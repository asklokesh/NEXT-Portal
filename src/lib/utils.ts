/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
 return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | number): string {
 return new Intl.DateTimeFormat('en-US', {
 month: 'short',
 day: 'numeric',
 year: 'numeric',
 }).format(new Date(date));
}

export function formatRelativeTime(date: Date | string | number): string {
 const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
 const daysDiff = Math.round(
 (new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
 );

 if (daysDiff === 0) return 'today';
 if (daysDiff === -1) return 'yesterday';
 if (daysDiff === 1) return 'tomorrow';
 if (Math.abs(daysDiff) < 7) return rtf.format(daysDiff, 'day');
 if (Math.abs(daysDiff) < 30) return rtf.format(Math.round(daysDiff / 7), 'week');
 if (Math.abs(daysDiff) < 365) return rtf.format(Math.round(daysDiff / 30), 'month');
 return rtf.format(Math.round(daysDiff / 365), 'year');
}

export function debounce<T extends (...args: unknown[]) => unknown>(
 func: T,
 wait: number
): (...args: Parameters<T>) => void {
 let timeout: NodeJS.Timeout;
 return (...args: Parameters<T>) => {
 clearTimeout(timeout);
 timeout = setTimeout(() => func(...args), wait);
 };
}

export function throttle<T extends (...args: unknown[]) => unknown>(
 func: T,
 limit: number
): (...args: Parameters<T>) => void {
 let inThrottle: boolean;
 return (...args: Parameters<T>) => {
 if (!inThrottle) {
 func(...args);
 inThrottle = true;
 setTimeout(() => (inThrottle = false), limit);
 }
 };
}

export function isServer(): boolean {
 return typeof window === 'undefined';
}

export function getBaseUrl(): string {
 if (!isServer()) {
 return '';
 }
 if (process.env.VERCEL_URL) {
 return `https://${process.env.VERCEL_URL}`;
 }
 return `http://localhost:${process.env.PORT ?? 3000}`;
}

export function getErrorMessage(error: unknown): string {
 if (error instanceof Error) return error.message;
 if (typeof error === 'string') return error;
 return 'An unknown error occurred';
}