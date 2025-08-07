import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkDirective from 'remark-directive';
import remarkToc from 'remark-toc';
import remarkHtml from 'remark-html';
import rehypeParse from 'rehype-parse';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';
import matter from 'gray-matter';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface TechDocsConfig {
  storageProvider: 'local' | 's3' | 'gcs' | 'azure';
  storageConfig: Record<string, any>;
  cacheDuration: number;
  supportedFormats: string[];
  enableVersioning: boolean;
  enableSearch: boolean;
  enableLiveReload: boolean;
}

export interface TechDocsEntity {
  id: string;
  name: string;
  namespace: string;
  kind: string;
  metadata: {
    title: string;
    description?: string;
    tags?: string[];
    owner?: string;
    techdocs?: {
      builder?: string;
      annotations?: Record<string, string>;
    };
  };
  spec?: {
    type?: string;
    owner?: string;
    lifecycle?: string;
  };
}

export interface TechDocsVersion {
  version: string;
  timestamp: Date;
  author?: string;
  message?: string;
  hash: string;
}

export interface TechDocsPage {
  id: string;
  title: string;
  content: string;
  htmlContent?: string;
  path: string;
  entityRef: string;
  metadata: Record<string, any>;
  frontmatter?: Record<string, any>;
  toc?: TocItem[];
  lastModified: Date;
  version?: string;
}

export interface TocItem {
  title: string;
  url: string;
  items?: TocItem[];
  depth: number;
}

export interface RenderOptions {
  format?: 'markdown' | 'mdx' | 'asciidoc';
  theme?: string;
  syntaxHighlight?: boolean;
  generateToc?: boolean;
  includeMetadata?: boolean;
}

export interface SearchResult {
  entityRef: string;
  page: string;
  title: string;
  excerpt: string;
  score: number;
  highlights: string[];
}

export class TechDocsService {
  private config: TechDocsConfig;
  private storageProvider: StorageProvider;
  private searchIndex: SearchIndex;
  private cache: Map<string, CachedDoc>;
  private markdownProcessor: any;
  private versionManager: VersionManager;

  constructor(config: TechDocsConfig) {
    this.config = config;
    this.cache = new Map();
    this.storageProvider = this.createStorageProvider();
    this.searchIndex = new SearchIndex();
    this.versionManager = new VersionManager();
    this.initializeProcessors();
  }

