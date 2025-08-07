/**
 * Comprehensive error handling utilities for bulk import/export operations
 */

export interface ErrorContext {
  operation: 'import' | 'export' | 'validation';
  phase: string;
  filename?: string;
  rowIndex?: number;
  entityName?: string;
  additionalInfo?: Record<string, any>;
}

export interface ProcessedError {
  id: string;
  message: string;
  code: string;
  severity: 'error' | 'warning' | 'info';
  category: 'validation' | 'parsing' | 'network' | 'permission' | 'system' | 'business';
  context: ErrorContext;
  suggestions: string[];
  recoverable: boolean;
  timestamp: Date;
  details?: any;
}

export class ErrorHandler {
  private static errorCodeMap = new Map<string, { category: string; severity: string; recoverable: boolean }>([
    // Validation errors
    ['VALIDATION_ERROR', { category: 'validation', severity: 'error', recoverable: true }],
    ['SCHEMA_VALIDATION_FAILED', { category: 'validation', severity: 'error', recoverable: true }],
    ['REQUIRED_FIELD_MISSING', { category: 'validation', severity: 'error', recoverable: true }],
    ['INVALID_FORMAT', { category: 'validation', severity: 'error', recoverable: true }],
    ['DUPLICATE_ENTITY', { category: 'validation', severity: 'warning', recoverable: true }],
    ['CIRCULAR_DEPENDENCY', { category: 'business', severity: 'error', recoverable: true }],
    ['INVALID_REFERENCE', { category: 'validation', severity: 'error', recoverable: true }],
    ['INVALID_OWNER', { category: 'validation', severity: 'warning', recoverable: true }],
    
    // Parsing errors
    ['PARSE_ERROR', { category: 'parsing', severity: 'error', recoverable: false }],
    ['UNSUPPORTED_FORMAT', { category: 'parsing', severity: 'error', recoverable: false }],
    ['FILE_CORRUPTED', { category: 'parsing', severity: 'error', recoverable: false }],
    ['ENCODING_ERROR', { category: 'parsing', severity: 'error', recoverable: false }],
    
    // System errors
    ['FILE_TOO_LARGE', { category: 'system', severity: 'error', recoverable: false }],
    ['MEMORY_LIMIT_EXCEEDED', { category: 'system', severity: 'error', recoverable: false }],
    ['TIMEOUT', { category: 'system', severity: 'error', recoverable: true }],
    ['STORAGE_FULL', { category: 'system', severity: 'error', recoverable: false }],
    
    // Network errors
    ['NETWORK_ERROR', { category: 'network', severity: 'error', recoverable: true }],
    ['SERVICE_UNAVAILABLE', { category: 'network', severity: 'error', recoverable: true }],
    ['RATE_LIMITED', { category: 'network', severity: 'warning', recoverable: true }],
    
    // Permission errors
    ['PERMISSION_DENIED', { category: 'permission', severity: 'error', recoverable: false }],
    ['UNAUTHORIZED', { category: 'permission', severity: 'error', recoverable: false }],
    ['FORBIDDEN', { category: 'permission', severity: 'error', recoverable: false }],
  ]);

  /**
   * Process and categorize an error
   */
  static processError(error: Error | string, context: ErrorContext): ProcessedError {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorStack = typeof error === 'string' ? undefined : error.stack;
    
    // Detect error code from message or use generic
    const errorCode = this.detectErrorCode(errorMessage) || 'UNKNOWN_ERROR';
    const errorInfo = this.errorCodeMap.get(errorCode) || {
      category: 'system',
      severity: 'error',
      recoverable: false,
    };

    const processedError: ProcessedError = {
      id: this.generateErrorId(),
      message: this.sanitizeErrorMessage(errorMessage),
      code: errorCode,
      severity: errorInfo.severity as any,
      category: errorInfo.category as any,
      context,
      suggestions: this.generateSuggestions(errorCode, errorMessage, context),
      recoverable: errorInfo.recoverable,
      timestamp: new Date(),
      details: errorStack ? { stack: errorStack } : undefined,
    };

    return processedError;
  }

