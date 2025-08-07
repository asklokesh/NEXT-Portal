# Visual Regression Testing

This directory contains comprehensive visual regression tests for the Plugin Management System, designed to catch unintended UI changes and ensure consistent visual appearance across different browsers, devices, and configurations.

## Overview

Visual regression testing captures screenshots of UI components and pages, comparing them against baseline images to detect visual changes. This is crucial for maintaining design consistency and catching visual bugs that might not be caught by functional tests.

## Test Structure

```
tests/visual/
├── README.md                              # This documentation
├── playwright-visual-regression.config.ts # Playwright configuration for visual tests
├── visual-test-setup.ts                  # Global setup for consistent test environment
├── visual-test-teardown.ts               # Global cleanup after tests
├── visual-test-utilities.ts              # Shared utilities and helpers
├── plugin-marketplace-visual.spec.ts     # Main marketplace visual tests
├── component-visual-regression.spec.ts   # Component-level visual tests
├── cross-browser-visual.spec.ts          # Cross-browser compatibility tests
├── screenshots/                          # Screenshot storage
│   ├── baseline/                         # Reference images
│   ├── actual/                           # Current test run images
│   └── diff/                            # Difference images when tests fail
├── archives/                             # Historical screenshot archives
└── test-results/                         # Test execution reports
```

## Getting Started

### Prerequisites

1. **Node.js 18+** - Required for Playwright
2. **Playwright browsers** - Install with: `npx playwright install`
3. **Test database** - Set `TEST_DATABASE_URL` environment variable
4. **Application running** - The tests need the app server running on port 3000

### Installation

```bash
# Install Playwright browsers if not already installed
npx playwright install

# Install additional dependencies for image processing
npx playwright install-deps
```

### Running Tests

#### Basic Visual Tests
```bash
# Run all visual regression tests
npm run test:visual

# Run with headed browser (watch tests execute)
npm run test:visual:headed

# Update baseline screenshots
npm run test:visual:update

# Debug failing tests
npm run test:visual:debug
```

#### Specific Test Categories
```bash
# Test plugin marketplace specifically
npm run test:visual:marketplace

# Test individual components
npm run test:visual:components

# Test cross-browser compatibility
npm run test:visual:cross-browser

# Run all visual test categories
npm run test:visual:full
```

#### Browser-Specific Tests
```bash
# Test in Chrome only
npm run test:visual:chrome

# Test in Firefox only
npm run test:visual:firefox

# Test in Safari (WebKit) only
npm run test:visual:safari

# Test mobile layout
npm run test:visual:mobile

# Test tablet layout
npm run test:visual:tablet

# Test dark mode
npm run test:visual:dark
```

#### Test Reports
```bash
# View HTML test report
npm run test:visual:report

# Generate new baseline images
npm run test:visual:baseline
```

## Test Configuration

The visual tests are configured in `playwright-visual-regression.config.ts` with:

- **Multiple browser engines**: Chromium, Firefox, WebKit
- **Responsive viewports**: Desktop, tablet, mobile
- **Consistent screenshots**: Disabled animations, hidden volatile elements
- **Threshold settings**: Configurable pixel difference tolerance
- **Parallel execution**: Optimized for CI/CD environments

### Key Configuration Options

```typescript
expect: {
  threshold: 0.2,  // 20% pixel difference tolerance
  toHaveScreenshot: { threshold: 0.2 },
},

projects: [
  { name: 'Desktop Chrome', use: { browserName: 'chromium' } },
  { name: 'Desktop Firefox', use: { browserName: 'firefox' } },
  { name: 'Desktop Safari', use: { browserName: 'webkit' } },
  { name: 'Mobile Chrome', use: devices['Pixel 5'] },
  { name: 'Tablet iPad', use: devices['iPad Pro'] },
  { name: 'Dark Mode', use: { colorScheme: 'dark' } },
]
```

## Writing Visual Tests

### Basic Test Structure

```typescript
import { test, expect } from '@playwright/test';
import { VisualTestUtils } from './visual-test-utilities';

test.describe('Component Visual Tests', () => {
  let visualUtils: VisualTestUtils;

  test.beforeEach(async ({ page }) => {
    visualUtils = new VisualTestUtils(page);
    await visualUtils.setupConsistentEnvironment();
    await visualUtils.mockAuthState('user');
  });

  test('should render component correctly', async ({ page }) => {
    await page.goto('/component-page');
    await visualUtils.screenshot('component-name');
  });
});
```

### Best Practices

