#!/usr/bin/env node

/**
 * Plugin Installation Pipeline
 * 
 * Production-ready plugin installation and lifecycle management system
 * following Spotify's Portal architecture patterns for enterprise deployment
 */

import { PluginPipelineOrchestrator, PipelineConfig } from './plugin-pipeline-orchestrator';
import { PluginDefinition, DeploymentStrategy } from './types/plugin-types';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

// Load environment variables
dotenv.config();

/**
 * Load configuration from environment and config files
 */
function loadConfiguration(): PipelineConfig {
  const configPath = process.env.CONFIG_PATH || '/app/config/pipeline-config.yaml';
  
  let fileConfig = {};
  if (fs.existsSync(configPath)) {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    fileConfig = yaml.parse(configContent);
  }

  const config: PipelineConfig = {
    kubernetes: {
      kubeconfig: process.env.KUBECONFIG,
      inCluster: process.env.KUBERNETES_IN_CLUSTER === 'true',
      defaultNamespace: process.env.KUBERNETES_NAMESPACE || 'plugins'
    },
    
    docker: {
      registryUrl: process.env.DOCKER_REGISTRY_URL || 'registry.hub.docker.com',
      buildTimeout: parseInt(process.env.DOCKER_BUILD_TIMEOUT || '600000'),
      maxConcurrentBuilds: parseInt(process.env.DOCKER_MAX_CONCURRENT_BUILDS || '5')
    },
    
    serviceMesh: {
      provider: (process.env.SERVICE_MESH_PROVIDER as any) || 'istio',
      config: {
        defaultPolicy: process.env.SERVICE_MESH_MTLS_MODE || 'STRICT',
        enableTracing: process.env.SERVICE_MESH_ENABLE_TRACING === 'true',
        enableMetrics: process.env.SERVICE_MESH_ENABLE_METRICS === 'true',
        mtlsMode: process.env.SERVICE_MESH_MTLS_MODE || 'STRICT'
      }
    },
    
    monitoring: {
      prometheus: {
        enabled: process.env.PROMETHEUS_ENABLED === 'true',
        scrapeInterval: process.env.PROMETHEUS_SCRAPE_INTERVAL || '30s',
        retentionTime: process.env.PROMETHEUS_RETENTION_TIME || '7d'
      },
      tracing: {
        enabled: process.env.TRACING_ENABLED === 'true',
        provider: (process.env.TRACING_PROVIDER as any) || 'jaeger',
        endpoint: process.env.TRACING_ENDPOINT || 'http://jaeger-collector.istio-system:14268/api/traces',
        samplingRate: parseFloat(process.env.TRACING_SAMPLING_RATE || '0.1')
      },
      logging: {
        enabled: process.env.LOGGING_ENABLED === 'true',
        provider: (process.env.LOGGING_PROVIDER as any) || 'loki',
        endpoint: process.env.LOGGING_ENDPOINT || 'http://loki.monitoring:3100',
        retentionDays: parseInt(process.env.LOGGING_RETENTION_DAYS || '30')
      },
      alerting: {
        enabled: process.env.ALERTING_ENABLED === 'true',
        provider: (process.env.ALERTING_PROVIDER as any) || 'alertmanager',
        channels: []
      }
    },
    
    security: {
      scanners: {
        trivy: {
          enabled: process.env.SECURITY_TRIVY_ENABLED === 'true',
          timeout: process.env.SECURITY_TRIVY_TIMEOUT || '300s'
        },
        snyk: {
          enabled: process.env.SECURITY_SNYK_ENABLED === 'true',
          token: process.env.SNYK_TOKEN || ''
        },
        clair: {
          enabled: process.env.SECURITY_CLAIR_ENABLED === 'true',
          endpoint: process.env.SECURITY_CLAIR_ENDPOINT || ''
        }
      },
      policies: [],
      thresholds: {
        critical: parseInt(process.env.SECURITY_THRESHOLD_CRITICAL || '0'),
        high: parseInt(process.env.SECURITY_THRESHOLD_HIGH || '5'),
        medium: parseInt(process.env.SECURITY_THRESHOLD_MEDIUM || '20'),
        low: parseInt(process.env.SECURITY_THRESHOLD_LOW || '50')
      },
      compliance: {
        frameworks: (process.env.COMPLIANCE_FRAMEWORKS || '').split(',').filter(f => f)
      }
    },
    
    registry: {
      registries: [
        {
          name: 'npm',
          type: 'npm',
          url: process.env.REGISTRY_NPM_URL || 'https://registry.npmjs.org',
          enabled: process.env.REGISTRY_NPM_ENABLED === 'true',
          priority: 1,
          scanFrequency: '0 */6 * * *' // Every 6 hours
        },
        {
          name: 'backstage-marketplace',
          type: 'backstage-marketplace',
          url: 'https://backstage.io/marketplace',
          enabled: process.env.REGISTRY_BACKSTAGE_MARKETPLACE_ENABLED === 'true',
          priority: 2,
          scanFrequency: '0 */12 * * *' // Every 12 hours
        }
      ],
      caching: {
        enabled: process.env.REGISTRY_CACHE_ENABLED === 'true',
        ttl: parseInt(process.env.REGISTRY_CACHE_TTL || '3600'),
        maxSize: parseInt(process.env.REGISTRY_CACHE_MAX_SIZE || '1073741824')
      },
      validation: {
        schemaValidation: process.env.REGISTRY_VALIDATION_SCHEMA === 'true',
        securityScanning: process.env.REGISTRY_VALIDATION_SECURITY === 'true',
        compatibilityChecks: process.env.REGISTRY_VALIDATION_COMPATIBILITY === 'true'
      }
    },
    
    pipeline: {
      maxConcurrentInstallations: parseInt(process.env.PIPELINE_MAX_CONCURRENT_INSTALLATIONS || '10'),
      defaultStrategy: (process.env.PIPELINE_DEFAULT_STRATEGY as DeploymentStrategy) || DeploymentStrategy.ROLLING_UPDATE,
      retryPolicy: {
        maxRetries: parseInt(process.env.PIPELINE_RETRY_MAX_RETRIES || '3'),
        backoffMultiplier: parseInt(process.env.PIPELINE_RETRY_BACKOFF_MULTIPLIER || '2'),
        maxBackoffTime: parseInt(process.env.PIPELINE_RETRY_MAX_BACKOFF_TIME || '60000')
      },
      timeouts: {
        installation: parseInt(process.env.PIPELINE_TIMEOUT_INSTALLATION || '1800000'),
        healthCheck: parseInt(process.env.PIPELINE_TIMEOUT_HEALTH_CHECK || '300000'),
        rollback: parseInt(process.env.PIPELINE_TIMEOUT_ROLLBACK || '600000')
      }
    },
    
    // Merge with file configuration
    ...fileConfig
  };

  return config;
}

