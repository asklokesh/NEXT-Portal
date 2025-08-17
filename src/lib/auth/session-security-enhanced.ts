/**
 * Enhanced Session Security Manager
 * Fixes session race conditions, concurrent attack vulnerabilities, and consistency issues
 */

import crypto from 'crypto';
import { LRUCache } from 'lru-cache';
import { sessionRedis } from '../db/client';

// Session configuration
const SESSION_CONFIG = {
  MAX_CONCURRENT_SESSIONS: 5,
  SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours
  IDLE_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  LOCK_TIMEOUT: 5000, // 5 seconds for distributed locks
  CLEANUP_INTERVAL: 5 * 60 * 1000, // 5 minutes
};

// Session states for state machine
enum SessionState {
  ACTIVE = 'ACTIVE',
  IDLE = 'IDLE',
  LOCKED = 'LOCKED',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED'
}

// Enhanced session data structure
export interface EnhancedSession {
  id: string;
  userId: string;
  email: string;
  role: string;
  tenantId?: string;
  state: SessionState;
  version: number; // For optimistic concurrency control
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
  idleExpiresAt: Date;
  deviceInfo: {
    fingerprint: string;
    userAgent: string;
    ipAddress: string;
    platform?: string;
    browser?: string;
  };
  securityContext: {
    loginMethod: string; // password, oauth, sso, mfa
    mfaVerified: boolean;
    riskScore: number; // 0-100
    anomalyDetected: boolean;
  };
  metadata: {
    location?: {
      country?: string;
      city?: string;
      coordinates?: [number, number];
    };
    lastActions: string[]; // Track last N actions for audit
  };
}

// Session event for audit trail
interface SessionEvent {
  sessionId: string;
  userId: string;
  eventType: 'created' | 'updated' | 'expired' | 'revoked' | 'locked' | 'unlocked';
  timestamp: Date;
  details: Record<string, any>;
}

// Distributed lock implementation
class DistributedLock {
  private static readonly LOCK_PREFIX = 'lock:session:';
  
  static async acquire(key: string, ttl: number = SESSION_CONFIG.LOCK_TIMEOUT): Promise<boolean> {
    const lockKey = `${this.LOCK_PREFIX}${key}`;
    const lockValue = crypto.randomUUID();
    
    try {
      // Use SET NX (set if not exists) with expiry
      const result = await sessionRedis.set(
        lockKey,
        lockValue,
        'PX', // Set expiry in milliseconds
        ttl,
        'NX'  // Only set if key doesn't exist
      );
      
      return result === 'OK';
    } catch (error) {
      console.error('Failed to acquire lock:', error);
      return false;
    }
  }
  
  static async release(key: string): Promise<void> {
    const lockKey = `${this.LOCK_PREFIX}${key}`;
    try {
      await sessionRedis.del(lockKey);
    } catch (error) {
      console.error('Failed to release lock:', error);
    }
  }
  
  static async withLock<T>(
    key: string,
    callback: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let retries = 0;
    
    while (retries < maxRetries) {
      const acquired = await this.acquire(key);
      
      if (acquired) {
        try {
          return await callback();
        } finally {
          await this.release(key);
        }
      }
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 100));
      retries++;
    }
    
    throw new Error(`Failed to acquire lock for key: ${key}`);
  }
}

// Session consistency validator
class SessionConsistencyValidator {
  private static readonly CONSISTENCY_CHECKS = [
    'version_mismatch',
    'state_transition',
    'timestamp_consistency',
    'device_consistency'
  ];
  
