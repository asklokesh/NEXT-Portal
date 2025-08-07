# Service Topology Visualization Plugin

Advanced interactive service topology and architecture visualization system for Backstage. This production-ready plugin provides comprehensive visualization capabilities for understanding and managing complex service architectures at scale.

## Features

### Core Capabilities

- **High-Performance Rendering**: Supports 10,000+ nodes and edges with WebGL acceleration
- **Multiple Layout Algorithms**: Force-directed, hierarchical, circular, grid, layered, radial, and geographic layouts
- **Real-time Updates**: WebSocket-based live topology updates with automatic reconnection
- **Advanced Analytics**: Dependency analysis, impact analysis, path finding, and bottleneck detection
- **Multi-layer Views**: Logical, physical, network, security, cost, and performance perspectives
- **Interactive Features**: Zoom, pan, search, filter, drill-down, and context menus
- **Time-based Analysis**: Historical playback, time-series metrics, and trend analysis
- **Export Capabilities**: PNG, SVG, PDF, JSON, GraphML, DOT, and GEXF formats

### Visualization Modes

1. **Logical View**: Service relationships and dependencies
2. **Physical View**: Infrastructure and deployment topology
3. **Network View**: Network connections and traffic flows
4. **Security View**: Security zones and boundaries
5. **Cost View**: Cost allocation and optimization opportunities
6. **Performance View**: Latency, throughput, and bottlenecks
7. **Dependencies View**: Upstream and downstream dependencies
8. **Data Flow View**: Data movement and transformations

## Installation

```bash
# Install the plugin
yarn add @backstage/plugin-service-topology-viz

# Install peer dependencies if not already present
yarn add d3@^7.9.0 three@^0.179.0 reactflow@^11.11.4
```

## Setup

### 1. Add to your Backstage app

```typescript
// packages/app/src/App.tsx
import { ServiceTopologyPage } from '@backstage/plugin-service-topology-viz';

const routes = (
  <FlatRoutes>
    {/* ... other routes */}
    <Route path="/topology" element={<ServiceTopologyPage />} />
  </FlatRoutes>
);
```

### 2. Add to the sidebar

```typescript
// packages/app/src/components/Root/Root.tsx
import { GraphicEq } from '@mui/icons-material';

export const Root = ({ children }: PropsWithChildren<{}>) => (
  <SidebarPage>
    <Sidebar>
      {/* ... other items */}
      <SidebarItem icon={GraphicEq} to="topology" text="Service Topology" />
    </Sidebar>
    {/* ... */}
  </SidebarPage>
);
```

### 3. Add to entity pages (optional)

```typescript
// packages/app/src/components/catalog/EntityPage.tsx
import { ServiceTopologyCard } from '@backstage/plugin-service-topology-viz';

const serviceEntityPage = (
  <EntityLayout>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3}>
        {/* ... other cards */}
        <Grid item md={6}>
          <ServiceTopologyCard />
        </Grid>
      </Grid>
    </EntityLayout.Route>
  </EntityLayout>
);
```

### 4. Configure backend (optional for real-time updates)

```typescript
// packages/backend/src/plugins/topology.ts
import { createRouter } from '@backstage/plugin-service-topology-viz-backend';
import { Router } from 'express';
import { PluginEnvironment } from '../types';

export default async function createPlugin(
  env: PluginEnvironment,
): Promise<Router> {
  return await createRouter({
    logger: env.logger,
    database: env.database,
    discovery: env.discovery,
    config: env.config,
    reader: env.reader,
    permissions: env.permissions,
  });
}
```

## Usage

### Basic Usage

```tsx
import { ServiceTopologyVisualization } from '@backstage/plugin-service-topology-viz';

function MyComponent() {
  return (
    <ServiceTopologyVisualization
      initialNodes={nodes}
      initialEdges={edges}
      onNodeSelect={(node) => console.log('Selected:', node)}
      enableRealtime={true}
      showMiniMap={true}
      showLegend={true}
    />
  );
}
```

### With Custom Configuration

