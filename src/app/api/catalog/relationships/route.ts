import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

interface EntityRelationship {
  id: string;
  sourceRef: string;
  targetRef: string;
  type: RelationType;
  metadata: RelationshipMetadata;
  validation: RelationshipValidation;
  lifecycle: RelationshipLifecycle;
  created: string;
  updated: string;
}

type RelationType = 
  | 'ownedBy'
  | 'partOf'
  | 'dependsOn'
  | 'dependencyOf'
  | 'parentOf'
  | 'childOf'
  | 'providesApi'
  | 'consumesApi'
  | 'hasPart'
  | 'memberOf'
  | 'uses'
  | 'usedBy'
  | 'implements'
  | 'implementedBy'
  | 'extends'
  | 'extendedBy'
  | 'validates'
  | 'validatedBy'
  | 'monitors'
  | 'monitoredBy'
  | 'secures'
  | 'securedBy'
  | 'documents'
  | 'documentedBy'
  | 'tests'
  | 'testedBy'
  | 'deploys'
  | 'deployedBy'
  | 'hosts'
  | 'hostedBy'
  | 'manages'
  | 'managedBy';

interface RelationshipMetadata {
  name?: string;
  description?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  tags?: string[];
  weight?: number;
  bidirectional?: boolean;
  transitive?: boolean;
  symmetric?: boolean;
  required?: boolean;
  cardinality?: CardinalityType;
  constraints?: RelationshipConstraint[];
  properties?: Record<string, any>;
}

type CardinalityType = 
  | 'one-to-one'
  | 'one-to-many'
  | 'many-to-one'
  | 'many-to-many';

interface RelationshipConstraint {
  type: 'kind' | 'type' | 'lifecycle' | 'namespace' | 'label' | 'annotation' | 'custom';
  field?: string;
  operator: 'equals' | 'not-equals' | 'in' | 'not-in' | 'contains' | 'regex';
  value: any;
  message?: string;
}

interface RelationshipValidation {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  lastValidated: string;
  validationRules: ValidationRule[];
}

interface ValidationError {
  code: string;
  message: string;
  field?: string;
  severity: 'error';
}

interface ValidationWarning {
  code: string;
  message: string;
  field?: string;
  severity: 'warning';
}

interface ValidationRule {
  id: string;
  type: 'structural' | 'semantic' | 'business' | 'security';
  description: string;
  expression: string;
  enabled: boolean;
}

interface RelationshipLifecycle {
  state: 'active' | 'pending' | 'deprecated' | 'deleted';
  reason?: string;
  effectiveDate?: string;
  expiryDate?: string;
  approvedBy?: string;
  approvedAt?: string;
  history: LifecycleEvent[];
}

interface LifecycleEvent {
  timestamp: string;
  event: string;
  actor: string;
  details?: Record<string, any>;
}

interface RelationshipGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: GraphCluster[];
  metadata: GraphMetadata;
}

interface GraphNode {
  id: string;
  ref: string;
  kind: string;
  name: string;
  namespace?: string;
  label?: string;
  properties?: Record<string, any>;
  position?: { x: number; y: number };
  style?: NodeStyle;
}

interface NodeStyle {
  shape?: 'circle' | 'rectangle' | 'diamond' | 'hexagon';
  color?: string;
  size?: number;
  icon?: string;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: RelationType;
  label?: string;
  weight?: number;
  style?: EdgeStyle;
}

interface EdgeStyle {
  type?: 'solid' | 'dashed' | 'dotted';
  color?: string;
  width?: number;
  arrow?: 'none' | 'forward' | 'backward' | 'both';
}

interface GraphCluster {
  id: string;
  name: string;
  nodes: string[];
  color?: string;
  collapsed?: boolean;
}

interface GraphMetadata {
  totalNodes: number;
  totalEdges: number;
  depth: number;
  breadth: number;
  density: number;
  connectivity: number;
  cycles: string[][];
  components: string[][];
  criticalPath?: string[];
}

interface RelationshipQuery {
  sourceRef?: string;
  targetRef?: string;
  type?: RelationType | RelationType[];
  kind?: string | string[];
  namespace?: string;
  depth?: number;
  includeIndirect?: boolean;
  includeInverse?: boolean;
  filters?: QueryFilter[];
  pagination?: PaginationOptions;
}

