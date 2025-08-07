"""Authentication manager for Backstage IDP SDK."""

import asyncio
import time
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Callable
from urllib.parse import urljoin

import httpx
import jwt
from pydantic import BaseModel

from ..types import AuthConfig
from ..exceptions import AuthenticationError, ConfigurationError


class TokenInfo(BaseModel):
    """Token information."""
    access_token: str
    refresh_token: Optional[str] = None
    expires_at: Optional[datetime] = None
    token_type: str = "bearer"


class AuthManager:
    """Manages authentication tokens and refresh logic."""
    
    def __init__(
        self, 
        config: AuthConfig,
        on_token_refresh: Optional[Callable[[TokenInfo], None]] = None,
        on_auth_error: Optional[Callable[[Exception], None]] = None
    ):
        self.config = config
        self.on_token_refresh = on_token_refresh
        self.on_auth_error = on_auth_error
        
        self._token_info: Optional[TokenInfo] = None
        self._refresh_task: Optional[asyncio.Task] = None
        self._http_client = httpx.AsyncClient(timeout=30.0, verify=True)
        
        # Initialize with provided tokens
        if config.api_key:
            self._token_info = TokenInfo(
                access_token=config.api_key,
                token_type="api_key"
            )
        elif config.bearer_token:
            self._token_info = TokenInfo(
                access_token=config.bearer_token,
                refresh_token=config.refresh_token,
                token_type="bearer",
                expires_at=self._extract_expiry_from_jwt(config.bearer_token)
            )
            
        # Start auto-refresh if enabled and we have a refresh token
        if (config.auto_refresh and 
            self._token_info and 
            self._token_info.refresh_token and 
            self._token_info.expires_at):
            self._schedule_refresh()

    def _extract_expiry_from_jwt(self, token: str) -> Optional[datetime]:
        """Extract expiry time from JWT token."""
        try:
            # Decode without verification to get expiry
            payload = jwt.decode(token, options={"verify_signature": False})
            exp = payload.get('exp')
            if exp:
                return datetime.fromtimestamp(exp)
        except Exception:
            # Not a JWT or invalid format
            pass
        return None

    def get_access_token(self) -> Optional[str]:
        """Get current access token."""
        return self._token_info.access_token if self._token_info else None

    def get_auth_header(self) -> Optional[str]:
        """Get authorization header value."""
        if not self._token_info:
            return None
            
        if self._token_info.token_type == "api_key":
            return self._token_info.access_token
        else:
            return f"Bearer {self._token_info.access_token}"

    def is_authenticated(self) -> bool:
        """Check if currently authenticated."""
        return self._token_info is not None and self._is_token_valid()

    def _is_token_valid(self) -> bool:
        """Check if token is valid (not expired)."""
        if not self._token_info:
            return False
            
        # API keys don't expire
        if self._token_info.token_type == "api_key":
            return True
            
        # Check if bearer token is expired
        if self._token_info.expires_at:
            # Add 1 minute buffer
            return datetime.utcnow() < self._token_info.expires_at - timedelta(minutes=1)
            
        return True

    def set_tokens(self, token_info: TokenInfo) -> None:
        """Set authentication tokens."""
        self._token_info = token_info
        
        # Cancel existing refresh task
        if self._refresh_task:
            self._refresh_task.cancel()
            self._refresh_task = None
            
        # Schedule new refresh if needed
        if (self.config.auto_refresh and 
            token_info.refresh_token and 
            token_info.expires_at):
            self._schedule_refresh()
            
        # Notify callback
        if self.on_token_refresh:
            self.on_token_refresh(token_info)

    def clear_tokens(self) -> None:
        """Clear authentication tokens."""
        self._token_info = None
        
        if self._refresh_task:
            self._refresh_task.cancel()
            self._refresh_task = None

    async def refresh_token(self) -> TokenInfo:
        """Refresh access token using refresh token."""
        if not self._token_info or not self._token_info.refresh_token:
            raise AuthenticationError("No refresh token available")

        try:
            url = urljoin(self.config.base_url, "/auth/refresh")
            
            response = await self._http_client.post(
                url,
                json={"refresh_token": self._token_info.refresh_token},
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code != 200:
                raise AuthenticationError(
                    f"Token refresh failed: {response.status_code}",
                    status=response.status_code
                )
                
            data = response.json()
            
            # Create new token info
            new_token_info = TokenInfo(
                access_token=data["access_token"],
                refresh_token=data.get("refresh_token", self._token_info.refresh_token),
                token_type="bearer"
            )
            
            # Set expiry if provided
            if "expires_in" in data:
                new_token_info.expires_at = datetime.utcnow() + timedelta(
                    seconds=data["expires_in"]
                )
            elif "expires_at" in data:
                new_token_info.expires_at = datetime.fromisoformat(
                    data["expires_at"].replace('Z', '+00:00')
                )
            else:
                # Try to extract from JWT
                new_token_info.expires_at = self._extract_expiry_from_jwt(
                    new_token_info.access_token
                )
            
            self.set_tokens(new_token_info)
            return new_token_info
            
        except httpx.RequestError as e:
            error = AuthenticationError(f"Network error during token refresh: {e}")
            if self.on_auth_error:
                self.on_auth_error(error)
            raise error
        except Exception as e:
            error = AuthenticationError(f"Token refresh failed: {e}")
            if self.on_auth_error:
                self.on_auth_error(error)
            raise error

    async def ensure_valid_token(self) -> str:
        """Ensure token is valid, refresh if necessary."""
        if not self._token_info:
            raise AuthenticationError("No authentication tokens available")

        if self._is_token_valid():
            return self._token_info.access_token

        # Try to refresh if possible
        if self._token_info.refresh_token and self.config.auto_refresh:
            refreshed_token = await self.refresh_token()
            return refreshed_token.access_token

        raise AuthenticationError("Token expired and cannot be refreshed")

    def _schedule_refresh(self) -> None:
        """Schedule automatic token refresh."""
        if not self._token_info or not self._token_info.expires_at:
            return
            
        # Calculate when to refresh (5 minutes before expiry)
        refresh_time = self._token_info.expires_at - timedelta(minutes=5)
        delay = (refresh_time - datetime.utcnow()).total_seconds()
        
        if delay > 0:
            self._refresh_task = asyncio.create_task(self._auto_refresh(delay))

    async def _auto_refresh(self, delay: float) -> None:
        """Automatically refresh token after delay."""
        try:
            await asyncio.sleep(delay)
            await self.refresh_token()
        except asyncio.CancelledError:
            pass
        except Exception as e:
            if self.on_auth_error:
                self.on_auth_error(e)

    async def close(self) -> None:
        """Close the auth manager and cleanup resources."""
        if self._refresh_task:
            self._refresh_task.cancel()
            try:
                await self._refresh_task
            except asyncio.CancelledError:
                pass
                
        await self._http_client.aclose()

    def __del__(self):
        """Cleanup when object is destroyed."""
        if hasattr(self, '_refresh_task') and self._refresh_task:
            self._refresh_task.cancel()