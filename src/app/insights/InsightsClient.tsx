'use client';

import React from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import dynamic from 'next/dynamic';
import { BarChart3 } from 'lucide-react';

const InsightsDashboard = dynamic(
  () => import('@/components/insights/InsightsDashboard'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <BarChart3 className="w-16 h-16 animate-pulse text-blue-600 mx-auto mb-4" />
          <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Loading Insights
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Analyzing platform usage and developer metrics...
          </p>
        </div>
      </div>
    )
  }
);

export default function InsightsClient() {
  return (
    <ErrorBoundary>
      <div className="container mx-auto px-4 py-6">
        <InsightsDashboard />
      </div>
    </ErrorBoundary>
  );
}