/**
 * Set up graceful shutdown
 */
function setupGracefulShutdown(orchestrator: PluginPipelineOrchestrator): void {
  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, initiating graceful shutdown...`);
    
    try {
      await orchestrator.shutdown();
      console.log('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGQUIT', () => shutdown('SIGQUIT'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    shutdown('uncaughtException');
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    shutdown('unhandledRejection');
  });
}

/**
 * Set up health check endpoints
 */
function setupHealthChecks(orchestrator: PluginPipelineOrchestrator): void {
  const express = require('express');
  const app = express();
  const port = process.env.HEALTH_PORT || 8081;

  // Liveness probe
  app.get('/health/liveness', (req: any, res: any) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Readiness probe
  app.get('/health/readiness', async (req: any, res: any) => {
    try {
      const status = await orchestrator.getSystemStatus();
      if (status.status === 'healthy' || status.status === 'degraded') {
        res.status(200).json({
          status: 'ready',
          systemStatus: status.status,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(503).json({
          status: 'not ready',
          systemStatus: status.status,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      res.status(503).json({
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Startup probe
  app.get('/health/startup', (req: any, res: any) => {
    if (orchestrator['isInitialized']) {
      res.status(200).json({
        status: 'started',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'starting',
        timestamp: new Date().toISOString()
      });
    }
  });

  app.listen(port, '0.0.0.0', () => {
    console.log(`Health check server listening on port ${port}`);
  });
}

/**
 * Set up metrics endpoint
 */
function setupMetricsEndpoint(orchestrator: PluginPipelineOrchestrator): void {
  const express = require('express');
  const app = express();
  const port = process.env.METRICS_PORT || 9090;

  app.get('/metrics', async (req: any, res: any) => {
    try {
      // This would return Prometheus metrics
      res.set('Content-Type', 'text/plain');
      res.send(`# Plugin Pipeline Orchestrator Metrics
# TYPE plugin_pipeline_up gauge
plugin_pipeline_up 1
# TYPE plugin_pipeline_uptime_seconds gauge
plugin_pipeline_uptime_seconds ${process.uptime()}
`);
    } catch (error) {
      res.status(500).send(`# Error collecting metrics: ${error.message}`);
    }
  });

  app.listen(port, '0.0.0.0', () => {
    console.log(`Metrics server listening on port ${port}`);
  });
}

