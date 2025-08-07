/**
 * Testing Framework Configuration
 * Centralized configuration for the comprehensive testing framework
 */

import { TestingFrameworkConfig, QualityGateThresholds } from '../TestingFramework';

export const DEFAULT_TESTING_CONFIG: TestingFrameworkConfig = {
  framework: {
    parallel: true,
    maxConcurrency: 4,
    timeout: 300000, // 5 minutes
    retries: 2,
    failFast: false
  },
  qualityGates: {
    enabled: true,
    strictMode: false,
    thresholds: {
      coverage: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80
      },
      performance: {
        responseTime: 2000, // 2 seconds
        throughput: 100,    // 100 requests/second
        errorRate: 5,       // 5% error rate
        availability: 99.9  // 99.9% availability
      },
      security: {
        vulnerabilities: {
          critical: 0,
          high: 2,
          medium: 10,
          low: 50
        },
        compliance: 80
      },
      reliability: {
        uptime: 99.9,
        mtbf: 168,  // 1 week in hours
        mttr: 1     // 1 hour
      }
    }
  },
  environments: {
    autoProvisioning: true,
    cleanup: true,
    isolation: true
  },
  reporting: {
    enabled: true,
    formats: ['html', 'json', 'junit'],
    realtime: true,
    webhooks: []
  },
  integrations: {
    ci: true,
    monitoring: true,
    alerting: true
  }
};

export const PRODUCTION_TESTING_CONFIG: TestingFrameworkConfig = {
  ...DEFAULT_TESTING_CONFIG,
  framework: {
    ...DEFAULT_TESTING_CONFIG.framework,
    maxConcurrency: 8,
    timeout: 600000, // 10 minutes
    retries: 3,
    failFast: true
  },
  qualityGates: {
    enabled: true,
    strictMode: true,
    thresholds: {
      coverage: {
        lines: 90,
        functions: 90,
        branches: 80,
        statements: 90
      },
      performance: {
        responseTime: 1000, // 1 second
        throughput: 500,    // 500 requests/second
        errorRate: 1,       // 1% error rate
        availability: 99.95 // 99.95% availability
      },
      security: {
        vulnerabilities: {
          critical: 0,
          high: 0,
          medium: 5,
          low: 20
        },
        compliance: 95
      },
      reliability: {
        uptime: 99.95,
        mtbf: 336,  // 2 weeks in hours
        mttr: 0.5   // 30 minutes
      }
    }
  }
};

export const DEVELOPMENT_TESTING_CONFIG: TestingFrameworkConfig = {
  ...DEFAULT_TESTING_CONFIG,
  framework: {
    ...DEFAULT_TESTING_CONFIG.framework,
    maxConcurrency: 2,
    timeout: 120000, // 2 minutes
    retries: 1,
    failFast: false
  },
  qualityGates: {
    enabled: true,
    strictMode: false,
    thresholds: {
      coverage: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70
      },
      performance: {
        responseTime: 5000, // 5 seconds
        throughput: 50,     // 50 requests/second
        errorRate: 10,      // 10% error rate
        availability: 95    // 95% availability
      },
      security: {
        vulnerabilities: {
          critical: 1,
          high: 5,
          medium: 20,
          low: 100
        },
        compliance: 70
      },
      reliability: {
        uptime: 95,
        mtbf: 24,   // 1 day in hours
        mttr: 4     // 4 hours
      }
    }
  }
};

/**
 * Get testing configuration based on environment
 */
export function getTestingConfig(environment: 'development' | 'staging' | 'production' = 'development'): TestingFrameworkConfig {
  switch (environment) {
    case 'production':
      return PRODUCTION_TESTING_CONFIG;
    case 'staging':
      return DEFAULT_TESTING_CONFIG;
    case 'development':
    default:
      return DEVELOPMENT_TESTING_CONFIG;
  }
}

/**
 * Create custom testing configuration
 */
export function createTestingConfig(overrides: Partial<TestingFrameworkConfig>): TestingFrameworkConfig {
  return {
    ...DEFAULT_TESTING_CONFIG,
    ...overrides,
    framework: {
      ...DEFAULT_TESTING_CONFIG.framework,
      ...overrides.framework
    },
    qualityGates: {
      ...DEFAULT_TESTING_CONFIG.qualityGates,
      ...overrides.qualityGates,
      thresholds: {
        ...DEFAULT_TESTING_CONFIG.qualityGates.thresholds,
        ...overrides.qualityGates?.thresholds
      }
    },
    environments: {
      ...DEFAULT_TESTING_CONFIG.environments,
      ...overrides.environments
    },
    reporting: {
      ...DEFAULT_TESTING_CONFIG.reporting,
      ...overrides.reporting
    },
    integrations: {
      ...DEFAULT_TESTING_CONFIG.integrations,
      ...overrides.integrations
    }
  };
}