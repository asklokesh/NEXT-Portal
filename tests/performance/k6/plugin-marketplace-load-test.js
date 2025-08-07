import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

// Custom metrics
const failureRate = new Rate('failure_rate');
const pluginSearchDuration = new Trend('plugin_search_duration');
const pluginInstallDuration = new Trend('plugin_install_duration');
const apiErrorCounter = new Counter('api_errors');

// Test configuration
export let options = {
  scenarios: {
    // Baseline load test
    baseline_load: {
      executor: 'constant-vus',
      vus: 10,
      duration: '5m',
      tags: { scenario: 'baseline' },
    },
    
    // Spike test for sudden traffic
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '2m', target: 100 },
        { duration: '1m', target: 50 },
        { duration: '1m', target: 0 },
      ],
      tags: { scenario: 'spike' },
    },
    
    // Stress test to find breaking point
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 200 },
        { duration: '2m', target: 300 },
        { duration: '5m', target: 300 },
        { duration: '2m', target: 0 },
      ],
      tags: { scenario: 'stress' },
    },
  },
  
  thresholds: {
    // 99% of requests should be below 500ms
    'http_req_duration': ['p(99)<500'],
    
    // Error rate should be below 1%
    'failure_rate': ['rate<0.01'],
    
    // Plugin search should complete within 200ms for 95% of requests
    'plugin_search_duration': ['p(95)<200'],
    
    // Plugin installation should complete within 10s for 90% of requests
    'plugin_install_duration': ['p(90)<10000'],
    
    // API errors should be minimal
    'api_errors': ['count<50'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4400';
const API_BASE = `${BASE_URL}/api`;

// Test data
const TEST_PLUGINS = [
  'api-docs-plugin',
  'monitoring-plugin',
  'security-scanner',
  'cicd-integration',
  'notification-service',
];

const SEARCH_QUERIES = [
  'api',
  'monitoring',
  'security',
  'documentation',
  'ci/cd',
  'notification',
  'backstage',
  'plugin',
];

const CATEGORIES = [
  'Documentation',
  'Monitoring',
  'Security',
  'CI/CD',
  'Communication',
  'Analytics',
];

// Helper functions
function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function generateRandomConfig() {
  return {
    apiUrl: `https://api-${Math.random().toString(36).substr(2, 9)}.example.com`,
    timeout: Math.floor(Math.random() * 5000) + 1000,
    retryAttempts: Math.floor(Math.random() * 5) + 1,
    enableLogging: Math.random() > 0.5,
  };
}

// Setup function
export function setup() {
  // Perform any setup needed before the test
  console.log('Starting K6 Plugin Marketplace Load Test');
  console.log(`Base URL: ${BASE_URL}`);
  
  // Test if the application is running
  const response = http.get(`${BASE_URL}/api/health`);
  if (response.status !== 200) {
    throw new Error(`Application not available. Status: ${response.status}`);
  }
  
  return {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
  };
}

// Main test function
export default function(data) {
  group('Plugin Marketplace Load Test', () => {
    
    // Test plugin listing and search
    group('Plugin Search and Listing', () => {
      testPluginListing();
      testPluginSearch();
      testPluginFiltering();
      testPluginSorting();
    });
    
    // Test plugin details
    group('Plugin Details', () => {
      testPluginDetails();
    });
    
    // Test plugin operations (installation, configuration)
    group('Plugin Operations', () => {
      testPluginInstallation();
      testPluginConfiguration();
      testPluginHealthCheck();
    });
    
    // Test admin operations
    group('Admin Operations', () => {
      testPluginManagement();
      testPluginMonitoring();
    });
  });
  
  sleep(1); // Think time between iterations
}

function testPluginListing() {
  const scenarios = [
    { page: 1, limit: 20 },
    { page: 1, limit: 50 },
    { page: 2, limit: 20 },
    { page: 1, limit: 100 }, // Large page size test
  ];
  
  scenarios.forEach(params => {
    const response = http.get(`${API_BASE}/plugins?page=${params.page}&limit=${params.limit}`);
    
    const success = check(response, {
      'plugins list status is 200': (r) => r.status === 200,
      'plugins list response time < 300ms': (r) => r.timings.duration < 300,
      'plugins list has valid JSON': (r) => {
        try {
          JSON.parse(r.body);
          return true;
        } catch (e) {
          return false;
        }
      },
      'plugins list has required fields': (r) => {
        const data = JSON.parse(r.body);
        return data.plugins && data.pagination && data.total !== undefined;
      },
      'plugins list pagination is correct': (r) => {
        const data = JSON.parse(r.body);
        return data.pagination.page === params.page && data.pagination.limit === params.limit;
      },
    });
    
    if (!success) {
      failureRate.add(1);
      apiErrorCounter.add(1);
    } else {
      failureRate.add(0);
    }
  });
}

function testPluginSearch() {
  SEARCH_QUERIES.forEach(query => {
    const startTime = Date.now();
    
    const response = http.get(`${API_BASE}/plugins?q=${encodeURIComponent(query)}`);
    
    const duration = Date.now() - startTime;
    pluginSearchDuration.add(duration);
    
    const success = check(response, {
      'search status is 200': (r) => r.status === 200,
      'search response time < 500ms': (r) => r.timings.duration < 500,
      'search results are relevant': (r) => {
        const data = JSON.parse(r.body);
        // Simple relevance check - results should contain search query
        return data.plugins.length === 0 || 
               data.plugins.some(plugin => 
                 plugin.name.toLowerCase().includes(query.toLowerCase()) ||
                 plugin.description.toLowerCase().includes(query.toLowerCase()) ||
                 plugin.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
               );
      },
    });
    
    if (!success) {
      failureRate.add(1);
      apiErrorCounter.add(1);
    } else {
      failureRate.add(0);
    }
  });
}

function testPluginFiltering() {
  // Test category filtering
  const category = randomItem(CATEGORIES);
  const response = http.get(`${API_BASE}/plugins?category=${encodeURIComponent(category)}`);
  
  const success = check(response, {
    'filter by category status is 200': (r) => r.status === 200,
    'filtered results match category': (r) => {
      const data = JSON.parse(r.body);
      return data.plugins.length === 0 || 
             data.plugins.every(plugin => plugin.category === category);
    },
  });
  
  if (!success) {
    failureRate.add(1);
  } else {
    failureRate.add(0);
  }
  
  // Test status filtering
  ['available', 'installed', 'updating'].forEach(status => {
    const statusResponse = http.get(`${API_BASE}/plugins?status=${status}`);
    
    check(statusResponse, {
      [`filter by ${status} status is 200`]: (r) => r.status === 200,
    });
  });
}

function testPluginSorting() {
  const sortOptions = [
    { sortBy: 'name', sortOrder: 'asc' },
    { sortBy: 'name', sortOrder: 'desc' },
    { sortBy: 'rating', sortOrder: 'desc' },
    { sortBy: 'downloads', sortOrder: 'desc' },
    { sortBy: 'lastUpdated', sortOrder: 'desc' },
  ];
  
  sortOptions.forEach(sort => {
    const response = http.get(`${API_BASE}/plugins?sortBy=${sort.sortBy}&sortOrder=${sort.sortOrder}`);
    
    const success = check(response, {
      [`sort by ${sort.sortBy} status is 200`]: (r) => r.status === 200,
      [`sort by ${sort.sortBy} returns sorted results`]: (r) => {
        const data = JSON.parse(r.body);
        if (data.plugins.length < 2) return true;
        
        // Check if results are sorted (basic check)
        for (let i = 1; i < Math.min(data.plugins.length, 5); i++) {
          const prev = data.plugins[i - 1];
          const curr = data.plugins[i];
          
          if (sort.sortBy === 'name') {
            const comparison = prev.name.localeCompare(curr.name);
            if (sort.sortOrder === 'asc' && comparison > 0) return false;
            if (sort.sortOrder === 'desc' && comparison < 0) return false;
          }
        }
        return true;
      },
    });
    
    if (!success) {
      failureRate.add(1);
    } else {
      failureRate.add(0);
    }
  });
}

function testPluginDetails() {
  const pluginId = randomItem(TEST_PLUGINS);
  const response = http.get(`${API_BASE}/plugins/${pluginId}`);
  
  const success = check(response, {
    'plugin details status is 200 or 404': (r) => r.status === 200 || r.status === 404,
    'plugin details response time < 200ms': (r) => r.timings.duration < 200,
    'plugin details has valid structure': (r) => {
      if (r.status === 404) return true;
      
      const plugin = JSON.parse(r.body);
      return plugin.id && plugin.name && plugin.version && plugin.description;
    },
  });
  
  if (!success) {
    failureRate.add(1);
  } else {
    failureRate.add(0);
  }
}

function testPluginInstallation() {
  const pluginId = randomItem(TEST_PLUGINS);
  const config = generateRandomConfig();
  
  const startTime = Date.now();
  
  const response = http.post(
    `${API_BASE}/plugins/${pluginId}/install`,
    JSON.stringify({ config }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token', // Mock auth
      },
    }
  );
  
  const duration = Date.now() - startTime;
  pluginInstallDuration.add(duration);
  
  const success = check(response, {
    'installation status is 200, 400, or 409': (r) => [200, 400, 409].includes(r.status),
    'installation response has proper structure': (r) => {
      const data = JSON.parse(r.body);
      return typeof data.success === 'boolean' && 
             (data.message || data.error);
    },
  });
  
  if (!success) {
    failureRate.add(1);
    apiErrorCounter.add(1);
  } else {
    failureRate.add(0);
  }
}

function testPluginConfiguration() {
  const pluginId = randomItem(TEST_PLUGINS);
  
  // Get current configuration
  const getResponse = http.get(`${API_BASE}/plugins/${pluginId}/config`);
  
  check(getResponse, {
    'get config status is 200 or 404': (r) => r.status === 200 || r.status === 404,
  });
  
  if (getResponse.status === 200) {
    // Update configuration
    const newConfig = generateRandomConfig();
    const updateResponse = http.put(
      `${API_BASE}/plugins/${pluginId}/config`,
      JSON.stringify({ config: newConfig }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
      }
    );
    
    check(updateResponse, {
      'update config status is 200 or 400': (r) => r.status === 200 || r.status === 400,
      'update config response time < 1s': (r) => r.timings.duration < 1000,
    });
  }
}

function testPluginHealthCheck() {
  const pluginId = randomItem(TEST_PLUGINS);
  const response = http.get(`${API_BASE}/plugins/${pluginId}/health`);
  
  const success = check(response, {
    'health check status is 200 or 404': (r) => r.status === 200 || r.status === 404,
    'health check response time < 100ms': (r) => r.timings.duration < 100,
    'health check has valid structure': (r) => {
      if (r.status === 404) return true;
      
      const health = JSON.parse(r.body);
      return health.status && health.timestamp;
    },
  });
  
  if (!success) {
    failureRate.add(1);
  } else {
    failureRate.add(0);
  }
}

function testPluginManagement() {
  // Test admin plugin listing
  const response = http.get(`${API_BASE}/admin/plugins`, {
    headers: {
      'Authorization': 'Bearer admin-token',
    },
  });
  
  check(response, {
    'admin plugins status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'admin plugins response time < 500ms': (r) => r.timings.duration < 500,
  });
}

function testPluginMonitoring() {
  // Test plugin metrics endpoint
  const response = http.get(`${API_BASE}/admin/plugins/metrics`, {
    headers: {
      'Authorization': 'Bearer admin-token',
    },
  });
  
  check(response, {
    'metrics status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'metrics response time < 200ms': (r) => r.timings.duration < 200,
  });
}

// Teardown function
export function teardown(data) {
  console.log('K6 Plugin Marketplace Load Test completed');
  console.log(`Started at: ${data.timestamp}`);
  console.log(`Ended at: ${new Date().toISOString()}`);
}