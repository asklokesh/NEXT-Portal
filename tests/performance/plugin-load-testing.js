import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const pluginInstallationRate = new Rate('plugin_installation_success_rate');
const pluginInstallationDuration = new Trend('plugin_installation_duration');
const pluginMarketplaceLoadTime = new Trend('plugin_marketplace_load_time');
const concurrentOperationsCount = new Counter('concurrent_operations_count');

// Performance SLA targets
const PERFORMANCE_THRESHOLDS = {
  marketplace_load_time: 3000,      // 3 seconds max
  plugin_installation: 30000,      // 30 seconds max
  configuration_save: 2000,        // 2 seconds max
  search_response: 1000,           // 1 second max
  health_check: 500,               // 500ms max
  error_rate: 0.05                 // 5% max error rate
};

// Test configuration
export const options = {
  stages: [
    // Warm-up
    { duration: '2m', target: 10 },   // Ramp up to 10 users
    { duration: '5m', target: 10 },   // Stay at 10 users
    
    // Load testing
    { duration: '5m', target: 50 },   // Ramp up to 50 users
    { duration: '10m', target: 50 },  // Stay at 50 users
    
    // Stress testing
    { duration: '5m', target: 100 },  // Ramp up to 100 users
    { duration: '10m', target: 100 }, // Stay at 100 users
    
    // Peak testing
    { duration: '2m', target: 200 },  // Spike to 200 users
    { duration: '3m', target: 200 },  // Stay at peak
    
    // Cool down
    { duration: '5m', target: 0 },    // Ramp down
  ],
  
  thresholds: {
    http_req_duration: [`p(95)<${PERFORMANCE_THRESHOLDS.marketplace_load_time}`],
    http_req_failed: [`rate<${PERFORMANCE_THRESHOLDS.error_rate}`],
    plugin_installation_duration: [`p(95)<${PERFORMANCE_THRESHOLDS.plugin_installation}`],
    plugin_marketplace_load_time: [`p(95)<${PERFORMANCE_THRESHOLDS.marketplace_load_time}`],
  },
  
  ext: {
    loadimpact: {
      projectID: 3596490,
      name: 'Plugin Management Load Test'
    }
  }
};

// Base URL - configurable via environment
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4400';

// Test data
const TEST_PLUGINS = [
  {
    id: '@backstage/plugin-catalog',
    name: 'Service Catalog',
    category: 'catalog'
  },
  {
    id: '@backstage/plugin-scaffolder',
    name: 'Software Templates', 
    category: 'scaffolder'
  },
  {
    id: '@backstage/plugin-techdocs',
    name: 'TechDocs',
    category: 'docs'
  },
  {
    id: '@backstage/plugin-kubernetes',
    name: 'Kubernetes',
    category: 'infrastructure'
  },
  {
    id: '@backstage/plugin-cost-insights',
    name: 'Cost Insights',
    category: 'cost-management'
  }
];

const SEARCH_QUERIES = [
  'catalog',
  'kubernetes', 
  'documentation',
  'monitoring',
  'security',
  'ci/cd',
  'scaffolder',
  'analytics'
];

const CATEGORIES = [
  'all',
  'catalog',
  'ci-cd', 
  'monitoring',
  'infrastructure',
  'analytics',
  'security',
  'documentation'
];

// Setup function - runs once per VU
export function setup() {
  // Authenticate if needed
  const authResponse = http.post(`${BASE_URL}/api/auth/login`, {
    username: 'test-user',
    password: 'test-password'
  });
  
  return {
    authToken: authResponse.json('token')
  };
}