1. **Consistent Data**: Use fixed test data to avoid variations
2. **Hide Volatile Elements**: Remove timestamps, counters, animations
3. **Wait for Stability**: Ensure page is fully loaded before screenshots
4. **Descriptive Names**: Use clear, descriptive screenshot names
5. **Threshold Tuning**: Adjust thresholds based on component complexity

### Handling Dynamic Content

```typescript
// Hide elements that change frequently
await page.addStyleTag({
  content: `
    [data-testid="timestamp"],
    .animate-spin,
    .loading {
      visibility: hidden !important;
    }
  `,
});

// Mock date/time for consistency
await page.evaluate(() => {
  Date.now = () => new Date('2024-01-15T12:00:00Z').getTime();
});
```

## Test Categories

### 1. Plugin Marketplace Visual Tests
- Homepage and navigation
- Plugin grid layouts
- Search and filtering interfaces
- Plugin details pages
- Installation workflows
- Mobile responsiveness

### 2. Component Visual Tests
- Plugin cards in various states
- Form components and validation
- Loading states and skeletons
- Navigation components
- Modal dialogs
- Status indicators

### 3. Cross-Browser Visual Tests
- Chrome-specific rendering
- Firefox compatibility
- Safari/WebKit differences
- Mobile browser variations
- Dark mode consistency
- Font rendering differences

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Visual Regression Tests

on: [push, pull_request]

jobs:
  visual-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright
        run: npx playwright install --with-deps
      
      - name: Run visual tests
        run: npm run test:visual
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: visual-test-results
          path: tests/visual/test-results/
```

### Handling Test Failures

When visual tests fail:

1. **Review Diff Images**: Check the `screenshots/diff/` directory
2. **Analyze Changes**: Determine if changes are intentional
3. **Update Baselines**: Run `npm run test:visual:update` if changes are expected
4. **Fix Regressions**: Address unintended visual changes

## Environment Variables

```bash
# Test database (required)
TEST_DATABASE_URL="postgresql://user:pass@localhost:5432/test_db"

# Skip server startup (if server already running)
SKIP_SERVER_START="true"

# Base URL for testing (default: http://localhost:3000)
BASE_URL="http://localhost:3000"

# CI mode (enables additional reporters)
CI="true"
```

## Troubleshooting

### Common Issues

1. **Font Rendering Differences**
   ```bash
   # Install system fonts for consistent rendering
   sudo apt-get install fonts-liberation fonts-dejavu-core
   ```

2. **Image Loading Timeouts**
   ```typescript
   // Increase timeout for image-heavy pages
   await page.waitForLoadState('networkidle', { timeout: 10000 });
   ```

3. **Animation Interference**
   ```typescript
   // Disable all animations
   await page.addStyleTag({
     content: '*, *::before, *::after { animation-duration: 0s !important; }'
   });
   ```

4. **Docker Environment Differences**
   ```dockerfile
   # Use consistent fonts in Docker
   RUN apt-get update && apt-get install -y fonts-liberation
   ```

### Debugging Tips

1. **Run in headed mode**: `npm run test:visual:headed`
2. **Use debug mode**: `npm run test:visual:debug`
3. **Check test logs**: Review `test-results/` directory
4. **Compare screenshots**: Use image diff tools for detailed comparison
5. **Test specific browsers**: Use browser-specific commands

## Performance Considerations

- **Parallel Execution**: Tests run in parallel by default
- **Screenshot Optimization**: Images are automatically optimized
- **Archive Cleanup**: Old screenshots are automatically archived
- **Resource Limits**: Configure memory limits for large test suites

## Maintenance

### Regular Tasks

1. **Update Baselines**: When intentional UI changes are made
2. **Archive Cleanup**: Remove old test artifacts
3. **Threshold Tuning**: Adjust sensitivity based on feedback
4. **Browser Updates**: Update Playwright browsers regularly

### Monitoring

- **Test Duration**: Monitor test execution time
- **Failure Rates**: Track and investigate recurring failures
- **Screenshot Size**: Optimize image storage
- **Coverage**: Ensure all critical UI paths are tested

## Contributing

When adding new visual tests:

1. Follow existing test patterns
2. Use descriptive test names
3. Include multiple viewport sizes
4. Test both light and dark modes
5. Document any special setup requirements

## References

- [Playwright Visual Testing](https://playwright.dev/docs/test-screenshots)
- [Visual Testing Best Practices](https://playwright.dev/docs/best-practices)
- [Cross-Browser Testing](https://playwright.dev/docs/browsers)
- [Test Configuration](https://playwright.dev/docs/test-configuration)