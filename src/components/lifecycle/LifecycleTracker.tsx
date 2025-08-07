'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Settings, 
  Bell, 
  Calendar, 
  BarChart3,
  Filter,
  Download,
  Play,
  Pause,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  ArrowRight,
  Activity,
  Users,
  Shield,
  Zap
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  LifecycleStage, 
  LifecycleEntity, 
  TransitionHistory, 
  LifecycleRule,
  RuleExecutionLog,
  DeprecationSchedule,
  ApprovalStatus,
  RulePriority,
  RuleStatus
} from '@/lib/lifecycle/LifecycleManager';

interface LifecycleTrackerProps {
  entities?: LifecycleEntity[];
  rules?: LifecycleRule[];
  transitions?: TransitionHistory[];
  schedules?: DeprecationSchedule[];
  executionLogs?: RuleExecutionLog[];
  onEntitySelect?: (entity: LifecycleEntity) => void;
  onRuleToggle?: (ruleId: string, enabled: boolean) => void;
  onBulkAction?: (action: string, entityIds: string[]) => void;
  onExportData?: (type: string) => void;
}

const stageColors: Record<LifecycleStage, string> = {
  [LifecycleStage.EXPERIMENTAL]: 'bg-yellow-500/10 text-yellow-700 border-yellow-200',
  [LifecycleStage.BETA]: 'bg-blue-500/10 text-blue-700 border-blue-200',
  [LifecycleStage.PRODUCTION]: 'bg-green-500/10 text-green-700 border-green-200',
  [LifecycleStage.MATURE]: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
  [LifecycleStage.DEPRECATED]: 'bg-orange-500/10 text-orange-700 border-orange-200',
  [LifecycleStage.RETIRED]: 'bg-gray-500/10 text-gray-700 border-gray-200'
};

const stageIcons: Record<LifecycleStage, React.ReactNode> = {
  [LifecycleStage.EXPERIMENTAL]: <Zap className="h-4 w-4" />,
  [LifecycleStage.BETA]: <Activity className="h-4 w-4" />,
  [LifecycleStage.PRODUCTION]: <CheckCircle className="h-4 w-4" />,
  [LifecycleStage.MATURE]: <Shield className="h-4 w-4" />,
  [LifecycleStage.DEPRECATED]: <AlertTriangle className="h-4 w-4" />,
  [LifecycleStage.RETIRED]: <XCircle className="h-4 w-4" />
};

const priorityColors: Record<RulePriority, string> = {
  [RulePriority.LOW]: 'bg-gray-100 text-gray-800',
  [RulePriority.MEDIUM]: 'bg-blue-100 text-blue-800',
  [RulePriority.HIGH]: 'bg-orange-100 text-orange-800',
  [RulePriority.CRITICAL]: 'bg-red-100 text-red-800'
};

