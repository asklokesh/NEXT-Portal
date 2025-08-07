import { Metadata } from 'next';
import { ServiceHealthDetail } from '@/components/soundcheck/ServiceHealthDetail';

export const metadata: Metadata = {
 title: 'Service Health Details - Soundcheck',
 description: 'Detailed health analysis and recommendations for your service'
};

interface PageProps {
 params: {
 serviceId: string;
 };
}

export default function ServiceDetailPage({ params }: PageProps) {
 return <ServiceHealthDetail serviceId={params.serviceId} />;
}