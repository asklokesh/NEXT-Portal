/**
 * Visual Regression Tests: Dashboard Components
 * Tests visual consistency of dashboard and its widgets
 */

import { test, expect } from '@playwright/test';

test.describe('Dashboard Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate to dashboard
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="email"]', 'developer@example.com');
    await page.fill('input[name="password"]', 'SecurePassword123!');
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('dashboard overview layout', async ({ page }) => {
    // Wait for all widgets to load
    await page.waitForSelector('[data-testid="metrics-widget"]');
    await page.waitForSelector('[data-testid="services-widget"]');
    await page.waitForSelector('[data-testid="deployments-widget"]');
    
    // Take full page screenshot
    await expect(page).toHaveScreenshot('dashboard-overview.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('metrics widget variations', async ({ page }) => {
    const metricsWidget = page.locator('[data-testid="metrics-widget"]');
    
    // Default state
    await expect(metricsWidget).toHaveScreenshot('metrics-widget-default.png');
    
    // Hover state
    await metricsWidget.hover();
    await expect(metricsWidget).toHaveScreenshot('metrics-widget-hover.png');
    
    // Expanded state
    await metricsWidget.locator('[data-testid="expand-button"]').click();
    await page.waitForTimeout(300); // Wait for animation
    await expect(metricsWidget).toHaveScreenshot('metrics-widget-expanded.png');
  });

  test('service health widget states', async ({ page }) => {
    const healthWidget = page.locator('[data-testid="service-health-widget"]');
    
    // Healthy state
    await expect(healthWidget).toHaveScreenshot('health-widget-healthy.png');
    
    // Toggle to show unhealthy services
    await healthWidget.locator('[data-testid="filter-unhealthy"]').click();
    await page.waitForTimeout(300);
    await expect(healthWidget).toHaveScreenshot('health-widget-unhealthy.png');
    
    // Show all services
    await healthWidget.locator('[data-testid="show-all"]').click();
    await page.waitForTimeout(300);
    await expect(healthWidget).toHaveScreenshot('health-widget-all.png');
  });

  test('deployment pipeline widget', async ({ page }) => {
    const deploymentWidget = page.locator('[data-testid="deployments-widget"]');
    
    // Pipeline view
    await expect(deploymentWidget).toHaveScreenshot('deployment-pipeline.png');
    
    // Click on a deployment to show details
    await deploymentWidget.locator('.deployment-item').first().click();
    await page.waitForSelector('[data-testid="deployment-details"]');
    await expect(deploymentWidget).toHaveScreenshot('deployment-details.png');
  });

  test('dark mode comparison', async ({ page }) => {
    // Light mode screenshot
    await expect(page).toHaveScreenshot('dashboard-light-mode.png', {
      fullPage: true,
    });
    
    // Switch to dark mode
    await page.click('[data-testid="theme-toggle"]');
    await page.waitForTimeout(500); // Wait for theme transition
    
    // Dark mode screenshot
    await expect(page).toHaveScreenshot('dashboard-dark-mode.png', {
      fullPage: true,
    });
  });

  test('responsive layouts', async ({ page }) => {
    // Desktop view (default)
    await expect(page).toHaveScreenshot('dashboard-desktop.png');
    
    // Tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('dashboard-tablet.png');
    
    // Mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('dashboard-mobile.png');
  });

  test('chart components', async ({ page }) => {
    // Line chart
    const lineChart = page.locator('[data-testid="line-chart"]');
    await expect(lineChart).toHaveScreenshot('chart-line.png');
    
    // Bar chart
    const barChart = page.locator('[data-testid="bar-chart"]');
    await expect(barChart).toHaveScreenshot('chart-bar.png');
    
    // Pie chart
    const pieChart = page.locator('[data-testid="pie-chart"]');
    await expect(pieChart).toHaveScreenshot('chart-pie.png');
    
    // Area chart
    const areaChart = page.locator('[data-testid="area-chart"]');
    await expect(areaChart).toHaveScreenshot('chart-area.png');
  });

  test('loading states', async ({ page }) => {
    // Refresh page and capture loading states
    await page.reload();
    
    // Capture skeleton loading
    await expect(page.locator('[data-testid="metrics-widget"]')).toHaveScreenshot('widget-loading.png');
    
    // Wait for content to load
    await page.waitForSelector('[data-testid="metrics-content"]');
    
    // Capture loaded state
    await expect(page.locator('[data-testid="metrics-widget"]')).toHaveScreenshot('widget-loaded.png');
  });

  test('error states', async ({ page }) => {
    // Simulate network error
    await page.route('**/api/dashboard/widgets/metrics', route => {
      route.abort('failed');
    });
    
    await page.reload();
    await page.waitForSelector('[data-testid="widget-error"]');
    
    const errorWidget = page.locator('[data-testid="metrics-widget"]');
    await expect(errorWidget).toHaveScreenshot('widget-error-state.png');
  });

  test('empty states', async ({ page }) => {
    // Navigate to a dashboard with no data
    await page.goto('http://localhost:3000/dashboard?empty=true');
    
    await expect(page.locator('[data-testid="empty-dashboard"]')).toHaveScreenshot('dashboard-empty.png');
  });

  test('notification badges', async ({ page }) => {
    // Add notifications
    await page.evaluate(() => {
      window.postMessage({
        type: 'ADD_NOTIFICATION',
        payload: { count: 5 },
      }, '*');
    });
    
    await page.waitForTimeout(300);
    
    const notificationBell = page.locator('[data-testid="notification-bell"]');
    await expect(notificationBell).toHaveScreenshot('notification-badge.png');
    
    // Open notification panel
    await notificationBell.click();
    await page.waitForSelector('[data-testid="notification-panel"]');
    await expect(page.locator('[data-testid="notification-panel"]')).toHaveScreenshot('notification-panel.png');
  });

  test('widget configuration modal', async ({ page }) => {
    // Open widget settings
    const widget = page.locator('[data-testid="metrics-widget"]');
    await widget.locator('[data-testid="widget-settings"]').click();
    
    await page.waitForSelector('[data-testid="config-modal"]');
    const modal = page.locator('[data-testid="config-modal"]');
    
    await expect(modal).toHaveScreenshot('widget-config-modal.png');
  });

  test('drag and drop visual feedback', async ({ page }) => {
    const widget = page.locator('[data-testid="metrics-widget"]');
    const dragHandle = widget.locator('[data-testid="drag-handle"]');
    
    // Start dragging
    await dragHandle.hover();
    await page.mouse.down();
    await page.mouse.move(100, 100);
    
    // Capture dragging state
    await expect(page).toHaveScreenshot('dashboard-dragging.png');
    
    // Release
    await page.mouse.up();
  });

  test('accessibility focus indicators', async ({ page }) => {
    // Tab through dashboard elements
    await page.keyboard.press('Tab');
    await expect(page).toHaveScreenshot('focus-first-element.png');
    
    await page.keyboard.press('Tab');
    await expect(page).toHaveScreenshot('focus-second-element.png');
    
    await page.keyboard.press('Tab');
    await expect(page).toHaveScreenshot('focus-third-element.png');
  });

  test('data visualization tooltips', async ({ page }) => {
    const chart = page.locator('[data-testid="line-chart"]');
    
    // Hover over data point
    await chart.locator('.data-point').first().hover();
    await page.waitForSelector('[data-testid="chart-tooltip"]');
    
    await expect(page).toHaveScreenshot('chart-tooltip.png');
  });

  test('custom dashboard layouts', async ({ page }) => {
    // Switch to custom layout
    await page.click('[data-testid="layout-selector"]');
    await page.click('[data-testid="layout-compact"]');
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot('dashboard-compact-layout.png');
    
    // Switch to wide layout
    await page.click('[data-testid="layout-selector"]');
    await page.click('[data-testid="layout-wide"]');
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot('dashboard-wide-layout.png');
  });

  test('real-time update indicators', async ({ page }) => {
    // Trigger real-time update
    await page.evaluate(() => {
      window.postMessage({
        type: 'REALTIME_UPDATE',
        payload: { widgetId: 'metrics' },
      }, '*');
    });
    
    await page.waitForSelector('[data-testid="update-indicator"]');
    await expect(page.locator('[data-testid="metrics-widget"]')).toHaveScreenshot('widget-updating.png');
  });

  test('export menu visual', async ({ page }) => {
    // Open export menu
    await page.click('[data-testid="export-dashboard"]');
    await page.waitForSelector('[data-testid="export-menu"]');
    
    await expect(page.locator('[data-testid="export-menu"]')).toHaveScreenshot('export-menu.png');
  });

  test('filter panel states', async ({ page }) => {
    // Open filter panel
    await page.click('[data-testid="filter-toggle"]');
    await page.waitForSelector('[data-testid="filter-panel"]');
    
    const filterPanel = page.locator('[data-testid="filter-panel"]');
    
    // Default state
    await expect(filterPanel).toHaveScreenshot('filter-panel-default.png');
    
    // With active filters
    await filterPanel.locator('input[name="date-range"]').fill('Last 7 days');
    await filterPanel.locator('input[name="service"]').fill('payment-service');
    await expect(filterPanel).toHaveScreenshot('filter-panel-active.png');
  });

  test('performance metrics visualization', async ({ page }) => {
    // Navigate to performance tab
    await page.click('[data-testid="tab-performance"]');
    await page.waitForSelector('[data-testid="performance-dashboard"]');
    
    await expect(page.locator('[data-testid="performance-dashboard"]')).toHaveScreenshot('performance-metrics.png');
  });
});