/**
 * Observability Configuration Management
 * 
 * Production-ready configuration system for comprehensive observability,
 * SRE automation, and monitoring platform integration.
 */

export interface ObservabilityConfig {
  // Core Configuration
  environment: 'development' | 'staging' | 'production';
  serviceName: string;
  version: string;
  
  // Metrics Collection
  metrics: {
    enabled: boolean;
    collectionInterval: number; // milliseconds
    batchSize: number;
    retention: string; // e.g., '30d', '90d', '1y'
    endpoints: {
      prometheus?: string;
      influxdb?: string;
      datadog?: string;
      newrelic?: string;
      custom?: string[];
    };
    customMetrics: {
      businessMetrics: boolean;
      userExperienceMetrics: boolean;
      infrastructureMetrics: boolean;
      applicationMetrics: boolean;
      securityMetrics: boolean;
    };
  };
  
  // Logging Configuration
  logging: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
    structured: boolean;
    sampling: {
      enabled: boolean;
      rate: number; // 0.0 to 1.0
    };
    outputs: {
      console: boolean;
      file: boolean;
      elasticsearch: boolean;
      loki: boolean;
      cloudwatch: boolean;
      splunk: boolean;
    };
    enhancement: {
      enrichWithTrace: boolean;
      enrichWithMetrics: boolean;
      enrichWithContext: boolean;
      sensitiveDataMasking: boolean;
    };
  };
  
  // Distributed Tracing
  tracing: {
    enabled: boolean;
    samplingRate: number; // 0.0 to 1.0
    exporters: {
      jaeger?: {
        endpoint: string;
        headers?: Record<string, string>;
      };
      zipkin?: {
        endpoint: string;
        headers?: Record<string, string>;
      };
      otlp?: {
        endpoint: string;
        headers?: Record<string, string>;
      };
      datadog?: {
        endpoint: string;
        apiKey: string;
      };
    };
    propagation: {
      b3: boolean;
      tracecontext: boolean;
      baggage: boolean;
      jaeger: boolean;
    };
    instrumentation: {
      http: boolean;
      database: boolean;
      redis: boolean;
      graphql: boolean;
      grpc: boolean;
      filesystem: boolean;
    };
  };
  
  // SRE Automation
  sre: {
    enabled: boolean;
    errorBudgets: {
      enabled: boolean;
      defaultBudget: number; // percentage (e.g., 99.9 = 0.1% error budget)
      burnRateAlerts: {
        enabled: boolean;
        fastBurnThreshold: number; // e.g., 14.4 (2% of budget in 1 hour)
        slowBurnThreshold: number; // e.g., 6 (5% of budget in 6 hours)
      };
    };
    slo: {
      availability: {
        enabled: boolean;
        target: number; // percentage (e.g., 99.9)
        window: string; // e.g., '30d', '7d'
      };
      latency: {
        enabled: boolean;
        p95Target: number; // milliseconds
        p99Target: number; // milliseconds
        window: string;
      };
      throughput: {
        enabled: boolean;
        target: number; // requests per second
        window: string;
      };
    };
    runbooks: {
      enabled: boolean;
      autoExecution: boolean;
      approvalRequired: boolean;
    };
  };
  
  // Incident Management
  incidents: {
    enabled: boolean;
    detection: {
      anomalyThreshold: number; // standard deviations
      consecutiveFailures: number;
      responseTimeThreshold: number; // milliseconds
      errorRateThreshold: number; // percentage
    };
    escalation: {
      levels: Array<{
        name: string;
        delay: number; // minutes
        channels: string[]; // slack, email, pagerduty, etc.
      }>;
    };
    automation: {
      autoRemediation: boolean;
      rollbackEnabled: boolean;
      scalingEnabled: boolean;
    };
    integrations: {
      slack?: {
        webhook: string;
        channels: string[];
      };
      pagerduty?: {
        integrationKey: string;
        severity: string;
      };
      jira?: {
        project: string;
        issueType: string;
        apiToken: string;
      };
    };
  };
  
  // Alerting Configuration
  alerting: {
    enabled: boolean;
    channels: {
      slack: boolean;
      email: boolean;
      webhooks: boolean;
      pagerduty: boolean;
      teams: boolean;
    };
    rules: Array<{
      name: string;
      condition: string;
      severity: 'critical' | 'high' | 'medium' | 'low';
      cooldown: number; // minutes
      enabled: boolean;
    }>;
    smartAlerting: {
      enabled: boolean;
      mlAnomalyDetection: boolean;
      alertCorrelation: boolean;
      noiseReduction: boolean;
      contextualAlerting: boolean;
    };
  };
  
  // Performance Monitoring
  performance: {
    enabled: boolean;
    realUserMonitoring: boolean;
    syntheticMonitoring: boolean;
    coreWebVitals: boolean;
    resourceTiming: boolean;
    customTimings: boolean;
    thresholds: {
      fcp: number; // First Contentful Paint (ms)
      lcp: number; // Largest Contentful Paint (ms)
      fid: number; // First Input Delay (ms)
      cls: number; // Cumulative Layout Shift
      ttfb: number; // Time to First Byte (ms)
    };
  };
  
  // Capacity Planning
  capacity: {
    enabled: boolean;
    forecasting: {
      enabled: boolean;
      horizonDays: number;
      confidenceLevel: number; // percentage
      seasonalAdjustment: boolean;
    };
    autoScaling: {
      enabled: boolean;
      minReplicas: number;
      maxReplicas: number;
      targetCpuUtilization: number;
      targetMemoryUtilization: number;
      scaleUpCooldown: number; // seconds
      scaleDownCooldown: number; // seconds
    };
    costOptimization: {
      enabled: boolean;
      rightSizing: boolean;
      unusedResourceDetection: boolean;
      recommendationsEnabled: boolean;
    };
  };
  
  // Integration Platform Settings
  integrations: {
    prometheus: {
      enabled: boolean;
      endpoint: string;
      queries: Record<string, string>;
      scrapeInterval: string;
    };
    grafana: {
      enabled: boolean;
      endpoint: string;
      apiKey: string;
      dashboards: string[];
    };
    elasticsearch: {
      enabled: boolean;
      endpoint: string;
      index: string;
      username?: string;
      password?: string;
    };
    jaeger: {
      enabled: boolean;
      endpoint: string;
      service: string;
    };
    datadog: {
      enabled: boolean;
      apiKey: string;
      appKey: string;
      site: string;
    };
  };
  
  // Security and Compliance
  security: {
    dataEncryption: boolean;
    auditLogging: boolean;
    complianceReporting: boolean;
    gdprCompliance: boolean;
    dataRetentionPolicies: Record<string, string>;
    accessControls: {
      rbac: boolean;
      apiKeyAuth: boolean;
      tokenAuth: boolean;
    };
  };
}

