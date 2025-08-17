import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { headers } from 'next/headers';
import Redis from 'ioredis';
import { z } from 'zod';

// Real-time event system
import { RealtimeEventService } from '@/lib/events/realtime-event-service';
import { PluginQualityService } from '@/lib/plugins/quality-service';
import { SecurityScanService } from '@/lib/security/security-scan-service';
import { NotificationService } from '@/lib/notifications/notification-service';

// Redis for event distribution
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

// GitLab webhook signature validation
async function validateGitLabSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const expectedSignature = createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('base64');
    
    return timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(expectedSignature, 'utf8')
    );
  } catch (error) {
    console.error('GitLab signature validation error:', error);
    return false;
  }
}

// Rate limiting for GitLab webhooks
const WEBHOOK_RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 minute
  max: 200, // 200 webhooks per minute per project
  keyGenerator: (projectId: string) => `webhook_gitlab_${projectId}`
};

// GitLab webhook event schemas
const GitLabProjectSchema = z.object({
  id: z.number(),
  name: z.string(),
  path: z.string(),
  path_with_namespace: z.string(),
  web_url: z.string(),
  ssh_url_to_repo: z.string(),
  http_url_to_repo: z.string(),
  namespace: z.object({
    name: z.string(),
    path: z.string(),
    kind: z.string(),
    full_path: z.string()
  }),
  topics: z.array(z.string()).optional(),
  default_branch: z.string().optional(),
  visibility: z.enum(['public', 'internal', 'private']).optional()
});

const GitLabPushEventSchema = z.object({
  object_kind: z.literal('push'),
  event_name: z.literal('push'),
  before: z.string(),
  after: z.string(),
  ref: z.string(),
  checkout_sha: z.string(),
  message: z.string().nullable(),
  user_id: z.number(),
  user_name: z.string(),
  user_username: z.string(),
  user_email: z.string(),
  user_avatar: z.string().optional(),
  project_id: z.number(),
  project: GitLabProjectSchema,
  commits: z.array(z.object({
    id: z.string(),
    message: z.string(),
    title: z.string(),
    timestamp: z.string(),
    url: z.string(),
    author: z.object({
      name: z.string(),
      email: z.string()
    }),
    added: z.array(z.string()),
    modified: z.array(z.string()),
    removed: z.array(z.string())
  })),
  total_commits_count: z.number()
});

const GitLabMergeRequestEventSchema = z.object({
  object_kind: z.literal('merge_request'),
  event_type: z.string(),
  user: z.object({
    id: z.number(),
    name: z.string(),
    username: z.string(),
    email: z.string(),
    avatar_url: z.string().optional()
  }),
  project: GitLabProjectSchema,
  object_attributes: z.object({
    id: z.number(),
    iid: z.number(),
    title: z.string(),
    description: z.string().nullable(),
    state: z.enum(['opened', 'closed', 'locked', 'merged']),
    created_at: z.string(),
    updated_at: z.string(),
    target_branch: z.string(),
    source_branch: z.string(),
    source_project_id: z.number(),
    target_project_id: z.number(),
    url: z.string(),
    action: z.enum(['open', 'close', 'reopen', 'update', 'approved', 'unapproved', 'approval', 'unapproval', 'merge'])
  }),
  changes: z.object({}).optional(),
  repository: z.object({
    name: z.string(),
    url: z.string(),
    description: z.string().nullable(),
    homepage: z.string()
  }).optional()
});

const GitLabReleaseEventSchema = z.object({
  object_kind: z.literal('release'),
  id: z.number(),
  created_at: z.string(),
  description: z.string(),
  name: z.string(),
  released_at: z.string(),
  tag: z.string(),
  object_kind_id: z.number(),
  project: GitLabProjectSchema,
  url: z.string(),
  action: z.enum(['create', 'update', 'delete']),
  assets: z.object({
    count: z.number(),
    links: z.array(z.object({
      id: z.number(),
      external: z.boolean(),
      link_type: z.string(),
      name: z.string(),
      url: z.string()
    })).optional(),
    sources: z.array(z.object({
      format: z.string(),
      url: z.string()
    })).optional()
  }).optional()
});

