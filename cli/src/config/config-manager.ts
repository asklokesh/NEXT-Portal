import Conf from 'conf';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { load, dump } from 'js-yaml';
import { Logger } from '../utils/logger';

export interface CLIConfig {
  baseURL: string;
  apiKey?: string;
  bearerToken?: string;
  timeout: number;
  retries: number;
  format: 'json' | 'yaml' | 'table';
  editor: string;
  pager: string;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  autoUpdate: boolean;
  telemetry: boolean;
}

export interface Profile {
  name: string;
  config: Partial<CLIConfig>;
}

const DEFAULT_CONFIG: CLIConfig = {
  baseURL: 'http://localhost:4400/api',
  timeout: 30000,
  retries: 3,
  format: 'table',
  editor: process.env.EDITOR || 'vi',
  pager: process.env.PAGER || 'less',
  logLevel: 'info',
  autoUpdate: true,
  telemetry: true,
};

export class ConfigManager {
  private static instance: ConfigManager;
  private store: Conf<CLIConfig>;
  private logger: Logger;
  private currentProfile: string = 'default';

  private constructor() {
    this.logger = Logger.getInstance();
    this.store = new Conf<CLIConfig>({
      configName: 'backstage-cli',
      defaults: DEFAULT_CONFIG,
      schema: {
        baseURL: {
          type: 'string',
          format: 'uri'
        },
        apiKey: {
          type: 'string'
        },
        bearerToken: {
          type: 'string'
        },
        timeout: {
          type: 'number',
          minimum: 1000
        },
        retries: {
          type: 'number',
          minimum: 0,
          maximum: 10
        },
        format: {
          type: 'string',
          enum: ['json', 'yaml', 'table']
        },
        editor: {
          type: 'string'
        },
        pager: {
          type: 'string'
        },
        logLevel: {
          type: 'string',
          enum: ['error', 'warn', 'info', 'debug']
        },
        autoUpdate: {
          type: 'boolean'
        },
        telemetry: {
          type: 'boolean'
        }
      }
    });
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  public async loadConfig(configPath?: string): Promise<void> {
    if (configPath) {
      await this.loadFromFile(configPath);
    } else {
      await this.loadDefaultConfig();
    }
  }

  public async loadDefaultConfig(): Promise<void> {
    // Try to load from various locations
    const configPaths = [
      join(process.cwd(), '.backstage-cli.yaml'),
      join(process.cwd(), '.backstage-cli.yml'),
      join(homedir(), '.backstage-cli.yaml'),
      join(homedir(), '.backstage-cli.yml'),
    ];

    for (const configPath of configPaths) {
      if (existsSync(configPath)) {
        await this.loadFromFile(configPath);
        this.logger.debug(`Loaded configuration from ${configPath}`);
        return;
      }
    }

    this.logger.debug('No configuration file found, using defaults');
  }

  private async loadFromFile(configPath: string): Promise<void> {
    try {
      const content = readFileSync(configPath, 'utf8');
      const config = load(content) as Partial<CLIConfig>;
      
      // Merge with current config
      for (const [key, value] of Object.entries(config)) {
        if (value !== undefined) {
          this.store.set(key as keyof CLIConfig, value as any);
        }
      }
      
      this.logger.debug(`Configuration loaded from ${configPath}`);
    } catch (error) {
      this.logger.error(`Failed to load configuration from ${configPath}:`, error);
      throw error;
    }
  }

  public get<K extends keyof CLIConfig>(key: K): CLIConfig[K] {
    const value = this.store.get(key);
    return value !== undefined ? value : DEFAULT_CONFIG[key];
  }

  public set<K extends keyof CLIConfig>(key: K, value: CLIConfig[K]): void {
    this.store.set(key, value);
    this.logger.debug(`Configuration updated: ${key} = ${value}`);
  }

  public getAll(): CLIConfig {
    const config = { ...DEFAULT_CONFIG };
    for (const key of Object.keys(DEFAULT_CONFIG) as Array<keyof CLIConfig>) {
      const value = this.store.get(key);
      if (value !== undefined) {
        (config as any)[key] = value;
      }
    }
    return config;
  }

  public setAll(config: Partial<CLIConfig>): void {
    for (const [key, value] of Object.entries(config)) {
      if (value !== undefined) {
        this.store.set(key as keyof CLIConfig, value as any);
      }
    }
    this.logger.debug('Configuration updated with new values');
  }

  public reset(): void {
    this.store.clear();
    this.logger.debug('Configuration reset to defaults');
  }

  public export(format: 'json' | 'yaml' = 'yaml'): string {
    const config = this.getAll();
    
    if (format === 'json') {
      return JSON.stringify(config, null, 2);
    } else {
      return dump(config, { indent: 2 });
    }
  }

  public exportToFile(filePath: string, format?: 'json' | 'yaml'): void {
    const extension = filePath.split('.').pop()?.toLowerCase();
    const detectedFormat = extension === 'json' ? 'json' : 'yaml';
    const finalFormat = format || detectedFormat;
    
    const content = this.export(finalFormat);
    writeFileSync(filePath, content, 'utf8');
    this.logger.info(`Configuration exported to ${filePath}`);
  }

  public getConfigPath(): string {
    return this.store.path;
  }

  public validate(): { valid: boolean; errors: string[] } {
    const config = this.getAll();
    const errors: string[] = [];

    // Validate base URL
    try {
      new URL(config.baseURL);
    } catch {
      errors.push('Invalid base URL format');
    }

    // Validate timeout
    if (config.timeout < 1000) {
      errors.push('Timeout must be at least 1000ms');
    }

    // Validate retries
    if (config.retries < 0 || config.retries > 10) {
      errors.push('Retries must be between 0 and 10');
    }

    // Check authentication
    if (!config.apiKey && !config.bearerToken) {
      errors.push('Either apiKey or bearerToken must be configured');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Profile management
  public createProfile(name: string, config: Partial<CLIConfig>): void {
    const profiles = this.store.get('profiles' as any) || {};
    profiles[name] = { name, config };
    this.store.set('profiles' as any, profiles);
    this.logger.debug(`Profile '${name}' created`);
  }

  public switchProfile(name: string): void {
    const profiles = this.store.get('profiles' as any) || {};
    const profile = profiles[name];
    
    if (!profile) {
      throw new Error(`Profile '${name}' not found`);
    }
    
    this.currentProfile = name;
    this.setAll(profile.config);
    this.logger.debug(`Switched to profile '${name}'`);
  }

  public listProfiles(): Profile[] {
    const profiles = this.store.get('profiles' as any) || {};
    return Object.values(profiles) as Profile[];
  }

  public deleteProfile(name: string): void {
    if (name === 'default') {
      throw new Error('Cannot delete default profile');
    }
    
    const profiles = this.store.get('profiles' as any) || {};
    delete profiles[name];
    this.store.set('profiles' as any, profiles);
    
    if (this.currentProfile === name) {
      this.currentProfile = 'default';
      this.reset();
    }
    
    this.logger.debug(`Profile '${name}' deleted`);
  }

  public getCurrentProfile(): string {
    return this.currentProfile;
  }
}