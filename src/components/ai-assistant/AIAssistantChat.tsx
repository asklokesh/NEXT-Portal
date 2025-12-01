'use client';

/**
 * AI Assistant Chat Component
 * Main chat interface for the AI Knowledge Assistant
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, ThumbsUp, ThumbsDown, Copy, ExternalLink, Sparkles, X, Maximize2, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface AISource {
  id: string;
  type: string;
  title: string;
  url?: string;
  snippet: string;
  relevanceScore: number;
}

interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  sources?: AISource[];
  isStreaming?: boolean;
}

interface AIAssistantChatProps {
  conversationId?: string;
  initialMessages?: AIMessage[];
  onSendMessage?: (message: string) => Promise<void>;
  onFeedback?: (messageId: string, rating: 'positive' | 'negative') => Promise<void>;
  suggestedQuestions?: string[];
  placeholder?: string;
  className?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onClose?: () => void;
}

export function AIAssistantChat({
  conversationId,
  initialMessages = [],
  onSendMessage,
  onFeedback,
  suggestedQuestions = [
    "What services does my team own?",
    "How do I create a new microservice?",
    "What are the deployment best practices?",
  ],
  placeholder = "Ask me anything about your services, APIs, or documentation...",
  className,
  isExpanded = false,
  onToggleExpand,
  onClose,
}: AIAssistantChatProps) {
  const [messages, setMessages] = useState<AIMessage[]>(initialMessages);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(messages.length === 0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: AIMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setShowSuggestions(false);
    setIsLoading(true);

    try {
      if (onSendMessage) {
        await onSendMessage(userMessage.content);
      } else {
        // Mock response for development
        await new Promise(resolve => setTimeout(resolve, 1500));

        const assistantMessage: AIMessage = {
          id: `msg-${Date.now()}-response`,
          role: 'assistant',
          content: `I understand you're asking about "${userMessage.content}". Here's what I found:\n\nThis is a placeholder response. In production, this would be a real AI-generated response based on your organization's documentation and software catalog.\n\nI can help you with:\n- Finding service information\n- Explaining dependencies\n- Providing documentation links\n- Executing self-service actions`,
          timestamp: new Date(),
          sources: [
            {
              id: '1',
              type: 'documentation',
              title: 'Getting Started Guide',
              url: '/docs/getting-started',
              snippet: 'This guide covers the basics of using the developer portal...',
              relevanceScore: 0.92,
            },
            {
              id: '2',
              type: 'catalog',
              title: 'Service Catalog Overview',
              url: '/catalog',
              snippet: 'The software catalog contains all registered services...',
              relevanceScore: 0.85,
            },
          ],
        };

        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
    inputRef.current?.focus();
  };

  const handleFeedback = async (messageId: string, rating: 'positive' | 'negative') => {
    if (onFeedback) {
      await onFeedback(messageId, rating);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className={cn(
      "flex flex-col bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700",
      isExpanded ? "h-[80vh] w-[60vw]" : "h-[500px] w-[400px]",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-600 to-purple-600 rounded-t-lg">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-white" />
          <span className="font-semibold text-white">Portal AI</span>
        </div>
        <div className="flex items-center gap-1">
          {onToggleExpand && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleExpand}
              className="text-white hover:bg-white/20"
            >
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          )}
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white/20"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Sparkles className="h-12 w-12 text-blue-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Welcome to Portal AI
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs mx-auto">
              I can help you find information about services, APIs, documentation, and more.
            </p>
          </div>
        )}

        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={cn(
                "flex",
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-4 py-3",
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                )}
              >
                <div className="whitespace-pre-wrap text-sm">{message.content}</div>

                {/* Sources */}
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                      Sources
                    </div>
                    <div className="space-y-2">
                      {message.sources.map((source) => (
                        <a
                          key={source.id}
                          href={source.url}
                          className="flex items-start gap-2 p-2 rounded bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                        >
                          <ExternalLink className="h-3 w-3 mt-0.5 text-blue-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-gray-900 dark:text-white truncate">
                              {source.title}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                              {source.snippet}
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions for assistant messages */}
                {message.role === 'assistant' && !message.isStreaming && (
                  <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFeedback(message.id, 'positive')}
                      className="text-gray-500 hover:text-green-600 p-1 h-auto"
                    >
                      <ThumbsUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFeedback(message.id, 'negative')}
                      className="text-gray-500 hover:text-red-600 p-1 h-auto"
                    >
                      <ThumbsDown className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(message.content)}
                      className="text-gray-500 hover:text-blue-600 p-1 h-auto"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {showSuggestions && suggestedQuestions.length > 0 && (
        <div className="px-4 pb-2">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            Suggested questions
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className="text-xs px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-white placeholder-gray-500"
            style={{ maxHeight: '120px' }}
          />
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="text-xs text-gray-400 mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}

export default AIAssistantChat;
