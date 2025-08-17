/**
 * Feature Flag List Component
 * Display and manage list of feature flags
 */

'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Copy, 
  ExternalLink,
  Archive,
  RotateCcw,
  AlertTriangle,
  TrendingUp,
  Users
} from 'lucide-react';
import { FeatureFlag, FlagType } from '@/lib/feature-flags/types';
import { Skeleton } from '@/components/ui/Skeleton';

interface FeatureFlagListProps {
  flags: FeatureFlag[];
  loading: boolean;
  onToggleFlag: (flagKey: string, enabled: boolean) => void;
  onEditFlag: (flag: FeatureFlag) => void;
  onDeleteFlag: (flagKey: string) => void;
  onDuplicateFlag?: (flag: FeatureFlag) => void;
  onViewMetrics?: (flagKey: string) => void;
  onViewAudit?: (flagKey: string) => void;
}

export function FeatureFlagList({
  flags,
  loading,
  onToggleFlag,
  onEditFlag,
  onDeleteFlag,
  onDuplicateFlag,
  onViewMetrics,
  onViewAudit
}: FeatureFlagListProps) {
  
  const getFlagTypeColor = (type: FlagType) => {
    switch (type) {
      case 'boolean': return 'bg-blue-100 text-blue-800';
      case 'string': return 'bg-green-100 text-green-800';
      case 'number': return 'bg-purple-100 text-purple-800';
      case 'json': return 'bg-orange-100 text-orange-800';
      case 'kill_switch': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getFlagStatusColor = (flag: FeatureFlag) => {
    if (flag.archived) return 'bg-gray-100 text-gray-600';
    if (flag.enabled) return 'bg-green-100 text-green-700';
    return 'bg-gray-100 text-gray-600';
  };

  const getFlagStatus = (flag: FeatureFlag) => {
    if (flag.archived) return 'Archived';
    if (flag.enabled) return 'Enabled';
    return 'Disabled';
  };

  const isExpiringSoon = (flag: FeatureFlag) => {
    if (!flag.expiresAt) return false;
    const now = new Date();
    const expiresAt = new Date(flag.expiresAt);
    const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  const copyFlagKey = async (flagKey: string) => {
    try {
      await navigator.clipboard.writeText(flagKey);
      // TODO: Show success toast
    } catch (error) {
      console.error('Failed to copy flag key:', error);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-12 w-12 rounded" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-[250px]" />
                  <Skeleton className="h-4 w-[200px]" />
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (flags.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold">No flags found</h3>
            <p className="text-muted-foreground">
              Create your first feature flag to get started
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Flag</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Rollout</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {flags.map((flag) => (
              <TableRow key={flag.key}>
                {/* Flag Details */}
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{flag.name}</span>
                      {isExpiringSoon(flag) && (
                        <AlertTriangle className="h-4 w-4 text-yellow-600" title="Expires soon" />
                      )}
                      {flag.type === 'kill_switch' && (
                        <AlertTriangle className="h-4 w-4 text-red-600" title="Kill switch" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">
                        {flag.key}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0"
                        onClick={() => copyFlagKey(flag.key)}
                        title="Copy flag key"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    {flag.description && (
                      <p className="text-sm text-muted-foreground">
                        {flag.description}
                      </p>
                    )}
                    {flag.tags.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {flag.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </TableCell>

                {/* Flag Type */}
                <TableCell>
                  <Badge className={getFlagTypeColor(flag.type)}>
                    {flag.type}
                  </Badge>
                </TableCell>

                {/* Status */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge className={getFlagStatusColor(flag)}>
                      {getFlagStatus(flag)}
                    </Badge>
                    {!flag.archived && (
                      <Switch
                        checked={flag.enabled}
                        onCheckedChange={(enabled) => onToggleFlag(flag.key, enabled)}
                        size="sm"
                      />
                    )}
                  </div>
                </TableCell>

                {/* Rollout */}
                <TableCell>
                  {flag.rollout.enabled ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-blue-600" />
                        <span className="text-sm font-medium">
                          {flag.rollout.percentage}%
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {flag.rollout.strategy}
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">No rollout</span>
                  )}
                </TableCell>

                {/* Created */}
                <TableCell>
                  <div className="text-sm">
                    <div>{formatDate(flag.createdAt)}</div>
                    <div className="text-muted-foreground">by {flag.createdBy}</div>
                  </div>
                </TableCell>

                {/* Updated */}
                <TableCell>
                  <div className="text-sm">
                    <div>{formatDate(flag.updatedAt)}</div>
                    <div className="text-muted-foreground">by {flag.updatedBy}</div>
                  </div>
                </TableCell>

                {/* Actions */}
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEditFlag(flag)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      
                      {onDuplicateFlag && (
                        <DropdownMenuItem onClick={() => onDuplicateFlag(flag)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicate
                        </DropdownMenuItem>
                      )}
                      
                      {onViewMetrics && (
                        <DropdownMenuItem onClick={() => onViewMetrics(flag.key)}>
                          <TrendingUp className="mr-2 h-4 w-4" />
                          View Metrics
                        </DropdownMenuItem>
                      )}
                      
                      {onViewAudit && (
                        <DropdownMenuItem onClick={() => onViewAudit(flag.key)}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Audit Log
                        </DropdownMenuItem>
                      )}
                      
                      <DropdownMenuItem
                        onClick={() => onDeleteFlag(flag.key)}
                        className="text-red-600"
                      >
                        {flag.archived ? (
                          <>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Permanently
                          </>
                        ) : (
                          <>
                            <Archive className="mr-2 h-4 w-4" />
                            Archive
                          </>
                        )}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}