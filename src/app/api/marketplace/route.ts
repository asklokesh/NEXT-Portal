/**
 * Ecosystem Marketplace API
 * Manage plugin marketplace, developer economy, and network effects
 */

import { NextRequest, NextResponse } from 'next/server';
import { ecosystemMarketplace } from '@/lib/marketplace/ecosystem-marketplace';
import { extractTenantContext, validateTenantAccess } from '@/middleware/tenant-context';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

/**
 * GET /api/marketplace - Get marketplace data and analytics
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'plugins';

    // Extract tenant context
    const tenantContext = extractTenantContext(request);
    const userRole = request.headers.get('x-user-role');
    const userId = request.headers.get('x-user-id');

    switch (action) {
      case 'health':
        return NextResponse.json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          marketplace: {
            enabled: true,
            plugins: ecosystemMarketplace.getPlugins().length,
            developers: ecosystemMarketplace.getDevelopers().length,
            operationalStatus: 'active'
          }
        });

      case 'plugins':
        const category = searchParams.get('category');
        const status = searchParams.get('status');
        const certified = searchParams.get('certified') === 'true';
        const search = searchParams.get('search');

        const plugins = ecosystemMarketplace.getPlugins({
          category: category || undefined,
          status: status || undefined,
          certified: certified || undefined,
          search: search || undefined
        });

        return NextResponse.json({
          plugins: plugins.map(plugin => ({
            id: plugin.id,
            name: plugin.name,
            slug: plugin.slug,
            description: plugin.description,
            category: plugin.category,
            subcategory: plugin.subcategory,
            version: plugin.version,
            author: {
              id: plugin.author.id,
              name: plugin.author.name,
              reputation: plugin.author.reputation,
              verified: plugin.author.verified
            },
            pricing: plugin.pricing,
            certification: {
              level: plugin.certification.level,
              certifiedAt: plugin.certification.certifiedAt
            },
            metadata: {
              downloads: plugin.metadata.downloads,
              installs: plugin.metadata.installs,
              rating: plugin.metadata.rating,
              reviews: plugin.metadata.reviews,
              lastUpdated: plugin.metadata.lastUpdated
            },
            status: plugin.status,
            createdAt: plugin.createdAt,
            updatedAt: plugin.updatedAt
          })),
          total: plugins.length,
          filters: { category, status, certified, search }
        });

      case 'plugin-details':
        const pluginId = searchParams.get('pluginId');
        if (!pluginId) {
          return NextResponse.json(
            { error: 'Missing pluginId parameter' },
            { status: 400 }
          );
        }

        const plugin = ecosystemMarketplace.getPlugins().find(p => p.id === pluginId);
        if (!plugin) {
          return NextResponse.json(
            { error: 'Plugin not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          plugin: {
            ...plugin,
            // Include full details for single plugin view
            content: plugin.content,
            distribution: plugin.distribution,
            analytics: plugin.analytics
          }
        });

      case 'developers':
        // Check admin access for developer data
        if (userRole !== 'admin') {
          return NextResponse.json(
            { error: 'Admin access required' },
            { status: 403 }
          );
        }

        const developers = ecosystemMarketplace.getDevelopers();
        return NextResponse.json({
          developers: developers.map(dev => ({
            id: dev.id,
            displayName: dev.displayName,
            reputation: dev.reputation,
            plugins: dev.plugins,
            activity: {
              lastActive: dev.activity.lastActive,
              responseTime: dev.activity.responseTime,
              supportQuality: dev.activity.supportQuality
            },
            earnings: userRole === 'admin' ? dev.earnings : undefined
          })),
          total: developers.length
        });

      case 'developer-profile':
        const developerId = searchParams.get('developerId') || userId;
        if (!developerId) {
          return NextResponse.json(
            { error: 'Missing developerId parameter' },
            { status: 400 }
          );
        }

        // Users can only access their own profile unless they're admin
        if (userRole !== 'admin' && developerId !== userId) {
          return NextResponse.json(
            { error: 'Access denied' },
            { status: 403 }
          );
        }

        const developer = ecosystemMarketplace.getDevelopers().find(d => d.id === developerId);
        if (!developer) {
          return NextResponse.json(
            { error: 'Developer profile not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          developer: {
            ...developer,
            // Hide sensitive information for non-admin users
            earnings: userRole === 'admin' || developerId === userId ? developer.earnings : undefined
          }
        });

      case 'analytics':
        // Check admin access for analytics
        if (userRole !== 'admin') {
          return NextResponse.json(
            { error: 'Admin access required' },
            { status: 403 }
          );
        }

        const analytics = ecosystemMarketplace.getMarketplaceAnalytics();
        return NextResponse.json({
          analytics,
          timestamp: new Date().toISOString()
        });

      case 'transactions':
        // Check admin access for transactions
        if (userRole !== 'admin') {
          return NextResponse.json(
            { error: 'Admin access required' },
            { status: 403 }
          );
        }

        const transactionPluginId = searchParams.get('pluginId');
        const transactionDeveloperId = searchParams.get('developerId');

        const transactions = ecosystemMarketplace.getTransactions({
          pluginId: transactionPluginId || undefined,
          developerId: transactionDeveloperId || undefined
        });

        return NextResponse.json({
          transactions: transactions.map(txn => ({
            id: txn.id,
            type: txn.type,
            pluginId: txn.pluginId,
            buyerId: txn.buyerId,
            sellerId: txn.sellerId,
            amount: txn.amount,
            currency: txn.currency,
            status: txn.status,
            createdAt: txn.createdAt,
            completedAt: txn.completedAt
          })),
          total: transactions.length
        });

      case 'network-effects':
        // Check admin access for network effects
        if (userRole !== 'admin') {
          return NextResponse.json(
            { error: 'Admin access required' },
            { status: 403 }
          );
        }

        const networkEffects = await ecosystemMarketplace.calculateNetworkEffects();
        return NextResponse.json({
          networkEffects,
          timestamp: new Date().toISOString()
        });

      case 'categories':
        const allPlugins = ecosystemMarketplace.getPlugins();
        const categories = new Map<string, { count: number; subcategories: Set<string> }>();

        for (const plugin of allPlugins) {
          if (!categories.has(plugin.category)) {
            categories.set(plugin.category, { count: 0, subcategories: new Set() });
          }
          const category = categories.get(plugin.category)!;
          category.count++;
          category.subcategories.add(plugin.subcategory);
        }

        return NextResponse.json({
          categories: Array.from(categories.entries()).map(([name, data]) => ({
            name,
            count: data.count,
            subcategories: Array.from(data.subcategories)
          }))
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported: health, plugins, plugin-details, developers, developer-profile, analytics, transactions, network-effects, categories' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error processing marketplace request:', error);
    return NextResponse.json(
      { error: 'Failed to process marketplace request' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/marketplace - Submit plugins, make purchases, submit reviews
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // Extract tenant context
    const tenantContext = extractTenantContext(request);
    const userRole = request.headers.get('x-user-role');
    const userId = request.headers.get('x-user-id');

    // Authentication check
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    switch (action) {
      case 'submit-plugin':
        return await handleSubmitPlugin(body, userId);

      case 'purchase-plugin':
        if (!tenantContext) {
          return NextResponse.json(
            { error: 'Tenant context required' },
            { status: 400 }
          );
        }
        return await handlePurchasePlugin(body, userId, tenantContext);

      case 'submit-review':
        return await handleSubmitReview(body, userId);

      case 'create-developer-profile':
        return await handleCreateDeveloperProfile(body, userId);

      case 'generate-payouts':
        if (userRole !== 'admin') {
          return NextResponse.json(
            { error: 'Admin access required' },
            { status: 403 }
          );
        }
        return await handleGeneratePayouts(body);

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported: submit-plugin, purchase-plugin, submit-review, create-developer-profile, generate-payouts' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error processing marketplace operation:', error);
    return NextResponse.json(
      { error: 'Failed to process marketplace operation' },
      { status: 500 }
    );
  }
}

/**
 * Handler implementations
 */