/**
 * Default configuration based on environment
 */
export const getDefaultConfig = (environment: string): ObservabilityConfig => {
  const isProduction = environment === 'production';
  const isDevelopment = environment === 'development';
  
  return {
    environment: environment as any,
    serviceName: process.env.SERVICE_NAME || 'saas-idp',
    version: process.env.VERSION || '1.0.0',
    
    metrics: {
      enabled: true,
      collectionInterval: isDevelopment ? 30000 : 15000, // 30s dev, 15s prod
      batchSize: 100,
      retention: isProduction ? '90d' : '30d',
      endpoints: {
        prometheus: process.env.PROMETHEUS_ENDPOINT || 'http://localhost:9090',
        influxdb: process.env.INFLUXDB_ENDPOINT,
        datadog: process.env.DATADOG_ENDPOINT,
        newrelic: process.env.NEWRELIC_ENDPOINT,
      },
      customMetrics: {
        businessMetrics: true,
        userExperienceMetrics: true,
        infrastructureMetrics: true,
        applicationMetrics: true,
        securityMetrics: isProduction,
      },
    },
    
    logging: {
      enabled: true,
      level: isDevelopment ? 'debug' : 'info',
      structured: true,
      sampling: {
        enabled: isProduction,
        rate: 0.1, // 10% sampling in production
      },
      outputs: {
        console: true,
        file: true,
        elasticsearch: isProduction,
        loki: process.env.LOKI_ENDPOINT ? true : false,
        cloudwatch: process.env.AWS_REGION ? true : false,
        splunk: process.env.SPLUNK_ENDPOINT ? true : false,
      },
      enhancement: {
        enrichWithTrace: true,
        enrichWithMetrics: true,
        enrichWithContext: true,
        sensitiveDataMasking: isProduction,
      },
    },
    
    tracing: {
      enabled: true,
      samplingRate: isDevelopment ? 1.0 : 0.1, // 100% dev, 10% prod
      exporters: {
        jaeger: {
          endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
        },
        otlp: {
          endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
        },
      },
      propagation: {
        b3: true,
        tracecontext: true,
        baggage: true,
        jaeger: true,
      },
      instrumentation: {
        http: true,
        database: true,
        redis: true,
        graphql: true,
        grpc: false,
        filesystem: isDevelopment,
      },
    },
    
    sre: {
      enabled: true,
      errorBudgets: {
        enabled: true,
        defaultBudget: 99.9, // 99.9% availability = 0.1% error budget
        burnRateAlerts: {
          enabled: true,
          fastBurnThreshold: 14.4,
          slowBurnThreshold: 6,
        },
      },
      slo: {
        availability: {
          enabled: true,
          target: 99.9,
          window: '30d',
        },
        latency: {
          enabled: true,
          p95Target: 500, // 500ms
          p99Target: 1000, // 1s
          window: '30d',
        },
        throughput: {
          enabled: true,
          target: 1000, // 1000 RPS
          window: '5m',
        },
      },
      runbooks: {
        enabled: true,
        autoExecution: !isProduction,
        approvalRequired: isProduction,
      },
    },
    
    incidents: {
      enabled: true,
      detection: {
        anomalyThreshold: 3,
        consecutiveFailures: 3,
        responseTimeThreshold: 5000,
        errorRateThreshold: 5, // 5%
      },
      escalation: {
        levels: [
          {
            name: 'L1 - Team Alert',
            delay: 0,
            channels: ['slack'],
          },
          {
            name: 'L2 - Manager Alert',
            delay: 15,
            channels: ['slack', 'email'],
          },
          {
            name: 'L3 - On-Call Alert',
            delay: 30,
            channels: ['pagerduty'],
          },
        ],
      },
      automation: {
        autoRemediation: !isProduction,
        rollbackEnabled: true,
        scalingEnabled: true,
      },
      integrations: {
        slack: {
          webhook: process.env.SLACK_WEBHOOK || '',
          channels: ['#alerts', '#incidents'],
        },
        pagerduty: {
          integrationKey: process.env.PAGERDUTY_INTEGRATION_KEY || '',
          severity: 'critical',
        },
      },
    },
    
    alerting: {
      enabled: true,
      channels: {
        slack: true,
        email: isProduction,
        webhooks: true,
        pagerduty: isProduction,
        teams: false,
      },
      rules: [
        {
          name: 'High Error Rate',
          condition: 'error_rate > 5%',
          severity: 'critical',
          cooldown: 15,
          enabled: true,
        },
        {
          name: 'High Response Time',
          condition: 'p95_latency > 1000ms',
          severity: 'high',
          cooldown: 10,
          enabled: true,
        },
        {
          name: 'Low Availability',
          condition: 'availability < 99.5%',
          severity: 'critical',
          cooldown: 5,
          enabled: true,
        },
      ],
      smartAlerting: {
        enabled: true,
        mlAnomalyDetection: true,
        alertCorrelation: true,
        noiseReduction: true,
        contextualAlerting: true,
      },
    },
    
    performance: {
      enabled: true,
      realUserMonitoring: true,
      syntheticMonitoring: isProduction,
      coreWebVitals: true,
      resourceTiming: true,
      customTimings: true,
      thresholds: {
        fcp: 1800, // 1.8s
        lcp: 2500, // 2.5s
        fid: 100,  // 100ms
        cls: 0.1,  // 0.1
        ttfb: 600, // 600ms
      },
    },
    
    capacity: {
      enabled: true,
      forecasting: {
        enabled: true,
        horizonDays: 30,
        confidenceLevel: 95,
        seasonalAdjustment: true,
      },
      autoScaling: {
        enabled: !isDevelopment,
        minReplicas: 2,
        maxReplicas: 10,
        targetCpuUtilization: 70,
        targetMemoryUtilization: 80,
        scaleUpCooldown: 300,
        scaleDownCooldown: 300,
      },
      costOptimization: {
        enabled: true,
        rightSizing: true,
        unusedResourceDetection: true,
        recommendationsEnabled: true,
      },
    },
    
    integrations: {
      prometheus: {
        enabled: true,
        endpoint: process.env.PROMETHEUS_ENDPOINT || 'http://localhost:9090',
        queries: {
          cpu_usage: 'cpu_usage_percent',
          memory_usage: 'memory_usage_percent',
          request_rate: 'http_requests_total',
          error_rate: 'http_errors_total',
        },
        scrapeInterval: '15s',
      },
      grafana: {
        enabled: true,
        endpoint: process.env.GRAFANA_ENDPOINT || 'http://localhost:3000',
        apiKey: process.env.GRAFANA_API_KEY || '',
        dashboards: ['system-overview', 'application-metrics', 'business-metrics'],
      },
      elasticsearch: {
        enabled: process.env.ELASTICSEARCH_ENDPOINT ? true : false,
        endpoint: process.env.ELASTICSEARCH_ENDPOINT || '',
        index: 'observability-*',
        username: process.env.ELASTICSEARCH_USERNAME,
        password: process.env.ELASTICSEARCH_PASSWORD,
      },
      jaeger: {
        enabled: true,
        endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:16686',
        service: 'saas-idp',
      },
      datadog: {
        enabled: process.env.DATADOG_API_KEY ? true : false,
        apiKey: process.env.DATADOG_API_KEY || '',
        appKey: process.env.DATADOG_APP_KEY || '',
        site: process.env.DATADOG_SITE || 'datadoghq.com',
      },
    },
    
    security: {
      dataEncryption: isProduction,
      auditLogging: true,
      complianceReporting: isProduction,
      gdprCompliance: isProduction,
      dataRetentionPolicies: {
        metrics: '90d',
        logs: '30d',
        traces: '7d',
        incidents: '1y',
      },
      accessControls: {
        rbac: true,
        apiKeyAuth: true,
        tokenAuth: true,
      },
    },
  };
};

