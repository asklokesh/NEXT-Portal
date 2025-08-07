"""Exception classes for Backstage IDP SDK."""

from typing import Any, Dict, Optional


class BackstageSDKError(Exception):
    """Base exception for all SDK errors."""
    
    def __init__(
        self, 
        message: str,
        code: Optional[str] = None,
        status: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.message = message
        self.code = code or 'SDK_ERROR'
        self.status = status
        self.details = details or {}

    def __str__(self) -> str:
        if self.status:
            return f"[{self.code}] {self.message} (HTTP {self.status})"
        return f"[{self.code}] {self.message}"

    def __repr__(self) -> str:
        return f"BackstageSDKError(message='{self.message}', code='{self.code}', status={self.status})"


class AuthenticationError(BackstageSDKError):
    """Authentication related errors."""
    
    def __init__(self, message: str = "Authentication failed", **kwargs):
        super().__init__(message, code="AUTH_ERROR", status=401, **kwargs)


class AuthorizationError(BackstageSDKError):
    """Authorization related errors."""
    
    def __init__(self, message: str = "Insufficient permissions", **kwargs):
        super().__init__(message, code="AUTHORIZATION_ERROR", status=403, **kwargs)


class NotFoundError(BackstageSDKError):
    """Resource not found errors."""
    
    def __init__(self, message: str = "Resource not found", **kwargs):
        super().__init__(message, code="NOT_FOUND", status=404, **kwargs)


class ValidationError(BackstageSDKError):
    """Request validation errors."""
    
    def __init__(self, message: str = "Invalid request data", **kwargs):
        super().__init__(message, code="VALIDATION_ERROR", status=400, **kwargs)


class RateLimitError(BackstageSDKError):
    """Rate limit exceeded errors."""
    
    def __init__(self, message: str = "Rate limit exceeded", **kwargs):
        super().__init__(message, code="RATE_LIMIT_ERROR", status=429, **kwargs)


class ServerError(BackstageSDKError):
    """Server-side errors."""
    
    def __init__(self, message: str = "Internal server error", **kwargs):
        super().__init__(message, code="SERVER_ERROR", status=500, **kwargs)


class NetworkError(BackstageSDKError):
    """Network related errors."""
    
    def __init__(self, message: str = "Network error", **kwargs):
        super().__init__(message, code="NETWORK_ERROR", **kwargs)


class TimeoutError(BackstageSDKError):
    """Request timeout errors."""
    
    def __init__(self, message: str = "Request timeout", **kwargs):
        super().__init__(message, code="TIMEOUT_ERROR", **kwargs)


class ConfigurationError(BackstageSDKError):
    """Configuration related errors."""
    
    def __init__(self, message: str = "Invalid configuration", **kwargs):
        super().__init__(message, code="CONFIG_ERROR", **kwargs)


class WebSocketError(BackstageSDKError):
    """WebSocket related errors."""
    
    def __init__(self, message: str = "WebSocket error", **kwargs):
        super().__init__(message, code="WEBSOCKET_ERROR", **kwargs)


class GraphQLError(BackstageSDKError):
    """GraphQL related errors."""
    
    def __init__(self, message: str = "GraphQL error", **kwargs):
        super().__init__(message, code="GRAPHQL_ERROR", **kwargs)


class CircuitBreakerError(BackstageSDKError):
    """Circuit breaker related errors."""
    
    def __init__(self, message: str = "Circuit breaker is open", **kwargs):
        super().__init__(message, code="CIRCUIT_BREAKER_ERROR", **kwargs)


class RetryError(BackstageSDKError):
    """Retry exhausted errors."""
    
    def __init__(self, message: str = "Maximum retries exceeded", **kwargs):
        super().__init__(message, code="RETRY_ERROR", **kwargs)


# Utility functions for error handling
def create_error_from_response(response_data: Dict[str, Any], status: int) -> BackstageSDKError:
    """Create appropriate error from API response."""
    message = response_data.get('message', 'Unknown error')
    code = response_data.get('error', 'API_ERROR')
    details = response_data.get('details', {})
    
    # Map status codes to specific exceptions
    error_map = {
        400: ValidationError,
        401: AuthenticationError,
        403: AuthorizationError,
        404: NotFoundError,
        429: RateLimitError,
        500: ServerError,
        502: ServerError,
        503: ServerError,
        504: TimeoutError,
    }
    
    error_class = error_map.get(status, BackstageSDKError)
    return error_class(message=message, code=code, status=status, details=details)


def is_retryable_error(error: Exception) -> bool:
    """Check if an error is retryable."""
    if isinstance(error, BackstageSDKError):
        # Retry on server errors, timeouts, and network errors
        retryable_codes = {
            'SERVER_ERROR',
            'TIMEOUT_ERROR', 
            'NETWORK_ERROR',
            'CIRCUIT_BREAKER_ERROR'
        }
        return error.code in retryable_codes or (error.status and error.status >= 500)
    
    # Retry on network-related exceptions
    return isinstance(error, (ConnectionError, TimeoutError))


__all__ = [
    'BackstageSDKError',
    'AuthenticationError',
    'AuthorizationError', 
    'NotFoundError',
    'ValidationError',
    'RateLimitError',
    'ServerError',
    'NetworkError',
    'TimeoutError',
    'ConfigurationError',
    'WebSocketError',
    'GraphQLError',
    'CircuitBreakerError',
    'RetryError',
    'create_error_from_response',
    'is_retryable_error',
]