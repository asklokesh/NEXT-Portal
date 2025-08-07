import { KubernetesApi } from '@kubernetes/client-node';
import { EventEmitter } from 'events';
import { ProgressiveDeployment, MultiRegionDeployment } from './types';
import { ProgressiveDeliveryOrchestrator } from './orchestrator';

export class MultiRegionManager extends EventEmitter {
  private k8sApi: KubernetesApi;
  private regionOrchestrators = new Map<string, ProgressiveDeliveryOrchestrator>();
  private activeDeployments = new Map<string, MultiRegionDeployment>();

  constructor(k8sApi: KubernetesApi) {
    super();
    this.k8sApi = k8sApi;
    this.initializeRegionOrchestrators();
  }

  async deployMultiRegion(deployment: ProgressiveDeployment): Promise<MultiRegionDeployment> {
    const { multiRegion } = deployment.config;
    
    if (!multiRegion.enabled) {
      throw new Error('Multi-region deployment not enabled');
    }

    const multiRegionDeployment: MultiRegionDeployment = {
      id: `mr-${deployment.id}`,
      name: `${deployment.name}-multi-region`,
      regions: multiRegion.regions.map(region => ({
        name: region,
        status: 'pending',
        dependsOn: this.calculateDependencies(region, multiRegion.regions, multiRegion.strategy)
      })),
      strategy: multiRegion.strategy,
      globalStatus: 'pending'
    };

    this.activeDeployments.set(multiRegionDeployment.id, multiRegionDeployment);
    
    await this.executeMultiRegionDeployment(deployment, multiRegionDeployment);
    
    return multiRegionDeployment;
  }

  private async executeMultiRegionDeployment(deployment: ProgressiveDeployment, multiRegionDeployment: MultiRegionDeployment): Promise<void> {
    multiRegionDeployment.globalStatus = 'running';
    this.emit('multiRegionStarted', { deployment, multiRegionDeployment });
    
    switch (multiRegionDeployment.strategy) {
      case 'sequential':
        await this.executeSequentialDeployment(deployment, multiRegionDeployment);
        break;
      case 'parallel':
        await this.executeParallelDeployment(deployment, multiRegionDeployment);
        break;
      case 'canary-first':
        await this.executeCanaryFirstDeployment(deployment, multiRegionDeployment);
        break;
    }
  }

  private async executeSequentialDeployment(deployment: ProgressiveDeployment, multiRegionDeployment: MultiRegionDeployment): Promise<void> {
    for (const region of multiRegionDeployment.regions) {
      try {
        region.status = 'running';
        
        const regionDeployment = await this.createRegionDeployment(deployment, region.name);
        const orchestrator = this.regionOrchestrators.get(region.name);
        
        if (!orchestrator) {
          throw new Error(`No orchestrator found for region ${region.name}`);
        }
        
        region.deployment = await orchestrator.startDeployment(regionDeployment.config);
        
        // Wait for completion
        await this.waitForDeploymentCompletion(region.deployment);
        
        region.status = 'succeeded';
        this.emit('regionCompleted', { multiRegionDeployment, region });
        
      } catch (error) {
        region.status = 'failed';
        multiRegionDeployment.globalStatus = 'failed';
        
        this.emit('regionFailed', { multiRegionDeployment, region, error });
        
        if (deployment.config.rollback.automatic) {
          await this.rollbackCompletedRegions(multiRegionDeployment);
        }
        
        throw error;
      }
    }
    
    multiRegionDeployment.globalStatus = 'succeeded';
    this.emit('multiRegionCompleted', { multiRegionDeployment });
  }

