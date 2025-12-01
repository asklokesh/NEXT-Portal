/**
 * RAG (Retrieval-Augmented Generation) Pipeline
 * Handles document ingestion, chunking, embedding, and retrieval
 */

import { v4 as uuidv4 } from 'uuid';
import {
  AIAssistantConfig,
  AIConversationContext,
  RAGDocument,
  RAGChunk,
  RAGContext,
  RAGSearchResult,
  RAGDocumentMetadata,
} from './types';

interface RAGSearchOptions {
  maxResults?: number;
  minScore?: number;
  filter?: {
    sourceTypes?: string[];
    teams?: string[];
    tags?: string[];
    dateRange?: { start: Date; end: Date };
  };
  rerank?: boolean;
}

interface DocumentSource {
  type: 'techdocs' | 'catalog' | 'github' | 'confluence' | 'slack' | 'custom';
  fetch: () => Promise<RawDocument[]>;
  transformers?: DocumentTransformer[];
}

interface RawDocument {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
}

type DocumentTransformer = (doc: RawDocument) => RawDocument;

export class RAGPipeline {
  private config: AIAssistantConfig;
  private documentSources: Map<string, DocumentSource> = new Map();
  private documents: Map<string, RAGDocument> = new Map();
  private chunks: Map<string, RAGChunk> = new Map();
  private embeddingCache: Map<string, number[]> = new Map();

  constructor(config: AIAssistantConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Register default document sources
    this.registerDefaultSources();

    // Initialize vector database connection
    await this.initializeVectorDB();

    console.log('RAG Pipeline initialized');
  }

  /**
   * Register a document source
   */
  registerSource(name: string, source: DocumentSource): void {
    this.documentSources.set(name, source);
  }

  /**
   * Ingest documents from a source
   */
  async ingestFromSource(sourceName: string): Promise<number> {
    const source = this.documentSources.get(sourceName);
    if (!source) {
      throw new Error(`Unknown source: ${sourceName}`);
    }

    const rawDocs = await source.fetch();
    let processedCount = 0;

    for (const rawDoc of rawDocs) {
      try {
        // Apply transformers
        let doc = rawDoc;
        if (source.transformers) {
          for (const transformer of source.transformers) {
            doc = transformer(doc);
          }
        }

        // Convert to RAG document
        const ragDoc = await this.processDocument(doc, source.type);
        this.documents.set(ragDoc.id, ragDoc);
        processedCount++;
      } catch (error) {
        console.error(`Failed to process document ${rawDoc.id}:`, error);
      }
    }

    // Batch index all chunks
    await this.indexDocuments(Array.from(this.documents.values()).slice(-processedCount));

    return processedCount;
  }

  /**
   * Ingest a single document
   */
  async ingestDocument(
    content: string,
    metadata: Partial<RAGDocumentMetadata>
  ): Promise<RAGDocument> {
    const doc: RAGDocument = {
      id: metadata.source || uuidv4(),
      content,
      metadata: {
        source: metadata.source || 'manual',
        sourceType: metadata.sourceType || 'documentation',
        title: metadata.title || 'Untitled',
        description: metadata.description,
        url: metadata.url,
        owner: metadata.owner,
        team: metadata.team,
        tags: metadata.tags || [],
        lastUpdated: metadata.lastUpdated || new Date(),
        lastIndexed: new Date(),
        accessLevel: metadata.accessLevel || 'public',
      },
      chunks: [],
    };

    // Chunk the document
    doc.chunks = await this.chunkDocument(doc);

    // Generate embeddings for chunks
    for (const chunk of doc.chunks) {
      chunk.embedding = await this.generateEmbedding(chunk.content);
    }

    // Store document
    this.documents.set(doc.id, doc);

    // Index in vector database
    await this.indexDocuments([doc]);

    return doc;
  }

  /**
   * Search for relevant documents
   */
  async search(
    query: string,
    context: AIConversationContext,
    options: RAGSearchOptions = {}
  ): Promise<RAGContext> {
    const startTime = Date.now();

    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query);

    // Apply query expansion
    const expandedQueries = await this.expandQuery(query, context);

    // Search vector database
    const results = await this.vectorSearch(queryEmbedding, {
      limit: options.maxResults || this.config.rag.maxResults,
      minScore: options.minScore || this.config.rag.minRelevanceScore,
      filter: this.buildFilter(options.filter, context),
    });

    // Optionally rerank results
    let finalResults = results;
    if (options.rerank !== false) {
      finalResults = await this.rerankResults(results, query, context);
    }

