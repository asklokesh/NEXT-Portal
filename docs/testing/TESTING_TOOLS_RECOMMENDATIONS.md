# Testing Tools & Frameworks Recommendations
## NEXT Internal Developer Portal

### Executive Summary
This document provides comprehensive recommendations for testing tools and frameworks, including evaluation criteria, comparison matrices, and implementation guidelines for the NEXT IDP platform.

---

## Tool Selection Criteria

### Evaluation Framework
1. **Compatibility** - Works with Next.js 15.4.4 and TypeScript
2. **Performance** - Fast execution and minimal overhead
3. **Maintainability** - Easy to write and maintain tests
4. **Community** - Active development and support
5. **Integration** - CI/CD and IDE compatibility
6. **Cost** - License and operational costs
7. **Learning Curve** - Team adoption effort

---

## Recommended Testing Stack

### Core Testing Framework

#### **PRIMARY CHOICE: Vitest** (Recommended Migration from Jest)
**Rationale:** Native ESM support, faster execution, better TypeScript integration

```javascript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', '.next/']
    }
  }
});
```

**Advantages:**
- 3-5x faster than Jest
- Native ESM support
- Compatible with Vite ecosystem
- Better watch mode
- Snapshot testing included

**Migration Path:**
```bash
# Install Vitest
npm install -D vitest @vitest/ui @vitejs/plugin-react jsdom

# Update package.json scripts
"test": "vitest",
"test:ui": "vitest --ui",
"test:coverage": "vitest --coverage"
```

#### **CURRENT: Jest** (Continue using with optimizations)
```javascript
// Optimized jest.config.js
module.exports = {
  // Use SWC for faster transforms
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest', {
      jsc: {
        parser: {
          syntax: 'typescript',
          tsx: true
        },
        transform: {
          react: {
            runtime: 'automatic'
          }
        }
      }
    }]
  },
  // Parallel execution
  maxWorkers: '50%',
  // Cache for faster reruns
  cache: true,
  cacheDirectory: '.jest-cache'
};
```

---

## Testing Tools by Category

### 1. Unit Testing

#### **React Testing Library** ✅ (Keep Current)
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Best practices utilities
export const renderWithProviders = (ui: ReactElement, options = {}) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {ui}
      </ThemeProvider>
    </QueryClientProvider>,
    options
  );
};
```

#### **React Hooks Testing Library**
```typescript
import { renderHook, act } from '@testing-library/react-hooks';

test('useWebSocket hook', async () => {
  const { result } = renderHook(() => useWebSocket('ws://localhost'));
  
  act(() => {
    result.current.connect();
  });
  
  expect(result.current.isConnected).toBe(true);
});
```

### 2. End-to-End Testing

#### **Playwright** ✅ (Primary E2E Tool)
**Current Setup:** Already configured, needs test implementation

```typescript
// Enhanced Playwright configuration
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results.json' }],
    ['junit', { outputFile: 'junit.xml' }],
    ['@estruyf/github-actions-reporter'] // GitHub integration
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:4400',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Advanced options
    actionTimeout: 10000,
    navigationTimeout: 30000,
    // Network stubbing
    extraHTTPHeaders: {
      'X-Test-Environment': 'e2e'
    }
  },
  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 13'] }
    }
  ],
  // Automatic server start
  webServer: {
    command: 'npm run dev',
    port: 4400,
    timeout: 120000,
    reuseExistingServer: !process.env.CI
  }
});
```

#### **Alternative: Cypress** (For teams familiar with it)
```javascript
// cypress.config.js
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4400',
    supportFile: 'cypress/support/e2e.js',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    screenshotOnRunFailure: true
  },
  component: {
    devServer: {
      framework: 'next',
      bundler: 'webpack'
    }
  }
});
```

### 3. API Testing

#### **Supertest** (For API Route Testing)
```typescript
import request from 'supertest';
import { createServer } from 'http';
import { apiHandler } from '@/pages/api/catalog';

describe('API: /api/catalog', () => {
  const server = createServer(apiHandler);
  
  it('should return catalog items', async () => {
    const response = await request(server)
      .get('/api/catalog')
      .set('Authorization', 'Bearer token')
      .expect(200);
      
    expect(response.body).toHaveProperty('items');
    expect(response.body.items).toBeInstanceOf(Array);
  });
});
```

#### **MSW (Mock Service Worker)** ✅ (For API Mocking)
```typescript
// mocks/handlers.ts
import { rest } from 'msw';