  private async executeParallelDeployment(deployment: ProgressiveDeployment, multiRegionDeployment: MultiRegionDeployment): Promise<void> {
    const deploymentPromises = multiRegionDeployment.regions.map(async (region) => {
      try {
        region.status = 'running';
        
        const regionDeployment = await this.createRegionDeployment(deployment, region.name);
        const orchestrator = this.regionOrchestrators.get(region.name);
        
        if (!orchestrator) {
          throw new Error(`No orchestrator found for region ${region.name}`);
        }
        
        region.deployment = await orchestrator.startDeployment(regionDeployment.config);
        
        await this.waitForDeploymentCompletion(region.deployment);
        
        region.status = 'succeeded';
        this.emit('regionCompleted', { multiRegionDeployment, region });
        
      } catch (error) {
        region.status = 'failed';
        this.emit('regionFailed', { multiRegionDeployment, region, error });
        throw error;
      }
    });
    
    try {
      await Promise.all(deploymentPromises);
      multiRegionDeployment.globalStatus = 'succeeded';
      this.emit('multiRegionCompleted', { multiRegionDeployment });
    } catch (error) {
      multiRegionDeployment.globalStatus = 'partial';
      this.emit('multiRegionPartialFailure', { multiRegionDeployment, error });
      
      if (deployment.config.rollback.automatic) {
        await this.rollbackSucceededRegions(multiRegionDeployment);
      }
    }
  }

  private async executeCanaryFirstDeployment(deployment: ProgressiveDeployment, multiRegionDeployment: MultiRegionDeployment): Promise<void> {
    // Deploy to primary region first as canary
    const primaryRegion = multiRegionDeployment.regions[0];
    primaryRegion.status = 'running';
    
    const canaryDeployment = await this.createRegionDeployment(deployment, primaryRegion.name);
    // Modify config for canary deployment
    canaryDeployment.config.strategy = 'canary';
    canaryDeployment.config.traffic.maxWeight = 10; // Start with 10%
    
    const orchestrator = this.regionOrchestrators.get(primaryRegion.name);
    if (!orchestrator) {
      throw new Error(`No orchestrator found for region ${primaryRegion.name}`);
    }
    
    primaryRegion.deployment = await orchestrator.startDeployment(canaryDeployment.config);
    
    // Monitor canary for stability
    await this.monitorCanaryStability(primaryRegion.deployment);
    
    if (primaryRegion.deployment.status === 'succeeded') {
      // Proceed with other regions
      const remainingRegions = multiRegionDeployment.regions.slice(1);
      
      for (const region of remainingRegions) {
        const regionDeployment = await this.createRegionDeployment(deployment, region.name);
        const regionOrchestrator = this.regionOrchestrators.get(region.name);
        
        if (regionOrchestrator) {
          region.deployment = await regionOrchestrator.startDeployment(regionDeployment.config);
          await this.waitForDeploymentCompletion(region.deployment);
          region.status = 'succeeded';
        }
      }
      
      multiRegionDeployment.globalStatus = 'succeeded';
    } else {
      multiRegionDeployment.globalStatus = 'failed';
      await this.rollbackCompletedRegions(multiRegionDeployment);
    }
  }

  private async createRegionDeployment(deployment: ProgressiveDeployment, region: string): Promise<ProgressiveDeployment> {
    return {
      ...deployment,
      id: `${deployment.id}-${region}`,
      name: `${deployment.name}-${region}`,
      namespace: `${deployment.namespace}-${region}`,
      config: {
        ...deployment.config,
        service: {
          ...deployment.config.service,
          namespace: `${deployment.config.service.namespace}-${region}`
        }
      },
      metadata: {
        ...deployment.metadata,
        region
      }
    };
  }

  private calculateDependencies(region: string, regions: string[], strategy: string): string[] {
    if (strategy === 'sequential') {
      const index = regions.indexOf(region);
      return index > 0 ? [regions[index - 1]] : [];
    }
    
    if (strategy === 'canary-first' && region !== regions[0]) {
      return [regions[0]]; // All regions depend on the first (canary) region
    }
    
    return []; // No dependencies for parallel
  }

