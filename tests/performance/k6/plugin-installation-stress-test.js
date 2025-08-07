import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Counter, Trend, Gauge } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// Custom metrics for plugin installation performance
const installationFailureRate = new Rate('installation_failure_rate');
const installationDuration = new Trend('installation_duration');
const concurrentInstallations = new Gauge('concurrent_installations');
const resourceExhaustionErrors = new Counter('resource_exhaustion_errors');
const dependencyConflicts = new Counter('dependency_conflicts');
const rollbackSuccessRate = new Rate('rollback_success_rate');

// Load test data
const testPlugins = new SharedArray('test-plugins', function() {
  return [
    {
      id: 'lightweight-plugin-1',
      name: 'Lightweight Test Plugin 1',
      size: 'small',
      resources: { memory: '128Mi', cpu: '0.1' },
      dependencies: [],
    },
    {
      id: 'medium-plugin-1',
      name: 'Medium Test Plugin 1',
      size: 'medium',
      resources: { memory: '512Mi', cpu: '0.5' },
      dependencies: ['lightweight-plugin-1'],
    },
    {
      id: 'heavy-plugin-1',
      name: 'Heavy Test Plugin 1',
      size: 'large',
      resources: { memory: '2Gi', cpu: '1.0' },
      dependencies: ['medium-plugin-1', 'lightweight-plugin-1'],
    },
    {
      id: 'database-plugin',
      name: 'Database Integration Plugin',
      size: 'medium',
      resources: { memory: '1Gi', cpu: '0.5' },
      dependencies: [],
      requiresSecrets: true,
    },
    {
      id: 'analytics-plugin',
      name: 'Analytics Dashboard Plugin',
      size: 'large',
      resources: { memory: '1.5Gi', cpu: '0.8' },
      dependencies: ['database-plugin'],
      requiresSecrets: true,
    },
    {
      id: 'monitoring-plugin',
      name: 'Monitoring Agent Plugin',
      size: 'medium',
      resources: { memory: '512Mi', cpu: '0.3' },
      dependencies: [],
      persistent: true,
    },
    {
      id: 'security-scanner',
      name: 'Security Scanner Plugin',
      size: 'large',
      resources: { memory: '2Gi', cpu: '1.5' },
      dependencies: ['monitoring-plugin'],
      securityContext: true,
    },
  ];
});

