'use client';

/* eslint-disable @typescript-eslint/no-unused-vars */

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
 theme: Theme;
 resolvedTheme: 'light' | 'dark';
 setTheme: (theme: Theme) => void;
 toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
 children: React.ReactNode;
 defaultTheme?: Theme;
 storageKey?: string;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
 children,
 defaultTheme = 'system',
 storageKey = 'dashboard-theme'
}) => {
 const [theme, setThemeState] = useState<Theme>(defaultTheme);
 const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

 // Initialize theme from localStorage
 useEffect(() => {
 try {
 const stored = localStorage.getItem(storageKey) as Theme;
 if (stored && ['light', 'dark', 'system'].includes(stored)) {
 setThemeState(stored);
 }
 } catch (error) {
 console.warn('Failed to load theme from storage:', error);
 }
 }, [storageKey]);

 // Update resolved theme when theme or system preference changes
 useEffect(() => {
 const updateResolvedTheme = () => {
 if (theme === 'system') {
 const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches 
 ? 'dark' 
 : 'light';
 setResolvedTheme(systemTheme);
 } else {
 setResolvedTheme(theme);
 }
 };

 updateResolvedTheme();

 // Listen for system theme changes
 const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
 const handleChange = () => {
 if (theme === 'system') {
 updateResolvedTheme();
 }
 };

 mediaQuery.addEventListener('change', handleChange);
 return () => mediaQuery.removeEventListener('change', handleChange);
 }, [theme]);

 // Apply theme to document
 useEffect(() => {
 const root = document.documentElement;
 
 // Remove previous theme classes
 root.classList.remove('light', 'dark');
 
 // Add current theme class
 root.classList.add(resolvedTheme);
 
 // Set data attribute for CSS custom properties
 root.setAttribute('data-theme', resolvedTheme);
 
 // Update meta theme-color for mobile browsers
 const metaThemeColor = document.querySelector('meta[name="theme-color"]');
 if (metaThemeColor) {
 metaThemeColor.setAttribute(
 'content',
 resolvedTheme === 'dark' ? '#020817' : '#ffffff'
 );
 }
 }, [resolvedTheme]);

 const setTheme = (newTheme: Theme) => {
 setThemeState(newTheme);
 try {
 localStorage.setItem(storageKey, newTheme);
 } catch (error) {
 console.warn('Failed to save theme to storage:', error);
 }
 };

 const toggleTheme = () => {
 if (theme === 'system') {
 setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
 } else {
 setTheme(theme === 'dark' ? 'light' : 'dark');
 }
 };

 const value: ThemeContextValue = {
 theme,
 resolvedTheme,
 setTheme,
 toggleTheme
 };

 return (
 <ThemeContext.Provider value={value}>
 {children}
 </ThemeContext.Provider>
 );
};

export const useTheme = (): ThemeContextValue => {
 const context = useContext(ThemeContext);
 if (!context) {
 throw new Error('useTheme must be used within a ThemeProvider');
 }
 return context;
};

// Theme toggle component
export const ThemeToggle: React.FC<{ className?: string }> = ({ className }) => {
 const { theme, resolvedTheme, setTheme } = useTheme();

 return (
 <select
 value={theme}
 onChange={(e) => setTheme(e.target.value as Theme)}
 className={className}
 aria-label="Select theme"
 >
 <option value="light">Light</option>
 <option value="dark">Dark</option>
 <option value="system">System</option>
 </select>
 );
};

// Hook for theme-aware styling
export const useThemeAwareStyle = () => {
 const { resolvedTheme } = useTheme();
 
 return {
 isDark: resolvedTheme === 'dark',
 isLight: resolvedTheme === 'light',
 resolvedTheme,
 // Common theme-aware utilities
 cardBg: resolvedTheme === 'dark' ? 'bg-slate-800' : 'bg-white',
 textPrimary: resolvedTheme === 'dark' ? 'text-slate-100' : 'text-slate-900',
 textSecondary: resolvedTheme === 'dark' ? 'text-slate-400' : 'text-slate-600',
 border: resolvedTheme === 'dark' ? 'border-slate-700' : 'border-slate-200',
 accent: resolvedTheme === 'dark' ? 'bg-slate-700' : 'bg-slate-100',
 };
};