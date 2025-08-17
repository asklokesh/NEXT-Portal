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

// Azure DevOps webhook signature validation
async function validateAzureDevOpsSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const hmac = createHmac('sha1', secret);
    hmac.update(payload, 'utf8');
    const expectedSignature = `sha1=${hmac.digest('hex')}`;
    
    if (signature.length !== expectedSignature.length) {
      return false;
    }
    
    return timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(expectedSignature, 'utf8')
    );
  } catch (error) {
    console.error('Azure DevOps signature validation error:', error);
    return false;
  }
}

// Rate limiting for Azure DevOps webhooks
const WEBHOOK_RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 minute
  max: 150, // 150 webhooks per minute per project
  keyGenerator: (projectId: string) => `webhook_azdo_${projectId}`
};

// Azure DevOps webhook event schemas
const AzureDevOpsResourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  project: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    url: z.string(),
    state: z.string(),
    revision: z.number(),
    visibility: z.enum(['private', 'public']).optional()
  }).optional()
});

const AzureDevOpsRepositorySchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  project: z.object({
    id: z.string(),
    name: z.string(),
    url: z.string(),
    state: z.string(),
    visibility: z.enum(['private', 'public']).optional()
  }),
  defaultBranch: z.string().optional(),
  size: z.number().optional(),
  remoteUrl: z.string(),
  sshUrl: z.string().optional(),
  webUrl: z.string().optional()
});

const AzureDevOpsPushEventSchema = z.object({
  subscriptionId: z.string(),
  notificationId: z.number(),
  id: z.string(),
  eventType: z.literal('git.push'),
  publisherId: z.literal('tfs'),
  message: z.object({
    text: z.string(),
    html: z.string(),
    markdown: z.string()
  }),
  detailedMessage: z.object({
    text: z.string(),
    html: z.string(),
    markdown: z.string()
  }),
  resource: z.object({
    commits: z.array(z.object({
      commitId: z.string(),
      author: z.object({
        name: z.string(),
        email: z.string(),
        date: z.string()
      }),
      committer: z.object({
        name: z.string(),
        email: z.string(),
        date: z.string()
      }),
      comment: z.string(),
      url: z.string()
    })),
    refUpdates: z.array(z.object({
      name: z.string(),
      oldObjectId: z.string(),
      newObjectId: z.string()
    })),
    repository: AzureDevOpsRepositorySchema,
    pushedBy: z.object({
      displayName: z.string(),
      url: z.string(),
      id: z.string(),
      uniqueName: z.string(),
      imageUrl: z.string().optional(),
      descriptor: z.string().optional()
    }),
    pushId: z.number(),
    date: z.string(),
    url: z.string()
  }),
  resourceVersion: z.string(),
  resourceContainers: z.object({
    collection: z.object({
      id: z.string(),
      baseUrl: z.string()
    }),
    account: z.object({
      id: z.string(),
      baseUrl: z.string()
    }),
    project: z.object({
      id: z.string(),
      baseUrl: z.string()
    })
  }),
  createdDate: z.string()
});

const AzureDevOpsPullRequestEventSchema = z.object({
  subscriptionId: z.string(),
  notificationId: z.number(),
  id: z.string(),
  eventType: z.literal('git.pullrequest.created').or(z.literal('git.pullrequest.updated')).or(z.literal('git.pullrequest.merged')),
  publisherId: z.literal('tfs'),
  message: z.object({
    text: z.string(),
    html: z.string(),
    markdown: z.string()
  }),
  detailedMessage: z.object({
    text: z.string(),
    html: z.string(),
    markdown: z.string()
  }),
  resource: z.object({
    repository: AzureDevOpsRepositorySchema,
    pullRequestId: z.number(),
    codeReviewId: z.number(),
    status: z.enum(['active', 'abandoned', 'completed']),
    createdBy: z.object({
      displayName: z.string(),
      url: z.string(),
      id: z.string(),
      uniqueName: z.string(),
      imageUrl: z.string().optional(),
      descriptor: z.string().optional()
    }),
    creationDate: z.string(),
    title: z.string(),
    description: z.string(),
    sourceRefName: z.string(),
    targetRefName: z.string(),
    mergeStatus: z.enum(['succeeded', 'failed', 'conflicts', 'notSet']),
    isDraft: z.boolean().optional(),
    mergeId: z.string(),
    lastMergeSourceCommit: z.object({
      commitId: z.string(),
      url: z.string()
    }),
    lastMergeTargetCommit: z.object({
      commitId: z.string(),
      url: z.string()
    }),
    reviewers: z.array(z.object({
      vote: z.number(),
      hasDeclined: z.boolean(),
      isRequired: z.boolean(),
      isFlagged: z.boolean(),
      displayName: z.string(),
      url: z.string(),
      id: z.string(),
      uniqueName: z.string(),
      imageUrl: z.string().optional()
    })).optional(),
    url: z.string()
  }),
  resourceVersion: z.string(),
  resourceContainers: z.object({
    collection: z.object({
      id: z.string(),
      baseUrl: z.string()
    }),
    account: z.object({
      id: z.string(),
      baseUrl: z.string()
    }),
    project: z.object({
      id: z.string(),
      baseUrl: z.string()
    })
  }),
  createdDate: z.string()
});

