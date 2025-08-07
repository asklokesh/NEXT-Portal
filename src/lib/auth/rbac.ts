/* eslint-disable @typescript-eslint/no-unused-vars */
import { prisma } from '../db/client';

export interface Permission {
 id: string;
 name: string;
 resource: string;
 action: string;
 description?: string;
}

export interface Role {
 id: string;
 name: string;
 description?: string;
 permissions: Permission[];
 isSystem: boolean;
}

export interface RBACContext {
 userId: string;
 userRole: string;
 teamIds: string[];
 serviceIds?: string[];
}

export class RBACSystem {
 // System roles
 private static readonly SYSTEM_ROLES: Record<string, Permission[]> = {
 ADMIN: [
 { id: 'admin.all', name: 'Admin All', resource: '*', action: '*' },
 ],
 USER: [
 { id: 'catalog.read', name: 'Read Catalog', resource: 'catalog', action: 'read' },
 { id: 'template.read', name: 'Read Templates', resource: 'template', action: 'read' },
 { id: 'template.execute', name: 'Execute Templates', resource: 'template', action: 'execute' },
 { id: 'service.read.own', name: 'Read Own Services', resource: 'service', action: 'read:own' },
 { id: 'cost.read.own', name: 'Read Own Costs', resource: 'cost', action: 'read:own' },
 ],
 MANAGER: [
 { id: 'catalog.read', name: 'Read Catalog', resource: 'catalog', action: 'read' },
 { id: 'catalog.write', name: 'Write Catalog', resource: 'catalog', action: 'write' },
 { id: 'template.read', name: 'Read Templates', resource: 'template', action: 'read' },
 { id: 'template.write', name: 'Write Templates', resource: 'template', action: 'write' },
 { id: 'template.execute', name: 'Execute Templates', resource: 'template', action: 'execute' },
 { id: 'service.read.team', name: 'Read Team Services', resource: 'service', action: 'read:team' },
 { id: 'service.write.team', name: 'Write Team Services', resource: 'service', action: 'write:team' },
 { id: 'cost.read.team', name: 'Read Team Costs', resource: 'cost', action: 'read:team' },
 { id: 'team.manage', name: 'Manage Team', resource: 'team', action: 'manage' },
 ],
 VIEWER: [
 { id: 'catalog.read', name: 'Read Catalog', resource: 'catalog', action: 'read' },
 { id: 'template.read', name: 'Read Templates', resource: 'template', action: 'read' },
 { id: 'service.read.all', name: 'Read All Services', resource: 'service', action: 'read:all' },
 { id: 'cost.read.all', name: 'Read All Costs', resource: 'cost', action: 'read:all' },
 ],
 };

 /**
 * Check if user has permission to perform action
 */
 async hasPermission(
 context: RBACContext,
 resource: string,
 action: string,
 resourceId?: string
 ): Promise<boolean> {
 // Admin has all permissions
 if (context.userRole === 'ADMIN') {
 return true;
 }

 // Get user's permissions
 const permissions = RBACSystem.SYSTEM_ROLES[context.userRole] || [];

 // Check for exact match or wildcard
 const hasBasePermission = permissions.some(perm => 
 (perm.resource === resource || perm.resource === '*') &&
 (perm.action === action || perm.action === '*' || perm.action.startsWith(action.split(':')[0]))
 );

 if (!hasBasePermission) {
 return false;
 }

 // Check ownership/team constraints for scoped actions
 if (action.includes(':own') && resourceId) {
 return this.checkOwnership(context.userId, resource, resourceId);
 }

 if (action.includes(':team') && resourceId) {
 return this.checkTeamMembership(context.teamIds, resource, resourceId);
 }

 return true;
 }

 /**
 * Check if user owns the resource
 */
 private async checkOwnership(userId: string, resource: string, resourceId: string): Promise<boolean> {
 switch (resource) {
 case 'service':
 const service = await prisma.service.findUnique({
 where: { id: resourceId },
 select: { ownerId: true },
 });
 return service?.ownerId === userId;

 case 'template':
 const template = await prisma.template.findUnique({
 where: { id: resourceId },
 select: { createdById: true },
 });
 return template?.createdById === userId;

 default:
 return false;
 }
 }

