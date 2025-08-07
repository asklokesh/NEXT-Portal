/**
 * Performance Test: Dashboard Loading
 * Tests dashboard loading performance under various load conditions
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const dashboardLoadTime = new Trend('dashboard_load_time');
const widgetRenderTime = new Trend('widget_render_time');
const apiResponseTime = new Trend('api_response_time');
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up to 10 users
    { duration: '5m', target: 50 },   // Ramp up to 50 users
    { duration: '10m', target: 100 }, // Stay at 100 users
    { duration: '5m', target: 200 },  // Spike to 200 users
    { duration: '10m', target: 100 }, // Back to 100 users
    { duration: '5m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    'dashboard_load_time': ['p(95)<3000'], // 95% of dashboard loads under 3s
    'widget_render_time': ['p(95)<1000'],  // 95% of widget renders under 1s
    'api_response_time': ['p(95)<500'],    // 95% of API calls under 500ms
    'errors': ['rate<0.05'],               // Error rate under 5%
    'http_req_duration': ['p(99)<5000'],   // 99% of requests under 5s
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Helper function to get auth token
function authenticate() {
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: 'loadtest@example.com',
    password: 'LoadTest123!',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(loginRes, {
    'login successful': (r) => r.status === 200,
    'token received': (r) => r.json('token') !== undefined,
  });

  return loginRes.json('token');
}

export function setup() {
  // Create test users and data
  const setupRes = http.post(`${BASE_URL}/api/test/setup-load-test`, null, {
    headers: { 'X-Test-Mode': 'true' },
  });

  check(setupRes, {
    'test setup successful': (r) => r.status === 200,
  });

  return { token: authenticate() };
}

export default function (data) {
  const token = data.token;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Test 1: Load Dashboard Page
  const dashboardStart = Date.now();
  const dashboardRes = http.get(`${BASE_URL}/dashboard`, { headers });
  const dashboardEnd = Date.now();
  
  dashboardLoadTime.add(dashboardEnd - dashboardStart);
  
  const dashboardSuccess = check(dashboardRes, {
    'dashboard loads': (r) => r.status === 200,
    'dashboard has content': (r) => r.body.includes('dashboard'),
    'dashboard load time < 3s': (r) => (dashboardEnd - dashboardStart) < 3000,
  });

  if (!dashboardSuccess) {
    errorRate.add(1);
  } else {
    errorRate.add(0);
  }

  sleep(randomIntBetween(1, 3));

  // Test 2: Load Dashboard Widgets
  const widgetTypes = ['metrics', 'services', 'deployments', 'alerts', 'costs'];
  
  widgetTypes.forEach(widgetType => {
    const widgetStart = Date.now();
    const widgetRes = http.get(`${BASE_URL}/api/dashboard/widgets/${widgetType}`, { headers });
    const widgetEnd = Date.now();
    
    widgetRenderTime.add(widgetEnd - widgetStart);
    
    check(widgetRes, {
      [`${widgetType} widget loads`]: (r) => r.status === 200,
      [`${widgetType} widget has data`]: (r) => r.json('data') !== undefined,
      [`${widgetType} widget load time < 1s`]: (r) => (widgetEnd - widgetStart) < 1000,
    });
  });

  sleep(randomIntBetween(1, 2));

  // Test 3: Dashboard Metrics API
  const metricsStart = Date.now();
  const metricsRes = http.get(`${BASE_URL}/api/monitoring/metrics`, {
    headers,
    params: {
      from: Date.now() - 3600000, // Last hour
      to: Date.now(),
      interval: '5m',
    },
  });
  const metricsEnd = Date.now();
  
  apiResponseTime.add(metricsEnd - metricsStart);
  
  check(metricsRes, {
    'metrics API responds': (r) => r.status === 200,
    'metrics data returned': (r) => r.json('metrics') !== undefined,
    'metrics response time < 500ms': (r) => (metricsEnd - metricsStart) < 500,
  });

  // Test 4: Service Health Status
  const healthStart = Date.now();
  const healthRes = http.get(`${BASE_URL}/api/catalog/health`, { headers });
  const healthEnd = Date.now();
  
  apiResponseTime.add(healthEnd - healthStart);
  
  check(healthRes, {
    'health API responds': (r) => r.status === 200,
    'health data structure valid': (r) => {
      const data = r.json();
      return data.services && Array.isArray(data.services);
    },
  });

  // Test 5: Real-time Updates (WebSocket simulation)
  const wsStart = Date.now();
  const wsRes = http.get(`${BASE_URL}/api/ws`, {
    headers: {
      ...headers,
      'Upgrade': 'websocket',
      'Connection': 'Upgrade',
    },
  });
  const wsEnd = Date.now();
  
  check(wsRes, {
    'WebSocket endpoint accessible': (r) => r.status === 101 || r.status === 426,
    'WebSocket upgrade time < 100ms': (r) => (wsEnd - wsStart) < 100,
  });

  sleep(randomIntBetween(2, 5));

  // Test 6: Dashboard Customization
  const customizationRes = http.post(
    `${BASE_URL}/api/dashboard/layout`,
    JSON.stringify({
      widgets: [
        { id: 'metrics', position: { x: 0, y: 0, w: 6, h: 4 } },
        { id: 'services', position: { x: 6, y: 0, w: 6, h: 4 } },
      ],
    }),
    { headers }
  );
  
  check(customizationRes, {
    'layout save successful': (r) => r.status === 200 || r.status === 201,
  });

  // Test 7: Concurrent Widget Loading
  const concurrentRequests = [
    http.get(`${BASE_URL}/api/dashboard/widgets/metrics`, { headers }),
    http.get(`${BASE_URL}/api/dashboard/widgets/services`, { headers }),
    http.get(`${BASE_URL}/api/dashboard/widgets/deployments`, { headers }),
    http.get(`${BASE_URL}/api/dashboard/widgets/alerts`, { headers }),
  ];

  const allSuccessful = concurrentRequests.every(res => res.status === 200);
  check(null, {
    'concurrent widget loading successful': () => allSuccessful,
  });

  sleep(randomIntBetween(3, 8));
}

export function teardown(data) {
  // Clean up test data
  const cleanupRes = http.post(`${BASE_URL}/api/test/cleanup-load-test`, null, {
    headers: {
      'Authorization': `Bearer ${data.token}`,
      'X-Test-Mode': 'true',
    },
  });

  check(cleanupRes, {
    'cleanup successful': (r) => r.status === 200,
  });
}

// Custom scenario for stress testing
export const stressTest = {
  executor: 'ramping-arrival-rate',
  startRate: 10,
  timeUnit: '1s',
  preAllocatedVUs: 50,
  maxVUs: 500,
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 RPS
    { duration: '5m', target: 100 },  // Ramp up to 100 RPS
    { duration: '2m', target: 200 },  // Spike to 200 RPS
    { duration: '5m', target: 100 },  // Back to 100 RPS
    { duration: '2m', target: 0 },    // Ramp down
  ],
};

// Custom scenario for soak testing
export const soakTest = {
  executor: 'constant-vus',
  vus: 50,
  duration: '2h',
};

// Custom scenario for spike testing
export const spikeTest = {
  executor: 'ramping-vus',
  startVUs: 0,
  stages: [
    { duration: '10s', target: 50 },
    { duration: '30s', target: 50 },
    { duration: '10s', target: 500 }, // Spike
    { duration: '30s', target: 500 },
    { duration: '10s', target: 50 },
    { duration: '30s', target: 50 },
    { duration: '10s', target: 0 },
  ],
};