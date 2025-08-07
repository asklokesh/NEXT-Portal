import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

interface ABTest {
  id: string;
  name: string;
  description: string;
  pluginId: string;
  status: 'draft' | 'running' | 'paused' | 'completed' | 'archived';
  type: 'split' | 'multivariate' | 'sequential';
  hypothesis: string;
  primaryMetric: Metric;
  secondaryMetrics: Metric[];
  variants: Variant[];
  allocation: AllocationStrategy;
  audience: AudienceSegment;
  schedule: TestSchedule;
  results?: TestResults;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  createdBy: string;
}

interface Variant {
  id: string;
  name: string;
  description: string;
  control: boolean;
  config: Record<string, any>;
  traffic: number; // percentage
  enrollments: number;
  conversions: number;
  metrics: Record<string, MetricValue>;
}

interface Metric {
  id: string;
  name: string;
  type: 'conversion' | 'revenue' | 'engagement' | 'performance' | 'custom';
  aggregation: 'sum' | 'average' | 'median' | 'percentile' | 'count';
  unit?: string;
  target?: number;
  minimumDetectableEffect?: number;
}

interface MetricValue {
  value: number;
  confidence: number;
  standardError: number;
  sampleSize: number;
  uplift?: number;
  significance?: boolean;
}

interface AllocationStrategy {
  type: 'random' | 'weighted' | 'sequential' | 'contextual';
  weights?: Record<string, number>;
  rules?: AllocationRule[];
  seed?: string;
}

interface AllocationRule {
  condition: string;
  variant: string;
  priority: number;
}

interface AudienceSegment {
  name: string;
  criteria: SegmentCriteria[];
  estimatedSize: number;
  excludeGroups?: string[];
}

interface SegmentCriteria {
  type: 'attribute' | 'behavior' | 'cohort' | 'geographic';
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: any;
}

interface TestSchedule {
  startDate: string;
  endDate?: string;
  duration?: number; // days
  minimumSampleSize: number;
  earlyStopRules?: EarlyStopRule[];
}

interface EarlyStopRule {
  type: 'winner' | 'loser' | 'futility' | 'harm';
  threshold: number;
  checkAfter: number; // hours
}

interface TestResults {
  winner?: string;
  confidence: number;
  pValue: number;
  statisticalPower: number;
  sampleSize: number;
  duration: number; // hours
  analysis: StatisticalAnalysis;
  segments: SegmentResults[];
  timeline: TimelineData[];
}

interface StatisticalAnalysis {
  method: 'frequentist' | 'bayesian';
  testStatistic: number;
  effectSize: number;
  confidenceInterval: [number, number];
  posteriorProbability?: number;
  bayesFactor?: number;
}

interface SegmentResults {
  segment: string;
  results: Record<string, MetricValue>;
  winner?: string;
  insights: string[];
}

interface TimelineData {
  timestamp: string;
  variantMetrics: Record<string, Record<string, number>>;
  cumulativeMetrics: Record<string, Record<string, number>>;
}

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  pluginId: string;
  enabled: boolean;
  conditions: FlagCondition[];
  variants: FlagVariant[];
  rolloutPercentage: number;
  targeting: TargetingRule[];
  dependencies: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface FlagCondition {
  type: 'environment' | 'user' | 'time' | 'custom';
  operator: string;
  value: any;
}

interface FlagVariant {
  name: string;
  value: any;
  weight: number;
  overrides?: Record<string, any>;
}

interface TargetingRule {
  segment: string;
  variant: string;
  percentage: number;
  priority: number;
}

interface ExperimentEvent {
  id: string;
  experimentId: string;
  userId: string;
  sessionId: string;
  variant: string;
  event: string;
  properties: Record<string, any>;
  timestamp: string;
  context: {
    device?: string;
    browser?: string;
    location?: string;
    referrer?: string;
  };
}

// Statistical calculations
class StatisticsCalculator {
  // Calculate conversion rate with confidence interval
  static calculateConversionRate(conversions: number, total: number): MetricValue {
    const rate = total > 0 ? conversions / total : 0;
    const standardError = Math.sqrt((rate * (1 - rate)) / total);
    const confidence = 1.96 * standardError; // 95% confidence interval
    
    return {
      value: rate,
      confidence,
      standardError,
      sampleSize: total,
      uplift: 0,
      significance: false
    };
  }

