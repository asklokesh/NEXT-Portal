/**
 * Kubernetes Secret Injector for Vault Integration
 * Provides programmatic secret injection into Kubernetes workloads
 */

import * as k8s from '@kubernetes/client-node';
import { VaultApi } from './vault-client';
import { DynamicSecretsManager } from './dynamic-secrets';

export interface SecretInjectionConfig {
  namespace: string;
  secretName: string;
  vaultPath: string;
  format: 'json' | 'env' | 'yaml' | 'raw';
  template?: string;
  refreshInterval?: number; // seconds
  annotations?: Record<string, string>;
  labels?: Record<string, string>;
}

export interface WorkloadInjectionConfig {
  name: string;
  namespace: string;
  type: 'deployment' | 'statefulset' | 'daemonset' | 'job' | 'cronjob';
  secrets: SecretInjectionConfig[];
  vaultRole: string;
  sidecarConfig?: {
    image?: string;
    resources?: k8s.V1ResourceRequirements;
    env?: k8s.V1EnvVar[];
  };
}

export interface InjectionStatus {
  workloadName: string;
  namespace: string;
  status: 'pending' | 'injected' | 'failed' | 'updating';
  lastUpdated: Date;
  secretsCount: number;
  errors?: string[];
}

/**
 * Kubernetes Secret Injector for automatic Vault secret injection
 */
export class K8sSecretInjector {
  private k8sApi: k8s.CoreV1Api;
  private k8sAppsApi: k8s.AppsV1Api;
  private k8sBatchApi: k8s.BatchV1Api;
  private vaultApi: VaultApi;
  private secretsManager: DynamicSecretsManager;
  private injectionStatuses: Map<string, InjectionStatus> = new Map();
  private watchController?: AbortController;

  constructor(
    vaultApi: VaultApi,
    secretsManager: DynamicSecretsManager,
    kubeConfig?: k8s.KubeConfig
  ) {
    this.vaultApi = vaultApi;
    this.secretsManager = secretsManager;

    // Initialize Kubernetes client
    const kc = kubeConfig || new k8s.KubeConfig();
    if (!kubeConfig) {
      kc.loadFromDefault();
    }

    this.k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    this.k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
    this.k8sBatchApi = kc.makeApiClient(k8s.BatchV1Api);
  }

  /**
   * Inject secrets into a Kubernetes workload using annotations
   */
  async injectSecretsViaAnnotations(config: WorkloadInjectionConfig): Promise<void> {
    const key = `${config.namespace}/${config.name}`;
    
    try {
      this.injectionStatuses.set(key, {
        workloadName: config.name,
        namespace: config.namespace,
        status: 'pending',
        lastUpdated: new Date(),
        secretsCount: config.secrets.length
      });

      // Get the workload
      const workload = await this.getWorkload(config.type, config.name, config.namespace);
      
      if (!workload) {
        throw new Error(`Workload ${config.type}/${config.name} not found in namespace ${config.namespace}`);
      }

      // Prepare annotations for Vault Agent injection
      const vaultAnnotations = this.generateVaultAnnotations(config);

      // Update workload with Vault annotations
      await this.updateWorkloadAnnotations(config.type, config.name, config.namespace, vaultAnnotations);

      // Update status
      this.injectionStatuses.set(key, {
        workloadName: config.name,
        namespace: config.namespace,
        status: 'injected',
        lastUpdated: new Date(),
        secretsCount: config.secrets.length
      });

    } catch (error) {
      this.injectionStatuses.set(key, {
        workloadName: config.name,
        namespace: config.namespace,
        status: 'failed',
        lastUpdated: new Date(),
        secretsCount: config.secrets.length,
        errors: [(error as Error).message]
      });
      throw error;
    }
  }

  /**
   * Inject secrets directly as Kubernetes secrets
   */
  async injectSecretsDirectly(configs: SecretInjectionConfig[]): Promise<void> {
    const injectionPromises = configs.map(async (config) => {
      try {
        // Fetch secret from Vault
        const secretData = await this.fetchVaultSecret(config.vaultPath);
        
        // Format secret data according to configuration
        const formattedData = this.formatSecretData(secretData, config.format, config.template);
        
        // Create or update Kubernetes secret
        await this.createOrUpdateK8sSecret(config, formattedData);
        
        // Setup automatic refresh if configured
        if (config.refreshInterval && config.refreshInterval > 0) {
          this.setupSecretRefresh(config);
        }

      } catch (error) {
        console.error(`Failed to inject secret ${config.secretName}:`, error);
        throw error;
      }
    });

    await Promise.all(injectionPromises);
  }