interface QueryFilter {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'in' | 'notIn';
  value: any;
}

interface PaginationOptions {
  limit: number;
  offset: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface RelationshipAnalytics {
  totalRelationships: number;
  byType: Record<RelationType, number>;
  byKind: Record<string, number>;
  averageDegree: number;
  maxDegree: { entity: string; degree: number };
  orphanedEntities: string[];
  circularDependencies: string[][];
  impactAnalysis: ImpactAnalysis;
  recommendations: Recommendation[];
}

interface ImpactAnalysis {
  entity: string;
  directImpact: string[];
  indirectImpact: string[];
  impactScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  affectedSystems: string[];
  affectedTeams: string[];
}

interface Recommendation {
  type: 'optimization' | 'security' | 'quality' | 'compliance';
  title: string;
  description: string;
  entities: string[];
  priority: 'low' | 'medium' | 'high';
  estimatedEffort: 'small' | 'medium' | 'large';
  benefits: string[];
}

// Storage
const relationships = new Map<string, EntityRelationship>();
const relationshipIndex = new Map<string, Set<string>>();
const graphCache = new Map<string, RelationshipGraph>();

// Initialize sample relationships
const initializeSampleRelationships = () => {
  const sampleRelationships: Omit<EntityRelationship, 'id' | 'created' | 'updated'>[] = [
    {
      sourceRef: 'component:default/backstage-portal',
      targetRef: 'group:default/platform-team',
      type: 'ownedBy',
      metadata: {
        name: 'Portal ownership',
        bidirectional: false,
        cardinality: 'many-to-one',
        required: true
      },
      validation: {
        isValid: true,
        errors: [],
        warnings: [],
        lastValidated: new Date().toISOString(),
        validationRules: []
      },
      lifecycle: {
        state: 'active',
        history: []
      }
    },
    {
      sourceRef: 'component:default/backstage-portal',
      targetRef: 'system:default/backstage',
      type: 'partOf',
      metadata: {
        name: 'System membership',
        bidirectional: false,
        cardinality: 'many-to-one'
      },
      validation: {
        isValid: true,
        errors: [],
        warnings: [],
        lastValidated: new Date().toISOString(),
        validationRules: []
      },
      lifecycle: {
        state: 'active',
        history: []
      }
    },
    {
      sourceRef: 'component:default/backstage-portal',
      targetRef: 'component:default/backstage-backend',
      type: 'dependsOn',
      metadata: {
        name: 'Backend dependency',
        bidirectional: true,
        cardinality: 'many-to-many',
        weight: 1.0
      },
      validation: {
        isValid: true,
        errors: [],
        warnings: [],
        lastValidated: new Date().toISOString(),
        validationRules: []
      },
      lifecycle: {
        state: 'active',
        history: []
      }
    },
    {
      sourceRef: 'component:default/backstage-backend',
      targetRef: 'resource:default/backstage-db',
      type: 'dependsOn',
      metadata: {
        name: 'Database dependency',
        bidirectional: false,
        cardinality: 'many-to-one',
        required: true,
        weight: 1.0
      },
      validation: {
        isValid: true,
        errors: [],
        warnings: [],
        lastValidated: new Date().toISOString(),
        validationRules: []
      },
      lifecycle: {
        state: 'active',
        history: []
      }
    },
    {
      sourceRef: 'user:default/john.doe',
      targetRef: 'group:default/platform-team',
      type: 'memberOf',
      metadata: {
        name: 'Team membership',
        bidirectional: true,
        cardinality: 'many-to-many'
      },
      validation: {
        isValid: true,
        errors: [],
        warnings: [],
        lastValidated: new Date().toISOString(),
        validationRules: []
      },
      lifecycle: {
        state: 'active',
        history: []
      }
    }
  ];

  sampleRelationships.forEach(rel => {
    const relationship: EntityRelationship = {
      ...rel,
      id: crypto.randomBytes(16).toString('hex'),
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };

    relationships.set(relationship.id, relationship);
    indexRelationship(relationship);
  });
};

// Index relationship for fast lookups
const indexRelationship = (relationship: EntityRelationship) => {
  // Index by source
  if (!relationshipIndex.has(relationship.sourceRef)) {
    relationshipIndex.set(relationship.sourceRef, new Set());
  }
  relationshipIndex.get(relationship.sourceRef)!.add(relationship.id);

  // Index by target
  const targetKey = `target:${relationship.targetRef}`;
  if (!relationshipIndex.has(targetKey)) {
    relationshipIndex.set(targetKey, new Set());
  }
  relationshipIndex.get(targetKey)!.add(relationship.id);

  // Index by type
  const typeKey = `type:${relationship.type}`;
  if (!relationshipIndex.has(typeKey)) {
    relationshipIndex.set(typeKey, new Set());
  }
  relationshipIndex.get(typeKey)!.add(relationship.id);
};

// Build relationship graph
const buildGraph = (
  startRef: string,
  depth: number = 1,
  includeIndirect: boolean = false
): RelationshipGraph => {
  const visited = new Set<string>();
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const queue: { ref: string; level: number }[] = [{ ref: startRef, level: 0 }];

  while (queue.length > 0) {
    const { ref, level } = queue.shift()!;
    
    if (visited.has(ref) || level > depth) {
      continue;
    }
    
    visited.add(ref);

    // Add node
    if (!nodes.has(ref)) {
      const [kind, namespaceAndName] = ref.split(':');
      const [namespace, name] = namespaceAndName.split('/');
      
      nodes.set(ref, {
        id: ref,
        ref,
        kind,
        name,
        namespace,
        label: name,
        position: {
          x: Math.random() * 1000,
          y: Math.random() * 1000
        },
        style: {
          shape: getNodeShape(kind),
          color: getNodeColor(kind)
        }
      });
    }

    // Find relationships
    const sourceRels = relationshipIndex.get(ref) || new Set();
    const targetRels = relationshipIndex.get(`target:${ref}`) || new Set();

    // Process outgoing relationships
    sourceRels.forEach(relId => {
      const rel = relationships.get(relId);
      if (rel && rel.lifecycle.state === 'active') {
        edges.push({
          id: rel.id,
          source: rel.sourceRef,
          target: rel.targetRef,
          type: rel.type,
          label: rel.type,
          weight: rel.metadata.weight,
          style: {
            type: 'solid',
            arrow: 'forward'
          }
        });

        if (level < depth) {
          queue.push({ ref: rel.targetRef, level: level + 1 });
        }
      }
    });

    // Process incoming relationships if requested
    if (includeIndirect) {
      targetRels.forEach(relId => {
        const rel = relationships.get(relId);
        if (rel && rel.lifecycle.state === 'active') {
          edges.push({
            id: rel.id + '-reverse',
            source: rel.sourceRef,
            target: rel.targetRef,
            type: rel.type,
            label: rel.type,
            weight: rel.metadata.weight,
            style: {
              type: 'dashed',
              arrow: 'forward'
            }
          });

          if (level < depth) {
            queue.push({ ref: rel.sourceRef, level: level + 1 });
          }
        }
      });
    }
  }

  // Calculate metadata
  const nodeArray = Array.from(nodes.values());
  const metadata: GraphMetadata = {
    totalNodes: nodeArray.length,
    totalEdges: edges.length,
    depth: Math.max(...Array.from(visited).map(ref => 
      calculateNodeDepth(ref, startRef)
    )),
    breadth: nodeArray.length,
    density: edges.length / (nodeArray.length * (nodeArray.length - 1)),
    connectivity: calculateConnectivity(nodeArray, edges),
    cycles: detectCycles(nodeArray, edges),
    components: findConnectedComponents(nodeArray, edges)
  };

  return {
    nodes: nodeArray,
    edges,
    clusters: identifyClusters(nodeArray, edges),
    metadata
  };
};

// Helper functions for graph building
const getNodeShape = (kind: string): NodeStyle['shape'] => {
  const shapeMap: Record<string, NodeStyle['shape']> = {
    'component': 'circle',
    'api': 'hexagon',
    'system': 'rectangle',
    'domain': 'diamond',
    'resource': 'rectangle',
    'group': 'circle',
    'user': 'circle'
  };
  return shapeMap[kind.toLowerCase()] || 'circle';
};

const getNodeColor = (kind: string): string => {
  const colorMap: Record<string, string> = {
    'component': '#4285f4',
    'api': '#34a853',
    'system': '#fbbc04',
    'domain': '#ea4335',
    'resource': '#9c27b0',
    'group': '#00acc1',
    'user': '#ff6f00'
  };
  return colorMap[kind.toLowerCase()] || '#757575';
};

const calculateNodeDepth = (nodeRef: string, startRef: string): number => {
  if (nodeRef === startRef) return 0;
  
  // BFS to find shortest path
  const queue: { ref: string; depth: number }[] = [{ ref: startRef, depth: 0 }];
  const visited = new Set<string>();
  
  while (queue.length > 0) {
    const { ref, depth } = queue.shift()!;
    
    if (ref === nodeRef) return depth;
    if (visited.has(ref)) continue;
    
    visited.add(ref);
    
    const rels = relationshipIndex.get(ref) || new Set();
    rels.forEach(relId => {
      const rel = relationships.get(relId);
      if (rel) {
        queue.push({ ref: rel.targetRef, depth: depth + 1 });
      }
    });
  }
  
  return -1;
};

const calculateConnectivity = (nodes: GraphNode[], edges: GraphEdge[]): number => {
  if (nodes.length <= 1) return 1;
  
  const edgeCount = edges.length;
  const maxEdges = nodes.length * (nodes.length - 1);
  
  return edgeCount / maxEdges;
};

const detectCycles = (nodes: GraphNode[], edges: GraphEdge[]): string[][] => {
  const cycles: string[][] = [];
  const adjList = new Map<string, string[]>();
  
  // Build adjacency list
  edges.forEach(edge => {
    if (!adjList.has(edge.source)) {
      adjList.set(edge.source, []);
    }
    adjList.get(edge.source)!.push(edge.target);
  });
  
  // DFS to detect cycles
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const currentPath: string[] = [];
  
  const dfs = (node: string): boolean => {
    visited.add(node);
    recursionStack.add(node);
    currentPath.push(node);
    
    const neighbors = adjList.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recursionStack.has(neighbor)) {
        // Cycle detected
        const cycleStart = currentPath.indexOf(neighbor);
        if (cycleStart !== -1) {
          cycles.push(currentPath.slice(cycleStart));
        }
        return true;
      }
    }
    
