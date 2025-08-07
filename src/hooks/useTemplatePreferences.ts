'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { useState, useEffect, useCallback } from 'react';

import type { TemplateEntity } from '@/services/backstage/types/templates';

interface TemplateUsage {
 templateRef: string;
 lastUsed: string;
 usageCount: number;
 templateData?: TemplateEntity;
}

interface TemplatePreferences {
 favorites: string[];
 recentlyUsed: TemplateUsage[];
 maxRecentItems: number;
}

const STORAGE_KEY = 'template-preferences';
const DEFAULT_PREFERENCES: TemplatePreferences = {
 favorites: [],
 recentlyUsed: [],
 maxRecentItems: 10,
};

export function useTemplatePreferences() {
 const [preferences, setPreferences] = useState<TemplatePreferences>(DEFAULT_PREFERENCES);
 const [isLoaded, setIsLoaded] = useState(false);

 // Load preferences from localStorage on mount
 useEffect(() => {
 try {
 const stored = localStorage.getItem(STORAGE_KEY);
 if (stored) {
 const parsed = JSON.parse(stored) as TemplatePreferences;
 setPreferences({
 ...DEFAULT_PREFERENCES,
 ...parsed,
 });
 }
 } catch (error) {
 console.warn('Failed to load template preferences:', error);
 } finally {
 setIsLoaded(true);
 }
 }, []);

 // Save preferences to localStorage
 const savePreferences = useCallback((newPreferences: TemplatePreferences) => {
 try {
 localStorage.setItem(STORAGE_KEY, JSON.stringify(newPreferences));
 setPreferences(newPreferences);
 } catch (error) {
 console.warn('Failed to save template preferences:', error);
 }
 }, []);

 // Add template to favorites
 const addToFavorites = useCallback((templateRef: string) => {
 const newPreferences = {
 ...preferences,
 favorites: [...preferences.favorites.filter(ref => ref !== templateRef), templateRef],
 };
 savePreferences(newPreferences);
 }, [preferences, savePreferences]);

 // Remove template from favorites
 const removeFromFavorites = useCallback((templateRef: string) => {
 const newPreferences = {
 ...preferences,
 favorites: preferences.favorites.filter(ref => ref !== templateRef),
 };
 savePreferences(newPreferences);
 }, [preferences, savePreferences]);

 // Toggle favorite status
 const toggleFavorite = useCallback((templateRef: string) => {
 if (preferences.favorites.includes(templateRef)) {
 removeFromFavorites(templateRef);
 } else {
 addToFavorites(templateRef);
 }
 }, [preferences.favorites, addToFavorites, removeFromFavorites]);

 // Check if template is favorited
 const isFavorite = useCallback((templateRef: string) => {
 return preferences.favorites.includes(templateRef);
 }, [preferences.favorites]);

 // Add template to recently used
 const addToRecentlyUsed = useCallback((templateRef: string, templateData?: TemplateEntity) => {
 const now = new Date().toISOString();
 const existing = preferences.recentlyUsed.find(item => item.templateRef === templateRef);
 
 let newRecentlyUsed: TemplateUsage[];
 
 if (existing) {
 // Update existing entry
 newRecentlyUsed = preferences.recentlyUsed.map(item =>
 item.templateRef === templateRef
 ? {
 ...item,
 lastUsed: now,
 usageCount: item.usageCount + 1,
 templateData: templateData || item.templateData,
 }
 : item
 );
 } else {
 // Add new entry
 const newUsage: TemplateUsage = {
 templateRef,
 lastUsed: now,
 usageCount: 1,
 templateData,
 };
 newRecentlyUsed = [newUsage, ...preferences.recentlyUsed];
 }

 // Sort by last used and limit to maxRecentItems
 newRecentlyUsed = newRecentlyUsed
 .sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime())
 .slice(0, preferences.maxRecentItems);

 const newPreferences = {
 ...preferences,
 recentlyUsed: newRecentlyUsed,
 };
 savePreferences(newPreferences);
 }, [preferences, savePreferences]);

 // Clear recently used
 const clearRecentlyUsed = useCallback(() => {
 const newPreferences = {
 ...preferences,
 recentlyUsed: [],
 };
 savePreferences(newPreferences);
 }, [preferences, savePreferences]);

 // Remove specific item from recently used
 const removeFromRecentlyUsed = useCallback((templateRef: string) => {
 const newPreferences = {
 ...preferences,
 recentlyUsed: preferences.recentlyUsed.filter(item => item.templateRef !== templateRef),
 };
 savePreferences(newPreferences);
 }, [preferences, savePreferences]);

 // Get template usage stats
 const getTemplateUsage = useCallback((templateRef: string): TemplateUsage | undefined => {
 return preferences.recentlyUsed.find(item => item.templateRef === templateRef);
 }, [preferences.recentlyUsed]);

 // Get most used templates
 const getMostUsed = useCallback((limit = 5): TemplateUsage[] => {
 return [...preferences.recentlyUsed]
 .sort((a, b) => b.usageCount - a.usageCount)
 .slice(0, limit);
 }, [preferences.recentlyUsed]);

 // Get recently used templates
 const getRecentlyUsed = useCallback((limit?: number): TemplateUsage[] => {
 const sorted = [...preferences.recentlyUsed]
 .sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime());
 
 return limit ? sorted.slice(0, limit) : sorted;
 }, [preferences.recentlyUsed]);

 // Export preferences
 const exportPreferences = useCallback(() => {
 const data = {
 ...preferences,
 exportedAt: new Date().toISOString(),
 version: '1.0',
 };
 
 const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 
 const link = document.createElement('a');
 link.href = url;
 link.download = `template-preferences-${new Date().toISOString().split('T')[0]}.json`;
 link.click();
 
 URL.revokeObjectURL(url);
 }, [preferences]);

 // Import preferences
 const importPreferences = useCallback((file: File): Promise<void> => {
 return new Promise((resolve, reject) => {
 const reader = new FileReader();
 
 reader.onload = (e) => {
 try {
 const result = e.target?.result as string;
 const imported = JSON.parse(result);
 
 // Validate imported data structure
 if (imported && typeof imported === 'object') {
 const newPreferences: TemplatePreferences = {
 favorites: Array.isArray(imported.favorites) ? imported.favorites : [],
 recentlyUsed: Array.isArray(imported.recentlyUsed) ? imported.recentlyUsed : [],
 maxRecentItems: typeof imported.maxRecentItems === 'number' 
 ? imported.maxRecentItems 
 : DEFAULT_PREFERENCES.maxRecentItems,
 };
 
 savePreferences(newPreferences);
 resolve();
 } else {
 reject(new Error('Invalid preferences file format'));
 }
 } catch (error) {
 reject(new Error('Failed to parse preferences file'));
 }
 };
 
 reader.onerror = () => reject(new Error('Failed to read file'));
 reader.readAsText(file);
 });
 }, [savePreferences]);

 // Clear all preferences
 const clearAllPreferences = useCallback(() => {
 savePreferences(DEFAULT_PREFERENCES);
 }, [savePreferences]);

 // Get statistics
 const getStats = useCallback(() => {
 const totalUsage = preferences.recentlyUsed.reduce((sum, item) => sum + item.usageCount, 0);
 const uniqueTemplates = preferences.recentlyUsed.length;
 const favoriteCount = preferences.favorites.length;
 
 const mostUsedTemplate = preferences.recentlyUsed.length > 0
 ? preferences.recentlyUsed.reduce((max, item) => 
 item.usageCount > max.usageCount ? item : max
 )
 : null;

 return {
 totalUsage,
 uniqueTemplates,
 favoriteCount,
 mostUsedTemplate,
 averageUsage: uniqueTemplates > 0 ? totalUsage / uniqueTemplates : 0,
 };
 }, [preferences]);

 return {
 // State
 preferences,
 isLoaded,
 
 // Favorites
 favorites: preferences.favorites,
 addToFavorites,
 removeFromFavorites,
 toggleFavorite,
 isFavorite,
 
 // Recently used
 recentlyUsed: preferences.recentlyUsed,
 addToRecentlyUsed,
 clearRecentlyUsed,
 removeFromRecentlyUsed,
 getRecentlyUsed,
 getMostUsed,
 getTemplateUsage,
 
 // Utilities
 exportPreferences,
 importPreferences,
 clearAllPreferences,
 getStats,
 };
}