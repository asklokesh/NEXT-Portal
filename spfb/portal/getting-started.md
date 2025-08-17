# Getting started with Portal for Backstage

## Checklist

Before you start, make sure you have the following:

- Your Admin password for Portal
- Your Portal License Key
- Access to GitHub
- Admin access to your GitHub organization
- Permission to configure GitHub App with required permissions

## Setup Wizard

The first time Portal is started, a Setup Wizard guides you through setting up authentication and determining at least one authorized user.

### GitHub Integration Options

You have two methods to enable GitHub integration:

1. [GitHub App](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/about-creating-github-apps) (Recommended)
2. [Personal Access Token (PAT)](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)

#### Repository Permissions Required for GitHub App

| Permission | Access Level | Why Required |
|-----------|--------------|--------------|
| Administration | Read / Write | Enables Portal to manage repository settings, webhooks, and collaborators |
| Actions | Read / Write | Allows Portal to view and trigger GitHub Actions workflows |
| Code scanning alerts | Read | Provides access to security vulnerabilities detected in code |
| ... (full table in original document) |

#### Alternative: Using Personal Access Tokens

Create a personal access token with these scopes:

- `read:user`
- `read:org`
- `user:email`
- `repo`

### Add Organizations and Administrators

> When using a personal access token, a user matching the auth providers username is automatically identified and added as an administrator.

## Setup Guide

After completing the Setup Wizard, you'll gain access to a comprehensive Setup Guide that provides:

- A detailed checklist of essential plugins
- Step-by-step configuration instructions
- Links to additional documentation
- Support resources and troubleshooting tips

## Personalization

When signed in to Portal, you can access the Config Manager at `/config-manager` to customize your experience.

### Key Personalization Features

- View and edit configuration
- Update company name
- Add authorized users
- Start/stop plugins
- Search configuration

## Onboarding Your Team

Portal's Software Catalog offers powerful team management capabilities that streamline the developer onboarding process:

### Team Discovery
- **Automatic Team Detection**: Portal automatically discovers teams from your GitHub organization structure
- **Role-Based Permissions**: Assign different access levels based on team membership
- **Team Dashboards**: Each team gets a dedicated dashboard showing their services, metrics, and recent activity

### Service Ownership
- **Clear Ownership Models**: Define and visualize who owns what services
- **Contact Information**: Automatically populate team contact details from GitHub
- **Escalation Paths**: Set up clear escalation procedures for incidents and support

### Developer Self-Service
- **Template Marketplace**: Provide developers with pre-approved service templates
- **Automated Workflows**: Enable self-service deployment and configuration
- **Documentation Integration**: Embed team-specific documentation and guides

## Advanced Configuration

### Environment Management
Portal supports multiple deployment environments out of the box:

- **Development**: Isolated environment for testing and experimentation
- **Staging**: Pre-production environment for validation
- **Production**: Live environment with enhanced monitoring and security

### Integration Ecosystem

#### CI/CD Integration
- **GitHub Actions**: Native support for GitHub workflows
- **Azure DevOps**: Comprehensive Azure integration
- **Jenkins**: Legacy CI/CD system support
- **GitLab CI**: Complete GitLab integration

#### Monitoring & Observability
- **Prometheus**: Metrics collection and alerting
- **Grafana**: Advanced dashboard and visualization
- **Datadog**: Enterprise monitoring and APM
- **New Relic**: Performance monitoring integration

#### Communication Tools
- **Slack**: Real-time notifications and incident management
- **Microsoft Teams**: Enterprise communication integration
- **PagerDuty**: Incident response and escalation
- **Jira**: Issue tracking and project management

## Security & Compliance

### Authentication Methods
- **SSO Integration**: Support for SAML, OIDC, and OAuth2
- **Multi-Factor Authentication**: Enhanced security with MFA
- **API Key Management**: Secure API access for integrations
- **Session Management**: Configurable session timeouts and policies

### Audit & Compliance
- **Audit Trails**: Comprehensive logging of all user actions
- **Compliance Reports**: SOC2, ISO27001, and GDPR compliance
- **Data Retention**: Configurable data retention policies
- **Access Reviews**: Regular access review and certification

## Troubleshooting

### Common Issues

#### Authentication Problems
- **SSO Configuration**: Verify SAML/OIDC settings and certificates
- **User Permissions**: Check role assignments and team memberships
- **Session Issues**: Clear browser cache and check session timeouts

#### Integration Failures
- **GitHub App Permissions**: Ensure all required permissions are granted
- **API Rate Limits**: Monitor and adjust API usage patterns
- **Network Connectivity**: Verify firewall and proxy configurations

#### Performance Issues
- **Database Performance**: Monitor query performance and indexing
- **Cache Configuration**: Optimize Redis and application-level caching
- **Resource Allocation**: Scale compute and memory resources as needed

### Getting Help

- **Support Portal**: Access our dedicated support portal at support.portal.spotify.com
- **Community Forum**: Join discussions at community.portal.spotify.com
- **Documentation**: Comprehensive guides at docs.portal.spotify.com
- **Status Page**: Check service status at status.portal.spotify.com

---

**Next Steps**: Once you've completed the initial setup, explore our [Portal Plugins](portal-plugins.md) to extend your platform capabilities.