    recursionStack.delete(node);
    currentPath.pop();
    return false;
  };
  
  nodes.forEach(node => {
    if (!visited.has(node.id)) {
      dfs(node.id);
    }
  });
  
  return cycles;
};

const findConnectedComponents = (nodes: GraphNode[], edges: GraphEdge[]): string[][] => {
  const components: string[][] = [];
  const visited = new Set<string>();
  const adjList = new Map<string, Set<string>>();
  
  // Build bidirectional adjacency list
  edges.forEach(edge => {
    if (!adjList.has(edge.source)) {
      adjList.set(edge.source, new Set());
    }
    if (!adjList.has(edge.target)) {
      adjList.set(edge.target, new Set());
    }
    adjList.get(edge.source)!.add(edge.target);
    adjList.get(edge.target)!.add(edge.source);
  });
  
  // DFS to find components
  const dfs = (node: string, component: string[]) => {
    visited.add(node);
    component.push(node);
    
    const neighbors = adjList.get(node) || new Set();
    neighbors.forEach(neighbor => {
      if (!visited.has(neighbor)) {
        dfs(neighbor, component);
      }
    });
  };
  
  nodes.forEach(node => {
    if (!visited.has(node.id)) {
      const component: string[] = [];
      dfs(node.id, component);
      if (component.length > 0) {
        components.push(component);
      }
    }
  });
  
  return components;
};