  // Two-proportion z-test
  static performZTest(control: MetricValue, variant: MetricValue): StatisticalAnalysis {
    const p1 = control.value;
    const p2 = variant.value;
    const n1 = control.sampleSize;
    const n2 = variant.sampleSize;
    
    const pooledProportion = (p1 * n1 + p2 * n2) / (n1 + n2);
    const standardError = Math.sqrt(pooledProportion * (1 - pooledProportion) * (1/n1 + 1/n2));
    const zScore = (p2 - p1) / standardError;
    const pValue = 2 * (1 - this.normalCDF(Math.abs(zScore)));
    
    const effectSize = (p2 - p1) / Math.sqrt(pooledProportion * (1 - pooledProportion));
    const marginOfError = 1.96 * standardError;
    const confidenceInterval: [number, number] = [
      (p2 - p1) - marginOfError,
      (p2 - p1) + marginOfError
    ];
    
    return {
      method: 'frequentist',
      testStatistic: zScore,
      effectSize,
      confidenceInterval,
      posteriorProbability: undefined,
      bayesFactor: undefined
    };
  }

  // Bayesian analysis
  static performBayesianAnalysis(control: MetricValue, variant: MetricValue): StatisticalAnalysis {
    // Beta-Binomial conjugate prior
    const alphaPrior = 1;
    const betaPrior = 1;
    
    const alphaControl = alphaPrior + control.value * control.sampleSize;
    const betaControl = betaPrior + (1 - control.value) * control.sampleSize;
    
    const alphaVariant = alphaPrior + variant.value * variant.sampleSize;
    const betaVariant = betaPrior + (1 - variant.value) * variant.sampleSize;
    
    // Monte Carlo simulation for posterior probability
    const samples = 10000;
    let variantWins = 0;
    
    for (let i = 0; i < samples; i++) {
      const controlSample = this.betaRandom(alphaControl, betaControl);
      const variantSample = this.betaRandom(alphaVariant, betaVariant);
      if (variantSample > controlSample) variantWins++;
    }
    
    const posteriorProbability = variantWins / samples;
    const bayesFactor = posteriorProbability / (1 - posteriorProbability);
    
    return {
      method: 'bayesian',
      testStatistic: 0,
      effectSize: (variant.value - control.value) / control.value,
      confidenceInterval: [0, 0], // Would calculate credible interval
      posteriorProbability,
      bayesFactor
    };
  }

  // Normal CDF approximation
  private static normalCDF(z: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp(-z * z / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? 1 - p : p;
  }

  // Beta distribution random sample
  private static betaRandom(alpha: number, beta: number): number {
    const gamma1 = this.gammaRandom(alpha);
    const gamma2 = this.gammaRandom(beta);
    return gamma1 / (gamma1 + gamma2);
  }

  // Gamma distribution random sample (simplified)
  private static gammaRandom(shape: number): number {
    let sum = 0;
    for (let i = 0; i < shape; i++) {
      sum -= Math.log(Math.random());
    }
    return sum;
  }

  // Calculate statistical power
  static calculatePower(effectSize: number, sampleSize: number, alpha: number = 0.05): number {
    const criticalZ = 1.96; // For alpha = 0.05, two-tailed
    const noncentrality = effectSize * Math.sqrt(sampleSize / 2);
    const power = 1 - this.normalCDF(criticalZ - noncentrality);
    return power;
  }

  // Calculate required sample size
  static calculateSampleSize(baselineRate: number, mde: number, power: number = 0.8, alpha: number = 0.05): number {
    const zAlpha = 1.96; // For alpha = 0.05, two-tailed
    const zBeta = 0.84; // For power = 0.8
    
    const p1 = baselineRate;
    const p2 = baselineRate * (1 + mde);
    const pooledP = (p1 + p2) / 2;
    
    const n = 2 * Math.pow((zAlpha + zBeta), 2) * pooledP * (1 - pooledP) / Math.pow(p2 - p1, 2);
    return Math.ceil(n);
  }
}

// Variant allocation
class VariantAllocator {
  private seed: string;

