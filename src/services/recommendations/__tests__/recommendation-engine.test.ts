// Comprehensive tests for Service Recommendations Engine

import { ServiceRecommendationsEngine } from '../index';
import {
  ServiceMetrics,
  Recommendation,
  RecommendationCategory,
  RecommendationType,
  RecommendationStatus,
  FeedbackData,
  ABTestConfig
} from '../types';

describe('ServiceRecommendationsEngine', () => {
  let engine: ServiceRecommendationsEngine;
  let mockMetrics: ServiceMetrics;

  beforeEach(() => {
    engine = new ServiceRecommendationsEngine({
      enableML: true,
      enableABTesting: true,
      enableAutoLearning: true,
      batchSize: 5,
      refreshInterval: 0, // Disable auto-refresh for tests
      confidenceThreshold: 0.7
    });

    mockMetrics = {
      performance: {
        responseTime: 1200,
        throughput: 5000,
        errorRate: 0.02,
        availability: 99.5,
        latency: [100, 200, 300, 400, 500],
        p50: 250,
        p95: 1100,
        p99: 1500
      },
      resource: {
        cpuUsage: 75,
        memoryUsage: 65,
        diskUsage: 45,
        networkBandwidth: 500,
        containerCount: 3
      },
      cost: {
        monthlySpend: 8000,
        perRequestCost: 0.002,
        infrastructureCost: 5000,
        operationalCost: 3000
      },
      quality: {
        codeComplexity: 70,
        testCoverage: 55,
        technicalDebt: 40,
        securityScore: 65,
        documentationScore: 50
      }
    };
  });

  afterEach(async () => {
    await engine.shutdown();
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      await expect(engine.initialize()).resolves.not.toThrow();
    });

    test('should emit initialized event', async () => {
      const initPromise = new Promise(resolve => {
        engine.once('initialized', resolve);
      });

      await engine.initialize();
      await expect(initPromise).resolves.toBeDefined();
    });

    test('should handle initialization errors gracefully', async () => {
      const brokenEngine = new ServiceRecommendationsEngine({
        enableML: true
      });

      // Mock a failure
      jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Should not throw but log error
      await brokenEngine.initialize();
      
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Service Analysis', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should analyze service and generate recommendations', async () => {
      const result = await engine.analyzeService('test-service', mockMetrics);

      expect(result).toMatchObject({
        serviceId: 'test-service',
        recommendations: expect.any(Array),
        patterns: expect.any(Array),
        anomalies: expect.any(Array),
        score: expect.any(Number),
        timestamp: expect.any(Date)
      });

      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    test('should filter recommendations by category', async () => {
      const result = await engine.analyzeService('test-service', mockMetrics, {
        categories: [RecommendationCategory.PERFORMANCE]
      });

      result.recommendations.forEach(rec => {
        expect(rec.category).toBe(RecommendationCategory.PERFORMANCE);
      });
    });

    test('should limit number of recommendations', async () => {
      const maxRecommendations = 3;
      const result = await engine.analyzeService('test-service', mockMetrics, {
        maxRecommendations
      });

      expect(result.recommendations.length).toBeLessThanOrEqual(maxRecommendations);
    });

    test('should generate performance recommendations for slow services', async () => {
      const slowMetrics = {
        ...mockMetrics,
        performance: {
          ...mockMetrics.performance,
          responseTime: 3000,
          p95: 4000,
          p99: 5000
        }
      };

      const result = await engine.analyzeService('slow-service', slowMetrics);
      
      const perfRecs = result.recommendations.filter(
        r => r.category === RecommendationCategory.PERFORMANCE
      );

      expect(perfRecs.length).toBeGreaterThan(0);
      
      const recTypes = perfRecs.map(r => r.type);
      expect(recTypes).toContain(RecommendationType.CACHING_OPTIMIZATION);
    });

    test('should generate security recommendations for vulnerable services', async () => {
      const insecureMetrics = {
        ...mockMetrics,
        quality: {
          ...mockMetrics.quality,
          securityScore: 40
        }
      };

      const result = await engine.analyzeService('insecure-service', insecureMetrics);
      
      const secRecs = result.recommendations.filter(
        r => r.category === RecommendationCategory.SECURITY
      );

      expect(secRecs.length).toBeGreaterThan(0);
    });

    test('should generate cost recommendations for over-provisioned services', async () => {
      const overProvisionedMetrics = {
        ...mockMetrics,
        resource: {
          ...mockMetrics.resource,
          cpuUsage: 20,
          memoryUsage: 25
        },
        cost: {
          ...mockMetrics.cost,
          monthlySpend: 15000
        }
      };

      const result = await engine.analyzeService('expensive-service', overProvisionedMetrics);
      
      const costRecs = result.recommendations.filter(
        r => r.category === RecommendationCategory.COST
      );

      expect(costRecs.length).toBeGreaterThan(0);
      expect(costRecs[0].type).toBe(RecommendationType.RESOURCE_RIGHTSIZING);
    });

    test('should calculate appropriate service scores', async () => {
      const healthyMetrics = {
        ...mockMetrics,
        performance: {
          ...mockMetrics.performance,
          responseTime: 200,
          errorRate: 0.001,
          availability: 99.99
        },
        quality: {
          ...mockMetrics.quality,
          testCoverage: 90,
          securityScore: 95,
          documentationScore: 85
        }
      };

      const healthyResult = await engine.analyzeService('healthy-service', healthyMetrics);
      const unhealthyResult = await engine.analyzeService('unhealthy-service', mockMetrics);

      expect(healthyResult.score).toBeGreaterThan(unhealthyResult.score);
    });
  });

  describe('Batch Analysis', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should analyze multiple services in batches', async () => {
      const serviceMetrics = new Map<string, ServiceMetrics>();
      
      for (let i = 0; i < 10; i++) {
        serviceMetrics.set(`service-${i}`, mockMetrics);
      }

      const results = await engine.analyzeServices(serviceMetrics);

      expect(results.size).toBe(10);
      
      results.forEach((result, serviceId) => {
        expect(result.serviceId).toBe(serviceId);
        expect(result.recommendations).toBeDefined();
      });
    });

    test('should emit batch processing events', async () => {
      const serviceMetrics = new Map<string, ServiceMetrics>();
      
      for (let i = 0; i < 10; i++) {
        serviceMetrics.set(`service-${i}`, mockMetrics);
      }

      const batchEvents: any[] = [];
      engine.on('batch-processed', (event) => {
        batchEvents.push(event);
      });

      await engine.analyzeServices(serviceMetrics);

      expect(batchEvents.length).toBe(2); // 10 services, batch size 5
      expect(batchEvents[0].batchNumber).toBe(1);
      expect(batchEvents[1].batchNumber).toBe(2);
    });
  });

  describe('Recommendation Management', () => {
    beforeEach(async () => {
      await engine.initialize();
      await engine.analyzeService('test-service', mockMetrics);
    });

    test('should retrieve recommendations by service', async () => {
      const recommendations = await engine.getRecommendations('test-service');
      
      expect(recommendations).toBeInstanceOf(Array);
      expect(recommendations.length).toBeGreaterThan(0);
    });

    test('should filter recommendations by status', async () => {
      const recommendations = await engine.getRecommendations('test-service');
      
      if (recommendations.length > 0) {
        const recId = recommendations[0].id;
        await engine.updateRecommendationStatus(recId, RecommendationStatus.IN_PROGRESS);
        
        const inProgressRecs = await engine.getRecommendations('test-service', {
          status: RecommendationStatus.IN_PROGRESS
        });
        
        expect(inProgressRecs.length).toBe(1);
        expect(inProgressRecs[0].status).toBe(RecommendationStatus.IN_PROGRESS);
      }
    });

    test('should filter recommendations by minimum score', async () => {
      const minScore = 70;
      const recommendations = await engine.getRecommendations('test-service', {
        minScore
      });
      
      recommendations.forEach(rec => {
        expect(rec.score).toBeGreaterThanOrEqual(minScore);
      });
    });

    test('should update recommendation status', async () => {
      const recommendations = await engine.getRecommendations('test-service');
      
      if (recommendations.length > 0) {
        const recId = recommendations[0].id;
        
        const statusUpdatePromise = new Promise(resolve => {
          engine.once('recommendation-status-updated', resolve);
        });
        
        await engine.updateRecommendationStatus(recId, RecommendationStatus.COMPLETED);
        
        const event: any = await statusUpdatePromise;
        expect(event.recommendationId).toBe(recId);
        expect(event.status).toBe(RecommendationStatus.COMPLETED);
      }
    });
  });

  describe('Feedback Integration', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should accept and process feedback', async () => {
      const feedback: FeedbackData = {
        recommendationId: 'rec-123',
        userId: 'user-456',
        helpful: true,
        implemented: true,
        actualImpact: {
          performance: 60,
          security: 0,
          cost: 20,
          reliability: 30,
          maintainability: 40,
          userExperience: 50,
          businessValue: 45,
          description: 'Positive impact observed'
        },
        actualEffort: 20,
        comments: 'Great recommendation',
        timestamp: new Date()
      };

      const feedbackPromise = new Promise(resolve => {
        engine.once('feedback-received', resolve);
      });

      await engine.provideFeedback(feedback);
      
      const receivedFeedback = await feedbackPromise;
      expect(receivedFeedback).toEqual(feedback);
    });
  });

  describe('A/B Testing', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should create A/B test', async () => {
      const testConfig: ABTestConfig = {
        id: 'test-001',
        name: 'Recommendation Algorithm Test',
        variants: [
          {
            id: 'control',
            name: 'Current Algorithm',
            allocation: 50,
            config: { algorithm: 'v1' }
          },
          {
            id: 'treatment',
            name: 'New Algorithm',
            allocation: 50,
            config: { algorithm: 'v2' }
          }
        ],
        metrics: ['acceptance_rate', 'implementation_rate'],
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'active'
      };

      await expect(engine.createABTest(testConfig)).resolves.not.toThrow();
    });

    test('should assign variant for A/B test', async () => {
      const testConfig: ABTestConfig = {
        id: 'test-002',
        name: 'Test',
        variants: [
          { id: 'a', name: 'A', allocation: 50, config: {} },
          { id: 'b', name: 'B', allocation: 50, config: {} }
        ],
        metrics: [],
        startDate: new Date(),
        endDate: new Date(Date.now() + 1000000),
        status: 'active'
      };

      await engine.createABTest(testConfig);
      
      const variant = await engine.getABTestVariant('test-002', 'entity-123');
      
      expect(variant).toBeDefined();
      expect(['a', 'b']).toContain(variant?.id);
    });

    test('should handle disabled A/B testing', async () => {
      const disabledEngine = new ServiceRecommendationsEngine({
        enableABTesting: false
      });
      
      await disabledEngine.initialize();
      
      const testConfig: ABTestConfig = {
        id: 'test-003',
        name: 'Test',
        variants: [],
        metrics: [],
        startDate: new Date(),
        endDate: new Date(),
        status: 'active'
      };

      await expect(disabledEngine.createABTest(testConfig)).rejects.toThrow('A/B testing is not enabled');
      
      await disabledEngine.shutdown();
    });
  });

  describe('Insights and Reporting', () => {
    beforeEach(async () => {
      await engine.initialize();
      
      // Generate some data
      const metrics1 = { ...mockMetrics };
      const metrics2 = { 
        ...mockMetrics,
        performance: { ...mockMetrics.performance, errorRate: 0.1 }
      };
      
      await engine.analyzeService('service-1', metrics1);
      await engine.analyzeService('service-2', metrics2);
    });

    test('should provide comprehensive insights', async () => {
      const insights = await engine.getInsights();
      
      expect(insights).toMatchObject({
        totalServices: expect.any(Number),
        totalRecommendations: expect.any(Number),
        categoryCounts: expect.any(Object),
        averageScore: expect.any(Number),
        topRecommendations: expect.any(Array),
        recentAnalyses: expect.any(Array)
      });

      expect(insights.totalServices).toBeGreaterThan(0);
      expect(insights.totalRecommendations).toBeGreaterThan(0);
    });

    test('should include learning metrics when enabled', async () => {
      const insights = await engine.getInsights();
      
      expect(insights.learningMetrics).toBeDefined();
      expect(insights.learningMetrics).toMatchObject({
        models: expect.any(Object),
        performance: expect.any(Array),
        feedbackSummary: expect.any(Object),
        activeABTests: expect.any(Array),
        trainingQueueSize: expect.any(Number)
      });
    });

    test('should return top recommendations sorted by score', async () => {
      const insights = await engine.getInsights();
      
      const scores = insights.topRecommendations.map((r: Recommendation) => r.score);
      
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
      }
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should handle invalid service metrics gracefully', async () => {
      const invalidMetrics = {} as ServiceMetrics;
      
      // Should not throw but handle gracefully
      const result = await engine.analyzeService('invalid-service', invalidMetrics);
      
      expect(result).toBeDefined();
      expect(result.serviceId).toBe('invalid-service');
    });

    test('should handle analysis failures', async () => {
      // Mock console.error to suppress output
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Force an error by passing null
      await expect(
        engine.analyzeService('error-service', null as any)
      ).rejects.toThrow();
      
      consoleError.mockRestore();
    });
  });

  describe('Shutdown', () => {
    test('should shutdown cleanly', async () => {
      await engine.initialize();
      
      const shutdownPromise = new Promise(resolve => {
        engine.once('shutdown', resolve);
      });
      
      await engine.shutdown();
      
      await expect(shutdownPromise).resolves.toBeDefined();
    });
  });
});