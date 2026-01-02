/**
 * Audit Logger - Security event logging for compliance and monitoring
 */

export interface AuthEvent {
  userId?: string;
  action: string;
  resource?: string;
  success: boolean;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

export interface SecurityEvent {
  type: 'authentication' | 'authorization' | 'access' | 'modification' | 'system';
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: string;
  userId?: string;
  resource?: string;
  success: boolean;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

/**
 * Log authentication events for audit trail
 */
export function logAuthEvent(event: AuthEvent): void {
  const logEntry = {
    type: 'auth',
    ...event,
    timestamp: event.timestamp.toISOString(),
  };

  if (process.env.NODE_ENV === 'production') {
    // In production, send to audit log service
    console.log(JSON.stringify(logEntry));
  } else if (process.env.NODE_ENV !== 'test') {
    // In development, log to console
    console.log('[AUDIT:AUTH]', logEntry);
  }
}

/**
 * Log security events for monitoring and alerting
 */
export function logSecurityEvent(event: SecurityEvent): void {
  const logEntry = {
    type: 'security',
    ...event,
    timestamp: event.timestamp.toISOString(),
  };

  if (process.env.NODE_ENV === 'production') {
    // In production, send to security monitoring service
    console.log(JSON.stringify(logEntry));

    // Alert on high/critical severity events
    if (event.severity === 'high' || event.severity === 'critical') {
      // TODO: Integrate with alerting system (PagerDuty, Slack, etc.)
    }
  } else if (process.env.NODE_ENV !== 'test') {
    // In development, log to console
    console.log('[AUDIT:SECURITY]', logEntry);
  }
}

/**
 * Log access events for compliance reporting
 */
export function logAccessEvent(
  userId: string,
  resource: string,
  action: 'read' | 'write' | 'delete' | 'admin',
  success: boolean,
  metadata?: Record<string, unknown>
): void {
  logSecurityEvent({
    type: 'access',
    severity: success ? 'low' : 'medium',
    action,
    userId,
    resource,
    success,
    timestamp: new Date(),
    metadata,
  });
}

/**
 * Log failed authentication attempts (for rate limiting and security monitoring)
 */
export function logFailedAuth(
  identifier: string,
  reason: string,
  ip?: string,
  metadata?: Record<string, unknown>
): void {
  logSecurityEvent({
    type: 'authentication',
    severity: 'medium',
    action: 'login_failed',
    userId: identifier,
    success: false,
    timestamp: new Date(),
    ip,
    metadata: { reason, ...metadata },
  });
}

/**
 * Log successful authentication
 */
export function logSuccessfulAuth(
  userId: string,
  method: string,
  ip?: string,
  metadata?: Record<string, unknown>
): void {
  logAuthEvent({
    userId,
    action: 'login_success',
    success: true,
    timestamp: new Date(),
    ip,
    metadata: { method, ...metadata },
  });
}