  /**
   * Generate a unique error ID
   */
  private static generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Detect error code from error message
   */
  private static detectErrorCode(message: string): string | null {
    const lowercaseMessage = message.toLowerCase();

    // Validation patterns
    if (lowercaseMessage.includes('validation failed') || lowercaseMessage.includes('invalid')) {
      return 'VALIDATION_ERROR';
    }
    if (lowercaseMessage.includes('required') && lowercaseMessage.includes('missing')) {
      return 'REQUIRED_FIELD_MISSING';
    }
    if (lowercaseMessage.includes('duplicate')) {
      return 'DUPLICATE_ENTITY';
    }
    if (lowercaseMessage.includes('circular') || lowercaseMessage.includes('depends on itself')) {
      return 'CIRCULAR_DEPENDENCY';
    }

    // Parsing patterns
    if (lowercaseMessage.includes('parse') || lowercaseMessage.includes('syntax')) {
      return 'PARSE_ERROR';
    }
    if (lowercaseMessage.includes('unsupported format') || lowercaseMessage.includes('format not supported')) {
      return 'UNSUPPORTED_FORMAT';
    }
    if (lowercaseMessage.includes('corrupted') || lowercaseMessage.includes('malformed')) {
      return 'FILE_CORRUPTED';
    }

    // System patterns
    if (lowercaseMessage.includes('file too large') || lowercaseMessage.includes('size limit')) {
      return 'FILE_TOO_LARGE';
    }
    if (lowercaseMessage.includes('memory') || lowercaseMessage.includes('out of memory')) {
      return 'MEMORY_LIMIT_EXCEEDED';
    }
    if (lowercaseMessage.includes('timeout') || lowercaseMessage.includes('timed out')) {
      return 'TIMEOUT';
    }

    // Network patterns
    if (lowercaseMessage.includes('network') || lowercaseMessage.includes('connection')) {
      return 'NETWORK_ERROR';
    }
    if (lowercaseMessage.includes('service unavailable') || lowercaseMessage.includes('503')) {
      return 'SERVICE_UNAVAILABLE';
    }
    if (lowercaseMessage.includes('rate limit') || lowercaseMessage.includes('429')) {
      return 'RATE_LIMITED';
    }

    // Permission patterns
    if (lowercaseMessage.includes('permission denied') || lowercaseMessage.includes('403')) {
      return 'PERMISSION_DENIED';
    }
    if (lowercaseMessage.includes('unauthorized') || lowercaseMessage.includes('401')) {
      return 'UNAUTHORIZED';
    }

    return null;
  }

  /**
   * Sanitize error message for safe display
   */
  private static sanitizeErrorMessage(message: string): string {
    // Remove sensitive information patterns
    return message
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
      .replace(/\b(?:password|token|key|secret)\s*[:=]\s*\S+/gi, '[REDACTED]')
      .replace(/\b[A-Fa-f0-9]{32,}\b/g, '[HASH]')
      .trim();
  }

  /**
   * Generate helpful suggestions based on error code and context
   */
  private static generateSuggestions(code: string, message: string, context: ErrorContext): string[] {
    const suggestions: string[] = [];

    switch (code) {
      case 'VALIDATION_ERROR':
        suggestions.push('Check the entity schema documentation');
        suggestions.push('Validate required fields are present');
        if (context.rowIndex) {
          suggestions.push(`Review data in row ${context.rowIndex}`);
        }
        break;

      case 'REQUIRED_FIELD_MISSING':
        suggestions.push('Ensure all required fields are provided');
        suggestions.push('Check the template for required field names');
        suggestions.push('Verify field names match exactly (case-sensitive)');
        break;

      case 'DUPLICATE_ENTITY':
        suggestions.push('Use a different entity name or namespace');
        suggestions.push('Enable conflict resolution to handle duplicates');
        suggestions.push('Check if the entity already exists in the catalog');
        break;

      case 'CIRCULAR_DEPENDENCY':
        suggestions.push('Review dependency relationships');
        suggestions.push('Remove circular references from dependsOn fields');
        suggestions.push('Create a dependency graph to visualize relationships');
        break;

      case 'INVALID_REFERENCE':
        suggestions.push('Use the format: kind:namespace/name');
        suggestions.push('Example: component:default/my-service');
        suggestions.push('Verify the referenced entity exists');
        break;

      case 'PARSE_ERROR':
        suggestions.push('Check file format and encoding');
        suggestions.push('Validate JSON/YAML syntax');
        suggestions.push('Ensure CSV headers are present and correct');
        break;

      case 'FILE_TOO_LARGE':
        suggestions.push('Split the file into smaller chunks');
        suggestions.push('Remove unnecessary data or fields');
        suggestions.push('Use compression if available');
        break;

      case 'UNSUPPORTED_FORMAT':
        suggestions.push('Use supported formats: YAML, JSON, CSV, or Excel');
        suggestions.push('Check file extension matches content type');
        suggestions.push('Convert to a supported format');
        break;

      case 'NETWORK_ERROR':
        suggestions.push('Check your internet connection');
        suggestions.push('Retry the operation');
        suggestions.push('Verify the service endpoint is accessible');
        break;

      case 'SERVICE_UNAVAILABLE':
        suggestions.push('Try again in a few minutes');
        suggestions.push('Check service status page');
        suggestions.push('Contact system administrator if problem persists');
        break;

      case 'RATE_LIMITED':
        suggestions.push('Wait before retrying');
        suggestions.push('Reduce batch size');
        suggestions.push('Contact administrator to increase rate limits');
        break;

      case 'PERMISSION_DENIED':
        suggestions.push('Check your permissions');
        suggestions.push('Contact administrator for access');
        suggestions.push('Verify you are logged in correctly');
        break;

      case 'TIMEOUT':
        suggestions.push('Try with a smaller batch size');
        suggestions.push('Check network connectivity');
        suggestions.push('Retry the operation');
        break;

      default:
        suggestions.push('Check the error details for more information');
        suggestions.push('Try the operation again');
        suggestions.push('Contact support if the problem persists');
    }

    // Add context-specific suggestions
    if (context.operation === 'import') {
      suggestions.push('Download and use the provided templates');
      suggestions.push('Validate your data before importing');
    } else if (context.operation === 'export') {
      suggestions.push('Check export filters and options');
      suggestions.push('Verify entities exist in the catalog');
    }

    return suggestions;
  }

