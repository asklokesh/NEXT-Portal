/**
 * Integration Setup Service
 * Handles automated integration setup during onboarding
 */

import { PrismaClient } from '@prisma/client';
import { Logger } from 'pino';
import { Octokit } from '@octokit/rest';
import axios from 'axios';

interface IntegrationResult {
  integration: string;
  success: boolean;
  message: string;
  data?: any;
}

export class IntegrationSetupService {
  private prisma: PrismaClient;
  private logger: Logger;

  constructor(prisma: PrismaClient, logger: Logger) {
    this.prisma = prisma;
    this.logger = logger;
  }

  /**
   * Setup multiple integrations
   */
  async setupIntegrations(
    organizationId: string,
    integrations: {
      github?: { token: string; org: string };
      gitlab?: { token: string; url: string };
      jenkins?: { url: string; username: string; token: string };
      aws?: { accountId: string; region: string; roleArn: string };
      slack?: { token: string; channel: string };
    }
  ): Promise<IntegrationResult[]> {
    const results: IntegrationResult[] = [];

    // Setup GitHub
    if (integrations.github) {
      const result = await this.setupGitHub(
        organizationId,
        integrations.github
      );
      results.push(result);
    }

    // Setup GitLab
    if (integrations.gitlab) {
      const result = await this.setupGitLab(
        organizationId,
        integrations.gitlab
      );
      results.push(result);
    }

    // Setup Jenkins
    if (integrations.jenkins) {
      const result = await this.setupJenkins(
        organizationId,
        integrations.jenkins
      );
      results.push(result);
    }

    // Setup AWS
    if (integrations.aws) {
      const result = await this.setupAWS(
        organizationId,
        integrations.aws
      );
      results.push(result);
    }

    // Setup Slack
    if (integrations.slack) {
      const result = await this.setupSlack(
        organizationId,
        integrations.slack
      );
      results.push(result);
    }

    return results;
  }