const identifyClusters = (nodes: GraphNode[], edges: GraphEdge[]): GraphCluster[] => {
  const clusters: GraphCluster[] = [];
  
  // Group nodes by system
  const systemGroups = new Map<string, string[]>();
  
  nodes.forEach(node => {
    // Extract system from relationships
    const systemRels = Array.from(relationships.values()).filter(
      rel => rel.sourceRef === node.ref && rel.type === 'partOf'
    );
    
    if (systemRels.length > 0) {
      const system = systemRels[0].targetRef;
      if (!systemGroups.has(system)) {
        systemGroups.set(system, []);
      }
      systemGroups.get(system)!.push(node.id);
    }
  });
  
  systemGroups.forEach((nodeIds, system) => {
    clusters.push({
      id: crypto.randomBytes(8).toString('hex'),
      name: system.split('/').pop() || 'Unknown',
      nodes: nodeIds,
      color: getNodeColor('system')
    });
  });
  
  return clusters;
};

// Validate relationship
const validateRelationship = (relationship: Omit<EntityRelationship, 'id' | 'created' | 'updated'>): RelationshipValidation => {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  // Check required fields
  if (!relationship.sourceRef) {
    errors.push({
      code: 'MISSING_SOURCE',
      message: 'Source reference is required',
      field: 'sourceRef',
      severity: 'error'
    });
  }
  
  if (!relationship.targetRef) {
    errors.push({
      code: 'MISSING_TARGET',
      message: 'Target reference is required',
      field: 'targetRef',
      severity: 'error'
    });
  }
  
  if (!relationship.type) {
    errors.push({
      code: 'MISSING_TYPE',
      message: 'Relationship type is required',
      field: 'type',
      severity: 'error'
    });
  }
  
  // Check for self-reference
  if (relationship.sourceRef === relationship.targetRef) {
    warnings.push({
      code: 'SELF_REFERENCE',
      message: 'Entity references itself',
      severity: 'warning'
    });
  }
  
  // Check for duplicate relationships
  const existingRels = Array.from(relationships.values()).filter(
    rel => rel.sourceRef === relationship.sourceRef &&
           rel.targetRef === relationship.targetRef &&
           rel.type === relationship.type
  );
  
  if (existingRels.length > 0) {
    warnings.push({
      code: 'DUPLICATE_RELATIONSHIP',
      message: 'Similar relationship already exists',
      severity: 'warning'
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    lastValidated: new Date().toISOString(),
    validationRules: []
  };
};

// Analyze impact of changes
const analyzeImpact = (entityRef: string): ImpactAnalysis => {
  const directImpact: Set<string> = new Set();
  const indirectImpact: Set<string> = new Set();
  const affectedSystems: Set<string> = new Set();
  const affectedTeams: Set<string> = new Set();
  
  // Find direct dependencies
  const directRels = relationshipIndex.get(entityRef) || new Set();
  const inverseRels = relationshipIndex.get(`target:${entityRef}`) || new Set();
  
  directRels.forEach(relId => {
    const rel = relationships.get(relId);
    if (rel && (rel.type === 'dependsOn' || rel.type === 'uses')) {
      directImpact.add(rel.targetRef);
    }
  });
  
  inverseRels.forEach(relId => {
    const rel = relationships.get(relId);
    if (rel && (rel.type === 'dependsOn' || rel.type === 'uses')) {
      directImpact.add(rel.sourceRef);
    }
  });
  
  // Find indirect dependencies (2 levels deep)
  directImpact.forEach(ref => {
    const secondLevel = relationshipIndex.get(ref) || new Set();
    secondLevel.forEach(relId => {
      const rel = relationships.get(relId);
      if (rel && !directImpact.has(rel.targetRef) && rel.targetRef !== entityRef) {
        indirectImpact.add(rel.targetRef);
      }
    });
  });
  
  // Calculate impact score
  const impactScore = directImpact.size * 2 + indirectImpact.size;
  
  // Determine risk level
  let riskLevel: ImpactAnalysis['riskLevel'] = 'low';
  if (impactScore > 20) riskLevel = 'critical';
  else if (impactScore > 10) riskLevel = 'high';
  else if (impactScore > 5) riskLevel = 'medium';
  
  return {
    entity: entityRef,
    directImpact: Array.from(directImpact),
    indirectImpact: Array.from(indirectImpact),
    impactScore,
    riskLevel,
    affectedSystems: Array.from(affectedSystems),
    affectedTeams: Array.from(affectedTeams)
  };
};

// Initialize sample data
initializeSampleRelationships();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceRef = searchParams.get('sourceRef');
    const targetRef = searchParams.get('targetRef');
    const type = searchParams.get('type');
    const graphMode = searchParams.get('graph') === 'true';
    const analyzeMode = searchParams.get('analyze') === 'true';
    
    // Graph mode
    if (graphMode && sourceRef) {
      const depth = parseInt(searchParams.get('depth') || '2');
      const includeIndirect = searchParams.get('includeIndirect') === 'true';
      
      const graph = buildGraph(sourceRef, depth, includeIndirect);
      
      return NextResponse.json({
        success: true,
        graph
      });
    }
    
    // Impact analysis mode
    if (analyzeMode && sourceRef) {
      const impact = analyzeImpact(sourceRef);
      
      return NextResponse.json({
        success: true,
        impact
      });
    }
    
    // Filter relationships
    let results = Array.from(relationships.values());
    
    if (sourceRef) {
      results = results.filter(rel => rel.sourceRef === sourceRef);
    }
    
    if (targetRef) {
      results = results.filter(rel => rel.targetRef === targetRef);
    }
    
    if (type) {
      const types = type.split(',') as RelationType[];
      results = results.filter(rel => types.includes(rel.type));
    }
    
    // Calculate analytics
    const analytics: RelationshipAnalytics = {
      totalRelationships: relationships.size,
      byType: {} as Record<RelationType, number>,
      byKind: {},
      averageDegree: 0,
      maxDegree: { entity: '', degree: 0 },
      orphanedEntities: [],
      circularDependencies: [],
      impactAnalysis: sourceRef ? analyzeImpact(sourceRef) : {} as ImpactAnalysis,
      recommendations: []
    };
    
    // Count by type
    results.forEach(rel => {
      analytics.byType[rel.type] = (analytics.byType[rel.type] || 0) + 1;
    });
    
    return NextResponse.json({
      success: true,
      relationships: results,
      total: results.length,
      analytics
    });
    
  } catch (error) {
    console.error('Relationship GET error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch relationships'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    
    switch (action) {
      case 'create': {
        const validation = validateRelationship(body.relationship);
        
        if (!validation.isValid) {
          return NextResponse.json({
            success: false,
            validation
          }, { status: 400 });
        }
        
        const relationship: EntityRelationship = {
          ...body.relationship,
          id: crypto.randomBytes(16).toString('hex'),
          validation,
          created: new Date().toISOString(),
          updated: new Date().toISOString()
        };
        
        relationships.set(relationship.id, relationship);
        indexRelationship(relationship);
        
        return NextResponse.json({
          success: true,
          relationship
        });
      }
      
      case 'update': {
        const { id, ...updates } = body;
        const relationship = relationships.get(id);
        
        if (!relationship) {
          return NextResponse.json({
            success: false,
            error: 'Relationship not found'
          }, { status: 404 });
        }
        
        Object.assign(relationship, updates, {
          updated: new Date().toISOString()
        });
        
        return NextResponse.json({
          success: true,
          relationship
        });
      }
      
      case 'delete': {
        const { id } = body;
        const relationship = relationships.get(id);
        
        if (!relationship) {
          return NextResponse.json({
            success: false,
            error: 'Relationship not found'
          }, { status: 404 });
        }
        
        relationships.delete(id);
        
        // Remove from indices
        relationshipIndex.forEach((ids, key) => {
          ids.delete(id);
        });
        
        return NextResponse.json({
          success: true,
          deleted: true
        });
      }
      
      case 'validate': {
        const validation = validateRelationship(body.relationship);
        
        return NextResponse.json({
          success: true,
          validation
        });
      }
      
      case 'bulk': {
        const { operations } = body;
        const results: any[] = [];
        
        for (const op of operations) {
          switch (op.type) {
            case 'create': {
              const validation = validateRelationship(op.relationship);
              
              if (validation.isValid) {
                const relationship: EntityRelationship = {
                  ...op.relationship,
                  id: crypto.randomBytes(16).toString('hex'),
                  validation,
                  created: new Date().toISOString(),
                  updated: new Date().toISOString()
                };
                
                relationships.set(relationship.id, relationship);
                indexRelationship(relationship);
                
                results.push({ success: true, relationship });
              } else {
                results.push({ success: false, validation });
              }
              break;
            }
            
            case 'delete': {
              if (relationships.has(op.id)) {
                relationships.delete(op.id);
                results.push({ success: true, deleted: op.id });
              } else {
                results.push({ success: false, error: 'Not found', id: op.id });
              }
              break;
            }
          }
        }
        
        return NextResponse.json({
          success: true,
          results
        });
      }
      
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Relationship POST error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process relationship request'
    }, { status: 500 });
  }
}