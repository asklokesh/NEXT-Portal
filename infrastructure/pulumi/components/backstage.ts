import * as pulumi from '@pulumi/pulumi';
import * as k8s from '@pulumi/kubernetes';
import * as aws from '@pulumi/aws';
import * as gcp from '@pulumi/gcp';
import * as azure from '@pulumi/azure-native';

export interface BackstageStackArgs {
  provider: any;
  environment: string;
  vpc: any;
  privateSubnets: any[];
  database: any;
  redis: any;
  storage: any;
  securityGroup: any;
  replicas: number;
  resources: {
    requests: {
      cpu: string;
      memory: string;
    };
    limits: {
      cpu: string;
      memory: string;
    };
  };
  ingress: {
    enabled: boolean;
    className: string;
    annotations: Record<string, string>;
    hosts: Array<{
      host: string;
      paths: Array<{
        path: string;
        pathType: string;
      }>;
    }>;
    tls?: Array<{
      secretName: string;
      hosts: string[];
    }>;
  };
}

export class BackstageStack extends pulumi.ComponentResource {
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly deployment: k8s.apps.v1.Deployment;
  public readonly service: k8s.core.v1.Service;
  public readonly ingress: k8s.networking.v1.Ingress | undefined;
  public readonly serviceUrl: pulumi.Output<string>;
  public readonly resourceCount: pulumi.Output<number>;