const AzureDevOpsBuildEventSchema = z.object({
  subscriptionId: z.string(),
  notificationId: z.number(),
  id: z.string(),
  eventType: z.literal('build.complete'),
  publisherId: z.literal('tfs'),
  message: z.object({
    text: z.string(),
    html: z.string(),
    markdown: z.string()
  }),
  detailedMessage: z.object({
    text: z.string(),
    html: z.string(),
    markdown: z.string()
  }),
  resource: z.object({
    uri: z.string(),
    id: z.number(),
    buildNumber: z.string(),
    url: z.string(),
    startTime: z.string(),
    finishTime: z.string(),
    reason: z.enum(['manual', 'individualCI', 'batchedCI', 'schedule', 'userCreated', 'validateShelveset', 'checkInShelveset', 'pullRequest', 'buildCompletion', 'resourceTrigger']),
    status: z.enum(['inProgress', 'completed', 'cancelling', 'postponed', 'notStarted', 'all']),
    result: z.enum(['succeeded', 'partiallySucceeded', 'failed', 'canceled']).optional(),
    queue: z.object({
      queueType: z.string(),
      id: z.number(),
      name: z.string(),
      url: z.string()
    }),
    requests: z.array(z.object({
      id: z.number(),
      url: z.string(),
      requestedFor: z.object({
        displayName: z.string(),
        url: z.string(),
        id: z.string(),
        uniqueName: z.string(),
        imageUrl: z.string().optional(),
        descriptor: z.string().optional()
      })
    })),
    lastChangedBy: z.object({
      displayName: z.string(),
      url: z.string(),
      id: z.string(),
      uniqueName: z.string(),
      imageUrl: z.string().optional(),
      descriptor: z.string().optional()
    }),
    parameters: z.string(),
    orchestrationPlan: z.object({
      planId: z.string()
    }),
    logs: z.object({
      id: z.number(),
      type: z.string(),
      url: z.string()
    }),
    repository: AzureDevOpsRepositorySchema,
    keepForever: z.boolean(),
    retainedByRelease: z.boolean(),
    triggeredByBuild: z.string().nullable()
  }),
  resourceVersion: z.string(),
  resourceContainers: z.object({
    collection: z.object({
      id: z.string(),
      baseUrl: z.string()
    }),
    account: z.object({
      id: z.string(),
      baseUrl: z.string()
    }),
    project: z.object({
      id: z.string(),
      baseUrl: z.string()
    })
  }),
  createdDate: z.string()
});

