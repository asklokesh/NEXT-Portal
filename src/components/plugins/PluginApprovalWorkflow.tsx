'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  MessageSquare,
  FileSearch,
  Lock,
  Unlock,
  GitBranch,
  Package,
  Users,
  Activity,
  ChevronRight,
  RefreshCw,
  Download,
  Upload,
  Zap,
  Info,
  Check,
  X,
  AlertCircle,
  ShieldCheck,
  UserCheck,
  FileCheck,
  GitPullRequest,
  Terminal,
  BarChart3
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface ApprovalRequest {
  id: string;
  pluginId: string;
  pluginName: string;
  pluginVersion: string;
  requestType: 'INSTALL' | 'UPDATE' | 'REMOVE' | 'CONFIGURATION';
  status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  requestedBy: {
    id: string;
    name: string;
    email: string;
    team: string;
  };
  approvers: Array<{
    id: string;
    name: string;
    role: string;
    approved?: boolean;
    approvedAt?: string;
    comments?: string;
  }>;
  stage: {
    current: number;
    total: number;
    name: string;
    type: 'SECURITY' | 'COMPLIANCE' | 'TECHNICAL' | 'BUSINESS' | 'FINAL';
  };
  securityScan: {
    status: 'PENDING' | 'SCANNING' | 'PASSED' | 'FAILED' | 'WARNING';
    vulnerabilities: Array<{
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      title: string;
      description: string;
      cve?: string;
    }>;
    score: number;
    scannedAt?: string;
  };
  complianceCheck: {
    status: 'PENDING' | 'CHECKING' | 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIAL';
    violations: string[];
    policies: Array<{
      name: string;
      status: 'PASS' | 'FAIL' | 'WARNING';
      message?: string;
    }>;
    checkedAt?: string;
  };
  testResults: {
    status: 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'SKIPPED';
    passed: number;
    failed: number;
    skipped: number;
    coverage: number;
    duration?: number;
    testedAt?: string;
  };
  dependencies: Array<{
    name: string;
    version: string;
    approved: boolean;
    conflicts?: string[];
  }>;
  license: {
    type: string;
    isApproved: boolean;
    restrictions?: string[];
  };
  metadata: {
    description?: string;
    repository?: string;
    homepage?: string;
    author?: string;
    downloads?: number;
    stars?: number;
    lastPublished?: string;
  };
  history: Array<{
    action: string;
    actor: string;
    timestamp: string;
    details?: string;
  }>;
  comments: Array<{
    id: string;
    author: string;
    role: string;
    message: string;
    timestamp: string;
    type: 'COMMENT' | 'APPROVAL' | 'REJECTION' | 'REQUEST_INFO';
  }>;
  businessJustification?: string;
  technicalJustification?: string;
  estimatedImpact?: {
    users: number;
    services: string[];
    downtime?: number;
  };
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

interface PluginApprovalWorkflowProps {
  requestId?: string;
  pluginId?: string;
  onApprove?: (requestId: string) => void;
  onReject?: (requestId: string) => void;
  viewMode?: 'compact' | 'full';
}

const APPROVAL_STAGES = [
  { id: 1, name: 'Security Review', type: 'SECURITY', icon: Shield },
  { id: 2, name: 'Compliance Check', type: 'COMPLIANCE', icon: FileCheck },
  { id: 3, name: 'Technical Review', type: 'TECHNICAL', icon: Terminal },
  { id: 4, name: 'Business Approval', type: 'BUSINESS', icon: Users },
  { id: 5, name: 'Final Approval', type: 'FINAL', icon: CheckCircle }
];

export function PluginApprovalWorkflow({
  requestId,
  pluginId,
  onApprove,
  onReject,
  viewMode = 'full'
}: PluginApprovalWorkflowProps) {
  const [selectedRequest, setSelectedRequest] = useState<string | null>(requestId || null);
  const [commentText, setCommentText] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const queryClient = useQueryClient();

  // Fetch approval requests
  const { data: requests, isLoading: requestsLoading } = useQuery({
    queryKey: ['approval-requests', pluginId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (pluginId) params.append('pluginId', pluginId);
      
      const response = await fetch(`/api/plugins/approval/requests?${params}`);
      if (!response.ok) throw new Error('Failed to fetch approval requests');
      return response.json();
    }
  });

  // Fetch single request details
  const { data: requestDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ['approval-request', selectedRequest],
    queryFn: async () => {
      if (!selectedRequest) return null;
      const response = await fetch(`/api/plugins/approval/requests/${selectedRequest}`);
      if (!response.ok) throw new Error('Failed to fetch request details');
      return response.json();
    },
    enabled: !!selectedRequest
  });

  // Approve request mutation
  const approveMutation = useMutation({
    mutationFn: async ({ requestId, comments }: { requestId: string; comments?: string }) => {
      const response = await fetch(`/api/plugins/approval/requests/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments })
      });
      if (!response.ok) throw new Error('Failed to approve request');
      return response.json();
    },
    onSuccess: (data, variables) => {
      toast.success('Request approved successfully');
      queryClient.invalidateQueries({ queryKey: ['approval-requests'] });
      queryClient.invalidateQueries({ queryKey: ['approval-request', variables.requestId] });
      if (onApprove) onApprove(variables.requestId);
    },
    onError: () => {
      toast.error('Failed to approve request');
    }
  });

  // Reject request mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      const response = await fetch(`/api/plugins/approval/requests/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      if (!response.ok) throw new Error('Failed to reject request');
      return response.json();
    },
    onSuccess: (data, variables) => {
      toast.success('Request rejected');
      queryClient.invalidateQueries({ queryKey: ['approval-requests'] });
      queryClient.invalidateQueries({ queryKey: ['approval-request', variables.requestId] });
      setShowRejectDialog(false);
      setRejectReason('');
      if (onReject) onReject(variables.requestId);
    },
    onError: () => {
      toast.error('Failed to reject request');
    }
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async ({ requestId, message }: { requestId: string; message: string }) => {
      const response = await fetch(`/api/plugins/approval/requests/${requestId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, type: 'COMMENT' })
      });
      if (!response.ok) throw new Error('Failed to add comment');
      return response.json();
    },
    onSuccess: (data, variables) => {
      toast.success('Comment added');
      queryClient.invalidateQueries({ queryKey: ['approval-request', variables.requestId] });
      setCommentText('');
    },
    onError: () => {
      toast.error('Failed to add comment');
    }
  });

  // Run security scan
  const runSecurityScanMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const response = await fetch(`/api/plugins/approval/requests/${requestId}/security-scan`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to run security scan');
      return response.json();
    },
    onSuccess: (data, requestId) => {
      toast.success('Security scan initiated');
      queryClient.invalidateQueries({ queryKey: ['approval-request', requestId] });
    },
    onError: () => {
      toast.error('Failed to run security scan');
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
      case 'PASSED':
      case 'COMPLIANT':
        return 'text-green-600';
      case 'REJECTED':
      case 'FAILED':
      case 'NON_COMPLIANT':
        return 'text-red-600';
      case 'IN_REVIEW':
      case 'SCANNING':
      case 'CHECKING':
      case 'RUNNING':
        return 'text-blue-600';
      case 'WARNING':
      case 'PARTIAL':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      CRITICAL: 'bg-red-100 text-red-800',
      HIGH: 'bg-orange-100 text-orange-800',
      MEDIUM: 'bg-yellow-100 text-yellow-800',
      LOW: 'bg-green-100 text-green-800'
    };
    return colors[priority as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const renderApprovalStages = (request: ApprovalRequest) => {
    return (
      <div className="flex items-center justify-between">
        {APPROVAL_STAGES.map((stage, index) => {
          const Icon = stage.icon;
          const isActive = request.stage.current === stage.id;
          const isComplete = request.stage.current > stage.id;
          const isFailed = request.status === 'REJECTED' && request.stage.current === stage.id;

          return (
            <React.Fragment key={stage.id}>
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                    isComplete && "bg-green-100 text-green-600",
                    isActive && !isFailed && "bg-blue-100 text-blue-600",
                    isFailed && "bg-red-100 text-red-600",
                    !isComplete && !isActive && !isFailed && "bg-gray-100 text-gray-400"
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className={cn(
                  "text-xs mt-1",
                  (isActive || isComplete) ? "font-medium" : "text-gray-500"
                )}>
                  {stage.name}
                </span>
              </div>
              {index < APPROVAL_STAGES.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-2",
                    isComplete ? "bg-green-500" : "bg-gray-200"
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  if (viewMode === 'compact') {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg">Approval Status</CardTitle>
        </CardHeader>
        <CardContent>
          {requestDetails && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge className={getPriorityBadge(requestDetails.priority)}>
                  {requestDetails.priority} Priority
                </Badge>
                <Badge className={getStatusColor(requestDetails.status)}>
                  {requestDetails.status}
                </Badge>
              </div>
              <Progress
                value={(requestDetails.stage.current / requestDetails.stage.total) * 100}
                className="h-2"
              />
              <div className="flex justify-between text-sm">
                <span>Stage {requestDetails.stage.current} of {requestDetails.stage.total}</span>
                <span>{requestDetails.stage.name}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Request List */}
      {!selectedRequest && (
        <Card>
          <CardHeader>
            <CardTitle>Plugin Approval Requests</CardTitle>
            <CardDescription>Review and approve plugin installation requests</CardDescription>
          </CardHeader>
          <CardContent>
            {requestsLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : requests?.length > 0 ? (
              <div className="space-y-4">
                {requests.map((request: ApprovalRequest) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedRequest(request.id)}
                  >
                    <div className="flex items-center space-x-4">
                      <Package className="w-8 h-8 text-gray-400" />
                      <div>
                        <div className="font-medium">{request.pluginName}</div>
                        <div className="text-sm text-gray-500">
                          v{request.pluginVersion} • Requested by {request.requestedBy.name}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {format(new Date(request.createdAt), 'MMM d, yyyy h:mm a')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <Badge className={getPriorityBadge(request.priority)}>
                        {request.priority}
                      </Badge>
                      <Badge className={getStatusColor(request.status)}>
                        {request.status}
                      </Badge>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No approval requests found
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Request Details */}
      {selectedRequest && requestDetails && (
        <>
          {/* Header */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedRequest(null)}
                  >
                    ← Back
                  </Button>
                  <div>
                    <CardTitle>{requestDetails.pluginName}</CardTitle>
                    <CardDescription>
                      Version {requestDetails.pluginVersion} • {requestDetails.requestType}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className={getPriorityBadge(requestDetails.priority)}>
                    {requestDetails.priority} Priority
                  </Badge>
                  <Badge className={getStatusColor(requestDetails.status)}>
                    {requestDetails.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {renderApprovalStages(requestDetails)}
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="compliance">Compliance</TabsTrigger>
              <TabsTrigger value="testing">Testing</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Request Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Requested By</span>
                      <span className="text-sm font-medium">{requestDetails.requestedBy.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Team</span>
                      <span className="text-sm font-medium">{requestDetails.requestedBy.team}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Request Date</span>
                      <span className="text-sm font-medium">
                        {format(new Date(requestDetails.createdAt), 'MMM d, yyyy')}
                      </span>
                    </div>
                    {requestDetails.expiresAt && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Expires</span>
                        <span className="text-sm font-medium">
                          {format(new Date(requestDetails.expiresAt), 'MMM d, yyyy')}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Plugin Metadata</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Author</span>
                      <span className="text-sm font-medium">
                        {requestDetails.metadata.author || 'Unknown'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">License</span>
                      <Badge variant={requestDetails.license.isApproved ? 'default' : 'destructive'}>
                        {requestDetails.license.type}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Downloads</span>
                      <span className="text-sm font-medium">
                        {requestDetails.metadata.downloads?.toLocaleString() || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Stars</span>
                      <span className="text-sm font-medium">
                        {requestDetails.metadata.stars?.toLocaleString() || 0}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Justifications */}
              {(requestDetails.businessJustification || requestDetails.technicalJustification) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Justifications</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {requestDetails.businessJustification && (
                      <div>
                        <Label className="text-sm font-medium">Business Justification</Label>
                        <p className="text-sm text-gray-600 mt-1">
                          {requestDetails.businessJustification}
                        </p>
                      </div>
                    )}
                    {requestDetails.technicalJustification && (
                      <div>
                        <Label className="text-sm font-medium">Technical Justification</Label>
                        <p className="text-sm text-gray-600 mt-1">
                          {requestDetails.technicalJustification}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Dependencies */}
              {requestDetails.dependencies.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Dependencies</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {requestDetails.dependencies.map((dep, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Package className="w-4 h-4 text-gray-400" />
                            <span className="text-sm">
                              {dep.name}@{dep.version}
                            </span>
                          </div>
                          {dep.approved ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-yellow-500" />
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Security Scan Results</CardTitle>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => runSecurityScanMutation.mutate(selectedRequest)}
                      disabled={runSecurityScanMutation.isPending}
                    >
                      <RefreshCw className={cn(
                        "w-4 h-4 mr-2",
                        runSecurityScanMutation.isPending && "animate-spin"
                      )} />
                      Rescan
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Shield className={cn(
                          "w-5 h-5",
                          getStatusColor(requestDetails.securityScan.status)
                        )} />
                        <span className="font-medium">Security Score</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Progress value={requestDetails.securityScan.score} className="w-24 h-2" />
                        <span className="text-sm font-medium">{requestDetails.securityScan.score}%</span>
                      </div>
                    </div>

                    {requestDetails.securityScan.vulnerabilities.length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Vulnerabilities Found</Label>
                          {requestDetails.securityScan.vulnerabilities.map((vuln, index) => (
                            <Alert key={index} variant={vuln.severity === 'CRITICAL' ? 'destructive' : 'default'}>
                              <AlertTriangle className="h-4 w-4" />
                              <AlertTitle className="text-sm">
                                {vuln.title} ({vuln.severity})
                              </AlertTitle>
                              <AlertDescription className="text-xs mt-1">
                                {vuln.description}
                                {vuln.cve && (
                                  <div className="mt-1">
                                    <Badge variant="outline" className="text-xs">
                                      {vuln.cve}
                                    </Badge>
                                  </div>
                                )}
                              </AlertDescription>
                            </Alert>
                          ))}
                        </div>
                      </>
                    )}

                    {requestDetails.securityScan.scannedAt && (
                      <div className="text-xs text-gray-500">
                        Last scanned: {format(new Date(requestDetails.securityScan.scannedAt), 'MMM d, yyyy h:mm a')}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Compliance Tab */}
            <TabsContent value="compliance" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Compliance Check Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <FileCheck className={cn(
                          "w-5 h-5",
                          getStatusColor(requestDetails.complianceCheck.status)
                        )} />
                        <span className="font-medium">Compliance Status</span>
                      </div>
                      <Badge className={getStatusColor(requestDetails.complianceCheck.status)}>
                        {requestDetails.complianceCheck.status}
                      </Badge>
                    </div>

                    {requestDetails.complianceCheck.policies.length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Policy Checks</Label>
                          {requestDetails.complianceCheck.policies.map((policy, index) => (
                            <div key={index} className="flex items-center justify-between p-2 border rounded">
                              <span className="text-sm">{policy.name}</span>
                              <div className="flex items-center space-x-2">
                                {policy.status === 'PASS' && <Check className="w-4 h-4 text-green-500" />}
                                {policy.status === 'FAIL' && <X className="w-4 h-4 text-red-500" />}
                                {policy.status === 'WARNING' && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                                <span className={cn(
                                  "text-xs",
                                  policy.status === 'PASS' && "text-green-600",
                                  policy.status === 'FAIL' && "text-red-600",
                                  policy.status === 'WARNING' && "text-yellow-600"
                                )}>
                                  {policy.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {requestDetails.complianceCheck.violations.length > 0 && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Compliance Violations</AlertTitle>
                        <AlertDescription>
                          <ul className="list-disc list-inside text-xs mt-2">
                            {requestDetails.complianceCheck.violations.map((violation, index) => (
                              <li key={index}>{violation}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Testing Tab */}
            <TabsContent value="testing" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Test Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {requestDetails.testResults.passed}
                        </div>
                        <div className="text-xs text-gray-500">Passed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">
                          {requestDetails.testResults.failed}
                        </div>
                        <div className="text-xs text-gray-500">Failed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-400">
                          {requestDetails.testResults.skipped}
                        </div>
                        <div className="text-xs text-gray-500">Skipped</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {requestDetails.testResults.coverage}%
                        </div>
                        <div className="text-xs text-gray-500">Coverage</div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Test Status</span>
                        <Badge className={getStatusColor(requestDetails.testResults.status)}>
                          {requestDetails.testResults.status}
                        </Badge>
                      </div>
                      {requestDetails.testResults.duration && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500">Duration</span>
                          <span className="text-sm font-medium">
                            {(requestDetails.testResults.duration / 1000).toFixed(2)}s
                          </span>
                        </div>
                      )}
                      {requestDetails.testResults.testedAt && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500">Tested At</span>
                          <span className="text-sm font-medium">
                            {format(new Date(requestDetails.testResults.testedAt), 'MMM d, yyyy h:mm a')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Approval History</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      {requestDetails.history.map((event, index) => (
                        <div key={index} className="flex space-x-3">
                          <div className="flex-shrink-0">
                            <div className="w-2 h-2 bg-gray-400 rounded-full mt-2" />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium">{event.action}</div>
                            <div className="text-xs text-gray-500">
                              by {event.actor} • {format(new Date(event.timestamp), 'MMM d, yyyy h:mm a')}
                            </div>
                            {event.details && (
                              <div className="text-xs text-gray-600 mt-1">{event.details}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Comments Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Comments & Reviews</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-3">
                      {requestDetails.comments.map((comment) => (
                        <div key={comment.id} className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium">{comment.author}</span>
                              <Badge variant="outline" className="text-xs">
                                {comment.role}
                              </Badge>
                              {comment.type !== 'COMMENT' && (
                                <Badge
                                  variant={comment.type === 'APPROVAL' ? 'default' : 'destructive'}
                                  className="text-xs"
                                >
                                  {comment.type}
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-gray-500">
                              {format(new Date(comment.timestamp), 'MMM d, h:mm a')}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700">{comment.message}</p>
                        </div>
                      ))}
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label htmlFor="comment">Add Comment</Label>
                      <Textarea
                        id="comment"
                        placeholder="Enter your comment or review feedback..."
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        rows={3}
                      />
                      <Button
                        size="sm"
                        onClick={() => addCommentMutation.mutate({
                          requestId: selectedRequest,
                          message: commentText
                        })}
                        disabled={!commentText.trim() || addCommentMutation.isPending}
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Add Comment
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Action Buttons */}
          {requestDetails.status === 'PENDING' || requestDetails.status === 'IN_REVIEW' && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    Review all information before making a decision
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowRejectDialog(true)}
                      disabled={rejectMutation.isPending}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                    <Button
                      onClick={() => approveMutation.mutate({
                        requestId: selectedRequest,
                        comments: commentText
                      })}
                      disabled={approveMutation.isPending}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this plugin installation request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reject-reason">Rejection Reason</Label>
              <Textarea
                id="reject-reason"
                placeholder="Enter the reason for rejection..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false);
                setRejectReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate({
                requestId: selectedRequest!,
                reason: rejectReason
              })}
              disabled={!rejectReason.trim() || rejectMutation.isPending}
            >
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PluginApprovalWorkflow;