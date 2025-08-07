import { KubernetesApi, V1Deployment, V1Service } from '@kubernetes/client-node';
import { EventEmitter } from 'events';
import {
  ProgressiveDeployment,
  FlaggerCanary,
  ArgoRollout,
  AnalysisTemplate,
  MetricQuery,
  TrafficSplit
} from './types';

export class CanaryDeploymentManager extends EventEmitter {
  private k8sApi: KubernetesApi;
  private flaggerEnabled: boolean;
  private argoEnabled: boolean;

  constructor(k8sApi: KubernetesApi) {
    super();
    this.k8sApi = k8sApi;
    this.flaggerEnabled = process.env.FLAGGER_ENABLED === 'true';
    this.argoEnabled = process.env.ARGO_ROLLOUTS_ENABLED === 'true';
  }

  async initialize(deployment: ProgressiveDeployment): Promise<void> {
    const { service, analysis } = deployment.config;
    
    // Create analysis templates
    const analysisTemplate = await this.createAnalysisTemplate(deployment);
    
    if (this.flaggerEnabled) {
      await this.createFlaggerCanary(deployment, analysisTemplate);
    } else if (this.argoEnabled) {
      await this.createArgoRollout(deployment, analysisTemplate);
    } else {
      await this.createNativeCanary(deployment);
    }
    
    this.emit('canaryInitialized', { deployment });
  }

  async pause(deployment: ProgressiveDeployment): Promise<void> {
    if (this.flaggerEnabled) {
      await this.pauseFlaggerCanary(deployment);
    } else if (this.argoEnabled) {
      await this.pauseArgoRollout(deployment);
    } else {
      await this.pauseNativeCanary(deployment);
    }
    
    this.emit('canaryPaused', { deployment });
  }

  async resume(deployment: ProgressiveDeployment): Promise<void> {
    if (this.flaggerEnabled) {
      await this.resumeFlaggerCanary(deployment);
    } else if (this.argoEnabled) {
      await this.resumeArgoRollout(deployment);
    } else {
      await this.resumeNativeCanary(deployment);
    }
    
    this.emit('canaryResumed', { deployment });
  }

  async terminate(deployment: ProgressiveDeployment): Promise<void> {
    if (this.flaggerEnabled) {
      await this.terminateFlaggerCanary(deployment);
    } else if (this.argoEnabled) {
      await this.terminateArgoRollout(deployment);
    } else {
      await this.terminateNativeCanary(deployment);
    }
    
    this.emit('canaryTerminated', { deployment });
  }

  async promote(deployment: ProgressiveDeployment): Promise<void> {
    if (this.flaggerEnabled) {
      await this.promoteFlaggerCanary(deployment);
    } else if (this.argoEnabled) {
      await this.promoteArgoRollout(deployment);
    } else {
      await this.promoteNativeCanary(deployment);
    }
    
    this.emit('canaryPromoted', { deployment });
  }

  async getStatus(deployment: ProgressiveDeployment): Promise<any> {
    if (this.flaggerEnabled) {
      return this.getFlaggerStatus(deployment);
    } else if (this.argoEnabled) {
      return this.getArgoRolloutStatus(deployment);
    } else {
      return this.getNativeCanaryStatus(deployment);
    }
  }

  private async createAnalysisTemplate(deployment: ProgressiveDeployment): Promise<AnalysisTemplate> {
    const { service, analysis } = deployment.config;
    
    const template: AnalysisTemplate = {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'AnalysisTemplate',
      metadata: {
        name: `${service.name}-analysis`,
        namespace: service.namespace,
        labels: {
          'progressive-delivery/deployment': deployment.id,
          'progressive-delivery/service': service.name
        }
      },
      spec: {
        args: [
          {
            name: 'service-name',
            value: service.name
          },
          {
            name: 'canary-hash',
            valueFrom: {
              podTemplateHashValue: 'Latest'
            }
          }
        ],
        metrics: analysis.metrics.map(metric => this.convertMetricToAnalysisMetric(metric))
      }
    };

    // Create the analysis template in Kubernetes
    await this.k8sApi.createCustomResource(template);
    
    return template;
  }

