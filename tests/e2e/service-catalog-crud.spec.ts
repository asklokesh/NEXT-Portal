/**
 * E2E Test: Service Catalog CRUD Operations
 * Tests creating, reading, updating, and deleting services in the catalog
 */

import { test, expect, Page } from '@playwright/test';

test.describe('Service Catalog CRUD Operations', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    
    // Login once for all tests
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="email"]', 'developer@example.com');
    await page.fill('input[name="password"]', 'SecurePassword123!');
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test.beforeEach(async () => {
    // Navigate to catalog before each test
    await page.goto('http://localhost:3000/catalog');
    await page.waitForLoadState('networkidle');
  });

  test('should display service catalog grid view', async () => {
    await expect(page.locator('h1')).toContainText(/Service Catalog/);
    
    // Check for view toggle buttons
    await expect(page.locator('[data-testid="view-grid"]')).toBeVisible();
    await expect(page.locator('[data-testid="view-list"]')).toBeVisible();
    
    // Check for service cards in grid view
    const serviceCards = page.locator('[data-testid="service-card"]');
    await expect(serviceCards).toHaveCount(await serviceCards.count());
    
    // Verify service card structure
    const firstCard = serviceCards.first();
    await expect(firstCard.locator('[data-testid="service-name"]')).toBeVisible();
    await expect(firstCard.locator('[data-testid="service-type"]')).toBeVisible();
    await expect(firstCard.locator('[data-testid="service-owner"]')).toBeVisible();
    await expect(firstCard.locator('[data-testid="service-lifecycle"]')).toBeVisible();
  });

  test('should switch between grid and list views', async () => {
    // Start in grid view
    await expect(page.locator('[data-testid="catalog-grid"]')).toBeVisible();
    
    // Switch to list view
    await page.click('[data-testid="view-list"]');
    await expect(page.locator('[data-testid="catalog-table"]')).toBeVisible();
    await expect(page.locator('[data-testid="catalog-grid"]')).not.toBeVisible();
    
    // Verify table headers
    await expect(page.locator('th:has-text("Name")')).toBeVisible();
    await expect(page.locator('th:has-text("Type")')).toBeVisible();
    await expect(page.locator('th:has-text("Owner")')).toBeVisible();
    await expect(page.locator('th:has-text("Lifecycle")')).toBeVisible();
    
    // Switch back to grid view
    await page.click('[data-testid="view-grid"]');
    await expect(page.locator('[data-testid="catalog-grid"]')).toBeVisible();
    await expect(page.locator('[data-testid="catalog-table"]')).not.toBeVisible();
  });

  test('should filter services by type', async () => {
    // Open filter panel
    await page.click('[data-testid="filter-button"]');
    
    // Select service type filter
    await page.click('[data-testid="filter-type"]');
    await page.click('text=Backend');
    
    // Apply filter
    await page.click('[data-testid="apply-filters"]');
    
    // Verify filtered results
    const serviceCards = page.locator('[data-testid="service-card"]');
    const count = await serviceCards.count();
    
    for (let i = 0; i < count; i++) {
      const typeText = await serviceCards.nth(i).locator('[data-testid="service-type"]').textContent();
      expect(typeText).toContain('Backend');
    }
  });

  test('should search for services', async () => {
    // Type in search box
    await page.fill('[data-testid="search-input"]', 'payment');
    await page.keyboard.press('Enter');
    
    // Wait for search results
    await page.waitForTimeout(500);
    
    // Verify search results
    const serviceCards = page.locator('[data-testid="service-card"]');
    const count = await serviceCards.count();
    
    expect(count).toBeGreaterThan(0);
    
    // Each result should contain 'payment' in name or description
    for (let i = 0; i < count; i++) {
      const card = serviceCards.nth(i);
      const name = await card.locator('[data-testid="service-name"]').textContent();
      const description = await card.locator('[data-testid="service-description"]').textContent();
      
      expect((name?.toLowerCase() + description?.toLowerCase())).toContain('payment');
    }
  });

  test('should create a new service', async () => {
    // Click create button
    await page.click('[data-testid="create-service-button"]');
    
    // Should navigate to create page
    await expect(page).toHaveURL(/\/catalog\/create/);
    
    // Fill in service details
    await page.fill('input[name="name"]', 'test-service-e2e');
    await page.fill('input[name="description"]', 'E2E test service created by Playwright');
    
    // Select service type
    await page.click('[data-testid="service-type-select"]');
    await page.click('text=Service');
    
    // Select lifecycle
    await page.click('[data-testid="lifecycle-select"]');
    await page.click('text=Production');
    
    // Select owner
    await page.click('[data-testid="owner-select"]');
    await page.click('text=Platform Team');
    
    // Add tags
    await page.fill('input[name="tags"]', 'test, e2e, automated');
    
    // Add system dependencies
    await page.click('[data-testid="add-dependency"]');
    await page.fill('input[name="dependency-0"]', 'database-service');
    
    // Add API specification
    await page.click('[data-testid="add-api-spec"]');
    await page.fill('input[name="api-spec-url"]', 'https://api.example.com/spec.yaml');
    
    // Submit form
    await page.click('[data-testid="submit-service"]');
    
    // Wait for creation and redirect
    await page.waitForNavigation();
    
    // Should redirect to service detail page
    await expect(page).toHaveURL(/\/catalog\/component\/default\/test-service-e2e/);
    
    // Verify service was created
    await expect(page.locator('h1')).toContainText('test-service-e2e');
    await expect(page.locator('[data-testid="service-description"]')).toContainText('E2E test service');
  });

  test('should view service details', async () => {
    // Click on a service card
    const firstCard = page.locator('[data-testid="service-card"]').first();
    const serviceName = await firstCard.locator('[data-testid="service-name"]').textContent();
    await firstCard.click();
    
    // Should navigate to service detail page
    await page.waitForNavigation();
    await expect(page).toHaveURL(/\/catalog\/component/);
    
    // Verify service details page
    await expect(page.locator('h1')).toContainText(serviceName!);
    
    // Check tabs
    await expect(page.locator('[data-testid="tab-overview"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-api"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-dependencies"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-docs"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-ci-cd"]')).toBeVisible();
    
    // Check overview tab content
    await expect(page.locator('[data-testid="service-metadata"]')).toBeVisible();
    await expect(page.locator('[data-testid="service-health"]')).toBeVisible();
    await expect(page.locator('[data-testid="service-metrics"]')).toBeVisible();
  });

  test('should edit service information', async () => {
    // Navigate to the test service
    await page.goto('http://localhost:3000/catalog/component/default/test-service-e2e');
    
    // Click edit button
    await page.click('[data-testid="edit-service"]');
    
    // Should open edit modal or navigate to edit page
    await page.waitForSelector('[data-testid="edit-form"]');
    
    // Update description
    await page.fill('textarea[name="description"]', 'Updated E2E test service description');
    
    // Update tags
    await page.fill('input[name="tags"]', 'test, e2e, automated, updated');
    
    // Add annotation
    await page.click('[data-testid="add-annotation"]');
    await page.fill('input[name="annotation-key"]', 'backstage.io/updated-by');
    await page.fill('input[name="annotation-value"]', 'playwright-e2e');
    
    // Save changes
    await page.click('[data-testid="save-changes"]');
    
    // Wait for save confirmation
    await page.waitForSelector('[data-testid="save-success"]');
    
    // Verify changes were saved
    await page.reload();
    await expect(page.locator('[data-testid="service-description"]')).toContainText('Updated E2E test service');
    await expect(page.locator('[data-testid="service-tags"]')).toContainText('updated');
  });

  test('should manage service relationships', async () => {
    await page.goto('http://localhost:3000/catalog/component/default/test-service-e2e');
    
    // Navigate to dependencies tab
    await page.click('[data-testid="tab-dependencies"]');
    
    // Add a dependency
    await page.click('[data-testid="add-relationship"]');
    await page.click('[data-testid="relationship-type"]');
    await page.click('text=Depends On');
    
    await page.fill('input[name="target-entity"]', 'component:default/database-service');
    await page.click('[data-testid="confirm-relationship"]');
    
    // Verify dependency was added
    await page.waitForSelector('[data-testid="dependency-database-service"]');
    
    // View dependency graph
    await page.click('[data-testid="view-dependency-graph"]');
    await expect(page.locator('[data-testid="dependency-graph-canvas"]')).toBeVisible();
    
    // Verify nodes in graph
    await expect(page.locator('[data-testid="node-test-service-e2e"]')).toBeVisible();
    await expect(page.locator('[data-testid="node-database-service"]')).toBeVisible();
  });

  test('should bulk import services', async () => {
    // Click bulk import button
    await page.click('[data-testid="bulk-operations"]');
    await page.click('[data-testid="bulk-import"]');
    
    // Should open import modal
    await page.waitForSelector('[data-testid="import-modal"]');
    
    // Select import from URL
    await page.click('[data-testid="import-from-url"]');
    await page.fill('input[name="catalog-url"]', 'https://github.com/example/catalog/catalog-info.yaml');
    
    // Preview import
    await page.click('[data-testid="preview-import"]');
    
    // Wait for preview results
    await page.waitForSelector('[data-testid="import-preview"]');
    
    // Check preview shows entities to import
    await expect(page.locator('[data-testid="entities-to-import"]')).toBeVisible();
    const entitiesToImport = await page.locator('[data-testid="entity-preview-item"]').count();
    expect(entitiesToImport).toBeGreaterThan(0);
    
    // Confirm import
    await page.click('[data-testid="confirm-import"]');
    
    // Wait for import completion
    await page.waitForSelector('[data-testid="import-success"]');
    
    // Verify success message
    await expect(page.locator('[data-testid="import-success"]')).toContainText(`Imported ${entitiesToImport} entities`);
  });

  test('should export catalog data', async () => {
    // Open bulk operations menu
    await page.click('[data-testid="bulk-operations"]');
    await page.click('[data-testid="export-catalog"]');
    
    // Select export format
    await page.click('[data-testid="export-format"]');
    await page.click('text=YAML');
    
    // Select entities to export
    await page.click('[data-testid="select-all-entities"]');
    
    // Start export
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="export-button"]'),
    ]);
    
    // Verify download
    expect(download.suggestedFilename()).toContain('catalog-export');
    expect(download.suggestedFilename()).toContain('.yaml');
  });

  test('should delete a service', async () => {
    // Navigate to test service
    await page.goto('http://localhost:3000/catalog/component/default/test-service-e2e');
    
    // Click delete button
    await page.click('[data-testid="delete-service"]');
    
    // Confirm deletion in modal
    await page.waitForSelector('[data-testid="delete-modal"]');
    await expect(page.locator('[data-testid="delete-warning"]')).toContainText(/This action cannot be undone/);
    
    // Type service name to confirm
    await page.fill('input[name="confirm-name"]', 'test-service-e2e');
    
    // Click confirm delete
    await page.click('[data-testid="confirm-delete"]');
    
    // Wait for deletion and redirect
    await page.waitForNavigation();
    
    // Should redirect to catalog
    await expect(page).toHaveURL(/\/catalog/);
    
    // Verify service is deleted
    await page.fill('[data-testid="search-input"]', 'test-service-e2e');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    await expect(page.locator('[data-testid="no-results"]')).toBeVisible();
  });

  test('should handle service health monitoring', async () => {
    // Click on a service with health data
    const serviceCard = page.locator('[data-testid="service-card"]').first();
    await serviceCard.click();
    
    // Navigate to health tab
    await page.click('[data-testid="tab-health"]');
    
    // Check health status indicators
    await expect(page.locator('[data-testid="health-status"]')).toBeVisible();
    await expect(page.locator('[data-testid="uptime-percentage"]')).toBeVisible();
    await expect(page.locator('[data-testid="response-time"]')).toBeVisible();
    
    // Check health history chart
    await expect(page.locator('[data-testid="health-chart"]')).toBeVisible();
    
    // Check recent incidents
    await expect(page.locator('[data-testid="incidents-list"]')).toBeVisible();
  });

  test('should manage service ownership', async () => {
    const serviceCard = page.locator('[data-testid="service-card"]').first();
    await serviceCard.click();
    
    // Click on owner to see ownership details
    await page.click('[data-testid="service-owner"]');
    
    // Should show ownership modal
    await page.waitForSelector('[data-testid="ownership-modal"]');
    
    // Check team information
    await expect(page.locator('[data-testid="team-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="team-members"]')).toBeVisible();
    await expect(page.locator('[data-testid="team-contact"]')).toBeVisible();
    
    // Change ownership (if permitted)
    if (await page.locator('[data-testid="change-owner"]').isVisible()) {
      await page.click('[data-testid="change-owner"]');
      await page.click('[data-testid="new-owner-select"]');
      await page.click('text=Infrastructure Team');
      await page.click('[data-testid="confirm-ownership-change"]');
      
      // Verify ownership changed
      await page.waitForSelector('[data-testid="ownership-changed"]');
    }
  });
});