  private initializeProcessors() {
    // Initialize Markdown processor with plugins
    this.markdownProcessor = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkFrontmatter, ['yaml', 'toml'])
      .use(remarkDirective)
      .use(remarkToc, { heading: 'Table of Contents', maxDepth: 3 })
      .use(remarkHtml, { sanitize: false });
  }

  private createStorageProvider(): StorageProvider {
    switch (this.config.storageProvider) {
      case 's3':
        return new S3StorageProvider(this.config.storageConfig);
      case 'gcs':
        return new GCSStorageProvider(this.config.storageConfig);
      case 'azure':
        return new AzureStorageProvider(this.config.storageConfig);
      default:
        return new LocalStorageProvider(this.config.storageConfig);
    }
  }

  // Render documentation from source
  async renderDocs(
    entity: TechDocsEntity,
    sourcePath: string,
    options: RenderOptions = {}
  ): Promise<TechDocsPage[]> {
    const entityRef = `${entity.kind}:${entity.namespace}/${entity.name}`;
    const cacheKey = `${entityRef}:${sourcePath}`;

    // Check cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < this.config.cacheDuration) {
        return cached.pages;
      }
    }

    // Process documentation files
    const pages = await this.processDocumentationFiles(
      entity,
      sourcePath,
      options
    );

    // Store in cache
    this.cache.set(cacheKey, {
      pages,
      timestamp: Date.now(),
      entityRef
    });

    // Index for search if enabled
    if (this.config.enableSearch) {
      await this.indexPages(pages, entityRef);
    }

    // Store rendered docs
    await this.storageProvider.store(entityRef, pages);

    return pages;
  }

  // Process documentation files
  private async processDocumentationFiles(
    entity: TechDocsEntity,
    sourcePath: string,
    options: RenderOptions
  ): Promise<TechDocsPage[]> {
    const pages: TechDocsPage[] = [];
    const files = await this.findDocumentationFiles(sourcePath);

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const processed = await this.processMarkdown(content, file, entity, options);
      pages.push(processed);
    }

    return pages;
  }

  // Process individual markdown file
  private async processMarkdown(
    content: string,
    filePath: string,
    entity: TechDocsEntity,
    options: RenderOptions
  ): Promise<TechDocsPage> {
    // Extract frontmatter
    const { data: frontmatter, content: markdownContent } = matter(content);

    // Process markdown to HTML
    const htmlProcessor = unified()
      .use(rehypeParse, { fragment: true })
      .use(rehypeSlug)
      .use(rehypeAutolinkHeadings, { behavior: 'wrap' });

    if (options.syntaxHighlight !== false) {
      htmlProcessor.use(rehypeHighlight);
    }

    const result = await this.markdownProcessor.process(markdownContent);
    const htmlResult = await htmlProcessor
      .use(rehypeStringify)
      .process(String(result));

    // Generate TOC
    const toc = options.generateToc !== false
      ? this.generateTableOfContents(String(htmlResult))
      : undefined;

    // Create page object
    const page: TechDocsPage = {
      id: crypto.randomUUID(),
      title: frontmatter.title || path.basename(filePath, path.extname(filePath)),
      content: markdownContent,
      htmlContent: String(htmlResult),
      path: filePath,
      entityRef: `${entity.kind}:${entity.namespace}/${entity.name}`,
      metadata: {
        ...frontmatter,
        entity: entity.metadata
      },
      frontmatter,
      toc,
      lastModified: new Date(),
      version: await this.versionManager.getCurrentVersion()
    };

    return page;
  }

  // Generate table of contents from HTML
  private generateTableOfContents(html: string): TocItem[] {
    const toc: TocItem[] = [];
    const headingRegex = /<h([1-6])[^>]*id="([^"]+)"[^>]*>([^<]+)<\/h\1>/gi;
    let match;

    while ((match = headingRegex.exec(html)) !== null) {
      const depth = parseInt(match[1]);
      const id = match[2];
      const title = match[3];

      toc.push({
        title,
        url: `#${id}`,
        depth,
        items: []
      });
    }

    return this.nestTocItems(toc);
  }

  // Nest TOC items based on depth
  private nestTocItems(items: TocItem[]): TocItem[] {
    const nested: TocItem[] = [];
    const stack: TocItem[] = [];

    for (const item of items) {
      while (stack.length > 0 && stack[stack.length - 1].depth >= item.depth) {
        stack.pop();
      }

      if (stack.length === 0) {
        nested.push(item);
      } else {
        const parent = stack[stack.length - 1];
        if (!parent.items) parent.items = [];
        parent.items.push(item);
      }

      stack.push(item);
    }

    return nested;
  }

  // Find documentation files
  private async findDocumentationFiles(sourcePath: string): Promise<string[]> {
    const files: string[] = [];
    const supportedExtensions = this.config.supportedFormats || ['.md', '.mdx'];

    async function walk(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (supportedExtensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    }

    await walk(sourcePath);
    return files;
  }

  // Index pages for search
  private async indexPages(pages: TechDocsPage[], entityRef: string) {
    for (const page of pages) {
      await this.searchIndex.index({
        id: page.id,
        entityRef,
        title: page.title,
        content: page.content,
        metadata: page.metadata,
        path: page.path
      });
    }
  }

  // Search documentation
  async search(query: string, filters?: SearchFilters): Promise<SearchResult[]> {
    return this.searchIndex.search(query, filters);
  }

  // Get documentation for entity
  async getDocsForEntity(entityRef: string): Promise<TechDocsPage[]> {
    // Check cache first
    const cached = Array.from(this.cache.values())
      .find(c => c.entityRef === entityRef);

    if (cached && Date.now() - cached.timestamp < this.config.cacheDuration) {
      return cached.pages;
    }

    // Retrieve from storage
    return this.storageProvider.retrieve(entityRef);
  }

  // Get specific page
  async getPage(entityRef: string, pagePath: string): Promise<TechDocsPage | null> {
    const pages = await this.getDocsForEntity(entityRef);
    return pages.find(p => p.path === pagePath) || null;
  }

  // Publish documentation
  async publish(
    entity: TechDocsEntity,
    sourcePath: string,
    version?: string,
    message?: string
  ): Promise<void> {
    // Render docs
    const pages = await this.renderDocs(entity, sourcePath);

    // Create version if versioning enabled
    if (this.config.enableVersioning) {
      await this.versionManager.createVersion({
        version: version || 'latest',
        timestamp: new Date(),
        message,
        hash: crypto.randomUUID(),
        pages
      });
    }

    // Store in permanent storage
    const entityRef = `${entity.kind}:${entity.namespace}/${entity.name}`;
    await this.storageProvider.store(entityRef, pages);

    // Clear cache
    this.clearCacheForEntity(entityRef);
  }

  // Clear cache for entity
  private clearCacheForEntity(entityRef: string) {
    for (const [key, value] of this.cache.entries()) {
      if (value.entityRef === entityRef) {
        this.cache.delete(key);
      }
    }
  }

  // Get versions for entity
  async getVersions(entityRef: string): Promise<TechDocsVersion[]> {
    return this.versionManager.getVersions(entityRef);
  }

  // Get specific version
  async getVersion(entityRef: string, version: string): Promise<TechDocsPage[]> {
    return this.versionManager.getVersion(entityRef, version);
  }

  // Delete documentation
  async deleteDocs(entityRef: string): Promise<void> {
    await this.storageProvider.delete(entityRef);
    this.clearCacheForEntity(entityRef);
    await this.searchIndex.removeEntity(entityRef);
  }
}

