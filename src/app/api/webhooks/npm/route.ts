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

// NPM webhook signature validation
async function validateNPMSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const hmac = createHmac('sha256', secret);
    hmac.update(payload, 'utf8');
    const expectedSignature = `sha256=${hmac.digest('hex')}`;
    
    if (signature.length !== expectedSignature.length) {
      return false;
    }
    
    return timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(expectedSignature, 'utf8')
    );
  } catch (error) {
    console.error('NPM signature validation error:', error);
    return false;
  }
}

// Rate limiting for NPM webhooks
const WEBHOOK_RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 minute
  max: 300, // 300 webhooks per minute (NPM can be very active)
  keyGenerator: (packageName: string) => `webhook_npm_${packageName.replace(/[^a-zA-Z0-9]/g, '_')}`
};

// NPM webhook event schemas
const NPMPackageSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  homepage: z.string().optional(),
  bugs: z.object({
    url: z.string().optional(),
    email: z.string().optional()
  }).optional(),
  license: z.string().optional(),
  author: z.object({
    name: z.string(),
    email: z.string().optional(),
    url: z.string().optional()
  }).or(z.string()).optional(),
  contributors: z.array(z.object({
    name: z.string(),
    email: z.string().optional(),
    url: z.string().optional()
  }).or(z.string())).optional(),
  maintainers: z.array(z.object({
    name: z.string(),
    email: z.string()
  })).optional(),
  repository: z.object({
    type: z.string(),
    url: z.string(),
    directory: z.string().optional()
  }).or(z.string()).optional(),
  main: z.string().optional(),
  scripts: z.record(z.string()).optional(),
  dependencies: z.record(z.string()).optional(),
  devDependencies: z.record(z.string()).optional(),
  peerDependencies: z.record(z.string()).optional(),
  optionalDependencies: z.record(z.string()).optional(),
  engines: z.record(z.string()).optional(),
  publishConfig: z.object({
    registry: z.string().optional(),
    access: z.enum(['public', 'restricted']).optional()
  }).optional(),
  dist: z.object({
    integrity: z.string(),
    shasum: z.string(),
    tarball: z.string(),
    fileCount: z.number().optional(),
    unpackedSize: z.number().optional(),
    signatures: z.array(z.object({
      keyid: z.string(),
      sig: z.string()
    })).optional()
  }),
  _id: z.string(),
  _nodeVersion: z.string().optional(),
  _npmVersion: z.string().optional(),
  _npmUser: z.object({
    name: z.string(),
    email: z.string()
  }).optional(),
  _hasShrinkwrap: z.boolean().optional()
});

const NPMPublishEventSchema = z.object({
  type: z.literal('package:publish'),
  name: z.string(),
  version: z.string(),
  hookOwner: z.object({
    username: z.string()
  }),
  payload: z.object({
    name: z.string(),
    version: z.string(),
    tag: z.string().optional(),
    access: z.enum(['public', 'restricted']).optional()
  }),
  change: z.object({
    type: z.literal('publish'),
    version: z.string(),
    published: z.string() // ISO date string
  }),
  time: z.string(), // ISO date string
  _id: z.string(),
  _rev: z.string().optional()
});

const NPMUnpublishEventSchema = z.object({
  type: z.literal('package:unpublish'),
  name: z.string(),
  version: z.string().optional(),
  hookOwner: z.object({
    username: z.string()
  }),
  payload: z.object({
    name: z.string(),
    version: z.string().optional()
  }),
  change: z.object({
    type: z.literal('unpublish'),
    version: z.string().optional(),
    unpublished: z.string() // ISO date string
  }),
  time: z.string(),
  _id: z.string(),
  _rev: z.string().optional()
});

const NPMOwnerEventSchema = z.object({
  type: z.literal('package:owner'),
  name: z.string(),
  hookOwner: z.object({
    username: z.string()
  }),
  payload: z.object({
    name: z.string(),
    action: z.enum(['add', 'remove']),
    user: z.string()
  }),
  change: z.object({
    type: z.literal('owner'),
    action: z.enum(['add', 'remove']),
    user: z.string(),
    time: z.string()
  }),
  time: z.string(),
  _id: z.string(),
  _rev: z.string().optional()
});

