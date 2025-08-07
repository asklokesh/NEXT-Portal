import { EventEmitter } from 'events';
import axios, { AxiosInstance } from 'axios';
import { ProgressiveDeployment, FeatureFlagConfig } from './types';

export class FeatureFlagManager extends EventEmitter {
  private launchDarklyClient?: AxiosInstance;
  private flagsmithClient?: AxiosInstance;
  private provider: 'launchdarkly' | 'flagsmith' | 'split' | 'optimizely' | 'custom';

  constructor() {
    super();
    
    this.provider = (process.env.FEATURE_FLAG_PROVIDER as any) || 'launchdarkly';
    
    this.initializeProvider();
  }

  async initialize(deployment: ProgressiveDeployment): Promise<void> {
    const { service } = deployment.config;
    
    // Create feature flag for progressive rollout
    const flagName = `${service.name}-${service.version}-rollout`;
    
    const flagConfig: FeatureFlagConfig = {
      name: flagName,
      enabled: true,
      rules: [
        {
          conditions: [
            {
              attribute: 'user_segment',
              operator: 'equals',
              value: 'canary'
            }
          ],
          percentage: 0 // Start with 0% rollout
        }
      ],
      variants: [
        {
          name: 'stable',
          value: { version: 'stable' },
          weight: 100
        },
        {
          name: 'canary',
          value: { version: service.version },
          weight: 0
        }
      ],
      targeting: {
        enabled: true,
        rules: [
          {
            attribute: 'environment',
            operator: 'equals',
            values: [service.namespace],
            percentage: 0
          }
        ]
      }
    };

    await this.createFeatureFlag(flagConfig);
    
    // Store flag name in deployment metadata
    deployment.metadata.featureFlagName = flagName;
    
    this.emit('featureFlagInitialized', { deployment, flagName });
  }

  async updateRolloutPercentage(deployment: ProgressiveDeployment, percentage: number): Promise<void> {
    const flagName = deployment.metadata.featureFlagName;
    if (!flagName) {
      throw new Error('Feature flag not initialized for deployment');
    }

    await this.updateFeatureFlagTargeting(flagName, {
      enabled: true,
      rules: [
        {
          attribute: 'environment',
          operator: 'equals',
          values: [deployment.config.service.namespace],
          percentage
        }
      ]
    });

    this.emit('rolloutPercentageUpdated', { deployment, percentage });
  }

  async enableFullRollout(deployment: ProgressiveDeployment): Promise<void> {
    const flagName = deployment.metadata.featureFlagName;
    if (!flagName) {
      throw new Error('Feature flag not initialized for deployment');
    }

    // Update flag to route 100% to new version
    await this.updateFeatureFlagVariants(flagName, [
      {
        name: 'stable',
        value: { version: deployment.config.service.version },
        weight: 100
      }
    ]);

    this.emit('fullRolloutEnabled', { deployment });
  }

  async rollback(deployment: ProgressiveDeployment): Promise<void> {
    const flagName = deployment.metadata.featureFlagName;
    if (!flagName) {
      throw new Error('Feature flag not initialized for deployment');
    }

    // Disable feature flag to rollback to stable
    await this.updateFeatureFlagTargeting(flagName, {
      enabled: false,
      rules: []
    });

    this.emit('featureFlagRollback', { deployment });
  }

  async pause(deployment: ProgressiveDeployment): Promise<void> {
    // Feature flag deployments are paused by not updating the percentage
    deployment.metadata.featureFlagPaused = true;
    this.emit('featureFlagPaused', { deployment });
  }

  async resume(deployment: ProgressiveDeployment): Promise<void> {
    deployment.metadata.featureFlagPaused = false;
    this.emit('featureFlagResumed', { deployment });
  }

  async terminate(deployment: ProgressiveDeployment): Promise<void> {
    const flagName = deployment.metadata.featureFlagName;
    if (flagName) {
      await this.deleteFeatureFlag(flagName);
    }
    
    this.emit('featureFlagTerminated', { deployment });
  }

  async promote(deployment: ProgressiveDeployment): Promise<void> {
    await this.enableFullRollout(deployment);
    this.emit('featureFlagPromoted', { deployment });
  }

  async getStatus(deployment: ProgressiveDeployment): Promise<any> {
    const flagName = deployment.metadata.featureFlagName;
    if (!flagName) {
      return null;
    }

    return this.getFeatureFlagStatus(flagName);
  }

