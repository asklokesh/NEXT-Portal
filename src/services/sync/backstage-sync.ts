import { apiAdapter } from '@/lib/backstage-compat';
import { catalogClient } from '@/services/backstage/clients/catalog.client';
import { scaffolderClient } from '@/services/backstage/clients/scaffolder.client';
import type { Entity } from '@/services/backstage/types/entities';
import type { TemplateEntity } from '@/services/backstage/types/templates';

export interface SyncOptions {
 entities?: boolean;
 templates?: boolean;
 locations?: boolean;
 plugins?: boolean;
 users?: boolean;
}

export interface SyncResult {
 success: boolean;
 entities?: {
 added: number;
 updated: number;
 deleted: number;
 errors: string[];
 };
 templates?: {
 added: number;
 updated: number;
 deleted: number;
 errors: string[];
 };
 timestamp: Date;
}

export interface SyncConflict {
 type: 'entity' | 'template';
 id: string;
 local: any;
 remote: any;
 resolution?: 'local' | 'remote' | 'merge';
}

export class BackstageSyncService {
 private static instance: BackstageSyncService;
 private syncInProgress = false;
 private lastSyncTime?: Date;
 private syncInterval?: NodeJS.Timeout;
 private conflictQueue: SyncConflict[] = [];

 private constructor() {}

 static getInstance(): BackstageSyncService {
 if (!BackstageSyncService.instance) {
 BackstageSyncService.instance = new BackstageSyncService();
 }
 return BackstageSyncService.instance;
 }

 // Start automatic sync with interval
 startAutoSync(intervalMinutes: number = 5, options: SyncOptions = { entities: true, templates: true }) {
 this.stopAutoSync(); // Clear any existing interval
 
 // Initial sync
 this.performSync(options);
 
 // Set up interval
 this.syncInterval = setInterval(() => {
 this.performSync(options);
 }, intervalMinutes * 60 * 1000);
 
 console.log(`Auto-sync started with ${intervalMinutes} minute interval`);
 }

 // Stop automatic sync
 stopAutoSync() {
 if (this.syncInterval) {
 clearInterval(this.syncInterval);
 this.syncInterval = undefined;
 console.log('Auto-sync stopped');
 }
 }

 // Perform manual sync
 async performSync(options: SyncOptions = { entities: true, templates: true }): Promise<SyncResult> {
 if (this.syncInProgress) {
 throw new Error('Sync already in progress');
 }

 this.syncInProgress = true;
 const result: SyncResult = {
 success: true,
 timestamp: new Date()
 };

 try {
 // Sync entities
 if (options.entities) {
 result.entities = await this.syncEntities();
 }

 // Sync templates
 if (options.templates) {
 result.templates = await this.syncTemplates();
 }

 // Sync locations
 if (options.locations) {
 await this.syncLocations();
 }

 // Sync users/groups
 if (options.users) {
 await this.syncUsers();
 }

 this.lastSyncTime = new Date();
 } catch (error) {
 result.success = false;
 console.error('Sync failed:', error);
 } finally {
 this.syncInProgress = false;
 }

 return result;
 }

 // Sync catalog entities
 private async syncEntities() {
 const result = {
 added: 0,
 updated: 0,
 deleted: 0,
 errors: [] as string[]
 };

 try {
 // Get all entities from Backstage
 const response = await catalogClient.getEntities({ limit: 1000 });
 const remoteEntities = response.items;
 
 // Get local entity cache
 const localEntities = await this.getLocalEntities();
 
 // Create maps for efficient lookup
 const remoteMap = new Map(remoteEntities.map(e => [e.metadata.uid, e]));
 const localMap = new Map(localEntities.map(e => [e.metadata.uid, e]));
 
 // Find entities to add
 for (const [uid, entity] of remoteMap) {
 if (!localMap.has(uid)) {
 try {
 await this.saveLocalEntity(entity);
 result.added++;
 } catch (error) {
 result.errors.push(`Failed to add entity ${uid}: ${error}`);
 }
 }
 }
 
 // Find entities to update
 for (const [uid, remoteEntity] of remoteMap) {
 if (localMap.has(uid)) {
 const localEntity = localMap.get(uid)!;
 if (this.hasEntityChanged(localEntity, remoteEntity)) {
 // Check for conflicts
 if (this.hasLocalModifications(localEntity)) {
 this.conflictQueue.push({
 type: 'entity',
 id: uid,
 local: localEntity,
 remote: remoteEntity
 });
 } else {
 try {
 await this.updateLocalEntity(remoteEntity);
 result.updated++;
 } catch (error) {
 result.errors.push(`Failed to update entity ${uid}: ${error}`);
 }
 }
 }
 }
 }
 
 // Find entities to delete
 for (const [uid, entity] of localMap) {
 if (!remoteMap.has(uid)) {
 try {
 await this.deleteLocalEntity(uid);
 result.deleted++;
 } catch (error) {
 result.errors.push(`Failed to delete entity ${uid}: ${error}`);
 }
 }
 }
 } catch (error) {
 result.errors.push(`Entity sync failed: ${error}`);
 }

 return result;
 }

