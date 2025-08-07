import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const execAsync = promisify(exec);

interface Tenant {
  id: string;
  name: string;
  organizationId: string;
  environment: 'development' | 'staging' | 'production';
  isolation: 'namespace' | 'cluster' | 'vpc';
  resources: TenantResources;
  networking: NetworkingConfig;
  security: SecurityConfig;
  plugins: string[];
  createdAt: string;
  status: 'active' | 'suspended' | 'terminating';
}

interface TenantResources {
  cpu: {
    limit: string;
    request: string;
  };
  memory: {
    limit: string;
    request: string;
  };
  storage: {
    limit: string;
    class: string;
  };
  replicas: {
    min: number;
    max: number;
  };
}

interface NetworkingConfig {
  vpcId?: string;
  subnetIds?: string[];
  securityGroupIds?: string[];
  ingressRules: IngressRule[];
  egressRules: EgressRule[];
  serviceMesh: boolean;
  networkPolicies: NetworkPolicy[];
}

interface IngressRule {
  from: string;
  to: string;
  ports: number[];
  protocol: 'tcp' | 'udp' | 'icmp';
}

interface EgressRule {
  to: string;
  ports: number[];
  protocol: 'tcp' | 'udp' | 'icmp';
}

interface NetworkPolicy {
  name: string;
  type: 'ingress' | 'egress';
  rules: string[];
}

interface SecurityConfig {
  rbac: {
    enabled: boolean;
    roles: Role[];
  };
  secrets: {
    encryption: 'aes256' | 'rsa4096';
    rotation: boolean;
    rotationDays: number;
  };
  audit: {
    enabled: boolean;
    level: 'basic' | 'request' | 'requestResponse';
  };
  compliance: {
    standards: string[]; // ['SOC2', 'HIPAA', 'GDPR', 'PCI-DSS']
    scanning: boolean;
  };
}

interface Role {
  name: string;
  permissions: string[];
  users: string[];
  serviceAccounts: string[];
}

// Kubernetes namespace manifest for tenant isolation
const createTenantNamespace = (tenant: Tenant) => {
  return `
apiVersion: v1
kind: Namespace
metadata:
  name: tenant-${tenant.id}
  labels:
    tenant: ${tenant.id}
    organization: ${tenant.organizationId}
    environment: ${tenant.environment}
    backstage.io/tenant: "true"
  annotations:
    scheduler.alpha.kubernetes.io/node-selector: tenant=${tenant.id}
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: tenant-quota
  namespace: tenant-${tenant.id}
spec:
  hard:
    requests.cpu: "${tenant.resources.cpu.request}"
    requests.memory: "${tenant.resources.memory.request}"
    limits.cpu: "${tenant.resources.cpu.limit}"
    limits.memory: "${tenant.resources.memory.limit}"
    requests.storage: "${tenant.resources.storage.limit}"
    persistentvolumeclaims: "10"
    services.loadbalancers: "2"
    services.nodeports: "0"
---
apiVersion: v1
kind: LimitRange
metadata:
  name: tenant-limits
  namespace: tenant-${tenant.id}
spec:
  limits:
  - max:
      cpu: "${tenant.resources.cpu.limit}"
      memory: "${tenant.resources.memory.limit}"
    min:
      cpu: "100m"
      memory: "128Mi"
    default:
      cpu: "500m"
      memory: "512Mi"
    defaultRequest:
      cpu: "250m"
      memory: "256Mi"
    type: Container
  - max:
      storage: "${tenant.resources.storage.limit}"
    min:
      storage: "1Gi"
    type: PersistentVolumeClaim
`;
};

// Network policy for tenant isolation
const createNetworkPolicy = (tenant: Tenant) => {
  return `
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: tenant-network-policy
  namespace: tenant-${tenant.id}
spec:
  podSelector:
    matchLabels:
      tenant: ${tenant.id}
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          tenant: ${tenant.id}
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    - namespaceSelector:
        matchLabels:
          name: monitoring
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          tenant: ${tenant.id}
    - namespaceSelector:
        matchLabels:
          name: kube-system
    - namespaceSelector:
        matchLabels:
          name: external-services
  - to:
    - podSelector: {}
    ports:
    - protocol: TCP
      port: 53
    - protocol: UDP
      port: 53
`;
};

