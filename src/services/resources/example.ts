/**
 * Example usage of the Intelligent Resource Management System
 */

import { 
  createResourceManagementSystem,
  CloudProvider,
  ResourceType,
  ScalingAction
} from './index';
import { getEnvironmentConfig, validateConfig } from './config';

/**
 * Initialize and demonstrate the resource management system
 */
async function demonstrateResourceManagement() {
  console.log('🚀 Initializing Intelligent Resource Management System...\n');
  
  // Get environment-specific configuration
  const environment = process.env.NODE_ENV || 'production';
  const config = getEnvironmentConfig(environment);
  
  // Validate configuration
  try {
    validateConfig(config);
    console.log('✅ Configuration validated successfully\n');
  } catch (error) {
    console.error('❌ Configuration validation failed:', error);
    return;
  }
  
  // Create resource management system
  const {
    resourceManager,
    autoScaler,
    capacityPlanner
  } = createResourceManagementSystem({
    providers: config.providers,
    enableAutoScaling: true,
    enableCapacityPlanning: true,
    enablePredictiveScaling: true,
    redisUrl: config.redis.url,
    mlModelPath: config.mlModels.path
  });
  
  console.log('✅ Resource Management System initialized\n');
  
  // Example 1: Allocate resources
  console.log('📦 Example 1: Allocating resources...');
  try {
    const allocation = await resourceManager.allocateResources(
      {
        cpu: 8,
        memory: 32,
        storage: 100,
        networkBandwidth: 1000
      },
      {
        provider: CloudProvider.AWS,
        region: 'us-east-1',
        team: 'platform-team',
        duration: 24 * 3600000, // 24 hours
        costOptimized: true
      }
    );
    
    console.log('✅ Resources allocated:', {
      id: allocation.id,
      provider: allocation.provider,
      region: allocation.region,
      status: allocation.status,
      cost: `$${allocation.cost.toFixed(2)}/hour`
    });
    console.log();
    
    // Get metrics for allocated resource
    const metrics = await resourceManager.getResourceMetrics(allocation.id);
    console.log('📊 Resource metrics:', {
      cpu: `${metrics.cpuUtilization.toFixed(2)}%`,
      memory: `${metrics.memoryUtilization.toFixed(2)}%`,
      latency: `${metrics.latency.toFixed(2)}ms`,
      health: metrics.health.status
    });
    console.log();
    
  } catch (error) {
    console.error('❌ Failed to allocate resources:', error);
  }
  
  // Example 2: Auto-scaling decision
  if (autoScaler) {
    console.log('⚡ Example 2: Making auto-scaling decision...');
    try {
      const decision = await autoScaler.makeScalingDecision(
        'resource-123',
        config.autoScaling.policies[0]
      );
      
      console.log('✅ Scaling decision:', {
        action: decision.action,
        currentInstances: decision.currentInstances,
        targetInstances: decision.targetInstances,
        reason: decision.reason,
        confidence: `${(decision.confidence * 100).toFixed(1)}%`,
        estimatedCost: `$${decision.estimatedCost.toFixed(2)}`
      });
      console.log();
      
      // Apply the decision if needed
      if (decision.action !== ScalingAction.SCALE_UP || decision.targetInstances !== decision.currentInstances) {
        await autoScaler.applyScalingDecision(decision);
        console.log('✅ Scaling decision applied\n');
      }
      
    } catch (error) {
      console.error('❌ Auto-scaling failed:', error);
    }
    
    // Schedule a scaling rule
    console.log('⏰ Scheduling scaling rules...');
    const scheduledRule = config.autoScaling.scheduledRules[0];
    autoScaler.scheduleRule(scheduledRule);
    console.log(`✅ Scheduled rule '${scheduledRule.name}' at ${scheduledRule.cron}\n`);
  }
  
  // Example 3: Capacity planning
  if (capacityPlanner) {
    console.log('📈 Example 3: Forecasting demand...');
    try {
      const forecast = await capacityPlanner.forecastDemand(7, {
        includeSeasonality: true,
        includeTrend: true,
        confidenceLevel: 0.95
      });
      
      console.log('✅ Demand forecast (7 days):', {
        pattern: forecast.pattern,
        confidence: `${(forecast.confidence * 100).toFixed(1)}%`,
        trend: forecast.trend.direction,
        growthRate: `${(forecast.trend.growthRate * 100).toFixed(2)}%`,
        recommendations: forecast.recommendations.length
      });
      
      // Show top recommendation
      if (forecast.recommendations.length > 0) {
        const topRec = forecast.recommendations[0];
        console.log('\n📋 Top recommendation:', {
          type: topRec.type,
          priority: topRec.priority,
          action: topRec.action,
          timeline: topRec.timeline,
          potentialSavings: `$${topRec.cost.savings.toFixed(2)}`
        });
      }
      console.log();
      
    } catch (error) {
      console.error('❌ Demand forecasting failed:', error);
    }
    
    // Example 4: What-if scenario
    console.log('🔮 Example 4: Creating what-if scenario...');
    try {
      const scenario = await capacityPlanner.createWhatIfScenario(
        'Black Friday Surge',
        'Simulate Black Friday traffic surge',
        {
          growthRate: 3.0, // 300% growth
          peakLoadIncrease: 5.0, // 500% peak increase
          costConstraints: 100000,
          performanceTargets: {
            availability: 99.99,
            latency: 50,
            throughput: 50000,
            errorRate: 0.01
          }
        }
      );
      
      console.log('✅ What-if scenario created:', {
        id: scenario.id,
        name: scenario.name,
        requiredCapacity: {
          cpu: scenario.results.capacityRequired.cpu,
          memory: scenario.results.capacityRequired.memory
        },
        estimatedCost: `$${scenario.results.estimatedCost.toFixed(2)}`,
        risks: scenario.results.risks.length
      });
      
      // Show risks
      if (scenario.results.risks.length > 0) {
        console.log('\n⚠️  Identified risks:');
        scenario.results.risks.forEach(risk => {
          console.log(`  - ${risk.level.toUpperCase()}: Probability ${(risk.probability * 100).toFixed(0)}%, Impact ${(risk.impact * 100).toFixed(0)}%`);
          console.log(`    Mitigations: ${risk.mitigations.slice(0, 2).join(', ')}`);
        });
      }
      console.log();
      
    } catch (error) {
      console.error('❌ Scenario creation failed:', error);
    }
    
    // Example 5: Budget planning
    console.log('💰 Example 5: Creating budget plan...');
    try {
      const budgetPlan = await capacityPlanner.createBudgetPlan(
        'Q1 2025',
        50000 // $50,000 quarterly budget
      );
      
      console.log('✅ Budget plan created:', {
        period: budgetPlan.period,
        totalBudget: `$${budgetPlan.totalBudget.toLocaleString()}`,
        allocations: budgetPlan.allocations.map(a => ({
          category: a.category,
          amount: `$${a.amount.toLocaleString()}`,
          percentage: `${a.percentage}%`
        })),
        projectedSpend: `$${budgetPlan.forecast.projected.toFixed(2)}`,
        potentialSavings: `$${budgetPlan.optimization.savings.toFixed(2)}`
      });
      
      console.log('\n💡 Optimization recommendations:');
      budgetPlan.optimization.recommendations.slice(0, 3).forEach(rec => {
        console.log(`  - ${rec}`);
      });
      console.log();
      
    } catch (error) {
      console.error('❌ Budget planning failed:', error);
    }
    
    // Example 6: Risk assessment
    console.log('⚠️  Example 6: Assessing capacity risk...');
    try {
      const forecast = await capacityPlanner.forecastDemand(30);
      const currentCapacity = {
        cpu: 100,
        memory: 400,
        storage: 1000,
        networkBandwidth: 5000
      };
      
      const risk = await capacityPlanner.assessCapacityRisk(forecast, currentCapacity);
      
      console.log('✅ Risk assessment:', {
        level: risk.level.toUpperCase(),
        probability: `${(risk.probability * 100).toFixed(0)}%`,
        impact: `${(risk.impact * 100).toFixed(0)}%`
      });
      
      if (risk.level !== 'low') {
        console.log('\n🛡️ Risk mitigations:');
        risk.mitigations.slice(0, 3).forEach(mitigation => {
          console.log(`  - ${mitigation}`);
        });
        
        console.log('\n🚨 Contingency plans:');
        risk.contingencies.slice(0, 3).forEach(contingency => {
          console.log(`  - ${contingency}`);
        });
      }
      console.log();
      
    } catch (error) {
      console.error('❌ Risk assessment failed:', error);
    }
  }
  
  // Event listeners
  console.log('👂 Setting up event listeners...\n');
  
  resourceManager.on('resource:allocated', (resource) => {
    console.log(`📦 Resource allocated: ${resource.id} (${resource.provider}/${resource.region})`);
  });
  
  resourceManager.on('resource:released', (resource) => {
    console.log(`🗑️ Resource released: ${resource.id}`);
  });
  
  if (autoScaler) {
    autoScaler.on('scaling:decision', (decision) => {
      console.log(`⚡ Scaling decision: ${decision.action} to ${decision.targetInstances} instances`);
    });
    
    autoScaler.on('scaling:prediction', ({ resourceId, prediction }) => {
      console.log(`🔮 Load prediction for ${resourceId}: CPU ${prediction.cpu.toFixed(1)}%`);
    });
  }
  
  if (capacityPlanner) {
    capacityPlanner.on('forecast:generated', (forecast) => {
      console.log(`📈 Forecast generated: ${forecast.pattern} pattern with ${(forecast.confidence * 100).toFixed(1)}% confidence`);
    });
    
    capacityPlanner.on('scenario:created', (scenario) => {
      console.log(`🔮 Scenario created: ${scenario.name}`);
    });
  }
  
  console.log('\n✅ Resource Management System demonstration complete!');
  
  // Cleanup (in production, this would be done on shutdown)
  setTimeout(async () => {
    console.log('\n🧹 Cleaning up...');
    await resourceManager.cleanup();
    if (autoScaler) await autoScaler.cleanup();
    if (capacityPlanner) await capacityPlanner.cleanup();
    console.log('✅ Cleanup complete');
  }, 5000);
}

