import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

// Custom metrics for stress testing
const systemResourceUsage = new Gauge('system_resource_usage');
const pluginOperationErrors = new Rate('plugin_operation_error_rate');
const pluginInstallationFailures = new Rate('plugin_installation_failure_rate');
const systemRecoveryTime = new Trend('system_recovery_time');
const memoryLeakIndicator = new Gauge('memory_leak_indicator');
const databaseConnectionErrors = new Rate('database_connection_error_rate');
const kubernetesResourceErrors = new Rate('kubernetes_resource_error_rate');

// Stress test thresholds
const STRESS_THRESHOLDS = {
  max_response_time: 45000,        // 45 seconds absolute max
  error_rate_threshold: 0.15,      // 15% max error rate under stress
  resource_exhaustion_limit: 0.90, // 90% resource usage limit
  recovery_time: 10000,            // 10 seconds max recovery time
  memory_growth_rate: 0.05,        // 5% max memory growth per minute
  concurrent_installations: 50,     // Max concurrent installations
  database_connection_timeout: 5000 // 5 seconds max DB timeout
};

// Stress test configuration
export const options = {
  scenarios: {
    // Gradual stress buildup
    stress_rampup: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '2m', target: 20 },   // Normal load
        { duration: '3m', target: 50 },   // Increased load
        { duration: '5m', target: 100 },  // High load
        { duration: '5m', target: 200 },  // Stress load
        { duration: '3m', target: 300 },  // Peak stress
        { duration: '5m', target: 200 },  // Partial recovery
        { duration: '5m', target: 50 },   // Recovery
        { duration: '2m', target: 0 },    // Cool down
      ],
    },
    
    // Sudden load spike test
    spike_test: {
      executor: 'ramping-vus',
      startTime: '15m',
      startVUs: 10,
      stages: [
        { duration: '30s', target: 500 },  // Sudden spike
        { duration: '2m', target: 500 },   // Maintain spike
        { duration: '1m', target: 10 },    // Quick recovery
      ],
    },
    
    // Volume stress test
    volume_stress: {
      executor: 'constant-vus',
      startTime: '25m',
      vus: 100,
      duration: '15m',
    },
    
    // Plugin installation stress
    installation_stress: {
      executor: 'constant-arrival-rate',
      startTime: '10m',
      rate: 10,
      timeUnit: '1s',
      duration: '20m',
      preAllocatedVUs: 30,
      maxVUs: 100,
    }
  },
  
  thresholds: {
    http_req_duration: [`p(95)<${STRESS_THRESHOLDS.max_response_time}`],
    http_req_failed: [`rate<${STRESS_THRESHOLDS.error_rate_threshold}`],
    plugin_operation_error_rate: [`rate<${STRESS_THRESHOLDS.error_rate_threshold}`],
    system_recovery_time: [`p(95)<${STRESS_THRESHOLDS.recovery_time}`],
    kubernetes_resource_error_rate: [`rate<0.1`],
  },
  
  ext: {
    loadimpact: {
      projectID: 3596490,
      name: 'Plugin Management Stress Test',
      distribution: {
        'amazon:us:ashburn': { loadZone: 'amazon:us:ashburn', percent: 50 },
        'amazon:eu:dublin': { loadZone: 'amazon:eu:dublin', percent: 30 },
        'amazon:ap:singapore': { loadZone: 'amazon:ap:singapore', percent: 20 }
      }
    }
  }
};

// Base configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4400';
const STRESS_TEST_PLUGINS = [
  '@backstage/plugin-catalog',
  '@backstage/plugin-scaffolder',
  '@backstage/plugin-techdocs',
  '@backstage/plugin-kubernetes',
  '@backstage/plugin-cost-insights',
  '@backstage/plugin-jenkins',
  '@backstage/plugin-lighthouse',
  '@backstage/plugin-sonarqube',
  '@backstage/plugin-rollbar',
  '@backstage/plugin-circleci'
];

