/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { randomBytes } from 'crypto';
import { sessionRedis } from '../db/client';
import type { User } from '@prisma/client';

const SESSION_PREFIX = 'session:';
const SESSION_MAX_AGE = parseInt(process.env.SESSION_MAX_AGE || '604800000'); // 7 days in milliseconds

export interface SessionData {
 userId: string;
 email: string;
 name: string;
 role: string;
 avatar?: string;
 createdAt: number;
 lastActivity: number;
 ipAddress?: string;
 userAgent?: string;
}

/**
 * Create a new session for a user
 */
export const createSession = async (
 user: User,
 metadata?: {
 ipAddress?: string;
 userAgent?: string;
 }
): Promise<string> => {
 const sessionId = randomBytes(32).toString('hex');
 const now = Date.now();

 const sessionData: SessionData = {
 userId: user.id,
 email: user.email,
 name: user.name,
 role: user.role,
 avatar: user.avatar || undefined,
 createdAt: now,
 lastActivity: now,
 ipAddress: metadata?.ipAddress,
 userAgent: metadata?.userAgent,
 };

 // Store session in Redis with expiration
 await sessionRedis.setex(
 `${SESSION_PREFIX}${sessionId}`,
 Math.floor(SESSION_MAX_AGE / 1000), // Redis expects seconds
 JSON.stringify(sessionData)
 );

 return sessionId;
};

/**
 * Get session data by session ID
 */
export const getSession = async (sessionId: string): Promise<SessionData | null> => {
 try {
 const data = await sessionRedis.get(`${SESSION_PREFIX}${sessionId}`);
 if (!data) {
 return null;
 }

 const sessionData: SessionData = JSON.parse(data);
 
 // Check if session is expired
 const now = Date.now();
 if (now - sessionData.createdAt > SESSION_MAX_AGE) {
 await destroySession(sessionId);
 return null;
 }

 return sessionData;
 } catch (error) {
 console.error('Failed to get session:', error);
 return null;
 }
};

/**
 * Update session activity timestamp
 */
export const updateSessionActivity = async (sessionId: string): Promise<void> => {
 try {
 const sessionData = await getSession(sessionId);
 if (!sessionData) {
 return;
 }

 sessionData.lastActivity = Date.now();

 await sessionRedis.setex(
 `${SESSION_PREFIX}${sessionId}`,
 Math.floor(SESSION_MAX_AGE / 1000),
 JSON.stringify(sessionData)
 );
 } catch (error) {
 console.error('Failed to update session activity:', error);
 }
};

/**
 * Destroy a session
 */
export const destroySession = async (sessionId: string): Promise<void> => {
 try {
 await sessionRedis.del(`${SESSION_PREFIX}${sessionId}`);
 } catch (error) {
 console.error('Failed to destroy session:', error);
 }
};

/**
 * Destroy all sessions for a user
 */
export const destroyAllUserSessions = async (userId: string): Promise<void> => {
 try {
 // Get all session keys
 const sessionKeys = await sessionRedis.keys(`${SESSION_PREFIX}*`);
 
 // Check each session to see if it belongs to the user
 const userSessionKeys: string[] = [];
 
 for (const key of sessionKeys) {
 const data = await sessionRedis.get(key);
 if (data) {
 const sessionData: SessionData = JSON.parse(data);
 if (sessionData.userId === userId) {
 userSessionKeys.push(key);
 }
 }
 }

 // Delete all user sessions
 if (userSessionKeys.length > 0) {
 await sessionRedis.del(...userSessionKeys);
 }
 } catch (error) {
 console.error('Failed to destroy all user sessions:', error);
 }
};

/**
 * Get all active sessions for a user
 */
export const getUserSessions = async (userId: string): Promise<SessionData[]> => {
 try {
 const sessionKeys = await sessionRedis.keys(`${SESSION_PREFIX}*`);
 const userSessions: SessionData[] = [];

 for (const key of sessionKeys) {
 const data = await sessionRedis.get(key);
 if (data) {
 const sessionData: SessionData = JSON.parse(data);
 if (sessionData.userId === userId) {
 userSessions.push(sessionData);
 }
 }
 }

 return userSessions.sort((a, b) => b.lastActivity - a.lastActivity);
 } catch (error) {
 console.error('Failed to get user sessions:', error);
 return [];
 }
};

/**
 * Clean up expired sessions
 */
export const cleanupExpiredSessions = async (): Promise<number> => {
 try {
 const sessionKeys = await sessionRedis.keys(`${SESSION_PREFIX}*`);
 let cleanedCount = 0;
 const now = Date.now();

 for (const key of sessionKeys) {
 const data = await sessionRedis.get(key);
 if (data) {
 const sessionData: SessionData = JSON.parse(data);
 if (now - sessionData.createdAt > SESSION_MAX_AGE) {
 await sessionRedis.del(key);
 cleanedCount++;
 }
 }
 }

 return cleanedCount;
 } catch (error) {
 console.error('Failed to cleanup expired sessions:', error);
 return 0;
 }
};

/**
 * Get session statistics
 */
export const getSessionStats = async (): Promise<{
 totalSessions: number;
 activeSessions: number;
 expiredSessions: number;
}> => {
 try {
 const sessionKeys = await sessionRedis.keys(`${SESSION_PREFIX}*`);
 const now = Date.now();
 let activeSessions = 0;
 let expiredSessions = 0;

 for (const key of sessionKeys) {
 const data = await sessionRedis.get(key);
 if (data) {
 const sessionData: SessionData = JSON.parse(data);
 if (now - sessionData.createdAt > SESSION_MAX_AGE) {
 expiredSessions++;
 } else {
 activeSessions++;
 }
 }
 }

 return {
 totalSessions: sessionKeys.length,
 activeSessions,
 expiredSessions,
 };
 } catch (error) {
 console.error('Failed to get session stats:', error);
 return {
 totalSessions: 0,
 activeSessions: 0,
 expiredSessions: 0,
 };
 }
};