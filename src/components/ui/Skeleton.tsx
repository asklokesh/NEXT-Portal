/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import React from 'react';

interface SkeletonProps {
 className?: string;
 width?: string | number;
 height?: string | number;
 circle?: boolean;
 lines?: number;
}

export const Skeleton = ({ 
 className = '', 
 width, 
 height, 
 circle = false,
 lines = 1
}: SkeletonProps) => {
 const baseClasses = 'animate-pulse bg-gray-200 dark:bg-gray-700';
 const circleClasses = circle ? 'rounded-full' : 'rounded';
 
 const style: React.CSSProperties = {};
 if (width) style.width = width;
 if (height) style.height = height;

 if (lines === 1) {
 return (
 <div 
 className={`${baseClasses} ${circleClasses} ${className}`}
 style={style}
 />
 );
 }

 return (
 <div className={className}>
 {Array.from({ length: lines }).map((_, index) => (
 <div
 key={index}
 className={`${baseClasses} ${circleClasses} mb-2 last:mb-0`}
 style={{
 ...style,
 width: index === lines - 1 ? '75%' : width || '100%',
 }}
 />
 ))}
 </div>
 );
}

export const ServiceCardSkeleton = () => {
 return (
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 {/* Header */}
 <div className="flex items-start justify-between mb-4">
 <div className="flex items-center gap-3">
 <Skeleton circle width={40} height={40} />
 <div>
 <Skeleton width={120} height={20} className="mb-2" />
 <Skeleton width={80} height={16} />
 </div>
 </div>
 <Skeleton width={60} height={24} />
 </div>
 
 {/* Description */}
 <Skeleton lines={2} height={16} className="mb-4" />
 
 {/* Tags */}
 <div className="flex gap-2 mb-4">
 <Skeleton width={60} height={24} />
 <Skeleton width={80} height={24} />
 <Skeleton width={70} height={24} />
 </div>
 
 {/* Footer */}
 <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
 <div className="flex items-center gap-4">
 <Skeleton width={60} height={16} />
 <Skeleton width={80} height={16} />
 </div>
 <Skeleton width={24} height={24} />
 </div>
 </div>
 );
}

export const ServiceListSkeleton = () => {
 return (
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-4">
 <Skeleton circle width={32} height={32} />
 <div>
 <Skeleton width={150} height={18} className="mb-1" />
 <Skeleton width={200} height={14} />
 </div>
 </div>
 <div className="flex items-center gap-4">
 <Skeleton width={60} height={20} />
 <Skeleton width={80} height={20} />
 <Skeleton width={24} height={24} />
 </div>
 </div>
 </div>
 );
}

export const ServiceTableSkeleton = () => {
 return (
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
 {/* Table Header */}
 <div className="border-b border-gray-200 dark:border-gray-700 p-4">
 <div className="flex items-center gap-4">
 <Skeleton width={24} height={24} />
 <Skeleton width={120} height={16} />
 <Skeleton width={80} height={16} />
 <Skeleton width={100} height={16} />
 <Skeleton width={90} height={16} />
 <Skeleton width={70} height={16} />
 </div>
 </div>
 
 {/* Table Rows */}
 {Array.from({ length: 5 }).map((_, index) => (
 <div key={index} className="border-b border-gray-200 dark:border-gray-700 p-4 last:border-b-0">
 <div className="flex items-center gap-4">
 <Skeleton width={24} height={24} />
 <Skeleton width={120} height={16} />
 <Skeleton width={80} height={16} />
 <Skeleton width={100} height={16} />
 <Skeleton width={90} height={16} />
 <Skeleton width={70} height={16} />
 </div>
 </div>
 ))}
 </div>
 );
}

export const ErrorState = ({ 
 title = 'Something went wrong',
 message = 'An error occurred while loading data.',
 onRetry,
 retryLabel = 'Try again',
 showRetry = true
}: {
 title?: string;
 message?: string;
 onRetry?: () => void;
 retryLabel?: string;
 showRetry?: boolean;
}) => {
 return (
 <div data-testid="error-state" className="text-center py-12">
 <div className="mx-auto w-24 h-24 mb-4 text-gray-400">
 <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
 </svg>
 </div>
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
 {title}
 </h3>
 <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
 {message}
 </p>
 {showRetry && onRetry && (
 <button
 data-testid="retry-button"
 onClick={onRetry}
 className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
 >
 {retryLabel}
 </button>
 )}
 </div>
 );
}

export const EmptyState = ({
 title = 'No data found',
 message = 'There are no items to display.',
 icon,
 action
}: {
 title?: string;
 message?: string;
 icon?: React.ReactNode;
 action?: React.ReactNode;
}) => {
 return (
 <div className="text-center py-12">
 {icon && (
 <div className="mx-auto w-24 h-24 mb-4 text-gray-400">
 {icon}
 </div>
 )}
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
 {title}
 </h3>
 <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
 {message}
 </p>
 {action}
 </div>
 );
}