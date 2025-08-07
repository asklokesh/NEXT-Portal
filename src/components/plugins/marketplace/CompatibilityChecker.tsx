'use client';

import React, { useMemo, useState } from 'react';
import {
  Shield,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
  Package,
  Server,
  Code,
  Database,
  Network,
  Lock,
  Zap,
  Cpu,
  MemoryStick,
  HardDrive,
  Globe,
  GitBranch,
  Settings,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import type { BackstagePlugin } from '@/services/backstage/plugin-registry';

interface CompatibilityResult {
  overall: 'compatible' | 'warning' | 'incompatible';
  score: number;
  checks: CompatibilityCheck[];
  requirements: SystemRequirement[];
  recommendations: string[];
  blockers: string[];
}

interface CompatibilityCheck {
  category: 'system' | 'dependencies' | 'versions' | 'permissions' | 'resources' | 'configuration';
  name: string;
  status: 'pass' | 'warning' | 'fail';
  message: string;
  required: boolean;
  details?: string;
  fixAction?: string;
}

interface SystemRequirement {
  type: 'runtime' | 'dependency' | 'service' | 'permission' | 'resource';
  name: string;
  required: string;
  current: string;
  satisfied: boolean;
  critical: boolean;
}

interface CompatibilityCheckerProps {
  plugin: BackstagePlugin;
  installedPlugins?: BackstagePlugin[];
  systemInfo?: SystemInfo;
  onCheckComplete?: (result: CompatibilityResult) => void;
}

interface SystemInfo {
  backstageVersion: string;
  nodeVersion: string;
  npmVersion: string;
  platform: string;
  arch: string;
  memory: number;
  diskSpace: number;
  installedPackages: Record<string, string>;
  availableServices: string[];
  permissions: string[];
}

const MOCK_SYSTEM_INFO: SystemInfo = {
  backstageVersion: '1.18.3',
  nodeVersion: '18.17.1',
  npmVersion: '9.6.7',
  platform: 'linux',
  arch: 'x64',
  memory: 8192, // MB
  diskSpace: 50000, // MB
  installedPackages: {
    '@backstage/core-plugin-api': '1.18.3',
    '@backstage/theme': '0.4.4',
    'react': '18.2.0',
    'react-dom': '18.2.0',
    'typescript': '5.0.4',
  },
  availableServices: ['postgresql', 'redis', 'elasticsearch'],
  permissions: ['catalog:read', 'catalog:write', 'scaffolder:read', 'user:read'],
};

class CompatibilityEngine {
  private systemInfo: SystemInfo;

  constructor(systemInfo: SystemInfo) {
    this.systemInfo = systemInfo;
  }

  public checkCompatibility(plugin: BackstagePlugin, installedPlugins: BackstagePlugin[] = []): CompatibilityResult {
    const checks: CompatibilityCheck[] = [];
    const requirements: SystemRequirement[] = [];
    let score = 100;

    // System version checks
    checks.push(...this.checkSystemVersions(plugin));
    
    // Dependency checks
    checks.push(...this.checkDependencies(plugin));
    
    // Resource checks
    checks.push(...this.checkResourceRequirements(plugin));
    
    // Permission checks
    checks.push(...this.checkPermissions(plugin));
    
    // Conflict checks
    checks.push(...this.checkConflicts(plugin, installedPlugins));
    
    // Configuration checks
    checks.push(...this.checkConfiguration(plugin));

    // Calculate requirements
    requirements.push(...this.extractRequirements(plugin));

    // Calculate overall score
    const failedCriticalChecks = checks.filter(c => c.status === 'fail' && c.required).length;
    const warningChecks = checks.filter(c => c.status === 'warning').length;
    const failedChecks = checks.filter(c => c.status === 'fail').length;

    score = Math.max(0, score - (failedCriticalChecks * 40) - (warningChecks * 10) - (failedChecks * 20));

    // Determine overall status
    let overall: CompatibilityResult['overall'] = 'compatible';
    if (failedCriticalChecks > 0) {
      overall = 'incompatible';
    } else if (warningChecks > 0 || failedChecks > 0) {
      overall = 'warning';
    }

    // Generate recommendations and blockers
    const recommendations = this.generateRecommendations(checks, plugin);
    const blockers = checks
      .filter(c => c.status === 'fail' && c.required)
      .map(c => c.message);

    return {
      overall,
      score,
      checks,
      requirements,
      recommendations,
      blockers,
    };
  }

  private checkSystemVersions(plugin: BackstagePlugin): CompatibilityCheck[] {
    const checks: CompatibilityCheck[] = [];

    // Backstage version check
    if (plugin.compatibility?.backstageVersion) {
      const required = plugin.compatibility.backstageVersion;
      const current = this.systemInfo.backstageVersion;
      const compatible = this.compareVersions(current, required);

      checks.push({
        category: 'versions',
        name: 'Backstage Version',
        status: compatible ? 'pass' : 'fail',
        message: compatible 
          ? `Compatible with Backstage ${current}` 
          : `Requires Backstage ${required}, but ${current} is installed`,
        required: true,
        details: `Plugin requires ${required}, system has ${current}`,
        fixAction: compatible ? undefined : 'Upgrade Backstage to a compatible version',
      });
    }

    // Node.js version check
    if (plugin.compatibility?.nodeVersion) {
      const required = plugin.compatibility.nodeVersion;
      const current = this.systemInfo.nodeVersion;
      const compatible = this.compareVersions(current, required);

      checks.push({
        category: 'versions',
        name: 'Node.js Version',
        status: compatible ? 'pass' : 'fail',
        message: compatible 
          ? `Compatible with Node.js ${current}` 
          : `Requires Node.js ${required}, but ${current} is installed`,
        required: true,
        details: `Plugin requires ${required}, system has ${current}`,
        fixAction: compatible ? undefined : 'Upgrade Node.js to a compatible version',
      });
    }

    return checks;
  }

  private checkDependencies(plugin: BackstagePlugin): CompatibilityCheck[] {
    const checks: CompatibilityCheck[] = [];
    const dependencies = plugin.dependencies || [];

    dependencies.forEach(dep => {
      const installed = this.systemInfo.installedPackages[dep];
      const isInstalled = !!installed;

      checks.push({
        category: 'dependencies',
        name: `Dependency: ${dep}`,
        status: isInstalled ? 'pass' : 'warning',
        message: isInstalled 
          ? `${dep} is available (${installed})` 
          : `${dep} will be installed automatically`,
        required: false,
        details: isInstalled ? `Version ${installed} is installed` : 'Will be installed during plugin installation',
      });
    });

    return checks;
  }

  private checkResourceRequirements(plugin: BackstagePlugin): CompatibilityCheck[] {
    const checks: CompatibilityCheck[] = [];

    // Memory requirement (estimated based on plugin category)
    const memoryRequirements = {
      'monitoring': 256,
      'analytics': 512,
      'ci-cd': 256,
      'infrastructure': 384,
      'security': 128,
      'documentation': 128,
      'default': 128,
    };

    const requiredMemory = memoryRequirements[plugin.category] || memoryRequirements.default;
    const availableMemory = this.systemInfo.memory;

    checks.push({
      category: 'resources',
      name: 'Memory Requirement',
      status: availableMemory >= requiredMemory ? 'pass' : 'fail',
      message: availableMemory >= requiredMemory 
        ? `Sufficient memory available (${availableMemory}MB)` 
        : `Insufficient memory: ${requiredMemory}MB required, ${availableMemory}MB available`,
      required: true,
      details: `Plugin estimated to use ${requiredMemory}MB, system has ${availableMemory}MB`,
      fixAction: availableMemory >= requiredMemory ? undefined : 'Increase system memory or close other applications',
    });

    // Disk space requirement
    const requiredDisk = 100; // Base requirement
    checks.push({
      category: 'resources',
      name: 'Disk Space',
      status: this.systemInfo.diskSpace >= requiredDisk ? 'pass' : 'fail',
      message: this.systemInfo.diskSpace >= requiredDisk 
        ? `Sufficient disk space available` 
        : `Insufficient disk space: ${requiredDisk}MB required`,
      required: true,
      details: `Plugin requires ${requiredDisk}MB, ${this.systemInfo.diskSpace}MB available`,
      fixAction: this.systemInfo.diskSpace >= requiredDisk ? undefined : 'Free up disk space',
    });

    return checks;
  }

  private checkPermissions(plugin: BackstagePlugin): CompatibilityCheck[] {
    const checks: CompatibilityCheck[] = [];
    const requiredPermissions = plugin.permissions || [];

    requiredPermissions.forEach(permission => {
      const hasPermission = this.systemInfo.permissions.includes(permission);

      checks.push({
        category: 'permissions',
        name: `Permission: ${permission}`,
        status: hasPermission ? 'pass' : 'warning',
        message: hasPermission 
          ? `Permission ${permission} is available` 
          : `Permission ${permission} may be required`,
        required: false,
        details: hasPermission ? 'User has this permission' : 'This permission may need to be granted',
        fixAction: hasPermission ? undefined : 'Contact administrator to grant permission',
      });
    });

    return checks;
  }

  private checkConflicts(plugin: BackstagePlugin, installedPlugins: BackstagePlugin[]): CompatibilityCheck[] {
    const checks: CompatibilityCheck[] = [];

    // Check for conflicting plugins (plugins that provide similar functionality)
    const conflictCategories = {
      'monitoring': ['monitoring', 'observability'],
      'ci-cd': ['ci-cd', 'deployment'],
      'security': ['security', 'auth'],
    };

    const categoryConflicts = conflictCategories[plugin.category];
    if (categoryConflicts) {
      const conflicting = installedPlugins.filter(p => 
        categoryConflicts.includes(p.category) && p.id !== plugin.id
      );

      if (conflicting.length > 0) {
        checks.push({
          category: 'configuration',
          name: 'Plugin Conflicts',
          status: 'warning',
          message: `May conflict with installed plugins: ${conflicting.map(p => p.title).join(', ')}`,
          required: false,
          details: 'Multiple plugins in the same category may cause configuration conflicts',
          fixAction: 'Review configuration to avoid conflicts',
        });
      }
    }

    return checks;
  }

  private checkConfiguration(plugin: BackstagePlugin): CompatibilityCheck[] {
    const checks: CompatibilityCheck[] = [];

    // Check if plugin requires external services
    const serviceRequirements = {
      'monitoring': ['prometheus', 'grafana'],
      'ci-cd': ['jenkins', 'github'],
      'analytics': ['elasticsearch'],
      'infrastructure': ['kubernetes'],
    };

    const requiredServices = serviceRequirements[plugin.category] || [];
    requiredServices.forEach(service => {
      const isAvailable = this.systemInfo.availableServices.includes(service);

      checks.push({
        category: 'configuration',
        name: `External Service: ${service}`,
        status: isAvailable ? 'pass' : 'warning',
        message: isAvailable 
          ? `${service} service is available` 
          : `${service} service may be required for full functionality`,
        required: false,
        details: isAvailable 
          ? `${service} is configured and available` 
          : `Plugin may require ${service} configuration`,
        fixAction: isAvailable ? undefined : `Configure ${service} service if needed`,
      });
    });

    return checks;
  }

  private extractRequirements(plugin: BackstagePlugin): SystemRequirement[] {
    const requirements: SystemRequirement[] = [];

    // Runtime requirements
    if (plugin.compatibility?.backstageVersion) {
      requirements.push({
        type: 'runtime',
        name: 'Backstage',
        required: plugin.compatibility.backstageVersion,
        current: this.systemInfo.backstageVersion,
        satisfied: this.compareVersions(this.systemInfo.backstageVersion, plugin.compatibility.backstageVersion),
        critical: true,
      });
    }

    if (plugin.compatibility?.nodeVersion) {
      requirements.push({
        type: 'runtime',
        name: 'Node.js',
        required: plugin.compatibility.nodeVersion,
        current: this.systemInfo.nodeVersion,
        satisfied: this.compareVersions(this.systemInfo.nodeVersion, plugin.compatibility.nodeVersion),
        critical: true,
      });
    }

    // Dependencies
    (plugin.dependencies || []).forEach(dep => {
      const current = this.systemInfo.installedPackages[dep] || 'Not installed';
      requirements.push({
        type: 'dependency',
        name: dep,
        required: 'Latest',
        current,
        satisfied: !!this.systemInfo.installedPackages[dep],
        critical: false,
      });
    });

    return requirements;
  }

  private generateRecommendations(checks: CompatibilityCheck[], plugin: BackstagePlugin): string[] {
    const recommendations: string[] = [];

    const failedChecks = checks.filter(c => c.status === 'fail');
    const warningChecks = checks.filter(c => c.status === 'warning');

    if (failedChecks.length === 0 && warningChecks.length === 0) {
      recommendations.push('Plugin is fully compatible and ready for installation');
    } else {
      if (failedChecks.length > 0) {
        recommendations.push('Resolve compatibility issues before installation');
      }
      
      if (warningChecks.length > 0) {
        recommendations.push('Review warnings to ensure optimal functionality');
      }

      // Specific recommendations
      const versionChecks = checks.filter(c => c.category === 'versions' && c.status === 'fail');
      if (versionChecks.length > 0) {
        recommendations.push('Update system components to meet version requirements');
      }

      const resourceChecks = checks.filter(c => c.category === 'resources' && c.status === 'fail');
      if (resourceChecks.length > 0) {
        recommendations.push('Increase system resources or optimize current usage');
      }

      const permissionChecks = checks.filter(c => c.category === 'permissions' && c.status === 'warning');
      if (permissionChecks.length > 0) {
        recommendations.push('Verify user permissions are sufficient for plugin functionality');
      }
    }

    return recommendations;
  }

  private compareVersions(current: string, required: string): boolean {
    // Simple version comparison (in real implementation, use a proper semver library)
    const currentParts = current.replace(/[^\d.]/g, '').split('.').map(Number);
    const requiredParts = required.replace(/[^\d.]/g, '').split('.').map(Number);

    for (let i = 0; i < Math.max(currentParts.length, requiredParts.length); i++) {
      const currentPart = currentParts[i] || 0;
      const requiredPart = requiredParts[i] || 0;

      if (currentPart > requiredPart) return true;
      if (currentPart < requiredPart) return false;
    }

    return true; // Equal versions are compatible
  }
}

function CompatibilityCheckItem({ check }: { check: CompatibilityCheck }) {
  const [expanded, setExpanded] = useState(false);
  
  const getStatusIcon = () => {
    switch (check.status) {
      case 'pass':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusColor = () => {
    switch (check.status) {
      case 'pass':
        return 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20';
      case 'warning':
        return 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20';
      case 'fail':
        return 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20';
    }
  };

  return (
    <div className={`border rounded-lg p-4 ${getStatusColor()}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {getStatusIcon()}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {check.name}
              </h4>
              {check.required && (
                <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300 px-2 py-0.5 rounded-full">
                  Required
                </span>
              )}
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {check.message}
            </p>
          </div>
        </div>
        
        {(check.details || check.fixAction) && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      {expanded && (check.details || check.fixAction) && (
        <div className="mt-3 pl-8 space-y-2">
          {check.details && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong>Details:</strong> {check.details}
            </p>
          )}
          {check.fixAction && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong>Fix:</strong> {check.fixAction}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function RequirementItem({ requirement }: { requirement: SystemRequirement }) {
  const getStatusIcon = () => {
    return requirement.satisfied ? (
      <CheckCircle className="w-4 h-4 text-green-500" />
    ) : (
      <XCircle className="w-4 h-4 text-red-500" />
    );
  };

  const getTypeIcon = () => {
    switch (requirement.type) {
      case 'runtime':
        return <Server className="w-4 h-4 text-blue-500" />;
      case 'dependency':
        return <Package className="w-4 h-4 text-purple-500" />;
      case 'service':
        return <Network className="w-4 h-4 text-green-500" />;
      case 'permission':
        return <Lock className="w-4 h-4 text-orange-500" />;
      case 'resource':
        return <Cpu className="w-4 h-4 text-yellow-500" />;
      default:
        return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <div className="flex items-center gap-3">
        {getTypeIcon()}
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {requirement.name}
            </span>
            {requirement.critical && (
              <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300 px-1.5 py-0.5 rounded">
                Critical
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Required: {requirement.required} | Current: {requirement.current}
          </div>
        </div>
      </div>
      
      {getStatusIcon()}
    </div>
  );
}

export function CompatibilityChecker({ 
  plugin, 
  installedPlugins = [], 
  systemInfo = MOCK_SYSTEM_INFO,
  onCheckComplete 
}: CompatibilityCheckerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'checks' | 'requirements'>('overview');
  const [isChecking, setIsChecking] = useState(false);

  const compatibilityResult = useMemo(() => {
    const engine = new CompatibilityEngine(systemInfo);
    const result = engine.checkCompatibility(plugin, installedPlugins);
    onCheckComplete?.(result);
    return result;
  }, [plugin, installedPlugins, systemInfo, onCheckComplete]);

  const runCheck = async () => {
    setIsChecking(true);
    // Simulate checking delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsChecking(false);
  };

  const getOverallStatusIcon = () => {
    if (isChecking) return <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />;
    
    switch (compatibilityResult.overall) {
      case 'compatible':
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-yellow-500" />;
      case 'incompatible':
        return <XCircle className="w-6 h-6 text-red-500" />;
    }
  };

  const getOverallStatusText = () => {
    if (isChecking) return 'Checking compatibility...';
    
    switch (compatibilityResult.overall) {
      case 'compatible':
        return 'Fully Compatible';
      case 'warning':
        return 'Compatible with Warnings';
      case 'incompatible':
        return 'Not Compatible';
    }
  };

  const getOverallStatusColor = () => {
    switch (compatibilityResult.overall) {
      case 'compatible':
        return 'text-green-600 dark:text-green-400';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'incompatible':
        return 'text-red-600 dark:text-red-400';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Compatibility Check
          </h3>
        </div>
        
        <button
          onClick={runCheck}
          disabled={isChecking}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
          {isChecking ? 'Checking...' : 'Re-check'}
        </button>
      </div>

      {/* Overall Status */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-4">
          {getOverallStatusIcon()}
          <div className="flex-1">
            <h4 className={`text-lg font-semibold ${getOverallStatusColor()}`}>
              {getOverallStatusText()}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Compatibility Score: {compatibilityResult.score}/100
            </p>
            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mt-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  compatibilityResult.score >= 80
                    ? 'bg-green-500'
                    : compatibilityResult.score >= 60
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${compatibilityResult.score}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: Info },
            { id: 'checks', label: 'Detailed Checks', icon: Settings },
            { id: 'requirements', label: 'Requirements', icon: Package },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-1 py-3 border-b-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Blockers */}
            {compatibilityResult.blockers.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Critical Issues ({compatibilityResult.blockers.length})
                </h4>
                <div className="space-y-2">
                  {compatibilityResult.blockers.map((blocker, index) => (
                    <div key={index} className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm text-red-700 dark:text-red-300">{blocker}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                <Lightbulb className="w-4 h-4" />
                Recommendations
              </h4>
              <div className="space-y-2">
                {compatibilityResult.recommendations.map((recommendation, index) => (
                  <div key={index} className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-700 dark:text-blue-300">{recommendation}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {compatibilityResult.checks.filter(c => c.status === 'pass').length}
                </div>
                <div className="text-sm text-green-700 dark:text-green-300">Passed</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">
                  {compatibilityResult.checks.filter(c => c.status === 'warning').length}
                </div>
                <div className="text-sm text-yellow-700 dark:text-yellow-300">Warnings</div>
              </div>
              <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {compatibilityResult.checks.filter(c => c.status === 'fail').length}
                </div>
                <div className="text-sm text-red-700 dark:text-red-300">Failed</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'checks' && (
          <div className="space-y-4">
            {compatibilityResult.checks.map((check, index) => (
              <CompatibilityCheckItem key={index} check={check} />
            ))}
          </div>
        )}

        {activeTab === 'requirements' && (
          <div className="space-y-4">
            {compatibilityResult.requirements.map((requirement, index) => (
              <RequirementItem key={index} requirement={requirement} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}