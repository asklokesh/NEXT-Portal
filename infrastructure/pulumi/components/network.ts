import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as gcp from '@pulumi/gcp';
import * as azure from '@pulumi/azure-native';

export interface NetworkStackArgs {
  provider: any;
  environment: string;
  region: string;
  multiRegion: boolean;
  cidrBlock: string;
  enableFlowLogs: boolean;
  enableNATGateway: boolean;
  availabilityZones: number;
}

export class NetworkStack extends pulumi.ComponentResource {
  public readonly vpc: any;
  public readonly publicSubnets: any[];
  public readonly privateSubnets: any[];
  public readonly natGateways: any[];
  public readonly internetGateway: any;
  public readonly resourceCount: pulumi.Output<number>;

  constructor(name: string, args: NetworkStackArgs, opts?: pulumi.ComponentResourceOptions) {
    super('saas-idp:network:Stack', name, {}, opts);

    const defaultTags = {
      Environment: args.environment,
      ManagedBy: 'Pulumi',
      Component: 'Network',
      Project: 'SaaS-IDP'
    };

    // Create VPC based on provider
    if (args.provider.constructor.name.includes('Aws')) {
      // AWS Network Implementation
      this.vpc = new aws.ec2.Vpc(`${name}-vpc`, {
        cidrBlock: args.cidrBlock,
        enableDnsHostnames: true,
        enableDnsSupport: true,
        tags: {
          ...defaultTags,
          Name: `${name}-vpc`
        }
      }, { parent: this });

      // Create Internet Gateway
      this.internetGateway = new aws.ec2.InternetGateway(`${name}-igw`, {
        vpcId: this.vpc.id,
        tags: {
          ...defaultTags,
          Name: `${name}-igw`
        }
      }, { parent: this });

      // Get availability zones
      const azs = aws.getAvailabilityZones({
        state: 'available'
      });

      // Create subnets
      this.publicSubnets = [];
      this.privateSubnets = [];
      this.natGateways = [];

      for (let i = 0; i < args.availabilityZones; i++) {
        const az = azs.then(zones => zones.names[i]);
        
        // Public subnet
        const publicSubnet = new aws.ec2.Subnet(`${name}-public-${i}`, {
          vpcId: this.vpc.id,
          cidrBlock: `10.0.${i * 2}.0/24`,
          availabilityZone: az,
          mapPublicIpOnLaunch: true,
          tags: {
            ...defaultTags,
            Name: `${name}-public-${i}`,
            Type: 'Public',
            'kubernetes.io/role/elb': '1'
          }
        }, { parent: this });
        this.publicSubnets.push(publicSubnet);

        // Private subnet
        const privateSubnet = new aws.ec2.Subnet(`${name}-private-${i}`, {
          vpcId: this.vpc.id,
          cidrBlock: `10.0.${i * 2 + 1}.0/24`,
          availabilityZone: az,
          tags: {
            ...defaultTags,
            Name: `${name}-private-${i}`,
            Type: 'Private',
            'kubernetes.io/role/internal-elb': '1'
          }
        }, { parent: this });
        this.privateSubnets.push(privateSubnet);

        // NAT Gateway (if enabled)
        if (args.enableNATGateway) {
          const eip = new aws.ec2.Eip(`${name}-nat-eip-${i}`, {
            domain: 'vpc',
            tags: {
              ...defaultTags,
              Name: `${name}-nat-eip-${i}`
            }
          }, { parent: this });

          const natGateway = new aws.ec2.NatGateway(`${name}-nat-${i}`, {
            subnetId: publicSubnet.id,
            allocationId: eip.id,
            tags: {
              ...defaultTags,
              Name: `${name}-nat-${i}`
            }
          }, { parent: this });
          this.natGateways.push(natGateway);
        }
      }

      // Create route tables
      const publicRouteTable = new aws.ec2.RouteTable(`${name}-public-rt`, {
        vpcId: this.vpc.id,
        tags: {
          ...defaultTags,
          Name: `${name}-public-rt`
        }
      }, { parent: this });

      // Add route to Internet Gateway
      new aws.ec2.Route(`${name}-public-route`, {
        routeTableId: publicRouteTable.id,
        destinationCidrBlock: '0.0.0.0/0',
        gatewayId: this.internetGateway.id
      }, { parent: this });

      // Associate public subnets with public route table
      this.publicSubnets.forEach((subnet, i) => {
        new aws.ec2.RouteTableAssociation(`${name}-public-rta-${i}`, {
          subnetId: subnet.id,
          routeTableId: publicRouteTable.id
        }, { parent: this });
      });

      // Create private route tables (one per AZ for HA)
      this.privateSubnets.forEach((subnet, i) => {
        const privateRouteTable = new aws.ec2.RouteTable(`${name}-private-rt-${i}`, {
          vpcId: this.vpc.id,
          tags: {
            ...defaultTags,
            Name: `${name}-private-rt-${i}`
          }
        }, { parent: this });

        // Add route to NAT Gateway if enabled
        if (args.enableNATGateway && this.natGateways[i]) {
          new aws.ec2.Route(`${name}-private-route-${i}`, {
            routeTableId: privateRouteTable.id,
            destinationCidrBlock: '0.0.0.0/0',
            natGatewayId: this.natGateways[i].id
          }, { parent: this });
        }

        // Associate private subnet with route table
        new aws.ec2.RouteTableAssociation(`${name}-private-rta-${i}`, {
          subnetId: subnet.id,
          routeTableId: privateRouteTable.id
        }, { parent: this });
      });

      // VPC Flow Logs (if enabled)
      if (args.enableFlowLogs) {
        const flowLogRole = new aws.iam.Role(`${name}-flow-log-role`, {
          assumeRolePolicy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [{
              Effect: 'Allow',
              Principal: {
                Service: 'vpc-flow-logs.amazonaws.com'
              },
              Action: 'sts:AssumeRole'
            }]
          }),
          tags: defaultTags
        }, { parent: this });

        const flowLogPolicy = new aws.iam.RolePolicy(`${name}-flow-log-policy`, {
          role: flowLogRole.id,
          policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [{
              Effect: 'Allow',
              Action: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
                'logs:DescribeLogGroups',
                'logs:DescribeLogStreams'
              ],
              Resource: '*'
            }]
          })
        }, { parent: this });

        const flowLogGroup = new aws.cloudwatch.LogGroup(`${name}-flow-logs`, {
          retentionInDays: 30,
          tags: defaultTags
        }, { parent: this });

        new aws.ec2.FlowLog(`${name}-vpc-flow-log`, {
          logDestinationType: 'cloud-watch-logs',
          logGroupName: flowLogGroup.name,
          iamRoleArn: flowLogRole.arn,
          vpcId: this.vpc.id,
          trafficType: 'ALL',
          tags: {
            ...defaultTags,
            Name: `${name}-vpc-flow-log`
          }
        }, { parent: this });
      }

      // Create VPC Endpoints for AWS Services
      const s3Endpoint = new aws.ec2.VpcEndpoint(`${name}-s3-endpoint`, {
        vpcId: this.vpc.id,
        serviceName: `com.amazonaws.${args.region}.s3`,
        routeTableIds: this.privateSubnets.map((_, i) => 
          pulumi.output(`${name}-private-rt-${i}`)
        ),
        tags: {
          ...defaultTags,
          Name: `${name}-s3-endpoint`
        }
      }, { parent: this });

      // Network ACLs for additional security
      const privateNetworkAcl = new aws.ec2.NetworkAcl(`${name}-private-nacl`, {
        vpcId: this.vpc.id,
        tags: {
          ...defaultTags,
          Name: `${name}-private-nacl`
        }
      }, { parent: this });

      // Allow inbound traffic from VPC
      new aws.ec2.NetworkAclRule(`${name}-private-nacl-inbound`, {
        networkAclId: privateNetworkAcl.id,
        ruleNumber: 100,
        protocol: '-1',
        ruleAction: 'allow',
        cidrBlock: args.cidrBlock,
        inbound: true
      }, { parent: this });

      // Allow outbound traffic
      new aws.ec2.NetworkAclRule(`${name}-private-nacl-outbound`, {
        networkAclId: privateNetworkAcl.id,
        ruleNumber: 100,
        protocol: '-1',
        ruleAction: 'allow',
        cidrBlock: '0.0.0.0/0',
        inbound: false
      }, { parent: this });

      // Associate NACLs with private subnets
      this.privateSubnets.forEach((subnet, i) => {
        new aws.ec2.NetworkAclAssociation(`${name}-private-nacl-assoc-${i}`, {
          networkAclId: privateNetworkAcl.id,
          subnetId: subnet.id
        }, { parent: this });
      });

      this.resourceCount = pulumi.output(
        3 + // VPC, IGW, S3 Endpoint
        args.availabilityZones * 2 + // Subnets
        (args.enableNATGateway ? args.availabilityZones * 2 : 0) + // NAT Gateways + EIPs
        (args.enableFlowLogs ? 4 : 0) + // Flow Logs resources
        args.availabilityZones * 2 + 1 + // Route Tables
        4 // NACLs and rules
      );

    } else if (args.provider.constructor.name.includes('Gcp')) {
      // GCP Network Implementation
      this.vpc = new gcp.compute.Network(`${name}-vpc`, {
        autoCreateSubnetworks: false,
        description: `VPC for ${args.environment} environment`,
        project: args.provider.project
      }, { parent: this });

      // Create subnets
      this.publicSubnets = [];
      this.privateSubnets = [];

      const subnet = new gcp.compute.Subnetwork(`${name}-subnet`, {
        network: this.vpc.id,
        ipCidrRange: args.cidrBlock,
        region: args.region,
        privateIpGoogleAccess: true,
        project: args.provider.project
      }, { parent: this });

      this.publicSubnets = [subnet];
      this.privateSubnets = [subnet];

      // Create Cloud Router for NAT
      if (args.enableNATGateway) {
        const router = new gcp.compute.Router(`${name}-router`, {
          network: this.vpc.id,
          region: args.region,
          project: args.provider.project
        }, { parent: this });

        const nat = new gcp.compute.RouterNat(`${name}-nat`, {
          router: router.name,
          region: args.region,
          natIpAllocateOption: 'AUTO_ONLY',
          sourceSubnetworkIpRangesToNat: 'ALL_SUBNETWORKS_ALL_IP_RANGES',
          project: args.provider.project
        }, { parent: this });

        this.natGateways = [nat];
      }

      this.resourceCount = pulumi.output(
        1 + // VPC
        1 + // Subnet
        (args.enableNATGateway ? 2 : 0) // Router + NAT
      );

    } else if (args.provider.constructor.name.includes('Azure')) {
      // Azure Network Implementation
      const resourceGroup = new azure.resources.ResourceGroup(`${name}-rg`, {
        location: args.region,
        tags: defaultTags
      }, { parent: this });

      this.vpc = new azure.network.VirtualNetwork(`${name}-vnet`, {
        resourceGroupName: resourceGroup.name,
        location: resourceGroup.location,
        addressSpace: {
          addressPrefixes: [args.cidrBlock]
        },
        tags: defaultTags
      }, { parent: this });

      // Create subnets
      this.publicSubnets = [];
      this.privateSubnets = [];

      for (let i = 0; i < args.availabilityZones; i++) {
        const publicSubnet = new azure.network.Subnet(`${name}-public-${i}`, {
          resourceGroupName: resourceGroup.name,
          virtualNetworkName: this.vpc.name,
          addressPrefix: `10.0.${i * 2}.0/24`
        }, { parent: this });
        this.publicSubnets.push(publicSubnet);

        const privateSubnet = new azure.network.Subnet(`${name}-private-${i}`, {
          resourceGroupName: resourceGroup.name,
          virtualNetworkName: this.vpc.name,
          addressPrefix: `10.0.${i * 2 + 1}.0/24`
        }, { parent: this });
        this.privateSubnets.push(privateSubnet);
      }

      // Create NAT Gateway if enabled
      if (args.enableNATGateway) {
        const publicIp = new azure.network.PublicIPAddress(`${name}-nat-ip`, {
          resourceGroupName: resourceGroup.name,
          location: resourceGroup.location,
          allocationMethod: 'Static',
          sku: {
            name: 'Standard'
          },
          tags: defaultTags
        }, { parent: this });

        const natGateway = new azure.network.NatGateway(`${name}-nat`, {
          resourceGroupName: resourceGroup.name,
          location: resourceGroup.location,
          sku: {
            name: 'Standard'
          },
          publicIpAddresses: [{
            id: publicIp.id
          }],
          tags: defaultTags
        }, { parent: this });

        this.natGateways = [natGateway];
      }

      this.resourceCount = pulumi.output(
        1 + // Resource Group
        1 + // VNet
        args.availabilityZones * 2 + // Subnets
        (args.enableNATGateway ? 2 : 0) // NAT Gateway + Public IP
      );
    }

    this.registerOutputs({
      vpc: this.vpc,
      publicSubnets: this.publicSubnets,
      privateSubnets: this.privateSubnets,
      natGateways: this.natGateways,
      internetGateway: this.internetGateway,
      resourceCount: this.resourceCount
    });
  }
}