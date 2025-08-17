'use client';

import React from 'react';
import { PluginApprovalWorkflow } from '@/components/plugins/PluginApprovalWorkflow';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Clock, CheckCircle, XCircle } from 'lucide-react';

export default function PluginApprovalPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Plugin Approval Workflow</h1>
        <p className="text-gray-600 mt-2">
          Review and approve plugin installation requests with comprehensive security and compliance checks
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Clock className="w-8 h-8 text-yellow-500" />
              <span className="text-2xl font-bold">12</span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">Pending Requests</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Shield className="w-8 h-8 text-blue-500" />
              <span className="text-2xl font-bold">5</span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">In Security Review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <span className="text-2xl font-bold">48</span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">Approved This Month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <XCircle className="w-8 h-8 text-red-500" />
              <span className="text-2xl font-bold">3</span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">Rejected This Month</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" className="space-y-6">
        <TabsList>
          <TabsTrigger value="all">All Requests</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <PluginApprovalWorkflow />
        </TabsContent>

        <TabsContent value="pending">
          <PluginApprovalWorkflow />
        </TabsContent>

        <TabsContent value="approved">
          <Card>
            <CardHeader>
              <CardTitle>Approved Requests</CardTitle>
              <CardDescription>
                Plugins that have been approved for installation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">No approved requests to display</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rejected">
          <Card>
            <CardHeader>
              <CardTitle>Rejected Requests</CardTitle>
              <CardDescription>
                Plugins that have been rejected due to security or compliance issues
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">No rejected requests to display</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}