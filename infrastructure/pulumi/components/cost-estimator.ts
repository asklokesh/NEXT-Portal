import * as pulumi from '@pulumi/pulumi';
import { estimateMonthlyCost } from './providers';

export interface CostEstimatorArgs {
  provider: string;
  region: string;
  environment: string;
}

export class CostEstimator extends pulumi.ComponentResource {
  public readonly estimatedMonthlyCost: pulumi.Output<number>;
  public readonly costBreakdown: pulumi.Output<any>;
  public readonly costOptimizations: pulumi.Output<string[]>;

  constructor(args: CostEstimatorArgs, opts?: pulumi.ComponentResourceOptions) {
    super('saas-idp:cost:Estimator', 'cost-estimator', {}, opts);

    // Define resource pricing based on environment and provider
    const resourcePricing = this.getResourcePricing(args.provider, args.environment);
    
    // Calculate base infrastructure cost
    const baseCost = this.calculateBaseCost(resourcePricing, args.environment);
    
    // Calculate additional service costs
    const serviceCosts = this.calculateServiceCosts(resourcePricing, args.environment);
    
    // Calculate data transfer costs
    const dataTransferCost = this.calculateDataTransferCost(args.provider, args.environment);
    
    // Calculate total monthly cost
    this.estimatedMonthlyCost = pulumi.output(
      baseCost + serviceCosts + dataTransferCost
    );

    // Generate cost breakdown
    this.costBreakdown = pulumi.output({
      compute: resourcePricing.compute * this.getComputeMultiplier(args.environment),
      database: resourcePricing.database * this.getDatabaseMultiplier(args.environment),
      storage: resourcePricing.storage * this.getStorageMultiplier(args.environment),
      network: resourcePricing.network * this.getNetworkMultiplier(args.environment),
      cdn: resourcePricing.cdn * this.getCDNMultiplier(args.environment),
      monitoring: resourcePricing.monitoring * this.getMonitoringMultiplier(args.environment),
      backup: resourcePricing.backup * this.getBackupMultiplier(args.environment),
      dataTransfer: dataTransferCost,
      total: baseCost + serviceCosts + dataTransferCost,
      currency: 'USD',
      period: 'monthly'
    });

    // Generate cost optimization recommendations
    this.costOptimizations = pulumi.output(
      this.generateOptimizationRecommendations(args.environment, resourcePricing)
    );

    this.registerOutputs({
      estimatedMonthlyCost: this.estimatedMonthlyCost,
      costBreakdown: this.costBreakdown,
      costOptimizations: this.costOptimizations
    });
  }

