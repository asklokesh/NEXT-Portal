'use client';

/**
 * AI Assistant Floating Button
 * Provides quick access to the AI assistant from anywhere in the portal
 */

import React, { useState, useEffect } from 'react';
import { Sparkles, MessageSquare, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AIAssistantChat } from './AIAssistantChat';
import { cn } from '@/lib/utils';

interface AIAssistantButtonProps {
  position?: 'bottom-right' | 'bottom-left';
  className?: string;
}

export function AIAssistantButton({
  position = 'bottom-right',
  className,
}: AIAssistantButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);

  // Show tooltip after a delay for new users
  useEffect(() => {
    const hasSeenAI = localStorage.getItem('portal-ai-tooltip-seen');
    if (!hasSeenAI) {
      const timer = setTimeout(() => {
        setShowTooltip(true);
        localStorage.setItem('portal-ai-tooltip-seen', 'true');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
  };

  const chatPositionClasses = {
    'bottom-right': 'bottom-20 right-6',
    'bottom-left': 'bottom-20 left-6',
  };

  return (
    <>
      {/* Floating Button */}
      <div className={cn('fixed z-50', positionClasses[position], className)}>
        <AnimatePresence>
          {showTooltip && !isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className={cn(
                "absolute bottom-full mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg whitespace-nowrap",
                position === 'bottom-right' ? 'right-0' : 'left-0'
              )}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-yellow-400" />
                <span>Ask Portal AI anything!</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Press <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs">⌘K</kbd> for quick access
              </div>
              <button
                onClick={() => setShowTooltip(false)}
                className="absolute -top-1 -right-1 p-1 bg-gray-700 rounded-full hover:bg-gray-600"
              >
                <X className="h-3 w-3" />
              </button>
              <div
                className={cn(
                  "absolute top-full w-3 h-3 bg-gray-900 transform rotate-45",
                  position === 'bottom-right' ? 'right-5' : 'left-5',
                  "-mt-1.5"
                )}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          onClick={() => {
            setIsOpen(!isOpen);
            setShowTooltip(false);
          }}
          className={cn(
            "relative flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all duration-200",
            isOpen
              ? "bg-gray-700 text-white"
              : "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
          )}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.div
                key="close"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <X className="h-6 w-6" />
              </motion.div>
            ) : (
              <motion.div
                key="open"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Sparkles className="h-6 w-6" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* New message indicator */}
          {hasNewMessage && !isOpen && (
            <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          )}
        </motion.button>
      </div>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'fixed z-40',
              isExpanded ? 'inset-10' : chatPositionClasses[position]
            )}
          >
            <AIAssistantChat
              isExpanded={isExpanded}
              onToggleExpand={() => setIsExpanded(!isExpanded)}
              onClose={() => setIsOpen(false)}
              className={isExpanded ? 'w-full h-full' : undefined}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop for expanded mode */}
      <AnimatePresence>
        {isOpen && isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsExpanded(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default AIAssistantButton;
