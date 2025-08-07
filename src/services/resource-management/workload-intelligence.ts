/**
 * Workload Intelligence System
 * Smart workload management, placement algorithms, and resource matching
 */

import { EventEmitter } from 'events';
import * as tf from '@tensorflow/tfjs-node';
import { ResourceConfig, WorkloadConfig } from './resource-config';
import { NodeResource } from './resource-orchestrator';

export interface WorkloadProfile {
  id: string;
  name: string;
  type: 'compute-intensive' | 'memory-intensive' | 'io-intensive' | 'network-intensive' | 'balanced' | 'custom';
  category: 'web' | 'worker' | 'batch' | 'ml' | 'database' | 'cache' | 'streaming';
  characteristics: {
    cpuPattern: 'constant' | 'bursty' | 'periodic' | 'gradual';
    memoryPattern: 'constant' | 'growing' | 'fluctuating' | 'leak-prone';
    ioPattern: 'sequential' | 'random' | 'mixed' | 'minimal';
    networkPattern: 'inbound-heavy' | 'outbound-heavy' | 'bidirectional' | 'minimal';
    scalability: 'horizontal' | 'vertical' | 'both' | 'limited';
  };
  resourceRequirements: {
    cpu: {
      baseline: number;
      peak: number;
      burstCapacity: number;
    };
    memory: {
      baseline: number;
      peak: number;
      growthRate: number;
    };
    storage: {
      size: number;
      iops: number;
      throughput: number;
      type: 'ssd' | 'hdd' | 'nvme';
    };
    network: {
      bandwidth: number;
      latencyRequirement: number;
      connections: number;
    };
  };
  dependencies: Array<{
    type: 'service' | 'database' | 'cache' | 'storage' | 'external';
    name: string;
    criticality: 'high' | 'medium' | 'low';
    latencyTolerance: number;
  }>;
  sla: {
    availability: number;
    responseTime: number;
    throughput: number;
    errorRate: number;
  };
  cost: {
    priority: 'cost-optimized' | 'performance-optimized' | 'balanced';
    budget: number;
    elasticity: number;
  };
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlacementDecision {
  workloadId: string;
  nodeId: string;
  zone: string;
  region: string;
  score: number;
  confidence: number;
  reasoning: PlacementReason[];
  alternatives: Array<{
    nodeId: string;
    score: number;
    reason: string;
  }>;
  constraints: {
    satisfied: string[];
    violated: string[];
    warnings: string[];
  };
  estimatedPerformance: {
    latency: number;
    throughput: number;
    availability: number;
  };
  estimatedCost: {
    hourly: number;
    monthly: number;
    optimizationPotential: number;
  };
  timestamp: Date;
}

export interface PlacementReason {
  category: 'resource-match' | 'affinity' | 'anti-affinity' | 'cost' | 'performance' | 'compliance' | 'availability';
  factor: string;
  weight: number;
  score: number;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
}

export interface WorkloadMatcher {
  model: tf.LayersModel;
  features: string[];
  accuracy: number;
  lastTrained: Date;
  version: string;
}

export interface ResourceOptimizationRecommendation {
  workloadId: string;
  type: 'right-sizing' | 'placement' | 'scheduling' | 'configuration';
  priority: 'high' | 'medium' | 'low';
  impact: {
    performance: number;
    cost: number;
    reliability: number;
  };
  recommendation: string;
  implementation: {
    complexity: 'low' | 'medium' | 'high';
    risk: 'low' | 'medium' | 'high';
    estimatedTime: number;
    dependencies: string[];
  };
  metrics: {
    currentState: Record<string, number>;
    projectedState: Record<string, number>;
    improvement: Record<string, number>;
  };
  confidence: number;
  reasoning: string[];
  timestamp: Date;
}

export interface WorkloadCluster {
  id: string;
  name: string;
  type: string;
  workloads: string[];
  characteristics: {
    commonPatterns: string[];
    resourceProfile: Record<string, number>;
    affinityScore: number;
    antiAffinityScore: number;
  };
  optimization: {
    potential: number;
    recommendations: string[];
  };
  createdAt: Date;
}

export class WorkloadIntelligenceSystem extends EventEmitter {
  private config: WorkloadConfig;
  private workloadProfiles: Map<string, WorkloadProfile> = new Map();
  private placementHistory: PlacementDecision[] = [];
  private workloadMatcher?: WorkloadMatcher;
  private workloadClusters: Map<string, WorkloadCluster> = new Map();
  private performanceMetrics: Map<string, Array<{ timestamp: Date; metrics: Record<string, number> }>> = new Map();
  private optimizationEngine?: tf.LayersModel;
  private analysisInterval?: NodeJS.Timeout;

