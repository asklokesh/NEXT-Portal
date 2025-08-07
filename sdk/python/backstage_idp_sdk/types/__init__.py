"""Type definitions for Backstage IDP SDK."""

from typing import Any, Dict, List, Optional, Union, Literal
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from enum import Enum

# Configuration Types
class ClientConfig(BaseModel):
    """Client configuration."""
    model_config = ConfigDict(extra='forbid')
    
    base_url: str = Field(..., description="Base URL for the API")
    api_key: Optional[str] = Field(None, description="API key for authentication")
    bearer_token: Optional[str] = Field(None, description="Bearer token for authentication")
    timeout: Optional[float] = Field(30.0, description="Request timeout in seconds")
    retries: Optional[int] = Field(3, description="Number of retries for failed requests")
    retry_delay: Optional[float] = Field(1.0, description="Delay between retries in seconds")
    verify_ssl: bool = Field(True, description="Whether to verify SSL certificates")


class AuthConfig(BaseModel):
    """Authentication configuration."""
    model_config = ConfigDict(extra='forbid')
    
    base_url: str
    api_key: Optional[str] = None
    bearer_token: Optional[str] = None
    refresh_token: Optional[str] = None
    auto_refresh: bool = True


# API Response Types
class ApiResponse(BaseModel):
    """Base API response model."""
    model_config = ConfigDict(extra='allow')
    
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    message: Optional[str] = None
    timestamp: datetime


class PaginatedResponse(BaseModel):
    """Paginated response model."""
    model_config = ConfigDict(extra='allow')
    
    items: List[Any]
    total: int
    limit: int
    offset: int
    has_more: bool


# Health Check Types
class ServiceStatus(str, Enum):
    """Service status enumeration."""
    OK = "ok"
    DEGRADED = "degraded"
    ERROR = "error"


class ServiceHealth(BaseModel):
    """Service health information."""
    model_config = ConfigDict(extra='allow')
    
    status: ServiceStatus
    message: str
    response_time: Optional[float] = Field(None, alias="responseTime")
    details: Optional[Dict[str, Any]] = None


class HealthCheck(BaseModel):
    """System health check response."""
    model_config = ConfigDict(extra='allow')
    
    status: ServiceStatus
    timestamp: datetime
    version: str
    uptime: int
    services: Dict[str, ServiceHealth]
    environment: Optional[Dict[str, Any]] = None


# Tenant Types
class TenantStatus(str, Enum):
    """Tenant status enumeration."""
    ACTIVE = "active"
    SUSPENDED = "suspended" 
    PENDING = "pending"


class Tenant(BaseModel):
    """Tenant information."""
    model_config = ConfigDict(extra='allow')
    
    id: str
    name: str
    domain: str
    status: TenantStatus
    settings: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(alias="createdAt")
    updated_at: Optional[datetime] = Field(None, alias="updatedAt")


class TenantAnalytics(BaseModel):
    """Tenant analytics data."""
    model_config = ConfigDict(extra='allow')
    
    user_count: int = Field(alias="userCount")
    plugin_count: int = Field(alias="pluginCount")
    workflow_count: int = Field(alias="workflowCount")
    api_requests: int = Field(alias="apiRequests")
    storage_used: int = Field(alias="storageUsed")
    period: str


class TenantRequest(BaseModel):
    """Tenant creation/update request."""
    model_config = ConfigDict(extra='allow')
    
    action: Literal["create", "update", "suspend", "activate"]
    name: Optional[str] = None
    domain: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None


# Plugin Types
class PluginStatus(str, Enum):
    """Plugin status enumeration."""
    AVAILABLE = "available"
    INSTALLED = "installed"
    DEPRECATED = "deprecated"


class Plugin(BaseModel):
    """Plugin information."""
    model_config = ConfigDict(extra='allow')
    
    id: str
    name: str
    version: str
    description: Optional[str] = None
    author: Optional[str] = None
    category: Optional[str] = None
    status: PluginStatus
    dependencies: Optional[List[str]] = None
    config: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None
    install_date: Optional[datetime] = Field(None, alias="installDate")


class PluginInstallRequest(BaseModel):
    """Plugin installation request."""
    model_config = ConfigDict(extra='forbid')
    
    plugin_id: str = Field(alias="pluginId")
    version: Optional[str] = None
    config: Optional[Dict[str, Any]] = None


class PluginInstallResponse(BaseModel):
    """Plugin installation response."""
    model_config = ConfigDict(extra='allow')
    
    success: bool
    plugin_id: str = Field(alias="pluginId")
    installation_id: Optional[str] = Field(None, alias="installationId")
    status: str