// Test scenarios configuration
export let options = {
  scenarios: {
    // Gradual ramp-up to test system capacity
    gradual_load: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '2m', target: 5 },   // Ramp up to 5 concurrent installations
        { duration: '5m', target: 10 },  // Hold at 10 concurrent installations
        { duration: '3m', target: 20 },  // Spike to 20 concurrent installations
        { duration: '5m', target: 20 },  // Hold spike
        { duration: '2m', target: 0 },   // Ramp down
      ],
      tags: { scenario: 'gradual_load' },
    },
    
    // Burst installation test
    burst_installations: {
      executor: 'constant-arrival-rate',
      rate: 2, // 2 installations per second
      timeUnit: '1s',
      duration: '3m',
      preAllocatedVUs: 10,
      maxVUs: 50,
      tags: { scenario: 'burst' },
    },
    
    // Dependency chain stress test
    dependency_stress: {
      executor: 'per-vu-iterations',
      vus: 5,
      iterations: 10,
      maxDuration: '10m',
      tags: { scenario: 'dependency_stress' },
    },
    
    // Resource exhaustion test
    resource_exhaustion: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      stages: [
        { duration: '2m', target: 5 },   // 5 installations/sec
        { duration: '3m', target: 10 },  // 10 installations/sec
        { duration: '2m', target: 20 },  // 20 installations/sec (should cause failures)
        { duration: '1m', target: 5 },   // Back to sustainable rate
      ],
      preAllocatedVUs: 20,
      maxVUs: 100,
      tags: { scenario: 'resource_exhaustion' },
    },
  },
  
  thresholds: {
    // Overall thresholds
    'http_req_duration': ['p(95)<10000'], // 95% of requests under 10s
    'http_req_failed': ['rate<0.05'], // Less than 5% HTTP failures
    
    // Plugin-specific thresholds
    'installation_duration': [
      'p(50)<5000',  // Median installation under 5s
      'p(95)<30000', // 95% of installations under 30s
    ],
    'installation_failure_rate': ['rate<0.1'], // Less than 10% installation failures
    'resource_exhaustion_errors': ['count<100'],
    'dependency_conflicts': ['count<10'],
    'rollback_success_rate': ['rate>0.9'], // 90%+ rollback success rate
    
    // Scenario-specific thresholds
    'http_req_duration{scenario:burst}': ['p(90)<15000'],
    'installation_failure_rate{scenario:resource_exhaustion}': ['rate<0.3'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4400';
const API_BASE = `${BASE_URL}/api`;

// Helper functions
function randomPlugin() {
  return testPlugins[Math.floor(Math.random() * testPlugins.length)];
}

function generatePluginConfig(plugin) {
  const baseConfig = {
    name: `${plugin.name}-${Date.now()}`,
    environment: 'test',
    logLevel: 'info',
  };
  
  if (plugin.requiresSecrets) {
    baseConfig.secrets = {
      apiKey: `secret-${Math.random().toString(36).substr(2, 16)}`,
      dbPassword: `pwd-${Math.random().toString(36).substr(2, 12)}`,
    };
  }
  
  if (plugin.persistent) {
    baseConfig.persistence = {
      enabled: true,
      size: '1Gi',
      storageClass: 'standard',
    };
  }
  
  if (plugin.securityContext) {
    baseConfig.securityContext = {
      runAsUser: 1000,
      runAsGroup: 1000,
      fsGroup: 2000,
      readOnlyRootFilesystem: true,
    };
  }
  
  return baseConfig;
}

function sleep_jitter(min = 0.5, max = 2) {
  sleep(Math.random() * (max - min) + min);
}

// Setup function
export function setup() {
  console.log('Starting Plugin Installation Stress Test');
  
  // Verify system is ready
  const healthCheck = http.get(`${BASE_URL}/api/health`);
  if (healthCheck.status !== 200) {
    throw new Error('System health check failed');
  }
  
  // Check available resources
  const resourcesCheck = http.get(`${API_BASE}/admin/system/resources`);
  if (resourcesCheck.status === 200) {
    const resources = JSON.parse(resourcesCheck.body);
    console.log(`Available resources: CPU=${resources.cpu}, Memory=${resources.memory}`);
  }
  
  return {
    startTime: Date.now(),
  };
}

// Main test function
export default function(data) {
  const scenario = __ENV.SCENARIO || __ITER % 4;
  
  switch (scenario) {
    case 0:
    case '0':
      testBasicInstallation();
      break;
    case 1:
    case '1':
      testDependencyChainInstallation();
      break;
    case 2:
    case '2':
      testConcurrentInstallations();
      break;
    case 3:
    case '3':
      testFailureRecovery();
      break;
    default:
      testBasicInstallation();
  }
  
  sleep_jitter();
}

function testBasicInstallation() {
  group('Basic Plugin Installation', () => {
    const plugin = randomPlugin();
    const config = generatePluginConfig(plugin);
    
    const installStartTime = Date.now();
    concurrentInstallations.add(1);
    
    // Attempt installation
    const installResponse = http.post(
      `${API_BASE}/plugins/${plugin.id}/install`,
      JSON.stringify({ config }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
        tags: {
          plugin_size: plugin.size,
          has_dependencies: plugin.dependencies.length > 0,
        },
      }
    );
    
    const installDuration = Date.now() - installStartTime;
    installationDuration.add(installDuration);
    concurrentInstallations.add(-1);
    
    const installSuccess = check(installResponse, {
      'installation request accepted': (r) => [200, 202].includes(r.status),
      'installation response is valid JSON': (r) => {
        try {
          JSON.parse(r.body);
          return true;
        } catch (e) {
          return false;
        }
      },
      'installation has tracking ID': (r) => {
        const data = JSON.parse(r.body);
        return data.installationId || data.taskId;
      },
    });
    
    if (!installSuccess) {
      installationFailureRate.add(1);
      
      // Check for specific error types
      if (installResponse.status === 429) {
        resourceExhaustionErrors.add(1);
      }
      
      if (installResponse.body && installResponse.body.includes('dependency')) {
        dependencyConflicts.add(1);
      }
      
      return;
    }
    
    installationFailureRate.add(0);
    const installData = JSON.parse(installResponse.body);
    
    // Monitor installation progress
    if (installData.installationId) {
      monitorInstallationProgress(plugin.id, installData.installationId);
    }
    
    // Test post-installation health
    sleep(2); // Allow some time for plugin to start
    testPluginHealth(plugin.id);
  });
}

function testDependencyChainInstallation() {
  group('Dependency Chain Installation', () => {
    // Select a plugin with dependencies
    const pluginsWithDeps = testPlugins.filter(p => p.dependencies.length > 0);
    if (pluginsWithDeps.length === 0) {
      console.log('No plugins with dependencies available for testing');
      return;
    }
    
    const plugin = pluginsWithDeps[Math.floor(Math.random() * pluginsWithDeps.length)];
    
    // Check dependency status
    const depCheckPromises = plugin.dependencies.map(depId => {
      return http.get(`${API_BASE}/plugins/${depId}/status`);
    });
    
    const missingDeps = [];
    plugin.dependencies.forEach((depId, index) => {
      const depResponse = depCheckPromises[index];
      if (depResponse.status !== 200) {
        missingDeps.push(depId);
      }
    });
    
    if (missingDeps.length > 0) {
      console.log(`Installing dependencies first: ${missingDeps.join(', ')}`);
      // Install dependencies first
      missingDeps.forEach(depId => {
        const depPlugin = testPlugins.find(p => p.id === depId);
        if (depPlugin) {
          installSinglePlugin(depPlugin);
          sleep(1); // Stagger dependency installations
        }
      });
    }
    
    // Now install the main plugin
    const installStartTime = Date.now();
    const result = installSinglePlugin(plugin);
    const totalDuration = Date.now() - installStartTime;
    
    check(result, {
      'dependency chain installation succeeded': (r) => r && r.success,
      'dependency chain installation time reasonable': () => totalDuration < 60000, // 1 minute
    });
  });
}

function testConcurrentInstallations() {
  group('Concurrent Plugin Installations', () => {
    const concurrentCount = Math.min(3, testPlugins.length);
    const plugins = [];
    
    // Select unique plugins for concurrent installation
    const shuffled = [...testPlugins].sort(() => Math.random() - 0.5);
    for (let i = 0; i < concurrentCount; i++) {
      plugins.push(shuffled[i]);
    }
    
    const installPromises = plugins.map(plugin => {
      return new Promise((resolve) => {
        const startTime = Date.now();
        const config = generatePluginConfig(plugin);
        
        const response = http.post(
          `${API_BASE}/plugins/${plugin.id}/install`,
          JSON.stringify({ config }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer test-token',
            },
          }
        );
        
        resolve({
          plugin: plugin.id,
          response,
          duration: Date.now() - startTime,
        });
      });
    });
    
    // Execute concurrent installations
    concurrentInstallations.add(concurrentCount);
    const results = Promise.all(installPromises);
    concurrentInstallations.add(-concurrentCount);
    
    // Analyze results
    let successCount = 0;
    let totalDuration = 0;
    
    results.forEach(result => {
      totalDuration += result.duration;
      if ([200, 202].includes(result.response.status)) {
        successCount++;
      }
    });
    
    const avgDuration = totalDuration / concurrentCount;
    const successRate = successCount / concurrentCount;
    
    check({ successRate, avgDuration }, {
      'concurrent installation success rate > 70%': (r) => r.successRate > 0.7,
      'concurrent installation average duration < 15s': (r) => r.avgDuration < 15000,
    });
    
    installationFailureRate.add(1 - successRate);
  });
}

function testFailureRecovery() {
  group('Installation Failure Recovery', () => {
    const plugin = randomPlugin();
    
    // Simulate installation failure by using invalid config
    const invalidConfig = {
      invalidField: 'invalid-value',
      memory: '-1Gi', // Invalid memory specification
    };
    
    const failResponse = http.post(
      `${API_BASE}/plugins/${plugin.id}/install`,
      JSON.stringify({ config: invalidConfig }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
      }
    );
    
    const failureDetected = check(failResponse, {
      'invalid installation correctly rejected': (r) => r.status >= 400,
      'error response has proper structure': (r) => {
        try {
          const data = JSON.parse(r.body);
          return data.error && typeof data.error === 'string';
        } catch (e) {
          return false;
        }
      },
    });
    
    if (!failureDetected) return;
    
    // Attempt rollback/cleanup if installation was partially started
    sleep(1);
    const cleanupResponse = http.delete(`${API_BASE}/plugins/${plugin.id}/install`);
    
    const rollbackSuccess = check(cleanupResponse, {
      'cleanup/rollback request processed': (r) => [200, 404].includes(r.status),
    });
    
    rollbackSuccessRate.add(rollbackSuccess ? 1 : 0);
    
    // Try installing with correct config after failure
    sleep(1);
    const validConfig = generatePluginConfig(plugin);
    const retryResponse = http.post(
      `${API_BASE}/plugins/${plugin.id}/install`,
      JSON.stringify({ config: validConfig }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
      }
    );
    
    check(retryResponse, {
      'retry after failure succeeds': (r) => [200, 202].includes(r.status),
    });
  });
}

function installSinglePlugin(plugin) {
  const config = generatePluginConfig(plugin);
  const response = http.post(
    `${API_BASE}/plugins/${plugin.id}/install`,
    JSON.stringify({ config }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
      },
    }
  );
  
  return {
    success: [200, 202].includes(response.status),
    response,
    plugin: plugin.id,
  };
}