  // Targeting methods for different user segments
  async addUserToCanary(deployment: ProgressiveDeployment, userId: string): Promise<void> {
    const flagName = deployment.metadata.featureFlagName;
    if (!flagName) {
      throw new Error('Feature flag not initialized for deployment');
    }

    await this.addTargetUser(flagName, userId, 'canary');
    this.emit('userAddedToCanary', { deployment, userId });
  }

  async removeUserFromCanary(deployment: ProgressiveDeployment, userId: string): Promise<void> {
    const flagName = deployment.metadata.featureFlagName;
    if (!flagName) {
      throw new Error('Feature flag not initialized for deployment');
    }

    await this.removeTargetUser(flagName, userId);
    this.emit('userRemovedFromCanary', { deployment, userId });
  }

  async addSegmentToCanary(deployment: ProgressiveDeployment, segment: string, percentage: number): Promise<void> {
    const flagName = deployment.metadata.featureFlagName;
    if (!flagName) {
      throw new Error('Feature flag not initialized for deployment');
    }

    await this.updateFeatureFlagRules(flagName, [
      {
        conditions: [
          {
            attribute: 'user_segment',
            operator: 'equals',
            value: segment
          }
        ],
        percentage
      }
    ]);

    this.emit('segmentAddedToCanary', { deployment, segment, percentage });
  }

  private initializeProvider(): void {
    switch (this.provider) {
      case 'launchdarkly':
        this.initializeLaunchDarkly();
        break;
      case 'flagsmith':
        this.initializeFlagsmith();
        break;
      case 'split':
        this.initializeSplit();
        break;
      case 'optimizely':
        this.initializeOptimizely();
        break;
      case 'custom':
        this.initializeCustom();
        break;
    }
  }