// RBAC configuration for tenant
const createRBACConfig = (tenant: Tenant) => {
  const roles = tenant.security.rbac.roles.map(role => `
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: ${role.name}
  namespace: tenant-${tenant.id}
rules:
${role.permissions.map(perm => {
  const [resource, verb] = perm.split(':');
  return `- apiGroups: [""]
  resources: ["${resource}"]
  verbs: ["${verb}"]`;
}).join('\n')}
`).join('');

  const roleBindings = tenant.security.rbac.roles.map(role => `
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: ${role.name}-binding
  namespace: tenant-${tenant.id}
subjects:
${role.users.map(user => `- kind: User
  name: ${user}
  apiGroup: rbac.authorization.k8s.io`).join('\n')}
${role.serviceAccounts.map(sa => `- kind: ServiceAccount
  name: ${sa}
  namespace: tenant-${tenant.id}`).join('\n')}
roleRef:
  kind: Role
  name: ${role.name}
  apiGroup: rbac.authorization.k8s.io
`).join('');

  return roles + roleBindings;
};

// Service mesh configuration (Istio)
const createServiceMeshConfig = (tenant: Tenant) => {
  return `
apiVersion: networking.istio.io/v1alpha3
kind: Sidecar
metadata:
  name: default
  namespace: tenant-${tenant.id}
spec:
  egress:
  - hosts:
    - "./*"
    - "istio-system/*"
    - "tenant-${tenant.id}/*"
---
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: tenant-${tenant.id}
spec:
  mtls:
    mode: STRICT
---
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: tenant-authz
  namespace: tenant-${tenant.id}
spec:
  rules:
  - from:
    - source:
        namespaces: ["tenant-${tenant.id}"]
  - from:
    - source:
        namespaces: ["istio-system"]
  - to:
    - operation:
        methods: ["GET", "POST", "PUT", "DELETE"]
`;
};

// Vault configuration for secrets management
const createVaultConfig = (tenant: Tenant) => {
  const vaultPath = `secret/tenants/${tenant.id}`;
  
  return {
    path: vaultPath,
    policies: [
      {
        name: `tenant-${tenant.id}-read`,
        rules: `
path "${vaultPath}/*" {
  capabilities = ["read", "list"]
}
`
      },
      {
        name: `tenant-${tenant.id}-write`,
        rules: `
path "${vaultPath}/*" {
  capabilities = ["create", "update", "delete", "list", "read"]
}
`
      }
    ],
    auth: {
      kubernetes: {
        role: `tenant-${tenant.id}`,
        boundServiceAccountNames: [`default`, `backstage-sa`],
        boundServiceAccountNamespaces: [`tenant-${tenant.id}`],
        policies: [`tenant-${tenant.id}-read`],
        ttl: '24h'
      }
    }
  };
};

// Create isolated Docker network for local development
const createDockerNetwork = async (tenant: Tenant) => {
  const networkName = `tenant-${tenant.id}-network`;
  
  try {
    // Create isolated network
    await execAsync(`docker network create --driver bridge --subnet=172.${20 + Math.floor(Math.random() * 200)}.0.0/16 --ip-range=172.${20 + Math.floor(Math.random() * 200)}.1.0/24 --attachable ${networkName}`);
    
    return {
      name: networkName,
      driver: 'bridge',
      isolated: true
    };
  } catch (error) {
    console.error('Error creating Docker network:', error);
    throw error;
  }
};

