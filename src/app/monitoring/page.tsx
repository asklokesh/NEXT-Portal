'use client';

import React, { useEffect } from 'react';
import { LazyComponents, LazyPageWrapper } from '@/lib/lazy';
import { useComponentMonitoring } from '@/hooks/useMonitoring';
import '@/lib/monitoring/initializeMonitoring';

export default function MonitoringPage() {
 const { trackInteraction } = useComponentMonitoring('MonitoringPage');
 
 useEffect(() => {
 document.title = 'Monitoring & Observability | Backstage IDP Platform';
 trackInteraction('page_viewed');
 }, [trackInteraction]);

 return (
 <div className="max-w-7xl mx-auto">
 <LazyPageWrapper>
 <LazyComponents.MonitoringDashboard />
 </LazyPageWrapper>
 </div>
 );
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';