export const handlers = [
  rest.get('/api/catalog', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        items: [
          { id: '1', name: 'Service A' },
          { id: '2', name: 'Service B' }
        ]
      })
    );
  })
];

// mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

### 4. Performance Testing

#### **k6** (Load Testing)
```javascript
// tests/performance/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up
    { duration: '5m', target: 100 }, // Stay at 100
    { duration: '2m', target: 200 }, // Ramp to 200
    { duration: '5m', target: 200 }, // Stay at 200
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    errors: ['rate<0.1'],
  },
};

export default function() {
  const res = http.get('http://localhost:4400/api/catalog');
  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  errorRate.add(!success);
  sleep(1);
}
```

#### **Lighthouse CI** (Performance Monitoring)
```javascript
// lighthouserc.js
module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:4400/',
        'http://localhost:4400/dashboard',
        'http://localhost:4400/catalog'
      ],
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        throttling: {
          cpuSlowdownMultiplier: 1
        }
      }
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }]
      }
    },
    upload: {
      target: 'temporary-public-storage'
    }
  }
};
```

### 5. Visual Regression Testing

#### **Percy** (Visual Testing Platform)
```typescript
// With Playwright
import { test } from '@playwright/test';
import percySnapshot from '@percy/playwright';

test('visual regression - dashboard', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await percySnapshot(page, 'Dashboard');
});
```

#### **Chromatic** (Storybook Visual Testing)
```bash
# Setup
npm install --save-dev chromatic

# Run visual tests
npx chromatic --project-token=<token>
```

### 6. Security Testing

#### **OWASP ZAP** (Security Scanning)
```yaml
# .github/workflows/security.yml
- name: OWASP ZAP Scan
  uses: zaproxy/action-full-scan@v0.4.0
  with:
    target: 'http://localhost:4400'
    rules_file_name: '.zap/rules.tsv'
    cmd_options: '-a'
```

#### **Snyk** (Dependency Scanning)
```bash
# Install
npm install -g snyk

# Test for vulnerabilities
snyk test

# Monitor project
snyk monitor
```

### 7. Accessibility Testing

#### **axe-core with Playwright**
```typescript
import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test('accessibility - dashboard', async ({ page }) => {
  await page.goto('/dashboard');
  await injectAxe(page);
  await checkA11y(page, null, {
    detailedReport: true,
    detailedReportOptions: {
      html: true
    }
  });
});
```

#### **Pa11y** (CLI Accessibility Testing)
```javascript
// pa11y.config.js
module.exports = {
  defaults: {
    standard: 'WCAG2AA',
    runners: ['axe', 'htmlcs'],
    viewport: {
      width: 1280,
      height: 1024
    }
  },
  urls: [
    'http://localhost:4400/',
    'http://localhost:4400/dashboard',
    'http://localhost:4400/catalog'
  ]
};
```

### 8. Test Data Management

#### **Faker.js** (Test Data Generation)
```typescript
import { faker } from '@faker-js/faker';

export function createMockService() {
  return {
    id: faker.string.uuid(),
    name: faker.company.name(),
    description: faker.lorem.paragraph(),
    owner: faker.internet.email(),
    repository: faker.internet.url(),
    tags: faker.helpers.arrayElements(['backend', 'frontend', 'database'], 2),
    createdAt: faker.date.past()
  };
}
```

#### **Prisma** (Database Seeding)
```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { createMockService } from './factories';

const prisma = new PrismaClient();

async function seed() {
  // Clear existing data
  await prisma.service.deleteMany();
  
  // Seed services
  const services = Array.from({ length: 100 }, createMockService);
  await prisma.service.createMany({ data: services });
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### 9. Monitoring & Observability

#### **Sentry** (Error Tracking in Tests)
```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: 'test',
  beforeSend(event) {
    // Filter test-specific errors
    if (event.tags?.test === true) {
      return null;
    }
    return event;
  }
});
```

#### **DataDog** (Test Metrics)
```typescript
import { StatsD } from 'node-dogstatsd';

const metrics = new StatsD();