/**
 * Configuration validation
 */
export const validateConfig = (config: ObservabilityConfig): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Validate required fields
  if (!config.serviceName) errors.push('serviceName is required');
  if (!config.version) errors.push('version is required');
  
  // Validate metrics configuration
  if (config.metrics.enabled && config.metrics.collectionInterval <= 0) {
    errors.push('metrics.collectionInterval must be positive');
  }
  
  // Validate SRE configuration
  if (config.sre.enabled && config.sre.errorBudgets.defaultBudget <= 0) {
    errors.push('sre.errorBudgets.defaultBudget must be positive');
  }
  
  // Validate tracing sampling rate
  if (config.tracing.samplingRate < 0 || config.tracing.samplingRate > 1) {
    errors.push('tracing.samplingRate must be between 0 and 1');
  }
  
  // Validate performance thresholds
  if (config.performance.enabled) {
    if (config.performance.thresholds.cls < 0 || config.performance.thresholds.cls > 1) {
      errors.push('performance.thresholds.cls must be between 0 and 1');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Environment-specific configuration loader
 */
export const loadConfig = (): ObservabilityConfig => {
  const environment = process.env.NODE_ENV || 'development';
  const config = getDefaultConfig(environment);
  
  // Override with environment-specific config file if it exists
  try {
    const envConfigPath = `./config/observability-${environment}.json`;
    const fs = require('fs');
    if (fs.existsSync(envConfigPath)) {
      const envConfig = JSON.parse(fs.readFileSync(envConfigPath, 'utf8'));
      Object.assign(config, envConfig);
    }
  } catch (error) {
    console.warn('Failed to load environment-specific config:', error);
  }
  
  // Validate configuration
  const validation = validateConfig(config);
  if (!validation.valid) {
    throw new Error(`Invalid observability configuration: ${validation.errors.join(', ')}`);
  }
  
  return config;
};

export default { getDefaultConfig, validateConfig, loadConfig };