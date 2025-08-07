'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

interface ServiceWorkerProviderProps {
 children: React.ReactNode;
}

export function ServiceWorkerProvider({ children }: ServiceWorkerProviderProps) {
 const [isOffline, setIsOffline] = useState(false);
 const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);

 useEffect(() => {
 // Check if service workers are supported
 if (!('serviceWorker' in navigator)) {
 console.log('Service Workers not supported');
 return;
 }

 // Register service worker
 const registerServiceWorker = async () => {
 try {
 const registration = await navigator.serviceWorker.register('/sw.js', {
 scope: '/',
 });

 console.log('Service Worker registered:', registration);
 setSwRegistration(registration);

 // Check for updates
 registration.addEventListener('updatefound', () => {
 const newWorker = registration.installing;
 if (newWorker) {
 newWorker.addEventListener('statechange', () => {
 if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
 // New content available
 toast.success(
 'New version available! Click to update.',
 {
 duration: 10000,
 onClick: () => {
 newWorker.postMessage({ type: 'SKIP_WAITING' });
 window.location.reload();
 },
 }
 );
 }
 });
 }
 });

 // Check for updates every hour
 setInterval(() => {
 registration.update();
 }, 60 * 60 * 1000);

 } catch (error) {
 console.error('Service Worker registration failed:', error);
 }
 };

 registerServiceWorker();

 // Handle online/offline events
 const handleOnline = () => {
 setIsOffline(false);
 toast.success('Back online!');
 };

 const handleOffline = () => {
 setIsOffline(true);
 toast.error('You are offline. Some features may be limited.');
 };

 window.addEventListener('online', handleOnline);
 window.addEventListener('offline', handleOffline);

 // Set initial state
 setIsOffline(!navigator.onLine);

 return () => {
 window.removeEventListener('online', handleOnline);
 window.removeEventListener('offline', handleOffline);
 };
 }, []);

 // Handle controller change (new service worker activated)
 useEffect(() => {
 if (!('serviceWorker' in navigator)) return;

 const handleControllerChange = () => {
 window.location.reload();
 };

 navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

 return () => {
 navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
 };
 }, []);

 // Provide offline status to children via data attribute
 return (
 <div data-offline={isOffline}>
 {children}
 {isOffline && (
 <div className="fixed bottom-4 left-4 bg-yellow-500 text-white px-4 py-2 rounded-md shadow-lg z-50 flex items-center gap-2">
 <svg 
 className="w-5 h-5" 
 fill="none" 
 stroke="currentColor" 
 viewBox="0 0 24 24"
 >
 <path 
 strokeLinecap="round" 
 strokeLinejoin="round" 
 strokeWidth={2} 
 d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" 
 />
 </svg>
 <span className="text-sm font-medium">Offline Mode</span>
 </div>
 )}
 </div>
 );
}

// Hook to access service worker registration
export function useServiceWorker() {
 const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
 const [isOffline, setIsOffline] = useState(!navigator.onLine);

 useEffect(() => {
 if ('serviceWorker' in navigator) {
 navigator.serviceWorker.ready.then(setRegistration);
 }

 const handleOnline = () => setIsOffline(false);
 const handleOffline = () => setIsOffline(true);

 window.addEventListener('online', handleOnline);
 window.addEventListener('offline', handleOffline);

 return () => {
 window.removeEventListener('online', handleOnline);
 window.removeEventListener('offline', handleOffline);
 };
 }, []);

 const clearCache = async () => {
 if (registration?.active) {
 registration.active.postMessage({ type: 'CLEAR_CACHE' });
 toast.success('Cache cleared successfully');
 }
 };

 const checkForUpdates = async () => {
 if (registration) {
 try {
 await registration.update();
 toast.success('Checked for updates');
 } catch (error) {
 toast.error('Failed to check for updates');
 }
 }
 };

 return {
 registration,
 isOffline,
 clearCache,
 checkForUpdates,
 };
}