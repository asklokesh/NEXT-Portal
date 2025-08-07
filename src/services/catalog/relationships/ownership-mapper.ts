/**
 * Ownership Mapper
 * 
 * Maps entities to teams and individuals, resolves ownership conflicts,
 * and maintains team hierarchies and responsibilities.
 */

import { EventEmitter } from 'events';
import {
  TransformedEntityData,
  EntityRelationship,
} from '../types';

interface OwnershipRule {
  id: string;
  name: string;
  priority: number;
  matcher: (entity: TransformedEntityData) => boolean;
  extractor: (entity: TransformedEntityData) => OwnershipCandidate[];
}

interface OwnershipCandidate {
  type: 'user' | 'group' | 'team';
  identifier: string;
  confidence: number;
  source: string;
  metadata: Record<string, unknown>;
}

interface OwnershipMapping {
  entityRef: string;
  primaryOwner?: OwnershipCandidate;
  secondaryOwners: OwnershipCandidate[];
  conflicts: OwnershipConflict[];
  lastUpdated: Date;
}

interface OwnershipConflict {
  type: 'multiple_primary' | 'conflicting_sources' | 'missing_owner';
  candidates: OwnershipCandidate[];
  reason: string;
}

interface TeamHierarchy {
  id: string;
  name: string;
  type: 'organization' | 'division' | 'department' | 'team' | 'squad';
  parentId?: string;
  children: string[];
  members: string[];
  responsibilities: string[];
  contacts: {
    email?: string;
    slack?: string;
    wiki?: string;
  };
}

interface OwnershipStatistics {
  totalEntities: number;
  ownedEntities: number;
  unownedEntities: number;
  conflictedEntities: number;
  ownershipByType: Record<string, number>;
  topOwners: Array<{ owner: string; count: number }>;
}

export class OwnershipMapper extends EventEmitter {
  private readonly rules: OwnershipRule[] = [];
  private readonly mappings = new Map<string, OwnershipMapping>();
  private readonly teamHierarchy = new Map<string, TeamHierarchy>();
  private readonly userProfiles = new Map<string, {
    id: string;
    name: string;
    email: string;
    teams: string[];
    roles: string[];
  }>();

  constructor() {
    super();
    this.initializeDefaultRules();
  }

  /**
   * Map ownership for entities
   */
  async mapOwnership(entities: TransformedEntityData[]): Promise<OwnershipMapping[]> {
    this.emit('ownershipMappingStarted', { entityCount: entities.length });
    
    const mappings: OwnershipMapping[] = [];

    for (const entity of entities) {
      const mapping = await this.mapEntityOwnership(entity);
      mappings.push(mapping);
      this.mappings.set(entity.entityRef, mapping);
    }

    // Resolve conflicts
    await this.resolveOwnershipConflicts(mappings);

    this.emit('ownershipMappingCompleted', {
      entityCount: entities.length,
      mappings: mappings.length,
      conflicts: mappings.reduce((sum, m) => sum + m.conflicts.length, 0),
    });

    return mappings;
  }

  /**
   * Map ownership for a single entity
   */
  private async mapEntityOwnership(entity: TransformedEntityData): Promise<OwnershipMapping> {
    const candidates: OwnershipCandidate[] = [];
    
    // Apply all rules to find ownership candidates
    for (const rule of this.rules.sort((a, b) => b.priority - a.priority)) {
      if (rule.matcher(entity)) {
        const ruleCandidates = rule.extractor(entity);
        candidates.push(...ruleCandidates);
      }
    }

    // Deduplicate and merge candidates
    const mergedCandidates = this.mergeCandidates(candidates);
    
    // Find primary owner (highest confidence)
    const primaryOwner = mergedCandidates.reduce((best, candidate) => 
      (!best || candidate.confidence > best.confidence) ? candidate : best
    , undefined as OwnershipCandidate | undefined);

    // Find secondary owners
    const secondaryOwners = mergedCandidates.filter(c => c !== primaryOwner);

    // Detect conflicts
    const conflicts = this.detectConflicts(mergedCandidates);

    const mapping: OwnershipMapping = {
      entityRef: entity.entityRef,
      primaryOwner,
      secondaryOwners,
      conflicts,
      lastUpdated: new Date(),
    };

    this.emit('entityOwnershipMapped', mapping);
    return mapping;
  }