  /**
   * Categorize errors by severity and type
   */
  static categorizeErrors(errors: ProcessedError[]): {
    critical: ProcessedError[];
    errors: ProcessedError[];
    warnings: ProcessedError[];
    info: ProcessedError[];
    byCategory: Record<string, ProcessedError[]>;
  } {
    const critical = errors.filter(e => e.severity === 'error' && !e.recoverable);
    const regularErrors = errors.filter(e => e.severity === 'error' && e.recoverable);
    const warnings = errors.filter(e => e.severity === 'warning');
    const info = errors.filter(e => e.severity === 'info');

    const byCategory: Record<string, ProcessedError[]> = {};
    errors.forEach(error => {
      if (!byCategory[error.category]) {
        byCategory[error.category] = [];
      }
      byCategory[error.category].push(error);
    });

    return {
      critical,
      errors: regularErrors,
      warnings,
      info,
      byCategory,
    };
  }

  /**
   * Generate error summary for reporting
   */
  static generateErrorSummary(errors: ProcessedError[]): {
    total: number;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
    topErrors: Array<{ code: string; count: number; message: string }>;
  } {
    const bySeverity: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const errorCounts: Record<string, { count: number; message: string }> = {};

    errors.forEach(error => {
      // Count by severity
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
      
      // Count by category
      byCategory[error.category] = (byCategory[error.category] || 0) + 1;
      
      // Count by error code
      if (!errorCounts[error.code]) {
        errorCounts[error.code] = { count: 0, message: error.message };
      }
      errorCounts[error.code].count++;
    });

    // Get top 5 most common errors
    const topErrors = Object.entries(errorCounts)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 5)
      .map(([code, { count, message }]) => ({ code, count, message }));

    return {
      total: errors.length,
      bySeverity,
      byCategory,
      topErrors,
    };
  }

  /**
   * Check if errors are recoverable
   */
  static canRecover(errors: ProcessedError[]): boolean {
    return errors.every(error => error.recoverable);
  }

  /**
   * Get recovery actions for errors
   */
  static getRecoveryActions(errors: ProcessedError[]): string[] {
    const actions = new Set<string>();

    errors.forEach(error => {
      if (error.recoverable) {
        error.suggestions.forEach(suggestion => actions.add(suggestion));
      }
    });

    return Array.from(actions);
  }
}

/**
 * Error recovery strategies
 */
