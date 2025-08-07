import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import { ExtractedDocumentation } from './DocumentationExtractor';
import { ProcessedMarkdown } from './MarkdownProcessor';
import { OpenAPISpec } from './APIDocGenerator';

export interface CacheEntry<T = any> {
  data: T;
  hash: string;
  lastModified: number;
  expires: number;
  version: string;
  metadata: {
    filePath?: string;
    dependencies?: string[];
    size: number;
    createdAt: number;
  };
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  expiredEntries: number;
  memoryUsage: number;
}

export interface IncrementalUpdate {
  type: 'added' | 'modified' | 'deleted';
  filePath: string;
  hash?: string;
  timestamp: number;
}

export class DocumentationCache {
  private memoryCache = new Map<string, CacheEntry>();
  private diskCacheDir: string;
  private maxMemorySize: number;
  private maxDiskSize: number;
  private cacheVersion = '1.0.0';
  
  // Statistics
  private stats = {
    hits: 0,
    misses: 0,
    totalRequests: 0,
  };

  // File watchers for incremental updates
  private fileWatchers = new Map<string, fs.FSWatcher>();
  private pendingUpdates = new Map<string, IncrementalUpdate>();
  private updateCallbacks = new Set<(updates: IncrementalUpdate[]) => void>();

  constructor(
    private options: {
      cacheDir?: string;
      maxMemorySize?: number; // in bytes
      maxDiskSize?: number; // in bytes
      enableIncrementalUpdate?: boolean;
      compressionEnabled?: boolean;
      encryptionKey?: string;
    } = {}
  ) {
    this.diskCacheDir = options.cacheDir || path.join(process.cwd(), '.cache', 'docs');
    this.maxMemorySize = options.maxMemorySize || 100 * 1024 * 1024; // 100MB
    this.maxDiskSize = options.maxDiskSize || 1024 * 1024 * 1024; // 1GB

    this.initializeCache();
  }

  private async initializeCache(): Promise<void> {
    try {
      await fs.mkdir(this.diskCacheDir, { recursive: true });
      await this.loadCacheMetadata();
      await this.cleanupExpiredEntries();
    } catch (error) {
      console.warn('Failed to initialize documentation cache:', error);
    }
  }

  /**
   * Get cached documentation
   */
  async get<T = any>(key: string): Promise<T | null> {
    this.stats.totalRequests++;

    // Check memory cache first
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && !this.isExpired(memoryEntry)) {
      this.stats.hits++;
      return memoryEntry.data;
    }

