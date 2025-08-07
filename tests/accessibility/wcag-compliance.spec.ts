/**
 * Accessibility Tests: WCAG 2.1 AA Compliance
 * Tests for keyboard navigation, screen reader support, and accessibility standards
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('WCAG 2.1 AA Compliance', () => {
  test.beforeEach(async ({ page }) => {
    // Enable screen reader announcements
    await page.addInitScript(() => {
      window.localStorage.setItem('announceToScreenReaders', 'true');
    });
  });

  test.describe('Login Page Accessibility', () => {
    test('should pass axe accessibility checks', async ({ page }) => {
      await page.goto('http://localhost:3000/login');
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      
      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should have proper heading hierarchy', async ({ page }) => {
      await page.goto('http://localhost:3000/login');
      
      const h1Count = await page.locator('h1').count();
      const h2Count = await page.locator('h2').count();
      
      expect(h1Count).toBe(1);
      
      // Check heading order
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents();
      expect(headings.length).toBeGreaterThan(0);
    });

    test('should have proper form labels', async ({ page }) => {
      await page.goto('http://localhost:3000/login');
      
      // Check email input has label
      const emailLabel = await page.locator('label[for="email"]');
      expect(await emailLabel.count()).toBe(1);
      expect(await emailLabel.textContent()).toContain('Email');
      
      // Check password input has label
      const passwordLabel = await page.locator('label[for="password"]');
      expect(await passwordLabel.count()).toBe(1);
      expect(await passwordLabel.textContent()).toContain('Password');
      
      // Check inputs have proper ARIA attributes
      const emailInput = page.locator('input[name="email"]');
      expect(await emailInput.getAttribute('aria-label')).toBeTruthy();
      expect(await emailInput.getAttribute('aria-required')).toBe('true');
    });

    test('should be fully keyboard navigable', async ({ page }) => {
      await page.goto('http://localhost:3000/login');
      
      // Tab through all interactive elements
      const interactiveElements = [];
      
      await page.keyboard.press('Tab');
      let activeElement = await page.evaluate(() => document.activeElement?.tagName);
      interactiveElements.push(activeElement);
      
      await page.keyboard.press('Tab');
      activeElement = await page.evaluate(() => document.activeElement?.tagName);
      interactiveElements.push(activeElement);
      
      await page.keyboard.press('Tab');
      activeElement = await page.evaluate(() => document.activeElement?.tagName);
      interactiveElements.push(activeElement);
      
      // Verify tab order includes form elements
      expect(interactiveElements).toContain('INPUT');
      expect(interactiveElements).toContain('BUTTON');
    });

    test('should announce errors to screen readers', async ({ page }) => {
      await page.goto('http://localhost:3000/login');
      
      // Submit empty form
      await page.click('button[type="submit"]');
      
      // Check for ARIA live regions
      const liveRegion = await page.locator('[aria-live="polite"], [aria-live="assertive"]');
      expect(await liveRegion.count()).toBeGreaterThan(0);
      
      // Check error messages have proper ARIA
      const errorMessages = await page.locator('[role="alert"]');
      expect(await errorMessages.count()).toBeGreaterThan(0);
    });
  });

  test.describe('Dashboard Accessibility', () => {
    test.beforeEach(async ({ page }) => {
      // Login first
      await page.goto('http://localhost:3000/login');
      await page.fill('input[name="email"]', 'developer@example.com');
      await page.fill('input[name="password"]', 'SecurePassword123!');
      await page.click('button[type="submit"]');
      await page.waitForNavigation();
    });

    test('dashboard should pass axe checks', async ({ page }) => {
      await page.goto('http://localhost:3000/dashboard');
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .exclude('[data-testid="chart-canvas"]') // Exclude canvas elements
        .analyze();
      
      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should have skip navigation link', async ({ page }) => {
      await page.goto('http://localhost:3000/dashboard');
      
      // Press Tab to reveal skip link
      await page.keyboard.press('Tab');
      
      const skipLink = await page.locator('a:has-text("Skip to main content")');
      expect(await skipLink.isVisible()).toBe(true);
      
      // Activate skip link
      await page.keyboard.press('Enter');
      
      // Check focus moved to main content
      const focusedElement = await page.evaluate(() => document.activeElement?.id);
      expect(focusedElement).toBe('main-content');
    });

    test('should have proper ARIA landmarks', async ({ page }) => {
      await page.goto('http://localhost:3000/dashboard');
      
      // Check for main landmarks
      expect(await page.locator('nav[role="navigation"], nav').count()).toBeGreaterThan(0);
      expect(await page.locator('main[role="main"], main').count()).toBe(1);
      expect(await page.locator('header[role="banner"], header').count()).toBe(1);
      expect(await page.locator('footer[role="contentinfo"], footer').count()).toBe(1);
    });

    test('widgets should have accessible names', async ({ page }) => {
      await page.goto('http://localhost:3000/dashboard');
      
      const widgets = await page.locator('[data-testid*="widget"]').all();
      
      for (const widget of widgets) {
        const ariaLabel = await widget.getAttribute('aria-label');
        const ariaLabelledBy = await widget.getAttribute('aria-labelledby');
        const heading = await widget.locator('h2, h3').first();
        
        // Widget should have accessible name via aria-label, aria-labelledby, or heading
        expect(ariaLabel || ariaLabelledBy || (await heading.count())).toBeTruthy();
      }
    });

    test('charts should have text alternatives', async ({ page }) => {
      await page.goto('http://localhost:3000/dashboard');
      
      const charts = await page.locator('[data-testid*="chart"]').all();
      
      for (const chart of charts) {
        // Check for aria-label or aria-describedby
        const ariaLabel = await chart.getAttribute('aria-label');
        const ariaDescribedBy = await chart.getAttribute('aria-describedby');
        
        expect(ariaLabel || ariaDescribedBy).toBeTruthy();
        
        // Check for table alternative
        const tableAlternative = await chart.locator('~ table, ~ .sr-only');
        expect(await tableAlternative.count()).toBeGreaterThan(0);
      }
    });

    test('interactive elements should be keyboard accessible', async ({ page }) => {
      await page.goto('http://localhost:3000/dashboard');
      
      // Find all interactive elements
      const buttons = await page.locator('button:visible').all();
      const links = await page.locator('a:visible').all();
      const inputs = await page.locator('input:visible, select:visible, textarea:visible').all();
      
      // Check each has proper focus styles
      for (const element of [...buttons.slice(0, 3), ...links.slice(0, 3), ...inputs.slice(0, 3)]) {
        await element.focus();
        
        const outlineStyle = await element.evaluate(el => {
          const styles = window.getComputedStyle(el);
          return {
            outlineWidth: styles.outlineWidth,
            outlineStyle: styles.outlineStyle,
            boxShadow: styles.boxShadow,
          };
        });
        
        // Element should have visible focus indicator
        const hasOutline = outlineStyle.outlineWidth !== '0px' && outlineStyle.outlineStyle !== 'none';
        const hasBoxShadow = outlineStyle.boxShadow !== 'none';
        
        expect(hasOutline || hasBoxShadow).toBe(true);
      }
    });
  });

  test.describe('Color Contrast', () => {
    test('should meet WCAG AA contrast ratios', async ({ page }) => {
      await page.goto('http://localhost:3000/dashboard');
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2aa'])
        .options({ rules: { 'color-contrast': { enabled: true } } })
        .analyze();
      
      const contrastViolations = accessibilityScanResults.violations.filter(
        v => v.id === 'color-contrast'
      );
      
      expect(contrastViolations).toEqual([]);
    });

    test('should maintain contrast in dark mode', async ({ page }) => {
      await page.goto('http://localhost:3000/dashboard');
      
      // Switch to dark mode
      await page.click('[data-testid="theme-toggle"]');
      await page.waitForTimeout(500);
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2aa'])
        .options({ rules: { 'color-contrast': { enabled: true } } })
        .analyze();
      
      const contrastViolations = accessibilityScanResults.violations.filter(
        v => v.id === 'color-contrast'
      );
      
      expect(contrastViolations).toEqual([]);
    });
  });

  test.describe('Screen Reader Announcements', () => {
    test('should announce page changes', async ({ page }) => {
      await page.goto('http://localhost:3000/dashboard');
      
      // Navigate to different page
      await page.click('nav >> text=Catalog');
      
      // Check for route announcement
      const announcement = await page.locator('[role="status"][aria-live="polite"]');
      expect(await announcement.textContent()).toContain('Navigated to');
    });

    test('should announce loading states', async ({ page }) => {
      await page.goto('http://localhost:3000/dashboard');
      
      // Trigger data refresh
      await page.click('[data-testid="refresh-button"]');
      
      // Check for loading announcement
      const loadingAnnouncement = await page.locator('[aria-live="polite"]:has-text("Loading")');
      expect(await loadingAnnouncement.count()).toBeGreaterThan(0);
    });

    test('should announce notifications', async ({ page }) => {
      await page.goto('http://localhost:3000/dashboard');
      
      // Trigger a notification
      await page.evaluate(() => {
        window.postMessage({
          type: 'SHOW_NOTIFICATION',
          payload: { message: 'Test notification' },
        }, '*');
      });
      
      // Check for notification in ARIA live region
      const notification = await page.locator('[role="alert"], [aria-live="assertive"]');
      expect(await notification.textContent()).toContain('Test notification');
    });
  });

  test.describe('Responsive Accessibility', () => {
    test('mobile menu should be keyboard accessible', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('http://localhost:3000/dashboard');
      
      // Tab to menu button
      const menuButton = await page.locator('[data-testid="mobile-menu-button"]');
      await menuButton.focus();
      
      // Open menu with keyboard
      await page.keyboard.press('Enter');
      
      // Check menu is visible and focusable
      const menu = await page.locator('[data-testid="mobile-menu"]');
      expect(await menu.isVisible()).toBe(true);
      
      // Tab through menu items
      await page.keyboard.press('Tab');
      const firstMenuItem = await page.evaluate(() => document.activeElement?.textContent);
      expect(firstMenuItem).toBeTruthy();
    });

    test('touch targets should meet minimum size', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('http://localhost:3000/dashboard');
      
      const buttons = await page.locator('button:visible').all();
      const links = await page.locator('a:visible').all();
      
      for (const element of [...buttons.slice(0, 5), ...links.slice(0, 5)]) {
        const box = await element.boundingBox();
        if (box) {
          // WCAG 2.1 AA requires 44x44px minimum
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      }
    });
  });

  test.describe('Focus Management', () => {
    test('should trap focus in modals', async ({ page }) => {
      await page.goto('http://localhost:3000/dashboard');
      
      // Open a modal
      await page.click('[data-testid="open-settings"]');
      await page.waitForSelector('[data-testid="settings-modal"]');
      
      // Tab through modal
      const focusableElements = [];
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
        const focused = await page.evaluate(() => {
          const el = document.activeElement;
          return {
            tag: el?.tagName,
            id: el?.id,
            inModal: el?.closest('[data-testid="settings-modal"]') !== null,
          };
        });
        focusableElements.push(focused);
        
        // Stop if we've cycled back
        if (i > 0 && focused.id === focusableElements[0].id) break;
      }
      
      // All focused elements should be within modal
      expect(focusableElements.every(el => el.inModal)).toBe(true);
    });

    test('should restore focus after modal closes', async ({ page }) => {
      await page.goto('http://localhost:3000/dashboard');
      
      // Focus and click button
      const triggerButton = page.locator('[data-testid="open-settings"]');
      await triggerButton.focus();
      await triggerButton.click();
      
      // Close modal
      await page.keyboard.press('Escape');
      
      // Check focus returned to trigger
      const focusedId = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
      expect(focusedId).toBe('open-settings');
    });
  });

  test.describe('Form Validation Accessibility', () => {
    test('should associate error messages with inputs', async ({ page }) => {
      await page.goto('http://localhost:3000/catalog/create');
      
      // Submit invalid form
      await page.click('[data-testid="submit-service"]');
      
      // Check error associations
      const inputs = await page.locator('input[aria-invalid="true"]').all();
      
      for (const input of inputs) {
        const ariaDescribedBy = await input.getAttribute('aria-describedby');
        expect(ariaDescribedBy).toBeTruthy();
        
        // Check error message exists
        const errorMessage = await page.locator(`#${ariaDescribedBy}`);
        expect(await errorMessage.count()).toBe(1);
        expect(await errorMessage.textContent()).toBeTruthy();
      }
    });

    test('should announce form errors', async ({ page }) => {
      await page.goto('http://localhost:3000/catalog/create');
      
      // Submit invalid form
      await page.click('[data-testid="submit-service"]');
      
      // Check for error summary
      const errorSummary = await page.locator('[role="alert"][aria-live="assertive"]');
      expect(await errorSummary.count()).toBeGreaterThan(0);
      expect(await errorSummary.textContent()).toContain('error');
    });
  });
});