'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { useState, useEffect, useCallback } from 'react';

interface UseGlobalSearchReturn {
 isSearchOpen: boolean;
 openSearch: () => void;
 closeSearch: () => void;
 toggleSearch: () => void;
}

export function useGlobalSearch(): UseGlobalSearchReturn {
 const [isSearchOpen, setIsSearchOpen] = useState(false);

 const openSearch = useCallback(() => setIsSearchOpen(true), []);
 const closeSearch = useCallback(() => setIsSearchOpen(false), []);
 const toggleSearch = useCallback(() => setIsSearchOpen(prev => !prev), []);

 // Global keyboard shortcut (Cmd+K / Ctrl+K)
 useEffect(() => {
 const handleKeyDown = (event: KeyboardEvent) => {
 if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
 event.preventDefault();
 toggleSearch();
 }
 };

 document.addEventListener('keydown', handleKeyDown);
 return () => document.removeEventListener('keydown', handleKeyDown);
 }, [toggleSearch]);

 return {
 isSearchOpen,
 openSearch,
 closeSearch,
 toggleSearch
 };
}