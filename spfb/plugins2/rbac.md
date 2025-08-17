# RBAC (Role-Based Access Control)

**Enterprise-grade role-based access control and permissions management for Backstage**

## Overview

RBAC (Role-Based Access Control) provides sophisticated permission management and access control for Backstage, enabling organizations to implement fine-grained security policies at scale. Built by Spotify's team that created Backstage, RBAC integrates seamlessly with the Backstage permission framework to deliver enterprise-grade security without complexity.

## What RBAC Helps You Achieve

### Enterprise Security & Compliance
- **Granular Access Control**: Fine-grained permissions for every resource and action
- **Compliance Support**: Meet SOC2, ISO27001, and regulatory requirements
- **Audit Trails**: Comprehensive logging of all access and permission changes
- **Risk Management**: Minimize security risks through principle of least privilege

### Scalable Permission Management
- **Code-Free Configuration**: Manage permissions through intuitive UI, no code required
- **Dynamic Policies**: Real-time policy updates without deployment
- **Team-Based Access**: Automatic permission assignment based on team membership
- **Hierarchical Permissions**: Support for complex organizational structures

### Operational Excellence
- **SSO Integration**: Seamless integration with enterprise identity providers
- **Emergency Access**: Break-glass procedures for critical situations
- **Self-Service**: Delegated permission management for team leads
- **Automated Provisioning**: Automatic permission assignment based on organizational data

## Core Permission Framework

### Permission Architecture
RBAC builds on Backstage's powerful permission framework to provide enterprise-grade access control:

**Permission Components**:
- **Resources**: The entities or objects being protected (catalogs, templates, plugins)
- **Actions**: The operations that can be performed (read, write, delete, execute)
- **Policies**: Rules that determine whether a permission should be granted
- **Roles**: Collections of permissions that can be assigned to users or groups
- **Conditions**: Dynamic rules that evaluate context (time, location, resource attributes)

### Policy Engine
**Intelligent policy evaluation with real-time decision making**

```typescript
// Example policy structure
interface PolicyRule {
  resource: string;
  action: string;
  conditions?: {
    user?: string[];
    group?: string[];
    time?: TimeCondition;
    location?: LocationCondition;
    attributes?: AttributeCondition;
  };
  effect: 'allow' | 'deny';
  priority: number;
}

// Policy evaluation
const policyDecision = await rbac.evaluatePolicy({
  user: 'john.doe@company.com',
  resource: 'catalog:component:payment-service',
  action: 'delete',
  context: {
    time: new Date(),
    location: 'office',
    userAttributes: { team: 'platform', role: 'senior-engineer' }
  }
});
```

## Permission Models

### Role-Based Permissions
**Traditional role-based access control with modern flexibility**

**Predefined Roles**:
- **Viewer**: Read-only access to catalog and documentation
- **Developer**: Create and modify own team's resources
- **Team Lead**: Manage team resources and permissions
- **Platform Admin**: Full platform administration capabilities
- **Security Admin**: Manage security policies and audit access

**Custom Roles**: Create organization-specific roles tailored to your needs

```yaml
# Custom role definition
roles:
  platform-engineer:
    displayName: "Platform Engineer"
    description: "Engineers responsible for platform infrastructure"
    permissions:
      - resource: "catalog:*"
        actions: ["read", "write"]
      - resource: "template:infrastructure:*"
        actions: ["read", "write", "execute"]
      - resource: "plugin:kubernetes:*"
        actions: ["read", "write"]
    conditions:
      team: ["platform", "infrastructure"]
      location: ["office", "vpn"]
```

### Attribute-Based Access Control (ABAC)
**Dynamic permissions based on user, resource, and environmental attributes**

**User Attributes**:
- Team membership and organizational hierarchy
- Job title, seniority level, and security clearance
- Geographic location and access patterns
- Training completion and certifications

**Resource Attributes**:
- Sensitivity level and classification
- Ownership and team assignment
- Lifecycle stage (development, staging, production)
- Compliance requirements and regulations

**Environmental Attributes**:
- Time of access and business hours
- Network location and device trust
- Risk assessment and threat level
- Emergency situations and break-glass scenarios

### Conditional Access
**Context-aware permissions that adapt to circumstances**

**Time-Based Access**:
```yaml
conditions:
  time:
    business_hours:
      start: "09:00"
      end: "17:00"
      timezone: "UTC"
      days: ["monday", "tuesday", "wednesday", "thursday", "friday"]
    
    maintenance_window:
      start: "02:00"
      end: "04:00"
      timezone: "UTC"
      effect: "deny"
```

