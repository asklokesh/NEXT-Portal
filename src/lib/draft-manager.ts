/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
export interface ServiceDraft {
 id: string;
 name: string;
 formData: any;
 currentStep: number;
 selectedTemplate?: string;
 createdAt: Date;
 updatedAt: Date;
 autoSaved: boolean;
}

export class DraftManager {
 private static readonly STORAGE_KEY = 'backstage-service-drafts';
 private static readonly AUTO_SAVE_INTERVAL = 30000; // 30 seconds
 private static readonly MAX_DRAFTS = 10;

 /**
 * Save a draft to localStorage
 */
 static saveDraft(draft: Omit<ServiceDraft, 'id' | 'createdAt' | 'updatedAt'>): string {
 const drafts = this.getAllDrafts();
 const now = new Date();
 
 // Generate ID based on name or timestamp
 const id = draft.name ? 
 `${draft.name}-${now.getTime()}` : 
 `draft-${now.getTime()}`;

 const newDraft: ServiceDraft = {
 ...draft,
 id,
 createdAt: now,
 updatedAt: now,
 };

 // Add to drafts array
 drafts.unshift(newDraft);

 // Keep only the most recent drafts
 const limitedDrafts = drafts.slice(0, this.MAX_DRAFTS);

 // Save to localStorage
 localStorage.setItem(this.STORAGE_KEY, JSON.stringify(limitedDrafts));
 
 return id;
 }

 /**
 * Update an existing draft
 */
 static updateDraft(id: string, updates: Partial<ServiceDraft>): boolean {
 const drafts = this.getAllDrafts();
 const draftIndex = drafts.findIndex(d => d.id === id);
 
 if (draftIndex === -1) return false;

 drafts[draftIndex] = {
 ...drafts[draftIndex],
 ...updates,
 updatedAt: new Date(),
 };

 localStorage.setItem(this.STORAGE_KEY, JSON.stringify(drafts));
 return true;
 }

 /**
 * Get all drafts
 */
 static getAllDrafts(): ServiceDraft[] {
 try {
 const stored = localStorage.getItem(this.STORAGE_KEY);
 if (!stored) return [];

 const drafts = JSON.parse(stored);
 
 // Convert date strings back to Date objects
 return drafts.map((draft: any) => ({
 ...draft,
 createdAt: new Date(draft.createdAt),
 updatedAt: new Date(draft.updatedAt),
 }));
 } catch (error) {
 console.error('Failed to load drafts:', error);
 return [];
 }
 }

 /**
 * Get a specific draft by ID
 */
 static getDraft(id: string): ServiceDraft | null {
 const drafts = this.getAllDrafts();
 return drafts.find(d => d.id === id) || null;
 }

 /**
 * Delete a draft
 */
 static deleteDraft(id: string): boolean {
 const drafts = this.getAllDrafts();
 const filteredDrafts = drafts.filter(d => d.id !== id);
 
 if (filteredDrafts.length === drafts.length) return false;

 localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredDrafts));
 return true;
 }

 /**
 * Clear all drafts
 */
 static clearAllDrafts(): void {
 localStorage.removeItem(this.STORAGE_KEY);
 }

 /**
 * Get recent drafts (last 5)
 */
 static getRecentDrafts(): ServiceDraft[] {
 return this.getAllDrafts().slice(0, 5);
 }

 /**
 * Check if there's a draft for a specific service name
 */
 static hasDraftForService(serviceName: string): ServiceDraft | null {
 const drafts = this.getAllDrafts();
 return drafts.find(d => 
 d.formData?.name === serviceName || 
 d.name === serviceName
 ) || null;
 }

 /**
 * Auto-save a draft (with debouncing)
 */
 static autoSave = (() => {
 let timeoutId: NodeJS.Timeout | null = null;
 
 return (
 formData: any,
 currentStep: number,
 selectedTemplate?: string,
 existingDraftId?: string
 ) => {
 if (timeoutId) {
 clearTimeout(timeoutId);
 }

 timeoutId = setTimeout(() => {
 const draftName = formData?.name || `Untitled Service ${new Date().toLocaleTimeString()}`;
 
 if (existingDraftId) {
 this.updateDraft(existingDraftId, {
 formData,
 currentStep,
 selectedTemplate,
 autoSaved: true,
 });
 } else {
 this.saveDraft({
 name: draftName,
 formData,
 currentStep,
 selectedTemplate,
 autoSaved: true,
 });
 }
 }, 2000); // 2 second debounce
 };
 })();

 /**
 * Format relative time for display
 */
 static getRelativeTime(date: Date): string {
 const now = new Date();
 const diffMs = now.getTime() - date.getTime();
 const diffMins = Math.floor(diffMs / 60000);
 const diffHours = Math.floor(diffMins / 60);
 const diffDays = Math.floor(diffHours / 24);

 if (diffMins < 1) return 'Just now';
 if (diffMins < 60) return `${diffMins} min ago`;
 if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
 if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
 
 return date.toLocaleDateString();
 }

 /**
 * Clean up old drafts (older than 30 days)
 */
 static cleanupOldDrafts(): void {
 const drafts = this.getAllDrafts();
 const thirtyDaysAgo = new Date();
 thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

 const filteredDrafts = drafts.filter(draft => 
 draft.updatedAt > thirtyDaysAgo
 );

 if (filteredDrafts.length !== drafts.length) {
 localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredDrafts));
 }
 }

 /**
 * Export drafts as JSON
 */
 static exportDrafts(): string {
 const drafts = this.getAllDrafts();
 return JSON.stringify(drafts, null, 2);
 }

 /**
 * Import drafts from JSON
 */
 static importDrafts(jsonData: string): boolean {
 try {
 const imported = JSON.parse(jsonData);
 if (Array.isArray(imported)) {
 const existingDrafts = this.getAllDrafts();
 const mergedDrafts = [...imported, ...existingDrafts].slice(0, this.MAX_DRAFTS);
 localStorage.setItem(this.STORAGE_KEY, JSON.stringify(mergedDrafts));
 return true;
 }
 } catch (error) {
 console.error('Failed to import drafts:', error);
 }
 return false;
 }
}