// Storage Provider Interface
interface StorageProvider {
  store(entityRef: string, pages: TechDocsPage[]): Promise<void>;
  retrieve(entityRef: string): Promise<TechDocsPage[]>;
  delete(entityRef: string): Promise<void>;
  exists(entityRef: string): Promise<boolean>;
}

// Local Storage Provider
class LocalStorageProvider implements StorageProvider {
  private basePath: string;

  constructor(config: Record<string, any>) {
    this.basePath = config.basePath || './techdocs';
  }

  async store(entityRef: string, pages: TechDocsPage[]): Promise<void> {
    const dir = path.join(this.basePath, entityRef);
    await fs.mkdir(dir, { recursive: true });

    for (const page of pages) {
      const filePath = path.join(dir, `${page.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(page, null, 2));
    }
  }

  async retrieve(entityRef: string): Promise<TechDocsPage[]> {
    const dir = path.join(this.basePath, entityRef);
    const pages: TechDocsPage[] = [];

    try {
      const files = await fs.readdir(dir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(dir, file), 'utf-8');
          pages.push(JSON.parse(content));
        }
      }
    } catch (error) {
      console.error(`Failed to retrieve docs for ${entityRef}:`, error);
    }

    return pages;
  }

  async delete(entityRef: string): Promise<void> {
    const dir = path.join(this.basePath, entityRef);
    await fs.rm(dir, { recursive: true, force: true });
  }

  async exists(entityRef: string): Promise<boolean> {
    const dir = path.join(this.basePath, entityRef);
    try {
      await fs.access(dir);
      return true;
    } catch {
      return false;
    }
  }
}

// Placeholder for cloud storage providers
class S3StorageProvider implements StorageProvider {
  constructor(config: Record<string, any>) {
    // Implementation would use AWS SDK
  }

  async store(entityRef: string, pages: TechDocsPage[]): Promise<void> {
    // Implementation
  }

  async retrieve(entityRef: string): Promise<TechDocsPage[]> {
    // Implementation
    return [];
  }

  async delete(entityRef: string): Promise<void> {
    // Implementation
  }

  async exists(entityRef: string): Promise<boolean> {
    // Implementation
    return false;
  }
}

class GCSStorageProvider implements StorageProvider {
  constructor(config: Record<string, any>) {
    // Implementation would use Google Cloud Storage SDK
  }

  async store(entityRef: string, pages: TechDocsPage[]): Promise<void> {
    // Implementation
  }

  async retrieve(entityRef: string): Promise<TechDocsPage[]> {
    // Implementation
    return [];
  }

  async delete(entityRef: string): Promise<void> {
    // Implementation
  }

  async exists(entityRef: string): Promise<boolean> {
    // Implementation
    return false;
  }
}

class AzureStorageProvider implements StorageProvider {
  constructor(config: Record<string, any>) {
    // Implementation would use Azure Blob Storage SDK
  }

  async store(entityRef: string, pages: TechDocsPage[]): Promise<void> {
    // Implementation
  }

  async retrieve(entityRef: string): Promise<TechDocsPage[]> {
    // Implementation
    return [];
  }

  async delete(entityRef: string): Promise<void> {
    // Implementation
  }

  async exists(entityRef: string): Promise<boolean> {
    // Implementation
    return false;
  }
}

// Search Index
class SearchIndex {
  private index: Map<string, SearchDocument>;

  constructor() {
    this.index = new Map();
  }

  async index(document: SearchDocument): Promise<void> {
    this.index.set(document.id, document);
  }

  async search(query: string, filters?: SearchFilters): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();

    for (const doc of this.index.values()) {
      if (filters?.entityRef && doc.entityRef !== filters.entityRef) {
        continue;
      }

      const titleMatch = doc.title.toLowerCase().includes(queryLower);
      const contentMatch = doc.content.toLowerCase().includes(queryLower);

      if (titleMatch || contentMatch) {
        results.push({
          entityRef: doc.entityRef,
          page: doc.path,
          title: doc.title,
          excerpt: this.generateExcerpt(doc.content, query),
          score: titleMatch ? 2 : 1,
          highlights: this.generateHighlights(doc.content, query)
        });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  private generateExcerpt(content: string, query: string): string {
    const index = content.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return content.substring(0, 200);

    const start = Math.max(0, index - 100);
    const end = Math.min(content.length, index + query.length + 100);
    return content.substring(start, end);
  }

  private generateHighlights(content: string, query: string): string[] {
    const highlights: string[] = [];
    const queryLower = query.toLowerCase();
    const contentLower = content.toLowerCase();
    let index = 0;

    while ((index = contentLower.indexOf(queryLower, index)) !== -1) {
      const start = Math.max(0, index - 50);
      const end = Math.min(content.length, index + query.length + 50);
      highlights.push(content.substring(start, end));
      index += query.length;
    }

    return highlights.slice(0, 3);
  }

  async removeEntity(entityRef: string): Promise<void> {
    for (const [id, doc] of this.index.entries()) {
      if (doc.entityRef === entityRef) {
        this.index.delete(id);
      }
    }
  }
}

// Version Manager
class VersionManager {
  private versions: Map<string, VersionedDocs>;

  constructor() {
    this.versions = new Map();
  }

  async createVersion(versionData: VersionData): Promise<void> {
    const entityRef = versionData.pages[0]?.entityRef;
    if (!entityRef) return;

    if (!this.versions.has(entityRef)) {
      this.versions.set(entityRef, { versions: [] });
    }

    const versionedDocs = this.versions.get(entityRef)!;
    versionedDocs.versions.push({
      version: versionData.version,
      timestamp: versionData.timestamp,
      message: versionData.message,
      hash: versionData.hash,
      pages: versionData.pages
    });
  }

  async getVersions(entityRef: string): Promise<TechDocsVersion[]> {
    const versionedDocs = this.versions.get(entityRef);
    if (!versionedDocs) return [];

    return versionedDocs.versions.map(v => ({
      version: v.version,
      timestamp: v.timestamp,
      message: v.message,
      hash: v.hash
    }));
  }

  async getVersion(entityRef: string, version: string): Promise<TechDocsPage[]> {
    const versionedDocs = this.versions.get(entityRef);
    if (!versionedDocs) return [];

    const versionData = versionedDocs.versions.find(v => v.version === version);
    return versionData?.pages || [];
  }

  async getCurrentVersion(): Promise<string> {
    return 'latest';
  }
}

// Types
interface CachedDoc {
  pages: TechDocsPage[];
  timestamp: number;
  entityRef: string;
}

interface SearchDocument {
  id: string;
  entityRef: string;
  title: string;
  content: string;
  metadata: Record<string, any>;
  path: string;
}

interface SearchFilters {
  entityRef?: string;
  tags?: string[];
  owner?: string;
}

interface VersionData {
  version: string;
  timestamp: Date;
  message?: string;
  hash: string;
  pages: TechDocsPage[];
}

interface VersionedDocs {
  versions: VersionData[];
}

export default TechDocsService;