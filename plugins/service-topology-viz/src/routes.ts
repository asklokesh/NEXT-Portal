/**
 * Service Topology Visualization Plugin Routes
 */

import { createRouteRef, createSubRouteRef } from '@backstage/core-plugin-api';

export const rootRouteRef = createRouteRef({
  id: 'service-topology-viz',
});

export const serviceDetailsRouteRef = createSubRouteRef({
  id: 'service-topology-viz:service-details',
  parent: rootRouteRef,
  path: '/service/:serviceId',
});

export const pathAnalysisRouteRef = createSubRouteRef({
  id: 'service-topology-viz:path-analysis',
  parent: rootRouteRef,
  path: '/analysis/path',
});

export const impactAnalysisRouteRef = createSubRouteRef({
  id: 'service-topology-viz:impact-analysis', 
  parent: rootRouteRef,
  path: '/analysis/impact/:serviceId',
});

export const dependencyAnalysisRouteRef = createSubRouteRef({
  id: 'service-topology-viz:dependency-analysis',
  parent: rootRouteRef,
  path: '/analysis/dependencies',
});

export const historyRouteRef = createSubRouteRef({
  id: 'service-topology-viz:history',
  parent: rootRouteRef,
  path: '/history',
});