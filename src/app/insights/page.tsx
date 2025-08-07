import InsightsClient from './InsightsClient';

export const metadata = {
  title: 'Insights & Analytics - Platform Metrics',
  description: 'Analyze Backstage usage, developer satisfaction, and adoption metrics'
};

export default function InsightsPage() {
  return <InsightsClient />;
}