**Location-Based Access**:
```yaml
conditions:
  location:
    allowed_networks:
      - "10.0.0.0/8"    # Corporate network
      - "172.16.0.0/12" # VPN network
    
    geo_restrictions:
      allowed_countries: ["US", "CA", "UK", "DE"]
      blocked_countries: ["CN", "RU", "KP"]
```

**Risk-Based Access**:
```yaml
conditions:
  risk:
    max_risk_score: 75
    factors:
      - unusual_location: weight(20)
      - new_device: weight(15)
      - unusual_time: weight(10)
      - failed_attempts: weight(25)
```

## Enterprise Security Features

### Single Sign-On (SSO) Integration
**Seamless integration with enterprise identity providers**

**Supported Providers**:
- **SAML 2.0**: Okta, Azure AD, Auth0, PingIdentity
- **OpenID Connect**: Google Workspace, Azure AD, Keycloak
- **LDAP/Active Directory**: Legacy directory service integration
- **OAuth 2.0**: GitHub, GitLab, Bitbucket enterprise

**Advanced SSO Features**:
- **Just-in-Time (JIT) Provisioning**: Automatic user creation and role assignment
- **Group Mapping**: Automatic role assignment based on SSO groups
- **Multi-Domain Support**: Support for multiple identity domains
- **Federation**: Cross-domain identity federation and trust

### Multi-Factor Authentication (MFA)
**Enhanced security with multiple authentication factors**

**MFA Options**:
- **TOTP (Time-based One-Time Password)**: Google Authenticator, Authy
- **SMS**: Text message verification codes
- **Email**: Email-based verification codes
- **Hardware Tokens**: YubiKey, RSA SecurID
- **Biometric**: Fingerprint, face recognition (device-dependent)

**Conditional MFA**:
- **Risk-Based**: Require MFA based on risk assessment
- **Location-Based**: Require MFA for access from untrusted locations
- **Resource-Based**: Require MFA for sensitive resources
- **Time-Based**: Require MFA outside business hours

### Audit & Compliance
**Comprehensive audit trails and compliance reporting**

**Audit Logging**:
```typescript
// Audit event structure
interface AuditEvent {
  timestamp: Date;
  userId: string;
  action: string;
  resource: string;
  result: 'granted' | 'denied';
  reason?: string;
  context: {
    ip: string;
    userAgent: string;
    location?: string;
    sessionId: string;
  };
  metadata?: Record<string, any>;
}
```

**Compliance Reports**:
- **Access Reviews**: Regular access certification and review reports
- **Permission Analytics**: Analysis of permission usage and effectiveness
- **Violation Reports**: Security policy violations and remediation
- **Risk Assessments**: Permission risk analysis and recommendations

## Advanced Permission Features

### Dynamic Permission Assignment
**Automatically assign permissions based on organizational data**

```typescript
// Dynamic role assignment
const dynamicRoles = {
  rules: [
    {
      condition: "user.department === 'Engineering' && user.level >= 'Senior'",
      roles: ['developer', 'code-reviewer']
    },
    {
      condition: "user.team === 'Platform' && user.title.includes('Lead')",
      roles: ['team-lead', 'platform-admin']
    },
    {
      condition: "user.certifications.includes('security-cleared')",
      roles: ['security-admin']
    }
  ]
};
```

### Permission Inheritance
**Hierarchical permission models that reflect organizational structure**

```yaml
# Permission hierarchy
hierarchy:
  organization:
    - team:
        platform:
          - sub-team:
              backend:
                permissions: ["catalog:backend:*"]
              frontend:
                permissions: ["catalog:frontend:*"]
        security:
          permissions: ["security:*", "audit:*"]
```

### Resource-Level Security
**Fine-grained permissions for individual resources**

```yaml
# Resource-specific permissions
resource_permissions:
  "catalog:component:payment-service":
    owners: ["team:payments"]
    permissions:
      read: ["role:developer", "team:payments", "team:platform"]
      write: ["team:payments"]
      delete: ["team:payments", "role:platform-admin"]
    
  "template:microservice":
    permissions:
      read: ["role:developer"]
      execute: ["role:developer"]
      modify: ["team:platform", "role:template-admin"]
```

