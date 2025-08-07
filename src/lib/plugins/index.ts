/**
 * Plugin System Exports
 * 
 * Main export file for the comprehensive plugin system including
 * dependency resolution, compatibility checking, and version management.
 */

// Main classes
export { DependencyResolver } from './DependencyResolver';
export { CompatibilityChecker } from './CompatibilityChecker';
export { VersionManager } from './VersionManager';

// Types
export * from './types';

// Re-export common types for convenience
export type {
  Plugin,
  PluginDependency,
  SystemRequirements,
  CompatibilityReport,
  ResolutionResult,
  UpgradeAnalysis,
  DependencyConflict,
  BreakingChange,
  MigrationGuide,
  ResolutionStrategy
} from './types';