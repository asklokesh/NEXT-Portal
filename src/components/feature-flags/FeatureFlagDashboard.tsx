/**
 * Feature Flag Management Dashboard
 * Comprehensive interface for managing feature flags
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Search, 
  Plus, 
  Settings, 
  TrendingUp, 
  AlertTriangle,
  Filter,
  MoreHorizontal,
  Flag,
  Users,
  Activity,
  Shield
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FeatureFlag, FlagType } from '@/lib/feature-flags/types';
import { FeatureFlagList } from './FeatureFlagList';
import { FeatureFlagEditor } from './FeatureFlagEditor';
import { FeatureFlagMetrics } from './FeatureFlagMetrics';
import { FeatureFlagAuditLog } from './FeatureFlagAuditLog';

interface FeatureFlagDashboardProps {
  className?: string;
}

export function FeatureFlagDashboard({ className }: FeatureFlagDashboardProps) {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEnvironment, setSelectedEnvironment] = useState('production');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [activeTab, setActiveTab] = useState('flags');

  const environments = ['development', 'staging', 'production'];
  const flagTypes: FlagType[] = ['boolean', 'string', 'number', 'json', 'kill_switch'];

  // Load flags
  const loadFlags = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        environment: selectedEnvironment,
        archived: showArchived.toString(),
        ...(searchQuery && { search: searchQuery })
      });

      const response = await fetch(`/api/feature-flags?${params}`);
      if (!response.ok) {
        throw new Error('Failed to load flags');
      }

      const result = await response.json();
      if (result.success) {
        setFlags(result.data);
      }
    } catch (error) {
      console.error('Error loading flags:', error);
      // TODO: Show error toast
    } finally {
      setLoading(false);
    }
  }, [selectedEnvironment, showArchived, searchQuery]);

  // Load flags on component mount and when filters change
  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  // Handle flag toggle
  const handleToggleFlag = async (flagKey: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/feature-flags/${flagKey}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) {
        throw new Error('Failed to update flag');
      }

      // Update local state
      setFlags(prev =>
        prev.map(flag =>
          flag.key === flagKey ? { ...flag, enabled } : flag
        )
      );
    } catch (error) {
      console.error('Error toggling flag:', error);
      // TODO: Show error toast
    }
  };

  // Handle flag creation
  const handleCreateFlag = () => {
    setSelectedFlag(null);
    setShowEditor(true);
  };

  // Handle flag edit
  const handleEditFlag = (flag: FeatureFlag) => {
    setSelectedFlag(flag);
    setShowEditor(true);
  };

  // Handle flag save
  const handleSaveFlag = async (flag: Partial<FeatureFlag>) => {
    try {
      const isEdit = selectedFlag !== null;
      const url = isEdit 
        ? `/api/feature-flags/${selectedFlag!.key}` 
        : '/api/feature-flags';
      
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(flag),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${isEdit ? 'update' : 'create'} flag`);
      }

      const result = await response.json();
      if (result.success) {
        setShowEditor(false);
        setSelectedFlag(null);
        await loadFlags();
      }
    } catch (error) {
      console.error('Error saving flag:', error);
      // TODO: Show error toast
    }
  };

  // Handle flag deletion
  const handleDeleteFlag = async (flagKey: string) => {
    if (!confirm('Are you sure you want to archive this flag?')) {
      return;
    }

    try {
      const response = await fetch(`/api/feature-flags/${flagKey}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete flag');
      }

      await loadFlags();
    } catch (error) {
      console.error('Error deleting flag:', error);
      // TODO: Show error toast
    }
  };

  // Get flag statistics
  const getStats = () => {
    const total = flags.length;
    const enabled = flags.filter(f => f.enabled).length;
    const killSwitches = flags.filter(f => f.type === 'kill_switch').length;
    const expiringSoon = flags.filter(f => 
      f.expiresAt && 
      new Date(f.expiresAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000
    ).length;

    return { total, enabled, killSwitches, expiringSoon };
  };

  const stats = getStats();

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Feature Flags</h1>
          <p className="text-muted-foreground">
            Manage feature flags, rollouts, and experiments
          </p>
        </div>
        <Button onClick={handleCreateFlag} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Flag
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Flags</CardTitle>
            <Flag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {selectedEnvironment} environment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enabled</CardTitle>
            <Activity className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.enabled}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.enabled / stats.total) * 100) : 0}% active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kill Switches</CardTitle>
            <Shield className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.killSwitches}</div>
            <p className="text-xs text-muted-foreground">
              Emergency controls
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.expiringSoon}</div>
            <p className="text-xs text-muted-foreground">
              Within 7 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col space-y-4 md:flex-row md:items-center md:space-y-0 md:space-x-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search flags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Environment Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  {selectedEnvironment}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {environments.map((env) => (
                  <DropdownMenuItem
                    key={env}
                    onClick={() => setSelectedEnvironment(env)}
                  >
                    {env}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Show Archived */}
            <div className="flex items-center space-x-2">
              <Switch
                id="show-archived"
                checked={showArchived}
                onCheckedChange={setShowArchived}
              />
              <label htmlFor="show-archived" className="text-sm">
                Show Archived
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="flags">Flags</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="flags" className="space-y-4">
          <FeatureFlagList
            flags={flags}
            loading={loading}
            onToggleFlag={handleToggleFlag}
            onEditFlag={handleEditFlag}
            onDeleteFlag={handleDeleteFlag}
          />
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <FeatureFlagMetrics
            flags={flags}
            environment={selectedEnvironment}
          />
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <FeatureFlagAuditLog
            environment={selectedEnvironment}
          />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dashboard Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Settings and configuration options will be available here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Flag Editor Modal */}
      {showEditor && (
        <FeatureFlagEditor
          flag={selectedFlag}
          environment={selectedEnvironment}
          onSave={handleSaveFlag}
          onCancel={() => {
            setShowEditor(false);
            setSelectedFlag(null);
          }}
        />
      )}
    </div>
  );
}