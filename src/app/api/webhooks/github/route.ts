import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { webhookManager } from '@/lib/sync/WebhookManager';
import Redis from 'ioredis';

// Enhanced real-time event system imports
import { RealtimeEventService } from '@/lib/events/realtime-event-service';
import { PluginQualityService } from '@/lib/plugins/quality-service';
import { SecurityScanService } from '@/lib/security/security-scan-service';
import { NotificationService } from '@/lib/notifications/notification-service';

// Redis for event distribution and caching
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  enableAutoPipelining: true,
  db: 1 // Use different DB for events
});

// GitHub webhook event schemas
const GitHubBaseEventSchema = z.object({
  action: z.string().optional(),
  repository: z.object({
    id: z.number(),
    name: z.string(),
    full_name: z.string(),
    html_url: z.string(),
    default_branch: z.string(),
    private: z.boolean(),
    owner: z.object({
      login: z.string(),
      id: z.number(),
      type: z.string(),
    }),
  }).optional(),
  sender: z.object({
    login: z.string(),
    id: z.number(),
    type: z.string(),
  }),
  installation: z.object({
    id: z.number(),
  }).optional(),
});

const GitHubPushEventSchema = GitHubBaseEventSchema.extend({
  ref: z.string(),
  before: z.string(),
  after: z.string(),
  commits: z.array(z.object({
    id: z.string(),
    message: z.string(),
    author: z.object({
      name: z.string(),
      email: z.string(),
    }),
    added: z.array(z.string()),
    removed: z.array(z.string()),
    modified: z.array(z.string()),
  })),
  head_commit: z.object({
    id: z.string(),
    message: z.string(),
    author: z.object({
      name: z.string(),
      email: z.string(),
    }),
  }).nullable(),
});

const GitHubPullRequestEventSchema = GitHubBaseEventSchema.extend({
  number: z.number(),
  pull_request: z.object({
    id: z.number(),
    number: z.number(),
    title: z.string(),
    body: z.string().nullable(),
    state: z.string(),
    html_url: z.string(),
    head: z.object({
      ref: z.string(),
      sha: z.string(),
      repo: z.object({
        name: z.string(),
        full_name: z.string(),
      }).nullable(),
    }),
    base: z.object({
      ref: z.string(),
      sha: z.string(),
    }),
    user: z.object({
      login: z.string(),
      id: z.number(),
    }),
  }),
});

const GitHubReleaseEventSchema = GitHubBaseEventSchema.extend({
  release: z.object({
    id: z.number(),
    tag_name: z.string(),
    name: z.string(),
    body: z.string().nullable(),
    draft: z.boolean(),
    prerelease: z.boolean(),
    html_url: z.string(),
    published_at: z.string().nullable(),
  }),
});

// Rate limiting
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = {
  maxRequests: 100,
  windowMs: 60000, // 1 minute
};

function checkRateLimit(clientId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const current = rateLimitStore.get(clientId);

  if (!current || now >= current.resetTime) {
    rateLimitStore.set(clientId, {
      count: 1,
      resetTime: now + RATE_LIMIT.windowMs,
    });
    return { allowed: true, remaining: RATE_LIMIT.maxRequests - 1 };
  }

  const remaining = Math.max(0, RATE_LIMIT.maxRequests - current.count);
  if (remaining === 0) {
    return { allowed: false, remaining: 0 };
  }

  current.count++;
  return { allowed: true, remaining: remaining - 1 };
}

function verifyGitHubSignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !signature.startsWith('sha256=')) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');

  const providedSignature = signature.slice(7); // Remove 'sha256=' prefix

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

// Helper function to detect Backstage plugin repositories
async function isBackstagePluginRepository(repository: any): Promise<boolean> {
  // Check repository name patterns
  if (repository.name.includes('backstage-plugin') || 
      repository.name.includes('plugin-') ||
      repository.full_name.includes('backstage') ||
      repository.name.startsWith('@backstage/') ||
      repository.name.includes('roadiehq')) {
    return true;
  }

  // Check repository description
  if (repository.description && 
      (repository.description.toLowerCase().includes('backstage') ||
       repository.description.toLowerCase().includes('plugin') ||
       repository.description.toLowerCase().includes('internal developer platform'))) {
    return true;
  }

  // Check topics/tags
  if (repository.topics && repository.topics.some((topic: string) => 
    topic.includes('backstage') || 
    topic.includes('plugin') ||
    topic.includes('internal-developer-platform') ||
    topic.includes('idp') ||
    topic.includes('developer-experience')
  )) {
    return true;
  }

  // Language and ecosystem hints
  if (repository.language === 'TypeScript' || repository.language === 'JavaScript') {
    // Could implement additional package.json checking here
    // For now, use heuristics based on naming
    return repository.name.includes('backstage') || repository.name.includes('plugin');
  }

  return false;
}

