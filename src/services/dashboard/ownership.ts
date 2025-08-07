/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { backstageClient } from '@/lib/backstage/client';

import type { Entity } from '@/lib/backstage/types';

export interface UserProfile {
 username: string;
 displayName: string;
 email: string;
 groups: string[];
 roles: string[];
}

export interface ServiceOwnership {
 entityRef: string;
 name: string;
 owner: string;
 ownerType: 'user' | 'group';
 isOwned: boolean;
 permissions: string[];
}

class OwnershipService {
 private currentUser: UserProfile | null = null;
 private ownedServices: Map<string, ServiceOwnership> = new Map();
 private cacheExpiry: number = 0;
 private cacheDuration: number = 300000; // 5 minutes

 // Mock user for demo purposes
 private getMockUser(): UserProfile {
 return {
 username: 'platform-user',
 displayName: 'Platform User',
 email: 'platform-user@company.com',
 groups: ['platform-team', 'backend-team', 'devops'],
 roles: ['developer', 'platform-engineer']
 };
 }

 async getCurrentUser(): Promise<UserProfile> {
 if (this.currentUser) {
 return this.currentUser;
 }

 try {
 // In a real implementation, this would fetch from an auth service
 // For now, return mock user
 this.currentUser = this.getMockUser();
 return this.currentUser;
 } catch (error) {
 console.error('Failed to get current user:', error);
 throw error;
 }
 }

 async getUserOwnedServices(user?: UserProfile): Promise<ServiceOwnership[]> {
 const currentUser = user || await this.getCurrentUser();
 
 // Check cache
 if (Date.now() < this.cacheExpiry && this.ownedServices.size > 0) {
 return Array.from(this.ownedServices.values()).filter(service => service.isOwned);
 }

 try {
 // Fetch all components from Backstage
 const entities = await backstageClient.getCatalogEntities({ kind: 'Component' });
 
 // Determine ownership for each service
 const ownerships = entities.map(entity => this.determineOwnership(entity, currentUser));
 
 // Update cache
 this.ownedServices.clear();
 ownerships.forEach(ownership => {
 this.ownedServices.set(ownership.entityRef, ownership);
 });
 this.cacheExpiry = Date.now() + this.cacheDuration;

 // Return only owned services
 return ownerships.filter(ownership => ownership.isOwned);
 } catch (error) {
 console.error('Failed to fetch user owned services:', error);
 throw error;
 }
 }

 async getAllServicesWithOwnership(user?: UserProfile): Promise<ServiceOwnership[]> {
 const currentUser = user || await this.getCurrentUser();
 
 // Check cache
 if (Date.now() < this.cacheExpiry && this.ownedServices.size > 0) {
 return Array.from(this.ownedServices.values());
 }

 try {
 // Fetch all components from Backstage
 const entities = await backstageClient.getCatalogEntities({ kind: 'Component' });
 
 // Determine ownership for each service
 const ownerships = entities.map(entity => this.determineOwnership(entity, currentUser));
 
 // Update cache
 this.ownedServices.clear();
 ownerships.forEach(ownership => {
 this.ownedServices.set(ownership.entityRef, ownership);
 });
 this.cacheExpiry = Date.now() + this.cacheDuration;

 return ownerships;
 } catch (error) {
 console.error('Failed to fetch services with ownership:', error);
 throw error;
 }
 }

 private determineOwnership(entity: Entity, user: UserProfile): ServiceOwnership {
 const entityRef = `${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}`;
 const owner = entity.spec?.owner as string || 'unknown';
 
 // Determine if user owns this service
 let isOwned = false;
 let ownerType: 'user' | 'group' = 'user';
 
 if (owner === user.username || owner === user.email) {
 // Direct user ownership
 isOwned = true;
 ownerType = 'user';
 } else if (user.groups.includes(owner)) {
 // Group ownership
 isOwned = true;
 ownerType = 'group';
 } else if (owner.includes('@') && owner === user.email) {
 // Email-based ownership
 isOwned = true;
 ownerType = 'user';
 } else {
 // Check annotations for additional ownership info
 const annotations = entity.metadata.annotations || {};
 const maintainers = annotations['backstage.io/maintainers']?.split(',') || [];
 const teams = annotations['backstage.io/teams']?.split(',') || [];
 
 if (maintainers.some(maintainer => 
 maintainer.trim() === user.username || 
 maintainer.trim() === user.email
 )) {
 isOwned = true;
 ownerType = 'user';
 } else if (teams.some(team => user.groups.includes(team.trim()))) {
 isOwned = true;
 ownerType = 'group';
 }
 }

 // For demo purposes, make platform-team own some services
 if (!isOwned && user.groups.includes('platform-team')) {
 const platformServices = ['user-service', 'auth-service', 'api-gateway', 'metrics-service'];
 if (platformServices.some(service => entity.metadata.name.includes(service))) {
 isOwned = true;
 ownerType = 'group';
 }
 }

 // Determine permissions based on ownership and roles
 const permissions = this.determinePermissions(entity, user, isOwned);

 return {
 entityRef,
 name: entity.metadata.name,
 owner,
 ownerType,
 isOwned,
 permissions
 };
 }

 private determinePermissions(entity: Entity, user: UserProfile, isOwned: boolean): string[] {
 const permissions: string[] = ['read'];
 
 if (isOwned) {
 permissions.push('write', 'deploy', 'configure');
 }
 
 if (user.roles.includes('admin') || user.roles.includes('platform-engineer')) {
 permissions.push('write', 'deploy', 'configure', 'delete');
 }
 
 if (user.groups.includes('platform-team')) {
 permissions.push('monitor', 'debug');
 }
 
 return [...new Set(permissions)]; // Remove duplicates
 }

 // Get services filtered by user ownership
 async getFilteredServices(includeOwned: boolean = true, includeNonOwned: boolean = false): Promise<string[]> {
 const allServices = await this.getAllServicesWithOwnership();
 
 return allServices
 .filter(service => 
 (includeOwned && service.isOwned) || 
 (includeNonOwned && !service.isOwned)
 )
 .map(service => service.entityRef);
 }

 // Check if user can perform action on service
 async canPerformAction(entityRef: string, action: string): Promise<boolean> {
 const allServices = await this.getAllServicesWithOwnership();
 const service = allServices.find(s => s.entityRef === entityRef);
 
 return service?.permissions.includes(action) || false;
 }

 // Get ownership summary for dashboard
 async getOwnershipSummary(): Promise<{
 totalServices: number;
 ownedServices: number;
 ownedByUser: number;
 ownedByGroup: number;
 permissions: { [key: string]: number };
 }> {
 const allServices = await this.getAllServicesWithOwnership();
 const ownedServices = allServices.filter(s => s.isOwned);
 
 const summary = {
 totalServices: allServices.length,
 ownedServices: ownedServices.length,
 ownedByUser: ownedServices.filter(s => s.ownerType === 'user').length,
 ownedByGroup: ownedServices.filter(s => s.ownerType === 'group').length,
 permissions: {} as { [key: string]: number }
 };

 // Count permissions
 const allPermissions = ownedServices.flatMap(s => s.permissions);
 allPermissions.forEach(permission => {
 summary.permissions[permission] = (summary.permissions[permission] || 0) + 1;
 });

 return summary;
 }

 // Clear cache
 clearCache(): void {
 this.ownedServices.clear();
 this.cacheExpiry = 0;
 }
}

export const ownershipService = new OwnershipService();