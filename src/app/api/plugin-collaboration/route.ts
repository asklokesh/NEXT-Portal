import { NextRequest, NextResponse } from 'next/server';

// Types for collaboration features
interface PluginReview {
  id: string;
  pluginId: string;
  userId: string;
  username: string;
  rating: number;
  title: string;
  content: string;
  pros: string[];
  cons: string[];
  useCase: string;
  helpful: number;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  version: string;
}

interface PluginQuestion {
  id: string;
  pluginId: string;
  userId: string;
  username: string;
  title: string;
  content: string;
  tags: string[];
  category: 'installation' | 'configuration' | 'usage' | 'troubleshooting' | 'integration';
  votes: number;
  answered: boolean;
  answers: PluginAnswer[];
  createdAt: string;
  updatedAt: string;
}

interface PluginAnswer {
  id: string;
  questionId: string;
  userId: string;
  username: string;
  content: string;
  votes: number;
  accepted: boolean;
  verified: boolean;
  createdAt: string;
  codeSnippets: CodeSnippet[];
}

interface CodeSnippet {
  id: string;
  language: string;
  code: string;
  description: string;
}

interface PluginShowcase {
  id: string;
  pluginId: string;
  userId: string;
  username: string;
  title: string;
  description: string;
  implementation: string;
  screenshots: string[];
  demoUrl?: string;
  repositoryUrl?: string;
  configuration: any;
  votes: number;
  featured: boolean;
  createdAt: string;
  tags: string[];
}

interface PluginIssue {
  id: string;
  pluginId: string;
  userId: string;
  username: string;
  title: string;
  description: string;
  type: 'bug' | 'enhancement' | 'question' | 'documentation';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in-progress' | 'closed' | 'resolved';
  assignedTo?: string;
  labels: string[];
  comments: IssueComment[];
  votes: number;
  createdAt: string;
  updatedAt: string;
}

interface IssueComment {
  id: string;
  issueId: string;
  userId: string;
  username: string;
  content: string;
  createdAt: string;
}

// Mock data storage (in production, use database)
class CollaborationDataStore {
  private static instance: CollaborationDataStore;
  private reviews: Map<string, PluginReview[]> = new Map();
  private questions: Map<string, PluginQuestion[]> = new Map();
  private showcases: Map<string, PluginShowcase[]> = new Map();
  private issues: Map<string, PluginIssue[]> = new Map();

  static getInstance(): CollaborationDataStore {
    if (!CollaborationDataStore.instance) {
      CollaborationDataStore.instance = new CollaborationDataStore();
      CollaborationDataStore.instance.initializeMockData();
    }
    return CollaborationDataStore.instance;
  }

