import { Redis } from 'ioredis';
import { z } from 'zod';
import crypto from 'crypto';

export interface SecurityPolicy {
  id: string;
  name: string;
  enabled: boolean;
  type: 'cors' | 'csrf' | 'waf' | 'rate_limiting' | 'ip_restriction' | 'content_filtering';
  configuration: Record<string, any>;
  appliesTo: {
    services?: string[];
    routes?: string[];
    consumers?: string[];
    global?: boolean;
  };
  priority: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CORSConfig {
  origins: string[];
  methods: string[];
  headers: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge: number;
  optionsSuccessStatus: number;
  preflightContinue: boolean;
}

export interface CSRFConfig {
  tokenSecret: string;
  cookieName: string;
  headerName: string;
  cookieOptions: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
    maxAge: number;
  };
  ignoredMethods: string[];
  skipDomainVerification: boolean;
}

export interface WAFConfig {
  mode: 'block' | 'monitor' | 'challenge';
  rulesets: string[];
  customRules: WAFRule[];
  thresholds: {
    sqlInjection: number;
    xss: number;
    rce: number;
    lfi: number;
  };
  logLevel: 'none' | 'minimal' | 'detailed';
  blockingResponse: {
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  };
}

export interface WAFRule {
  id: string;
  name: string;
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  pattern: string;
  patternType: 'regex' | 'contains' | 'equals' | 'starts_with' | 'ends_with';
  field: 'uri' | 'body' | 'headers' | 'query' | 'all';
  action: 'block' | 'log' | 'challenge';
  description: string;
}

export interface IPRestrictionConfig {
  whitelist: string[];
  blacklist: string[];
  defaultAction: 'allow' | 'deny';
  trustProxy: boolean;
  message: string;
}

export interface ContentFilteringConfig {
  maxBodySize: number;
  allowedContentTypes: string[];
  blockedContentTypes: string[];
  scanUploads: boolean;
  virusScanning: {
    enabled: boolean;
    provider: string;
    apiKey: string;
  };
  malwareDetection: {
    enabled: boolean;
    patterns: string[];
  };
}

export interface SecurityEvent {
  id: string;
  timestamp: Date;
  type: 'policy_violation' | 'attack_detected' | 'suspicious_activity' | 'access_denied';
  severity: 'low' | 'medium' | 'high' | 'critical';
  sourceIp: string;
  userAgent?: string;
  requestId: string;
  policyId?: string;
  ruleId?: string;
  details: {
    uri: string;
    method: string;
    headers: Record<string, string>;
    blocked: boolean;
    action: string;
    message: string;
  };
}

const SecurityPolicySchema = z.object({
  name: z.string().min(1),
  enabled: z.boolean().default(true),
  type: z.enum(['cors', 'csrf', 'waf', 'rate_limiting', 'ip_restriction', 'content_filtering']),
  configuration: z.record(z.any()),
  appliesTo: z.object({
    services: z.array(z.string()).optional(),
    routes: z.array(z.string()).optional(),
    consumers: z.array(z.string()).optional(),
    global: z.boolean().optional(),
  }),
  priority: z.number().default(0),
  tags: z.array(z.string()).default([]),
});

