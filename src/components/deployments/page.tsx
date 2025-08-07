'use client';

import React from 'react';
import { ProgressiveDeploymentDashboard } from './ProgressiveDeploymentDashboard';
import { ProgressiveDeliveryOrchestrator } from '@/lib/progressive-delivery/orchestrator';

// Initialize orchestrator (in a real app, this would be provided via context or dependency injection)
const orchestrator = new ProgressiveDeliveryOrchestrator();

export default function DeploymentsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <ProgressiveDeploymentDashboard orchestrator={orchestrator} />
    </div>
  );
}