// Deploy tenant resources
const deployTenant = async (tenant: Tenant) => {
  const manifests = [];
  
  // Create namespace and resource quotas
  manifests.push(createTenantNamespace(tenant));
  
  // Add network policies
  if (tenant.networking.networkPolicies.length > 0) {
    manifests.push(createNetworkPolicy(tenant));
  }
  
  // Add RBAC if enabled
  if (tenant.security.rbac.enabled) {
    manifests.push(createRBACConfig(tenant));
  }
  
  // Add service mesh configuration
  if (tenant.networking.serviceMesh) {
    manifests.push(createServiceMeshConfig(tenant));
  }
  
  // Write manifests to file
  const manifestPath = path.join(process.cwd(), 'tenants', tenant.id, 'manifests.yaml');
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, manifests.join('\n---\n'));
  
  // Apply to Kubernetes
  if (tenant.isolation === 'namespace' || tenant.isolation === 'cluster') {
    try {
      await execAsync(`kubectl apply -f ${manifestPath}`);
    } catch (error) {
      console.error('Error applying Kubernetes manifests:', error);
      // For local development, create Docker network instead
      if (process.env.NODE_ENV === 'development') {
        await createDockerNetwork(tenant);
      }
    }
  }
  
  return {
    manifestPath,
    deployed: true
  };
};