async function handleSubmitPlugin(body: any, userId: string): Promise<NextResponse> {
  const { plugin } = body;

  if (!plugin || !plugin.name || !plugin.description || !plugin.category) {
    return NextResponse.json(
      { error: 'Missing required plugin fields: name, description, category' },
      { status: 400 }
    );
  }

  // Validate pricing model
  if (!plugin.pricing || !plugin.pricing.model) {
    return NextResponse.json(
      { error: 'Missing pricing information' },
      { status: 400 }
    );
  }

  try {
    const pluginId = await ecosystemMarketplace.submitPlugin(
      {
        ...plugin,
        author: {
          id: userId,
          name: plugin.author?.name || 'Anonymous',
          email: plugin.author?.email || '',
          reputation: 50, // Starting reputation
          verified: false
        },
        certification: {
          level: 'community',
          securityScan: false,
          performanceTest: false,
          codeReview: false
        }
      },
      userId
    );

    return NextResponse.json({
      pluginId,
      message: 'Plugin submitted successfully and queued for certification',
      name: plugin.name,
      category: plugin.category
    });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit plugin' },
      { status: 500 }
    );
  }
}

async function handlePurchasePlugin(body: any, userId: string, tenantContext: any): Promise<NextResponse> {
  const { pluginId, purchaseOptions } = body;

  if (!pluginId) {
    return NextResponse.json(
      { error: 'Missing required field: pluginId' },
      { status: 400 }
    );
  }

  if (!purchaseOptions || !purchaseOptions.type) {
    return NextResponse.json(
      { error: 'Missing purchase options: type is required' },
      { status: 400 }
    );
  }

  try {
    const purchase = await ecosystemMarketplace.purchasePlugin(
      pluginId,
      userId,
      {
        type: purchaseOptions.type,
        period: purchaseOptions.period,
        quantity: purchaseOptions.quantity || 1
      }
    );

    return NextResponse.json({
      purchase: {
        transactionId: purchase.transactionId,
        downloadUrl: purchase.downloadUrl,
        licenseKey: purchase.licenseKey
      },
      message: 'Plugin purchased successfully',
      pluginId
    });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to purchase plugin' },
      { status: 500 }
    );
  }
}

