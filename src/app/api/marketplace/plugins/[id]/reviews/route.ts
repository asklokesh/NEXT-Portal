import { NextRequest, NextResponse } from 'next/server';

interface PluginReview {
  id: string;
  pluginId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  title: string;
  content: string;
  pros: string[];
  cons: string[];
  version: string;
  verified: boolean;
  helpful: number;
  createdAt: string;
  updatedAt: string;
}

// In-memory storage for demo (shared with main route)
const reviewsDatabase = new Map<string, PluginReview[]>();

// GET /api/marketplace/plugins/[id]/reviews - Get reviews for a specific plugin
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const sort = searchParams.get('sort') || 'recent';
    const rating = searchParams.get('rating');

    let reviews = reviewsDatabase.get(params.id) || [];

    // Filter by rating if specified
    if (rating) {
      const ratingNum = parseInt(rating, 10);
      reviews = reviews.filter(r => r.rating === ratingNum);
    }

    // Sort reviews
    switch (sort) {
      case 'helpful':
        reviews.sort((a, b) => b.helpful - a.helpful);
        break;
      case 'rating_high':
        reviews.sort((a, b) => b.rating - a.rating);
        break;
      case 'rating_low':
        reviews.sort((a, b) => a.rating - b.rating);
        break;
      case 'recent':
      default:
        reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    // Apply pagination
    const total = reviews.length;
    reviews = reviews.slice(offset, offset + limit);

    // Calculate rating summary
    const allReviews = reviewsDatabase.get(params.id) || [];
    const ratingSummary = {
      average: allReviews.length > 0 
        ? Math.round((allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length) * 10) / 10 
        : 0,
      total: allReviews.length,
      distribution: {
        5: allReviews.filter(r => r.rating === 5).length,
        4: allReviews.filter(r => r.rating === 4).length,
        3: allReviews.filter(r => r.rating === 3).length,
        2: allReviews.filter(r => r.rating === 2).length,
        1: allReviews.filter(r => r.rating === 1).length
      }
    };

    return NextResponse.json({
      reviews,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
      summary: ratingSummary
    });

  } catch (error) {
    console.error('Failed to fetch reviews:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}

// POST /api/marketplace/plugins/[id]/reviews - Add a review
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId, userName, rating, title, content, pros, cons, version } = await request.json();

    if (!userId || !rating || !title || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, rating, title, content' },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    // Check if user already reviewed this plugin
    const existingReviews = reviewsDatabase.get(params.id) || [];
    const userExistingReview = existingReviews.find(r => r.userId === userId);

    if (userExistingReview) {
      // Update existing review
      userExistingReview.rating = rating;
      userExistingReview.title = title;
      userExistingReview.content = content;
      userExistingReview.pros = pros || [];
      userExistingReview.cons = cons || [];
      userExistingReview.version = version || userExistingReview.version;
      userExistingReview.updatedAt = new Date().toISOString();

      return NextResponse.json({
        message: 'Review updated successfully',
        review: userExistingReview
      });
    } else {
      // Create new review
      const newReview: PluginReview = {
        id: `review-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        pluginId: params.id,
        userId,
        userName: userName || 'Anonymous User',
        rating,
        title,
        content,
        pros: pros || [],
        cons: cons || [],
        version: version || 'latest',
        verified: false, // In production, check if user has installed the plugin
        helpful: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      existingReviews.push(newReview);
      reviewsDatabase.set(params.id, existingReviews);

      return NextResponse.json({
        message: 'Review added successfully',
        review: newReview
      }, { status: 201 });
    }

  } catch (error) {
    console.error('Failed to add review:', error);
    return NextResponse.json(
      { error: 'Failed to add review' },
      { status: 500 }
    );
  }
}

// PUT /api/marketplace/plugins/[id]/reviews - Update review helpfulness
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { reviewId, action } = await request.json();

    if (!reviewId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: reviewId, action' },
        { status: 400 }
      );
    }

    const reviews = reviewsDatabase.get(params.id) || [];
    const review = reviews.find(r => r.id === reviewId);

    if (!review) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      );
    }

    if (action === 'helpful') {
      review.helpful += 1;
    } else if (action === 'unhelpful' && review.helpful > 0) {
      review.helpful -= 1;
    }

    review.updatedAt = new Date().toISOString();

    return NextResponse.json({
      message: 'Review updated successfully',
      review
    });

  } catch (error) {
    console.error('Failed to update review:', error);
    return NextResponse.json(
      { error: 'Failed to update review' },
      { status: 500 }
    );
  }
}