  static async validate(
    oldSession: EnhancedSession | null,
    newSession: EnhancedSession
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    if (oldSession) {
      // Version check for optimistic concurrency control
      if (newSession.version <= oldSession.version) {
        errors.push('Version mismatch - potential concurrent modification');
      }
      
      // State transition validation
      if (!this.isValidStateTransition(oldSession.state, newSession.state)) {
        errors.push(`Invalid state transition: ${oldSession.state} -> ${newSession.state}`);
      }
      
      // Timestamp consistency
      if (newSession.createdAt.getTime() !== oldSession.createdAt.getTime()) {
        errors.push('Session creation time cannot be modified');
      }
      
      if (newSession.lastActivityAt.getTime() < oldSession.lastActivityAt.getTime()) {
        errors.push('Last activity timestamp cannot go backwards');
      }
      
      // Device consistency
      if (newSession.deviceInfo.fingerprint !== oldSession.deviceInfo.fingerprint) {
        errors.push('Device fingerprint mismatch - potential session hijacking');
      }
    }
    
    // General validation
    if (newSession.expiresAt.getTime() < Date.now()) {
      errors.push('Session already expired');
    }
    
    if (newSession.idleExpiresAt.getTime() < Date.now()) {
      errors.push('Session idle timeout exceeded');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  private static isValidStateTransition(from: SessionState, to: SessionState): boolean {
    const validTransitions: Record<SessionState, SessionState[]> = {
      [SessionState.ACTIVE]: [SessionState.IDLE, SessionState.LOCKED, SessionState.EXPIRED, SessionState.REVOKED],
      [SessionState.IDLE]: [SessionState.ACTIVE, SessionState.EXPIRED, SessionState.REVOKED],
      [SessionState.LOCKED]: [SessionState.ACTIVE, SessionState.EXPIRED, SessionState.REVOKED],
      [SessionState.EXPIRED]: [], // Terminal state
      [SessionState.REVOKED]: [], // Terminal state
    };
    
    return validTransitions[from]?.includes(to) ?? false;
  }
}

// Main session manager class
export class EnhancedSessionManager {
  private static instance: EnhancedSessionManager;
  private sessionEvents: SessionEvent[] = [];
  private activeSessionsCache = new LRUCache<string, EnhancedSession>({
    max: 1000,
    ttl: 60 * 1000 // 1 minute cache
  });
  
  private constructor() {
    // Start cleanup interval
    setInterval(() => this.cleanupExpiredSessions(), SESSION_CONFIG.CLEANUP_INTERVAL);
  }
  
  static getInstance(): EnhancedSessionManager {
    if (!EnhancedSessionManager.instance) {
      EnhancedSessionManager.instance = new EnhancedSessionManager();
    }
    return EnhancedSessionManager.instance;
  }
  
  /**
   * Create a new session with race condition protection
   */
  async createSession(
    userId: string,
    email: string,
    role: string,
    deviceInfo: EnhancedSession['deviceInfo'],
    securityContext: EnhancedSession['securityContext'],
    tenantId?: string
  ): Promise<EnhancedSession> {
    return DistributedLock.withLock(`user:${userId}`, async () => {
      // Check concurrent session limit
      const userSessions = await this.getUserSessions(userId);
      const activeSessions = userSessions.filter(s => 
        s.state === SessionState.ACTIVE || s.state === SessionState.IDLE
      );
      
      if (activeSessions.length >= SESSION_CONFIG.MAX_CONCURRENT_SESSIONS) {
        // Revoke oldest session
        const oldestSession = activeSessions.sort((a, b) => 
          a.lastActivityAt.getTime() - b.lastActivityAt.getTime()
        )[0];
        
        await this.revokeSession(oldestSession.id, 'MAX_SESSIONS_EXCEEDED');
      }
      
      const now = new Date();
      const sessionId = this.generateSecureSessionId();
      
      const session: EnhancedSession = {
        id: sessionId,
        userId,
        email,
        role,
        tenantId,
        state: SessionState.ACTIVE,
        version: 1,
        createdAt: now,
        lastActivityAt: now,
        expiresAt: new Date(now.getTime() + SESSION_CONFIG.SESSION_TIMEOUT),
        idleExpiresAt: new Date(now.getTime() + SESSION_CONFIG.IDLE_TIMEOUT),
        deviceInfo,
        securityContext,
        metadata: {
          lastActions: []
        }
      };
      
      // Validate session consistency
      const validation = await SessionConsistencyValidator.validate(null, session);
      if (!validation.valid) {
        throw new Error(`Session validation failed: ${validation.errors.join(', ')}`);
      }
      
      // Store session in Redis
      await this.persistSession(session);
      
      // Record event
      this.recordSessionEvent({
        sessionId,
        userId,
        eventType: 'created',
        timestamp: now,
        details: { deviceInfo, securityContext }
      });
      
      // Update cache
      this.activeSessionsCache.set(sessionId, session);
      
      return session;
    });
  }
  
  /**
   * Get session with consistency validation
   */
  async getSession(sessionId: string): Promise<EnhancedSession | null> {
    // Check cache first
    const cached = this.activeSessionsCache.get(sessionId);
    if (cached) {
      // Validate cache freshness
      if (cached.state === SessionState.ACTIVE && cached.idleExpiresAt > new Date()) {
        return cached;
      }
    }
    
    // Fetch from Redis
    const sessionData = await sessionRedis.get(`session:${sessionId}`);
    if (!sessionData) {
      return null;
    }
    
    const session = this.deserializeSession(sessionData);
    
    // Check expiration
    const now = new Date();
    if (session.expiresAt < now || session.idleExpiresAt < now) {
      await this.expireSession(sessionId);
      return null;
    }
    
    // Update cache
    this.activeSessionsCache.set(sessionId, session);
    
    return session;
  }
  
  /**
   * Update session activity with race condition protection
   */
  async updateSessionActivity(
    sessionId: string,
    action?: string
  ): Promise<EnhancedSession | null> {
    return DistributedLock.withLock(`session:${sessionId}`, async () => {
      const session = await this.getSession(sessionId);
      if (!session) {
        return null;
      }
      
      const oldSession = { ...session };
      const now = new Date();
      
      // Update session
      session.lastActivityAt = now;
      session.idleExpiresAt = new Date(now.getTime() + SESSION_CONFIG.IDLE_TIMEOUT);
      session.version++;
      
      // Transition from IDLE to ACTIVE if needed
      if (session.state === SessionState.IDLE) {
        session.state = SessionState.ACTIVE;
      }
      
      // Track action
      if (action) {
        session.metadata.lastActions = [
          action,
          ...(session.metadata.lastActions || [])
        ].slice(0, 10); // Keep last 10 actions
      }
      
      // Validate consistency
      const validation = await SessionConsistencyValidator.validate(oldSession, session);
      if (!validation.valid) {
        console.error('Session consistency validation failed:', validation.errors);
        return null;
      }
      
      // Persist updated session
      await this.persistSession(session);
      
      // Update cache
      this.activeSessionsCache.set(sessionId, session);
      
      return session;
    });
  }
  
  /**
   * Validate session with comprehensive checks
   */
  async validateSession(
    sessionId: string,
    deviceFingerprint?: string,
    ipAddress?: string
  ): Promise<{ valid: boolean; reason?: string }> {
    const session = await this.getSession(sessionId);
    
    if (!session) {
      return { valid: false, reason: 'Session not found' };
    }
    
    // Check session state
    if (session.state !== SessionState.ACTIVE && session.state !== SessionState.IDLE) {
      return { valid: false, reason: `Invalid session state: ${session.state}` };
    }
    
    // Check expiration
    const now = new Date();
    if (session.expiresAt < now) {
      await this.expireSession(sessionId);
      return { valid: false, reason: 'Session expired' };
    }
    
    if (session.idleExpiresAt < now) {
      await this.expireSession(sessionId);
      return { valid: false, reason: 'Session idle timeout' };
    }
    
    // Validate device fingerprint
    if (deviceFingerprint && session.deviceInfo.fingerprint !== deviceFingerprint) {
      // Potential session hijacking
      await this.lockSession(sessionId, 'FINGERPRINT_MISMATCH');
      return { valid: false, reason: 'Device fingerprint mismatch' };
    }
    
    // Check for anomalies
    if (ipAddress && this.isAnomalousIPChange(session.deviceInfo.ipAddress, ipAddress)) {
      session.securityContext.anomalyDetected = true;
      session.securityContext.riskScore = Math.min(100, session.securityContext.riskScore + 20);
      await this.persistSession(session);
      
      if (session.securityContext.riskScore > 80) {
        await this.lockSession(sessionId, 'HIGH_RISK_SCORE');
        return { valid: false, reason: 'Security risk detected' };
      }
    }
    
    return { valid: true };
  }
  
  /**
   * Revoke session
   */
  async revokeSession(sessionId: string, reason: string): Promise<void> {
    return DistributedLock.withLock(`session:${sessionId}`, async () => {
      const session = await this.getSession(sessionId);
      if (!session) return;
      
      session.state = SessionState.REVOKED;
      session.version++;
      
      await this.persistSession(session);
      this.activeSessionsCache.delete(sessionId);
      
      this.recordSessionEvent({
        sessionId,
        userId: session.userId,
        eventType: 'revoked',
        timestamp: new Date(),
        details: { reason }
      });
    });
  }
  
  /**
   * Lock session for security reasons
   */
  private async lockSession(sessionId: string, reason: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;
    
    session.state = SessionState.LOCKED;
    session.version++;
    
    await this.persistSession(session);
    this.activeSessionsCache.delete(sessionId);
    
    this.recordSessionEvent({
      sessionId,
      userId: session.userId,
      eventType: 'locked',
      timestamp: new Date(),
      details: { reason }
    });
  }
  
  /**
   * Expire session
   */
  private async expireSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;
    
    session.state = SessionState.EXPIRED;
    session.version++;
    
    await this.persistSession(session);
    this.activeSessionsCache.delete(sessionId);
    
    this.recordSessionEvent({
      sessionId,
      userId: session.userId,
      eventType: 'expired',
      timestamp: new Date(),
      details: {}
    });
  }
  
  /**
   * Get all sessions for a user
   */
  private async getUserSessions(userId: string): Promise<EnhancedSession[]> {
    const pattern = `session:user:${userId}:*`;
    const keys = await sessionRedis.keys(pattern);
    const sessions: EnhancedSession[] = [];
    
    for (const key of keys) {
      const data = await sessionRedis.get(key);
      if (data) {
        sessions.push(this.deserializeSession(data));
      }
    }
    
    return sessions;
  }
  
  /**
   * Clean up expired sessions
   */
  private async cleanupExpiredSessions(): Promise<void> {
    const pattern = 'session:*';
    const keys = await sessionRedis.keys(pattern);
    const now = new Date();
    let cleaned = 0;
    
    for (const key of keys) {
      const data = await sessionRedis.get(key);
      if (data) {
        const session = this.deserializeSession(data);
        if (session.expiresAt < now || session.idleExpiresAt < now) {
          await sessionRedis.del(key);
          this.activeSessionsCache.delete(session.id);
          cleaned++;
        }
      }
    }
    
    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} expired sessions`);
    }
  }
  
  /**
   * Persist session to Redis
   */
  private async persistSession(session: EnhancedSession): Promise<void> {
    const key = `session:${session.id}`;
    const userKey = `session:user:${session.userId}:${session.id}`;
    const ttl = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000);
    
    const data = this.serializeSession(session);
    
    // Store with TTL
    await sessionRedis.setex(key, ttl, data);
    await sessionRedis.setex(userKey, ttl, data);
  }
  
  /**
   * Serialize session for storage
   */
  private serializeSession(session: EnhancedSession): string {
    return JSON.stringify(session);
  }
  
  /**
   * Deserialize session from storage
   */
  private deserializeSession(data: string): EnhancedSession {
    const parsed = JSON.parse(data);
    return {
      ...parsed,
      createdAt: new Date(parsed.createdAt),
      lastActivityAt: new Date(parsed.lastActivityAt),
      expiresAt: new Date(parsed.expiresAt),
      idleExpiresAt: new Date(parsed.idleExpiresAt)
    };
  }
  
  /**
   * Generate secure session ID
   */
  private generateSecureSessionId(): string {
    return crypto.randomBytes(32).toString('base64url');
  }
  
  /**
   * Check for anomalous IP changes
   */
  private isAnomalousIPChange(oldIP: string, newIP: string): boolean {
    if (oldIP === newIP) return false;
    
    // In production, implement proper IP geolocation and anomaly detection
    // For now, check if IPs are from different subnets
    const oldParts = oldIP.split('.');
    const newParts = newIP.split('.');
    
    // Check if first two octets are different (different network)
    return oldParts[0] !== newParts[0] || oldParts[1] !== newParts[1];
  }
  
  /**
   * Record session event for audit
   */
  private recordSessionEvent(event: SessionEvent): void {
    this.sessionEvents.push(event);
    
    // Keep only last 1000 events in memory
    if (this.sessionEvents.length > 1000) {
      this.sessionEvents = this.sessionEvents.slice(-1000);
    }
    
    // In production, persist to audit log database
    console.log('Session event:', event);
  }
  
  /**
   * Get session events for audit
   */
  getSessionEvents(sessionId?: string, userId?: string): SessionEvent[] {
    return this.sessionEvents.filter(event => {
      if (sessionId && event.sessionId !== sessionId) return false;
      if (userId && event.userId !== userId) return false;
      return true;
    });
  }
}

// Export singleton instance
export const enhancedSessionManager = EnhancedSessionManager.getInstance();