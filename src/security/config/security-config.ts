/**
 * Production-Ready Security Configuration
 * Centralized security configuration management for enterprise deployment
 * Supports multiple environments and security compliance frameworks
 */

import { z } from 'zod';

// Security Configuration Schema
export const SecurityConfigSchema = z.object({
  environment: z.enum(['development', 'staging', 'production']),
  
  // Plugin Sandbox Configuration
  sandbox: z.object({
    defaultIsolationLevel: z.enum(['strict', 'moderate', 'minimal']),
    maxConcurrentSandboxes: z.number().min(1).max(1000),
    defaultResourceLimits: z.object({
      cpu: z.string(),
      memory: z.string(),
      storage: z.string(),
      networkBandwidth: z.string(),
      maxConnections: z.number(),
      maxFileDescriptors: z.number(),
      maxProcesses: z.number(),
      executionTimeLimit: z.number()
    }),
    defaultSecurityContext: z.object({
      runAsNonRoot: z.boolean(),
      runAsUser: z.number(),
      runAsGroup: z.number(),
      readOnlyRootFilesystem: z.boolean(),
      allowPrivilegeEscalation: z.boolean()
    }),
    kubernetes: z.object({
      namespace: z.string(),
      serviceAccount: z.string(),
      networkPoliciesEnabled: z.boolean(),
      podSecurityStandard: z.enum(['privileged', 'baseline', 'restricted']),
      admissionControllers: z.array(z.string())
    })
  }),

  // Authentication & Authorization
  auth: z.object({
    // mTLS Configuration
    mtls: z.object({
      enabled: z.boolean(),
      certificateValidityDays: z.number(),
      keySize: z.number(),
      minimumTLSVersion: z.enum(['1.2', '1.3']),
      cipherSuites: z.array(z.string()),
      ocspEnabled: z.boolean(),
      certificateRevocationEnabled: z.boolean(),
      caPaths: z.object({
        certificate: z.string(),
        privateKey: z.string()
      })
    }),
    
    // RBAC Configuration
    rbac: z.object({
      enabled: z.boolean(),
      defaultDenyAll: z.boolean(),
      sessionTimeout: z.number(),
      maxSessionsPerUser: z.number(),
      requireMFAForPrivilegedActions: z.boolean(),
      passwordPolicy: z.object({
        minLength: z.number(),
        requireUppercase: z.boolean(),
        requireLowercase: z.boolean(),
        requireNumbers: z.boolean(),
        requireSpecialChars: z.boolean(),
        maxAge: z.number(),
        historySize: z.number()
      })
    }),

    // JWT Configuration
    jwt: z.object({
      issuer: z.string(),
      audience: z.string(),
      secretOrPrivateKey: z.string(),
      algorithm: z.enum(['HS256', 'RS256', 'ES256']),
      expiresIn: z.string(),
      refreshTokenExpiry: z.string()
    })
  }),

  // Secret Management
  secrets: z.object({
    provider: z.enum(['internal', 'vault', 'aws', 'azure', 'gcp']),
    encryption: z.object({
      algorithm: z.enum(['AES-256-GCM', 'ChaCha20-Poly1305']),
      keyDerivation: z.object({
        algorithm: z.enum(['PBKDF2', 'scrypt', 'Argon2']),
        iterations: z.number(),
        saltLength: z.number()
      })
    }),
    rotation: z.object({
      enabled: z.boolean(),
      defaultInterval: z.number(), // days
      autoRotateApiKeys: z.boolean(),
      autoRotatePasswords: z.boolean()
    }),
    external: z.object({
      vault: z.object({
        url: z.string().optional(),
        token: z.string().optional(),
        namespace: z.string().optional()
      }).optional(),
      aws: z.object({
        region: z.string().optional(),
        accessKeyId: z.string().optional(),
        secretAccessKey: z.string().optional()
      }).optional()
    })
  }),

  // Security Scanning
  scanning: z.object({
    enabled: z.boolean(),
    scheduledScans: z.boolean(),
    realTimeScanning: z.boolean(),
    scanTypes: z.array(z.enum(['sast', 'dast', 'dependency', 'container', 'infrastructure'])),
    vulnerabilityThresholds: z.object({
      critical: z.number(),
      high: z.number(),
      medium: z.number(),
      low: z.number()
    }),
    complianceFrameworks: z.array(z.enum(['OWASP_TOP10', 'CIS', 'NIST', 'ISO27001', 'SOC2', 'GDPR', 'HIPAA'])),
    scanSchedule: z.object({
      frequency: z.enum(['daily', 'weekly', 'monthly']),
      time: z.string(), // HH:MM format
      timezone: z.string()
    })
  }),

  // Threat Detection
  threatDetection: z.object({
    enabled: z.boolean(),
    realTimeAnalysis: z.boolean(),
    behaviorAnalysis: z.boolean(),
    machineLearning: z.boolean(),
    threatIntelligence: z.object({
      enabled: z.boolean(),
      feeds: z.array(z.object({
        name: z.string(),
        url: z.string(),
        format: z.enum(['json', 'csv', 'xml', 'stix']),
        updateInterval: z.number() // minutes
      }))
    }),
    responseAutomation: z.object({
      enabled: z.boolean(),
      maxAutomatedActions: z.number(),
      requireApproval: z.array(z.string()),
      cooldownPeriod: z.number() // seconds
    })
  }),

  // Audit Logging
  audit: z.object({
    enabled: z.boolean(),
    logLevel: z.enum(['debug', 'info', 'warning', 'error', 'critical']),
    encryptLogs: z.boolean(),
    integrityChecking: z.boolean(),
    retentionPeriod: z.number(), // days
    remoteLogging: z.object({
      enabled: z.boolean(),
      endpoints: z.array(z.object({
        url: z.string(),
        method: z.enum(['POST', 'PUT']),
        authentication: z.object({
          type: z.enum(['none', 'basic', 'bearer', 'api_key']),
          credentials: z.record(z.string()).optional()
        }).optional()
      }))
    }),
    compliance: z.object({
      frameworks: z.array(z.enum(['SOX', 'PCI_DSS', 'HIPAA', 'GDPR', 'SOC2'])),
      tamperEvident: z.boolean(),
      digitalSignatures: z.boolean()
    })
  }),

  // Network Security
  network: z.object({
    zeroTrust: z.boolean(),
    serviceMesh: z.object({
      enabled: z.boolean(),
      provider: z.enum(['istio', 'linkerd', 'consul']),
      mtlsMode: z.enum(['STRICT', 'PERMISSIVE']),
      authorizationPolicy: z.enum(['ALLOW_ALL', 'DENY_ALL', 'CUSTOM'])
    }),
    firewalls: z.object({
      webApplicationFirewall: z.boolean(),
      networkFirewall: z.boolean(),
      dnsFiltering: z.boolean(),
      ipAllowlist: z.array(z.string()),
      ipBlocklist: z.array(z.string())
    })
  }),

  // Compliance
  compliance: z.object({
    enabled: z.boolean(),
    frameworks: z.array(z.enum(['SOC2', 'ISO27001', 'NIST', 'GDPR', 'HIPAA', 'PCI_DSS'])),
    dataClassification: z.object({
      enabled: z.boolean(),
      levels: z.array(z.enum(['public', 'internal', 'confidential', 'restricted'])),
      defaultLevel: z.enum(['public', 'internal', 'confidential', 'restricted'])
    }),
    dataResidency: z.object({
      enforced: z.boolean(),
      allowedRegions: z.array(z.string()),
      defaultRegion: z.string()
    }),
    rightsManagement: z.object({
      dataSubjectRights: z.boolean(),
      rightToBeDeleted: z.boolean(),
      rightToPortability: z.boolean(),
      consentManagement: z.boolean()
    })
  }),

  // Monitoring & Alerting
  monitoring: z.object({
    enabled: z.boolean(),
    metricsCollection: z.boolean(),
    distributedTracing: z.boolean(),
    healthChecks: z.object({
      enabled: z.boolean(),
      interval: z.number(), // seconds
      timeout: z.number() // seconds
    }),
    alerting: z.object({
      enabled: z.boolean(),
      channels: z.array(z.enum(['email', 'slack', 'webhook', 'pagerduty'])),
      severityThresholds: z.object({
        critical: z.boolean(),
        high: z.boolean(),
        medium: z.boolean(),
        low: z.boolean()
      })
    }),
    dashboards: z.object({
      enabled: z.boolean(),
      provider: z.enum(['grafana', 'kibana', 'datadog']),
      refreshInterval: z.number() // seconds
    })
  })
});

