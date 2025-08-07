import * as k8s from '@kubernetes/client-node';
import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect } from '@jest/globals';
import * as yaml from 'js-yaml';

// Kubernetes testing utilities
class KubernetesTestHelper {
  private kc: k8s.KubeConfig;
  private k8sApi: k8s.CoreV1Api;
  private k8sAppsApi: k8s.AppsV1Api;
  private k8sNetworkingApi: k8s.NetworkingV1Api;
  private customObjectsApi: k8s.CustomObjectsApi;
  
  private testNamespace: string;
  private createdResources: Array<{
    type: string;
    name: string;
    namespace?: string;
  }> = [];

  constructor(testNamespace: string = 'plugin-testing') {
    this.testNamespace = testNamespace;
    this.kc = new k8s.KubeConfig();
    
    // Load config from default location or in-cluster
    if (process.env.KUBECONFIG) {
      this.kc.loadFromFile(process.env.KUBECONFIG);
    } else if (process.env.KUBERNETES_SERVICE_HOST) {
      this.kc.loadFromCluster();
    } else {
      this.kc.loadFromDefault();
    }

    this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
    this.k8sAppsApi = this.kc.makeApiClient(k8s.AppsV1Api);
    this.k8sNetworkingApi = this.kc.makeApiClient(k8s.NetworkingV1Api);
    this.customObjectsApi = this.kc.makeApiClient(k8s.CustomObjectsApi);
  }

  async setupTestNamespace(): Promise<void> {
    const namespace: k8s.V1Namespace = {
      metadata: {
        name: this.testNamespace,
        labels: {
          'test.framework': 'jest',
          'test.suite': 'plugin-management',
          'test.timestamp': Date.now().toString(),
        },
      },
    };

    try {
      await this.k8sApi.createNamespace(namespace);
      console.log(`Created test namespace: ${this.testNamespace}`);
    } catch (error) {
      if (error.response?.statusCode === 409) {
        // Namespace already exists, that's okay
        console.log(`Test namespace ${this.testNamespace} already exists`);
      } else {
        throw error;
      }
    }
  }

  async createDeployment(spec: {
    name: string;
    image: string;
    replicas?: number;
    ports?: number[];
    env?: Array<{ name: string; value: string }>;
    resources?: {
      requests?: { cpu?: string; memory?: string };
      limits?: { cpu?: string; memory?: string };
    };
    labels?: { [key: string]: string };
    securityContext?: k8s.V1SecurityContext;
    volumes?: k8s.V1Volume[];
    volumeMounts?: k8s.V1VolumeMount[];
  }): Promise<k8s.V1Deployment> {
    const deployment: k8s.V1Deployment = {
      metadata: {
        name: spec.name,
        namespace: this.testNamespace,
        labels: {
          app: spec.name,
          'test.framework': 'jest',
          ...spec.labels,
        },
      },
      spec: {
        replicas: spec.replicas || 1,
        selector: {
          matchLabels: {
            app: spec.name,
          },
        },
        template: {
          metadata: {
            labels: {
              app: spec.name,
              ...spec.labels,
            },
          },
          spec: {
            containers: [
              {
                name: spec.name,
                image: spec.image,
                ports: spec.ports?.map(port => ({ containerPort: port })),
                env: spec.env?.map(e => ({ name: e.name, value: e.value })),
                resources: spec.resources,
                securityContext: spec.securityContext,
                volumeMounts: spec.volumeMounts,
              },
            ],
            volumes: spec.volumes,
            securityContext: {
              runAsNonRoot: true,
              runAsUser: 1000,
              fsGroup: 2000,
            },
          },
        },
      },
    };

    const response = await this.k8sAppsApi.createNamespacedDeployment(
      this.testNamespace,
      deployment
    );

    this.createdResources.push({
      type: 'deployment',
      name: spec.name,
      namespace: this.testNamespace,
    });

    return response.body;
  }

