/**
 * Tests for Relationship Resolver
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RelationshipResolver } from '../relationships/relationship-resolver';
import { TransformedEntityData, EntityRelationship } from '../types';

describe('RelationshipResolver', () => {
  let resolver: RelationshipResolver;
  let testEntities: TransformedEntityData[];

  beforeEach(() => {
    resolver = new RelationshipResolver();

    testEntities = [
      {
        id: 'service-a',
        sourceId: 'test-source',
        entityRef: 'Component:default/service-a',
        kind: 'Component',
        metadata: {
          name: 'service-a',
          namespace: 'default',
          description: 'Service A',
        },
        spec: {
          type: 'service',
          owner: 'team-platform',
          lifecycle: 'production',
          system: 'platform-system',
        },
        rawData: {
          id: 'service-a',
          sourceId: 'test-source',
          type: 'Component',
          data: {},
          metadata: { discoveredAt: new Date() },
        },
        transformedBy: ['test'],
      },
      {
        id: 'api-a',
        sourceId: 'test-source',
        entityRef: 'API:default/api-a',
        kind: 'API',
        metadata: {
          name: 'api-a',
          namespace: 'default',
          description: 'API A',
        },
        spec: {
          type: 'openapi',
          owner: 'team-platform',
          system: 'platform-system',
          definition: 'https://example.com/api-a/openapi.yaml',
        },
        rawData: {
          id: 'api-a',
          sourceId: 'test-source',
          type: 'API',
          data: {},
          metadata: { discoveredAt: new Date() },
        },
        transformedBy: ['test'],
      },
      {
        id: 'team-platform',
        sourceId: 'test-source',
        entityRef: 'Group:default/team-platform',
        kind: 'Group',
        metadata: {
          name: 'team-platform',
          namespace: 'default',
          description: 'Platform Team',
        },
        spec: {
          type: 'team',
          children: [],
        },
        rawData: {
          id: 'team-platform',
          sourceId: 'test-source',
          type: 'Group',
          data: {},
          metadata: { discoveredAt: new Date() },
        },
        transformedBy: ['test'],
      },
      {
        id: 'platform-system',
        sourceId: 'test-source',
        entityRef: 'System:default/platform-system',
        kind: 'System',
        metadata: {
          name: 'platform-system',
          namespace: 'default',
          description: 'Platform System',
        },
        spec: {
          owner: 'team-platform',
        },
        rawData: {
          id: 'platform-system',
          sourceId: 'test-source',
          type: 'System',
          data: {},
          metadata: { discoveredAt: new Date() },
        },
        transformedBy: ['test'],
      },
    ];
  });

  describe('Basic Relationship Resolution', () => {
    it('should resolve ownership relationships', async () => {
      const relationships = await resolver.resolveRelationships(testEntities);
      
      const ownershipRelationships = relationships.filter(r => r.type === 'ownedBy');
      expect(ownershipRelationships.length).toBeGreaterThan(0);
      
      // Service should be owned by team
      const serviceOwnership = ownershipRelationships.find(r => 
        r.sourceRef === 'Component:default/service-a' && 
        r.targetRef === 'Group:default/team-platform'
      );
      expect(serviceOwnership).toBeDefined();
      expect(serviceOwnership?.confidence).toBeGreaterThan(0.8);
    });

    it('should resolve system membership relationships', async () => {
      const relationships = await resolver.resolveRelationships(testEntities);
      
      const membershipRelationships = relationships.filter(r => r.type === 'partOf');
      expect(membershipRelationships.length).toBeGreaterThan(0);
      
      // Service should be part of system
      const systemMembership = membershipRelationships.find(r => 
        r.sourceRef === 'Component:default/service-a' && 
        r.targetRef === 'System:default/platform-system'
      );
      expect(systemMembership).toBeDefined();
      expect(systemMembership?.confidence).toBeGreaterThan(0.9);
    });

    it('should resolve API provision relationships', async () => {
      const relationships = await resolver.resolveRelationships(testEntities);
      
      const provisionRelationships = relationships.filter(r => r.type === 'providesApi');
      expect(provisionRelationships.length).toBeGreaterThan(0);
      
      // Service should provide API (both in same system)
      const apiProvision = provisionRelationships.find(r => 
        r.sourceRef === 'Component:default/service-a' && 
        r.targetRef === 'API:default/api-a'
      );
      expect(apiProvision).toBeDefined();
    });
  });

  describe('Custom Rules', () => {
    it('should allow adding custom rules', () => {
      const customRule = {
        id: 'custom-rule',
        name: 'Custom Rule',
        description: 'Custom relationship rule for testing',
        relationshipType: 'dependsOn' as const,
        confidence: 0.7,
        matcher: jest.fn().mockReturnValue(true),
        extractor: jest.fn().mockReturnValue({ custom: true }),
      };

      expect(() => resolver.addRule(customRule)).not.toThrow();
    });

    it('should allow removing rules', () => {
      const customRule = {
        id: 'removable-rule',
        name: 'Removable Rule',
        description: 'Rule to be removed',
        relationshipType: 'dependsOn' as const,
        confidence: 0.5,
        matcher: jest.fn().mockReturnValue(false),
      };

      resolver.addRule(customRule);
      expect(() => resolver.removeRule('removable-rule')).not.toThrow();
    });

    it('should apply custom rules during resolution', async () => {
      const customRule = {
        id: 'test-dependency-rule',
        name: 'Test Dependency Rule',
        description: 'Creates test dependencies',
        relationshipType: 'dependsOn' as const,
        confidence: 0.8,
        matcher: (source: TransformedEntityData, target: TransformedEntityData) => {
          return source.kind === 'Component' && target.kind === 'API';
        },
        extractor: () => ({ ruleType: 'test-dependency' }),
      };

      resolver.addRule(customRule);
      const relationships = await resolver.resolveRelationships(testEntities);
      
      const testDependencies = relationships.filter(r => 
        r.type === 'dependsOn' && 
        r.metadata?.ruleType === 'test-dependency'
      );
      
      expect(testDependencies.length).toBeGreaterThan(0);
    });
  });

  describe('Relationship Quality', () => {
    it('should assign appropriate confidence scores', async () => {
      const relationships = await resolver.resolveRelationships(testEntities);
      
      // All relationships should have confidence between 0 and 1
      relationships.forEach(relationship => {
        expect(relationship.confidence).toBeGreaterThanOrEqual(0);
        expect(relationship.confidence).toBeLessThanOrEqual(1);
      });
      
      // High-confidence relationships (spec.owner) should have higher scores
      const ownershipRelationships = relationships.filter(r => r.type === 'ownedBy');
      const avgOwnershipConfidence = ownershipRelationships.reduce((sum, r) => sum + r.confidence, 0) / ownershipRelationships.length;
      expect(avgOwnershipConfidence).toBeGreaterThan(0.8);
    });

    it('should include metadata about rule application', async () => {
      const relationships = await resolver.resolveRelationships(testEntities);
      
      relationships.forEach(relationship => {
        expect(relationship).toHaveProperty('metadata');
        expect(relationship).toHaveProperty('source');
        expect(relationship).toHaveProperty('createdAt');
        expect(relationship).toHaveProperty('updatedAt');
      });
    });

    it('should merge relationships from multiple rules', async () => {
      // Add two rules that could create the same relationship
      const rule1 = {
        id: 'rule-1',
        name: 'Rule 1',
        description: 'First rule',
        relationshipType: 'dependsOn' as const,
        confidence: 0.6,
        matcher: (source: TransformedEntityData, target: TransformedEntityData) => {
          return source.metadata.name === 'service-a' && target.metadata.name === 'api-a';
        },
        extractor: () => ({ source: 'rule-1' }),
      };

      const rule2 = {
        id: 'rule-2',
        name: 'Rule 2',
        description: 'Second rule',
        relationshipType: 'dependsOn' as const,
        confidence: 0.8,
        matcher: (source: TransformedEntityData, target: TransformedEntityData) => {
          return source.metadata.name === 'service-a' && target.metadata.name === 'api-a';
        },
        extractor: () => ({ source: 'rule-2' }),
      };

      resolver.addRule(rule1);
      resolver.addRule(rule2);

      const relationships = await resolver.resolveRelationships(testEntities);
      
      // Should merge into single relationship with higher confidence
      const mergedRelationships = relationships.filter(r => 
        r.sourceRef === 'Component:default/service-a' && 
        r.targetRef === 'API:default/api-a' && 
        r.type === 'dependsOn'
      );
      
      expect(mergedRelationships).toHaveLength(1);
      expect(mergedRelationships[0].confidence).toBe(0.8); // Should take higher confidence
    });
  });

  describe('Event Emission', () => {
    it('should emit resolution events', async () => {
      const startListener = jest.fn();
      const completedListener = jest.fn();
      
      resolver.on('resolutionStarted', startListener);
      resolver.on('resolutionCompleted', completedListener);
      
      await resolver.resolveRelationships(testEntities);
      
      expect(startListener).toHaveBeenCalledWith({ entityCount: testEntities.length });
      expect(completedListener).toHaveBeenCalledWith(
        expect.objectContaining({
          entityCount: testEntities.length,
          relationshipCount: expect.any(Number),
        })
      );
    });

    it('should emit rule management events', () => {
      const ruleAddedListener = jest.fn();
      const ruleRemovedListener = jest.fn();
      
      resolver.on('ruleAdded', ruleAddedListener);
      resolver.on('ruleRemoved', ruleRemovedListener);
      
      const testRule = {
        id: 'event-test-rule',
        name: 'Event Test Rule',
        description: 'Rule for testing events',
        relationshipType: 'dependsOn' as const,
        confidence: 0.5,
        matcher: () => false,
      };
      
      resolver.addRule(testRule);
      expect(ruleAddedListener).toHaveBeenCalledWith(testRule);
      
      resolver.removeRule('event-test-rule');
      expect(ruleRemovedListener).toHaveBeenCalledWith(testRule);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty entity list', async () => {
      const relationships = await resolver.resolveRelationships([]);
      expect(relationships).toEqual([]);
    });

    it('should handle entities with missing fields', async () => {
      const incompleteEntities = [
        {
          id: 'incomplete',
          sourceId: 'test',
          entityRef: 'Component:default/incomplete',
          kind: 'Component',
          metadata: { name: 'incomplete', namespace: 'default' },
          spec: {}, // Missing owner and other fields
          rawData: {
            id: 'incomplete',
            sourceId: 'test',
            type: 'Component',
            data: {},
            metadata: { discoveredAt: new Date() },
          },
          transformedBy: ['test'],
        },
      ];

      const relationships = await resolver.resolveRelationships(incompleteEntities);
      expect(relationships).toEqual([]);
    });

    it('should avoid self-references', async () => {
      const relationships = await resolver.resolveRelationships(testEntities);
      
      // No relationship should have the same source and target
      relationships.forEach(relationship => {
        expect(relationship.sourceRef).not.toBe(relationship.targetRef);
      });
    });

    it('should handle circular dependencies gracefully', async () => {
      const circularEntities = [
        {
          id: 'service-x',
          sourceId: 'test',
          entityRef: 'Component:default/service-x',
          kind: 'Component',
          metadata: { name: 'service-x', namespace: 'default' },
          spec: { dependencies: ['Component:default/service-y'] },
          rawData: {
            id: 'service-x',
            sourceId: 'test',
            type: 'Component',
            data: {},
            metadata: { discoveredAt: new Date() },
          },
          transformedBy: ['test'],
        },
        {
          id: 'service-y',
          sourceId: 'test',
          entityRef: 'Component:default/service-y',
          kind: 'Component',
          metadata: { name: 'service-y', namespace: 'default' },
          spec: { dependencies: ['Component:default/service-x'] },
          rawData: {
            id: 'service-y',
            sourceId: 'test',
            type: 'Component',
            data: {},
            metadata: { discoveredAt: new Date() },
          },
          transformedBy: ['test'],
        },
      ];

      // Should not throw error even with circular dependencies
      const relationships = await resolver.resolveRelationships(circularEntities);
      expect(relationships).toBeDefined();
    });
  });
});