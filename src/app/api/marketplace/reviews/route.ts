import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';

const prisma = new PrismaClient();

// Review submission schema
const ReviewSchema = z.object({
  pluginId: z.string().min(1),
  rating: z.number().min(1).max(5),
  title: z.string().min(1).max(200),
  comment: z.string().max(5000).optional(),
  pros: z.array(z.string()).optional(),
  cons: z.array(z.string()).optional(),
  version: z.string().optional(),
  usageContext: z.object({
    environment: z.enum(['development', 'staging', 'production']).optional(),
    teamSize: z.enum(['small', 'medium', 'large']).optional(),
    useDuration: z.enum(['days', 'weeks', 'months', 'years']).optional(),
    complexity: z.enum(['simple', 'moderate', 'complex']).optional()
  }).optional()
});

const ReviewUpdateSchema = ReviewSchema.partial().extend({
  reviewId: z.string().min(1)
});

const ReviewFiltersSchema = z.object({
  pluginId: z.string().optional(),
  rating: z.coerce.number().min(1).max(5).optional(),
  verified: z.coerce.boolean().optional(),
  hasComment: z.coerce.boolean().optional(),
  sortBy: z.enum(['newest', 'oldest', 'rating-high', 'rating-low', 'helpful']).default('newest'),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20)
});