const AzureDevOpsReleaseEventSchema = z.object({
  subscriptionId: z.string(),
  notificationId: z.number(),
  id: z.string(),
  eventType: z.literal('ms.vss-release.release-created-event').or(z.literal('ms.vss-release.deployment-completed-event')),
  publisherId: z.literal('rm'),
  message: z.object({
    text: z.string(),
    html: z.string(),
    markdown: z.string()
  }),
  detailedMessage: z.object({
    text: z.string(),
    html: z.string(),
    markdown: z.string()
  }),
  resource: z.object({
    release: z.object({
      id: z.number(),
      name: z.string(),
      status: z.enum(['active', 'draft', 'abandoned']),
      createdOn: z.string(),
      modifiedOn: z.string(),
      modifiedBy: z.object({
        displayName: z.string(),
        url: z.string(),
        id: z.string(),
        uniqueName: z.string(),
        imageUrl: z.string().optional(),
        descriptor: z.string().optional()
      }),
      createdBy: z.object({
        displayName: z.string(),
        url: z.string(),
        id: z.string(),
        uniqueName: z.string(),
        imageUrl: z.string().optional(),
        descriptor: z.string().optional()
      }),
      environments: z.array(z.object({
        id: z.number(),
        name: z.string(),
        status: z.enum(['notStarted', 'inProgress', 'succeeded', 'canceled', 'rejected', 'queued', 'scheduled', 'partiallySucceeded']),
        variables: z.object({}).optional(),
        preDeployApprovals: z.array(z.any()).optional(),
        postDeployApprovals: z.array(z.any()).optional(),
        preApprovalsSnapshot: z.object({}).optional(),
        postApprovalsSnapshot: z.object({}).optional(),
        deploySteps: z.array(z.any()).optional(),
        rank: z.number(),
        definitionEnvironmentId: z.number(),
        environmentOptions: z.object({}).optional(),
        demands: z.array(z.any()).optional(),
        conditions: z.array(z.any()).optional(),
        workflowTasks: z.array(z.any()).optional(),
        deployPhasesSnapshot: z.array(z.any()).optional(),
        owner: z.object({
          displayName: z.string(),
          url: z.string(),
          id: z.string(),
          uniqueName: z.string(),
          imageUrl: z.string().optional(),
          descriptor: z.string().optional()
        }),
        schedules: z.array(z.any()).optional(),
        release: z.object({
          id: z.number(),
          name: z.string(),
          url: z.string()
        }).optional(),
        releaseDefinition: z.object({
          id: z.number(),
          name: z.string(),
          url: z.string()
        }).optional()
      })),
      artifacts: z.array(z.object({
        sourceId: z.string(),
        type: z.string(),
        alias: z.string(),
        definitionReference: z.object({}).optional(),
        isPrimary: z.boolean(),
        isRetained: z.boolean().optional()
      })),
      releaseDefinition: z.object({
        id: z.number(),
        name: z.string(),
        url: z.string()
      }),
      description: z.string(),
      reason: z.enum(['none', 'manual', 'continuousIntegration', 'schedule']),
      releaseNameFormat: z.string(),
      keepForever: z.boolean(),
      definitionSnapshotRevision: z.number(),
      logsContainerUrl: z.string(),
      url: z.string(),
      tags: z.array(z.string()).optional(),
      projectReference: z.object({
        id: z.string(),
        name: z.string()
      }).optional()
    }),
    project: z.object({
      id: z.string(),
      name: z.string(),
      url: z.string(),
      state: z.string(),
      visibility: z.enum(['private', 'public']).optional()
    })
  }),
  resourceVersion: z.string(),
  resourceContainers: z.object({
    collection: z.object({
      id: z.string(),
      baseUrl: z.string()
    }),
    account: z.object({
      id: z.string(),
      baseUrl: z.string()
    }),
    project: z.object({
      id: z.string(),
      baseUrl: z.string()
    })
  }),
  createdDate: z.string()
});

