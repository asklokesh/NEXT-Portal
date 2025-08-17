'use client';

import React, { useState } from 'react';
import { PluginDiscovery } from '@/components/plugins/PluginDiscovery';
import { PluginApprovalWorkflow } from '@/components/plugins/PluginApprovalWorkflow';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Package, 
  Search, 
  Shield, 
  TrendingUp, 
  Download,
  Star,
  Info,
  CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function PluginDiscoveryPage() {
  const [requestedPlugin, setRequestedPlugin] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('discover');

  const handleInstallRequest = (plugin: any) => {
    setRequestedPlugin(plugin);
    toast.success(`Installation request submitted for ${plugin.name}`);
    // Optionally switch to approval tab
    setTimeout(() => {
      setActiveTab('approvals');
    }, 1500);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Plugin Discovery & Management</h1>
        <p className="text-gray-600 mt-2">
          Discover, evaluate, and install Backstage plugins from the NPM registry
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Package className="w-5 h-5 text-blue-500" />
              <span className="text-xl font-bold">2,847</span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-600">Available Plugins</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-xl font-bold">24</span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-600">Installed Plugins</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Shield className="w-5 h-5 text-purple-500" />
              <span className="text-xl font-bold">98%</span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-600">Security Score</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <TrendingUp className="w-5 h-5 text-orange-500" />
              <span className="text-xl font-bold">12</span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-600">Updates Available</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Star className="w-5 h-5 text-yellow-500" />
              <span className="text-xl font-bold">156</span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-600">Featured Plugins</p>
          </CardContent>
        </Card>
      </div>

      {/* Info Alert */}
      {requestedPlugin && (
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertTitle>Installation Request Submitted</AlertTitle>
          <AlertDescription>
            Your request to install <strong>{requestedPlugin.name}</strong> has been submitted for approval.
            Track its progress in the Approval Requests tab.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="discover">
            <Search className="w-4 h-4 mr-2" />
            Discover Plugins
          </TabsTrigger>
          <TabsTrigger value="installed">
            <Package className="w-4 h-4 mr-2" />
            Installed Plugins
          </TabsTrigger>
          <TabsTrigger value="approvals">
            <Shield className="w-4 h-4 mr-2" />
            Approval Requests
          </TabsTrigger>
        </TabsList>

        <TabsContent value="discover">
          <PluginDiscovery 
            onInstallRequest={handleInstallRequest}
            showInstalled={false}
          />
        </TabsContent>

        <TabsContent value="installed">
          <Card>
            <CardHeader>
              <CardTitle>Installed Plugins</CardTitle>
              <CardDescription>
                Manage your currently installed Backstage plugins
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Example installed plugins */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <Package className="w-8 h-8 text-gray-400" />
                    <div>
                      <div className="font-medium">@backstage/plugin-kubernetes</div>
                      <div className="text-sm text-gray-500">v0.11.2 • Installed 2 weeks ago</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className="bg-green-100 text-green-800">Active</Badge>
                    <Badge variant="outline">Update Available</Badge>
                    <Button size="sm" variant="outline">Configure</Button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <Package className="w-8 h-8 text-gray-400" />
                    <div>
                      <div className="font-medium">@backstage/plugin-github-actions</div>
                      <div className="text-sm text-gray-500">v0.6.8 • Installed 1 month ago</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className="bg-green-100 text-green-800">Active</Badge>
                    <Button size="sm" variant="outline">Configure</Button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <Package className="w-8 h-8 text-gray-400" />
                    <div>
                      <div className="font-medium">@backstage/plugin-tech-radar</div>
                      <div className="text-sm text-gray-500">v0.7.1 • Installed 3 months ago</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className="bg-yellow-100 text-yellow-800">Disabled</Badge>
                    <Button size="sm" variant="outline">Enable</Button>
                    <Button size="sm" variant="outline">Configure</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approvals">
          <PluginApprovalWorkflow />
        </TabsContent>
      </Tabs>
    </div>
  );
}