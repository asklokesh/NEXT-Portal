'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const PluginManagementDashboard = dynamic(
  () => import('@/components/plugins/PluginManagementDashboard'),
  { ssr: false }
);

export default function PluginManagementPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <PluginManagementDashboard />
      </div>
    </div>
  );
}