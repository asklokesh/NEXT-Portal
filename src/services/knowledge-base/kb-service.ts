/**
 * Knowledge Base and Documentation Service
 * 
 * Comprehensive knowledge management system with:
 * - Searchable documentation site
 * - API reference with interactive examples
 * - Video tutorials and walkthroughs
 * - Best practices and case studies
 * - Community forums and discussions
 */

import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { EventEmitter } from 'events';
import algoliasearch from 'algoliasearch';

const prisma = new PrismaClient();

export interface KBArticle {
  id: string;
  slug: string;
  title: string;
  excerpt?: string;
  content: string;
  category: string;
  subcategory?: string;
  tags: string[];
  author: string;
  version: string;
  isPublished: boolean;
  publishedAt?: Date;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const createArticleSchema = z.object({
  title: z.string().min(5).max(200),
  excerpt: z.string().max(300).optional(),
  content: z.string().min(50),
  category: z.string(),
  subcategory: z.string().optional(),
  tags: z.array(z.string()).default([]),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  keywords: z.array(z.string()).default([]),
  isDraft: z.boolean().default(false),
  contentFormat: z.enum(['MARKDOWN', 'HTML', 'RICH_TEXT']).default('MARKDOWN')
});

const searchParamsSchema = z.object({
  query: z.string(),
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),
  page: z.number().default(1),
  limit: z.number().default(20),
  sortBy: z.enum(['relevance', 'views', 'date', 'helpful']).default('relevance')
});

export class KnowledgeBaseService extends EventEmitter {
  private searchClient: any;
  private searchIndex: any;

  constructor() {
    super();
    
    // Initialize search client (Algolia or similar)
    if (process.env.ALGOLIA_APP_ID && process.env.ALGOLIA_API_KEY) {
      this.searchClient = algoliasearch(
        process.env.ALGOLIA_APP_ID,
        process.env.ALGOLIA_API_KEY
      );
      this.searchIndex = this.searchClient.initIndex('knowledge_base');
    }
  }

  /**
   * Create new knowledge base article
   */
  async createArticle(
    authorId: string,
    data: z.infer<typeof createArticleSchema>
  ): Promise<KBArticle> {
    try {
      const validatedData = createArticleSchema.parse(data);
      
      // Generate slug from title
      const slug = this.generateSlug(validatedData.title);
      
      // Check for duplicate slug
      const existingArticle = await prisma.knowledgeBaseArticle.findUnique({
        where: { slug }
      });
      
      if (existingArticle) {
        throw new Error('Article with similar title already exists');
      }

      const article = await prisma.knowledgeBaseArticle.create({
        data: {
          slug,
          title: validatedData.title,
          excerpt: validatedData.excerpt,
          content: validatedData.content,
          contentFormat: validatedData.contentFormat,
          category: validatedData.category,
          subcategory: validatedData.subcategory,
          tags: validatedData.tags,
          author: authorId,
          metaTitle: validatedData.metaTitle,
          metaDescription: validatedData.metaDescription,
          keywords: validatedData.keywords,
          isDraft: validatedData.isDraft,
          isPublished: !validatedData.isDraft,
          publishedAt: !validatedData.isDraft ? new Date() : null
        }
      });

      // Index for search if published
      if (!validatedData.isDraft) {
        await this.indexArticle(article);
      }

      this.emit('articleCreated', article);
      return article as any;
    } catch (error) {
      console.error('Error creating article:', error);
      throw new Error('Failed to create article');
    }
  }

  /**
   * Update existing article
   */
  async updateArticle(
    articleId: string,
    data: Partial<z.infer<typeof createArticleSchema>>
  ): Promise<KBArticle> {
    try {
      const updateData: any = { ...data };
      
      // Update slug if title changed
      if (data.title) {
        updateData.slug = this.generateSlug(data.title);
      }
      
      // Handle publishing
      if (data.isDraft === false) {
        updateData.isPublished = true;
        updateData.publishedAt = new Date();
      }

      const article = await prisma.knowledgeBaseArticle.update({
        where: { id: articleId },
        data: updateData
      });

      // Re-index if published
      if (article.isPublished) {
        await this.indexArticle(article);
      }

      this.emit('articleUpdated', article);
      return article as any;
    } catch (error) {
      console.error('Error updating article:', error);
      throw new Error('Failed to update article');
    }
  }

