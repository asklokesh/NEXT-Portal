'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// Dynamic import with no SSR to avoid window/localStorage issues
const PluginMarketplace = dynamic(
 () => import('./PluginMarketplace'),
 {
 ssr: false,
 loading: () => (
 <div className="flex items-center justify-center h-96">
 <div className="text-center">
 <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
 <p className="text-gray-600 dark:text-gray-400">Loading plugin marketplace...</p>
 </div>
 </div>
 )
 }
);

interface PluginMarketplaceWrapperProps {
 onPluginInstalled?: (plugin: any) => void;
}

export function PluginMarketplaceWrapper({ onPluginInstalled }: PluginMarketplaceWrapperProps) {
 return (
 <Suspense fallback={
 <div className="flex items-center justify-center h-96">
 <div className="text-center">
 <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
 <p className="text-gray-600 dark:text-gray-400">Loading plugin marketplace...</p>
 </div>
 </div>
 }>
 <PluginMarketplace onPluginInstalled={onPluginInstalled} />
 </Suspense>
 );
}