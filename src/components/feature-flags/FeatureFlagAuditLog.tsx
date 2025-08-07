/**
 * Feature Flag Audit Log Component
 * Display audit history and compliance tracking
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Search, 
  Filter, 
  Download, 
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  FileText,
  Shield,
  Activity,
  Eye
} from 'lucide-react';
import { AuditEntry, AuditAction } from '@/lib/feature-flags/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface FeatureFlagAuditLogProps {
  environment: string;
}

interface AuditLogFilters {
  flagKey?: string;
  userId?: string;
  action?: AuditAction;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export function FeatureFlagAuditLog({ environment }: FeatureFlagAuditLogProps) {
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Mock audit data - in reality this would come from the API
  useEffect(() => {
    const mockAuditEntries: AuditEntry[] = [
      {
        id: 'audit_1',
        action: 'CREATED',
        flagKey: 'new-checkout-flow',
        userId: 'user_123',
        userName: 'John Doe',
        timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
        reason: 'Initial flag creation for new checkout experiment',
        changes: [
          { field: 'enabled', oldValue: undefined, newValue: false },
          { field: 'rollout.percentage', oldValue: undefined, newValue: 0 }
        ]
      },
      {
        id: 'audit_2',
        action: 'UPDATED',
        flagKey: 'new-checkout-flow',
        userId: 'user_123',
        userName: 'John Doe',
        timestamp: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
        reason: 'Enable flag for testing',
        changes: [
          { field: 'enabled', oldValue: false, newValue: true },
          { field: 'rollout.percentage', oldValue: 0, newValue: 5 }
        ]
      },
      {
        id: 'audit_3',
        action: 'ROLLOUT_STARTED',
        flagKey: 'new-checkout-flow',
        userId: 'user_456',
        userName: 'Jane Smith',
        timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
        reason: 'Starting gradual rollout to 10%',
        changes: [
          { field: 'rollout.percentage', oldValue: 5, newValue: 10 }
        ]
      },
      {
        id: 'audit_4',
        action: 'KILL_SWITCH_ACTIVATED',
        flagKey: 'payment-processor-v2',
        userId: 'user_789',
        userName: 'Emergency User',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
        reason: 'High error rate detected - emergency shutdown',
        changes: [
          { field: 'enabled', oldValue: true, newValue: false }
        ]
      },
      {
        id: 'audit_5',
        action: 'ARCHIVED',
        flagKey: 'old-feature-experiment',
        userId: 'user_123',
        userName: 'John Doe',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
        reason: 'Experiment completed - cleaning up deprecated flag',
        changes: [
          { field: 'archived', oldValue: false, newValue: true }
        ]
      }
    ];

    setAuditEntries(mockAuditEntries);
    setLoading(false);
  }, []);

  const getActionColor = (action: AuditAction) => {
    switch (action) {
      case 'CREATED': return 'bg-blue-100 text-blue-800';
      case 'UPDATED': return 'bg-green-100 text-green-800';
      case 'DELETED': return 'bg-red-100 text-red-800';
      case 'ARCHIVED': return 'bg-gray-100 text-gray-800';
      case 'ROLLOUT_STARTED': return 'bg-purple-100 text-purple-800';
      case 'ROLLOUT_STOPPED': return 'bg-orange-100 text-orange-800';
      case 'KILL_SWITCH_ACTIVATED': return 'bg-red-100 text-red-800';
      case 'KILL_SWITCH_DEACTIVATED': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getActionIcon = (action: AuditAction) => {
    switch (action) {
      case 'CREATED': return <CheckCircle className="h-4 w-4" />;
      case 'UPDATED': return <Activity className="h-4 w-4" />;
      case 'DELETED': return <AlertTriangle className="h-4 w-4" />;
      case 'ARCHIVED': return <FileText className="h-4 w-4" />;
      case 'ROLLOUT_STARTED': return <Activity className="h-4 w-4" />;
      case 'ROLLOUT_STOPPED': return <AlertTriangle className="h-4 w-4" />;
      case 'KILL_SWITCH_ACTIVATED': return <Shield className="h-4 w-4" />;
      case 'KILL_SWITCH_DEACTIVATED': return <CheckCircle className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(timestamp);
  };

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const handleExport = () => {
    // Mock export functionality
    console.log('Exporting audit log...');
  };

  const viewEntryDetails = (entry: AuditEntry) => {
    setSelectedEntry(entry);
    setShowDetails(true);
  };

  const filterEntries = (entries: AuditEntry[]) => {
    return entries.filter(entry => {
      if (filters.flagKey && !entry.flagKey.toLowerCase().includes(filters.flagKey.toLowerCase())) {
        return false;
      }
      if (filters.userId && entry.userId !== filters.userId) {
        return false;
      }
      if (filters.action && entry.action !== filters.action) {
        return false;
      }
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        return (
          entry.flagKey.toLowerCase().includes(searchTerm) ||
          entry.userName?.toLowerCase().includes(searchTerm) ||
          entry.reason?.toLowerCase().includes(searchTerm)
        );
      }
      return true;
    });
  };

  const filteredEntries = filterEntries(auditEntries);

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Audit Log
            </div>
            <Button onClick={handleExport} variant="outline" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-4 md:flex-row md:items-center md:space-y-0 md:space-x-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search audit log..."
                value={filters.search || ''}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-9"
              />
            </div>

            {/* Flag Filter */}
            <Input
              placeholder="Filter by flag key"
              value={filters.flagKey || ''}
              onChange={(e) => setFilters({ ...filters, flagKey: e.target.value })}
              className="md:w-48"
            />

            {/* Action Filter */}
            <Select 
              value={filters.action || 'all'} 
              onValueChange={(value) => setFilters({ ...filters, action: value === 'all' ? undefined : value as AuditAction })}
            >
              <SelectTrigger className="md:w-40">
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="CREATED">Created</SelectItem>
                <SelectItem value="UPDATED">Updated</SelectItem>
                <SelectItem value="DELETED">Deleted</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
                <SelectItem value="ROLLOUT_STARTED">Rollout Started</SelectItem>
                <SelectItem value="KILL_SWITCH_ACTIVATED">Kill Switch</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Audit Entries */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Flag</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Changes</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                  </TableRow>
                ))
              ) : filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">No audit entries found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    {/* Action */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge className={getActionColor(entry.action)}>
                          <div className="flex items-center gap-1">
                            {getActionIcon(entry.action)}
                            {entry.action.replace('_', ' ')}
                          </div>
                        </Badge>
                      </div>
                    </TableCell>

                    {/* Flag */}
                    <TableCell>
                      <div className="space-y-1">
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                          {entry.flagKey}
                        </code>
                      </div>
                    </TableCell>

                    {/* User */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{entry.userName || 'Unknown'}</div>
                          <div className="text-sm text-muted-foreground">{entry.userId}</div>
                        </div>
                      </div>
                    </TableCell>

                    {/* Timestamp */}
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{formatTimeAgo(entry.timestamp)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatTimestamp(entry.timestamp)}
                        </div>
                      </div>
                    </TableCell>

                    {/* Changes */}
                    <TableCell>
                      <div className="space-y-1">
                        {entry.changes && entry.changes.length > 0 ? (
                          <div>
                            <div className="text-sm">
                              {entry.changes.length} change{entry.changes.length !== 1 ? 's' : ''}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {entry.changes[0].field}
                              {entry.changes.length > 1 && `, +${entry.changes.length - 1} more`}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">No changes recorded</span>
                        )}
                      </div>
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => viewEntryDetails(entry)}
                        className="h-8 w-8 p-0"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Audit Entry Details Modal */}
      {selectedEntry && (
        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Audit Entry Details</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Action</label>
                  <div className="mt-1">
                    <Badge className={getActionColor(selectedEntry.action)}>
                      <div className="flex items-center gap-1">
                        {getActionIcon(selectedEntry.action)}
                        {selectedEntry.action.replace('_', ' ')}
                      </div>
                    </Badge>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Flag Key</label>
                  <div className="mt-1">
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                      {selectedEntry.flagKey}
                    </code>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">User</label>
                  <div className="mt-1 flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{selectedEntry.userName || 'Unknown'}</div>
                      <div className="text-sm text-muted-foreground">{selectedEntry.userId}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Timestamp</label>
                  <div className="mt-1">
                    <div className="font-medium">{formatTimestamp(selectedEntry.timestamp)}</div>
                    <div className="text-sm text-muted-foreground">{formatTimeAgo(selectedEntry.timestamp)}</div>
                  </div>
                </div>
              </div>

              {/* Reason */}
              {selectedEntry.reason && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Reason</label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm">{selectedEntry.reason}</p>
                  </div>
                </div>
              )}

              {/* Changes */}
              {selectedEntry.changes && selectedEntry.changes.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Changes</label>
                  <div className="mt-1 space-y-2">
                    {selectedEntry.changes.map((change, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg">
                        <div className="font-medium text-sm">{change.field}</div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="line-through">
                            {change.oldValue !== undefined ? JSON.stringify(change.oldValue) : 'undefined'}
                          </span>
                          <span>→</span>
                          <span className="font-medium text-green-700">
                            {change.newValue !== undefined ? JSON.stringify(change.newValue) : 'undefined'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata */}
              {selectedEntry.metadata && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Metadata</label>
                  <div className="mt-1">
                    <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-auto">
                      {JSON.stringify(selectedEntry.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}