"""Backstage IDP Python SDK.

A comprehensive Python SDK for interacting with the Backstage Developer Portal.
Provides REST API, GraphQL, and WebSocket clients with full type safety.
"""

from ._version import __version__, __version_info__
from .client.backstage_client import BackstageClient
from .client.http_client import HttpClient
from .graphql.graphql_client import GraphQLClient
from .websocket.websocket_client import WebSocketClient
from .auth.auth_manager import AuthManager
from .types import *
from .exceptions import *

# Factory functions
from .factory import (
    create_client,
    create_client_with_api_key,
    create_client_with_token,
    create_production_client,
    create_dev_client,
)

# Testing utilities
from .testing import MockBackstageClient, create_mock_client

__all__ = [
    # Version info
    "__version__",
    "__version_info__",
    
    # Main client classes
    "BackstageClient",
    "HttpClient", 
    "GraphQLClient",
    "WebSocketClient",
    "AuthManager",
    
    # Factory functions
    "create_client",
    "create_client_with_api_key", 
    "create_client_with_token",
    "create_production_client",
    "create_dev_client",
    
    # Testing
    "MockBackstageClient",
    "create_mock_client",
]