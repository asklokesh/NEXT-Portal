/**
 * K6 Performance Tests for SaaS IDP Platform
 * Tests API endpoints under various load scenarios
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomIntBetween, randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const loginSuccessRate = new Rate('login_success_rate');
const pluginSearchDuration = new Trend('plugin_search_duration');
const pluginInstallDuration = new Trend('plugin_install_duration');
const apiErrorRate = new Rate('api_error_rate');
const multiTenantIsolationFailures = new Counter('multi_tenant_isolation_failures');

// Test configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4400';
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'admin@test.com';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'testpassword';

// Load test scenarios
export const options = {
  scenarios: {
    // Smoke test - basic functionality check
    smoke_test: {
      executor: 'constant-vus',
      vus: 1,
      duration: '1m',
      tags: { test_type: 'smoke' },
    },
    
    // Load test - normal expected traffic
    load_test: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
      tags: { test_type: 'load' },
      startTime: '1m',
    },
    
    // Stress test - beyond normal capacity
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 200 },
        { duration: '2m', target: 300 },
        { duration: '3m', target: 300 },
        { duration: '2m', target: 0 },
      ],
      tags: { test_type: 'stress' },
      startTime: '6m',
    },
    
    // Spike test - sudden traffic increase
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 500 },
        { duration: '1m', target: 500 },
        { duration: '10s', target: 0 },
      ],
      tags: { test_type: 'spike' },
      startTime: '15m',
    },
    
    // Endurance test - sustained load over time
    endurance_test: {
      executor: 'constant-vus',
      vus: 75,
      duration: '30m',
      tags: { test_type: 'endurance' },
      startTime: '17m',
    },
    
    // Multi-tenant isolation test
    multi_tenant_test: {
      executor: 'per-vu-iterations',
      vus: 20,
      iterations: 10,
      tags: { test_type: 'multi_tenant' },
      startTime: '47m',
    },
  },
  
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    http_req_failed: ['rate<0.05'], // Error rate under 5%
    login_success_rate: ['rate>0.95'], // Login success rate above 95%
    plugin_search_duration: ['p(90)<1000'], // 90% of searches under 1s
    plugin_install_duration: ['p(95)<30000'], // 95% of installs under 30s
    api_error_rate: ['rate<0.02'], // API error rate under 2%
    multi_tenant_isolation_failures: ['count<5'], // Max 5 isolation failures
  },
  
  // Resource limits
  discardResponseBodies: false,
  noConnectionReuse: false,
  userAgent: 'K6-Load-Test/1.0',
};

// Test data for different tenants
const TENANTS = [
  { id: 'tenant-1', domain: 'tenant1.test.com', name: 'Enterprise Corp' },
  { id: 'tenant-2', domain: 'tenant2.test.com', name: 'Startup Inc' },
  { id: 'tenant-3', domain: 'tenant3.test.com', name: 'Government Org' },
  { id: 'tenant-4', domain: 'tenant4.test.com', name: 'Healthcare Ltd' },
  { id: 'tenant-5', domain: 'tenant5.test.com', name: 'Finance Group' },
];

// Sample plugins for testing
const TEST_PLUGINS = [
  '@backstage/plugin-catalog',
  '@backstage/plugin-kubernetes',
  '@roadiehq/backstage-plugin-jira',
  '@roadiehq/backstage-plugin-argo-cd',
  '@backstage/plugin-github-actions',
];

export function setup() {
  console.log('Setting up performance test environment...');
  
  // Create test tenants and users
  const setupData = {
    tokens: {},
    tenants: [],
  };
  
  TENANTS.forEach(tenant => {
    // Create tenant and get auth token
    const token = createTenantAndGetToken(tenant);
    if (token) {
      setupData.tokens[tenant.id] = token;
      setupData.tenants.push(tenant);
    }
  });
  
  console.log(`Setup complete. Created ${setupData.tenants.length} test tenants.`);
  return setupData;
}

export default function(data) {
  const testType = __ENV.K6_TEST_TYPE || 'load';
  
  // Select random tenant for this VU
  const tenant = data.tenants[randomIntBetween(0, data.tenants.length - 1)];
  const authToken = data.tokens[tenant.id];
  
  if (!authToken) {
    console.error(`No auth token for tenant ${tenant.id}`);
    return;
  }
  
  const headers = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json',
    'X-Tenant-ID': tenant.id,
  };
  
  group('Authentication Flow', () => {
    testAuthenticationFlow(tenant);
  });
  
  group('Plugin Discovery', () => {
    testPluginDiscovery(headers);
  });
  
  group('Plugin Management', () => {
    testPluginManagement(headers, tenant);
  });
  
  group('Real-time Features', () => {
    testRealtimeFeatures(headers);
  });
  
  group('Multi-tenant Isolation', () => {
    testMultiTenantIsolation(headers, tenant, data);
  });
  
  // Different sleep patterns based on test type
  switch (testType) {
    case 'smoke':
      sleep(randomIntBetween(1, 3));
      break;
    case 'load':
      sleep(randomIntBetween(1, 5));
      break;
    case 'stress':
      sleep(randomIntBetween(0.5, 2));
      break;
    case 'spike':
      sleep(randomIntBetween(0.1, 1));
      break;
    case 'endurance':
      sleep(randomIntBetween(2, 8));
      break;
    default:
      sleep(1);
  }
}

function testAuthenticationFlow(tenant) {
  const loginPayload = {
    email: `admin@${tenant.domain}`,
    password: 'testpassword',
  };
  
  const loginResponse = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify(loginPayload),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'auth_login' },
    }
  );
  
  const loginSuccess = check(loginResponse, {
    'login status is 200': (r) => r.status === 200,
    'login response has token': (r) => r.json('token') !== undefined,
    'login response time < 1s': (r) => r.timings.duration < 1000,
  });
  
  loginSuccessRate.add(loginSuccess);
  apiErrorRate.add(!loginSuccess);
}

function testPluginDiscovery(headers) {
  const searchQueries = ['kubernetes', 'catalog', 'security', 'ci-cd', 'monitoring'];
  const categories = ['all', 'core', 'infrastructure', 'security', 'productivity'];
  
  // Test plugin search
  const query = searchQueries[randomIntBetween(0, searchQueries.length - 1)];
  const category = categories[randomIntBetween(0, categories.length - 1)];
  
  const searchStart = Date.now();
  const searchResponse = http.get(
    `${BASE_URL}/api/plugins?search=${query}&category=${category}&includeQuality=true&page=1&limit=20`,
    { 
      headers,
      tags: { endpoint: 'plugin_search' },
    }
  );
  const searchDuration = Date.now() - searchStart;
  
  const searchSuccess = check(searchResponse, {
    'search status is 200': (r) => r.status === 200,
    'search has plugins array': (r) => Array.isArray(r.json('plugins')),
    'search response time < 2s': (r) => r.timings.duration < 2000,
    'search includes quality data': (r) => {
      const plugins = r.json('plugins');
      return plugins.length === 0 || plugins[0].health !== undefined;
    },
  });
  
  pluginSearchDuration.add(searchDuration);
  apiErrorRate.add(!searchSuccess);
  
  // Test plugin categories endpoint
  const categoriesResponse = http.get(
    `${BASE_URL}/api/plugins/categories`,
    { 
      headers,
      tags: { endpoint: 'plugin_categories' },
    }
  );
  
  check(categoriesResponse, {
    'categories status is 200': (r) => r.status === 200,
    'categories is array': (r) => Array.isArray(r.json()),
  });
  
  // Test plugin sorting and filtering
  const sortOptions = ['relevance', 'downloads', 'stars', 'updated', 'health'];
  const sortBy = sortOptions[randomIntBetween(0, sortOptions.length - 1)];
  
  const sortedResponse = http.get(
    `${BASE_URL}/api/plugins?sortBy=${sortBy}&sortOrder=desc&limit=10`,
    { 
      headers,
      tags: { endpoint: 'plugin_sort' },
    }
  );
  
  check(sortedResponse, {
    'sorted results status is 200': (r) => r.status === 200,
    'sorted results properly ordered': (r) => {
      const plugins = r.json('plugins');
      if (plugins.length < 2) return true;
      
      // Basic ordering check for numeric fields
      if (['downloads', 'stars', 'health'].includes(sortBy)) {
        return plugins[0][sortBy] >= plugins[1][sortBy];
      }
      return true;
    },
  });
}

function testPluginManagement(headers, tenant) {
  const pluginId = TEST_PLUGINS[randomIntBetween(0, TEST_PLUGINS.length - 1)];
  
  // Test plugin installation
  const installStart = Date.now();
  const installPayload = {
    action: 'install',
    pluginId: pluginId,
    config: {
      enabled: true,
      tenantId: tenant.id,
      testInstall: true, // Mark as test installation
    },
  };
  
  const installResponse = http.post(
    `${BASE_URL}/api/plugins`,
    JSON.stringify(installPayload),
    { 
      headers,
      tags: { endpoint: 'plugin_install' },
    }
  );
  const installDuration = Date.now() - installStart;
  
  const installSuccess = check(installResponse, {
    'install request accepted': (r) => [200, 202].includes(r.status),
    'install response has success field': (r) => r.json('success') !== undefined,
    'install response time < 30s': (r) => r.timings.duration < 30000,
  });
  
  pluginInstallDuration.add(installDuration);
  apiErrorRate.add(!installSuccess);
  
  // Test plugin status check
  const statusResponse = http.get(
    `${BASE_URL}/api/plugins/status?pluginId=${encodeURIComponent(pluginId)}`,
    { 
      headers,
      tags: { endpoint: 'plugin_status' },
    }
  );
  
  check(statusResponse, {
    'status check is 200': (r) => r.status === 200,
    'status has installation info': (r) => r.json('installed') !== undefined,
  });
  
  // Test plugin configuration
  const configPayload = {
    action: 'configure',
    pluginId: pluginId,
    config: {
      testConfig: `value-${randomString(8)}`,
      refreshInterval: randomIntBetween(10000, 60000),
    },
  };
  
  const configResponse = http.post(
    `${BASE_URL}/api/plugins`,
    JSON.stringify(configPayload),
    { 
      headers,
      tags: { endpoint: 'plugin_configure' },
    }
  );
  
  check(configResponse, {
    'config status is 200': (r) => r.status === 200,
    'config response has success': (r) => r.json('success') !== undefined,
  });
  
  // Test plugin health monitoring
  const healthResponse = http.get(
    `${BASE_URL}/api/plugin-health?pluginId=${encodeURIComponent(pluginId)}`,
    { 
      headers,
      tags: { endpoint: 'plugin_health' },
    }
  );
  
  check(healthResponse, {
    'health check is 200': (r) => r.status === 200,
    'health has metrics': (r) => r.json('metrics') !== undefined,
  });
}

function testRealtimeFeatures(headers) {
  // Test metrics endpoint
  const metricsResponse = http.get(
    `${BASE_URL}/api/metrics?timeRange=1h`,
    { 
      headers,
      tags: { endpoint: 'metrics' },
    }
  );
  
  check(metricsResponse, {
    'metrics status is 200': (r) => r.status === 200,
    'metrics has data': (r) => r.json('metrics') !== undefined,
  });
  
  // Test monitoring alerts
  const alertsResponse = http.get(
    `${BASE_URL}/api/monitoring/alerts?status=active`,
    { 
      headers,
      tags: { endpoint: 'alerts' },
    }
  );
  
  check(alertsResponse, {
    'alerts status is 200': (r) => r.status === 200,
    'alerts is array': (r) => Array.isArray(r.json('alerts')),
  });
  
  // Test notification settings
  const notificationsResponse = http.get(
    `${BASE_URL}/api/notifications/settings`,
    { 
      headers,
      tags: { endpoint: 'notifications' },
    }
  );
  
  check(notificationsResponse, {
    'notifications status is 200': (r) => r.status === 200,
  });
}

function testMultiTenantIsolation(headers, currentTenant, data) {
  // Try to access another tenant's data
  const otherTenant = data.tenants.find(t => t.id !== currentTenant.id);
  if (!otherTenant) return;
  
  // Attempt cross-tenant data access
  const crossTenantHeaders = {
    ...headers,
    'X-Tenant-ID': otherTenant.id, // Try to access different tenant
  };
  
  const isolationTestResponse = http.get(
    `${BASE_URL}/api/plugins/status`,
    { 
      headers: crossTenantHeaders,
      tags: { endpoint: 'isolation_test' },
    }
  );
  
  const isolationViolation = check(isolationTestResponse, {
    'cross-tenant access denied': (r) => r.status === 403 || r.status === 401,
  });
  
  if (!isolationViolation) {
    multiTenantIsolationFailures.add(1);
    console.error(`Tenant isolation violation: ${currentTenant.id} accessed ${otherTenant.id}`);
  }
  
  // Test tenant-specific plugin installations
  const tenantPluginsResponse = http.get(
    `${BASE_URL}/api/plugins?status=installed`,
    { 
      headers,
      tags: { endpoint: 'tenant_plugins' },
    }
  );
  
  check(tenantPluginsResponse, {
    'tenant plugins status is 200': (r) => r.status === 200,
    'plugins are tenant-specific': (r) => {
      const plugins = r.json('plugins');
      // All plugins should belong to current tenant (if any)
      return plugins.every(plugin => 
        !plugin.tenantId || plugin.tenantId === currentTenant.id
      );
    },
  });
}

function createTenantAndGetToken(tenant) {
  // Create test tenant (if not exists)
  const tenantPayload = {
    name: tenant.name,
    domain: tenant.domain,
    isActive: true,
    features: ['plugin-marketplace', 'real-time-updates'],
  };
  
  const tenantResponse = http.post(
    `${BASE_URL}/api/admin/tenants`,
    JSON.stringify(tenantPayload),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAdminToken()}`,
      },
    }
  );
  
  // Create test user for tenant
  const userPayload = {
    email: `admin@${tenant.domain}`,
    password: 'testpassword',
    name: `${tenant.name} Admin`,
    role: 'admin',
    tenantId: tenant.id,
  };
  
  http.post(
    `${BASE_URL}/api/admin/users`,
    JSON.stringify(userPayload),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAdminToken()}`,
      },
    }
  );
  
  // Login and get token
  const loginPayload = {
    email: `admin@${tenant.domain}`,
    password: 'testpassword',
  };
  
  const loginResponse = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify(loginPayload),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  
  if (loginResponse.status === 200) {
    return loginResponse.json('token');
  }
  
  console.error(`Failed to get token for tenant ${tenant.id}: ${loginResponse.status}`);
  return null;
}

function getAdminToken() {
  // Cache admin token for efficiency
  if (!global.adminToken) {
    const adminLoginResponse = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
    
    if (adminLoginResponse.status === 200) {
      global.adminToken = adminLoginResponse.json('token');
    }
  }
  
  return global.adminToken;
}

export function teardown(data) {
  console.log('Cleaning up performance test environment...');
  
  // Clean up test installations and data
  const adminToken = getAdminToken();
  
  data.tenants.forEach(tenant => {
    // Clean up test plugins
    TEST_PLUGINS.forEach(pluginId => {
      http.post(
        `${BASE_URL}/api/plugins`,
        JSON.stringify({
          action: 'uninstall',
          pluginId: pluginId,
        }),
        {
          headers: {
            'Authorization': `Bearer ${data.tokens[tenant.id]}`,
            'Content-Type': 'application/json',
          },
        }
      );
    });
    
    // Delete test tenant
    http.del(`${BASE_URL}/api/admin/tenants/${tenant.id}`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
      },
    });
  });
  
  console.log('Cleanup complete.');
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString();
  
  return {
    'performance-report.json': JSON.stringify(data, null, 2),
    'performance-report.html': generateHtmlReport(data, timestamp),
    stdout: generateSummaryText(data, timestamp),
  };
}

function generateHtmlReport(data, timestamp) {
  const metrics = data.metrics;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>SaaS IDP Performance Test Report</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .metric { margin: 10px 0; padding: 10px; border-left: 4px solid #007cba; }
        .passed { border-left-color: #28a745; }
        .failed { border-left-color: #dc3545; }
        .chart { margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>SaaS IDP Performance Test Report</h1>
        <p>Generated: ${timestamp}</p>
        <p>Test Duration: ${Math.round(data.state.testRunDurationMs / 1000)}s</p>
        <p>Virtual Users: ${data.state.vusMax}</p>
        <p>Total Requests: ${metrics.http_reqs.count}</p>
      </div>
      
      <h2>Key Metrics</h2>
      <div class="metric ${metrics.http_req_duration.p95 < 2000 ? 'passed' : 'failed'}">
        <strong>Response Time (95th percentile):</strong> ${Math.round(metrics.http_req_duration.p95)}ms
        <br><small>Threshold: &lt; 2000ms</small>
      </div>
      
      <div class="metric ${metrics.http_req_failed.rate < 0.05 ? 'passed' : 'failed'}">
        <strong>Error Rate:</strong> ${(metrics.http_req_failed.rate * 100).toFixed(2)}%
        <br><small>Threshold: &lt; 5%</small>
      </div>
      
      <div class="metric ${metrics.login_success_rate.rate > 0.95 ? 'passed' : 'failed'}">
        <strong>Login Success Rate:</strong> ${(metrics.login_success_rate.rate * 100).toFixed(2)}%
        <br><small>Threshold: &gt; 95%</small>
      </div>
      
      <h2>Detailed Metrics</h2>
      <table>
        <tr><th>Metric</th><th>Value</th><th>Threshold</th><th>Status</th></tr>
        <tr>
          <td>Average Response Time</td>
          <td>${Math.round(metrics.http_req_duration.avg)}ms</td>
          <td>-</td>
          <td>-</td>
        </tr>
        <tr>
          <td>Plugin Search Duration (90th percentile)</td>
          <td>${Math.round(metrics.plugin_search_duration.p90)}ms</td>
          <td>&lt; 1000ms</td>
          <td>${metrics.plugin_search_duration.p90 < 1000 ? '✅' : '❌'}</td>
        </tr>
        <tr>
          <td>Plugin Install Duration (95th percentile)</td>
          <td>${Math.round(metrics.plugin_install_duration.p95)}ms</td>
          <td>&lt; 30000ms</td>
          <td>${metrics.plugin_install_duration.p95 < 30000 ? '✅' : '❌'}</td>
        </tr>
        <tr>
          <td>Multi-tenant Isolation Failures</td>
          <td>${metrics.multi_tenant_isolation_failures.count}</td>
          <td>&lt; 5</td>
          <td>${metrics.multi_tenant_isolation_failures.count < 5 ? '✅' : '❌'}</td>
        </tr>
      </table>
      
      <h2>Test Scenarios</h2>
      <p>The following test scenarios were executed:</p>
      <ul>
        <li><strong>Smoke Test:</strong> Basic functionality validation</li>
        <li><strong>Load Test:</strong> Normal expected traffic (50 VUs for 5 minutes)</li>
        <li><strong>Stress Test:</strong> Beyond normal capacity (up to 300 VUs)</li>
        <li><strong>Spike Test:</strong> Sudden traffic increase (500 VUs spike)</li>
        <li><strong>Endurance Test:</strong> Sustained load over time (75 VUs for 30 minutes)</li>
        <li><strong>Multi-tenant Test:</strong> Tenant isolation validation</li>
      </ul>
      
      <h2>Recommendations</h2>
      <ul>
        ${metrics.http_req_duration.p95 > 2000 ? '<li>🔴 Response times are above threshold. Consider optimizing slow endpoints or scaling infrastructure.</li>' : ''}
        ${metrics.http_req_failed.rate > 0.05 ? '<li>🔴 Error rate is high. Investigate failing requests and improve error handling.</li>' : ''}
        ${metrics.login_success_rate.rate < 0.95 ? '<li>🔴 Authentication issues detected. Review authentication service stability.</li>' : ''}
        ${metrics.multi_tenant_isolation_failures.count > 0 ? '<li>🔴 Multi-tenant isolation failures detected. This is a critical security issue.</li>' : ''}
        <li>✅ Continue monitoring these metrics in production</li>
        <li>✅ Consider implementing auto-scaling based on these load patterns</li>
      </ul>
    </body>
    </html>
  `;
}

function generateSummaryText(data, timestamp) {
  const metrics = data.metrics;
  
  return `
=== SaaS IDP Performance Test Summary ===
Generated: ${timestamp}
Duration: ${Math.round(data.state.testRunDurationMs / 1000)}s
Virtual Users: ${data.state.vusMax}
Total Requests: ${metrics.http_reqs.count}

Key Metrics:
- Response Time (95th): ${Math.round(metrics.http_req_duration.p95)}ms ${metrics.http_req_duration.p95 < 2000 ? '✅' : '❌'}
- Error Rate: ${(metrics.http_req_failed.rate * 100).toFixed(2)}% ${metrics.http_req_failed.rate < 0.05 ? '✅' : '❌'}
- Login Success: ${(metrics.login_success_rate.rate * 100).toFixed(2)}% ${metrics.login_success_rate.rate > 0.95 ? '✅' : '❌'}
- Tenant Isolation: ${metrics.multi_tenant_isolation_failures.count} failures ${metrics.multi_tenant_isolation_failures.count < 5 ? '✅' : '❌'}

Plugin Performance:
- Search Duration (90th): ${Math.round(metrics.plugin_search_duration.p90)}ms
- Install Duration (95th): ${Math.round(metrics.plugin_install_duration.p95)}ms

Overall Status: ${
  metrics.http_req_duration.p95 < 2000 && 
  metrics.http_req_failed.rate < 0.05 && 
  metrics.login_success_rate.rate > 0.95 && 
  metrics.multi_tenant_isolation_failures.count < 5 
    ? '✅ PASSED' : '❌ FAILED'
}
===========================================
  `;
}