  /**
   * Add ownership rule
   */
  addRule(rule: OwnershipRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
    this.emit('ownershipRuleAdded', rule);
  }

  /**
   * Register team hierarchy
   */
  registerTeamHierarchy(teams: TeamHierarchy[]): void {
    this.teamHierarchy.clear();
    
    for (const team of teams) {
      this.teamHierarchy.set(team.id, team);
    }

    // Build parent-child relationships
    for (const team of teams) {
      if (team.parentId) {
        const parent = this.teamHierarchy.get(team.parentId);
        if (parent && !parent.children.includes(team.id)) {
          parent.children.push(team.id);
        }
      }
    }

    this.emit('teamHierarchyRegistered', { teamCount: teams.length });
  }

  /**
   * Register user profiles
   */
  registerUserProfiles(users: Array<{
    id: string;
    name: string;
    email: string;
    teams: string[];
    roles: string[];
  }>): void {
    this.userProfiles.clear();
    
    for (const user of users) {
      this.userProfiles.set(user.id, user);
    }

    this.emit('userProfilesRegistered', { userCount: users.length });
  }

  /**
   * Get ownership mapping for an entity
   */
  getOwnership(entityRef: string): OwnershipMapping | undefined {
    return this.mappings.get(entityRef);
  }

  /**
   * Get entities owned by a specific owner
   */
  getEntitiesByOwner(ownerId: string): OwnershipMapping[] {
    return Array.from(this.mappings.values()).filter(mapping =>
      mapping.primaryOwner?.identifier === ownerId ||
      mapping.secondaryOwners.some(owner => owner.identifier === ownerId)
    );
  }

