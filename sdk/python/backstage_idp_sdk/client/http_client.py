"""HTTP client for Backstage IDP SDK."""

import asyncio
import time
from typing import Any, Dict, Optional, Union, List
from urllib.parse import urljoin

import httpx
from tenacity import (
    retry, 
    stop_after_attempt, 
    wait_exponential,
    retry_if_exception_type,
    RetryError as TenacityRetryError
)

from ..auth.auth_manager import AuthManager
from ..types import ClientConfig, RequestOptions
from ..exceptions import (
    BackstageSDKError,
    NetworkError,
    TimeoutError,
    CircuitBreakerError,
    create_error_from_response,
    is_retryable_error
)


class CircuitBreaker:
    """Simple circuit breaker implementation."""
    
    def __init__(self, failure_threshold: int = 5, timeout: float = 60.0, recovery_timeout: float = 30.0):
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time = 0
        self.state = "closed"  # closed, open, half_open

    async def call(self, func, *args, **kwargs):
        """Execute function with circuit breaker protection."""
        if self.state == "open":
            if time.time() - self.last_failure_time > self.timeout:
                self.state = "half_open"
            else:
                raise CircuitBreakerError("Circuit breaker is open")

        try:
            result = await func(*args, **kwargs)
            if self.state == "half_open":
                self.reset()
            return result
        except Exception as e:
            self.record_failure()
            raise e

    def record_failure(self):
        """Record a failure."""
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        if self.failure_count >= self.failure_threshold:
            self.state = "open"

    def reset(self):
        """Reset circuit breaker."""
        self.failure_count = 0
        self.state = "closed"
        self.last_failure_time = 0


class RateLimiter:
    """Token bucket rate limiter."""
    
    def __init__(self, requests_per_second: float, burst_size: int):
        self.requests_per_second = requests_per_second
        self.burst_size = burst_size
        self.tokens = burst_size
        self.last_update = time.time()
        self.lock = asyncio.Lock()

    async def acquire(self):
        """Acquire a token for making a request."""
        async with self.lock:
            now = time.time()
            # Add tokens based on elapsed time
            elapsed = now - self.last_update
            self.tokens = min(
                self.burst_size, 
                self.tokens + elapsed * self.requests_per_second
            )
            self.last_update = now
            
            if self.tokens >= 1:
                self.tokens -= 1
                return
            
            # Wait for next token
            wait_time = (1 - self.tokens) / self.requests_per_second
            await asyncio.sleep(wait_time)
            self.tokens = 0


