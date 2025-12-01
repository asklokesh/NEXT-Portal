/**
 * AI Knowledge Assistant Types
 * Comprehensive type definitions for the AiKA-like AI assistant
 */

// ============================================================================
// Core Types
// ============================================================================

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  metadata?: {
    sources?: AISource[];
    toolCalls?: AIToolCall[];
    toolResults?: AIToolResult[];
    reasoning?: string;
    confidence?: number;
    processingTime?: number;
  };
}

export interface AISource {
  id: string;
  type: 'documentation' | 'catalog' | 'code' | 'slack' | 'confluence' | 'github' | 'jira';
  title: string;
  url?: string;
  snippet: string;
  relevanceScore: number;
  lastUpdated?: Date;
  owner?: string;
}

export interface AIConversation {
  id: string;
  userId: string;
  title?: string;
  messages: AIMessage[];
  context: AIConversationContext;
  createdAt: Date;
  updatedAt: Date;
  isShared?: boolean;
  sharedWith?: string[];
  tags?: string[];
}

export interface AIConversationContext {
  currentPage?: string;
  currentEntity?: {
    kind: string;
    name: string;
    namespace?: string;
  };
  userRole: string;
  team?: string;
  recentEntities?: string[];
  sessionId: string;
  preferences?: AIUserPreferences;
}

export interface AIUserPreferences {
  responseStyle: 'concise' | 'detailed' | 'technical';
  language: string;
  codeStyle?: 'typescript' | 'javascript' | 'python' | 'go' | 'java';
  showSources: boolean;
  enableSuggestions: boolean;
}

// ============================================================================
// Tool System Types
// ============================================================================

export interface AITool {
  name: string;
  description: string;
  category: 'catalog' | 'documentation' | 'deployment' | 'monitoring' | 'workflow' | 'integration';
  parameters: AIToolParameter[];
  handler: (params: Record<string, unknown>) => Promise<AIToolResult>;
  requiresApproval?: boolean;
  riskLevel?: 'low' | 'medium' | 'high';
}

export interface AIToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  enum?: string[];
  default?: unknown;
}

export interface AIToolCall {
  id: string;
  toolName: string;
  parameters: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed';
  requestedAt: Date;
  completedAt?: Date;
}

export interface AIToolResult {
  toolCallId: string;
  success: boolean;
  data?: unknown;
  error?: string;
  executionTime: number;
}

// ============================================================================
// RAG Pipeline Types
// ============================================================================

export interface RAGDocument {
  id: string;
  content: string;
  embedding?: number[];
  metadata: RAGDocumentMetadata;
  chunks?: RAGChunk[];
}

export interface RAGDocumentMetadata {
  source: string;
  sourceType: AISource['type'];
  title: string;
  description?: string;
  url?: string;
  owner?: string;
  team?: string;
  tags?: string[];
  lastUpdated: Date;
  lastIndexed: Date;
  accessLevel?: 'public' | 'team' | 'private';
}

export interface RAGChunk {
  id: string;
  documentId: string;
  content: string;
  embedding: number[];
  startIndex: number;
  endIndex: number;
  metadata: {
    section?: string;
    heading?: string;
    codeLanguage?: string;
  };
}

export interface RAGSearchResult {
  document: RAGDocument;
  chunk: RAGChunk;
  score: number;
  highlights?: string[];
}

export interface RAGContext {
  query: string;
  results: RAGSearchResult[];
  totalResults: number;
  searchTime: number;
}

// ============================================================================
// MCP (Model Context Protocol) Types
// ============================================================================

export interface MCPServer {
  id: string;
  name: string;
  description: string;
  type: 'builtin' | 'custom' | 'marketplace';
  endpoint: string;
  capabilities: MCPCapability[];
  status: 'active' | 'inactive' | 'error';
  config?: Record<string, unknown>;
}

export interface MCPCapability {
  name: string;
  type: 'tool' | 'resource' | 'prompt';
  description: string;
  schema?: Record<string, unknown>;
}

export interface MCPToolRequest {
  serverId: string;
  toolName: string;
  parameters: Record<string, unknown>;
  context?: Record<string, unknown>;
}

export interface MCPToolResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: {
    executionTime: number;
    serverId: string;
    toolName: string;
  };
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface AIUsageMetrics {
  userId: string;
  period: 'day' | 'week' | 'month';
  metrics: {
    totalQueries: number;
    avgResponseTime: number;
    toolUsage: Record<string, number>;
    topTopics: Array<{ topic: string; count: number }>;
    satisfactionScore?: number;
    sourcesUsed: Record<string, number>;
  };
}

export interface AIFeedback {
  id: string;
  messageId: string;
  conversationId: string;
  userId: string;
  rating: 'positive' | 'negative';
  category?: 'accuracy' | 'helpfulness' | 'completeness' | 'speed' | 'other';
  comment?: string;
  timestamp: Date;
}

export interface AIKnowledgeGap {
  id: string;
  query: string;
  frequency: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  suggestedDocOwners: string[];
  status: 'open' | 'addressed' | 'ignored';
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface AIAssistantConfig {
  model: {
    provider: 'openai' | 'anthropic' | 'google' | 'local';
    modelId: string;
    temperature: number;
    maxTokens: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
  };
  embedding: {
    provider: 'openai' | 'cohere' | 'local';
    modelId: string;
    dimensions: number;
  };
  vectorDb: {
    provider: 'pinecone' | 'weaviate' | 'qdrant' | 'chroma';
    indexName: string;
    namespace?: string;
  };
  rag: {
    chunkSize: number;
    chunkOverlap: number;
    maxContextTokens: number;
    minRelevanceScore: number;
    maxResults: number;
  };
  features: {
    streaming: boolean;
    multiTurn: boolean;
    toolUse: boolean;
    mcpEnabled: boolean;
    feedbackEnabled: boolean;
    analyticsEnabled: boolean;
  };
  guardrails: {
    maxQueriesPerMinute: number;
    maxTokensPerQuery: number;
    blockedTopics: string[];
    piiRedaction: boolean;
    contentModeration: boolean;
  };
  persona: {
    name: string;
    systemPrompt: string;
    welcomeMessage: string;
    suggestedQuestions: string[];
  };
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface AIQueryRequest {
  query: string;
  conversationId?: string;
  context?: Partial<AIConversationContext>;
  options?: {
    streaming?: boolean;
    includeSources?: boolean;
    maxSources?: number;
    enableTools?: boolean;
    temperature?: number;
  };
}

export interface AIQueryResponse {
  messageId: string;
  conversationId: string;
  content: string;
  sources?: AISource[];
  toolCalls?: AIToolCall[];
  suggestedFollowUps?: string[];
  metadata: {
    model: string;
    processingTime: number;
    tokensUsed: {
      input: number;
      output: number;
      total: number;
    };
    ragContext?: {
      documentsSearched: number;
      chunksRetrieved: number;
      searchTime: number;
    };
  };
}

export interface AIStreamChunk {
  type: 'content' | 'source' | 'tool_call' | 'tool_result' | 'done' | 'error';
  data: string | AISource | AIToolCall | AIToolResult | { messageId: string };
  index?: number;
}

// ============================================================================
// Event Types
// ============================================================================

export type AIEventType =
  | 'conversation:created'
  | 'conversation:updated'
  | 'message:sent'
  | 'message:received'
  | 'tool:called'
  | 'tool:completed'
  | 'feedback:submitted'
  | 'knowledge_gap:detected'
  | 'index:updated';

export interface AIEvent {
  type: AIEventType;
  timestamp: Date;
  userId: string;
  data: Record<string, unknown>;
}