  private initializeMockData() {
    // Initialize with sample data
    const sampleReviews: PluginReview[] = [
      {
        id: 'review1',
        pluginId: '@backstage/plugin-kubernetes',
        userId: 'user1',
        username: 'devops-expert',
        rating: 5,
        title: 'Excellent Kubernetes integration',
        content: 'This plugin provides seamless integration with Kubernetes clusters. The dashboard is intuitive and provides all the information needed for monitoring workloads.',
        pros: ['Easy setup', 'Great UI', 'Real-time updates', 'Multi-cluster support'],
        cons: ['Could use better error handling', 'Memory intensive'],
        useCase: 'Production monitoring for microservices',
        helpful: 15,
        verified: true,
        createdAt: '2024-08-01T10:00:00Z',
        updatedAt: '2024-08-01T10:00:00Z',
        tags: ['kubernetes', 'monitoring', 'production'],
        version: '0.18.0'
      },
      {
        id: 'review2',
        pluginId: '@backstage/plugin-github-actions',
        userId: 'user2',
        username: 'ci-cd-guru',
        rating: 4,
        title: 'Good CI/CD visibility',
        content: 'Provides good overview of GitHub Actions workflows. The integration is smooth and the UI is clean.',
        pros: ['Clean interface', 'Real-time status', 'Good filtering'],
        cons: ['Limited customization', 'No workflow triggering'],
        useCase: 'CI/CD pipeline monitoring',
        helpful: 8,
        verified: false,
        createdAt: '2024-08-02T14:30:00Z',
        updatedAt: '2024-08-02T14:30:00Z',
        tags: ['github', 'ci-cd', 'workflows'],
        version: '0.8.0'
      }
    ];

    const sampleQuestions: PluginQuestion[] = [
      {
        id: 'q1',
        pluginId: '@backstage/plugin-kubernetes',
        userId: 'user3',
        username: 'k8s-newbie',
        title: 'How to configure multiple Kubernetes clusters?',
        content: 'I\'m trying to set up the Kubernetes plugin to work with multiple clusters. What\'s the best approach for configuration?',
        tags: ['configuration', 'multi-cluster'],
        category: 'configuration',
        votes: 5,
        answered: true,
        answers: [
          {
            id: 'a1',
            questionId: 'q1',
            userId: 'user4',
            username: 'k8s-expert',
            content: 'You can configure multiple clusters by adding them to your app-config.yaml. Here\'s an example configuration:',
            votes: 8,
            accepted: true,
            verified: true,
            createdAt: '2024-08-03T09:00:00Z',
            codeSnippets: [
              {
                id: 'code1',
                language: 'yaml',
                code: `kubernetes:
  serviceLocatorMethod:
    type: 'multiTenant'
  clusterLocatorMethods:
    - type: 'config'
      clusters:
        - url: https://cluster1.example.com
          name: production
          authProvider: 'serviceAccount'
        - url: https://cluster2.example.com
          name: staging
          authProvider: 'serviceAccount'`,
                description: 'Multi-cluster configuration'
              }
            ]
          }
        ],
        createdAt: '2024-08-03T08:00:00Z',
        updatedAt: '2024-08-03T09:00:00Z'
      }
    ];

    const sampleShowcases: PluginShowcase[] = [
      {
        id: 'showcase1',
        pluginId: '@backstage/plugin-kubernetes',
        userId: 'user5',
        username: 'platform-engineer',
        title: 'Production Kubernetes Dashboard',
        description: 'Complete setup for monitoring production Kubernetes workloads with custom dashboards and alerting.',
        implementation: 'Implemented with custom resource definitions and automated scaling based on metrics.',
        screenshots: ['/screenshots/k8s-dashboard1.png', '/screenshots/k8s-dashboard2.png'],
        demoUrl: 'https://demo.company.com/k8s',
        repositoryUrl: 'https://github.com/company/k8s-config',
        configuration: {
          clusters: ['production', 'staging'],
          resources: ['pods', 'services', 'deployments', 'ingress'],
          customDashboards: true
        },
        votes: 25,
        featured: true,
        createdAt: '2024-07-28T12:00:00Z',
        tags: ['kubernetes', 'production', 'monitoring', 'custom-dashboard']
      }
    ];

    const sampleIssues: PluginIssue[] = [
      {
        id: 'issue1',
        pluginId: '@backstage/plugin-jenkins',
        userId: 'user6',
        username: 'jenkins-user',
        title: 'Jenkins plugin fails to load build history',
        description: 'The plugin shows an error when trying to load build history for jobs with special characters in the name.',
        type: 'bug',
        priority: 'medium',
        status: 'open',
        labels: ['bug', 'jenkins', 'build-history'],
        comments: [
          {
            id: 'comment1',
            issueId: 'issue1',
            userId: 'user7',
            username: 'backstage-maintainer',
            content: 'Thanks for reporting this. Can you provide the exact job names that are causing issues?',
            createdAt: '2024-08-04T10:00:00Z'
          }
        ],
        votes: 3,
        createdAt: '2024-08-04T09:00:00Z',
        updatedAt: '2024-08-04T10:00:00Z'
      }
    ];

    // Store sample data
    this.reviews.set('@backstage/plugin-kubernetes', [sampleReviews[0]]);
    this.reviews.set('@backstage/plugin-github-actions', [sampleReviews[1]]);
    this.questions.set('@backstage/plugin-kubernetes', [sampleQuestions[0]]);
    this.showcases.set('@backstage/plugin-kubernetes', [sampleShowcases[0]]);
    this.issues.set('@backstage/plugin-jenkins', [sampleIssues[0]]);
  }

  getReviews(pluginId: string): PluginReview[] {
    return this.reviews.get(pluginId) || [];
  }

  addReview(review: PluginReview): void {
    const existing = this.reviews.get(review.pluginId) || [];
    existing.push(review);
    this.reviews.set(review.pluginId, existing);
  }

  getQuestions(pluginId: string): PluginQuestion[] {
    return this.questions.get(pluginId) || [];
  }