class HttpClient:
    """HTTP client with retry, circuit breaker, and rate limiting."""
    
    def __init__(self, config: ClientConfig, auth_manager: Optional[AuthManager] = None):
        self.config = config
        self.auth_manager = auth_manager
        
        # Initialize HTTP client
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(config.timeout or 30.0),
            verify=config.verify_ssl,
            headers={
                "User-Agent": "backstage-idp-sdk-python/1.0.0",
                "Accept": "application/json",
                "Content-Type": "application/json"
            }
        )
        
        # Initialize circuit breaker
        self.circuit_breaker = CircuitBreaker()
        
        # Initialize rate limiter if configured
        self.rate_limiter: Optional[RateLimiter] = None
        if hasattr(config, 'rate_limit') and config.rate_limit:
            self.rate_limiter = RateLimiter(
                requests_per_second=config.rate_limit['requests'] / 60.0,  # Convert per minute to per second
                burst_size=min(config.rate_limit['requests'], 10)
            )

    async def request(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        json: Optional[Any] = None,
        data: Optional[Any] = None,
        headers: Optional[Dict[str, str]] = None,
        options: Optional[RequestOptions] = None
    ) -> Any:
        """Make HTTP request with retry and error handling."""
        
        # Apply rate limiting
        if self.rate_limiter:
            await self.rate_limiter.acquire()
            
        # Prepare request
        url = urljoin(self.config.base_url, path.lstrip('/'))
        request_headers = dict(self.client.headers)
        
        # Add auth header
        if self.auth_manager:
            try:
                auth_header = self.auth_manager.get_auth_header()
                if auth_header:
                    if auth_header.startswith('Bearer'):
                        request_headers['Authorization'] = auth_header
                    else:
                        request_headers['X-API-Key'] = auth_header
            except Exception:
                # Continue without auth if token refresh fails
                pass
                
        # Add custom headers
        if headers:
            request_headers.update(headers)
            
        # Add request ID for tracing
        request_headers['X-Request-ID'] = self._generate_request_id()
        
        # Configure retry
        retry_decorator = retry(
            stop=stop_after_attempt(self.config.retries or 3),
            wait=wait_exponential(
                multiplier=self.config.retry_delay or 1.0,
                max=30
            ),
            retry=retry_if_exception_type((httpx.RequestError, httpx.TimeoutException)),
            reraise=True
        )
        
        @retry_decorator
        async def _make_request():
            return await self.circuit_breaker.call(
                self._execute_request,
                method=method,
                url=url,
                params=params,
                json=json,
                data=data,
                headers=request_headers,
                timeout=options.timeout if options else None
            )
            
        try:
            return await _make_request()
        except TenacityRetryError as e:
            # Get the original exception
            original_error = e.last_attempt.exception()
            raise self._transform_error(original_error)
        except Exception as e:
            raise self._transform_error(e)

    async def _execute_request(
        self,
        method: str,
        url: str,
        params: Optional[Dict[str, Any]] = None,
        json: Optional[Any] = None,
        data: Optional[Any] = None,
        headers: Optional[Dict[str, str]] = None,
        timeout: Optional[float] = None
    ) -> Any:
        """Execute the actual HTTP request."""
        
        timeout_config = httpx.Timeout(timeout) if timeout else None
        
        try:
            response = await self.client.request(
                method=method,
                url=url,
                params=params,
                json=json,
                data=data,
                headers=headers,
                timeout=timeout_config
            )
            
            # Handle authentication errors with token refresh
            if response.status_code == 401 and self.auth_manager:
                try:
                    await self.auth_manager.refresh_token()
                    # Retry request with new token
                    auth_header = self.auth_manager.get_auth_header()
                    if auth_header:
                        if auth_header.startswith('Bearer'):
                            headers = headers or {}
                            headers['Authorization'] = auth_header
                        else:
                            headers = headers or {}
                            headers['X-API-Key'] = auth_header
                            
                    response = await self.client.request(
                        method=method,
                        url=url,
                        params=params,
                        json=json,
                        data=data,
                        headers=headers,
                        timeout=timeout_config
                    )
                except Exception:
                    # If refresh fails, continue with original response
                    pass
            
            # Check for error responses
            if response.status_code >= 400:
                try:
                    error_data = response.json()
                except Exception:
                    error_data = {
                        'error': 'HTTP_ERROR',
                        'message': f'HTTP {response.status_code}: {response.reason_phrase}'
                    }
                
                raise create_error_from_response(error_data, response.status_code)
            
            # Return JSON response or empty dict for 204 No Content
            if response.status_code == 204:
                return {}
                
            try:
                return response.json()
            except Exception:
                # Return text content if not JSON
                return response.text
                
        except httpx.TimeoutException as e:
            raise TimeoutError(f"Request timeout: {e}")
        except httpx.RequestError as e:
            raise NetworkError(f"Network error: {e}")

    async def get(
        self,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        options: Optional[RequestOptions] = None
    ) -> Any:
        """Make GET request."""
        return await self.request("GET", path, params=params, headers=headers, options=options)

    async def post(
        self,
        path: str,
        json: Optional[Any] = None,
        data: Optional[Any] = None,
        headers: Optional[Dict[str, str]] = None,
        options: Optional[RequestOptions] = None
    ) -> Any:
        """Make POST request."""
        return await self.request("POST", path, json=json, data=data, headers=headers, options=options)

    async def put(
        self,
        path: str,
        json: Optional[Any] = None,
        data: Optional[Any] = None,
        headers: Optional[Dict[str, str]] = None,
        options: Optional[RequestOptions] = None
    ) -> Any:
        """Make PUT request."""
        return await self.request("PUT", path, json=json, data=data, headers=headers, options=options)

    async def patch(
        self,
        path: str,
        json: Optional[Any] = None,
        data: Optional[Any] = None,
        headers: Optional[Dict[str, str]] = None,
        options: Optional[RequestOptions] = None
    ) -> Any:
        """Make PATCH request."""
        return await self.request("PATCH", path, json=json, data=data, headers=headers, options=options)

    async def delete(
        self,
        path: str,
        headers: Optional[Dict[str, str]] = None,
        options: Optional[RequestOptions] = None
    ) -> Any:
        """Make DELETE request."""
        return await self.request("DELETE", path, headers=headers, options=options)

    def get_circuit_breaker_status(self) -> Dict[str, Any]:
        """Get circuit breaker status."""
        return {
            "state": self.circuit_breaker.state,
            "failures": self.circuit_breaker.failure_count,
            "last_failure": self.circuit_breaker.last_failure_time
        }

    def reset_circuit_breaker(self):
        """Reset circuit breaker."""
        self.circuit_breaker.reset()

    def _generate_request_id(self) -> str:
        """Generate unique request ID."""
        return f"req_{int(time.time() * 1000)}_{id(self) % 10000:04d}"

    def _transform_error(self, error: Exception) -> BackstageSDKError:
        """Transform exception to SDK error."""
        if isinstance(error, BackstageSDKError):
            return error
            
        if isinstance(error, httpx.TimeoutException):
            return TimeoutError(f"Request timeout: {error}")
        elif isinstance(error, httpx.RequestError):
            return NetworkError(f"Network error: {error}")
        else:
            return BackstageSDKError(f"Unexpected error: {error}")

    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()