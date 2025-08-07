import { test, expect, Page, BrowserContext } from '@playwright/test';
import { setTimeout } from 'timers/promises';

// Test configuration for plugin installation workflow
const INSTALLATION_CONFIG = {
  DOCKER: {
    environment: 'local',
    resources: {
      cpu: '1 CPU Core',
      memory: '1GB RAM',
      storage: '2GB Storage'
    }
  },
  KUBERNETES: {
    environment: 'kubernetes',
    resources: {
      cpu: '500m CPU',
      memory: '1Gi RAM', 
      storage: '2GB Storage'
    }
  }
};

const INSTALLATION_PHASES = [
  'pending',
  'installing', 
  'building',
  'deploying',
  'running'
];

const PERFORMANCE_SLA = {
  INSTALLATION_START: 3000,
  PHASE_TRANSITION: 5000,
  HEALTH_CHECK_RESPONSE: 2000,
  LOG_STREAMING: 1000
};

test.describe('Plugin Installation Workflow', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      permissions: ['notifications'],
      recordVideo: { dir: 'tests/e2e/test-results/videos/installation/' },
      trace: 'retain-on-failure'
    });
  });

  test.beforeEach(async () => {
    page = await context.newPage();
    
    // Mock the plugin installer API for consistent testing
    let currentPhase = 0;
    let installId: string;

    await page.route('/api/plugin-installer*', async (route) => {
      const method = route.request().method();
      const url = new URL(route.request().url());
      
      if (method === 'POST') {
        // Start installation
        installId = `test-install-${Date.now()}`;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            installId,
            message: 'Installation started'
          })
        });
      } else if (method === 'GET') {
        // Poll installation status
        const phase = INSTALLATION_PHASES[currentPhase] || 'running';
        const isComplete = currentPhase >= INSTALLATION_PHASES.length - 1;
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            pluginId: '@backstage/plugin-test',
            status: phase,
            installId: url.searchParams.get('installId'),
            containerId: isComplete ? 'container-123' : undefined,
            namespace: 'backstage-plugin-test',
            serviceUrl: isComplete ? 'http://localhost:3000' : undefined,
            healthCheckUrl: isComplete ? 'http://localhost:3000/health' : undefined,
            logs: [
              'Starting installation...',
              'Downloading plugin package...',
              'Building Docker image...',
              'Deploying to environment...',
              ...(isComplete ? ['Plugin is now running'] : [])
            ].slice(0, currentPhase + 2),
            startedAt: new Date().toISOString(),
            completedAt: isComplete ? new Date().toISOString() : undefined,
            resources: {
              cpu: '500m',
              memory: '1Gi',
              storage: '2Gi'
            }
          })
        });
        
        // Progress through phases
        if (currentPhase < INSTALLATION_PHASES.length - 1) {
          currentPhase++;
        }
      } else if (method === 'DELETE') {
        // Stop installation
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Installation stopped'
          })
        });
      }
    });

    // Mock health check endpoints
    await page.route('**/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString()
        })
      });
    });

    // Navigate to plugin installer
    await page.goto('/plugins/install/@backstage/plugin-test');
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should display plugin installer interface', async () => {
    // Verify installer components are loaded
    await expect(page.locator('[data-testid="plugin-installer"]')).toBeVisible();
    await expect(page.locator('[data-testid="plugin-name"]')).toContainText('@backstage/plugin-test');
    await expect(page.locator('[data-testid="plugin-version"]')).toContainText('latest');
    
    // Verify environment selection options
    await expect(page.locator('[data-testid="environment-local"]')).toBeVisible();
    await expect(page.locator('[data-testid="environment-kubernetes"]')).toBeVisible();
    
    // Verify resource requirements display
    await expect(page.locator('[data-testid="resource-requirements"]')).toBeVisible();
    await expect(page.locator('[data-testid="cpu-requirement"]')).toBeVisible();
    await expect(page.locator('[data-testid="memory-requirement"]')).toBeVisible();
    await expect(page.locator('[data-testid="storage-requirement"]')).toBeVisible();
  });

  test('should configure installation environment - Docker', async () => {
    // Select Docker environment
    await page.locator('[data-testid="environment-local"]').click();
    
    // Verify Docker environment is selected
    await expect(page.locator('[data-testid="environment-local"]')).toHaveClass(/border-blue-500/);
    
    // Verify resource requirements for Docker
    await expect(page.locator('[data-testid="cpu-requirement"]')).toContainText(INSTALLATION_CONFIG.DOCKER.resources.cpu);
    await expect(page.locator('[data-testid="memory-requirement"]')).toContainText(INSTALLATION_CONFIG.DOCKER.resources.memory);
    await expect(page.locator('[data-testid="storage-requirement"]')).toContainText(INSTALLATION_CONFIG.DOCKER.resources.storage);
    
    // Verify namespace input is not visible for Docker
    await expect(page.locator('[data-testid="namespace-input"]')).not.toBeVisible();
  });

  test('should configure installation environment - Kubernetes', async () => {
    // Select Kubernetes environment
    await page.locator('[data-testid="environment-kubernetes"]').click();
    
    // Verify Kubernetes environment is selected
    await expect(page.locator('[data-testid="environment-kubernetes"]')).toHaveClass(/border-blue-500/);
    
    // Verify resource requirements for Kubernetes
    await expect(page.locator('[data-testid="cpu-requirement"]')).toContainText(INSTALLATION_CONFIG.KUBERNETES.resources.cpu);
    await expect(page.locator('[data-testid="memory-requirement"]')).toContainText(INSTALLATION_CONFIG.KUBERNETES.resources.memory);
    
    // Verify namespace input is visible for Kubernetes
    await expect(page.locator('[data-testid="namespace-input"]')).toBeVisible();
    
    // Test custom namespace input
    const namespaceInput = page.locator('[data-testid="namespace-input"]');
    await namespaceInput.fill('custom-namespace');
    await expect(namespaceInput).toHaveValue('custom-namespace');
  });

  test('should start plugin installation with performance validation', async () => {
    // Select environment
    await page.locator('[data-testid="environment-local"]').click();
    
    // Start installation
    const installButton = page.locator('[data-testid="install-button"]');
    
    const startTime = Date.now();
    await installButton.click();
    
    // Verify installation starts quickly
    await expect(page.locator('[data-testid="installation-status"]')).toBeVisible();
    
    const installationStartTime = Date.now() - startTime;
    expect(installationStartTime).toBeLessThan(PERFORMANCE_SLA.INSTALLATION_START);
    
    // Verify installation button is disabled during installation
    await expect(installButton).toBeDisabled();
    await expect(installButton).toContainText('Starting...');
  });

  test('should track installation progress through all phases', async () => {
    // Start installation
    await page.locator('[data-testid="environment-local"]').click();
    await page.locator('[data-testid="install-button"]').click();
    
    // Track progress through each phase
    for (let i = 0; i < INSTALLATION_PHASES.length; i++) {
      const phase = INSTALLATION_PHASES[i];
      const phaseStartTime = Date.now();
      
      // Wait for phase to appear
      await expect(page.locator('[data-testid="installation-status"]')).toContainText(phase, { timeout: 10000 });
      
      const phaseTransitionTime = Date.now() - phaseStartTime;
      if (i > 0) { // Skip timing check for first phase
        expect(phaseTransitionTime).toBeLessThan(PERFORMANCE_SLA.PHASE_TRANSITION);
      }
      
      // Verify status icon matches phase
      const statusIcon = page.locator('[data-testid="status-icon"]');
      await expect(statusIcon).toBeVisible();
      
      // For the final phase, verify completion indicators
      if (phase === 'running') {
        await expect(page.locator('[data-testid="installation-complete"]')).toBeVisible();
        await expect(page.locator('[data-testid="service-url"]')).toBeVisible();
        await expect(page.locator('[data-testid="health-check-url"]')).toBeVisible();
      }
    }
  });

  test('should display real-time installation logs', async () => {
    // Start installation
    await page.locator('[data-testid="environment-local"]').click();
    await page.locator('[data-testid="install-button"]').click();
    
    // Show logs
    await page.locator('[data-testid="show-logs-button"]').click();
    
    const logsStartTime = Date.now();
    
    // Verify logs panel appears
    await expect(page.locator('[data-testid="installation-logs"]')).toBeVisible();
    
    const logsDisplayTime = Date.now() - logsStartTime;
    expect(logsDisplayTime).toBeLessThan(PERFORMANCE_SLA.LOG_STREAMING);
    
    // Verify logs contain installation steps
    const logsContainer = page.locator('[data-testid="logs-container"]');
    await expect(logsContainer).toContainText('Starting installation...');
    await expect(logsContainer).toContainText('Downloading plugin package...');
    
    // Wait for more logs to appear
    await page.waitForTimeout(3000);
    await expect(logsContainer).toContainText('Building Docker image...');
    
    // Test logs scrolling and formatting
    const logEntries = page.locator('[data-testid="log-entry"]');
    const logCount = await logEntries.count();
    expect(logCount).toBeGreaterThan(2);
    
    // Verify each log entry has timestamp
    for (let i = 0; i < Math.min(3, logCount); i++) {
      const logEntry = logEntries.nth(i);
      await expect(logEntry).toContainText('[');
      await expect(logEntry).toContainText(']');
    }
  });

  test('should handle installation resource monitoring', async () => {
    // Start installation
    await page.locator('[data-testid="environment-local"]').click();
    await page.locator('[data-testid="install-button"]').click();
    
    // Wait for installation to progress
    await expect(page.locator('[data-testid="installation-status"]')).toContainText('running', { timeout: 15000 });
    
    // Verify resource monitoring section
    await expect(page.locator('[data-testid="resource-monitoring"]')).toBeVisible();
    
    // Check individual resource metrics
    const cpuMetric = page.locator('[data-testid="cpu-usage"]');
    const memoryMetric = page.locator('[data-testid="memory-usage"]');
    const storageMetric = page.locator('[data-testid="storage-usage"]');
    
    await expect(cpuMetric).toBeVisible();
    await expect(memoryMetric).toBeVisible();
    await expect(storageMetric).toBeVisible();
    
    // Verify resource values are displayed
    await expect(cpuMetric).toContainText('500m');
    await expect(memoryMetric).toContainText('1Gi');
    await expect(storageMetric).toContainText('2Gi');
  });

  test('should provide service access after successful installation', async () => {
    // Start and complete installation
    await page.locator('[data-testid="environment-local"]').click();
    await page.locator('[data-testid="install-button"]').click();
    
    // Wait for completion
    await expect(page.locator('[data-testid="installation-status"]')).toContainText('running', { timeout: 15000 });
    
    // Verify service access section
    await expect(page.locator('[data-testid="service-access"]')).toBeVisible();
    
    // Check service URL
    const serviceUrl = page.locator('[data-testid="service-url"]');
    await expect(serviceUrl).toBeVisible();
    await expect(serviceUrl).toContainText('http://localhost:3000');
    
    // Check health check URL
    const healthUrl = page.locator('[data-testid="health-check-url"]');
    await expect(healthUrl).toBeVisible();
    await expect(healthUrl).toContainText('http://localhost:3000/health');
    
    // Test service URL link
    const openServiceButton = page.locator('[data-testid="open-service-button"]');
    await expect(openServiceButton).toBeVisible();
    
    // Verify link attributes
    await expect(openServiceButton).toHaveAttribute('href', 'http://localhost:3000');
    await expect(openServiceButton).toHaveAttribute('target', '_blank');
  });

  test('should support installation cancellation', async () => {
    // Start installation
    await page.locator('[data-testid="environment-local"]').click();
    await page.locator('[data-testid="install-button"]').click();
    
    // Wait for installation to start
    await expect(page.locator('[data-testid="installation-status"]')).toBeVisible();
    
    // Cancel installation
    const stopButton = page.locator('[data-testid="stop-installation-button"]');
    await expect(stopButton).toBeVisible();
    await stopButton.click();
    
    // Verify cancellation confirmation
    await expect(page.locator('[data-testid="stop-confirmation"]')).toBeVisible();
    await page.locator('[data-testid="confirm-stop"]').click();
    
    // Verify installation is stopped
    await expect(page.locator('[data-testid="installation-status"]')).toContainText('stopped');
    
    // Verify retry option is available
    await expect(page.locator('[data-testid="retry-installation"]')).toBeVisible();
  });

  test('should handle installation failure gracefully', async () => {
    // Mock installation failure
    await page.route('/api/plugin-installer*', async (route) => {
      const method = route.request().method();
      
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            status: 'failed',
            error: 'Docker daemon not running',
            logs: [
              'Starting installation...',
              'Downloading plugin package...',
              'ERROR: Docker daemon not running',
              'Installation failed'
            ]
          })
        });
      }
    });
    
    // Start installation
    await page.locator('[data-testid="environment-local"]').click();
    await page.locator('[data-testid="install-button"]').click();
    
    // Wait for failure status
    await expect(page.locator('[data-testid="installation-status"]')).toContainText('failed', { timeout: 10000 });
    
    // Verify error display
    await expect(page.locator('[data-testid="installation-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="installation-error"]')).toContainText('Docker daemon not running');
    
    // Verify retry button is available
    await expect(page.locator('[data-testid="retry-installation"]')).toBeVisible();
    
    // Verify logs show error details
    await page.locator('[data-testid="show-logs-button"]').click();
    await expect(page.locator('[data-testid="logs-container"]')).toContainText('ERROR: Docker daemon not running');
  });

  test('should support installation retry after failure', async () => {
    // Mock initial failure then success
    let attemptCount = 0;
    
    await page.route('/api/plugin-installer*', async (route) => {
      const method = route.request().method();
      
      if (method === 'POST') {
        attemptCount++;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            installId: `retry-install-${attemptCount}`,
            message: 'Installation started'
          })
        });
      } else if (method === 'GET') {
        if (attemptCount === 1) {
          // First attempt fails
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              status: 'failed',
              error: 'Network timeout',
              logs: ['Installation failed due to network timeout']
            })
          });
        } else {
          // Second attempt succeeds
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              status: 'running',
              serviceUrl: 'http://localhost:3000',
              logs: ['Installation completed successfully']
            })
          });
        }
      }
    });
    
    // Start installation (will fail)
    await page.locator('[data-testid="environment-local"]').click();
    await page.locator('[data-testid="install-button"]').click();
    
    // Wait for failure
    await expect(page.locator('[data-testid="installation-status"]')).toContainText('failed', { timeout: 10000 });
    
    // Retry installation
    await page.locator('[data-testid="retry-installation"]').click();
    
    // Verify success on retry
    await expect(page.locator('[data-testid="installation-status"]')).toContainText('running', { timeout: 10000 });
    await expect(page.locator('[data-testid="service-url"]')).toBeVisible();
  });

  test('should validate health checks after installation', async () => {
    // Complete installation
    await page.locator('[data-testid="environment-local"]').click();
    await page.locator('[data-testid="install-button"]').click();
    
    // Wait for completion
    await expect(page.locator('[data-testid="installation-status"]')).toContainText('running', { timeout: 15000 });
    
    // Verify health check is performed
    const healthIndicator = page.locator('[data-testid="health-indicator"]');
    await expect(healthIndicator).toBeVisible();
    
    const healthCheckStartTime = Date.now();
    
    // Wait for health check result
    await expect(healthIndicator).toHaveClass(/text-green-500/, { timeout: 5000 });
    
    const healthCheckTime = Date.now() - healthCheckStartTime;
    expect(healthCheckTime).toBeLessThan(PERFORMANCE_SLA.HEALTH_CHECK_RESPONSE);
    
    // Verify health status details
    await page.locator('[data-testid="health-details"]').click();
    await expect(page.locator('[data-testid="health-status-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="health-status-text"]')).toContainText('healthy');
  });

  test('should handle concurrent installations', async () => {
    // Open multiple installer tabs
    const page2 = await context.newPage();
    await page2.goto('/plugins/install/@backstage/plugin-test-2');
    await page2.waitForLoadState('networkidle');
    
    // Start installations concurrently
    await Promise.all([
      page.locator('[data-testid="environment-local"]').click(),
      page2.locator('[data-testid="environment-local"]').click()
    ]);
    
    await Promise.all([
      page.locator('[data-testid="install-button"]').click(),
      page2.locator('[data-testid="install-button"]').click()
    ]);
    
    // Verify both installations progress independently
    await expect(page.locator('[data-testid="installation-status"]')).toBeVisible();
    await expect(page2.locator('[data-testid="installation-status"]')).toBeVisible();
    
    // Wait for both to complete
    await Promise.all([
      expect(page.locator('[data-testid="installation-status"]')).toContainText('running', { timeout: 15000 }),
      expect(page2.locator('[data-testid="installation-status"]')).toContainText('running', { timeout: 15000 })
    ]);
    
    await page2.close();
  });

  test('should persist installation state across page reloads', async () => {
    // Start installation
    await page.locator('[data-testid="environment-local"]').click();
    await page.locator('[data-testid="install-button"]').click();
    
    // Wait for installation to start
    await expect(page.locator('[data-testid="installation-status"]')).toBeVisible();
    
    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Verify installation state is restored
    await expect(page.locator('[data-testid="installation-status"]')).toBeVisible();
    
    // If installation was in progress, it should continue
    // If completed, service details should be shown
    const status = await page.locator('[data-testid="installation-status"]').textContent();
    
    if (status?.includes('running')) {
      await expect(page.locator('[data-testid="service-url"]')).toBeVisible();
    } else {
      // Should continue progressing
      await expect(page.locator('[data-testid="installation-status"]')).not.toContainText('pending');
    }
  });

  test('should provide detailed installation metrics', async () => {
    // Complete installation
    await page.locator('[data-testid="environment-local"]').click();
    await page.locator('[data-testid="install-button"]').click();
    
    // Wait for completion
    await expect(page.locator('[data-testid="installation-status"]')).toContainText('running', { timeout: 15000 });
    
    // Verify timing information
    const timingSection = page.locator('[data-testid="installation-timing"]');
    await expect(timingSection).toBeVisible();
    
    // Check start time
    await expect(page.locator('[data-testid="start-time"]')).toBeVisible();
    await expect(page.locator('[data-testid="start-time"]')).toContainText('Started:');
    
    // Check completion time
    await expect(page.locator('[data-testid="completion-time"]')).toBeVisible();
    await expect(page.locator('[data-testid="completion-time"]')).toContainText('Completed:');
    
    // Verify installation ID is shown
    await expect(page.locator('[data-testid="installation-id"]')).toBeVisible();
    await expect(page.locator('[data-testid="installation-id"]')).toContainText('test-install-');
  });
});