export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;

// Environment-specific configurations
export const SECURITY_CONFIGS: Record<string, SecurityConfig> = {
  development: {
    environment: 'development',
    sandbox: {
      defaultIsolationLevel: 'moderate',
      maxConcurrentSandboxes: 50,
      defaultResourceLimits: {
        cpu: '500m',
        memory: '512Mi',
        storage: '1Gi',
        networkBandwidth: '10Mbps',
        maxConnections: 100,
        maxFileDescriptors: 1024,
        maxProcesses: 50,
        executionTimeLimit: 3600
      },
      defaultSecurityContext: {
        runAsNonRoot: true,
        runAsUser: 65534,
        runAsGroup: 65534,
        readOnlyRootFilesystem: true,
        allowPrivilegeEscalation: false
      },
      kubernetes: {
        namespace: 'plugin-sandbox-dev',
        serviceAccount: 'plugin-sandbox',
        networkPoliciesEnabled: true,
        podSecurityStandard: 'baseline',
        admissionControllers: ['PodSecurity']
      }
    },
    auth: {
      mtls: {
        enabled: false, // Disabled for development ease
        certificateValidityDays: 30,
        keySize: 2048,
        minimumTLSVersion: '1.2',
        cipherSuites: ['ECDHE-ECDSA-AES256-GCM-SHA384'],
        ocspEnabled: false,
        certificateRevocationEnabled: false,
        caPaths: {
          certificate: '/tmp/ca-cert.pem',
          privateKey: '/tmp/ca-key.pem'
        }
      },
      rbac: {
        enabled: true,
        defaultDenyAll: false,
        sessionTimeout: 3600, // 1 hour
        maxSessionsPerUser: 10,
        requireMFAForPrivilegedActions: false,
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: false,
          maxAge: 365, // 1 year
          historySize: 3
        }
      },
      jwt: {
        issuer: 'portal-dev',
        audience: 'portal-users',
        secretOrPrivateKey: 'dev-secret-key-change-in-production',
        algorithm: 'HS256',
        expiresIn: '24h',
        refreshTokenExpiry: '7d'
      }
    },
    secrets: {
      provider: 'internal',
      encryption: {
        algorithm: 'AES-256-GCM',
        keyDerivation: {
          algorithm: 'scrypt',
          iterations: 32768,
          saltLength: 32
        }
      },
      rotation: {
        enabled: true,
        defaultInterval: 90,
        autoRotateApiKeys: false,
        autoRotatePasswords: false
      },
      external: {}
    },
    scanning: {
      enabled: true,
      scheduledScans: true,
      realTimeScanning: false,
      scanTypes: ['sast', 'dependency'],
      vulnerabilityThresholds: {
        critical: 0,
        high: 5,
        medium: 20,
        low: 100
      },
      complianceFrameworks: ['OWASP_TOP10'],
      scanSchedule: {
        frequency: 'weekly',
        time: '02:00',
        timezone: 'UTC'
      }
    },
    threatDetection: {
      enabled: true,
      realTimeAnalysis: true,
      behaviorAnalysis: false,
      machineLearning: false,
      threatIntelligence: {
        enabled: false,
        feeds: []
      },
      responseAutomation: {
        enabled: true,
        maxAutomatedActions: 5,
        requireApproval: ['block_user', 'terminate_sandbox'],
        cooldownPeriod: 300
      }
    },
    audit: {
      enabled: true,
      logLevel: 'info',
      encryptLogs: false,
      integrityChecking: true,
      retentionPeriod: 30,
      remoteLogging: {
        enabled: false,
        endpoints: []
      },
      compliance: {
        frameworks: [],
        tamperEvident: false,
        digitalSignatures: false
      }
    },
    network: {
      zeroTrust: false,
      serviceMesh: {
        enabled: false,
        provider: 'istio',
        mtlsMode: 'PERMISSIVE',
        authorizationPolicy: 'ALLOW_ALL'
      },
      firewalls: {
        webApplicationFirewall: false,
        networkFirewall: false,
        dnsFiltering: false,
        ipAllowlist: [],
        ipBlocklist: []
      }
    },
    compliance: {
      enabled: false,
      frameworks: [],
      dataClassification: {
        enabled: false,
        levels: ['public', 'internal'],
        defaultLevel: 'internal'
      },
      dataResidency: {
        enforced: false,
        allowedRegions: ['us-east-1'],
        defaultRegion: 'us-east-1'
      },
      rightsManagement: {
        dataSubjectRights: false,
        rightToBeDeleted: false,
        rightToPortability: false,
        consentManagement: false
      }
    },
    monitoring: {
      enabled: true,
      metricsCollection: true,
      distributedTracing: false,
      healthChecks: {
        enabled: true,
        interval: 30,
        timeout: 5
      },
      alerting: {
        enabled: true,
        channels: ['email'],
        severityThresholds: {
          critical: true,
          high: true,
          medium: false,
          low: false
        }
      },
      dashboards: {
        enabled: true,
        provider: 'grafana',
        refreshInterval: 30
      }
    }
  },

  production: {
    environment: 'production',
    sandbox: {
      defaultIsolationLevel: 'strict',
      maxConcurrentSandboxes: 500,
      defaultResourceLimits: {
        cpu: '1000m',
        memory: '1Gi',
        storage: '2Gi',
        networkBandwidth: '50Mbps',
        maxConnections: 200,
        maxFileDescriptors: 2048,
        maxProcesses: 100,
        executionTimeLimit: 7200
      },
      defaultSecurityContext: {
        runAsNonRoot: true,
        runAsUser: 65534,
        runAsGroup: 65534,
        readOnlyRootFilesystem: true,
        allowPrivilegeEscalation: false
      },
      kubernetes: {
        namespace: 'plugin-sandbox',
        serviceAccount: 'plugin-sandbox',
        networkPoliciesEnabled: true,
        podSecurityStandard: 'restricted',
        admissionControllers: ['PodSecurity', 'ValidatingAdmissionWebhook', 'MutatingAdmissionWebhook']
      }
    },
    auth: {
      mtls: {
        enabled: true,
        certificateValidityDays: 90,
        keySize: 4096,
        minimumTLSVersion: '1.3',
        cipherSuites: [
          'TLS_AES_256_GCM_SHA384',
          'TLS_CHACHA20_POLY1305_SHA256',
          'ECDHE-ECDSA-AES256-GCM-SHA384'
        ],
        ocspEnabled: true,
        certificateRevocationEnabled: true,
        caPaths: {
          certificate: '/etc/ssl/certs/portal-ca.pem',
          privateKey: '/etc/ssl/private/portal-ca-key.pem'
        }
      },
      rbac: {
        enabled: true,
        defaultDenyAll: true,
        sessionTimeout: 1800, // 30 minutes
        maxSessionsPerUser: 3,
        requireMFAForPrivilegedActions: true,
        passwordPolicy: {
          minLength: 14,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
          maxAge: 90, // 90 days
          historySize: 24
        }
      },
      jwt: {
        issuer: 'portal-production',
        audience: 'portal-users',
        secretOrPrivateKey: process.env.JWT_PRIVATE_KEY || '',
        algorithm: 'RS256',
        expiresIn: '15m',
        refreshTokenExpiry: '24h'
      }
    },
    secrets: {
      provider: 'vault',
      encryption: {
        algorithm: 'AES-256-GCM',
        keyDerivation: {
          algorithm: 'Argon2',
          iterations: 100000,
          saltLength: 64
        }
      },
      rotation: {
        enabled: true,
        defaultInterval: 30, // 30 days
        autoRotateApiKeys: true,
        autoRotatePasswords: true
      },
      external: {
        vault: {
          url: process.env.VAULT_URL || 'https://vault.internal.com',
          token: process.env.VAULT_TOKEN || '',
          namespace: 'portal'
        }
      }
    },
    scanning: {
      enabled: true,
      scheduledScans: true,
      realTimeScanning: true,
      scanTypes: ['sast', 'dast', 'dependency', 'container', 'infrastructure'],
      vulnerabilityThresholds: {
        critical: 0,
        high: 0,
        medium: 5,
        low: 20
      },
      complianceFrameworks: ['OWASP_TOP10', 'CIS', 'NIST', 'SOC2'],
      scanSchedule: {
        frequency: 'daily',
        time: '03:00',
        timezone: 'UTC'
      }
    },
    threatDetection: {
      enabled: true,
      realTimeAnalysis: true,
      behaviorAnalysis: true,
      machineLearning: true,
      threatIntelligence: {
        enabled: true,
        feeds: [
          {
            name: 'MISP',
            url: 'https://misp.internal.com/api',
            format: 'json',
            updateInterval: 60
          },
          {
            name: 'Commercial TI Feed',
            url: 'https://threatintel.provider.com/api',
            format: 'stix',
            updateInterval: 30
          }
        ]
      },
      responseAutomation: {
        enabled: true,
        maxAutomatedActions: 10,
        requireApproval: ['terminate_sandbox', 'block_user', 'isolate_network'],
        cooldownPeriod: 60
      }
    },
    audit: {
      enabled: true,
      logLevel: 'info',
      encryptLogs: true,
      integrityChecking: true,
      retentionPeriod: 2555, // 7 years
      remoteLogging: {
        enabled: true,
        endpoints: [
          {
            url: 'https://siem.internal.com/api/logs',
            method: 'POST',
            authentication: {
              type: 'bearer',
              credentials: {
                token: process.env.SIEM_TOKEN || ''
              }
            }
          }
        ]
      },
      compliance: {
        frameworks: ['SOX', 'SOC2', 'GDPR'],
        tamperEvident: true,
        digitalSignatures: true
      }
    },
    network: {
      zeroTrust: true,
      serviceMesh: {
        enabled: true,
        provider: 'istio',
        mtlsMode: 'STRICT',
        authorizationPolicy: 'DENY_ALL'
      },
      firewalls: {
        webApplicationFirewall: true,
        networkFirewall: true,
        dnsFiltering: true,
        ipAllowlist: [
          '10.0.0.0/8',
          '172.16.0.0/12',
          '192.168.0.0/16'
        ],
        ipBlocklist: [
          '0.0.0.0/8',
          '127.0.0.0/8',
          '169.254.0.0/16'
        ]
      }
    },
    compliance: {
      enabled: true,
      frameworks: ['SOC2', 'ISO27001', 'GDPR'],
      dataClassification: {
        enabled: true,
        levels: ['public', 'internal', 'confidential', 'restricted'],
        defaultLevel: 'internal'
      },
      dataResidency: {
        enforced: true,
        allowedRegions: ['us-east-1', 'us-west-2', 'eu-west-1'],
        defaultRegion: 'us-east-1'
      },
      rightsManagement: {
        dataSubjectRights: true,
        rightToBeDeleted: true,
        rightToPortability: true,
        consentManagement: true
      }
    },
    monitoring: {
      enabled: true,
      metricsCollection: true,
      distributedTracing: true,
      healthChecks: {
        enabled: true,
        interval: 15,
        timeout: 3
      },
      alerting: {
        enabled: true,
        channels: ['email', 'slack', 'pagerduty'],
        severityThresholds: {
          critical: true,
          high: true,
          medium: true,
          low: false
        }
      },
      dashboards: {
        enabled: true,
        provider: 'grafana',
        refreshInterval: 15
      }
    }
  }
};

