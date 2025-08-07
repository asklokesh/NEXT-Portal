'use client';

import React from 'react';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';
import { useBackstageVersion } from '@/lib/backstage-compat/hooks';

export function VersionIndicator() {
 const { versionInfo, loading } = useBackstageVersion();

 if (loading || !versionInfo) {
 return null;
 }

 return (
 <div className="group relative">
 <button
 className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
 versionInfo.supported
 ? 'text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20'
 : 'text-yellow-700 dark:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
 }`}
 >
 {versionInfo.supported ? (
 <CheckCircle className="w-3.5 h-3.5" />
 ) : (
 <AlertCircle className="w-3.5 h-3.5" />
 )}
 v{versionInfo.current}
 </button>
 
 {/* Tooltip */}
 <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
 <div className="text-sm">
 <div className="flex items-center gap-2 mb-2">
 <Info className="w-4 h-4 text-gray-500" />
 <span className="font-medium text-gray-900 dark:text-gray-100">
 Backstage Version
 </span>
 </div>
 <div className="space-y-1 text-xs">
 <p className="text-gray-600 dark:text-gray-400">
 Current: v{versionInfo.current}
 </p>
 <p className="text-gray-600 dark:text-gray-400">
 Supported: v{versionInfo.supportedRange.min} - v{versionInfo.supportedRange.max}
 </p>
 {versionInfo.recommendations.length > 0 && (
 <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
 {versionInfo.recommendations.map((rec, idx) => (
 <p key={idx} className="text-gray-500 dark:text-gray-400">
 • {rec}
 </p>
 ))}
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 );
}