export class SecurityManager {
  private redis: Redis;
  private policies: Map<string, SecurityPolicy> = new Map();
  private csrfTokens: Map<string, { token: string; expires: number }> = new Map();

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Create a new security policy
   */
  async createSecurityPolicy(policyData: z.infer<typeof SecurityPolicySchema>): Promise<SecurityPolicy> {
    const validatedData = SecurityPolicySchema.parse(policyData);
    
    const policy: SecurityPolicy = {
      id: `policy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...validatedData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Validate configuration based on policy type
    await this.validatePolicyConfiguration(policy);

    // Store policy
    await this.storeSecurityPolicy(policy);
    this.policies.set(policy.id, policy);

    return policy;
  }

  /**
   * Update security policy
   */
  async updateSecurityPolicy(policyId: string, updates: Partial<z.infer<typeof SecurityPolicySchema>>): Promise<SecurityPolicy> {
    const existingPolicy = this.policies.get(policyId);
    if (!existingPolicy) {
      throw new Error(`Security policy ${policyId} not found`);
    }

    const updatedPolicy: SecurityPolicy = {
      ...existingPolicy,
      ...updates,
      updatedAt: new Date(),
    };

    await this.validatePolicyConfiguration(updatedPolicy);
    await this.storeSecurityPolicy(updatedPolicy);
    this.policies.set(policyId, updatedPolicy);

    return updatedPolicy;
  }

  /**
   * Delete security policy
   */
  async deleteSecurityPolicy(policyId: string): Promise<void> {
    await this.redis.del(`security_policy:${policyId}`);
    this.policies.delete(policyId);
  }

  /**
   * Get all security policies
   */
  async getSecurityPolicies(): Promise<SecurityPolicy[]> {
    const policies = Array.from(this.policies.values());
    return policies.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Apply CORS policy
   */
  applyCORSPolicy(config: CORSConfig) {
    return (req: any, res: any, next: any) => {
      const origin = req.headers.origin;
      const method = req.method;

      // Check if origin is allowed
      const isOriginAllowed = config.origins.includes('*') || 
                             config.origins.includes(origin) ||
                             config.origins.some(allowed => {
                               if (allowed.includes('*')) {
                                 const regex = new RegExp(allowed.replace(/\*/g, '.*'));
                                 return regex.test(origin);
                               }
                               return false;
                             });

      if (isOriginAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
      }

      // Set other CORS headers
      res.setHeader('Access-Control-Allow-Methods', config.methods.join(', '));
      res.setHeader('Access-Control-Allow-Headers', config.headers.join(', '));
      
      if (config.exposedHeaders.length > 0) {
        res.setHeader('Access-Control-Expose-Headers', config.exposedHeaders.join(', '));
      }
      
      if (config.credentials) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
      
      if (config.maxAge > 0) {
        res.setHeader('Access-Control-Max-Age', config.maxAge.toString());
      }

      // Handle preflight requests
      if (method === 'OPTIONS') {
        res.status(config.optionsSuccessStatus || 204);
        if (!config.preflightContinue) {
          return res.end();
        }
      }

      next();
    };
  }

  /**
   * Generate CSRF token
   */
  generateCSRFToken(sessionId: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + (60 * 60 * 1000); // 1 hour
    
    this.csrfTokens.set(sessionId, { token, expires });
    
    // Also store in Redis for distributed systems
    this.redis.setex(`csrf_token:${sessionId}`, 3600, token);
    
    return token;
  }

  /**
   * Verify CSRF token
   */
  async verifyCSRFToken(sessionId: string, token: string): Promise<boolean> {
    // Check in-memory cache first
    const cachedToken = this.csrfTokens.get(sessionId);
    if (cachedToken && cachedToken.expires > Date.now()) {
      return cachedToken.token === token;
    }

    // Check Redis
    const redisToken = await this.redis.get(`csrf_token:${sessionId}`);
    return redisToken === token;
  }

  /**
   * Apply CSRF protection
   */
  applyCSRFProtection(config: CSRFConfig) {
    return async (req: any, res: any, next: any) => {
      const method = req.method.toLowerCase();
      
      // Skip CSRF for ignored methods (typically GET, HEAD, OPTIONS)
      if (config.ignoredMethods.includes(method)) {
        return next();
      }

      const sessionId = req.sessionId || req.session?.id;
      if (!sessionId) {
        return res.status(403).json({ error: 'Session required for CSRF protection' });
      }

      const token = req.headers[config.headerName.toLowerCase()] || 
                   req.body?._csrf || 
                   req.query?._csrf;

      if (!token) {
        return res.status(403).json({ error: 'CSRF token required' });
      }

      const isValid = await this.verifyCSRFToken(sessionId, token);
      if (!isValid) {
        await this.recordSecurityEvent({
          type: 'policy_violation',
          severity: 'medium',
          sourceIp: req.ip,
          userAgent: req.headers['user-agent'],
          requestId: req.requestId,
          details: {
            uri: req.originalUrl,
            method: req.method,
            headers: req.headers,
            blocked: true,
            action: 'csrf_token_invalid',
            message: 'Invalid CSRF token',
          },
        });

        return res.status(403).json({ error: 'Invalid CSRF token' });
      }

      next();
    };
  }

  /**
   * Apply WAF protection
   */
  applyWAFProtection(config: WAFConfig) {
    return async (req: any, res: any, next: any) => {
      const violations: Array<{ rule: WAFRule; field: string; value: string }> = [];

      // Check custom rules
      for (const rule of config.customRules) {
        if (!rule.enabled) continue;

        const fieldValue = this.extractFieldValue(req, rule.field);
        if (this.matchesPattern(fieldValue, rule.pattern, rule.patternType)) {
          violations.push({ rule, field: rule.field, value: fieldValue });
        }
      }

      // Apply built-in security checks
      await this.applyBuiltinSecurityChecks(req, violations);

      if (violations.length > 0) {
        const highestSeverity = this.getHighestSeverity(violations.map(v => v.rule.severity));
        const shouldBlock = config.mode === 'block' || 
                           (config.mode === 'challenge' && highestSeverity === 'critical');

        await this.recordSecurityEvent({
          type: 'attack_detected',
          severity: highestSeverity,
          sourceIp: req.ip,
          userAgent: req.headers['user-agent'],
          requestId: req.requestId,
          details: {
            uri: req.originalUrl,
            method: req.method,
            headers: req.headers,
            blocked: shouldBlock,
            action: shouldBlock ? 'blocked' : 'logged',
            message: `WAF violations detected: ${violations.map(v => v.rule.name).join(', ')}`,
          },
        });

        if (shouldBlock) {
          return res.status(config.blockingResponse.statusCode)
                   .set(config.blockingResponse.headers)
                   .send(config.blockingResponse.body);
        }
      }

      next();
    };
  }

  /**
   * Apply IP restriction
   */
  applyIPRestriction(config: IPRestrictionConfig) {
    return (req: any, res: any, next: any) => {
      const clientIP = this.getClientIP(req, config.trustProxy);
      
      // Check blacklist first
      if (config.blacklist.length > 0 && this.isIPInList(clientIP, config.blacklist)) {
        this.recordSecurityEvent({
          type: 'access_denied',
          severity: 'medium',
          sourceIp: clientIP,
          userAgent: req.headers['user-agent'],
          requestId: req.requestId,
          details: {
            uri: req.originalUrl,
            method: req.method,
            headers: req.headers,
            blocked: true,
            action: 'ip_blacklisted',
            message: 'IP address is blacklisted',
          },
        });

        return res.status(403).json({ error: config.message || 'Access denied' });
      }

      // Check whitelist
      if (config.whitelist.length > 0) {
        const isAllowed = this.isIPInList(clientIP, config.whitelist);
        
        if (!isAllowed) {
          this.recordSecurityEvent({
            type: 'access_denied',
            severity: 'medium',
            sourceIp: clientIP,
            userAgent: req.headers['user-agent'],
            requestId: req.requestId,
            details: {
              uri: req.originalUrl,
              method: req.method,
              headers: req.headers,
              blocked: true,
              action: 'ip_not_whitelisted',
              message: 'IP address not in whitelist',
            },
          });

          return res.status(403).json({ error: config.message || 'Access denied' });
        }
      } else if (config.defaultAction === 'deny') {
        // Default deny with no whitelist
        this.recordSecurityEvent({
          type: 'access_denied',
          severity: 'low',
          sourceIp: clientIP,
          userAgent: req.headers['user-agent'],
          requestId: req.requestId,
          details: {
            uri: req.originalUrl,
            method: req.method,
            headers: req.headers,
            blocked: true,
            action: 'default_deny',
            message: 'Default deny policy',
          },
        });

        return res.status(403).json({ error: config.message || 'Access denied' });
      }

      next();
    };
  }

  /**
   * Apply content filtering
   */
  applyContentFiltering(config: ContentFilteringConfig) {
    return async (req: any, res: any, next: any) => {
      // Check content type
      const contentType = req.headers['content-type'];
      
      if (contentType) {
        const baseContentType = contentType.split(';')[0].trim();
        
        if (config.blockedContentTypes.includes(baseContentType)) {
          await this.recordSecurityEvent({
            type: 'policy_violation',
            severity: 'medium',
            sourceIp: req.ip,
            userAgent: req.headers['user-agent'],
            requestId: req.requestId,
            details: {
              uri: req.originalUrl,
              method: req.method,
              headers: req.headers,
              blocked: true,
              action: 'blocked_content_type',
              message: `Blocked content type: ${baseContentType}`,
            },
          });

          return res.status(415).json({ error: 'Unsupported media type' });
        }

        if (config.allowedContentTypes.length > 0 && 
            !config.allowedContentTypes.includes(baseContentType)) {
          await this.recordSecurityEvent({
            type: 'policy_violation',
            severity: 'low',
            sourceIp: req.ip,
            userAgent: req.headers['user-agent'],
            requestId: req.requestId,
            details: {
              uri: req.originalUrl,
              method: req.method,
              headers: req.headers,
              blocked: true,
              action: 'content_type_not_allowed',
              message: `Content type not allowed: ${baseContentType}`,
            },
          });

          return res.status(415).json({ error: 'Content type not allowed' });
        }
      }

      // Check body size
      const contentLength = parseInt(req.headers['content-length'] || '0');
      if (contentLength > config.maxBodySize) {
        await this.recordSecurityEvent({
          type: 'policy_violation',
          severity: 'medium',
          sourceIp: req.ip,
          userAgent: req.headers['user-agent'],
          requestId: req.requestId,
          details: {
            uri: req.originalUrl,
            method: req.method,
            headers: req.headers,
            blocked: true,
            action: 'body_size_exceeded',
            message: `Body size ${contentLength} exceeds limit ${config.maxBodySize}`,
          },
        });

        return res.status(413).json({ error: 'Payload too large' });
      }

      next();
    };
  }

  /**
   * Get security events
   */
  async getSecurityEvents(filters: {
    startTime?: Date;
    endTime?: Date;
    severity?: string;
    type?: string;
    sourceIp?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<SecurityEvent[]> {
    const { startTime, endTime, limit = 100, offset = 0 } = filters;
    const start = startTime ? startTime.getTime() : 0;
    const end = endTime ? endTime.getTime() : Date.now();

    const events = await this.redis.zrangebyscore(
      'security_events',
      start,
      end,
      'LIMIT',
      offset,
      limit
    );

    return events.map(eventData => {
      const event = JSON.parse(eventData);
      return {
        ...event,
        timestamp: new Date(event.timestamp),
      };
    }).filter(event => {
      if (filters.severity && event.severity !== filters.severity) return false;
      if (filters.type && event.type !== filters.type) return false;
      if (filters.sourceIp && event.sourceIp !== filters.sourceIp) return false;
      return true;
    });
  }

  /**
   * Record security event
   */
  private async recordSecurityEvent(eventData: Omit<SecurityEvent, 'id' | 'timestamp'>): Promise<void> {
    const event: SecurityEvent = {
      id: `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...eventData,
    };

    // Store in Redis sorted set by timestamp
    await this.redis.zadd(
      'security_events',
      event.timestamp.getTime(),
      JSON.stringify(event)
    );

    // Clean up old events (keep 30 days)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    await this.redis.zremrangebyscore('security_events', '-inf', thirtyDaysAgo);

    // Log to console for immediate visibility
    console.log(`Security Event [${event.severity.toUpperCase()}]: ${event.details.message}`);
  }

