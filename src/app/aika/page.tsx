'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle, Search, BookOpen, Users, FileText, 
  Send, Sparkles, Brain, Lightbulb, ArrowUp,
  Clock, Filter, Star, ThumbsUp, ThumbsDown,
  Bookmark, Share, ExternalLink, Settings, Zap,
  HelpCircle, Archive, Tag, Globe, Database
} from 'lucide-react';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: KnowledgeSource[];
  helpful?: boolean;
}

interface KnowledgeSource {
  id: string;
  title: string;
  type: 'techdocs' | 'service' | 'runbook' | 'wiki' | 'api';
  url: string;
  snippet: string;
  relevanceScore: number;
  lastUpdated: Date;
}

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
  category: string;
}

interface RecentQuery {
  id: string;
  query: string;
  timestamp: Date;
  helpful: boolean;
}

// Mock data for AiKA
const mockKnowledgeSources: KnowledgeSource[] = [
  {
    id: '1',
    title: 'User Service API Documentation',
    type: 'techdocs',
    url: '/docs/user-service/api',
    snippet: 'Authentication endpoints and user management APIs...',
    relevanceScore: 0.92,
    lastUpdated: new Date('2024-01-15')
  },
  {
    id: '2',
    title: 'Payment Service Runbook',
    type: 'runbook',
    url: '/runbooks/payment-service',
    snippet: 'Incident response procedures and troubleshooting...',
    relevanceScore: 0.87,
    lastUpdated: new Date('2024-01-14')
  },
  {
    id: '3',
    title: 'Development Guidelines',
    type: 'wiki',
    url: '/wiki/dev-guidelines',
    snippet: 'Coding standards, review process, and best practices...',
    relevanceScore: 0.85,
    lastUpdated: new Date('2024-01-13')
  }
];

const quickActions: QuickAction[] = [
  {
    id: '1',
    label: 'Find Documentation',
    description: 'Search across all TechDocs and wikis',
    icon: FileText,
    category: 'Documentation'
  },
  {
    id: '2',
    label: 'Service Lookup',
    description: 'Find service information and contacts',
    icon: Database,
    category: 'Services'
  },
  {
    id: '3',
    label: 'API Reference',
    description: 'Search API documentation and examples',
    icon: Globe,
    category: 'APIs'
  },
  {
    id: '4',
    label: 'Troubleshooting',
    description: 'Find runbooks and incident procedures',
    icon: HelpCircle,
    category: 'Support'
  },
  {
    id: '5',
    label: 'Team Contacts',
    description: 'Find team members and expertise',
    icon: Users,
    category: 'People'
  },
  {
    id: '6',
    label: 'Best Practices',
    description: 'Discover coding and architecture guidelines',
    icon: Star,
    category: 'Guidelines'
  }
];

const recentQueries: RecentQuery[] = [
  {
    id: '1',
    query: 'How to deploy a new microservice?',
    timestamp: new Date('2024-01-15T14:30:00Z'),
    helpful: true
  },
  {
    id: '2',
    query: 'User authentication flow documentation',
    timestamp: new Date('2024-01-15T13:15:00Z'),
    helpful: true
  },
  {
    id: '3',
    query: 'Payment service error codes',
    timestamp: new Date('2024-01-15T12:00:00Z'),
    helpful: false
  }
];