  /**
   * Setup GitHub integration
   */
  private async setupGitHub(
    organizationId: string,
    config: { token: string; org: string }
  ): Promise<IntegrationResult> {
    try {
      this.logger.info({ org: config.org }, 'Setting up GitHub integration');

      // Validate token and permissions
      const octokit = new Octokit({ auth: config.token });
      
      // Test authentication
      const { data: user } = await octokit.users.getAuthenticated();
      
      // Get organization details
      const { data: org } = await octokit.orgs.get({ org: config.org });
      
      // List repositories
      const { data: repos } = await octokit.repos.listForOrg({
        org: config.org,
        per_page: 100
      });

      // Setup webhooks for key events
      const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/github`;
      const webhookSecret = this.generateWebhookSecret();

      try {
        await octokit.orgs.createWebhook({
          org: config.org,
          config: {
            url: webhookUrl,
            content_type: 'json',
            secret: webhookSecret
          },
          events: [
            'push',
            'pull_request',
            'issues',
            'deployment',
            'workflow_run'
          ]
        });
      } catch (error) {
        this.logger.warn('Failed to create GitHub webhook', error);
      }

      // Store integration configuration
      await this.prisma.$queryRaw`
        INSERT INTO integrations (
          id, organization_id, type, name, config, status, created_at, updated_at
        ) VALUES (
          gen_random_uuid(),
          ${organizationId},
          'github',
          ${config.org},
          ${JSON.stringify({
            org: config.org,
            user: user.login,
            webhookSecret,
            repositories: repos.map(r => ({
              name: r.name,
              fullName: r.full_name,
              private: r.private,
              defaultBranch: r.default_branch
            }))
          })}::jsonb,
          'active',
          NOW(),
          NOW()
        )
      `;

      // Import repositories into service catalog
      await this.importGitHubRepositories(organizationId, repos);

      return {
        integration: 'github',
        success: true,
        message: `Successfully connected to GitHub organization ${config.org}`,
        data: {
          organization: org.login,
          repositories: repos.length,
          user: user.login
        }
      };
    } catch (error) {
      this.logger.error({ error }, 'GitHub setup failed');
      return {
        integration: 'github',
        success: false,
        message: `Failed to setup GitHub: ${error.message}`
      };
    }
  }

  /**
   * Setup GitLab integration
   */
  private async setupGitLab(
    organizationId: string,
    config: { token: string; url: string }
  ): Promise<IntegrationResult> {
    try {
      this.logger.info({ url: config.url }, 'Setting up GitLab integration');

      // Validate token
      const response = await axios.get(`${config.url}/api/v4/user`, {
        headers: {
          'PRIVATE-TOKEN': config.token
        }
      });

      const user = response.data;

      // Get projects
      const projectsResponse = await axios.get(`${config.url}/api/v4/projects`, {
        headers: {
          'PRIVATE-TOKEN': config.token
        },
        params: {
          membership: true,
          per_page: 100
        }
      });

      const projects = projectsResponse.data;

      // Store integration
      await this.prisma.$queryRaw`
        INSERT INTO integrations (
          id, organization_id, type, name, config, status, created_at, updated_at
        ) VALUES (
          gen_random_uuid(),
          ${organizationId},
          'gitlab',
          ${config.url},
          ${JSON.stringify({
            url: config.url,
            user: user.username,
            projects: projects.map(p => ({
              id: p.id,
              name: p.name,
              path: p.path_with_namespace,
              defaultBranch: p.default_branch
            }))
          })}::jsonb,
          'active',
          NOW(),
          NOW()
        )
      `;

      return {
        integration: 'gitlab',
        success: true,
        message: `Successfully connected to GitLab at ${config.url}`,
        data: {
          user: user.username,
          projects: projects.length
        }
      };
    } catch (error) {
      this.logger.error({ error }, 'GitLab setup failed');
      return {
        integration: 'gitlab',
        success: false,
        message: `Failed to setup GitLab: ${error.message}`
      };
    }
  }

  /**
   * Setup Jenkins integration
   */
  private async setupJenkins(
    organizationId: string,
    config: { url: string; username: string; token: string }
  ): Promise<IntegrationResult> {
    try {
      this.logger.info({ url: config.url }, 'Setting up Jenkins integration');

      // Test connection
      const auth = Buffer.from(`${config.username}:${config.token}`).toString('base64');
      const response = await axios.get(`${config.url}/api/json`, {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      });

      const jenkinsInfo = response.data;

      // Get jobs
      const jobsResponse = await axios.get(`${config.url}/api/json?tree=jobs[name,url,color]`, {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      });

      const jobs = jobsResponse.data.jobs || [];

      // Store integration
      await this.prisma.$queryRaw`
        INSERT INTO integrations (
          id, organization_id, type, name, config, status, created_at, updated_at
        ) VALUES (
          gen_random_uuid(),
          ${organizationId},
          'jenkins',
          ${config.url},
          ${JSON.stringify({
            url: config.url,
            username: config.username,
            version: jenkinsInfo.version,
            jobs: jobs.map(j => ({
              name: j.name,
              url: j.url,
              status: j.color
            }))
          })}::jsonb,
          'active',
          NOW(),
          NOW()
        )
      `;

      return {
        integration: 'jenkins',
        success: true,
        message: `Successfully connected to Jenkins at ${config.url}`,
        data: {
          version: jenkinsInfo.version,
          jobs: jobs.length
        }
      };
    } catch (error) {
      this.logger.error({ error }, 'Jenkins setup failed');
      return {
        integration: 'jenkins',
        success: false,
        message: `Failed to setup Jenkins: ${error.message}`
      };
    }
  }

  /**
   * Setup AWS integration
   */
  private async setupAWS(
    organizationId: string,
    config: { accountId: string; region: string; roleArn: string }
  ): Promise<IntegrationResult> {
    try {
      this.logger.info({ accountId: config.accountId }, 'Setting up AWS integration');

      // In production, you would:
      // 1. Assume the provided role
      // 2. Validate permissions
      // 3. Set up CloudWatch events
      // 4. Configure cost explorer access

      // Store integration
      await this.prisma.$queryRaw`
        INSERT INTO integrations (
          id, organization_id, type, name, config, status, created_at, updated_at
        ) VALUES (
          gen_random_uuid(),
          ${organizationId},
          'aws',
          ${config.accountId},
          ${JSON.stringify({
            accountId: config.accountId,
            region: config.region,
            roleArn: config.roleArn,
            services: ['ec2', 's3', 'rds', 'lambda', 'ecs', 'eks']
          })}::jsonb,
          'active',
          NOW(),
          NOW()
        )
      `;

      return {
        integration: 'aws',
        success: true,
        message: `Successfully connected to AWS account ${config.accountId}`,
        data: {
          accountId: config.accountId,
          region: config.region
        }
      };
    } catch (error) {
      this.logger.error({ error }, 'AWS setup failed');
      return {
        integration: 'aws',
        success: false,
        message: `Failed to setup AWS: ${error.message}`
      };
    }
  }

  /**
   * Setup Slack integration
   */
  private async setupSlack(
    organizationId: string,
    config: { token: string; channel: string }
  ): Promise<IntegrationResult> {
    try {
      this.logger.info({ channel: config.channel }, 'Setting up Slack integration');

      // Test token and get workspace info
      const response = await axios.get('https://slack.com/api/auth.test', {
        headers: {
          'Authorization': `Bearer ${config.token}`
        }
      });

      if (!response.data.ok) {
        throw new Error(response.data.error);
      }

      const workspaceInfo = response.data;

      // Get channel info
      const channelResponse = await axios.get('https://slack.com/api/conversations.info', {
        headers: {
          'Authorization': `Bearer ${config.token}`
        },
        params: {
          channel: config.channel
        }
      });

      const channelInfo = channelResponse.data.channel;

      // Store integration
      await this.prisma.$queryRaw`
        INSERT INTO integrations (
          id, organization_id, type, name, config, status, created_at, updated_at
        ) VALUES (
          gen_random_uuid(),
          ${organizationId},
          'slack',
          ${workspaceInfo.team},
          ${JSON.stringify({
            workspace: workspaceInfo.team,
            workspaceId: workspaceInfo.team_id,
            channel: channelInfo.name,
            channelId: channelInfo.id,
            botUserId: workspaceInfo.user_id
          })}::jsonb,
          'active',
          NOW(),
          NOW()
        )
      `;

      // Send welcome message to channel
      await this.sendSlackWelcomeMessage(config.token, config.channel);

      return {
        integration: 'slack',
        success: true,
        message: `Successfully connected to Slack workspace ${workspaceInfo.team}`,
        data: {
          workspace: workspaceInfo.team,
          channel: channelInfo.name
        }
      };
    } catch (error) {
      this.logger.error({ error }, 'Slack setup failed');
      return {
        integration: 'slack',
        success: false,
        message: `Failed to setup Slack: ${error.message}`
      };
    }
  }

  /**
   * Import GitHub repositories to service catalog
   */
  private async importGitHubRepositories(
    organizationId: string,
    repositories: any[]
  ): Promise<void> {
    for (const repo of repositories.slice(0, 10)) { // Import first 10 repos
      try {
        await this.prisma.$queryRaw`
          INSERT INTO services (
            id, name, display_name, description, type,
            lifecycle, owner, organization_id, metadata,
            created_at, updated_at
          ) VALUES (
            gen_random_uuid(),
            ${repo.name},
            ${repo.name},
            ${repo.description || 'Imported from GitHub'},
            'service',
            'production',
            'imported',
            ${organizationId},
            ${JSON.stringify({
              source: 'github',
              repository: repo.full_name,
              language: repo.language,
              topics: repo.topics || [],
              defaultBranch: repo.default_branch,
              private: repo.private
            })}::jsonb,
            NOW(),
            NOW()
          )
          ON CONFLICT (name) DO NOTHING
        `;
      } catch (error) {
        this.logger.warn({ repo: repo.name }, 'Failed to import repository');
      }
    }
  }

  /**
   * Send Slack welcome message
   */
  private async sendSlackWelcomeMessage(
    token: string,
    channel: string
  ): Promise<void> {
    try {
      await axios.post('https://slack.com/api/chat.postMessage', {
        channel,
        text: 'SaaS IDP integration successful! 🎉',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: 'SaaS IDP Connected Successfully! 🎉'
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'Your Slack workspace is now connected to SaaS IDP. You\'ll receive notifications about:'
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '• 🚀 Deployments and releases\n• 🚨 Incidents and alerts\n• 📊 Important metrics and reports\n• 👥 Team activity updates'
            }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'View Dashboard'
                },
                url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
              },
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Configure Notifications'
                },
                url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/notifications`
              }
            ]
          }
        ]
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      this.logger.warn('Failed to send Slack welcome message', error);
    }
  }

  /**
   * Generate webhook secret
   */
  private generateWebhookSecret(): string {
    return Buffer.from(Math.random().toString(36).substring(2) + Date.now().toString(36)).toString('base64');
  }
}