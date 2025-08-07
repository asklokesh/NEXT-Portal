import { prisma } from '@/lib/db/client';

export type AuditAction = 
 | 'create'
 | 'update'
 | 'delete'
 | 'view'
 | 'export'
 | 'import'
 | 'login'
 | 'logout'
 | 'password_change'
 | 'permission_grant'
 | 'permission_revoke'
 | 'deploy'
 | 'rollback'
 | 'approve'
 | 'reject'
 | 'execute'
 | 'configure'
 | 'archive'
 | 'restore'
 | 'share'
 | 'unshare';

export type AuditResource = 
 | 'service'
 | 'template'
 | 'user'
 | 'team'
 | 'deployment'
 | 'api_key'
 | 'notification'
 | 'cost_budget'
 | 'health_check'
 | 'document'
 | 'settings'
 | 'session'
 | 'permission'
 | 'webhook'
 | 'integration';

export interface AuditContext {
 userId?: string;
 ipAddress?: string;
 userAgent?: string;
 sessionId?: string;
}

export interface AuditMetadata {
 [key: string]: any;
 changes?: {
 before?: Record<string, any>;
 after?: Record<string, any>;
 };
 reason?: string;
 tags?: string[];
}

export class AuditService {
 private static instance: AuditService;
 private context: AuditContext = {};

 private constructor() {}

 static getInstance(): AuditService {
 if (!AuditService.instance) {
 AuditService.instance = new AuditService();
 }
 return AuditService.instance;
 }

 /**
 * Set global context for audit logging
 */
 setContext(context: AuditContext) {
 this.context = { ...this.context, ...context };
 }

 /**
 * Clear context
 */
 clearContext() {
 this.context = {};
 }

 /**
 * Log an audit event
 */
 async log(
 action: AuditAction | string,
 resource: AuditResource | string,
 resourceId?: string,
 metadata?: AuditMetadata,
 overrideContext?: AuditContext
 ) {
 try {
 const context = { ...this.context, ...overrideContext };
 
 await prisma.auditLog.create({
 data: {
 userId: context.userId || null,
 action,
 resource,
 resourceId: resourceId || null,
 metadata: metadata ? JSON.stringify(metadata) : null,
 ipAddress: context.ipAddress || null,
 userAgent: context.userAgent || null
 }
 });
 } catch (error) {
 console.error('Failed to create audit log:', error);
 // Don't throw - audit logging should not break the application
 }
 }

 /**
 * Log a service-related action
 */
 async logService(
 action: Extract<AuditAction, 'create' | 'update' | 'delete' | 'view' | 'deploy' | 'rollback'>,
 serviceId: string,
 metadata?: AuditMetadata
 ) {
 await this.log(action, 'service', serviceId, metadata);
 }

 /**
 * Log a template-related action
 */
 async logTemplate(
 action: Extract<AuditAction, 'create' | 'update' | 'delete' | 'view' | 'execute' | 'share' | 'unshare'>,
 templateId: string,
 metadata?: AuditMetadata
 ) {
 await this.log(action, 'template', templateId, metadata);
 }

 /**
 * Log a user-related action
 */
 async logUser(
 action: Extract<AuditAction, 'create' | 'update' | 'delete' | 'login' | 'logout' | 'password_change' | 'permission_grant' | 'permission_revoke'>,
 userId: string,
 metadata?: AuditMetadata
 ) {
 await this.log(action, 'user', userId, metadata);
 }

 /**
 * Log a deployment-related action
 */
 async logDeployment(
 action: Extract<AuditAction, 'create' | 'approve' | 'reject' | 'deploy' | 'rollback'>,
 deploymentId: string,
 metadata?: AuditMetadata & {
 serviceId?: string;
 environment?: string;
 version?: string;
 status?: string;
 }
 ) {
 await this.log(action, 'deployment', deploymentId, metadata);
 }

 /**
 * Log an API key action
 */
 async logApiKey(
 action: Extract<AuditAction, 'create' | 'update' | 'delete' | 'view'>,
 apiKeyId: string,
 metadata?: AuditMetadata & {
 keyName?: string;
 permissions?: string[];
 }
 ) {
 await this.log(action, 'api_key', apiKeyId, metadata);
 }

 /**
 * Log a cost/budget action
 */
 async logCostBudget(
 action: Extract<AuditAction, 'create' | 'update' | 'delete' | 'view'>,
 budgetId: string,
 metadata?: AuditMetadata & {
 budgetName?: string;
 amount?: number;
 threshold?: number;
 }
 ) {
 await this.log(action, 'cost_budget', budgetId, metadata);
 }

 /**
 * Log a settings change
 */
 async logSettings(
 action: Extract<AuditAction, 'update' | 'view'>,
 settingsType: string,
 metadata?: AuditMetadata
 ) {
 await this.log(action, 'settings', settingsType, metadata);
 }