  /**
   * Helper methods
   */
  private async validatePolicyConfiguration(policy: SecurityPolicy): Promise<void> {
    switch (policy.type) {
      case 'cors':
        this.validateCORSConfig(policy.configuration as CORSConfig);
        break;
      case 'csrf':
        this.validateCSRFConfig(policy.configuration as CSRFConfig);
        break;
      case 'waf':
        this.validateWAFConfig(policy.configuration as WAFConfig);
        break;
      case 'ip_restriction':
        this.validateIPRestrictionConfig(policy.configuration as IPRestrictionConfig);
        break;
      case 'content_filtering':
        this.validateContentFilteringConfig(policy.configuration as ContentFilteringConfig);
        break;
    }
  }

  private validateCORSConfig(config: CORSConfig): void {
    if (!Array.isArray(config.origins) || config.origins.length === 0) {
      throw new Error('CORS origins must be a non-empty array');
    }
    if (!Array.isArray(config.methods) || config.methods.length === 0) {
      throw new Error('CORS methods must be a non-empty array');
    }
  }

  private validateCSRFConfig(config: CSRFConfig): void {
    if (!config.tokenSecret || config.tokenSecret.length < 32) {
      throw new Error('CSRF token secret must be at least 32 characters');
    }
  }

  private validateWAFConfig(config: WAFConfig): void {
    if (!['block', 'monitor', 'challenge'].includes(config.mode)) {
      throw new Error('WAF mode must be block, monitor, or challenge');
    }
  }

