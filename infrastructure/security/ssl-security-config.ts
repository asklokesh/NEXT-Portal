/**
 * Enterprise SSL and Security Configuration
 * Comprehensive security setup with SSL/TLS, WAF, rate limiting, and security headers
 */

import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { Redis } from 'ioredis';
import winston from 'winston';
import { readFileSync } from 'fs';
import https from 'https';
import http from 'http';
import { EventEmitter } from 'events';

interface SecurityConfig {
  ssl: {
    enabled: boolean;
    port: number;
    certificatePath?: string;
    privateKeyPath?: string;
    caPath?: string;
    protocols: string[];
    ciphers: string[];
    dhparam?: string;
    hsts: {
      maxAge: number;
      includeSubDomains: boolean;
      preload: boolean;
    };
  };
  waf: {
    enabled: boolean;
    rules: WAFRule[];
    blocklist: {
      ips: string[];
      userAgents: string[];
      countries?: string[];
    };
    allowlist: {
      ips: string[];
      paths: string[];
    };
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
    skipFailedRequests: boolean;
    standardHeaders: boolean;
    legacyHeaders: boolean;
    store?: 'redis' | 'memory';
  };
  ddos: {
    burst: number;
    limit: number;
    maxconnections: number;
    maxcount: number;
    maxexpiry: number;
    checkinterval: number;
    trustProxy: boolean;
  };
  headers: {
    contentSecurityPolicy: {
      directives: Record<string, string[]>;
    };
    referrerPolicy: string;
    permissions: string[];
    crossOriginEmbedderPolicy: boolean;
    crossOriginOpenerPolicy: string;
    crossOriginResourcePolicy: string;
    originAgentCluster: boolean;
  };
  cors: {
    origins: string[];
    credentials: boolean;
    methods: string[];
    allowedHeaders: string[];
    exposedHeaders: string[];
    maxAge: number;
  };
  monitoring: {
    logSecurityEvents: boolean;
    alertOnSuspiciousActivity: boolean;
    metricsInterval: number;
  };
}

interface WAFRule {
  name: string;
  type: 'ip' | 'url' | 'header' | 'body' | 'sql_injection' | 'xss' | 'path_traversal' | 'command_injection';
  pattern: string | RegExp;
  action: 'block' | 'log' | 'rate_limit';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

interface SecurityMetrics {
  timestamp: Date;
  requests: {
    total: number;
    blocked: number;
    rateLimit: number;
    suspicious: number;
  };
  attacks: {
    sqlInjection: number;
    xss: number;
    pathTraversal: number;
    commandInjection: number;
    bruteForce: number;
  };
  sources: Record<string, number>; // IP -> count
  userAgents: Record<string, number>;
  countries: Record<string, number>;
}

interface SecurityIncident {
  id: string;
  timestamp: Date;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: {
    ip: string;
    userAgent?: string;
    country?: string;
  };
  details: any;
  blocked: boolean;
}

export class SecurityManager extends EventEmitter {
  private config: SecurityConfig;
  private logger: winston.Logger;
  private redis?: Redis;
  private metrics: SecurityMetrics[] = [];
  private incidents: SecurityIncident[] = [];
  private blockedIPs: Set<string> = new Set();
  private metricsInterval?: NodeJS.Timeout;

  constructor(config: SecurityConfig, redisClient?: Redis) {
    super();
    this.config = config;
    this.redis = redisClient;
    this.setupLogger();
  }

