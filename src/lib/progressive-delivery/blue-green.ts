import { KubernetesApi, V1Deployment, V1Service } from '@kubernetes/client-node';
import { EventEmitter } from 'events';
import { ProgressiveDeployment, TrafficSplit } from './types';

export class BlueGreenDeploymentManager extends EventEmitter {
  private k8sApi: KubernetesApi;

  constructor(k8sApi: KubernetesApi) {
    super();
    this.k8sApi = k8sApi;
  }

  async initialize(deployment: ProgressiveDeployment): Promise<void> {
    const { service } = deployment.config;
    
    // Create blue (current) and green (new) deployments
    await this.createBlueDeployment(deployment);
    await this.createGreenDeployment(deployment);
    
    // Create services for blue-green routing
    await this.createBlueGreenServices(deployment);
    
    // Create Istio VirtualService for traffic routing
    await this.createTrafficRouting(deployment);
    
    this.emit('blueGreenInitialized', { deployment });
  }

  async pause(deployment: ProgressiveDeployment): Promise<void> {
    // Mark deployment as paused
    deployment.metadata.paused = true;
    
    this.emit('blueGreenPaused', { deployment });
  }

  async resume(deployment: ProgressiveDeployment): Promise<void> {
    // Resume deployment
    deployment.metadata.paused = false;
    
    this.emit('blueGreenResumed', { deployment });
  }

  async terminate(deployment: ProgressiveDeployment): Promise<void> {
    const { service } = deployment.config;
    
    // Clean up green deployment
    await this.cleanupGreenDeployment(deployment);
    
    // Ensure traffic is routed back to blue
    await this.routeTrafficToBlue(deployment);
    
    this.emit('blueGreenTerminated', { deployment });
  }

  async promote(deployment: ProgressiveDeployment): Promise<void> {
    const { service } = deployment.config;
    
    // Switch traffic to green (new version)
    await this.switchTrafficToGreen(deployment);
    
    // Wait for confirmation before cleanup
    await this.waitForConfirmation(deployment);
    
    // Clean up old blue deployment
    await this.cleanupBlueDeployment(deployment);
    
    // Rename green to blue for next deployment
    await this.promoteGreenToBlue(deployment);
    
    this.emit('blueGreenPromoted', { deployment });
  }

  async switchTrafficToPreview(deployment: ProgressiveDeployment): Promise<void> {
    // Route traffic to green for preview/testing
    await this.updateVirtualService(deployment, {
      blue: 0,
      green: 100,
      preview: true
    });
    
    this.emit('trafficSwitchedToPreview', { deployment });
  }

  async switchTrafficToProduction(deployment: ProgressiveDeployment): Promise<void> {
    // Switch production traffic to green
    await this.updateVirtualService(deployment, {
      blue: 0,
      green: 100,
      preview: false
    });
    
    this.emit('trafficSwitchedToProduction', { deployment });
  }

  async rollbackToBlue(deployment: ProgressiveDeployment): Promise<void> {
    // Immediately route all traffic back to blue
    await this.routeTrafficToBlue(deployment);
    
    this.emit('rolledBackToBlue', { deployment });
  }

  async getStatus(deployment: ProgressiveDeployment): Promise<any> {
    const { service } = deployment.config;
    
    const [blueDeployment, greenDeployment, virtualService] = await Promise.all([
      this.getBlueDeploymentStatus(deployment),
      this.getGreenDeploymentStatus(deployment),
      this.getVirtualServiceStatus(deployment)
    ]);
    
    return {
      blue: blueDeployment,
      green: greenDeployment,
      trafficSplit: virtualService?.trafficSplit,
      phase: deployment.phases[deployment.currentPhase]?.name || 'unknown'
    };
  }

