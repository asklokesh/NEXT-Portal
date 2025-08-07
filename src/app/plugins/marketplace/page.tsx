import RealTimeMarketplace from '@/components/plugins/RealTimeMarketplace';

export const metadata = {
  title: 'Plugin Marketplace - Install & Manage Backstage Plugins',
  description: 'Real-time plugin marketplace with Docker containerization and Kubernetes deployment'
};

export default function PluginMarketplacePage() {
  return <RealTimeMarketplace />;
}