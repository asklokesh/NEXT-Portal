/**
 * Feature Flags Management Page
 * Main page for feature flag management interface
 */

import { FeatureFlagDashboard } from '@/components/feature-flags/FeatureFlagDashboard';

export default function FeatureFlagsPage() {
  return (
    <div className="container mx-auto py-8">
      <FeatureFlagDashboard />
    </div>
  );
}

export const metadata = {
  title: 'Feature Flags - Portal Management',
  description: 'Manage feature flags, rollouts, and experiments for your applications',
};