  private validateIPRestrictionConfig(config: IPRestrictionConfig): void {
    // Validate IP addresses/ranges in lists
    // Implementation would include IP validation logic
  }

  private validateContentFilteringConfig(config: ContentFilteringConfig): void {
    if (config.maxBodySize <= 0) {
      throw new Error('Max body size must be positive');
    }
  }

  private extractFieldValue(req: any, field: string): string {
    switch (field) {
      case 'uri':
        return req.originalUrl || req.url;
      case 'body':
        return JSON.stringify(req.body || {});
      case 'headers':
        return JSON.stringify(req.headers);
      case 'query':
        return JSON.stringify(req.query || {});
      case 'all':
        return JSON.stringify({ uri: req.originalUrl, body: req.body, headers: req.headers, query: req.query });
      default:
        return '';
    }
  }

  private matchesPattern(value: string, pattern: string, type: string): boolean {
    switch (type) {
      case 'regex':
        try {
          return new RegExp(pattern, 'i').test(value);
        } catch {
          return false;
        }
      case 'contains':
        return value.toLowerCase().includes(pattern.toLowerCase());
      case 'equals':
        return value.toLowerCase() === pattern.toLowerCase();
      case 'starts_with':
        return value.toLowerCase().startsWith(pattern.toLowerCase());
      case 'ends_with':
        return value.toLowerCase().endsWith(pattern.toLowerCase());
      default:
        return false;
    }
  }

