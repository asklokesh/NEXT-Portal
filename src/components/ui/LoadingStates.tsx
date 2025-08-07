'use client';

import { Loader, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

// Basic loading spinner
export function LoadingSpinner({ size = "default", className = "" }: { 
 size?: "sm" | "default" | "lg"; 
 className?: string; 
}) {
 const sizeClasses = {
 sm: "w-4 h-4",
 default: "w-6 h-6",
 lg: "w-8 h-8"
 };

 return (
 <Loader className={`animate-spin ${sizeClasses[size]} ${className}`} />
 );
}

// Page-level loading
export function PageLoading({ title = "Loading..." }: { title?: string }) {
 return (
 <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
 <div className="text-center">
 <motion.div
 animate={{ rotate: 360 }}
 transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
 className="mx-auto mb-4"
 >
 <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
 </motion.div>
 <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
 {title}
 </h2>
 </div>
 </div>
 );
}

// Section loading
export function SectionLoading({ height = "200px", title }: { 
 height?: string; 
 title?: string; 
}) {
 return (
 <div 
 className="flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
 style={{ height }}
 >
 <div className="text-center">
 <LoadingSpinner size="lg" className="mx-auto mb-2 text-gray-400" />
 {title && (
 <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
 )}
 </div>
 </div>
 );
}

// Card loading skeleton
export function CardLoading({ count = 1 }: { count?: number }) {
 return (
 <>
 {Array.from({ length: count }).map((_, index) => (
 <div 
 key={index}
 className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 animate-pulse"
 >
 <div className="flex items-start justify-between mb-4">
 <div className="flex-1">
 <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
 <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
 </div>
 <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
 </div>
 
 <div className="space-y-3">
 <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
 <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
 <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6"></div>
 </div>
 
 <div className="flex justify-between mt-6">
 <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
 <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
 </div>
 </div>
 ))}
 </>
 );
}

// Table loading skeleton
export function TableLoading({ 
 rows = 5, 
 columns = 4 
}: { 
 rows?: number; 
 columns?: number; 
}) {
 return (
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
 {/* Header */}
 <div className="border-b border-gray-200 dark:border-gray-700 p-4 animate-pulse">
 <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
 {Array.from({ length: columns }).map((_, index) => (
 <div key={index} className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
 ))}
 </div>
 </div>
 
 {/* Rows */}
 {Array.from({ length: rows }).map((_, rowIndex) => (
 <div key={rowIndex} className="border-b border-gray-200 dark:border-gray-700 p-4 animate-pulse">
 <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
 {Array.from({ length: columns }).map((_, colIndex) => (
 <div 
 key={colIndex} 
 className="h-4 bg-gray-200 dark:bg-gray-700 rounded"
 style={{ 
 width: colIndex === 0 ? '100%' : `${70 + Math.random() * 30}%` 
 }}
 ></div>
 ))}
 </div>
 </div>
 ))}
 </div>
 );
}

// Inline loading for buttons
export function ButtonLoading({ 
 children, 
 loading = false, 
 ...props 
}: { 
 children: React.ReactNode; 
 loading?: boolean; 
 [key: string]: any; 
}) {
 return (
 <button disabled={loading} {...props}>
 <div className="flex items-center gap-2">
 {loading && <LoadingSpinner size="sm" />}
 {children}
 </div>
 </button>
 );
}

// Data fetching states
export function DataLoadingState({ 
 loading = false,
 error = null,
 data = null,
 loadingComponent = <SectionLoading />,
 errorComponent = null,
 emptyComponent = null,
 children
}: {
 loading?: boolean;
 error?: Error | string | null;
 data?: any;
 loadingComponent?: React.ReactNode;
 errorComponent?: React.ReactNode;
 emptyComponent?: React.ReactNode;
 children: React.ReactNode;
}) {
 if (loading) {
 return <>{loadingComponent}</>;
 }

 if (error) {
 if (errorComponent) {
 return <>{errorComponent}</>;
 }
 
 return (
 <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
 <div className="text-red-600 dark:text-red-400 mb-2">
 <RefreshCw className="w-6 h-6 mx-auto" />
 </div>
 <h3 className="text-lg font-medium text-red-900 dark:text-red-100 mb-2">
 Failed to load data
 </h3>
 <p className="text-red-700 dark:text-red-300 text-sm">
 {typeof error === 'string' ? error : error.message}
 </p>
 </div>
 );
 }

 if (!data || (Array.isArray(data) && data.length === 0)) {
 if (emptyComponent) {
 return <>{emptyComponent}</>;
 }
 
 return (
 <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
 <p className="text-gray-500 dark:text-gray-400">No data available</p>
 </div>
 );
 }

 return <>{children}</>;
}

// Progressive loading component
export function ProgressiveLoader({ 
 steps, 
 currentStep = 0,
 className = ""
}: {
 steps: string[];
 currentStep?: number;
 className?: string;
}) {
 return (
 <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
 <div className="text-center mb-6">
 <motion.div
 animate={{ rotate: 360 }}
 transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
 className="mx-auto mb-4"
 >
 <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
 </motion.div>
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
 Processing...
 </h3>
 </div>
 
 <div className="space-y-3">
 {steps.map((step, index) => (
 <div key={index} className="flex items-center gap-3">
 <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
 index < currentStep 
 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
 : index === currentStep
 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
 : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
 }`}>
 {index < currentStep ? 'DONE' : index + 1}
 </div>
 <span className={`text-sm ${
 index <= currentStep 
 ? 'text-gray-900 dark:text-gray-100'
 : 'text-gray-500 dark:text-gray-400'
 }`}>
 {step}
 </span>
 {index === currentStep && (
 <LoadingSpinner size="sm" className="text-blue-600" />
 )}
 </div>
 ))}
 </div>
 </div>
 );
}