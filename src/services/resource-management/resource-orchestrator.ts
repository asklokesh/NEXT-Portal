/**
 * Resource Orchestrator
 * AI-powered resource orchestration engine for intelligent resource allocation and management
 */

import { EventEmitter } from 'events';
import * as tf from '@tensorflow/tfjs-node';
import { ResourceConfig, OrchestrationConfig } from './resource-config';

export interface ResourceAllocation {
  id: string;
  workloadId: string;
  nodeId?: string;
  resources: {
    cpu: string;
    memory: string;
    storage: string;
    network: string;
  };
  constraints: ResourceConstraints;
  status: 'pending' | 'scheduling' | 'running' | 'failed' | 'terminated';
  createdAt: Date;
  scheduledAt?: Date;
  startedAt?: Date;
  metadata: Record<string, any>;
}

export interface ResourceConstraints {
  nodeSelector?: Record<string, string>;
  affinity?: {
    nodeAffinity?: any;
    podAffinity?: any;
    podAntiAffinity?: any;
  };
  tolerations?: Array<{
    key: string;
    operator: string;
    value?: string;
    effect: string;
  }>;
  topologySpreadConstraints?: Array<{
    maxSkew: number;
    topologyKey: string;
    whenUnsatisfiable: 'DoNotSchedule' | 'ScheduleAnyway';
  }>;
}

export interface NodeResource {
  id: string;
  name: string;
  zone: string;
  region: string;
  instanceType: string;
  capacity: {
    cpu: number;
    memory: number;
    storage: number;
    network: number;
    pods: number;
  };
  allocatable: {
    cpu: number;
    memory: number;
    storage: number;
    network: number;
    pods: number;
  };
  allocated: {
    cpu: number;
    memory: number;
    storage: number;
    network: number;
    pods: number;
  };
  labels: Record<string, string>;
  taints: Array<{
    key: string;
    value: string;
    effect: string;
  }>;
  conditions: Array<{
    type: string;
    status: string;
    lastTransitionTime: Date;
  }>;
  cost: {
    hourly: number;
    spot: boolean;
    reserved: boolean;
  };
  performance: {
    cpuScore: number;
    memoryScore: number;
    networkScore: number;
    storageScore: number;
  };
  health: {
    status: 'ready' | 'not-ready' | 'unknown';
    lastHeartbeat: Date;
    diskPressure: boolean;
    memoryPressure: boolean;
    pidPressure: boolean;
  };
}

export interface SchedulingDecision {
  allocationId: string;
  nodeId: string;
  score: number;
  reasons: string[];
  alternative?: {
    nodeId: string;
    score: number;
  };
}

export interface AISchedulingModel {
  model: tf.LayersModel;
  features: string[];
  scaler: {
    mean: number[];
    std: number[];
  };
  version: string;
  accuracy: number;
  lastTrained: Date;
}

