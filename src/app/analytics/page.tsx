'use client';

import { useState } from 'react';
import { LazyComponents, LazyPageWrapper } from '@/lib/lazy';
import { ClientOnly } from '@/components/analytics/ClientOnly';
import PluginAnalyticsDashboard from '@/components/analytics/PluginAnalyticsDashboard';

const AnalyticsPage = () => {
  const [analyticsView, setAnalyticsView] = useState<'services' | 'plugins'>('plugins');

  return (
    <div className="container mx-auto px-4 py-6">
      {/* View Toggle */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setAnalyticsView('plugins')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            analyticsView === 'plugins'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          Plugin Analytics
        </button>
        <button
          onClick={() => setAnalyticsView('services')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            analyticsView === 'services'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          Service Analytics
        </button>
      </div>

      {/* Content */}
      <ClientOnly
        fallback={
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        }
      >
        {analyticsView === 'plugins' ? (
          <PluginAnalyticsDashboard />
        ) : (
          <LazyPageWrapper>
            <LazyComponents.ServiceAnalyticsDashboard />
          </LazyPageWrapper>
        )}
      </ClientOnly>
    </div>
  );
};

export default AnalyticsPage;

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';