/**
 * Feature Flag Management System - Core Service
 * Production-ready feature flag service with comprehensive functionality
 */

import { 
  FeatureFlag, 
  FlagEvaluation, 
  UserContext, 
  IFeatureFlagService,
  FlagFilters,
  BulkFlagUpdate,
  BulkEvaluationRequest,
  BulkEvaluationResponse,
  FeatureFlagError,
  FlagEvaluationError,
  AuditEntry,
  FlagMetrics,
  TargetingRule,
  RolloutConfig,
  KillSwitchTrigger,
  EvaluationReason,
  FlagType
} from './types';
import { EvaluationEngine } from './evaluation-engine';
import { AuditLogger } from './audit-logger';
import { MetricsCollector } from './metrics-collector';
import { ApprovalWorkflow } from './approval-workflow';

/**
 * Core Feature Flag Service
 * Handles flag management, evaluation, and orchestration
 */
export class FeatureFlagService implements IFeatureFlagService {
  private evaluationEngine: EvaluationEngine;
  private auditLogger: AuditLogger;
  private metricsCollector: MetricsCollector;
  private approvalWorkflow: ApprovalWorkflow;
  private flagCache = new Map<string, FeatureFlag>();
  private evaluationCache = new Map<string, { evaluation: FlagEvaluation; timestamp: number }>();
  
  constructor(
    private config: {
      cacheEnabled: boolean;
      cacheTTL: number;
      streamingEnabled: boolean;
      metricsEnabled: boolean;
      auditEnabled: boolean;
      approvalRequired: boolean;
    } = {
      cacheEnabled: true,
      cacheTTL: 60000, // 1 minute
      streamingEnabled: true,
      metricsEnabled: true,
      auditEnabled: true,
      approvalRequired: false
    }
  ) {
    this.evaluationEngine = new EvaluationEngine();
    this.auditLogger = new AuditLogger();
    this.metricsCollector = new MetricsCollector();
    this.approvalWorkflow = new ApprovalWorkflow();
  }

  /**
   * Create a new feature flag
   */
  async createFlag(flagData: Partial<FeatureFlag>): Promise<FeatureFlag> {
    try {
      // Validate flag data
      this.validateFlagData(flagData);
      
      const flag: FeatureFlag = {
        id: this.generateId(),
        key: flagData.key!,
        name: flagData.name!,
        description: flagData.description,
        enabled: flagData.enabled ?? false,
        defaultValue: flagData.defaultValue ?? false,
        environment: flagData.environment ?? 'development',
        projectId: flagData.projectId,
        type: flagData.type ?? 'boolean',
        tags: flagData.tags ?? [],
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: flagData.createdBy ?? 'system',
        updatedBy: flagData.updatedBy ?? 'system',
        archived: false,
        expiresAt: flagData.expiresAt,
        rollout: flagData.rollout ?? {
          enabled: false,
          percentage: 0,
          strategy: 'percentage'
        },
        targeting: flagData.targeting ?? {
          enabled: false,
          rules: [],
          fallback: { strategy: 'default' }
        },
        variations: flagData.variations ?? [],
        auditLog: []
      };

      // Store flag (in production, this would be database)
      await this.storeFlag(flag);
      
      // Update cache
      if (this.config.cacheEnabled) {
        this.flagCache.set(flag.key, flag);
      }

      // Audit log
      if (this.config.auditEnabled) {
        await this.auditLogger.log({
          id: this.generateId(),
          action: 'CREATED',
          flagKey: flag.key,
          userId: flag.createdBy,
          timestamp: new Date(),
          reason: 'Flag created'
        });
      }

      // Emit event for real-time updates
      this.emitFlagEvent('flag_created', flag);

      return flag;
    } catch (error) {
      throw new FeatureFlagError(
        `Failed to create flag: ${error.message}`,
        'CREATION_FAILED',
        error
      );
    }
  }

