import { NextRequest, NextResponse } from 'next/server';
import { getRateLimitingEngine } from '@/lib/rate-limiting';
import { z } from 'zod';
import { withAuth } from '@/lib/auth/middleware';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

// Request schemas
const CreateTierSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  limits: z.object({
    perSecond: z.number().optional(),
    perMinute: z.number().optional(),
    perHour: z.number().optional(),
    perDay: z.number().optional()
  }),
  burstLimit: z.number().optional(),
  priority: z.number().default(0),
  enabled: z.boolean().default(true)
});

const CreateRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  pattern: z.string().min(1),
  method: z.array(z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', '*'])).default(['*']),
  tierId: z.string().min(1),
  userTypes: z.array(z.string()).default([]),
  ipWhitelist: z.array(z.string()).default([]),
  ipBlacklist: z.array(z.string()).default([]),
  enabled: z.boolean().default(true)
});

const ResetLimitsSchema = z.object({
  identifier: z.string().min(1),
  type: z.enum(['user', 'ip'])
});

// GET - Retrieve rate limiting configuration and stats
export async function GET(request: NextRequest) {
  return withAuth(request, async (req, user) => {
    try {
      const { searchParams } = new URL(req.url);
      const action = searchParams.get('action');

      // Check admin permissions
      if (user.role !== 'admin' && user.role !== 'platform-admin') {
        return NextResponse.json(
          { error: 'Insufficient permissions to access rate limiting configuration' },
          { status: 403 }
        );
      }

      const rateLimiter = getRateLimitingEngine();

      switch (action) {
        case 'tiers':
          const tiers = rateLimiter.getAllTiers();
          
          logger.info('Rate limit tiers retrieved', {
            user: user.id,
            count: tiers.length
          });
          
          return NextResponse.json({
            tiers,
            total: tiers.length
          });

        case 'tier':
          const tierId = searchParams.get('tierId');
          if (!tierId) {
            return NextResponse.json(
              { error: 'Tier ID is required' },
              { status: 400 }
            );
          }
          
          const tier = rateLimiter.getTier(tierId);
          if (!tier) {
            return NextResponse.json(
              { error: 'Tier not found' },
              { status: 404 }
            );
          }
          
          return NextResponse.json({ tier });

        case 'rules':
          const rules = rateLimiter.getAllRules();
          
          logger.info('Rate limit rules retrieved', {
            user: user.id,
            count: rules.length
          });
          
          return NextResponse.json({
            rules,
            total: rules.length
          });

        case 'usage':
          const identifier = searchParams.get('identifier');
          if (!identifier) {
            return NextResponse.json(
              { error: 'Identifier is required for usage stats' },
              { status: 400 }
            );
          }
          
          const usage = await rateLimiter.getUsageStats(identifier);
          
          return NextResponse.json({
            identifier,
            usage
          });

        case 'health':
          const health = await rateLimiter.healthCheck();
          
          return NextResponse.json({ health });

        case 'test':
          // Test rate limiting for a specific request
          const testIp = searchParams.get('ip') || '127.0.0.1';
          const testPath = searchParams.get('path') || '/api/test';
          const testMethod = searchParams.get('method') || 'GET';
          const testUserId = searchParams.get('userId');
          const testUserType = searchParams.get('userType');
          
          const testResult = await rateLimiter.checkRateLimit({
            ip: testIp,
            userId: testUserId || undefined,
            userType: testUserType || undefined,
            path: testPath,
            method: testMethod
          });
          
          return NextResponse.json({
            test: {
              ip: testIp,
              path: testPath,
              method: testMethod,
              userId: testUserId,
              userType: testUserType
            },
            result: testResult
          });

        default:
          // Return overview
          const allTiers = rateLimiter.getAllTiers();
          const allRules = rateLimiter.getAllRules();
          const healthStatus = await rateLimiter.healthCheck();
          
          return NextResponse.json({
            overview: {
              tiers: allTiers.length,
              rules: allRules.length,
              enabledTiers: allTiers.filter(t => t.enabled).length,
              enabledRules: allRules.filter(r => r.enabled).length,
              health: healthStatus
            },
            recentTiers: allTiers.slice(0, 5),
            recentRules: allRules.slice(0, 5)
          });
      }
    } catch (error) {
      logger.error('Rate limiting API error', {
        error: error.message,
        user: user?.id,
        action: new URL(request.url).searchParams.get('action')
      });
      
      return NextResponse.json(
        { error: 'Rate limiting operation failed', details: error.message },
        { status: 500 }
      );
    }
  });
}

