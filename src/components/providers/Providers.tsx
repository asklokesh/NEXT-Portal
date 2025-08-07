'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from 'next-themes';
import React, { useState } from 'react';
import { Toaster } from 'react-hot-toast';

import { ErrorProvider } from '@/contexts/ErrorContext';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
// Temporarily disabled WebSocket to fix module loading issue
// import { WebSocketProvider } from '@/contexts/WebSocketContext';
// Temporarily disabled to fix loading issues
// import { RoutePreloader } from './RoutePreloader';
// import { ServiceWorkerProvider } from './ServiceWorkerProvider';
// import { CDNProvider } from './CDNProvider';

interface ProvidersProps {
 children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
 const [queryClient] = useState(
 () =>
 new QueryClient({
 defaultOptions: {
 queries: {
 staleTime: 5 * 60 * 1000, // 5 minutes
 gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
 retry: 3,
 retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
 refetchOnWindowFocus: false,
 },
 mutations: {
 retry: 1,
 },
 },
 })
 );

 return (
 <ErrorBoundary>
 <ErrorProvider>
 <QueryClientProvider client={queryClient}>
 <ThemeProvider
 attribute="class"
 defaultTheme="system"
 enableSystem
 disableTransitionOnChange
 storageKey="backstage-idp-theme"
 >
 {/* Temporarily simplified provider chain */}
 {children}
 <Toaster
 position="top-right"
 toastOptions={{
 duration: 5000,
 style: {
 background: '#363636',
 color: '#fff',
 },
 success: {
 iconTheme: {
 primary: '#10b981',
 secondary: '#fff',
 },
 },
 error: {
 iconTheme: {
 primary: '#ef4444',
 secondary: '#fff',
 },
 },
 }}
 />
 </ThemeProvider>
 <ReactQueryDevtools initialIsOpen={false} />
 </QueryClientProvider>
 </ErrorProvider>
 </ErrorBoundary>
 );
}