/**
 * Edge Runtime Compatible Permission Engine
 * Simplified version for use in Next.js middleware
 */

import {
  Permission,
  PermissionAction,
  PermissionCheckRequest,
  PermissionContext,
  PermissionDecision,
  ResourceType,
  Role
} from './types';
import { PermissionCache } from './permission-cache-edge';

// Simplified user type for Edge Runtime
interface EdgeUser {
  id: string;
  roles: string[];
  permissions?: string[];
}

export class PermissionEngineEdge {
  private cache: PermissionCache;
  private static instance: PermissionEngineEdge;

  constructor() {
    this.cache = new PermissionCache();
  }

  static getInstance(): PermissionEngineEdge {
    if (!PermissionEngineEdge.instance) {
      PermissionEngineEdge.instance = new PermissionEngineEdge();
    }
    return PermissionEngineEdge.instance;
  }

  /**
   * Check if user has permission for a specific action
   * Simplified version for Edge Runtime
   */
  async checkPermission(
    request: PermissionCheckRequest
  ): Promise<PermissionDecision> {
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(request);
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      // In Edge Runtime, we'll use a simplified permission check
      // Real permission data should be passed via JWT or session
      const decision = await this.evaluateSimplifiedPermissions(
        request.userId,
        request.resource,
        request.action,
        request.context
      );

      // Cache the decision
      await this.cache.set(cacheKey, decision, 300);

      return decision;
    } catch (error) {
      console.error('Permission check failed:', error);
      return this.deny('Permission evaluation failed');
    }
  }

  /**
   * Simplified permission evaluation for Edge Runtime
   * This should rely on data available in the JWT/session
   */
  private async evaluateSimplifiedPermissions(
    userId: string,
    resource: ResourceType,
    action: PermissionAction,
    context?: PermissionContext
  ): Promise<PermissionDecision> {
    // In a real implementation, this would:
    // 1. Extract user roles/permissions from JWT
    // 2. Check against a simplified permission matrix
    // 3. Return the decision

    // For now, we'll implement basic logic
    // This should be replaced with actual logic based on your auth system
    
    // Example: Allow read operations for authenticated users
    if (action === PermissionAction.READ) {
      return {
        allowed: true,
        reason: 'Read access granted for authenticated user'
      };
    }

    // Example: Check for admin role for write operations
    // In production, this would come from JWT claims
    if (context?.roles?.includes('admin')) {
      return {
        allowed: true,
        reason: 'Admin access granted'
      };
    }

    // Default deny
    return this.deny('Insufficient permissions');
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(request: PermissionCheckRequest): string {
    return `perm:${request.userId}:${request.resource}:${request.action}:${request.resourceId || 'global'}`;
  }

  /**
   * Create deny decision
   */
  private deny(reason: string): PermissionDecision {
    return {
      allowed: false,
      reason
    };
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    await this.cache.clear();
  }
}