// POST - Create tiers, rules, or perform operations
export async function POST(request: NextRequest) {
  return withAuth(request, async (req, user) => {
    try {
      const body = await req.json();
      const { searchParams } = new URL(req.url);
      const action = searchParams.get('action');

      // Check admin permissions
      if (user.role !== 'admin' && user.role !== 'platform-admin') {
        return NextResponse.json(
          { error: 'Insufficient permissions to modify rate limiting configuration' },
          { status: 403 }
        );
      }

      const rateLimiter = getRateLimitingEngine();

      switch (action) {
        case 'create-tier':
          const tierData = CreateTierSchema.parse(body);
          
          rateLimiter.addTier(tierData);
          
          logger.info('Rate limit tier created', {
            user: user.id,
            tierId: tierData.id,
            name: tierData.name
          });
          
          return NextResponse.json({
            success: true,
            tier: tierData,
            message: 'Rate limit tier created successfully'
          });

        case 'create-rule':
          const ruleData = CreateRuleSchema.parse(body);
          
          // Verify tier exists
          const tier = rateLimiter.getTier(ruleData.tierId);
          if (!tier) {
            return NextResponse.json(
              { error: `Rate limit tier '${ruleData.tierId}' not found` },
              { status: 400 }
            );
          }
          
          rateLimiter.addRule(ruleData);
          
          logger.info('Rate limit rule created', {
            user: user.id,
            ruleId: ruleData.id,
            pattern: ruleData.pattern,
            tierId: ruleData.tierId
          });
          
          return NextResponse.json({
            success: true,
            rule: ruleData,
            message: 'Rate limit rule created successfully'
          });

        case 'reset-limits':
          const resetData = ResetLimitsSchema.parse(body);
          
          if (resetData.type === 'user') {
            await rateLimiter.resetUserLimits(resetData.identifier);
          } else {
            await rateLimiter.resetIpLimits(resetData.identifier);
          }
          
          logger.info('Rate limits reset', {
            user: user.id,
            type: resetData.type,
            identifier: resetData.identifier
          });
          
          return NextResponse.json({
            success: true,
            message: `${resetData.type} rate limits reset successfully`
          });

        case 'bulk-create-rules':
          const rulesData = z.array(CreateRuleSchema).parse(body.rules || []);
          
          const created = [];
          const errors = [];
          
          for (const rule of rulesData) {
            try {
              // Verify tier exists
              const tier = rateLimiter.getTier(rule.tierId);
              if (!tier) {
                errors.push({ rule: rule.id, error: `Tier '${rule.tierId}' not found` });
                continue;
              }
              
              rateLimiter.addRule(rule);
              created.push(rule.id);
            } catch (error) {
              errors.push({ rule: rule.id, error: error.message });
            }
          }
          
          logger.info('Bulk rules creation completed', {
            user: user.id,
            created: created.length,
            errors: errors.length
          });
          
          return NextResponse.json({
            success: true,
            created,
            errors,
            message: `Created ${created.length} rules, ${errors.length} errors`
          });

        default:
          return NextResponse.json(
            { error: 'Invalid action specified' },
            { status: 400 }
          );
      }
    } catch (error) {
      logger.error('Rate limiting POST operation failed', {
        error: error.message,
        user: user?.id,
        action: new URL(request.url).searchParams.get('action')
      });

      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation failed', details: error.errors },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'Operation failed', details: error.message },
        { status: 500 }
      );
    }
  });
}