  constructor(seed?: string) {
    this.seed = seed || crypto.randomBytes(16).toString('hex');
  }

  allocate(userId: string, variants: Variant[], strategy: AllocationStrategy): string {
    switch (strategy.type) {
      case 'random':
        return this.randomAllocation(userId, variants);
      case 'weighted':
        return this.weightedAllocation(userId, variants, strategy.weights!);
      case 'sequential':
        return this.sequentialAllocation(userId, variants);
      case 'contextual':
        return this.contextualAllocation(userId, variants, strategy.rules!);
      default:
        return variants[0].id;
    }
  }

  private randomAllocation(userId: string, variants: Variant[]): string {
    const hash = crypto.createHash('md5').update(userId + this.seed).digest('hex');
    const bucket = parseInt(hash.substring(0, 8), 16) / 0xffffffff;
    
    let cumulative = 0;
    for (const variant of variants) {
      cumulative += variant.traffic / 100;
      if (bucket <= cumulative) {
        return variant.id;
      }
    }
    
    return variants[variants.length - 1].id;
  }

  private weightedAllocation(userId: string, variants: Variant[], weights: Record<string, number>): string {
    const hash = crypto.createHash('md5').update(userId + this.seed).digest('hex');
    const bucket = parseInt(hash.substring(0, 8), 16) / 0xffffffff;
    
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
    let cumulative = 0;
    
    for (const variant of variants) {
      const weight = weights[variant.id] || 0;
      cumulative += weight / totalWeight;
      if (bucket <= cumulative) {
        return variant.id;
      }
    }
    
    return variants[variants.length - 1].id;
  }

  private sequentialAllocation(userId: string, variants: Variant[]): string {
    const userIndex = parseInt(crypto.createHash('md5').update(userId).digest('hex').substring(0, 8), 16);
    return variants[userIndex % variants.length].id;
  }

  private contextualAllocation(userId: string, variants: Variant[], rules: AllocationRule[]): string {
    // Sort rules by priority
    const sortedRules = rules.sort((a, b) => b.priority - a.priority);
    
    for (const rule of sortedRules) {
      // Evaluate condition (simplified)
      if (this.evaluateCondition(rule.condition, userId)) {
        return rule.variant;
      }
    }
    
    // Fallback to random allocation
    return this.randomAllocation(userId, variants);
  }

  private evaluateCondition(condition: string, userId: string): boolean {
    // Simplified condition evaluation
    return Math.random() > 0.5;
  }
}

// Store for A/B tests
const testStore = new Map<string, ABTest>();
const eventStore = new Map<string, ExperimentEvent[]>();
const flagStore = new Map<string, FeatureFlag>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create_test': {
        const { name, description, pluginId, hypothesis, primaryMetric, variants, audience, schedule } = body;
        
        const test: ABTest = {
          id: crypto.randomBytes(8).toString('hex'),
          name,
          description,
          pluginId,
          status: 'draft',
          type: 'split',
          hypothesis,
          primaryMetric,
          secondaryMetrics: [],
          variants: variants || [
            {
              id: 'control',
              name: 'Control',
              description: 'Original version',
              control: true,
              config: {},
              traffic: 50,
              enrollments: 0,
              conversions: 0,
              metrics: {}
            },
            {
              id: 'variant-a',
              name: 'Variant A',
              description: 'Test version',
              control: false,
              config: { feature: 'enabled' },
              traffic: 50,
              enrollments: 0,
              conversions: 0,
              metrics: {}
            }
          ],
          allocation: {
            type: 'random',
            seed: crypto.randomBytes(16).toString('hex')
          },
          audience: audience || {
            name: 'All Users',
            criteria: [],
            estimatedSize: 10000
          },
          schedule: schedule || {
            startDate: new Date().toISOString(),
            duration: 14,
            minimumSampleSize: 1000
          },
          createdAt: new Date().toISOString(),
          createdBy: 'user'
        };
        
        testStore.set(test.id, test);
        