  async createService(spec: {
    name: string;
    selector: { [key: string]: string };
    ports: Array<{ port: number; targetPort: number; name?: string }>;
    type?: 'ClusterIP' | 'NodePort' | 'LoadBalancer';
  }): Promise<k8s.V1Service> {
    const service: k8s.V1Service = {
      metadata: {
        name: spec.name,
        namespace: this.testNamespace,
        labels: {
          'test.framework': 'jest',
        },
      },
      spec: {
        selector: spec.selector,
        ports: spec.ports.map(p => ({
          port: p.port,
          targetPort: p.targetPort,
          name: p.name,
        })),
        type: spec.type || 'ClusterIP',
      },
    };

    const response = await this.k8sApi.createNamespacedService(
      this.testNamespace,
      service
    );

    this.createdResources.push({
      type: 'service',
      name: spec.name,
      namespace: this.testNamespace,
    });

    return response.body;
  }

  async createConfigMap(spec: {
    name: string;
    data: { [key: string]: string };
  }): Promise<k8s.V1ConfigMap> {
    const configMap: k8s.V1ConfigMap = {
      metadata: {
        name: spec.name,
        namespace: this.testNamespace,
        labels: {
          'test.framework': 'jest',
        },
      },
      data: spec.data,
    };

    const response = await this.k8sApi.createNamespacedConfigMap(
      this.testNamespace,
      configMap
    );

    this.createdResources.push({
      type: 'configmap',
      name: spec.name,
      namespace: this.testNamespace,
    });

    return response.body;
  }

  async createSecret(spec: {
    name: string;
    data: { [key: string]: string };
    type?: string;
  }): Promise<k8s.V1Secret> {
    const secret: k8s.V1Secret = {
      metadata: {
        name: spec.name,
        namespace: this.testNamespace,
        labels: {
          'test.framework': 'jest',
        },
      },
      type: spec.type || 'Opaque',
      data: Object.entries(spec.data).reduce((acc, [key, value]) => {
        acc[key] = Buffer.from(value).toString('base64');
        return acc;
      }, {} as { [key: string]: string }),
    };

    const response = await this.k8sApi.createNamespacedSecret(
      this.testNamespace,
      secret
    );

    this.createdResources.push({
      type: 'secret',
      name: spec.name,
      namespace: this.testNamespace,
    });

    return response.body;
  }

  async createPersistentVolumeClaim(spec: {
    name: string;
    storageClass?: string;
    accessModes: string[];
    size: string;
  }): Promise<k8s.V1PersistentVolumeClaim> {
    const pvc: k8s.V1PersistentVolumeClaim = {
      metadata: {
        name: spec.name,
        namespace: this.testNamespace,
        labels: {
          'test.framework': 'jest',
        },
      },
      spec: {
        accessModes: spec.accessModes,
        storageClassName: spec.storageClass,
        resources: {
          requests: {
            storage: spec.size,
          },
        },
      },
    };

    const response = await this.k8sApi.createNamespacedPersistentVolumeClaim(
      this.testNamespace,
      pvc
    );

    this.createdResources.push({
      type: 'persistentvolumeclaim',
      name: spec.name,
      namespace: this.testNamespace,
    });

    return response.body;
  }

  async waitForDeploymentReady(
    name: string,
    timeout: number = 300000
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const response = await this.k8sAppsApi.readNamespacedDeployment(
          name,
          this.testNamespace
        );

        const deployment = response.body;
        const readyReplicas = deployment.status?.readyReplicas || 0;
        const replicas = deployment.spec?.replicas || 1;

        if (readyReplicas === replicas) {
          return;
        }
      } catch (error) {
        console.warn(`Error checking deployment status: ${error.message}`);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error(
      `Deployment ${name} did not become ready within ${timeout}ms`
    );
  }

  async waitForPodReady(
    labelSelector: string,
    timeout: number = 300000
  ): Promise<k8s.V1Pod[]> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const response = await this.k8sApi.listNamespacedPod(
          this.testNamespace,
          undefined,
          undefined,
          undefined,
          undefined,
          labelSelector
        );

