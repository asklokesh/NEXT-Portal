/**
 * Error Tracking and Alerting System
 * Monitors application errors and sends alerts for critical issues
 */

export interface ErrorEvent {
  id: string;
  message: string;
  stack?: string;
  url?: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: 'client' | 'server' | 'api';
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: {
    errorPattern?: string;
    severity?: ErrorEvent['severity'];
    frequency?: {
      count: number;
      timeWindow: number; // in minutes
    };
  };
  actions: AlertAction[];
  enabled: boolean;
}

export interface AlertAction {
  type: 'email' | 'slack' | 'webhook' | 'log';
  config: Record<string, any>;
}

class ErrorTracker {
  private errors: ErrorEvent[] = [];
  private alertRules: AlertRule[] = [];
  private maxErrors = 1000; // Keep last 1000 errors in memory

  constructor() {
    this.initializeDefaultRules();
    
    // Set up periodic cleanup
    setInterval(() => {
      this.cleanupOldErrors();
    }, 60000); // Every minute
  }

  /**
   * Track an error event
   */
  track(error: Omit<ErrorEvent, 'id' | 'timestamp'>): string {
    const errorEvent: ErrorEvent = {
      ...error,
      id: this.generateId(),
      timestamp: new Date(),
    };

    this.errors.unshift(errorEvent);
    
    // Keep only recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors);
    }

    // Process alert rules
    this.processAlerts(errorEvent);

    // Log the error
    this.logError(errorEvent);

