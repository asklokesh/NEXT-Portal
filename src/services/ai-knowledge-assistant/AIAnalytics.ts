/**
 * AI Analytics Service
 * Tracks usage, feedback, and knowledge gaps for the AI assistant
 */

import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import {
  AIUsageMetrics,
  AIFeedback,
  AIKnowledgeGap,
} from './types';

interface QueryLog {
  userId: string;
  conversationId: string;
  query: string;
  responseTime: number;
  sourcesUsed: number;
  toolsUsed: string[];
  timestamp: Date;
}

interface AggregatedMetrics {
  totalQueries: number;
  avgResponseTime: number;
  toolUsage: Record<string, number>;
  topTopics: Array<{ topic: string; count: number }>;
  satisfactionScore: number;
  sourcesUsed: Record<string, number>;
}

export class AIAnalytics {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Log a query
   */
  async logQuery(log: QueryLog): Promise<void> {
    const key = `ai:analytics:queries:${log.userId}`;
    const dayKey = `ai:analytics:queries:day:${this.getDayKey()}`;

    const data = {
      ...log,
      timestamp: log.timestamp || new Date(),
    };

    // Store per-user queries (limited to last 1000)
    await this.redis.lpush(key, JSON.stringify(data));
    await this.redis.ltrim(key, 0, 999);

    // Store daily aggregates
    await this.redis.hincrby(dayKey, 'total_queries', 1);
    await this.redis.hincrbyfloat(dayKey, 'total_response_time', log.responseTime);
    await this.redis.expire(dayKey, 60 * 60 * 24 * 90); // 90 days

    // Track tool usage
    for (const tool of log.toolsUsed) {
      await this.redis.hincrby(`ai:analytics:tools:${this.getDayKey()}`, tool, 1);
    }

    // Extract and track topics
    const topics = this.extractTopics(log.query);
    for (const topic of topics) {
      await this.redis.zincrby('ai:analytics:topics', 1, topic);
    }
  }

  /**
   * Log feedback
   */
  async logFeedback(feedback: AIFeedback): Promise<void> {
    const key = 'ai:analytics:feedback';
    const dayKey = `ai:analytics:feedback:day:${this.getDayKey()}`;

    // Store feedback
    await this.redis.lpush(key, JSON.stringify(feedback));
    await this.redis.ltrim(key, 0, 9999);

    // Update daily aggregates
    await this.redis.hincrby(dayKey, 'total', 1);
    await this.redis.hincrby(dayKey, feedback.rating, 1);

    if (feedback.category) {
      await this.redis.hincrby(`${dayKey}:categories`, feedback.category, 1);
    }

    await this.redis.expire(dayKey, 60 * 60 * 24 * 90);
  }

  /**
   * Record a knowledge gap
   */
  async recordKnowledgeGap(query: string, feedback: AIFeedback): Promise<void> {
    const normalizedQuery = this.normalizeQuery(query);
    const key = `ai:analytics:knowledge_gaps:${this.hashString(normalizedQuery)}`;

    const existing = await this.redis.get(key);

    if (existing) {
      const gap: AIKnowledgeGap = JSON.parse(existing);
      gap.frequency++;
      gap.lastOccurrence = new Date();
      await this.redis.set(key, JSON.stringify(gap));
    } else {
      const gap: AIKnowledgeGap = {
        id: uuidv4(),
        query: normalizedQuery,
        frequency: 1,
        firstOccurrence: new Date(),
        lastOccurrence: new Date(),
        suggestedDocOwners: [],
        status: 'open',
      };
      await this.redis.set(key, JSON.stringify(gap));
    }

    // Add to sorted set for priority tracking
    await this.redis.zincrby('ai:analytics:knowledge_gaps:priority', 1, normalizedQuery);
  }

  /**
   * Get usage metrics for a user
   */
  async getUserMetrics(
    userId: string,
    period: 'day' | 'week' | 'month' = 'week'
  ): Promise<AIUsageMetrics> {
    const queries = await this.getUserQueries(userId, period);
    const feedback = await this.getUserFeedback(userId, period);

    const toolUsage: Record<string, number> = {};
    let totalResponseTime = 0;

    for (const query of queries) {
      totalResponseTime += query.responseTime;
      for (const tool of query.toolsUsed) {
        toolUsage[tool] = (toolUsage[tool] || 0) + 1;
      }
    }

    const positiveCount = feedback.filter(f => f.rating === 'positive').length;
    const satisfactionScore = feedback.length > 0
      ? (positiveCount / feedback.length) * 100
      : 0;

    return {
      userId,
      period,
      metrics: {
        totalQueries: queries.length,
        avgResponseTime: queries.length > 0 ? totalResponseTime / queries.length : 0,
        toolUsage,
        topTopics: await this.getTopTopics(10),
        satisfactionScore,
        sourcesUsed: {},
      },
    };
  }

