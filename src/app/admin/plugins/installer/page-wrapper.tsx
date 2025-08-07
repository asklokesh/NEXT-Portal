'use client';

import dynamic from 'next/dynamic';
import { PageLoader } from '@/lib/lazy';

const PluginInstallerContent = dynamic(
 () => import('./page').then(mod => ({ default: mod.default })),
 { 
 loading: () => <PageLoader />,
 ssr: false // Disable SSR for this heavy component
 }
);

export default function PluginInstallerPage() {
 return <PluginInstallerContent />;
}