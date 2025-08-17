/**
 * Partner Portal Service
 * 
 * Comprehensive partner management system with:
 * - Reseller registration and onboarding
 * - Deal registration and protection
 * - Partner training and certification
 * - Co-marketing resources
 * - Revenue sharing and commissions
 */

import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { EventEmitter } from 'events';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

export interface Partner {
  id: string;
  companyName: string;
  companyWebsite?: string;
  partnerType: 'RESELLER' | 'REFERRAL' | 'TECHNOLOGY' | 'SERVICE_PROVIDER' | 'CONSULTANT';
  partnerTier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
  primaryContact: string;
  primaryEmail: string;
  country: string;
  certificationLevel?: string;
  commissionRate: number;
  createdAt: Date;
  updatedAt: Date;
  approvedAt?: Date;
}

const createPartnerSchema = z.object({
  companyName: z.string().min(2).max(100),
  companyWebsite: z.string().url().optional(),
  partnerType: z.enum(['RESELLER', 'REFERRAL', 'TECHNOLOGY', 'SERVICE_PROVIDER', 'CONSULTANT']),
  primaryContact: z.string().min(2).max(100),
  primaryEmail: z.string().email(),
  primaryPhone: z.string().optional(),
  technicalContact: z.string().optional(),
  technicalEmail: z.string().email().optional(),
  billingContact: z.string().optional(),
  billingEmail: z.string().email().optional(),
  taxId: z.string().optional(),
  address: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
    country: z.string()
  }),
  country: z.string(),
  currency: z.string().default('USD'),
  specializations: z.array(z.string()).default([]),
  territories: z.array(z.string()).default([]),
  requestedTier: z.enum(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']).default('BRONZE')
});

const createDealSchema = z.object({
  customerName: z.string().min(2).max(100),
  customerEmail: z.string().email(),
  customerCompany: z.string().min(2).max(100),
  dealValue: z.number().min(0),
  currency: z.string().default('USD'),
  probability: z.number().min(0).max(100),
  expectedClose: z.string().transform(str => new Date(str)),
  description: z.string().min(10).max(1000),
  competitors: z.array(z.string()).default([]),
  notes: z.string().optional()
});

const updateDealSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'WON', 'LOST', 'EXPIRED']).optional(),
  dealValue: z.number().min(0).optional(),
  probability: z.number().min(0).max(100).optional(),
  expectedClose: z.string().transform(str => new Date(str)).optional(),
  description: z.string().optional(),
  notes: z.string().optional()
});

export class PartnerService extends EventEmitter {
  private tierBenefits = {
    'BRONZE': { commissionRate: 0.15, protectionDays: 30, trainingAccess: 'basic' },
    'SILVER': { commissionRate: 0.20, protectionDays: 60, trainingAccess: 'intermediate' },
    'GOLD': { commissionRate: 0.25, protectionDays: 90, trainingAccess: 'advanced' },
    'PLATINUM': { commissionRate: 0.30, protectionDays: 120, trainingAccess: 'expert' }
  };

  constructor() {
    super();
    this.setupCommissionProcessing();
  }

  /**
   * Register new partner application
   */
  async registerPartner(
    data: z.infer<typeof createPartnerSchema>
  ): Promise<Partner> {
    try {
      const validatedData = createPartnerSchema.parse(data);
      
      // Check for duplicate email
      const existingPartner = await prisma.partner.findUnique({
        where: { primaryEmail: validatedData.primaryEmail }
      });
      
      if (existingPartner) {
        throw new Error('Partner with this email already exists');
      }

      // Determine initial tier and commission rate
      const tierBenefit = this.tierBenefits[validatedData.requestedTier];
      
      const partner = await prisma.partner.create({
        data: {
          companyName: validatedData.companyName,
          companyWebsite: validatedData.companyWebsite,
          partnerType: validatedData.partnerType,
          partnerTier: validatedData.requestedTier,
          status: 'PENDING',
          primaryContact: validatedData.primaryContact,
          primaryEmail: validatedData.primaryEmail,
          primaryPhone: validatedData.primaryPhone,
          technicalContact: validatedData.technicalContact,
          technicalEmail: validatedData.technicalEmail,
          billingContact: validatedData.billingContact,
          billingEmail: validatedData.billingEmail,
          taxId: validatedData.taxId,
          address: validatedData.address,
          country: validatedData.country,
          currency: validatedData.currency,
          specializations: validatedData.specializations,
          territories: validatedData.territories,
          commissionRate: tierBenefit.commissionRate
        }
      });

      // Start onboarding process
      await this.initiateOnboarding(partner.id);

      this.emit('partnerRegistered', partner);
      return partner as any;
    } catch (error) {
      console.error('Error registering partner:', error);
      throw new Error('Failed to register partner');
    }
  }