// Main test scenarios
export default function(data) {
  const scenarios = [
    pluginMarketplaceBrowsing,
    pluginSearchAndFiltering,
    pluginInstallationWorkflow,
    pluginConfigurationOperations,
    concurrentPluginOperations,
    pluginMonitoringAndHealth
  ];
  
  // Randomly select a scenario for this iteration
  const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
  scenario(data);
  
  // Small delay between iterations
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

function pluginMarketplaceBrowsing(data) {
  const startTime = new Date();
  
  // Load plugin marketplace
  const marketplaceResponse = http.get(`${BASE_URL}/api/plugins`, {
    headers: {
      'Authorization': `Bearer ${data.authToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  const marketplaceLoadTime = new Date() - startTime;
  pluginMarketplaceLoadTime.add(marketplaceLoadTime);
  
  check(marketplaceResponse, {
    'marketplace loads successfully': (r) => r.status === 200,
    'marketplace response time acceptable': () => marketplaceLoadTime < PERFORMANCE_THRESHOLDS.marketplace_load_time,
    'marketplace returns plugin data': (r) => {
      const body = r.json();
      return body.plugins && Array.isArray(body.plugins);
    }
  });
  
  // Browse plugin categories
  const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  const categoryResponse = http.get(`${BASE_URL}/api/plugins?category=${category}`, {
    headers: {
      'Authorization': `Bearer ${data.authToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  check(categoryResponse, {
    'category filtering works': (r) => r.status === 200,
    'filtered results returned': (r) => {
      const body = r.json();
      return body.plugins !== undefined;
    }
  });
  
  concurrentOperationsCount.add(1);
}

function pluginSearchAndFiltering(data) {
  const query = SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)];
  const startTime = new Date();
  
  // Perform plugin search
  const searchResponse = http.get(`${BASE_URL}/api/plugins/search?q=${query}`, {
    headers: {
      'Authorization': `Bearer ${data.authToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  const searchTime = new Date() - startTime;
  
  check(searchResponse, {
    'search executes successfully': (r) => r.status === 200,
    'search response time acceptable': () => searchTime < PERFORMANCE_THRESHOLDS.search_response,
    'search returns results': (r) => {
      const body = r.json();
      return body.plugins && Array.isArray(body.plugins);
    }
  });
  
  // Test advanced filtering
  const filterParams = new URLSearchParams({
    category: 'catalog',
    tags: 'components,services',
    sort: 'popularity'
  });
  
  const filterResponse = http.get(`${BASE_URL}/api/plugins?${filterParams}`, {
    headers: {
      'Authorization': `Bearer ${data.authToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  check(filterResponse, {
    'advanced filtering works': (r) => r.status === 200,
    'filter parameters applied': (r) => {
      const body = r.json();
      return body.plugins !== undefined;
    }
  });
  
  concurrentOperationsCount.add(1);
}

function pluginInstallationWorkflow(data) {
  const plugin = TEST_PLUGINS[Math.floor(Math.random() * TEST_PLUGINS.length)];
  const installationStartTime = new Date();
  
  // Start plugin installation
  const installResponse = http.post(`${BASE_URL}/api/plugins`, 
    JSON.stringify({
      action: 'install',
      pluginId: plugin.id,
      environment: 'kubernetes',
      config: {
        enabled: true,
        replicas: 1
      }
    }), 
    {
      headers: {
        'Authorization': `Bearer ${data.authToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  const installStartSuccess = check(installResponse, {
    'installation starts successfully': (r) => r.status === 200,
    'installation ID returned': (r) => {
      const body = r.json();
      return body.installId !== undefined;
    }
  });
  
  if (!installStartSuccess) {
    pluginInstallationRate.add(0);
    return;
  }
  
  const installId = installResponse.json('installId');
  let installationComplete = false;
  let pollCount = 0;
  const maxPolls = 60; // 60 polls = 2 minutes max
  
  // Poll installation status
  while (!installationComplete && pollCount < maxPolls) {
    sleep(2); // Poll every 2 seconds
    pollCount++;
    
    const statusResponse = http.get(`${BASE_URL}/api/plugin-installer?installId=${installId}`, {
      headers: {
        'Authorization': `Bearer ${data.authToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (statusResponse.status === 200) {
      const status = statusResponse.json();
      
      if (status.status === 'running') {
        installationComplete = true;
        const installationDuration = new Date() - installationStartTime;
        pluginInstallationDuration.add(installationDuration);
        pluginInstallationRate.add(1);
      } else if (status.status === 'failed') {
        pluginInstallationRate.add(0);
        break;
      }
    }
  }
  
  if (!installationComplete) {
    pluginInstallationRate.add(0);
  }
  
  concurrentOperationsCount.add(1);
}

function pluginConfigurationOperations(data) {
  const plugin = TEST_PLUGINS[Math.floor(Math.random() * TEST_PLUGINS.length)];
  const configStartTime = new Date();
  
  // Get plugin configuration schema
  const schemaResponse = http.get(`${BASE_URL}/api/plugins/${encodeURIComponent(plugin.id)}/schema`, {
    headers: {
      'Authorization': `Bearer ${data.authToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  check(schemaResponse, {
    'schema retrieved successfully': (r) => r.status === 200,
    'schema contains properties': (r) => {
      const schema = r.json();
      return schema.properties !== undefined;
    }
  });
  
  // Update plugin configuration
  const configData = {
    enabled: true,
    settings: {
      title: 'Load Test Configuration',
      description: 'Configuration created during load test',
      features: ['catalog', 'search']
    }
  };
  
  const configResponse = http.post(`${BASE_URL}/api/plugins`, 
    JSON.stringify({
      action: 'configure',
      pluginId: plugin.id,
      config: configData
    }), 
    {
      headers: {
        'Authorization': `Bearer ${data.authToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  const configTime = new Date() - configStartTime;
  
  check(configResponse, {
    'configuration saved successfully': (r) => r.status === 200,
    'configuration save time acceptable': () => configTime < PERFORMANCE_THRESHOLDS.configuration_save,
    'configuration response valid': (r) => {
      const body = r.json();
      return body.success === true;
    }
  });
  
  concurrentOperationsCount.add(1);
}

function concurrentPluginOperations(data) {
  // Simulate multiple concurrent operations
  const operations = [];
  
  // Add plugin browsing operation
  operations.push(
    http.get(`${BASE_URL}/api/plugins`, {
      headers: { 'Authorization': `Bearer ${data.authToken}` }
    })
  );
  
  // Add plugin search operation
  const query = SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)];
  operations.push(
    http.get(`${BASE_URL}/api/plugins/search?q=${query}`, {
      headers: { 'Authorization': `Bearer ${data.authToken}` }
    })
  );
  
  // Add plugin health check
  const plugin = TEST_PLUGINS[Math.floor(Math.random() * TEST_PLUGINS.length)];
  operations.push(
    http.get(`${BASE_URL}/api/plugins/${encodeURIComponent(plugin.id)}/health`, {
      headers: { 'Authorization': `Bearer ${data.authToken}` }
    })
  );
  
  // Execute operations concurrently
  const responses = http.batch(operations);
  
  check(responses[0], {
    'concurrent marketplace load successful': (r) => r.status === 200
  });
  
  check(responses[1], {
    'concurrent search successful': (r) => r.status === 200
  });
  
  check(responses[2], {
    'concurrent health check successful': (r) => r.status === 200 || r.status === 404 // 404 if plugin not installed
  });
  
  concurrentOperationsCount.add(3); // 3 concurrent operations
}

function pluginMonitoringAndHealth(data) {
  const plugin = TEST_PLUGINS[Math.floor(Math.random() * TEST_PLUGINS.length)];
  const healthStartTime = new Date();
  
  // Check plugin health
  const healthResponse = http.get(`${BASE_URL}/api/plugins/${encodeURIComponent(plugin.id)}/health`, {
    headers: {
      'Authorization': `Bearer ${data.authToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  const healthTime = new Date() - healthStartTime;
  
  check(healthResponse, {
    'health check responds quickly': () => healthTime < PERFORMANCE_THRESHOLDS.health_check,
    'health check response valid': (r) => r.status === 200 || r.status === 404 // 404 if not installed
  });
  
  // Get plugin metrics
  const metricsResponse = http.get(`${BASE_URL}/api/plugins/${encodeURIComponent(plugin.id)}/metrics`, {
    headers: {
      'Authorization': `Bearer ${data.authToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  check(metricsResponse, {
    'metrics endpoint accessible': (r) => r.status === 200 || r.status === 404
  });
  
  // Check plugin logs
  const logsResponse = http.get(`${BASE_URL}/api/plugins/${encodeURIComponent(plugin.id)}/logs?lines=10`, {
    headers: {
      'Authorization': `Bearer ${data.authToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  check(logsResponse, {
    'logs endpoint accessible': (r) => r.status === 200 || r.status === 404
  });
  
  concurrentOperationsCount.add(1);
}

// Stress test scenario - maximum load
export function stressTest(data) {
  const operations = [];
  const operationCount = 10; // Perform 10 operations per iteration
  
  for (let i = 0; i < operationCount; i++) {
    const plugin = TEST_PLUGINS[Math.floor(Math.random() * TEST_PLUGINS.length)];
    const query = SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)];
    
    operations.push(
      http.get(`${BASE_URL}/api/plugins/search?q=${query}`, {
        headers: { 'Authorization': `Bearer ${data.authToken}` }
      })
    );
  }
  
  const responses = http.batch(operations);
  
  let successCount = 0;
  responses.forEach((response, index) => {
    if (response.status === 200) {
      successCount++;
    }
  });
  
  const successRate = successCount / responses.length;
  pluginInstallationRate.add(successRate);
  concurrentOperationsCount.add(operationCount);
  
  check(null, {
    'stress test success rate acceptable': () => successRate >= 0.95, // 95% success rate
    'no response timeouts': () => responses.every(r => r.timings.duration < 30000)
  });
}

// Cleanup function - runs once at the end
export function teardown(data) {
  // Cleanup any test data if needed
  console.log('Load test completed. Cleaning up test data...');
  
  // Could include cleanup operations like:
  // - Uninstall test plugins
  // - Clear test configurations
  // - Reset monitoring dashboards
}

// Custom scenario for peak load testing
export const peakLoadTest = {
  executor: 'ramping-arrival-rate',
  startRate: 10,
  timeUnit: '1s',
  preAllocatedVUs: 50,
  maxVUs: 200,
  stages: [
    { target: 50, duration: '5m' },   // Ramp up to 50 RPS
    { target: 100, duration: '10m' }, // Ramp up to 100 RPS
    { target: 200, duration: '5m' },  // Peak at 200 RPS
    { target: 50, duration: '5m' },   // Ramp down
  ],
  exec: 'stressTest'
};

// Export scenarios for modular testing
export const scenarios = {
  marketplace_browsing: {
    executor: 'constant-vus',
    vus: 20,
    duration: '10m',
    exec: 'pluginMarketplaceBrowsing'
  },
  plugin_installation: {
    executor: 'constant-vus', 
    vus: 5,
    duration: '15m',
    exec: 'pluginInstallationWorkflow'
  },
  search_and_filtering: {
    executor: 'constant-vus',
    vus: 30,
    duration: '10m', 
    exec: 'pluginSearchAndFiltering'
  },
  configuration_operations: {
    executor: 'constant-vus',
    vus: 15,
    duration: '10m',
    exec: 'pluginConfigurationOperations'
  },
  concurrent_operations: {
    executor: 'constant-vus',
    vus: 25,
    duration: '10m',
    exec: 'concurrentPluginOperations'
  },
  monitoring_health: {
    executor: 'constant-vus',
    vus: 20,
    duration: '10m',
    exec: 'pluginMonitoringAndHealth'
  }
};