  private convertMetricToAnalysisMetric(metric: MetricQuery): any {
    const analysisMetric: any = {
      name: metric.name,
      interval: metric.interval,
      failureLimit: 3,
      consecutiveErrorLimit: 2,
    };

    switch (metric.provider) {
      case 'prometheus':
        analysisMetric.provider = {
          prometheus: {
            address: process.env.PROMETHEUS_URL || 'http://prometheus.monitoring.svc.cluster.local:9090',
            query: metric.query
          }
        };
        break;
      
      case 'datadog':
        analysisMetric.provider = {
          datadog: {
            address: process.env.DATADOG_API_URL || 'https://api.datadoghq.com',
            query: metric.query,
            apiKey: process.env.DATADOG_API_KEY!,
            appKey: process.env.DATADOG_APP_KEY!
          }
        };
        break;
      
      case 'newrelic':
        analysisMetric.provider = {
          newRelic: {
            profile: 'default',
            query: metric.query
          }
        };
        break;
      
      default:
        // Custom webhook provider
        analysisMetric.provider = {
          web: {
            url: `${process.env.METRICS_WEBHOOK_URL}/metrics/${metric.name}`,
            headers: [
              {
                key: 'Authorization',
                value: `Bearer ${process.env.METRICS_API_TOKEN}`
              }
            ],
            jsonPath: '$.value'
          }
        };
    }

    // Set success/failure conditions based on threshold and comparison
    const thresholdValue = metric.threshold;
    switch (metric.comparison) {
      case '>':
        analysisMetric.successCondition = `result > ${thresholdValue}`;
        analysisMetric.failureCondition = `result <= ${thresholdValue}`;
        break;
      case '<':
        analysisMetric.successCondition = `result < ${thresholdValue}`;
        analysisMetric.failureCondition = `result >= ${thresholdValue}`;
        break;
      case '>=':
        analysisMetric.successCondition = `result >= ${thresholdValue}`;
        analysisMetric.failureCondition = `result < ${thresholdValue}`;
        break;
      case '<=':
        analysisMetric.successCondition = `result <= ${thresholdValue}`;
        analysisMetric.failureCondition = `result > ${thresholdValue}`;
        break;
      case '==':
        analysisMetric.successCondition = `result == ${thresholdValue}`;
        analysisMetric.failureCondition = `result != ${thresholdValue}`;
        break;
    }

    return analysisMetric;
  }

  private async createFlaggerCanary(deployment: ProgressiveDeployment, analysisTemplate: AnalysisTemplate): Promise<void> {
    const { service, traffic, analysis } = deployment.config;
    
    const canary: FlaggerCanary = {
      apiVersion: 'flagger.app/v1beta1',
      kind: 'Canary',
      metadata: {
        name: service.name,
        namespace: service.namespace,
        labels: {
          'progressive-delivery/deployment': deployment.id
        }
      },
      spec: {
        targetRef: {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          name: service.name
        },
        service: {
          port: service.port,
          targetPort: service.port,
          gateways: [`${service.namespace}/${service.name}-gateway`],
          hosts: [`${service.name}.${service.namespace}.svc.cluster.local`]
        },
        analysis: {
          interval: analysis.interval,
          threshold: Math.floor(analysis.threshold * 100), // Convert to percentage
          maxWeight: traffic.maxWeight,
          stepWeight: traffic.stepWeight,
          stepWeightPromotion: traffic.stepWeightPromotion || traffic.stepWeight,
          metrics: analysis.metrics.map(metric => ({
            name: metric.name,
            interval: metric.interval,
            thresholdRange: {
              max: metric.threshold
            }
          }))
        }
      }
    };

    await this.k8sApi.createCustomResource(canary);
  }

  private async createArgoRollout(deployment: ProgressiveDeployment, analysisTemplate: AnalysisTemplate): Promise<void> {
    const { service, traffic, analysis } = deployment.config;
    
    // Generate canary steps
    const steps = [];
    for (let weight = traffic.stepWeight; weight <= traffic.maxWeight; weight += traffic.stepWeight) {
      steps.push(
        {
          setWeight: weight
        },
        {
          pause: {
            duration: analysis.interval
          }
        },
        {
          analysis: {
            templates: [{
              templateName: analysisTemplate.metadata.name
            }]
          }
        }
      );
    }

    const rollout: ArgoRollout = {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'Rollout',
      metadata: {
        name: service.name,
        namespace: service.namespace,
        labels: {
          'progressive-delivery/deployment': deployment.id
        }
      },
      spec: {
        replicas: 3, // Default replica count
        strategy: {
          canary: {
            maxSurge: '25%',
            maxUnavailable: 1,
            steps,
            canaryService: `${service.name}-canary`,
            stableService: `${service.name}-stable`,
            trafficRouting: {
              istio: {
                virtualService: {
                  name: `${service.name}-vs`,
                  routes: ['primary']
                },
                destinationRule: {
                  name: `${service.name}-dr`,
                  canarySubsetName: 'canary',
                  stableSubsetName: 'stable'
                }
              }
            },
            analysis: {
              templates: [{
                templateName: analysisTemplate.metadata.name
              }]
            }
          }
        },
        selector: {
          matchLabels: {
            app: service.name,
            version: service.version
          }
        },
        template: {
          metadata: {
            labels: {
              app: service.name,
              version: service.version
            }
          },
          spec: {
            containers: [{
              name: service.name,
              image: service.image,
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
                periodSeconds: 10
              },
              readinessProbe: {
                httpGet: {
                  path: '/ready',
                  port: service.port
                },
                initialDelaySeconds: 5,
                periodSeconds: 5
              }
            }]
          }
        }
      }
    };