  constructor(name: string, args: BackstageStackArgs, opts?: pulumi.ComponentResourceOptions) {
    super('saas-idp:backstage:Stack', name, {}, opts);

    const labels = {
      app: 'backstage',
      component: 'backend',
      environment: args.environment,
      'app.kubernetes.io/name': 'backstage',
      'app.kubernetes.io/instance': name,
      'app.kubernetes.io/component': 'backend',
      'app.kubernetes.io/managed-by': 'pulumi'
    };

    // Create namespace
    this.namespace = new k8s.core.v1.Namespace(`${name}-namespace`, {
      metadata: {
        name: `backstage-${args.environment}`,
        labels: labels
      }
    }, { parent: this });

    // Create ConfigMap for Backstage configuration
    const configMap = new k8s.core.v1.ConfigMap(`${name}-config`, {
      metadata: {
        name: 'backstage-config',
        namespace: this.namespace.metadata.name,
        labels: labels
      },
      data: {
        'app-config.yaml': this.generateBackstageConfig(args)
      }
    }, { parent: this });

    // Create Secret for sensitive data
    const secret = new k8s.core.v1.Secret(`${name}-secret`, {
      metadata: {
        name: 'backstage-secrets',
        namespace: this.namespace.metadata.name,
        labels: labels
      },
      type: 'Opaque',
      stringData: {
        POSTGRES_HOST: pulumi.interpolate`${args.database.endpoint}`,
        POSTGRES_PORT: '5432',
        POSTGRES_USER: 'backstage',
        POSTGRES_PASSWORD: pulumi.secret('backstage-password'),
        REDIS_HOST: pulumi.interpolate`${args.redis.endpoint}`,
        REDIS_PORT: '6379',
        GITHUB_TOKEN: pulumi.secret(process.env.GITHUB_TOKEN || ''),
        AUTH_GITHUB_CLIENT_ID: pulumi.secret(process.env.AUTH_GITHUB_CLIENT_ID || ''),
        AUTH_GITHUB_CLIENT_SECRET: pulumi.secret(process.env.AUTH_GITHUB_CLIENT_SECRET || '')
      }
    }, { parent: this });

    // Create ServiceAccount
    const serviceAccount = new k8s.core.v1.ServiceAccount(`${name}-sa`, {
      metadata: {
        name: 'backstage',
        namespace: this.namespace.metadata.name,
        labels: labels
      }
    }, { parent: this });

    // Create RBAC Role
    const role = new k8s.rbac.v1.Role(`${name}-role`, {
      metadata: {
        name: 'backstage-role',
        namespace: this.namespace.metadata.name,
        labels: labels
      },
      rules: [
        {
          apiGroups: [''],
          resources: ['pods', 'services', 'configmaps', 'secrets'],
          verbs: ['get', 'list', 'watch']
        },
        {
          apiGroups: ['apps'],
          resources: ['deployments', 'replicasets'],
          verbs: ['get', 'list', 'watch']
        },
        {
          apiGroups: ['batch'],
          resources: ['jobs', 'cronjobs'],
          verbs: ['get', 'list', 'watch']
        },
        {
          apiGroups: ['networking.k8s.io'],
          resources: ['ingresses'],
          verbs: ['get', 'list', 'watch']
        }
      ]
    }, { parent: this });

    // Create RoleBinding
    const roleBinding = new k8s.rbac.v1.RoleBinding(`${name}-rolebinding`, {
      metadata: {
        name: 'backstage-rolebinding',
        namespace: this.namespace.metadata.name,
        labels: labels
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'Role',
        name: role.metadata.name
      },
      subjects: [{
        kind: 'ServiceAccount',
        name: serviceAccount.metadata.name,
        namespace: this.namespace.metadata.name
      }]
    }, { parent: this });

    // Create PersistentVolumeClaim for Backstage data
    const pvc = new k8s.core.v1.PersistentVolumeClaim(`${name}-pvc`, {
      metadata: {
        name: 'backstage-data',
        namespace: this.namespace.metadata.name,
        labels: labels
      },
      spec: {
        accessModes: ['ReadWriteOnce'],
        resources: {
          requests: {
            storage: args.environment === 'production' ? '50Gi' : '10Gi'
          }
        },
        storageClassName: 'gp2'
      }
    }, { parent: this });

    // Create Deployment
    this.deployment = new k8s.apps.v1.Deployment(`${name}-deployment`, {
      metadata: {
        name: 'backstage',
        namespace: this.namespace.metadata.name,
        labels: labels
      },
      spec: {
        replicas: args.replicas,
        selector: {
          matchLabels: {
            app: 'backstage',
            component: 'backend'
          }
        },
        template: {
          metadata: {
            labels: labels,
            annotations: {
              'prometheus.io/scrape': 'true',
              'prometheus.io/port': '9090',
              'prometheus.io/path': '/metrics'
            }
          },
          spec: {
            serviceAccountName: serviceAccount.metadata.name,
            securityContext: {
              runAsUser: 1000,
              runAsGroup: 1000,
              fsGroup: 1000
            },
            initContainers: [
              {
                name: 'install-plugins',
                image: 'backstage/backstage:latest',
                command: ['/bin/sh'],
                args: ['-c', 'yarn install --frozen-lockfile && yarn build'],
                volumeMounts: [
                  {
                    name: 'backstage-data',
                    mountPath: '/app/packages'
                  }
                ],
                resources: {
                  requests: {
                    cpu: '500m',
                    memory: '1Gi'
                  },
                  limits: {
                    cpu: '1000m',
                    memory: '2Gi'
                  }
                }
              }
            ],
            containers: [
              {
                name: 'backstage',
                image: 'backstage/backstage:latest',
                imagePullPolicy: 'Always',
                ports: [
                  {
                    name: 'http',
                    containerPort: 7007,
                    protocol: 'TCP'
                  },
                  {
                    name: 'metrics',
                    containerPort: 9090,
                    protocol: 'TCP'
                  }
                ],
                envFrom: [
                  {
                    secretRef: {
                      name: secret.metadata.name
                    }
                  }
                ],
                env: [
                  {
                    name: 'NODE_ENV',
                    value: args.environment
                  },
                  {
                    name: 'APP_CONFIG_app_baseUrl',
                    value: `https://${args.ingress.hosts[0].host}`
                  },
                  {
                    name: 'APP_CONFIG_backend_baseUrl',
                    value: `https://${args.ingress.hosts[0].host}`
                  },
                  {
                    name: 'APP_CONFIG_backend_cors_origin',
                    value: `https://${args.ingress.hosts[0].host}`
                  },
                  {
                    name: 'LOG_LEVEL',
                    value: args.environment === 'production' ? 'info' : 'debug'
                  }
                ],
                volumeMounts: [
                  {
                    name: 'backstage-config',
                    mountPath: '/app/app-config.yaml',
                    subPath: 'app-config.yaml'
                  },
                  {
                    name: 'backstage-data',
                    mountPath: '/app/packages'
                  }
                ],
                livenessProbe: {
                  httpGet: {
                    path: '/healthz',
                    port: 7007
                  },
                  initialDelaySeconds: 60,
                  periodSeconds: 30,
                  timeoutSeconds: 5,
                  failureThreshold: 3
                },
                readinessProbe: {
                  httpGet: {
                    path: '/healthz',
                    port: 7007
                  },
                  initialDelaySeconds: 30,
                  periodSeconds: 10,
                  timeoutSeconds: 5,
                  failureThreshold: 3
                },
                resources: args.resources
              },
              // Sidecar container for plugin management
              {
                name: 'plugin-manager',
                image: 'saas-idp/plugin-manager:latest',
                ports: [
                  {
                    name: 'plugin-api',
                    containerPort: 8080,
                    protocol: 'TCP'
                  }
                ],
                env: [
                  {
                    name: 'BACKSTAGE_URL',
                    value: 'http://localhost:7007'
                  },
                  {
                    name: 'STORAGE_BUCKET',
                    value: pulumi.interpolate`${args.storage.id}`
                  }
                ],
                resources: {
                  requests: {
                    cpu: '100m',
                    memory: '256Mi'
                  },
                  limits: {
                    cpu: '500m',
                    memory: '512Mi'
                  }
                }
              }
            ],
            volumes: [
              {
                name: 'backstage-config',
                configMap: {
                  name: configMap.metadata.name
                }
              },
              {
                name: 'backstage-data',
                persistentVolumeClaim: {
                  claimName: pvc.metadata.name
                }
              }
            ],
            affinity: {
              podAntiAffinity: {
                preferredDuringSchedulingIgnoredDuringExecution: [
                  {
                    weight: 100,
                    podAffinityTerm: {
                      labelSelector: {
                        matchExpressions: [
                          {
                            key: 'app',
                            operator: 'In',
                            values: ['backstage']
                          }
                        ]
                      },
                      topologyKey: 'kubernetes.io/hostname'
                    }
                  }
                ]
              }
            }
          }
        },
        strategy: {
          type: 'RollingUpdate',
          rollingUpdate: {
            maxSurge: 1,
            maxUnavailable: 0
          }
        }
      }
    }, { parent: this });

    // Create Service
    this.service = new k8s.core.v1.Service(`${name}-service`, {
      metadata: {
        name: 'backstage',
        namespace: this.namespace.metadata.name,
        labels: labels,
        annotations: {
          'service.beta.kubernetes.io/aws-load-balancer-type': 'nlb',
          'service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled': 'true'
        }
      },
      spec: {
        type: 'ClusterIP',
        selector: {
          app: 'backstage',
          component: 'backend'
        },
        ports: [
          {
            name: 'http',
            port: 80,
            targetPort: 7007,
            protocol: 'TCP'
          },
          {
            name: 'metrics',
            port: 9090,
            targetPort: 9090,
            protocol: 'TCP'
          }
        ]
      }
    }, { parent: this });

    // Create Ingress if enabled
    if (args.ingress.enabled) {
      this.ingress = new k8s.networking.v1.Ingress(`${name}-ingress`, {
        metadata: {
          name: 'backstage',
          namespace: this.namespace.metadata.name,
          labels: labels,
          annotations: args.ingress.annotations
        },
        spec: {
          ingressClassName: args.ingress.className,
          tls: args.ingress.tls,
          rules: args.ingress.hosts.map(host => ({
            host: host.host,
            http: {
              paths: host.paths.map(path => ({
                path: path.path,
                pathType: path.pathType as any,
                backend: {
                  service: {
                    name: this.service.metadata.name,
                    port: {
                      number: 80
                    }
                  }
                }
              }))
            }
          }))
        }
      }, { parent: this });

      this.serviceUrl = pulumi.interpolate`https://${args.ingress.hosts[0].host}`;
    } else {
      this.serviceUrl = pulumi.interpolate`http://${this.service.metadata.name}.${this.namespace.metadata.name}.svc.cluster.local`;
    }

    // Create HorizontalPodAutoscaler
    const hpa = new k8s.autoscaling.v2.HorizontalPodAutoscaler(`${name}-hpa`, {
      metadata: {
        name: 'backstage',
        namespace: this.namespace.metadata.name,
        labels: labels
      },
      spec: {
        scaleTargetRef: {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          name: this.deployment.metadata.name
        },
        minReplicas: args.replicas,
        maxReplicas: args.replicas * 3,
        metrics: [
          {
            type: 'Resource',
            resource: {
              name: 'cpu',
              target: {
                type: 'Utilization',
                averageUtilization: 70
              }
            }
          },
          {
            type: 'Resource',
            resource: {
              name: 'memory',
              target: {
                type: 'Utilization',
                averageUtilization: 80
              }
            }
          }
        ],
        behavior: {
          scaleDown: {
            stabilizationWindowSeconds: 300,
            policies: [
              {
                type: 'Percent',
                value: 50,
                periodSeconds: 60
              }
            ]
          },
          scaleUp: {
            stabilizationWindowSeconds: 60,
            policies: [
              {
                type: 'Percent',
                value: 100,
                periodSeconds: 60
              }
            ]
          }
        }
      }
    }, { parent: this });

    // Create PodDisruptionBudget
    const pdb = new k8s.policy.v1.PodDisruptionBudget(`${name}-pdb`, {
      metadata: {
        name: 'backstage',
        namespace: this.namespace.metadata.name,
        labels: labels
      },
      spec: {
        minAvailable: Math.max(1, Math.floor(args.replicas / 2)),
        selector: {
          matchLabels: {
            app: 'backstage',
            component: 'backend'
          }
        }
      }
    }, { parent: this });

    // Create NetworkPolicy
    const networkPolicy = new k8s.networking.v1.NetworkPolicy(`${name}-netpol`, {
      metadata: {
        name: 'backstage',
        namespace: this.namespace.metadata.name,
        labels: labels
      },
      spec: {
        podSelector: {
          matchLabels: {
            app: 'backstage'
          }
        },
        policyTypes: ['Ingress', 'Egress'],
        ingress: [
          {
            from: [
              {
                namespaceSelector: {
                  matchLabels: {
                    name: 'ingress-nginx'
                  }
                }
              },
              {
                podSelector: {
                  matchLabels: {
                    app: 'prometheus'
                  }
                }
              }
            ],
            ports: [
              {
                protocol: 'TCP',
                port: 7007
              },
              {
                protocol: 'TCP',
                port: 9090
              }
            ]
          }
        ],
        egress: [
          {
            to: [
              {
                podSelector: {}
              }
            ],
            ports: [
              {
                protocol: 'TCP',
                port: 5432
              },
              {
                protocol: 'TCP',
                port: 6379
              },
              {
                protocol: 'TCP',
                port: 443
              },
              {
                protocol: 'TCP',
                port: 53
              },
              {
                protocol: 'UDP',
                port: 53
              }
            ]
          }
        ]
      }
    }, { parent: this });

    this.resourceCount = pulumi.output(
      1 + // Namespace
      1 + // ConfigMap
      1 + // Secret
      1 + // ServiceAccount
      1 + // Role
      1 + // RoleBinding
      1 + // PVC
      1 + // Deployment
      1 + // Service
      (args.ingress.enabled ? 1 : 0) + // Ingress
      1 + // HPA
      1 + // PDB
      1 // NetworkPolicy
    );

    this.registerOutputs({
      namespace: this.namespace,
      deployment: this.deployment,
      service: this.service,
      ingress: this.ingress,
      serviceUrl: this.serviceUrl,
      resourceCount: this.resourceCount
    });
  }