  /**
   * Create Vault Agent sidecar configuration
   */
  createVaultAgentSidecar(config: WorkloadInjectionConfig): k8s.V1Container {
    const agentConfig = this.generateAgentConfig(config);
    
    return {
      name: 'vault-agent',
      image: config.sidecarConfig?.image || 'hashicorp/vault:1.16.1',
      command: ['vault', 'agent', '-config=/vault/config/agent.hcl'],
      env: [
        {
          name: 'VAULT_ADDR',
          value: 'https://vault.vault-system.svc.cluster.local:8200'
        },
        {
          name: 'VAULT_CACERT',
          value: '/vault/ssl/ca.crt'
        },
        ...(config.sidecarConfig?.env || [])
      ],
      volumeMounts: [
        {
          name: 'vault-secrets',
          mountPath: '/vault/secrets'
        },
        {
          name: 'vault-config',
          mountPath: '/vault/config'
        },
        {
          name: 'vault-ssl',
          mountPath: '/vault/ssl',
          readOnly: true
        }
      ],
      resources: config.sidecarConfig?.resources || {
        requests: {
          memory: '128Mi',
          cpu: '100m'
        },
        limits: {
          memory: '256Mi',
          cpu: '200m'
        }
      },
      securityContext: {
        allowPrivilegeEscalation: false,
        readOnlyRootFilesystem: true,
        runAsNonRoot: true,
        runAsUser: 65534,
        capabilities: {
          drop: ['ALL']
        }
      }
    };
  }

  /**
   * Watch for workload changes and automatically inject secrets
   */
  async startAutoInjection(namespaces: string[] = ['default']): Promise<void> {
    this.watchController = new AbortController();

    for (const namespace of namespaces) {
      // Watch Deployments
      this.watchWorkloadType('deployments', namespace);
      
      // Watch StatefulSets
      this.watchWorkloadType('statefulsets', namespace);
      
      // Watch DaemonSets
      this.watchWorkloadType('daemonsets', namespace);
    }
  }

  /**
   * Stop auto-injection watcher
   */
  stopAutoInjection(): void {
    if (this.watchController) {
      this.watchController.abort();
      this.watchController = undefined;
    }
  }

  /**
   * Get injection status for all workloads
   */
  getInjectionStatuses(): Map<string, InjectionStatus> {
    return new Map(this.injectionStatuses);
  }

  /**
   * Remove secret injection from a workload
   */
  async removeSecretInjection(
    type: string,
    name: string,
    namespace: string
  ): Promise<void> {
    try {
      // Remove Vault annotations
      const emptyAnnotations: Record<string, string> = {};
      await this.updateWorkloadAnnotations(type, name, namespace, emptyAnnotations, true);

      // Remove from status tracking
      const key = `${namespace}/${name}`;
      this.injectionStatuses.delete(key);

    } catch (error) {
      console.error(`Failed to remove secret injection from ${type}/${name}:`, error);
      throw error;
    }
  }

  private async fetchVaultSecret(path: string): Promise<any> {
    try {
      return await this.vaultApi.getSecret(path);
    } catch (error) {
      console.error(`Failed to fetch secret from Vault path ${path}:`, error);
      throw error;
    }
  }

  private formatSecretData(data: any, format: string, template?: string): Record<string, string> {
    switch (format) {
      case 'json':
        return { 'data.json': JSON.stringify(data, null, 2) };
      
      case 'env':
        const envVars: string[] = [];
        this.flattenObject(data, '', envVars);
        return { '.env': envVars.join('\n') };
      
      case 'yaml':
        // Simple YAML conversion - in production, use a proper YAML library
        return { 'data.yaml': JSON.stringify(data, null, 2) };
      
      case 'raw':
        if (template) {
          return { 'data': this.applyTemplate(template, data) };
        }
        return typeof data === 'string' ? { 'data': data } : { 'data.json': JSON.stringify(data) };
      
      default:
        return { 'data.json': JSON.stringify(data, null, 2) };
    }
  }

  private flattenObject(obj: any, prefix: string, result: string[]): void {
    for (const [key, value] of Object.entries(obj)) {
      const envKey = prefix ? `${prefix}_${key}`.toUpperCase() : key.toUpperCase();
      
      if (typeof value === 'object' && value !== null) {
        this.flattenObject(value, envKey, result);
      } else {
        result.push(`${envKey}=${value}`);
      }
    }
  }