  /**
   * Get global metrics
   */
  async getGlobalMetrics(
    period: 'day' | 'week' | 'month' = 'week'
  ): Promise<AggregatedMetrics> {
    const days = this.getDaysForPeriod(period);
    let totalQueries = 0;
    let totalResponseTime = 0;
    const toolUsage: Record<string, number> = {};

    for (const day of days) {
      const dayKey = `ai:analytics:queries:day:${day}`;
      const data = await this.redis.hgetall(dayKey);

      if (data.total_queries) {
        totalQueries += parseInt(data.total_queries, 10);
      }
      if (data.total_response_time) {
        totalResponseTime += parseFloat(data.total_response_time);
      }

      // Aggregate tool usage
      const toolKey = `ai:analytics:tools:${day}`;
      const tools = await this.redis.hgetall(toolKey);
      for (const [tool, count] of Object.entries(tools)) {
        toolUsage[tool] = (toolUsage[tool] || 0) + parseInt(count, 10);
      }
    }

    // Get satisfaction score
    const satisfactionScore = await this.calculateSatisfactionScore(days);

    return {
      totalQueries,
      avgResponseTime: totalQueries > 0 ? totalResponseTime / totalQueries : 0,
      toolUsage,
      topTopics: await this.getTopTopics(10),
      satisfactionScore,
      sourcesUsed: {},
    };
  }

  /**
   * Get knowledge gaps
   */
  async getKnowledgeGaps(
    options?: {
      status?: 'open' | 'addressed' | 'ignored';
      limit?: number;
      minFrequency?: number;
    }
  ): Promise<AIKnowledgeGap[]> {
    // Get top gaps by frequency
    const gapQueries = await this.redis.zrevrange(
      'ai:analytics:knowledge_gaps:priority',
      0,
      (options?.limit || 50) - 1,
      'WITHSCORES'
    );

    const gaps: AIKnowledgeGap[] = [];

    for (let i = 0; i < gapQueries.length; i += 2) {
      const query = gapQueries[i];
      const key = `ai:analytics:knowledge_gaps:${this.hashString(query)}`;
      const data = await this.redis.get(key);

      if (data) {
        const gap: AIKnowledgeGap = JSON.parse(data);

        if (options?.status && gap.status !== options.status) {
          continue;
        }

        if (options?.minFrequency && gap.frequency < options.minFrequency) {
          continue;
        }

        gaps.push(gap);
      }
    }

    return gaps;
  }