// Configuration loader with validation
export class SecurityConfigManager {
  private static instance: SecurityConfigManager;
  private config: SecurityConfig;
  private environment: string;

  private constructor() {
    this.environment = process.env.NODE_ENV || 'development';
    this.config = this.loadConfig();
  }

  static getInstance(): SecurityConfigManager {
    if (!SecurityConfigManager.instance) {
      SecurityConfigManager.instance = new SecurityConfigManager();
    }
    return SecurityConfigManager.instance;
  }

  private loadConfig(): SecurityConfig {
    const baseConfig = SECURITY_CONFIGS[this.environment] || SECURITY_CONFIGS.development;
    
    // Override with environment variables
    const configOverrides = this.loadEnvironmentOverrides();
    const mergedConfig = this.mergeConfigs(baseConfig, configOverrides);
    
    // Validate configuration
    const validationResult = SecurityConfigSchema.safeParse(mergedConfig);
    if (!validationResult.success) {
      throw new Error(`Invalid security configuration: ${validationResult.error.message}`);
    }

    return validationResult.data;
  }

  private loadEnvironmentOverrides(): Partial<SecurityConfig> {
    const overrides: any = {};

    // JWT configuration from environment
    if (process.env.JWT_PRIVATE_KEY) {
      overrides.auth = {
        ...overrides.auth,
        jwt: {
          ...overrides.auth?.jwt,
          secretOrPrivateKey: process.env.JWT_PRIVATE_KEY
        }
      };
    }

    // Vault configuration from environment
    if (process.env.VAULT_URL) {
      overrides.secrets = {
        ...overrides.secrets,
        external: {
          vault: {
            url: process.env.VAULT_URL,
            token: process.env.VAULT_TOKEN,
            namespace: process.env.VAULT_NAMESPACE
          }
        }
      };
    }

    // Certificate paths from environment
    if (process.env.CA_CERT_PATH) {
      overrides.auth = {
        ...overrides.auth,
        mtls: {
          ...overrides.auth?.mtls,
          caPaths: {
            certificate: process.env.CA_CERT_PATH,
            privateKey: process.env.CA_KEY_PATH
          }
        }
      };
    }

    return overrides;
  }

