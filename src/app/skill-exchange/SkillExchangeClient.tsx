'use client';

import React from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import dynamic from 'next/dynamic';
import { Users } from 'lucide-react';

const SkillExchangeDashboard = dynamic(
  () => import('@/components/skill-exchange/SkillExchangeDashboard'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Users className="w-16 h-16 animate-pulse text-emerald-600 mx-auto mb-4" />
          <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Loading Skill Exchange
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Connecting you with internal experts...
          </p>
        </div>
      </div>
    )
  }
);

export default function SkillExchangeClient() {
  return (
    <ErrorBoundary>
      <div className="container mx-auto px-4 py-6">
        <SkillExchangeDashboard />
      </div>
    </ErrorBoundary>
  );
}