"""Main Backstage client for Python SDK."""

from typing import Any, Dict, List, Optional, Union, Callable, AsyncGenerator
import asyncio
from datetime import datetime

from ..types import (
    ClientConfig,
    AuthConfig,
    RequestOptions,
    QueryParams,
    HealthCheck,
    Plugin,
    PluginInstallRequest,
    PluginInstallResponse,
    Workflow,
    WorkflowRequest,
    WorkflowExecution,
    WorkflowExecutionRequest,
    Tenant,
    TenantRequest,
    TenantAnalytics,
    Notification,
    NotificationRequest,
    Metrics,
    SearchResponse,
    PaginatedResponse
)
from ..auth.auth_manager import AuthManager, TokenInfo
from .http_client import HttpClient
from ..graphql.graphql_client import GraphQLClient
from ..websocket.websocket_client import WebSocketClient
from ..exceptions import BackstageSDKError, ConfigurationError


class SystemAPI:
    """System health and status operations."""
    
    def __init__(self, http_client: HttpClient):
        self._http = http_client

    async def get_health(self, verbose: bool = False, options: Optional[RequestOptions] = None) -> HealthCheck:
        """Get system health status."""
        params = {"verbose": verbose} if verbose else {}
        response = await self._http.get("/health", params=params, options=options)
        return HealthCheck.model_validate(response)

    async def get_metrics(
        self, 
        timerange: str = "1h", 
        format: str = "json",
        options: Optional[RequestOptions] = None
    ) -> Metrics:
        """Get system metrics."""
        params = {"timerange": timerange, "format": format}
        response = await self._http.get("/metrics", params=params, options=options)
        return Metrics.model_validate(response)


class TenantsAPI:
    """Tenant management operations."""
    
    def __init__(self, http_client: HttpClient):
        self._http = http_client

    async def get_current(self, options: Optional[RequestOptions] = None) -> Dict[str, Any]:
        """Get current tenant information."""
        params = {"action": "current"}
        return await self._http.get("/tenants", params=params, options=options)

    async def list(self, options: Optional[RequestOptions] = None) -> Dict[str, List[Tenant]]:
        """List user's tenants."""
        params = {"action": "list"}
        response = await self._http.get("/tenants", params=params, options=options)
        return {
            "tenants": [Tenant.model_validate(t) for t in response["tenants"]]
        }

    async def get_analytics(self, days: int = 30, options: Optional[RequestOptions] = None) -> Dict[str, TenantAnalytics]:
        """Get tenant analytics."""
        params = {"action": "analytics", "days": days}
        response = await self._http.get("/tenants", params=params, options=options)
        return {
            "analytics": TenantAnalytics.model_validate(response["analytics"])
        }

    async def create(self, request: TenantRequest, options: Optional[RequestOptions] = None) -> Tenant:
        """Create new tenant."""
        response = await self._http.post("/tenants", json=request.model_dump(), options=options)
        return Tenant.model_validate(response)

    async def update(self, request: TenantRequest, options: Optional[RequestOptions] = None) -> Tenant:
        """Update tenant."""
        response = await self._http.post("/tenants", json=request.model_dump(), options=options)
        return Tenant.model_validate(response)


class PluginsAPI:
    """Plugin management operations."""
    
    def __init__(self, http_client: HttpClient):
        self._http = http_client

    async def list(
        self, 
        params: Optional[QueryParams] = None,
        options: Optional[RequestOptions] = None
    ) -> PaginatedResponse[Plugin]:
        """List available plugins."""
        query_params = params.model_dump(exclude_none=True) if params else {}
        response = await self._http.get("/plugins", params=query_params, options=options)
        
        return PaginatedResponse(
            items=[Plugin.model_validate(p) for p in response["plugins"]],
            total=response["total"],
            limit=response["limit"],
            offset=response["offset"],
            has_more=response["offset"] + len(response["plugins"]) < response["total"]
        )

    async def get(self, plugin_id: str, options: Optional[RequestOptions] = None) -> Plugin:
        """Get plugin details."""
        response = await self._http.get(f"/plugins/{plugin_id}", options=options)
        return Plugin.model_validate(response)

    async def install(
        self, 
        request: PluginInstallRequest,
        options: Optional[RequestOptions] = None
    ) -> PluginInstallResponse:
        """Install plugin."""
        response = await self._http.post("/plugins", json=request.model_dump(), options=options)
        return PluginInstallResponse.model_validate(response)

    async def uninstall(self, plugin_id: str, options: Optional[RequestOptions] = None) -> None:
        """Uninstall plugin."""
        await self._http.delete(f"/plugins/{plugin_id}", options=options)

    async def search(
        self, 
        query: str, 
        category: Optional[str] = None,
        options: Optional[RequestOptions] = None
    ) -> PaginatedResponse[Plugin]:
        """Search plugins."""
        params = QueryParams(search=query, category=category)
        return await self.list(params, options)


