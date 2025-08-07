'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { 
 LayoutGrid,
 GitCompare,
 TestTube,
 FileText,
 Share2,
 Shield,
 GitBranch,
 BarChart3,
 Settings,
 Package,
 ArrowLeft
} from 'lucide-react';
import React, { useState } from 'react';

import { cn } from '@/lib/utils';

import { TemplateGrid } from './TemplateGrid';
import { TemplateAdminPanel } from '../TemplateAdmin/TemplateAdminPanel';
import TemplateBuilderPage from '@/app/templates/builder/page';
import { TemplateAnalyticsDashboard } from '../TemplateAnalytics/TemplateAnalyticsDashboard';
import { TemplateComparison } from '../TemplateComparison/TemplateComparison';
import { TemplateDocumentationGenerator } from '../TemplateDocumentation/TemplateDocumentationGenerator';
import { TemplateShareDialog } from '../TemplateSharing/TemplateShareDialog';
import { TemplateTestEnvironment } from '../TemplateTesting/TemplateTestEnvironment';
import { TemplateVersionManager } from '../TemplateVersioning/TemplateVersionManager';

import type { TemplateEntity } from '@/services/backstage/types/templates';

interface TemplateMarketplaceHubProps {
 className?: string;
 isAdmin?: boolean;
}

type ViewMode = 
 | 'marketplace' 
 | 'builder'
 | 'compare' 
 | 'testing' 
 | 'documentation' 
 | 'analytics' 
 | 'versions' 
 | 'admin';

interface FeatureCard {
 id: ViewMode;
 title: string;
 description: string;
 icon: React.ComponentType<{ className?: string }>;
 adminOnly?: boolean;
 comingSoon?: boolean;
}

const FEATURES: FeatureCard[] = [
 {
 id: 'marketplace',
 title: 'Template Marketplace',
 description: 'Browse, search, and use templates to bootstrap your projects',
 icon: LayoutGrid,
 },
 {
 id: 'builder',
 title: 'Template Builder',
 description: 'Create templates visually without writing YAML',
 icon: Package,
 },
 {
 id: 'compare',
 title: 'Template Comparison',
 description: 'Compare templates side by side to find the best fit',
 icon: GitCompare,
 },
 {
 id: 'testing',
 title: 'Template Testing',
 description: 'Test templates and create preview environments',
 icon: TestTube,
 },
 {
 id: 'documentation',
 title: 'Documentation Generator',
 description: 'Generate comprehensive documentation for templates',
 icon: FileText,
 },
 {
 id: 'analytics',
 title: 'Analytics Dashboard',
 description: 'View template usage analytics and insights',
 icon: BarChart3,
 },
 {
 id: 'versions',
 title: 'Version Management',
 description: 'Track and manage template versions over time',
 icon: GitBranch,
 },
 {
 id: 'admin',
 title: 'Admin Panel',
 description: 'Administrative controls for template governance',
 icon: Shield,
 adminOnly: true,
 },
];

