'use client';
/* eslint-disable react/function-component-definition */

import { DeploymentPipeline } from '@/components/deployment/DeploymentPipeline';

export default function DeploymentsPage() {
 return (
 <div className="container mx-auto px-4 py-6">
 <DeploymentPipeline showHistory={true} />
 </div>
 );
}