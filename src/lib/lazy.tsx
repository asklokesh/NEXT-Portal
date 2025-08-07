import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

// Loading component for suspense fallback
export const PageLoader = () => (
 <div className="flex items-center justify-center min-h-[400px]">
 <div className="flex flex-col items-center gap-4">
 <Loader2 className="h-8 w-8 animate-spin text-primary" />
 <p className="text-sm text-muted-foreground">Loading...</p>
 </div>
 </div>
);

// Wrapper for lazy loaded components
export const LazyPageWrapper = ({ children }: { children: React.ReactNode }) => (
 <Suspense fallback={<PageLoader />}>
 {children}
 </Suspense>
);

// Helper to create lazy loaded page components
export const createLazyPage = (importFn: () => Promise<any>) => {
 return dynamic(importFn, {
 loading: () => <PageLoader />,
 ssr: true, // Enable SSR for better SEO
 });
};

// Pre-configured lazy imports for common heavy components
export const LazyComponents = {
 // Analytics components
 ServiceAnalyticsDashboard: dynamic(
 () => import('@/components/analytics/ServiceAnalyticsDashboard').then(mod => ({ default: mod.ServiceAnalyticsDashboard })),
 { loading: () => <PageLoader /> }
 ),
 
 // Template components
 TemplateMarketplace: dynamic(
 () => import('@/components/templates/TemplateMarketplace/TemplateMarketplaceHub').then(mod => ({ default: mod.TemplateMarketplaceHub })),
 { loading: () => <PageLoader /> }
 ),
 
 TemplateManagement: dynamic(
 () => import('@/components/templates/TemplateManagement').then(mod => ({ default: mod.TemplateManagement })),
 { loading: () => <PageLoader /> }
 ),
 
 // Admin components
 VersionCompatibility: dynamic(
 () => import('@/components/admin/VersionCompatibility').then(mod => ({ default: mod.VersionCompatibility })),
 { loading: () => <PageLoader /> }
 ),
 
 // Monitoring components
 MonitoringDashboard: dynamic(
 () => import('@/components/monitoring/MonitoringDashboard').then(mod => ({ default: mod.MonitoringDashboard })),
 { loading: () => <PageLoader /> }
 ),
 
 // Cost components
 CostOptimizationDashboard: dynamic(
 () => import('@/components/cost/CostOptimizationDashboard').then(mod => ({ default: mod.CostOptimizationDashboard })),
 { loading: () => <PageLoader /> }
 ),
 
 ServiceCostTracker: dynamic(
 () => import('@/components/cost/ServiceCostTracker').then(mod => ({ default: mod.ServiceCostTracker })),
 { loading: () => <PageLoader /> }
 ),
};