    await this.k8sApi.createCustomResource(rollout);
    
    // Create supporting services
    await this.createCanaryServices(service);
  }

  private async createNativeCanary(deployment: ProgressiveDeployment): Promise<void> {
    const { service } = deployment.config;
    
    // Create stable deployment
    const stableDeployment = await this.createStableDeployment(service);
    
    // Create canary deployment
    const canaryDeployment = await this.createCanaryDeployment(service);
    
    // Create services
    await this.createCanaryServices(service);
    
    // Store deployment references
    deployment.metadata.stableDeployment = stableDeployment.metadata?.name;
    deployment.metadata.canaryDeployment = canaryDeployment.metadata?.name;
  }

  private async createStableDeployment(service: any): Promise<V1Deployment> {
    const deployment: V1Deployment = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: `${service.name}-stable`,
        namespace: service.namespace,
        labels: {
          app: service.name,
          version: 'stable'
        }
      },
      spec: {
        replicas: 3,
        selector: {
          matchLabels: {
            app: service.name,
            version: 'stable'
          }
        },
        template: {
          metadata: {
            labels: {
              app: service.name,
              version: 'stable'
            }
          },
          spec: {
            containers: [{
              name: service.name,
              image: service.image.replace(service.version, 'stable'),
              ports: [{
                containerPort: service.port
              }]
            }]
          }
        }
      }
    };

    const result = await this.k8sApi.createDeployment(service.namespace, deployment);
    return result.body;
  }

  private async createCanaryDeployment(service: any): Promise<V1Deployment> {
    const deployment: V1Deployment = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: `${service.name}-canary`,
        namespace: service.namespace,
        labels: {
          app: service.name,
          version: 'canary'
        }
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            app: service.name,
            version: 'canary'
          }
        },
        template: {
          metadata: {
            labels: {
              app: service.name,
              version: 'canary'
            }
          },
          spec: {
            containers: [{
              name: service.name,
              image: service.image,
              ports: [{
                containerPort: service.port
              }]
            }]
          }
        }
      }
    };

    const result = await this.k8sApi.createDeployment(service.namespace, deployment);
    return result.body;
  }

  private async createCanaryServices(service: any): Promise<void> {
    // Stable service
    const stableService: V1Service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: `${service.name}-stable`,
        namespace: service.namespace
      },
      spec: {
        selector: {
          app: service.name,
          version: 'stable'
        },
        ports: [{
          port: service.port,
          targetPort: service.port
        }]
      }
    };

    // Canary service
    const canaryService: V1Service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: `${service.name}-canary`,
        namespace: service.namespace
      },
      spec: {
        selector: {
          app: service.name,
          version: 'canary'
        },
        ports: [{
          port: service.port,
          targetPort: service.port
        }]
      }
    };

    await Promise.all([
      this.k8sApi.createService(service.namespace, stableService),
      this.k8sApi.createService(service.namespace, canaryService)
    ]);
  }

  private async pauseFlaggerCanary(deployment: ProgressiveDeployment): Promise<void> {
    const { service } = deployment.config;
    
    // Annotate the canary to pause
    await this.k8sApi.patchCustomResource(
      'flagger.app/v1beta1',
      'canaries',
      service.namespace,
      service.name,
      {
        metadata: {
          annotations: {
            'flagger.app/pause': 'true'
          }
        }
      }
    );
  }

  private async pauseArgoRollout(deployment: ProgressiveDeployment): Promise<void> {
    const { service } = deployment.config;
    
    // Pause the rollout
    await this.k8sApi.patchCustomResource(
      'argoproj.io/v1alpha1',
      'rollouts',
      service.namespace,
      service.name,
      {
        spec: {
          paused: true
        }
      }
    );
  }

  private async pauseNativeCanary(deployment: ProgressiveDeployment): Promise<void> {
    // For native canary, we pause by not updating traffic weights
    deployment.metadata.paused = true;
  }

  private async resumeFlaggerCanary(deployment: ProgressiveDeployment): Promise<void> {
    const { service } = deployment.config;
    
    // Remove pause annotation
    await this.k8sApi.patchCustomResource(
      'flagger.app/v1beta1',
      'canaries',
      service.namespace,
      service.name,
      {
        metadata: {
          annotations: {
            'flagger.app/pause': null
          }
        }
      }
    );
  }

  private async resumeArgoRollout(deployment: ProgressiveDeployment): Promise<void> {
    const { service } = deployment.config;
    
    // Resume the rollout
    await this.k8sApi.patchCustomResource(
      'argoproj.io/v1alpha1',
      'rollouts',
      service.namespace,
      service.name,
      {
        spec: {
          paused: false
        }
      }
    );
  }

  private async resumeNativeCanary(deployment: ProgressiveDeployment): Promise<void> {
    deployment.metadata.paused = false;
  }

  private async terminateFlaggerCanary(deployment: ProgressiveDeployment): Promise<void> {
    const { service } = deployment.config;
    
    // Delete the canary resource
    await this.k8sApi.deleteCustomResource(
      'flagger.app/v1beta1',
      'canaries',
      service.namespace,
      service.name
    );
  }

  private async terminateArgoRollout(deployment: ProgressiveDeployment): Promise<void> {
    const { service } = deployment.config;
    
    // Abort the rollout
    await this.k8sApi.patchCustomResource(
      'argoproj.io/v1alpha1',
      'rollouts',
      service.namespace,
      service.name,
      {
        spec: {
          abort: true
        }
      }
    );
  }

  private async terminateNativeCanary(deployment: ProgressiveDeployment): Promise<void> {
    const { service } = deployment.config;
    
    // Delete canary deployment
    await this.k8sApi.deleteDeployment(service.namespace, `${service.name}-canary`);
    
    // Delete canary service
    await this.k8sApi.deleteService(service.namespace, `${service.name}-canary`);
  }

  private async promoteFlaggerCanary(deployment: ProgressiveDeployment): Promise<void> {
    const { service } = deployment.config;
    
    // Promote the canary by confirming promotion
    await this.k8sApi.patchCustomResource(
      'flagger.app/v1beta1',
      'canaries',
      service.namespace,
      service.name,
      {
        metadata: {
          annotations: {
            'flagger.app/promote': 'true'
          }
        }
      }
    );
  }

  private async promoteArgoRollout(deployment: ProgressiveDeployment): Promise<void> {
    const { service } = deployment.config;
    
    // Promote the rollout
    await this.k8sApi.patchCustomResource(
      'argoproj.io/v1alpha1',
      'rollouts',
      service.namespace,
      service.name,
      {
        spec: {
          promote: true
        }
      }
    );
  }

  private async promoteNativeCanary(deployment: ProgressiveDeployment): Promise<void> {
    const { service } = deployment.config;
    
    // Update stable deployment to use canary image
    await this.k8sApi.patchDeployment(
      service.namespace,
      `${service.name}-stable`,
      {
        spec: {
          template: {
            spec: {
              containers: [{
                name: service.name,
                image: service.image
              }]
            }
          }
        }
      }
    );
    
    // Delete canary resources
    await this.terminateNativeCanary(deployment);
  }

  private async getFlaggerStatus(deployment: ProgressiveDeployment): Promise<any> {
    const { service } = deployment.config;
    
    const canary = await this.k8sApi.getCustomResource(
      'flagger.app/v1beta1',
      'canaries',
      service.namespace,
      service.name
    );
    
    return canary.status;
  }

  private async getArgoRolloutStatus(deployment: ProgressiveDeployment): Promise<any> {
    const { service } = deployment.config;
    
    const rollout = await this.k8sApi.getCustomResource(
      'argoproj.io/v1alpha1',
      'rollouts',
      service.namespace,
      service.name
    );
    
    return rollout.status;
  }

  private async getNativeCanaryStatus(deployment: ProgressiveDeployment): Promise<any> {
    const { service } = deployment.config;
    
    const [stableDeployment, canaryDeployment] = await Promise.all([
      this.k8sApi.getDeployment(service.namespace, `${service.name}-stable`),
      this.k8sApi.getDeployment(service.namespace, `${service.name}-canary`)
    ]);
    
    return {
      stable: stableDeployment?.status,
      canary: canaryDeployment?.status,
      phase: deployment.status
    };
  }
}