export function trackTestMetrics(testName: string, duration: number, passed: boolean) {
  metrics.timing(`tests.duration.${testName}`, duration);
  metrics.increment(`tests.${passed ? 'passed' : 'failed'}.${testName}`);
}
```

---

## Tool Comparison Matrix

### Unit Testing Frameworks
| Feature | Jest | Vitest | Mocha | AVA |
|---------|------|--------|-------|-----|
| Speed | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Setup | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| TypeScript | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Watch Mode | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| Mocking | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| Community | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |

### E2E Testing Frameworks
| Feature | Playwright | Cypress | Puppeteer | Selenium |
|---------|------------|---------|-----------|----------|
| Speed | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| Reliability | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Cross-browser | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| Debugging | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| CI Integration | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Learning Curve | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1)
```bash
# Install core testing tools
npm install -D @testing-library/react @testing-library/user-event
npm install -D msw @mswjs/data
npm install -D @faker-js/faker

# Set up test infrastructure
mkdir -p tests/{unit,integration,e2e,fixtures,mocks}
```

### Phase 2: Migration (Week 2-3)
```bash
# Optional: Migrate to Vitest
npm install -D vitest @vitest/ui
npm run test -- --run # Verify existing tests

# Update test scripts
npm pkg set scripts.test="vitest"
npm pkg set scripts.test:ui="vitest --ui"
```

### Phase 3: Enhancement (Week 4)
```bash
# Add specialized tools
npm install -D @percy/playwright
npm install -D axe-playwright
npm install -D @faker-js/faker

# Configure CI integration
cp .github/workflows/test.yml.template .github/workflows/test.yml
```

---

## Cost Analysis

### Open Source Tools (Recommended)
| Tool | License | Cost | Notes |
|------|---------|------|-------|
| Vitest | MIT | Free | Core testing framework |
| Playwright | Apache 2.0 | Free | E2E testing |
| k6 | AGPL 3.0 | Free | Load testing |
| MSW | MIT | Free | API mocking |
| axe-core | MPL 2.0 | Free | Accessibility |

### Commercial Tools (Optional)
| Tool | Purpose | Cost/Month | ROI |
|------|---------|------------|-----|
| Percy | Visual Testing | $599 | High for UI-heavy apps |
| Chromatic | Storybook Testing | $149 | Medium |
| Sentry | Error Tracking | $26 | High |
| DataDog | Monitoring | $15/host | Medium |
| BrowserStack | Cross-browser | $199 | Low (Playwright sufficient) |

**Total Monthly Cost:**
- Minimum (Open Source): $0
- Recommended: $41 (Sentry + Basic Monitoring)
- Full Suite: $989

---

## Best Practices & Guidelines

### 1. Test Organization
```
tests/
├── unit/              # Fast, isolated tests
├── integration/       # Service integration tests
├── e2e/              # User journey tests
├── performance/      # Load and stress tests
├── fixtures/         # Test data
├── mocks/           # API mocks
├── helpers/         # Test utilities
└── setup/           # Global setup files
```

### 2. Naming Conventions
```typescript
// Test files
ComponentName.test.tsx    // Unit tests
ComponentName.spec.tsx    // Integration tests
feature.e2e.ts           // E2E tests

// Test descriptions
describe('ComponentName', () => {
  describe('when condition', () => {
    it('should expected behavior', () => {
      // Test implementation
    });
  });
});
```

### 3. Performance Optimization
```javascript
// Parallel execution
export default {
  maxWorkers: '50%',
  
  // Sharding for CI
  shard: process.env.CI ? {
    current: Number(process.env.SHARD_INDEX),
    total: Number(process.env.TOTAL_SHARDS)
  } : undefined,
  
  // Selective testing
  testMatch: process.env.ONLY_CHANGED 
    ? ['**/*.test.ts'] 
    : ['**/*.{test,spec}.{ts,tsx}']
};
```

---

## Conclusion

The recommended testing stack prioritizes:
1. **Speed** - Vitest for faster feedback loops
2. **Reliability** - Playwright for stable E2E tests
3. **Coverage** - Comprehensive tool selection for all test types
4. **Cost-effectiveness** - Open source tools with optional commercial add-ons
5. **Developer Experience** - Modern tools with excellent debugging

**Immediate Actions:**
1. Continue with Jest (optimize configuration)
2. Implement Playwright E2E tests
3. Set up MSW for API mocking
4. Configure k6 for performance testing
5. Integrate axe-core for accessibility

**Future Considerations:**
1. Migrate to Vitest for better performance
2. Add visual regression with Percy
3. Implement contract testing
4. Explore AI-powered test generation