  addQuestion(question: PluginQuestion): void {
    const existing = this.questions.get(question.pluginId) || [];
    existing.push(question);
    this.questions.set(question.pluginId, existing);
  }

  getShowcases(pluginId: string): PluginShowcase[] {
    return this.showcases.get(pluginId) || [];
  }

  addShowcase(showcase: PluginShowcase): void {
    const existing = this.showcases.get(showcase.pluginId) || [];
    existing.push(showcase);
    this.showcases.set(showcase.pluginId, existing);
  }

  getIssues(pluginId: string): PluginIssue[] {
    return this.issues.get(pluginId) || [];
  }

  addIssue(issue: PluginIssue): void {
    const existing = this.issues.get(issue.pluginId) || [];
    existing.push(issue);
    this.issues.set(issue.pluginId, existing);
  }

  getAllReviews(): PluginReview[] {
    const all: PluginReview[] = [];
    this.reviews.forEach(reviews => all.push(...reviews));
    return all;
  }

  getAllQuestions(): PluginQuestion[] {
    const all: PluginQuestion[] = [];
    this.questions.forEach(questions => all.push(...questions));
    return all;
  }

  getAllShowcases(): PluginShowcase[] {
    const all: PluginShowcase[] = [];
    this.showcases.forEach(showcases => all.push(...showcases));
    return all;
  }
}

// Analytics and insights service
class CollaborationAnalytics {
  static calculatePluginScore(pluginId: string, dataStore: CollaborationDataStore): {
    overall: number;
    breakdown: {
      rating: number;
      community: number;
      activity: number;
      support: number;
    };
  } {
    const reviews = dataStore.getReviews(pluginId);
    const questions = dataStore.getQuestions(pluginId);
    const showcases = dataStore.getShowcases(pluginId);
    const issues = dataStore.getIssues(pluginId);

    // Calculate rating score (40% weight)
    const avgRating = reviews.length > 0 
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
      : 0;
    const ratingScore = (avgRating / 5) * 100;

    // Calculate community engagement (30% weight)
    const totalVotes = [...questions, ...showcases].reduce((sum, item) => sum + item.votes, 0);
    const communityScore = Math.min((totalVotes / 50) * 100, 100);

    // Calculate activity score (20% weight)
    const recentActivity = [...reviews, ...questions, ...showcases]
      .filter(item => {
        const date = new Date(item.createdAt);
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return date > monthAgo;
      }).length;
    const activityScore = Math.min((recentActivity / 10) * 100, 100);

    // Calculate support quality (10% weight)
    const answeredQuestions = questions.filter(q => q.answered).length;
    const supportScore = questions.length > 0 
      ? (answeredQuestions / questions.length) * 100 
      : 80; // Default score if no questions

    const overall = (
      ratingScore * 0.4 +
      communityScore * 0.3 +
      activityScore * 0.2 +
      supportScore * 0.1
    );

    return {
      overall: Math.round(overall),
      breakdown: {
        rating: Math.round(ratingScore),
        community: Math.round(communityScore),
        activity: Math.round(activityScore),
        support: Math.round(supportScore)
      }
    };
  }

