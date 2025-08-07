// Import stub implementation
import * as metricsStub from './metrics-stub';

// Export the stub by default
export const { 
 register,
 Counter,
 Histogram,
 Gauge,
 httpRequestDuration,
 httpRequestTotal,
 httpRequestErrors,
 apiCallDuration,
 apiCallTotal,
 apiCallErrors,
 dbQueryDuration,
 dbQueryTotal,
 dbConnectionPool,
 cacheHits,
 cacheMisses,
 cacheLatency,
 wsConnections,
 wsMessages,
 wsErrors,
 servicesTotal,
 servicesHealthy,
 servicesDegraded,
 pluginsInstalled,
 pluginsEnabled,
 pluginErrors
} = metricsStub;