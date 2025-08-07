import { backstageClient } from '../backstage/real-client';

export interface KubernetesCluster {
  name: string;
  title?: string;
  authProvider: string;
  oidcTokenProvider?: string;
  dashboardUrl?: string;
  auth?: Record<string, any>;
}

export interface KubernetesResource {
  type: string;
  name: string;
  namespace?: string;
  cluster: string;
  status: 'healthy' | 'warning' | 'error';
  metadata: {
    creationTimestamp: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    [key: string]: any;
  };
  spec?: Record<string, any>;
  status_data?: Record<string, any>;
}

export interface KubernetesWorkload {
  deployments: KubernetesResource[];
  pods: KubernetesResource[];
  services: KubernetesResource[];
  ingresses: KubernetesResource[];
  configMaps: KubernetesResource[];
  secrets: KubernetesResource[];
}

export interface KubernetesEntityResponse {
  cluster: string;
  resources: KubernetesResource[];
  errors?: Array<{
    errorType: string;
    message: string;
    resourcePath?: string;
  }>;
}

/**
 * Kubernetes client that integrates with Backstage's Kubernetes plugin
 */
export class KubernetesClient {
  private baseUrl = '/api/kubernetes';

  /**
   * Get all available Kubernetes clusters
   */
  async getClusters(): Promise<KubernetesCluster[]> {
    try {
      const response = await backstageClient.request('/api/kubernetes/clusters');
      return response.items || [];
    } catch (error) {
      console.error('Failed to fetch Kubernetes clusters:', error);
      return [];
    }
  }

  /**
   * Get Kubernetes resources for a specific entity
   */
  async getResourcesByEntity(
    entityName: string, 
    entityKind: string = 'Component',
    entityNamespace: string = 'default'
  ): Promise<KubernetesEntityResponse[]> {
    try {
      const entity = {
        metadata: {
          name: entityName,
          namespace: entityNamespace,
        },
        kind: entityKind,
        apiVersion: 'backstage.io/v1alpha1'
      };

      const response = await fetch(`${this.baseUrl}/resources`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entity,
          auth: {}
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error('Failed to fetch Kubernetes resources for entity:', error);
      return [];
    }
  }

  /**
   * Get workloads (deployments, pods, services) for an entity
   */
  async getWorkloadsByEntity(
    entityName: string,
    entityKind: string = 'Component',
    entityNamespace: string = 'default'
  ): Promise<KubernetesWorkload> {
    try {
      const entity = {
        metadata: {
          name: entityName,
          namespace: entityNamespace,
        },
        kind: entityKind,
        apiVersion: 'backstage.io/v1alpha1'
      };

      const response = await fetch(`${this.baseUrl}/workloads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entity,
          auth: {}
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Group resources by type
      const workload: KubernetesWorkload = {
        deployments: [],
        pods: [],
        services: [],
        ingresses: [],
        configMaps: [],
        secrets: []
      };

      if (data.items) {
        for (const clusterResponse of data.items) {
          for (const resource of clusterResponse.resources || []) {
            switch (resource.type.toLowerCase()) {
              case 'deployment':
              case 'deployments':
                workload.deployments.push(resource);
                break;
              case 'pod':
              case 'pods':
                workload.pods.push(resource);
                break;
              case 'service':
              case 'services':
                workload.services.push(resource);
                break;
              case 'ingress':
              case 'ingresses':
                workload.ingresses.push(resource);
                break;
              case 'configmap':
              case 'configmaps':
                workload.configMaps.push(resource);
                break;
              case 'secret':
              case 'secrets':
                workload.secrets.push(resource);
                break;
            }
          }
        }
      }

      return workload;
    } catch (error) {
      console.error('Failed to fetch Kubernetes workloads for entity:', error);
      return {
        deployments: [],
        pods: [],
        services: [],
        ingresses: [],
        configMaps: [],
        secrets: []
      };
    }
  }

  /**
   * Get custom Kubernetes resources
   */
  async getCustomResourcesByEntity(
    entityName: string,
    customResources: Array<{
      group: string;
      apiVersion: string;
      plural: string;
    }>,
    entityKind: string = 'Component',
    entityNamespace: string = 'default'
  ): Promise<KubernetesEntityResponse[]> {
    try {
      const entity = {
        metadata: {
          name: entityName,
          namespace: entityNamespace,
        },
        kind: entityKind,
        apiVersion: 'backstage.io/v1alpha1'
      };

      const response = await fetch(`${this.baseUrl}/custom-resources`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entity,
          customResources,
          auth: {}
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error('Failed to fetch custom Kubernetes resources for entity:', error);
      return [];
    }
  }

  /**
   * Proxy request to Kubernetes cluster
   */
  async proxyRequest(
    clusterName: string,
    path: string,
    method: string = 'GET',
    body?: any
  ): Promise<Response> {
    const response = await fetch(`${this.baseUrl}/proxy/${clusterName}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      ...(body && { body: JSON.stringify(body) })
    });

    return response;
  }

  /**
   * Get cluster status and metrics
   */
  async getClusterMetrics(clusterName: string): Promise<any> {
    try {
      const response = await this.proxyRequest(
        clusterName,
        '/api/v1/nodes',
        'GET'
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch cluster metrics: ${response.statusText}`);
      }

      const nodes = await response.json();
      
      // Calculate basic cluster metrics
      const nodeCount = nodes.items?.length || 0;
      const readyNodes = nodes.items?.filter((node: any) =>
        node.status?.conditions?.find((c: any) => 
          c.type === 'Ready' && c.status === 'True'
        )
      ).length || 0;

      return {
        cluster: clusterName,
        nodes: {
          total: nodeCount,
          ready: readyNodes,
          notReady: nodeCount - readyNodes
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Failed to get cluster metrics for ${clusterName}:`, error);
      return {
        cluster: clusterName,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Create and export singleton instance
export const kubernetesClient = new KubernetesClient();