const GitLabPipelineEventSchema = z.object({
  object_kind: z.literal('pipeline'),
  object_attributes: z.object({
    id: z.number(),
    ref: z.string(),
    tag: z.boolean(),
    sha: z.string(),
    before_sha: z.string(),
    source: z.string(),
    status: z.enum(['pending', 'running', 'success', 'failed', 'canceled', 'skipped', 'manual', 'scheduled']),
    detailed_status: z.string(),
    stages: z.array(z.string()),
    created_at: z.string(),
    finished_at: z.string().nullable(),
    duration: z.number().nullable(),
    queued_duration: z.number().nullable(),
    variables: z.array(z.object({
      key: z.string(),
      value: z.string()
    })).optional()
  }),
  user: z.object({
    id: z.number(),
    name: z.string(),
    username: z.string(),
    email: z.string(),
    avatar_url: z.string().optional()
  }),
  project: GitLabProjectSchema,
  commit: z.object({
    id: z.string(),
    message: z.string(),
    title: z.string(),
    timestamp: z.string(),
    url: z.string(),
    author: z.object({
      name: z.string(),
      email: z.string()
    })
  }),
  builds: z.array(z.object({
    id: z.number(),
    stage: z.string(),
    name: z.string(),
    status: z.string(),
    created_at: z.string(),
    started_at: z.string().nullable(),
    finished_at: z.string().nullable(),
    when: z.string(),
    manual: z.boolean(),
    allow_failure: z.boolean(),
    user: z.object({
      id: z.number(),
      name: z.string(),
      username: z.string(),
      email: z.string()
    }),
    runner: z.object({
      id: z.number(),
      description: z.string(),
      active: z.boolean(),
      is_shared: z.boolean()
    }).nullable(),
    artifacts_file: z.object({
      filename: z.string(),
      size: z.number()
    }).nullable()
  }))
});

