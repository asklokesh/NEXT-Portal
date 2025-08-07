import { Metadata } from 'next';
import { SoundcheckDashboard } from '@/components/soundcheck/SoundcheckDashboard';

export const metadata: Metadata = {
 title: 'Soundcheck - Quality & Compliance Platform',
 description: 'Monitor and improve the quality of your services with comprehensive checks and insights'
};

export default function SoundcheckPage() {
 return <SoundcheckDashboard />;
}