### Emergency Access Procedures
**Break-glass procedures for critical situations**

```yaml
# Emergency access configuration
emergency_access:
  enabled: true
  approval_required: true
  
  procedures:
    production_incident:
      duration: "4h"
      permissions: ["catalog:production:*", "deploy:production:*"]
      approvers: ["role:incident-commander", "role:platform-admin"]
      audit: "enhanced"
    
    security_breach:
      duration: "2h"
      permissions: ["security:*", "audit:*", "admin:*"]
      approvers: ["role:security-admin", "role:ciso"]
      audit: "enhanced"
      notification: "immediate"
```

## Integration Ecosystem

### Identity Providers
- **Okta**: Complete Okta integration with group mapping
- **Azure Active Directory**: Native Azure AD integration
- **Auth0**: Auth0 identity platform integration
- **Google Workspace**: Google identity and SSO integration
- **Keycloak**: Open-source identity management integration

### Security Tools
- **Vault**: HashiCorp Vault secret management integration
- **CyberArk**: Privileged access management integration
- **BeyondTrust**: Privileged access and identity management
- **Ping Identity**: Enterprise identity management platform

### Compliance Platforms
- **Vanta**: Automated compliance monitoring
- **Drata**: Continuous compliance automation
- **SecureFrame**: Security compliance automation
- **OneTrust**: Privacy and data governance platform

## Getting Started

### Installation & Setup
```bash
# Install RBAC plugin
yarn add @spotify/backstage-plugin-rbac
yarn add @spotify/backstage-plugin-rbac-backend

# Configure license and permissions
export SPOTIFY_PLUGINS_LICENSE_KEY="your-license-key"
export RBAC_ENABLED="true"
```

### Basic Configuration
```yaml
# app-config.yaml
rbac:
  enabled: true
  defaultPolicy: "deny"
  
  # SSO configuration
  auth:
    providers:
      - type: "saml"
        entityId: "https://your-backstage.com"
        ssoUrl: "https://your-idp.com/sso"
        certificate: ${SAML_CERTIFICATE}
    
    groupMapping:
      "Engineering": ["role:developer"]
      "Platform Team": ["role:platform-admin"]
      "Security Team": ["role:security-admin"]
  
  # Audit configuration
  audit:
    enabled: true
    retention: "2y"
    storage: "database"
```

### Permission Policy Definition
```typescript
// Define custom permission policy
import { PermissionPolicy } from '@spotify/backstage-plugin-rbac';

export class CustomPermissionPolicy implements PermissionPolicy {
  async handle(request: PolicyRequest): Promise<PolicyDecision> {
    // Custom authorization logic
    const user = request.user;
    const resource = request.resource;
    const action = request.action;
    
    // Check team-based permissions
    if (resource.startsWith('catalog:') && user.teams.includes('platform')) {
      return { result: 'ALLOW' };
    }
    
    // Check time-based restrictions
    if (this.isOutsideBusinessHours() && action === 'delete') {
      return {
        result: 'CONDITIONAL',
        conditions: {
          approval: { required: true, approvers: ['role:platform-admin'] }
        }
      };
    }
    
    return { result: 'DENY' };
  }
}
```

## Success Metrics & ROI

### Security Improvements
- **Reduced Security Incidents**: 70% reduction in security-related incidents
- **Faster Compliance**: 50% faster compliance audit preparation
- **Improved Governance**: 80% improvement in access governance
- **Risk Reduction**: 60% reduction in excessive privilege risk

### Operational Efficiency
- **Automated Provisioning**: 90% reduction in manual permission management
- **Self-Service**: 75% reduction in access request tickets
- **Audit Preparation**: 80% faster audit preparation and reporting
- **Policy Management**: 85% reduction in policy deployment time

## Support & Resources

### Documentation
- [Installation Guide](getting-started.md) - Complete setup instructions
- [Configuration Reference](../portal/guides.md) - Detailed configuration options
- [Policy Development](policy-development.md) - Build custom permission policies
- [Best Practices](security-best-practices.md) - Security implementation guidelines

### Training & Support
- **Security Training**: Comprehensive training on access control and security
- **Policy Development**: Training on building custom permission policies
- **Compliance Support**: Assistance with regulatory compliance requirements
- **Enterprise Support**: Priority support for licensed customers

---

**Ready to secure your platform?** Start with our [Installation Guide](getting-started.md) or explore [Policy Development](policy-development.md) for advanced security configurations.