  private setupLogger() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'security-manager' },
      transports: [
        new winston.transports.File({ filename: 'logs/security-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/security-incidents.log' }),
        new winston.transports.Console()
      ],
    });
  }

  public configureExpress(app: express.Application): void {
    this.logger.info('Configuring Express security middleware');

    // Basic security headers
    app.use(helmet({
      contentSecurityPolicy: {
        directives: this.config.headers.contentSecurityPolicy.directives,
      },
      hsts: this.config.ssl.enabled ? {
        maxAge: this.config.ssl.hsts.maxAge,
        includeSubDomains: this.config.ssl.hsts.includeSubDomains,
        preload: this.config.ssl.hsts.preload,
      } : false,
      referrerPolicy: { policy: this.config.headers.referrerPolicy as any },
      crossOriginEmbedderPolicy: this.config.headers.crossOriginEmbedderPolicy,
      crossOriginOpenerPolicy: { policy: this.config.headers.crossOriginOpenerPolicy as any },
      crossOriginResourcePolicy: { policy: this.config.headers.crossOriginResourcePolicy as any },
      originAgentCluster: this.config.headers.originAgentCluster,
    }));

    // Additional security headers
    app.use((req, res, next) => {
      // Permissions Policy
      if (this.config.headers.permissions.length > 0) {
        res.setHeader('Permissions-Policy', this.config.headers.permissions.join(', '));
      }

      // Remove server header
      res.removeHeader('X-Powered-By');
      res.setHeader('Server', 'Enterprise-Portal');

      // Anti-clickjacking
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');

      next();
    });

    // CORS configuration
    app.use((req, res, next) => {
      const origin = req.headers.origin as string;
      
      if (this.config.cors.origins.includes('*') || this.config.cors.origins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
        res.setHeader('Access-Control-Allow-Credentials', this.config.cors.credentials.toString());
        res.setHeader('Access-Control-Allow-Methods', this.config.cors.methods.join(', '));
        res.setHeader('Access-Control-Allow-Headers', this.config.cors.allowedHeaders.join(', '));
        res.setHeader('Access-Control-Expose-Headers', this.config.cors.exposedHeaders.join(', '));
        res.setHeader('Access-Control-Max-Age', this.config.cors.maxAge.toString());
      }

      if (req.method === 'OPTIONS') {
        return res.status(204).end();
      }

      next();
    });

    // WAF middleware
    if (this.config.waf.enabled) {
      app.use(this.createWAFMiddleware());
    }

    // Rate limiting
    if (this.config.rateLimit.maxRequests > 0) {
      app.use(this.createRateLimitMiddleware());
    }

    // DDoS protection
    app.use(this.createDDoSProtectionMiddleware());

    // Request logging and monitoring
    if (this.config.monitoring.logSecurityEvents) {
      app.use(this.createSecurityLoggingMiddleware());
    }

    this.logger.info('Express security middleware configured');
  }

  private createWAFMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const clientIP = this.getClientIP(req);
      const userAgent = req.headers['user-agent'] || '';
      const url = req.url;
      const method = req.method;

      try {
        // Check IP blocklist
        if (this.config.waf.blocklist.ips.includes(clientIP) || this.blockedIPs.has(clientIP)) {
          await this.logSecurityIncident('ip_blocked', 'medium', clientIP, {
            url, method, userAgent
          }, true);
          return res.status(403).json({ error: 'Access denied' });
        }

        // Check IP allowlist
        if (this.config.waf.allowlist.ips.length > 0 && !this.config.waf.allowlist.ips.includes(clientIP)) {
          // If allowlist is configured, only allow listed IPs
          await this.logSecurityIncident('ip_not_whitelisted', 'high', clientIP, {
            url, method, userAgent
          }, true);
          return res.status(403).json({ error: 'Access denied' });
        }

        // Check User-Agent blocklist
        for (const blockedUA of this.config.waf.blocklist.userAgents) {
          if (userAgent.toLowerCase().includes(blockedUA.toLowerCase())) {
            await this.logSecurityIncident('user_agent_blocked', 'medium', clientIP, {
              url, method, userAgent, blockedUA
            }, true);
            return res.status(403).json({ error: 'Access denied' });
          }
        }

        // Apply WAF rules
        for (const rule of this.config.waf.rules) {
          if (await this.checkWAFRule(rule, req)) {
            await this.logSecurityIncident(rule.name, rule.severity, clientIP, {
              rule: rule.name,
              type: rule.type,
              url, method, userAgent,
              pattern: rule.pattern.toString()
            }, rule.action === 'block');

            if (rule.action === 'block') {
              // Add to temporary blocklist for repeat offenders
              if (rule.severity === 'high' || rule.severity === 'critical') {
                this.blockedIPs.add(clientIP);
                setTimeout(() => this.blockedIPs.delete(clientIP), 3600000); // 1 hour
              }
              return res.status(403).json({ error: 'Request blocked by WAF' });
            } else if (rule.action === 'rate_limit') {
              // Apply additional rate limiting
              // Implementation would depend on rate limiting strategy
            }
          }
        }

        next();

      } catch (error) {
        this.logger.error('WAF middleware error', { error: error.message, clientIP, url });
        next(); // Don't block requests due to WAF errors
      }
    };
  }

  private async checkWAFRule(rule: WAFRule, req: Request): Promise<boolean> {
    const clientIP = this.getClientIP(req);
    const userAgent = req.headers['user-agent'] || '';
    const url = req.url;
    const body = JSON.stringify(req.body || {});
    const headers = JSON.stringify(req.headers);

    switch (rule.type) {
      case 'ip':
        return this.matchPattern(rule.pattern, clientIP);
      
      case 'url':
        return this.matchPattern(rule.pattern, url);
      
      case 'header':
        return this.matchPattern(rule.pattern, headers);
      
      case 'body':
        return this.matchPattern(rule.pattern, body);
      
      case 'sql_injection':
        return this.detectSQLInjection(url + body);
      
      case 'xss':
        return this.detectXSS(url + body);
      
      case 'path_traversal':
        return this.detectPathTraversal(url);
      
      case 'command_injection':
        return this.detectCommandInjection(url + body);
      
      default:
        return false;
    }
  }

  private matchPattern(pattern: string | RegExp, text: string): boolean {
    if (pattern instanceof RegExp) {
      return pattern.test(text);
    }
    return text.includes(pattern);
  }

  private detectSQLInjection(text: string): boolean {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC)\b)/i,
      /(UNION\s+(ALL\s+)?SELECT)/i,
      /(;\s*(SELECT|INSERT|UPDATE|DELETE))/i,
      /(\'\s*(OR|AND)\s*\'\w*\'\s*=\s*\'\w*)/i,
      /(OR\s+1\s*=\s*1)/i,
      /(\'\s*OR\s*\'\w*\'\s*=\s*\'\w*)/i
    ];

    return sqlPatterns.some(pattern => pattern.test(text));
  }

  private detectXSS(text: string): boolean {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/i,
      /on\w+\s*=\s*['"][^'"]*['"]/i,
      /<iframe\b[^>]*>/i,
      /<object\b[^>]*>/i,
      /<embed\b[^>]*>/i,
      /eval\s*\(/i,
      /expression\s*\(/i
    ];

    return xssPatterns.some(pattern => pattern.test(text));
  }

  private detectPathTraversal(text: string): boolean {
    const pathTraversalPatterns = [
      /\.\.\//,
      /\.\.\\/,
      /%2e%2e%2f/i,
      /%2e%2e%5c/i,
      /\.\.%2f/i,
      /\.\.%5c/i
    ];

    return pathTraversalPatterns.some(pattern => pattern.test(text));
  }

  private detectCommandInjection(text: string): boolean {
    const commandPatterns = [
      /;\s*(ls|cat|pwd|whoami|id|uname)/i,
      /\|\s*(ls|cat|pwd|whoami|id|uname)/i,
      /&&\s*(ls|cat|pwd|whoami|id|uname)/i,
      /`[^`]*`/,
      /\$\([^)]*\)/,
      />\s*\/dev\/null/i,
      /2>&1/i
    ];

    return commandPatterns.some(pattern => pattern.test(text));
  }

  private createRateLimitMiddleware() {
    const store = this.redis ? new (require('rate-limit-redis'))({
      storeClient: this.redis,
      prefix: 'saas-idp:rate-limit:',
    }) : undefined;

    const limiter = rateLimit({
      windowMs: this.config.rateLimit.windowMs,
      max: this.config.rateLimit.maxRequests,
      standardHeaders: this.config.rateLimit.standardHeaders,
      legacyHeaders: this.config.rateLimit.legacyHeaders,
      skipSuccessfulRequests: this.config.rateLimit.skipSuccessfulRequests,
      skipFailedRequests: this.config.rateLimit.skipFailedRequests,
      store,
      keyGenerator: (req) => this.getClientIP(req),
      onLimitReached: async (req) => {
        const clientIP = this.getClientIP(req);
        await this.logSecurityIncident('rate_limit_exceeded', 'medium', clientIP, {
          url: req.url,
          method: req.method,
          userAgent: req.headers['user-agent']
        }, false);
      }
    });

    const speedLimiter = slowDown({
      windowMs: this.config.rateLimit.windowMs,
      delayAfter: Math.floor(this.config.rateLimit.maxRequests * 0.5), // Start slowing down at 50%
      delayMs: 500, // 500ms delay per request
      maxDelayMs: 20000, // Maximum delay of 20 seconds
      keyGenerator: (req) => this.getClientIP(req),
    });

    return [speedLimiter, limiter];
  }

  private createDDoSProtectionMiddleware() {
    const connections = new Map<string, { count: number; lastSeen: number }>();

    return (req: Request, res: Response, next: NextFunction) => {
      const clientIP = this.getClientIP(req);
      const now = Date.now();

      // Clean old connections
      for (const [ip, data] of connections) {
        if (now - data.lastSeen > this.config.ddos.maxexpiry) {
          connections.delete(ip);
        }
      }

      const connectionData = connections.get(clientIP) || { count: 0, lastSeen: now };
      
      if (now - connectionData.lastSeen < this.config.ddos.checkinterval) {
        connectionData.count++;
      } else {
        connectionData.count = 1;
      }
      
      connectionData.lastSeen = now;
      connections.set(clientIP, connectionData);

      if (connectionData.count > this.config.ddos.maxconnections) {
        this.logSecurityIncident('ddos_protection', 'high', clientIP, {
          connections: connectionData.count,
          url: req.url,
          method: req.method
        }, true);

        return res.status(429).json({ 
          error: 'Too many connections',
          retryAfter: Math.ceil(this.config.ddos.checkinterval / 1000)
        });
      }

      next();
    };
  }

  private createSecurityLoggingMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      const clientIP = this.getClientIP(req);

      res.on('finish', () => {
        const duration = Date.now() - start;
        const logData = {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          clientIP,
          userAgent: req.headers['user-agent'],
          referer: req.headers.referer,
          duration,
          contentLength: res.get('content-length'),
          timestamp: new Date().toISOString()
        };

        // Log suspicious activities
        if (res.statusCode >= 400 || duration > 10000) {
          this.logger.warn('Suspicious request', logData);
        } else {
          this.logger.info('Request processed', logData);
        }
      });

      next();
    };
  }

  private getClientIP(req: Request): string {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] as string ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           'unknown';
  }

  private async logSecurityIncident(
    type: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    sourceIP: string,
    details: any,
    blocked: boolean
  ): Promise<void> {
    const incident: SecurityIncident = {
      id: `incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      type,
      severity,
      source: {
        ip: sourceIP,
        userAgent: details.userAgent,
        country: details.country
      },
      details,
      blocked
    };

    this.incidents.push(incident);

    // Keep only last 1000 incidents
    if (this.incidents.length > 1000) {
      this.incidents = this.incidents.slice(-1000);
    }

    // Log to file
    this.logger.warn('Security incident', incident);

    // Store in Redis if available
    if (this.redis) {
      await this.redis.zadd('security:incidents', Date.now(), JSON.stringify(incident));
      // Keep only last 24 hours
      await this.redis.zremrangebyscore('security:incidents', 0, Date.now() - 86400000);
    }

    // Emit event for real-time monitoring
    this.emit('incident', incident);

    // Alert on critical incidents
    if (severity === 'critical' && this.config.monitoring.alertOnSuspiciousActivity) {
      this.emit('criticalIncident', incident);
    }
  }

  public createHTTPSServer(app: express.Application): https.Server | null {
    if (!this.config.ssl.enabled) {
      return null;
    }

    try {
      const options: https.ServerOptions = {
        cert: readFileSync(this.config.ssl.certificatePath!),
        key: readFileSync(this.config.ssl.privateKeyPath!),
        secureProtocol: 'TLS_method',
        secureOptions: require('constants').SSL_OP_NO_SSLv2 | require('constants').SSL_OP_NO_SSLv3,
        ciphers: this.config.ssl.ciphers.join(':'),
        honorCipherOrder: true,
      };

      if (this.config.ssl.caPath) {
        options.ca = readFileSync(this.config.ssl.caPath);
      }

      if (this.config.ssl.dhparam) {
        options.dhparam = readFileSync(this.config.ssl.dhparam);
      }

      const server = https.createServer(options, app);

      server.on('secureConnection', (tlsSocket) => {
        this.logger.debug('Secure connection established', {
          protocol: tlsSocket.getProtocol(),
          cipher: tlsSocket.getCipher(),
          clientIP: tlsSocket.remoteAddress
        });
      });

      server.on('tlsClientError', (err, tlsSocket) => {
        this.logger.error('TLS client error', {
          error: err.message,
          clientIP: tlsSocket.remoteAddress
        });
      });

      return server;

    } catch (error) {
      this.logger.error('Failed to create HTTPS server', { error: error.message });
      throw error;
    }
  }

  public startMonitoring(): void {
    if (this.config.monitoring.metricsInterval > 0) {
      this.metricsInterval = setInterval(() => {
        this.collectSecurityMetrics();
      }, this.config.monitoring.metricsInterval);
    }
  }

  public stopMonitoring(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
  }

  private collectSecurityMetrics(): void {
    // This would collect metrics from various sources
    // Implementation depends on monitoring requirements
    
    const metrics: SecurityMetrics = {
      timestamp: new Date(),
      requests: {
        total: 0,
        blocked: 0,
        rateLimit: 0,
        suspicious: 0
      },
      attacks: {
        sqlInjection: 0,
        xss: 0,
        pathTraversal: 0,
        commandInjection: 0,
        bruteForce: 0
      },
      sources: {},
      userAgents: {},
      countries: {}
    };

    // Calculate metrics from incidents
    const recentIncidents = this.incidents.filter(i => 
      Date.now() - i.timestamp.getTime() < this.config.monitoring.metricsInterval
    );

    recentIncidents.forEach(incident => {
      if (incident.blocked) {
        metrics.requests.blocked++;
      }
      
      const sourceIP = incident.source.ip;
      metrics.sources[sourceIP] = (metrics.sources[sourceIP] || 0) + 1;

      if (incident.source.userAgent) {
        const ua = incident.source.userAgent;
        metrics.userAgents[ua] = (metrics.userAgents[ua] || 0) + 1;
      }

      // Count attack types
      switch (incident.type) {
        case 'sql_injection':
          metrics.attacks.sqlInjection++;
          break;
        case 'xss':
          metrics.attacks.xss++;
          break;
        case 'path_traversal':
          metrics.attacks.pathTraversal++;
          break;
        case 'command_injection':
          metrics.attacks.commandInjection++;
          break;
      }
    });

    this.metrics.push(metrics);
    
    // Keep only last 24 hours
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    this.metrics = this.metrics.filter(m => m.timestamp.getTime() > oneDayAgo);

    this.emit('metrics', metrics);
  }

  // Public methods for monitoring and management
  public getSecurityMetrics(): SecurityMetrics | null {
    return this.metrics[this.metrics.length - 1] || null;
  }

  public getRecentIncidents(hours: number = 1): SecurityIncident[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return this.incidents.filter(i => i.timestamp.getTime() > cutoff);
  }

  public blockIP(ip: string, duration: number = 3600000): void {
    this.blockedIPs.add(ip);
    setTimeout(() => this.blockedIPs.delete(ip), duration);
    this.logger.info('IP blocked', { ip, duration });
  }

  public unblockIP(ip: string): void {
    this.blockedIPs.delete(ip);
    this.logger.info('IP unblocked', { ip });
  }

  public getBlockedIPs(): string[] {
    return Array.from(this.blockedIPs);
  }

  public async getSecurityStatus() {
    const recentIncidents = this.getRecentIncidents(1); // Last hour
    const criticalIncidents = recentIncidents.filter(i => i.severity === 'critical');
    const blockedRequests = recentIncidents.filter(i => i.blocked).length;

    return {
      status: criticalIncidents.length > 0 ? 'critical' : 
              recentIncidents.length > 10 ? 'warning' : 'healthy',
      blockedIPs: this.blockedIPs.size,
      recentIncidents: recentIncidents.length,
      criticalIncidents: criticalIncidents.length,
      blockedRequests,
      ssl: this.config.ssl.enabled,
      waf: this.config.waf.enabled
    };
  }
}