    return errorEvent.id;
  }

  /**
   * Track JavaScript errors from the client
   */
  trackClientError(
    message: string,
    source?: string,
    lineno?: number,
    colno?: number,
    error?: Error,
    userId?: string,
    sessionId?: string
  ): string {
    return this.track({
      message,
      stack: error?.stack,
      url: source,
      severity: this.determineSeverity(message, error),
      source: 'client',
      userId,
      sessionId,
      metadata: {
        line: lineno,
        column: colno,
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      },
    });
  }

  /**
   * Track server-side errors
   */
  trackServerError(
    error: Error,
    context?: {
      url?: string;
      method?: string;
      userId?: string;
      sessionId?: string;
      metadata?: Record<string, any>;
    }
  ): string {
    return this.track({
      message: error.message,
      stack: error.stack,
      url: context?.url,
      severity: this.determineSeverity(error.message, error),
      source: 'server',
      userId: context?.userId,
      sessionId: context?.sessionId,
      metadata: {
        method: context?.method,
        ...context?.metadata,
      },
    });
  }

  /**
   * Track API errors
   */
  trackApiError(
    endpoint: string,
    statusCode: number,
    message: string,
    context?: {
      method?: string;
      userId?: string;
      sessionId?: string;
      responseTime?: number;
      metadata?: Record<string, any>;
    }
  ): string {
    return this.track({
      message: `API Error: ${message}`,
      url: endpoint,
      severity: statusCode >= 500 ? 'high' : statusCode >= 400 ? 'medium' : 'low',
      source: 'api',
      userId: context?.userId,
      sessionId: context?.sessionId,
      metadata: {
        statusCode,
        method: context?.method,
        responseTime: context?.responseTime,
        ...context?.metadata,
      },
    });
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit = 50): ErrorEvent[] {
    return this.errors.slice(0, limit);
  }

  /**
   * Get error statistics
   */
  getErrorStats(timeWindow = 60): {
    total: number;
    bySeverity: Record<string, number>;
    bySource: Record<string, number>;
    topErrors: Array<{ message: string; count: number }>;
  } {
    const cutoff = new Date(Date.now() - timeWindow * 60 * 1000);
    const recentErrors = this.errors.filter(e => e.timestamp > cutoff);

    const bySeverity: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    const errorCounts: Record<string, number> = {};

    recentErrors.forEach(error => {
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
      bySource[error.source] = (bySource[error.source] || 0) + 1;
      errorCounts[error.message] = (errorCounts[error.message] || 0) + 1;
    });

    const topErrors = Object.entries(errorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([message, count]) => ({ message, count }));

    return {
      total: recentErrors.length,
      bySeverity,
      bySource,
      topErrors,
    };
  }

  /**
   * Add or update alert rule
   */
  addAlertRule(rule: AlertRule): void {
    const existingIndex = this.alertRules.findIndex(r => r.id === rule.id);
    if (existingIndex >= 0) {
      this.alertRules[existingIndex] = rule;
    } else {
      this.alertRules.push(rule);
    }
  }

  /**
   * Remove alert rule
   */
  removeAlertRule(ruleId: string): boolean {
    const index = this.alertRules.findIndex(r => r.id === ruleId);
    if (index >= 0) {
      this.alertRules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all alert rules
   */
  getAlertRules(): AlertRule[] {
    return [...this.alertRules];
  }

  private initializeDefaultRules(): void {
    this.alertRules = [
      {
        id: 'critical-errors',
        name: 'Critical Error Alert',
        condition: {
          severity: 'critical',
        },
        actions: [
          {
            type: 'log',
            config: { level: 'error' },
          },
        ],
        enabled: true,
      },
      {
        id: 'high-error-frequency',
        name: 'High Error Frequency',
        condition: {
          frequency: {
            count: 10,
            timeWindow: 5, // 10 errors in 5 minutes
          },
        },
        actions: [
          {
            type: 'log',
            config: { level: 'warn' },
          },
        ],
        enabled: true,
      },
      {
        id: 'chunk-load-errors',
        name: 'JavaScript Chunk Load Errors',
        condition: {
          errorPattern: 'ChunkLoadError|Loading chunk',
        },
        actions: [
          {
            type: 'log',
            config: { level: 'error', message: 'JavaScript chunk loading issue detected' },
          },
        ],
        enabled: true,
      },
    ];
  }

  private processAlerts(error: ErrorEvent): void {
    this.alertRules
      .filter(rule => rule.enabled)
      .forEach(rule => {
        if (this.shouldTriggerAlert(rule, error)) {
          this.executeAlertActions(rule, error);
        }
      });
  }

  private shouldTriggerAlert(rule: AlertRule, error: ErrorEvent): boolean {
    const { condition } = rule;

    // Check severity
    if (condition.severity && error.severity !== condition.severity) {
      return false;
    }

    // Check error pattern
    if (condition.errorPattern) {
      const pattern = new RegExp(condition.errorPattern, 'i');
      if (!pattern.test(error.message)) {
        return false;
      }
    }

    // Check frequency
    if (condition.frequency) {
      const cutoff = new Date(Date.now() - condition.frequency.timeWindow * 60 * 1000);
      const recentErrors = this.errors.filter(e => e.timestamp > cutoff);
      if (recentErrors.length < condition.frequency.count) {
        return false;
      }
    }

    return true;
  }

  private executeAlertActions(rule: AlertRule, error: ErrorEvent): void {
    rule.actions.forEach(action => {
      try {
        switch (action.type) {
          case 'log':
            this.executeLogAction(action, rule, error);
            break;
          case 'email':
            this.executeEmailAction(action, rule, error);
            break;
          case 'slack':
            this.executeSlackAction(action, rule, error);
            break;
          case 'webhook':
            this.executeWebhookAction(action, rule, error);
            break;
          default:
            console.warn(`Unknown alert action type: ${action.type}`);
        }
      } catch (actionError) {
        console.error(`Failed to execute alert action: ${actionError}`);
      }
    });
  }

  private executeLogAction(action: AlertAction, rule: AlertRule, error: ErrorEvent): void {
    const level = action.config.level || 'info';
    const message = action.config.message || `Alert triggered: ${rule.name}`;
    
    const logData = {
      alert: rule.name,
      error: {
        id: error.id,
        message: error.message,
        severity: error.severity,
        source: error.source,
      },
      timestamp: error.timestamp,
    };

    switch (level) {
      case 'error':
        console.error(message, logData);
        break;
      case 'warn':
        console.warn(message, logData);
        break;
      default:
        console.log(message, logData);
    }
  }

  private executeEmailAction(action: AlertAction, rule: AlertRule, error: ErrorEvent): void {
    // Email implementation would go here
    console.log(`Email alert would be sent for rule: ${rule.name}`, { error });
  }

  private executeSlackAction(action: AlertAction, rule: AlertRule, error: ErrorEvent): void {
    // Slack implementation would go here
    console.log(`Slack alert would be sent for rule: ${rule.name}`, { error });
  }

  private executeWebhookAction(action: AlertAction, rule: AlertRule, error: ErrorEvent): void {
    // Webhook implementation would go here
    console.log(`Webhook would be called for rule: ${rule.name}`, { error });
  }

  private determineSeverity(message: string, error?: Error): ErrorEvent['severity'] {
    const criticalPatterns = [
      /out of memory/i,
      /segmentation fault/i,
      /fatal/i,
      /critical/i,
    ];

    const highPatterns = [
      /chunkloaderror/i,
      /syntax error/i,
      /reference error/i,
      /type error/i,
      /network error/i,
    ];

    const mediumPatterns = [
      /warning/i,
      /deprecated/i,
      /not found/i,
    ];

    if (criticalPatterns.some(pattern => pattern.test(message))) {
      return 'critical';
    }

    if (highPatterns.some(pattern => pattern.test(message))) {
      return 'high';
    }

    if (mediumPatterns.some(pattern => pattern.test(message))) {
      return 'medium';
    }

    return 'low';
  }

  private logError(error: ErrorEvent): void {
    const logData = {
      id: error.id,
      message: error.message,
      severity: error.severity,
      source: error.source,
      url: error.url,
      timestamp: error.timestamp,
      userId: error.userId,
      sessionId: error.sessionId,
    };

    switch (error.severity) {
      case 'critical':
        console.error('CRITICAL ERROR:', logData);
        break;
      case 'high':
        console.error('HIGH SEVERITY ERROR:', logData);
        break;
      case 'medium':
        console.warn('MEDIUM SEVERITY ERROR:', logData);
        break;
      default:
        console.log('ERROR:', logData);
    }
  }

  private cleanupOldErrors(): void {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours
    this.errors = this.errors.filter(error => error.timestamp > cutoff);
  }

  private generateId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Global error tracker instance
export const errorTracker = new ErrorTracker();

// Client-side error handling
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    errorTracker.trackClientError(
      event.message,
      event.filename,
      event.lineno,
      event.colno,
      event.error
    );
  });

  window.addEventListener('unhandledrejection', (event) => {
    errorTracker.trackClientError(
      `Unhandled Promise Rejection: ${event.reason}`,
      undefined,
      undefined,
      undefined,
      event.reason instanceof Error ? event.reason : undefined
    );
  });
}

export default errorTracker;