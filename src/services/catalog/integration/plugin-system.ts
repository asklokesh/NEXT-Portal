/**
 * Plugin System
 * 
 * Extensible plugin system for custom data sources, processors, enrichers,
 * and integrations with external systems.
 */

import { EventEmitter } from 'events';
import { z } from 'zod';
import {
  ISourceProcessor,
  IEntityTransformer,
  IEntityValidator,
  IEntityEnricher,
  IRelationshipResolver,
  IQualityAssessor,
} from '../types';

// Plugin manifest schema
const PluginManifestSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string(),
  author: z.string(),
  homepage: z.string().url().optional(),
  repository: z.string().url().optional(),
  keywords: z.array(z.string()),
  license: z.string(),
  dependencies: z.record(z.string()).optional(),
  backstageVersion: z.string().optional(),
  exports: z.object({
    sourceProcessors: z.array(z.string()).optional(),
    transformers: z.array(z.string()).optional(),
    validators: z.array(z.string()).optional(),
    enrichers: z.array(z.string()).optional(),
    relationshipResolvers: z.array(z.string()).optional(),
    qualityAssessors: z.array(z.string()).optional(),
  }),
  config: z.object({
    schema: z.record(z.unknown()).optional(),
    defaults: z.record(z.unknown()).optional(),
  }).optional(),
  permissions: z.array(z.enum([
    'read:entities',
    'write:entities',
    'read:relationships',
    'write:relationships',
    'read:metrics',
    'network:http',
    'network:https',
    'filesystem:read',
    'filesystem:write',
  ])).optional(),
});

export type PluginManifest = z.infer<typeof PluginManifestSchema>;

interface PluginInstance {
  manifest: PluginManifest;
  module: any;
  instances: {
    sourceProcessors: Map<string, ISourceProcessor>;
    transformers: Map<string, IEntityTransformer>;
    validators: Map<string, IEntityValidator>;
    enrichers: Map<string, IEntityEnricher>;
    relationshipResolvers: Map<string, IRelationshipResolver>;
    qualityAssessors: Map<string, IQualityAssessor>;
  };
  status: 'loaded' | 'active' | 'inactive' | 'error';
  loadedAt: Date;
  lastError?: string;
}

interface PluginConfig {
  allowedPermissions: string[];
  sandboxEnabled: boolean;
  maxMemoryMB: number;
  maxExecutionTimeMs: number;
  trustedPlugins: string[];
  pluginDirectory: string;
}

export class PluginSystem extends EventEmitter {
  private readonly plugins = new Map<string, PluginInstance>();
  private readonly config: PluginConfig;

  constructor(config: PluginConfig) {
    super();
    this.config = config;
  }

  /**
   * Load plugin from directory or package
   */
  async loadPlugin(pluginPath: string, pluginConfig?: Record<string, unknown>): Promise<void> {
    try {
      this.emit('pluginLoadStarted', { pluginPath });

      // Read plugin manifest
      const manifestPath = `${pluginPath}/plugin.json`;
      const manifestData = await this.readPluginManifest(manifestPath);
      const manifest = PluginManifestSchema.parse(manifestData);

      // Check if plugin already loaded
      if (this.plugins.has(manifest.id)) {
        throw new Error(`Plugin ${manifest.id} is already loaded`);
      }

      // Validate permissions
      this.validatePluginPermissions(manifest);

      // Load plugin module
      const module = await this.loadPluginModule(pluginPath, manifest);

      // Create plugin instance
      const pluginInstance: PluginInstance = {
        manifest,
        module,
        instances: {
          sourceProcessors: new Map(),
          transformers: new Map(),
          validators: new Map(),
          enrichers: new Map(),
          relationshipResolvers: new Map(),
          qualityAssessors: new Map(),
        },
        status: 'loaded',
        loadedAt: new Date(),
      };

      // Initialize plugin components
      await this.initializePluginComponents(pluginInstance, pluginConfig);

      this.plugins.set(manifest.id, pluginInstance);
      
      this.emit('pluginLoaded', { pluginId: manifest.id, manifest });

    } catch (error) {
      this.emit('pluginLoadFailed', { pluginPath, error });
      throw error;
    }
  }

