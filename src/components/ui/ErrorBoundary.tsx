'use client';

import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
 children: ReactNode;
 fallback?: ReactNode;
 onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
 hasError: boolean;
 error?: Error;
 errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
 public state: State = {
 hasError: false
 };

 public static getDerivedStateFromError(error: Error): State {
 return { hasError: true, error };
 }

 public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
 console.error('ErrorBoundary caught an error:', error, errorInfo);
 
 // Call optional error handler
 if (this.props.onError) {
 this.props.onError(error, errorInfo);
 }

 this.setState({
 error,
 errorInfo
 });
 }

 private handleRetry = () => {
 this.setState({ hasError: false, error: undefined, errorInfo: undefined });
 };

 private handleGoHome = () => {
 window.location.href = '/';
 };

 public render() {
 if (this.state.hasError) {
 // Custom fallback UI
 if (this.props.fallback) {
 return this.props.fallback;
 }

 // Default error UI
 return (
 <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
 <div className="max-w-md w-full text-center">
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
 <div className="flex justify-center mb-6">
 <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
 <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
 </div>
 </div>
 
 <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
 Something went wrong
 </h1>
 
 <p className="text-gray-600 dark:text-gray-300 mb-6">
 We apologize for the inconvenience. An unexpected error has occurred.
 </p>
 
 {process.env.NODE_ENV === 'development' && this.state.error && (
 <details className="text-left mb-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
 <summary className="cursor-pointer font-medium text-gray-900 dark:text-gray-100 mb-2">
 Error Details
 </summary>
 <pre className="text-xs text-red-600 dark:text-red-400 overflow-auto">
 {this.state.error.toString()}
 {this.state.errorInfo?.componentStack}
 </pre>
 </details>
 )}
 
 <div className="flex flex-col sm:flex-row gap-3 justify-center">
 <button
 onClick={this.handleRetry}
 className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
 >
 <RefreshCw className="w-4 h-4" />
 Try Again
 </button>
 
 <button
 onClick={this.handleGoHome}
 className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 transition-colors dark:bg-gray-600 dark:text-gray-100 dark:hover:bg-gray-500"
 >
 <Home className="w-4 h-4" />
 Go Home
 </button>
 </div>
 </div>
 </div>
 </div>
 );
 }

 return this.props.children;
 }
}

// Async boundary for handling promise rejections
export function AsyncErrorBoundary({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
 return (
 <ErrorBoundary fallback={fallback}>
 {children}
 </ErrorBoundary>
 );
}