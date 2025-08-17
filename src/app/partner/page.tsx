/**
 * Partner Portal Page
 * 
 * Partner management portal with deal registration, training, and resources
 */

'use client';

import React from 'react';
import { PartnerDashboard } from '@/components/partner/PartnerDashboard';

export default function PartnerPage() {
  return (
    <div className="container mx-auto py-8">
      <PartnerDashboard />
    </div>
  );
}