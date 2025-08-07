/**
 * Topology API Reference
 */

import { createApiRef } from '@backstage/core-plugin-api';
import { TopologyApiClient } from './TopologyApiClient';

export const topologyApiRef = createApiRef<TopologyApiClient>({
  id: 'plugin.service-topology-viz',
});