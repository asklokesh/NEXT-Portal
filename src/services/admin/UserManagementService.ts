/**
 * Enterprise User Management Service
 * Handles user CRUD operations, search, bulk operations, and user lifecycle management
 */

import { prisma } from '@/lib/db/client';
import { User, UserRole, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { AuditService } from './AuditService';
import { CacheService } from '@/lib/cache/CacheService';
import { EventEmitter } from 'events';

export interface UserCreateInput {
  email: string;
  name: string;
  username?: string;
  password?: string;
  role: UserRole;
  teamIds?: string[];
  isActive?: boolean;
  metadata?: Record<string, any>;
}

export interface UserUpdateInput {
  email?: string;
  name?: string;
  username?: string;
  role?: UserRole;
  isActive?: boolean;
  mfaEnabled?: boolean;
  teamIds?: string[];
  metadata?: Record<string, any>;
}

export interface UserSearchParams {
  query?: string;
  role?: UserRole;
  teamId?: string;
  isActive?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  lastLoginAfter?: Date;
  lastLoginBefore?: Date;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'email' | 'createdAt' | 'lastLogin';
  sortOrder?: 'asc' | 'desc';
}

export interface BulkOperationResult {
  success: number;
  failed: number;
  errors: Array<{ userId: string; error: string }>;
}

export interface UserMetrics {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  usersByRole: Record<UserRole, number>;
  recentSignups: number;
  averageSessionDuration: number;
  mfaAdoptionRate: number;
}

export class UserManagementService extends EventEmitter {
  private auditService: AuditService;
  private cacheService: CacheService;
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly MAX_BULK_SIZE = 1000;

  constructor() {
    super();
    this.auditService = new AuditService();
    this.cacheService = new CacheService();
  }

  /**
   * Create a new user with proper validation and security
   */
  async createUser(input: UserCreateInput, createdBy: string): Promise<User> {
    try {
      // Validate input
      await this.validateUserInput(input);

      // Check for duplicates
      const existing = await prisma.user.findFirst({
        where: {
          OR: [
            { email: input.email },
            { username: input.username }
          ]
        }
      });

      if (existing) {
        throw new Error('User with this email or username already exists');
      }

      // Hash password if provided
      let hashedPassword: string | undefined;
      if (input.password) {
        hashedPassword = await bcrypt.hash(input.password, 12);
      }

      // Create user with transaction
      const user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            id: uuidv4(),
            email: input.email.toLowerCase(),
            name: input.name,
            username: input.username?.toLowerCase(),
            password: hashedPassword,
            role: input.role,
            isActive: input.isActive ?? true,
            provider: 'local',
            providerId: uuidv4(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });

        // Add to teams if specified
        if (input.teamIds && input.teamIds.length > 0) {
          await tx.teamMember.createMany({
            data: input.teamIds.map(teamId => ({
              userId: newUser.id,
              teamId,
              role: 'MEMBER'
            }))
          });
        }

        // Audit log
        await this.auditService.log({
          action: 'USER_CREATE',
          userId: createdBy,
          targetId: newUser.id,
          details: {
            email: newUser.email,
            role: newUser.role,
            teams: input.teamIds
          }
        });

        return newUser;
      });

      // Emit event
      this.emit('user:created', user);

      // Clear cache
      await this.cacheService.delete('users:metrics');

      return user;
    } catch (error) {
      console.error('Failed to create user:', error);
      throw error;
    }
  }

  /**
   * Update user with validation and audit
   */
  async updateUser(
    userId: string,
    input: UserUpdateInput,
    updatedBy: string
  ): Promise<User> {
    try {
      const existingUser = await this.getUserById(userId);
      if (!existingUser) {
        throw new Error('User not found');
      }

      // Validate changes
      if (input.email && input.email !== existingUser.email) {
        const emailExists = await prisma.user.findUnique({
          where: { email: input.email }
        });
        if (emailExists) {
          throw new Error('Email already in use');
        }
      }

      // Update user with transaction
      const updatedUser = await prisma.$transaction(async (tx) => {
        const user = await tx.user.update({
          where: { id: userId },
          data: {
            email: input.email?.toLowerCase(),
            name: input.name,
            username: input.username?.toLowerCase(),
            role: input.role,
            isActive: input.isActive,
            mfaEnabled: input.mfaEnabled,
            updatedAt: new Date()
          }
        });

        // Update team memberships if specified
        if (input.teamIds !== undefined) {
          // Remove existing memberships
          await tx.teamMember.deleteMany({
            where: { userId }
          });

          // Add new memberships
          if (input.teamIds.length > 0) {
            await tx.teamMember.createMany({
              data: input.teamIds.map(teamId => ({
                userId,
                teamId,
                role: 'MEMBER'
              }))
            });
          }
        }

        // Audit log
        await this.auditService.log({
          action: 'USER_UPDATE',
          userId: updatedBy,
          targetId: userId,
          details: {
            changes: input,
            previousValues: {
              email: existingUser.email,
              role: existingUser.role,
              isActive: existingUser.isActive
            }
          }
        });

        return user;
      });

      // Emit event
      this.emit('user:updated', updatedUser);

      // Clear cache
      await this.cacheService.delete(`user:${userId}`);
      await this.cacheService.delete('users:metrics');

      return updatedUser;
    } catch (error) {
      console.error('Failed to update user:', error);
      throw error;
    }
  }

  /**
   * Delete user with proper cleanup
   */
  async deleteUser(userId: string, deletedBy: string): Promise<void> {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Soft delete with transaction
      await prisma.$transaction(async (tx) => {
        // Mark user as inactive
        await tx.user.update({
          where: { id: userId },
          data: {
            isActive: false,
            updatedAt: new Date()
          }
        });

        // Remove from teams
        await tx.teamMember.deleteMany({
          where: { userId }
        });

        // Invalidate sessions
        await tx.session.updateMany({
          where: { userId },
          data: { isActive: false }
        });

        // Audit log
        await this.auditService.log({
          action: 'USER_DELETE',
          userId: deletedBy,
          targetId: userId,
          details: {
            email: user.email,
            role: user.role
          }
        });
      });

      // Emit event
      this.emit('user:deleted', user);

      // Clear cache
      await this.cacheService.delete(`user:${userId}`);
      await this.cacheService.delete('users:metrics');
    } catch (error) {
      console.error('Failed to delete user:', error);
      throw error;
    }
  }

  /**
   * Search users with advanced filtering
   */
  async searchUsers(params: UserSearchParams): Promise<{
    users: User[];
    total: number;
    page: number;
    pages: number;
  }> {
    try {
      const {
        query,
        role,
        teamId,
        isActive,
        createdAfter,
        createdBefore,
        lastLoginAfter,
        lastLoginBefore,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = params;

      // Build where clause
      const where: Prisma.UserWhereInput = {
        AND: [
          query ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
              { username: { contains: query, mode: 'insensitive' } }
            ]
          } : {},
          role ? { role } : {},
          isActive !== undefined ? { isActive } : {},
          teamId ? {
            teamMemberships: {
              some: { teamId }
            }
          } : {},
          createdAfter ? { createdAt: { gte: createdAfter } } : {},
          createdBefore ? { createdAt: { lte: createdBefore } } : {},
          lastLoginAfter ? { lastLogin: { gte: lastLoginAfter } } : {},
          lastLoginBefore ? { lastLogin: { lte: lastLoginBefore } } : {}
        ]
      };

      // Get total count
      const total = await prisma.user.count({ where });

      // Get users with pagination
      const users = await prisma.user.findMany({
        where,
        include: {
          teamMemberships: {
            include: {
              team: true
            }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit
      });

      return {
        users,
        total,
        page,
        pages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Failed to search users:', error);
      throw error;
    }
  }

  /**
   * Bulk create users
   */
  async bulkCreateUsers(
    users: UserCreateInput[],
    createdBy: string
  ): Promise<BulkOperationResult> {
    if (users.length > this.MAX_BULK_SIZE) {
      throw new Error(`Cannot process more than ${this.MAX_BULK_SIZE} users at once`);
    }

    const result: BulkOperationResult = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const userInput of users) {
      try {
        await this.createUser(userInput, createdBy);
        result.success++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({
          userId: userInput.email,
          error: error.message
        });
      }
    }

    return result;
  }

  /**
   * Bulk update users
   */
  async bulkUpdateUsers(
    updates: Array<{ userId: string; update: UserUpdateInput }>,
    updatedBy: string
  ): Promise<BulkOperationResult> {
    if (updates.length > this.MAX_BULK_SIZE) {
      throw new Error(`Cannot process more than ${this.MAX_BULK_SIZE} users at once`);
    }

    const result: BulkOperationResult = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const { userId, update } of updates) {
      try {
        await this.updateUser(userId, update, updatedBy);
        result.success++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({
          userId,
          error: error.message
        });
      }
    }

    return result;
  }

  /**
   * Bulk delete users
   */
  async bulkDeleteUsers(
    userIds: string[],
    deletedBy: string
  ): Promise<BulkOperationResult> {
    if (userIds.length > this.MAX_BULK_SIZE) {
      throw new Error(`Cannot process more than ${this.MAX_BULK_SIZE} users at once`);
    }

    const result: BulkOperationResult = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const userId of userIds) {
      try {
        await this.deleteUser(userId, deletedBy);
        result.success++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({
          userId,
          error: error.message
        });
      }
    }

    return result;
  }

  /**
   * Get user by ID with caching
   */
  async getUserById(userId: string): Promise<User | null> {
    const cacheKey = `user:${userId}`;
    
    // Check cache
    const cached = await this.cacheService.get<User>(cacheKey);
    if (cached) {
      return cached;
    }

    // Get from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        teamMemberships: {
          include: {
            team: true
          }
        }
      }
    });

    if (user) {
      // Cache result
      await this.cacheService.set(cacheKey, user, this.CACHE_TTL);
    }

    return user;
  }

  /**
   * Get user metrics
   */
  async getUserMetrics(): Promise<UserMetrics> {
    const cacheKey = 'users:metrics';
    
    // Check cache
    const cached = await this.cacheService.get<UserMetrics>(cacheKey);
    if (cached) {
      return cached;
    }

    // Calculate metrics
    const [
      totalUsers,
      activeUsers,
      usersByRole,
      recentSignups,
      mfaUsers
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      this.getUsersByRole(),
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        }
      }),
      prisma.user.count({ where: { mfaEnabled: true } })
    ]);

    const metrics: UserMetrics = {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      usersByRole,
      recentSignups,
      averageSessionDuration: await this.calculateAverageSessionDuration(),
      mfaAdoptionRate: totalUsers > 0 ? (mfaUsers / totalUsers) * 100 : 0
    };

    // Cache result
    await this.cacheService.set(cacheKey, metrics, this.CACHE_TTL);

    return metrics;
  }

  /**
   * Reset user password
   */
  async resetUserPassword(
    userId: string,
    newPassword: string,
    resetBy: string
  ): Promise<void> {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      await prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
          updatedAt: new Date()
        }
      });

      // Invalidate all sessions
      await prisma.session.updateMany({
        where: { userId },
        data: { isActive: false }
      });

      // Audit log
      await this.auditService.log({
        action: 'PASSWORD_RESET',
        userId: resetBy,
        targetId: userId,
        details: {
          method: 'admin_reset'
        }
      });

      this.emit('user:password-reset', userId);
    } catch (error) {
      console.error('Failed to reset password:', error);
      throw error;
    }
  }

  /**
   * Lock/unlock user account
   */
  async toggleUserLock(
    userId: string,
    lock: boolean,
    actionBy: string
  ): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          isActive: !lock,
          updatedAt: new Date()
        }
      });

      if (lock) {
        // Invalidate all sessions
        await prisma.session.updateMany({
          where: { userId },
          data: { isActive: false }
        });
      }

      // Audit log
      await this.auditService.log({
        action: lock ? 'USER_LOCK' : 'USER_UNLOCK',
        userId: actionBy,
        targetId: userId,
        details: {}
      });

      this.emit(lock ? 'user:locked' : 'user:unlocked', userId);
    } catch (error) {
      console.error('Failed to toggle user lock:', error);
      throw error;
    }
  }

  /**
   * Validate user input
   */
  private async validateUserInput(input: UserCreateInput): Promise<void> {
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.email)) {
      throw new Error('Invalid email format');
    }

    // Username validation (if provided)
    if (input.username) {
      const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
      if (!usernameRegex.test(input.username)) {
        throw new Error('Username must be 3-30 characters and contain only letters, numbers, underscores, and hyphens');
      }
    }

    // Password validation (if provided)
    if (input.password) {
      if (input.password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }
      // Additional password strength checks can be added here
    }

    // Name validation
    if (input.name.length < 2 || input.name.length > 100) {
      throw new Error('Name must be between 2 and 100 characters');
    }
  }

  /**
   * Get users by role
   */
  private async getUsersByRole(): Promise<Record<UserRole, number>> {
    const counts = await prisma.user.groupBy({
      by: ['role'],
      _count: true
    });

    const result: Partial<Record<UserRole, number>> = {};
    for (const { role, _count } of counts) {
      result[role] = _count;
    }

    // Ensure all roles are represented
    const allRoles: UserRole[] = ['ADMIN', 'PLATFORM_ENGINEER', 'DEVELOPER', 'VIEWER'];
    for (const role of allRoles) {
      if (!result[role]) {
        result[role] = 0;
      }
    }

    return result as Record<UserRole, number>;
  }

  /**
   * Calculate average session duration
   */
  private async calculateAverageSessionDuration(): Promise<number> {
    const sessions = await prisma.session.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      },
      select: {
        createdAt: true,
        expiresAt: true
      }
    });

    if (sessions.length === 0) return 0;

    const durations = sessions.map(s => 
      s.expiresAt.getTime() - s.createdAt.getTime()
    );

    return durations.reduce((a, b) => a + b, 0) / durations.length / 1000 / 60; // Minutes
  }
}