  private getResourcePricing(provider: string, environment: string): any {
    const pricing: any = {
      aws: {
        compute: {
          't3.medium': 30.24,
          't3.large': 60.48,
          't3.xlarge': 120.96,
          'fargate-vcpu': 0.04048, // per vCPU per hour
          'fargate-memory': 0.004445 // per GB per hour
        },
        database: {
          'db.t3.medium': 49.92,
          'db.t3.large': 99.84,
          'db.r6g.xlarge': 403.20,
          'cache.t3.micro': 12.96,
          'cache.t3.small': 25.92,
          'cache.r6g.large': 111.60
        },
        storage: {
          's3-standard': 0.023, // per GB
          's3-ia': 0.0125, // per GB
          's3-glacier': 0.004, // per GB
          'ebs-gp3': 0.08 // per GB
        },
        network: {
          'nat-gateway': 45.00,
          'load-balancer': 22.50,
          'data-transfer': 0.09 // per GB
        },
        cdn: {
          'cloudfront-requests': 0.0075, // per 10,000 requests
          'cloudfront-transfer': 0.085 // per GB
        },
        monitoring: {
          'cloudwatch-metrics': 0.30, // per metric
          'cloudwatch-logs': 0.50, // per GB ingested
          'xray-traces': 0.000005 // per trace
        },
        backup: {
          'snapshot-storage': 0.05, // per GB
          'backup-storage': 0.023 // per GB
        }
      },
      gcp: {
        compute: {
          'n1-standard-2': 48.91,
          'n1-standard-4': 97.83,
          'n1-standard-8': 195.65,
          'cloud-run': 0.00002400 // per vCPU-second
        },
        database: {
          'db-f1-micro': 13.57,
          'db-custom-2-7680': 118.34,
          'db-custom-4-16384': 350.78,
          'redis-basic': 35.00,
          'redis-standard': 140.00
        },
        storage: {
          'storage-standard': 0.020,
          'storage-nearline': 0.010,
          'storage-coldline': 0.004,
          'storage-archive': 0.0012
        },
        network: {
          'cloud-nat': 45.00,
          'load-balancer': 18.00,
          'data-transfer': 0.12
        },
        cdn: {
          'cloud-cdn-cache-fill': 0.08,
          'cloud-cdn-cache-egress': 0.08
        },
        monitoring: {
          'monitoring-metrics': 0.258,
          'logging-ingestion': 0.50,
          'trace-ingestion': 0.20
        },
        backup: {
          'snapshot-storage': 0.026,
          'backup-storage': 0.020
        }
      },
      azure: {
        compute: {
          'Standard_B2s': 30.37,
          'Standard_B4ms': 121.47,
          'Standard_D4s_v3': 140.16,
          'container-instances': 0.0000125 // per vCPU-second
        },
        database: {
          'Basic_A2': 43.80,
          'Standard_S2': 73.00,
          'Premium_P4': 467.40,
          'cache-basic': 43.00,
          'cache-standard': 161.00
        },
        storage: {
          'storage-hot': 0.0184,
          'storage-cool': 0.01,
          'storage-archive': 0.00099
        },
        network: {
          'nat-gateway': 45.00,
          'load-balancer': 22.50,
          'data-transfer': 0.087
        },
        cdn: {
          'cdn-standard': 0.081,
          'cdn-premium': 0.158
        },
        monitoring: {
          'monitor-metrics': 0.30,
          'log-analytics': 2.30, // per GB
          'app-insights': 2.30 // per GB
        },
        backup: {
          'backup-storage': 0.0224,
          'snapshot-storage': 0.05
        }
      }
    };

    return pricing[provider] || pricing.aws;
  }

  private calculateBaseCost(pricing: any, environment: string): number {
    let cost = 0;

    // Compute costs
    if (environment === 'production') {
      cost += pricing.compute['t3.xlarge'] || pricing.compute['n1-standard-8'] || pricing.compute['Standard_D4s_v3'] || 200;
      cost *= 3; // 3 instances minimum
    } else if (environment === 'staging') {
      cost += pricing.compute['t3.large'] || pricing.compute['n1-standard-4'] || pricing.compute['Standard_B4ms'] || 100;
      cost *= 2; // 2 instances
    } else {
      cost += pricing.compute['t3.medium'] || pricing.compute['n1-standard-2'] || pricing.compute['Standard_B2s'] || 50;
    }

    // Database costs
    if (environment === 'production') {
      cost += pricing.database['db.r6g.xlarge'] || pricing.database['db-custom-4-16384'] || pricing.database['Premium_P4'] || 400;
      cost += pricing.database['cache.r6g.large'] || pricing.database['redis-standard'] || pricing.database['cache-standard'] || 150;
    } else if (environment === 'staging') {
      cost += pricing.database['db.t3.large'] || pricing.database['db-custom-2-7680'] || pricing.database['Standard_S2'] || 100;
      cost += pricing.database['cache.t3.small'] || pricing.database['redis-basic'] || pricing.database['cache-basic'] || 40;
    } else {
      cost += pricing.database['db.t3.medium'] || pricing.database['db-f1-micro'] || pricing.database['Basic_A2'] || 50;
      cost += pricing.database['cache.t3.micro'] || pricing.database['redis-basic'] || pricing.database['cache-basic'] || 20;
    }

    // Storage costs (estimated GB usage)
    const storageGB = environment === 'production' ? 1000 : environment === 'staging' ? 500 : 100;
    cost += (pricing.storage['s3-standard'] || pricing.storage['storage-standard'] || pricing.storage['storage-hot'] || 0.023) * storageGB;

    // Network costs
    cost += pricing.network['nat-gateway'] || 45;
    cost += pricing.network['load-balancer'] || 22.5;

    return cost;
  }