 /**
 * Check if resource belongs to user's team
 */
 private async checkTeamMembership(teamIds: string[], resource: string, resourceId: string): Promise<boolean> {
 if (teamIds.length === 0) return false;

 switch (resource) {
 case 'service':
 const service = await prisma.service.findUnique({
 where: { id: resourceId },
 select: { teamId: true },
 });
 return service ? teamIds.includes(service.teamId) : false;

 case 'cost':
 // For cost data, check if the service belongs to the team
 const costData = await prisma.serviceCost.findFirst({
 where: { serviceId: resourceId },
 include: { service: { select: { teamId: true } } },
 });
 return costData?.service ? teamIds.includes(costData.service.teamId) : false;

 default:
 return false;
 }
 }

 /**
 * Get all permissions for a role
 */
 getRolePermissions(role: string): Permission[] {
 return RBACSystem.SYSTEM_ROLES[role] || [];
 }

 /**
 * Create authorization middleware
 */
 createAuthorizationMiddleware(resource: string, action: string) {
 return async (req: any, res: any, next: any) => {
 try {
 const user = req.user;
 if (!user) {
 return res.status(401).json({ error: 'Unauthorized' });
 }

 const context: RBACContext = {
 userId: user.id,
 userRole: user.role,
 teamIds: user.teamIds || [],
 };

 const resourceId = req.params.id || req.query.resourceId;
 const hasPermission = await this.hasPermission(context, resource, action, resourceId);

 if (!hasPermission) {
 return res.status(403).json({ error: 'Forbidden' });
 }

 next();
 } catch (error) {
 console.error('Authorization error:', error);
 res.status(500).json({ error: 'Authorization failed' });
 }
 };
 }

 /**
 * Filter resources based on user permissions
 */
 async filterResources<T extends { id: string; teamId?: string; ownerId?: string }>(
 context: RBACContext,
 resources: T[],
 resource: string,
 action: string
 ): Promise<T[]> {
 // Admin sees all
 if (context.userRole === 'ADMIN') {
 return resources;
 }

 const permissions = this.getRolePermissions(context.userRole);
 const permission = permissions.find(p => 
 p.resource === resource && p.action.startsWith(action.split(':')[0])
 );

 if (!permission) {
 return [];
 }

 // Filter based on permission scope
 if (permission.action.includes(':own')) {
 return resources.filter(r => r.ownerId === context.userId);
 }

 if (permission.action.includes(':team')) {
 return resources.filter(r => r.teamId && context.teamIds.includes(r.teamId));
 }

 if (permission.action.includes(':all')) {
 return resources;
 }

 return [];
 }

 /**
 * Get user's effective permissions
 */
 async getUserPermissions(userId: string): Promise<Permission[]> {
 const user = await prisma.user.findUnique({
 where: { id: userId },
 select: { role: true },
 });

 if (!user) {
 return [];
 }

 return this.getRolePermissions(user.role);
 }

 /**
 * Check if user can perform bulk operation
 */
 async canPerformBulkOperation(
 context: RBACContext,
 resource: string,
 action: string,
 resourceIds: string[]
 ): Promise<boolean> {
 // Check permission for each resource
 const checks = await Promise.all(
 resourceIds.map(id => this.hasPermission(context, resource, action, id))
 );

 return checks.every(check => check);
 }

 /**
 * Create Backstage-compatible permission policy
 */
 createBackstagePolicy() {
 return {
 isAllowed: async (user: any, action: string, resource: any) => {
 const context: RBACContext = {
 userId: user.id,
 userRole: user.role || 'USER',
 teamIds: user.teams || [],
 };

 // Map Backstage actions to our permissions
 const [resourceType, operation] = action.split('.');
 return this.hasPermission(context, resourceType, operation, resource?.id);
 },
 };
 }
}

// Create singleton instance
export const rbacSystem = new RBACSystem();