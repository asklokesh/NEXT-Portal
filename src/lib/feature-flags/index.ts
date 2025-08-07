/**
 * Feature Flag Management System - Main Export File
 * Complete feature flag system with SDK, service, and utilities
 */

// Core types
export * from './types';

// Main service
export { FeatureFlagService } from './service';

// Evaluation engine
export { EvaluationEngine } from './evaluation-engine';

// Management utilities
export { AuditLogger } from './audit-logger';
export { MetricsCollector } from './metrics-collector';
export { ApprovalWorkflow } from './approval-workflow';

// Advanced features
export { RolloutManager } from './rollout-manager';
export { KillSwitchManager } from './kill-switch-manager';

// SDK client
export { FeatureFlagSDK, createFeatureFlagClient } from './sdk-client';

// Default configuration
export const DEFAULT_FEATURE_FLAG_CONFIG = {
  cacheEnabled: true,
  cacheTTL: 60000, // 1 minute
  streamingEnabled: true,
  metricsEnabled: true,
  auditEnabled: true,
  approvalRequired: false,
  pollInterval: 60000, // 1 minute
  timeout: 5000, // 5 seconds
  offlineMode: false,
  debugMode: process.env.NODE_ENV === 'development'
};

// Utility functions
export const createFeatureFlagService = (config = DEFAULT_FEATURE_FLAG_CONFIG) => {
  return new FeatureFlagService(config);
};

export const createFeatureFlagSDK = (config: {
  apiKey: string;
  baseUrl: string;
  environment: string;
  userId?: string;
}) => {
  return createFeatureFlagClient({
    ...DEFAULT_FEATURE_FLAG_CONFIG,
    ...config
  });
};