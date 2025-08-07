'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { 
 MessageSquare,
 Send,
 Sparkles,
 Bot,
 User,
 Loader2,
 ThumbsUp,
 ThumbsDown,
 Copy,
 ExternalLink,
 Play,
 Search,
 Lightbulb,
 Zap,
 Brain,
 Target,
 ArrowRight,
 RefreshCw,
 Settings,
 X
} from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';

import { cn } from '@/lib/utils';
import { useTemplates } from '@/services/backstage/hooks/useScaffolder';

import type { TemplateEntity } from '@/services/backstage/types/templates';

interface TemplateDiscoveryAssistantProps {
 className?: string;
 isOpen: boolean;
 onClose: () => void;
 onTemplateSelect: (templateRef: string) => void;
}

interface Message {
 id: string;
 type: 'user' | 'assistant';
 content: string;
 timestamp: Date;
 templates?: TemplateEntity[];
 suggestions?: string[];
 metadata?: {
 query: string;
 confidence: number;
 reasoning: string[];
 };
}

interface TemplateMatch {
 template: TemplateEntity;
 score: number;
 reasoning: string[];
}

const EXAMPLE_QUERIES = [
 "I need a React microservice template with TypeScript",
 "Show me templates for a data pipeline with Python",
 "I want to create a documentation site",
 "Find templates for serverless functions",
 "I need a full-stack application template",
 "Show me templates with CI/CD pipelines",
];

const QUICK_ACTIONS = [
 { label: "Popular templates", query: "Show me the most popular templates" },
 { label: "New templates", query: "What are the newest templates available?" },
 { label: "React templates", query: "Find all React-based templates" },
 { label: "Microservices", query: "I need microservice templates" },
 { label: "Data templates", query: "Show me data processing templates" },
 { label: "Documentation", query: "I want to create documentation" },
];