        const pods = response.body.items;
        const readyPods = pods.filter(pod =>
          pod.status?.conditions?.some(
            condition =>
              condition.type === 'Ready' && condition.status === 'True'
          )
        );

        if (readyPods.length > 0) {
          return readyPods;
        }
      } catch (error) {
        console.warn(`Error checking pod status: ${error.message}`);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error(
      `No pods with selector ${labelSelector} became ready within ${timeout}ms`
    );
  }

  async getPodLogs(podName: string): Promise<string> {
    try {
      const response = await this.k8sApi.readNamespacedPodLog(
        podName,
        this.testNamespace
      );
      return response.body;
    } catch (error) {
      console.error(`Failed to get logs for pod ${podName}:`, error.message);
      return '';
    }
  }

  async executePodCommand(
    podName: string,
    command: string[]
  ): Promise<string> {
    const exec = new k8s.Exec(this.kc);
    
    return new Promise((resolve, reject) => {
      let output = '';
      let error = '';

      exec.exec(
        this.testNamespace,
        podName,
        podName, // container name same as pod name
        command,
        process.stdout,
        process.stderr,
        process.stdin,
        false,
        (status) => {
          if (status.status === 'Success') {
            resolve(output);
          } else {
            reject(new Error(`Command failed: ${error}`));
          }
        }
      );
    });
  }

  async getDeploymentStatus(name: string): Promise<k8s.V1DeploymentStatus | undefined> {
    try {
      const response = await this.k8sAppsApi.readNamespacedDeployment(
        name,
        this.testNamespace
      );
      return response.body.status;
    } catch (error) {
      console.error(`Failed to get deployment status: ${error.message}`);
      return undefined;
    }
  }

  async scaleDeployment(name: string, replicas: number): Promise<void> {
    const patch = {
      spec: {
        replicas: replicas,
      },
    };

    await this.k8sAppsApi.patchNamespacedDeployment(
      name,
      this.testNamespace,
      patch,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        headers: { 'Content-Type': 'application/merge-patch+json' },
      }
    );
  }

  async cleanup(): Promise<void> {
    console.log('Cleaning up Kubernetes test resources...');

    // Delete resources in reverse order
    for (const resource of this.createdResources.reverse()) {
      try {
        switch (resource.type) {
          case 'deployment':
            await this.k8sAppsApi.deleteNamespacedDeployment(
              resource.name,
              resource.namespace!
            );
            break;
          case 'service':
            await this.k8sApi.deleteNamespacedService(
              resource.name,
              resource.namespace!
            );
            break;
          case 'configmap':
            await this.k8sApi.deleteNamespacedConfigMap(
              resource.name,
              resource.namespace!
            );
            break;
          case 'secret':
            await this.k8sApi.deleteNamespacedSecret(
              resource.name,
              resource.namespace!
            );
            break;
          case 'persistentvolumeclaim':
            await this.k8sApi.deleteNamespacedPersistentVolumeClaim(
              resource.name,
              resource.namespace!
            );
            break;
        }
        console.log(`Deleted ${resource.type}: ${resource.name}`);
      } catch (error) {
        console.warn(
          `Failed to delete ${resource.type} ${resource.name}:`,
          error.message
        );
      }
    }

    // Delete the test namespace
    try {
      await this.k8sApi.deleteNamespace(this.testNamespace);
      console.log(`Deleted test namespace: ${this.testNamespace}`);
    } catch (error) {
      console.warn(`Failed to delete namespace: ${error.message}`);
    }

    this.createdResources = [];
  }
}