  /**
   * Update an existing feature flag
   */
  async updateFlag(flagKey: string, updates: Partial<FeatureFlag>): Promise<FeatureFlag> {
    try {
      const existingFlag = await this.getFlag(flagKey);
      if (!existingFlag) {
        throw new FeatureFlagError(`Flag not found: ${flagKey}`, 'FLAG_NOT_FOUND');
      }

      // Check if approval is required
      if (this.config.approvalRequired && this.requiresApproval(updates)) {
        await this.approvalWorkflow.requestApproval(flagKey, updates);
        throw new FeatureFlagError(
          'Update requires approval',
          'APPROVAL_REQUIRED'
        );
      }

      const updatedFlag: FeatureFlag = {
        ...existingFlag,
        ...updates,
        updatedAt: new Date(),
        updatedBy: updates.updatedBy ?? 'system'
      };

      // Validate updates
      this.validateFlagData(updatedFlag);

      // Store updated flag
      await this.storeFlag(updatedFlag);

      // Update cache
      if (this.config.cacheEnabled) {
        this.flagCache.set(flagKey, updatedFlag);
        // Invalidate evaluation cache for this flag
        this.invalidateEvaluationCache(flagKey);
      }

      // Audit log
      if (this.config.auditEnabled) {
        await this.auditLogger.log({
          id: this.generateId(),
          action: 'UPDATED',
          flagKey,
          userId: updatedFlag.updatedBy,
          timestamp: new Date(),
          changes: this.calculateChanges(existingFlag, updatedFlag)
        });
      }

      // Handle kill switch triggers if enabled
      if (updates.rollout?.killSwitchConfig?.triggers) {
        await this.setupKillSwitchMonitoring(flagKey, updatedFlag);
      }

      // Emit event for real-time updates
      this.emitFlagEvent('flag_updated', updatedFlag);

      return updatedFlag;
    } catch (error) {
      if (error instanceof FeatureFlagError) {
        throw error;
      }
      throw new FeatureFlagError(
        `Failed to update flag: ${error.message}`,
        'UPDATE_FAILED',
        error
      );
    }
  }

  /**
   * Delete a feature flag
   */
  async deleteFlag(flagKey: string): Promise<void> {
    try {
      const existingFlag = await this.getFlag(flagKey);
      if (!existingFlag) {
        throw new FeatureFlagError(`Flag not found: ${flagKey}`, 'FLAG_NOT_FOUND');
      }

      // Archive instead of delete for audit trail
      await this.archiveFlag(flagKey);

      // Remove from cache
      if (this.config.cacheEnabled) {
        this.flagCache.delete(flagKey);
        this.invalidateEvaluationCache(flagKey);
      }

      // Audit log
      if (this.config.auditEnabled) {
        await this.auditLogger.log({
          id: this.generateId(),
          action: 'DELETED',
          flagKey,
          userId: 'system',
          timestamp: new Date()
        });
      }

      // Emit event
      this.emitFlagEvent('flag_deleted', existingFlag);
    } catch (error) {
      if (error instanceof FeatureFlagError) {
        throw error;
      }
      throw new FeatureFlagError(
        `Failed to delete flag: ${error.message}`,
        'DELETE_FAILED',
        error
      );
    }
  }

  /**
   * Get a feature flag by key
   */
  async getFlag(flagKey: string): Promise<FeatureFlag | null> {
    try {
      // Check cache first
      if (this.config.cacheEnabled && this.flagCache.has(flagKey)) {
        return this.flagCache.get(flagKey)!;
      }

      // Load from storage
      const flag = await this.loadFlag(flagKey);
      
      // Update cache
      if (flag && this.config.cacheEnabled) {
        this.flagCache.set(flagKey, flag);
      }

      return flag;
    } catch (error) {
      throw new FeatureFlagError(
        `Failed to get flag: ${error.message}`,
        'GET_FAILED',
        error
      );
    }
  }