  private async waitForDeploymentCompletion(deployment: ProgressiveDeployment): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkStatus = () => {
        if (deployment.status === 'succeeded') {
          resolve();
        } else if (deployment.status === 'failed') {
          reject(new Error(`Deployment ${deployment.id} failed`));
        } else {
          setTimeout(checkStatus, 5000); // Check every 5 seconds
        }
      };
      
      checkStatus();
    });
  }

  private async monitorCanaryStability(deployment: ProgressiveDeployment): Promise<void> {
    // Monitor canary for 15 minutes
    const monitoringDuration = 15 * 60 * 1000;
    const checkInterval = 30 * 1000;
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const monitor = () => {
        const elapsed = Date.now() - startTime;
        
        if (elapsed >= monitoringDuration) {
          if (deployment.status === 'running') {
            deployment.status = 'succeeded'; // Consider stable after monitoring period
          }
          resolve();
          return;
        }
        
        if (deployment.status === 'failed') {
          reject(new Error('Canary failed during stability monitoring'));
          return;
        }
        
        setTimeout(monitor, checkInterval);
      };
      
      monitor();
    });
  }

  private async rollbackCompletedRegions(multiRegionDeployment: MultiRegionDeployment): Promise<void> {
    const completedRegions = multiRegionDeployment.regions.filter(r => r.status === 'succeeded' && r.deployment);
    
    for (const region of completedRegions) {
      try {
        const orchestrator = this.regionOrchestrators.get(region.name);
        if (orchestrator && region.deployment) {
          await orchestrator.rollbackDeployment(region.deployment.id, 'Multi-region rollback');
        }
      } catch (error) {
        console.error(`Failed to rollback region ${region.name}:`, error);
      }
    }
  }

  private async rollbackSucceededRegions(multiRegionDeployment: MultiRegionDeployment): Promise<void> {
    const succeededRegions = multiRegionDeployment.regions.filter(r => r.status === 'succeeded' && r.deployment);
    
    await Promise.all(succeededRegions.map(async (region) => {
      try {
        const orchestrator = this.regionOrchestrators.get(region.name);
        if (orchestrator && region.deployment) {
          await orchestrator.rollbackDeployment(region.deployment.id, 'Multi-region partial failure rollback');
        }
      } catch (error) {
        console.error(`Failed to rollback region ${region.name}:`, error);
      }
    }));
  }

  private initializeRegionOrchestrators(): void {
    const regions = (process.env.SUPPORTED_REGIONS || 'us-east-1,us-west-2,eu-west-1').split(',');
    
    for (const region of regions) {
      // Create region-specific orchestrator with region-specific k8s config
      const orchestrator = new ProgressiveDeliveryOrchestrator(this.getRegionKubeConfig(region));
      this.regionOrchestrators.set(region, orchestrator);
    }
  }

  private getRegionKubeConfig(region: string): string | undefined {
    return process.env[`KUBECONFIG_${region.toUpperCase().replace('-', '_')}`];
  }

  async getMultiRegionStatus(deploymentId: string): Promise<MultiRegionDeployment | null> {
    return this.activeDeployments.get(deploymentId) || null;
  }

  async terminateMultiRegionDeployment(deploymentId: string): Promise<void> {
    const multiRegionDeployment = this.activeDeployments.get(deploymentId);
    if (!multiRegionDeployment) {
      throw new Error('Multi-region deployment not found');
    }
    
    // Terminate all region deployments
    for (const region of multiRegionDeployment.regions) {
      if (region.deployment && region.status === 'running') {
        const orchestrator = this.regionOrchestrators.get(region.name);
        if (orchestrator) {
          await orchestrator.terminateDeployment(region.deployment.id, 'Multi-region termination');
        }
      }
    }
    
    multiRegionDeployment.globalStatus = 'failed';
    this.activeDeployments.delete(deploymentId);
    
    this.emit('multiRegionTerminated', { multiRegionDeployment });
  }
}