// Default security configuration factory
export function createSecurityConfig(): SecurityConfig {
  return {
    ssl: {
      enabled: process.env.SSL_ENABLED === 'true',
      port: parseInt(process.env.SSL_PORT || '443'),
      certificatePath: process.env.SSL_CERT_PATH,
      privateKeyPath: process.env.SSL_KEY_PATH,
      caPath: process.env.SSL_CA_PATH,
      protocols: ['TLSv1.2', 'TLSv1.3'],
      ciphers: [
        'ECDHE-RSA-AES128-GCM-SHA256',
        'ECDHE-RSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES128-SHA256',
        'ECDHE-RSA-AES256-SHA384'
      ],
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
    },
    waf: {
      enabled: process.env.WAF_ENABLED !== 'false',
      rules: [
        {
          name: 'sql_injection',
          type: 'sql_injection',
          pattern: '',
          action: 'block',
          severity: 'high',
          description: 'Detect SQL injection attempts'
        },
        {
          name: 'xss_attacks',
          type: 'xss',
          pattern: '',
          action: 'block',
          severity: 'high',
          description: 'Detect XSS attacks'
        },
        {
          name: 'path_traversal',
          type: 'path_traversal',
          pattern: '',
          action: 'block',
          severity: 'medium',
          description: 'Detect path traversal attempts'
        }
      ],
      blocklist: {
        ips: (process.env.WAF_BLOCKED_IPS || '').split(',').filter(Boolean),
        userAgents: ['bot', 'crawler', 'scanner'],
        countries: process.env.WAF_BLOCKED_COUNTRIES?.split(','),
      },
      allowlist: {
        ips: (process.env.WAF_ALLOWED_IPS || '').split(',').filter(Boolean),
        paths: ['/health', '/metrics', '/api/health'],
      },
    },
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100'),
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      standardHeaders: true,
      legacyHeaders: false,
      store: process.env.REDIS_URL ? 'redis' : 'memory',
    },
    ddos: {
      burst: parseInt(process.env.DDOS_BURST || '10'),
      limit: parseInt(process.env.DDOS_LIMIT || '15'),
      maxconnections: parseInt(process.env.DDOS_MAX_CONNECTIONS || '50'),
      maxcount: parseInt(process.env.DDOS_MAX_COUNT || '300'),
      maxexpiry: parseInt(process.env.DDOS_MAX_EXPIRY || '600000'),
      checkinterval: parseInt(process.env.DDOS_CHECK_INTERVAL || '1000'),
      trustProxy: process.env.TRUST_PROXY === 'true',
    },
    headers: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https:'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
          imgSrc: ["'self'", 'data:', 'https:'],
          fontSrc: ["'self'", 'https:'],
          connectSrc: ["'self'", 'https:', 'wss:'],
          mediaSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'self'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      referrerPolicy: 'strict-origin-when-cross-origin',
      permissions: [
        'camera=()',
        'microphone=()',
        'geolocation=()',
        'notifications=(self)',
      ],
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: 'same-origin',
      crossOriginResourcePolicy: 'cross-origin',
      originAgentCluster: true,
    },
    cors: {
      origins: (process.env.CORS_ORIGINS || '').split(',').filter(Boolean),
      credentials: process.env.CORS_CREDENTIALS === 'true',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
      exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
      maxAge: 86400, // 24 hours
    },
    monitoring: {
      logSecurityEvents: process.env.LOG_SECURITY_EVENTS !== 'false',
      alertOnSuspiciousActivity: process.env.ALERT_ON_SUSPICIOUS_ACTIVITY === 'true',
      metricsInterval: parseInt(process.env.SECURITY_METRICS_INTERVAL || '60000'),
    },
  };
}