// PUT - Update tiers or rules
export async function PUT(request: NextRequest) {
  return withAuth(request, async (req, user) => {
    try {
      const body = await req.json();
      const { searchParams } = new URL(req.url);
      const action = searchParams.get('action');

      // Check admin permissions
      if (user.role !== 'admin' && user.role !== 'platform-admin') {
        return NextResponse.json(
          { error: 'Insufficient permissions to modify rate limiting configuration' },
          { status: 403 }
        );
      }

      const rateLimiter = getRateLimitingEngine();

      switch (action) {
        case 'update-tier':
          const tierId = searchParams.get('tierId');
          if (!tierId) {
            return NextResponse.json(
              { error: 'Tier ID is required' },
              { status: 400 }
            );
          }
          
          const existingTier = rateLimiter.getTier(tierId);
          if (!existingTier) {
            return NextResponse.json(
              { error: 'Tier not found' },
              { status: 404 }
            );
          }
          
          rateLimiter.updateTier(tierId, body);
          
          logger.info('Rate limit tier updated', {
            user: user.id,
            tierId,
            updatedFields: Object.keys(body)
          });
          
          return NextResponse.json({
            success: true,
            message: 'Rate limit tier updated successfully'
          });

        case 'toggle-tier':
          const toggleTierId = searchParams.get('tierId');
          if (!toggleTierId) {
            return NextResponse.json(
              { error: 'Tier ID is required' },
              { status: 400 }
            );
          }
          
          const tier = rateLimiter.getTier(toggleTierId);
          if (!tier) {
            return NextResponse.json(
              { error: 'Tier not found' },
              { status: 404 }
            );
          }
          
          rateLimiter.updateTier(toggleTierId, { enabled: !tier.enabled });
          
          logger.info('Rate limit tier toggled', {
            user: user.id,
            tierId: toggleTierId,
            enabled: !tier.enabled
          });
          
          return NextResponse.json({
            success: true,
            enabled: !tier.enabled,
            message: `Rate limit tier ${!tier.enabled ? 'enabled' : 'disabled'}`
          });

        case 'toggle-rule':
          const toggleRuleId = searchParams.get('ruleId');
          if (!toggleRuleId) {
            return NextResponse.json(
              { error: 'Rule ID is required' },
              { status: 400 }
            );
          }
          
          const rule = rateLimiter.getAllRules().find(r => r.id === toggleRuleId);
          if (!rule) {
            return NextResponse.json(
              { error: 'Rule not found' },
              { status: 404 }
            );
          }
          
          // Remove and re-add with updated enabled status
          rateLimiter.removeRule(toggleRuleId);
          rateLimiter.addRule({ ...rule, enabled: !rule.enabled });
          
          logger.info('Rate limit rule toggled', {
            user: user.id,
            ruleId: toggleRuleId,
            enabled: !rule.enabled
          });
          
          return NextResponse.json({
            success: true,
            enabled: !rule.enabled,
            message: `Rate limit rule ${!rule.enabled ? 'enabled' : 'disabled'}`
          });

        default:
          return NextResponse.json(
            { error: 'Invalid action specified' },
            { status: 400 }
          );
      }
    } catch (error) {
      logger.error('Rate limiting PUT operation failed', {
        error: error.message,
        user: user?.id,
        action: new URL(request.url).searchParams.get('action')
      });

      return NextResponse.json(
        { error: 'Update failed', details: error.message },
        { status: 500 }
      );
    }
  });
}

// DELETE - Remove tiers or rules
export async function DELETE(request: NextRequest) {
  return withAuth(request, async (req, user) => {
    try {
      const { searchParams } = new URL(req.url);
      const action = searchParams.get('action');

      // Check admin permissions
      if (user.role !== 'admin' && user.role !== 'platform-admin') {
        return NextResponse.json(
          { error: 'Insufficient permissions to modify rate limiting configuration' },
          { status: 403 }
        );
      }

      const rateLimiter = getRateLimitingEngine();

      switch (action) {
        case 'tier':
          const tierId = searchParams.get('tierId');
          if (!tierId) {
            return NextResponse.json(
              { error: 'Tier ID is required' },
              { status: 400 }
            );
          }
          
          const tier = rateLimiter.getTier(tierId);
          if (!tier) {
            return NextResponse.json(
              { error: 'Tier not found' },
              { status: 404 }
            );
          }
          
          // Check if tier is being used by any rules
          const usingRules = rateLimiter.getAllRules().filter(r => r.tierId === tierId);
          if (usingRules.length > 0) {
            return NextResponse.json(
              { 
                error: `Cannot delete tier. It is being used by ${usingRules.length} rule(s)`,
                usingRules: usingRules.map(r => ({ id: r.id, name: r.name }))
              },
              { status: 400 }
            );
          }
          
          rateLimiter.removeTier(tierId);
          
          logger.info('Rate limit tier deleted', {
            user: user.id,
            tierId,
            name: tier.name
          });
          
          return NextResponse.json({
            success: true,
            message: 'Rate limit tier deleted successfully'
          });

        case 'rule':
          const ruleId = searchParams.get('ruleId');
          if (!ruleId) {
            return NextResponse.json(
              { error: 'Rule ID is required' },
              { status: 400 }
            );
          }
          
          const rule = rateLimiter.getAllRules().find(r => r.id === ruleId);
          if (!rule) {
            return NextResponse.json(
              { error: 'Rule not found' },
              { status: 404 }
            );
          }
          
          rateLimiter.removeRule(ruleId);
          
          logger.info('Rate limit rule deleted', {
            user: user.id,
            ruleId,
            name: rule.name
          });
          
          return NextResponse.json({
            success: true,
            message: 'Rate limit rule deleted successfully'
          });

        default:
          return NextResponse.json(
            { error: 'Invalid action specified' },
            { status: 400 }
          );
      }
    } catch (error) {
      logger.error('Rate limiting DELETE operation failed', {
        error: error.message,
        user: user?.id,
        action: new URL(request.url).searchParams.get('action')
      });

      return NextResponse.json(
        { error: 'Delete failed', details: error.message },
        { status: 500 }
      );
    }
  });
}