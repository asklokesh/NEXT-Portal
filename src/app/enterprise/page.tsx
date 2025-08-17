/**
 * Enterprise Dashboard Page
 * Executive-level view of platform performance and business metrics
 */

import { Metadata } from 'next';
import ExecutiveDashboard from '@/components/enterprise/ExecutiveDashboard';

export const metadata: Metadata = {
  title: 'Executive Dashboard | Enterprise Portal',
  description: 'Strategic overview of platform performance, tenant health, and business metrics for enterprise leadership',
};

export default function EnterprisePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <ExecutiveDashboard />
    </div>
  );
}