  /**
   * Get ownership statistics
   */
  getStatistics(): OwnershipStatistics {
    const mappings = Array.from(this.mappings.values());
    
    const ownedEntities = mappings.filter(m => m.primaryOwner).length;
    const conflictedEntities = mappings.filter(m => m.conflicts.length > 0).length;
    
    const ownershipByType: Record<string, number> = {};
    const ownerCounts = new Map<string, number>();
    
    for (const mapping of mappings) {
      if (mapping.primaryOwner) {
        ownershipByType[mapping.primaryOwner.type] = (ownershipByType[mapping.primaryOwner.type] || 0) + 1;
        
        const count = ownerCounts.get(mapping.primaryOwner.identifier) || 0;
        ownerCounts.set(mapping.primaryOwner.identifier, count + 1);
      }
    }
    
    const topOwners = Array.from(ownerCounts.entries())
      .map(([owner, count]) => ({ owner, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalEntities: mappings.length,
      ownedEntities,
      unownedEntities: mappings.length - ownedEntities,
      conflictedEntities,
      ownershipByType,
      topOwners,
    };
  }

  /**
   * Resolve ownership conflicts
   */
  private async resolveOwnershipConflicts(mappings: OwnershipMapping[]): Promise<void> {
    for (const mapping of mappings) {
      if (mapping.conflicts.length > 0) {
        await this.resolveEntityConflicts(mapping);
      }
    }
  }

  /**
   * Resolve conflicts for a single entity
   */
  private async resolveEntityConflicts(mapping: OwnershipMapping): Promise<void> {
    const resolvedConflicts: OwnershipConflict[] = [];

    for (const conflict of mapping.conflicts) {
      switch (conflict.type) {
        case 'multiple_primary':
          const resolved = await this.resolveMultiplePrimaryOwners(conflict.candidates);
          if (resolved) {
            mapping.primaryOwner = resolved;
            mapping.secondaryOwners.push(...conflict.candidates.filter(c => c !== resolved));
          }
          break;

        case 'conflicting_sources':
          await this.resolveConflictingSources(conflict.candidates, mapping);
          break;

        case 'missing_owner':
          const inferred = await this.inferOwnershipFromContext(mapping.entityRef);
          if (inferred) {
            mapping.primaryOwner = inferred;
          } else {
            resolvedConflicts.push(conflict);
          }
          break;
      }
    }

    mapping.conflicts = resolvedConflicts;
    
    if (resolvedConflicts.length === 0) {
      this.emit('ownershipConflictResolved', mapping);
    }
  }

  /**
   * Resolve multiple primary owners by selecting highest confidence
   */
  private async resolveMultiplePrimaryOwners(candidates: OwnershipCandidate[]): Promise<OwnershipCandidate | null> {
    // Sort by confidence and select highest
    const sorted = candidates.sort((a, b) => b.confidence - a.confidence);
    
    // If there's a clear winner (significant confidence difference)
    if (sorted.length >= 2 && (sorted[0].confidence - sorted[1].confidence) >= 0.2) {
      return sorted[0];
    }

    // Check team hierarchy - prefer parent teams
    for (const candidate of sorted) {
      if (candidate.type === 'team' || candidate.type === 'group') {
        const team = this.teamHierarchy.get(candidate.identifier);
        if (team && team.parentId) {
          // This is a child team, prefer it over parent teams
          return candidate;
        }
      }
    }

    return sorted[0]; // Default to highest confidence
  }

  /**
   * Resolve conflicting sources
   */
  private async resolveConflictingSources(candidates: OwnershipCandidate[], mapping: OwnershipMapping): Promise<void> {
    // Group by source and merge
    const sourceGroups = new Map<string, OwnershipCandidate[]>();
    
    for (const candidate of candidates) {
      const group = sourceGroups.get(candidate.source) || [];
      group.push(candidate);
      sourceGroups.set(candidate.source, group);
    }

    // Merge candidates from each source
    const mergedCandidates: OwnershipCandidate[] = [];
    
    for (const [source, sourceCandidates] of sourceGroups) {
      const merged = this.mergeCandidates(sourceCandidates);
      mergedCandidates.push(...merged);
    }

    // Update mapping with merged candidates
    const primary = mergedCandidates.reduce((best, candidate) =>
      (!best || candidate.confidence > best.confidence) ? candidate : best
    , undefined as OwnershipCandidate | undefined);

    if (primary) {
      mapping.primaryOwner = primary;
      mapping.secondaryOwners = mergedCandidates.filter(c => c !== primary);
    }
  }

  /**
   * Infer ownership from entity context
   */
  private async inferOwnershipFromContext(entityRef: string): Promise<OwnershipCandidate | null> {
    // Try to infer from entity name patterns
    const [kind, namespaceAndName] = entityRef.split(':');
    const [namespace, name] = namespaceAndName.split('/');
    
    // Check if namespace matches a known team
    for (const team of this.teamHierarchy.values()) {
      if (team.name.toLowerCase() === namespace.toLowerCase() ||
          team.id.toLowerCase() === namespace.toLowerCase()) {
        return {
          type: 'team',
          identifier: team.id,
          confidence: 0.7,
          source: 'namespace-inference',
          metadata: { inferredFrom: 'namespace' },
        };
      }
    }

    // Check entity name for team patterns
    const nameTokens = name.toLowerCase().split('-');
    for (const team of this.teamHierarchy.values()) {
      const teamTokens = team.name.toLowerCase().split(/[-\s]/);
      const commonTokens = nameTokens.filter(token => teamTokens.includes(token));
      
      if (commonTokens.length > 0) {
        return {
          type: 'team',
          identifier: team.id,
          confidence: 0.5 + (commonTokens.length * 0.1),
          source: 'name-pattern-inference',
          metadata: { 
            inferredFrom: 'name-pattern',
            commonTokens,
          },
        };
      }
    }

    return null;
  }

  /**
   * Merge duplicate candidates
   */
  private mergeCandidates(candidates: OwnershipCandidate[]): OwnershipCandidate[] {
    const merged = new Map<string, OwnershipCandidate>();
    
    for (const candidate of candidates) {
      const key = `${candidate.type}:${candidate.identifier}`;
      const existing = merged.get(key);
      
      if (existing) {
        // Merge candidates - take highest confidence and combine metadata
        existing.confidence = Math.max(existing.confidence, candidate.confidence);
        existing.metadata = { ...existing.metadata, ...candidate.metadata };
        existing.source = `${existing.source},${candidate.source}`;
      } else {
        merged.set(key, { ...candidate });
      }
    }
    
    return Array.from(merged.values());
  }

  /**
   * Detect ownership conflicts
   */
  private detectConflicts(candidates: OwnershipCandidate[]): OwnershipConflict[] {
    const conflicts: OwnershipConflict[] = [];
    
    if (candidates.length === 0) {
      conflicts.push({
        type: 'missing_owner',
        candidates: [],
        reason: 'No ownership candidates found',
      });
    } else if (candidates.length > 1) {
      const highConfidenceCandidates = candidates.filter(c => c.confidence >= 0.8);
      
      if (highConfidenceCandidates.length > 1) {
        conflicts.push({
          type: 'multiple_primary',
          candidates: highConfidenceCandidates,
          reason: 'Multiple high-confidence ownership candidates',
        });
      }
      
      // Check for conflicting sources
      const sourceGroups = new Map<string, OwnershipCandidate[]>();
      for (const candidate of candidates) {
        const group = sourceGroups.get(candidate.source) || [];
        group.push(candidate);
        sourceGroups.set(candidate.source, group);
      }
      
      if (sourceGroups.size > 1 && candidates.length > sourceGroups.size) {
        conflicts.push({
          type: 'conflicting_sources',
          candidates,
          reason: 'Ownership information from multiple conflicting sources',
        });
      }
    }
    
    return conflicts;
  }

  /**
   * Initialize default ownership rules
   */
  private initializeDefaultRules(): void {
    // Spec owner field
    this.addRule({
      id: 'spec-owner',
      name: 'Specification Owner Field',
      priority: 100,
      matcher: (entity) => Boolean(entity.spec.owner),
      extractor: (entity) => {
        const owner = entity.spec.owner as string;
        const type = this.determineOwnerType(owner);
        
        return [{
          type,
          identifier: this.normalizeOwnerIdentifier(owner, type),
          confidence: 0.95,
          source: 'spec-owner-field',
          metadata: { field: 'spec.owner', rawValue: owner },
        }];
      },
    });

    // GitHub/GitLab repository ownership
    this.addRule({
      id: 'git-repository-owner',
      name: 'Git Repository Owner',
      priority: 80,
      matcher: (entity) => Boolean(
        entity.metadata.annotations?.['github.com/project-slug'] ||
        entity.metadata.annotations?.['gitlab.com/project-slug']
      ),
      extractor: (entity) => {
        const githubSlug = entity.metadata.annotations?.['github.com/project-slug'];
        const gitlabSlug = entity.metadata.annotations?.['gitlab.com/project-slug'];
        
        const slug = githubSlug || gitlabSlug;
        const organization = slug?.split('/')[0];
        
        if (organization) {
          return [{
            type: 'group',
            identifier: organization,
            confidence: 0.8,
            source: githubSlug ? 'github-repository' : 'gitlab-repository',
            metadata: { repository: slug, organization },
          }];
        }
        
        return [];
      },
    });

    // Namespace-based ownership
    this.addRule({
      id: 'namespace-owner',
      name: 'Namespace-based Ownership',
      priority: 60,
      matcher: (entity) => entity.metadata.namespace !== 'default',
      extractor: (entity) => {
        const namespace = entity.metadata.namespace;
        
        return [{
          type: 'team',
          identifier: namespace,
          confidence: 0.7,
          source: 'namespace',
          metadata: { namespace },
        }];
      },
    });

    // Label-based ownership
    this.addRule({
      id: 'label-owner',
      name: 'Label-based Ownership',
      priority: 70,
      matcher: (entity) => Boolean(
        entity.metadata.labels?.owner ||
        entity.metadata.labels?.team ||
        entity.metadata.labels?.['app.kubernetes.io/managed-by']
      ),
      extractor: (entity) => {
        const candidates: OwnershipCandidate[] = [];
        const labels = entity.metadata.labels || {};
        
        if (labels.owner) {
          candidates.push({
            type: this.determineOwnerType(labels.owner),
            identifier: this.normalizeOwnerIdentifier(labels.owner, this.determineOwnerType(labels.owner)),
            confidence: 0.85,
            source: 'label-owner',
            metadata: { label: 'owner', value: labels.owner },
          });
        }
        
        if (labels.team) {
          candidates.push({
            type: 'team',
            identifier: labels.team,
            confidence: 0.8,
            source: 'label-team',
            metadata: { label: 'team', value: labels.team },
          });
        }
        
        if (labels['app.kubernetes.io/managed-by']) {
          candidates.push({
            type: 'team',
            identifier: labels['app.kubernetes.io/managed-by'],
            confidence: 0.75,
            source: 'k8s-managed-by-label',
            metadata: { label: 'app.kubernetes.io/managed-by', value: labels['app.kubernetes.io/managed-by'] },
          });
        }
        
        return candidates;
      },
    });

    // Annotation-based ownership
    this.addRule({
      id: 'annotation-owner',
      name: 'Annotation-based Ownership',
      priority: 65,
      matcher: (entity) => Boolean(
        entity.metadata.annotations?.owner ||
        entity.metadata.annotations?.team ||
        entity.metadata.annotations?.contact
      ),
      extractor: (entity) => {
        const candidates: OwnershipCandidate[] = [];
        const annotations = entity.metadata.annotations || {};
        
        if (annotations.owner) {
          candidates.push({
            type: this.determineOwnerType(annotations.owner),
            identifier: this.normalizeOwnerIdentifier(annotations.owner, this.determineOwnerType(annotations.owner)),
            confidence: 0.8,
            source: 'annotation-owner',
            metadata: { annotation: 'owner', value: annotations.owner },
          });
        }
        
        if (annotations.team) {
          candidates.push({
            type: 'team',
            identifier: annotations.team,
            confidence: 0.75,
            source: 'annotation-team',
            metadata: { annotation: 'team', value: annotations.team },
          });
        }
        
        if (annotations.contact) {
          const contactType = annotations.contact.includes('@') ? 'user' : 'team';
          candidates.push({
            type: contactType,
            identifier: annotations.contact,
            confidence: 0.7,
            source: 'annotation-contact',
            metadata: { annotation: 'contact', value: annotations.contact },
          });
        }
        
        return candidates;
      },
    });
  }

  /**
   * Determine owner type from identifier
   */
  private determineOwnerType(identifier: string): 'user' | 'group' | 'team' {
    if (identifier.includes('@')) {
      return 'user';
    }
    
    if (identifier.startsWith('user:')) {
      return 'user';
    }
    
    if (identifier.startsWith('group:') || identifier.startsWith('org:')) {
      return 'group';
    }
    
    if (identifier.startsWith('team:')) {
      return 'team';
    }
    
    // Default to team for organizational entities
    return 'team';
  }

  /**
   * Normalize owner identifier
   */
  private normalizeOwnerIdentifier(identifier: string, type: 'user' | 'group' | 'team'): string {
    // Remove prefixes
    const cleaned = identifier.replace(/^(user:|group:|team:|org:)/, '');
    
    // For email addresses, extract username
    if (type === 'user' && cleaned.includes('@')) {
      return cleaned; // Keep full email for users
    }
    
    return cleaned.toLowerCase();
  }
}

export default OwnershipMapper;