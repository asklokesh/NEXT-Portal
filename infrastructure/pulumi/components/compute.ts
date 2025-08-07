import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as awsx from '@pulumi/awsx';
import * as gcp from '@pulumi/gcp';
import * as azure from '@pulumi/azure-native';
import * as docker from '@pulumi/docker';

export interface ComputeStackArgs {
  provider: any;
  environment: string;
  vpc: any;
  privateSubnets: any[];
  publicSubnets: any[];
  securityGroup: any;
  desiredCapacity: number;
  minSize: number;
  maxSize: number;
  instanceType: string;
  enableAutoScaling: boolean;
  targetCPUUtilization: number;
  healthCheckPath: string;
  containerImage: string;
  containerPort: number;
  cpu: number;
  memory: number;
}

export class ComputeStack extends pulumi.ComponentResource {
  public readonly cluster: any;
  public readonly service: any;
  public readonly loadBalancer: any;
  public readonly loadBalancerUrl: pulumi.Output<string>;
  public readonly autoScaling: any;
  public readonly resourceCount: pulumi.Output<number>;

  constructor(name: string, args: ComputeStackArgs, opts?: pulumi.ComponentResourceOptions) {
    super('saas-idp:compute:Stack', name, {}, opts);

    const defaultTags = {
      Environment: args.environment,
      ManagedBy: 'Pulumi',
      Component: 'Compute',
      Project: 'SaaS-IDP'
    };

    if (args.provider.constructor.name.includes('Aws')) {
      // AWS ECS Fargate Implementation
      
      // Create ECS Cluster
      this.cluster = new aws.ecs.Cluster(`${name}-cluster`, {
        settings: [{
          name: 'containerInsights',
          value: 'enabled'
        }],
        tags: {
          ...defaultTags,
          Name: `${name}-cluster`
        }
      }, { parent: this });

      // Create CloudWatch Log Group
      const logGroup = new aws.cloudwatch.LogGroup(`${name}-logs`, {
        retentionInDays: args.environment === 'production' ? 30 : 7,
        tags: defaultTags
      }, { parent: this });

      // Create Task Execution Role
      const taskExecutionRole = new aws.iam.Role(`${name}-task-exec-role`, {
        assumeRolePolicy: JSON.stringify({
          Version: '2012-10-17',
          Statement: [{
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: {
              Service: 'ecs-tasks.amazonaws.com'
            }
          }]
        }),
        tags: defaultTags
      }, { parent: this });

      new aws.iam.RolePolicyAttachment(`${name}-task-exec-policy`, {
        role: taskExecutionRole.name,
        policyArn: 'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy'
      }, { parent: this });

      // Create Task Role
      const taskRole = new aws.iam.Role(`${name}-task-role`, {
        assumeRolePolicy: JSON.stringify({
          Version: '2012-10-17',
          Statement: [{
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: {
              Service: 'ecs-tasks.amazonaws.com'
            }
          }]
        }),
        tags: defaultTags
      }, { parent: this });

      // Attach policies to task role
      const taskPolicy = new aws.iam.RolePolicy(`${name}-task-policy`, {
        role: taskRole.name,
        policy: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Action: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
                's3:ListBucket'
              ],
              Resource: '*'
            },
            {
              Effect: 'Allow',
              Action: [
                'secretsmanager:GetSecretValue',
                'kms:Decrypt'
              ],
              Resource: '*'
            },
            {
              Effect: 'Allow',
              Action: [
                'cloudwatch:PutMetricData',
                'logs:CreateLogStream',
                'logs:PutLogEvents'
              ],
              Resource: '*'
            }
          ]
        })
      }, { parent: this });

      // Create Application Load Balancer
      this.loadBalancer = new aws.lb.LoadBalancer(`${name}-alb`, {
        loadBalancerType: 'application',
        subnets: args.publicSubnets.map(subnet => subnet.id),
        securityGroups: [args.securityGroup.id],
        enableHttp2: true,
        enableCrossZoneLoadBalancing: true,
        enableDeletionProtection: args.environment === 'production',
        accessLogs: args.environment === 'production' ? {
          enabled: true,
          bucket: pulumi.interpolate`${name}-alb-logs`
        } : undefined,
        tags: {
          ...defaultTags,
          Name: `${name}-alb`
        }
      }, { parent: this });

      // Create Target Group
      const targetGroup = new aws.lb.TargetGroup(`${name}-tg`, {
        port: args.containerPort,
        protocol: 'HTTP',
        targetType: 'ip',
        vpcId: args.vpc.id,
        healthCheck: {
          enabled: true,
          path: args.healthCheckPath,
          protocol: 'HTTP',
          healthyThreshold: 2,
          unhealthyThreshold: 3,
          timeout: 30,
          interval: 60,
          matcher: '200-299'
        },
        deregistrationDelay: 30,
        stickiness: {
          type: 'lb_cookie',
          enabled: true,
          duration: 86400
        },
        tags: {
          ...defaultTags,
          Name: `${name}-tg`
        }
      }, { parent: this });

      // Create ALB Listener
      const listener = new aws.lb.Listener(`${name}-listener`, {
        loadBalancerArn: this.loadBalancer.arn,
        port: 80,
        protocol: 'HTTP',
        defaultActions: [{
          type: 'forward',
          targetGroupArn: targetGroup.arn
        }]
      }, { parent: this });

      // HTTPS Listener for production
      if (args.environment === 'production') {
        const certificate = new aws.acm.Certificate(`${name}-cert`, {
          domainName: '*.saas-idp.com',
          validationMethod: 'DNS',
          subjectAlternativeNames: [
            'saas-idp.com',
            '*.api.saas-idp.com',
            '*.portal.saas-idp.com'
          ],
          tags: defaultTags
        }, { parent: this });

        const httpsListener = new aws.lb.Listener(`${name}-https-listener`, {
          loadBalancerArn: this.loadBalancer.arn,
          port: 443,
          protocol: 'HTTPS',
          certificateArn: certificate.arn,
          sslPolicy: 'ELBSecurityPolicy-TLS-1-2-2017-01',
          defaultActions: [{
            type: 'forward',
            targetGroupArn: targetGroup.arn
          }]
        }, { parent: this });

        // Redirect HTTP to HTTPS
        const httpRedirectListener = new aws.lb.ListenerRule(`${name}-http-redirect`, {
          listenerArn: listener.arn,
          priority: 100,
          conditions: [{
            pathPattern: {
              values: ['/*']
            }
          }],
          actions: [{
            type: 'redirect',
            redirect: {
              protocol: 'HTTPS',
              port: '443',
              statusCode: 'HTTP_301'
            }
          }]
        }, { parent: this });
      }

      // Create ECR Repository
      const repository = new aws.ecr.Repository(`${name}-repo`, {
        imageScanningConfiguration: {
          scanOnPush: true
        },
        imageTagMutability: 'MUTABLE',
        encryptionConfigurations: [{
          encryptionType: 'AES256'
        }],
        lifecyclePolicy: JSON.stringify({
          rules: [{
            rulePriority: 1,
            description: 'Keep last 10 images',
            selection: {
              tagStatus: 'tagged',
              tagPrefixList: ['v'],
              countType: 'imageCountMoreThan',
              countNumber: 10
            },
            action: {
              type: 'expire'
            }
          }]
        }),
        tags: defaultTags
      }, { parent: this });

      // Build and push Docker image
      const image = new docker.Image(`${name}-image`, {
        imageName: pulumi.interpolate`${repository.repositoryUrl}:latest`,
        build: {
          context: '../../../',
          dockerfile: '../../../Dockerfile.production',
          platform: 'linux/amd64',
          args: {
            NODE_ENV: args.environment
          }
        },
        registry: {
          server: repository.repositoryUrl,
          username: 'AWS',
          password: pulumi.secret(aws.ecr.getAuthorizationToken().then(auth => auth.password))
        }
      }, { parent: this });

      // Create Task Definition
      const taskDefinition = new aws.ecs.TaskDefinition(`${name}-task`, {
        family: name,
        requiresCompatibilities: ['FARGATE'],
        networkMode: 'awsvpc',
        cpu: args.cpu.toString(),
        memory: args.memory.toString(),
        executionRoleArn: taskExecutionRole.arn,
        taskRoleArn: taskRole.arn,
        containerDefinitions: JSON.stringify([{
          name: 'app',
          image: image.imageName,
          cpu: args.cpu,
          memory: args.memory,
          essential: true,
          portMappings: [{
            containerPort: args.containerPort,
            protocol: 'tcp'
          }],
          environment: [
            { name: 'NODE_ENV', value: args.environment },
            { name: 'PORT', value: args.containerPort.toString() }
          ],
          secrets: [],
          logConfiguration: {
            logDriver: 'awslogs',
            options: {
              'awslogs-group': logGroup.name,
              'awslogs-region': aws.getRegion().then(r => r.name),
              'awslogs-stream-prefix': 'app'
            }
          },
          healthCheck: {
            command: ['CMD-SHELL', `curl -f http://localhost:${args.containerPort}${args.healthCheckPath} || exit 1`],
            interval: 30,
            timeout: 5,
            retries: 3,
            startPeriod: 60
          }
        }]),
        tags: defaultTags
      }, { parent: this });

      // Create ECS Service
      this.service = new aws.ecs.Service(`${name}-service`, {
        cluster: this.cluster.arn,
        taskDefinition: taskDefinition.arn,
        desiredCount: args.desiredCapacity,
        launchType: 'FARGATE',
        networkConfiguration: {
          subnets: args.privateSubnets.map(subnet => subnet.id),
          securityGroups: [args.securityGroup.id],
          assignPublicIp: false
        },
        loadBalancers: [{
          targetGroupArn: targetGroup.arn,
          containerName: 'app',
          containerPort: args.containerPort
        }],
        healthCheckGracePeriodSeconds: 60,
        deploymentController: {
          type: 'ECS'
        },
        deploymentConfiguration: {
          maximumPercent: 200,
          minimumHealthyPercent: 100,
          deploymentCircuitBreaker: {
            enable: true,
            rollback: true
          }
        },
        enableEcsManagedTags: true,
        propagateTags: 'SERVICE',
        tags: {
          ...defaultTags,
          Name: `${name}-service`
        }
      }, { parent: this, dependsOn: [listener] });

      // Auto Scaling
      if (args.enableAutoScaling) {
        const scalingTarget = new aws.appautoscaling.Target(`${name}-scaling-target`, {
          serviceNamespace: 'ecs',
          resourceId: pulumi.interpolate`service/${this.cluster.name}/${this.service.name}`,
          scalableDimension: 'ecs:service:DesiredCount',
          minCapacity: args.minSize,
          maxCapacity: args.maxSize
        }, { parent: this });

        const cpuScalingPolicy = new aws.appautoscaling.Policy(`${name}-cpu-scaling`, {
          policyType: 'TargetTrackingScaling',
          resourceId: scalingTarget.resourceId,
          scalableDimension: scalingTarget.scalableDimension,
          serviceNamespace: scalingTarget.serviceNamespace,
          targetTrackingScalingPolicyConfiguration: {
            targetValue: args.targetCPUUtilization,
            predefinedMetricSpecification: {
              predefinedMetricType: 'ECSServiceAverageCPUUtilization'
            },
            scaleInCooldown: 300,
            scaleOutCooldown: 60
          }
        }, { parent: this });

        const memoryScalingPolicy = new aws.appautoscaling.Policy(`${name}-memory-scaling`, {
          policyType: 'TargetTrackingScaling',
          resourceId: scalingTarget.resourceId,
          scalableDimension: scalingTarget.scalableDimension,
          serviceNamespace: scalingTarget.serviceNamespace,
          targetTrackingScalingPolicyConfiguration: {
            targetValue: 80,
            predefinedMetricSpecification: {
              predefinedMetricType: 'ECSServiceAverageMemoryUtilization'
            },
            scaleInCooldown: 300,
            scaleOutCooldown: 60
          }
        }, { parent: this });

        this.autoScaling = {
          target: scalingTarget,
          cpuPolicy: cpuScalingPolicy,
          memoryPolicy: memoryScalingPolicy
        };
      }

      this.loadBalancerUrl = this.loadBalancer.dnsName;
      this.resourceCount = pulumi.output(
        1 + // Cluster
        1 + // Load Balancer
        1 + // Target Group
        2 + // Listeners
        1 + // ECR Repository
        1 + // Task Definition
        1 + // Service
        4 + // IAM Roles and Policies
        1 + // Log Group
        (args.enableAutoScaling ? 3 : 0) + // Auto Scaling resources
        (args.environment === 'production' ? 2 : 0) // Certificate and HTTPS resources
      );

    } else if (args.provider.constructor.name.includes('Gcp')) {
      // GCP Cloud Run Implementation
      const serviceAccount = new gcp.serviceaccount.Account(`${name}-sa`, {
        accountId: `${name}-sa`.substring(0, 30),
        displayName: `Service account for ${name}`,
        project: args.provider.project
      }, { parent: this });

      // Grant necessary permissions
      new gcp.projects.IAMMember(`${name}-sa-invoker`, {
        role: 'roles/run.invoker',
        member: pulumi.interpolate`serviceAccount:${serviceAccount.email}`,
        project: args.provider.project
      }, { parent: this });

      this.service = new gcp.cloudrun.Service(`${name}-service`, {
        location: args.provider.region,
        template: {
          spec: {
            serviceAccountName: serviceAccount.email,
            containers: [{
              image: args.containerImage,
              ports: [{
                containerPort: args.containerPort
              }],
              resources: {
                limits: {
                  cpu: `${args.cpu}m`,
                  memory: `${args.memory}Mi`
                }
              },
              envs: [
                { name: 'NODE_ENV', value: args.environment },
                { name: 'PORT', value: args.containerPort.toString() }
              ]
            }]
          },
          metadata: {
            annotations: {
              'autoscaling.knative.dev/minScale': args.minSize.toString(),
              'autoscaling.knative.dev/maxScale': args.maxSize.toString(),
              'run.googleapis.com/cpu-throttling': 'false'
            }
          }
        },
        traffics: [{
          percent: 100,
          latestRevision: true
        }],
        project: args.provider.project
      }, { parent: this });

      // Make service publicly accessible
      new gcp.cloudrun.IamMember(`${name}-invoker`, {
        service: this.service.name,
        location: args.provider.region,
        role: 'roles/run.invoker',
        member: 'allUsers',
        project: args.provider.project
      }, { parent: this });

      this.loadBalancerUrl = this.service.statuses[0].url;
      this.resourceCount = pulumi.output(3); // Service, Service Account, IAM

    } else if (args.provider.constructor.name.includes('Azure')) {
      // Azure Container Instances Implementation
      const resourceGroup = new azure.resources.ResourceGroup(`${name}-rg`, {
        location: args.provider.location,
        tags: defaultTags
      }, { parent: this });

      const containerGroup = new azure.containerinstance.ContainerGroup(`${name}-container-group`, {
        resourceGroupName: resourceGroup.name,
        location: resourceGroup.location,
        osType: 'Linux',
        restartPolicy: 'Always',
        ipAddress: {
          type: 'Public',
          ports: [{
            port: args.containerPort,
            protocol: 'TCP'
          }],
          dnsNameLabel: name
        },
        containers: [{
          name: 'app',
          image: args.containerImage,
          resources: {
            requests: {
              cpu: args.cpu / 1000,
              memoryInGB: args.memory / 1024
            }
          },
          ports: [{
            port: args.containerPort,
            protocol: 'TCP'
          }],
          environmentVariables: [
            { name: 'NODE_ENV', value: args.environment },
            { name: 'PORT', value: args.containerPort.toString() }
          ]
        }],
        tags: defaultTags
      }, { parent: this });

      this.loadBalancerUrl = pulumi.interpolate`${containerGroup.ipAddress.apply(ip => ip?.fqdn)}`;
      this.resourceCount = pulumi.output(2); // Resource Group, Container Group
    }

    this.registerOutputs({
      cluster: this.cluster,
      service: this.service,
      loadBalancer: this.loadBalancer,
      loadBalancerUrl: this.loadBalancerUrl,
      autoScaling: this.autoScaling,
      resourceCount: this.resourceCount
    });
  }
}