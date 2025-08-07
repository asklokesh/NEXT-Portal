/**
 * Kubernetes V2 Plugin - Main Export Index
 * Centralized exports for the advanced Kubernetes management plugin
 */

// Core types
export * from './types';

// Management engines
export { multiCloudManager } from './multi-cloud-manager';
export { aiInsightsEngine } from './ai-insights-engine';
export { costOptimizationEngine } from './cost-optimization-engine';
export { securityScanner } from './security-scanner';
export { resourceOptimizationEngine } from './resource-optimization-engine';

// Plugin configuration
export { kubernetesV2PluginConfig } from '../../plugins/kubernetes-v2/plugin.config';

// Utility functions
export const KUBERNETES_V2_CONSTANTS = {
  PLUGIN_ID: 'kubernetes-v2',
  VERSION: '2.0.0',
  API_PREFIX: '/api/kubernetes-v2',
  DEFAULT_REFRESH_INTERVAL: 30000,
  MAX_CLUSTERS: 50,
  
  // Provider types
  SUPPORTED_PROVIDERS: ['aws', 'gcp', 'azure', 'bare-metal', 'hybrid'],
  
  // AI confidence thresholds
  AI_CONFIDENCE_THRESHOLDS: {
    HIGH: 0.9,
    MEDIUM: 0.7,
    LOW: 0.5
  },
  
  // Cost optimization thresholds
  COST_THRESHOLDS: {
    HIGH_IMPACT: 1000,
    MEDIUM_IMPACT: 500,
    LOW_IMPACT: 100
  },
  
  // Security severity levels
  SECURITY_SEVERITIES: ['low', 'medium', 'high', 'critical'],
  
  // Resource optimization types
  OPTIMIZATION_TYPES: [
    'rightsizing',
    'scheduling', 
    'spot-instances',
    'storage-optimization',
    'network-optimization'
  ],
  
  // Auto-scaling types
  SCALING_TYPES: ['horizontal', 'vertical', 'cluster'],
  
  // Compliance frameworks
  COMPLIANCE_FRAMEWORKS: ['cis', 'nist', 'pci-dss', 'sox', 'hipaa', 'gdpr']
};

// Validation functions
export const validateClusterConfig = (config: any): string[] => {
  const errors: string[] = [];
  
  if (!config.name) errors.push('Cluster name is required');
  if (!config.provider) errors.push('Provider configuration is required');
  if (!config.environment) errors.push('Environment is required');
  if (!config.region) errors.push('Region is required');
  
  if (config.provider && !KUBERNETES_V2_CONSTANTS.SUPPORTED_PROVIDERS.includes(config.provider.type)) {
    errors.push(`Unsupported provider type: ${config.provider.type}`);
  }
  
  return errors;
};

export const validateOptimizationRecommendation = (recommendation: any): boolean => {
  return (
    recommendation.confidence >= KUBERNETES_V2_CONSTANTS.AI_CONFIDENCE_THRESHOLDS.LOW &&
    recommendation.impact &&
    recommendation.impact.cost !== undefined &&
    recommendation.implementation &&
    Array.isArray(recommendation.implementation.steps)
  );
};

// Utility functions for cost calculations
export const calculateCostSavings = (
  currentCost: number, 
  optimizedCost: number
): number => {
  return Math.max(0, currentCost - optimizedCost);
};

export const calculateCostSavingsPercentage = (
  currentCost: number, 
  optimizedCost: number
): number => {
  if (currentCost === 0) return 0;
  return ((currentCost - optimizedCost) / currentCost) * 100;
};

// Utility functions for security scoring
export const calculateSecurityScore = (
  vulnerabilities: { severity: string }[],
  complianceChecks: { passed: number; total: number }
): number => {
  // Base score
  let score = 100;
  
  // Deduct points for vulnerabilities
  vulnerabilities.forEach(vuln => {
    switch (vuln.severity) {
      case 'critical':
        score -= 20;
        break;
      case 'high':
        score -= 10;
        break;
      case 'medium':
        score -= 5;
        break;
      case 'low':
        score -= 1;
        break;
    }
  });
  
  // Factor in compliance score
  const complianceScore = complianceChecks.total > 0 
    ? (complianceChecks.passed / complianceChecks.total) * 100 
    : 100;
  
  // Weighted average (60% vulnerability impact, 40% compliance)
  const finalScore = (score * 0.6) + (complianceScore * 0.4);
  
  return Math.max(0, Math.min(100, Math.round(finalScore)));
};

// Resource utilization utilities
export const calculateResourceEfficiency = (
  usage: number,
  limit: number
): number => {
  if (limit === 0) return 0;
  return Math.min(100, (usage / limit) * 100);
};

export const determineResourceWaste = (
  request: number,
  usage: number
): number => {
  return Math.max(0, request - usage);
};

// Time and date utilities
export const formatTimestamp = (timestamp: string): string => {
  return new Date(timestamp).toLocaleString();
};

export const getTimeAgo = (timestamp: string): string => {
  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now.getTime() - past.getTime();
  
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return `${seconds} second${seconds > 1 ? 's' : ''} ago`;
};

// Format utilities
export const formatCurrency = (
  amount: number, 
  currency: string = 'USD'
): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(amount);
};

export const formatBytes = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

export const formatPercentage = (value: number, decimals: number = 1): string => {
  return `${value.toFixed(decimals)}%`;
};

// Color utilities for UI components
export const getStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'healthy':
    case 'active':
    case 'running':
      return 'text-green-600';
    case 'warning':
    case 'degraded':
      return 'text-yellow-600';
    case 'error':
    case 'failed':
    case 'critical':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
};

export const getSeverityColor = (severity: string): string => {
  switch (severity.toLowerCase()) {
    case 'critical':
      return 'text-red-600';
    case 'high':
      return 'text-orange-600';
    case 'medium':
      return 'text-yellow-600';
    case 'low':
      return 'text-blue-600';
    default:
      return 'text-gray-600';
  }
};

// Default plugin instance (for compatibility)
export const kubernetesV2Plugin = {
  id: KUBERNETES_V2_CONSTANTS.PLUGIN_ID,
  version: KUBERNETES_V2_CONSTANTS.VERSION,
  config: kubernetesV2PluginConfig,
  
  // Core functionality
  multiCloudManager,
  aiInsightsEngine,
  costOptimizationEngine,
  securityScanner,
  resourceOptimizationEngine,
  
  // Utilities
  utils: {
    validateClusterConfig,
    validateOptimizationRecommendation,
    calculateCostSavings,
    calculateCostSavingsPercentage,
    calculateSecurityScore,
    calculateResourceEfficiency,
    determineResourceWaste,
    formatTimestamp,
    getTimeAgo,
    formatCurrency,
    formatBytes,
    formatPercentage,
    getStatusColor,
    getSeverityColor
  }
};

export default kubernetesV2Plugin;