async function handleSubmitReview(body: any, userId: string): Promise<NextResponse> {
  const { pluginId, review } = body;

  if (!pluginId || !review) {
    return NextResponse.json(
      { error: 'Missing required fields: pluginId, review' },
      { status: 400 }
    );
  }

  if (!review.rating || !review.title || !review.content) {
    return NextResponse.json(
      { error: 'Missing review fields: rating, title, content are required' },
      { status: 400 }
    );
  }

  if (review.rating < 1 || review.rating > 5) {
    return NextResponse.json(
      { error: 'Invalid rating: must be between 1 and 5' },
      { status: 400 }
    );
  }

  try {
    const reviewId = await ecosystemMarketplace.submitReview(
      pluginId,
      userId,
      {
        rating: review.rating,
        title: review.title,
        content: review.content,
        version: review.version || 'latest'
      }
    );

    return NextResponse.json({
      reviewId,
      message: 'Review submitted successfully',
      pluginId,
      rating: review.rating
    });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit review' },
      { status: 500 }
    );
  }
}

async function handleCreateDeveloperProfile(body: any, userId: string): Promise<NextResponse> {
  const { profile } = body;

  if (!profile || !profile.displayName) {
    return NextResponse.json(
      { error: 'Missing required field: displayName' },
      { status: 400 }
    );
  }

  try {
    // In a real implementation, this would create a developer profile
    console.log(`Creating developer profile for ${userId}:`, profile);

    return NextResponse.json({
      message: 'Developer profile created successfully',
      userId,
      displayName: profile.displayName
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create developer profile' },
      { status: 500 }
    );
  }
}

async function handleGeneratePayouts(body: any): Promise<NextResponse> {
  const { period } = body;

  if (!period || !period.start || !period.end) {
    return NextResponse.json(
      { error: 'Missing required fields: period.start, period.end' },
      { status: 400 }
    );
  }

  try {
    const payouts = await ecosystemMarketplace.generateRevenueSharePayouts({
      start: new Date(period.start),
      end: new Date(period.end)
    });

    return NextResponse.json({
      payouts: {
        totalPayouts: payouts.totalPayouts,
        processed: payouts.processed,
        failed: payouts.failed,
        developerCount: payouts.developerPayouts.length
      },
      message: 'Revenue share payouts generated successfully',
      period
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate payouts' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/marketplace - Update plugins, profiles, and settings
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    switch (action) {
      case 'update-plugin':
        return await handleUpdatePlugin(body, userId, userRole);

      case 'update-developer-profile':
        return await handleUpdateDeveloperProfile(body, userId, userRole);

      case 'approve-plugin':
        if (userRole !== 'admin') {
          return NextResponse.json(
            { error: 'Admin access required' },
            { status: 403 }
          );
        }
        return await handleApprovePlugin(body);

      case 'update-marketplace-settings':
        if (userRole !== 'admin') {
          return NextResponse.json(
            { error: 'Admin access required' },
            { status: 403 }
          );
        }
        return await handleUpdateMarketplaceSettings(body);

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported: update-plugin, update-developer-profile, approve-plugin, update-marketplace-settings' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error updating marketplace data:', error);
    return NextResponse.json(
      { error: 'Failed to update marketplace data' },
      { status: 500 }
    );
  }
}

async function handleUpdatePlugin(body: any, userId: string, userRole: string | null): Promise<NextResponse> {
  const { pluginId, updates } = body;

  if (!pluginId || !updates) {
    return NextResponse.json(
      { error: 'Missing required fields: pluginId, updates' },
      { status: 400 }
    );
  }

  // Verify ownership or admin access
  const plugin = ecosystemMarketplace.getPlugins().find(p => p.id === pluginId);
  if (!plugin) {
    return NextResponse.json(
      { error: 'Plugin not found' },
      { status: 404 }
    );
  }

  if (userRole !== 'admin' && plugin.author.id !== userId) {
    return NextResponse.json(
      { error: 'Access denied: you can only update your own plugins' },
      { status: 403 }
    );
  }

  // In a real implementation, this would update the plugin
  console.log(`Updating plugin ${pluginId}:`, updates);

  return NextResponse.json({
    message: 'Plugin updated successfully',
    pluginId,
    updates
  });
}

async function handleUpdateDeveloperProfile(body: any, userId: string, userRole: string | null): Promise<NextResponse> {
  const { developerId, updates } = body;
  const targetDeveloperId = developerId || userId;

  // Access control
  if (userRole !== 'admin' && targetDeveloperId !== userId) {
    return NextResponse.json(
      { error: 'Access denied: you can only update your own profile' },
      { status: 403 }
    );
  }

  if (!updates) {
    return NextResponse.json(
      { error: 'Missing required field: updates' },
      { status: 400 }
    );
  }

  // In a real implementation, this would update the developer profile
  console.log(`Updating developer profile ${targetDeveloperId}:`, updates);

  return NextResponse.json({
    message: 'Developer profile updated successfully',
    developerId: targetDeveloperId,
    updates
  });
}

async function handleApprovePlugin(body: any): Promise<NextResponse> {
  const { pluginId, approved, reason } = body;

  if (!pluginId || typeof approved !== 'boolean') {
    return NextResponse.json(
      { error: 'Missing required fields: pluginId, approved' },
      { status: 400 }
    );
  }

  // In a real implementation, this would approve/reject the plugin
  console.log(`Plugin ${pluginId} ${approved ? 'approved' : 'rejected'}: ${reason || 'No reason provided'}`);

  return NextResponse.json({
    message: `Plugin ${approved ? 'approved' : 'rejected'} successfully`,
    pluginId,
    approved,
    reason
  });
}

async function handleUpdateMarketplaceSettings(body: any): Promise<NextResponse> {
  const { settings } = body;

  if (!settings) {
    return NextResponse.json(
      { error: 'Missing required field: settings' },
      { status: 400 }
    );
  }

  // In a real implementation, this would update marketplace settings
  console.log('Updating marketplace settings:', settings);

  return NextResponse.json({
    message: 'Marketplace settings updated successfully',
    settings
  });
}

/**
 * DELETE /api/marketplace - Remove plugins and clean up data
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    const userRole = request.headers.get('x-user-role');
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    switch (action) {
      case 'delete-plugin':
        const pluginId = searchParams.get('pluginId');
        if (!pluginId) {
          return NextResponse.json(
            { error: 'Missing pluginId parameter' },
            { status: 400 }
          );
        }

        // Verify ownership or admin access
        const plugin = ecosystemMarketplace.getPlugins().find(p => p.id === pluginId);
        if (!plugin) {
          return NextResponse.json(
            { error: 'Plugin not found' },
            { status: 404 }
          );
        }

        if (userRole !== 'admin' && plugin.author.id !== userId) {
          return NextResponse.json(
            { error: 'Access denied: you can only delete your own plugins' },
            { status: 403 }
          );
        }

        console.log(`Deleting plugin: ${pluginId}`);
        return NextResponse.json({
          message: 'Plugin deleted successfully',
          pluginId
        });

      case 'clear-analytics':
        if (userRole !== 'admin') {
          return NextResponse.json(
            { error: 'Admin access required' },
            { status: 403 }
          );
        }

        console.log('Clearing marketplace analytics');
        return NextResponse.json({
          message: 'Marketplace analytics cleared successfully'
        });

      case 'reset-marketplace':
        if (userRole !== 'admin') {
          return NextResponse.json(
            { error: 'Admin access required' },
            { status: 403 }
          );
        }

        console.log('Resetting marketplace data');
        return NextResponse.json({
          message: 'Marketplace reset successfully'
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported: delete-plugin, clear-analytics, reset-marketplace' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error processing marketplace delete request:', error);
    return NextResponse.json(
      { error: 'Failed to process delete request' },
      { status: 500 }
    );
  }
}