/**
 * Set up API endpoints
 */
function setupAPIEndpoints(orchestrator: PluginPipelineOrchestrator): void {
  const express = require('express');
  const app = express();
  const port = process.env.PORT || 8080;

  app.use(express.json());

  // Install plugin endpoint
  app.post('/api/v1/plugins/install', async (req: any, res: any) => {
    try {
      const { plugin, strategy, options } = req.body;
      
      if (!plugin || !plugin.name || !plugin.version) {
        return res.status(400).json({
          error: 'Invalid plugin definition. Name and version are required.'
        });
      }

      const result = await orchestrator.installPlugin(plugin, strategy, options);
      
      res.status(202).json({
        message: 'Plugin installation initiated',
        installationId: result.installationId,
        status: result.status
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to initiate plugin installation',
        message: error.message
      });
    }
  });

  // Get installation status
  app.get('/api/v1/installations/:id', (req: any, res: any) => {
    try {
      const status = orchestrator.getInstallationStatus(req.params.id);
      
      if (!status) {
        return res.status(404).json({
          error: 'Installation not found'
        });
      }

      res.json(status);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get installation status',
        message: error.message
      });
    }
  });

  // List installed plugins
  app.get('/api/v1/plugins', async (req: any, res: any) => {
    try {
      const plugins = await orchestrator.getInstalledPlugins();
      res.json({ plugins });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to list plugins',
        message: error.message
      });
    }
  });

  // Uninstall plugin
  app.delete('/api/v1/plugins/:name', async (req: any, res: any) => {
    try {
      await orchestrator.uninstallPlugin(req.params.name);
      
      res.json({
        message: 'Plugin uninstalled successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to uninstall plugin',
        message: error.message
      });
    }
  });

  // Get system status
  app.get('/api/v1/status', async (req: any, res: any) => {
    try {
      const status = await orchestrator.getSystemStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get system status',
        message: error.message
      });
    }
  });

  // Trigger maintenance
  app.post('/api/v1/maintenance', async (req: any, res: any) => {
    try {
      await orchestrator.performMaintenance();
      
      res.json({
        message: 'Maintenance completed successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Maintenance failed',
        message: error.message
      });
    }
  });

  app.listen(port, '0.0.0.0', () => {
    console.log(`API server listening on port ${port}`);
  });
}

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  console.log('Starting Plugin Installation Pipeline Orchestrator...');
  
  try {
    // Load configuration
    const config = loadConfiguration();
    console.log('Configuration loaded successfully');

    // Initialize orchestrator
    const orchestrator = new PluginPipelineOrchestrator(config);

    // Set up endpoints
    setupHealthChecks(orchestrator);
    setupMetricsEndpoint(orchestrator);
    setupAPIEndpoints(orchestrator);

    // Set up graceful shutdown
    setupGracefulShutdown(orchestrator);

    // Initialize the orchestrator
    await orchestrator.initialize();
    
    console.log('Plugin Installation Pipeline Orchestrator started successfully');
    console.log(`API server: http://0.0.0.0:${process.env.PORT || 8080}`);
    console.log(`Health checks: http://0.0.0.0:${process.env.HEALTH_PORT || 8081}`);
    console.log(`Metrics: http://0.0.0.0:${process.env.METRICS_PORT || 9090}`);

    // Set up event listeners
    orchestrator.on('plugin-installed', (data) => {
      console.log(`Plugin installed successfully: ${data.pluginDefinition.name}@${data.pluginDefinition.version}`);
    });

    orchestrator.on('plugin-installation-failed', (data) => {
      console.error(`Plugin installation failed: ${data.pluginDefinition.name}@${data.pluginDefinition.version}`, data.error);
    });

    orchestrator.on('system-unhealthy', (status) => {
      console.error('System health check failed:', status);
    });

    // Keep the process running
    process.stdin.resume();

  } catch (error) {
    console.error('Failed to start Plugin Installation Pipeline Orchestrator:', error);
    process.exit(1);
  }
}

// Start the application
if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error in main:', error);
    process.exit(1);
  });
}

export {
  PluginPipelineOrchestrator,
  loadConfiguration,
  setupGracefulShutdown,
  setupHealthChecks,
  setupMetricsEndpoint,
  setupAPIEndpoints
};