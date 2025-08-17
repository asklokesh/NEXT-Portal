# Troubleshooting Guide

**Comprehensive troubleshooting guide for Spotify Portal for Backstage Beta**

This guide provides solutions for common issues, performance optimization, and enterprise-specific troubleshooting scenarios. Use the quick navigation below to find solutions for your specific issue.

## Quick Issue Resolution

### Emergency Contacts
- **Critical Issues**: [Emergency Support](mailto:emergency@portal.spotify.com) - 24/7 response
- **Security Incidents**: [Security Team](mailto:security@portal.spotify.com) - Immediate response
- **Platform Outages**: [Status Page](https://status.portal.spotify.com) - Real-time status
- **Enterprise Support**: [Support Portal](https://support.portal.spotify.com) - Priority queue

### Diagnostic Tools
```bash
# Portal health check
portal-cli health check --verbose

# System diagnostics
portal-cli diagnostics --export-logs

# Configuration validation
portal-cli config validate --fix-issues

# Performance analysis
portal-cli performance analyze --detailed
```

## Authentication & Access Control

### Authentication Configuration Issues

#### Problem: Authentication Provider Misconfiguration
**Symptoms**:
- Users unable to log in
- "Authentication failed" errors
- Redirect loops after login attempts
- SSO integration not working

**Emergency Recovery**:
```bash
# Enable recovery mode
portal-cli auth recovery enable

# Access using root credentials
# Navigate to: https://your-portal.com/admin/recovery
# Login with: admin / [recovery-password]
```

**Detailed Resolution**:
1. **Verify SSO Configuration**:
   ```yaml
   # app-config.yaml
   auth:
     providers:
       saml:
         development:
           entryPoint: 'https://your-idp.com/sso'
           issuer: 'https://your-portal.com'
           cert: '${SAML_CERTIFICATE}'
           # Verify these URLs match your IdP configuration
   ```

2. **Check Certificate Validity**:
   ```bash
   # Validate SAML certificate
   openssl x509 -in certificate.pem -text -noout
   
   # Check certificate expiration
   openssl x509 -in certificate.pem -dates -noout
   ```

3. **Test Authentication Flow**:
   ```bash
   # Test SSO configuration
   portal-cli auth test-sso --provider saml
   
   # Verify user resolution
   portal-cli auth test-user-resolution --email user@company.com
   ```

#### Problem: User Identity Resolution Failures
**Error Message**: `Login failed; caused by Error: Failed to sign-in, unable to resolve user identity`

**Root Causes & Solutions**:

1. **Missing User Entity in Catalog**:
   ```yaml
   # Create user entity in catalog
   apiVersion: backstage.io/v1alpha1
   kind: User
   metadata:
     name: john.doe
     title: John Doe
   spec:
     profile:
       email: john.doe@company.com
       displayName: John Doe
     memberOf:
       - team-alpha
   ```

2. **Sign-in Resolver Configuration**:
   ```typescript
   // Custom sign-in resolver
   export const customSignInResolver: SignInResolver<SAMLResult> = async (
     info,
     ctx,
   ) => {
     const { email } = info.profile;
     
     // Ensure email extraction is correct
     if (!email) {
       throw new Error('Email not found in SAML response');
     }
     
     // Return consistent user reference
     return ctx.issueToken({
       claims: {
         sub: email.toLowerCase(), // Ensure consistent casing
         ent: [email],
       },
     });
   };
   ```

3. **User Provisioning Automation**:
   ```typescript
   // Auto-provision users from SSO
   export class UserProvisioningProcessor implements CatalogProcessor {
     async preProcessEntity(entity: Entity): Promise<Entity> {
       if (entity.kind === 'User') {
         // Auto-populate missing fields from SSO data
         const ssoData = await this.fetchSSOUserData(entity.metadata.name);
         return {
           ...entity,
           spec: {
             ...entity.spec,
             profile: {
               ...entity.spec?.profile,
               ...ssoData.profile,
             },
           },
         };
       }
       return entity;
     }
   }
   ```

### Role-Based Access Control (RBAC) Issues

#### Problem: Insufficient Permissions
**Symptoms**:
- "Access Denied" errors
- Missing UI elements or navigation items
- API calls returning 403 Forbidden

**Diagnostic Steps**:
```bash
# Check user permissions
portal-cli rbac check-permissions --user john.doe@company.com

# Audit permission policies
portal-cli rbac audit-policies --detailed

# Test specific permission
portal-cli rbac test-permission \
  --user john.doe@company.com \
  --resource catalog:component:payment-service \
  --action read
```

**Common Solutions**:

1. **Permission Policy Configuration**:
   ```typescript
   // Comprehensive RBAC policy
   export class CompanyPermissionPolicy implements PermissionPolicy {
     async handle(request: PolicyRequest): Promise<PolicyDecision> {
       const { user, permission } = request;
       
       // Admin users have full access
       if (user.identity.ownershipEntityRefs.includes('group:admin')) {
         return { result: AuthorizeResult.ALLOW };
       }
       
       // Team-based access control
       if (permission.resourceRef?.startsWith('catalog:component:')) {
         const component = await this.catalogApi.getEntityByRef(permission.resourceRef);
         const owner = component?.spec?.owner;
         
         if (user.identity.ownershipEntityRefs.includes(owner)) {
           return { result: AuthorizeResult.ALLOW };
         }
       }
       
       return { result: AuthorizeResult.DENY };
     }
   }
   ```

2. **Group Membership Synchronization**:
   ```bash
   # Sync groups from Active Directory
   portal-cli auth sync-groups --provider ldap --force
   
   # Verify group memberships
   portal-cli auth list-groups --user john.doe@company.com
   ```

#### Problem: Config Manager Access Denied
**Solution**: Verify authorized users configuration

```yaml
# app-config.yaml
portal:
  authorizedUsers:
    - john.doe@company.com
    - admin@company.com
    - group:platform-admins
```

## Software Catalog Issues

### Entity Discovery & Ingestion

#### Problem: Missing or Outdated Entities
**Symptoms**:
- Services not appearing in catalog
- Outdated metadata or relationships
- Broken entity links or references

**Diagnostic Commands**:
```bash
# Check entity providers status
portal-cli catalog providers status

# Force entity refresh
portal-cli catalog refresh --provider github --force

# Validate entity definitions
portal-cli catalog validate --path /path/to/catalog-info.yaml

# Check processing errors
portal-cli catalog errors --detailed
```

**Common Solutions**:

1. **GitHub Integration Issues**:
   ```bash
   # Verify GitHub App permissions
   portal-cli github check-permissions --org your-org
   
   # Test repository access
   portal-cli github test-access --repo your-org/your-repo
   
   # Check webhook configuration
   portal-cli github webhooks status --org your-org
   ```

2. **Entity Processing Errors**:
   ```typescript
   // Custom entity processor with error handling
   export class RobustEntityProcessor implements CatalogProcessor {
     async preProcessEntity(
       entity: Entity,
       location: LocationSpec,
       emit: CatalogProcessorEmit,
     ): Promise<Entity> {
       try {
         // Validate required fields
         if (!entity.metadata?.name) {
           throw new Error('Entity name is required');
         }
         
         // Normalize entity data
         const normalizedEntity = {
           ...entity,
           metadata: {
             ...entity.metadata,
             name: entity.metadata.name.toLowerCase(),
           },
         };
         
         return normalizedEntity;
       } catch (error) {
         // Emit error for monitoring
         emit(processingResult.generalError(location, error.message));
         throw error;
       }
     }
   }
   ```

3. **Performance Optimization**:
   ```yaml
   # Optimize catalog refresh intervals
   catalog:
     providers:
       github:
         development:
           schedule:
             frequency: { minutes: 30 }
             timeout: { minutes: 3 }
   ```

### Team Management Issues

#### Problem: Multiple Team Representations
**Scenario**: Same logical team appears multiple times in different contexts

**Understanding the Issue**:
- **Logical Team**: Real-world team (e.g., "Platform Engineering")
- **GitHub Team**: GitHub organization representation (e.g., "platform-eng")
- **Backstage Team**: Catalog entity derived from various sources

**Resolution Strategy**:

1. **Team Consolidation**:
   ```yaml
   # Create canonical team entity
   apiVersion: backstage.io/v1alpha1
   kind: Group
   metadata:
     name: platform-engineering
     title: Platform Engineering
     description: Platform and infrastructure engineering team
     annotations:
       github.com/team-slug: platform-eng
       company.com/cost-center: CC-001
   spec:
     type: team
     children: []
     members:
       - john.doe
       - jane.smith
   ```

2. **Automated Team Synchronization**:
   ```typescript
   // Team synchronization processor
   export class TeamSyncProcessor implements CatalogProcessor {
     async preProcessEntity(entity: Entity): Promise<Entity> {
       if (entity.kind === 'Group' && entity.spec?.type === 'team') {
         // Merge data from multiple sources
         const githubData = await this.fetchGitHubTeamData(entity.metadata.name);
         const hrData = await this.fetchHRTeamData(entity.metadata.name);
         
         return {
           ...entity,
           metadata: {
             ...entity.metadata,
             annotations: {
               ...entity.metadata.annotations,
               'github.com/team-slug': githubData.slug,
               'company.com/cost-center': hrData.costCenter,
             },
           },
           spec: {
             ...entity.spec,
             members: [...new Set([...entity.spec.members, ...githubData.members])],
           },
         };
       }
       return entity;
     }
   }
   ```

## Performance Issues

### Slow Page Load Times

#### Problem: Portal Pages Loading Slowly
**Symptoms**:
- Page load times > 3 seconds
- Timeouts during navigation
- Unresponsive user interface

**Performance Diagnostics**:
```bash
# Performance analysis
portal-cli performance analyze --page /catalog --detailed

# Database query analysis
portal-cli database analyze-queries --slow-only

# Cache hit rate analysis
portal-cli cache analyze --provider redis

# Bundle size analysis
portal-cli frontend bundle-analyze
```

**Optimization Solutions**:

1. **Database Optimization**:
   ```sql
   -- Add performance indexes
   CREATE INDEX CONCURRENTLY idx_catalog_entity_kind_name 
   ON catalog_entities(entity_kind, entity_name);
   
   CREATE INDEX CONCURRENTLY idx_catalog_entity_owner 
   ON catalog_entities((entity_spec->>'owner'));
   
   -- Analyze table statistics
   ANALYZE catalog_entities;
   ```

2. **Caching Configuration**:
   ```yaml
   # Enhanced caching configuration
   backend:
     cache:
       redis:
         host: redis.company.com
         port: 6379
         ttl: 3600
       
     database:
       connection:
         pool:
           min: 5
           max: 20
           acquireTimeoutMillis: 60000
   ```

3. **Frontend Optimization**:
   ```typescript
   // Lazy loading for heavy components
   const HeavyComponent = React.lazy(() => import('./HeavyComponent'));
   
   // Memoization for expensive computations
   const expensiveValue = useMemo(() => {
     return computeExpensiveValue(props.data);
   }, [props.data]);
   
   // Virtual scrolling for large lists
   import { FixedSizeList as List } from 'react-window';
   ```

### Memory Issues

#### Problem: High Memory Usage
**Symptoms**:
- Portal becoming unresponsive
- Out of memory errors
- Container restarts in Kubernetes

**Memory Diagnostics**:
```bash
# Memory usage analysis
portal-cli diagnostics memory --heap-dump

# Identify memory leaks
portal-cli diagnostics memory-leaks --duration 300s

# Check garbage collection
portal-cli diagnostics gc-analysis
```

**Memory Optimization**:

1. **Node.js Memory Configuration**:
   ```bash
   # Increase Node.js heap size
   export NODE_OPTIONS="--max-old-space-size=4096"
   
   # Enable garbage collection logging
   export NODE_OPTIONS="--trace-gc --trace-gc-verbose"
   ```

2. **Connection Pool Optimization**:
   ```yaml
   # Optimize database connections
   backend:
     database:
       connection:
         pool:
           min: 2
           max: 10
           idleTimeoutMillis: 30000
   ```

## Plugin-Specific Issues

### Soundcheck Plugin Issues

#### Problem: Checks Not Running
**Symptoms**:
- Quality checks showing "Unknown" status
- Checks failing with timeout errors
- Missing check results

**Diagnostic Steps**:
```bash
# Check Soundcheck service status
portal-cli soundcheck status

# Test individual checks
portal-cli soundcheck test-check --check-id basic-health --entity component:payment-service

# View check logs
portal-cli soundcheck logs --check-id security-scan --follow
```

**Solutions**:

1. **Check Configuration Validation**:
   ```yaml
   # Validate Soundcheck configuration
   soundcheck:
     checks:
       basic-health:
         factRetriever:
           type: 'file'
           path: 'README.md'
         rule:
           operator: 'exists'
   ```

2. **Fact Collector Troubleshooting**:
   ```typescript
   // Custom fact collector with error handling
   export class RobustFactCollector implements FactCollector {
     async collect(entity: Entity): Promise<Fact[]> {
       try {
         const facts = await this.collectFacts(entity);
         return facts;
       } catch (error) {
         this.logger.error(`Fact collection failed for ${entity.metadata.name}:`, error);
         return [];
       }
     }
   }
   ```

### Insights Plugin Issues

#### Problem: Analytics Data Not Appearing
**Symptoms**:
- Empty analytics dashboards
- "No data available" messages
- Missing usage metrics

**Troubleshooting Steps**:
```bash
# Check Insights data collection
portal-cli insights status

# Verify data pipeline
portal-cli insights pipeline status

# Test analytics endpoints
portal-cli insights test-endpoints
```

**Solutions**:

1. **Data Collection Configuration**:
   ```yaml
   # Ensure analytics tracking is enabled
   insights:
     enabled: true
     tracking:
       pageViews: true
       userActions: true
       apiCalls: true
   ```

2. **Data Pipeline Validation**:
   ```bash
   # Check data ingestion
   portal-cli insights validate-ingestion --days 7
   
   # Rebuild analytics cache
   portal-cli insights rebuild-cache --force
   ```

## Network & Connectivity Issues

### External Integration Failures

#### Problem: GitHub Integration Not Working
**Symptoms**:
- Repository data not syncing
- "GitHub API rate limit exceeded" errors
- Authentication failures with GitHub

**Troubleshooting Steps**:
```bash
# Check GitHub API connectivity
portal-cli github test-connection

# Verify API rate limits
portal-cli github rate-limit-status

# Test GitHub App permissions
portal-cli github test-permissions --org your-org
```

**Solutions**:

1. **GitHub App Configuration**:
   ```yaml
   # Optimize GitHub integration
   integrations:
     github:
       - host: github.com
         apps:
           - appId: ${GITHUB_APP_ID}
             privateKey: ${GITHUB_PRIVATE_KEY}
             webhookSecret: ${GITHUB_WEBHOOK_SECRET}
             clientId: ${GITHUB_CLIENT_ID}
             clientSecret: ${GITHUB_CLIENT_SECRET}
   ```

2. **Rate Limiting Optimization**:
   ```typescript
   // Implement intelligent rate limiting
   export class GitHubRateLimiter {
     private static instance: GitHubRateLimiter;
     private rateLimitRemaining = 5000;
     private resetTime = new Date();
     
     async executeWithRateLimit<T>(operation: () => Promise<T>): Promise<T> {
       if (this.rateLimitRemaining < 100) {
         const waitTime = this.resetTime.getTime() - Date.now();
         if (waitTime > 0) {
           await new Promise(resolve => setTimeout(resolve, waitTime));
         }
       }
       
       const result = await operation();
       this.updateRateLimitInfo();
       return result;
     }
   }
   ```

### Proxy and Firewall Issues

#### Problem: Corporate Firewall Blocking Requests
**Symptoms**:
- Timeout errors for external APIs
- "Network unreachable" errors
- SSL certificate validation failures

**Solutions**:

1. **Proxy Configuration**:
   ```bash
   # Configure HTTP proxy
   export HTTP_PROXY=http://proxy.company.com:8080
   export HTTPS_PROXY=http://proxy.company.com:8080
   export NO_PROXY=localhost,127.0.0.1,.company.com
   ```

2. **SSL Certificate Configuration**:
   ```yaml
   # Custom CA certificate configuration
   backend:
     https:
       certificate:
         ca: |
           -----BEGIN CERTIFICATE-----
           [Your corporate CA certificate]
           -----END CERTIFICATE-----
   ```

## Security Issues

### SSL/TLS Certificate Problems

#### Problem: Certificate Validation Errors
**Symptoms**:
- "Certificate verification failed" errors
- "Unable to verify the first certificate" messages
- HTTPS connection failures

**Solutions**:

1. **Certificate Chain Validation**:
   ```bash
   # Verify certificate chain
   openssl s_client -connect your-portal.com:443 -showcerts
   
   # Check certificate expiration
   openssl x509 -in certificate.pem -dates -noout
   ```

2. **Custom Certificate Configuration**:
   ```yaml
   # Custom SSL configuration
   backend:
     https:
       certificate:
         cert: ${SSL_CERTIFICATE}
         key: ${SSL_PRIVATE_KEY}
         ca: ${SSL_CA_CERTIFICATE}
   ```

### Security Scanning Issues

#### Problem: Vulnerability Scanner False Positives
**Symptoms**:
- High number of false positive security alerts
- Critical vulnerabilities in dependencies
- Security scan failures

**Solutions**:

1. **Vulnerability Management**:
   ```bash
   # Update dependencies
   yarn audit fix
   
   # Check for security updates
   portal-cli security scan --fix-available
   
   # Generate security report
   portal-cli security report --format pdf
   ```

2. **False Positive Management**:
   ```yaml
   # Configure vulnerability exceptions
   security:
     vulnerability:
       exceptions:
         - cve: "CVE-2023-12345"
           reason: "False positive - not applicable to our use case"
           expires: "2025-12-31"
   ```

## Monitoring & Alerting

### Health Check Failures

#### Problem: Health Checks Reporting Unhealthy Status
**Symptoms**:
- Health endpoint returning 503 errors
- Load balancer removing instances from rotation
- Monitoring alerts for service degradation

**Diagnostic Commands**:
```bash
# Comprehensive health check
portal-cli health check --all-services --detailed

# Check individual service health
portal-cli health check --service catalog --verbose

# Test external dependencies
portal-cli health check --external-deps
```

**Health Check Configuration**:
```typescript
// Comprehensive health check implementation
export class PortalHealthCheck implements HealthCheck {
  async getHealth(): Promise<{ status: number; payload?: any }> {
    const checks = {
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
      github: await this.checkGitHub(),
      plugins: await this.checkPlugins(),
    };
    
    const failures = Object.entries(checks)
      .filter(([_, result]) => !result.healthy)
      .map(([name, result]) => ({ name, error: result.error }));
    
    if (failures.length > 0) {
      return {
        status: 503,
        payload: {
          status: 'unhealthy',
          failures,
          timestamp: new Date().toISOString(),
        },
      };
    }
    
    return {
      status: 200,
      payload: {
        status: 'healthy',
        checks,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
```

## Emergency Procedures

### Disaster Recovery

#### Complete Platform Outage Recovery
**Emergency Steps**:

1. **Assessment**:
   ```bash
   # Check infrastructure status
   portal-cli infrastructure status --all
   
   # Verify database connectivity
   portal-cli database ping --timeout 10s
   
   # Check external dependencies
   portal-cli dependencies health-check
   ```

2. **Recovery Procedures**:
   ```bash
   # Restore from backup
   portal-cli backup restore --backup-id latest --confirm
   
   # Restart all services
   portal-cli services restart --all --wait
   
   # Validate system health
   portal-cli validate --comprehensive
   ```

3. **Communication**:
   ```bash
   # Notify stakeholders
   portal-cli incident notify --severity critical --template outage
   
   # Update status page
   portal-cli status update --message "Recovery in progress"
   ```

### Data Corruption Recovery

#### Database Corruption Issues
**Recovery Steps**:

1. **Stop All Services**:
   ```bash
   # Graceful shutdown
   portal-cli services stop --graceful --timeout 60s
   ```

2. **Restore from Backup**:
   ```bash
   # List available backups
   portal-cli backup list --detailed
   
   # Restore from point-in-time backup
   portal-cli backup restore \
     --timestamp "2025-03-15T10:00:00Z" \
     --validate-integrity
   ```

3. **Verify Data Integrity**:
   ```bash
   # Run data integrity checks
   portal-cli database integrity-check --fix-issues
   
   # Rebuild search indexes
   portal-cli search rebuild-index --all
   ```

## Performance Monitoring

### Key Performance Indicators

#### Critical Metrics to Monitor
```bash
# Response time monitoring
portal-cli metrics response-time --percentile 95

# Error rate monitoring
portal-cli metrics error-rate --timeframe 1h

# Resource utilization
portal-cli metrics resources --detailed

# User experience metrics
portal-cli metrics user-experience --core-web-vitals
```

#### Alerting Configuration
```yaml
# Monitoring and alerting configuration
monitoring:
  alerts:
    response_time:
      threshold: 2000ms
      severity: warning
    error_rate:
      threshold: 5%
      severity: critical
    memory_usage:
      threshold: 80%
      severity: warning
    disk_usage:
      threshold: 90%
      severity: critical
```

## Getting Additional Help

### Support Channels

#### Enterprise Support
- **24/7 Emergency Support**: [+1-800-SPOTIFY](tel:+18007768439)
- **Support Portal**: [support.portal.spotify.com](https://support.portal.spotify.com)
- **Dedicated Slack Channel**: Enterprise customers receive dedicated support channels
- **Video Support**: Screen sharing and remote assistance available

#### Community Support
- **Community Forum**: [community.portal.spotify.com](https://community.portal.spotify.com)
- **Discord Server**: [discord.gg/backstage-portal](https://discord.gg/backstage-portal)
- **Stack Overflow**: Tag questions with `spotify-portal` and `backstage`
- **GitHub Discussions**: [github.com/spotify/portal/discussions](https://github.com/spotify/portal/discussions)

### Professional Services

#### Implementation Support
- **Migration Services**: Expert assistance for migrating from other platforms
- **Custom Integration**: Development of organization-specific integrations
- **Performance Optimization**: Expert performance tuning and optimization
- **Security Hardening**: Comprehensive security assessment and hardening

#### Training & Certification
- **Administrator Training**: Comprehensive platform administration training
- **Developer Training**: Plugin development and customization training
- **End-User Training**: Training for developers using the platform
- **Certification Programs**: Official Portal administrator certification

### Documentation Resources

#### Complete Documentation
- **[Installation Guide](getting-started.md)**: Complete setup and installation guide
- **[Configuration Reference](guides.md)**: Comprehensive configuration documentation
- **[Security Guide](security.md)**: Security best practices and configuration
- **[Plugin Development](portal-plugins.md)**: Plugin development and customization

#### Video Tutorials
- **Platform Overview**: Introduction to Portal capabilities and features
- **Installation Walkthrough**: Step-by-step installation demonstration
- **Advanced Configuration**: Complex configuration scenarios and best practices
- **Troubleshooting Workshop**: Common issues and resolution techniques

---

**Need immediate assistance?** Contact our [Emergency Support](mailto:emergency@portal.spotify.com) for critical issues or visit our [Support Portal](https://support.portal.spotify.com) for comprehensive assistance.