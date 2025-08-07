'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';

// Loading component for dynamic import
const LoadingSpinner = () => (
 <div className="flex items-center justify-center h-96">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
 </div>
);

// Error boundary component
class ActivityErrorBoundary extends React.Component<
 { children: React.ReactNode },
 { hasError: boolean; error?: Error }
> {
 constructor(props: { children: React.ReactNode }) {
 super(props);
 this.state = { hasError: false };
 }

 static getDerivedStateFromError(error: Error) {
 return { hasError: true, error };
 }

 componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
 console.error('Activity page error:', error, errorInfo);
 }

 render() {
 if (this.state.hasError) {
 return (
 <div className="flex flex-col items-center justify-center h-96 space-y-4">
 <div className="text-red-600 dark:text-red-400 text-lg font-semibold">
 Failed to load activity page
 </div>
 <button
 onClick={() => {
 this.setState({ hasError: false });
 window.location.reload();
 }}
 className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
 >
 Reload Page
 </button>
 </div>
 );
 }

 return this.props.children;
 }
}

// Dynamically import the actual content to prevent webpack loading issues
const DynamicActivityContent = dynamic(
 () => import('./ActivityContent').catch((err) => {
 console.error('Failed to load ActivityContent:', err);
 // Return a fallback component on error
 return {
 default: () => (
 <div className="text-center p-8">
 <p className="text-red-600 dark:text-red-400">Failed to load activity content. Please refresh the page.</p>
 </div>
 )
 };
 }),
 {
 loading: () => <LoadingSpinner />,
 ssr: false // Disable SSR to prevent hydration issues
 }
);

export default function ActivityPage() {
 return (
 <ActivityErrorBoundary>
 <Suspense fallback={<LoadingSpinner />}>
 <DynamicActivityContent />
 </Suspense>
 </ActivityErrorBoundary>
 );
}

// Force dynamic rendering to prevent build-time errors
export const dynamicConfig = 'force-dynamic';
export const runtime = 'nodejs';