# Workflow Types
class WorkflowStatus(str, Enum):
    """Workflow status enumeration."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class WorkflowStep(BaseModel):
    """Workflow step information."""
    model_config = ConfigDict(extra='allow')
    
    id: str
    name: str
    type: str
    status: WorkflowStatus
    config: Optional[Dict[str, Any]] = None
    output: Optional[Dict[str, Any]] = None


class Workflow(BaseModel):
    """Workflow information."""
    model_config = ConfigDict(extra='allow')
    
    id: str
    name: str
    description: Optional[str] = None
    status: WorkflowStatus
    config: Optional[Dict[str, Any]] = None
    steps: Optional[List[WorkflowStep]] = None
    created_at: datetime = Field(alias="createdAt")
    updated_at: Optional[datetime] = Field(None, alias="updatedAt")
    completed_at: Optional[datetime] = Field(None, alias="completedAt")


class WorkflowRequest(BaseModel):
    """Workflow creation request."""
    model_config = ConfigDict(extra='allow')
    
    name: str
    description: Optional[str] = None
    steps: List[WorkflowStep]
    config: Optional[Dict[str, Any]] = None


class WorkflowExecution(BaseModel):
    """Workflow execution information."""
    model_config = ConfigDict(extra='allow')
    
    execution_id: str = Field(alias="executionId")
    workflow_id: str = Field(alias="workflowId")
    status: WorkflowStatus
    started_at: datetime = Field(alias="startedAt")
    completed_at: Optional[datetime] = Field(None, alias="completedAt")
    result: Optional[Dict[str, Any]] = None


class WorkflowExecutionRequest(BaseModel):
    """Workflow execution request."""
    model_config = ConfigDict(extra='allow')
    
    parameters: Optional[Dict[str, Any]] = None


# Metrics Types
class SystemMetrics(BaseModel):
    """System metrics data."""
    model_config = ConfigDict(extra='allow')
    
    cpu: float
    memory: float
    disk: float
    uptime: int


class PerformanceMetrics(BaseModel):
    """Performance metrics data."""
    model_config = ConfigDict(extra='allow')
    
    average_response_time: float = Field(alias="averageResponseTime")
    requests_per_second: float = Field(alias="requestsPerSecond")
    error_rate: float = Field(alias="errorRate")


class UsageMetrics(BaseModel):
    """Usage metrics data."""
    model_config = ConfigDict(extra='allow')
    
    active_users: int = Field(alias="activeUsers")
    api_calls: int = Field(alias="apiCalls")
    plugins_installed: int = Field(alias="pluginsInstalled")
    workflows_executed: int = Field(alias="workflowsExecuted")


class MetricsData(BaseModel):
    """Metrics data container."""
    model_config = ConfigDict(extra='allow')
    
    system: Optional[SystemMetrics] = None
    performance: Optional[PerformanceMetrics] = None
    usage: Optional[UsageMetrics] = None


class Metrics(BaseModel):
    """Metrics response."""
    model_config = ConfigDict(extra='allow')
    
    timestamp: datetime
    timerange: str
    data: MetricsData


# Notification Types
class NotificationType(str, Enum):
    """Notification type enumeration."""
    INFO = "info"
    WARNING = "warning" 
    ERROR = "error"
    SUCCESS = "success"


class Notification(BaseModel):
    """Notification information."""
    model_config = ConfigDict(extra='allow')
    
    id: str
    title: str
    message: str
    type: NotificationType
    read: bool
    created_at: datetime = Field(alias="createdAt")
    metadata: Optional[Dict[str, Any]] = None


class NotificationRequest(BaseModel):
    """Notification creation request."""
    model_config = ConfigDict(extra='allow')
    
    title: str
    message: str
    type: NotificationType
    recipient_id: Optional[str] = Field(None, alias="recipientId")
    metadata: Optional[Dict[str, Any]] = None


# Search Types
class SearchResult(BaseModel):
    """Search result item."""
    model_config = ConfigDict(extra='allow')
    
    id: str
    title: str
    description: Optional[str] = None
    type: str
    url: Optional[str] = None
    score: float
    metadata: Optional[Dict[str, Any]] = None


class SearchResponse(BaseModel):
    """Search response."""
    model_config = ConfigDict(extra='allow')
    
    results: List[SearchResult]
    total: int
    query: str
    took: int


# Error Types
class SDKError(BaseModel):
    """SDK error information."""
    model_config = ConfigDict(extra='allow')
    
    code: str
    message: str
    details: Optional[Dict[str, Any]] = None
    status: Optional[int] = None
    timestamp: datetime


# Request Options
class RequestOptions(BaseModel):
    """Request options."""
    model_config = ConfigDict(extra='allow')
    
    timeout: Optional[float] = None
    retries: Optional[int] = None
    headers: Optional[Dict[str, str]] = None


# Query Parameters
class QueryParams(BaseModel):
    """Query parameters for list operations."""
    model_config = ConfigDict(extra='allow')
    
    search: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    limit: Optional[int] = None
    offset: Optional[int] = None
    sort: Optional[str] = None
    order: Optional[Literal["asc", "desc"]] = None


# Export all types
__all__ = [
    # Configuration
    "ClientConfig",
    "AuthConfig",
    "RequestOptions",
    "QueryParams",
    
    # Base types
    "ApiResponse",
    "PaginatedResponse",
    "SDKError",
    
    # Health types
    "ServiceStatus",
    "ServiceHealth", 
    "HealthCheck",
    
    # Tenant types
    "TenantStatus",
    "Tenant",
    "TenantAnalytics",
    "TenantRequest",
    
    # Plugin types
    "PluginStatus",
    "Plugin",
    "PluginInstallRequest",
    "PluginInstallResponse",
    
    # Workflow types
    "WorkflowStatus",
    "WorkflowStep",
    "Workflow",
    "WorkflowRequest",
    "WorkflowExecution", 
    "WorkflowExecutionRequest",
    
    # Metrics types
    "SystemMetrics",
    "PerformanceMetrics",
    "UsageMetrics",
    "MetricsData",
    "Metrics",
    
    # Notification types
    "NotificationType",
    "Notification",
    "NotificationRequest",
    
    # Search types
    "SearchResult",
    "SearchResponse",
]