 // Sync templates
 private async syncTemplates() {
 const result = {
 added: 0,
 updated: 0,
 deleted: 0,
 errors: [] as string[]
 };

 try {
 // Get all templates from Backstage
 const remoteTemplates = await scaffolderClient.getTemplates();
 
 // Get local template cache
 const localTemplates = await this.getLocalTemplates();
 
 // Create maps for efficient lookup
 const remoteMap = new Map(remoteTemplates.map(t => [t.metadata.uid, t]));
 const localMap = new Map(localTemplates.map(t => [t.metadata.uid, t]));
 
 // Similar sync logic as entities
 for (const [uid, template] of remoteMap) {
 if (!localMap.has(uid)) {
 try {
 await this.saveLocalTemplate(template);
 result.added++;
 } catch (error) {
 result.errors.push(`Failed to add template ${uid}: ${error}`);
 }
 } else {
 const localTemplate = localMap.get(uid)!;
 if (this.hasTemplateChanged(localTemplate, template)) {
 try {
 await this.updateLocalTemplate(template);
 result.updated++;
 } catch (error) {
 result.errors.push(`Failed to update template ${uid}: ${error}`);
 }
 }
 }
 }
 
 // Find templates to delete
 for (const [uid, template] of localMap) {
 if (!remoteMap.has(uid)) {
 try {
 await this.deleteLocalTemplate(uid);
 result.deleted++;
 } catch (error) {
 result.errors.push(`Failed to delete template ${uid}: ${error}`);
 }
 }
 }
 } catch (error) {
 result.errors.push(`Template sync failed: ${error}`);
 }

 return result;
 }

 // Sync catalog locations
 private async syncLocations() {
 try {
 const locations = await catalogClient.getLocations();
 await this.saveLocalLocations(locations);
 } catch (error) {
 console.error('Location sync failed:', error);
 }
 }

 // Sync users and groups
 private async syncUsers() {
 try {
 // Get users and groups from Backstage
 const users = await catalogClient.getEntitiesByKind('User');
 const groups = await catalogClient.getEntitiesByKind('Group');
 
 // Save to local cache
 await this.saveLocalUsers(users.items);
 await this.saveLocalGroups(groups.items);
 } catch (error) {
 console.error('User sync failed:', error);
 }
 }

 // Get sync status
 getSyncStatus() {
 return {
 inProgress: this.syncInProgress,
 lastSyncTime: this.lastSyncTime,
 autoSyncEnabled: !!this.syncInterval,
 pendingConflicts: this.conflictQueue.length
 };
 }

 // Get pending conflicts
 getConflicts(): SyncConflict[] {
 return [...this.conflictQueue];
 }

 // Resolve conflict
 async resolveConflict(conflictId: string, resolution: 'local' | 'remote' | 'merge') {
 const conflictIndex = this.conflictQueue.findIndex(c => c.id === conflictId);
 if (conflictIndex === -1) {
 throw new Error('Conflict not found');
 }

 const conflict = this.conflictQueue[conflictIndex];
 conflict.resolution = resolution;

 try {
 if (conflict.type === 'entity') {
 if (resolution === 'remote') {
 await this.updateLocalEntity(conflict.remote);
 } else if (resolution === 'merge') {
 // Implement merge logic
 const merged = this.mergeEntities(conflict.local, conflict.remote);
 await this.updateLocalEntity(merged);
 }
 // If 'local', do nothing (keep local version)
 }

 // Remove resolved conflict
 this.conflictQueue.splice(conflictIndex, 1);
 } catch (error) {
 throw new Error(`Failed to resolve conflict: ${error}`);
 }
 }