const MessageBubble: React.FC<{
 message: Message;
 onTemplateSelect: (templateRef: string) => void;
 onFeedback: (messageId: string, positive: boolean) => void;
}> = ({ message, onTemplateSelect, onFeedback }) => {
 const isUser = message.type === 'user';
 
 return (
 <div className={cn('flex gap-3 mb-4', isUser && 'flex-row-reverse')}>
 <div className={cn(
 'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
 isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
 )}>
 {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
 </div>
 
 <div className={cn('flex-1 max-w-[80%]', isUser && 'flex justify-end')}>
 <div className={cn(
 'rounded-lg px-4 py-3 text-sm',
 isUser 
 ? 'bg-primary text-primary-foreground' 
 : 'bg-muted'
 )}>
 <div className="whitespace-pre-wrap">{message.content}</div>
 
 {/* Templates */}
 {message.templates && message.templates.length > 0 && (
 <div className="mt-3 space-y-2">
 {message.templates.map((template) => {
 const templateRef = `${template.kind}:${template.metadata.namespace || 'default'}/${template.metadata.name}`;
 return (
 <div
 key={templateRef}
 className="bg-background rounded-lg border p-3 text-foreground"
 >
 <div className="flex items-start justify-between mb-2">
 <div>
 <h4 className="font-medium">{template.metadata.title || template.metadata.name}</h4>
 <p className="text-xs text-muted-foreground">{template.spec.type} by {template.spec.owner}</p>
 </div>
 <button
 onClick={() => onTemplateSelect(templateRef)}
 className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-primary text-primary-foreground hover:bg-primary/90"
 >
 <Play className="w-3 h-3" />
 Use
 </button>
 </div>
 
 <p className="text-xs text-muted-foreground line-clamp-2">
 {template.metadata.description}
 </p>
 
 {template.metadata.tags && template.metadata.tags.length > 0 && (
 <div className="flex flex-wrap gap-1 mt-2">
 {template.metadata.tags.slice(0, 3).map((tag) => (
 <span
 key={tag}
 className="px-1 py-0.5 rounded text-xs bg-secondary text-secondary-foreground"
 >
 {tag}
 </span>
 ))}
 </div>
 )}
 </div>
 );
 })}
 </div>
 )}
 
 {/* Suggestions */}
 {message.suggestions && message.suggestions.length > 0 && (
 <div className="mt-3">
 <p className="text-xs opacity-75 mb-2">Try asking:</p>
 <div className="space-y-1">
 {message.suggestions.map((suggestion, index) => (
 <button
 key={index}
 className="block w-full text-left text-xs p-2 rounded bg-background/20 hover:bg-background/30 transition-colors"
 onClick={() => {
 // This would trigger a new query
 console.log('Suggested query:', suggestion);
 }}
 >
 {suggestion}
 </button>
 ))}
 </div>
 </div>
 )}
 
 {/* Metadata */}
 {message.metadata && (
 <div className="mt-3 text-xs opacity-75">
 <p>Confidence: {Math.round(message.metadata.confidence * 100)}%</p>
 {message.metadata.reasoning.length > 0 && (
 <div className="mt-1">
 <p>Reasoning:</p>
 <ul className="list-disc list-inside ml-2">
 {message.metadata.reasoning.map((reason, index) => (
 <li key={index}>{reason}</li>
 ))}
 </ul>
 </div>
 )}
 </div>
 )}
 </div>
 
 {/* Feedback buttons for assistant messages */}
 {!isUser && (
 <div className="flex items-center gap-1 mt-2 ml-2">
 <button
 onClick={() => onFeedback(message.id, true)}
 className="p-1 rounded hover:bg-green-50 hover:text-green-600 transition-colors"
 title="Helpful"
 >
 <ThumbsUp className="w-3 h-3" />
 </button>
 <button
 onClick={() => onFeedback(message.id, false)}
 className="p-1 rounded hover:bg-red-50 hover:text-red-600 transition-colors"
 title="Not helpful"
 >
 <ThumbsDown className="w-3 h-3" />
 </button>
 <button
 onClick={() => navigator.clipboard.writeText(message.content)}
 className="p-1 rounded hover:bg-accent transition-colors"
 title="Copy response"
 >
 <Copy className="w-3 h-3" />
 </button>
 </div>
 )}
 </div>
 </div>
 );
};

export const TemplateDiscoveryAssistant: React.FC<TemplateDiscoveryAssistantProps> = ({
 className,
 isOpen,
 onClose,
 onTemplateSelect,
}) => {
 const [messages, setMessages] = useState<Message[]>([
 {
 id: '1',
 type: 'assistant',
 content: `Hi! I'm your template discovery assistant. I can help you find the perfect template for your project.\n\nTell me what you're trying to build, what technologies you want to use, or any specific requirements you have. I'll search through all available templates and suggest the best matches.`,
 timestamp: new Date(),
 suggestions: [
 "I need a React application template",
 "Show me Python microservice templates",
 "Find templates with automated testing",
 "I want to build a documentation site",
 ],
 },
 ]);
 const [inputValue, setInputValue] = useState('');
 const [isLoading, setIsLoading] = useState(false);
 const messagesEndRef = useRef<HTMLDivElement>(null);
 const inputRef = useRef<HTMLInputElement>(null);

 const { data: templates = [] } = useTemplates();

 useEffect(() => {
 if (messagesEndRef.current) {
 messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
 }
 }, [messages]);

 useEffect(() => {
 if (isOpen && inputRef.current) {
 inputRef.current.focus();
 }
 }, [isOpen]);

 // AI-powered template matching (mock implementation)
 const findMatchingTemplates = (query: string): TemplateMatch[] => {
 const queryLower = query.toLowerCase();
 const keywords = queryLower.split(/\s+/).filter(word => word.length > 2);
 
 const matches: TemplateMatch[] = [];
 
 templates.forEach(template => {
 let score = 0;
 const reasoning: string[] = [];
 
 // Check name match
 if (keywords.some(keyword => 
 (template.metadata.title || template.metadata.name).toLowerCase().includes(keyword)
 )) {
 score += 0.4;
 reasoning.push('Template name matches your query');
 }
 
 // Check description match
 if (template.metadata.description && keywords.some(keyword =>
 template.metadata.description!.toLowerCase().includes(keyword)
 )) {
 score += 0.3;
 reasoning.push('Template description is relevant');
 }
 
 // Check type match
 if (keywords.includes(template.spec.type.toLowerCase())) {
 score += 0.3;
 reasoning.push(`Template type (${template.spec.type}) matches your needs`);
 }
 
 // Check tags match
 const templateTags = template.metadata.tags || [];
 const tagMatches = templateTags.filter(tag => 
 keywords.some(keyword => tag.toLowerCase().includes(keyword))
 );
 if (tagMatches.length > 0) {
 score += tagMatches.length * 0.2;
 reasoning.push(`Relevant technologies: ${tagMatches.join(', ')}`);
 }
 
 // Technology-specific scoring
 const techKeywords = {
 react: ['react', 'frontend', 'ui', 'component'],
 node: ['node', 'nodejs', 'javascript', 'backend'],
 python: ['python', 'flask', 'django', 'fastapi'],
 typescript: ['typescript', 'ts', 'typed'],
 microservice: ['microservice', 'service', 'api'],
 kubernetes: ['kubernetes', 'k8s', 'container', 'docker'],
 database: ['database', 'db', 'sql', 'postgres', 'mongo'],
 };
 
 Object.entries(techKeywords).forEach(([tech, relatedTerms]) => {
 if (relatedTerms.some(term => queryLower.includes(term))) {
 if (templateTags.some(tag => tag.toLowerCase().includes(tech)) ||
 (template.metadata.description?.toLowerCase() || '').includes(tech)) {
 score += 0.25;
 reasoning.push(`Good match for ${tech} technology`);
 }
 }
 });
 
 if (score > 0.2) {
 matches.push({ template, score, reasoning });
 }
 });
 
 return matches.sort((a, b) => b.score - a.score).slice(0, 5);
 };

 const generateAssistantResponse = (query: string, matches: TemplateMatch[]): Message => {
 let content = '';
 let suggestions: string[] = [];
 
 if (matches.length === 0) {
 content = `I couldn't find any templates that closely match "${query}". This might be because:\n\n• The query is too specific\n• No templates exist for this technology stack\n• Try using more general terms\n\nWould you like me to show you popular templates or help you refine your search?`;
 
 suggestions = [
 'Show me the most popular templates',
 'What types of templates are available?',
 'I need help choosing the right template',
 'Show me all React templates',
 ];
 } else {
 const topMatch = matches[0];
 const confidence = Math.min(topMatch.score, 0.95);
 
 if (matches.length === 1) {
 content = `I found a great template for you! Based on your query "${query}", here's the best match:`;
 } else {
 content = `I found ${matches.length} templates that match "${query}". Here are the best options, ranked by relevance:`;
 }
 
 // Add reasoning for top match
 if (topMatch.reasoning.length > 0) {
 content += `\n\nWhy I recommend the top result:\n${topMatch.reasoning.map(r => `• ${r}`).join('\n')}`;
 }
 
 suggestions = [
 'Tell me more about the first template',
 'Show me similar templates',
 'What are the requirements for this template?',
 'Help me understand the differences',
 ];
 }
 
 return {
 id: Date.now().toString(),
 type: 'assistant',
 content,
 timestamp: new Date(),
 templates: matches.map(m => m.template),
 suggestions,
 metadata: {
 query,
 confidence: matches.length > 0 ? matches[0].score : 0,
 reasoning: matches.length > 0 ? matches[0].reasoning : [],
 },
 };
 };

 const handleSendMessage = async (message?: string) => {
 const query = message || inputValue.trim();
 if (!query) return;
 
 // Add user message
 const userMessage: Message = {
 id: Date.now().toString(),
 type: 'user',
 content: query,
 timestamp: new Date(),
 };
 
 setMessages(prev => [...prev, userMessage]);
 setInputValue('');
 setIsLoading(true);
 
 // Simulate AI processing delay
 await new Promise(resolve => setTimeout(resolve, 1000));
 
 // Find matching templates
 const matches = findMatchingTemplates(query);
 
 // Generate assistant response
 const assistantMessage = generateAssistantResponse(query, matches);
 
 setMessages(prev => [...prev, assistantMessage]);
 setIsLoading(false);
 };

 const handleQuickAction = (query: string) => {
 handleSendMessage(query);
 };

 const handleFeedback = (messageId: string, positive: boolean) => {
 console.log('Feedback for message:', messageId, positive ? 'positive' : 'negative');
 // In real implementation, send feedback to analytics service
 };

 const handleKeyPress = (e: React.KeyboardEvent) => {
 if (e.key === 'Enter' && !e.shiftKey) {
 e.preventDefault();
 handleSendMessage();
 }
 };

 if (!isOpen) return null;

 return (
 <div className="fixed inset-0 bg-black/50 flex items-end justify-end z-50 p-4">
 <div className={cn(
 'bg-background rounded-lg border shadow-xl w-full max-w-md h-[600px] flex flex-col',
 className
 )}>
 {/* Header */}
 <div className="flex items-center justify-between p-4 border-b">
 <div className="flex items-center gap-2">
 <div className="p-2 rounded-lg bg-primary/10">
 <Brain className="w-5 h-5 text-primary" />
 </div>
 <div>
 <h3 className="font-semibold">Template Assistant</h3>
 <p className="text-xs text-muted-foreground">AI-powered template discovery</p>
 </div>
 </div>
 
 <button
 onClick={onClose}
 className="p-2 rounded-md hover:bg-accent transition-colors"
 >
 <X className="w-4 h-4" />
 </button>
 </div>

 {/* Messages */}
 <div className="flex-1 overflow-y-auto p-4">
 {messages.map((message) => (
 <MessageBubble
 key={message.id}
 message={message}
 onTemplateSelect={onTemplateSelect}
 onFeedback={handleFeedback}
 />
 ))}
 
 {isLoading && (
 <div className="flex items-center gap-3 mb-4">
 <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
 <Bot className="w-4 h-4" />
 </div>
 <div className="bg-muted rounded-lg px-4 py-3">
 <div className="flex items-center gap-2 text-sm">
 <Loader2 className="w-4 h-4 animate-spin" />
 Searching through templates...
 </div>
 </div>
 </div>
 )}
 
 <div ref={messagesEndRef} />
 </div>

 {/* Quick Actions */}
 {messages.length <= 2 && (
 <div className="p-4 border-t">
 <p className="text-xs text-muted-foreground mb-2">Quick actions:</p>
 <div className="grid grid-cols-2 gap-2">
 {QUICK_ACTIONS.slice(0, 4).map((action, index) => (
 <button
 key={index}
 onClick={() => handleQuickAction(action.query)}
 className="text-left text-xs p-2 rounded border border-border hover:bg-accent transition-colors"
 >
 {action.label}
 </button>
 ))}
 </div>
 </div>
 )}

 {/* Input */}
 <div className="p-4 border-t">
 <div className="flex items-center gap-2">
 <div className="flex-1 relative">
 <input
 ref={inputRef}
 type="text"
 value={inputValue}
 onChange={(e) => setInputValue(e.target.value)}
 onKeyPress={handleKeyPress}
 placeholder="Ask about templates..."
 className="w-full px-3 py-2 pr-10 rounded-md border border-input bg-background text-sm"
 disabled={isLoading}
 />
 <Sparkles className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
 </div>
 
 <button
 onClick={() => handleSendMessage()}
 disabled={!inputValue.trim() || isLoading}
 className="p-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 <Send className="w-4 h-4" />
 </button>
 </div>
 
 <div className="mt-2 text-xs text-muted-foreground">
 Try: "{EXAMPLE_QUERIES[Math.floor(Math.random() * EXAMPLE_QUERIES.length)]}"
 </div>
 </div>
 </div>
 </div>
 );
};