/**
 * Advanced usage examples
 */
async function advancedExamples() {
  const { resourceManager, autoScaler, capacityPlanner } = createResourceManagementSystem({
    providers: getEnvironmentConfig().providers,
    enableAutoScaling: true,
    enableCapacityPlanning: true,
    enablePredictiveScaling: true
  });
  
  // Multi-region deployment
  console.log('🌍 Multi-region resource deployment...');
  const regions = ['us-east-1', 'eu-west-1', 'ap-southeast-1'];
  const deployments = await Promise.all(
    regions.map(region => 
      resourceManager.allocateResources(
        { cpu: 4, memory: 16, storage: 50, networkBandwidth: 500 },
        { provider: CloudProvider.AWS, region, costOptimized: true }
      )
    )
  );
  
  console.log('✅ Deployed to regions:', deployments.map(d => d.region).join(', '));
  
  // Cross-region scaling coordination
  if (autoScaler) {
    console.log('\n🔄 Coordinating cross-region scaling...');
    // Implementation would coordinate scaling across regions
  }
  
  // Seasonal capacity planning
  if (capacityPlanner) {
    console.log('\n📅 Seasonal capacity planning...');
    const yearlyForecast = await capacityPlanner.forecastDemand(365, {
      includeSeasonality: true,
      includeTrend: true
    });
    
    // Identify peak periods
    const peaks = yearlyForecast.seasonality.yearly.peaks;
    console.log('📊 Identified peak periods:', peaks.slice(0, 5).map(p => p.toLocaleDateString()));
  }
  
  // Cost optimization analysis
  console.log('\n💵 Cost optimization analysis...');
  const costAnalysis = {
    currentMonthly: 50000,
    optimizedMonthly: 35000,
    savings: 15000,
    optimizations: [
      'Switch to reserved instances: $5000/month',
      'Use spot instances for batch: $3000/month',
      'Consolidate underutilized resources: $2000/month',
      'Implement auto-scaling: $3000/month',
      'Optimize storage tiers: $2000/month'
    ]
  };
  
  console.log('💰 Potential monthly savings: $' + costAnalysis.savings.toLocaleString());
  costAnalysis.optimizations.forEach(opt => console.log(`  - ${opt}`));
  
  // Cleanup
  await Promise.all([
    resourceManager.cleanup(),
    autoScaler?.cleanup(),
    capacityPlanner?.cleanup()
  ]);
}

// Run the demonstration
if (require.main === module) {
  demonstrateResourceManagement().catch(console.error);
  
  // Uncomment to run advanced examples
  // advancedExamples().catch(console.error);
}

export { demonstrateResourceManagement, advancedExamples };