  private generateBackstageConfig(args: BackstageStackArgs): string {
    return `
app:
  title: SaaS IDP Portal
  baseUrl: https://${args.ingress.hosts[0].host}
  support:
    url: https://github.com/saas-idp/portal/issues
    items:
      - title: Issues
        icon: github
        links:
          - url: https://github.com/saas-idp/portal/issues
            title: GitHub Issues
      - title: Documentation
        icon: docs
        links:
          - url: https://docs.saas-idp.com
            title: Documentation

organization:
  name: SaaS IDP

backend:
  baseUrl: https://${args.ingress.hosts[0].host}
  listen:
    port: 7007
  csp:
    connect-src: ["'self'", 'http:', 'https:']
  cors:
    origin: https://${args.ingress.hosts[0].host}
    methods: [GET, POST, PUT, DELETE]
    credentials: true
  database:
    client: pg
    connection:
      host: \${POSTGRES_HOST}
      port: \${POSTGRES_PORT}
      user: \${POSTGRES_USER}
      password: \${POSTGRES_PASSWORD}
      database: backstage
  cache:
    store: redis
    connection:
      host: \${REDIS_HOST}
      port: \${REDIS_PORT}
  reading:
    allow:
      - host: github.com
      - host: gitlab.com
      - host: bitbucket.org

integrations:
  github:
    - host: github.com
      token: \${GITHUB_TOKEN}
  gitlab:
    - host: gitlab.com
      token: \${GITLAB_TOKEN}
  bitbucket:
    - host: bitbucket.org
      username: \${BITBUCKET_USERNAME}
      appPassword: \${BITBUCKET_APP_PASSWORD}

proxy:
  '/jenkins':
    target: 'http://jenkins.default.svc.cluster.local:8080'
    changeOrigin: true
  '/prometheus':
    target: 'http://prometheus.monitoring.svc.cluster.local:9090'
    changeOrigin: true
  '/grafana':
    target: 'http://grafana.monitoring.svc.cluster.local:3000'
    changeOrigin: true

techdocs:
  builder: 'local'
  generator:
    runIn: 'docker'
  publisher:
    type: 'awsS3'
    awsS3:
      bucketName: \${TECHDOCS_BUCKET}
      region: \${AWS_REGION}

auth:
  environment: ${args.environment}
  providers:
    github:
      ${args.environment}:
        clientId: \${AUTH_GITHUB_CLIENT_ID}
        clientSecret: \${AUTH_GITHUB_CLIENT_SECRET}

scaffolder:
  defaultAuthor:
    name: SaaS IDP
    email: scaffolder@saas-idp.com
  defaultCommitMessage: 'Initial commit'

catalog:
  import:
    entityFilename: catalog-info.yaml
    pullRequestBranchName: backstage-integration
  rules:
    - allow: [Component, System, API, Resource, Location, Domain, Group, User]
  locations:
    - type: url
      target: https://github.com/saas-idp/catalog/blob/main/catalog.yaml
  processors:
    - GithubDiscoveryProcessor
    - GitlabDiscoveryProcessor
    - BitbucketDiscoveryProcessor

kubernetes:
  serviceLocatorMethod:
    type: 'multiTenant'
  clusterLocatorMethods:
    - type: 'config'
      clusters:
        - url: https://kubernetes.default.svc
          name: local
          authProvider: 'serviceAccount'
          skipTLSVerify: false
          skipMetricsLookup: false

permission:
  enabled: true
  rbac:
    admin:
      users:
        - name: admin@saas-idp.com
    policies:
      - permission: catalog.entity.read
        allow: [group:default/developers]
      - permission: catalog.entity.create
        allow: [group:default/developers]
      - permission: catalog.entity.delete
        allow: [group:default/admins]

search:
  elasticsearch:
    provider: elasticsearch
    node: http://elasticsearch.default.svc.cluster.local:9200
    auth:
      username: \${ELASTICSEARCH_USERNAME}
      password: \${ELASTICSEARCH_PASSWORD}
    `;
  }
}