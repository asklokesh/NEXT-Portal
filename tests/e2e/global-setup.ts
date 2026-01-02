/**
 * Global Setup for Playwright E2E Tests
 * Runs once before all test files
 */

import { FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig): Promise<void> {
  // Environment validation
  const baseURL = config.projects[0]?.use?.baseURL || process.env.PLAYWRIGHT_BASE_URL;

  if (process.env.CI) {
    console.log('[E2E Setup] Running in CI environment');
    console.log(`[E2E Setup] Target URL: ${baseURL}`);
  }

  // Database setup could be added here for CI
  // await setupTestDatabase();

  // Seed test data could be added here
  // await seedTestUsers();

  console.log('[E2E Setup] Global setup complete');
}

export default globalSetup;