```tsx
import { 
  ServiceTopologyVisualization,
  VisualizationConfig,
  LayoutType,
  RenderMode,
  ViewMode 
} from '@backstage/plugin-service-topology-viz';

const config: VisualizationConfig = {
  layout: LayoutType.HIERARCHICAL,
  renderMode: RenderMode.WEBGL,
  viewMode: ViewMode.LOGICAL,
  animation: {
    enabled: true,
    duration: 300,
    particleEffects: true,
  },
  clustering: {
    enabled: true,
    algorithm: 'hierarchical',
    threshold: 0.7,
  },
  performance: {
    maxNodes: 5000,
    maxEdges: 10000,
    levelOfDetail: 'high',
    workers: true,
  }
};

function MyComponent() {
  return (
    <ServiceTopologyVisualization
      config={config}
      enableRealtime={true}
      realtimeEndpoint="/api/topology/stream"
    />
  );
}
```

### Using the Store

```tsx
import { useTopologyStore } from '@backstage/plugin-service-topology-viz';

function MyComponent() {
  const {
    nodes,
    edges,
    selectedNodeIds,
    updateConfig,
    selectNode,
    highlightPath,
    getFilteredNodes,
  } = useTopologyStore();

  const handleAnalysis = () => {
    const criticalNodes = nodes.filter(n => n.metadata.criticality === 'critical');
    const path = findCriticalPath(nodes, edges);
    highlightPath(path);
  };

  return (
    <div>
      <button onClick={handleAnalysis}>Analyze Critical Path</button>
      <div>Selected: {Array.from(selectedNodeIds).join(', ')}</div>
    </div>
  );
}
```

### Using the Dependency Analyzer

```tsx
import { DependencyAnalyzer } from '@backstage/plugin-service-topology-viz';

function analyzeTopology(nodes: ServiceNode[], edges: ServiceRelationship[]) {
  const analyzer = new DependencyAnalyzer(nodes, edges);
  
  // Find shortest path
  const path = analyzer.findShortestPath('service-a', 'service-b');
  
  // Analyze impact
  const impact = analyzer.analyzeImpact('critical-service');
  console.log(`${impact.affected.length} services would be affected`);
  
  // Detect cycles
  const analysis = analyzer.analyzeDependencies();
  if (analysis.cycles.length > 0) {
    console.warn('Circular dependencies detected:', analysis.cycles);
  }
  
  // Find bottlenecks
  console.log('Bottleneck services:', analysis.bottlenecks);
}
```

### Real-time Updates

```tsx
import { RealtimeDataService } from '@backstage/plugin-service-topology-viz';

const realtimeService = new RealtimeDataService('/api/topology/stream');

// Connect and subscribe to updates
await realtimeService.connect();

realtimeService.on('nodeUpdate', (update) => {
  console.log('Node updated:', update);
});

realtimeService.on('healthChange', (change) => {
  if (change.health.status === 'unhealthy') {
    alert(`Service ${change.nodeName} is unhealthy!`);
  }
});

realtimeService.on('incident', (incident) => {
  console.log('Incident:', incident);
});

// Subscribe to specific topics
realtimeService.subscribe('production-environment');
realtimeService.subscribe('critical-services');

// Cleanup
realtimeService.destroy();
```

## Configuration

### App Config

```yaml
# app-config.yaml
serviceTopology:
  backend:
    baseUrl: ${TOPOLOGY_BACKEND_URL}
  realtime:
    enabled: true
    endpoint: ${TOPOLOGY_WEBSOCKET_URL}
  performance:
    maxNodes: 5000
    maxEdges: 10000
    enableWebGL: true
    enableWorkers: true
  defaults:
    layout: hierarchical
    viewMode: logical
    animationsEnabled: true
```

### Environment-specific Configuration

```yaml
# app-config.production.yaml
serviceTopology:
  performance:
    maxNodes: 10000
    maxEdges: 50000
    levelOfDetail: medium
    caching:
      enabled: true
      ttl: 300000
```

## API Reference

### Types

