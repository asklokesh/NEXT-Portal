'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'react-hot-toast';

interface ProvidersProps {
 children: React.ReactNode;
}

// Create QueryClient with safe defaults
function makeQueryClient() {
 return new QueryClient({
 defaultOptions: {
 queries: {
 staleTime: 60 * 1000, // 1 minute
 gcTime: 5 * 60 * 1000, // 5 minutes
 retry: 1,
 refetchOnWindowFocus: false,
 },
 },
 });
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
 if (typeof window === 'undefined') {
 // Server: always make a new query client
 return makeQueryClient();
 } else {
 // Browser: make a new query client if we don't already have one
 if (!browserQueryClient) browserQueryClient = makeQueryClient();
 return browserQueryClient;
 }
}

export function FunctionalProviders({ children }: ProvidersProps) {
 // NOTE: Avoid useState for QueryClient if possible to prevent hydration issues
 const queryClient = getQueryClient();

 return (
 <QueryClientProvider client={queryClient}>
 <ThemeProvider
 attribute="class"
 defaultTheme="light"
 enableSystem={false}
 disableTransitionOnChange
 >
 {children}
 <Toaster position="top-right" />
 </ThemeProvider>
 </QueryClientProvider>
 );
}