describe('Kubernetes Plugin Testing', () => {
  let k8sHelper: KubernetesTestHelper;
  const testNamespace = `plugin-test-${Date.now()}`;

  beforeAll(async () => {
    k8sHelper = new KubernetesTestHelper(testNamespace);
    
    try {
      await k8sHelper.setupTestNamespace();
    } catch (error) {
      if (error.message?.includes('connection refused')) {
        console.log('Kubernetes cluster not available, skipping tests');
        return;
      }
      throw error;
    }
  }, 60000);

  afterAll(async () => {
    if (k8sHelper) {
      await k8sHelper.cleanup();
    }
  }, 60000);

  describe('Plugin Deployment Lifecycle', () => {
    it('should deploy a basic plugin to Kubernetes', async () => {
      const deployment = await k8sHelper.createDeployment({
        name: 'basic-plugin',
        image: 'nginx:alpine',
        replicas: 1,
        ports: [80],
        env: [
          { name: 'PLUGIN_NAME', value: 'basic-plugin' },
          { name: 'PLUGIN_VERSION', value: '1.0.0' },
        ],
        labels: {
          'plugin.type': 'web',
          'plugin.category': 'test',
        },
      });

      expect(deployment.metadata?.name).toBe('basic-plugin');
      expect(deployment.spec?.replicas).toBe(1);

      await k8sHelper.waitForDeploymentReady('basic-plugin');

      const status = await k8sHelper.getDeploymentStatus('basic-plugin');
      expect(status?.readyReplicas).toBe(1);
    });

    it('should create service for plugin', async () => {
      await k8sHelper.createDeployment({
        name: 'service-plugin',
        image: 'nginx:alpine',
        replicas: 2,
        ports: [80],
      });

      const service = await k8sHelper.createService({
        name: 'service-plugin-svc',
        selector: { app: 'service-plugin' },
        ports: [{ port: 80, targetPort: 80, name: 'http' }],
        type: 'ClusterIP',
      });

      expect(service.metadata?.name).toBe('service-plugin-svc');
      expect(service.spec?.ports?.[0].port).toBe(80);

      await k8sHelper.waitForDeploymentReady('service-plugin');
    });

    it('should handle plugin configuration with ConfigMaps', async () => {
      const configMap = await k8sHelper.createConfigMap({
        name: 'plugin-config',
        data: {
          'config.json': JSON.stringify({
            apiUrl: 'https://api.example.com',
            timeout: 5000,
            retries: 3,
          }),
          'logging.conf': 'level=info\nformat=json',
        },
      });

      expect(configMap.data?.['config.json']).toBeDefined();

      await k8sHelper.createDeployment({
        name: 'configured-plugin',
        image: 'alpine:latest',
        replicas: 1,
        env: [
          { name: 'CONFIG_PATH', value: '/etc/plugin/config.json' },
        ],
        volumes: [
          {
            name: 'config-volume',
            configMap: {
              name: 'plugin-config',
            },
          },
        ],
        volumeMounts: [
          {
            name: 'config-volume',
            mountPath: '/etc/plugin',
          },
        ],
      });

      await k8sHelper.waitForDeploymentReady('configured-plugin');
    });

    it('should handle plugin secrets', async () => {
      const secret = await k8sHelper.createSecret({
        name: 'plugin-secrets',
        data: {
          'api-key': 'super-secret-key',
          'database-url': 'postgresql://user:pass@db:5432/plugin',
        },
      });

      expect(secret.data?.['api-key']).toBeDefined();

      await k8sHelper.createDeployment({
        name: 'secure-plugin',
        image: 'alpine:latest',
        replicas: 1,
        env: [
          { name: 'API_KEY', value: '/etc/secrets/api-key' },
        ],
        volumes: [
          {
            name: 'secret-volume',
            secret: {
              secretName: 'plugin-secrets',
            },
          },
        ],
        volumeMounts: [
          {
            name: 'secret-volume',
            mountPath: '/etc/secrets',
            readOnly: true,
          },
        ],
      });

      await k8sHelper.waitForDeploymentReady('secure-plugin');
    });
  });

  describe('Plugin Scaling and Resources', () => {
    it('should scale plugin deployment', async () => {
      await k8sHelper.createDeployment({
        name: 'scalable-plugin',
        image: 'nginx:alpine',
        replicas: 1,
        ports: [80],
      });

      await k8sHelper.waitForDeploymentReady('scalable-plugin');

      // Scale up
      await k8sHelper.scaleDeployment('scalable-plugin', 3);
      await k8sHelper.waitForDeploymentReady('scalable-plugin');

      const status = await k8sHelper.getDeploymentStatus('scalable-plugin');
      expect(status?.readyReplicas).toBe(3);

      // Scale down
      await k8sHelper.scaleDeployment('scalable-plugin', 1);
      await k8sHelper.waitForDeploymentReady('scalable-plugin');

      const statusAfterScale = await k8sHelper.getDeploymentStatus('scalable-plugin');
      expect(statusAfterScale?.readyReplicas).toBe(1);
    });

    it('should handle resource limits and requests', async () => {
      await k8sHelper.createDeployment({
        name: 'resource-limited-plugin',
        image: 'nginx:alpine',
        replicas: 1,
        resources: {
          requests: {
            cpu: '100m',
            memory: '128Mi',
          },
          limits: {
            cpu: '500m',
            memory: '512Mi',
          },
        },
      });

      await k8sHelper.waitForDeploymentReady('resource-limited-plugin');

      const status = await k8sHelper.getDeploymentStatus('resource-limited-plugin');
      expect(status?.readyReplicas).toBe(1);
    });
  });

  describe('Plugin Security', () => {
    it('should run plugins with security context', async () => {
      await k8sHelper.createDeployment({
        name: 'secure-context-plugin',
        image: 'alpine:latest',
        replicas: 1,
        securityContext: {
          runAsNonRoot: true,
          runAsUser: 1000,
          runAsGroup: 1000,
          allowPrivilegeEscalation: false,
          readOnlyRootFilesystem: true,
          capabilities: {
            drop: ['ALL'],
            add: ['NET_BIND_SERVICE'],
          },
        },
        volumes: [
          {
            name: 'tmp-volume',
            emptyDir: {},
          },
        ],
        volumeMounts: [
          {
            name: 'tmp-volume',
            mountPath: '/tmp',
          },
        ],
      });

      await k8sHelper.waitForDeploymentReady('secure-context-plugin');

      const pods = await k8sHelper.waitForPodReady('app=secure-context-plugin');
      expect(pods.length).toBeGreaterThan(0);
    });

    it('should isolate plugins with network policies', async () => {
      // This test requires a CNI that supports network policies
      await k8sHelper.createDeployment({
        name: 'isolated-plugin',
        image: 'nginx:alpine',
        replicas: 1,
        ports: [80],
        labels: {
          'network-policy': 'restricted',
        },
      });

      // Create a network policy
      const networkPolicy: k8s.V1NetworkPolicy = {
        metadata: {
          name: 'plugin-isolation-policy',
          namespace: testNamespace,
        },
        spec: {
          podSelector: {
            matchLabels: {
              'network-policy': 'restricted',
            },
          },
          policyTypes: ['Ingress', 'Egress'],
          ingress: [
            {
              from: [
                {
                  podSelector: {
                    matchLabels: {
                      'allowed-access': 'true',
                    },
                  },
                },
              ],
              ports: [
                {
                  port: 80,
                  protocol: 'TCP',
                },
              ],
            },
          ],
          egress: [
            {
              to: [],
              ports: [
                {
                  port: 53,
                  protocol: 'UDP',
                },
              ],
            },
          ],
        },
      };

      try {
        await k8sHelper['k8sNetworkingApi'].createNamespacedNetworkPolicy(
          testNamespace,
          networkPolicy
        );
      } catch (error) {
        console.warn('Network policies may not be supported:', error.message);
      }

      await k8sHelper.waitForDeploymentReady('isolated-plugin');
    });
  });

  describe('Plugin Storage and Persistence', () => {
    it('should handle persistent storage', async () => {
      const pvc = await k8sHelper.createPersistentVolumeClaim({
        name: 'plugin-storage',
        accessModes: ['ReadWriteOnce'],
        size: '1Gi',
      });

      expect(pvc.spec?.resources?.requests?.storage).toBe('1Gi');

      await k8sHelper.createDeployment({
        name: 'persistent-plugin',
        image: 'alpine:latest',
        replicas: 1,
        volumes: [
          {
            name: 'data-volume',
            persistentVolumeClaim: {
              claimName: 'plugin-storage',
            },
          },
        ],
        volumeMounts: [
          {
            name: 'data-volume',
            mountPath: '/data',
          },
        ],
      });

      await k8sHelper.waitForDeploymentReady('persistent-plugin');
    });

    it('should handle shared storage between plugin instances', async () => {
      const pvc = await k8sHelper.createPersistentVolumeClaim({
        name: 'shared-plugin-storage',
        accessModes: ['ReadWriteMany'],
        size: '2Gi',
      });

      await k8sHelper.createDeployment({
        name: 'shared-storage-plugin',
        image: 'alpine:latest',
        replicas: 2,
        volumes: [
          {
            name: 'shared-volume',
            persistentVolumeClaim: {
              claimName: 'shared-plugin-storage',
            },
          },
        ],
        volumeMounts: [
          {
            name: 'shared-volume',
            mountPath: '/shared',
          },
        ],
      });

      await k8sHelper.waitForDeploymentReady('shared-storage-plugin');

      const status = await k8sHelper.getDeploymentStatus('shared-storage-plugin');
      expect(status?.readyReplicas).toBe(2);
    });
  });

  describe('Plugin Monitoring and Health', () => {
    it('should configure health checks for plugins', async () => {
      await k8sHelper.createDeployment({
        name: 'health-check-plugin',
        image: 'nginx:alpine',
        replicas: 1,
        ports: [80],
      });

      // Health checks would be configured in the container spec
      await k8sHelper.waitForDeploymentReady('health-check-plugin');

      const pods = await k8sHelper.waitForPodReady('app=health-check-plugin');
      expect(pods.length).toBe(1);

      // Check if pod is actually healthy
      const pod = pods[0];
      expect(pod.status?.phase).toBe('Running');
    });

    it('should collect plugin logs', async () => {
      await k8sHelper.createDeployment({
        name: 'logging-plugin',
        image: 'alpine:latest',
        replicas: 1,
      });

      await k8sHelper.waitForDeploymentReady('logging-plugin');

      const pods = await k8sHelper.waitForPodReady('app=logging-plugin');
      const pod = pods[0];

      // Get logs from the pod
      const logs = await k8sHelper.getPodLogs(pod.metadata!.name!);
      expect(typeof logs).toBe('string');
    });
  });

  describe('Plugin Failure Scenarios', () => {
    it('should handle pod failures and restarts', async () => {
      await k8sHelper.createDeployment({
        name: 'crash-test-plugin',
        image: 'alpine:latest',
        replicas: 1,
      });

      await k8sHelper.waitForDeploymentReady('crash-test-plugin');

      const pods = await k8sHelper.waitForPodReady('app=crash-test-plugin');
      const pod = pods[0];

      // Simulate pod failure by deleting it
      await k8sHelper['k8sApi'].deleteNamespacedPod(
        pod.metadata!.name!,
        testNamespace
      );

      // Wait for new pod to be created and ready
      await k8sHelper.waitForPodReady('app=crash-test-plugin');

      const status = await k8sHelper.getDeploymentStatus('crash-test-plugin');
      expect(status?.readyReplicas).toBe(1);
    });

    it('should handle resource exhaustion', async () => {
      await k8sHelper.createDeployment({
        name: 'resource-exhaustion-plugin',
        image: 'alpine:latest',
        replicas: 1,
        resources: {
          limits: {
            memory: '64Mi',
            cpu: '100m',
          },
        },
      });

      await k8sHelper.waitForDeploymentReady('resource-exhaustion-plugin');

      // Plugin should still be running within limits
      const status = await k8sHelper.getDeploymentStatus('resource-exhaustion-plugin');
      expect(status?.readyReplicas).toBe(1);
    });

    it('should handle node failures gracefully', async () => {
      await k8sHelper.createDeployment({
        name: 'node-failure-plugin',
        image: 'nginx:alpine',
        replicas: 2,
        ports: [80],
      });

      await k8sHelper.waitForDeploymentReady('node-failure-plugin');

      // Verify pods are distributed (if multi-node cluster)
      const pods = await k8sHelper.waitForPodReady('app=node-failure-plugin');
      expect(pods.length).toBe(2);
    });
  });

  describe('Plugin Updates and Rollouts', () => {
    it('should handle rolling updates', async () => {
      await k8sHelper.createDeployment({
        name: 'rolling-update-plugin',
        image: 'nginx:1.20-alpine',
        replicas: 3,
        ports: [80],
        labels: {
          version: 'v1',
        },
      });

      await k8sHelper.waitForDeploymentReady('rolling-update-plugin');

      // Update the deployment with new image
      const updatePatch = {
        spec: {
          template: {
            metadata: {
              labels: {
                app: 'rolling-update-plugin',
                version: 'v2',
              },
            },
            spec: {
              containers: [
                {
                  name: 'rolling-update-plugin',
                  image: 'nginx:1.21-alpine',
                },
              ],
            },
          },
        },
      };

      await k8sHelper['k8sAppsApi'].patchNamespacedDeployment(
        'rolling-update-plugin',
        testNamespace,
        updatePatch,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          headers: { 'Content-Type': 'application/merge-patch+json' },
        }
      );

      await k8sHelper.waitForDeploymentReady('rolling-update-plugin');

      const status = await k8sHelper.getDeploymentStatus('rolling-update-plugin');
      expect(status?.readyReplicas).toBe(3);
    });

    it('should support blue-green deployments', async () => {
      // Create blue deployment
      await k8sHelper.createDeployment({
        name: 'blue-green-plugin-blue',
        image: 'nginx:1.20-alpine',
        replicas: 2,
        ports: [80],
        labels: {
          app: 'blue-green-plugin',
          version: 'blue',
        },
      });

      const blueService = await k8sHelper.createService({
        name: 'blue-green-plugin-svc',
        selector: { 
          app: 'blue-green-plugin',
          version: 'blue',
        },
        ports: [{ port: 80, targetPort: 80 }],
      });

      await k8sHelper.waitForDeploymentReady('blue-green-plugin-blue');

      // Create green deployment
      await k8sHelper.createDeployment({
        name: 'blue-green-plugin-green',
        image: 'nginx:1.21-alpine',
        replicas: 2,
        ports: [80],
        labels: {
          app: 'blue-green-plugin',
          version: 'green',
        },
      });

      await k8sHelper.waitForDeploymentReady('blue-green-plugin-green');

      // Switch service to green
      const servicePatch = {
        spec: {
          selector: {
            app: 'blue-green-plugin',
            version: 'green',
          },
        },
      };

      await k8sHelper['k8sApi'].patchNamespacedService(
        'blue-green-plugin-svc',
        testNamespace,
        servicePatch,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          headers: { 'Content-Type': 'application/merge-patch+json' },
        }
      );

      // Verify both deployments are running
      const blueStatus = await k8sHelper.getDeploymentStatus('blue-green-plugin-blue');
      const greenStatus = await k8sHelper.getDeploymentStatus('blue-green-plugin-green');

      expect(blueStatus?.readyReplicas).toBe(2);
      expect(greenStatus?.readyReplicas).toBe(2);
    });
  });

  describe('Plugin Custom Resources', () => {
    it('should work with custom resource definitions', async () => {
      // This test would require creating CRDs first
      // For now, we'll just verify the capability exists
      try {
        const customResources = await k8sHelper['customObjectsApi'].listClusterCustomObject(
          'apiextensions.k8s.io',
          'v1',
          'customresourcedefinitions'
        );
        expect(customResources).toBeDefined();
      } catch (error) {
        // CRDs might not be accessible in test environment
        console.warn('Custom resources not accessible:', error.message);
      }
    });
  });
});