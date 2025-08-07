
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
 Card,
 CardContent,
 CardDescription,
 CardHeader,
 CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
 FileCode,
 GitBranch,
 Search,
 ArrowLeft,
 Upload,
 Globe,
 Zap,
 Info
} from 'lucide-react';
import { ImportFromUrl } from '@/components/catalog/ImportFromUrl';
import { AutoDiscovery } from '@/components/catalog/AutoDiscovery';
import {
 Alert,
 AlertDescription,
 AlertTitle,
} from '@/components/ui/alert';

export default function ImportEntitiesPage() {
 const router = useRouter();
 const [activeTab, setActiveTab] = useState('url');

 return (
 <div className="min-h-screen bg-background">
 <div className="container mx-auto px-4 py-6 max-w-7xl">
 {/* Header */}
 <div className="flex items-center justify-between mb-6">
 <div className="flex items-center gap-4">
 <Button
 variant="ghost"
 size="icon"
 onClick={() => router.push('/catalog')}
 >
 <ArrowLeft className="h-4 w-4" />
 </Button>
 <div>
 <h1 className="text-3xl font-bold">Import Entities</h1>
 <p className="text-muted-foreground mt-1">
 Add existing services and resources to your catalog
 </p>
 </div>
 </div>
 </div>

 {/* Quick Actions */}
 <div className="grid gap-4 md:grid-cols-3 mb-6">
 <Card
 className={`cursor-pointer transition-colors hover:border-primary ${
 activeTab === 'url' ? 'border-primary bg-primary/5' : ''
 }`}
 onClick={() => setActiveTab('url')}
 >
 <CardHeader className="pb-3">
 <div className="flex items-center gap-2">
 <div className="p-2 bg-primary/10 rounded-lg">
 <GitBranch className="h-5 w-5 text-primary" />
 </div>
 <CardTitle className="text-base">Import from URL</CardTitle>
 </div>
 </CardHeader>
 <CardContent>
 <CardDescription>
 Import catalog files from Git repositories or direct URLs
 </CardDescription>
 </CardContent>
 </Card>

 <Card
 className={`cursor-pointer transition-colors hover:border-primary ${
 activeTab === 'discovery' ? 'border-primary bg-primary/5' : ''
 }`}
 onClick={() => setActiveTab('discovery')}
 >
 <CardHeader className="pb-3">
 <div className="flex items-center gap-2">
 <div className="p-2 bg-primary/10 rounded-lg">
 <Search className="h-5 w-5 text-primary" />
 </div>
 <CardTitle className="text-base">Auto-discovery</CardTitle>
 </div>
 </CardHeader>
 <CardContent>
 <CardDescription>
 Automatically discover entities from your infrastructure
 </CardDescription>
 </CardContent>
 </Card>

 <Card
 className="cursor-pointer transition-colors hover:border-primary opacity-50"
 >
 <CardHeader className="pb-3">
 <div className="flex items-center gap-2">
 <div className="p-2 bg-gray-100 rounded-lg">
 <Upload className="h-5 w-5 text-gray-500" />
 </div>
 <CardTitle className="text-base">Upload File</CardTitle>
 </div>
 </CardHeader>
 <CardContent>
 <CardDescription>
 Upload catalog files directly from your computer
 </CardDescription>
 <div className="mt-2">
 <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
 Coming Soon
 </span>
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Import Methods */}
 <Tabs value={activeTab} onValueChange={setActiveTab}>
 <TabsList className="grid w-full grid-cols-2 max-w-md">
 <TabsTrigger value="url" className="flex items-center gap-2">
 <GitBranch className="h-4 w-4" />
 Import from URL
 </TabsTrigger>
 <TabsTrigger value="discovery" className="flex items-center gap-2">
 <Search className="h-4 w-4" />
 Auto-discovery
 </TabsTrigger>
 </TabsList>

 <div className="mt-6">
 <TabsContent value="url">
 <ImportFromUrl />
 </TabsContent>

 <TabsContent value="discovery">
 <AutoDiscovery />
 </TabsContent>
 </div>
 </Tabs>

 {/* Help Section */}
 <div className="mt-8">
 <Alert>
 <Info className="h-4 w-4" />
 <AlertTitle>Need Help?</AlertTitle>
 <AlertDescription className="space-y-2 mt-2">
 <p>Here are some tips for importing entities:</p>
 <ul className="list-disc list-inside space-y-1 text-sm">
 <li>
 <strong>Import from URL:</strong> Best for importing specific repositories or when you know exactly where your catalog files are located.
 </li>
 <li>
 <strong>Auto-discovery:</strong> Ideal for continuously discovering new services and keeping your catalog in sync with your infrastructure.
 </li>
 <li>
 All imported entities will be validated before being added to the catalog.
 </li>
 </ul>
 <div className="mt-3">
 <Button variant="link" className="p-0 h-auto">
 View Documentation
 <Globe className="ml-1 h-3 w-3" />
 </Button>
 </div>
 </AlertDescription>
 </Alert>
 </div>
 </div>
 </div>
 );
}