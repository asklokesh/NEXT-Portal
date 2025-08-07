'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Check, X, AlertCircle, Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
import { BackstageConnectionTest } from '@/components/setup/BackstageConnectionTest';
import { DatabaseSetup } from '@/components/setup/DatabaseSetup';
import { IntegrationsSetup } from '@/components/setup/IntegrationsSetup';
import { InitialConfiguration } from '@/components/setup/InitialConfiguration';
import { PluginsSetup } from '@/components/setup/PluginsSetup';
import { FinalReview } from '@/components/setup/FinalReview';

const setupSteps = [
 {
 id: 'welcome',
 title: 'Welcome',
 description: 'Get started with Backstage IDP',
 },
 {
 id: 'backstage',
 title: 'Backstage Connection',
 description: 'Connect to your Backstage backend',
 },
 {
 id: 'database',
 title: 'Database Setup',
 description: 'Configure your database connection',
 },
 {
 id: 'configuration',
 title: 'Initial Configuration',
 description: 'Set up basic configuration',
 },
 {
 id: 'integrations',
 title: 'Integrations',
 description: 'Connect external services',
 },
 {
 id: 'plugins',
 title: 'Plugins',
 description: 'Install and configure plugins',
 },
 {
 id: 'review',
 title: 'Review & Launch',
 description: 'Review your configuration',
 },
];