  private async applyBuiltinSecurityChecks(req: any, violations: any[]): Promise<void> {
    const value = this.extractFieldValue(req, 'all').toLowerCase();
    
    // SQL Injection patterns
    const sqlPatterns = [
      /union\s+select/i,
      /drop\s+table/i,
      /insert\s+into/i,
      /delete\s+from/i,
      /update\s+.*set/i,
      /'.*or.*'/i,
      /--/,
      /\/\*.*\*\//,
    ];

    // XSS patterns
    const xssPatterns = [
      /<script[\s\S]*?>[\s\S]*?<\/script>/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
    ];

    // Check for SQL injection
    for (const pattern of sqlPatterns) {
      if (pattern.test(value)) {
        violations.push({
          rule: {
            id: 'builtin-sql-injection',
            name: 'SQL Injection Detection',
            severity: 'high' as const,
            pattern: pattern.source,
            patternType: 'regex' as const,
            field: 'all' as const,
            action: 'block' as const,
            description: 'Potential SQL injection detected',
            enabled: true,
          },
          field: 'all',
          value: value.substring(0, 100),
        });
        break;
      }
    }

    // Check for XSS
    for (const pattern of xssPatterns) {
      if (pattern.test(value)) {
        violations.push({
          rule: {
            id: 'builtin-xss',
            name: 'XSS Detection',
            severity: 'high' as const,
            pattern: pattern.source,
            patternType: 'regex' as const,
            field: 'all' as const,
            action: 'block' as const,
            description: 'Potential XSS attack detected',
            enabled: true,
          },
          field: 'all',
          value: value.substring(0, 100),
        });
        break;
      }
    }
  }

  private getHighestSeverity(severities: string[]): 'low' | 'medium' | 'high' | 'critical' {
    if (severities.includes('critical')) return 'critical';
    if (severities.includes('high')) return 'high';
    if (severities.includes('medium')) return 'medium';
    return 'low';
  }

  private getClientIP(req: any, trustProxy: boolean): string {
    if (trustProxy) {
      return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
             req.headers['x-real-ip'] ||
             req.connection?.remoteAddress ||
             req.socket?.remoteAddress ||
             req.ip;
    }
    return req.connection?.remoteAddress || req.socket?.remoteAddress || req.ip;
  }

  private isIPInList(ip: string, list: string[]): boolean {
    return list.some(item => {
      if (item.includes('/')) {
        // CIDR notation - would need proper CIDR matching library
        return false; // Simplified for this example
      }
      return item === ip;
    });
  }

  private async storeSecurityPolicy(policy: SecurityPolicy): Promise<void> {
    await this.redis.hset(
      `security_policy:${policy.id}`,
      'data',
      JSON.stringify({
        ...policy,
        createdAt: policy.createdAt.toISOString(),
        updatedAt: policy.updatedAt.toISOString(),
      })
    );
  }

  /**
   * Load all security policies from Redis
   */
  async loadSecurityPolicies(): Promise<void> {
    const keys = await this.redis.keys('security_policy:*');
    
    for (const key of keys) {
      const data = await this.redis.hget(key, 'data');
      if (data) {
        const policy = JSON.parse(data);
        this.policies.set(policy.id, {
          ...policy,
          createdAt: new Date(policy.createdAt),
          updatedAt: new Date(policy.updatedAt),
        });
      }
    }
  }
}