  /**
   * Update knowledge gap status
   */
  async updateKnowledgeGapStatus(
    gapId: string,
    status: AIKnowledgeGap['status']
  ): Promise<boolean> {
    // Find the gap
    const gapQueries = await this.redis.zrange(
      'ai:analytics:knowledge_gaps:priority',
      0,
      -1
    );

    for (const query of gapQueries) {
      const key = `ai:analytics:knowledge_gaps:${this.hashString(query)}`;
      const data = await this.redis.get(key);

      if (data) {
        const gap: AIKnowledgeGap = JSON.parse(data);
        if (gap.id === gapId) {
          gap.status = status;
          await this.redis.set(key, JSON.stringify(gap));
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get feedback summary
   */
  async getFeedbackSummary(
    period: 'day' | 'week' | 'month' = 'week'
  ): Promise<{
    total: number;
    positive: number;
    negative: number;
    byCategory: Record<string, number>;
    recentComments: Array<{ comment: string; rating: string; timestamp: Date }>;
  }> {
    const days = this.getDaysForPeriod(period);
    let total = 0;
    let positive = 0;
    let negative = 0;
    const byCategory: Record<string, number> = {};

    for (const day of days) {
      const dayKey = `ai:analytics:feedback:day:${day}`;
      const data = await this.redis.hgetall(dayKey);

      if (data.total) {
        total += parseInt(data.total, 10);
      }
      if (data.positive) {
        positive += parseInt(data.positive, 10);
      }
      if (data.negative) {
        negative += parseInt(data.negative, 10);
      }

      const categories = await this.redis.hgetall(`${dayKey}:categories`);
      for (const [category, count] of Object.entries(categories)) {
        byCategory[category] = (byCategory[category] || 0) + parseInt(count, 10);
      }
    }

    // Get recent comments
    const feedbackData = await this.redis.lrange('ai:analytics:feedback', 0, 49);
    const recentComments = feedbackData
      .map(d => JSON.parse(d) as AIFeedback)
      .filter(f => f.comment)
      .slice(0, 10)
      .map(f => ({
        comment: f.comment!,
        rating: f.rating,
        timestamp: new Date(f.timestamp),
      }));

    return {
      total,
      positive,
      negative,
      byCategory,
      recentComments,
    };
  }

  /**
   * Export analytics data
   */
  async exportData(
    startDate: Date,
    endDate: Date
  ): Promise<{
    queries: QueryLog[];
    feedback: AIFeedback[];
    knowledgeGaps: AIKnowledgeGap[];
  }> {
    // This would export data for the given date range
    // For now, return empty arrays
    return {
      queries: [],
      feedback: [],
      knowledgeGaps: await this.getKnowledgeGaps(),
    };
  }

  // Private methods

  private getDayKey(date?: Date): string {
    const d = date || new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private getDaysForPeriod(period: 'day' | 'week' | 'month'): string[] {
    const days: string[] = [];
    const today = new Date();
    const numDays = period === 'day' ? 1 : period === 'week' ? 7 : 30;

    for (let i = 0; i < numDays; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      days.push(this.getDayKey(date));
    }

    return days;
  }

  private async getUserQueries(userId: string, period: 'day' | 'week' | 'month'): Promise<QueryLog[]> {
    const key = `ai:analytics:queries:${userId}`;
    const data = await this.redis.lrange(key, 0, -1);

    const queries = data.map(d => JSON.parse(d) as QueryLog);
    const cutoff = this.getCutoffDate(period);

    return queries.filter(q => new Date(q.timestamp) >= cutoff);
  }

  private async getUserFeedback(userId: string, period: 'day' | 'week' | 'month'): Promise<AIFeedback[]> {
    const data = await this.redis.lrange('ai:analytics:feedback', 0, -1);
    const feedback = data.map(d => JSON.parse(d) as AIFeedback);
    const cutoff = this.getCutoffDate(period);

    return feedback.filter(f => f.userId === userId && new Date(f.timestamp) >= cutoff);
  }

  private getCutoffDate(period: 'day' | 'week' | 'month'): Date {
    const date = new Date();
    switch (period) {
      case 'day':
        date.setDate(date.getDate() - 1);
        break;
      case 'week':
        date.setDate(date.getDate() - 7);
        break;
      case 'month':
        date.setMonth(date.getMonth() - 1);
        break;
    }
    return date;
  }

  private async getTopTopics(limit: number): Promise<Array<{ topic: string; count: number }>> {
    const topics = await this.redis.zrevrange('ai:analytics:topics', 0, limit - 1, 'WITHSCORES');
    const result: Array<{ topic: string; count: number }> = [];

    for (let i = 0; i < topics.length; i += 2) {
      result.push({
        topic: topics[i],
        count: parseInt(topics[i + 1], 10),
      });
    }

    return result;
  }

  private async calculateSatisfactionScore(days: string[]): Promise<number> {
    let totalPositive = 0;
    let totalFeedback = 0;

    for (const day of days) {
      const dayKey = `ai:analytics:feedback:day:${day}`;
      const data = await this.redis.hgetall(dayKey);

      if (data.total) {
        totalFeedback += parseInt(data.total, 10);
      }
      if (data.positive) {
        totalPositive += parseInt(data.positive, 10);
      }
    }

    return totalFeedback > 0 ? (totalPositive / totalFeedback) * 100 : 0;
  }

  private extractTopics(query: string): string[] {
    // Simple topic extraction - in production, use NLP
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'what', 'how', 'why', 'when', 'where', 'who', 'which', 'do', 'does', 'can', 'could', 'would', 'should', 'to', 'for', 'of', 'in', 'on', 'at', 'by', 'with', 'about', 'my', 'me', 'i', 'you', 'it', 'this', 'that']);

    const words = query.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));

    // Return unique words as topics
    return [...new Set(words)].slice(0, 5);
  }

  private normalizeQuery(query: string): string {
    return query.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}

export default AIAnalytics;