        // Calculate required sample size
        const baselineRate = 0.1; // 10% baseline conversion
        const mde = primaryMetric.minimumDetectableEffect || 0.1; // 10% MDE
        const requiredSampleSize = StatisticsCalculator.calculateSampleSize(baselineRate, mde);
        
        return NextResponse.json({
          success: true,
          test,
          requiredSampleSize,
          estimatedDuration: Math.ceil(requiredSampleSize / (audience?.estimatedSize || 1000))
        });
      }

      case 'start_test': {
        const { testId } = body;
        const test = testStore.get(testId);
        
        if (!test) {
          return NextResponse.json({
            success: false,
            error: 'Test not found'
          }, { status: 404 });
        }
        
        test.status = 'running';
        test.startedAt = new Date().toISOString();
        testStore.set(testId, test);
        
        return NextResponse.json({
          success: true,
          message: 'Test started',
          test
        });
      }

      case 'track_event': {
        const { testId, userId, sessionId, event, properties } = body;
        const test = testStore.get(testId);
        
        if (!test || test.status !== 'running') {
          return NextResponse.json({
            success: false,
            error: 'Test not found or not running'
          }, { status: 400 });
        }
        
        // Allocate variant
        const allocator = new VariantAllocator(test.allocation.seed);
        const variantId = allocator.allocate(userId, test.variants, test.allocation);
        const variant = test.variants.find(v => v.id === variantId)!;
        
        // Track event
        const experimentEvent: ExperimentEvent = {
          id: crypto.randomBytes(8).toString('hex'),
          experimentId: testId,
          userId,
          sessionId,
          variant: variantId,
          event,
          properties: properties || {},
          timestamp: new Date().toISOString(),
          context: {
            device: 'desktop',
            browser: 'chrome',
            location: 'US'
          }
        };
        
        const events = eventStore.get(testId) || [];
        events.push(experimentEvent);
        eventStore.set(testId, events);
        
        // Update variant metrics
        variant.enrollments++;
        if (event === 'conversion') {
          variant.conversions++;
        }
        
        // Calculate metrics
        variant.metrics[test.primaryMetric.id] = StatisticsCalculator.calculateConversionRate(
          variant.conversions,
          variant.enrollments
        );
        
        testStore.set(testId, test);
        
        return NextResponse.json({
          success: true,
          variant: variantId,
          event: experimentEvent
        });
      }

      case 'analyze_results': {
        const { testId } = body;
        const test = testStore.get(testId);
        
        if (!test) {
          return NextResponse.json({
            success: false,
            error: 'Test not found'
          }, { status: 404 });
        }
        
        // Get control and variant
        const control = test.variants.find(v => v.control)!;
        const variant = test.variants.find(v => !v.control)!;
        
        // Perform statistical analysis
        const controlMetric = control.metrics[test.primaryMetric.id] || 
          StatisticsCalculator.calculateConversionRate(0, 0);
        const variantMetric = variant.metrics[test.primaryMetric.id] || 
          StatisticsCalculator.calculateConversionRate(0, 0);
        
        const frequentistAnalysis = StatisticsCalculator.performZTest(controlMetric, variantMetric);
        const bayesianAnalysis = StatisticsCalculator.performBayesianAnalysis(controlMetric, variantMetric);
        
        // Determine winner
        const pValue = 2 * (1 - StatisticsCalculator.normalCDF(Math.abs(frequentistAnalysis.testStatistic)));
        const isSignificant = pValue < 0.05;
        const winner = isSignificant && variantMetric.value > controlMetric.value ? variant.id : 
                      isSignificant && controlMetric.value > variantMetric.value ? control.id : 
                      undefined;
        
        // Calculate power
        const power = StatisticsCalculator.calculatePower(
          frequentistAnalysis.effectSize,
          control.enrollments + variant.enrollments
        );
        
        test.results = {
          winner,
          confidence: 1 - pValue,
          pValue,
          statisticalPower: power,
          sampleSize: control.enrollments + variant.enrollments,
          duration: test.startedAt ? 
            (Date.now() - new Date(test.startedAt).getTime()) / (1000 * 60 * 60) : 0,
          analysis: frequentistAnalysis,
          segments: [],
          timeline: []
        };
        
        testStore.set(testId, test);
        
        return NextResponse.json({
          success: true,
          results: test.results,
          frequentist: frequentistAnalysis,
          bayesian: bayesianAnalysis,
          recommendation: winner ? `Deploy ${winner}` : 'Continue testing for more data'
        });
      }

      case 'create_flag': {
        const { name, description, pluginId, enabled, conditions, variants, rolloutPercentage } = body;
        
        const flag: FeatureFlag = {
          id: crypto.randomBytes(8).toString('hex'),
          name,
          description,
          pluginId,
          enabled: enabled || false,
          conditions: conditions || [],
          variants: variants || [
            { name: 'on', value: true, weight: 50 },
            { name: 'off', value: false, weight: 50 }
          ],
          rolloutPercentage: rolloutPercentage || 0,
          targeting: [],
          dependencies: [],
          tags: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        flagStore.set(flag.id, flag);
        
        return NextResponse.json({
          success: true,
          flag
        });
      }

      case 'evaluate_flag': {
        const { flagId, userId, context } = body;
        const flag = flagStore.get(flagId);
        
        if (!flag || !flag.enabled) {
          return NextResponse.json({
            success: true,
            value: false,
            reason: flag ? 'Flag disabled' : 'Flag not found'
          });
        }
        
        // Check conditions
        for (const condition of flag.conditions) {
          if (!this.evaluateCondition(condition, context)) {
            return NextResponse.json({
              success: true,
              value: false,
              reason: 'Condition not met'
            });
          }
        }
        
        // Check rollout percentage
        const hash = crypto.createHash('md5').update(userId + flagId).digest('hex');
        const bucket = parseInt(hash.substring(0, 8), 16) / 0xffffffff * 100;
        
        if (bucket > flag.rolloutPercentage) {
          return NextResponse.json({
            success: true,
            value: false,
            reason: 'Not in rollout percentage'
          });
        }
        
        // Determine variant
        let cumulative = 0;
        for (const variant of flag.variants) {
          cumulative += variant.weight;
          if (bucket <= cumulative) {
            return NextResponse.json({
              success: true,
              value: variant.value,
              variant: variant.name,
              reason: 'Evaluation successful'
            });
          }
        }
        
        return NextResponse.json({
          success: true,
          value: flag.variants[0].value,
          variant: flag.variants[0].name,
          reason: 'Default variant'
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('A/B Testing API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process A/B testing request'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    switch (type) {
      case 'test': {
        if (id) {
          const test = testStore.get(id);
          if (!test) {
            return NextResponse.json({
              success: false,
              error: 'Test not found'
            }, { status: 404 });
          }
          
          return NextResponse.json({
            success: true,
            test
          });
        }
        
        // List all tests
        const tests = Array.from(testStore.values());
        return NextResponse.json({
          success: true,
          tests,
          summary: {
            total: tests.length,
            running: tests.filter(t => t.status === 'running').length,
            completed: tests.filter(t => t.status === 'completed').length
          }
        });
      }

      case 'flag': {
        if (id) {
          const flag = flagStore.get(id);
          if (!flag) {
            return NextResponse.json({
              success: false,
              error: 'Flag not found'
            }, { status: 404 });
          }
          
          return NextResponse.json({
            success: true,
            flag
          });
        }
        
        // List all flags
        const flags = Array.from(flagStore.values());
        return NextResponse.json({
          success: true,
          flags,
          summary: {
            total: flags.length,
            enabled: flags.filter(f => f.enabled).length,
            disabled: flags.filter(f => !f.enabled).length
          }
        });
      }

      case 'events': {
        const testId = searchParams.get('testId');
        if (!testId) {
          return NextResponse.json({
            success: false,
            error: 'Test ID required'
          }, { status: 400 });
        }
        
        const events = eventStore.get(testId) || [];
        return NextResponse.json({
          success: true,
          events,
          total: events.length
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid type'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('A/B Testing API GET error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch A/B testing data'
    }, { status: 500 });
  }
}

// Helper function for condition evaluation
function evaluateCondition(condition: FlagCondition, context: any): boolean {
  // Simplified condition evaluation
  return true;
}