async function processRepositoryEvent(eventType: string, payload: any): Promise<void> {
  const repository = payload.repository;
  if (!repository) return;

  const realtimeEvents = RealtimeEventService.getInstance();
  const isPluginRepo = await isBackstagePluginRepository(repository);

  // Check if this repository contains Backstage catalog files
  const catalogFiles = [
    'catalog-info.yaml',
    'catalog-info.yml',
    '.backstage/catalog-info.yaml',
    'backstage.yaml',
    'backstage.yml',
  ];

  try {
    // For now, we'll assume the repository has catalog files
    // In a real implementation, you'd check the repository contents
    const hasCatalogFiles = true;

    if (hasCatalogFiles) {
      await webhookManager.sendEvent('catalog.repository.updated', {
        repository: {
          id: repository.id,
          name: repository.name,
          fullName: repository.full_name,
          url: repository.html_url,
          defaultBranch: repository.default_branch,
          private: repository.private,
          owner: repository.owner,
        },
        eventType,
        isPluginRepo,
        timestamp: Date.now(),
      });

      // Real-time notification for repository events affecting plugins
      if (isPluginRepo) {
        await realtimeEvents.broadcast('plugin.repository.event', {
          eventType,
          repository: {
            id: repository.id,
            name: repository.name,
            fullName: repository.full_name,
            url: repository.html_url,
            private: repository.private,
            owner: repository.owner
          },
          timestamp: new Date().toISOString()
        });
      }
    }
  } catch (error) {
    console.error('Error processing repository event:', error);
  }
}

