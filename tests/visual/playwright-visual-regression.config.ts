import { PlaywrightTestConfig } from '@playwright/test';

/**
 * Visual Regression Testing Configuration
 * 
 * This configuration is specifically designed for visual regression testing
 * with consistent screenshot comparisons across different environments.
 */
const config: PlaywrightTestConfig = {
  testDir: './tests/visual',
  outputDir: './tests/visual/test-results',
  
  // Global test timeout
  timeout: 60000,
  
  // Expect timeout for assertions
  expect: {
    // Screenshot comparison threshold
    threshold: 0.2,
    // Pixel difference tolerance
    toHaveScreenshot: { threshold: 0.2 },
    toMatchScreenshot: { threshold: 0.2 },
  },
  
  // Fail the build on CI if the tests fail
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Parallel execution
  workers: process.env.CI ? 2 : 4,
  
  // Reporter configuration
  reporter: [
    ['html', { outputFolder: './tests/visual/playwright-report' }],
    ['json', { outputFile: './tests/visual/test-results.json' }],
    ['junit', { outputFile: './tests/visual/junit-results.xml' }],
    ...(process.env.CI ? [['github'] as const] : [['list'] as const]),
  ],
  
  use: {
    // Base URL for testing
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    
    // Browser context options
    headless: true,
    
    // Screenshot options for consistent visual testing
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    
    // Viewport size
    viewport: { width: 1280, height: 720 },
    
    // Ignore HTTPS errors
    ignoreHTTPSErrors: true,
    
    // Wait for network idle
    waitForLoadState: 'networkidle',
    
    // Action timeout
    actionTimeout: 15000,
    
    // Navigation timeout
    navigationTimeout: 30000,
  },
  
  // Test projects for different browsers and configurations
  projects: [
    // Desktop Chrome - Primary target
    {
      name: 'Desktop Chrome',
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
      },
    },
    
    // Desktop Firefox
    {
      name: 'Desktop Firefox',
      use: {
        browserName: 'firefox',
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
      },
    },
    
    // Desktop Safari (WebKit)
    {
      name: 'Desktop Safari',
      use: {
        browserName: 'webkit',
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
      },
    },
    
    // Mobile Chrome
    {
      name: 'Mobile Chrome',
      use: {
        ...require('@playwright/test').devices['Pixel 5'],
      },
    },
    
    // Tablet iPad
    {
      name: 'Tablet iPad',
      use: {
        ...require('@playwright/test').devices['iPad Pro'],
      },
    },
    
    // High DPI Display
    {
      name: 'High DPI',
      use: {
        browserName: 'chromium',
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 2,
      },
    },
    
    // Dark Mode Testing
    {
      name: 'Dark Mode',
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 },
        colorScheme: 'dark',
      },
    },
  ],
  
  // Global setup and teardown
  globalSetup: require.resolve('./visual-test-setup.ts'),
  globalTeardown: require.resolve('./visual-test-teardown.ts'),
  
  // Test metadata
  metadata: {
    purpose: 'Visual regression testing for plugin management UI',
    maintainer: 'QA Team',
    environment: process.env.NODE_ENV || 'test',
  },
};

export default config;