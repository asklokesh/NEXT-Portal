'use client';

import React, { useState, useEffect } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Loader2, Package } from 'lucide-react';
import dynamic from 'next/dynamic';

const AdvancedPluginMarketplace = dynamic(
  () => import('@/components/plugins/AdvancedPluginMarketplace'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Package className="w-16 h-16 animate-pulse text-blue-600 mx-auto mb-4" />
          <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Loading Plugin Marketplace
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Fetching 500+ plugins from NPM registry...
          </p>
        </div>
      </div>
    )
  }
);

const PluginMarketplaceV2 = dynamic(
  () => import('@/components/plugins/PluginMarketplaceV2'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading fallback marketplace...</p>
        </div>
      </div>
    )
  }
);

function LoadingFallback() {
 return (
 <div className="flex items-center justify-center h-96">
 <div className="text-center">
 <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
 <p className="text-gray-600 dark:text-gray-400">Loading plugin marketplace...</p>
 </div>
 </div>
 );
}

function FallbackPluginMarketplace() {
  return (
    <ErrorBoundary>
      <div className="container mx-auto">
        <PluginMarketplaceV2 />
      </div>
    </ErrorBoundary>
  );
}

export default function PluginsPage() {
 const [isLoading, setIsLoading] = useState(true);
 const [hasError, setHasError] = useState(false);
 const [useAdvanced, setUseAdvanced] = useState(true);
 
 useEffect(() => {
 // Check if we can render the component
 const timer = setTimeout(() => {
 setIsLoading(false);
 }, 100);
 
 return () => clearTimeout(timer);
 }, []);
 
 // Handle webpack/module errors
 useEffect(() => {
 const handleError = (event: ErrorEvent) => {
 if (event.message.includes('webpack') || event.message.includes('Cannot read properties of undefined')) {
 console.error('Module loading error:', event.error);
 setHasError(true);
 setUseAdvanced(false);
 }
 };
 
 window.addEventListener('error', handleError);
 return () => window.removeEventListener('error', handleError);
 }, []);
 
 if (isLoading) {
 return <LoadingFallback />;
 }
 
 if (hasError || !useAdvanced) {
 return <FallbackPluginMarketplace />;
 }
 
 return (
 <ErrorBoundary>
 <div className="container mx-auto px-4 py-6">
 <AdvancedPluginMarketplace />
 </div>
 </ErrorBoundary>
 );
}