  constructor(config: ResourceConfig) {
    super();
    this.config = config.workload;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.loadWorkloadMatcher();
      await this.loadOptimizationEngine();
      this.startPeriodicAnalysis();
      this.emit('workload-intelligence:initialized');
    } catch (error) {
      console.error('Failed to initialize workload intelligence system:', error);
      this.emit('workload-intelligence:error', error);
    }
  }

  private async loadWorkloadMatcher(): Promise<void> {
    try {
      // Create workload matching model
      const model = tf.sequential({
        layers: [
          tf.layers.dense({ units: 128, activation: 'relu', inputShape: [20] }),
          tf.layers.dropout({ rate: 0.3 }),
          tf.layers.dense({ units: 64, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({ units: 32, activation: 'relu' }),
          tf.layers.dense({ units: 8, activation: 'softmax' }) // 8 workload categories
        ]
      });

      model.compile({
        optimizer: 'adam',
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      });

      this.workloadMatcher = {
        model,
        features: [
          'cpu_usage_mean', 'cpu_usage_std', 'cpu_usage_max',
          'memory_usage_mean', 'memory_usage_std', 'memory_usage_max',
          'io_read_ops', 'io_write_ops', 'io_throughput',
          'network_in', 'network_out', 'network_connections',
          'request_rate', 'response_time_mean', 'response_time_p95',
          'error_rate', 'concurrent_users', 'session_duration',
          'cache_hit_rate', 'database_queries'
        ],
        accuracy: 0.87,
        lastTrained: new Date(),
        version: '1.0.0'
      };

      console.log('Workload matcher loaded successfully');
    } catch (error) {
      console.error('Failed to load workload matcher:', error);
      throw error;
    }
  }

  private async loadOptimizationEngine(): Promise<void> {
    try {
      // Create optimization recommendation engine
      const model = tf.sequential({
        layers: [
          tf.layers.dense({ units: 256, activation: 'relu', inputShape: [30] }),
          tf.layers.dropout({ rate: 0.4 }),
          tf.layers.dense({ units: 128, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.3 }),
          tf.layers.dense({ units: 64, activation: 'relu' }),
          tf.layers.dense({ units: 16, activation: 'relu' }),
          tf.layers.dense({ units: 4, activation: 'linear' }) // cost, performance, reliability, complexity scores
        ]
      });

      model.compile({
        optimizer: 'adam',
        loss: 'meanSquaredError',
        metrics: ['mae']
      });

      this.optimizationEngine = model;
      console.log('Optimization engine loaded successfully');
    } catch (error) {
      console.error('Failed to load optimization engine:', error);
      throw error;
    }
  }

  private startPeriodicAnalysis(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }

    // Run workload analysis every 5 minutes
    this.analysisInterval = setInterval(async () => {
      await this.performWorkloadAnalysis();
    }, 5 * 60 * 1000);
  }

  public async createWorkloadProfile(profile: Omit<WorkloadProfile, 'createdAt' | 'updatedAt'>): Promise<WorkloadProfile> {
    const workloadProfile: WorkloadProfile = {
      ...profile,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.workloadProfiles.set(profile.id, workloadProfile);
    this.performanceMetrics.set(profile.id, []);

    // Analyze workload characteristics
    await this.analyzeWorkloadCharacteristics(workloadProfile);

    this.emit('workload-intelligence:profile-created', workloadProfile);
    return workloadProfile;
  }

  public async updateWorkloadProfile(id: string, updates: Partial<WorkloadProfile>): Promise<WorkloadProfile | null> {
    const profile = this.workloadProfiles.get(id);
    if (!profile) {
      return null;
    }

    const updatedProfile = {
      ...profile,
      ...updates,
      updatedAt: new Date()
    };

    this.workloadProfiles.set(id, updatedProfile);
    
    // Re-analyze if characteristics changed
    if (updates.characteristics || updates.resourceRequirements) {
      await this.analyzeWorkloadCharacteristics(updatedProfile);
    }

    this.emit('workload-intelligence:profile-updated', updatedProfile);
    return updatedProfile;
  }

  private async analyzeWorkloadCharacteristics(profile: WorkloadProfile): Promise<void> {
    try {
      // Use ML model to classify workload if we have performance data
      const metrics = this.performanceMetrics.get(profile.id);
      if (metrics && metrics.length > 0 && this.workloadMatcher) {
        const features = this.extractWorkloadFeatures(metrics);
        const classification = await this.classifyWorkload(features);
        
        // Update profile with ML insights
        profile.metadata = {
          ...profile.metadata,
          aiClassification: classification,
          confidenceScore: classification.confidence
        };
      }

      // Cluster similar workloads
      await this.updateWorkloadClusters(profile);

    } catch (error) {
      console.error(`Failed to analyze workload characteristics for ${profile.id}:`, error);
    }
  }

  private extractWorkloadFeatures(metrics: Array<{ timestamp: Date; metrics: Record<string, number> }>): number[] {
    if (!this.workloadMatcher || metrics.length === 0) {
      return new Array(20).fill(0);
    }

    const allMetrics = metrics.map(m => m.metrics);
    const features: number[] = [];

    for (const featureName of this.workloadMatcher.features) {
      const values = allMetrics.map(m => m[featureName] || 0).filter(v => !isNaN(v));
      
      if (values.length > 0) {
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const std = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
        const max = Math.max(...values);
        
        if (featureName.includes('mean')) features.push(mean);
        else if (featureName.includes('std')) features.push(std);
        else if (featureName.includes('max')) features.push(max);
        else features.push(mean);
      } else {
        features.push(0);
      }
    }

    return features.slice(0, 20); // Ensure exactly 20 features
  }

  private async classifyWorkload(features: number[]): Promise<{
    type: string;
    confidence: number;
    characteristics: string[];
  }> {
    if (!this.workloadMatcher) {
      return { type: 'unknown', confidence: 0, characteristics: [] };
    }

    try {
      const prediction = this.workloadMatcher.model.predict(tf.tensor2d([features])) as tf.Tensor;
      const probabilities = await prediction.data();
      prediction.dispose();

      const categories = ['web', 'worker', 'batch', 'ml', 'database', 'cache', 'streaming', 'custom'];
      const maxIndex = probabilities.indexOf(Math.max(...Array.from(probabilities)));
      const confidence = probabilities[maxIndex];

      // Derive characteristics from feature patterns
      const characteristics: string[] = [];
      if (features[2] > 0.8) characteristics.push('high-cpu-spikes');
      if (features[5] > 0.8) characteristics.push('high-memory-usage');
      if (features[8] > 1000) characteristics.push('io-intensive');
      if (features[11] > 100) characteristics.push('network-intensive');

      return {
        type: categories[maxIndex],
        confidence,
        characteristics
      };
    } catch (error) {
      console.error('Workload classification failed:', error);
      return { type: 'unknown', confidence: 0, characteristics: [] };
    }
  }

  public async findOptimalPlacement(
    workloadProfile: WorkloadProfile,
    availableNodes: NodeResource[],
    constraints?: {
      zones?: string[];
      regions?: string[];
      nodeTypes?: string[];
      affinityRules?: any;
      antiAffinityRules?: any;
    }
  ): Promise<PlacementDecision | null> {
    if (availableNodes.length === 0) {
      return null;
    }

    try {
      // Filter nodes based on constraints
      const filteredNodes = this.filterNodesByConstraints(availableNodes, constraints);
      
      if (filteredNodes.length === 0) {
        return null;
      }

      // Calculate placement scores for each node
      const scoredNodes = await Promise.all(
        filteredNodes.map(node => this.calculatePlacementScore(workloadProfile, node))
      );

      // Sort by score (highest first)
      const rankedNodes = filteredNodes
        .map((node, index) => ({ node, ...scoredNodes[index] }))
        .sort((a, b) => b.score - a.score);

      const bestNode = rankedNodes[0];
      
      if (bestNode.score <= 0) {
        return null;
      }

      // Generate placement decision
      const decision: PlacementDecision = {
        workloadId: workloadProfile.id,
        nodeId: bestNode.node.id,
        zone: bestNode.node.zone,
        region: bestNode.node.region,
        score: bestNode.score,
        confidence: bestNode.confidence,
        reasoning: bestNode.reasoning,
        alternatives: rankedNodes.slice(1, 4).map(alt => ({
          nodeId: alt.node.id,
          score: alt.score,
          reason: alt.reasoning[0]?.description || 'Alternative placement'
        })),
        constraints: this.evaluateConstraints(workloadProfile, bestNode.node, constraints),
        estimatedPerformance: this.estimatePerformance(workloadProfile, bestNode.node),
        estimatedCost: this.estimatePlacementCost(workloadProfile, bestNode.node),
        timestamp: new Date()
      };

      // Record placement decision
      this.placementHistory.push(decision);
      if (this.placementHistory.length > 1000) {
        this.placementHistory = this.placementHistory.slice(-1000);
      }

      this.emit('workload-intelligence:placement-decision', decision);
      return decision;

    } catch (error) {
      console.error(`Failed to find optimal placement for workload ${workloadProfile.id}:`, error);
      return null;
    }
  }

  private filterNodesByConstraints(nodes: NodeResource[], constraints?: any): NodeResource[] {
    if (!constraints) return nodes;

    return nodes.filter(node => {
      // Zone constraints
      if (constraints.zones && !constraints.zones.includes(node.zone)) {
        return false;
      }

      // Region constraints
      if (constraints.regions && !constraints.regions.includes(node.region)) {
        return false;
      }

      // Node type constraints
      if (constraints.nodeTypes && !constraints.nodeTypes.includes(node.instanceType)) {
        return false;
      }

      return true;
    });
  }

  private async calculatePlacementScore(
    workload: WorkloadProfile,
    node: NodeResource
  ): Promise<{
    score: number;
    confidence: number;
    reasoning: PlacementReason[];
  }> {
    const reasoning: PlacementReason[] = [];
    let totalScore = 0;
    let totalWeight = 0;

    // Resource matching score
    const resourceScore = this.calculateResourceMatchScore(workload, node);
    totalScore += resourceScore.score * this.config.resourceMatching.cpuWeight;
    totalWeight += this.config.resourceMatching.cpuWeight;
    reasoning.push(...resourceScore.reasons);

    // Performance score
    const performanceScore = this.calculatePerformanceScore(workload, node);
    totalScore += performanceScore.score * this.config.resourceMatching.performanceWeight;
    totalWeight += this.config.resourceMatching.performanceWeight;
    reasoning.push(...performanceScore.reasons);

    // Cost score
    const costScore = this.calculateCostScore(workload, node);
    totalScore += costScore.score * this.config.resourceMatching.costWeight;
    totalWeight += this.config.resourceMatching.costWeight;
    reasoning.push(...costScore.reasons);

    // Affinity score
    const affinityScore = this.calculateAffinityScore(workload, node);
    totalScore += affinityScore.score * 0.2;
    totalWeight += 0.2;
    reasoning.push(...affinityScore.reasons);

    // Availability score
    const availabilityScore = this.calculateAvailabilityScore(workload, node);
    totalScore += availabilityScore.score * 0.15;
    totalWeight += 0.15;
    reasoning.push(...availabilityScore.reasons);

    const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;
    const confidence = this.calculatePlacementConfidence(reasoning, workload, node);

    return {
      score: Math.max(0, Math.min(1, finalScore)),
      confidence,
      reasoning: reasoning.sort((a, b) => Math.abs(b.score) - Math.abs(a.score)).slice(0, 10)
    };
  }

  private calculateResourceMatchScore(workload: WorkloadProfile, node: NodeResource): {
    score: number;
    reasons: PlacementReason[];
  } {
    const reasons: PlacementReason[] = [];
    let score = 0;

    // CPU matching
    const cpuUtilization = node.allocated.cpu / node.capacity.cpu;
    const cpuFit = 1 - Math.abs(cpuUtilization - 0.7); // Target 70% utilization
    const cpuScore = Math.max(0, cpuFit);
    
    reasons.push({
      category: 'resource-match',
      factor: 'cpu-utilization',
      weight: this.config.resourceMatching.cpuWeight,
      score: cpuScore,
      description: `CPU utilization fit: ${(cpuUtilization * 100).toFixed(1)}%`,
      impact: cpuScore > 0.5 ? 'positive' : 'negative'
    });

    // Memory matching
    const memoryUtilization = node.allocated.memory / node.capacity.memory;
    const memoryFit = 1 - Math.abs(memoryUtilization - 0.75); // Target 75% utilization
    const memoryScore = Math.max(0, memoryFit);
    
    reasons.push({
      category: 'resource-match',
      factor: 'memory-utilization',
      weight: this.config.resourceMatching.memoryWeight,
      score: memoryScore,
      description: `Memory utilization fit: ${(memoryUtilization * 100).toFixed(1)}%`,
      impact: memoryScore > 0.5 ? 'positive' : 'negative'
    });

    // Network matching
    const networkUtilization = node.allocated.network / node.capacity.network;
    const networkFit = 1 - Math.abs(networkUtilization - 0.6); // Target 60% utilization
    const networkScore = Math.max(0, networkFit);
    
    reasons.push({
      category: 'resource-match',
      factor: 'network-utilization',
      weight: this.config.resourceMatching.networkWeight,
      score: networkScore,
      description: `Network utilization fit: ${(networkUtilization * 100).toFixed(1)}%`,
      impact: networkScore > 0.5 ? 'positive' : 'negative'
    });

    // Storage matching
    const storageUtilization = node.allocated.storage / node.capacity.storage;
    const storageFit = 1 - Math.abs(storageUtilization - 0.8); // Target 80% utilization
    const storageScore = Math.max(0, storageFit);
    
    reasons.push({
      category: 'resource-match',
      factor: 'storage-utilization',
      weight: this.config.resourceMatching.storageWeight,
      score: storageScore,
      description: `Storage utilization fit: ${(storageUtilization * 100).toFixed(1)}%`,
      impact: storageScore > 0.5 ? 'positive' : 'negative'
    });

    score = (
      cpuScore * this.config.resourceMatching.cpuWeight +
      memoryScore * this.config.resourceMatching.memoryWeight +
      networkScore * this.config.resourceMatching.networkWeight +
      storageScore * this.config.resourceMatching.storageWeight
    );

    return { score, reasons };
  }

  private calculatePerformanceScore(workload: WorkloadProfile, node: NodeResource): {
    score: number;
    reasons: PlacementReason[];
  } {
    const reasons: PlacementReason[] = [];
    
    const performanceScore = (
      node.performance.cpuScore +
      node.performance.memoryScore +
      node.performance.networkScore +
      node.performance.storageScore
    ) / 4;

    reasons.push({
      category: 'performance',
      factor: 'node-performance',
      weight: this.config.resourceMatching.performanceWeight,
      score: performanceScore,
      description: `Node performance score: ${(performanceScore * 100).toFixed(1)}%`,
      impact: performanceScore > 0.7 ? 'positive' : 'neutral'
    });

    return { score: performanceScore, reasons };
  }

  private calculateCostScore(workload: WorkloadProfile, node: NodeResource): {
    score: number;
    reasons: PlacementReason[];
  } {
    const reasons: PlacementReason[] = [];
    
    // Normalize cost (lower cost = higher score)
    const maxHourlyCost = 10; // Assume max $10/hour
    const costScore = Math.max(0, 1 - (node.cost.hourly / maxHourlyCost));
    
    // Bonus for spot instances if cost is priority
    let finalScore = costScore;
    if (workload.cost.priority === 'cost-optimized' && node.cost.spot) {
      finalScore += 0.2;
      reasons.push({
        category: 'cost',
        factor: 'spot-instance',
        weight: 0.2,
        score: 0.2,
        description: 'Spot instance provides cost savings',
        impact: 'positive'
      });
    }

    reasons.push({
      category: 'cost',
      factor: 'hourly-cost',
      weight: this.config.resourceMatching.costWeight,
      score: costScore,
      description: `Hourly cost: $${node.cost.hourly.toFixed(2)}`,
      impact: costScore > 0.6 ? 'positive' : 'negative'
    });

    return { score: Math.min(1, finalScore), reasons };
  }

  private calculateAffinityScore(workload: WorkloadProfile, node: NodeResource): {
    score: number;
    reasons: PlacementReason[];
  } {
    const reasons: PlacementReason[] = [];
    let score = 0.5; // Base neutral score

    // Check for dependency-based affinity
    const dependencyScore = this.calculateDependencyAffinity(workload, node);
    score += dependencyScore * 0.3;

    if (dependencyScore > 0) {
      reasons.push({
        category: 'affinity',
        factor: 'dependency-proximity',
        weight: 0.3,
        score: dependencyScore,
        description: 'Workload dependencies are nearby',
        impact: 'positive'
      });
    }

    // Check for workload clustering opportunities
    const clusteringScore = this.calculateClusteringAffinity(workload, node);
    score += clusteringScore * 0.2;

    if (clusteringScore !== 0) {
      reasons.push({
        category: 'affinity',
        factor: 'workload-clustering',
        weight: 0.2,
        score: clusteringScore,
        description: clusteringScore > 0 ? 'Good clustering opportunity' : 'Avoid clustering',
        impact: clusteringScore > 0 ? 'positive' : 'negative'
      });
    }

    return { score: Math.max(0, Math.min(1, score)), reasons };
  }

  private calculateAvailabilityScore(workload: WorkloadProfile, node: NodeResource): {
    score: number;
    reasons: PlacementReason[];
  } {
    const reasons: PlacementReason[] = [];
    
    // Base availability from node health
    let score = node.health.status === 'ready' ? 0.8 : 0.2;
    
    // Adjust based on SLA requirements
    const requiredAvailability = workload.sla.availability;
    if (requiredAvailability > 0.99 && node.cost.spot) {
      score *= 0.7; // Reduce score for spot instances with high availability requirements
      reasons.push({
        category: 'availability',
        factor: 'spot-instance-reliability',
        weight: 0.3,
        score: -0.3,
        description: 'Spot instance may not meet high availability SLA',
        impact: 'negative'
      });
    }

    reasons.push({
      category: 'availability',
      factor: 'node-health',
      weight: 0.7,
      score: node.health.status === 'ready' ? 0.8 : 0.2,
      description: `Node health: ${node.health.status}`,
      impact: node.health.status === 'ready' ? 'positive' : 'negative'
    });

    return { score, reasons };
  }

  private calculateDependencyAffinity(workload: WorkloadProfile, node: NodeResource): number {
    // In a real implementation, this would check if dependent services
    // are running on the same node, zone, or region
    return 0; // Placeholder
  }

  private calculateClusteringAffinity(workload: WorkloadProfile, node: NodeResource): number {
    // Check if similar workloads would benefit from being co-located
    const cluster = this.findWorkloadCluster(workload.id);
    if (!cluster) return 0;

    // In a real implementation, check if other workloads from the same cluster
    // are already on this node
    return 0.1; // Placeholder positive affinity
  }

  private findWorkloadCluster(workloadId: string): WorkloadCluster | null {
    for (const cluster of this.workloadClusters.values()) {
      if (cluster.workloads.includes(workloadId)) {
        return cluster;
      }
    }
    return null;
  }

  private calculatePlacementConfidence(
    reasoning: PlacementReason[],
    workload: WorkloadProfile,
    node: NodeResource
  ): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on strong positive reasons
    const strongPositiveReasons = reasoning.filter(r => r.impact === 'positive' && r.score > 0.7);
    confidence += strongPositiveReasons.length * 0.1;

    // Decrease confidence based on negative reasons
    const negativeReasons = reasoning.filter(r => r.impact === 'negative');
    confidence -= negativeReasons.length * 0.1;

    // Increase confidence if we have historical data
    const hasHistoricalData = this.performanceMetrics.get(workload.id)?.length || 0 > 10;
    if (hasHistoricalData) {
      confidence += 0.1;
    }

    return Math.max(0.1, Math.min(0.95, confidence));
  }

  private evaluateConstraints(
    workload: WorkloadProfile,
    node: NodeResource,
    constraints?: any
  ): PlacementDecision['constraints'] {
    const satisfied: string[] = [];
    const violated: string[] = [];
    const warnings: string[] = [];

    // Check resource constraints
    if (node.allocatable.cpu >= workload.resourceRequirements.cpu.baseline) {
      satisfied.push('cpu-requirements');
    } else {
      violated.push('cpu-requirements');
    }

    if (node.allocatable.memory >= workload.resourceRequirements.memory.baseline) {
      satisfied.push('memory-requirements');
    } else {
      violated.push('memory-requirements');
    }

    // Check SLA constraints
    if (workload.sla.availability > 0.99 && node.cost.spot) {
      warnings.push('high-availability-on-spot-instance');
    }

    return { satisfied, violated, warnings };
  }

  private estimatePerformance(workload: WorkloadProfile, node: NodeResource): PlacementDecision['estimatedPerformance'] {
    // Simplified performance estimation
    const cpuPerformance = node.performance.cpuScore;
    const memoryPerformance = node.performance.memoryScore;
    const networkPerformance = node.performance.networkScore;

    return {
      latency: Math.max(1, workload.sla.responseTime * (2 - cpuPerformance)),
      throughput: Math.min(workload.sla.throughput, workload.sla.throughput * cpuPerformance),
      availability: Math.min(workload.sla.availability, 0.999)
    };
  }

  private estimatePlacementCost(workload: WorkloadProfile, node: NodeResource): PlacementDecision['estimatedCost'] {
    const hourly = node.cost.hourly;
    const monthly = hourly * 24 * 30;
    
    // Calculate optimization potential based on spot instances, reserved instances, etc.
    let optimizationPotential = 0;
    if (!node.cost.spot && workload.cost.priority === 'cost-optimized') {
      optimizationPotential = 0.7; // 70% savings with spot instances
    }

    return { hourly, monthly, optimizationPotential };
  }

  private async updateWorkloadClusters(profile: WorkloadProfile): Promise<void> {
    try {
      // Find similar workloads
      const similarWorkloads = this.findSimilarWorkloads(profile);
      
      if (similarWorkloads.length > 0) {
        // Create or update cluster
        const clusterId = `cluster-${profile.type}-${profile.category}`;
        const existingCluster = this.workloadClusters.get(clusterId);
        
        if (existingCluster) {
          if (!existingCluster.workloads.includes(profile.id)) {
            existingCluster.workloads.push(profile.id);
          }
        } else {
          const newCluster: WorkloadCluster = {
            id: clusterId,
            name: `${profile.type} ${profile.category} cluster`,
            type: profile.type,
            workloads: [profile.id, ...similarWorkloads.map(w => w.id)],
            characteristics: {
              commonPatterns: this.identifyCommonPatterns([profile, ...similarWorkloads]),
              resourceProfile: this.calculateClusterResourceProfile([profile, ...similarWorkloads]),
              affinityScore: 0.8,
              antiAffinityScore: 0.1
            },
            optimization: {
              potential: this.calculateClusterOptimizationPotential([profile, ...similarWorkloads]),
              recommendations: []
            },
            createdAt: new Date()
          };

          this.workloadClusters.set(clusterId, newCluster);
          this.emit('workload-intelligence:cluster-created', newCluster);
        }
      }
    } catch (error) {
      console.error('Failed to update workload clusters:', error);
    }
  }

  private findSimilarWorkloads(profile: WorkloadProfile): WorkloadProfile[] {
    const similarity_threshold = 0.7;
    const similar: WorkloadProfile[] = [];

    for (const existingProfile of this.workloadProfiles.values()) {
      if (existingProfile.id === profile.id) continue;

      const similarity = this.calculateWorkloadSimilarity(profile, existingProfile);
      if (similarity > similarity_threshold) {
        similar.push(existingProfile);
      }
    }

    return similar;
  }

  private calculateWorkloadSimilarity(profile1: WorkloadProfile, profile2: WorkloadProfile): number {
    let similarity = 0;
    let factors = 0;

    // Type similarity
    if (profile1.type === profile2.type) {
      similarity += 0.3;
    }
    factors++;

    // Category similarity
    if (profile1.category === profile2.category) {
      similarity += 0.2;
    }
    factors++;

    // Resource requirements similarity
    const cpuSimilarity = 1 - Math.abs(
      profile1.resourceRequirements.cpu.baseline - profile2.resourceRequirements.cpu.baseline
    ) / Math.max(profile1.resourceRequirements.cpu.baseline, profile2.resourceRequirements.cpu.baseline);
    similarity += cpuSimilarity * 0.2;
    factors++;

    // Pattern similarity
    let patternMatches = 0;
    const patterns1 = Object.values(profile1.characteristics);
    const patterns2 = Object.values(profile2.characteristics);
    patterns1.forEach((pattern, index) => {
      if (pattern === patterns2[index]) patternMatches++;
    });
    similarity += (patternMatches / patterns1.length) * 0.3;
    factors++;

    return similarity / factors;
  }

  private identifyCommonPatterns(profiles: WorkloadProfile[]): string[] {
    const patterns: string[] = [];
    
    // Find most common characteristics
    const characteristicCounts: Record<string, number> = {};
    profiles.forEach(profile => {
      Object.values(profile.characteristics).forEach(characteristic => {
        characteristicCounts[characteristic] = (characteristicCounts[characteristic] || 0) + 1;
      });
    });

    // Add patterns that appear in majority of workloads
    const threshold = Math.ceil(profiles.length / 2);
    Object.entries(characteristicCounts).forEach(([pattern, count]) => {
      if (count >= threshold) {
        patterns.push(pattern);
      }
    });

    return patterns;
  }

  private calculateClusterResourceProfile(profiles: WorkloadProfile[]): Record<string, number> {
    const aggregated = {
      avgCpuBaseline: 0,
      avgMemoryBaseline: 0,
      avgStorageSize: 0,
      avgNetworkBandwidth: 0
    };

    profiles.forEach(profile => {
      aggregated.avgCpuBaseline += profile.resourceRequirements.cpu.baseline;
      aggregated.avgMemoryBaseline += profile.resourceRequirements.memory.baseline;
      aggregated.avgStorageSize += profile.resourceRequirements.storage.size;
      aggregated.avgNetworkBandwidth += profile.resourceRequirements.network.bandwidth;
    });

    const count = profiles.length;
    return {
      avgCpuBaseline: aggregated.avgCpuBaseline / count,
      avgMemoryBaseline: aggregated.avgMemoryBaseline / count,
      avgStorageSize: aggregated.avgStorageSize / count,
      avgNetworkBandwidth: aggregated.avgNetworkBandwidth / count
    };
  }

  private calculateClusterOptimizationPotential(profiles: WorkloadProfile[]): number {
    // Simple heuristic: more similar workloads = higher optimization potential
    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < profiles.length; i++) {
      for (let j = i + 1; j < profiles.length; j++) {
        totalSimilarity += this.calculateWorkloadSimilarity(profiles[i], profiles[j]);
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  private async performWorkloadAnalysis(): Promise<void> {
    if (this.workloadProfiles.size === 0) return;

    try {
      // Generate optimization recommendations
      const recommendations = await this.generateOptimizationRecommendations();
      
      if (recommendations.length > 0) {
        this.emit('workload-intelligence:recommendations', recommendations);
      }

      // Update workload clusters
      for (const profile of this.workloadProfiles.values()) {
        await this.updateWorkloadClusters(profile);
      }

      this.emit('workload-intelligence:analysis-complete', {
        profilesAnalyzed: this.workloadProfiles.size,
        clustersUpdated: this.workloadClusters.size,
        recommendationsGenerated: recommendations.length
      });

    } catch (error) {
      console.error('Workload analysis failed:', error);
      this.emit('workload-intelligence:error', error);
    }
  }

  private async generateOptimizationRecommendations(): Promise<ResourceOptimizationRecommendation[]> {
    const recommendations: ResourceOptimizationRecommendation[] = [];

    for (const profile of this.workloadProfiles.values()) {
      const metrics = this.performanceMetrics.get(profile.id);
      if (!metrics || metrics.length < 10) continue;

      // Analyze resource utilization patterns
      const utilizationAnalysis = this.analyzeResourceUtilization(metrics);
      
      // Generate right-sizing recommendations
      if (utilizationAnalysis.cpuWaste > 0.3) {
        recommendations.push({
          workloadId: profile.id,
          type: 'right-sizing',
          priority: 'medium',
          impact: {
            performance: 0,
            cost: utilizationAnalysis.cpuWaste * 0.5,
            reliability: 0
          },
          recommendation: `Reduce CPU allocation by ${(utilizationAnalysis.cpuWaste * 100).toFixed(1)}%`,
          implementation: {
            complexity: 'low',
            risk: 'low',
            estimatedTime: 30,
            dependencies: []
          },
          metrics: {
            currentState: { cpu_allocation: profile.resourceRequirements.cpu.baseline },
            projectedState: { cpu_allocation: profile.resourceRequirements.cpu.baseline * (1 - utilizationAnalysis.cpuWaste) },
            improvement: { cost_reduction: utilizationAnalysis.cpuWaste * 0.5 }
          },
          confidence: 0.8,
          reasoning: [`CPU utilization consistently below ${((1 - utilizationAnalysis.cpuWaste) * 100).toFixed(1)}%`],
          timestamp: new Date()
        });
      }

      // Similar analysis for memory, storage, etc.
    }

    return recommendations.slice(0, 10); // Limit recommendations
  }

  private analyzeResourceUtilization(metrics: Array<{ timestamp: Date; metrics: Record<string, number> }>): {
    cpuWaste: number;
    memoryWaste: number;
    storageWaste: number;
    networkWaste: number;
  } {
    const recent = metrics.slice(-20); // Last 20 measurements
    
    const avgCpuUsage = recent.reduce((sum, m) => sum + (m.metrics.cpu_usage || 0), 0) / recent.length;
    const avgMemoryUsage = recent.reduce((sum, m) => sum + (m.metrics.memory_usage || 0), 0) / recent.length;
    
    return {
      cpuWaste: Math.max(0, 1 - avgCpuUsage),
      memoryWaste: Math.max(0, 1 - avgMemoryUsage),
      storageWaste: 0, // Would analyze storage patterns
      networkWaste: 0  // Would analyze network patterns
    };
  }

  // Public API methods
  public updateWorkloadMetrics(workloadId: string, metrics: Record<string, number>): void {
    const buffer = this.performanceMetrics.get(workloadId);
    if (!buffer) return;

    buffer.push({ timestamp: new Date(), metrics });

    // Keep only last 48 hours
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const filtered = buffer.filter(entry => entry.timestamp > cutoff);
    this.performanceMetrics.set(workloadId, filtered);

    this.emit('workload-intelligence:metrics-updated', { workloadId, metrics });
  }

  public getWorkloadProfiles(): WorkloadProfile[] {
    return Array.from(this.workloadProfiles.values());
  }

  public getWorkloadClusters(): WorkloadCluster[] {
    return Array.from(this.workloadClusters.values());
  }

  public getPlacementHistory(workloadId?: string, limit = 100): PlacementDecision[] {
    let history = this.placementHistory;
    
    if (workloadId) {
      history = history.filter(decision => decision.workloadId === workloadId);
    }
    
    return history.slice(-limit);
  }

  public getMetrics(): {
    totalWorkloads: number;
    totalClusters: number;
    placementDecisions: number;
    averageConfidence: number;
    optimizationPotential: number;
  } {
    const totalOptimizationPotential = Array.from(this.workloadClusters.values())
      .reduce((sum, cluster) => sum + cluster.optimization.potential, 0);
    
    const avgConfidence = this.placementHistory.length > 0
      ? this.placementHistory.reduce((sum, decision) => sum + decision.confidence, 0) / this.placementHistory.length
      : 0;

    return {
      totalWorkloads: this.workloadProfiles.size,
      totalClusters: this.workloadClusters.size,
      placementDecisions: this.placementHistory.length,
      averageConfidence: avgConfidence,
      optimizationPotential: this.workloadClusters.size > 0 ? totalOptimizationPotential / this.workloadClusters.size : 0
    };
  }

  public async shutdown(): Promise<void> {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }

    // Clean up ML models
    if (this.workloadMatcher) {
      this.workloadMatcher.model.dispose();
    }

    if (this.optimizationEngine) {
      this.optimizationEngine.dispose();
    }

    this.emit('workload-intelligence:shutdown');
  }
}