async function processPushEvent(payload: z.infer<typeof GitHubPushEventSchema>): Promise<void> {
  const { repository, ref, commits, head_commit } = payload;
  
  if (!repository || !commits.length) return;

  const realtimeEvents = RealtimeEventService.getInstance();
  const qualityService = new PluginQualityService();
  const securityScan = new SecurityScanService();
  const notifications = new NotificationService();

  // Check if this is a Backstage plugin repository
  const isPluginRepo = await isBackstagePluginRepository(repository);
  const branchName = ref.replace('refs/heads/', '');
  const isMainBranch = branchName === 'main' || branchName === 'master';

  // Check if push affects catalog files
  const catalogFilesChanged = commits.some(commit =>
    [...commit.added, ...commit.modified, ...commit.removed].some(file =>
      file.includes('catalog-info.') || 
      file.includes('backstage.') ||
      file.includes('.backstage/')
    )
  );

  // Check for package.json changes (for dependency security scanning)
  const hasPackageChanges = commits.some(commit =>
    [...commit.added, ...commit.modified].some(file => 
      file.includes('package.json') || file.includes('yarn.lock') || file.includes('package-lock.json')
    )
  );

  // Enhanced real-time processing for plugin repositories
  if (isPluginRepo) {
    console.log(`Processing plugin repository update: ${repository.full_name}`);
    
    // Immediate real-time broadcast
    await realtimeEvents.broadcast('plugin.repository.updated', {
      repository: {
        id: repository.id,
        name: repository.name,
        fullName: repository.full_name,
        url: repository.html_url,
        private: repository.private,
        owner: repository.owner
      },
      ref,
      branch: branchName,
      commits: commits.map(commit => ({
        id: commit.id,
        message: commit.message,
        author: commit.author,
        filesChanged: {
          added: commit.added,
          modified: commit.modified,
          removed: commit.removed
        }
      })),
      headCommit: head_commit,
      isMainBranch,
      catalogFilesChanged,
      hasPackageChanges,
      timestamp: new Date().toISOString()
    });

    // Trigger quality re-evaluation for main branch changes
    if (isMainBranch) {
      console.log(`Triggering quality re-evaluation for ${repository.full_name}`);
      
      await redis.lpush('quality_assessment_queue', JSON.stringify({
        type: 'repository_update',
        repository: {
          id: repository.id,
          name: repository.name,
          fullName: repository.full_name,
          url: repository.html_url
        },
        commitId: head_commit?.id,
        branch: branchName,
        timestamp: new Date().toISOString()
      }));

      // Real-time quality status update
      await realtimeEvents.broadcast('plugin.quality.evaluation_started', {
        repository: repository.full_name,
        commitId: head_commit?.id,
        reason: 'main_branch_update',
        timestamp: new Date().toISOString()
      });
    }

    // Security scanning for dependency changes
    if (hasPackageChanges) {
      console.log(`Package changes detected, triggering security scan for ${repository.full_name}`);
      
      await redis.lpush('security_scan_queue', JSON.stringify({
        type: 'dependency_update',
        repository: {
          id: repository.id,
          name: repository.name,
          fullName: repository.full_name,
          url: repository.html_url
        },
        commitId: head_commit?.id,
        changedFiles: commits.flatMap(commit => 
          [...commit.added, ...commit.modified].filter(file => 
            file.includes('package.json') || file.includes('yarn.lock') || file.includes('package-lock.json')
          )
        ),
        timestamp: new Date().toISOString()
      }));

      // Real-time security scan notification
      await realtimeEvents.broadcast('plugin.security.scan_triggered', {
        repository: repository.full_name,
        reason: 'dependency_update',
        commitId: head_commit?.id,
        files: commits.flatMap(commit => 
          [...commit.added, ...commit.modified].filter(file => 
            file.includes('package.json') || file.includes('yarn.lock') || file.includes('package-lock.json')
          )
        ),
        timestamp: new Date().toISOString()
      });
    }

    // Send real-time notification to portal users
    if (isMainBranch) {
      await notifications.sendRealTimeNotification({
        type: 'plugin_update',
        title: `Plugin Updated: ${repository.name}`,
        message: `${repository.full_name} has been updated with ${commits.length} new commit(s)`,
        data: {
          repository: repository.full_name,
          commits: commits.length,
          lastCommit: head_commit?.message,
          branch: branchName,
          catalogFilesChanged,
          hasPackageChanges
        },
        channels: ['websocket', 'database'],
        targetUsers: 'plugin_subscribers',
        metadata: {
          repositoryId: repository.id,
          isPluginRepo: true,
          priority: hasPackageChanges || catalogFilesChanged ? 'high' : 'normal'
        }
      });
    }
  }

  // Enhanced catalog processing
  if (catalogFilesChanged) {
    await webhookManager.sendEvent('catalog.entity.changed', {
      repository: {
        id: repository.id,
        name: repository.name,
        fullName: repository.full_name,
        url: repository.html_url,
      },
      branch: branchName,
      commits: commits.map(commit => ({
        id: commit.id,
        message: commit.message,
        author: commit.author,
        filesChanged: {
          added: commit.added,
          modified: commit.modified,
          removed: commit.removed,
        },
      })),
      headCommit: head_commit,
      isPluginRepo,
      timestamp: Date.now(),
    });

    // Real-time catalog refresh notification
    await realtimeEvents.broadcast('catalog.refresh_triggered', {
      repository: repository.full_name,
      branch: branchName,
      reason: 'catalog_files_changed',
      affectedFiles: commits.flatMap(commit => 
        [...commit.added, ...commit.modified, ...commit.removed].filter(file =>
          file.includes('catalog-info.') || 
          file.includes('backstage.') ||
          file.includes('.backstage/')
        )
      ),
      timestamp: new Date().toISOString()
    });
  }

  // Always send generic push event for monitoring
  await webhookManager.sendEvent('github.push', {
    repository: repository.full_name,
    branch: branchName,
    commitCount: commits.length,
    pusher: payload.sender.login,
    isPluginRepo,
    catalogFilesChanged,
    hasPackageChanges,
    timestamp: Date.now(),
  });

  // Real-time metrics update
  await realtimeEvents.broadcast('github.push', {
    repository: {
      id: repository.id,
      name: repository.name,
      fullName: repository.full_name,
      isPluginRepo
    },
    branch: branchName,
    isMainBranch,
    commits: commits.length,
    pusher: payload.sender.login,
    catalogFilesChanged,
    hasPackageChanges,
    timestamp: new Date().toISOString()
  });
}

async function processPullRequestEvent(payload: z.infer<typeof GitHubPullRequestEventSchema>): Promise<void> {
  const { action, pull_request, repository } = payload;
  
  if (!repository) return;

  await webhookManager.sendEvent('github.pull_request', {
    action,
    repository: repository.full_name,
    pullRequest: {
      number: pull_request.number,
      title: pull_request.title,
      state: pull_request.state,
      url: pull_request.html_url,
      head: {
        ref: pull_request.head.ref,
        sha: pull_request.head.sha,
      },
      base: {
        ref: pull_request.base.ref,
        sha: pull_request.base.sha,
      },
      author: pull_request.user.login,
    },
    timestamp: Date.now(),
  });

  // Check if PR affects catalog files and send specific event
  if (action === 'opened' || action === 'synchronize') {
    // In a real implementation, you'd check the PR diff for catalog files
    const affectsCatalogFiles = true; // Placeholder
    
    if (affectsCatalogFiles) {
      await webhookManager.sendEvent('catalog.pull_request.updated', {
        repository: repository.full_name,
        pullRequest: {
          number: pull_request.number,
          title: pull_request.title,
          url: pull_request.html_url,
          author: pull_request.user.login,
        },
        action,
        timestamp: Date.now(),
      });
    }
  }
}