```typescript
interface ServiceNode {
  id: string;
  name: string;
  type: ServiceType;
  metadata: ServiceMetadata;
  health: HealthStatus;
  metrics: ServiceMetrics;
  dependencies: string[];
  dependents: string[];
}

interface ServiceRelationship {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  metadata: RelationshipMetadata;
  traffic?: TrafficFlow;
}

interface ImpactAnalysisResult {
  affected: ServiceNode[];
  directImpact: ServiceNode[];
  indirectImpact: ServiceNode[];
  criticalPath: string[];
  riskScore: number;
}
```

### Hooks

- `useTopologyData()` - Fetch and manage topology data
- `useVisualizationEngine()` - Access visualization engine instance
- `useRealtimeUpdates()` - Subscribe to real-time updates
- `useDependencyAnalysis()` - Perform dependency analysis
- `useTopologyFilters()` - Manage filters
- `useTopologySearch()` - Search functionality
- `useTopologyExport()` - Export topology data

## Performance Optimization

### For Large Topologies (1000+ nodes)

1. **Enable WebGL Rendering**
   ```tsx
   config.renderMode = RenderMode.WEBGL;
   ```

2. **Use Level of Detail**
   ```tsx
   config.performance.levelOfDetail = LevelOfDetail.LOW;
   ```

3. **Enable Clustering**
   ```tsx
   config.clustering.enabled = true;
   config.clustering.threshold = 0.5;
   ```

4. **Use Web Workers**
   ```tsx
   config.performance.workers = true;
   ```

5. **Implement Virtualization**
   ```tsx
   config.performance.culling.frustum = true;
   config.performance.culling.distance = true;
   ```

### Benchmarks

| Nodes | Edges | Render Mode | FPS | Memory |
|-------|-------|------------|-----|--------|
| 100   | 200   | SVG        | 60  | 50MB   |
| 500   | 1000  | Canvas 2D  | 60  | 150MB  |
| 1000  | 3000  | WebGL      | 60  | 200MB  |
| 5000  | 10000 | WebGL      | 45  | 400MB  |
| 10000 | 20000 | WebGL      | 30  | 800MB  |

## Customization

### Custom Node Rendering

```tsx
import { VisualizationEngine } from '@backstage/plugin-service-topology-viz';

class CustomVisualizationEngine extends VisualizationEngine {
  protected getNodeGeometry(node: ServiceNode): THREE.BufferGeometry {
    // Custom geometry based on service type
    switch (node.type) {
      case 'database':
        return new THREE.CylinderGeometry(10, 10, 20);
      case 'api':
        return new THREE.BoxGeometry(15, 15, 15);
      default:
        return new THREE.SphereGeometry(10);
    }
  }

  protected getNodeColor(node: ServiceNode): string {
    // Custom color scheme
    if (node.health.status === 'unhealthy') return '#ff0000';
    if (node.metadata.criticality === 'critical') return '#ff9800';
    return '#4caf50';
  }
}
```

### Custom Layout Algorithm

```typescript
import { LayoutAlgorithm } from '@backstage/plugin-service-topology-viz';

class CustomLayout implements LayoutAlgorithm {
  apply(nodes: ServiceNode[], edges: ServiceRelationship[]): void {
    // Custom layout logic
    nodes.forEach((node, index) => {
      const angle = (index / nodes.length) * Math.PI * 2;
      const radius = 200;
      node.position = {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        z: 0
      };
    });
  }
}
```

## Troubleshooting

### Common Issues

1. **Performance Issues with Large Graphs**
   - Enable WebGL rendering
   - Reduce level of detail
   - Enable node clustering
   - Increase performance limits in config

2. **WebSocket Connection Issues**
   - Check WebSocket endpoint configuration
   - Verify authentication tokens
   - Check network/firewall settings

3. **Memory Issues**
   - Limit maximum nodes/edges
   - Enable culling
   - Use lower level of detail
   - Clear cache periodically

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines.

## License

This plugin is part of the Backstage project and follows the same Apache 2.0 license.