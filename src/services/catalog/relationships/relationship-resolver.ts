/**
 * Relationship Resolver
 * 
 * Automatically infers and resolves relationships between entities
 * based on multiple sources of information and heuristics.
 */

import { EventEmitter } from 'events';
import {
  TransformedEntityData,
  EntityRelationship,
  IRelationshipResolver,
} from '../types';

interface RelationshipRule {
  id: string;
  name: string;
  description: string;
  sourceKind?: string;
  targetKind?: string;
  relationshipType: EntityRelationship['type'];
  confidence: number;
  matcher: (source: TransformedEntityData, target: TransformedEntityData) => boolean;
  extractor?: (source: TransformedEntityData, target: TransformedEntityData) => Record<string, unknown>;
}

interface RelationshipCandidate {
  sourceRef: string;
  targetRef: string;
  type: EntityRelationship['type'];
  confidence: number;
  rules: string[];
  metadata: Record<string, unknown>;
}

export class RelationshipResolver extends EventEmitter implements IRelationshipResolver {
  readonly id = 'core-relationship-resolver';
  readonly name = 'Core Relationship Resolver';

  private readonly rules: RelationshipRule[] = [];

  constructor() {
    super();
    this.initializeDefaultRules();
  }

  /**
   * Resolve relationships between entities
   */
  async resolveRelationships(entities: TransformedEntityData[]): Promise<EntityRelationship[]> {
    const relationships: EntityRelationship[] = [];
    const candidates = new Map<string, RelationshipCandidate>();

    this.emit('resolutionStarted', { entityCount: entities.length });

    // Generate relationship candidates using all rules
    for (const rule of this.rules) {
      const ruleCandidates = this.applyRule(rule, entities);
      
      for (const candidate of ruleCandidates) {
        const key = `${candidate.sourceRef}:${candidate.targetRef}:${candidate.type}`;
        const existing = candidates.get(key);
        
        if (existing) {
          // Merge candidates from multiple rules
          existing.confidence = Math.max(existing.confidence, candidate.confidence);
          existing.rules.push(...candidate.rules);
          existing.metadata = { ...existing.metadata, ...candidate.metadata };
        } else {
          candidates.set(key, candidate);
        }
      }
    }

    // Convert candidates to relationships
    for (const candidate of candidates.values()) {
      const relationship: EntityRelationship = {
        id: this.generateRelationshipId(candidate.sourceRef, candidate.targetRef, candidate.type),
        sourceRef: candidate.sourceRef,
        targetRef: candidate.targetRef,
        type: candidate.type,
        confidence: candidate.confidence,
        source: this.id,
        metadata: {
          rules: candidate.rules,
          ...candidate.metadata,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      relationships.push(relationship);
    }

    this.emit('resolutionCompleted', { 
      entityCount: entities.length, 
      relationshipCount: relationships.length 
    });

    return relationships;
  }

  /**
   * Add a custom relationship rule
   */
  addRule(rule: RelationshipRule): void {
    this.rules.push(rule);
    this.emit('ruleAdded', rule);
  }

  /**
   * Remove a relationship rule
   */
  removeRule(ruleId: string): void {
    const index = this.rules.findIndex(rule => rule.id === ruleId);
    if (index !== -1) {
      const removed = this.rules.splice(index, 1)[0];
      this.emit('ruleRemoved', removed);
    }
  }

  /**
   * Apply a rule to find relationship candidates
   */
  private applyRule(rule: RelationshipRule, entities: TransformedEntityData[]): RelationshipCandidate[] {
    const candidates: RelationshipCandidate[] = [];

    for (const sourceEntity of entities) {
      // Skip if rule specifies source kind and it doesn't match
      if (rule.sourceKind && sourceEntity.kind !== rule.sourceKind) {
        continue;
      }

      for (const targetEntity of entities) {
        // Skip if rule specifies target kind and it doesn't match
        if (rule.targetKind && targetEntity.kind !== rule.targetKind) {
          continue;
        }

        // Skip self-references
        if (sourceEntity.entityRef === targetEntity.entityRef) {
          continue;
        }

        // Apply rule matcher
        if (rule.matcher(sourceEntity, targetEntity)) {
          const metadata = rule.extractor ? rule.extractor(sourceEntity, targetEntity) : {};

          candidates.push({
            sourceRef: sourceEntity.entityRef,
            targetRef: targetEntity.entityRef,
            type: rule.relationshipType,
            confidence: rule.confidence,
            rules: [rule.id],
            metadata,
          });
        }
      }
    }

    return candidates;
  }

  /**
   * Initialize default relationship rules
   */
  private initializeDefaultRules(): void {
    // Owner relationships based on spec.owner
    this.addRule({
      id: 'spec-owner',
      name: 'Specification Owner',
      description: 'Finds ownership relationships based on spec.owner field',
      relationshipType: 'ownedBy',
      confidence: 0.9,
      matcher: (source, target) => {
        const owner = source.spec.owner as string;
        return owner && (
          owner === target.metadata.name ||
          owner === target.entityRef ||
          owner === `user:${target.metadata.name}` ||
          owner === `group:${target.metadata.name}`
        );
      },
      extractor: (source) => ({
        ownerField: source.spec.owner,
      }),
    });

    // API consumption relationships
    this.addRule({
      id: 'api-consumption',
      name: 'API Consumption',
      description: 'Finds API consumption relationships based on dependencies and URLs',
      sourceKind: 'Component',
      targetKind: 'API',
      relationshipType: 'consumesApi',
      confidence: 0.8,
      matcher: (source, target) => {
        // Check dependencies
        const dependencies = source.spec.dependencies as string[] || [];
        if (dependencies.includes(target.entityRef) || dependencies.includes(target.metadata.name)) {
          return true;
        }

        // Check if component references API URL
        const sourceStr = JSON.stringify(source.spec).toLowerCase();
        const apiUrl = target.spec.definition as string;
        
        if (apiUrl && sourceStr.includes(apiUrl.toLowerCase())) {
          return true;
        }

        return false;
      },
      extractor: (source, target) => ({
        detectionMethod: 'dependency-analysis',
        apiUrl: target.spec.definition,
      }),
    });

    // API provision relationships
    this.addRule({
      id: 'api-provision',
      name: 'API Provision',
      description: 'Finds API provision relationships based on service definitions',
      sourceKind: 'Component',
      targetKind: 'API',
      relationshipType: 'providesApi',
      confidence: 0.85,
      matcher: (source, target) => {
        // Check if component provides the API
        const providesApis = source.spec.providesApis as string[] || [];
        if (providesApis.includes(target.entityRef) || providesApis.includes(target.metadata.name)) {
          return true;
        }

        // Check if API spec references the component
        const apiOwner = target.spec.owner as string;
        if (apiOwner === source.metadata.name || apiOwner === source.entityRef) {
          return true;
        }

        // Check system membership
        const sourceSystem = source.spec.system as string;
        const targetSystem = target.spec.system as string;
        
        return sourceSystem && targetSystem && sourceSystem === targetSystem;
      },
      extractor: (source, target) => ({
        detectionMethod: 'specification-analysis',
        system: source.spec.system,
      }),
    });

    // System membership relationships
    this.addRule({
      id: 'system-membership',
      name: 'System Membership',
      description: 'Finds part-of relationships for system membership',
      targetKind: 'System',
      relationshipType: 'partOf',
      confidence: 0.95,
      matcher: (source, target) => {
        const system = source.spec.system as string;
        return system && (
          system === target.metadata.name ||
          system === target.entityRef
        );
      },
      extractor: (source, target) => ({
        systemField: source.spec.system,
      }),
    });

    // Infrastructure deployment relationships
    this.addRule({
      id: 'deployment-infrastructure',
      name: 'Deployment Infrastructure',
      description: 'Finds deployment relationships based on infrastructure references',
      sourceKind: 'Component',
      targetKind: 'Resource',
      relationshipType: 'deployedOn',
      confidence: 0.8,
      matcher: (source, target) => {
        // Check annotations for deployment info
        const deploymentAnnotations = [
          'kubernetes.io/namespace',
          'kubernetes.io/deployment',
          'aws.amazon.com/ecs-service',
          'gcp.google.com/gke-cluster',
        ];

        for (const annotation of deploymentAnnotations) {
          const value = source.metadata.annotations?.[annotation];
          if (value && (
            value.includes(target.metadata.name) ||
            JSON.stringify(target.spec).includes(value)
          )) {
            return true;
          }
        }

        return false;
      },
      extractor: (source, target) => ({
        detectionMethod: 'annotation-analysis',
        annotations: source.metadata.annotations,
      }),
    });

    // Domain relationships
    this.addRule({
      id: 'domain-membership',
      name: 'Domain Membership',
      description: 'Finds part-of relationships for domain membership',
      targetKind: 'Domain',
      relationshipType: 'partOf',
      confidence: 0.9,
      matcher: (source, target) => {
        const domain = source.spec.domain as string;
        return domain && (
          domain === target.metadata.name ||
          domain === target.entityRef
        );
      },
      extractor: (source, target) => ({
        domainField: source.spec.domain,
      }),
    });

    // Technology stack dependencies
    this.addRule({
      id: 'technology-dependencies',
      name: 'Technology Dependencies',
      description: 'Infers dependencies based on technology stack similarities',
      relationshipType: 'dependsOn',
      confidence: 0.6,
      matcher: (source, target) => {
        const sourceTech = this.extractTechnologyStack(source);
        const targetTech = this.extractTechnologyStack(target);
        
        // Check for shared databases
        const sharedDatabases = sourceTech.databases.filter(db => 
          targetTech.databases.includes(db)
        );
        
        if (sharedDatabases.length > 0) {
          return true;
        }

        // Check for message queue dependencies
        const sharedQueues = sourceTech.messageQueues.filter(queue =>
          targetTech.messageQueues.includes(queue)
        );
        
        return sharedQueues.length > 0;
      },
      extractor: (source, target) => {
        const sourceTech = this.extractTechnologyStack(source);
        const targetTech = this.extractTechnologyStack(target);
        
        return {
          detectionMethod: 'technology-stack-analysis',
          sharedTechnologies: {
            databases: sourceTech.databases.filter(db => targetTech.databases.includes(db)),
            messageQueues: sourceTech.messageQueues.filter(q => targetTech.messageQueues.includes(q)),
          },
        };
      },
    });

    // Git repository relationships
    this.addRule({
      id: 'git-repository',
      name: 'Git Repository Ownership',
      description: 'Finds ownership relationships based on Git repository information',
      relationshipType: 'ownedBy',
      confidence: 0.7,
      matcher: (source, target) => {
        const sourceRepo = source.metadata.annotations?.['github.com/project-slug'] ||
                          source.metadata.annotations?.['gitlab.com/project-slug'];
        
        const targetRepo = target.metadata.annotations?.['github.com/project-slug'] ||
                          target.metadata.annotations?.['gitlab.com/project-slug'];
        
        if (sourceRepo && targetRepo) {
          // Extract organization/team from repository path
          const sourceOrg = sourceRepo.split('/')[0];
          const targetName = target.metadata.name;
          
          return sourceOrg.toLowerCase().includes(targetName.toLowerCase()) ||
                 targetName.toLowerCase().includes(sourceOrg.toLowerCase());
        }

        return false;
      },
      extractor: (source, target) => ({
        detectionMethod: 'git-repository-analysis',
        sourceRepository: source.metadata.annotations?.['github.com/project-slug'],
        targetRepository: target.metadata.annotations?.['github.com/project-slug'],
      }),
    });
  }

  /**
   * Extract technology stack from entity
   */
  private extractTechnologyStack(entity: TransformedEntityData): {
    databases: string[];
    messageQueues: string[];
    frameworks: string[];
  } {
    const entityStr = JSON.stringify(entity).toLowerCase();
    
    const databases = [
      'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'elasticsearch',
      'cassandra', 'dynamodb', 'sqlite', 'oracle', 'mssql'
    ].filter(db => entityStr.includes(db));
    
    const messageQueues = [
      'kafka', 'rabbitmq', 'activemq', 'sqs', 'pubsub', 'nats', 'pulsar'
    ].filter(queue => entityStr.includes(queue));
    
    const frameworks = [
      'spring', 'express', 'django', 'flask', 'rails', 'laravel', 'nextjs', 'react'
    ].filter(framework => entityStr.includes(framework));
    
    return { databases, messageQueues, frameworks };
  }

  /**
   * Generate relationship ID
   */
  private generateRelationshipId(sourceRef: string, targetRef: string, type: string): string {
    return `${sourceRef}:${type}:${targetRef}`.replace(/[^a-zA-Z0-9:/-]/g, '-');
  }
}

export default RelationshipResolver;