  /**
   * List feature flags with filtering
   */
  async listFlags(filters: FlagFilters = {}): Promise<FeatureFlag[]> {
    try {
      // In production, this would query the database with filters
      const allFlags = await this.loadAllFlags();
      
      let filteredFlags = allFlags;

      if (filters.environment) {
        filteredFlags = filteredFlags.filter(f => f.environment === filters.environment);
      }

      if (filters.enabled !== undefined) {
        filteredFlags = filteredFlags.filter(f => f.enabled === filters.enabled);
      }

      if (filters.type) {
        filteredFlags = filteredFlags.filter(f => f.type === filters.type);
      }

      if (filters.tags?.length) {
        filteredFlags = filteredFlags.filter(f => 
          filters.tags!.some(tag => f.tags.includes(tag))
        );
      }

      if (filters.archived !== undefined) {
        filteredFlags = filteredFlags.filter(f => f.archived === filters.archived);
      }

      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        filteredFlags = filteredFlags.filter(f =>
          f.name.toLowerCase().includes(searchTerm) ||
          f.key.toLowerCase().includes(searchTerm) ||
          (f.description && f.description.toLowerCase().includes(searchTerm))
        );
      }

      if (filters.createdBy) {
        filteredFlags = filteredFlags.filter(f => f.createdBy === filters.createdBy);
      }

      // Apply pagination
      const offset = filters.offset ?? 0;
      const limit = filters.limit ?? 50;
      
      return filteredFlags.slice(offset, offset + limit);
    } catch (error) {
      throw new FeatureFlagError(
        `Failed to list flags: ${error.message}`,
        'LIST_FAILED',
        error
      );
    }
  }

  /**
   * Archive a feature flag
   */
  async archiveFlag(flagKey: string): Promise<void> {
    const flag = await this.getFlag(flagKey);
    if (!flag) {
      throw new FeatureFlagError(`Flag not found: ${flagKey}`, 'FLAG_NOT_FOUND');
    }

    await this.updateFlag(flagKey, { 
      archived: true, 
      enabled: false,
      updatedBy: 'system'
    });
  }

  /**
   * Restore an archived feature flag
   */
  async restoreFlag(flagKey: string): Promise<void> {
    const flag = await this.getFlag(flagKey);
    if (!flag) {
      throw new FeatureFlagError(`Flag not found: ${flagKey}`, 'FLAG_NOT_FOUND');
    }

    await this.updateFlag(flagKey, { 
      archived: false,
      updatedBy: 'system'
    });
  }

  /**
   * Evaluate a single feature flag
   */
  async evaluateFlag(flagKey: string, context: UserContext): Promise<FlagEvaluation> {
    const startTime = Date.now();
    
    try {
      // Check evaluation cache
      const cacheKey = `${flagKey}:${JSON.stringify(context)}`;
      if (this.config.cacheEnabled) {
        const cached = this.evaluationCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < this.config.cacheTTL) {
          return cached.evaluation;
        }
      }

      const flag = await this.getFlag(flagKey);
      if (!flag) {
        throw new FlagEvaluationError(`Flag not found: ${flagKey}`, flagKey);
      }

      // Check if flag is archived or expired
      if (flag.archived) {
        return this.createEvaluation(flagKey, flag.defaultValue, {
          kind: 'OFF',
          errorKind: 'FLAG_ARCHIVED'
        });
      }

      if (flag.expiresAt && flag.expiresAt < new Date()) {
        return this.createEvaluation(flagKey, flag.defaultValue, {
          kind: 'OFF',
          errorKind: 'FLAG_EXPIRED'
        });
      }

      // Use evaluation engine
      const evaluation = await this.evaluationEngine.evaluate(flag, context);

      // Cache evaluation
      if (this.config.cacheEnabled) {
        this.evaluationCache.set(cacheKey, {
          evaluation,
          timestamp: Date.now()
        });
      }

      // Collect metrics
      if (this.config.metricsEnabled) {
        const duration = Date.now() - startTime;
        await this.metricsCollector.recordEvaluation(flagKey, evaluation, duration);
      }

      // Emit evaluation event
      this.emitFlagEvent('flag_evaluated', { flagKey, evaluation, context });

      return evaluation;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Record error metrics
      if (this.config.metricsEnabled) {
        await this.metricsCollector.recordError(flagKey, error, duration);
      }

      if (error instanceof FlagEvaluationError) {
        throw error;
      }

      throw new FlagEvaluationError(
        `Evaluation failed: ${error.message}`,
        flagKey,
        error
      );
    }
  }

  /**
   * Evaluate multiple feature flags
   */
  async evaluateFlags(flagKeys: string[], context: UserContext): Promise<Record<string, FlagEvaluation>> {
    const results: Record<string, FlagEvaluation> = {};
    
    // Evaluate flags in parallel
    const evaluationPromises = flagKeys.map(async (flagKey) => {
      try {
        const evaluation = await this.evaluateFlag(flagKey, context);
        return { flagKey, evaluation };
      } catch (error) {
        // Return default evaluation for failed flags
        return {
          flagKey,
          evaluation: this.createEvaluation(flagKey, false, {
            kind: 'ERROR',
            errorKind: 'EVALUATION_FAILED'
          })
        };
      }
    });

    const evaluationResults = await Promise.all(evaluationPromises);
    
    evaluationResults.forEach(({ flagKey, evaluation }) => {
      results[flagKey] = evaluation;
    });

    return results;
  }

  /**
   * Bulk update flags
   */
  async bulkUpdateFlags(updates: BulkFlagUpdate[]): Promise<FeatureFlag[]> {
    const results: FeatureFlag[] = [];
    
    // Process updates in parallel with concurrency limit
    const concurrency = 5;
    for (let i = 0; i < updates.length; i += concurrency) {
      const batch = updates.slice(i, i + concurrency);
      const batchPromises = batch.map(async (update) => {
        try {
          return await this.updateFlag(update.flagKey, update.updates);
        } catch (error) {
          // Log error but continue with other updates
          console.error(`Failed to update flag ${update.flagKey}:`, error);
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(Boolean) as FeatureFlag[]);
    }

    return results;
  }

  /**
   * Bulk evaluate flags
   */
  async bulkEvaluateFlags(request: BulkEvaluationRequest): Promise<BulkEvaluationResponse> {
    const evaluations = await this.evaluateFlags(request.flagKeys, request.context);
    
    return {
      evaluations,
      timestamp: new Date()
    };
  }

  // Private helper methods

  private validateFlagData(flag: Partial<FeatureFlag>): void {
    if (!flag.key) {
      throw new FeatureFlagError('Flag key is required', 'VALIDATION_ERROR');
    }

    if (!flag.name) {
      throw new FeatureFlagError('Flag name is required', 'VALIDATION_ERROR');
    }

    // Validate flag key format
    const flagKeyPattern = /^[a-zA-Z][a-zA-Z0-9._-]*$/;
    if (!flagKeyPattern.test(flag.key)) {
      throw new FeatureFlagError(
        'Flag key must start with a letter and contain only alphanumeric characters, dots, underscores, and hyphens',
        'VALIDATION_ERROR'
      );
    }

    // Validate rollout configuration
    if (flag.rollout?.percentage !== undefined) {
      if (flag.rollout.percentage < 0 || flag.rollout.percentage > 100) {
        throw new FeatureFlagError(
          'Rollout percentage must be between 0 and 100',
          'VALIDATION_ERROR'
        );
      }
    }

    // Validate variations
    if (flag.variations) {
      const totalWeight = flag.variations.reduce((sum, v) => sum + v.weight, 0);
      if (totalWeight > 100) {
        throw new FeatureFlagError(
          'Total variation weights cannot exceed 100%',
          'VALIDATION_ERROR'
        );
      }
    }
  }

  private requiresApproval(updates: Partial<FeatureFlag>): boolean {
    // Define which updates require approval
    const criticalFields = ['enabled', 'rollout', 'targeting', 'variations'];
    return criticalFields.some(field => field in updates);
  }

  private createEvaluation(
    flagKey: string, 
    value: any, 
    reason: EvaluationReason,
    variation?: string
  ): FlagEvaluation {
    return {
      flagKey,
      value,
      variation,
      reason,
      timestamp: new Date()
    };
  }

  private calculateChanges(oldFlag: FeatureFlag, newFlag: FeatureFlag): any[] {
    const changes: any[] = [];
    
    // Compare relevant fields
    const fieldsToCompare = ['enabled', 'rollout', 'targeting', 'variations', 'tags'];
    
    fieldsToCompare.forEach(field => {
      const oldValue = (oldFlag as any)[field];
      const newValue = (newFlag as any)[field];
      
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          field,
          oldValue,
          newValue
        });
      }
    });

    return changes;
  }

  private invalidateEvaluationCache(flagKey: string): void {
    // Remove all cached evaluations for this flag
    for (const key of this.evaluationCache.keys()) {
      if (key.startsWith(`${flagKey}:`)) {
        this.evaluationCache.delete(key);
      }
    }
  }

  private async setupKillSwitchMonitoring(flagKey: string, flag: FeatureFlag): Promise<void> {
    // Set up monitoring for kill switch triggers
    // In production, this would integrate with monitoring systems
    console.log(`Setting up kill switch monitoring for flag: ${flagKey}`);
  }

  private emitFlagEvent(eventType: string, data: any): void {
    // Emit real-time events for WebSocket clients
    // In production, this would use WebSocket or Server-Sent Events
    if (this.config.streamingEnabled) {
      console.log(`Emitting event: ${eventType}`, data);
    }
  }

  private generateId(): string {
    return `flag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Storage methods (in production, these would interact with database)
  private async storeFlag(flag: FeatureFlag): Promise<void> {
    // Mock storage implementation
    // In production, this would save to database
    console.log(`Storing flag: ${flag.key}`);
  }

  private async loadFlag(flagKey: string): Promise<FeatureFlag | null> {
    // Mock loading implementation
    // In production, this would query database
    return null;
  }

  private async loadAllFlags(): Promise<FeatureFlag[]> {
    // Mock loading implementation
    // In production, this would query database
    return [];
  }
}