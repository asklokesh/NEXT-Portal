// Stub implementation for metrics when prom-client is not available

export const register = {
 metrics: async () => 'Metrics collection disabled',
 contentType: 'text/plain'
};

export const Counter = class {
 inc() {}
 labels() { return this; }
};

export const Histogram = class {
 observe() {}
 labels() { return this; }
};

export const Gauge = class {
 set() {}
 inc() {}
 dec() {}
 labels() { return this; }
};

// HTTP metrics stubs
export const httpRequestDuration = new Histogram();
export const httpRequestTotal = new Counter();
export const httpRequestErrors = new Counter();

// API metrics stubs
export const apiCallDuration = new Histogram();
export const apiCallTotal = new Counter();
export const apiCallErrors = new Counter();

// Database metrics stubs
export const dbQueryDuration = new Histogram();
export const dbQueryTotal = new Counter();
export const dbConnectionPool = new Gauge();

// Cache metrics stubs
export const cacheHits = new Counter();
export const cacheMisses = new Counter();
export const cacheLatency = new Histogram();

// WebSocket metrics stubs
export const wsConnections = new Gauge();
export const wsMessages = new Counter();
export const wsErrors = new Counter();

// Service metrics stubs
export const servicesTotal = new Gauge();
export const servicesHealthy = new Gauge();
export const servicesDegraded = new Gauge();

// Plugin metrics stubs
export const pluginsInstalled = new Gauge();
export const pluginsEnabled = new Gauge();
export const pluginErrors = new Counter();