  private calculateServiceCosts(pricing: any, environment: string): number {
    let cost = 0;

    // CDN costs (estimated usage)
    const cdnRequests = environment === 'production' ? 10000000 : environment === 'staging' ? 1000000 : 100000;
    const cdnTransferGB = environment === 'production' ? 1000 : environment === 'staging' ? 100 : 10;
    
    cost += (pricing.cdn['cloudfront-requests'] || 0.0075) * (cdnRequests / 10000);
    cost += (pricing.cdn['cloudfront-transfer'] || pricing.cdn['cloud-cdn-cache-egress'] || pricing.cdn['cdn-standard'] || 0.085) * cdnTransferGB;

    // Monitoring costs
    const metrics = environment === 'production' ? 100 : environment === 'staging' ? 50 : 20;
    const logsGB = environment === 'production' ? 100 : environment === 'staging' ? 50 : 10;
    
    cost += (pricing.monitoring['cloudwatch-metrics'] || pricing.monitoring['monitoring-metrics'] || pricing.monitoring['monitor-metrics'] || 0.30) * metrics;
    cost += (pricing.monitoring['cloudwatch-logs'] || pricing.monitoring['logging-ingestion'] || pricing.monitoring['log-analytics'] || 0.50) * logsGB;

    // Backup costs
    const backupGB = environment === 'production' ? 500 : environment === 'staging' ? 200 : 50;
    cost += (pricing.backup['backup-storage'] || 0.023) * backupGB;
    cost += (pricing.backup['snapshot-storage'] || 0.05) * (backupGB * 0.5); // Snapshots are typically smaller

    return cost;
  }

  private calculateDataTransferCost(provider: string, environment: string): number {
    // Estimated data transfer in GB
    const dataTransferGB = environment === 'production' ? 5000 : environment === 'staging' ? 1000 : 100;
    
    const transferRates: any = {
      aws: 0.09,
      gcp: 0.12,
      azure: 0.087
    };

    return (transferRates[provider] || 0.09) * dataTransferGB;
  }

  private getComputeMultiplier(environment: string): number {
    return environment === 'production' ? 3 : environment === 'staging' ? 2 : 1;
  }

  private getDatabaseMultiplier(environment: string): number {
    return environment === 'production' ? 1.5 : 1;
  }

  private getStorageMultiplier(environment: string): number {
    return environment === 'production' ? 10 : environment === 'staging' ? 5 : 1;
  }

  private getNetworkMultiplier(environment: string): number {
    return environment === 'production' ? 2 : 1;
  }

  private getCDNMultiplier(environment: string): number {
    return environment === 'production' ? 10 : environment === 'staging' ? 2 : 1;
  }

  private getMonitoringMultiplier(environment: string): number {
    return environment === 'production' ? 5 : environment === 'staging' ? 2 : 1;
  }

  private getBackupMultiplier(environment: string): number {
    return environment === 'production' ? 10 : environment === 'staging' ? 4 : 1;
  }

  private generateOptimizationRecommendations(environment: string, pricing: any): string[] {
    const recommendations: string[] = [];

    if (environment === 'development') {
      recommendations.push('Consider using spot instances or preemptible VMs for development workloads');
      recommendations.push('Use auto-shutdown schedules for non-business hours');
      recommendations.push('Reduce backup retention period to 7 days');
      recommendations.push('Use single-AZ deployments for non-critical components');
    }

    if (environment === 'staging') {
      recommendations.push('Implement auto-scaling with conservative thresholds');
      recommendations.push('Use lifecycle policies to move old data to cheaper storage tiers');
      recommendations.push('Consider using reserved instances for predictable workloads');
      recommendations.push('Optimize container resource requests and limits');
    }

    if (environment === 'production') {
      recommendations.push('Purchase reserved instances or committed use discounts for steady-state workloads');
      recommendations.push('Implement intelligent tiering for S3/storage to optimize costs');
      recommendations.push('Use CDN more aggressively to reduce origin traffic');
      recommendations.push('Consider multi-region active-passive setup instead of active-active');
      recommendations.push('Optimize database queries to reduce instance size requirements');
      recommendations.push('Implement cost allocation tags for better cost tracking');
      recommendations.push('Use AWS Cost Explorer/GCP Cost Management/Azure Cost Management for detailed analysis');
    }

    // General recommendations
    recommendations.push('Review and remove unused resources regularly');
    recommendations.push('Implement resource tagging for cost allocation');
    recommendations.push('Set up billing alerts for unexpected cost increases');
    recommendations.push('Use native cloud services instead of self-managed solutions where possible');
    recommendations.push('Optimize data transfer by keeping traffic within the same region/AZ');

    return recommendations;
  }
}