// GET /api/marketplace/reviews - Fetch reviews with advanced filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawFilters = Object.fromEntries(searchParams.entries());
    const filters = ReviewFiltersSchema.parse(rawFilters);

    const where: any = {};
    
    if (filters.pluginId) {
      where.marketplacePluginId = filters.pluginId;
    }
    
    if (filters.rating) {
      where.rating = { gte: filters.rating };
    }
    
    if (filters.verified !== undefined) {
      where.isVerifiedPurchase = filters.verified;
    }
    
    if (filters.hasComment) {
      where.comment = { not: null };
    }

    // Build sorting options
    const orderBy: any = {};
    switch (filters.sortBy) {
      case 'newest':
        orderBy.createdAt = 'desc';
        break;
      case 'oldest':
        orderBy.createdAt = 'asc';
        break;
      case 'rating-high':
        orderBy.rating = 'desc';
        break;
      case 'rating-low':
        orderBy.rating = 'asc';
        break;
      case 'helpful':
        orderBy.helpfulCount = 'desc';
        break;
    }

    const [reviews, totalCount] = await Promise.all([
      prisma.pluginReview.findMany({
        where,
        orderBy,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        include: {
          marketplacePlugin: {
            include: {
              plugin: {
                select: {
                  name: true,
                  displayName: true
                }
              }
            }
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true
            }
          },
          _count: {
            select: {
              helpfulVotes: true,
              replies: true
            }
          }
        }
      }),
      prisma.pluginReview.count({ where })
    ]);

    // Calculate review statistics for the plugin
    let statistics = null;
    if (filters.pluginId) {
      const stats = await prisma.pluginReview.aggregate({
        where: { marketplacePluginId: filters.pluginId },
        _avg: { rating: true },
        _count: { rating: true },
        _min: { createdAt: true },
        _max: { createdAt: true }
      });

      const ratingDistribution = await prisma.pluginReview.groupBy({
        by: ['rating'],
        where: { marketplacePluginId: filters.pluginId },
        _count: { rating: true }
      });

      statistics = {
        averageRating: stats._avg.rating || 0,
        totalReviews: stats._count.rating,
        firstReview: stats._min.createdAt,
        latestReview: stats._max.createdAt,
        ratingDistribution: ratingDistribution.reduce((acc, curr) => {
          acc[curr.rating] = curr._count.rating;
          return acc;
        }, {} as Record<number, number>),
        verifiedPurchaseCount: await prisma.pluginReview.count({
          where: { marketplacePluginId: filters.pluginId, isVerifiedPurchase: true }
        })
      };
    }

    const response = {
      success: true,
      data: {
        reviews: reviews.map(review => ({
          id: review.id,
          rating: review.rating,
          title: review.title,
          comment: review.comment,
          isVerifiedPurchase: review.isVerifiedPurchase,
          helpfulCount: review._count.helpfulVotes,
          replyCount: review._count.replies,
          createdAt: review.createdAt.toISOString(),
          updatedAt: review.updatedAt.toISOString(),
          plugin: review.marketplacePlugin?.plugin ? {
            name: review.marketplacePlugin.plugin.name,
            displayName: review.marketplacePlugin.plugin.displayName
          } : null,
          user: {
            id: review.user?.id || 'anonymous',
            name: review.user?.name || 'Anonymous User',
            avatar: review.user?.avatar,
            // Don't expose email for privacy
          }
        })),
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / filters.limit),
          hasNext: filters.page * filters.limit < totalCount,
          hasPrev: filters.page > 1
        },
        statistics
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Reviews API Error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request parameters',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch reviews',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// POST /api/marketplace/reviews - Submit a new review
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ 
        success: false, 
        error: 'Authentication required' 
      }, { status: 401 });
    }

    const body = await request.json();
    const reviewData = ReviewSchema.parse(body);

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, email: true }
    });

    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 });
    }

    // Verify plugin exists and get marketplace plugin ID
    const plugin = await prisma.plugin.findUnique({
      where: { id: reviewData.pluginId },
      include: {
        marketplacePlugin: {
          select: { id: true }
        }
      }
    });

    if (!plugin?.marketplacePlugin) {
      return NextResponse.json({
        success: false,
        error: 'Plugin not found in marketplace'
      }, { status: 404 });
    }

    // Check if user already reviewed this plugin
    const existingReview = await prisma.pluginReview.findFirst({
      where: {
        marketplacePluginId: plugin.marketplacePlugin.id,
        userId: user.id
      }
    });

    if (existingReview) {
      return NextResponse.json({
        success: false,
        error: 'You have already reviewed this plugin. Use PUT to update your review.'
      }, { status: 409 });
    }

    // Check if user has purchased/installed the plugin (verified purchase)
    const hasInstalled = await prisma.pluginOperation.findFirst({
      where: {
        pluginId: reviewData.pluginId,
        performedBy: user.id,
        operationType: 'INSTALL',
        status: 'COMPLETED'
      }
    });

    const hasPurchased = await prisma.pluginSale.findFirst({
      where: {
        marketplacePluginId: plugin.marketplacePlugin.id,
        buyerOrgId: user.id, // Simplified - in production would check user's org
        status: 'COMPLETED'
      }
    });

    const isVerifiedPurchase = Boolean(hasInstalled || hasPurchased);

    // Create the review
    const review = await prisma.pluginReview.create({
      data: {
        marketplacePluginId: plugin.marketplacePlugin.id,
        userId: user.id,
        rating: reviewData.rating,
        title: reviewData.title,
        comment: reviewData.comment,
        isVerifiedPurchase,
        metadata: {
          pros: reviewData.pros || [],
          cons: reviewData.cons || [],
          version: reviewData.version,
          usageContext: reviewData.usageContext
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true
          }
        }
      }
    });

    // Update plugin average rating and review count
    const updatedStats = await prisma.pluginReview.aggregate({
      where: { marketplacePluginId: plugin.marketplacePlugin.id },
      _avg: { rating: true },
      _count: { rating: true }
    });

    await prisma.plugin.update({
      where: { id: reviewData.pluginId },
      data: {
        // Store computed rating for fast queries
        starCount: Math.round((updatedStats._avg.rating || 0) * updatedStats._count.rating),
        // Update any cached review count if stored
        issueCount: updatedStats._count.rating
      }
    });

    // Create activity/notification for plugin developer
    const pluginDeveloper = await prisma.plugin.findUnique({
      where: { id: reviewData.pluginId },
      select: { author: true }
    });

    if (pluginDeveloper?.author) {
      await prisma.notification.create({
        data: {
          userId: pluginDeveloper.author,
          type: 'info',
          title: 'New Plugin Review',
          message: `${user.name} left a ${reviewData.rating}-star review for your plugin "${plugin.displayName}"`,
          sourceName: plugin.displayName,
          sourceType: 'plugin',
          metadata: JSON.stringify({
            pluginId: reviewData.pluginId,
            reviewId: review.id,
            rating: reviewData.rating
          })
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        review: {
          id: review.id,
          rating: review.rating,
          title: review.title,
          comment: review.comment,
          isVerifiedPurchase: review.isVerifiedPurchase,
          createdAt: review.createdAt.toISOString(),
          user: review.user
        },
        statistics: {
          averageRating: updatedStats._avg.rating || 0,
          totalReviews: updatedStats._count.rating
        }
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Review submission error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid review data',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to submit review',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// PUT /api/marketplace/reviews - Update an existing review
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ 
        success: false, 
        error: 'Authentication required' 
      }, { status: 401 });
    }

    const body = await request.json();
    const updateData = ReviewUpdateSchema.parse(body);

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 });
    }

    // Find and verify ownership of the review
    const existingReview = await prisma.pluginReview.findFirst({
      where: {
        id: updateData.reviewId,
        userId: user.id
      },
      include: {
        marketplacePlugin: {
          include: {
            plugin: true
          }
        }
      }
    });

    if (!existingReview) {
      return NextResponse.json({
        success: false,
        error: 'Review not found or not owned by user'
      }, { status: 404 });
    }

    // Update the review
    const updatedReview = await prisma.pluginReview.update({
      where: { id: updateData.reviewId },
      data: {
        ...(updateData.rating && { rating: updateData.rating }),
        ...(updateData.title && { title: updateData.title }),
        ...(updateData.comment && { comment: updateData.comment }),
        ...(updateData.pros || updateData.cons || updateData.usageContext) && {
          metadata: {
            ...(existingReview.metadata as any || {}),
            ...(updateData.pros && { pros: updateData.pros }),
            ...(updateData.cons && { cons: updateData.cons }),
            ...(updateData.usageContext && { usageContext: updateData.usageContext })
          }
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true
          }
        }
      }
    });

    // Recalculate plugin statistics if rating changed
    if (updateData.rating) {
      const updatedStats = await prisma.pluginReview.aggregate({
        where: { marketplacePluginId: existingReview.marketplacePluginId },
        _avg: { rating: true },
        _count: { rating: true }
      });

      await prisma.plugin.update({
        where: { id: existingReview.marketplacePlugin.plugin.id },
        data: {
          starCount: Math.round((updatedStats._avg.rating || 0) * updatedStats._count.rating)
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        review: {
          id: updatedReview.id,
          rating: updatedReview.rating,
          title: updatedReview.title,
          comment: updatedReview.comment,
          isVerifiedPurchase: updatedReview.isVerifiedPurchase,
          updatedAt: updatedReview.updatedAt.toISOString(),
          user: updatedReview.user
        },
        message: 'Review updated successfully'
      }
    });

  } catch (error) {
    console.error('Review update error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid update data',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to update review',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE /api/marketplace/reviews - Delete a review
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ 
        success: false, 
        error: 'Authentication required' 
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const reviewId = searchParams.get('reviewId');

    if (!reviewId) {
      return NextResponse.json({
        success: false,
        error: 'Review ID is required'
      }, { status: 400 });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 });
    }

    // Find and verify ownership of the review
    const review = await prisma.pluginReview.findFirst({
      where: {
        id: reviewId,
        userId: user.id
      },
      include: {
        marketplacePlugin: {
          include: {
            plugin: true
          }
        }
      }
    });

    if (!review) {
      return NextResponse.json({
        success: false,
        error: 'Review not found or not owned by user'
      }, { status: 404 });
    }

    // Delete the review
    await prisma.pluginReview.delete({
      where: { id: reviewId }
    });

    // Recalculate plugin statistics
    const updatedStats = await prisma.pluginReview.aggregate({
      where: { marketplacePluginId: review.marketplacePluginId },
      _avg: { rating: true },
      _count: { rating: true }
    });

    await prisma.plugin.update({
      where: { id: review.marketplacePlugin.plugin.id },
      data: {
        starCount: Math.round((updatedStats._avg.rating || 0) * updatedStats._count.rating),
        issueCount: updatedStats._count.rating
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Review deleted successfully'
    });

  } catch (error) {
    console.error('Review deletion error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to delete review',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}