class WorkflowsAPI:
    """Workflow management operations."""
    
    def __init__(self, http_client: HttpClient):
        self._http = http_client

    async def list(
        self, 
        params: Optional[QueryParams] = None,
        options: Optional[RequestOptions] = None
    ) -> PaginatedResponse[Workflow]:
        """List workflows."""
        query_params = params.model_dump(exclude_none=True) if params else {}
        response = await self._http.get("/workflows", params=query_params, options=options)
        
        return PaginatedResponse(
            items=[Workflow.model_validate(w) for w in response["workflows"]],
            total=response["total"],
            limit=params.limit if params else 50,
            offset=params.offset if params else 0,
            has_more=(params.offset if params else 0) + len(response["workflows"]) < response["total"]
        )

    async def get(self, workflow_id: str, options: Optional[RequestOptions] = None) -> Workflow:
        """Get workflow details."""
        response = await self._http.get(f"/workflows/{workflow_id}", options=options)
        return Workflow.model_validate(response)

    async def create(self, request: WorkflowRequest, options: Optional[RequestOptions] = None) -> Workflow:
        """Create workflow."""
        response = await self._http.post("/workflows", json=request.model_dump(), options=options)
        return Workflow.model_validate(response)

    async def update(
        self, 
        workflow_id: str, 
        request: WorkflowRequest,
        options: Optional[RequestOptions] = None
    ) -> Workflow:
        """Update workflow."""
        response = await self._http.put(f"/workflows/{workflow_id}", json=request.model_dump(), options=options)
        return Workflow.model_validate(response)

    async def execute(
        self,
        workflow_id: str,
        request: Optional[WorkflowExecutionRequest] = None,
        options: Optional[RequestOptions] = None
    ) -> WorkflowExecution:
        """Execute workflow."""
        payload = request.model_dump() if request else {}
        response = await self._http.post(f"/workflows/{workflow_id}/execute", json=payload, options=options)
        return WorkflowExecution.model_validate(response)

    async def delete(self, workflow_id: str, options: Optional[RequestOptions] = None) -> None:
        """Delete workflow."""
        await self._http.delete(f"/workflows/{workflow_id}", options=options)


class NotificationsAPI:
    """Notification management operations."""
    
    def __init__(self, http_client: HttpClient):
        self._http = http_client

    async def list(
        self,
        unread_only: bool = False,
        limit: int = 20,
        options: Optional[RequestOptions] = None
    ) -> Dict[str, Any]:
        """List notifications."""
        params = {"unread_only": unread_only, "limit": limit}
        response = await self._http.get("/notifications", params=params, options=options)
        
        return {
            "notifications": [Notification.model_validate(n) for n in response["notifications"]],
            "total": response["total"],
            "unreadCount": response.get("unreadCount", 0)
        }

    async def create(
        self, 
        request: NotificationRequest,
        options: Optional[RequestOptions] = None
    ) -> Notification:
        """Create notification."""
        response = await self._http.post("/notifications", json=request.model_dump(), options=options)
        return Notification.model_validate(response)

    async def mark_as_read(self, notification_id: str, options: Optional[RequestOptions] = None) -> None:
        """Mark notification as read."""
        await self._http.patch(f"/notifications/{notification_id}", json={"read": True}, options=options)


class EventsAPI:
    """Event subscription operations."""
    
    def __init__(self, websocket_client: Optional[WebSocketClient]):
        self._ws = websocket_client

    async def on_plugin_event(self, handler: Callable[[Dict[str, Any]], None]) -> Optional[str]:
        """Subscribe to plugin events."""
        if not self._ws:
            return None
        return await self._ws.subscribe(
            ["plugin.installed", "plugin.uninstalled", "plugin.updated"],
            handler
        )

    async def on_workflow_event(self, handler: Callable[[Dict[str, Any]], None]) -> Optional[str]:
        """Subscribe to workflow events."""
        if not self._ws:
            return None
        return await self._ws.subscribe(
            ["workflow.started", "workflow.completed", "workflow.failed"],
            handler
        )

    async def on_system_event(self, handler: Callable[[Dict[str, Any]], None]) -> Optional[str]:
        """Subscribe to system events."""
        if not self._ws:
            return None
        return await self._ws.subscribe(["system.health_change"], handler)

    async def unsubscribe(self, subscription_id: str) -> None:
        """Unsubscribe from events."""
        if self._ws:
            await self._ws.unsubscribe(subscription_id)


