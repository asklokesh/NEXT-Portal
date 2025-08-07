import { EventEmitter } from 'events';
import { Logger } from 'pino';
import { z } from 'zod';

const ArticleSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  author: z.string(),
  createdAt: z.date(),
});

export type Article = z.infer<typeof ArticleSchema>;

export class KnowledgeHubService extends EventEmitter {
  private articles: Map<string, Article> = new Map();

  constructor(private logger: Logger) {
    super();
  }

  async createArticle(articleData: Omit<Article, 'id' | 'createdAt'>): Promise<Article> {
    const article = ArticleSchema.parse({
      id: crypto.randomUUID(),
      ...articleData,
      createdAt: new Date(),
    });
    this.articles.set(article.id, article);
    this.logger.info(`Article created: ${article.id}`);
    this.emit('articleCreated', article);
    return article;
  }

  async getArticle(id: string): Promise<Article | undefined> {
    return this.articles.get(id);
  }

  async searchArticles(query: string): Promise<Article[]> {
    const lowerCaseQuery = query.toLowerCase();
    return Array.from(this.articles.values()).filter(
      (article) =>
        article.title.toLowerCase().includes(lowerCaseQuery) ||
        article.content.toLowerCase().includes(lowerCaseQuery)
    );
  }
}
