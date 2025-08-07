import { NextRequest, NextResponse } from 'next/server';
import { CatalogGraphEngine } from '@/lib/catalog-graph/engine';
import { GraphFilterEngine } from '@/lib/catalog-graph/filters';
import { GraphLayoutEngine } from '@/lib/catalog-graph/layouts';
import { GraphMetricsEngine } from '@/lib/catalog-graph/metrics';
import { GraphHealthMonitor } from '@/lib/catalog-graph/health';
import type { 
  GraphFilter, 
  GraphLayout, 
  GraphExportOptions,
  DependencyGraph,
} from '@/lib/catalog-graph/types';

// Mock entity data - in production, this would come from Backstage catalog
const mockEntities = [
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'user-service',
      uid: 'component:default/user-service',
      description: 'User management service',
      tags: ['backend', 'authentication'],
    },
    spec: {
      type: 'service',
      lifecycle: 'production',
      owner: 'platform-team',
      system: 'user-management',
      dependsOn: ['user-database', 'auth-service'],
      providesApis: ['user-api'],
    },
  },
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'auth-service',
      uid: 'component:default/auth-service',
      description: 'Authentication and authorization service',
      tags: ['backend', 'security'],
    },
    spec: {
      type: 'service',
      lifecycle: 'production',
      owner: 'security-team',
      system: 'user-management',
      dependsOn: ['auth-database', 'redis-cache'],
      providesApis: ['auth-api'],
    },
  },
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Resource',
    metadata: {
      name: 'user-database',
      uid: 'resource:default/user-database',
      description: 'PostgreSQL database for user data',
    },
    spec: {
      type: 'database',
      lifecycle: 'production',
      owner: 'platform-team',
      system: 'user-management',
    },
  },
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Resource',
    metadata: {
      name: 'auth-database',
      uid: 'resource:default/auth-database',
      description: 'PostgreSQL database for authentication data',
    },
    spec: {
      type: 'database',
      lifecycle: 'production',
      owner: 'security-team',
      system: 'user-management',
    },
  },
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Resource',
    metadata: {
      name: 'redis-cache',
      uid: 'resource:default/redis-cache',
      description: 'Redis cache for session storage',
    },
    spec: {
      type: 'cache',
      lifecycle: 'production',
      owner: 'platform-team',
      system: 'user-management',
    },
  },
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'API',
    metadata: {
      name: 'user-api',
      uid: 'api:default/user-api',
      description: 'RESTful API for user operations',
    },
    spec: {
      type: 'openapi',
      lifecycle: 'production',
      owner: 'platform-team',
      system: 'user-management',
      definition: {
        $text: 'https://example.com/user-api/openapi.yaml',
      },
    },
  },
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'API',
    metadata: {
      name: 'auth-api',
      uid: 'api:default/auth-api',
      description: 'Authentication API',
    },
    spec: {
      type: 'openapi',
      lifecycle: 'production',
      owner: 'security-team',
      system: 'user-management',
      definition: {
        $text: 'https://example.com/auth-api/openapi.yaml',
      },
    },
  },
  // Add more mock services for a more complex graph
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'order-service',
      uid: 'component:default/order-service',
      description: 'Order processing service',
      tags: ['backend', 'orders'],
    },
    spec: {
      type: 'service',
      lifecycle: 'production',
      owner: 'commerce-team',
      system: 'order-management',
      dependsOn: ['order-database', 'payment-service', 'inventory-service'],
      consumesApis: ['user-api', 'payment-api'],
    },
  },
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'payment-service',
      uid: 'component:default/payment-service',
      description: 'Payment processing service',
      tags: ['backend', 'payments'],
    },
    spec: {
      type: 'service',
      lifecycle: 'production',
      owner: 'payments-team',
      system: 'payment-system',
      dependsOn: ['payment-database'],
      providesApis: ['payment-api'],
    },
  },
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'inventory-service',
      uid: 'component:default/inventory-service',
      description: 'Inventory management service',
      tags: ['backend', 'inventory'],
    },
    spec: {
      type: 'service',
      lifecycle: 'production',
      owner: 'commerce-team',
      system: 'inventory-system',
      dependsOn: ['inventory-database'],
      providesApis: ['inventory-api'],
    },
  },
];