export const TemplateMarketplaceHub: React.FC<TemplateMarketplaceHubProps> = ({
 className,
 isAdmin = false,
}) => {
 const [currentView, setCurrentView] = useState<ViewMode>('marketplace');
 const [selectedTemplate, setSelectedTemplate] = useState<TemplateEntity | null>(null);
 const [selectedTemplateRef, setSelectedTemplateRef] = useState<string | null>(null);
 const [showShareDialog, setShowShareDialog] = useState(false);

 const availableFeatures = FEATURES.filter(feature => 
 !feature.adminOnly || (feature.adminOnly && isAdmin)
 );

 const handleBackToHub = () => {
 setCurrentView('marketplace');
 setSelectedTemplate(null);
 setSelectedTemplateRef(null);
 };

 const handleTemplateSelect = (templateRef: string, template?: TemplateEntity) => {
 setSelectedTemplateRef(templateRef);
 if (template) {
 setSelectedTemplate(template);
 }
 };

 const renderFeatureCard = (feature: FeatureCard) => {
 const Icon = feature.icon;
 
 return (
 <button
 key={feature.id}
 onClick={() => setCurrentView(feature.id)}
 disabled={feature.comingSoon}
 className={cn(
 'group relative flex flex-col items-start p-6 rounded-lg border bg-card text-left',
 'hover:shadow-md hover:border-primary/50 transition-all duration-200',
 'disabled:opacity-50 disabled:cursor-not-allowed',
 feature.comingSoon && 'border-dashed'
 )}
 >
 {feature.comingSoon && (
 <div className="absolute top-2 right-2 px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">
 Coming Soon
 </div>
 )}
 
 <div className="p-3 rounded-lg bg-primary/10 mb-4 group-hover:bg-primary/20 transition-colors">
 <Icon className="w-6 h-6 text-primary" />
 </div>
 
 <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
 <p className="text-sm text-muted-foreground">{feature.description}</p>
 
 {feature.adminOnly && (
 <div className="mt-3 px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800">
 Admin Only
 </div>
 )}
 </button>
 );
 };

 const renderCurrentView = () => {
 switch (currentView) {
 case 'marketplace':
 return <TemplateGrid />;
 
 case 'builder':
 return (
 <div className="space-y-6">
 <div className="flex items-center gap-4">
 <button
 onClick={handleBackToHub}
 className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
 >
 <ArrowLeft className="w-4 h-4" />
 Back to Templates
 </button>
 </div>
 <TemplateBuilderPage />
 </div>
 );
 
 case 'compare':
 return (
 <div className="space-y-6">
 <div className="flex items-center gap-4">
 <button
 onClick={handleBackToHub}
 className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
 >
 <ArrowLeft className="w-4 h-4" />
 Back to Hub
 </button>
 </div>
 <TemplateComparison />
 </div>
 );
 
 case 'testing':
 return (
 <div className="space-y-6">
 <div className="flex items-center gap-4">
 <button
 onClick={handleBackToHub}
 className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
 >
 <ArrowLeft className="w-4 h-4" />
 Back to Hub
 </button>
 </div>
 {selectedTemplateRef ? (
 <TemplateTestEnvironment templateRef={selectedTemplateRef} />
 ) : (
 <div className="text-center py-12">
 <TestTube className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
 <h3 className="text-lg font-semibold mb-2">No Template Selected</h3>
 <p className="text-muted-foreground">
 Select a template from the marketplace to test it
 </p>
 <button
 onClick={() => setCurrentView('marketplace')}
 className="mt-4 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
 >
 Browse Templates
 </button>
 </div>
 )}
 </div>
 );
 
 case 'documentation':
 return (
 <div className="space-y-6">
 <div className="flex items-center gap-4">
 <button
 onClick={handleBackToHub}
 className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
 >
 <ArrowLeft className="w-4 h-4" />
 Back to Hub
 </button>
 </div>
 {selectedTemplateRef ? (
 <TemplateDocumentationGenerator templateRef={selectedTemplateRef} />
 ) : (
 <div className="text-center py-12">
 <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
 <h3 className="text-lg font-semibold mb-2">No Template Selected</h3>
 <p className="text-muted-foreground">
 Select a template from the marketplace to generate documentation
 </p>
 <button
 onClick={() => setCurrentView('marketplace')}
 className="mt-4 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
 >
 Browse Templates
 </button>
 </div>
 )}
 </div>
 );
 
 case 'analytics':
 return (
 <div className="space-y-6">
 <div className="flex items-center gap-4">
 <button
 onClick={handleBackToHub}
 className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
 >
 <ArrowLeft className="w-4 h-4" />
 Back to Hub
 </button>
 </div>
 <TemplateAnalyticsDashboard />
 </div>
 );
 
 case 'versions':
 return (
 <div className="space-y-6">
 <div className="flex items-center gap-4">
 <button
 onClick={handleBackToHub}
 className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
 >
 <ArrowLeft className="w-4 h-4" />
 Back to Hub
 </button>
 </div>
 {selectedTemplateRef ? (
 <TemplateVersionManager templateRef={selectedTemplateRef} />
 ) : (
 <div className="text-center py-12">
 <GitBranch className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
 <h3 className="text-lg font-semibold mb-2">No Template Selected</h3>
 <p className="text-muted-foreground">
 Select a template from the marketplace to manage its versions
 </p>
 <button
 onClick={() => setCurrentView('marketplace')}
 className="mt-4 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
 >
 Browse Templates
 </button>
 </div>
 )}
 </div>
 );
 
 case 'admin':
 return (
 <div className="space-y-6">
 <div className="flex items-center gap-4">
 <button
 onClick={handleBackToHub}
 className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
 >
 <ArrowLeft className="w-4 h-4" />
 Back to Hub
 </button>
 </div>
 <TemplateAdminPanel />
 </div>
 );
 
 default:
 return null;
 }
 };

 // Show hub overview for marketplace view
 if (currentView === 'marketplace') {
 return (
 <div className={cn('h-full', className)}>
 <TemplateGrid />
 
 {/* Quick access to other features */}
 <div className="fixed bottom-4 right-4 z-40">
 <div className="bg-card rounded-lg border shadow-lg p-4">
 <h4 className="font-medium mb-3 text-sm">Quick Actions</h4>
 <div className="flex flex-col gap-2">
 <button
 onClick={() => setCurrentView('builder')}
 className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors"
 >
 <Package className="w-4 h-4" />
 Create Template
 </button>
 <button
 onClick={() => setCurrentView('compare')}
 className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors"
 >
 <GitCompare className="w-4 h-4" />
 Compare Templates
 </button>
 <button
 onClick={() => setCurrentView('analytics')}
 className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors"
 >
 <BarChart3 className="w-4 h-4" />
 Analytics
 </button>
 </div>
 </div>
 </div>

 {/* Share dialog */}
 {showShareDialog && selectedTemplate && (
 <TemplateShareDialog
 template={selectedTemplate}
 onClose={() => setShowShareDialog(false)}
 />
 )}
 </div>
 );
 }

 // Show feature hub for other views
 return (
 <div className={cn('h-full', className)}>
 {renderCurrentView()}
 </div>
 );
};