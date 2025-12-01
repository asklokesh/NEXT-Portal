/**
 * AI Knowledge Assistant (AiKA-like)
 * Enterprise-grade AI assistant with RAG, tool use, and MCP integration
 */

import { v4 as uuidv4 } from 'uuid';
import { Redis } from 'ioredis';
import {
  AIMessage,
  AIConversation,
  AIConversationContext,
  AIQueryRequest,
  AIQueryResponse,
  AIStreamChunk,
  AISource,
  AITool,
  AIToolCall,
  AIToolResult,
  AIFeedback,
  AIAssistantConfig,
  RAGContext,
  RAGSearchResult,
} from './types';
import { RAGPipeline } from './RAGPipeline';
import { AIToolRegistry } from './AIToolRegistry';
import { MCPClient } from './MCPClient';
import { AIAnalytics } from './AIAnalytics';

const DEFAULT_CONFIG: AIAssistantConfig = {
  model: {
    provider: 'anthropic',
    modelId: 'claude-sonnet-4-20250514',
    temperature: 0.7,
    maxTokens: 4096,
    topP: 0.9,
  },
  embedding: {
    provider: 'openai',
    modelId: 'text-embedding-3-small',
    dimensions: 1536,
  },
  vectorDb: {
    provider: 'pinecone',
    indexName: 'portal-knowledge',
  },
  rag: {
    chunkSize: 1000,
    chunkOverlap: 200,
    maxContextTokens: 8000,
    minRelevanceScore: 0.7,
    maxResults: 10,
  },
  features: {
    streaming: true,
    multiTurn: true,
    toolUse: true,
    mcpEnabled: true,
    feedbackEnabled: true,
    analyticsEnabled: true,
  },
  guardrails: {
    maxQueriesPerMinute: 30,
    maxTokensPerQuery: 2000,
    blockedTopics: [],
    piiRedaction: true,
    contentModeration: true,
  },
  persona: {
    name: 'Portal AI',
    systemPrompt: `You are Portal AI, an intelligent knowledge assistant for the Internal Developer Portal.

Your capabilities:
- Answer questions about services, APIs, documentation, and platform features
- Help developers find and understand existing services and their dependencies
- Assist with service creation using templates
- Provide guidance on best practices and golden paths
- Execute actions on behalf of users (with approval when needed)
- Search across documentation, Slack, Confluence, GitHub, and more

Guidelines:
- Always cite your sources with clickable links when possible
- Be concise but thorough
- If you're not sure, say so and suggest where to find the answer
- When executing actions, explain what you're doing and why
- Respect user permissions and data access levels
- Proactively suggest related information that might be helpful`,
    welcomeMessage: "Hi! I'm Portal AI, your intelligent assistant for the developer portal. I can help you find information about services, documentation, and platform features. What would you like to know?",
    suggestedQuestions: [
      "What services does my team own?",
      "How do I create a new microservice?",
      "What are the deployment best practices?",
      "Show me recent incidents for the payment service",
      "What APIs are available for authentication?",
    ],
  },
};

export class AiKnowledgeAssistant {
  private config: AIAssistantConfig;
  private redis: Redis;
  private ragPipeline: RAGPipeline;
  private toolRegistry: AIToolRegistry;
  private mcpClient: MCPClient;
  private analytics: AIAnalytics;
  private conversations: Map<string, AIConversation> = new Map();