async function processReleaseEvent(payload: z.infer<typeof GitHubReleaseEventSchema>): Promise<void> {
  const { action, release, repository } = payload;
  
  if (!repository || action !== 'published') return;

  await webhookManager.sendEvent('github.release', {
    repository: repository.full_name,
    release: {
      id: release.id,
      tagName: release.tag_name,
      name: release.name,
      url: release.html_url,
      draft: release.draft,
      prerelease: release.prerelease,
      publishedAt: release.published_at,
    },
    timestamp: Date.now(),
  });

  // Check if this is a Backstage template or plugin release
  const isBackstageRelated = repository.name.includes('template') || 
                            repository.name.includes('plugin') ||
                            repository.full_name.includes('backstage');

  if (isBackstageRelated) {
    await webhookManager.sendEvent('backstage.template.released', {
      repository: repository.full_name,
      version: release.tag_name,
      name: release.name,
      url: release.html_url,
      timestamp: Date.now(),
    });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';
    const rateLimitResult = checkRateLimit(clientIp);
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + 60),
          },
        }
      );
    }

    // Get webhook signature and event type
    const signature = request.headers.get('x-hub-signature-256') || '';
    const eventType = request.headers.get('x-github-event') || '';
    const deliveryId = request.headers.get('x-github-delivery') || '';

    if (!eventType) {
      return NextResponse.json(
        { error: 'Missing X-GitHub-Event header' },
        { status: 400 }
      );
    }

    if (!deliveryId) {
      return NextResponse.json(
        { error: 'Missing X-GitHub-Delivery header' },
        { status: 400 }
      );
    }

    // Get payload
    const payload = await request.text();
    if (!payload) {
      return NextResponse.json(
        { error: 'Empty payload' },
        { status: 400 }
      );
    }

    // Verify signature if secret is configured
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    if (webhookSecret && !verifyGitHubSignature(payload, signature, webhookSecret)) {
      console.warn(`Invalid GitHub webhook signature for delivery ${deliveryId}`);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse JSON payload
    let parsedPayload;
    try {
      parsedPayload = JSON.parse(payload);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    console.log(`Received GitHub webhook: ${eventType} (delivery: ${deliveryId})`);

    // Process different event types
    try {
      switch (eventType) {
        case 'push':
          const pushPayload = GitHubPushEventSchema.parse(parsedPayload);
          await processPushEvent(pushPayload);
          break;

        case 'pull_request':
          const prPayload = GitHubPullRequestEventSchema.parse(parsedPayload);
          await processPullRequestEvent(prPayload);
          break;

        case 'release':
          const releasePayload = GitHubReleaseEventSchema.parse(parsedPayload);
          await processReleaseEvent(releasePayload);
          break;

        case 'repository':
        case 'create':
        case 'delete':
          await processRepositoryEvent(eventType, parsedPayload);
          break;

        default:
          // For other events, just log and send generic event
          console.log(`Unhandled GitHub event type: ${eventType}`);
          await webhookManager.sendEvent(`github.${eventType}`, {
            eventType,
            repository: parsedPayload.repository?.full_name,
            sender: parsedPayload.sender?.login,
            timestamp: Date.now(),
          });
      }

      return NextResponse.json(
        { 
          success: true, 
          eventType,
          deliveryId,
          processed: true,
        },
        {
          headers: {
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          },
        }
      );

    } catch (processingError) {
      console.error(`Error processing GitHub webhook ${eventType}:`, processingError);
      
      // Still return success to GitHub to avoid retries for processing errors
      return NextResponse.json(
        { 
          success: true, 
          eventType,
          deliveryId,
          processed: false,
          error: 'Processing error - logged for investigation',
        },
        {
          headers: {
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          },
        }
      );
    }

  } catch (error) {
    console.error('GitHub webhook handler error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Handle GET requests for webhook validation
export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const challenge = searchParams.get('hub.challenge');
  
  if (challenge) {
    // GitHub webhook validation
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return NextResponse.json({
    service: 'GitHub Webhook Handler',
    status: 'active',
    timestamp: new Date().toISOString(),
    supportedEvents: [
      'push',
      'pull_request',
      'release',
      'repository',
      'create',
      'delete',
    ],
  });
}