// Setup function
export function setup() {
  console.log('Starting stress test setup...');
  
  // Pre-authenticate
  const authResponse = http.post(`${BASE_URL}/api/auth/login`, {
    username: 'stress-test-user',
    password: 'stress-test-password'
  });
  
  const authToken = authResponse.json('token');
  
  // Get system baseline metrics
  const baselineResponse = http.get(`${BASE_URL}/api/system/metrics`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  
  const baseline = baselineResponse.status === 200 ? baselineResponse.json() : {};
  
  return {
    authToken,
    baseline: {
      memory: baseline.memory || 0,
      cpu: baseline.cpu || 0,
      connections: baseline.connections || 0
    }
  };
}

// Main stress test function
export default function(data) {
  const stressScenarios = [
    massivePluginBrowsing,
    concurrentPluginInstallations,
    systemResourceExhaustion,
    databaseConnectionStress,
    kubernetesResourceStress,
    configurationOperationStorm,
    memoryLeakDetection
  ];
  
  // Execute random stress scenario
  const scenario = stressScenarios[Math.floor(Math.random() * stressScenarios.length)];
  scenario(data);
  
  sleep(0.1); // Minimal pause between operations
}

function massivePluginBrowsing(data) {
  const operations = [];
  const concurrentRequests = 20;
  
  // Create batch of concurrent marketplace requests
  for (let i = 0; i < concurrentRequests; i++) {
    const category = ['all', 'catalog', 'ci-cd', 'monitoring', 'infrastructure'][Math.floor(Math.random() * 5)];
    const searchQuery = ['catalog', 'kubernetes', 'docs', 'jenkins', 'monitoring'][Math.floor(Math.random() * 5)];
    
    operations.push([
      'GET',
      `${BASE_URL}/api/plugins?category=${category}`,
      null,
      { headers: { 'Authorization': `Bearer ${data.authToken}` } }
    ]);
    
    operations.push([
      'GET', 
      `${BASE_URL}/api/plugins/search?q=${searchQuery}`,
      null,
      { headers: { 'Authorization': `Bearer ${data.authToken}` } }
    ]);
  }
  
  const responses = http.batch(operations);
  
  // Analyze response patterns
  let errorCount = 0;
  let slowResponseCount = 0;
  
  responses.forEach(response => {
    if (response.status >= 400) {
      errorCount++;
    }
    if (response.timings.duration > 10000) { // 10+ second responses
      slowResponseCount++;
    }
  });
  
  const errorRate = errorCount / responses.length;
  const slowResponseRate = slowResponseCount / responses.length;
  
  pluginOperationErrors.add(errorRate);
  
  check(null, {
    'massive browsing error rate acceptable': () => errorRate < STRESS_THRESHOLDS.error_rate_threshold,
    'response degradation manageable': () => slowResponseRate < 0.3, // 30% max slow responses
    'system remains responsive': () => responses.length > 0
  });
}

function concurrentPluginInstallations(data) {
  const installationPromises = [];
  const concurrentInstalls = Math.min(10, STRESS_THRESHOLDS.concurrent_installations);
  
  for (let i = 0; i < concurrentInstalls; i++) {
    const plugin = STRESS_TEST_PLUGINS[Math.floor(Math.random() * STRESS_TEST_PLUGINS.length)];
    
    const installResponse = http.post(`${BASE_URL}/api/plugins`, 
      JSON.stringify({
        action: 'install',
        pluginId: `${plugin}-stress-${i}`,
        environment: 'kubernetes',
        config: {
          enabled: true,
          replicas: 1,
          resources: {
            requests: { cpu: '100m', memory: '128Mi' },
            limits: { cpu: '200m', memory: '256Mi' }
          }
        }
      }), 
      {
        headers: {
          'Authorization': `Bearer ${data.authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    installationPromises.push({
      response: installResponse,
      pluginId: `${plugin}-stress-${i}`
    });
  }
  
  // Check installation responses
  let failureCount = 0;
  const installIds = [];
  
  installationPromises.forEach(({ response, pluginId }) => {
    if (response.status !== 200) {
      failureCount++;
    } else {
      const installId = response.json('installId');
      if (installId) {
        installIds.push(installId);
      }
    }
  });
  
  const failureRate = failureCount / installationPromises.length;
  pluginInstallationFailures.add(failureRate);
  
  // Monitor ongoing installations
  if (installIds.length > 0) {
    sleep(5); // Wait 5 seconds before checking status
    
    const statusChecks = installIds.map(installId => [
      'GET',
      `${BASE_URL}/api/plugin-installer?installId=${installId}`,
      null,
      { headers: { 'Authorization': `Bearer ${data.authToken}` } }
    ]);
    
    const statusResponses = http.batch(statusChecks);
    
    let runningCount = 0;
    let failedCount = 0;
    
    statusResponses.forEach(response => {
      if (response.status === 200) {
        const status = response.json();
        if (status.status === 'running') runningCount++;
        if (status.status === 'failed') failedCount++;
      }
    });
    
    const overallFailureRate = (failureCount + failedCount) / concurrentInstalls;
    pluginInstallationFailures.add(overallFailureRate);
  }
  
  check(null, {
    'concurrent installation failure rate acceptable': () => failureRate < 0.2, // 20% max failures
    'system handles concurrent installations': () => installIds.length > 0,
    'installation queue not blocked': () => failureCount < concurrentInstalls
  });
}

function systemResourceExhaustion(data) {
  const resourceStartTime = new Date();
  
  // Get current system metrics
  const metricsResponse = http.get(`${BASE_URL}/api/system/metrics`, {
    headers: { 'Authorization': `Bearer ${data.authToken}` }
  });
  
  if (metricsResponse.status === 200) {
    const metrics = metricsResponse.json();
    
    // Calculate resource usage
    const cpuUsage = metrics.cpu / 100; // Convert percentage to decimal
    const memoryUsage = metrics.memory / (metrics.totalMemory || 100);
    const diskUsage = metrics.disk / (metrics.totalDisk || 100);
    
    const maxUsage = Math.max(cpuUsage, memoryUsage, diskUsage);
    systemResourceUsage.add(maxUsage);
    
    // Check if system is approaching exhaustion
    if (maxUsage > STRESS_THRESHOLDS.resource_exhaustion_limit) {
      console.warn(`Resource exhaustion detected: ${maxUsage * 100}%`);
      
      // Test system recovery
      sleep(2); // Brief pause
      
      const recoveryStartTime = new Date();
      const recoveryCheck = http.get(`${BASE_URL}/api/health`, {
        headers: { 'Authorization': `Bearer ${data.authToken}` }
      });
      
      if (recoveryCheck.status === 200) {
        const recoveryTime = new Date() - recoveryStartTime;
        systemRecoveryTime.add(recoveryTime);
      }
    }
  }
  
  // Generate additional load to stress resources
  const heavyOperations = [];
  for (let i = 0; i < 15; i++) {
    heavyOperations.push([
      'POST',
      `${BASE_URL}/api/plugins/search`,
      JSON.stringify({
        query: 'comprehensive search with complex filters',
        filters: {
          category: 'all',
          tags: ['monitoring', 'kubernetes', 'catalog', 'ci-cd'],
          sortBy: 'relevance',
          includeDeprecated: true
        }
      }),
      { headers: { 'Authorization': `Bearer ${data.authToken}`, 'Content-Type': 'application/json' } }
    ]);
  }
  
  const heavyResponses = http.batch(heavyOperations);
  
  let resourceErrorCount = 0;
  heavyResponses.forEach(response => {
    if (response.status === 503 || response.status === 429) { // Service unavailable or rate limited
      resourceErrorCount++;
    }
  });
  
  const resourceErrorRate = resourceErrorCount / heavyResponses.length;
  pluginOperationErrors.add(resourceErrorRate);
  
  check(null, {
    'system handles resource stress': () => resourceErrorRate < 0.3,
    'resource monitoring functional': () => metricsResponse.status === 200,
    'system recovers from high load': () => resourceErrorCount < heavyOperations.length
  });
}

function databaseConnectionStress(data) {
  const dbOperations = [];
  const connectionCount = 25; // High number of concurrent DB operations
  
  // Create multiple concurrent database-intensive operations
  for (let i = 0; i < connectionCount; i++) {
    // Plugin configuration operations (DB heavy)
    dbOperations.push([
      'POST',
      `${BASE_URL}/api/plugins`,
      JSON.stringify({
        action: 'configure',
        pluginId: STRESS_TEST_PLUGINS[i % STRESS_TEST_PLUGINS.length],
        config: {
          database: {
            host: `stress-test-db-${i}`,
            port: 5432,
            name: `stress_test_${i}`
          },
          features: ['catalog', 'search', 'monitoring'],
          timestamp: new Date().toISOString()
        }
      }),
      { headers: { 'Authorization': `Bearer ${data.authToken}`, 'Content-Type': 'application/json' } }
    ]);
    
    // Plugin listing (DB read heavy)
    dbOperations.push([
      'GET',
      `${BASE_URL}/api/plugins?includeConfig=true&detailed=true`,
      null,
      { headers: { 'Authorization': `Bearer ${data.authToken}` } }
    ]);
  }
  
  const dbResponses = http.batch(dbOperations);
  
  let dbErrorCount = 0;
  let timeoutCount = 0;
  
  dbResponses.forEach(response => {
    if (response.status >= 500) {
      dbErrorCount++;
    }
    if (response.timings.duration > STRESS_THRESHOLDS.database_connection_timeout) {
      timeoutCount++;
    }
  });
  
  const dbErrorRate = dbErrorCount / dbResponses.length;
  const timeoutRate = timeoutCount / dbResponses.length;
  
  databaseConnectionErrors.add(dbErrorRate);
  
  check(null, {
    'database connection errors manageable': () => dbErrorRate < 0.1, // 10% max
    'database timeout rate acceptable': () => timeoutRate < 0.2, // 20% max
    'database pool not exhausted': () => dbErrorCount < dbOperations.length / 2
  });
}

function kubernetesResourceStress(data) {
  const k8sOperations = [];
  const namespaceCount = 15;
  
  // Create operations that stress Kubernetes API
  for (let i = 0; i < namespaceCount; i++) {
    const plugin = STRESS_TEST_PLUGINS[i % STRESS_TEST_PLUGINS.length];
    
    // Deployment creation
    k8sOperations.push([
      'POST',
      `${BASE_URL}/api/plugin-installer`,
      JSON.stringify({
        pluginId: `${plugin}-k8s-stress-${i}`,
        environment: 'kubernetes',
        namespace: `stress-test-${i}`,
        resources: {
          requests: { cpu: '50m', memory: '64Mi' },
          limits: { cpu: '100m', memory: '128Mi' }
        }
      }),
      { headers: { 'Authorization': `Bearer ${data.authToken}`, 'Content-Type': 'application/json' } }
    ]);
    
    // Resource monitoring
    k8sOperations.push([
      'GET',
      `${BASE_URL}/api/kubernetes/namespaces/stress-test-${i}/resources`,
      null,
      { headers: { 'Authorization': `Bearer ${data.authToken}` } }
    ]);
  }
  
  const k8sResponses = http.batch(k8sOperations);
  
  let k8sErrorCount = 0;
  let resourceQuotaErrors = 0;
  
  k8sResponses.forEach(response => {
    if (response.status === 403 || response.status === 429) { // Quota exceeded or rate limited
      resourceQuotaErrors++;
    } else if (response.status >= 500) {
      k8sErrorCount++;
    }
  });
  
  const k8sErrorRate = k8sErrorCount / k8sResponses.length;
  const quotaErrorRate = resourceQuotaErrors / k8sResponses.length;
  
  kubernetesResourceErrors.add(k8sErrorRate);
  
  check(null, {
    'kubernetes API handles stress': () => k8sErrorRate < 0.15, // 15% max errors
    'resource quotas enforced': () => quotaErrorRate < 0.5, // 50% max quota errors (expected)
    'kubernetes operations responsive': () => k8sResponses.some(r => r.status === 200)
  });
}

function configurationOperationStorm(data) {
  const configOps = [];
  const stormSize = 30;
  
  // Generate a storm of configuration operations
  for (let i = 0; i < stormSize; i++) {
    const plugin = STRESS_TEST_PLUGINS[Math.floor(Math.random() * STRESS_TEST_PLUGINS.length)];
    const operation = Math.random() > 0.5 ? 'configure' : 'validate';
    
    const configData = {
      title: `Stress Config ${i}`,
      database: {
        host: `db-${i}.example.com`,
        port: 5432 + (i % 100),
        name: `stress_db_${i}`,
        ssl: i % 2 === 0
      },
      features: ['catalog', 'search', 'monitoring', 'techdocs'].slice(0, (i % 4) + 1),
      limits: {
        maxEntities: 1000 + (i * 100),
        cacheTimeout: 300 + (i * 60)
      }
    };
    
    configOps.push([
      'POST',
      `${BASE_URL}/api/plugins`,
      JSON.stringify({
        action: operation,
        pluginId: plugin,
        config: configData
      }),
      { headers: { 'Authorization': `Bearer ${data.authToken}`, 'Content-Type': 'application/json' } }
    ]);
  }
  
  const configResponses = http.batch(configOps);
  
  let validationErrors = 0;
  let configurationErrors = 0;
  
  configResponses.forEach(response => {
    if (response.status === 400) {
      validationErrors++;
    } else if (response.status >= 500) {
      configurationErrors++;
    }
  });
  
  const totalErrorRate = (validationErrors + configurationErrors) / configResponses.length;
  pluginOperationErrors.add(totalErrorRate);
  
  check(null, {
    'configuration storm handled': () => totalErrorRate < 0.2, // 20% max errors
    'validation system responsive': () => validationErrors < stormSize / 2,
    'configuration persistence stable': () => configurationErrors < stormSize / 4
  });
}

function memoryLeakDetection(data) {
  const startMemory = data.baseline.memory;
  
  // Perform memory-intensive operations
  const memoryIntensiveOps = [];
  
  for (let i = 0; i < 20; i++) {
    // Large payload operations
    const largeConfig = {
      metadata: new Array(1000).fill(0).map((_, idx) => ({
        id: `item-${idx}`,
        data: `large-data-${idx}-`.repeat(50)
      })),
      features: new Array(100).fill(0).map((_, idx) => `feature-${idx}`)
    };
    
    memoryIntensiveOps.push([
      'POST',
      `${BASE_URL}/api/plugins`,
      JSON.stringify({
        action: 'configure',
        pluginId: STRESS_TEST_PLUGINS[i % STRESS_TEST_PLUGINS.length],
        config: largeConfig
      }),
      { headers: { 'Authorization': `Bearer ${data.authToken}`, 'Content-Type': 'application/json' } }
    ]);
  }
  
  http.batch(memoryIntensiveOps);
  
  // Check memory after operations
  sleep(2); // Allow time for memory allocation
  
  const postOpMetrics = http.get(`${BASE_URL}/api/system/metrics`, {
    headers: { 'Authorization': `Bearer ${data.authToken}` }
  });
  
  if (postOpMetrics.status === 200) {
    const currentMemory = postOpMetrics.json().memory;
    const memoryIncrease = (currentMemory - startMemory) / startMemory;
    
    memoryLeakIndicator.add(memoryIncrease);
    
    check(null, {
      'memory growth within limits': () => memoryIncrease < STRESS_THRESHOLDS.memory_growth_rate,
      'memory metrics available': () => currentMemory !== undefined,
      'system not out of memory': () => currentMemory < 0.95 // 95% memory usage limit
    });
  }
}

// Generate HTML report
export function handleSummary(data) {
  return {
    'stress-test-report.html': htmlReport(data),
    stdout: '\n' + htmlReport(data, { debug: true }) + '\n\n',
    'stress-test-summary.json': JSON.stringify(data, null, 2)
  };
}

// Cleanup function
export function teardown(data) {
  console.log('Stress test completed. Generating cleanup report...');
  
  // Attempt to clean up stress test resources
  const cleanupResponse = http.post(`${BASE_URL}/api/system/cleanup`, 
    JSON.stringify({
      action: 'cleanup_stress_test',
      patterns: ['stress-test-*', '*-stress-*']
    }), 
    {
      headers: {
        'Authorization': `Bearer ${data.authToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  check(cleanupResponse, {
    'cleanup completed successfully': (r) => r.status === 200,
  });
  
  console.log('Stress test teardown completed.');
}