export default function SetupWizard() {
 const router = useRouter();
 const [currentStep, setCurrentStep] = useState(0);
 const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
 const [setupData, setSetupData] = useState({
 backstageUrl: '',
 backstageToken: '',
 databaseUrl: '',
 organizationName: '',
 adminEmail: '',
 enabledIntegrations: [] as string[],
 installedPlugins: [] as string[],
 });
 const [isValidating, setIsValidating] = useState(false);

 const progress = ((currentStep + 1) / setupSteps.length) * 100;

 const handleNext = () => {
 setCompletedSteps(prev => new Set([...prev, currentStep]));
 setCurrentStep(prev => Math.min(prev + 1, setupSteps.length - 1));
 };

 const handlePrevious = () => {
 setCurrentStep(prev => Math.max(prev - 1, 0));
 };

 const handleComplete = async () => {
 try {
 setIsValidating(true);
 
 // Save configuration
 const response = await fetch('/api/setup/complete', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(setupData),
 });

 if (!response.ok) {
 throw new Error('Failed to complete setup');
 }

 // Redirect to dashboard
 router.push('/dashboard');
 } catch (error) {
 console.error('Setup completion error:', error);
 } finally {
 setIsValidating(false);
 }
 };

 const updateSetupData = (data: Partial<typeof setupData>) => {
 setSetupData(prev => ({ ...prev, ...data }));
 };

 return (
 <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
 <div className="container mx-auto py-8 px-4">
 {/* Header */}
 <div className="text-center mb-8">
 <h1 className="text-4xl font-bold mb-2">Backstage IDP Setup Wizard</h1>
 <p className="text-muted-foreground">
 Let's get your Internal Developer Platform up and running
 </p>
 </div>

 {/* Progress */}
 <div className="max-w-4xl mx-auto mb-8">
 <Progress value={progress} className="h-2" />
 <div className="flex justify-between mt-4">
 {setupSteps.map((step, index) => (
 <div
 key={step.id}
 className={`flex flex-col items-center cursor-pointer ${
 index <= currentStep ? 'text-primary' : 'text-muted-foreground'
 }`}
 onClick={() => {
 if (index <= currentStep || completedSteps.has(index - 1)) {
 setCurrentStep(index);
 }
 }}
 >
 <div
 className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${
 completedSteps.has(index)
 ? 'bg-green-500 text-white'
 : index === currentStep
 ? 'bg-primary text-primary-foreground'
 : 'bg-muted'
 }`}
 >
 {completedSteps.has(index) ? (
 <Check className="h-4 w-4" />
 ) : (
 <span className="text-sm">{index + 1}</span>
 )}
 </div>
 <span className="text-xs text-center hidden md:block">{step.title}</span>
 </div>
 ))}
 </div>
 </div>

 {/* Content */}
 <div className="max-w-4xl mx-auto">
 <Card>
 <CardHeader>
 <CardTitle>{setupSteps[currentStep].title}</CardTitle>
 <CardDescription>{setupSteps[currentStep].description}</CardDescription>
 </CardHeader>
 <CardContent>
 {currentStep === 0 && (
 <div className="space-y-6">
 <div className="text-center py-8">
 <div className="w-32 h-32 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
 <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center">
 <div className="w-12 h-12 bg-primary rounded-full" />
 </div>
 </div>
 <h2 className="text-2xl font-semibold mb-4">
 Welcome to Backstage IDP Platform
 </h2>
 <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
 This wizard will guide you through setting up your Internal Developer Platform.
 The entire process takes about 5-10 minutes.
 </p>
 </div>

 <div className="grid gap-4 md:grid-cols-2">
 <Card>
 <CardContent className="pt-6">
 <h3 className="font-semibold mb-2">What you'll need:</h3>
 <ul className="space-y-2 text-sm text-muted-foreground">
 <li className="flex items-start gap-2">
 <Check className="h-4 w-4 text-green-500 mt-0.5" />
 Backstage backend URL and authentication token
 </li>
 <li className="flex items-start gap-2">
 <Check className="h-4 w-4 text-green-500 mt-0.5" />
 Database connection details (PostgreSQL)
 </li>
 <li className="flex items-start gap-2">
 <Check className="h-4 w-4 text-green-500 mt-0.5" />
 API keys for integrations (optional)
 </li>
 </ul>
 </CardContent>
 </Card>

 <Card>
 <CardContent className="pt-6">
 <h3 className="font-semibold mb-2">What we'll set up:</h3>
 <ul className="space-y-2 text-sm text-muted-foreground">
 <li className="flex items-start gap-2">
 <Check className="h-4 w-4 text-primary mt-0.5" />
 Connection to your Backstage backend
 </li>
 <li className="flex items-start gap-2">
 <Check className="h-4 w-4 text-primary mt-0.5" />
 Database and caching configuration
 </li>
 <li className="flex items-start gap-2">
 <Check className="h-4 w-4 text-primary mt-0.5" />
 Essential plugins and integrations
 </li>
 </ul>
 </CardContent>
 </Card>
 </div>
 </div>
 )}

 {currentStep === 1 && (
 <BackstageConnectionTest
 data={setupData}
 onUpdate={updateSetupData}
 />
 )}

 {currentStep === 2 && (
 <DatabaseSetup
 data={setupData}
 onUpdate={updateSetupData}
 />
 )}

 {currentStep === 3 && (
 <InitialConfiguration
 data={setupData}
 onUpdate={updateSetupData}
 />
 )}

 {currentStep === 4 && (
 <IntegrationsSetup
 data={setupData}
 onUpdate={updateSetupData}
 />
 )}

 {currentStep === 5 && (
 <PluginsSetup
 data={setupData}
 onUpdate={updateSetupData}
 />
 )}

 {currentStep === 6 && (
 <FinalReview
 data={setupData}
 onComplete={handleComplete}
 isValidating={isValidating}
 />
 )}
 </CardContent>

 {/* Navigation */}
 <div className="flex justify-between p-6 border-t">
 <Button
 variant="outline"
 onClick={handlePrevious}
 disabled={currentStep === 0}
 >
 <ChevronLeft className="h-4 w-4 mr-2" />
 Previous
 </Button>

 {currentStep < setupSteps.length - 1 ? (
 <Button onClick={handleNext}>
 Next
 <ChevronRight className="h-4 w-4 ml-2" />
 </Button>
 ) : (
 <Button
 onClick={handleComplete}
 disabled={isValidating}
 >
 {isValidating ? (
 <>
 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
 Completing Setup...
 </>
 ) : (
 <>
 Complete Setup
 <Check className="h-4 w-4 ml-2" />
 </>
 )}
 </Button>
 )}
 </div>
 </Card>
 </div>

 {/* Skip Setup Option */}
 <div className="text-center mt-8">
 <Button
 variant="ghost"
 className="text-muted-foreground"
 onClick={() => router.push('/dashboard')}
 >
 Skip setup and configure manually
 </Button>
 </div>
 </div>
 </div>
 );
}