    // Check disk cache
    try {
      const diskEntry = await this.loadFromDisk<T>(key);
      if (diskEntry && !this.isExpired(diskEntry)) {
        // Move to memory cache
        this.memoryCache.set(key, diskEntry);
        await this.enforceMemoryLimit();
        
        this.stats.hits++;
        return diskEntry.data;
      }
    } catch (error) {
      // Disk cache miss or error, continue
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Set cached documentation
   */
  async set<T = any>(
    key: string,
    data: T,
    options: {
      filePath?: string;
      dependencies?: string[];
      ttl?: number; // time to live in ms
    } = {}
  ): Promise<void> {
    const ttl = options.ttl || 24 * 60 * 60 * 1000; // 24 hours default
    const hash = this.generateHash(data);
    const now = Date.now();

    const entry: CacheEntry<T> = {
      data,
      hash,
      lastModified: now,
      expires: now + ttl,
      version: this.cacheVersion,
      metadata: {
        filePath: options.filePath,
        dependencies: options.dependencies || [],
        size: this.calculateSize(data),
        createdAt: now,
      },
    };

    // Set in memory cache
    this.memoryCache.set(key, entry);
    await this.enforceMemoryLimit();

    // Set in disk cache
    try {
      await this.saveToDisk(key, entry);
      await this.enforceDiskLimit();
    } catch (error) {
      console.warn(`Failed to save ${key} to disk cache:`, error);
    }

    // Set up file watching for incremental updates
    if (this.options.enableIncrementalUpdate && options.filePath) {
      await this.watchFile(options.filePath, key);
    }
  }

  /**
   * Invalidate cache entry
   */
  async invalidate(key: string): Promise<void> {
    this.memoryCache.delete(key);
    
    try {
      const diskPath = this.getDiskPath(key);
      await fs.unlink(diskPath);
    } catch (error) {
      // File might not exist
    }

    // Stop watching file if exists
    const entry = this.memoryCache.get(key);
    if (entry?.metadata.filePath) {
      this.stopWatchingFile(entry.metadata.filePath);
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    
    try {
      await fs.rm(this.diskCacheDir, { recursive: true, force: true });
      await fs.mkdir(this.diskCacheDir, { recursive: true });
    } catch (error) {
      console.warn('Failed to clear disk cache:', error);
    }

    // Stop all file watchers
    for (const watcher of this.fileWatchers.values()) {
      watcher.close();
    }
    this.fileWatchers.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const memorySize = Array.from(this.memoryCache.values())
      .reduce((sum, entry) => sum + entry.metadata.size, 0);

    const expiredEntries = Array.from(this.memoryCache.values())
      .filter(entry => this.isExpired(entry)).length;

    return {
      totalEntries: this.memoryCache.size,
      totalSize: memorySize,
      hitRate: this.stats.totalRequests > 0 ? this.stats.hits / this.stats.totalRequests : 0,
      missRate: this.stats.totalRequests > 0 ? this.stats.misses / this.stats.totalRequests : 0,
      expiredEntries,
      memoryUsage: memorySize,
    };
  }

  /**
   * Get or compute cached value
   */
  async getOrCompute<T>(
    key: string,
    computeFn: () => Promise<T>,
    options: {
      filePath?: string;
      dependencies?: string[];
      ttl?: number;
    } = {}
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const computed = await computeFn();
    await this.set(key, computed, options);
    return computed;
  }

  /**
   * Bulk invalidation by pattern
   */
  async invalidatePattern(pattern: RegExp): Promise<number> {
    let invalidated = 0;

    // Invalidate memory cache
    for (const key of this.memoryCache.keys()) {
      if (pattern.test(key)) {
        await this.invalidate(key);
        invalidated++;
      }
    }

    // Invalidate disk cache
    try {
      const files = await fs.readdir(this.diskCacheDir);
      for (const file of files) {
        const key = this.keyFromFilename(file);
        if (pattern.test(key)) {
          await fs.unlink(path.join(this.diskCacheDir, file));
          invalidated++;
        }
      }
    } catch (error) {
      console.warn('Failed to invalidate disk cache pattern:', error);
    }

    return invalidated;
  }

  /**
   * Subscribe to incremental updates
   */
  onIncrementalUpdate(callback: (updates: IncrementalUpdate[]) => void): () => void {
    this.updateCallbacks.add(callback);
    
    return () => {
      this.updateCallbacks.delete(callback);
    };
  }

  /**
   * Process pending incremental updates
   */
  async processPendingUpdates(): Promise<void> {
    if (this.pendingUpdates.size === 0) return;

    const updates = Array.from(this.pendingUpdates.values());
    this.pendingUpdates.clear();

    // Invalidate affected cache entries
    for (const update of updates) {
      await this.invalidateByFilePath(update.filePath);
    }

    // Notify subscribers
    for (const callback of this.updateCallbacks) {
      try {
        callback(updates);
      } catch (error) {
        console.error('Error in incremental update callback:', error);
      }
    }
  }

  /**
   * Export cache contents for backup
   */
  async exportCache(): Promise<Record<string, CacheEntry>> {
    const exported: Record<string, CacheEntry> = {};

    // Export memory cache
    for (const [key, entry] of this.memoryCache) {
      exported[key] = entry;
    }

    // Export disk cache
    try {
      const files = await fs.readdir(this.diskCacheDir);
      for (const file of files) {
        const key = this.keyFromFilename(file);
        if (!exported[key]) {
          const entry = await this.loadFromDisk(key);
          if (entry) {
            exported[key] = entry;
          }
        }
      }
    } catch (error) {
      console.warn('Failed to export disk cache:', error);
    }

    return exported;
  }

  /**
   * Import cache contents from backup
   */
  async importCache(backup: Record<string, CacheEntry>): Promise<void> {
    for (const [key, entry] of Object.entries(backup)) {
      if (!this.isExpired(entry)) {
        await this.set(key, entry.data, {
          filePath: entry.metadata.filePath,
          dependencies: entry.metadata.dependencies,
          ttl: entry.expires - Date.now(),
        });
      }
    }
  }

  // Private methods
  private generateHash(data: any): string {
    return createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');
  }

  private calculateSize(data: any): number {
    return Buffer.byteLength(JSON.stringify(data), 'utf8');
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() > entry.expires;
  }

  private getDiskPath(key: string): string {
    const filename = this.sanitizeKey(key) + '.json';
    return path.join(this.diskCacheDir, filename);
  }

  private sanitizeKey(key: string): string {
    return key.replace(/[^a-zA-Z0-9-_]/g, '_');
  }

  private keyFromFilename(filename: string): string {
    return filename.replace('.json', '');
  }

  private async loadFromDisk<T>(key: string): Promise<CacheEntry<T> | null> {
    try {
      const filePath = this.getDiskPath(key);
      const content = await fs.readFile(filePath, 'utf8');
      
      let entry: CacheEntry<T>;
      if (this.options.compressionEnabled) {
        // Decompress if needed
        entry = JSON.parse(content);
      } else {
        entry = JSON.parse(content);
      }

      // Verify version compatibility
      if (entry.version !== this.cacheVersion) {
        await fs.unlink(filePath);
        return null;
      }

      return entry;
    } catch (error) {
      return null;
    }
  }

  private async saveToDisk<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    const filePath = this.getDiskPath(key);
    let content: string;

    if (this.options.compressionEnabled) {
      // Compress if needed
      content = JSON.stringify(entry);
    } else {
      content = JSON.stringify(entry);
    }

    await fs.writeFile(filePath, content, 'utf8');
  }

  private async enforceMemoryLimit(): Promise<void> {
    const currentSize = Array.from(this.memoryCache.values())
      .reduce((sum, entry) => sum + entry.metadata.size, 0);

    if (currentSize <= this.maxMemorySize) return;

    // Sort by last modified (LRU)
    const entries = Array.from(this.memoryCache.entries())
      .sort((a, b) => a[1].lastModified - b[1].lastModified);

    let removedSize = 0;
    const targetSize = this.maxMemorySize * 0.8; // Remove 20% extra to avoid frequent cleanup

    for (const [key, entry] of entries) {
      this.memoryCache.delete(key);
      removedSize += entry.metadata.size;

      if (currentSize - removedSize <= targetSize) {
        break;
      }
    }
  }

  private async enforceDiskLimit(): Promise<void> {
    try {
      const files = await fs.readdir(this.diskCacheDir, { withFileTypes: true });
      let totalSize = 0;

      const fileStats = await Promise.all(
        files
          .filter(file => file.isFile())
          .map(async file => {
            const filePath = path.join(this.diskCacheDir, file.name);
            const stats = await fs.stat(filePath);
            totalSize += stats.size;
            return {
              name: file.name,
              path: filePath,
              size: stats.size,
              mtime: stats.mtime.getTime(),
            };
          })
      );

      if (totalSize <= this.maxDiskSize) return;

      // Sort by modification time (LRU)
      fileStats.sort((a, b) => a.mtime - b.mtime);

      let removedSize = 0;
      const targetSize = this.maxDiskSize * 0.8;

      for (const file of fileStats) {
        await fs.unlink(file.path);
        removedSize += file.size;

        if (totalSize - removedSize <= targetSize) {
          break;
        }
      }
    } catch (error) {
      console.warn('Failed to enforce disk cache limit:', error);
    }
  }

  private async watchFile(filePath: string, cacheKey: string): Promise<void> {
    if (this.fileWatchers.has(filePath)) return;

    try {
      const watcher = fs.watch(filePath, (eventType) => {
        if (eventType === 'rename' || eventType === 'change') {
          const update: IncrementalUpdate = {
            type: eventType === 'rename' ? 'deleted' : 'modified',
            filePath,
            timestamp: Date.now(),
          };

          this.pendingUpdates.set(filePath, update);

          // Debounce updates
          setTimeout(() => {
            this.processPendingUpdates();
          }, 1000);
        }
      });

      this.fileWatchers.set(filePath, watcher);
    } catch (error) {
      console.warn(`Failed to watch file ${filePath}:`, error);
    }
  }

  private stopWatchingFile(filePath: string): void {
    const watcher = this.fileWatchers.get(filePath);
    if (watcher) {
      watcher.close();
      this.fileWatchers.delete(filePath);
    }
  }

  private async invalidateByFilePath(filePath: string): Promise<void> {
    const keysToInvalidate: string[] = [];

    // Find all cache entries that depend on this file
    for (const [key, entry] of this.memoryCache) {
      if (
        entry.metadata.filePath === filePath ||
        entry.metadata.dependencies?.includes(filePath)
      ) {
        keysToInvalidate.push(key);
      }
    }

    // Invalidate found entries
    for (const key of keysToInvalidate) {
      await this.invalidate(key);
    }
  }

  private async loadCacheMetadata(): Promise<void> {
    try {
      const metadataPath = path.join(this.diskCacheDir, '.metadata.json');
      const content = await fs.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(content);
      
      // Load any persistent cache metadata
      if (metadata.version !== this.cacheVersion) {
        // Version mismatch, clear cache
        await this.clear();
      }
    } catch (error) {
      // No metadata file, create one
      await this.saveCacheMetadata();
    }
  }

  private async saveCacheMetadata(): Promise<void> {
    try {
      const metadata = {
        version: this.cacheVersion,
        lastUpdated: Date.now(),
        stats: this.getStats(),
      };

      const metadataPath = path.join(this.diskCacheDir, '.metadata.json');
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
    } catch (error) {
      console.warn('Failed to save cache metadata:', error);
    }
  }

  private async cleanupExpiredEntries(): Promise<void> {
    // Cleanup memory cache
    for (const [key, entry] of this.memoryCache) {
      if (this.isExpired(entry)) {
        this.memoryCache.delete(key);
      }
    }

    // Cleanup disk cache
    try {
      const files = await fs.readdir(this.diskCacheDir);
      for (const file of files) {
        if (file === '.metadata.json') continue;
        
        const key = this.keyFromFilename(file);
        const entry = await this.loadFromDisk(key);
        
        if (!entry || this.isExpired(entry)) {
          await fs.unlink(path.join(this.diskCacheDir, file));
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup expired disk cache entries:', error);
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    // Save metadata
    await this.saveCacheMetadata();

    // Close all file watchers
    for (const watcher of this.fileWatchers.values()) {
      watcher.close();
    }
    this.fileWatchers.clear();

    // Process any pending updates
    await this.processPendingUpdates();
  }
}

// Global cache instance
let globalCache: DocumentationCache | null = null;

export function getDocumentationCache(): DocumentationCache {
  if (!globalCache) {
    globalCache = new DocumentationCache({
      enableIncrementalUpdate: true,
      compressionEnabled: false, // Enable if needed for large documentation
      maxMemorySize: 100 * 1024 * 1024, // 100MB
      maxDiskSize: 1024 * 1024 * 1024, // 1GB
    });
  }
  return globalCache;
}

export async function shutdownDocumentationCache(): Promise<void> {
  if (globalCache) {
    await globalCache.shutdown();
    globalCache = null;
  }
}

export default DocumentationCache;