  constructor(config?: Partial<AIAssistantConfig>, redisUrl?: string) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
    this.ragPipeline = new RAGPipeline(this.config);
    this.toolRegistry = new AIToolRegistry();
    this.mcpClient = new MCPClient();
    this.analytics = new AIAnalytics(this.redis);
  }

  /**
   * Initialize the AI assistant
   */
  async initialize(): Promise<void> {
    await Promise.all([
      this.ragPipeline.initialize(),
      this.toolRegistry.initialize(),
      this.mcpClient.initialize(),
    ]);
    console.log('AI Knowledge Assistant initialized');
  }

  /**
   * Process a query and return a response
   */
  async query(request: AIQueryRequest): Promise<AIQueryResponse> {
    const startTime = Date.now();
    const messageId = uuidv4();

    // Get or create conversation
    const conversation = await this.getOrCreateConversation(
      request.conversationId,
      request.context
    );

    // Add user message to conversation
    const userMessage: AIMessage = {
      id: uuidv4(),
      role: 'user',
      content: request.query,
      timestamp: new Date(),
    };
    conversation.messages.push(userMessage);

    try {
      // Rate limiting check
      await this.checkRateLimit(conversation.userId);

      // Retrieve relevant context using RAG
      const ragContext = await this.ragPipeline.search(
        request.query,
        conversation.context,
        {
          maxResults: request.options?.maxSources || this.config.rag.maxResults,
          minScore: this.config.rag.minRelevanceScore,
        }
      );

      // Prepare messages for the LLM
      const messages = this.prepareMessages(conversation, ragContext);

      // Generate response
      const response = await this.generateResponse(
        messages,
        request.options?.enableTools ?? this.config.features.toolUse
      );

      // Extract sources from RAG context
      const sources = this.extractSources(ragContext, request.options?.maxSources || 5);

      // Create assistant message
      const assistantMessage: AIMessage = {
        id: messageId,
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        metadata: {
          sources,
          toolCalls: response.toolCalls,
          toolResults: response.toolResults,
          processingTime: Date.now() - startTime,
        },
      };
      conversation.messages.push(assistantMessage);

      // Save conversation
      await this.saveConversation(conversation);

      // Log analytics
      if (this.config.features.analyticsEnabled) {
        await this.analytics.logQuery({
          userId: conversation.userId,
          conversationId: conversation.id,
          query: request.query,
          responseTime: Date.now() - startTime,
          sourcesUsed: sources.length,
          toolsUsed: response.toolCalls?.map(tc => tc.toolName) || [],
        });
      }

      // Generate suggested follow-ups
      const suggestedFollowUps = await this.generateFollowUpSuggestions(
        request.query,
        response.content,
        ragContext
      );

      return {
        messageId,
        conversationId: conversation.id,
        content: response.content,
        sources: request.options?.includeSources !== false ? sources : undefined,
        toolCalls: response.toolCalls,
        suggestedFollowUps,
        metadata: {
          model: this.config.model.modelId,
          processingTime: Date.now() - startTime,
          tokensUsed: response.tokensUsed,
          ragContext: {
            documentsSearched: ragContext.totalResults,
            chunksRetrieved: ragContext.results.length,
            searchTime: ragContext.searchTime,
          },
        },
      };
    } catch (error) {
      console.error('AI query failed:', error);
      throw error;
    }
  }

  /**
   * Stream a response
   */
  async *queryStream(
    request: AIQueryRequest
  ): AsyncGenerator<AIStreamChunk, void, unknown> {
    const messageId = uuidv4();
    const startTime = Date.now();

    const conversation = await this.getOrCreateConversation(
      request.conversationId,
      request.context
    );

    const userMessage: AIMessage = {
      id: uuidv4(),
      role: 'user',
      content: request.query,
      timestamp: new Date(),
    };
    conversation.messages.push(userMessage);

    try {
      await this.checkRateLimit(conversation.userId);

      // RAG search
      const ragContext = await this.ragPipeline.search(
        request.query,
        conversation.context,
        {
          maxResults: request.options?.maxSources || this.config.rag.maxResults,
          minScore: this.config.rag.minRelevanceScore,
        }
      );

      // Yield sources first
      const sources = this.extractSources(ragContext, 5);
      for (const source of sources) {
        yield { type: 'source', data: source };
      }

      // Prepare messages
      const messages = this.prepareMessages(conversation, ragContext);

      // Stream response
      let fullContent = '';
      for await (const chunk of this.streamResponse(messages)) {
        fullContent += chunk;
        yield { type: 'content', data: chunk };
      }

      // Save conversation
      const assistantMessage: AIMessage = {
        id: messageId,
        role: 'assistant',
        content: fullContent,
        timestamp: new Date(),
        metadata: {
          sources,
          processingTime: Date.now() - startTime,
        },
      };
      conversation.messages.push(assistantMessage);
      await this.saveConversation(conversation);

      yield { type: 'done', data: { messageId } };
    } catch (error) {
      yield { type: 'error', data: String(error) };
    }
  }

  /**
   * Execute a tool
   */
  async executeTool(
    toolCall: AIToolCall,
    context: AIConversationContext
  ): Promise<AIToolResult> {
    const tool = this.toolRegistry.getTool(toolCall.toolName);
    if (!tool) {
      return {
        toolCallId: toolCall.id,
        success: false,
        error: `Tool not found: ${toolCall.toolName}`,
        executionTime: 0,
      };
    }

    // Check if tool requires approval
    if (tool.requiresApproval && toolCall.status !== 'approved') {
      return {
        toolCallId: toolCall.id,
        success: false,
        error: 'Tool requires approval before execution',
        executionTime: 0,
      };
    }

    const startTime = Date.now();
    try {
      const result = await tool.handler(toolCall.parameters);
      return {
        toolCallId: toolCall.id,
        success: true,
        data: result,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        toolCallId: toolCall.id,
        success: false,
        error: String(error),
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Submit feedback for a message
   */
  async submitFeedback(feedback: Omit<AIFeedback, 'id' | 'timestamp'>): Promise<void> {
    const fullFeedback: AIFeedback = {
      ...feedback,
      id: uuidv4(),
      timestamp: new Date(),
    };

    await this.redis.lpush('ai:feedback', JSON.stringify(fullFeedback));
    await this.analytics.logFeedback(fullFeedback);

    // Detect potential knowledge gaps from negative feedback
    if (feedback.rating === 'negative') {
      const conversation = await this.getConversation(feedback.conversationId);
      if (conversation) {
        const message = conversation.messages.find(m => m.id === feedback.messageId);
        const userQuery = conversation.messages
          .filter(m => m.role === 'user')
          .pop()?.content;

        if (userQuery) {
          await this.analytics.recordKnowledgeGap(userQuery, feedback);
        }
      }
    }
  }

  /**
   * Get conversation history
   */
  async getConversation(conversationId: string): Promise<AIConversation | null> {
    // Check memory cache first
    if (this.conversations.has(conversationId)) {
      return this.conversations.get(conversationId)!;
    }

    // Check Redis
    const data = await this.redis.get(`ai:conversation:${conversationId}`);
    if (data) {
      const conversation = JSON.parse(data) as AIConversation;
      this.conversations.set(conversationId, conversation);
      return conversation;
    }

    return null;
  }

  /**
   * List user conversations
   */
  async listConversations(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<AIConversation[]> {
    const keys = await this.redis.keys(`ai:conversation:user:${userId}:*`);
    const conversations: AIConversation[] = [];

    const sortedKeys = keys.slice(offset, offset + limit);
    for (const key of sortedKeys) {
      const conversationId = key.split(':').pop();
      if (conversationId) {
        const conversation = await this.getConversation(conversationId);
        if (conversation) {
          conversations.push(conversation);
        }
      }
    }

    return conversations.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId: string, userId: string): Promise<boolean> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation || conversation.userId !== userId) {
      return false;
    }

    await this.redis.del(`ai:conversation:${conversationId}`);
    await this.redis.del(`ai:conversation:user:${userId}:${conversationId}`);
    this.conversations.delete(conversationId);
    return true;
  }

  /**
   * Share a conversation
   */
  async shareConversation(
    conversationId: string,
    userId: string,
    shareWith: string[]
  ): Promise<string | null> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation || conversation.userId !== userId) {
      return null;
    }

    conversation.isShared = true;
    conversation.sharedWith = shareWith;
    await this.saveConversation(conversation);

    const shareId = uuidv4();
    await this.redis.setex(
      `ai:shared:${shareId}`,
      60 * 60 * 24 * 7, // 7 days
      conversationId
    );

    return shareId;
  }

  /**
   * Get suggested questions based on context
   */
  async getSuggestedQuestions(context: AIConversationContext): Promise<string[]> {
    const suggestions = [...this.config.persona.suggestedQuestions];

    // Add context-specific suggestions
    if (context.currentEntity) {
      suggestions.unshift(
        `What does the ${context.currentEntity.name} service do?`,
        `Who owns ${context.currentEntity.name}?`,
        `What are the dependencies of ${context.currentEntity.name}?`
      );
    }

    if (context.currentPage?.includes('incident')) {
      suggestions.unshift(
        'What are the current active incidents?',
        'Show me incident resolution steps'
      );
    }

    return suggestions.slice(0, 5);
  }

  // Private methods

  private async getOrCreateConversation(
    conversationId?: string,
    context?: Partial<AIConversationContext>
  ): Promise<AIConversation> {
    if (conversationId) {
      const existing = await this.getConversation(conversationId);
      if (existing) {
        if (context) {
          existing.context = { ...existing.context, ...context };
        }
        return existing;
      }
    }

    const newConversation: AIConversation = {
      id: conversationId || uuidv4(),
      userId: context?.sessionId || 'anonymous',
      messages: [],
      context: {
        userRole: 'developer',
        sessionId: uuidv4(),
        ...context,
      } as AIConversationContext,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.saveConversation(newConversation);
    return newConversation;
  }

  private async saveConversation(conversation: AIConversation): Promise<void> {
    conversation.updatedAt = new Date();

    // Update title based on first user message if not set
    if (!conversation.title && conversation.messages.length > 0) {
      const firstUserMessage = conversation.messages.find(m => m.role === 'user');
      if (firstUserMessage) {
        conversation.title = firstUserMessage.content.slice(0, 50) +
          (firstUserMessage.content.length > 50 ? '...' : '');
      }
    }

    this.conversations.set(conversation.id, conversation);

    await this.redis.setex(
      `ai:conversation:${conversation.id}`,
      60 * 60 * 24 * 30, // 30 days
      JSON.stringify(conversation)
    );

    await this.redis.setex(
      `ai:conversation:user:${conversation.userId}:${conversation.id}`,
      60 * 60 * 24 * 30,
      conversation.id
    );
  }

  private async checkRateLimit(userId: string): Promise<void> {
    const key = `ai:ratelimit:${userId}`;
    const count = await this.redis.incr(key);

    if (count === 1) {
      await this.redis.expire(key, 60);
    }

    if (count > this.config.guardrails.maxQueriesPerMinute) {
      throw new Error('Rate limit exceeded. Please wait before sending more queries.');
    }
  }

  private prepareMessages(
    conversation: AIConversation,
    ragContext: RAGContext
  ): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];

    // System prompt with RAG context
    const contextSection = ragContext.results.length > 0
      ? `\n\nRelevant Context:\n${ragContext.results
          .slice(0, 5)
          .map((r, i) => `[${i + 1}] ${r.document.metadata.title}: ${r.chunk.content}`)
          .join('\n\n')}`
      : '';

    messages.push({
      role: 'system',
      content: this.config.persona.systemPrompt + contextSection,
    });

    // Add conversation history (last N messages)
    const historyLimit = 20;
    const recentMessages = conversation.messages.slice(-historyLimit);

    for (const msg of recentMessages) {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      });
    }

    return messages;
  }

  private async generateResponse(
    messages: Array<{ role: string; content: string }>,
    enableTools: boolean
  ): Promise<{
    content: string;
    toolCalls?: AIToolCall[];
    toolResults?: AIToolResult[];
    tokensUsed: { input: number; output: number; total: number };
  }> {
    // This would integrate with the actual LLM provider
    // For now, return a mock response structure
    const provider = this.config.model.provider;

    // In production, this would call the actual API
    // Example with Anthropic:
    // const response = await anthropic.messages.create({
    //   model: this.config.model.modelId,
    //   max_tokens: this.config.model.maxTokens,
    //   temperature: this.config.model.temperature,
    //   messages,
    //   tools: enableTools ? this.toolRegistry.getToolSchemas() : undefined,
    // });

    return {
      content: 'This is a placeholder response. The actual implementation would call the LLM API.',
      tokensUsed: {
        input: 0,
        output: 0,
        total: 0,
      },
    };
  }

  private async *streamResponse(
    messages: Array<{ role: string; content: string }>
  ): AsyncGenerator<string, void, unknown> {
    // This would integrate with the actual streaming API
    // For now, yield placeholder chunks
    const words = 'This is a streaming response placeholder.'.split(' ');
    for (const word of words) {
      yield word + ' ';
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  private extractSources(ragContext: RAGContext, maxSources: number): AISource[] {
    return ragContext.results.slice(0, maxSources).map(result => ({
      id: result.document.id,
      type: result.document.metadata.sourceType,
      title: result.document.metadata.title,
      url: result.document.metadata.url,
      snippet: result.chunk.content.slice(0, 200) + '...',
      relevanceScore: result.score,
      lastUpdated: result.document.metadata.lastUpdated,
      owner: result.document.metadata.owner,
    }));
  }

  private async generateFollowUpSuggestions(
    query: string,
    response: string,
    ragContext: RAGContext
  ): Promise<string[]> {
    // Generate contextual follow-up suggestions
    const suggestions: string[] = [];

    // Based on related documents
    const relatedTopics = new Set<string>();
    for (const result of ragContext.results) {
      result.document.metadata.tags?.forEach(tag => relatedTopics.add(tag));
    }

    if (relatedTopics.size > 0) {
      const topTopic = Array.from(relatedTopics)[0];
      suggestions.push(`Tell me more about ${topTopic}`);
    }

    // Generic follow-ups based on query type
    if (query.toLowerCase().includes('how to')) {
      suggestions.push('Show me an example');
      suggestions.push('What are common mistakes to avoid?');
    }

    if (query.toLowerCase().includes('service')) {
      suggestions.push('What are its dependencies?');
      suggestions.push('Show me recent deployments');
    }

    return suggestions.slice(0, 3);
  }
}

export default AiKnowledgeAssistant;