  static getTrendingPlugins(dataStore: CollaborationDataStore, limit: number = 5): Array<{
    pluginId: string;
    score: number;
    trend: 'up' | 'down' | 'stable';
    activity: number;
  }> {
    const allReviews = dataStore.getAllReviews();
    const allQuestions = dataStore.getAllQuestions();
    const allShowcases = dataStore.getAllShowcases();

    const pluginActivity = new Map<string, number>();

    [...allReviews, ...allQuestions, ...allShowcases].forEach(item => {
      const current = pluginActivity.get(item.pluginId) || 0;
      pluginActivity.set(item.pluginId, current + 1);
    });

    return Array.from(pluginActivity.entries())
      .map(([pluginId, activity]) => ({
        pluginId,
        score: this.calculatePluginScore(pluginId, dataStore).overall,
        trend: 'up' as const, // Simplified trend calculation
        activity
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = new URL(req.url).searchParams;
    const pluginId = searchParams.get('pluginId');
    const type = searchParams.get('type') || 'all';
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    const sort = searchParams.get('sort') || 'recent';

    const dataStore = CollaborationDataStore.getInstance();

    // Handle different request types
    switch (type) {
      case 'reviews':
        if (!pluginId) {
          const allReviews = dataStore.getAllReviews()
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(offset, offset + limit);
          
          return NextResponse.json({
            reviews: allReviews,
            total: dataStore.getAllReviews().length,
            hasMore: offset + limit < dataStore.getAllReviews().length
          });
        }

        const reviews = dataStore.getReviews(pluginId);
        const sortedReviews = this.sortItems(reviews, sort);
        
        // Calculate review statistics
        const avgRating = reviews.length > 0 
          ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
          : 0;
        
        const ratingDistribution = [1, 2, 3, 4, 5].map(rating => ({
          rating,
          count: reviews.filter(r => r.rating === rating).length,
          percentage: reviews.length > 0 ? (reviews.filter(r => r.rating === rating).length / reviews.length) * 100 : 0
        }));

        return NextResponse.json({
          reviews: sortedReviews.slice(offset, offset + limit),
          total: reviews.length,
          statistics: {
            averageRating: Math.round(avgRating * 10) / 10,
            totalReviews: reviews.length,
            verifiedReviews: reviews.filter(r => r.verified).length,
            ratingDistribution
          },
          hasMore: offset + limit < reviews.length
        });

      case 'questions':
        if (!pluginId) {
          const allQuestions = dataStore.getAllQuestions()
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(offset, offset + limit);
          
          return NextResponse.json({
            questions: allQuestions,
            total: dataStore.getAllQuestions().length,
            hasMore: offset + limit < dataStore.getAllQuestions().length
          });
        }

        const questions = dataStore.getQuestions(pluginId);
        const sortedQuestions = this.sortItems(questions, sort);

        return NextResponse.json({
          questions: sortedQuestions.slice(offset, offset + limit),
          total: questions.length,
          statistics: {
            totalQuestions: questions.length,
            answeredQuestions: questions.filter(q => q.answered).length,
            averageVotes: questions.length > 0 ? questions.reduce((sum, q) => sum + q.votes, 0) / questions.length : 0
          },
          hasMore: offset + limit < questions.length
        });

      case 'showcases':
        if (!pluginId) {
          const allShowcases = dataStore.getAllShowcases()
            .sort((a, b) => b.votes - a.votes)
            .slice(offset, offset + limit);
          
          return NextResponse.json({
            showcases: allShowcases,
            total: dataStore.getAllShowcases().length,
            featured: allShowcases.filter(s => s.featured),
            hasMore: offset + limit < dataStore.getAllShowcases().length
          });
        }

        const showcases = dataStore.getShowcases(pluginId);
        const sortedShowcases = this.sortItems(showcases, sort);

        return NextResponse.json({
          showcases: sortedShowcases.slice(offset, offset + limit),
          total: showcases.length,
          featured: showcases.filter(s => s.featured),
          hasMore: offset + limit < showcases.length
        });

      case 'issues':
        if (!pluginId) {
          return NextResponse.json({ error: 'Plugin ID required for issues' }, { status: 400 });
        }

        const issues = dataStore.getIssues(pluginId);
        const sortedIssues = this.sortItems(issues, sort);

        return NextResponse.json({
          issues: sortedIssues.slice(offset, offset + limit),
          total: issues.length,
          statistics: {
            open: issues.filter(i => i.status === 'open').length,
            closed: issues.filter(i => i.status === 'closed').length,
            inProgress: issues.filter(i => i.status === 'in-progress').length
          },
          hasMore: offset + limit < issues.length
        });

      case 'analytics':
        if (!pluginId) {
          const trending = CollaborationAnalytics.getTrendingPlugins(dataStore, 10);
          return NextResponse.json({
            trending,
            totalCommunityActivity: {
              reviews: dataStore.getAllReviews().length,
              questions: dataStore.getAllQuestions().length,
              showcases: dataStore.getAllShowcases().length
            }
          });
        }

        const score = CollaborationAnalytics.calculatePluginScore(pluginId, dataStore);
        
        return NextResponse.json({
          pluginId,
          score,
          communityMetrics: {
            reviews: dataStore.getReviews(pluginId).length,
            questions: dataStore.getQuestions(pluginId).length,
            showcases: dataStore.getShowcases(pluginId).length,
            issues: dataStore.getIssues(pluginId).length
          }
        });

      case 'all':
      default:
        if (!pluginId) {
          return NextResponse.json({ error: 'Plugin ID required' }, { status: 400 });
        }

        return NextResponse.json({
          pluginId,
          reviews: dataStore.getReviews(pluginId).slice(0, 3),
          questions: dataStore.getQuestions(pluginId).slice(0, 3),
          showcases: dataStore.getShowcases(pluginId).slice(0, 2),
          issues: dataStore.getIssues(pluginId).slice(0, 3),
          analytics: CollaborationAnalytics.calculatePluginScore(pluginId, dataStore)
        });
    }
  } catch (error) {
    console.error('Collaboration API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch collaboration data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function sortItems(items: any[], sort: string): any[] {
  switch (sort) {
    case 'recent':
      return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    case 'popular':
      return [...items].sort((a, b) => (b.votes || b.helpful || 0) - (a.votes || a.helpful || 0));
    case 'rating':
      return [...items].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    default:
      return items;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, type, pluginId, userId, data } = body;

    const dataStore = CollaborationDataStore.getInstance();

    switch (action) {
      case 'create':
        const id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const timestamp = new Date().toISOString();

        switch (type) {
          case 'review':
            const review: PluginReview = {
              id,
              pluginId,
              userId,
              username: data.username || 'anonymous',
              rating: data.rating,
              title: data.title,
              content: data.content,
              pros: data.pros || [],
              cons: data.cons || [],
              useCase: data.useCase || '',
              helpful: 0,
              verified: false,
              createdAt: timestamp,
              updatedAt: timestamp,
              tags: data.tags || [],
              version: data.version || 'latest'
            };
            dataStore.addReview(review);
            
            return NextResponse.json({
              success: true,
              review,
              message: 'Review created successfully'
            });

          case 'question':
            const question: PluginQuestion = {
              id,
              pluginId,
              userId,
              username: data.username || 'anonymous',
              title: data.title,
              content: data.content,
              tags: data.tags || [],
              category: data.category || 'usage',
              votes: 0,
              answered: false,
              answers: [],
              createdAt: timestamp,
              updatedAt: timestamp
            };
            dataStore.addQuestion(question);
            
            return NextResponse.json({
              success: true,
              question,
              message: 'Question created successfully'
            });

          case 'showcase':
            const showcase: PluginShowcase = {
              id,
              pluginId,
              userId,
              username: data.username || 'anonymous',
              title: data.title,
              description: data.description,
              implementation: data.implementation || '',
              screenshots: data.screenshots || [],
              demoUrl: data.demoUrl,
              repositoryUrl: data.repositoryUrl,
              configuration: data.configuration || {},
              votes: 0,
              featured: false,
              createdAt: timestamp,
              tags: data.tags || []
            };
            dataStore.addShowcase(showcase);
            
            return NextResponse.json({
              success: true,
              showcase,
              message: 'Showcase created successfully'
            });

          case 'issue':
            const issue: PluginIssue = {
              id,
              pluginId,
              userId,
              username: data.username || 'anonymous',
              title: data.title,
              description: data.description,
              type: data.type || 'bug',
              priority: data.priority || 'medium',
              status: 'open',
              labels: data.labels || [],
              comments: [],
              votes: 0,
              createdAt: timestamp,
              updatedAt: timestamp
            };
            dataStore.addIssue(issue);
            
            return NextResponse.json({
              success: true,
              issue,
              message: 'Issue created successfully'
            });

          default:
            return NextResponse.json(
              { error: 'Invalid type for creation' },
              { status: 400 }
            );
        }

      case 'vote':
        // Implement voting logic
        return NextResponse.json({
          success: true,
          message: `Vote recorded for ${type} ${data.itemId}`,
          newVoteCount: (data.currentVotes || 0) + (data.vote === 'up' ? 1 : -1)
        });

      case 'answer':
        // Add answer to question
        const answerId = `answer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const answer: PluginAnswer = {
          id: answerId,
          questionId: data.questionId,
          userId,
          username: data.username || 'anonymous',
          content: data.content,
          votes: 0,
          accepted: false,
          verified: false,
          createdAt: new Date().toISOString(),
          codeSnippets: data.codeSnippets || []
        };

        // In production, update the question in database
        return NextResponse.json({
          success: true,
          answer,
          message: 'Answer added successfully'
        });

      case 'moderate':
        // Content moderation actions
        return NextResponse.json({
          success: true,
          message: `${data.action} applied to ${type} ${data.itemId}`,
          action: data.action
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Collaboration operation failed:', error);
    return NextResponse.json(
      { error: 'Operation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}