/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { Inter } from 'next/font/google';

import { AppShell } from '@/components/layout/AppShell';
import { FunctionalProviders as Providers } from '@/components/providers/FunctionalProviders';
import { FeatureTogglesProvider } from '@/contexts/FeatureTogglesContext';
import '@/styles/globals.css';

import type { Metadata } from 'next';

const inter = Inter({ 
 subsets: ['latin'],
 variable: '--font-inter',
 display: 'swap',
 preload: true,
});

export const metadata: Metadata = {
 title: 'NEXT Portal - Modern Internal Developer Platform',
 description: 'Enterprise-grade Internal Developer Portal for modern development teams. Streamline workflows, manage services, and accelerate delivery.',
 keywords: ['internal developer platform', 'idp', 'developer portal', 'service catalog', 'platform engineering', 'devops'],
 authors: [{ name: 'NEXT Portal Team' }],
 manifest: '/manifest.json',
 icons: {
  icon: [
   { url: '/favicon.ico', sizes: 'any' },
   { url: '/favicon.svg', type: 'image/svg+xml' },
   { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
   { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
  ],
  apple: [
   { url: '/apple-touch-icon.png', sizes: '180x180' },
  ],
 },
 appleWebApp: {
 capable: true,
 statusBarStyle: 'default',
 title: 'NEXT Portal',
 },
 openGraph: {
 title: 'NEXT Portal - Modern Internal Developer Platform',
 description: 'Enterprise-grade Internal Developer Portal for modern development teams. Streamline workflows, manage services, and accelerate delivery.',
 type: 'website',
 siteName: 'NEXT Portal',
 },
};

export const viewport = {
 width: 'device-width',
 initialScale: 1,
 themeColor: [
 { media: '(prefers-color-scheme: light)', color: '#ffffff' },
 { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
 ],
};

const RootLayout = ({
 children,
}: {
 children: React.ReactNode;
}) => {
 return (
 <html lang="en" className={inter.variable} suppressHydrationWarning>
 <head>
 <script src="/cache-buster.js" defer />
 </head>
 <body className="min-h-screen bg-background font-sans antialiased">
 <Providers>
 <FeatureTogglesProvider>
 <AppShell>
 {children}
 </AppShell>
 </FeatureTogglesProvider>
 </Providers>
 </body>
 </html>
 );
};

export default RootLayout;