 /**
 * Batch log multiple events
 */
 async logBatch(
 events: Array<{
 action: AuditAction | string;
 resource: AuditResource | string;
 resourceId?: string;
 metadata?: AuditMetadata;
 }>
 ) {
 try {
 const context = this.context;
 
 await prisma.auditLog.createMany({
 data: events.map(event => ({
 userId: context.userId || null,
 action: event.action,
 resource: event.resource,
 resourceId: event.resourceId || null,
 metadata: event.metadata ? JSON.stringify(event.metadata) : null,
 ipAddress: context.ipAddress || null,
 userAgent: context.userAgent || null
 }))
 });
 } catch (error) {
 console.error('Failed to batch create audit logs:', error);
 }
 }

 /**
 * Query audit logs
 */
 async query(options: {
 resource?: string;
 action?: string;
 userId?: string;
 resourceId?: string;
 startDate?: Date;
 endDate?: Date;
 limit?: number;
 offset?: number;
 }) {
 const whereClause: any = {};

 if (options.resource) {
 whereClause.resource = options.resource;
 }

 if (options.action) {
 whereClause.action = options.action;
 }

 if (options.userId) {
 whereClause.userId = options.userId;
 }

 if (options.resourceId) {
 whereClause.resourceId = options.resourceId;
 }

 if (options.startDate || options.endDate) {
 whereClause.timestamp = {};
 if (options.startDate) {
 whereClause.timestamp.gte = options.startDate;
 }
 if (options.endDate) {
 whereClause.timestamp.lte = options.endDate;
 }
 }

 const logs = await prisma.auditLog.findMany({
 where: whereClause,
 include: {
 user: true
 },
 orderBy: {
 timestamp: 'desc'
 },
 take: options.limit || 50,
 skip: options.offset || 0
 });

 return logs.map(log => ({
 ...log,
 metadata: log.metadata ? JSON.parse(log.metadata as string) : null
 }));
 }

 /**
 * Get activity summary for a resource
 */
 async getResourceActivity(resource: string, resourceId: string, days: number = 30) {
 const startDate = new Date();
 startDate.setDate(startDate.getDate() - days);

 const logs = await this.query({
 resource,
 resourceId,
 startDate,
 limit: 100
 });

 const summary = {
 totalActions: logs.length,
 uniqueUsers: new Set(logs.map(l => l.userId).filter(Boolean)).size,
 actionCounts: {} as Record<string, number>,
 recentActivity: logs.slice(0, 10),
 lastModified: logs.find(l => ['create', 'update'].includes(l.action))?.timestamp
 };

 logs.forEach(log => {
 summary.actionCounts[log.action] = (summary.actionCounts[log.action] || 0) + 1;
 });

 return summary;
 }

 /**
 * Get user activity summary
 */
 async getUserActivity(userId: string, days: number = 30) {
 const startDate = new Date();
 startDate.setDate(startDate.getDate() - days);

 const logs = await this.query({
 userId,
 startDate,
 limit: 500
 });

 const summary = {
 totalActions: logs.length,
 resourceCounts: {} as Record<string, number>,
 actionCounts: {} as Record<string, number>,
 recentActivity: logs.slice(0, 20),
 mostActiveResource: '',
 mostCommonAction: ''
 };

 logs.forEach(log => {
 summary.resourceCounts[log.resource] = (summary.resourceCounts[log.resource] || 0) + 1;
 summary.actionCounts[log.action] = (summary.actionCounts[log.action] || 0) + 1;
 });

 // Find most active resource and action
 summary.mostActiveResource = Object.entries(summary.resourceCounts)
 .sort(([, a], [, b]) => b - a)[0]?.[0] || '';
 
 summary.mostCommonAction = Object.entries(summary.actionCounts)
 .sort(([, a], [, b]) => b - a)[0]?.[0] || '';

 return summary;
 }

 /**
 * Clean up old audit logs
 */
 async cleanup(olderThanDays: number = 90) {
 const cutoffDate = new Date();
 cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

 const result = await prisma.auditLog.deleteMany({
 where: {
 timestamp: {
 lt: cutoffDate
 }
 }
 });

 await this.log('delete', 'audit_log', null, {
 reason: 'Scheduled cleanup',
 deletedCount: result.count,
 cutoffDate: cutoffDate.toISOString()
 });

 return result.count;
 }
}

// Export singleton instance
export const auditService = AuditService.getInstance();

// Simple wrapper for middleware compatibility
export interface SimpleAuditLogData {
  action: string;
  resource: string;
  resourceId: string | null;
  userId: string | null;
  details: Record<string, any>;
  status: 'success' | 'failed' | 'error' | 'blocked';
}

export const createAuditLog = async (data: SimpleAuditLogData): Promise<void> => {
  const service = AuditService.getInstance();
  
  // Map status to appropriate metadata
  const metadata: AuditMetadata = {
    ...data.details,
    status: data.status,
  };
  
  await service.log(data.action, data.resource, data.resourceId || undefined, metadata, {
    userId: data.userId || undefined,
  });
};

// Middleware helper for Express/Next.js
export function withAuditContext(handler: any) {
 return async (req: any, res: any, ...args: any[]) => {
 const auditService = AuditService.getInstance();
 
 auditService.setContext({
 userId: req.user?.id || req.session?.userId,
 ipAddress: req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.ip,
 userAgent: req.headers['user-agent'],
 sessionId: req.session?.id
 });

 try {
 return await handler(req, res, ...args);
 } finally {
 auditService.clearContext();
 }
 };
}