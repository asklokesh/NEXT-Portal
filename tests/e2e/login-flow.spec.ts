/**
 * E2E Test: User Login and Navigation Flow
 * Tests the complete user journey from login to accessing various portal features
 */

import { test, expect, Page } from '@playwright/test';

test.describe('User Login and Navigation Flow', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto('http://localhost:3000');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should display login page for unauthenticated users', async () => {
    await expect(page).toHaveTitle(/NEXT Portal/);
    await expect(page.locator('h1')).toContainText(/Sign in/i);
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText(/Sign in/i);
  });

  test('should show validation errors for invalid inputs', async () => {
    // Submit empty form
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=Email is required')).toBeVisible();
    await expect(page.locator('text=Password is required')).toBeVisible();
    
    // Invalid email format
    await page.fill('input[name="email"]', 'invalid-email');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=Invalid email format')).toBeVisible();
  });

  test('should show error for invalid credentials', async () => {
    await page.fill('input[name="email"]', 'wrong@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    await page.waitForSelector('text=Invalid email or password');
    await expect(page.locator('.alert-error')).toBeVisible();
  });

  test('should successfully login with valid credentials', async () => {
    // Fill in login form
    await page.fill('input[name="email"]', 'developer@example.com');
    await page.fill('input[name="password"]', 'SecurePassword123!');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for navigation to dashboard
    await page.waitForNavigation();
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Verify user is logged in
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-email"]')).toContainText('developer@example.com');
  });

  test('should remember user session across page refreshes', async () => {
    // Login
    await page.fill('input[name="email"]', 'developer@example.com');
    await page.fill('input[name="password"]', 'SecurePassword123!');
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
    
    // Refresh page
    await page.reload();
    
    // Should still be logged in
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('should navigate to main portal sections', async () => {
    // Login first
    await page.fill('input[name="email"]', 'developer@example.com');
    await page.fill('input[name="password"]', 'SecurePassword123!');
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
    
    // Navigate to Service Catalog
    await page.click('nav >> text=Catalog');
    await expect(page).toHaveURL(/\/catalog/);
    await expect(page.locator('h1')).toContainText(/Service Catalog/);
    
    // Navigate to Templates
    await page.click('nav >> text=Templates');
    await expect(page).toHaveURL(/\/templates/);
    await expect(page.locator('h1')).toContainText(/Software Templates/);
    
    // Navigate to TechDocs
    await page.click('nav >> text=Docs');
    await expect(page).toHaveURL(/\/docs/);
    await expect(page.locator('h1')).toContainText(/Documentation/);
    
    // Navigate to Plugins
    await page.click('nav >> text=Plugins');
    await expect(page).toHaveURL(/\/plugins/);
    await expect(page.locator('h1')).toContainText(/Plugin Marketplace/);
  });

  test('should handle OAuth login (GitHub)', async () => {
    // Click GitHub login button
    await page.click('button:has-text("Sign in with GitHub")');
    
    // Mock OAuth redirect
    await page.waitForNavigation();
    
    // Should redirect to dashboard after OAuth
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should handle OAuth login (Google)', async () => {
    // Click Google login button
    await page.click('button:has-text("Sign in with Google")');
    
    // Mock OAuth redirect
    await page.waitForNavigation();
    
    // Should redirect to dashboard after OAuth
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should show role-based navigation items', async () => {
    // Login as admin
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'AdminPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
    
    // Admin should see admin menu items
    await expect(page.locator('nav >> text=Admin')).toBeVisible();
    await expect(page.locator('nav >> text=RBAC')).toBeVisible();
    await expect(page.locator('nav >> text=Analytics')).toBeVisible();
    
    // Logout
    await page.click('[data-testid="user-menu"]');
    await page.click('text=Sign out');
    
    // Login as developer
    await page.fill('input[name="email"]', 'developer@example.com');
    await page.fill('input[name="password"]', 'SecurePassword123!');
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
    
    // Developer should not see admin items
    await expect(page.locator('nav >> text=Admin')).not.toBeVisible();
    await expect(page.locator('nav >> text=RBAC')).not.toBeVisible();
  });

  test('should successfully logout', async () => {
    // Login
    await page.fill('input[name="email"]', 'developer@example.com');
    await page.fill('input[name="password"]', 'SecurePassword123!');
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
    
    // Open user menu and logout
    await page.click('[data-testid="user-menu"]');
    await page.click('text=Sign out');
    
    // Should redirect to login page
    await page.waitForNavigation();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('h1')).toContainText(/Sign in/);
    
    // Try to access protected route
    await page.goto('http://localhost:3000/dashboard');
    
    // Should redirect back to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('should handle session timeout', async () => {
    // Login
    await page.fill('input[name="email"]', 'developer@example.com');
    await page.fill('input[name="password"]', 'SecurePassword123!');
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
    
    // Simulate session timeout by clearing cookies
    await page.context().clearCookies();
    
    // Try to navigate
    await page.click('nav >> text=Catalog');
    
    // Should redirect to login with session expired message
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('text=Session expired')).toBeVisible();
  });

  test('should handle multi-factor authentication', async () => {
    // Login with MFA-enabled account
    await page.fill('input[name="email"]', 'mfa-user@example.com');
    await page.fill('input[name="password"]', 'SecurePassword123!');
    await page.click('button[type="submit"]');
    
    // Should show MFA code input
    await page.waitForSelector('input[name="mfaCode"]');
    await expect(page.locator('h2')).toContainText(/Two-Factor Authentication/);
    
    // Enter MFA code
    await page.fill('input[name="mfaCode"]', '123456');
    await page.click('button:has-text("Verify")');
    
    // Should redirect to dashboard
    await page.waitForNavigation();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should show password reset link', async () => {
    await page.click('text=Forgot password?');
    
    await expect(page).toHaveURL(/\/reset-password/);
    await expect(page.locator('h1')).toContainText(/Reset Password/);
    
    // Enter email for reset
    await page.fill('input[name="email"]', 'developer@example.com');
    await page.click('button:has-text("Send Reset Link")');
    
    // Should show success message
    await expect(page.locator('.alert-success')).toContainText(/Reset link sent/);
  });

  test('should preserve return URL after login', async () => {
    // Try to access protected route
    await page.goto('http://localhost:3000/catalog/create');
    
    // Should redirect to login with return URL
    await expect(page).toHaveURL(/\/login\?returnUrl=/);
    
    // Login
    await page.fill('input[name="email"]', 'developer@example.com');
    await page.fill('input[name="password"]', 'SecurePassword123!');
    await page.click('button[type="submit"]');
    
    // Should redirect to original URL
    await page.waitForNavigation();
    await expect(page).toHaveURL(/\/catalog\/create/);
  });

  test('should handle concurrent login attempts', async () => {
    // Open multiple tabs
    const page2 = await page.context().newPage();
    await page2.goto('http://localhost:3000');
    
    // Login in first tab
    await page.fill('input[name="email"]', 'developer@example.com');
    await page.fill('input[name="password"]', 'SecurePassword123!');
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
    
    // Second tab should also be logged in after refresh
    await page2.reload();
    await expect(page2).toHaveURL(/\/dashboard/);
    
    await page2.close();
  });

  test('should display user profile information', async () => {
    // Login
    await page.fill('input[name="email"]', 'developer@example.com');
    await page.fill('input[name="password"]', 'SecurePassword123!');
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
    
    // Open user menu
    await page.click('[data-testid="user-menu"]');
    
    // Check profile information
    await expect(page.locator('[data-testid="user-name"]')).toContainText('John Developer');
    await expect(page.locator('[data-testid="user-role"]')).toContainText('Developer');
    await expect(page.locator('[data-testid="user-team"]')).toContainText('Platform Team');
    
    // Navigate to profile settings
    await page.click('text=Profile Settings');
    await expect(page).toHaveURL(/\/settings\/profile/);
  });

  test('should handle keyboard navigation for accessibility', async () => {
    // Tab to email field
    await page.keyboard.press('Tab');
    await expect(page.locator('input[name="email"]')).toBeFocused();
    
    // Fill email using keyboard
    await page.keyboard.type('developer@example.com');
    
    // Tab to password field
    await page.keyboard.press('Tab');
    await expect(page.locator('input[name="password"]')).toBeFocused();
    
    // Fill password
    await page.keyboard.type('SecurePassword123!');
    
    // Tab to submit button
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab'); // Skip "Remember me" checkbox
    await expect(page.locator('button[type="submit"]')).toBeFocused();
    
    // Submit with Enter key
    await page.keyboard.press('Enter');
    
    // Should login successfully
    await page.waitForNavigation();
    await expect(page).toHaveURL(/\/dashboard/);
  });
});