// Monitor tenant resources
const monitorTenant = async (tenantId: string) => {
  try {
    // Get resource usage from Kubernetes
    const { stdout: podMetrics } = await execAsync(`kubectl top pods -n tenant-${tenantId} --no-headers`);
    const { stdout: nodeMetrics } = await execAsync(`kubectl top nodes -l tenant=${tenantId} --no-headers`);
    
    // Parse metrics
    const pods = podMetrics.split('\n').filter(line => line.trim()).map(line => {
      const [name, cpu, memory] = line.trim().split(/\s+/);
      return { name, cpu, memory };
    });
    
    const nodes = nodeMetrics.split('\n').filter(line => line.trim()).map(line => {
      const [name, cpu, cpuPercent, memory, memoryPercent] = line.trim().split(/\s+/);
      return { name, cpu, cpuPercent, memory, memoryPercent };
    });
    
    return {
      pods,
      nodes,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    // Fallback for local development
    return {
      pods: [],
      nodes: [],
      timestamp: new Date().toISOString(),
      error: 'Metrics not available in local environment'
    };
  }
};

// Tenant lifecycle management
const tenantStore = new Map<string, Tenant>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create_tenant': {
        const { name, organizationId, environment, isolation, resources, networking, security } = body;
        
        const tenant: Tenant = {
          id: crypto.randomBytes(8).toString('hex'),
          name,
          organizationId,
          environment: environment || 'development',
          isolation: isolation || 'namespace',
          resources: resources || {
            cpu: { limit: '2', request: '500m' },
            memory: { limit: '4Gi', request: '1Gi' },
            storage: { limit: '10Gi', class: 'standard' },
            replicas: { min: 1, max: 3 }
          },
          networking: networking || {
            ingressRules: [],
            egressRules: [],
            serviceMesh: false,
            networkPolicies: []
          },
          security: security || {
            rbac: {
              enabled: true,
              roles: [
                {
                  name: 'tenant-admin',
                  permissions: ['pods:*', 'services:*', 'configmaps:*', 'secrets:*'],
                  users: [`admin@${organizationId}`],
                  serviceAccounts: ['default']
                }
              ]
            },
            secrets: {
              encryption: 'aes256',
              rotation: true,
              rotationDays: 90
            },
            audit: {
              enabled: true,
              level: 'basic'
            },
            compliance: {
              standards: [],
              scanning: false
            }
          },
          plugins: [],
          createdAt: new Date().toISOString(),
          status: 'active'
        };
        
        // Deploy tenant resources
        const deployment = await deployTenant(tenant);
        
        // Store tenant
        tenantStore.set(tenant.id, tenant);
        
        // Create Vault configuration if using secrets management
        const vaultConfig = createVaultConfig(tenant);
        
        return NextResponse.json({
          success: true,
          tenant,
          deployment,
          vaultConfig
        });
      }

      case 'update_tenant': {
        const { tenantId, updates } = body;
        const tenant = tenantStore.get(tenantId);
        
        if (!tenant) {
          return NextResponse.json({
            success: false,
            error: 'Tenant not found'
          }, { status: 404 });
        }
        
        // Update tenant configuration
        Object.assign(tenant, updates);
        
        // Redeploy if resource or security changes
        if (updates.resources || updates.security || updates.networking) {
          await deployTenant(tenant);
        }
        
        tenantStore.set(tenantId, tenant);
        
        return NextResponse.json({
          success: true,
          tenant
        });
      }

      case 'delete_tenant': {
        const { tenantId } = body;
        const tenant = tenantStore.get(tenantId);
        
        if (!tenant) {
          return NextResponse.json({
            success: false,
            error: 'Tenant not found'
          }, { status: 404 });
        }
        
        // Mark as terminating
        tenant.status = 'terminating';
        
        // Delete Kubernetes resources
        try {
          await execAsync(`kubectl delete namespace tenant-${tenantId}`);
        } catch (error) {
          // Try Docker cleanup for local
          await execAsync(`docker network rm tenant-${tenantId}-network`);
        }
        
        // Remove from store
        tenantStore.delete(tenantId);
        
        return NextResponse.json({
          success: true,
          message: `Tenant ${tenantId} deleted`
        });
      }

      case 'assign_plugin': {
        const { tenantId, pluginId } = body;
        const tenant = tenantStore.get(tenantId);
        
        if (!tenant) {
          return NextResponse.json({
            success: false,
            error: 'Tenant not found'
          }, { status: 404 });
        }
        
        // Add plugin to tenant
        if (!tenant.plugins.includes(pluginId)) {
          tenant.plugins.push(pluginId);
        }
        
        // Deploy plugin in tenant namespace
        const deployCommand = `kubectl apply -f plugin-${pluginId}.yaml -n tenant-${tenantId}`;
        
        try {
          await execAsync(deployCommand);
        } catch (error) {
          console.error('Error deploying plugin to tenant:', error);
        }
        
        tenantStore.set(tenantId, tenant);
        
        return NextResponse.json({
          success: true,
          tenant
        });
      }

      case 'tenant_metrics': {
        const { tenantId } = body;
        const metrics = await monitorTenant(tenantId);
        
        return NextResponse.json({
          success: true,
          metrics
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Multi-tenancy API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process multi-tenancy request'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'list_tenants': {
        const organizationId = searchParams.get('organizationId');
        const tenants = Array.from(tenantStore.values()).filter(
          t => !organizationId || t.organizationId === organizationId
        );
        
        return NextResponse.json({
          success: true,
          tenants
        });
      }

      case 'get_tenant': {
        const tenantId = searchParams.get('tenantId');
        const tenant = tenantStore.get(tenantId!);
        
        if (!tenant) {
          return NextResponse.json({
            success: false,
            error: 'Tenant not found'
          }, { status: 404 });
        }
        
        // Get current metrics
        const metrics = await monitorTenant(tenantId!);
        
        return NextResponse.json({
          success: true,
          tenant,
          metrics
        });
      }

      case 'compliance_report': {
        const tenantId = searchParams.get('tenantId');
        const tenant = tenantStore.get(tenantId!);
        
        if (!tenant) {
          return NextResponse.json({
            success: false,
            error: 'Tenant not found'
          }, { status: 404 });
        }
        
        // Generate compliance report
        const report = {
          tenantId,
          standards: tenant.security.compliance.standards,
          checks: {
            encryption: tenant.security.secrets.encryption === 'aes256' || tenant.security.secrets.encryption === 'rsa4096',
            rbac: tenant.security.rbac.enabled,
            audit: tenant.security.audit.enabled,
            networkIsolation: tenant.networking.networkPolicies.length > 0,
            secretsRotation: tenant.security.secrets.rotation
          },
          score: 0,
          recommendations: []
        };
        
        // Calculate compliance score
        const checksPassed = Object.values(report.checks).filter(Boolean).length;
        report.score = (checksPassed / Object.keys(report.checks).length) * 100;
        
        // Add recommendations
        if (!report.checks.encryption) {
          report.recommendations.push('Enable strong encryption (AES256 or RSA4096)');
        }
        if (!report.checks.rbac) {
          report.recommendations.push('Enable Role-Based Access Control');
        }
        if (!report.checks.networkIsolation) {
          report.recommendations.push('Implement network policies for isolation');
        }
        
        return NextResponse.json({
          success: true,
          report
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Multi-tenancy API GET error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch multi-tenancy data'
    }, { status: 500 });
  }
}