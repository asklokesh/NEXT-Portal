/**
 * Service Topology Visualization Plugin
 * Advanced interactive service topology and architecture visualization for Backstage
 */

import {
  createPlugin,
  createRoutableExtension,
  createComponentExtension,
  createApiFactory,
  discoveryApiRef,
  identityApiRef,
  fetchApiRef
} from '@backstage/core-plugin-api';
import { rootRouteRef } from './routes';

// Export the main plugin
export const serviceTopologyVizPlugin = createPlugin({
  id: 'service-topology-viz',
  routes: {
    root: rootRouteRef,
  },
  apis: [
    createApiFactory({
      api: topologyApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        identityApi: identityApiRef,
        fetchApi: fetchApiRef,
      },
      factory: ({ discoveryApi, identityApi, fetchApi }) =>
        new TopologyApiClient({ discoveryApi, identityApi, fetchApi }),
    }),
  ],
});

// Main page extension
export const ServiceTopologyPage = serviceTopologyVizPlugin.provide(
  createRoutableExtension({
    name: 'ServiceTopologyPage',
    component: () =>
      import('./components/ServiceTopologyVisualization').then(m => m.ServiceTopologyVisualization),
    mountPoint: rootRouteRef,
  }),
);

// Card component for entity pages
export const ServiceTopologyCard = serviceTopologyVizPlugin.provide(
  createComponentExtension({
    name: 'ServiceTopologyCard',
    component: {
      lazy: () =>
        import('./components/ServiceTopologyCard').then(m => m.ServiceTopologyCard),
    },
  }),
);

// Mini visualization widget
export const ServiceTopologyWidget = serviceTopologyVizPlugin.provide(
  createComponentExtension({
    name: 'ServiceTopologyWidget',
    component: {
      lazy: () =>
        import('./components/ServiceTopologyWidget').then(m => m.ServiceTopologyWidget),
    },
  }),
);

// Export types
export * from './types';

// Export services
export { VisualizationEngine } from './services/VisualizationEngine';
export { DependencyAnalyzer } from './services/DependencyAnalyzer';
export { RealtimeDataService } from './services/RealtimeDataService';

// Export store
export { useTopologyStore } from './store/useTopologyStore';

// Export components
export { ServiceTopologyVisualization } from './components/ServiceTopologyVisualization';
export { ServiceDetailsPanel } from './components/ServiceDetailsPanel';
export { MetricsOverlay } from './components/MetricsOverlay';
export { TimelineControls } from './components/TimelineControls';
export { FilterPanel } from './components/FilterPanel';
export { SearchBar } from './components/SearchBar';
export { MiniMap } from './components/MiniMap';
export { LegendPanel } from './components/LegendPanel';
export { PathFinderDialog } from './components/PathFinderDialog';
export { ImpactAnalysisDialog } from './components/ImpactAnalysisDialog';

// Export hooks
export { useTopologyData } from './hooks/useTopologyData';
export { useVisualizationEngine } from './hooks/useVisualizationEngine';
export { useRealtimeUpdates } from './hooks/useRealtimeUpdates';
export { useDependencyAnalysis } from './hooks/useDependencyAnalysis';
export { useTopologyFilters } from './hooks/useTopologyFilters';
export { useTopologySearch } from './hooks/useTopologySearch';
export { useTopologyExport } from './hooks/useTopologyExport';

// Export utilities
export { GraphAlgorithms } from './utils/GraphAlgorithms';
export { LayoutAlgorithms } from './utils/LayoutAlgorithms';
export { MetricsCalculator } from './utils/MetricsCalculator';
export { TopologyExporter } from './utils/TopologyExporter';
export { PerformanceOptimizer } from './utils/PerformanceOptimizer';
export { ColorSchemes } from './utils/ColorSchemes';

// Export API
export { TopologyApiClient } from './api/TopologyApiClient';
export { topologyApiRef } from './api/topologyApiRef';