  private applyTemplate(template: string, data: any): string {
    let result = template;
    
    const replacements = this.extractTemplateVariables(data, '');
    
    for (const [key, value] of Object.entries(replacements)) {
      const regex = new RegExp(`\\{\\{\\s*\\.${key}\\s*\\}\\}`, 'g');
      result = result.replace(regex, String(value));
    }
    
    return result;
  }

  private extractTemplateVariables(obj: any, prefix: string): Record<string, any> {
    const variables: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'object' && value !== null) {
        Object.assign(variables, this.extractTemplateVariables(value, fullKey));
      } else {
        variables[fullKey] = value;
      }
    }
    
    return variables;
  }

  private async createOrUpdateK8sSecret(
    config: SecretInjectionConfig,
    data: Record<string, string>
  ): Promise<void> {
    const secret: k8s.V1Secret = {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name: config.secretName,
        namespace: config.namespace,
        labels: {
          'managed-by': 'vault-injector',
          'vault-path': config.vaultPath.replace(/[^a-zA-Z0-9-_.]/g, '-'),
          ...config.labels
        },
        annotations: {
          'vault.hashicorp.com/path': config.vaultPath,
          'vault.hashicorp.com/format': config.format,
          'vault.hashicorp.com/last-updated': new Date().toISOString(),
          ...config.annotations
        }
      },
      type: 'Opaque',
      stringData: data
    };

    try {
      // Try to get existing secret
      await this.k8sApi.readNamespacedSecret(config.secretName, config.namespace);
      
      // Secret exists, update it
      await this.k8sApi.replaceNamespacedSecret(config.secretName, config.namespace, secret);
      
    } catch (error) {
      // Secret doesn't exist, create it
      await this.k8sApi.createNamespacedSecret(config.namespace, secret);
    }
  }

  private generateVaultAnnotations(config: WorkloadInjectionConfig): Record<string, string> {
    const annotations: Record<string, string> = {
      'vault.hashicorp.com/agent-inject': 'true',
      'vault.hashicorp.com/role': config.vaultRole,
      'vault.hashicorp.com/agent-init-first': 'true',
      'vault.hashicorp.com/agent-pre-populate-only': 'true'
    };

    config.secrets.forEach((secret, index) => {
      const secretKey = secret.secretName || `secret-${index}`;
      annotations[`vault.hashicorp.com/agent-inject-secret-${secretKey}`] = secret.vaultPath;
      
      if (secret.template) {
        annotations[`vault.hashicorp.com/agent-inject-template-${secretKey}`] = secret.template;
      }
      
      if (secret.format !== 'raw') {
        annotations[`vault.hashicorp.com/secret-volume-path-${secretKey}`] = `/vault/secrets/${secretKey}.${secret.format}`;
      }
    });

    return annotations;
  }

  private generateAgentConfig(config: WorkloadInjectionConfig): string {
    const templates = config.secrets.map(secret => {
      return `
template {
  source = "/vault/templates/${secret.secretName}.tpl"
  destination = "/vault/secrets/${secret.secretName}"
  perms = 0600
  wait {
    min = "2s"
    max = "10s"
  }
}`;
    }).join('\n');

    return `
auto_auth {
  method "kubernetes" {
    mount_path = "auth/kubernetes"
    config = {
      role = "${config.vaultRole}"
    }
  }
  sink "file" {
    config = {
      path = "/vault/secrets/.token"
    }
  }
}

api_proxy {
  use_auto_auth_token = true
}

listener "tcp" {
  address = "127.0.0.1:8100"
  tls_disable = true
}

vault {
  address = "https://vault.vault-system.svc.cluster.local:8200"
}

${templates}
`;
  }

  private async getWorkload(type: string, name: string, namespace: string): Promise<any> {
    try {
      switch (type) {
        case 'deployment':
          const deployment = await this.k8sAppsApi.readNamespacedDeployment(name, namespace);
          return deployment.body;
        case 'statefulset':
          const statefulset = await this.k8sAppsApi.readNamespacedStatefulSet(name, namespace);
          return statefulset.body;
        case 'daemonset':
          const daemonset = await this.k8sAppsApi.readNamespacedDaemonSet(name, namespace);
          return daemonset.body;
        case 'job':
          const job = await this.k8sBatchApi.readNamespacedJob(name, namespace);
          return job.body;
        default:
          throw new Error(`Unsupported workload type: ${type}`);
      }
    } catch (error) {
      return null;
    }
  }

  private async updateWorkloadAnnotations(
    type: string,
    name: string,
    namespace: string,
    annotations: Record<string, string>,
    remove = false
  ): Promise<void> {
    const workload = await this.getWorkload(type, name, namespace);
    
    if (!workload) {
      throw new Error(`Workload ${type}/${name} not found`);
    }

    // Update pod template annotations
    if (!workload.spec.template.metadata) {
      workload.spec.template.metadata = {};
    }
    if (!workload.spec.template.metadata.annotations) {
      workload.spec.template.metadata.annotations = {};
    }

    if (remove) {
      // Remove Vault-related annotations
      for (const key of Object.keys(workload.spec.template.metadata.annotations)) {
        if (key.startsWith('vault.hashicorp.com/')) {
          delete workload.spec.template.metadata.annotations[key];
        }
      }
    } else {
      // Add/update annotations
      Object.assign(workload.spec.template.metadata.annotations, annotations);
    }

    // Update the workload
    switch (type) {
      case 'deployment':
        await this.k8sAppsApi.replaceNamespacedDeployment(name, namespace, workload);
        break;
      case 'statefulset':
        await this.k8sAppsApi.replaceNamespacedStatefulSet(name, namespace, workload);
        break;
      case 'daemonset':
        await this.k8sAppsApi.replaceNamespacedDaemonSet(name, namespace, workload);
        break;
      default:
        throw new Error(`Cannot update workload type: ${type}`);
    }
  }

  private watchWorkloadType(type: string, namespace: string): void {
    // This is a simplified watch implementation
    // In production, you'd want to use proper Kubernetes watch APIs
    setInterval(async () => {
      try {
        let workloads: any[] = [];
        
        switch (type) {
          case 'deployments':
            const deployments = await this.k8sAppsApi.listNamespacedDeployment(namespace);
            workloads = deployments.body.items;
            break;
          case 'statefulsets':
            const statefulsets = await this.k8sAppsApi.listNamespacedStatefulSet(namespace);
            workloads = statefulsets.body.items;
            break;
          case 'daemonsets':
            const daemonsets = await this.k8sAppsApi.listNamespacedDaemonSet(namespace);
            workloads = daemonsets.body.items;
            break;
        }

        for (const workload of workloads) {
          const annotations = workload.spec?.template?.metadata?.annotations || {};
          const shouldInject = annotations['vault.hashicorp.com/agent-inject'] === 'true';
          
          if (shouldInject) {
            // Check if injection is up to date
            this.validateInjection(workload, type.slice(0, -1)); // Remove 's' from type
          }
        }
      } catch (error) {
        console.error(`Error watching ${type} in namespace ${namespace}:`, error);
      }
    }, 30000); // Check every 30 seconds
  }

  private validateInjection(workload: any, type: string): void {
    const key = `${workload.metadata.namespace}/${workload.metadata.name}`;
    const annotations = workload.spec?.template?.metadata?.annotations || {};
    
    // Simple validation - in production, this would be more comprehensive
    const hasVaultAnnotations = Object.keys(annotations).some(key => 
      key.startsWith('vault.hashicorp.com/')
    );

    if (hasVaultAnnotations) {
      this.injectionStatuses.set(key, {
        workloadName: workload.metadata.name,
        namespace: workload.metadata.namespace,
        status: 'injected',
        lastUpdated: new Date(),
        secretsCount: Object.keys(annotations).filter(k => 
          k.startsWith('vault.hashicorp.com/agent-inject-secret-')
        ).length
      });
    }
  }

  private setupSecretRefresh(config: SecretInjectionConfig): void {
    setInterval(async () => {
      try {
        const secretData = await this.fetchVaultSecret(config.vaultPath);
        const formattedData = this.formatSecretData(secretData, config.format, config.template);
        await this.createOrUpdateK8sSecret(config, formattedData);
      } catch (error) {
        console.error(`Failed to refresh secret ${config.secretName}:`, error);
      }
    }, (config.refreshInterval || 300) * 1000); // Default 5 minutes
  }
}

/**
 * Factory function to create a configured K8sSecretInjector
 */
export function createK8sSecretInjector(
  vaultApi: VaultApi,
  secretsManager: DynamicSecretsManager,
  kubeConfig?: k8s.KubeConfig
): K8sSecretInjector {
  return new K8sSecretInjector(vaultApi, secretsManager, kubeConfig);
}