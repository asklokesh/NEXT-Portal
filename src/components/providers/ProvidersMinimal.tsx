'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import React, { useState } from 'react';
import { Toaster } from 'react-hot-toast';

interface ProvidersProps {
 children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
 const [queryClient] = useState(
 () =>
 new QueryClient({
 defaultOptions: {
 queries: {
 staleTime: 5 * 60 * 1000,
 gcTime: 10 * 60 * 1000,
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
 <QueryClientProvider client={queryClient}>
 <ThemeProvider
 attribute="class"
 defaultTheme="system"
 enableSystem
 disableTransitionOnChange
 storageKey="backstage-idp-theme"
 >
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
 </QueryClientProvider>
 );
}