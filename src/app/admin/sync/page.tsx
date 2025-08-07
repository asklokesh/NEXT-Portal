'use client';

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import SyncManager from '@/components/sync/SyncManager';

export default function BackstageSyncPage() {
 const router = useRouter();

 return (
 <div className="space-y-6">
 {/* Header */}
 <div>
 <button
 onClick={() => router.back()}
 className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4"
 >
 <ArrowLeft className="w-4 h-4 mr-1" />
 Back to Admin
 </button>
 
 <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 Backstage Synchronization
 </h1>
 <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
 Keep your wrapper synchronized with Backstage data
 </p>
 </div>

 {/* Sync Manager Component */}
 <SyncManager />
 </div>
 );
}