  private async createBlueDeployment(deployment: ProgressiveDeployment): Promise<void> {
    const { service } = deployment.config;
    
    const blueDeployment: V1Deployment = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: `${service.name}-blue`,
        namespace: service.namespace,
        labels: {
          app: service.name,
          version: 'blue',
          'progressive-delivery/deployment': deployment.id
        }
      },
      spec: {
        replicas: 3,
        selector: {
          matchLabels: {
            app: service.name,
            version: 'blue'
          }
        },
        template: {
          metadata: {
            labels: {
              app: service.name,
              version: 'blue'
            }
          },
          spec: {
            containers: [{
              name: service.name,
              image: service.image.replace(service.version, 'stable'), // Current stable version
              ports: [{
                containerPort: service.port
              }],
              resources: {
                requests: {
                  cpu: '100m',
                  memory: '128Mi'
                },
                limits: {
                  cpu: '500m',
                  memory: '512Mi'
                }
              },
              livenessProbe: {
                httpGet: {
                  path: '/health',
                  port: service.port
                },
                initialDelaySeconds: 30,
                periodSeconds: 10,
                failureThreshold: 3
              },
              readinessProbe: {
                httpGet: {
                  path: '/ready',
                  port: service.port
                },
                initialDelaySeconds: 5,
                periodSeconds: 5,
                failureThreshold: 3
              }
            }]
          }
        }
      }
    };

    await this.k8sApi.createDeployment(service.namespace, blueDeployment);
    
    // Wait for blue deployment to be ready
    await this.waitForDeploymentReady(service.namespace, `${service.name}-blue`);
  }

  private async createGreenDeployment(deployment: ProgressiveDeployment): Promise<void> {
    const { service } = deployment.config;
    
    const greenDeployment: V1Deployment = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: `${service.name}-green`,
        namespace: service.namespace,
        labels: {
          app: service.name,
          version: 'green',
          'progressive-delivery/deployment': deployment.id
        }
      },
      spec: {
        replicas: 3,
        selector: {
          matchLabels: {
            app: service.name,
            version: 'green'
          }
        },
        template: {
          metadata: {
            labels: {
              app: service.name,
              version: 'green'
            }
          },
          spec: {
            containers: [{
              name: service.name,
              image: service.image, // New version
              ports: [{
                containerPort: service.port
              }],
              resources: {
                requests: {
                  cpu: '100m',
                  memory: '128Mi'
                },
                limits: {
                  cpu: '500m',
                  memory: '512Mi'
                }
              },
              livenessProbe: {
                httpGet: {
                  path: '/health',
                  port: service.port
                },
                initialDelaySeconds: 30,
                periodSeconds: 10,
                failureThreshold: 3
              },
              readinessProbe: {
                httpGet: {
                  path: '/ready',
                  port: service.port
                },
                initialDelaySeconds: 5,
                periodSeconds: 5,
                failureThreshold: 3
              }
            }]
          }
        }
      }
    };

    await this.k8sApi.createDeployment(service.namespace, greenDeployment);
    
    // Wait for green deployment to be ready before proceeding
    await this.waitForDeploymentReady(service.namespace, `${service.name}-green`);
  }

  private async createBlueGreenServices(deployment: ProgressiveDeployment): Promise<void> {
    const { service } = deployment.config;

    // Blue service
    const blueService: V1Service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: `${service.name}-blue`,
        namespace: service.namespace,
        labels: {
          app: service.name,
          version: 'blue'
        }
      },
      spec: {
        selector: {
          app: service.name,
          version: 'blue'
        },
        ports: [{
          name: 'http',
          port: service.port,
          targetPort: service.port,
          protocol: 'TCP'
        }],
        type: 'ClusterIP'
      }
    };

    // Green service  
    const greenService: V1Service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: `${service.name}-green`,
        namespace: service.namespace,
        labels: {
          app: service.name,
          version: 'green'
        }
      },
      spec: {
        selector: {
          app: service.name,
          version: 'green'
        },
        ports: [{
          name: 'http',
          port: service.port,
          targetPort: service.port,
          protocol: 'TCP'
        }],
        type: 'ClusterIP'
      }
    };

    // Preview service (for testing green before switching)
    const previewService: V1Service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: `${service.name}-preview`,
        namespace: service.namespace,
        labels: {
          app: service.name,
          version: 'preview'
        }
      },
      spec: {
        selector: {
          app: service.name,
          version: 'green'
        },
        ports: [{
          name: 'http',
          port: service.port,
          targetPort: service.port,
          protocol: 'TCP'
        }],
        type: 'ClusterIP'
      }
    };

    await Promise.all([
      this.k8sApi.createService(service.namespace, blueService),
      this.k8sApi.createService(service.namespace, greenService),
      this.k8sApi.createService(service.namespace, previewService)
    ]);
  }

  private async createTrafficRouting(deployment: ProgressiveDeployment): Promise<void> {
    const { service } = deployment.config;

    // Create Istio DestinationRule
    const destinationRule = {
      apiVersion: 'networking.istio.io/v1beta1',
      kind: 'DestinationRule',
      metadata: {
        name: `${service.name}-dr`,
        namespace: service.namespace
      },
      spec: {
        host: `${service.name}.${service.namespace}.svc.cluster.local`,
        subsets: [
          {
            name: 'blue',
            labels: {
              version: 'blue'
            }
          },
          {
            name: 'green',
            labels: {
              version: 'green'
            }
          }
        ]
      }
    };

    // Create Istio VirtualService (initially routes 100% to blue)
    const virtualService = {
      apiVersion: 'networking.istio.io/v1beta1',
      kind: 'VirtualService',
      metadata: {
        name: `${service.name}-vs`,
        namespace: service.namespace,
        labels: {
          'progressive-delivery/deployment': deployment.id
        }
      },
      spec: {
        hosts: [
          `${service.name}.${service.namespace}.svc.cluster.local`,
          service.name
        ],
        gateways: [`${service.name}-gateway`],
        http: [
          {
            name: 'primary',
            match: [{
              uri: {
                prefix: '/'
              }
            }],
            route: [
              {
                destination: {
                  host: `${service.name}.${service.namespace}.svc.cluster.local`,
                  subset: 'blue'
                },
                weight: 100
              },
              {
                destination: {
                  host: `${service.name}.${service.namespace}.svc.cluster.local`,
                  subset: 'green'
                },
                weight: 0
              }
            ],
            fault: {
              // Optional: Add fault injection for testing
            },
            timeout: '30s',
            retries: {
              attempts: 3,
              perTryTimeout: '10s'
            }
          },
          {
            name: 'preview',
            match: [{
              headers: {
                'x-preview': {
                  exact: 'true'
                }
              }
            }],
            route: [{
              destination: {
                host: `${service.name}.${service.namespace}.svc.cluster.local`,
                subset: 'green'
              }
            }]
          }
        ]
      }
    };

    await Promise.all([
      this.k8sApi.createCustomResource(destinationRule),
      this.k8sApi.createCustomResource(virtualService)
    ]);
  }

  private async updateVirtualService(deployment: ProgressiveDeployment, trafficSplit: { blue: number; green: number; preview?: boolean }): Promise<void> {
    const { service } = deployment.config;
    
    const virtualServiceUpdate = {
      spec: {
        http: [
          {
            name: 'primary',
            match: [{
              uri: {
                prefix: '/'
              }
            }],
            route: [
              {
                destination: {
                  host: `${service.name}.${service.namespace}.svc.cluster.local`,
                  subset: 'blue'
                },
                weight: trafficSplit.blue
              },
              {
                destination: {
                  host: `${service.name}.${service.namespace}.svc.cluster.local`,
                  subset: 'green'
                },
                weight: trafficSplit.green
              }
            ].filter(route => route.weight > 0), // Remove routes with 0 weight
            timeout: '30s',
            retries: {
              attempts: 3,
              perTryTimeout: '10s'
            }
          }
        ]
      }
    };

    // Add preview route if needed
    if (trafficSplit.preview) {
      virtualServiceUpdate.spec.http.push({
        name: 'preview',
        match: [{
          headers: {
            'x-preview': {
              exact: 'true'
            }
          }
        }],
        route: [{
          destination: {
            host: `${service.name}.${service.namespace}.svc.cluster.local`,
            subset: 'green'
          }
        }]
      });
    }

    await this.k8sApi.patchCustomResource(
      'networking.istio.io/v1beta1',
      'virtualservices',
      service.namespace,
      `${service.name}-vs`,
      virtualServiceUpdate
    );

    // Wait for traffic routing to take effect
    await this.sleep(5000);
  }

  private async switchTrafficToGreen(deployment: ProgressiveDeployment): Promise<void> {
    await this.updateVirtualService(deployment, {
      blue: 0,
      green: 100
    });

    this.emit('trafficSwitched', { deployment, target: 'green' });
  }

  private async routeTrafficToBlue(deployment: ProgressiveDeployment): Promise<void> {
    await this.updateVirtualService(deployment, {
      blue: 100,
      green: 0
    });

    this.emit('trafficSwitched', { deployment, target: 'blue' });
  }

  private async waitForConfirmation(deployment: ProgressiveDeployment): Promise<void> {
    // Wait for manual confirmation or automated validation
    const confirmationTimeout = deployment.config.approval?.timeout || '10m';
    const timeoutMs = this.parseTimeoutToMs(confirmationTimeout);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Confirmation timeout exceeded'));
      }, timeoutMs);
      
      // Listen for confirmation event
      this.once('confirmed', () => {
        clearTimeout(timeout);
        resolve();
      });
      
      // Auto-confirm if no manual approval required
      if (!deployment.config.approval.required) {
        setTimeout(() => {
          clearTimeout(timeout);
          resolve();
        }, 30000); // 30 second grace period
      }
    });
  }

  private async cleanupBlueDeployment(deployment: ProgressiveDeployment): Promise<void> {
    const { service } = deployment.config;
    
    // Delete blue deployment and service
    await Promise.all([
      this.k8sApi.deleteDeployment(service.namespace, `${service.name}-blue`),
      this.k8sApi.deleteService(service.namespace, `${service.name}-blue`)
    ]);
  }

  private async cleanupGreenDeployment(deployment: ProgressiveDeployment): Promise<void> {
    const { service } = deployment.config;
    
    // Delete green deployment and service
    await Promise.all([
      this.k8sApi.deleteDeployment(service.namespace, `${service.name}-green`),
      this.k8sApi.deleteService(service.namespace, `${service.name}-green`)
    ]);
  }

  private async promoteGreenToBlue(deployment: ProgressiveDeployment): Promise<void> {
    const { service } = deployment.config;
    
    // Update green deployment to be the new blue
    await this.k8sApi.patchDeployment(
      service.namespace,
      `${service.name}-green`,
      {
        metadata: {
          name: `${service.name}-blue`,
          labels: {
            app: service.name,
            version: 'blue'
          }
        },
        spec: {
          selector: {
            matchLabels: {
              app: service.name,
              version: 'blue'
            }
          },
          template: {
            metadata: {
              labels: {
                app: service.name,
                version: 'blue'
              }
            }
          }
        }
      }
    );
  }

  private async waitForDeploymentReady(namespace: string, name: string): Promise<void> {
    const maxWaitTime = 300000; // 5 minutes
    const checkInterval = 5000; // 5 seconds
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const deployment = await this.k8sApi.getDeployment(namespace, name);
        const status = deployment.body.status;
        
        if (status?.readyReplicas === status?.replicas && status?.replicas > 0) {
          return; // Deployment is ready
        }
        
        await this.sleep(checkInterval);
      } catch (error) {
        await this.sleep(checkInterval);
      }
    }
    
    throw new Error(`Deployment ${name} did not become ready within ${maxWaitTime}ms`);
  }

  private async getBlueDeploymentStatus(deployment: ProgressiveDeployment): Promise<any> {
    const { service } = deployment.config;
    
    try {
      const result = await this.k8sApi.getDeployment(service.namespace, `${service.name}-blue`);
      return result.body.status;
    } catch (error) {
      return null;
    }
  }

  private async getGreenDeploymentStatus(deployment: ProgressiveDeployment): Promise<any> {
    const { service } = deployment.config;
    
    try {
      const result = await this.k8sApi.getDeployment(service.namespace, `${service.name}-green`);
      return result.body.status;
    } catch (error) {
      return null;
    }
  }

  private async getVirtualServiceStatus(deployment: ProgressiveDeployment): Promise<any> {
    const { service } = deployment.config;
    
    try {
      const result = await this.k8sApi.getCustomResource(
        'networking.istio.io/v1beta1',
        'virtualservices',
        service.namespace,
        `${service.name}-vs`
      );
      
      const routes = result.spec.http[0].route;
      const trafficSplit = {
        blue: routes.find((r: any) => r.destination.subset === 'blue')?.weight || 0,
        green: routes.find((r: any) => r.destination.subset === 'green')?.weight || 0
      };
      
      return { trafficSplit };
    } catch (error) {
      return null;
    }
  }

  private parseTimeoutToMs(timeout: string): number {
    const match = timeout.match(/^(\d+)([smh])$/);
    if (!match) return 600000; // Default 10 minutes
    
    const [, value, unit] = match;
    const num = parseInt(value, 10);
    
    switch (unit) {
      case 's': return num * 1000;
      case 'm': return num * 60 * 1000;
      case 'h': return num * 60 * 60 * 1000;
      default: return 600000;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public method to confirm blue-green switch
  confirm(deploymentId: string): void {
    this.emit('confirmed', { deploymentId });
  }
}