export async function POST(req: NextRequest) {
  try {
    const headersList = headers();
    const signature = headersList.get('x-vss-signature');
    const eventType = headersList.get('x-vss-eventtype');
    const subscriptionId = headersList.get('x-vss-subscriptionid');
    
    if (!eventType) {
      return NextResponse.json(
        { error: 'Missing X-VSS-EventType header' },
        { status: 400 }
      );
    }

    const body = await req.text();
    
    // Validate webhook signature if configured
    const webhookSecret = process.env.AZURE_DEVOPS_WEBHOOK_SECRET;
    if (webhookSecret && signature) {
      const isValidSignature = await validateAzureDevOpsSignature(body, signature, webhookSecret);
      if (!isValidSignature) {
        console.error('Invalid Azure DevOps webhook signature');
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
    const projectId = payload.resource?.repository?.project?.id || payload.resourceContainers?.project?.id;
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

    // Process Azure DevOps webhook event
    await processAzureDevOpsWebhookEvent(eventType, payload, subscriptionId);

    return NextResponse.json({ 
      success: true, 
      eventType,
      subscriptionId,
      projectId,
      processed: true,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Azure DevOps webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function processAzureDevOpsWebhookEvent(eventType: string, payload: any, subscriptionId?: string | null) {
  const realtimeEvents = RealtimeEventService.getInstance();
  const qualityService = new PluginQualityService();
  const securityScan = new SecurityScanService();
  const notifications = new NotificationService();

  try {
    switch (eventType) {
      case 'git.push':
        await handleAzureDevOpsPushEvent(payload, realtimeEvents, qualityService, securityScan, notifications);
        break;
      
      case 'git.pullrequest.created':
      case 'git.pullrequest.updated':
      case 'git.pullrequest.merged':
        await handleAzureDevOpsPullRequestEvent(payload, realtimeEvents, qualityService, notifications);
        break;
      
      case 'build.complete':
        await handleAzureDevOpsBuildEvent(payload, realtimeEvents, notifications);
        break;
      
      case 'ms.vss-release.release-created-event':
      case 'ms.vss-release.deployment-completed-event':
        await handleAzureDevOpsReleaseEvent(payload, realtimeEvents, qualityService, securityScan, notifications);
        break;
      
      default:
        console.log(`Unhandled Azure DevOps event: ${eventType}`);
        // Still broadcast for extensibility
        await realtimeEvents.broadcast('azuredevops.event', {
          eventType,
          subscriptionId,
          payload,
          timestamp: new Date().toISOString()
        });
    }
  } catch (error) {
    console.error(`Error processing Azure DevOps ${eventType} event:`, error);
    
    // Broadcast error event for monitoring
    await realtimeEvents.broadcast('azuredevops.error', {
      eventType,
      error: error instanceof Error ? error.message : 'Unknown error',
      subscriptionId,
      timestamp: new Date().toISOString()
    });
  }
}

async function handleAzureDevOpsPushEvent(
  payload: any,
  realtimeEvents: RealtimeEventService,
  qualityService: PluginQualityService,
  securityScan: SecurityScanService,
  notifications: NotificationService
) {
  const pushEvent = AzureDevOpsPushEventSchema.parse(payload);
  const repository = pushEvent.resource.repository;
  const project = repository.project;
  
  // Check if this is a Backstage plugin repository
  const isPluginRepo = await isBackstagePluginRepository(repository);
  
  // Extract branch from ref updates
  const refUpdate = pushEvent.resource.refUpdates[0];
  const branchName = refUpdate?.name.replace('refs/heads/', '') || 'unknown';
  const isMainBranch = branchName === repository.defaultBranch || branchName === 'main' || branchName === 'master';

  if (isPluginRepo) {
    console.log(`Processing Azure DevOps plugin repository update: ${project.name}/${repository.name}`);
    
    // Real-time broadcast
    await realtimeEvents.broadcast('plugin.repository.updated', {
      source: 'azuredevops',
      repository: {
        id: repository.id,
        name: repository.name,
        fullName: `${project.name}/${repository.name}`,
        url: repository.url,
        webUrl: repository.webUrl,
        remoteUrl: repository.remoteUrl,
        sshUrl: repository.sshUrl,
        project: {
          id: project.id,
          name: project.name,
          url: project.url,
          state: project.state,
          visibility: project.visibility
        },
        defaultBranch: repository.defaultBranch
      },
      branch: branchName,
      commits: pushEvent.resource.commits.map(commit => ({
        id: commit.commitId,
        message: commit.comment,
        url: commit.url,
        author: commit.author,
        committer: commit.committer,
        timestamp: commit.author.date
      })),
      refUpdates: pushEvent.resource.refUpdates.map(update => ({
        name: update.name,
        oldObjectId: update.oldObjectId,
        newObjectId: update.newObjectId
      })),
      isMainBranch,
      pushedBy: {
        displayName: pushEvent.resource.pushedBy.displayName,
        uniqueName: pushEvent.resource.pushedBy.uniqueName,
        id: pushEvent.resource.pushedBy.id
      },
      pushId: pushEvent.resource.pushId,
      timestamp: new Date().toISOString()
    });

    // Trigger quality assessment for main branch
    if (isMainBranch) {
      await redis.lpush('quality_assessment_queue', JSON.stringify({
        type: 'repository_update',
        source: 'azuredevops',
        repository: {
          id: repository.id,
          name: repository.name,
          fullName: `${project.name}/${repository.name}`,
          url: repository.url
        },
        commitId: refUpdate?.newObjectId,
        branch: branchName,
        timestamp: new Date().toISOString()
      }));

      await realtimeEvents.broadcast('plugin.quality.evaluation_started', {
        source: 'azuredevops',
        repository: `${project.name}/${repository.name}`,
        commitId: refUpdate?.newObjectId,
        reason: 'main_branch_update',
        timestamp: new Date().toISOString()
      });
    }

    // Send notification for main branch updates
    if (isMainBranch) {
      await notifications.sendRealTimeNotification({
        type: 'plugin_update',
        title: `Azure DevOps Plugin Updated: ${repository.name}`,
        message: `${project.name}/${repository.name} has been updated with ${pushEvent.resource.commits.length} new commit(s)`,
        data: {
          source: 'azuredevops',
          repository: `${project.name}/${repository.name}`,
          commits: pushEvent.resource.commits.length,
          branch: branchName,
          pushedBy: pushEvent.resource.pushedBy.displayName
        },
        channels: ['websocket', 'database'],
        targetUsers: 'plugin_subscribers',
        metadata: {
          repositoryId: repository.id,
          isPluginRepo: true,
          source: 'azuredevops',
          priority: 'normal'
        }
      });
    }
  }

  // Always broadcast push event
  await realtimeEvents.broadcast('azuredevops.push', {
    repository: {
      id: repository.id,
      name: repository.name,
      fullName: `${project.name}/${repository.name}`,
      isPluginRepo
    },
    branch: branchName,
    isMainBranch,
    commits: pushEvent.resource.commits.length,
    pushedBy: pushEvent.resource.pushedBy.displayName,
    timestamp: new Date().toISOString()
  });
}

async function handleAzureDevOpsPullRequestEvent(
  payload: any,
  realtimeEvents: RealtimeEventService,
  qualityService: PluginQualityService,
  notifications: NotificationService
) {
  const prEvent = AzureDevOpsPullRequestEventSchema.parse(payload);
  const repository = prEvent.resource.repository;
  const project = repository.project;
  const pr = prEvent.resource;
  
  const isPluginRepo = await isBackstagePluginRepository(repository);
  
  if (isPluginRepo && prEvent.eventType === 'git.pullrequest.created') {
    console.log(`New Azure DevOps PR created: ${project.name}/${repository.name} #${pr.pullRequestId}`);
    
    // Trigger quality checks for pull request
    await redis.lpush('quality_assessment_queue', JSON.stringify({
      type: 'pull_request',
      source: 'azuredevops',
      repository: {
        id: repository.id,
        name: repository.name,
        fullName: `${project.name}/${repository.name}`,
        url: repository.url
      },
      pullRequest: {
        id: pr.pullRequestId,
        title: pr.title,
        description: pr.description,
        sourceRefName: pr.sourceRefName,
        targetRefName: pr.targetRefName,
        url: pr.url
      },
      timestamp: new Date().toISOString()
    }));

    await realtimeEvents.broadcast('plugin.pull_request.created', {
      source: 'azuredevops',
      repository: `${project.name}/${repository.name}`,
      pullRequest: {
        id: pr.pullRequestId,
        title: pr.title,
        url: pr.url,
        author: pr.createdBy.displayName,
        sourceRef: pr.sourceRefName,
        targetRef: pr.targetRefName,
        status: pr.status,
        isDraft: pr.isDraft
      },
      timestamp: new Date().toISOString()
    });
  }

  await realtimeEvents.broadcast('azuredevops.pullrequest', {
    eventType: prEvent.eventType,
    repository: `${project.name}/${repository.name}`,
    pullRequest: {
      id: pr.pullRequestId,
      title: pr.title,
      status: pr.status,
      url: pr.url,
      author: pr.createdBy.displayName
    },
    isPluginRepo,
    timestamp: new Date().toISOString()
  });
}

async function handleAzureDevOpsBuildEvent(
  payload: any,
  realtimeEvents: RealtimeEventService,
  notifications: NotificationService
) {
  const buildEvent = AzureDevOpsBuildEventSchema.parse(payload);
  const repository = buildEvent.resource.repository;
  const project = repository.project;
  const build = buildEvent.resource;
  
  const isPluginRepo = await isBackstagePluginRepository(repository);
  
  if (isPluginRepo) {
    await realtimeEvents.broadcast('plugin.build.completed', {
      source: 'azuredevops',
      repository: `${project.name}/${repository.name}`,
      build: {
        id: build.id,
        buildNumber: build.buildNumber,
        url: build.url,
        status: build.status,
        result: build.result,
        reason: build.reason,
        startTime: build.startTime,
        finishTime: build.finishTime,
        requestedFor: build.requests[0]?.requestedFor.displayName,
        queue: build.queue.name
      },
      timestamp: new Date().toISOString()
    });

    // Notify on build failures
    if (build.result === 'failed') {
      await notifications.sendRealTimeNotification({
        type: 'build_failure',
        title: `Azure DevOps Build Failed: ${repository.name}`,
        message: `Build ${build.buildNumber} failed in ${project.name}/${repository.name}`,
        data: {
          source: 'azuredevops',
          repository: `${project.name}/${repository.name}`,
          buildId: build.id,
          buildNumber: build.buildNumber,
          result: build.result
        },
        channels: ['websocket', 'database'],
        targetUsers: 'plugin_maintainers'
      });
    }
  }

  await realtimeEvents.broadcast('azuredevops.build', {
    repository: `${project.name}/${repository.name}`,
    build: {
      id: build.id,
      buildNumber: build.buildNumber,
      status: build.status,
      result: build.result
    },
    isPluginRepo,
    timestamp: new Date().toISOString()
  });
}

async function handleAzureDevOpsReleaseEvent(
  payload: any,
  realtimeEvents: RealtimeEventService,
  qualityService: PluginQualityService,
  securityScan: SecurityScanService,
  notifications: NotificationService
) {
  const releaseEvent = AzureDevOpsReleaseEventSchema.parse(payload);
  const release = releaseEvent.resource.release;
  const project = releaseEvent.resource.project;
  
  // For release events, we need to check if any of the artifacts are from plugin repositories
  const isPluginRelease = release.artifacts.some(artifact => 
    artifact.alias.includes('plugin') || artifact.alias.includes('backstage')
  );
  
  if (isPluginRelease && releaseEvent.eventType === 'ms.vss-release.release-created-event') {
    console.log(`New Azure DevOps plugin release: ${project.name} - ${release.name}`);
    
    await realtimeEvents.broadcast('plugin.release.created', {
      source: 'azuredevops',
      project: project.name,
      release: {
        id: release.id,
        name: release.name,
        status: release.status,
        createdOn: release.createdOn,
        createdBy: release.createdBy.displayName,
        description: release.description,
        reason: release.reason,
        url: release.url,
        artifacts: release.artifacts.map(artifact => ({
          sourceId: artifact.sourceId,
          type: artifact.type,
          alias: artifact.alias,
          isPrimary: artifact.isPrimary
        })),
        environments: release.environments.map(env => ({
          id: env.id,
          name: env.name,
          status: env.status,
          rank: env.rank
        }))
      },
      timestamp: new Date().toISOString()
    });

    await notifications.sendRealTimeNotification({
      type: 'plugin_release',
      title: `New Azure DevOps Plugin Release: ${release.name}`,
      message: `${project.name} has created a new release`,
      data: {
        source: 'azuredevops',
        project: project.name,
        releaseName: release.name,
        description: release.description
      },
      channels: ['websocket', 'database'],
      targetUsers: 'plugin_subscribers'
    });
  }

  await realtimeEvents.broadcast('azuredevops.release', {
    eventType: releaseEvent.eventType,
    project: project.name,
    release: {
      id: release.id,
      name: release.name,
      status: release.status
    },
    isPluginRelease,
    timestamp: new Date().toISOString()
  });
}

async function isBackstagePluginRepository(repository: any): Promise<boolean> {
  // Check repository name patterns
  if (repository.name.includes('backstage-plugin') || 
      repository.name.includes('plugin-') ||
      repository.name.includes('backstage') ||
      repository.name.startsWith('@backstage/')) {
    return true;
  }

  // Check project name patterns
  if (repository.project && 
      (repository.project.name.includes('backstage') ||
       repository.project.name.includes('plugin') ||
       repository.project.name.includes('idp'))) {
    return true;
  }

  // For Azure DevOps, we could also check repository description if available
  // This would require additional API calls to get full repository metadata
  
  return false;
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'azure-devops-webhooks',
    timestamp: new Date().toISOString(),
    capabilities: [
      'signature_validation',
      'rate_limiting',
      'real_time_events',
      'quality_triggers',
      'security_scanning',
      'notifications',
      'build_monitoring',
      'release_tracking'
    ],
    supportedEvents: [
      'git.push',
      'git.pullrequest.created',
      'git.pullrequest.updated',
      'git.pullrequest.merged',
      'build.complete',
      'ms.vss-release.release-created-event',
      'ms.vss-release.deployment-completed-event'
    ]
  });
}