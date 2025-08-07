'use client';

import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
 children: React.ReactNode;
}

interface State {
 hasError: boolean;
 error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
 constructor(props: Props) {
 super(props);
 this.state = { hasError: false };
 }

 static getDerivedStateFromError(error: Error): State {
 return { hasError: true, error };
 }

 componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
 console.error('ErrorBoundary caught an error:', error, errorInfo);
 }

 handleReset = () => {
 this.setState({ hasError: false, error: undefined });
 // Clear cache and reload
 if ('caches' in window) {
 caches.keys().then(names => {
 names.forEach(name => {
 caches.delete(name);
 });
 });
 }
 window.location.reload();
 };
 
 clearCacheAndRetry = () => {
 // Clear localStorage cache entries
 if (typeof window !== 'undefined') {
 Object.keys(localStorage).forEach(key => {
 if (key.startsWith('plugin-') || key.includes('cache') || key.includes('query')) {
 localStorage.removeItem(key);
 }
 });
 }
 this.handleReset();
 };

 render() {
 if (this.state.hasError) {
 return (
 <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
 <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
 <div className="flex items-center gap-3 mb-4">
 <AlertCircle className="w-8 h-8 text-red-500" />
 <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
 Something went wrong
 </h1>
 </div>
 
 <p className="text-gray-600 dark:text-gray-400 mb-4">
 An unexpected error occurred. This might be a temporary issue with loading resources.
 </p>

 {this.state.error && (
 <details className="mb-4">
 <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
 Technical details
 </summary>
 <pre className="mt-2 text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded overflow-auto">
 {this.state.error.toString()}
 </pre>
 </details>
 )}

 <div className="space-y-2">
 <button
 onClick={this.handleReset}
 className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
 >
 <RefreshCw className="w-4 h-4" />
 Reload Page
 </button>
 
 <button
 onClick={this.clearCacheAndRetry}
 className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
 >
 Clear Cache & Retry
 </button>
 </div>
 </div>
 </div>
 );
 }

 return this.props.children;
 }
}