export default function LifecycleTracker({
  entities = [],
  rules = [],
  transitions = [],
  schedules = [],
  executionLogs = [],
  onEntitySelect,
  onRuleToggle,
  onBulkAction,
  onExportData
}: LifecycleTrackerProps) {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<LifecycleStage | 'all'>('all');
  const [selectedEntities, setSelectedEntities] = useState<Set<string>>(new Set());
  const [showRuleConfig, setShowRuleConfig] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [selectedRule, setSelectedRule] = useState<LifecycleRule | null>(null);

  // Filtered entities based on search and stage
  const filteredEntities = useMemo(() => {
    return entities.filter(entity => {
      const matchesSearch = entity.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           entity.kind.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStage = stageFilter === 'all' || entity.currentStage === stageFilter;
      return matchesSearch && matchesStage;
    });
  }, [entities, searchTerm, stageFilter]);

  // Statistics
  const stats = useMemo(() => {
    const stageDistribution = entities.reduce((acc, entity) => {
      acc[entity.currentStage] = (acc[entity.currentStage] || 0) + 1;
      return acc;
    }, {} as Record<LifecycleStage, number>);

    const activeRules = rules.filter(rule => rule.enabled && rule.status === RuleStatus.ACTIVE).length;
    const pendingTransitions = transitions.filter(t => t.approvalStatus === ApprovalStatus.PENDING).length;
    const upcomingDeprecations = schedules.filter(s => 
      new Date(s.scheduledDate) > new Date() && 
      new Date(s.scheduledDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    ).length;

    return {
      total: entities.length,
      stageDistribution,
      activeRules,
      pendingTransitions,
      upcomingDeprecations
    };
  }, [entities, rules, transitions, schedules]);

  const handleEntitySelection = (entityId: string, selected: boolean) => {
    const newSelection = new Set(selectedEntities);
    if (selected) {
      newSelection.add(entityId);
    } else {
      newSelection.delete(entityId);
    }
    setSelectedEntities(newSelection);
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedEntities(new Set(filteredEntities.map(e => e.id)));
    } else {
      setSelectedEntities(new Set());
    }
  };

  const handleBulkAction = (action: string) => {
    if (selectedEntities.size > 0) {
      onBulkAction?.(action, Array.from(selectedEntities));
      setSelectedEntities(new Set());
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lifecycle Management</h1>
          <p className="text-muted-foreground">
            Track and manage the lifecycle of your services across all stages
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onExportData?.('entities')}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export Data
          </Button>
          <Dialog open={showRuleConfig} onOpenChange={setShowRuleConfig}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Settings className="h-4 w-4" />
                Configure Rules
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <RuleConfigurationDialog 
                rules={rules} 
                onRuleToggle={onRuleToggle}
                onRuleSelect={setSelectedRule}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Services</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              Active services across all stages
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeRules}</div>
            <p className="text-xs text-muted-foreground">
              Automated lifecycle rules
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingTransitions}</div>
            <p className="text-xs text-muted-foreground">
              Transitions awaiting approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Deprecations</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.upcomingDeprecations}</div>
            <p className="text-xs text-muted-foreground">
              In the next 30 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Stage Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Lifecycle Stage Distribution</CardTitle>
          <CardDescription>Overview of services across different lifecycle stages</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            {Object.entries(stageColors).map(([stage, colorClass]) => (
              <div key={stage} className="text-center">
                <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-full border ${colorClass} mb-2`}>
                  {stageIcons[stage as LifecycleStage]}
                  <span className="text-sm font-medium capitalize">{stage}</span>
                </div>
                <div className="text-2xl font-bold">
                  {stats.stageDistribution[stage as LifecycleStage] || 0}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="entities">Services</TabsTrigger>
          <TabsTrigger value="transitions">Transitions</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <OverviewTab 
            entities={entities}
            transitions={transitions}
            rules={rules}
            executionLogs={executionLogs}
          />
        </TabsContent>

        <TabsContent value="entities" className="space-y-6">
          <EntitiesTab
            entities={filteredEntities}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            stageFilter={stageFilter}
            setStageFilter={setStageFilter}
            selectedEntities={selectedEntities}
            onEntitySelection={handleEntitySelection}
            onSelectAll={handleSelectAll}
            onBulkAction={handleBulkAction}
            onEntitySelect={onEntitySelect}
          />
        </TabsContent>

        <TabsContent value="transitions" className="space-y-6">
          <TransitionsTab transitions={transitions} entities={entities} />
        </TabsContent>

        <TabsContent value="rules" className="space-y-6">
          <RulesTab 
            rules={rules} 
            executionLogs={executionLogs}
            onRuleToggle={onRuleToggle}
          />
        </TabsContent>

        <TabsContent value="schedules" className="space-y-6">
          <SchedulesTab schedules={schedules} entities={entities} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Overview Tab Component
function OverviewTab({ 
  entities, 
  transitions, 
  rules,
  executionLogs 
}: {
  entities: LifecycleEntity[];
  transitions: TransitionHistory[];
  rules: LifecycleRule[];
  executionLogs: RuleExecutionLog[];
}) {
  const recentTransitions = transitions.slice(0, 5);
  const recentExecutions = executionLogs.slice(0, 5);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Recent Transitions</CardTitle>
          <CardDescription>Latest lifecycle stage changes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {recentTransitions.map((transition) => (
            <div key={transition.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Badge className={stageColors[transition.fromStage]}>
                    {transition.fromStage}
                  </Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Badge className={stageColors[transition.toStage]}>
                    {transition.toStage}
                  </Badge>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                {new Date(transition.timestamp).toLocaleDateString()}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rule Execution Activity</CardTitle>
          <CardDescription>Recent automated rule executions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {recentExecutions.map((execution) => (
            <div key={execution.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${execution.overallResult ? 'bg-green-500' : 'bg-gray-300'}`} />
                <div>
                  <div className="font-medium">
                    {rules.find(r => r.id === execution.ruleId)?.name || 'Unknown Rule'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {execution.executionTime}ms
                  </div>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                {new Date(execution.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// Entities Tab Component
function EntitiesTab({
  entities,
  searchTerm,
  setSearchTerm,
  stageFilter,
  setStageFilter,
  selectedEntities,
  onEntitySelection,
  onSelectAll,
  onBulkAction,
  onEntitySelect
}: {
  entities: LifecycleEntity[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  stageFilter: LifecycleStage | 'all';
  setStageFilter: (stage: LifecycleStage | 'all') => void;
  selectedEntities: Set<string>;
  onEntitySelection: (entityId: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onBulkAction: (action: string) => void;
  onEntitySelect?: (entity: LifecycleEntity) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search services..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <div className="flex gap-2">
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              {Object.values(LifecycleStage).map((stage) => (
                <SelectItem key={stage} value={stage} className="capitalize">
                  {stage}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Bulk Actions */}
      <AnimatePresence>
        {selectedEntities.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg"
          >
            <span className="text-sm font-medium">
              {selectedEntities.size} service{selectedEntities.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2 ml-auto">
              <Button size="sm" variant="outline" onClick={() => onBulkAction('deprecate')}>
                Deprecate
              </Button>
              <Button size="sm" variant="outline" onClick={() => onBulkAction('transition')}>
                Transition
              </Button>
              <Button size="sm" variant="outline" onClick={() => onBulkAction('export')}>
                Export
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Entity List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Services</CardTitle>
              <CardDescription>
                {entities.length} service{entities.length !== 1 ? 's' : ''} found
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedEntities.size === entities.length && entities.length > 0}
                onCheckedChange={onSelectAll}
              />
              <Label className="text-sm">Select All</Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {entities.map((entity) => (
              <div
                key={entity.id}
                className="flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Checkbox
                  checked={selectedEntities.has(entity.id)}
                  onCheckedChange={(checked) => 
                    onEntitySelection(entity.id, checked as boolean)
                  }
                />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium truncate">{entity.name}</h3>
                    <Badge variant="outline" className="text-xs">
                      {entity.kind}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{entity.namespace}</span>
                    <span>•</span>
                    <span>Updated {new Date(entity.updatedAt).toLocaleDateString()}</span>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {entity.owners.length} owner{entity.owners.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                <Badge className={stageColors[entity.currentStage]}>
                  <div className="flex items-center gap-1">
                    {stageIcons[entity.currentStage]}
                    <span className="capitalize">{entity.currentStage}</span>
                  </div>
                </Badge>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEntitySelect?.(entity)}>
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Transitions Tab Component
function TransitionsTab({ 
  transitions, 
  entities 
}: { 
  transitions: TransitionHistory[];
  entities: LifecycleEntity[];
}) {
  const getEntityName = (entityId: string) => {
    return entities.find(e => e.id === entityId)?.name || 'Unknown Service';
  };

  const getApprovalStatusColor = (status: ApprovalStatus) => {
    switch (status) {
      case ApprovalStatus.PENDING:
        return 'bg-yellow-100 text-yellow-800';
      case ApprovalStatus.APPROVED:
        return 'bg-green-100 text-green-800';
      case ApprovalStatus.REJECTED:
        return 'bg-red-100 text-red-800';
      case ApprovalStatus.AUTO_APPROVED:
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transition History</CardTitle>
        <CardDescription>
          Complete history of lifecycle stage transitions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {transitions.map((transition) => (
            <div key={transition.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h3 className="font-medium">{getEntityName(transition.entityId)}</h3>
                  <div className="flex items-center gap-2">
                    <Badge className={stageColors[transition.fromStage]}>
                      {transition.fromStage}
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <Badge className={stageColors[transition.toStage]}>
                      {transition.toStage}
                    </Badge>
                  </div>
                </div>
                <Badge className={getApprovalStatusColor(transition.approvalStatus)}>
                  {transition.approvalStatus.replace('_', ' ')}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div>
                  <span className="font-medium">Triggered by:</span> {transition.triggeredBy}
                </div>
                <div>
                  <span className="font-medium">Date:</span> {new Date(transition.timestamp).toLocaleString()}
                </div>
                <div className="col-span-2">
                  <span className="font-medium">Reason:</span> {transition.reason}
                </div>
                {transition.approvedBy && (
                  <div>
                    <span className="font-medium">Approved by:</span> {transition.approvedBy}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Rules Tab Component
function RulesTab({ 
  rules, 
  executionLogs,
  onRuleToggle 
}: { 
  rules: LifecycleRule[];
  executionLogs: RuleExecutionLog[];
  onRuleToggle?: (ruleId: string, enabled: boolean) => void;
}) {
  const getRuleStats = (ruleId: string) => {
    const ruleLogs = executionLogs.filter(log => log.ruleId === ruleId);
    const successCount = ruleLogs.filter(log => log.overallResult).length;
    const totalCount = ruleLogs.length;
    
    return {
      executions: totalCount,
      successRate: totalCount > 0 ? (successCount / totalCount) * 100 : 0,
      lastExecution: ruleLogs[0]?.timestamp
    };
  };

  return (
    <div className="space-y-4">
      {rules.map((rule) => {
        const stats = getRuleStats(rule.id);
        
        return (
          <Card key={rule.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={(enabled) => onRuleToggle?.(rule.id, enabled)}
                  />
                  <div>
                    <CardTitle className="text-lg">{rule.name}</CardTitle>
                    <CardDescription>{rule.description}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={priorityColors[rule.priority]}>
                    {rule.priority}
                  </Badge>
                  <Badge variant={rule.status === RuleStatus.ACTIVE ? 'default' : 'secondary'}>
                    {rule.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{stats.executions}</div>
                  <div className="text-sm text-muted-foreground">Executions</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{stats.successRate.toFixed(1)}%</div>
                  <div className="text-sm text-muted-foreground">Success Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{rule.conditions.length}</div>
                  <div className="text-sm text-muted-foreground">Conditions</div>
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground">
                <div className="mb-2">
                  <span className="font-medium">Applicable Stages:</span>{' '}
                  {rule.applicableStages.map(stage => (
                    <Badge key={stage} variant="outline" className="ml-1">
                      {stage}
                    </Badge>
                  ))}
                </div>
                {stats.lastExecution && (
                  <div>
                    <span className="font-medium">Last Execution:</span>{' '}
                    {new Date(stats.lastExecution).toLocaleString()}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// Schedules Tab Component
function SchedulesTab({ 
  schedules, 
  entities 
}: { 
  schedules: DeprecationSchedule[];
  entities: LifecycleEntity[];
}) {
  const getEntityName = (entityId: string) => {
    return entities.find(e => e.id === entityId)?.name || 'Unknown Service';
  };

  const getDaysUntilScheduled = (scheduledDate: string) => {
    const now = new Date();
    const scheduled = new Date(scheduledDate);
    const diffTime = scheduled.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deprecation Schedules</CardTitle>
        <CardDescription>
          Planned deprecations and retirement schedules
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {schedules.map((schedule) => {
            const daysUntil = getDaysUntilScheduled(schedule.scheduledDate);
            
            return (
              <div key={schedule.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">{getEntityName(schedule.entityId)}</h3>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {daysUntil > 0 ? `${daysUntil} days` : 'Overdue'}
                    </span>
                  </div>
                </div>
                
                <div className="mb-3">
                  <Progress 
                    value={Math.max(0, Math.min(100, 100 - (daysUntil / 90) * 100))} 
                    className="h-2"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                  <div>
                    <span className="font-medium">Scheduled Date:</span>{' '}
                    {new Date(schedule.scheduledDate).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="font-medium">Created by:</span> {schedule.createdBy}
                  </div>
                  <div className="col-span-2">
                    <span className="font-medium">Reason:</span> {schedule.reason}
                  </div>
                  {schedule.replacementService && (
                    <div className="col-span-2">
                      <span className="font-medium">Replacement:</span> {schedule.replacementService}
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t">
                  <div className="text-sm">
                    <span className="font-medium">Notification Schedule:</span>
                    <div className="mt-1 flex gap-2">
                      {schedule.notificationDates.map((date, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {new Date(date).toLocaleDateString()}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Rule Configuration Dialog Component
function RuleConfigurationDialog({ 
  rules, 
  onRuleToggle,
  onRuleSelect 
}: {
  rules: LifecycleRule[];
  onRuleToggle?: (ruleId: string, enabled: boolean) => void;
  onRuleSelect?: (rule: LifecycleRule) => void;
}) {
  return (
    <div>
      <DialogHeader>
        <DialogTitle>Rule Configuration</DialogTitle>
        <DialogDescription>
          Configure automated lifecycle management rules
        </DialogDescription>
      </DialogHeader>
      <div className="mt-6 space-y-4 max-h-96 overflow-y-auto">
        {rules.map((rule) => (
          <div key={rule.id} className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <Switch
                checked={rule.enabled}
                onCheckedChange={(enabled) => onRuleToggle?.(rule.id, enabled)}
              />
              <div>
                <div className="font-medium">{rule.name}</div>
                <div className="text-sm text-muted-foreground">{rule.description}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={priorityColors[rule.priority]}>
                {rule.priority}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRuleSelect?.(rule)}
              >
                Configure
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}