const graphEngine = new CatalogGraphEngine();
const filterEngine = new GraphFilterEngine();
const layoutEngine = new GraphLayoutEngine();
const metricsEngine = new GraphMetricsEngine();
const healthMonitor = new GraphHealthMonitor();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const includeMetrics = searchParams.get('includeMetrics') === 'true';
    const includeHealth = searchParams.get('includeHealth') === 'true';
    const applyLayout = searchParams.get('applyLayout') === 'true';
    
    // Parse filter parameters
    const filter: Partial<GraphFilter> = {
      nodeTypes: searchParams.get('nodeTypes')?.split(',').filter(Boolean) || [],
      edgeTypes: searchParams.get('edgeTypes')?.split(',').filter(Boolean) as any[] || [],
      owners: searchParams.get('owners')?.split(',').filter(Boolean) || [],
      systems: searchParams.get('systems')?.split(',').filter(Boolean) || [],
      lifecycles: searchParams.get('lifecycles')?.split(',').filter(Boolean) as any[] || [],
      searchQuery: searchParams.get('searchQuery') || '',
      showOrphans: searchParams.get('showOrphans') !== 'false',
      maxDepth: searchParams.get('maxDepth') ? parseInt(searchParams.get('maxDepth')!) : undefined,
      focusNode: searchParams.get('focusNode') || undefined,
      healthRange: {
        min: parseInt(searchParams.get('healthMin') || '0'),
        max: parseInt(searchParams.get('healthMax') || '100'),
      },
    };

    // Parse layout parameters
    const layout: GraphLayout = {
      type: (searchParams.get('layoutType') as any) || 'force',
      parameters: {
        width: parseInt(searchParams.get('width') || '1200'),
        height: parseInt(searchParams.get('height') || '800'),
        iterations: parseInt(searchParams.get('iterations') || '100'),
      },
    };

    // Build the graph
    let graph = await graphEngine.buildGraph(mockEntities);

    // Apply filters if any are specified
    const hasFilters = Object.values(filter).some(value => 
      value !== undefined && 
      value !== '' && 
      (Array.isArray(value) ? value.length > 0 : true)
    );

    if (hasFilters) {
      const completeFilter: GraphFilter = {
        nodeTypes: filter.nodeTypes || [],
        edgeTypes: filter.edgeTypes || [],
        owners: filter.owners || [],
        systems: filter.systems || [],
        lifecycles: filter.lifecycles || [],
        healthRange: filter.healthRange || { min: 0, max: 100 },
        searchQuery: filter.searchQuery || '',
        showOrphans: filter.showOrphans !== false,
        maxDepth: filter.maxDepth,
        focusNode: filter.focusNode,
      };
      
      graph = filterEngine.applyFilter(graph, completeFilter);
    }

    // Apply layout if requested
    if (applyLayout) {
      graph = layoutEngine.applyLayout(graph, layout);
    }

    // Prepare response data
    const responseData: any = {
      graph,
      timestamp: new Date().toISOString(),
    };

    // Include metrics if requested
    if (includeMetrics) {
      const metrics = metricsEngine.calculateMetrics(graph);
      const analytics = await graphEngine.analyzeGraph(graph);
      
      responseData.metrics = metrics;
      responseData.analytics = analytics;
    }

    // Include health data if requested
    if (includeHealth) {
      // Perform health check
      await healthMonitor.performHealthCheck(graph);
      
      responseData.health = {
        summary: healthMonitor.getHealthSummary(),
        nodeHealth: Object.fromEntries(
          graph.nodes.map(node => [node.id, healthMonitor.getNodeHealth(node.id)])
        ),
        alerts: healthMonitor.getActiveAlerts(),
      };
    }

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error generating catalog graph:', error);
    return NextResponse.json(
      { error: 'Failed to generate catalog graph' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { entities, options = {} } = body;

    if (!entities || !Array.isArray(entities)) {
      return NextResponse.json(
        { error: 'Invalid request: entities array is required' },
        { status: 400 }
      );
    }

    // Build graph from provided entities
    let graph = await graphEngine.buildGraph(entities);

    // Apply options
    if (options.filter) {
      graph = filterEngine.applyFilter(graph, options.filter);
    }

    if (options.layout) {
      graph = layoutEngine.applyLayout(graph, options.layout);
    }

    // Prepare response
    const responseData: any = { graph };

    if (options.includeMetrics) {
      responseData.metrics = metricsEngine.calculateMetrics(graph);
      responseData.analytics = await graphEngine.analyzeGraph(graph);
    }

    if (options.includeHealth) {
      await healthMonitor.performHealthCheck(graph);
      responseData.health = {
        summary: healthMonitor.getHealthSummary(),
        nodeHealth: Object.fromEntries(
          graph.nodes.map(node => [node.id, healthMonitor.getNodeHealth(node.id)])
        ),
        alerts: healthMonitor.getActiveAlerts(),
      };
    }

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error processing catalog graph request:', error);
    return NextResponse.json(
      { error: 'Failed to process catalog graph request' },
      { status: 500 }
    );
  }
}