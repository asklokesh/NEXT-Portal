/**
 * TechDocs v2 Document Block Renderer
 * Revolutionary block-based rendering with interactive capabilities
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Pause, 
  Copy, 
  Check, 
  MessageCircle, 
  Eye,
  Maximize,
  Download,
  Share,
  Edit3,
  Zap
} from 'lucide-react';

import { VisualDocumentationRenderer } from '@/lib/techdocs-v2/core/renderer';
import { InteractiveCodeEngine } from '@/lib/techdocs-v2/execution/sandbox';
import { 
  DocumentBlock, 
  Comment, 
  UserCursor,
  RenderedBlock,
  ExecutionResult
} from '@/lib/techdocs-v2/types';

import { CodeExecutionBlock } from './CodeExecutionBlock';
import { DiagramRenderer } from './DiagramRenderer';
import { InteractiveChart } from './InteractiveChart';
import { APIExplorer } from './APIExplorer';
import { LiveDemo } from './LiveDemo';

interface DocumentBlockRendererProps {
  block: DocumentBlock;
  index: number;
  renderer: VisualDocumentationRenderer;
  onInteraction: (interaction: string) => void;
  onAddComment: (content: string) => void;
  comments: Comment[];
  cursors: UserCursor[];
  readOnly?: boolean;
  className?: string;
}

export function DocumentBlockRenderer({
  block,
  index,
  renderer,
  onInteraction,
  onAddComment,
  comments,
  cursors,
  readOnly = false,
  className = '',
}: DocumentBlockRendererProps) {
  // State
  const [renderedBlock, setRenderedBlock] = useState<RenderedBlock | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const blockRef = useRef<HTMLDivElement>(null);
  const codeEngine = useRef<InteractiveCodeEngine>(new InteractiveCodeEngine());

  // Render block on mount and when block changes
  useEffect(() => {
    const renderBlock = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const rendered = await renderer.renderBlock(block, {
          theme: 'default',
          interactive: true,
          showLineNumbers: block.type === 'code',
          showCopyButton: block.type === 'code',
          showLanguage: block.type === 'code',
        });
        
        setRenderedBlock(rendered);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    renderBlock();
  }, [block, renderer]);

  // Handle interaction tracking
  const handleInteraction = useCallback((interactionType: string) => {
    onInteraction(interactionType);
    
    // Track interaction analytics
    if (blockRef.current) {
      const rect = blockRef.current.getBoundingClientRect();
      const scrollPercentage = (window.scrollY + rect.top) / document.body.scrollHeight;
      
      // Custom event for analytics
      window.dispatchEvent(new CustomEvent('techdocs-interaction', {
        detail: {
          blockId: block.id,
          type: interactionType,
          scrollPercentage,
          timestamp: Date.now(),
        }
      }));
    }
  }, [block.id, onInteraction]);

  // Handle code execution
  const handleCodeExecution = useCallback(async () => {
    if (block.type !== 'code' || !block.interactive?.executable) return;

    setIsExecuting(true);
    handleInteraction('execute-code');

    try {
      const result = await codeEngine.current.executeCode(
        block.content.code,
        block.content.language,
        block.interactive
      );
      
      setExecutionResult(result);
    } catch (err) {
      setExecutionResult({
        id: 'error',
        success: false,
        error: err.message,
        executionTime: 0,
        resourceUsage: { memory: 0, cpu: 0, network: 0 },
        output: { stdout: '', stderr: err.message, logs: [] },
      });
    } finally {
      setIsExecuting(false);
    }
  }, [block, handleInteraction]);

  // Handle copy to clipboard
  const handleCopy = useCallback(async () => {
    if (block.type === 'code') {
      try {
        await navigator.clipboard.writeText(block.content.code);
        setCopied(true);
        handleInteraction('copy-code');
        
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy code:', err);
      }
    }
  }, [block, handleInteraction]);

  // Handle comment submission
  const handleCommentSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    onAddComment(newComment);
    setNewComment('');
    setShowComments(false);
    handleInteraction('add-comment');
  }, [newComment, onAddComment, handleInteraction]);

  // Intersection observer for visibility tracking
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            handleInteraction('view');
          }
        });
      },
      { threshold: 0.5 }
    );

    if (blockRef.current) {
      observer.observe(blockRef.current);
    }

    return () => observer.disconnect();
  }, [handleInteraction]);

  // Render loading state
  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
          <AlertTriangle className="w-4 h-4" />
          <span className="font-medium">Rendering Error</span>
        </div>
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (!renderedBlock) return null;

  return (
    <motion.div
      ref={blockRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={`techdocs-block group relative ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Block toolbar */}
      <AnimatePresence>
        {isHovered && !readOnly && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute -top-10 right-0 flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-sm p-1 z-10"
          >
            {/* Copy button for code blocks */}
            {block.type === 'code' && (
              <button
                onClick={handleCopy}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Copy code"
              >
                {copied ? (
                  <Check className="w-3 h-3 text-green-600" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            )}

            {/* Execute button for executable code */}
            {block.type === 'code' && block.interactive?.executable && (
              <button
                onClick={handleCodeExecution}
                disabled={isExecuting}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                title="Execute code"
              >
                {isExecuting ? (
                  <Pause className="w-3 h-3 animate-spin" />
                ) : (
                  <Play className="w-3 h-3 text-green-600" />
                )}
              </button>
            )}

            {/* Expand button */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Expand"
            >
              <Maximize className="w-3 h-3" />
            </button>

            {/* Comment button */}
            <button
              onClick={() => setShowComments(!showComments)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 relative"
              title="Add comment"
            >
              <MessageCircle className="w-3 h-3" />
              {comments.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-600 rounded-full"></span>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User cursors */}
      {cursors.map(cursor => (
        <div
          key={cursor.userId}
          className="absolute w-0.5 h-4 bg-blue-500 animate-pulse"
          style={{
            left: `${cursor.position.column * 8}px`,
            top: `${cursor.position.line * 20}px`,
          }}
          title={`User ${cursor.userId}`}
        >
          <div className="absolute -top-5 left-0 bg-blue-500 text-white text-xs px-1 rounded whitespace-nowrap">
            User {cursor.userId.substring(0, 8)}
          </div>
        </div>
      ))}

      {/* Block content */}
      <div className={`techdocs-block-content ${expanded ? 'expanded' : ''}`}>
        {/* Render specific block types */}
        {block.type === 'code' && block.interactive?.executable ? (
          <CodeExecutionBlock
            block={block}
            onExecute={handleCodeExecution}
            executionResult={executionResult}
            isExecuting={isExecuting}
          />
        ) : block.type === 'diagram' ? (
          <DiagramRenderer
            config={block.content}
            onInteraction={handleInteraction}
          />
        ) : block.type === 'chart' ? (
          <InteractiveChart
            config={block.content}
            onInteraction={handleInteraction}
          />
        ) : block.type === 'api-explorer' ? (
          <APIExplorer
            config={block.content}
            onInteraction={handleInteraction}
          />
        ) : block.type === 'live-demo' ? (
          <LiveDemo
            config={block.content}
            onInteraction={handleInteraction}
          />
        ) : (
          /* Default rendering */
          <div
            className="prose prose-lg dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ 
              __html: renderedBlock.content.html || '' 
            }}
            onClick={() => handleInteraction('click')}
          />
        )}

        {/* Interactive elements */}
        {renderedBlock.content.interactiveElements && (
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(renderedBlock.content.interactiveElements).map(([key, element]) => (
              <div
                key={key}
                dangerouslySetInnerHTML={{ __html: String(element) }}
                onClick={() => handleInteraction(`interact-${key}`)}
              />
            ))}
          </div>
        )}

        {/* AI enhancement indicator */}
        {renderedBlock.content.metadata?.aiEnhanced && (
          <div className="mt-2 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
            <Zap className="w-3 h-3" />
            AI Enhanced
          </div>
        )}
      </div>

      {/* Comments section */}
      <AnimatePresence>
        {(showComments || comments.length > 0) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4"
          >
            {/* Existing comments */}
            {comments.map(comment => (
              <motion.div
                key={comment.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="mb-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">User {comment.userId.substring(0, 8)}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(comment.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">{comment.content}</p>
              </motion.div>
            ))}

            {/* Add new comment */}
            {showComments && !readOnly && (
              <form onSubmit={handleCommentSubmit} className="mt-3">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="w-full p-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 resize-none"
                  rows={3}
                  autoFocus
                />
                <div className="flex items-center justify-end gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowComments(false)}
                    className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newComment.trim()}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Comment
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Performance metadata */}
      {renderedBlock.metadata?.renderTime && renderedBlock.metadata.renderTime > 100 && (
        <div className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
          Render time: {renderedBlock.metadata.renderTime.toFixed(0)}ms
        </div>
      )}
    </motion.div>
  );
}

// Missing import (would be from lucide-react)
function AlertTriangle({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
  );
}