  /**
   * Unload plugin
   */
  async unloadPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    try {
      this.emit('pluginUnloadStarted', { pluginId });

      // Cleanup plugin instances
      await this.cleanupPluginInstances(plugin);

      // Remove from registry
      this.plugins.delete(pluginId);
      
      this.emit('pluginUnloaded', { pluginId });

    } catch (error) {
      this.emit('pluginUnloadFailed', { pluginId, error });
      throw error;
    }
  }

  /**
   * Get plugin instance
   */
  getPlugin(pluginId: string): PluginInstance | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * List all loaded plugins
   */
  listPlugins(): Array<{
    id: string;
    name: string;
    version: string;
    status: string;
    loadedAt: Date;
  }> {
    return Array.from(this.plugins.values()).map(plugin => ({
      id: plugin.manifest.id,
      name: plugin.manifest.name,
      version: plugin.manifest.version,
      status: plugin.status,
      loadedAt: plugin.loadedAt,
    }));
  }

  /**
   * Get source processors from all plugins
   */
  getSourceProcessors(): ISourceProcessor[] {
    const processors: ISourceProcessor[] = [];
    
    for (const plugin of this.plugins.values()) {
      if (plugin.status === 'active') {
        processors.push(...plugin.instances.sourceProcessors.values());
      }
    }
    
    return processors;
  }

  /**
   * Get transformers from all plugins
   */
  getTransformers(): IEntityTransformer[] {
    const transformers: IEntityTransformer[] = [];
    
    for (const plugin of this.plugins.values()) {
      if (plugin.status === 'active') {
        transformers.push(...plugin.instances.transformers.values());
      }
    }
    
    return transformers;
  }

  /**
   * Get validators from all plugins
   */
  getValidators(): IEntityValidator[] {
    const validators: IEntityValidator[] = [];
    
    for (const plugin of this.plugins.values()) {
      if (plugin.status === 'active') {
        validators.push(...plugin.instances.validators.values());
      }
    }
    
    return validators;
  }

  /**
   * Get enrichers from all plugins
   */
  getEnrichers(): IEntityEnricher[] {
    const enrichers: IEntityEnricher[] = [];
    
    for (const plugin of this.plugins.values()) {
      if (plugin.status === 'active') {
        enrichers.push(...plugin.instances.enrichers.values());
      }
    }
    
    return enrichers;
  }

  /**
   * Get relationship resolvers from all plugins
   */
  getRelationshipResolvers(): IRelationshipResolver[] {
    const resolvers: IRelationshipResolver[] = [];
    
    for (const plugin of this.plugins.values()) {
      if (plugin.status === 'active') {
        resolvers.push(...plugin.instances.relationshipResolvers.values());
      }
    }
    
    return resolvers;
  }

  /**
   * Get quality assessors from all plugins
   */
  getQualityAssessors(): IQualityAssessor[] {
    const assessors: IQualityAssessor[] = [];
    
    for (const plugin of this.plugins.values()) {
      if (plugin.status === 'active') {
        assessors.push(...plugin.instances.qualityAssessors.values());
      }
    }
    
    return assessors;
  }

  /**
   * Activate plugin
   */
  async activatePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    if (plugin.status === 'active') {
      return;
    }

    try {
      plugin.status = 'active';
      this.emit('pluginActivated', { pluginId });

    } catch (error) {
      plugin.status = 'error';
      plugin.lastError = error instanceof Error ? error.message : 'Unknown error';
      this.emit('pluginActivationFailed', { pluginId, error });
      throw error;
    }
  }

  /**
   * Deactivate plugin
   */
  async deactivatePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    if (plugin.status !== 'active') {
      return;
    }

    plugin.status = 'inactive';
    this.emit('pluginDeactivated', { pluginId });
  }

  /**
   * Get plugin health status
   */
  getPluginHealth(pluginId: string): {
    status: string;
    lastError?: string;
    memoryUsage?: number;
    uptime?: number;
  } {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    return {
      status: plugin.status,
      lastError: plugin.lastError,
      uptime: Date.now() - plugin.loadedAt.getTime(),
    };
  }

  /**
   * Read plugin manifest
   */
  private async readPluginManifest(manifestPath: string): Promise<unknown> {
    try {
      const fs = await import('fs/promises');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      return JSON.parse(manifestContent);
    } catch (error) {
      throw new Error(`Failed to read plugin manifest: ${error}`);
    }
  }

  /**
   * Validate plugin permissions
   */
  private validatePluginPermissions(manifest: PluginManifest): void {
    if (!manifest.permissions) {
      return;
    }

    for (const permission of manifest.permissions) {
      if (!this.config.allowedPermissions.includes(permission)) {
        throw new Error(`Plugin requests disallowed permission: ${permission}`);
      }
    }
  }

  /**
   * Load plugin module with sandboxing
   */
  private async loadPluginModule(pluginPath: string, manifest: PluginManifest): Promise<any> {
    if (this.config.sandboxEnabled && !this.config.trustedPlugins.includes(manifest.id)) {
      return this.loadPluginInSandbox(pluginPath, manifest);
    } else {
      return this.loadPluginDirectly(pluginPath);
    }
  }

  /**
   * Load plugin directly (trusted plugins)
   */
  private async loadPluginDirectly(pluginPath: string): Promise<any> {
    try {
      // Clear require cache to allow reloading
      const mainPath = require.resolve(pluginPath);
      delete require.cache[mainPath];
      
      return require(pluginPath);
    } catch (error) {
      throw new Error(`Failed to load plugin module: ${error}`);
    }
  }

  /**
   * Load plugin in sandbox (untrusted plugins)
   */
  private async loadPluginInSandbox(pluginPath: string, manifest: PluginManifest): Promise<any> {
    // In a real implementation, this would use VM2 or similar sandboxing
    // For now, we'll use a simplified approach
    try {
      const vm = await import('vm');
      const fs = await import('fs/promises');
      
      const pluginCode = await fs.readFile(`${pluginPath}/index.js`, 'utf-8');
      
      const sandbox = {
        require: this.createSandboxedRequire(manifest.permissions || []),
        module: { exports: {} },
        exports: {},
        console,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
      };

      const script = new vm.Script(`
        (function(require, module, exports, console, setTimeout, clearTimeout, setInterval, clearInterval) {
          ${pluginCode}
        })(require, module, exports, console, setTimeout, clearTimeout, setInterval, clearInterval);
      `);

      script.runInNewContext(sandbox, {
        timeout: this.config.maxExecutionTimeMs,
      });

      return sandbox.module.exports;

    } catch (error) {
      throw new Error(`Failed to load plugin in sandbox: ${error}`);
    }
  }

  /**
   * Create sandboxed require function
   */
  private createSandboxedRequire(permissions: string[]): typeof require {
    const allowedModules = new Set([
      'crypto',
      'url',
      'querystring',
      'util',
      'events',
      'stream',
      'buffer',
    ]);

    // Add modules based on permissions
    if (permissions.includes('network:http')) {
      allowedModules.add('http');
    }
    if (permissions.includes('network:https')) {
      allowedModules.add('https');
    }

    return function sandboxedRequire(moduleName: string) {
      if (!allowedModules.has(moduleName)) {
        throw new Error(`Module '${moduleName}' is not allowed in sandbox`);
      }
      return require(moduleName);
    };
  }

  /**
   * Initialize plugin components
   */
  private async initializePluginComponents(
    plugin: PluginInstance,
    pluginConfig?: Record<string, unknown>
  ): Promise<void> {
    const { manifest, module, instances } = plugin;
    const config = { ...manifest.config?.defaults, ...pluginConfig };

    // Initialize source processors
    if (manifest.exports.sourceProcessors) {
      for (const processorName of manifest.exports.sourceProcessors) {
        const ProcessorClass = module[processorName];
        if (ProcessorClass) {
          const processor = new ProcessorClass(config);
          await processor.initialize(config);
          instances.sourceProcessors.set(processor.id, processor);
        }
      }
    }

    // Initialize transformers
    if (manifest.exports.transformers) {
      for (const transformerName of manifest.exports.transformers) {
        const TransformerClass = module[transformerName];
        if (TransformerClass) {
          const transformer = new TransformerClass(config);
          instances.transformers.set(transformer.id, transformer);
        }
      }
    }

    // Initialize validators
    if (manifest.exports.validators) {
      for (const validatorName of manifest.exports.validators) {
        const ValidatorClass = module[validatorName];
        if (ValidatorClass) {
          const validator = new ValidatorClass(config);
          instances.validators.set(validator.id, validator);
        }
      }
    }

    // Initialize enrichers
    if (manifest.exports.enrichers) {
      for (const enricherName of manifest.exports.enrichers) {
        const EnricherClass = module[enricherName];
        if (EnricherClass) {
          const enricher = new EnricherClass(config);
          instances.enrichers.set(enricher.id, enricher);
        }
      }
    }

    // Initialize relationship resolvers
    if (manifest.exports.relationshipResolvers) {
      for (const resolverName of manifest.exports.relationshipResolvers) {
        const ResolverClass = module[resolverName];
        if (ResolverClass) {
          const resolver = new ResolverClass(config);
          instances.relationshipResolvers.set(resolver.id, resolver);
        }
      }
    }

    // Initialize quality assessors
    if (manifest.exports.qualityAssessors) {
      for (const assessorName of manifest.exports.qualityAssessors) {
        const AssessorClass = module[assessorName];
        if (AssessorClass) {
          const assessor = new AssessorClass(config);
          instances.qualityAssessors.set(assessor.id, assessor);
        }
      }
    }

    plugin.status = 'active';
  }

  /**
   * Cleanup plugin instances
   */
  private async cleanupPluginInstances(plugin: PluginInstance): Promise<void> {
    // Cleanup source processors
    for (const processor of plugin.instances.sourceProcessors.values()) {
      try {
        await processor.cleanup();
      } catch (error) {
        this.emit('pluginCleanupError', { 
          pluginId: plugin.manifest.id, 
          component: 'sourceProcessor', 
          error 
        });
      }
    }

    // Clear all instances
    plugin.instances.sourceProcessors.clear();
    plugin.instances.transformers.clear();
    plugin.instances.validators.clear();
    plugin.instances.enrichers.clear();
    plugin.instances.relationshipResolvers.clear();
    plugin.instances.qualityAssessors.clear();
  }
}

export default PluginSystem;