/**
 * Customer Feedback System Service
 * 
 * Comprehensive feedback management system with:
 * - In-app feedback widget with screenshots
 * - Feature request portal with voting
 * - Bug reporting with automatic metadata
 * - Roadmap visibility and transparency
 * - Customer advisory board management
 */

import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { EventEmitter } from 'events';

const prisma = new PrismaClient();

export interface FeedbackCapture {
  screenshot?: string;
  browserInfo: {
    userAgent: string;
    viewport: { width: number; height: number };
    url: string;
    timestamp: string;
  };
  systemInfo?: {
    platform: string;
    memory?: number;
    connection?: string;
  };
}

export interface FeedbackItem {
  id: string;
  type: 'BUG' | 'FEATURE_REQUEST' | 'IMPROVEMENT' | 'QUESTION' | 'COMPLAINT';
  category: string;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'CRITICAL';
  status: string;
  votes: number;
  screenshot?: string;
  metadata?: FeedbackCapture;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

const createFeedbackSchema = z.object({
  type: z.enum(['BUG', 'FEATURE_REQUEST', 'IMPROVEMENT', 'QUESTION', 'COMPLAINT']),
  category: z.enum(['UI_UX', 'PERFORMANCE', 'FUNCTIONALITY', 'DOCUMENTATION', 'INTEGRATION', 'SECURITY', 'OTHER']),
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(5000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL']).default('MEDIUM'),
  screenshot: z.string().optional(),
  metadata: z.object({
    browserInfo: z.object({
      userAgent: z.string(),
      viewport: z.object({
        width: z.number(),
        height: z.number()
      }),
      url: z.string(),
      timestamp: z.string()
    }),
    systemInfo: z.object({
      platform: z.string(),
      memory: z.number().optional(),
      connection: z.string().optional()
    }).optional()
  }).optional(),
  tags: z.array(z.string()).default([])
});

export class FeedbackService extends EventEmitter {
  constructor() {
    super();
  }

  /**
   * Submit new feedback with automatic metadata capture
   */
  async submitFeedback(
    userId: string,
    data: z.infer<typeof createFeedbackSchema>
  ): Promise<FeedbackItem> {
    try {
      const validatedData = createFeedbackSchema.parse(data);
      
      // Auto-categorize based on keywords
      const autoCategory = await this.categorizeFeedback(
        validatedData.title + ' ' + validatedData.description
      );
      
      // Create feedback item
      const feedbackItem = await prisma.feedbackItem.create({
        data: {
          userId,
          type: validatedData.type,
          category: validatedData.category,
          title: validatedData.title,
          description: validatedData.description,
          priority: validatedData.priority,
          status: 'OPEN',
          visibility: 'PUBLIC',
          screenshot: validatedData.screenshot,
          screenData: validatedData.metadata as any,
          tags: {
            create: validatedData.tags.map(tag => ({ tag }))
          }
        },
        include: {
          user: true,
          tags: true,
          userVotes: true
        }
      });

      // Auto-assign to product team if high priority
      if (validatedData.priority === 'HIGH' || validatedData.priority === 'URGENT') {
        await this.autoAssignToProductTeam(feedbackItem.id);
      }

      // Emit event for real-time updates
      this.emit('feedbackSubmitted', feedbackItem);

      return feedbackItem as any;
    } catch (error) {
      console.error('Error submitting feedback:', error);
      throw new Error('Failed to submit feedback');
    }
  }

  /**
   * Vote on feedback items
   */
  async voteFeedback(
    feedbackId: string,
    userId: string,
    voteType: 'UPVOTE' | 'DOWNVOTE'
  ): Promise<{ votes: number; userVote: string | null }> {
    try {
      // Check for existing vote
      const existingVote = await prisma.feedbackVote.findUnique({
        where: { feedbackId_userId: { feedbackId, userId } }
      });

      let voteChange = 0;

      if (existingVote) {
        if (existingVote.voteType === voteType) {
          // Remove vote
          await prisma.feedbackVote.delete({
            where: { id: existingVote.id }
          });
          voteChange = voteType === 'UPVOTE' ? -1 : 1;
        } else {
          // Change vote
          await prisma.feedbackVote.update({
            where: { id: existingVote.id },
            data: { voteType }
          });
          voteChange = voteType === 'UPVOTE' ? 2 : -2;
        }
      } else {
        // New vote
        await prisma.feedbackVote.create({
          data: { feedbackId, userId, voteType }
        });
        voteChange = voteType === 'UPVOTE' ? 1 : -1;
      }

      // Update vote count
      const updatedFeedback = await prisma.feedbackItem.update({
        where: { id: feedbackId },
        data: {
          votes: { increment: voteChange }
        },
        include: {
          userVotes: {
            where: { userId }
          }
        }
      });

      return {
        votes: updatedFeedback.votes,
        userVote: updatedFeedback.userVotes[0]?.voteType || null
      };
    } catch (error) {
      console.error('Error voting on feedback:', error);
      throw new Error('Failed to vote on feedback');
    }
  }

  /**
   * Get feedback with filtering and pagination
   */
  async getFeedback(params: {
    userId?: string;
    type?: string[];
    category?: string[];
    status?: string[];
    priority?: string[];
    tags?: string[];
    sortBy?: 'votes' | 'created' | 'updated';
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
    search?: string;
  }) {
    try {
      const {
        userId,
        type = [],
        category = [],
        status = [],
        priority = [],
        tags = [],
        sortBy = 'votes',
        sortOrder = 'desc',
        page = 1,
        limit = 20,
        search
      } = params;

      const where: any = {
        visibility: { not: 'INTERNAL' }
      };

      if (userId) where.userId = userId;
      if (type.length) where.type = { in: type };
      if (category.length) where.category = { in: category };
      if (status.length) where.status = { in: status };
      if (priority.length) where.priority = { in: priority };
      if (tags.length) {
        where.tags = {
          some: {
            tag: { in: tags }
          }
        };
      }
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ];
      }

      const orderBy: any = {};
      if (sortBy === 'votes') orderBy.votes = sortOrder;
      else if (sortBy === 'created') orderBy.createdAt = sortOrder;
      else if (sortBy === 'updated') orderBy.updatedAt = sortOrder;

      const [items, total] = await Promise.all([
        prisma.feedbackItem.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
          include: {
            user: {
              select: { id: true, name: true, avatar: true }
            },
            tags: true,
            userVotes: true,
            comments: {
              take: 5,
              orderBy: { createdAt: 'desc' },
              include: {
                user: {
                  select: { id: true, name: true, avatar: true }
                }
              }
            },
            _count: {
              select: { comments: true }
            }
          }
        }),
        prisma.feedbackItem.count({ where })
      ]);

