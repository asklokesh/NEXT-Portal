/**
 * Backstage Integration Service
 * Real integration with Backstage APIs for plugin management, installation, and monitoring
 * Handles actual plugin registry communication and deployment
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import yaml from 'js-yaml';
import { pluginValidator, PluginValidationResult } from './PluginValidator';
import { pluginInstaller, PluginInstallationResult } from './plugin-installer';

export interface BackstagePluginInfo {
  name: string;
  version: string;
  description: string;
  author: string;
  repository?: string;
  homepage?: string;
  keywords: string[];
  backstageVersion: string;
  pluginType: 'frontend' | 'backend' | 'common';
  installationStatus: 'not_installed' | 'installing' | 'installed' | 'failed' | 'updating';
  healthStatus: 'healthy' | 'unhealthy' | 'unknown';
  lastUpdated: Date;
  configuration: any;
  dependencies: string[];
  peerDependencies: string[];
}

export interface PluginRegistryResponse {
  plugins: BackstagePluginInfo[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PluginInstallationProgress {
  pluginId: string;
  stage: 'downloading' | 'installing' | 'configuring' | 'validating' | 'complete' | 'failed';
  progress: number; // 0-100
  message: string;
  details?: any;
  error?: string;
}

export interface PluginHealthCheck {
  pluginId: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  lastCheck: Date;
  responseTime: number;
  errors: string[];
  warnings: string[];
  metrics: {
    memoryUsage: number;
    cpuUsage: number;
    requestCount: number;
    errorRate: number;
  };
}

export interface BackstageSystemInfo {
  version: string;
  buildInfo: {
    version: string;
    timestamp: string;
    commit: string;
  };
  plugins: {
    installed: string[];
    enabled: string[];
    disabled: string[];
  };
  configuration: {
    integrations: string[];
    authentication: string[];
    features: string[];
  };
  health: {
    status: 'healthy' | 'unhealthy' | 'degraded';
    components: Record<string, any>;
  };
}

export class BackstageIntegration extends EventEmitter {
  private apiClient: AxiosInstance;
  private wsConnection: WebSocket | null = null;
  private backstageBaseUrl: string;
  private apiToken?: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    backstageBaseUrl: string = process.env.BACKSTAGE_API_URL || 'http://localhost:7007',
    apiToken?: string
  ) {
    super();
    this.backstageBaseUrl = backstageBaseUrl;
    this.apiToken = apiToken || process.env.BACKSTAGE_API_TOKEN;
    
    this.apiClient = axios.create({
      baseURL: this.backstageBaseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiToken && { 'Authorization': `Bearer ${this.apiToken}` })
      }
    });

    this.setupApiInterceptors();
    this.initializeWebSocketConnection();
    this.startHealthMonitoring();
  }

  /**
   * Initialize real-time WebSocket connection to Backstage
   */
  private initializeWebSocketConnection(): void {
    try {
      const wsUrl = this.backstageBaseUrl.replace(/^http/, 'ws') + '/ws/plugins';
      this.wsConnection = new WebSocket(wsUrl);

      this.wsConnection.on('open', () => {
        console.log('Connected to Backstage WebSocket');
        this.reconnectAttempts = 0;
        this.emit('connected');
      });

      this.wsConnection.on('message', (data: string) => {
        try {
          const message = JSON.parse(data);
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      });

      this.wsConnection.on('close', () => {
        console.log('Backstage WebSocket connection closed');
        this.emit('disconnected');
        this.attemptReconnection();
      });

      this.wsConnection.on('error', (error) => {
        console.error('Backstage WebSocket error:', error);
        this.emit('error', error);
      });

    } catch (error) {
      console.error('Failed to initialize WebSocket connection:', error);
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleWebSocketMessage(message: any): void {
    switch (message.type) {
      case 'plugin_status_update':
        this.emit('pluginStatusUpdate', message.data);
        break;
      case 'installation_progress':
        this.emit('installationProgress', message.data as PluginInstallationProgress);
        break;
      case 'health_check_result':
        this.emit('healthCheckResult', message.data as PluginHealthCheck);
        break;
      case 'system_alert':
        this.emit('systemAlert', message.data);
        break;
      default:
        console.log('Unknown WebSocket message type:', message.type);
    }
  }

  /**
   * Attempt to reconnect WebSocket
   */
  private attemptReconnection(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff
      
      setTimeout(() => {
        console.log(`Attempting to reconnect WebSocket (attempt ${this.reconnectAttempts})`);
        this.initializeWebSocketConnection();
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      this.emit('connectionFailed');
    }
  }

  /**
   * Setup API client interceptors
   */
  private setupApiInterceptors(): void {
    // Request interceptor
    this.apiClient.interceptors.request.use(
      (config) => {
        console.log(`Making API request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('API request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.apiClient.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        console.error('API response error:', error.response?.status, error.response?.data);
        
        // Handle specific error cases
        if (error.response?.status === 401) {
          this.emit('authenticationError', error);
        } else if (error.response?.status >= 500) {
          this.emit('serverError', error);
        }
        
        return Promise.reject(error);
      }
    );
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performSystemHealthCheck();
      } catch (error) {
        console.error('Health check failed:', error);
      }
    }, 60000); // Check every minute
  }

  /**
   * Get system information from Backstage
   */
  async getSystemInfo(): Promise<BackstageSystemInfo> {
    try {
      const response = await this.apiClient.get('/api/system/info');
      return response.data;
    } catch (error) {
      console.error('Failed to get system info:', error);
      throw new Error(`Failed to get Backstage system info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Query the Backstage plugin registry
   */
  async queryPluginRegistry(
    query?: string,
    filters?: {
      category?: string;
      author?: string;
      type?: 'frontend' | 'backend' | 'common';
    },
    page = 1,
    pageSize = 20
  ): Promise<PluginRegistryResponse> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        ...(query && { q: query }),
        ...(filters?.category && { category: filters.category }),
        ...(filters?.author && { author: filters.author }),
        ...(filters?.type && { type: filters.type })
      });

      const response = await this.apiClient.get(`/api/plugins/registry?${params}`);
      return response.data;
    } catch (error) {
      console.error('Failed to query plugin registry:', error);
      throw new Error(`Failed to query plugin registry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get detailed information about a specific plugin
   */
  async getPluginInfo(pluginId: string): Promise<BackstagePluginInfo> {
    try {
      const response = await this.apiClient.get(`/api/plugins/${pluginId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to get plugin info for ${pluginId}:`, error);
      throw new Error(`Failed to get plugin info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Install a plugin through Backstage API
   */
  async installPlugin(
    pluginId: string,
    version?: string,
    configuration?: any
  ): Promise<{ taskId: string; initialProgress: PluginInstallationProgress }> {
    try {
      const installRequest = {
        pluginId,
        version: version || 'latest',
        configuration: configuration || {}
      };

      const response = await this.apiClient.post('/api/plugins/install', installRequest);
      
      // Return task ID for tracking progress
      return {
        taskId: response.data.taskId,
        initialProgress: {
          pluginId,
          stage: 'downloading',
          progress: 0,
          message: 'Starting plugin installation...'
        }
      };
    } catch (error) {
      console.error(`Failed to install plugin ${pluginId}:`, error);
      throw new Error(`Failed to install plugin: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Track installation progress
   */
  async getInstallationProgress(taskId: string): Promise<PluginInstallationProgress> {
    try {
      const response = await this.apiClient.get(`/api/plugins/install/${taskId}/progress`);
      return response.data;
    } catch (error) {
      console.error(`Failed to get installation progress for task ${taskId}:`, error);
      throw new Error(`Failed to get installation progress: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Configure a plugin
   */
  async configurePlugin(pluginId: string, configuration: any): Promise<PluginInstallationResult> {
    try {
      // First validate the configuration
      const validationResult = await pluginValidator.validatePlugin(pluginId, configuration);
      
      if (!validationResult.isValid && validationResult.errors.some(e => e.severity === 'critical')) {
        return {
          success: false,
          message: 'Configuration validation failed',
          error: 'Critical configuration errors found',
          details: validationResult.errors
        };
      }

      // Apply configuration through Backstage API
      const response = await this.apiClient.put(`/api/plugins/${pluginId}/configure`, {
        configuration
      });

      return {
        success: true,
        message: `Plugin ${pluginId} configured successfully`,
        details: response.data
      };
    } catch (error) {
      console.error(`Failed to configure plugin ${pluginId}:`, error);
      return {
        success: false,
        message: 'Plugin configuration failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Enable/disable a plugin
   */
  async togglePlugin(pluginId: string, enabled: boolean): Promise<PluginInstallationResult> {
    try {
      const action = enabled ? 'enable' : 'disable';
      const response = await this.apiClient.post(`/api/plugins/${pluginId}/${action}`);

      return {
        success: true,
        message: `Plugin ${pluginId} ${enabled ? 'enabled' : 'disabled'} successfully`,
        details: response.data
      };
    } catch (error) {
      console.error(`Failed to ${enabled ? 'enable' : 'disable'} plugin ${pluginId}:`, error);
      return {
        success: false,
        message: `Failed to ${enabled ? 'enable' : 'disable'} plugin`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(pluginId: string, force = false): Promise<PluginInstallationResult> {
    try {
      const response = await this.apiClient.delete(`/api/plugins/${pluginId}`, {
        data: { force }
      });

      return {
        success: true,
        message: `Plugin ${pluginId} uninstalled successfully`,
        details: response.data
      };
    } catch (error) {
      console.error(`Failed to uninstall plugin ${pluginId}:`, error);
      return {
        success: false,
        message: 'Plugin uninstallation failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get health status of all plugins
   */
  async getAllPluginHealthStatus(): Promise<PluginHealthCheck[]> {
    try {
      const response = await this.apiClient.get('/api/plugins/health');
      return response.data;
    } catch (error) {
      console.error('Failed to get plugin health status:', error);
      throw new Error(`Failed to get plugin health status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get health status of a specific plugin
   */
  async getPluginHealthStatus(pluginId: string): Promise<PluginHealthCheck> {
    try {
      const response = await this.apiClient.get(`/api/plugins/${pluginId}/health`);
      return response.data;
    } catch (error) {
      console.error(`Failed to get health status for plugin ${pluginId}:`, error);
      throw new Error(`Failed to get plugin health status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform comprehensive plugin verification
   */
  async verifyPlugin(pluginId: string): Promise<PluginValidationResult> {
    try {
      // Get plugin configuration from Backstage
      const pluginInfo = await this.getPluginInfo(pluginId);
      
      // Perform local validation
      const validationResult = await pluginValidator.validatePlugin(pluginId, pluginInfo.configuration);
      
      // Get runtime health from Backstage
      const healthStatus = await this.getPluginHealthStatus(pluginId);
      
      // Combine results
      validationResult.runtime = {
        ...validationResult.runtime,
        isHealthy: healthStatus.status === 'healthy',
        lastChecked: healthStatus.lastCheck,
        performance: {
          memoryUsage: healthStatus.metrics.memoryUsage,
          cpuUsage: healthStatus.metrics.cpuUsage,
          responseTime: healthStatus.responseTime,
          errorRate: healthStatus.metrics.errorRate
        },
        errors: healthStatus.errors.map(error => ({
          timestamp: new Date(),
          error,
          context: { pluginId }
        }))
      };

      return validationResult;
    } catch (error) {
      console.error(`Failed to verify plugin ${pluginId}:`, error);
      throw new Error(`Failed to verify plugin: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get list of installed plugins
   */
  async getInstalledPlugins(): Promise<BackstagePluginInfo[]> {
    try {
      const response = await this.apiClient.get('/api/plugins/installed');
      return response.data;
    } catch (error) {
      console.error('Failed to get installed plugins:', error);
      throw new Error(`Failed to get installed plugins: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get plugin logs
   */
  async getPluginLogs(
    pluginId: string, 
    options: {
      level?: 'error' | 'warn' | 'info' | 'debug';
      limit?: number;
      since?: Date;
    } = {}
  ): Promise<Array<{
    timestamp: Date;
    level: string;
    message: string;
    metadata?: any;
  }>> {
    try {
      const params = new URLSearchParams({
        ...(options.level && { level: options.level }),
        ...(options.limit && { limit: options.limit.toString() }),
        ...(options.since && { since: options.since.toISOString() })
      });

      const response = await this.apiClient.get(`/api/plugins/${pluginId}/logs?${params}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to get logs for plugin ${pluginId}:`, error);
      throw new Error(`Failed to get plugin logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform system health check
   */
  async performSystemHealthCheck(): Promise<BackstageSystemInfo['health']> {
    try {
      const response = await this.apiClient.get('/api/system/health');
      const healthData = response.data;
      
      this.emit('systemHealthUpdate', healthData);
      return healthData;
    } catch (error) {
      console.error('System health check failed:', error);
      const unhealthyStatus = {
        status: 'unhealthy' as const,
        components: {
          api: { status: 'unhealthy', error: error instanceof Error ? error.message : 'Unknown error' }
        }
      };
      
      this.emit('systemHealthUpdate', unhealthyStatus);
      return unhealthyStatus;
    }
  }

  /**
   * Deploy configuration changes
   */
  async deployConfiguration(changes: {
    pluginId: string;
    configuration: any;
    restartRequired?: boolean;
  }[]): Promise<{
    success: boolean;
    deploymentId: string;
    results: Array<{
      pluginId: string;
      success: boolean;
      error?: string;
    }>;
  }> {
    try {
      const response = await this.apiClient.post('/api/system/deploy-config', {
        changes
      });

      return response.data;
    } catch (error) {
      console.error('Failed to deploy configuration:', error);
      throw new Error(`Failed to deploy configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(deploymentId: string): Promise<{
    id: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    progress: number;
    startedAt: Date;
    completedAt?: Date;
    results: any[];
    error?: string;
  }> {
    try {
      const response = await this.apiClient.get(`/api/system/deployments/${deploymentId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to get deployment status for ${deploymentId}:`, error);
      throw new Error(`Failed to get deployment status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Test connection to Backstage
   */
  async testConnection(): Promise<{ success: boolean; message: string; systemInfo?: BackstageSystemInfo }> {
    try {
      const systemInfo = await this.getSystemInfo();
      return {
        success: true,
        message: 'Successfully connected to Backstage',
        systemInfo
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to connect to Backstage: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    this.removeAllListeners();
  }
}

// Export singleton instance
export const backstageIntegration = new BackstageIntegration();