  private mergeConfigs(base: SecurityConfig, overrides: Partial<SecurityConfig>): SecurityConfig {
    // Deep merge configuration objects
    return this.deepMerge(base, overrides) as SecurityConfig;
  }

  private deepMerge(target: any, source: any): any {
    if (!source) return target;
    
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  getConfig(): SecurityConfig {
    return this.config;
  }

  getEnvironment(): string {
    return this.environment;
  }

  // Get specific configuration sections
  getSandboxConfig() {
    return this.config.sandbox;
  }

  getAuthConfig() {
    return this.config.auth;
  }

  getSecretsConfig() {
    return this.config.secrets;
  }

  getScanningConfig() {
    return this.config.scanning;
  }

  getThreatDetectionConfig() {
    return this.config.threatDetection;
  }

  getAuditConfig() {
    return this.config.audit;
  }

  getNetworkConfig() {
    return this.config.network;
  }

  getComplianceConfig() {
    return this.config.compliance;
  }

  getMonitoringConfig() {
    return this.config.monitoring;
  }

  // Configuration validation methods
  validateConfiguration(): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate production requirements
    if (this.environment === 'production') {
      if (!this.config.auth.mtls.enabled) {
        errors.push('mTLS must be enabled in production');
      }

      if (!this.config.audit.encryptLogs) {
        errors.push('Audit log encryption must be enabled in production');
      }

      if (!this.config.network.zeroTrust) {
        warnings.push('Zero trust networking is recommended for production');
      }

      if (this.config.auth.jwt.algorithm === 'HS256') {
        warnings.push('Consider using RS256 algorithm for JWT in production');
      }

      if (this.config.sandbox.defaultIsolationLevel !== 'strict') {
        errors.push('Strict isolation level required in production');
      }
    }

    // Validate security settings consistency
    if (this.config.secrets.provider === 'vault' && !this.config.secrets.external.vault?.url) {
      errors.push('Vault URL required when using Vault as secrets provider');
    }

    if (this.config.threatDetection.enabled && !this.config.audit.enabled) {
      warnings.push('Audit logging should be enabled when threat detection is active');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Runtime configuration updates (for non-security critical settings)
  updateMonitoringConfig(updates: Partial<SecurityConfig['monitoring']>): void {
    this.config.monitoring = { ...this.config.monitoring, ...updates };
  }

  updateAlertingConfig(updates: Partial<SecurityConfig['monitoring']['alerting']>): void {
    this.config.monitoring.alerting = { ...this.config.monitoring.alerting, ...updates };
  }
}

// Export singleton instance
export const securityConfig = SecurityConfigManager.getInstance();

// Export configuration constants
export const SECURITY_CONSTANTS = {
  // Maximum values for security constraints
  MAX_SANDBOX_CPU: '4000m',
  MAX_SANDBOX_MEMORY: '8Gi',
  MAX_SANDBOX_STORAGE: '20Gi',
  MAX_SANDBOX_EXECUTION_TIME: 14400, // 4 hours
  MAX_CONCURRENT_SANDBOXES: 1000,
  
  // Cryptographic constants
  MIN_PASSWORD_LENGTH: 12,
  MIN_KEY_SIZE: 2048,
  MIN_CERTIFICATE_VALIDITY: 1, // 1 day
  MAX_CERTIFICATE_VALIDITY: 365, // 1 year
  
  // Audit and compliance
  MIN_AUDIT_RETENTION: 30, // days
  MAX_AUDIT_RETENTION: 2555, // 7 years
  REQUIRED_COMPLIANCE_FRAMEWORKS: ['SOC2'] as const,
  
  // Network security
  ALLOWED_TLS_VERSIONS: ['1.2', '1.3'] as const,
  SECURE_CIPHER_SUITES: [
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    'ECDHE-ECDSA-AES256-GCM-SHA384',
    'ECDHE-RSA-AES256-GCM-SHA384'
  ] as const,
  
  // Threat detection
  MAX_THREAT_SCORE: 100,
  CRITICAL_THREAT_THRESHOLD: 80,
  HIGH_THREAT_THRESHOLD: 60,
  MEDIUM_THREAT_THRESHOLD: 40,
  
  // Default timeouts and limits
  DEFAULT_SESSION_TIMEOUT: 1800, // 30 minutes
  DEFAULT_REQUEST_TIMEOUT: 30, // 30 seconds
  DEFAULT_HEALTH_CHECK_INTERVAL: 30, // 30 seconds
  DEFAULT_METRIC_COLLECTION_INTERVAL: 15 // 15 seconds
} as const;

export default SecurityConfigManager;