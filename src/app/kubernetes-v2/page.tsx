/**
 * Kubernetes V2 Plugin - Main Page
 * Entry point for the advanced Kubernetes management interface
 */

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { RefreshCw } from 'lucide-react';

// Dynamically import the main component to improve initial page load
const KubernetesV2Overview = dynamic(
  () => import('@/components/kubernetes-v2/KubernetesV2Overview'),
  {
    loading: () => (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-lg font-medium">Loading Kubernetes Dashboard...</p>
          <p className="text-sm text-muted-foreground mt-2">
            Initializing multi-cloud management interface
          </p>
        </div>
      </div>
    ),
    ssr: false // Disable server-side rendering for better performance with real-time data
  }
);

export default function KubernetesV2Page() {
  return (
    <main className="min-h-screen">
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-lg font-medium">Loading Kubernetes Dashboard...</p>
          </div>
        </div>
      }>
        <KubernetesV2Overview />
      </Suspense>
    </main>
  );
}

// Metadata for SEO and page information
export const metadata = {
  title: 'Kubernetes V2 Management | Next Portal',
  description: 'Advanced multi-cloud Kubernetes management with AI-powered insights, cost optimization, and security monitoring',
  keywords: 'kubernetes, container orchestration, multi-cloud, cost optimization, security, ai insights, auto-scaling',
};

// Page configuration
export const dynamic = 'force-dynamic';
export const revalidate = 0;