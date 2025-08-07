import { useEffect, useRef } from 'react';

type KeyHandler = (event: KeyboardEvent) => void;

interface HotkeyOptions {
  enabled?: boolean;
  preventDefault?: boolean;
  enableOnFormTags?: boolean;
}

export const useHotkeys = (
  keys: string,
  callback: KeyHandler,
  options: HotkeyOptions = {}
) => {
  const {
    enabled = true,
    preventDefault = true,
    enableOnFormTags = false
  } = options;

  const callbackRef = useRef<KeyHandler>(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if in form elements (unless explicitly enabled)
      if (!enableOnFormTags) {
        const target = event.target as HTMLElement;
        const tagName = target.tagName.toLowerCase();
        if (
          tagName === 'input' ||
          tagName === 'textarea' ||
          tagName === 'select' ||
          target.contentEditable === 'true'
        ) {
          return;
        }
      }

      // Parse the keys string
      const keyPatterns = keys.split(',').map(k => k.trim().toLowerCase());
      
      for (const pattern of keyPatterns) {
        const parts = pattern.split('+').map(p => p.trim());
        
        let matches = true;
        let hasModifiers = false;
        
        for (const part of parts) {
          switch (part) {
            case 'cmd':
            case 'command':
            case 'meta':
              if (!event.metaKey) matches = false;
              hasModifiers = true;
              break;
            case 'ctrl':
            case 'control':
              if (!event.ctrlKey) matches = false;
              hasModifiers = true;
              break;
            case 'alt':
            case 'option':
              if (!event.altKey) matches = false;
              hasModifiers = true;
              break;
            case 'shift':
              if (!event.shiftKey) matches = false;
              hasModifiers = true;
              break;
            default:
              // Regular key
              if (event.key.toLowerCase() !== part) matches = false;
              break;
          }
        }
        
        // Check that no extra modifiers are pressed
        if (matches && hasModifiers) {
          const extraModifiers = 
            (event.metaKey && !parts.some(p => ['cmd', 'command', 'meta'].includes(p))) ||
            (event.ctrlKey && !parts.some(p => ['ctrl', 'control'].includes(p))) ||
            (event.altKey && !parts.some(p => ['alt', 'option'].includes(p))) ||
            (event.shiftKey && !parts.includes('shift'));
          
          if (extraModifiers) matches = false;
        }
        
        if (matches) {
          if (preventDefault) {
            event.preventDefault();
          }
          callbackRef.current(event);
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [keys, enabled, preventDefault, enableOnFormTags]);
};

// Predefined common hotkeys
export const HOTKEYS = {
  SEARCH: 'cmd+k, ctrl+k',
  SAVE: 'cmd+s, ctrl+s',
  NEW: 'cmd+n, ctrl+n',
  OPEN: 'cmd+o, ctrl+o',
  CLOSE: 'cmd+w, ctrl+w',
  QUIT: 'cmd+q, ctrl+q',
  UNDO: 'cmd+z, ctrl+z',
  REDO: 'cmd+shift+z, ctrl+shift+z',
  CUT: 'cmd+x, ctrl+x',
  COPY: 'cmd+c, ctrl+c',
  PASTE: 'cmd+v, ctrl+v',
  SELECT_ALL: 'cmd+a, ctrl+a',
  ESCAPE: 'escape',
  ENTER: 'enter',
  DELETE: 'delete, backspace',
  TAB: 'tab',
  ARROW_UP: 'arrowup',
  ARROW_DOWN: 'arrowdown',
  ARROW_LEFT: 'arrowleft',
  ARROW_RIGHT: 'arrowright',
} as const;