  /**
   * Get article by slug
   */
  async getArticle(slug: string, incrementView = true): Promise<KBArticle | null> {
    try {
      const article = await prisma.knowledgeBaseArticle.findUnique({
        where: { slug, isPublished: true },
        include: {
          relatedArticles: {
            include: {
              // Self-reference would need careful handling
            }
          },
          attachments: true,
          comments: {
            take: 10,
            orderBy: { createdAt: 'desc' }
          },
          ratings: {
            select: { rating: true }
          }
        }
      });

      if (!article) return null;

      // Increment view count
      if (incrementView) {
        await prisma.knowledgeBaseArticle.update({
          where: { id: article.id },
          data: { viewCount: { increment: 1 } }
        });
      }

      return article as any;
    } catch (error) {
      console.error('Error fetching article:', error);
      throw new Error('Failed to fetch article');
    }
  }

  /**
   * Search knowledge base articles
   */
  async searchArticles(params: z.infer<typeof searchParamsSchema>) {
    try {
      const validatedParams = searchParamsSchema.parse(params);
      const { query, category, tags, page, limit, sortBy } = validatedParams;

      // Use Algolia search if available
      if (this.searchIndex) {
        return await this.searchWithAlgolia(validatedParams);
      }

      // Fallback to database search
      const where: any = {
        isPublished: true,
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { content: { contains: query, mode: 'insensitive' } },
          { excerpt: { contains: query, mode: 'insensitive' } }
        ]
      };

      if (category) where.category = category;
      if (tags.length) {
        where.tags = { hasSome: tags };
      }

      const orderBy: any = {};
      switch (sortBy) {
        case 'views':
          orderBy.viewCount = 'desc';
          break;
        case 'date':
          orderBy.publishedAt = 'desc';
          break;
        case 'helpful':
          orderBy.helpfulCount = 'desc';
          break;
        default:
          orderBy.createdAt = 'desc';
      }

      const [articles, total] = await Promise.all([
        prisma.knowledgeBaseArticle.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            slug: true,
            title: true,
            excerpt: true,
            category: true,
            subcategory: true,
            tags: true,
            author: true,
            publishedAt: true,
            viewCount: true,
            helpfulCount: true,
            notHelpfulCount: true
          }
        }),
        prisma.knowledgeBaseArticle.count({ where })
      ]);

      return {
        articles,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error searching articles:', error);
      throw new Error('Failed to search articles');
    }
  }

  /**
   * Get articles by category
   */
  async getArticlesByCategory(
    category: string,
    subcategory?: string,
    page = 1,
    limit = 20
  ) {
    try {
      const where: any = {
        category,
        isPublished: true
      };

      if (subcategory) where.subcategory = subcategory;

      const [articles, total] = await Promise.all([
        prisma.knowledgeBaseArticle.findMany({
          where,
          orderBy: { publishedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            slug: true,
            title: true,
            excerpt: true,
            category: true,
            subcategory: true,
            tags: true,
            author: true,
            publishedAt: true,
            viewCount: true,
            helpfulCount: true
          }
        }),
        prisma.knowledgeBaseArticle.count({ where })
      ]);

      return {
        articles,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      };
    } catch (error) {
      console.error('Error fetching articles by category:', error);
      throw new Error('Failed to fetch articles');
    }
  }

  /**
   * Rate article helpfulness
   */
  async rateArticle(
    articleId: string,
    userId: string,
    rating: number,
    feedback?: string
  ) {
    try {
      if (rating < 1 || rating > 5) {
        throw new Error('Rating must be between 1 and 5');
      }

      // Check for existing rating
      const existingRating = await prisma.articleRating.findUnique({
        where: { articleId_userId: { articleId, userId } }
      });

      if (existingRating) {
        // Update existing rating
        await prisma.articleRating.update({
          where: { id: existingRating.id },
          data: { rating, feedback }
        });
      } else {
        // Create new rating
        await prisma.articleRating.create({
          data: { articleId, userId, rating, feedback }
        });
      }

      // Recalculate article helpful counts
      await this.recalculateArticleHelpfulness(articleId);

      return { success: true };
    } catch (error) {
      console.error('Error rating article:', error);
      throw new Error('Failed to rate article');
    }
  }

  /**
   * Add comment to article
   */
  async addComment(
    articleId: string,
    userId: string,
    content: string
  ) {
    try {
      const comment = await prisma.articleComment.create({
        data: { articleId, userId, content }
      });

      this.emit('commentAdded', { articleId, comment });
      return comment;
    } catch (error) {
      console.error('Error adding comment:', error);
      throw new Error('Failed to add comment');
    }
  }

  /**
   * Get popular articles
   */
  async getPopularArticles(limit = 10) {
    try {
      return await prisma.knowledgeBaseArticle.findMany({
        where: { isPublished: true },
        orderBy: [
          { viewCount: 'desc' },
          { helpfulCount: 'desc' }
        ],
        take: limit,
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          category: true,
          tags: true,
          viewCount: true,
          helpfulCount: true,
          publishedAt: true
        }
      });
    } catch (error) {
      console.error('Error fetching popular articles:', error);
      throw new Error('Failed to fetch popular articles');
    }
  }

  /**
   * Get recent articles
   */
  async getRecentArticles(limit = 10) {
    try {
      return await prisma.knowledgeBaseArticle.findMany({
        where: { isPublished: true },
        orderBy: { publishedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          category: true,
          tags: true,
          publishedAt: true
        }
      });
    } catch (error) {
      console.error('Error fetching recent articles:', error);
      throw new Error('Failed to fetch recent articles');
    }
  }

  /**
   * Get categories with article counts
   */
  async getCategories() {
    try {
      const categories = await prisma.knowledgeBaseArticle.groupBy({
        by: ['category', 'subcategory'],
        where: { isPublished: true },
        _count: { id: true }
      });

      const categoriesMap: { [key: string]: any } = {};
      
      categories.forEach(cat => {
        if (!categoriesMap[cat.category]) {
          categoriesMap[cat.category] = {
            name: cat.category,
            count: 0,
            subcategories: []
          };
        }
        
        categoriesMap[cat.category].count += cat._count.id;
        
        if (cat.subcategory) {
          categoriesMap[cat.category].subcategories.push({
            name: cat.subcategory,
            count: cat._count.id
          });
        }
      });

      return Object.values(categoriesMap);
    } catch (error) {
      console.error('Error fetching categories:', error);
      throw new Error('Failed to fetch categories');
    }
  }

  /**
   * Video tutorial management
   */
  async createVideoTutorial(data: {
    title: string;
    description: string;
    videoUrl: string;
    thumbnailUrl?: string;
    duration: number;
    category: string;
    tags: string[];
    transcriptUrl?: string;
  }) {
    try {
      const video = await prisma.videoTutorial.create({
        data: {
          ...data,
          isPublished: true,
          publishedAt: new Date()
        }
      });

      this.emit('videoCreated', video);
      return video;
    } catch (error) {
      console.error('Error creating video tutorial:', error);
      throw new Error('Failed to create video tutorial');
    }
  }

  async getVideoTutorials(category?: string) {
    try {
      const where: any = { isPublished: true };
      if (category) where.category = category;

      return await prisma.videoTutorial.findMany({
        where,
        orderBy: { publishedAt: 'desc' }
      });
    } catch (error) {
      console.error('Error fetching video tutorials:', error);
      throw new Error('Failed to fetch video tutorials');
    }
  }

  /**
   * Community forum management
   */
  async createForumTopic(
    forumId: string,
    userId: string,
    title: string,
    content: string
  ) {
    try {
      const topic = await prisma.forumTopic.create({
        data: {
          forumId,
          userId,
          title,
          content
        }
      });

      // Update forum post count
      await prisma.communityForum.update({
        where: { id: forumId },
        data: { postCount: { increment: 1 } }
      });

      this.emit('topicCreated', topic);
      return topic;
    } catch (error) {
      console.error('Error creating forum topic:', error);
      throw new Error('Failed to create forum topic');
    }
  }

  async getForumTopics(forumId: string, page = 1, limit = 20) {
    try {
      const [topics, total] = await Promise.all([
        prisma.forumTopic.findMany({
          where: { forumId },
          orderBy: [
            { isPinned: 'desc' },
            { lastReplyAt: 'desc' },
            { createdAt: 'desc' }
          ],
          skip: (page - 1) * limit,
          take: limit,
          include: {
            replies: {
              take: 1,
              orderBy: { createdAt: 'desc' }
            }
          }
        }),
        prisma.forumTopic.count({ where: { forumId } })
      ]);

      return {
        topics,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      };
    } catch (error) {
      console.error('Error fetching forum topics:', error);
      throw new Error('Failed to fetch forum topics');
    }
  }

  /**
   * Generate analytics for knowledge base
   */
  async getAnalytics(timeframe: '7d' | '30d' | '90d' = '30d') {
    try {
      const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const [
        totalArticles,
        totalViews,
        topArticles,
        categoryStats,
        searchTerms
      ] = await Promise.all([
        prisma.knowledgeBaseArticle.count({
          where: { isPublished: true, createdAt: { gte: since } }
        }),
        prisma.knowledgeBaseArticle.aggregate({
          where: { isPublished: true },
          _sum: { viewCount: true }
        }),
        prisma.knowledgeBaseArticle.findMany({
          where: { isPublished: true },
          orderBy: { viewCount: 'desc' },
          take: 10,
          select: { slug: true, title: true, viewCount: true, category: true }
        }),
        prisma.knowledgeBaseArticle.groupBy({
          by: ['category'],
          where: { isPublished: true },
          _count: { id: true },
          _sum: { viewCount: true }
        }),
        // This would need to be tracked separately in search logs
        this.getPopularSearchTerms(since)
      ]);

      return {
        totalArticles,
        totalViews: totalViews._sum.viewCount || 0,
        topArticles,
        categoryStats,
        searchTerms
      };
    } catch (error) {
      console.error('Error generating KB analytics:', error);
      throw new Error('Failed to generate analytics');
    }
  }

  // Private helper methods

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async indexArticle(article: any) {
    if (!this.searchIndex) return;

    try {
      await this.searchIndex.saveObject({
        objectID: article.id,
        title: article.title,
        excerpt: article.excerpt,
        content: article.content,
        category: article.category,
        subcategory: article.subcategory,
        tags: article.tags,
        slug: article.slug,
        publishedAt: article.publishedAt?.getTime()
      });
    } catch (error) {
      console.error('Error indexing article:', error);
    }
  }

  private async searchWithAlgolia(params: any) {
    try {
      const searchParams: any = {
        query: params.query,
        hitsPerPage: params.limit,
        page: params.page - 1
      };

      if (params.category) {
        searchParams.filters = `category:${params.category}`;
      }

      const results = await this.searchIndex.search(searchParams);

      return {
        articles: results.hits,
        pagination: {
          page: params.page,
          limit: params.limit,
          total: results.nbHits,
          pages: results.nbPages
        }
      };
    } catch (error) {
      console.error('Algolia search error:', error);
      throw error;
    }
  }

  private async recalculateArticleHelpfulness(articleId: string) {
    try {
      const ratings = await prisma.articleRating.findMany({
        where: { articleId },
        select: { rating: true }
      });

      const helpfulCount = ratings.filter(r => r.rating >= 4).length;
      const notHelpfulCount = ratings.filter(r => r.rating <= 2).length;

      await prisma.knowledgeBaseArticle.update({
        where: { id: articleId },
        data: { helpfulCount, notHelpfulCount }
      });
    } catch (error) {
      console.error('Error recalculating helpfulness:', error);
    }
  }

  private async getPopularSearchTerms(since: Date) {
    // This would typically be tracked in a separate search analytics system
    // For now, return mock data
    return [
      { term: 'api integration', count: 45 },
      { term: 'authentication setup', count: 32 },
      { term: 'plugin development', count: 28 },
      { term: 'deployment guide', count: 24 },
      { term: 'troubleshooting', count: 19 }
    ];
  }
}

export const knowledgeBaseService = new KnowledgeBaseService();