function monitorInstallationProgress(pluginId, installationId) {
  const maxChecks = 10;
  const checkInterval = 1; // seconds
  
  for (let i = 0; i < maxChecks; i++) {
    sleep(checkInterval);
    
    const progressResponse = http.get(
      `${API_BASE}/plugins/${pluginId}/installation/${installationId}/status`
    );
    
    if (progressResponse.status === 200) {
      const status = JSON.parse(progressResponse.body);
      
      if (status.state === 'completed' || status.state === 'failed') {
        break;
      }
    }
  }
}

function testPluginHealth(pluginId) {
  sleep(1); // Allow plugin to initialize
  
  const healthResponse = http.get(`${API_BASE}/plugins/${pluginId}/health`);
  
  check(healthResponse, {
    'plugin health check responds': (r) => r.status !== 0,
    'plugin health check time < 2s': (r) => r.timings.duration < 2000,
  });
  
  if (healthResponse.status === 200) {
    const health = JSON.parse(healthResponse.body);
    check(health, {
      'plugin is healthy': (h) => h.status === 'healthy' || h.status === 'starting',
    });
  }
}

// Teardown function
export function teardown(data) {
  const endTime = Date.now();
  const totalDuration = endTime - data.startTime;
  
  console.log(`\nPlugin Installation Stress Test Summary:`);
  console.log(`Total duration: ${totalDuration / 1000}s`);
  console.log(`Test completed at: ${new Date().toISOString()}`);
  
  // Optional: Cleanup test installations
  if (__ENV.CLEANUP_AFTER_TEST === 'true') {
    console.log('Cleaning up test installations...');
    
    testPlugins.forEach(plugin => {
      const cleanupResponse = http.delete(
        `${API_BASE}/plugins/${plugin.id}/uninstall`,
        null,
        {
          headers: {
            'Authorization': 'Bearer test-token',
          },
        }
      );
      
      if (cleanupResponse.status === 200) {
        console.log(`Cleaned up ${plugin.id}`);
      }
    });
  }
}