export default function AiKAPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `I found several relevant resources for "${inputValue}". Here's what I discovered:\n\nBased on your query, I recommend checking the User Service API documentation which covers authentication flows and user management. The Payment Service runbook also contains relevant troubleshooting information.\n\nWould you like me to elaborate on any specific aspect?`,
        timestamp: new Date(),
        sources: mockKnowledgeSources.slice(0, 2)
      };

      setMessages(prev => [...prev, aiResponse]);
      setIsLoading(false);
    }, 1500);
  };

  const handleQuickAction = (action: QuickAction) => {
    setInputValue(`${action.label}: ${action.description}`);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const categories = ['all', ...Array.from(new Set(quickActions.map(a => a.category)))];

  const filteredQuickActions = selectedCategory === 'all' 
    ? quickActions 
    : quickActions.filter(a => a.category === selectedCategory);

  return (
    <div className="spotify-layout min-h-screen">
      <div className="spotify-main-content max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-6"
          >
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Brain className="h-8 w-8 text-primary" />
                <h1 className="text-3xl font-bold spotify-gradient-text">AiKA</h1>
                <span className="bg-gradient-to-r from-primary to-accent text-primary-foreground px-3 py-1 rounded-full text-sm font-semibold">
                  Premium
                </span>
              </div>
              <p className="text-muted-foreground">
                AI Knowledge Assistant - Your intelligent guide to organizational knowledge
              </p>
            </div>
            <button className="spotify-button-primary px-6 py-3 rounded-xl font-semibold flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configure AiKA
            </button>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Chat Interface */}
          <div className="lg:col-span-2 space-y-6">
            {/* Chat Messages */}
            <div className="spotify-card h-[600px] flex flex-col">
              <div className="p-6 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-bold text-foreground">Knowledge Chat</h2>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Ask me anything about your organization's knowledge base
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <AnimatePresence>
                  {messages.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-16"
                    >
                      <MessageCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-foreground mb-2">Start a conversation</h3>
                      <p className="text-muted-foreground">
                        Ask me about documentation, services, APIs, or any technical questions
                      </p>
                    </motion.div>
                  )}

                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-xl p-4 ${
                          message.type === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-foreground'
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{message.content}</div>
                        
                        {message.sources && (
                          <div className="mt-4 pt-4 border-t border-border/20">
                            <p className="text-sm font-semibold mb-2">Related Sources:</p>
                            <div className="space-y-2">
                              {message.sources.map((source) => (
                                <div key={source.id} className="flex items-start gap-2 p-2 rounded-lg bg-background/50">
                                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{source.title}</p>
                                    <p className="text-xs text-muted-foreground">{source.snippet}</p>
                                  </div>
                                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/20">
                          <span className="text-xs text-muted-foreground">
                            {message.timestamp.toLocaleTimeString()}
                          </span>
                          {message.type === 'assistant' && (
                            <div className="flex items-center gap-1">
                              <button className="p-1 rounded hover:bg-background/20">
                                <ThumbsUp className="h-4 w-4" />
                              </button>
                              <button className="p-1 rounded hover:bg-background/20">
                                <ThumbsDown className="h-4 w-4" />
                              </button>
                              <button className="p-1 rounded hover:bg-background/20">
                                <Bookmark className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start"
                  >
                    <div className="bg-muted rounded-xl p-4 max-w-[80%]">
                      <div className="flex items-center gap-2">
                        <div className="animate-spin">
                          <Sparkles className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-sm text-muted-foreground">AiKA is thinking...</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-6 border-t border-border/50">
                <div className="flex items-end gap-3">
                  <div className="flex-1 relative">
                    <textarea
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Ask AiKA about documentation, services, APIs..."
                      className="spotify-input w-full resize-none py-3 pr-12"
                      rows={Math.min(inputValue.split('\n').length, 4)}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!inputValue.trim() || isLoading}
                      className="absolute right-3 bottom-3 p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="spotify-card p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <Zap className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold text-foreground">Quick Actions</h3>
              </div>

              {/* Category Filter */}
              <div className="flex flex-wrap gap-2 mb-4">
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-3 py-1 rounded-full text-sm font-medium capitalize transition-all ${
                      selectedCategory === category
                        ? 'spotify-tab-active'
                        : 'spotify-tab-inactive'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                {filteredQuickActions.map((action) => (
                  <motion.button
                    key={action.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => handleQuickAction(action)}
                    className="w-full text-left p-3 rounded-lg border border-border/50 hover:border-primary/20 hover:bg-muted/50 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <action.icon className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium text-foreground">{action.label}</p>
                        <p className="text-sm text-muted-foreground">{action.description}</p>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* Recent Queries */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="spotify-card p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <Clock className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold text-foreground">Recent Queries</h3>
              </div>

              <div className="space-y-3">
                {recentQueries.map((query) => (
                  <div
                    key={query.id}
                    className="p-3 rounded-lg border border-border/50 hover:border-primary/20 cursor-pointer transition-all"
                    onClick={() => setInputValue(query.query)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-foreground">{query.query}</p>
                      {query.helpful ? (
                        <ThumbsUp className="h-4 w-4 text-green-600 flex-shrink-0" />
                      ) : (
                        <ThumbsDown className="h-4 w-4 text-red-600 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {query.timestamp.toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Knowledge Sources */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="spotify-card p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <Archive className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold text-foreground">Knowledge Sources</h3>
              </div>

              <div className="space-y-3">
                {mockKnowledgeSources.map((source) => (
                  <div
                    key={source.id}
                    className="p-3 rounded-lg border border-border/50 hover:border-primary/20 cursor-pointer transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${
                        source.type === 'techdocs' ? 'bg-blue-500/10 text-blue-600' :
                        source.type === 'runbook' ? 'bg-red-500/10 text-red-600' :
                        source.type === 'wiki' ? 'bg-green-500/10 text-green-600' :
                        source.type === 'api' ? 'bg-purple-500/10 text-purple-600' :
                        'bg-gray-500/10 text-gray-600'
                      }`}>
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{source.title}</p>
                        <p className="text-xs text-muted-foreground capitalize">{source.type}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex items-center">
                            <Star className="h-3 w-3 text-yellow-600 mr-1" />
                            <span className="text-xs text-muted-foreground">
                              {Math.round(source.relevanceScore * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}