class AuthAPI:
    """Authentication operations."""
    
    def __init__(self, auth_manager: Optional[AuthManager]):
        self._auth = auth_manager

    def set_api_key(self, api_key: str) -> None:
        """Set API key for authentication."""
        if self._auth:
            token_info = TokenInfo(access_token=api_key, token_type="api_key")
            self._auth.set_tokens(token_info)

    def set_bearer_token(self, token: str, refresh_token: Optional[str] = None) -> None:
        """Set bearer token for authentication.""" 
        if self._auth:
            token_info = TokenInfo(
                access_token=token,
                refresh_token=refresh_token,
                token_type="bearer",
                expires_at=self._auth._extract_expiry_from_jwt(token)
            )
            self._auth.set_tokens(token_info)

    def clear_auth(self) -> None:
        """Clear authentication tokens."""
        if self._auth:
            self._auth.clear_tokens()

    def is_authenticated(self) -> bool:
        """Check if authenticated."""
        return self._auth.is_authenticated() if self._auth else False

    def get_access_token(self) -> Optional[str]:
        """Get current access token."""
        return self._auth.get_access_token() if self._auth else None


class BackstageClient:
    """Main Backstage client."""
    
    def __init__(self, config: ClientConfig):
        """Initialize Backstage client."""
        self.config = config
        
        # Initialize auth manager
        auth_config = None
        if config.api_key or config.bearer_token:
            auth_config = AuthConfig(
                base_url=config.base_url,
                api_key=config.api_key,
                bearer_token=config.bearer_token,
                auto_refresh=True
            )
            self._auth_manager = AuthManager(auth_config)
        else:
            self._auth_manager = None
        
        # Initialize HTTP client
        self._http_client = HttpClient(config, self._auth_manager)
        
        # Initialize GraphQL client
        self._graphql_client = GraphQLClient(config, self._auth_manager)
        
        # Initialize WebSocket client
        self._websocket_client = WebSocketClient(config, self._auth_manager)
        
        # Initialize API clients
        self.system = SystemAPI(self._http_client)
        self.tenants = TenantsAPI(self._http_client)
        self.plugins = PluginsAPI(self._http_client)
        self.workflows = WorkflowsAPI(self._http_client)
        self.notifications = NotificationsAPI(self._http_client)
        self.events = EventsAPI(self._websocket_client)
        self.auth = AuthAPI(self._auth_manager)

    async def connect(self) -> None:
        """Connect WebSocket client."""
        if self._websocket_client:
            await self._websocket_client.connect()

    async def disconnect(self) -> None:
        """Disconnect WebSocket client."""
        if self._websocket_client:
            await self._websocket_client.disconnect()

    async def search(
        self,
        query: str,
        type: Optional[str] = None,
        limit: int = 20,
        options: Optional[RequestOptions] = None
    ) -> SearchResponse:
        """Global search."""
        params = {"q": query, "limit": limit}
        if type:
            params["type"] = type
            
        response = await self._http_client.get("/search", params=params, options=options)
        return SearchResponse.model_validate(response)

    async def batch_execute(
        self,
        operations: List[Dict[str, Any]],
        options: Optional[RequestOptions] = None
    ) -> List[Any]:
        """Execute multiple operations in batch."""
        payload = {"operations": operations}
        return await self._http_client.post("/batch", json=payload, options=options)

    def get_connection_status(self) -> Dict[str, Any]:
        """Get connection status."""
        return {
            "http": True,  # HTTP client doesn't maintain persistent connection
            "websocket": self._websocket_client.get_status() if self._websocket_client else None,
            "auth": self.auth.is_authenticated()
        }

    def get_statistics(self) -> Dict[str, Any]:
        """Get client statistics."""
        return {
            "subscriptions": self._websocket_client.get_subscriptions_count() if self._websocket_client else 0,
            "circuit_breaker": self._http_client.get_circuit_breaker_status()
        }

    @property
    def graphql(self) -> GraphQLClient:
        """Access GraphQL client."""
        return self._graphql_client

    @property
    def websocket(self) -> Optional[WebSocketClient]:
        """Access WebSocket client."""
        return self._websocket_client

    async def close(self) -> None:
        """Close all connections and cleanup resources."""
        await asyncio.gather(
            self._http_client.close(),
            self._graphql_client.close(),
            self._websocket_client.close() if self._websocket_client else asyncio.sleep(0),
            self._auth_manager.close() if self._auth_manager else asyncio.sleep(0),
            return_exceptions=True
        )

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()