  /**
   * Approve partner application
   */
  async approvePartner(
    partnerId: string,
    approvedBy: string,
    tier?: string
  ): Promise<Partner> {
    try {
      const updateData: any = {
        status: 'ACTIVE',
        approvedAt: new Date()
      };

      if (tier) {
        const tierBenefit = this.tierBenefits[tier as keyof typeof this.tierBenefits];
        updateData.partnerTier = tier;
        updateData.commissionRate = tierBenefit.commissionRate;
      }

      const partner = await prisma.partner.update({
        where: { id: partnerId },
        data: updateData
      });

      // Setup partner resources and access
      await this.setupPartnerResources(partnerId);
      
      // Send welcome email and setup training
      await this.sendWelcomePackage(partner);

      this.emit('partnerApproved', partner);
      return partner as any;
    } catch (error) {
      console.error('Error approving partner:', error);
      throw new Error('Failed to approve partner');
    }
  }

  /**
   * Create deal registration
   */
  async createDealRegistration(
    partnerId: string,
    data: z.infer<typeof createDealSchema>
  ) {
    try {
      const validatedData = createDealSchema.parse(data);
      
      // Verify partner is active
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId, status: 'ACTIVE' }
      });
      
      if (!partner) {
        throw new Error('Partner not found or not active');
      }

      // Generate deal number
      const dealNumber = await this.generateDealNumber();
      
      // Calculate protection end date
      const tierBenefit = this.tierBenefits[partner.partnerTier];
      const protectionEnd = new Date(
        Date.now() + (tierBenefit.protectionDays * 24 * 60 * 60 * 1000)
      );

      const deal = await prisma.dealRegistration.create({
        data: {
          partnerId,
          dealNumber,
          customerName: validatedData.customerName,
          customerEmail: validatedData.customerEmail,
          customerCompany: validatedData.customerCompany,
          dealValue: new Decimal(validatedData.dealValue),
          currency: validatedData.currency,
          probability: validatedData.probability,
          expectedClose: validatedData.expectedClose,
          protectionEnd,
          description: validatedData.description,
          competitors: validatedData.competitors,
          notes: validatedData.notes,
          status: 'PENDING'
        }
      });

      // Check for conflicts with existing deals
      await this.checkDealConflicts(deal);

      this.emit('dealRegistered', { deal, partner });
      return deal;
    } catch (error) {
      console.error('Error creating deal registration:', error);
      throw new Error('Failed to create deal registration');
    }
  }

  /**
   * Update deal registration
   */
  async updateDealRegistration(
    dealId: string,
    partnerId: string,
    data: z.infer<typeof updateDealSchema>
  ) {
    try {
      const validatedData = updateDealSchema.parse(data);
      
      // Verify deal belongs to partner
      const existingDeal = await prisma.dealRegistration.findFirst({
        where: { id: dealId, partnerId }
      });
      
      if (!existingDeal) {
        throw new Error('Deal not found or access denied');
      }

      const updateData: any = { ...validatedData };
      
      // Handle status changes
      if (validatedData.status === 'WON') {
        updateData.closedAt = new Date();
        // Generate commission
        await this.generateCommission(dealId);
      } else if (validatedData.status === 'LOST') {
        updateData.closedAt = new Date();
      }

      const deal = await prisma.dealRegistration.update({
        where: { id: dealId },
        data: updateData
      });

      this.emit('dealUpdated', deal);
      return deal;
    } catch (error) {
      console.error('Error updating deal registration:', error);
      throw new Error('Failed to update deal registration');
    }
  }

  /**
   * Get partner deals
   */
  async getPartnerDeals(
    partnerId: string,
    params: {
      status?: string[];
      page?: number;
      limit?: number;
      sortBy?: 'created' | 'value' | 'close';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ) {
    try {
      const {
        status = [],
        page = 1,
        limit = 20,
        sortBy = 'created',
        sortOrder = 'desc'
      } = params;

      const where: any = { partnerId };
      if (status.length) where.status = { in: status };

      const orderBy: any = {};
      if (sortBy === 'created') orderBy.createdAt = sortOrder;
      else if (sortBy === 'value') orderBy.dealValue = sortOrder;
      else if (sortBy === 'close') orderBy.expectedClose = sortOrder;

      const [deals, total] = await Promise.all([
        prisma.dealRegistration.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.dealRegistration.count({ where })
      ]);

      return {
        deals,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error fetching partner deals:', error);
      throw new Error('Failed to fetch partner deals');
    }
  }

  /**
   * Add partner resource (marketing materials, guides, etc.)
   */
  async addPartnerResource(
    partnerId: string,
    data: {
      title: string;
      type: 'SALES_MATERIAL' | 'TECHNICAL_GUIDE' | 'MARKETING_ASSET' | 'TRAINING_VIDEO' | 'CASE_STUDY' | 'TEMPLATE';
      description: string;
      fileUrl?: string;
      content?: string;
      category: string;
      isPublic: boolean;
    }
  ) {
    try {
      const resource = await prisma.partnerResource.create({
        data: {
          partnerId,
          title: data.title,
          type: data.type,
          description: data.description,
          fileUrl: data.fileUrl,
          content: data.content,
          category: data.category,
          isPublic: data.isPublic
        }
      });

      return resource;
    } catch (error) {
      console.error('Error adding partner resource:', error);
      throw new Error('Failed to add partner resource');
    }
  }

  /**
   * Get partner resources
   */
  async getPartnerResources(
    partnerId: string,
    category?: string,
    type?: string
  ) {
    try {
      const where: any = {
        OR: [
          { partnerId },
          { isPublic: true }
        ]
      };

      if (category) where.category = category;
      if (type) where.type = type;

      const resources = await prisma.partnerResource.findMany({
        where,
        orderBy: { createdAt: 'desc' }
      });

      return resources;
    } catch (error) {
      console.error('Error fetching partner resources:', error);
      throw new Error('Failed to fetch partner resources');
    }
  }

  /**
   * Record training completion
   */
  async recordTrainingCompletion(
    partnerId: string,
    userId: string,
    data: {
      courseName: string;
      courseLevel: string;
      score?: number;
      certificateUrl?: string;
      expiresAt?: Date;
    }
  ) {
    try {
      const training = await prisma.partnerTraining.create({
        data: {
          partnerId,
          userId,
          courseName: data.courseName,
          courseLevel: data.courseLevel,
          completedAt: new Date(),
          score: data.score,
          certificateUrl: data.certificateUrl,
          expiresAt: data.expiresAt
        }
      });

      // Check for certification upgrades
      await this.checkCertificationUpgrade(partnerId);

      this.emit('trainingCompleted', training);
      return training;
    } catch (error) {
      console.error('Error recording training completion:', error);
      throw new Error('Failed to record training completion');
    }
  }

  /**
   * Generate commission for deal
   */
  async generateCommission(dealId: string) {
    try {
      const deal = await prisma.dealRegistration.findUnique({
        where: { id: dealId },
        include: { partner: true }
      });

      if (!deal || deal.status !== 'WON') {
        throw new Error('Deal not found or not won');
      }

      const commissionAmount = deal.dealValue.toNumber() * deal.partner.commissionRate;
      const period = new Date().toISOString().slice(0, 7); // YYYY-MM
      const dueDate = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)); // 30 days

      const commission = await prisma.commission.create({
        data: {
          partnerId: deal.partnerId,
          dealId: deal.id,
          amount: new Decimal(commissionAmount),
          currency: deal.currency,
          rate: deal.partner.commissionRate,
          status: 'PENDING',
          period,
          dueDate
        }
      });

      this.emit('commissionGenerated', commission);
      return commission;
    } catch (error) {
      console.error('Error generating commission:', error);
      throw new Error('Failed to generate commission');
    }
  }

  /**
   * Get partner commissions
   */
  async getPartnerCommissions(
    partnerId: string,
    params: {
      status?: string[];
      period?: string;
      page?: number;
      limit?: number;
    } = {}
  ) {
    try {
      const {
        status = [],
        period,
        page = 1,
        limit = 20
      } = params;

      const where: any = { partnerId };
      if (status.length) where.status = { in: status };
      if (period) where.period = period;

      const [commissions, total] = await Promise.all([
        prisma.commission.findMany({
          where,
          orderBy: { dueDate: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.commission.count({ where })
      ]);

      const summary = await prisma.commission.aggregate({
        where: { partnerId },
        _sum: { amount: true },
        _count: { id: true }
      });

      return {
        commissions,
        summary: {
          totalAmount: summary._sum.amount?.toNumber() || 0,
          totalCount: summary._count.id
        },
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error fetching partner commissions:', error);
      throw new Error('Failed to fetch partner commissions');
    }
  }

  /**
   * Get partner analytics
   */
  async getPartnerAnalytics(partnerId: string, timeframe: '30d' | '90d' | '1y' = '90d') {
    try {
      const days = timeframe === '30d' ? 30 : timeframe === '90d' ? 90 : 365;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const [
        totalDeals,
        wonDeals,
        totalValue,
        wonValue,
        commissionsPaid,
        trainingCompleted
      ] = await Promise.all([
        prisma.dealRegistration.count({
          where: { partnerId, createdAt: { gte: since } }
        }),
        prisma.dealRegistration.count({
          where: { partnerId, status: 'WON', createdAt: { gte: since } }
        }),
        prisma.dealRegistration.aggregate({
          where: { partnerId, createdAt: { gte: since } },
          _sum: { dealValue: true }
        }),
        prisma.dealRegistration.aggregate({
          where: { partnerId, status: 'WON', createdAt: { gte: since } },
          _sum: { dealValue: true }
        }),
        prisma.commission.aggregate({
          where: { partnerId, status: 'PAID', createdAt: { gte: since } },
          _sum: { amount: true }
        }),
        prisma.partnerTraining.count({
          where: { partnerId, completedAt: { gte: since } }
        })
      ]);

      return {
        deals: {
          total: totalDeals,
          won: wonDeals,
          winRate: totalDeals > 0 ? (wonDeals / totalDeals) * 100 : 0
        },
        revenue: {
          total: totalValue._sum.dealValue?.toNumber() || 0,
          won: wonValue._sum.dealValue?.toNumber() || 0
        },
        commissions: {
          paid: commissionsPaid._sum.amount?.toNumber() || 0
        },
        training: {
          completed: trainingCompleted
        }
      };
    } catch (error) {
      console.error('Error generating partner analytics:', error);
      throw new Error('Failed to generate partner analytics');
    }
  }

  // Private helper methods

  private async generateDealNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear().toString().substr(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    
    const count = await prisma.dealRegistration.count({
      where: {
        dealNumber: {
          startsWith: `DEAL-${year}${month}`
        }
      }
    });

    return `DEAL-${year}${month}${(count + 1).toString().padStart(4, '0')}`;
  }

  private async initiateOnboarding(partnerId: string) {
    // Create onboarding tasks, send welcome email, etc.
    console.log(`Initiating onboarding for partner ${partnerId}`);
  }

  private async setupPartnerResources(partnerId: string) {
    // Create default resources, setup access permissions, etc.
    console.log(`Setting up resources for partner ${partnerId}`);
  }

  private async sendWelcomePackage(partner: any) {
    // Send welcome email with credentials, resources, etc.
    console.log(`Sending welcome package to partner ${partner.id}`);
  }

  private async checkDealConflicts(deal: any) {
    // Check for existing deals with same customer
    const conflicts = await prisma.dealRegistration.findMany({
      where: {
        customerEmail: deal.customerEmail,
        status: { in: ['PENDING', 'APPROVED'] },
        protectionEnd: { gte: new Date() }
      }
    });

    if (conflicts.length > 0) {
      console.warn(`Deal conflict detected for customer ${deal.customerEmail}`);
      // Handle conflict resolution
    }
  }

  private async checkCertificationUpgrade(partnerId: string) {
    // Check if partner qualifies for tier upgrade based on training
    const completedTrainings = await prisma.partnerTraining.count({
      where: {
        partnerId,
        completedAt: { not: null },
        expiresAt: { gt: new Date() }
      }
    });

    const partner = await prisma.partner.findUnique({
      where: { id: partnerId }
    });

    if (partner && completedTrainings >= 5 && partner.partnerTier === 'BRONZE') {
      await this.upgradeTier(partnerId, 'SILVER');
    }
  }

  private async upgradeTier(partnerId: string, newTier: string) {
    const tierBenefit = this.tierBenefits[newTier as keyof typeof this.tierBenefits];
    
    await prisma.partner.update({
      where: { id: partnerId },
      data: {
        partnerTier: newTier as any,
        commissionRate: tierBenefit.commissionRate,
        updatedAt: new Date()
      }
    });

    this.emit('tierUpgraded', { partnerId, newTier });
  }

  private setupCommissionProcessing() {
    // Setup periodic commission processing
    setInterval(() => {
      this.processCommissions();
    }, 24 * 60 * 60 * 1000); // Daily
  }

  private async processCommissions() {
    try {
      const dueCommissions = await prisma.commission.findMany({
        where: {
          status: 'PENDING',
          dueDate: { lte: new Date() }
        }
      });

      for (const commission of dueCommissions) {
        await this.processCommission(commission.id);
      }
    } catch (error) {
      console.error('Error processing commissions:', error);
    }
  }

  private async processCommission(commissionId: string) {
    // Process payment, update status, send notification
    await prisma.commission.update({
      where: { id: commissionId },
      data: {
        status: 'APPROVED', // Would be 'PAID' after actual payment
        updatedAt: new Date()
      }
    });
  }
}

export const partnerService = new PartnerService();