    return {
      query,
      results: finalResults,
      totalResults: results.length,
      searchTime: Date.now() - startTime,
    };
  }

  /**
   * Update a document
   */
  async updateDocument(
    documentId: string,
    updates: Partial<{ content: string; metadata: Partial<RAGDocumentMetadata> }>
  ): Promise<RAGDocument | null> {
    const doc = this.documents.get(documentId);
    if (!doc) return null;

    if (updates.content) {
      doc.content = updates.content;
      doc.chunks = await this.chunkDocument(doc);

      for (const chunk of doc.chunks) {
        chunk.embedding = await this.generateEmbedding(chunk.content);
      }
    }

    if (updates.metadata) {
      doc.metadata = { ...doc.metadata, ...updates.metadata };
    }

    doc.metadata.lastIndexed = new Date();
    this.documents.set(documentId, doc);

    await this.indexDocuments([doc]);

    return doc;
  }

  /**
   * Delete a document
   */
  async deleteDocument(documentId: string): Promise<boolean> {
    const doc = this.documents.get(documentId);
    if (!doc) return false;

    // Delete from vector database
    await this.deleteFromVectorDB(documentId);

    // Delete from local storage
    this.documents.delete(documentId);
    if (doc.chunks) {
      for (const chunk of doc.chunks) {
        this.chunks.delete(chunk.id);
      }
    }

    return true;
  }

  /**
   * Get document by ID
   */
  getDocument(documentId: string): RAGDocument | undefined {
    return this.documents.get(documentId);
  }

  /**
   * List all indexed documents
   */
  listDocuments(options?: {
    sourceType?: string;
    team?: string;
    limit?: number;
    offset?: number;
  }): RAGDocument[] {
    let docs = Array.from(this.documents.values());

    if (options?.sourceType) {
      docs = docs.filter(d => d.metadata.sourceType === options.sourceType);
    }

    if (options?.team) {
      docs = docs.filter(d => d.metadata.team === options.team);
    }

    const start = options?.offset || 0;
    const end = start + (options?.limit || 100);

    return docs.slice(start, end);
  }

  /**
   * Get indexing statistics
   */
  getStats(): {
    totalDocuments: number;
    totalChunks: number;
    bySourceType: Record<string, number>;
    lastIndexed: Date | null;
  } {
    const bySourceType: Record<string, number> = {};

    for (const doc of this.documents.values()) {
      const type = doc.metadata.sourceType;
      bySourceType[type] = (bySourceType[type] || 0) + 1;
    }

    let lastIndexed: Date | null = null;
    for (const doc of this.documents.values()) {
      if (!lastIndexed || doc.metadata.lastIndexed > lastIndexed) {
        lastIndexed = doc.metadata.lastIndexed;
      }
    }

    return {
      totalDocuments: this.documents.size,
      totalChunks: this.chunks.size,
      bySourceType,
      lastIndexed,
    };
  }

  // Private methods

  private registerDefaultSources(): void {
    // TechDocs source
    this.registerSource('techdocs', {
      type: 'techdocs',
      fetch: async () => this.fetchTechDocs(),
    });

    // Catalog source
    this.registerSource('catalog', {
      type: 'catalog',
      fetch: async () => this.fetchCatalogEntities(),
    });
  }

  private async initializeVectorDB(): Promise<void> {
    // Initialize connection to vector database
    // This would connect to Pinecone, Weaviate, etc.
    console.log(`Initializing vector DB: ${this.config.vectorDb.provider}`);
  }

  private async processDocument(
    rawDoc: RawDocument,
    sourceType: RAGDocumentMetadata['sourceType']
  ): Promise<RAGDocument> {
    const doc: RAGDocument = {
      id: rawDoc.id,
      content: rawDoc.content,
      metadata: {
        source: String(rawDoc.metadata.source || rawDoc.id),
        sourceType,
        title: String(rawDoc.metadata.title || 'Untitled'),
        description: rawDoc.metadata.description as string | undefined,
        url: rawDoc.metadata.url as string | undefined,
        owner: rawDoc.metadata.owner as string | undefined,
        team: rawDoc.metadata.team as string | undefined,
        tags: (rawDoc.metadata.tags as string[]) || [],
        lastUpdated: (rawDoc.metadata.lastUpdated as Date) || new Date(),
        lastIndexed: new Date(),
        accessLevel: (rawDoc.metadata.accessLevel as 'public' | 'team' | 'private') || 'public',
      },
      chunks: [],
    };

    doc.chunks = await this.chunkDocument(doc);

    for (const chunk of doc.chunks) {
      chunk.embedding = await this.generateEmbedding(chunk.content);
      this.chunks.set(chunk.id, chunk);
    }

    return doc;
  }

  private async chunkDocument(doc: RAGDocument): Promise<RAGChunk[]> {
    const chunks: RAGChunk[] = [];
    const content = doc.content;
    const chunkSize = this.config.rag.chunkSize;
    const overlap = this.config.rag.chunkOverlap;

    // Smart chunking: try to split on paragraph/section boundaries
    const paragraphs = content.split(/\n\n+/);
    let currentChunk = '';
    let startIndex = 0;
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > chunkSize) {
        // Save current chunk
        if (currentChunk.trim()) {
          chunks.push({
            id: `${doc.id}_chunk_${chunkIndex}`,
            documentId: doc.id,
            content: currentChunk.trim(),
            embedding: [],
            startIndex,
            endIndex: startIndex + currentChunk.length,
            metadata: this.extractChunkMetadata(currentChunk),
          });
          chunkIndex++;
        }

        // Start new chunk with overlap
        const overlapText = currentChunk.slice(-overlap);
        startIndex = startIndex + currentChunk.length - overlap;
        currentChunk = overlapText + paragraph + '\n\n';
      } else {
        currentChunk += paragraph + '\n\n';
      }
    }

    // Don't forget the last chunk
    if (currentChunk.trim()) {
      chunks.push({
        id: `${doc.id}_chunk_${chunkIndex}`,
        documentId: doc.id,
        content: currentChunk.trim(),
        embedding: [],
        startIndex,
        endIndex: startIndex + currentChunk.length,
        metadata: this.extractChunkMetadata(currentChunk),
      });
    }

    return chunks;
  }

  private extractChunkMetadata(content: string): RAGChunk['metadata'] {
    const metadata: RAGChunk['metadata'] = {};

    // Extract heading if present
    const headingMatch = content.match(/^#+\s+(.+)$/m);
    if (headingMatch) {
      metadata.heading = headingMatch[1];
    }

    // Detect code blocks
    const codeMatch = content.match(/```(\w+)?/);
    if (codeMatch) {
      metadata.codeLanguage = codeMatch[1] || 'unknown';
    }

    return metadata;
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    // Check cache
    const cacheKey = this.hashString(text);
    if (this.embeddingCache.has(cacheKey)) {
      return this.embeddingCache.get(cacheKey)!;
    }

    // Generate embedding using configured provider
    // In production, this would call OpenAI, Cohere, etc.
    const embedding = Array(this.config.embedding.dimensions)
      .fill(0)
      .map(() => Math.random() - 0.5);

    // Cache the result
    this.embeddingCache.set(cacheKey, embedding);

    return embedding;
  }

  private async indexDocuments(docs: RAGDocument[]): Promise<void> {
    // Index all chunks in the vector database
    // This would call the actual vector DB API
    console.log(`Indexing ${docs.length} documents with ${docs.reduce((sum, d) => sum + (d.chunks?.length || 0), 0)} chunks`);
  }

  private async deleteFromVectorDB(documentId: string): Promise<void> {
    // Delete document and its chunks from vector DB
    console.log(`Deleting document ${documentId} from vector DB`);
  }

  private async vectorSearch(
    embedding: number[],
    options: {
      limit: number;
      minScore: number;
      filter?: Record<string, unknown>;
    }
  ): Promise<RAGSearchResult[]> {
    // Perform vector similarity search
    // This would call the actual vector DB
    const results: RAGSearchResult[] = [];

    // For now, return mock results based on stored documents
    for (const doc of this.documents.values()) {
      if (doc.chunks) {
        for (const chunk of doc.chunks) {
          const score = this.cosineSimilarity(embedding, chunk.embedding);
          if (score >= options.minScore) {
            results.push({
              document: doc,
              chunk,
              score,
            });
          }
        }
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit);
  }

  private async expandQuery(
    query: string,
    context: AIConversationContext
  ): Promise<string[]> {
    // Expand query with synonyms and related terms
    const expanded = [query];

    // Add context-based expansions
    if (context.currentEntity) {
      expanded.push(`${query} ${context.currentEntity.name}`);
    }

    if (context.team) {
      expanded.push(`${query} ${context.team}`);
    }

    return expanded;
  }

  private async rerankResults(
    results: RAGSearchResult[],
    query: string,
    context: AIConversationContext
  ): Promise<RAGSearchResult[]> {
    // Re-rank results based on additional signals
    return results.map(result => {
      let score = result.score;

      // Boost results from user's team
      if (context.team && result.document.metadata.team === context.team) {
        score *= 1.2;
      }

      // Boost recent documents
      const daysSinceUpdate = Math.floor(
        (Date.now() - new Date(result.document.metadata.lastUpdated).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      if (daysSinceUpdate < 7) {
        score *= 1.1;
      }

      return { ...result, score: Math.min(1, score) };
    }).sort((a, b) => b.score - a.score);
  }

  private buildFilter(
    filter?: RAGSearchOptions['filter'],
    context?: AIConversationContext
  ): Record<string, unknown> {
    const builtFilter: Record<string, unknown> = {};

    if (filter?.sourceTypes?.length) {
      builtFilter.sourceType = { $in: filter.sourceTypes };
    }

    if (filter?.teams?.length) {
      builtFilter.team = { $in: filter.teams };
    }

    if (filter?.tags?.length) {
      builtFilter.tags = { $containsAny: filter.tags };
    }

    if (filter?.dateRange) {
      builtFilter.lastUpdated = {
        $gte: filter.dateRange.start,
        $lte: filter.dateRange.end,
      };
    }

    return builtFilter;
  }

  private async fetchTechDocs(): Promise<RawDocument[]> {
    // Fetch documents from TechDocs
    // This would integrate with the Backstage TechDocs API
    return [];
  }

  private async fetchCatalogEntities(): Promise<RawDocument[]> {
    // Fetch entities from the software catalog
    // This would integrate with the catalog API
    return [];
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }
}

export default RAGPipeline;
