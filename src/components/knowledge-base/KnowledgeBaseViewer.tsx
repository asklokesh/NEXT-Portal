/**
 * Knowledge Base Viewer Component
 * 
 * Comprehensive knowledge base with:
 * - Searchable documentation site
 * - Article viewer with ratings
 * - Categories and navigation
 * - Related articles
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Search,
  BookOpen,
  Star,
  ThumbsUp,
  ThumbsDown,
  Eye,
  Calendar,
  Tag,
  MessageCircle,
  ArrowRight,
  Filter,
  TrendingUp,
  Clock,
  User
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface KBArticle {
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
  publishedAt?: string;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  createdAt: string;
  updatedAt: string;
}

interface KBCategory {
  name: string;
  count: number;
  subcategories: Array<{
    name: string;
    count: number;
  }>;
}

export const KnowledgeBaseViewer: React.FC = () => {
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [categories, setCategories] = useState<KBCategory[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<KBArticle | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<KBArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState('relevance');
  const [userRating, setUserRating] = useState<number>(0);
  const [ratingFeedback, setRatingFeedback] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const { toast } = useToast();

  const loadArticles = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (searchQuery) params.append('query', searchQuery);
      if (selectedCategory) params.append('category', selectedCategory);
      if (sortBy !== 'relevance') params.append('sortBy', sortBy);
      
      const response = await fetch(`/api/knowledge-base?${params}`);
      const result = await response.json();

      if (result.success) {
        setArticles(result.data.articles || []);
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        title: 'Loading Failed',
        description: error.message || 'Failed to load articles.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/knowledge-base/categories');
      const result = await response.json();

      if (result.success) {
        setCategories(result.data);
      }
    } catch (error: any) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadArticle = async (slug: string) => {
    try {
      const response = await fetch(`/api/knowledge-base/${slug}`);
      const result = await response.json();

      if (result.success) {
        setSelectedArticle(result.data);
        // Load related articles
        loadRelatedArticles(result.data.category, result.data.id);
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        title: 'Article Not Found',
        description: error.message || 'Failed to load article.',
        variant: 'destructive'
      });
    }
  };

  const loadRelatedArticles = async (category: string, excludeId: string) => {
    try {
      const response = await fetch(`/api/knowledge-base?category=${category}&limit=5`);
      const result = await response.json();

      if (result.success) {
        setRelatedArticles(
          result.data.articles.filter((article: KBArticle) => article.id !== excludeId)
        );
      }
    } catch (error: any) {
      console.error('Failed to load related articles:', error);
    }
  };

  const submitRating = async () => {
    if (!selectedArticle || userRating === 0) return;

    try {
      setIsSubmittingRating(true);

      const response = await fetch(`/api/knowledge-base/${selectedArticle.slug}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'current-user-id' // This would come from auth context
        },
        body: JSON.stringify({
          rating: userRating,
          feedback: ratingFeedback.trim() || undefined
        })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Rating Submitted',
          description: 'Thank you for your feedback!',
        });
        
        setUserRating(0);
        setRatingFeedback('');
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        title: 'Rating Failed',
        description: error.message || 'Failed to submit rating.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmittingRating(false);
    }
  };

  useEffect(() => {
    loadArticles();
    loadCategories();
  }, [searchQuery, selectedCategory, sortBy]);

  const ArticleCard: React.FC<{ article: KBArticle }> = ({ article }) => (
    <Card 
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => loadArticle(article.slug)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary">
                {article.category}
              </Badge>
              {article.subcategory && (
                <Badge variant="outline">
                  {article.subcategory}
                </Badge>
              )}
            </div>
            <CardTitle className="text-lg leading-tight">
              {article.title}
            </CardTitle>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              {article.viewCount}
            </div>
            <div className="flex items-center gap-1">
              <ThumbsUp className="h-4 w-4" />
              {article.helpfulCount}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {article.excerpt && (
          <p className="text-gray-600 text-sm mb-3 line-clamp-2">
            {article.excerpt}
          </p>
        )}

        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {article.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                <Tag className="h-2 w-2 mr-1" />
                {tag}
              </Badge>
            ))}
            {article.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{article.tags.length - 3} more
              </Badge>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {article.author}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(article.publishedAt || article.createdAt).toLocaleDateString()}
            </span>
          </div>
          <span>v{article.version}</span>
        </div>
      </CardContent>
    </Card>
  );

  const StarRating: React.FC<{ rating: number; onChange: (rating: number) => void; readonly?: boolean }> = ({
    rating,
    onChange,
    readonly = false
  }) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-5 w-5 ${
              star <= rating 
                ? 'text-yellow-400 fill-current' 
                : 'text-gray-300'
            } ${readonly ? '' : 'cursor-pointer hover:text-yellow-300'}`}
            onClick={readonly ? undefined : () => onChange(star)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold mb-2">Knowledge Base</h1>
        <p className="text-gray-600">
          Find answers, guides, and documentation to help you get the most out of our platform.
        </p>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search knowledge base..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.name} value={category.name}>
                      {category.name} ({category.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={sortBy}
                onValueChange={setSortBy}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">Relevance</SelectItem>
                  <SelectItem value="views">Most Viewed</SelectItem>
                  <SelectItem value="date">Recently Updated</SelectItem>
                  <SelectItem value="helpful">Most Helpful</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar - Categories */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Categories
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <Button
                  variant={selectedCategory === '' ? 'default' : 'ghost'}
                  className="w-full justify-start"
                  onClick={() => setSelectedCategory('')}
                >
                  All Articles
                </Button>
                {categories.map((category) => (
                  <div key={category.name}>
                    <Button
                      variant={selectedCategory === category.name ? 'default' : 'ghost'}
                      className="w-full justify-between"
                      onClick={() => setSelectedCategory(category.name)}
                    >
                      <span>{category.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {category.count}
                      </Badge>
                    </Button>
                    {selectedCategory === category.name && category.subcategories.length > 0 && (
                      <div className="ml-4 mt-1 space-y-1">
                        {category.subcategories.map((sub) => (
                          <Button
                            key={sub.name}
                            variant="ghost"
                            size="sm"
                            className="w-full justify-between text-xs"
                            onClick={() => setSelectedCategory(sub.name)}
                          >
                            <span>{sub.name}</span>
                            <span className="text-gray-500">{sub.count}</span>
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Articles Grid */}
        <div className="lg:col-span-3">
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All Articles</TabsTrigger>
              <TabsTrigger value="popular">Popular</TabsTrigger>
              <TabsTrigger value="recent">Recent</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              {loading ? (
                <div className="grid gap-4">
                  {[...Array(6)].map((_, i) => (
                    <Card key={i} className="animate-pulse">
                      <CardHeader>
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      </CardHeader>
                      <CardContent>
                        <div className="h-3 bg-gray-200 rounded mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : articles.length > 0 ? (
                <div className="grid gap-4">
                  {articles.map(article => (
                    <ArticleCard key={article.id} article={article} />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="text-center py-12">
                    <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No articles found</h3>
                    <p className="text-gray-600">
                      Try adjusting your search terms or filters.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="popular">
              <div className="grid gap-4">
                {articles
                  .filter(article => article.viewCount > 100 || article.helpfulCount > 5)
                  .slice(0, 10)
                  .map(article => (
                    <ArticleCard key={article.id} article={article} />
                  ))}
              </div>
            </TabsContent>

            <TabsContent value="recent">
              <div className="grid gap-4">
                {articles
                  .sort((a, b) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime())
                  .slice(0, 10)
                  .map(article => (
                    <ArticleCard key={article.id} article={article} />
                  ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Article Detail Modal */}
      <Dialog open={!!selectedArticle} onOpenChange={(open) => !open && setSelectedArticle(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedArticle && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary">
                        {selectedArticle.category}
                      </Badge>
                      {selectedArticle.subcategory && (
                        <Badge variant="outline">
                          {selectedArticle.subcategory}
                        </Badge>
                      )}
                    </div>
                    <DialogTitle className="text-xl">
                      {selectedArticle.title}
                    </DialogTitle>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
                      <span className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {selectedArticle.author}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(selectedArticle.publishedAt || selectedArticle.createdAt).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-4 w-4" />
                        {selectedArticle.viewCount} views
                      </span>
                      <span>v{selectedArticle.version}</span>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-6">
                {/* Content */}
                <div>
                  <div 
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ 
                      __html: selectedArticle.content.replace(/\n/g, '<br />') 
                    }}
                  />
                </div>

                {/* Tags */}
                {selectedArticle.tags.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Tags</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedArticle.tags.map((tag) => (
                        <Badge key={tag} variant="outline">
                          <Tag className="h-3 w-3 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Rating Section */}
                <div>
                  <h4 className="font-medium mb-4">Was this article helpful?</h4>
                  
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Rate this article:</span>
                      <StarRating rating={userRating} onChange={setUserRating} />
                    </div>
                    <div className="text-sm text-gray-500">
                      {selectedArticle.helpfulCount} people found this helpful
                    </div>
                  </div>

                  {userRating > 0 && (
                    <div className="space-y-3">
                      <Textarea
                        value={ratingFeedback}
                        onChange={(e) => setRatingFeedback(e.target.value)}
                        placeholder="Optional: Tell us more about your experience..."
                        rows={3}
                      />
                      <Button
                        onClick={submitRating}
                        disabled={isSubmittingRating}
                        size="sm"
                      >
                        {isSubmittingRating ? 'Submitting...' : 'Submit Rating'}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Related Articles */}
                {relatedArticles.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium mb-4">Related Articles</h4>
                      <div className="grid gap-3">
                        {relatedArticles.map((article) => (
                          <Card 
                            key={article.id} 
                            className="cursor-pointer hover:shadow-sm transition-shadow"
                            onClick={() => loadArticle(article.slug)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <h5 className="font-medium mb-1">{article.title}</h5>
                                  {article.excerpt && (
                                    <p className="text-sm text-gray-600 line-clamp-1">
                                      {article.excerpt}
                                    </p>
                                  )}
                                </div>
                                <ArrowRight className="h-4 w-4 text-gray-400 ml-4" />
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};