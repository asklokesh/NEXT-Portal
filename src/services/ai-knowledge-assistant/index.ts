/**
 * AI Knowledge Assistant Service
 * Enterprise-grade AI assistant with RAG, tool use, and MCP integration
 * Competitor to Spotify's AiKA
 */

export * from './types';
export { AiKnowledgeAssistant, default as AiKnowledgeAssistantDefault } from './AiKnowledgeAssistant';
export { RAGPipeline } from './RAGPipeline';
export { AIToolRegistry } from './AIToolRegistry';
export { MCPClient } from './MCPClient';
export { AIAnalytics } from './AIAnalytics';

// Convenience factory function
import { AiKnowledgeAssistant } from './AiKnowledgeAssistant';
import { AIAssistantConfig } from './types';

let instance: AiKnowledgeAssistant | null = null;

export async function getAIAssistant(
  config?: Partial<AIAssistantConfig>
): Promise<AiKnowledgeAssistant> {
  if (!instance) {
    instance = new AiKnowledgeAssistant(config);
    await instance.initialize();
  }
  return instance;
}

export function resetAIAssistant(): void {
  instance = null;
}
