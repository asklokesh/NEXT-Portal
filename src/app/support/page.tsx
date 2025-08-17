/**
 * Support Page
 * 
 * Multi-channel support ticketing system with SLA management
 */

'use client';

import React from 'react';
import { SupportDashboard } from '@/components/support/SupportDashboard';

export default function SupportPage() {
  return (
    <div className="container mx-auto py-8">
      <SupportDashboard />
    </div>
  );
}