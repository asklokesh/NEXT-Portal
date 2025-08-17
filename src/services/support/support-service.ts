/**
 * Support Ticketing System Service
 * 
 * Multi-channel support system with:
 * - Multi-channel support (email, chat, in-app)
 * - SLA management and escalation
 * - Knowledge base integration
 * - Automated ticket routing
 * - Customer satisfaction surveys
 */

import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { EventEmitter } from 'events';

const prisma = new PrismaClient();

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  userId: string;
  channel: 'EMAIL' | 'CHAT' | 'IN_APP' | 'PHONE' | 'SOCIAL' | 'API';
  category: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'CRITICAL';
  status: string;
  subject: string;
  description: string;
  slaLevel?: string;
  slaResponseTime?: number;
  slaResolveTime?: number;
  assignedTo?: string;
  assignedTeam?: string;
  escalationLevel: number;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  closedAt?: Date;
}

const createTicketSchema = z.object({
  channel: z.enum(['EMAIL', 'CHAT', 'IN_APP', 'PHONE', 'SOCIAL', 'API']),
  category: z.enum(['TECHNICAL', 'BILLING', 'ACCOUNT', 'FEATURE_REQUEST', 'INTEGRATION', 'SECURITY', 'OTHER']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL']).default('MEDIUM'),
  subject: z.string().min(5).max(200),
  description: z.string().min(10).max(5000),
  accountId: z.string().optional(),
  externalId: z.string().optional(),
  attachments: z.array(z.object({
    fileName: z.string(),
    fileUrl: z.string(),
    fileSize: z.number(),
    mimeType: z.string()
  })).default([])
});

const updateTicketSchema = z.object({
  status: z.enum(['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'WAITING_INTERNAL', 'ESCALATED', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL']).optional(),
  assignedTo: z.string().optional(),
  assignedTeam: z.string().optional(),
  category: z.enum(['TECHNICAL', 'BILLING', 'ACCOUNT', 'FEATURE_REQUEST', 'INTEGRATION', 'SECURITY', 'OTHER']).optional()
});

const addMessageSchema = z.object({
  message: z.string().min(1).max(5000),
  isInternal: z.boolean().default(false),
  attachments: z.array(z.object({
    fileName: z.string(),
    fileUrl: z.string(),
    fileSize: z.number(),
    mimeType: z.string()
  })).default([])
});

export class SupportService extends EventEmitter {
  private slaLevels = {
    'bronze': { responseTime: 24 * 60, resolveTime: 72 * 60 }, // hours to minutes
    'silver': { responseTime: 8 * 60, resolveTime: 24 * 60 },
    'gold': { responseTime: 4 * 60, resolveTime: 12 * 60 },
    'platinum': { responseTime: 2 * 60, resolveTime: 6 * 60 }
  };

  constructor() {
    super();
    this.setupAutomatedProcesses();
  }

  /**
   * Create new support ticket
   */
  async createTicket(
    userId: string,
    data: z.infer<typeof createTicketSchema>
  ): Promise<SupportTicket> {
    try {
      const validatedData = createTicketSchema.parse(data);
      
      // Generate unique ticket number
      const ticketNumber = await this.generateTicketNumber();
      
      // Determine SLA level based on user/account
      const slaLevel = await this.determineSlaLevel(userId, validatedData.accountId);
      const slaConfig = this.slaLevels[slaLevel as keyof typeof this.slaLevels];
      
      // Auto-categorize and prioritize based on content
      const { category, priority } = await this.autoCategorizePrioritize(
        validatedData.subject + ' ' + validatedData.description,
        validatedData.category,
        validatedData.priority
      );

      // Create ticket
      const ticket = await prisma.supportTicket.create({
        data: {
          ticketNumber,
          userId,
          channel: validatedData.channel,
          category,
          priority,
          status: 'NEW',
          subject: validatedData.subject,
          description: validatedData.description,
          accountId: validatedData.accountId,
          slaLevel,
          slaResponseTime: slaConfig.responseTime,
          slaResolveTime: slaConfig.resolveTime,
          externalId: validatedData.externalId,
          escalationLevel: 0
        }
      });

      // Create attachments
      if (validatedData.attachments.length > 0) {
        await prisma.ticketAttachment.createMany({
          data: validatedData.attachments.map(att => ({
            ticketId: ticket.id,
            fileName: att.fileName,
            fileUrl: att.fileUrl,
            fileSize: att.fileSize,
            mimeType: att.mimeType
          }))
        });
      }

      // Auto-assign ticket
      const assignedAgent = await this.autoAssignTicket(ticket);
      if (assignedAgent) {
        await this.updateTicket(ticket.id, assignedAgent, {
          assignedTo: assignedAgent.agentId,
          assignedTeam: assignedAgent.teamId,
          status: 'OPEN'
        });
      }

      // Send automated response
      await this.sendAutomatedResponse(ticket.id, category);

      // Log activity
      await this.logActivity(ticket.id, userId, 'CREATED', {
        ticketNumber,
        priority,
        category
      });

      this.emit('ticketCreated', ticket);
      return ticket as any;
    } catch (error) {
      console.error('Error creating support ticket:', error);
      throw new Error('Failed to create support ticket');
    }
  }

  /**
   * Update ticket
   */
  async updateTicket(
    ticketId: string,
    updatedBy: string,
    data: z.infer<typeof updateTicketSchema>
  ): Promise<SupportTicket> {
    try {
      const validatedData = updateTicketSchema.parse(data);
      
      const currentTicket = await prisma.supportTicket.findUnique({
        where: { id: ticketId }
      });

      if (!currentTicket) {
        throw new Error('Ticket not found');
      }

      const updateData: any = { ...validatedData };
      
      // Handle status changes
      if (validatedData.status) {
        if (validatedData.status === 'RESOLVED') {
          updateData.resolvedAt = new Date();
        } else if (validatedData.status === 'CLOSED') {
          updateData.closedAt = new Date();
        }
        
        // Handle first response
        if (currentTicket.status === 'NEW' && !currentTicket.respondedAt) {
          updateData.respondedAt = new Date();
        }
      }

      const updatedTicket = await prisma.supportTicket.update({
        where: { id: ticketId },
        data: updateData
      });

      // Log activity
      await this.logActivity(ticketId, updatedBy, 'UPDATED', {
        changes: validatedData
      });

      // Check for SLA violations
      await this.checkSlaViolations(updatedTicket);

      this.emit('ticketUpdated', updatedTicket);
      return updatedTicket as any;
    } catch (error) {
      console.error('Error updating ticket:', error);
      throw new Error('Failed to update ticket');
    }
  }

  /**
   * Add message to ticket
   */
  async addMessage(
    ticketId: string,
    senderId: string,
    senderType: 'CUSTOMER' | 'AGENT' | 'SYSTEM',
    data: z.infer<typeof addMessageSchema>
  ) {
    try {
      const validatedData = addMessageSchema.parse(data);

      const message = await prisma.ticketMessage.create({
        data: {
          ticketId,
          senderId,
          senderType,
          message: validatedData.message,
          isInternal: validatedData.isInternal
        }
      });

      // Create attachments
      if (validatedData.attachments.length > 0) {
        await prisma.ticketAttachment.createMany({
          data: validatedData.attachments.map(att => ({
            ticketId,
            fileName: att.fileName,
            fileUrl: att.fileUrl,
            fileSize: att.fileSize,
            mimeType: att.mimeType
          }))
        });
      }

      // Update ticket status if customer replied
      if (senderType === 'CUSTOMER') {
        await prisma.supportTicket.update({
          where: { id: ticketId },
          data: {
            status: 'OPEN',
            updatedAt: new Date()
          }
        });
      }

      // Mark as responded if agent replied
      if (senderType === 'AGENT' && !validatedData.isInternal) {
        const ticket = await prisma.supportTicket.findUnique({
          where: { id: ticketId }
        });

        if (ticket && !ticket.respondedAt) {
          await prisma.supportTicket.update({
            where: { id: ticketId },
            data: { respondedAt: new Date() }
          });
        }
      }

      // Log activity
      await this.logActivity(ticketId, senderId, 'MESSAGE_ADDED', {
        messageType: senderType,
        isInternal: validatedData.isInternal
      });

      this.emit('messageAdded', { ticketId, message });
      return message;
    } catch (error) {
      console.error('Error adding message:', error);
      throw new Error('Failed to add message');
    }
  }

  /**
   * Get ticket by ID or number
   */
  async getTicket(identifier: string, includeMessages = true) {
    try {
      const isTicketNumber = identifier.startsWith('TKT-');
      
      const ticket = await prisma.supportTicket.findFirst({
        where: isTicketNumber ? { ticketNumber: identifier } : { id: identifier },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatar: true }
          },
          messages: includeMessages ? {
            orderBy: { createdAt: 'asc' },
            include: {
              // Would need user lookup for senderId
            }
          } : false,
          attachments: true,
          activities: {
            take: 10,
            orderBy: { createdAt: 'desc' }
          },
          satisfaction: true,
          escalations: {
            orderBy: { escalatedAt: 'desc' }
          }
        }
      });

      return ticket;
    } catch (error) {
      console.error('Error fetching ticket:', error);
      throw new Error('Failed to fetch ticket');
    }
  }

  /**
   * Get tickets with filtering
   */
  async getTickets(params: {
    userId?: string;
    assignedTo?: string;
    assignedTeam?: string;
    status?: string[];
    priority?: string[];
    category?: string[];
    channel?: string[];
    slaLevel?: string[];
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: 'created' | 'updated' | 'priority' | 'status';
    sortOrder?: 'asc' | 'desc';
    overdueSla?: boolean;
  }) {
    try {
      const {
        userId,
        assignedTo,
        assignedTeam,
        status = [],
        priority = [],
        category = [],
        channel = [],
        slaLevel = [],
        search,
        page = 1,
        limit = 20,
        sortBy = 'created',
        sortOrder = 'desc',
        overdueSla = false
      } = params;

      const where: any = {};
      
      if (userId) where.userId = userId;
      if (assignedTo) where.assignedTo = assignedTo;
      if (assignedTeam) where.assignedTeam = assignedTeam;
      if (status.length) where.status = { in: status };
      if (priority.length) where.priority = { in: priority };
      if (category.length) where.category = { in: category };
      if (channel.length) where.channel = { in: channel };
      if (slaLevel.length) where.slaLevel = { in: slaLevel };
      
      if (search) {
        where.OR = [
          { ticketNumber: { contains: search, mode: 'insensitive' } },
          { subject: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ];
      }

      // SLA overdue filter
      if (overdueSla) {
        const now = new Date();
        where.AND = [
          { respondedAt: null },
          { 
            createdAt: {
              lt: new Date(now.getTime() - (2 * 60 * 60 * 1000)) // 2 hours ago as example
            }
          }
        ];
      }

      const orderBy: any = {};
      if (sortBy === 'created') orderBy.createdAt = sortOrder;
      else if (sortBy === 'updated') orderBy.updatedAt = sortOrder;
      else if (sortBy === 'priority') orderBy.priority = sortOrder;
      else if (sortBy === 'status') orderBy.status = sortOrder;

      const [tickets, total] = await Promise.all([
        prisma.supportTicket.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true }
            },
            _count: {
              select: { messages: true }
            }
          }
        }),
        prisma.supportTicket.count({ where })
      ]);

      return {
        tickets,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error fetching tickets:', error);
      throw new Error('Failed to fetch tickets');
    }
  }

  /**
   * Escalate ticket
   */
  async escalateTicket(
    ticketId: string,
    reason: string,
    escalatedBy: string
  ) {
    try {
      const ticket = await prisma.supportTicket.findUnique({
        where: { id: ticketId }
      });

      if (!ticket) {
        throw new Error('Ticket not found');
      }

      const newLevel = ticket.escalationLevel + 1;

      // Create escalation record
      await prisma.ticketEscalation.create({
        data: {
          ticketId,
          fromLevel: ticket.escalationLevel,
          toLevel: newLevel,
          reason,
          escalatedBy
        }
      });

      // Update ticket
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: {
          status: 'ESCALATED',
          escalationLevel: newLevel,
          priority: this.escalatePriority(ticket.priority),
          updatedAt: new Date()
        }
      });

      // Reassign to higher tier team
      const newAssignment = await this.getEscalationTeam(newLevel);
      if (newAssignment) {
        await this.updateTicket(ticketId, escalatedBy, {
          assignedTo: newAssignment.agentId,
          assignedTeam: newAssignment.teamId
        });
      }

      // Log activity
      await this.logActivity(ticketId, escalatedBy, 'ESCALATED', {
        reason,
        fromLevel: ticket.escalationLevel,
        toLevel: newLevel
      });

      this.emit('ticketEscalated', { ticketId, level: newLevel, reason });
    } catch (error) {
      console.error('Error escalating ticket:', error);
      throw new Error('Failed to escalate ticket');
    }
  }

  /**
   * Submit customer satisfaction survey
   */
  async submitSatisfactionSurvey(
    ticketId: string,
    rating: number,
    feedback?: string
  ) {
    try {
      if (rating < 1 || rating > 5) {
        throw new Error('Rating must be between 1 and 5');
      }

      const satisfaction = await prisma.ticketSatisfaction.create({
        data: {
          ticketId,
          rating,
          feedback
        }
      });

      // Update ticket status to closed if not already
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: {
          status: 'CLOSED',
          closedAt: new Date()
        }
      });

      this.emit('satisfactionSubmitted', { ticketId, rating, feedback });
      return satisfaction;
    } catch (error) {
      console.error('Error submitting satisfaction survey:', error);
      throw new Error('Failed to submit satisfaction survey');
    }
  }

  /**
   * Get support analytics
   */
  async getAnalytics(timeframe: '7d' | '30d' | '90d' = '30d') {
    try {
      const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const [
        totalTickets,
        resolvedTickets,
        avgResponseTime,
        avgResolutionTime,
        byStatus,
        byPriority,
        byCategory,
        byChannel,
        satisfactionStats,
        slaCompliance
      ] = await Promise.all([
        prisma.supportTicket.count({
          where: { createdAt: { gte: since } }
        }),
        prisma.supportTicket.count({
          where: {
            createdAt: { gte: since },
            status: { in: ['RESOLVED', 'CLOSED'] }
          }
        }),
        this.calculateAvgResponseTime(since),
        this.calculateAvgResolutionTime(since),
        prisma.supportTicket.groupBy({
          by: ['status'],
          where: { createdAt: { gte: since } },
          _count: { id: true }
        }),
        prisma.supportTicket.groupBy({
          by: ['priority'],
          where: { createdAt: { gte: since } },
          _count: { id: true }
        }),
        prisma.supportTicket.groupBy({
          by: ['category'],
          where: { createdAt: { gte: since } },
          _count: { id: true }
        }),
        prisma.supportTicket.groupBy({
          by: ['channel'],
          where: { createdAt: { gte: since } },
          _count: { id: true }
        }),
        this.getSatisfactionStats(since),
        this.getSlaCompliance(since)
      ]);

      return {
        totalTickets,
        resolvedTickets,
        resolutionRate: totalTickets > 0 ? (resolvedTickets / totalTickets) * 100 : 0,
        avgResponseTime,
        avgResolutionTime,
        breakdown: {
          byStatus,
          byPriority,
          byCategory,
          byChannel
        },
        satisfaction: satisfactionStats,
        sla: slaCompliance
      };
    } catch (error) {
      console.error('Error generating support analytics:', error);
      throw new Error('Failed to generate support analytics');
    }
  }

  // Private helper methods

  private async generateTicketNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear().toString().substr(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    
    const count = await prisma.supportTicket.count({
      where: {
        ticketNumber: {
          startsWith: `TKT-${year}${month}`
        }
      }
    });

    return `TKT-${year}${month}${(count + 1).toString().padStart(4, '0')}`;
  }

  private async determineSlaLevel(userId: string, accountId?: string): Promise<string> {
    // This would typically check user's subscription tier or account type
    // For now, return default
    return 'silver';
  }

  private async autoCategorizePrioritize(
    content: string,
    suggestedCategory: string,
    suggestedPriority: string
  ): Promise<{ category: string; priority: string }> {
    const lowerContent = content.toLowerCase();
    
    // Auto-escalate critical keywords
    const criticalKeywords = ['down', 'outage', 'critical', 'urgent', 'security breach'];
    const highKeywords = ['error', 'bug', 'issue', 'problem', 'not working'];
    
    let priority = suggestedPriority;
    
    if (criticalKeywords.some(keyword => lowerContent.includes(keyword))) {
      priority = 'CRITICAL';
    } else if (highKeywords.some(keyword => lowerContent.includes(keyword))) {
      priority = 'HIGH';
    }

    return { category: suggestedCategory, priority };
  }

  private async autoAssignTicket(ticket: any): Promise<{ agentId: string; teamId: string } | null> {
    // This would implement intelligent routing based on:
    // - Category expertise
    // - Agent workload
    // - SLA level
    // - Language/timezone
    
    // Mock implementation
    const teams = {
      'TECHNICAL': 'tech-team',
      'BILLING': 'billing-team',
      'ACCOUNT': 'account-team'
    };

    const teamId = teams[ticket.category as keyof typeof teams] || 'general-team';
    
    return {
      agentId: 'auto-assigned-agent',
      teamId
    };
  }

  private async sendAutomatedResponse(ticketId: string, category: string) {
    try {
      const template = await prisma.automatedResponse.findFirst({
        where: {
          category,
          isActive: true
        }
      });

      if (template) {
        await this.addMessage(ticketId, 'system', 'SYSTEM', {
          message: template.response,
          isInternal: false
        });

        // Update usage count
        await prisma.automatedResponse.update({
          where: { id: template.id },
          data: { usageCount: { increment: 1 } }
        });
      }
    } catch (error) {
      console.error('Error sending automated response:', error);
    }
  }

  private async logActivity(
    ticketId: string,
    userId: string,
    action: string,
    details?: any
  ) {
    try {
      await prisma.ticketActivity.create({
        data: {
          ticketId,
          userId,
          action,
          details
        }
      });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }

  private async checkSlaViolations(ticket: any) {
    const now = new Date();
    
    // Check response SLA
    if (!ticket.respondedAt && ticket.slaResponseTime) {
      const responseDeadline = new Date(
        ticket.createdAt.getTime() + (ticket.slaResponseTime * 60 * 1000)
      );
      
      if (now > responseDeadline) {
        this.emit('slaViolation', {
          ticketId: ticket.id,
          type: 'RESPONSE',
          deadline: responseDeadline
        });
      }
    }

    // Check resolution SLA
    if (!ticket.resolvedAt && ticket.slaResolveTime) {
      const resolveDeadline = new Date(
        ticket.createdAt.getTime() + (ticket.slaResolveTime * 60 * 1000)
      );
      
      if (now > resolveDeadline) {
        this.emit('slaViolation', {
          ticketId: ticket.id,
          type: 'RESOLUTION',
          deadline: resolveDeadline
        });
      }
    }
  }

  private escalatePriority(currentPriority: string): string {
    const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL'];
    const currentIndex = priorities.indexOf(currentPriority);
    return priorities[Math.min(currentIndex + 1, priorities.length - 1)];
  }

  private async getEscalationTeam(level: number): Promise<{ agentId: string; teamId: string } | null> {
    // Mock escalation team assignment
    const escalationTeams = {
      1: { agentId: 'senior-agent-1', teamId: 'senior-team' },
      2: { agentId: 'manager-1', teamId: 'management-team' },
      3: { agentId: 'director-1', teamId: 'executive-team' }
    };

    return escalationTeams[level as keyof typeof escalationTeams] || null;
  }

  private setupAutomatedProcesses() {
    // Setup periodic checks for SLA violations, auto-escalation, etc.
    setInterval(() => {
      this.checkOverdueTickets();
    }, 15 * 60 * 1000); // Check every 15 minutes
  }

  private async checkOverdueTickets() {
    try {
      const now = new Date();
      
      // Find tickets approaching SLA deadlines
      const overdueTickets = await prisma.supportTicket.findMany({
        where: {
          status: { in: ['NEW', 'OPEN', 'IN_PROGRESS'] },
          OR: [
            {
              respondedAt: null,
              createdAt: {
                lt: new Date(now.getTime() - (2 * 60 * 60 * 1000)) // 2 hours
              }
            }
          ]
        }
      });

      for (const ticket of overdueTickets) {
        this.emit('ticketOverdue', ticket);
      }
    } catch (error) {
      console.error('Error checking overdue tickets:', error);
    }
  }

  private async calculateAvgResponseTime(since: Date): Promise<number> {
    // Implementation would calculate average time from creation to first response
    return 240; // Mock: 4 hours in minutes
  }

  private async calculateAvgResolutionTime(since: Date): Promise<number> {
    // Implementation would calculate average time from creation to resolution
    return 1440; // Mock: 24 hours in minutes
  }

  private async getSatisfactionStats(since: Date) {
    const stats = await prisma.ticketSatisfaction.aggregate({
      where: {
        respondedAt: { gte: since }
      },
      _avg: { rating: true },
      _count: { rating: true }
    });

    return {
      avgRating: stats._avg.rating || 0,
      totalResponses: stats._count.rating
    };
  }

  private async getSlaCompliance(since: Date) {
    // Mock SLA compliance calculation
    return {
      responseCompliance: 85, // percentage
      resolutionCompliance: 78 // percentage
    };
  }
}

export const supportService = new SupportService();