const NPMDistTagEventSchema = z.object({
  type: z.literal('package:dist-tag'),
  name: z.string(),
  hookOwner: z.object({
    username: z.string()
  }),
  payload: z.object({
    name: z.string(),
    action: z.enum(['add', 'remove', 'set']),
    tag: z.string(),
    version: z.string().optional()
  }),
  change: z.object({
    type: z.literal('dist-tag'),
    action: z.enum(['add', 'remove', 'set']),
    tag: z.string(),
    version: z.string().optional(),
    time: z.string()
  }),
  time: z.string(),
  _id: z.string(),
  _rev: z.string().optional()
});

export async function POST(req: NextRequest) {
  try {
    const headersList = headers();
    const signature = headersList.get('x-npm-signature');
    const delivery = headersList.get('x-npm-delivery');
    const userAgent = headersList.get('user-agent');
    
    // Validate user agent (NPM webhooks have specific user agent)
    if (!userAgent?.includes('npm-registry-hooks')) {
      return NextResponse.json(
        { error: 'Invalid user agent' },
        { status: 400 }
      );
    }

    const body = await req.text();
    
    // Validate webhook signature if configured
    const webhookSecret = process.env.NPM_WEBHOOK_SECRET;
    if (webhookSecret && signature) {
      const isValidSignature = await validateNPMSignature(body, signature, webhookSecret);
      if (!isValidSignature) {
        console.error('Invalid NPM webhook signature');
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
    const packageName = payload.name;
    if (packageName) {
      const rateLimitKey = WEBHOOK_RATE_LIMIT.keyGenerator(packageName);
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

    // Process NPM webhook event
    await processNPMWebhookEvent(payload.type, payload, delivery);

    return NextResponse.json({ 
      success: true, 
      type: payload.type,
      package: packageName,
      version: payload.version,
      delivery,
      processed: true,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('NPM webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function processNPMWebhookEvent(eventType: string, payload: any, delivery?: string | null) {
  const realtimeEvents = RealtimeEventService.getInstance();
  const qualityService = new PluginQualityService();
  const securityScan = new SecurityScanService();
  const notifications = new NotificationService();

  try {
    switch (eventType) {
      case 'package:publish':
        await handleNPMPublishEvent(payload, realtimeEvents, qualityService, securityScan, notifications);
        break;
      
      case 'package:unpublish':
        await handleNPMUnpublishEvent(payload, realtimeEvents, notifications);
        break;
      
      case 'package:owner':
        await handleNPMOwnerEvent(payload, realtimeEvents, notifications);
        break;
      
      case 'package:dist-tag':
        await handleNPMDistTagEvent(payload, realtimeEvents, notifications);
        break;
      
      default:
        console.log(`Unhandled NPM event: ${eventType}`);
        // Still broadcast for extensibility
        await realtimeEvents.broadcast('npm.event', {
          eventType,
          package: payload.name,
          payload,
          delivery,
          timestamp: new Date().toISOString()
        });
    }
  } catch (error) {
    console.error(`Error processing NPM ${eventType} event:`, error);
    
    // Broadcast error event for monitoring
    await realtimeEvents.broadcast('npm.error', {
      eventType,
      error: error instanceof Error ? error.message : 'Unknown error',
      package: payload.name,
      delivery,
      timestamp: new Date().toISOString()
    });
  }
}

async function handleNPMPublishEvent(
  payload: any,
  realtimeEvents: RealtimeEventService,
  qualityService: PluginQualityService,
  securityScan: SecurityScanService,
  notifications: NotificationService
) {
  const publishEvent = NPMPublishEventSchema.parse(payload);
  
  // Check if this is a Backstage plugin package
  const isPluginPackage = await isBackstagePluginPackage(publishEvent.name);
  
  if (isPluginPackage) {
    console.log(`New Backstage plugin published: ${publishEvent.name}@${publishEvent.version}`);
    
    // Fetch additional package metadata from NPM registry
    const packageMetadata = await fetchPackageMetadata(publishEvent.name, publishEvent.version);
    
    // Real-time broadcast
    await realtimeEvents.broadcast('plugin.package.published', {
      source: 'npm',
      package: {
        name: publishEvent.name,
        version: publishEvent.version,
        tag: publishEvent.payload.tag || 'latest',
        access: publishEvent.payload.access,
        publishedAt: publishEvent.change.published,
        metadata: packageMetadata
      },
      publisher: publishEvent.hookOwner.username,
      timestamp: new Date().toISOString()
    });

    // Trigger comprehensive quality evaluation for new package version
    await redis.lpush('quality_assessment_queue', JSON.stringify({
      type: 'package_published',
      source: 'npm',
      package: {
        name: publishEvent.name,
        version: publishEvent.version,
        tag: publishEvent.payload.tag || 'latest',
        publishedAt: publishEvent.change.published
      },
      metadata: packageMetadata,
      timestamp: new Date().toISOString()
    }));

    // Trigger security scan for new package
    await redis.lpush('security_scan_queue', JSON.stringify({
      type: 'package_published',
      source: 'npm',
      package: {
        name: publishEvent.name,
        version: publishEvent.version,
        tarball: packageMetadata?.dist?.tarball,
        dependencies: packageMetadata?.dependencies,
        devDependencies: packageMetadata?.devDependencies,
        peerDependencies: packageMetadata?.peerDependencies
      },
      timestamp: new Date().toISOString()
    }));

    // Real-time notifications
    await realtimeEvents.broadcast('plugin.quality.evaluation_started', {
      source: 'npm',
      package: publishEvent.name,
      version: publishEvent.version,
      reason: 'package_published',
      timestamp: new Date().toISOString()
    });

    await realtimeEvents.broadcast('plugin.security.scan_triggered', {
      source: 'npm',
      package: publishEvent.name,
      version: publishEvent.version,
      reason: 'package_published',
      timestamp: new Date().toISOString()
    });

    // Send notification to portal users
    await notifications.sendRealTimeNotification({
      type: 'plugin_package_published',
      title: `New Plugin Version: ${publishEvent.name}`,
      message: `Version ${publishEvent.version} of ${publishEvent.name} has been published to NPM`,
      data: {
        source: 'npm',
        package: publishEvent.name,
        version: publishEvent.version,
        tag: publishEvent.payload.tag || 'latest',
        publisher: publishEvent.hookOwner.username,
        publishedAt: publishEvent.change.published
      },
      channels: ['websocket', 'database'],
      targetUsers: 'plugin_subscribers',
      metadata: {
        packageName: publishEvent.name,
        isPluginPackage: true,
        source: 'npm',
        priority: 'high'
      }
    });

    // Check for major version changes
    const versionParts = publishEvent.version.split('.');
    const majorVersion = parseInt(versionParts[0], 10);
    
    if (majorVersion > 0 && versionParts[1] === '0' && versionParts[2] === '0') {
      // This is a major version release
      await notifications.sendRealTimeNotification({
        type: 'plugin_major_release',
        title: `Major Release: ${publishEvent.name} v${majorVersion}`,
        message: `${publishEvent.name} has released a major version ${publishEvent.version}`,
        data: {
          source: 'npm',
          package: publishEvent.name,
          version: publishEvent.version,
          majorVersion,
          isBreakingChange: true
        },
        channels: ['websocket', 'database', 'alert'],
        targetUsers: 'all_users',
        metadata: {
          priority: 'critical',
          requiresAttention: true
        }
      });
    }
  }

  // Always broadcast NPM publish event
  await realtimeEvents.broadcast('npm.package.published', {
    package: {
      name: publishEvent.name,
      version: publishEvent.version,
      tag: publishEvent.payload.tag || 'latest'
    },
    publisher: publishEvent.hookOwner.username,
    publishedAt: publishEvent.change.published,
    isPluginPackage,
    timestamp: new Date().toISOString()
  });
}

async function handleNPMUnpublishEvent(
  payload: any,
  realtimeEvents: RealtimeEventService,
  notifications: NotificationService
) {
  const unpublishEvent = NPMUnpublishEventSchema.parse(payload);
  
  const isPluginPackage = await isBackstagePluginPackage(unpublishEvent.name);
  
  if (isPluginPackage) {
    console.log(`Backstage plugin unpublished: ${unpublishEvent.name}${unpublishEvent.version ? `@${unpublishEvent.version}` : ''}`);
    
    await realtimeEvents.broadcast('plugin.package.unpublished', {
      source: 'npm',
      package: {
        name: unpublishEvent.name,
        version: unpublishEvent.version,
        unpublishedAt: unpublishEvent.change.unpublished
      },
      unpublisher: unpublishEvent.hookOwner.username,
      timestamp: new Date().toISOString()
    });

    // Send critical notification for unpublished plugins
    await notifications.sendRealTimeNotification({
      type: 'plugin_package_unpublished',
      priority: 'critical',
      title: `Plugin Unpublished: ${unpublishEvent.name}`,
      message: `${unpublishEvent.name}${unpublishEvent.version ? ` version ${unpublishEvent.version}` : ''} has been unpublished from NPM`,
      data: {
        source: 'npm',
        package: unpublishEvent.name,
        version: unpublishEvent.version,
        unpublisher: unpublishEvent.hookOwner.username,
        unpublishedAt: unpublishEvent.change.unpublished
      },
      channels: ['websocket', 'database', 'alert', 'email'],
      targetUsers: 'all_users',
      metadata: {
        packageName: unpublishEvent.name,
        isPluginPackage: true,
        source: 'npm',
        priority: 'critical',
        requiresAttention: true
      }
    });
  }

  await realtimeEvents.broadcast('npm.package.unpublished', {
    package: {
      name: unpublishEvent.name,
      version: unpublishEvent.version
    },
    unpublisher: unpublishEvent.hookOwner.username,
    unpublishedAt: unpublishEvent.change.unpublished,
    isPluginPackage,
    timestamp: new Date().toISOString()
  });
}

async function handleNPMOwnerEvent(
  payload: any,
  realtimeEvents: RealtimeEventService,
  notifications: NotificationService
) {
  const ownerEvent = NPMOwnerEventSchema.parse(payload);
  
  const isPluginPackage = await isBackstagePluginPackage(ownerEvent.name);
  
  if (isPluginPackage) {
    console.log(`Plugin package owner ${ownerEvent.change.action}: ${ownerEvent.name} - ${ownerEvent.change.user}`);
    
    await realtimeEvents.broadcast('plugin.package.owner_changed', {
      source: 'npm',
      package: ownerEvent.name,
      action: ownerEvent.change.action,
      user: ownerEvent.change.user,
      changedBy: ownerEvent.hookOwner.username,
      timestamp: new Date().toISOString()
    });

    // Notify for owner changes (security concern)
    await notifications.sendRealTimeNotification({
      type: 'plugin_owner_changed',
      priority: 'high',
      title: `Plugin Owner ${ownerEvent.change.action === 'add' ? 'Added' : 'Removed'}: ${ownerEvent.name}`,
      message: `${ownerEvent.change.user} has been ${ownerEvent.change.action === 'add' ? 'added as an owner' : 'removed as an owner'} of ${ownerEvent.name}`,
      data: {
        source: 'npm',
        package: ownerEvent.name,
        action: ownerEvent.change.action,
        user: ownerEvent.change.user,
        changedBy: ownerEvent.hookOwner.username
      },
      channels: ['websocket', 'database', 'alert'],
      targetUsers: 'security_team',
      metadata: {
        packageName: ownerEvent.name,
        isPluginPackage: true,
        source: 'npm',
        priority: 'high',
        securityRelevant: true
      }
    });
  }

  await realtimeEvents.broadcast('npm.package.owner', {
    package: ownerEvent.name,
    action: ownerEvent.change.action,
    user: ownerEvent.change.user,
    changedBy: ownerEvent.hookOwner.username,
    isPluginPackage,
    timestamp: new Date().toISOString()
  });
}

async function handleNPMDistTagEvent(
  payload: any,
  realtimeEvents: RealtimeEventService,
  notifications: NotificationService
) {
  const distTagEvent = NPMDistTagEventSchema.parse(payload);
  
  const isPluginPackage = await isBackstagePluginPackage(distTagEvent.name);
  
  if (isPluginPackage) {
    console.log(`Plugin dist-tag ${distTagEvent.change.action}: ${distTagEvent.name} ${distTagEvent.change.tag}`);
    
    await realtimeEvents.broadcast('plugin.package.dist_tag_changed', {
      source: 'npm',
      package: distTagEvent.name,
      action: distTagEvent.change.action,
      tag: distTagEvent.change.tag,
      version: distTagEvent.change.version,
      changedBy: distTagEvent.hookOwner.username,
      timestamp: new Date().toISOString()
    });

    // Notify for important tag changes (latest, stable, etc.)
    const importantTags = ['latest', 'stable', 'next', 'beta', 'alpha'];
    if (importantTags.includes(distTagEvent.change.tag)) {
      await notifications.sendRealTimeNotification({
        type: 'plugin_dist_tag_changed',
        title: `Plugin Tag Updated: ${distTagEvent.name}`,
        message: `The '${distTagEvent.change.tag}' tag has been ${distTagEvent.change.action}${distTagEvent.change.version ? ` to version ${distTagEvent.change.version}` : ''}`,
        data: {
          source: 'npm',
          package: distTagEvent.name,
          action: distTagEvent.change.action,
          tag: distTagEvent.change.tag,
          version: distTagEvent.change.version,
          changedBy: distTagEvent.hookOwner.username
        },
        channels: ['websocket', 'database'],
        targetUsers: 'plugin_subscribers',
        metadata: {
          packageName: distTagEvent.name,
          isPluginPackage: true,
          source: 'npm',
          priority: distTagEvent.change.tag === 'latest' ? 'high' : 'normal'
        }
      });
    }
  }

  await realtimeEvents.broadcast('npm.package.dist_tag', {
    package: distTagEvent.name,
    action: distTagEvent.change.action,
    tag: distTagEvent.change.tag,
    version: distTagEvent.change.version,
    changedBy: distTagEvent.hookOwner.username,
    isPluginPackage,
    timestamp: new Date().toISOString()
  });
}

async function isBackstagePluginPackage(packageName: string): Promise<boolean> {
  // Check package name patterns
  if (packageName.startsWith('@backstage/plugin-') ||
      packageName.startsWith('@roadiehq/backstage-plugin-') ||
      packageName.startsWith('@spotify/backstage-plugin-') ||
      packageName.includes('backstage-plugin') ||
      packageName.includes('backstage-template')) {
    return true;
  }

  // Check for common Backstage plugin naming patterns
  if (packageName.includes('backstage') && 
      (packageName.includes('plugin') || packageName.includes('template'))) {
    return true;
  }

  return false;
}

async function fetchPackageMetadata(packageName: string, version: string): Promise<any> {
  try {
    const response = await fetch(`https://registry.npmjs.org/${packageName}/${version}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'backstage-portal-webhook'
      },
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });

    if (response.ok) {
      return await response.json();
    } else {
      console.warn(`Failed to fetch package metadata for ${packageName}@${version}: ${response.status}`);
      return null;
    }
  } catch (error) {
    console.error(`Error fetching package metadata for ${packageName}@${version}:`, error);
    return null;
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'npm-webhooks',
    timestamp: new Date().toISOString(),
    capabilities: [
      'signature_validation',
      'rate_limiting',
      'real_time_events',
      'quality_triggers',
      'security_scanning',
      'notifications',
      'package_monitoring',
      'version_tracking'
    ],
    supportedEvents: [
      'package:publish',
      'package:unpublish',
      'package:owner',
      'package:dist-tag'
    ]
  });
}