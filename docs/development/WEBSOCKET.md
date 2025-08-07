# Real-time WebSocket Updates

This implementation provides real-time updates for all entities in the Backstage IDP wrapper using WebSockets.

## Features

- **Real-time Service Updates**: Live updates when services are created, updated, or deleted
- **Live Metrics**: Real-time CPU, memory, requests, errors, and response time metrics
- **Deployment Notifications**: Live deployment status updates with notifications
- **Health Monitoring**: Real-time health status changes
- **Connection Management**: Automatic reconnection with exponential backoff
- **Mock Development Server**: Simulated real-time updates for development and testing

## Architecture

### Components

1. **WebSocketService** (`src/lib/websocket/WebSocketService.ts`)
 - Core WebSocket connection management
 - Message handling and routing
 - Reconnection logic
 - Mock connection simulation for development

2. **React Hooks** (`src/hooks/useWebSocket.ts`)
 - `useWebSocketConnection()` - Connection status management
 - `useEntityUpdates()` - Real-time entity updates
 - `useMetricsUpdates(entityRef)` - Live metrics for specific entities
 - `useDeploymentUpdates(entityRef)` - Deployment status updates
 - `useHealthUpdates(entityRef)` - Health status changes
 - `useCatalogUpdates()` - Catalog-wide updates

3. **Context Provider** (`src/contexts/WebSocketContext.tsx`)
 - Global WebSocket state management
 - User preferences for enabling/disabling real-time updates
 - Status indicator component

4. **Mock Server** (`src/lib/websocket/mockServer.ts`)
 - Development-time simulation of real-time updates
 - Automatic periodic updates for testing

## Usage

### Basic Setup

The WebSocket provider is automatically included in the application providers:

```tsx
// Already configured in src/components/providers/Providers.tsx
<WebSocketProvider>
 <YourApp />
</WebSocketProvider>
```

### Using Real-time Updates in Components

```tsx
import { useMetricsUpdates, useDeploymentUpdates } from '@/hooks/useWebSocket';

function ServiceDetail({ entityRef }: { entityRef: string }) {
 const { metrics, lastUpdated } = useMetricsUpdates(entityRef);
 const { deployments, lastDeployment } = useDeploymentUpdates(entityRef);

 useEffect(() => {
 if (lastDeployment) {
 toast.success(`Deployment ${lastDeployment.version} completed!`);
 }
 }, [lastDeployment]);

 return (
 <div>
 {metrics && (
 <div>
 <p>CPU: {metrics.cpu.toFixed(1)}%</p>
 <p>Memory: {metrics.memory.toFixed(1)}%</p>
 <p>Last updated: {lastUpdated}</p>
 </div>
 )}
 </div>
 );
}
```

### Connection Status

The WebSocket status indicator is automatically shown in the application header:

```tsx
import { WebSocketStatusIndicator } from '@/contexts/WebSocketContext';

// Already included in AppShell
<WebSocketStatusIndicator />
```

## Development Mode

In development mode, the system automatically uses a mock WebSocket server that simulates real-time updates:

- **Metrics Updates**: Every 3-5 seconds for common services
- **Entity Updates**: Every 30 seconds with random service updates
- **Deployment Events**: Every minute with simulated deployment flows
- **Health Changes**: Every 45 seconds with random health status changes

The mock server provides realistic data patterns for testing the real-time UI updates.

## Production Setup

For production, you'll need to set up a real WebSocket server that connects to your Backstage backend:

1. **Environment Variables**:
 ```env
 WEBSOCKET_PORT=4401 # Optional: Custom WebSocket port
 ```

2. **WebSocket Server**: Implement a WebSocket server that:
 - Connects to Backstage's event stream
 - Transforms Backstage events to the expected format
 - Handles client subscriptions and unsubscriptions

3. **Message Format**: The server should send messages in this format:
 ```json
 {
 "type": "metrics_update|entity_update|deployment_update|health_update",
 "data": { /* type-specific data */ },
 "entityRef": "Component:default/service-name", // optional
 "timestamp": "2024-01-01T00:00:00.000Z"
 }
 ```

## Message Types

### Entity Updates
```json
{
 "type": "entity_update",
 "data": {
 "kind": "Component",
 "namespace": "default", 
 "name": "service-name",
 "changeType": "created|updated|deleted",
 "data": { /* full entity data */ }
 }
}
```

### Metrics Updates
```json
{
 "type": "metrics_update",
 "data": {
 "entityRef": "Component:default/service-name",
 "metrics": {
 "cpu": 45.2,
 "memory": 67.8,
 "requests": 1234,
 "errors": 5,
 "responseTime": 123.4
 }
 }
}
```

### Deployment Updates
```json
{
 "type": "deployment_update",
 "data": {
 "entityRef": "Component:default/service-name",
 "deployment": {
 "id": "deploy-123",
 "version": "v1.2.3",
 "environment": "production",
 "status": "success|failed|in_progress|rolled_back",
 "startTime": "2024-01-01T00:00:00.000Z",
 "endTime": "2024-01-01T00:05:00.000Z"
 }
 }
}
```

### Health Updates
```json
{
 "type": "health_update", 
 "data": {
 "entityRef": "Component:default/service-name",
 "health": {
 "level": "info|warning|error",
 "message": "Service is healthy",
 "timestamp": "2024-01-01T00:00:00.000Z"
 }
 }
}
```

## User Controls

Users can control real-time updates through:

1. **Status Indicator**: Shows connection status and allows toggling updates on/off
2. **Automatic Reconnection**: Handles connection drops with exponential backoff
3. **Preferences**: Settings are persisted in localStorage

## Integration Points

The WebSocket system is integrated into:

- **Service Catalog** (`src/app/catalog/page.tsx`): Live service updates and additions
- **Service Details** (`src/app/catalog/[...]/page.tsx`): Real-time metrics and deployments
- **Enhanced Overview Tab**: Live metrics and health status
- **Deployment Pipeline**: Real-time deployment status updates

## Performance Considerations

- **Selective Subscriptions**: Only subscribe to updates for entities being viewed
- **Debounced Updates**: UI updates are debounced to prevent excessive re-renders 
- **Connection Pooling**: Single WebSocket connection shared across all components
- **Memory Management**: Automatic cleanup of subscriptions when components unmount

## Testing

The mock server provides comprehensive test scenarios:

1. **Happy Path**: Regular metrics updates and successful deployments
2. **Error Scenarios**: Failed deployments and health issues
3. **Edge Cases**: Connection drops, rapid updates, and data inconsistencies
4. **Performance**: High-frequency updates to test UI responsiveness

## Future Enhancements

- **GraphQL Subscriptions**: Integration with Backstage's GraphQL API
- **Event Sourcing**: Full event history and replay capabilities 
- **Filtering**: User-defined filters for update types
- **Batching**: Efficient batching of multiple updates
- **Compression**: WebSocket message compression for better performance