      return {
        items,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error fetching feedback:', error);
      throw new Error('Failed to fetch feedback');
    }
  }

  /**
   * Add comment to feedback
   */
  async addComment(
    feedbackId: string,
    userId: string,
    content: string,
    isInternal = false
  ) {
    try {
      const comment = await prisma.feedbackComment.create({
        data: {
          feedbackId,
          userId,
          content,
          isInternal
        },
        include: {
          user: {
            select: { id: true, name: true, avatar: true }
          }
        }
      });

      this.emit('commentAdded', { feedbackId, comment });
      return comment;
    } catch (error) {
      console.error('Error adding comment:', error);
      throw new Error('Failed to add comment');
    }
  }

  /**
   * Update feedback status (admin only)
   */
  async updateFeedbackStatus(
    feedbackId: string,
    status: string,
    adminUserId: string,
    notes?: string
  ) {
    try {
      const updatedFeedback = await prisma.feedbackItem.update({
        where: { id: feedbackId },
        data: {
          status,
          updatedAt: new Date()
        },
        include: {
          user: true
        }
      });

      // Add internal comment if notes provided
      if (notes) {
        await this.addComment(feedbackId, adminUserId, notes, true);
      }

      // Notify user of status change
      this.emit('statusChanged', { feedbackId, status, feedback: updatedFeedback });

      return updatedFeedback;
    } catch (error) {
      console.error('Error updating feedback status:', error);
      throw new Error('Failed to update feedback status');
    }
  }

  /**
   * Get roadmap items with feedback integration
   */
  async getRoadmap() {
    try {
      const roadmapItems = await prisma.feedbackItem.groupBy({
        by: ['roadmapItem', 'releaseTarget'],
        where: {
          roadmapItem: { not: null },
          status: { in: ['PLANNED', 'IN_PROGRESS', 'COMPLETED'] }
        },
        _count: {
          id: true
        },
        _sum: {
          votes: true
        }
      });

      return roadmapItems.map(item => ({
        roadmapItem: item.roadmapItem,
        releaseTarget: item.releaseTarget,
        feedbackCount: item._count.id,
        totalVotes: item._sum.votes || 0
      }));
    } catch (error) {
      console.error('Error fetching roadmap:', error);
      throw new Error('Failed to fetch roadmap');
    }
  }

  /**
   * Manage customer advisory board
   */
  async getAdvisoryBoard() {
    try {
      return await prisma.customerAdvisoryBoard.findMany({
        where: { isActive: true },
        orderBy: { joinedAt: 'desc' }
      });
    } catch (error) {
      console.error('Error fetching advisory board:', error);
      throw new Error('Failed to fetch advisory board');
    }
  }

  /**
   * Auto-categorize feedback using keywords
   */
  private async categorizeFeedback(text: string): Promise<string> {
    const keywords = {
      'UI_UX': ['ui', 'ux', 'design', 'interface', 'layout', 'usability'],
      'PERFORMANCE': ['slow', 'fast', 'performance', 'speed', 'lag', 'loading'],
      'FUNCTIONALITY': ['feature', 'function', 'behavior', 'work', 'broken'],
      'DOCUMENTATION': ['docs', 'documentation', 'help', 'guide', 'tutorial'],
      'INTEGRATION': ['api', 'integration', 'connect', 'sync', 'webhook'],
      'SECURITY': ['security', 'auth', 'login', 'password', 'permission']
    };

    const lowerText = text.toLowerCase();
    
    for (const [category, terms] of Object.entries(keywords)) {
      if (terms.some(term => lowerText.includes(term))) {
        return category;
      }
    }

    return 'OTHER';
  }

  /**
   * Auto-assign high priority feedback to product team
   */
  private async autoAssignToProductTeam(feedbackId: string) {
    // Implementation would depend on team management system
    console.log(`Auto-assigning high priority feedback ${feedbackId} to product team`);
  }

  /**
   * Generate feedback analytics
   */
  async getAnalytics(timeframe: '7d' | '30d' | '90d' | '1y' = '30d') {
    try {
      const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : timeframe === '90d' ? 90 : 365;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const [
        totalFeedback,
        byType,
        byStatus,
        byPriority,
        topVoted,
        recentTrends
      ] = await Promise.all([
        prisma.feedbackItem.count({
          where: { createdAt: { gte: since } }
        }),
        prisma.feedbackItem.groupBy({
          by: ['type'],
          where: { createdAt: { gte: since } },
          _count: { id: true }
        }),
        prisma.feedbackItem.groupBy({
          by: ['status'],
          where: { createdAt: { gte: since } },
          _count: { id: true }
        }),
        prisma.feedbackItem.groupBy({
          by: ['priority'],
          where: { createdAt: { gte: since } },
          _count: { id: true }
        }),
        prisma.feedbackItem.findMany({
          where: { createdAt: { gte: since } },
          orderBy: { votes: 'desc' },
          take: 10,
          select: { id: true, title: true, votes: true, type: true }
        }),
        this.getTrendData(since)
      ]);

      return {
        totalFeedback,
        breakdown: {
          byType,
          byStatus,
          byPriority
        },
        topVoted,
        trends: recentTrends
      };
    } catch (error) {
      console.error('Error generating feedback analytics:', error);
      throw new Error('Failed to generate feedback analytics');
    }
  }

  /**
   * Get trend data for analytics
   */
  private async getTrendData(since: Date) {
    const trends = await prisma.feedbackItem.groupBy({
      by: ['createdAt'],
      where: { createdAt: { gte: since } },
      _count: { id: true }
    });

    // Group by day
    const dailyTrends: { [key: string]: number } = {};
    trends.forEach(trend => {
      const date = trend.createdAt.toISOString().split('T')[0];
      dailyTrends[date] = (dailyTrends[date] || 0) + trend._count.id;
    });

    return Object.entries(dailyTrends).map(([date, count]) => ({
      date,
      count
    }));
  }
}

export const feedbackService = new FeedbackService();