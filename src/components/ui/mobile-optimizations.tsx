'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, Smartphone, Tablet, Monitor, Info } from 'lucide-react';

interface MobileOptimizationsProps {
  component: string;
  optimizations: string[];
}

export function MobileOptimizationsGuide({ component, optimizations }: MobileOptimizationsProps) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Mobile Optimizations for {component}
        </CardTitle>
        <CardDescription>
          Responsive design improvements for better mobile experience
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {optimizations.map((optimization, index) => (
            <div key={index} className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm">{optimization}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ResponsiveBreakpoints() {
  const breakpoints = [
    { name: 'Mobile', icon: Smartphone, range: '< 640px', prefix: 'default' },
    { name: 'Tablet', icon: Tablet, range: '640px - 1024px', prefix: 'sm:' },
    { name: 'Desktop', icon: Monitor, range: '> 1024px', prefix: 'lg:' }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      {breakpoints.map((breakpoint) => (
        <Card key={breakpoint.name}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <breakpoint.icon className="h-4 w-4" />
              <span className="font-medium">{breakpoint.name}</span>
            </div>
            <div className="text-sm text-gray-600 mb-2">{breakpoint.range}</div>
            <Badge variant="secondary" className="text-xs">
              {breakpoint.prefix}
            </Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function MobileBestPractices() {
  const practices = [
    {
      title: "Touch-Friendly Targets",
      description: "Minimum 44px tap targets for touch interfaces",
      implementation: "Use min-h-[44px] class on interactive elements"
    },
    {
      title: "Responsive Typography", 
      description: "Scale text appropriately across screen sizes",
      implementation: "text-sm sm:text-base lg:text-lg pattern"
    },
    {
      title: "Flexible Layouts",
      description: "Stack vertically on mobile, horizontal on desktop",
      implementation: "flex-col sm:flex-row responsive patterns"
    },
    {
      title: "Optimized Navigation",
      description: "Collapsible navigation for smaller screens",
      implementation: "Hidden navigation with mobile menu triggers"
    },
    {
      title: "Touch Gestures",
      description: "Swipe, pinch, and other mobile gestures",
      implementation: "touch-manipulation CSS property"
    }
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Info className="h-5 w-5" />
        Mobile Design Best Practices
      </h3>
      <div className="space-y-3">
        {practices.map((practice, index) => (
          <Alert key={index}>
            <AlertDescription>
              <div className="space-y-1">
                <div className="font-medium">{practice.title}</div>
                <div className="text-sm text-gray-600">{practice.description}</div>
                <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                  {practice.implementation}
                </code>
              </div>
            </AlertDescription>
          </Alert>
        ))}
      </div>
    </div>
  );
}

export function MobileOptimizationStatus() {
  const components = [
    { 
      name: 'WebhookManager', 
      status: 'completed',
      optimizations: [
        'Responsive dialog sizing (w-[95vw] max-w-2xl h-[90vh])',
        'Mobile-first grid layouts (grid-cols-1 sm:grid-cols-2)',  
        'Collapsible navigation tabs',
        'Touch-friendly button sizing',
        'Stacked form layouts on mobile',
        'Hidden/shown elements based on screen size'
      ]
    },
    {
      name: 'AdvancedPluginMarketplace',
      status: 'completed', 
      optimizations: [
        'Responsive grid (grid-cols-1 sm:grid-cols-2 lg:grid-cols-3)',
        'Mobile-optimized search and filters',
        'Collapsible view mode toggles',
        'Touch-optimized plugin cards',
        'Responsive dialog content',
        'Mobile-friendly plugin stats display'
      ]
    },
    {
      name: 'AuditComplianceDashboard',
      status: 'completed',
      optimizations: [
        'Responsive metrics cards (grid-cols-2 sm:grid-cols-2 lg:grid-cols-4)',
        'Mobile-friendly tab navigation',
        'Collapsible filter sections',
        'Touch-optimized action buttons', 
        'Responsive table layouts',
        'Mobile-safe content areas'
      ]
    }
  ];

  const statusColors = {
    completed: 'bg-green-100 text-green-800',
    'in-progress': 'bg-yellow-100 text-yellow-800',
    pending: 'bg-gray-100 text-gray-800'
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Component Optimization Status</h3>
      <div className="space-y-3">
        {components.map((component) => (
          <MobileOptimizationsGuide 
            key={component.name}
            component={component.name}
            optimizations={component.optimizations}
          />
        ))}
      </div>
    </div>
  );
}