export class ErrorRecoveryStrategies {
  /**
   * Attempt automatic recovery for common errors
   */
  static async attemptAutoRecovery(
    errors: ProcessedError[],
    data: any[],
    context: ErrorContext
  ): Promise<{
    recovered: any[];
    remainingErrors: ProcessedError[];
    recoveryActions: string[];
  }> {
    const recovered: any[] = [];
    const remainingErrors: ProcessedError[] = [];
    const recoveryActions: string[] = [];

    // Group errors by row/entity
    const errorsByRow = new Map<number, ProcessedError[]>();
    errors.forEach(error => {
      if (error.context.rowIndex !== undefined) {
        const row = error.context.rowIndex;
        if (!errorsByRow.has(row)) {
          errorsByRow.set(row, []);
        }
        errorsByRow.get(row)!.push(error);
      } else {
        remainingErrors.push(error);
      }
    });

    // Attempt recovery for each row
    for (const [rowIndex, rowErrors] of errorsByRow.entries()) {
      const originalEntity = data[rowIndex - 1]; // rowIndex is 1-based
      if (!originalEntity) continue;

      try {
        const recoveryResult = await this.recoverEntity(originalEntity, rowErrors, context);
        
        if (recoveryResult.success) {
          recovered.push(recoveryResult.entity);
          recoveryActions.push(...recoveryResult.actions);
        } else {
          remainingErrors.push(...recoveryResult.errors);
        }
      } catch (error) {
        remainingErrors.push(...rowErrors);
      }
    }

    return { recovered, remainingErrors, recoveryActions };
  }

  /**
   * Attempt to recover a single entity
   */
  private static async recoverEntity(
    entity: any,
    errors: ProcessedError[],
    context: ErrorContext
  ): Promise<{
    success: boolean;
    entity?: any;
    errors: ProcessedError[];
    actions: string[];
  }> {
    let recoveredEntity = { ...entity };
    const remainingErrors: ProcessedError[] = [];
    const actions: string[] = [];

    for (const error of errors) {
      if (!error.recoverable) {
        remainingErrors.push(error);
        continue;
      }

      switch (error.code) {
        case 'VALIDATION_ERROR':
          // Attempt to fix validation errors
          const validationFix = this.fixValidationError(recoveredEntity, error);
          if (validationFix.success) {
            recoveredEntity = validationFix.entity;
            actions.push(validationFix.action);
          } else {
            remainingErrors.push(error);
          }
          break;

        case 'INVALID_REFERENCE':
          // Attempt to fix entity references
          const referenceFix = this.fixEntityReference(recoveredEntity, error);
          if (referenceFix.success) {
            recoveredEntity = referenceFix.entity;
            actions.push(referenceFix.action);
          } else {
            remainingErrors.push(error);
          }
          break;

        case 'DUPLICATE_ENTITY':
          // Generate unique name
          const uniqueFix = this.generateUniqueName(recoveredEntity, error);
          if (uniqueFix.success) {
            recoveredEntity = uniqueFix.entity;
            actions.push(uniqueFix.action);
          } else {
            remainingErrors.push(error);
          }
          break;

        default:
          remainingErrors.push(error);
      }
    }

    return {
      success: remainingErrors.length < errors.length,
      entity: recoveredEntity,
      errors: remainingErrors,
      actions,
    };
  }

  /**
   * Fix validation errors
   */
  private static fixValidationError(entity: any, error: ProcessedError): {
    success: boolean;
    entity: any;
    action: string;
  } {
    const field = error.context.additionalInfo?.field;
    if (!field) {
      return { success: false, entity, action: '' };
    }

    if (field === 'metadata.name') {
      const originalName = entity.metadata?.name;
      const fixedName = this.sanitizeName(originalName);
      
      if (fixedName !== originalName) {
        return {
          success: true,
          entity: {
            ...entity,
            metadata: { ...entity.metadata, name: fixedName },
          },
          action: `Fixed entity name: "${originalName}" → "${fixedName}"`,
        };
      }
    }

    return { success: false, entity, action: '' };
  }

  /**
   * Fix entity reference format
   */
  private static fixEntityReference(entity: any, error: ProcessedError): {
    success: boolean;
    entity: any;
    action: string;
  } {
    // Implementation for fixing entity references
    return { success: false, entity, action: '' };
  }

  /**
   * Generate unique entity name
   */
  private static generateUniqueName(entity: any, error: ProcessedError): {
    success: boolean;
    entity: any;
    action: string;
  } {
    const originalName = entity.metadata?.name;
    const uniqueName = `${originalName}-${Date.now().toString().slice(-6)}`;
    
    return {
      success: true,
      entity: {
        ...entity,
        metadata: { ...entity.metadata, name: uniqueName },
      },
      action: `Generated unique name: "${originalName}" → "${uniqueName}"`,
    };
  }

  /**
   * Sanitize entity name
   */
  private static sanitizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}

export default ErrorHandler;