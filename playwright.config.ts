import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
 testDir: './tests/e2e',
 /* Run tests in files in parallel */
 fullyParallel: true,
 /* Fail the build on CI if you accidentally left test.only in the source code. */
 forbidOnly: !!process.env.CI,
 /* Retry on CI only */
 retries: process.env.CI ? 2 : 0,
 /* Opt out of parallel tests on CI. */
 workers: process.env.CI ? 1 : undefined,
 /* Reporter to use. See https://playwright.dev/docs/test-reporters */
 reporter: [
 ['html', { outputFolder: 'tests/e2e/reports/html' }],
 ['junit', { outputFile: 'tests/e2e/reports/junit.xml' }],
 ['json', { outputFile: 'tests/e2e/reports/results.json' }],
 ],
 /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
 use: {
 /* Base URL to use in actions like `await page.goto('/')`. */
 baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4400',

 /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
 trace: 'on-first-retry',
 
 /* Take screenshot on failure */
 screenshot: 'only-on-failure',
 
 /* Record video on failure */
 video: 'retain-on-failure',
 
 /* Global timeout for each action */
 actionTimeout: 30000,
 
 /* Global timeout for navigation */
 navigationTimeout: 30000,
 },

 /* Configure projects for major browsers */
 projects: [
 {
 name: 'chromium',
 use: { ...devices['Desktop Chrome'] },
 },

 {
 name: 'firefox',
 use: { ...devices['Desktop Firefox'] },
 },

 {
 name: 'webkit',
 use: { ...devices['Desktop Safari'] },
 },

 /* Test against mobile viewports. */
 {
 name: 'Mobile Chrome',
 use: { ...devices['Pixel 5'] },
 },
 {
 name: 'Mobile Safari',
 use: { ...devices['iPhone 12'] },
 },

 /* Test against branded browsers. */
 {
 name: 'Microsoft Edge',
 use: { ...devices['Desktop Edge'], channel: 'msedge' },
 },
 {
 name: 'Google Chrome',
 use: { ...devices['Desktop Chrome'], channel: 'chrome' },
 },
 ],

 /* Global setup and teardown */
 globalSetup: require.resolve('./tests/e2e/global-setup.ts'),
 globalTeardown: require.resolve('./tests/e2e/global-teardown.ts'),

 /* Run your local dev server before starting the tests */
 // webServer: {
 // command: 'npm run dev',
 // url: 'http://localhost:4400',
 // reuseExistingServer: !process.env.CI,
 // timeout: 120000,
 // },

 /* Test timeout */
 timeout: 60000,
 
 /* Expect timeout */
 expect: {
 timeout: 10000,
 },

 /* Output directories */
 outputDir: 'tests/e2e/test-results',
});