export class ResourceOrchestrator extends EventEmitter {
  private config: OrchestrationConfig;
  private allocations: Map<string, ResourceAllocation> = new Map();
  private nodes: Map<string, NodeResource> = new Map();
  private schedulingQueue: ResourceAllocation[] = [];
  private aiModel?: AISchedulingModel;
  private schedulingInProgress = false;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config: ResourceConfig) {
    super();
    this.config = config.orchestration;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.loadAIModel();
      this.startHealthChecking();
      this.emit('orchestrator:initialized');
    } catch (error) {
      console.error('Failed to initialize resource orchestrator:', error);
      this.emit('orchestrator:error', error);
    }
  }

  private async loadAIModel(): Promise<void> {
    try {
      // In production, load from saved model
      // For now, create a simple model for demonstration
      const model = tf.sequential({
        layers: [
          tf.layers.dense({ units: 64, activation: 'relu', inputShape: [10] }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({ units: 32, activation: 'relu' }),
          tf.layers.dense({ units: 1, activation: 'sigmoid' })
        ]
      });

      model.compile({
        optimizer: 'adam',
        loss: 'binaryCrossentropy',
        metrics: ['accuracy']
      });

      this.aiModel = {
        model,
        features: [
          'cpu_usage', 'memory_usage', 'storage_usage', 'network_usage',
          'cpu_request', 'memory_request', 'storage_request', 'network_request',
          'node_score', 'affinity_score'
        ],
        scaler: {
          mean: new Array(10).fill(0.5),
          std: new Array(10).fill(0.2)
        },
        version: '1.0.0',
        accuracy: 0.85,
        lastTrained: new Date()
      };

      console.log('AI scheduling model loaded successfully');
    } catch (error) {
      console.error('Failed to load AI model:', error);
      throw error;
    }
  }

  private startHealthChecking(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  private async performHealthCheck(): Promise<void> {
    const unhealthyNodes = Array.from(this.nodes.values()).filter(node => 
      node.health.status !== 'ready' || 
      Date.now() - node.health.lastHeartbeat.getTime() > this.config.healthCheckInterval * 2
    );

    if (unhealthyNodes.length > 0) {
      this.emit('orchestrator:unhealthy-nodes', unhealthyNodes);
      
      // Reschedule allocations on unhealthy nodes
      for (const node of unhealthyNodes) {
        await this.rescheduleAllocationsFromNode(node.id);
      }
    }
  }

  public async scheduleAllocation(allocation: ResourceAllocation): Promise<SchedulingDecision | null> {
    try {
      allocation.status = 'scheduling';
      this.allocations.set(allocation.id, allocation);
      this.schedulingQueue.push(allocation);

      if (!this.schedulingInProgress) {
        await this.processSchedulingQueue();
      }

      const decision = await this.findOptimalNode(allocation);
      if (decision) {
        await this.executeSchedulingDecision(decision);
        this.emit('orchestrator:scheduled', { allocation, decision });
      } else {
        allocation.status = 'failed';
        this.emit('orchestrator:scheduling-failed', { allocation, reason: 'No suitable node found' });
      }

      return decision;
    } catch (error) {
      console.error(`Failed to schedule allocation ${allocation.id}:`, error);
      allocation.status = 'failed';
      this.emit('orchestrator:error', error);
      return null;
    }
  }

  private async processSchedulingQueue(): Promise<void> {
    if (this.schedulingInProgress || this.schedulingQueue.length === 0) {
      return;
    }

    this.schedulingInProgress = true;

    try {
      const concurrentLimit = Math.min(
        this.config.maxConcurrentDeployments,
        this.schedulingQueue.length
      );

      const batch = this.schedulingQueue.splice(0, concurrentLimit);
      const promises = batch.map(allocation => this.findOptimalNode(allocation));
      
      const decisions = await Promise.all(promises);
      const validDecisions = decisions.filter(decision => decision !== null) as SchedulingDecision[];

      // Execute scheduling decisions in parallel
      await Promise.all(validDecisions.map(decision => this.executeSchedulingDecision(decision)));

      this.emit('orchestrator:batch-scheduled', { count: validDecisions.length });

      // Process remaining queue
      if (this.schedulingQueue.length > 0) {
        setTimeout(() => this.processSchedulingQueue(), 100);
      }
    } catch (error) {
      console.error('Error processing scheduling queue:', error);
      this.emit('orchestrator:error', error);
    } finally {
      this.schedulingInProgress = false;
    }
  }

  private async findOptimalNode(allocation: ResourceAllocation): Promise<SchedulingDecision | null> {
    const availableNodes = this.getAvailableNodes(allocation);
    
    if (availableNodes.length === 0) {
      return null;
    }

    const nodeScores = await Promise.all(
      availableNodes.map(node => this.calculateNodeScore(node, allocation))
    );

    // Sort by score (highest first)
    const rankedNodes = availableNodes
      .map((node, index) => ({ node, score: nodeScores[index] }))
      .sort((a, b) => b.score - a.score);

    const bestNode = rankedNodes[0];
    const alternative = rankedNodes[1];

    if (bestNode.score <= 0) {
      return null;
    }

    return {
      allocationId: allocation.id,
      nodeId: bestNode.node.id,
      score: bestNode.score,
      reasons: this.generateSchedulingReasons(bestNode.node, allocation),
      alternative: alternative ? {
        nodeId: alternative.node.id,
        score: alternative.score
      } : undefined
    };
  }

  private getAvailableNodes(allocation: ResourceAllocation): NodeResource[] {
    const requiredResources = this.parseResourceRequirements(allocation.resources);
    
    return Array.from(this.nodes.values()).filter(node => {
      // Check resource availability
      if (node.allocatable.cpu < requiredResources.cpu ||
          node.allocatable.memory < requiredResources.memory ||
          node.allocatable.storage < requiredResources.storage ||
          node.allocatable.network < requiredResources.network) {
        return false;
      }

      // Check node selectors
      if (allocation.constraints.nodeSelector) {
        const matches = Object.entries(allocation.constraints.nodeSelector).every(
          ([key, value]) => node.labels[key] === value
        );
        if (!matches) return false;
      }

      // Check taints and tolerations
      if (!this.checkTolerations(node.taints, allocation.constraints.tolerations)) {
        return false;
      }

      // Check node health
      if (node.health.status !== 'ready') {
        return false;
      }

      return true;
    });
  }

  private async calculateNodeScore(node: NodeResource, allocation: ResourceAllocation): Promise<number> {
    const baseScore = this.calculateBaseScore(node, allocation);
    const aiScore = await this.calculateAIScore(node, allocation);
    const affinityScore = this.calculateAffinityScore(node, allocation);
    const costScore = this.calculateCostScore(node);
    const performanceScore = this.calculatePerformanceScore(node);

    // Weighted combination based on strategy
    switch (this.config.resourceAllocationStrategy) {
      case 'cost-optimized':
        return baseScore * 0.2 + aiScore * 0.2 + affinityScore * 0.1 + costScore * 0.4 + performanceScore * 0.1;
      case 'performance-optimized':
        return baseScore * 0.3 + aiScore * 0.3 + affinityScore * 0.1 + costScore * 0.1 + performanceScore * 0.2;
      case 'balanced':
      default:
        return baseScore * 0.25 + aiScore * 0.25 + affinityScore * 0.2 + costScore * 0.15 + performanceScore * 0.15;
    }
  }

  private calculateBaseScore(node: NodeResource, allocation: ResourceAllocation): number {
    const requiredResources = this.parseResourceRequirements(allocation.resources);
    
    const cpuUtilization = (node.allocated.cpu + requiredResources.cpu) / node.capacity.cpu;
    const memoryUtilization = (node.allocated.memory + requiredResources.memory) / node.capacity.memory;
    const storageUtilization = (node.allocated.storage + requiredResources.storage) / node.capacity.storage;
    const networkUtilization = (node.allocated.network + requiredResources.network) / node.capacity.network;

    // Penalize high utilization to maintain resource buffer
    const utilizationPenalty = Math.max(
      cpuUtilization > 0.8 ? (cpuUtilization - 0.8) * 5 : 0,
      memoryUtilization > 0.8 ? (memoryUtilization - 0.8) * 5 : 0,
      storageUtilization > 0.9 ? (storageUtilization - 0.9) * 10 : 0,
      networkUtilization > 0.8 ? (networkUtilization - 0.8) * 3 : 0
    );

    // Reward balanced resource usage
    const balanceScore = 1 - Math.abs(cpuUtilization - memoryUtilization);

    return Math.max(0, balanceScore - utilizationPenalty);
  }

  private async calculateAIScore(node: NodeResource, allocation: ResourceAllocation): Promise<number> {
    if (!this.aiModel) {
      return 0.5; // Fallback score
    }

    try {
      const features = this.extractFeatures(node, allocation);
      const normalizedFeatures = this.normalizeFeatures(features);
      
      const prediction = this.aiModel.model.predict(tf.tensor2d([normalizedFeatures])) as tf.Tensor;
      const score = await prediction.data();
      
      prediction.dispose();
      
      return score[0];
    } catch (error) {
      console.error('AI scoring error:', error);
      return 0.5;
    }
  }

  private calculateAffinityScore(node: NodeResource, allocation: ResourceAllocation): number {
    let score = 0.5; // Base score

    if (allocation.constraints.affinity?.nodeAffinity) {
      // Implement node affinity scoring logic
      score += 0.2;
    }

    if (allocation.constraints.affinity?.podAffinity) {
      // Check for co-located pods that this allocation should be near
      const colocatedPods = this.getPodsOnNode(node.id, allocation.constraints.affinity.podAffinity);
      score += colocatedPods.length > 0 ? 0.3 : 0;
    }

    if (allocation.constraints.affinity?.podAntiAffinity) {
      // Check for pods that this allocation should avoid
      const avoidPods = this.getPodsOnNode(node.id, allocation.constraints.affinity.podAntiAffinity);
      score -= avoidPods.length * 0.2;
    }

    return Math.max(0, Math.min(1, score));
  }

  private calculateCostScore(node: NodeResource): number {
    // Lower cost = higher score
    const maxCost = 10; // Assume max hourly cost of $10
    const normalizedCost = node.cost.hourly / maxCost;
    const costScore = 1 - normalizedCost;

    // Bonus for spot instances
    const spotBonus = node.cost.spot ? 0.2 : 0;
    
    // Bonus for reserved instances
    const reservedBonus = node.cost.reserved ? 0.1 : 0;

    return Math.min(1, costScore + spotBonus + reservedBonus);
  }

  private calculatePerformanceScore(node: NodeResource): number {
    return (
      node.performance.cpuScore +
      node.performance.memoryScore +
      node.performance.networkScore +
      node.performance.storageScore
    ) / 4;
  }

  private extractFeatures(node: NodeResource, allocation: ResourceAllocation): number[] {
    const requiredResources = this.parseResourceRequirements(allocation.resources);
    
    return [
      node.allocated.cpu / node.capacity.cpu,
      node.allocated.memory / node.capacity.memory,
      node.allocated.storage / node.capacity.storage,
      node.allocated.network / node.capacity.network,
      requiredResources.cpu / node.capacity.cpu,
      requiredResources.memory / node.capacity.memory,
      requiredResources.storage / node.capacity.storage,
      requiredResources.network / node.capacity.network,
      (node.performance.cpuScore + node.performance.memoryScore + 
       node.performance.networkScore + node.performance.storageScore) / 4,
      this.calculateAffinityScore(node, allocation)
    ];
  }

  private normalizeFeatures(features: number[]): number[] {
    if (!this.aiModel) return features;
    
    return features.map((feature, index) => {
      const mean = this.aiModel!.scaler.mean[index];
      const std = this.aiModel!.scaler.std[index];
      return (feature - mean) / std;
    });
  }

  private async executeSchedulingDecision(decision: SchedulingDecision): Promise<void> {
    const allocation = this.allocations.get(decision.allocationId);
    const node = this.nodes.get(decision.nodeId);

    if (!allocation || !node) {
      throw new Error(`Invalid scheduling decision: allocation ${decision.allocationId} or node ${decision.nodeId} not found`);
    }

    try {
      // Update node resources
      const requiredResources = this.parseResourceRequirements(allocation.resources);
      node.allocated.cpu += requiredResources.cpu;
      node.allocated.memory += requiredResources.memory;
      node.allocated.storage += requiredResources.storage;
      node.allocated.network += requiredResources.network;
      node.allocated.pods += 1;

      // Update allocation
      allocation.nodeId = node.id;
      allocation.status = 'running';
      allocation.scheduledAt = new Date();
      allocation.startedAt = new Date();

      this.emit('orchestrator:allocation-started', { allocation, node });
    } catch (error) {
      console.error(`Failed to execute scheduling decision for ${decision.allocationId}:`, error);
      throw error;
    }
  }

  private generateSchedulingReasons(node: NodeResource, allocation: ResourceAllocation): string[] {
    const reasons = [];
    
    reasons.push(`Selected node ${node.name} in zone ${node.zone}`);
    
    if (node.cost.spot) {
      reasons.push('Cost-optimized: Using spot instance');
    }
    
    if (node.performance.cpuScore > 0.8) {
      reasons.push('High CPU performance score');
    }
    
    if (allocation.constraints.nodeSelector) {
      reasons.push('Matches node selector requirements');
    }
    
    return reasons;
  }

  private parseResourceRequirements(resources: ResourceAllocation['resources']): {
    cpu: number;
    memory: number;
    storage: number;
    network: number;
  } {
    return {
      cpu: this.parseResource(resources.cpu, 'cpu'),
      memory: this.parseResource(resources.memory, 'memory'),
      storage: this.parseResource(resources.storage, 'storage'),
      network: this.parseResource(resources.network, 'network')
    };
  }

  private parseResource(resource: string, type: 'cpu' | 'memory' | 'storage' | 'network'): number {
    switch (type) {
      case 'cpu':
        return resource.endsWith('m') ? parseInt(resource.slice(0, -1)) / 1000 : parseFloat(resource);
      case 'memory':
        if (resource.endsWith('Ki')) return parseInt(resource.slice(0, -2)) * 1024;
        if (resource.endsWith('Mi')) return parseInt(resource.slice(0, -2)) * 1024 * 1024;
        if (resource.endsWith('Gi')) return parseInt(resource.slice(0, -2)) * 1024 * 1024 * 1024;
        return parseInt(resource);
      case 'storage':
        if (resource.endsWith('Ki')) return parseInt(resource.slice(0, -2)) * 1024;
        if (resource.endsWith('Mi')) return parseInt(resource.slice(0, -2)) * 1024 * 1024;
        if (resource.endsWith('Gi')) return parseInt(resource.slice(0, -2)) * 1024 * 1024 * 1024;
        return parseInt(resource);
      case 'network':
        if (resource.endsWith('Mbps')) return parseInt(resource.slice(0, -4));
        if (resource.endsWith('Gbps')) return parseInt(resource.slice(0, -4)) * 1000;
        return parseInt(resource);
      default:
        return 0;
    }
  }

  private checkTolerations(taints: NodeResource['taints'], tolerations?: ResourceConstraints['tolerations']): boolean {
    if (!tolerations || tolerations.length === 0) {
      return taints.length === 0;
    }

    return taints.every(taint => 
      tolerations.some(toleration => 
        toleration.key === taint.key &&
        (toleration.operator === 'Exists' || toleration.value === taint.value) &&
        toleration.effect === taint.effect
      )
    );
  }

  private getPodsOnNode(nodeId: string, affinityRules: any): any[] {
    // In production, query actual pods on the node
    return [];
  }

  private async rescheduleAllocationsFromNode(nodeId: string): Promise<void> {
    const affectedAllocations = Array.from(this.allocations.values())
      .filter(allocation => allocation.nodeId === nodeId && allocation.status === 'running');

    for (const allocation of affectedAllocations) {
      allocation.status = 'pending';
      allocation.nodeId = undefined;
      this.schedulingQueue.push(allocation);
    }

    if (affectedAllocations.length > 0) {
      this.emit('orchestrator:rescheduling', { 
        nodeId, 
        count: affectedAllocations.length 
      });
    }
  }

  // Public API methods
  public registerNode(node: NodeResource): void {
    this.nodes.set(node.id, node);
    this.emit('orchestrator:node-registered', node);
  }

  public unregisterNode(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      this.nodes.delete(nodeId);
      this.rescheduleAllocationsFromNode(nodeId);
      this.emit('orchestrator:node-unregistered', node);
    }
  }

  public updateNodeHealth(nodeId: string, health: Partial<NodeResource['health']>): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.health = { ...node.health, ...health };
      this.emit('orchestrator:node-updated', node);
    }
  }

  public getAllocations(): ResourceAllocation[] {
    return Array.from(this.allocations.values());
  }

  public getNodes(): NodeResource[] {
    return Array.from(this.nodes.values());
  }

  public getSchedulingQueue(): ResourceAllocation[] {
    return [...this.schedulingQueue];
  }

  public async terminateAllocation(allocationId: string): Promise<void> {
    const allocation = this.allocations.get(allocationId);
    if (!allocation) {
      throw new Error(`Allocation ${allocationId} not found`);
    }

    const node = allocation.nodeId ? this.nodes.get(allocation.nodeId) : null;
    if (node) {
      const requiredResources = this.parseResourceRequirements(allocation.resources);
      node.allocated.cpu -= requiredResources.cpu;
      node.allocated.memory -= requiredResources.memory;
      node.allocated.storage -= requiredResources.storage;
      node.allocated.network -= requiredResources.network;
      node.allocated.pods -= 1;
    }

    allocation.status = 'terminated';
    this.allocations.delete(allocationId);
    this.emit('orchestrator:allocation-terminated', allocation);
  }

  public async retrainAIModel(trainingData: Array<{ features: number[]; label: number }>): Promise<void> {
    if (!this.aiModel || trainingData.length === 0) {
      return;
    }

    try {
      const features = tf.tensor2d(trainingData.map(d => d.features));
      const labels = tf.tensor2d(trainingData.map(d => [d.label]));

      await this.aiModel.model.fit(features, labels, {
        epochs: 50,
        batchSize: 32,
        validationSplit: 0.2,
        shuffle: true
      });

      features.dispose();
      labels.dispose();

      this.aiModel.lastTrained = new Date();
      this.emit('orchestrator:model-retrained', this.aiModel);
    } catch (error) {
      console.error('Failed to retrain AI model:', error);
      this.emit('orchestrator:error', error);
    }
  }

  public getMetrics(): {
    totalAllocations: number;
    runningAllocations: number;
    failedAllocations: number;
    totalNodes: number;
    healthyNodes: number;
    averageNodeUtilization: number;
    schedulingQueueLength: number;
  } {
    const allocations = Array.from(this.allocations.values());
    const nodes = Array.from(this.nodes.values());
    
    return {
      totalAllocations: allocations.length,
      runningAllocations: allocations.filter(a => a.status === 'running').length,
      failedAllocations: allocations.filter(a => a.status === 'failed').length,
      totalNodes: nodes.length,
      healthyNodes: nodes.filter(n => n.health.status === 'ready').length,
      averageNodeUtilization: nodes.length > 0 
        ? nodes.reduce((sum, n) => sum + (n.allocated.cpu / n.capacity.cpu), 0) / nodes.length 
        : 0,
      schedulingQueueLength: this.schedulingQueue.length
    };
  }

  public async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Clean up AI model
    if (this.aiModel) {
      this.aiModel.model.dispose();
    }

    this.emit('orchestrator:shutdown');
  }
}