  private initializeLaunchDarkly(): void {
    const apiKey = process.env.LAUNCHDARKLY_API_KEY;
    const projectKey = process.env.LAUNCHDARKLY_PROJECT_KEY;
    
    if (!apiKey || !projectKey) {
      throw new Error('LaunchDarkly API key and project key required');
    }

    this.launchDarklyClient = axios.create({
      baseURL: 'https://app.launchdarkly.com/api/v2',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      }
    });
  }

  private initializeFlagsmith(): void {
    const apiKey = process.env.FLAGSMITH_API_KEY;
    
    if (!apiKey) {
      throw new Error('Flagsmith API key required');
    }

    this.flagsmithClient = axios.create({
      baseURL: 'https://api.flagsmith.com/api/v1',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  private initializeSplit(): void {
    // Split.io integration
    const apiKey = process.env.SPLIT_API_KEY;
    if (!apiKey) {
      throw new Error('Split.io API key required');
    }
    // Implementation would go here
  }

  private initializeOptimizely(): void {
    // Optimizely integration
    const apiKey = process.env.OPTIMIZELY_API_KEY;
    if (!apiKey) {
      throw new Error('Optimizely API key required');
    }
    // Implementation would go here
  }

  private initializeCustom(): void {
    // Custom feature flag provider
    const apiUrl = process.env.CUSTOM_FEATURE_FLAG_URL;
    if (!apiUrl) {
      throw new Error('Custom feature flag API URL required');
    }
    // Implementation would go here
  }

  private async createFeatureFlag(config: FeatureFlagConfig): Promise<void> {
    switch (this.provider) {
      case 'launchdarkly':
        await this.createLaunchDarklyFlag(config);
        break;
      case 'flagsmith':
        await this.createFlagsmithFlag(config);
        break;
      default:
        throw new Error(`Provider ${this.provider} not implemented`);
    }
  }

  private async createLaunchDarklyFlag(config: FeatureFlagConfig): Promise<void> {
    if (!this.launchDarklyClient) {
      throw new Error('LaunchDarkly client not initialized');
    }

    const projectKey = process.env.LAUNCHDARKLY_PROJECT_KEY;
    const envKey = process.env.LAUNCHDARKLY_ENV_KEY || 'production';

    // Create the feature flag
    const flagData = {
      key: config.name,
      name: config.name,
      kind: 'multivariate',
      variations: config.variants?.map(variant => ({
        key: variant.name,
        name: variant.name,
        value: variant.value
      })) || [
        { key: 'stable', name: 'Stable', value: false },
        { key: 'canary', name: 'Canary', value: true }
      ]
    };

    await this.launchDarklyClient.post(`/projects/${projectKey}/flags`, flagData);

    // Configure targeting
    const targetingData = {
      on: config.enabled,
      targets: [],
      rules: config.targeting?.rules.map(rule => ({
        variation: 0, // Default to stable
        clauses: [{
          attribute: rule.attribute,
          op: rule.operator,
          values: rule.values,
          negate: false
        }],
        rollout: {
          variations: [
            { variation: 0, weight: 100000 - (rule.percentage || 0) * 1000 },
            { variation: 1, weight: (rule.percentage || 0) * 1000 }
          ]
        }
      })) || [],
      fallthrough: {
        variation: 0
      },
      offVariation: 0
    };

    await this.launchDarklyClient.put(
      `/projects/${projectKey}/environments/${envKey}/flags/${config.name}`,
      targetingData
    );
  }

  private async createFlagsmithFlag(config: FeatureFlagConfig): Promise<void> {
    if (!this.flagsmithClient) {
      throw new Error('Flagsmith client not initialized');
    }

    const environmentId = process.env.FLAGSMITH_ENVIRONMENT_ID;

    const flagData = {
      name: config.name,
      enabled: config.enabled,
      feature: {
        name: config.name,
        type: 'MULTIVARIATE'
      }
    };

    await this.flagsmithClient.post(`/environments/${environmentId}/features/`, flagData);
  }

  private async updateFeatureFlagTargeting(flagName: string, targeting: any): Promise<void> {
    switch (this.provider) {
      case 'launchdarkly':
        await this.updateLaunchDarklyTargeting(flagName, targeting);
        break;
      case 'flagsmith':
        await this.updateFlagsmithTargeting(flagName, targeting);
        break;
    }
  }

  private async updateLaunchDarklyTargeting(flagName: string, targeting: any): Promise<void> {
    if (!this.launchDarklyClient) {
      throw new Error('LaunchDarkly client not initialized');
    }

    const projectKey = process.env.LAUNCHDARKLY_PROJECT_KEY;
    const envKey = process.env.LAUNCHDARKLY_ENV_KEY || 'production';

    const targetingData = {
      on: targeting.enabled,
      rules: targeting.rules.map((rule: any) => ({
        variation: 1, // Target canary variation
        clauses: [{
          attribute: rule.attribute,
          op: rule.operator === 'equals' ? 'in' : rule.operator,
          values: rule.values,
          negate: false
        }],
        rollout: {
          variations: [
            { variation: 0, weight: 100000 - rule.percentage * 1000 },
            { variation: 1, weight: rule.percentage * 1000 }
          ]
        }
      }))
    };

    await this.launchDarklyClient.patch(
      `/projects/${projectKey}/environments/${envKey}/flags/${flagName}`,
      {
        patch: [
          {
            op: 'replace',
            path: '/on',
            value: targetingData.on
          },
          {
            op: 'replace',
            path: '/rules',
            value: targetingData.rules
          }
        ]
      }
    );
  }

  private async updateFlagsmithTargeting(flagName: string, targeting: any): Promise<void> {
    if (!this.flagsmithClient) {
      throw new Error('Flagsmith client not initialized');
    }

    const environmentId = process.env.FLAGSMITH_ENVIRONMENT_ID;

    // Flagsmith uses segments for targeting
    for (const rule of targeting.rules) {
      const segmentData = {
        name: `${flagName}-${rule.attribute}`,
        rules: [
          {
            type: 'ALL',
            conditions: [
              {
                operator: rule.operator.toUpperCase(),
                property: rule.attribute,
                value: rule.values.join(',')
              }
            ]
          }
        ]
      };

      await this.flagsmithClient.post(`/environments/${environmentId}/segments/`, segmentData);
    }
  }

  private async updateFeatureFlagVariants(flagName: string, variants: any[]): Promise<void> {
    switch (this.provider) {
      case 'launchdarkly':
        await this.updateLaunchDarklyVariants(flagName, variants);
        break;
      case 'flagsmith':
        await this.updateFlagsmithVariants(flagName, variants);
        break;
    }
  }

  private async updateLaunchDarklyVariants(flagName: string, variants: any[]): Promise<void> {
    if (!this.launchDarklyClient) {
      throw new Error('LaunchDarkly client not initialized');
    }

    const projectKey = process.env.LAUNCHDARKLY_PROJECT_KEY;

    const patchData = {
      patch: [
        {
          op: 'replace',
          path: '/variations',
          value: variants.map(variant => ({
            key: variant.name,
            name: variant.name,
            value: variant.value
          }))
        }
      ]
    };

    await this.launchDarklyClient.patch(`/projects/${projectKey}/flags/${flagName}`, patchData);
  }

  private async updateFlagsmithVariants(flagName: string, variants: any[]): Promise<void> {
    // Flagsmith variant update implementation
  }

  private async updateFeatureFlagRules(flagName: string, rules: any[]): Promise<void> {
    await this.updateFeatureFlagTargeting(flagName, {
      enabled: true,
      rules: rules.map(rule => ({
        attribute: rule.conditions[0].attribute,
        operator: rule.conditions[0].operator,
        values: [rule.conditions[0].value],
        percentage: rule.percentage
      }))
    });
  }

  private async addTargetUser(flagName: string, userId: string, variant: string): Promise<void> {
    switch (this.provider) {
      case 'launchdarkly':
        await this.addLaunchDarklyTargetUser(flagName, userId, variant);
        break;
      case 'flagsmith':
        await this.addFlagsmithTargetUser(flagName, userId, variant);
        break;
    }
  }

  private async addLaunchDarklyTargetUser(flagName: string, userId: string, variant: string): Promise<void> {
    if (!this.launchDarklyClient) {
      throw new Error('LaunchDarkly client not initialized');
    }

    const projectKey = process.env.LAUNCHDARKLY_PROJECT_KEY;
    const envKey = process.env.LAUNCHDARKLY_ENV_KEY || 'production';

    const patchData = {
      patch: [
        {
          op: 'add',
          path: `/targets/${variant === 'canary' ? 1 : 0}/values/-`,
          value: userId
        }
      ]
    };

    await this.launchDarklyClient.patch(
      `/projects/${projectKey}/environments/${envKey}/flags/${flagName}`,
      patchData
    );
  }

  private async addFlagsmithTargetUser(flagName: string, userId: string, variant: string): Promise<void> {
    // Flagsmith user targeting implementation
  }

  private async removeTargetUser(flagName: string, userId: string): Promise<void> {
    switch (this.provider) {
      case 'launchdarkly':
        await this.removeLaunchDarklyTargetUser(flagName, userId);
        break;
      case 'flagsmith':
        await this.removeFlagsmithTargetUser(flagName, userId);
        break;
    }
  }

  private async removeLaunchDarklyTargetUser(flagName: string, userId: string): Promise<void> {
    // Implementation to remove user from targeting
  }

  private async removeFlagsmithTargetUser(flagName: string, userId: string): Promise<void> {
    // Implementation to remove user from targeting
  }

  private async deleteFeatureFlag(flagName: string): Promise<void> {
    switch (this.provider) {
      case 'launchdarkly':
        await this.deleteLaunchDarklyFlag(flagName);
        break;
      case 'flagsmith':
        await this.deleteFlagsmithFlag(flagName);
        break;
    }
  }

  private async deleteLaunchDarklyFlag(flagName: string): Promise<void> {
    if (!this.launchDarklyClient) {
      throw new Error('LaunchDarkly client not initialized');
    }

    const projectKey = process.env.LAUNCHDARKLY_PROJECT_KEY;
    await this.launchDarklyClient.delete(`/projects/${projectKey}/flags/${flagName}`);
  }

  private async deleteFlagsmithFlag(flagName: string): Promise<void> {
    // Flagsmith flag deletion implementation
  }

  private async getFeatureFlagStatus(flagName: string): Promise<any> {
    switch (this.provider) {
      case 'launchdarkly':
        return this.getLaunchDarklyFlagStatus(flagName);
      case 'flagsmith':
        return this.getFlagsmithFlagStatus(flagName);
      default:
        return null;
    }
  }

  private async getLaunchDarklyFlagStatus(flagName: string): Promise<any> {
    if (!this.launchDarklyClient) {
      throw new Error('LaunchDarkly client not initialized');
    }

    const projectKey = process.env.LAUNCHDARKLY_PROJECT_KEY;
    const envKey = process.env.LAUNCHDARKLY_ENV_KEY || 'production';

    const response = await this.launchDarklyClient.get(
      `/projects/${projectKey}/environments/${envKey}/flags/${flagName}`
    );

    return response.data;
  }

  private async getFlagsmithFlagStatus(flagName: string): Promise<any> {
    // Flagsmith flag status implementation
    return null;
  }
}