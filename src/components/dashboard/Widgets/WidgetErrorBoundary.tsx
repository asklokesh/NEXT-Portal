'use client';

/* eslint-disable @typescript-eslint/no-unused-vars, no-alert */

import { AlertTriangle, RefreshCw, Bug, ExternalLink } from 'lucide-react';
import React, { Component } from 'react';

import { cn } from '@/lib/utils';

import type { ReactNode } from 'react';

interface Props {
 children: ReactNode;
 widgetId?: string;
 widgetTitle?: string;
 onRetry?: () => void;
 fallback?: ReactNode;
}

interface State {
 hasError: boolean;
 error: Error | null;
 errorInfo: string | null;
}

export class WidgetErrorBoundary extends Component<Props, State> {
 constructor(props: Props) {
 super(props);
 this.state = {
 hasError: false,
 error: null,
 errorInfo: null
 };
 }

 static getDerivedStateFromError(error: Error): State {
 return {
 hasError: true,
 error,
 errorInfo: error.stack || null
 };
 }

 componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
 console.error('Widget Error Boundary caught an error:', error, errorInfo);
 
 // Log error to monitoring service
 this.logError(error, errorInfo);
 }

 private logError = (error: Error, errorInfo: React.ErrorInfo) => {
 const errorData = {
 message: error.message,
 stack: error.stack,
 componentStack: errorInfo.componentStack,
 widgetId: this.props.widgetId,
 widgetTitle: this.props.widgetTitle,
 timestamp: new Date().toISOString(),
 userAgent: navigator.userAgent,
 url: window.location.href
 };

 // In a real app, send to error tracking service like Sentry
 console.error('Widget Error Details:', errorData);
 };

 private handleRetry = () => {
 this.setState({
 hasError: false,
 error: null,
 errorInfo: null
 });
 
 this.props.onRetry?.();
 };

 private handleReportBug = () => {
 const { error, errorInfo } = this.state;
 const { widgetId, widgetTitle } = this.props;
 
 const bugReport = {
 title: `Widget Error: ${widgetTitle || widgetId || 'Unknown Widget'}`,
 description: `
**Error Message:** ${error?.message || 'Unknown error'}

**Widget ID:** ${widgetId || 'Unknown'}
**Widget Title:** ${widgetTitle || 'Unknown'}
**Timestamp:** ${new Date().toISOString()}

**Stack Trace:**
\`\`\`
${error?.stack || 'No stack trace available'}
\`\`\`

**Component Stack:**
\`\`\`
${errorInfo || 'No component stack available'}
\`\`\`

**User Agent:** ${navigator.userAgent}
**URL:** ${window.location.href}
 `.trim()
 };

 // In a real app, this would create a bug report in your issue tracker
 // TODO: Send bug report to error tracking service
 alert('Bug report details would be sent to our support team.');
 };

 render() {
 if (this.state.hasError) {
 if (this.props.fallback) {
 return this.props.fallback;
 }

 return (
 <div className="h-full flex flex-col items-center justify-center p-4 text-center space-y-4">
 <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10">
 <AlertTriangle className="w-6 h-6 text-destructive" />
 </div>
 
 <div className="space-y-2">
 <h3 className="font-semibold text-destructive">Widget Error</h3>
 <p className="text-sm text-muted-foreground max-w-sm">
 Something went wrong while loading this widget. Please try refreshing or contact support if the problem persists.
 </p>
 
 {process.env.NODE_ENV === 'development' && this.state.error && (
 <details className="text-xs text-left bg-muted p-2 rounded mt-2">
 <summary className="cursor-pointer font-medium mb-1">Error Details</summary>
 <pre className="whitespace-pre-wrap text-destructive">
 {this.state.error.message}
 </pre>
 </details>
 )}
 </div>

 <div className="flex gap-2">
 <button
 onClick={this.handleRetry}
 className={cn(
 'inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md',
 'bg-primary text-primary-foreground hover:bg-primary/90',
 'transition-colors'
 )}
 >
 <RefreshCw className="w-3 h-3" />
 Retry
 </button>
 
 <button
 onClick={this.handleReportBug}
 className={cn(
 'inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md',
 'border border-border hover:bg-accent hover:text-accent-foreground',
 'transition-colors'
 )}
 >
 <Bug className="w-3 h-3" />
 Report Bug
 </button>
 </div>

 {this.props.widgetId && (
 <p className="text-xs text-muted-foreground">
 Widget ID: <code className="bg-muted px-1 rounded">{this.props.widgetId}</code>
 </p>
 )}
 </div>
 );
 }

 return this.props.children;
 }
}

// HOC for wrapping widgets with error boundary
export function withErrorBoundary<P extends object>(
 WrappedComponent: React.ComponentType<P>,
 fallback?: ReactNode
) {
 const WithErrorBoundaryComponent = (props: P & { widgetId?: string; widgetTitle?: string }) => {
 return (
 <WidgetErrorBoundary 
 widgetId={props.widgetId}
 widgetTitle={props.widgetTitle}
 fallback={fallback}
 >
 <WrappedComponent {...props} />
 </WidgetErrorBoundary>
 );
 };

 WithErrorBoundaryComponent.displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;
 
 return WithErrorBoundaryComponent;
}