export async function POST(req: NextRequest) {
  try {
    const headersList = headers();
    const signature = headersList.get('x-gitlab-token');
    const event = headersList.get('x-gitlab-event');
    const instanceUrl = headersList.get('x-gitlab-instance');
    
    if (!event) {
      return NextResponse.json(
        { error: 'Missing X-GitLab-Event header' },
        { status: 400 }
      );
    }

    const body = await req.text();
    
    // Validate webhook signature if configured
    const webhookSecret = process.env.GITLAB_WEBHOOK_SECRET;
    if (webhookSecret && signature) {
      const isValidSignature = await validateGitLabSignature(body, signature, webhookSecret);
      if (!isValidSignature) {
        console.error('Invalid GitLab webhook signature');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    }

    let payload: any;
    try {
      payload = JSON.parse(body);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Rate limiting check
    const projectId = payload.project_id?.toString() || payload.project?.id?.toString();
    if (projectId) {
      const rateLimitKey = WEBHOOK_RATE_LIMIT.keyGenerator(projectId);
      const requests = await redis.incr(rateLimitKey);
      if (requests === 1) {
        await redis.expire(rateLimitKey, Math.ceil(WEBHOOK_RATE_LIMIT.windowMs / 1000));
      }
      if (requests > WEBHOOK_RATE_LIMIT.max) {
        return NextResponse.json(
          { error: 'Rate limit exceeded' },
          { status: 429, headers: { 'Retry-After': '60' } }
        );
      }
    }

    // Process GitLab webhook event
    await processGitLabWebhookEvent(event, payload, instanceUrl);

    return NextResponse.json({ 
      success: true, 
      event,
      projectId,
      processed: true,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('GitLab webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function processGitLabWebhookEvent(event: string, payload: any, instanceUrl?: string | null) {
  const realtimeEvents = RealtimeEventService.getInstance();
  const qualityService = new PluginQualityService();
  const securityScan = new SecurityScanService();
  const notifications = new NotificationService();

  try {
    switch (event) {
      case 'Push Hook':
        await handleGitLabPushEvent(payload, realtimeEvents, qualityService, securityScan, notifications);
        break;
      
      case 'Merge Request Hook':
        await handleGitLabMergeRequestEvent(payload, realtimeEvents, qualityService, notifications);
        break;
      
      case 'Release Hook':
        await handleGitLabReleaseEvent(payload, realtimeEvents, qualityService, securityScan, notifications);
        break;
      
      case 'Pipeline Hook':
        await handleGitLabPipelineEvent(payload, realtimeEvents, notifications);
        break;
      
      case 'Tag Push Hook':
        await handleGitLabTagEvent(payload, realtimeEvents, qualityService, securityScan, notifications);
        break;
      
      default:
        console.log(`Unhandled GitLab event: ${event}`);
        // Still broadcast for extensibility
        await realtimeEvents.broadcast('gitlab.event', {
          event,
          project: payload.project,
          payload,
          instanceUrl,
          timestamp: new Date().toISOString()
        });
    }
  } catch (error) {
    console.error(`Error processing GitLab ${event} event:`, error);
    
    // Broadcast error event for monitoring
    await realtimeEvents.broadcast('gitlab.error', {
      event,
      error: error instanceof Error ? error.message : 'Unknown error',
      project: payload.project,
      instanceUrl,
      timestamp: new Date().toISOString()
    });
  }
}

async function handleGitLabPushEvent(
  payload: any,
  realtimeEvents: RealtimeEventService,
  qualityService: PluginQualityService,
  securityScan: SecurityScanService,
  notifications: NotificationService
) {
  const pushEvent = GitLabPushEventSchema.parse(payload);
  const project = pushEvent.project;
  
  // Check if this is a Backstage plugin repository
  const isPluginRepo = await isBackstagePluginRepository(project);
  const branchName = pushEvent.ref.replace('refs/heads/', '');
  const isMainBranch = branchName === project.default_branch || branchName === 'main' || branchName === 'master';

  // Check for package.json changes
  const hasPackageChanges = pushEvent.commits.some(commit =>
    [...commit.added, ...commit.modified].some(file => 
      file.includes('package.json') || file.includes('yarn.lock') || file.includes('package-lock.json')
    )
  );

  // Check for catalog file changes
  const catalogFilesChanged = pushEvent.commits.some(commit =>
    [...commit.added, ...commit.modified, ...commit.removed].some(file =>
      file.includes('catalog-info.') || 
      file.includes('backstage.') ||
      file.includes('.backstage/')
    )
  );

  if (isPluginRepo) {
    console.log(`Processing GitLab plugin repository update: ${project.path_with_namespace}`);
    
    // Real-time broadcast
    await realtimeEvents.broadcast('plugin.repository.updated', {
      source: 'gitlab',
      repository: {
        id: project.id,
        name: project.name,
        fullName: project.path_with_namespace,
        url: project.web_url,
        sshUrl: project.ssh_url_to_repo,
        httpUrl: project.http_url_to_repo,
        namespace: project.namespace,
        visibility: project.visibility,
        topics: project.topics || []
      },
      ref: pushEvent.ref,
      branch: branchName,
      commits: pushEvent.commits.map(commit => ({
        id: commit.id,
        message: commit.message,
        title: commit.title,
        timestamp: commit.timestamp,
        url: commit.url,
        author: commit.author,
        filesChanged: {
          added: commit.added,
          modified: commit.modified,
          removed: commit.removed
        }
      })),
      isMainBranch,
      catalogFilesChanged,
      hasPackageChanges,
      totalCommits: pushEvent.total_commits_count,
      user: {
        name: pushEvent.user_name,
        username: pushEvent.user_username,
        email: pushEvent.user_email
      },
      timestamp: new Date().toISOString()
    });

    // Trigger quality assessment for main branch
    if (isMainBranch) {
      await redis.lpush('quality_assessment_queue', JSON.stringify({
        type: 'repository_update',
        source: 'gitlab',
        repository: {
          id: project.id,
          name: project.name,
          fullName: project.path_with_namespace,
          url: project.web_url
        },
        commitId: pushEvent.after,
        branch: branchName,
        timestamp: new Date().toISOString()
      }));

      await realtimeEvents.broadcast('plugin.quality.evaluation_started', {
        source: 'gitlab',
        repository: project.path_with_namespace,
        commitId: pushEvent.after,
        reason: 'main_branch_update',
        timestamp: new Date().toISOString()
      });
    }

    // Security scanning for dependency changes
    if (hasPackageChanges) {
      await redis.lpush('security_scan_queue', JSON.stringify({
        type: 'dependency_update',
        source: 'gitlab',
        repository: {
          id: project.id,
          name: project.name,
          fullName: project.path_with_namespace,
          url: project.web_url
        },
        commitId: pushEvent.after,
        changedFiles: pushEvent.commits.flatMap(commit => 
          [...commit.added, ...commit.modified].filter(file => 
            file.includes('package.json') || file.includes('yarn.lock') || file.includes('package-lock.json')
          )
        ),
        timestamp: new Date().toISOString()
      }));

      await realtimeEvents.broadcast('plugin.security.scan_triggered', {
        source: 'gitlab',
        repository: project.path_with_namespace,
        reason: 'dependency_update',
        commitId: pushEvent.after,
        timestamp: new Date().toISOString()
      });
    }

    // Send notification for main branch updates
    if (isMainBranch) {
      await notifications.sendRealTimeNotification({
        type: 'plugin_update',
        title: `GitLab Plugin Updated: ${project.name}`,
        message: `${project.path_with_namespace} has been updated with ${pushEvent.total_commits_count} new commit(s)`,
        data: {
          source: 'gitlab',
          repository: project.path_with_namespace,
          commits: pushEvent.total_commits_count,
          branch: branchName,
          catalogFilesChanged,
          hasPackageChanges
        },
        channels: ['websocket', 'database'],
        targetUsers: 'plugin_subscribers',
        metadata: {
          repositoryId: project.id,
          isPluginRepo: true,
          source: 'gitlab',
          priority: hasPackageChanges || catalogFilesChanged ? 'high' : 'normal'
        }
      });
    }
  }

  // Always broadcast push event
  await realtimeEvents.broadcast('gitlab.push', {
    repository: {
      id: project.id,
      name: project.name,
      fullName: project.path_with_namespace,
      isPluginRepo
    },
    branch: branchName,
    isMainBranch,
    commits: pushEvent.total_commits_count,
    user: pushEvent.user_username,
    catalogFilesChanged,
    hasPackageChanges,
    timestamp: new Date().toISOString()
  });
}

async function handleGitLabMergeRequestEvent(
  payload: any,
  realtimeEvents: RealtimeEventService,
  qualityService: PluginQualityService,
  notifications: NotificationService
) {
  const mrEvent = GitLabMergeRequestEventSchema.parse(payload);
  const project = mrEvent.project;
  const mr = mrEvent.object_attributes;
  
  const isPluginRepo = await isBackstagePluginRepository(project);
  
  if (isPluginRepo && mr.action === 'open') {
    console.log(`New GitLab MR opened: ${project.path_with_namespace}!${mr.iid}`);
    
    // Trigger quality checks for merge request
    await redis.lpush('quality_assessment_queue', JSON.stringify({
      type: 'merge_request',
      source: 'gitlab',
      repository: {
        id: project.id,
        name: project.name,
        fullName: project.path_with_namespace,
        url: project.web_url
      },
      mergeRequest: {
        id: mr.id,
        iid: mr.iid,
        title: mr.title,
        description: mr.description,
        sourceBranch: mr.source_branch,
        targetBranch: mr.target_branch,
        url: mr.url
      },
      timestamp: new Date().toISOString()
    }));

    await realtimeEvents.broadcast('plugin.merge_request.opened', {
      source: 'gitlab',
      repository: project.path_with_namespace,
      mergeRequest: {
        id: mr.id,
        iid: mr.iid,
        title: mr.title,
        url: mr.url,
        author: mrEvent.user.username,
        sourceBranch: mr.source_branch,
        targetBranch: mr.target_branch
      },
      timestamp: new Date().toISOString()
    });
  }

  await realtimeEvents.broadcast('gitlab.merge_request', {
    action: mr.action,
    repository: project.path_with_namespace,
    mergeRequest: {
      id: mr.id,
      iid: mr.iid,
      title: mr.title,
      state: mr.state,
      url: mr.url,
      author: mrEvent.user.username
    },
    isPluginRepo,
    timestamp: new Date().toISOString()
  });
}

async function handleGitLabReleaseEvent(
  payload: any,
  realtimeEvents: RealtimeEventService,
  qualityService: PluginQualityService,
  securityScan: SecurityScanService,
  notifications: NotificationService
) {
  const releaseEvent = GitLabReleaseEventSchema.parse(payload);
  const project = releaseEvent.project;
  
  const isPluginRepo = await isBackstagePluginRepository(project);
  
  if (isPluginRepo && releaseEvent.action === 'create') {
    console.log(`New GitLab plugin release: ${project.path_with_namespace} ${releaseEvent.tag}`);
    
    // Trigger quality evaluation for new release
    await redis.lpush('quality_assessment_queue', JSON.stringify({
      type: 'new_release',
      source: 'gitlab',
      repository: {
        id: project.id,
        name: project.name,
        fullName: project.path_with_namespace,
        url: project.web_url
      },
      release: {
        tag: releaseEvent.tag,
        name: releaseEvent.name,
        description: releaseEvent.description,
        releasedAt: releaseEvent.released_at,
        url: releaseEvent.url
      },
      timestamp: new Date().toISOString()
    }));

    // Trigger security scan
    await redis.lpush('security_scan_queue', JSON.stringify({
      type: 'new_release',
      source: 'gitlab',
      repository: {
        id: project.id,
        name: project.name,
        fullName: project.path_with_namespace,
        url: project.web_url
      },
      release: {
        tag: releaseEvent.tag,
        assets: releaseEvent.assets
      },
      timestamp: new Date().toISOString()
    }));

    await realtimeEvents.broadcast('plugin.release.published', {
      source: 'gitlab',
      repository: project.path_with_namespace,
      release: {
        tag: releaseEvent.tag,
        name: releaseEvent.name,
        description: releaseEvent.description,
        url: releaseEvent.url,
        releasedAt: releaseEvent.released_at,
        assets: releaseEvent.assets
      },
      timestamp: new Date().toISOString()
    });

    await notifications.sendRealTimeNotification({
      type: 'plugin_release',
      title: `New GitLab Plugin Release: ${project.name} ${releaseEvent.tag}`,
      message: `${project.path_with_namespace} has published a new release`,
      data: {
        source: 'gitlab',
        repository: project.path_with_namespace,
        version: releaseEvent.tag,
        releaseNotes: releaseEvent.description
      },
      channels: ['websocket', 'database'],
      targetUsers: 'plugin_subscribers'
    });
  }

  await realtimeEvents.broadcast('gitlab.release', {
    action: releaseEvent.action,
    repository: project.path_with_namespace,
    release: {
      tag: releaseEvent.tag,
      name: releaseEvent.name,
      url: releaseEvent.url
    },
    isPluginRepo,
    timestamp: new Date().toISOString()
  });
}

async function handleGitLabPipelineEvent(
  payload: any,
  realtimeEvents: RealtimeEventService,
  notifications: NotificationService
) {
  const pipelineEvent = GitLabPipelineEventSchema.parse(payload);
  const project = pipelineEvent.project;
  const pipeline = pipelineEvent.object_attributes;
  
  const isPluginRepo = await isBackstagePluginRepository(project);
  
  if (isPluginRepo) {
    await realtimeEvents.broadcast('plugin.pipeline.updated', {
      source: 'gitlab',
      repository: project.path_with_namespace,
      pipeline: {
        id: pipeline.id,
        ref: pipeline.ref,
        sha: pipeline.sha,
        status: pipeline.status,
        detailedStatus: pipeline.detailed_status,
        stages: pipeline.stages,
        createdAt: pipeline.created_at,
        finishedAt: pipeline.finished_at,
        duration: pipeline.duration
      },
      commit: pipelineEvent.commit,
      builds: pipelineEvent.builds.map(build => ({
        id: build.id,
        stage: build.stage,
        name: build.name,
        status: build.status,
        createdAt: build.created_at,
        startedAt: build.started_at,
        finishedAt: build.finished_at,
        manual: build.manual,
        allowFailure: build.allow_failure
      })),
      timestamp: new Date().toISOString()
    });

    // Notify on pipeline failures
    if (pipeline.status === 'failed') {
      await notifications.sendRealTimeNotification({
        type: 'pipeline_failure',
        title: `GitLab Pipeline Failed: ${project.name}`,
        message: `Pipeline failed in ${project.path_with_namespace} on ${pipeline.ref}`,
        data: {
          source: 'gitlab',
          repository: project.path_with_namespace,
          pipelineId: pipeline.id,
          ref: pipeline.ref,
          status: pipeline.status
        },
        channels: ['websocket', 'database'],
        targetUsers: 'plugin_maintainers'
      });
    }
  }

  await realtimeEvents.broadcast('gitlab.pipeline', {
    repository: project.path_with_namespace,
    pipeline: {
      id: pipeline.id,
      ref: pipeline.ref,
      status: pipeline.status
    },
    isPluginRepo,
    timestamp: new Date().toISOString()
  });
}

async function handleGitLabTagEvent(
  payload: any,
  realtimeEvents: RealtimeEventService,
  qualityService: PluginQualityService,
  securityScan: SecurityScanService,
  notifications: NotificationService
) {
  // Tag push events have similar structure to push events
  const project = payload.project;
  const isPluginRepo = await isBackstagePluginRepository(project);
  
  if (isPluginRepo) {
    const tagName = payload.ref.replace('refs/tags/', '');
    console.log(`New GitLab tag: ${project.path_with_namespace} ${tagName}`);
    
    await realtimeEvents.broadcast('plugin.tag.created', {
      source: 'gitlab',
      repository: project.path_with_namespace,
      tag: tagName,
      commit: {
        id: payload.after,
        message: payload.message
      },
      user: payload.user_username,
      timestamp: new Date().toISOString()
    });
  }
}

async function isBackstagePluginRepository(project: any): Promise<boolean> {
  // Check project name patterns
  if (project.name.includes('backstage-plugin') || 
      project.name.includes('plugin-') ||
      project.path_with_namespace.includes('backstage') ||
      project.name.startsWith('@backstage/')) {
    return true;
  }

  // Check project description
  if (project.description && 
      (project.description.toLowerCase().includes('backstage') ||
       project.description.toLowerCase().includes('plugin') ||
       project.description.toLowerCase().includes('internal developer platform'))) {
    return true;
  }

  // Check topics
  if (project.topics && project.topics.some((topic: string) => 
    topic.includes('backstage') || 
    topic.includes('plugin') ||
    topic.includes('internal-developer-platform') ||
    topic.includes('idp') ||
    topic.includes('developer-experience')
  )) {
    return true;
  }

  return false;
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'gitlab-webhooks',
    timestamp: new Date().toISOString(),
    capabilities: [
      'signature_validation',
      'rate_limiting',
      'real_time_events',
      'quality_triggers',
      'security_scanning',
      'notifications',
      'pipeline_monitoring'
    ],
    supportedEvents: [
      'Push Hook',
      'Merge Request Hook',
      'Release Hook',
      'Pipeline Hook',
      'Tag Push Hook'
    ]
  });
}