 // Helper methods for storage (fallback to in-memory if localStorage unavailable)
private storage: Map<string, string> = new Map();

private isClientSide(): boolean {
return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

private getStorageItem(key: string): string | null {
if (this.isClientSide()) {
return localStorage.getItem(key);
}
return this.storage.get(key) || null;
}

private setStorageItem(key: string, value: string): void {
if (this.isClientSide()) {
localStorage.setItem(key, value);
} else {
this.storage.set(key, value);
}
}
private async getLocalEntities(): Promise<Entity[]> {
 const stored = this.getStorageItem('backstage_entities');
 return stored ? JSON.parse(stored) : [];
 }

private async saveLocalEntity(entity: Entity) {
 const entities = await this.getLocalEntities();
 entities.push(entity);
 this.setStorageItem('backstage_entities', JSON.stringify(entities));
 }

private async updateLocalEntity(entity: Entity) {
 const entities = await this.getLocalEntities();
 const index = entities.findIndex(e => e.metadata.uid === entity.metadata.uid);
 if (index !== -1) {
 entities[index] = entity;
 this.setStorageItem('backstage_entities', JSON.stringify(entities));
 }
 }

private async deleteLocalEntity(uid: string) {
 const entities = await this.getLocalEntities();
 const filtered = entities.filter(e => e.metadata.uid !== uid);
 this.setStorageItem('backstage_entities', JSON.stringify(filtered));
 }

private async getLocalTemplates(): Promise<TemplateEntity[]> {
 const stored = this.getStorageItem('backstage_templates');
 return stored ? JSON.parse(stored) : [];
 }

private async saveLocalTemplate(template: TemplateEntity) {
 const templates = await this.getLocalTemplates();
 templates.push(template);
 this.setStorageItem('backstage_templates', JSON.stringify(templates));
 }

private async updateLocalTemplate(template: TemplateEntity) {
 const templates = await this.getLocalTemplates();
 const index = templates.findIndex(t => t.metadata.uid === template.metadata.uid);
 if (index !== -1) {
 templates[index] = template;
 this.setStorageItem('backstage_templates', JSON.stringify(templates));
 }
 }

private async deleteLocalTemplate(uid: string) {
 const templates = await this.getLocalTemplates();
 const filtered = templates.filter(t => t.metadata.uid !== uid);
 this.setStorageItem('backstage_templates', JSON.stringify(filtered));
 }

private async saveLocalLocations(locations: any[]) {
 this.setStorageItem('backstage_locations', JSON.stringify(locations));
 }

 private async saveLocalUsers(users: Entity[]) {
 this.setStorageItem('backstage_users', JSON.stringify(users));
 }

 private async saveLocalGroups(groups: Entity[]) {
 this.setStorageItem('backstage_groups', JSON.stringify(groups));
 }

 // Change detection
 private hasEntityChanged(local: Entity, remote: Entity): boolean {
 // Simple comparison - in production, use proper diff algorithm
 return JSON.stringify(local) !== JSON.stringify(remote);
 }

 private hasTemplateChanged(local: TemplateEntity, remote: TemplateEntity): boolean {
 return JSON.stringify(local) !== JSON.stringify(remote);
 }

 private hasLocalModifications(entity: Entity): boolean {
 // Check if entity has been modified locally
 // In production, track modification timestamps
 return entity.metadata.annotations?.['wrapper/modified'] === 'true';
 }

 // Merge entities (simple merge, in production use more sophisticated algorithm)
 private mergeEntities(local: Entity, remote: Entity): Entity {
 return {
 ...remote,
 metadata: {
 ...remote.metadata,
 annotations: {
 ...remote.metadata.annotations,
 ...local.metadata.annotations,
 'wrapper/merged': 'true',
 'wrapper/mergeTime': new Date().toISOString()
 }
 }
 };
 }
}

export const syncService = BackstageSyncService.getInstance();