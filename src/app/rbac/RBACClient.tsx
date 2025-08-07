'use client';

import React from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import dynamic from 'next/dynamic';
import { Shield } from 'lucide-react';

const RBACDashboard = dynamic(
  () => import('@/components/rbac/RBACDashboard'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Shield className="w-16 h-16 animate-pulse text-indigo-600 mx-auto mb-4" />
          <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Loading RBAC
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Setting up role-based access control...
          </p>
        </div>
      </div>
    )
  }
);

export default function RBACClient() {
  return (
    <ErrorBoundary>
      <div className="container mx-auto px-4 py-6">
        <RBACDashboard />
      </div>
    </ErrorBoundary>
  );
}