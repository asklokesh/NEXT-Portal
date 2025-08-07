'use client';

import React, { useEffect, useState, lazy, Suspense } from 'react';
import { useComponentMonitoring } from '@/hooks/useMonitoring';
import { PageLoader } from '@/lib/lazy';

const ServiceCostTracker = lazy(() => 
 import('@/components/cost/ServiceCostTracker').then(mod => ({ default: mod.ServiceCostTracker }))
);

const CostOptimizationDashboard = lazy(() => 
 import('@/components/cost/CostOptimizationDashboard').then(mod => ({ default: mod.CostOptimizationDashboard }))
);

const CostTrackingPage = () => {
 const { trackInteraction } = useComponentMonitoring('CostTrackingPage');
 const [viewMode, setViewMode] = useState<'tracker' | 'optimization'>('optimization');

 useEffect(() => {
 document.title = 'Cost Tracking & Optimization | Backstage IDP Platform';
 trackInteraction('page_viewed', { viewMode });
 }, [trackInteraction, viewMode]);

 return (
 <div className="space-y-6">
 {/* View Toggle */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
 <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-md p-1 inline-flex">
 <button
 onClick={() => {
 setViewMode('optimization');
 trackInteraction('view_mode_changed', { viewMode: 'optimization' });
 }}
 className={`px-4 py-2 text-sm rounded font-medium ${
 viewMode === 'optimization' 
 ? 'bg-white dark:bg-gray-600 shadow text-blue-600 dark:text-blue-400' 
 : 'text-gray-700 dark:text-gray-300'
 }`}
 >
 Cost Optimization
 </button>
 <button
 onClick={() => {
 setViewMode('tracker');
 trackInteraction('view_mode_changed', { viewMode: 'tracker' });
 }}
 className={`px-4 py-2 text-sm rounded font-medium ${
 viewMode === 'tracker' 
 ? 'bg-white dark:bg-gray-600 shadow text-blue-600 dark:text-blue-400' 
 : 'text-gray-700 dark:text-gray-300'
 }`}
 >
 Service Cost Tracker
 </button>
 </div>
 </div>

 {/* Content */}
 <Suspense fallback={<PageLoader />}>
 {viewMode === 'optimization' ? (
 <CostOptimizationDashboard />
 ) : (
 <ServiceCostTracker />
 )}
 </Suspense>
 </div>
 );
};

export default CostTrackingPage;

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';