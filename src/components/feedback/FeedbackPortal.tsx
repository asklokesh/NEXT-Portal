/**
 * Feedback Portal Component
 * 
 * Feature request portal with voting and roadmap visibility:
 * - List all feedback items with filtering
 * - Voting system for community feedback
 * - Status tracking and roadmap integration
 * - Comment system for discussions
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  Search,
  Filter,
  Calendar,
  TrendingUp,
  CheckCircle,
  Clock,
  AlertTriangle,
  Eye,
  Send,
  Tag
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface FeedbackItem {
  id: string;
  type: string;
  category: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  votes: number;
  userVote?: 'UPVOTE' | 'DOWNVOTE' | null;
  screenshot?: string;
  tags: Array<{ tag: string }>;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  comments: Array<{
    id: string;
    content: string;
    createdAt: string;
    user: {
      name: string;
      avatar?: string;
    };
  }>;
  _count: {
    comments: number;
  };
  createdAt: string;
  updatedAt: string;
  roadmapItem?: string;
  releaseTarget?: string;
}

const statusConfig = {
  'OPEN': { label: 'Open', color: 'bg-blue-100 text-blue-800', icon: Clock },
  'UNDER_REVIEW': { label: 'Under Review', color: 'bg-yellow-100 text-yellow-800', icon: Eye },
  'IN_PROGRESS': { label: 'In Progress', color: 'bg-purple-100 text-purple-800', icon: TrendingUp },
  'PLANNED': { label: 'Planned', color: 'bg-indigo-100 text-indigo-800', icon: Calendar },
  'COMPLETED': { label: 'Completed', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  'REJECTED': { label: 'Rejected', color: 'bg-red-100 text-red-800', icon: AlertTriangle },
  'DUPLICATE': { label: 'Duplicate', color: 'bg-gray-100 text-gray-800', icon: AlertTriangle }
};

const priorityConfig = {
  'LOW': { color: 'bg-gray-100 text-gray-800' },
  'MEDIUM': { color: 'bg-blue-100 text-blue-800' },
  'HIGH': { color: 'bg-orange-100 text-orange-800' },
  'URGENT': { color: 'bg-red-100 text-red-800' },
  'CRITICAL': { color: 'bg-red-200 text-red-900' }
};

const typeIcons = {
  'BUG': '🐛',
  'FEATURE_REQUEST': '💡',
  'IMPROVEMENT': '⚡',
  'QUESTION': '❓',
  'COMPLAINT': '😟'
};

export const FeedbackPortal: React.FC = () => {
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<FeedbackItem | null>(null);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    type: '',
    category: '',
    status: '',
    priority: '',
    sortBy: 'votes',
    sortOrder: 'desc'
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });
  const { toast } = useToast();

  const loadFeedback = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      params.append('page', pagination.page.toString());
      params.append('limit', pagination.limit.toString());

      const response = await fetch(`/api/feedback?${params}`);
      const result = await response.json();

      if (result.success) {
        setFeedbackItems(result.data.items);
        setPagination(result.data.pagination);
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        title: 'Loading Failed',
        description: error.message || 'Failed to load feedback items.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (feedbackId: string, voteType: 'UPVOTE' | 'DOWNVOTE') => {
    try {
      const response = await fetch(`/api/feedback/${feedbackId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'current-user-id' // This would come from auth context
        },
        body: JSON.stringify({ voteType })
      });

      const result = await response.json();

      if (result.success) {
        // Update the feedback item in the list
        setFeedbackItems(prev => prev.map(item => 
          item.id === feedbackId 
            ? { ...item, votes: result.data.votes, userVote: result.data.userVote }
            : item
        ));

        // Update selected item if it's the same
        if (selectedItem && selectedItem.id === feedbackId) {
          setSelectedItem(prev => prev ? {
            ...prev,
            votes: result.data.votes,
            userVote: result.data.userVote
          } : null);
        }
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        title: 'Vote Failed',
        description: error.message || 'Failed to record vote.',
        variant: 'destructive'
      });
    }
  };

  const handleComment = async () => {
    if (!selectedItem || !newComment.trim()) return;

    try {
      setIsSubmittingComment(true);

      const response = await fetch(`/api/feedback/${selectedItem.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'current-user-id' // This would come from auth context
        },
        body: JSON.stringify({ content: newComment.trim() })
      });

      const result = await response.json();

      if (result.success) {
        // Add the new comment to the selected item
        setSelectedItem(prev => prev ? {
          ...prev,
          comments: [...prev.comments, result.data]
        } : null);

        setNewComment('');
        
        toast({
          title: 'Comment Added',
          description: 'Your comment has been added successfully.',
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        title: 'Comment Failed',
        description: error.message || 'Failed to add comment.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  useEffect(() => {
    loadFeedback();
  }, [filters, pagination.page]);

  const FeedbackCard: React.FC<{ item: FeedbackItem }> = ({ item }) => {
    const statusInfo = statusConfig[item.status as keyof typeof statusConfig];
    const StatusIcon = statusInfo.icon;
    
    return (
      <Card 
        className="hover:shadow-md transition-shadow cursor-pointer"
        onClick={() => setSelectedItem(item)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">
                  {typeIcons[item.type as keyof typeof typeIcons]}
                </span>
                <Badge 
                  variant="secondary"
                  className={statusInfo.color}
                >
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusInfo.label}
                </Badge>
                <Badge 
                  variant="outline"
                  className={priorityConfig[item.priority as keyof typeof priorityConfig].color}
                >
                  {item.priority}
                </Badge>
              </div>
              <CardTitle className="text-lg leading-tight">
                {item.title}
              </CardTitle>
            </div>
            
            <div className="flex flex-col items-center gap-1 min-w-0">
              <Button
                variant={item.userVote === 'UPVOTE' ? 'default' : 'ghost'}
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleVote(item.id, 'UPVOTE');
                }}
                className="h-8 px-2"
              >
                <ThumbsUp className="h-3 w-3" />
              </Button>
              <span className="text-sm font-medium">
                {item.votes}
              </span>
              <Button
                variant={item.userVote === 'DOWNVOTE' ? 'default' : 'ghost'}
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleVote(item.id, 'DOWNVOTE');
                }}
                className="h-8 px-2"
              >
                <ThumbsDown className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <p className="text-gray-600 text-sm mb-3 line-clamp-2">
            {item.description}
          </p>

          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {item.tags.slice(0, 3).map((tag) => (
                <Badge key={tag.tag} variant="outline" className="text-xs">
                  <Tag className="h-2 w-2 mr-1" />
                  {tag.tag}
                </Badge>
              ))}
              {item.tags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{item.tags.length - 3} more
                </Badge>
              )}
            </div>
          )}

          {item.roadmapItem && (
            <Alert className="mb-3">
              <Calendar className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>Roadmap:</strong> {item.roadmapItem}
                {item.releaseTarget && ` (Target: ${item.releaseTarget})`}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-3">
              <span>
                By {item.user.name}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3" />
                {item._count.comments} comments
              </span>
            </div>
            <span>
              {new Date(item.createdAt).toLocaleDateString()}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold mb-2">Feedback Portal</h1>
        <p className="text-gray-600">
          Share your ideas, report bugs, and help us improve the platform.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search feedback..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select
              value={filters.type}
              onValueChange={(value) => setFilters(prev => ({ ...prev, type: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Types</SelectItem>
                <SelectItem value="BUG">🐛 Bug Report</SelectItem>
                <SelectItem value="FEATURE_REQUEST">💡 Feature Request</SelectItem>
                <SelectItem value="IMPROVEMENT">⚡ Improvement</SelectItem>
                <SelectItem value="QUESTION">❓ Question</SelectItem>
                <SelectItem value="COMPLAINT">😟 Complaint</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.status}
              onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Status</SelectItem>
                {Object.entries(statusConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.priority}
              onValueChange={(value) => setFilters(prev => ({ ...prev, priority: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Priority</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={`${filters.sortBy}-${filters.sortOrder}`}
              onValueChange={(value) => {
                const [sortBy, sortOrder] = value.split('-');
                setFilters(prev => ({ ...prev, sortBy, sortOrder }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="votes-desc">Most Voted</SelectItem>
                <SelectItem value="votes-asc">Least Voted</SelectItem>
                <SelectItem value="created-desc">Newest</SelectItem>
                <SelectItem value="created-asc">Oldest</SelectItem>
                <SelectItem value="updated-desc">Recently Updated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Feedback</TabsTrigger>
          <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
          <TabsTrigger value="popular">Popular</TabsTrigger>
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
          ) : (
            <div className="grid gap-4">
              {feedbackItems.map(item => (
                <FeedbackCard key={item.id} item={item} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page === 1}
              >
                Previous
              </Button>
              <span className="px-4 py-2 text-sm">
                Page {pagination.page} of {pagination.pages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                disabled={pagination.page === pagination.pages}
              >
                Next
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="roadmap">
          <Card>
            <CardHeader>
              <CardTitle>Product Roadmap</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Roadmap integration coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="popular">
          <div className="grid gap-4">
            {feedbackItems
              .filter(item => item.votes > 5)
              .slice(0, 10)
              .map(item => (
                <FeedbackCard key={item.id} item={item} />
              ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Feedback Detail Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedItem && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">
                    {typeIcons[selectedItem.type as keyof typeof typeIcons]}
                  </span>
                  <div className="flex-1">
                    <DialogTitle className="text-xl">
                      {selectedItem.title}
                    </DialogTitle>
                    <div className="flex gap-2 mt-2">
                      <Badge 
                        variant="secondary"
                        className={statusConfig[selectedItem.status as keyof typeof statusConfig].color}
                      >
                        {statusConfig[selectedItem.status as keyof typeof statusConfig].label}
                      </Badge>
                      <Badge 
                        variant="outline"
                        className={priorityConfig[selectedItem.priority as keyof typeof priorityConfig].color}
                      >
                        {selectedItem.priority}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center gap-2">
                    <Button
                      variant={selectedItem.userVote === 'UPVOTE' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => handleVote(selectedItem.id, 'UPVOTE')}
                    >
                      <ThumbsUp className="h-4 w-4" />
                    </Button>
                    <span className="font-medium text-lg">
                      {selectedItem.votes}
                    </span>
                    <Button
                      variant={selectedItem.userVote === 'DOWNVOTE' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => handleVote(selectedItem.id, 'DOWNVOTE')}
                    >
                      <ThumbsDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-6">
                {/* Description */}
                <div>
                  <p className="whitespace-pre-wrap text-gray-700">
                    {selectedItem.description}
                  </p>
                </div>

                {/* Screenshot */}
                {selectedItem.screenshot && (
                  <div>
                    <h4 className="font-medium mb-2">Screenshot</h4>
                    <img
                      src={selectedItem.screenshot}
                      alt="Feedback screenshot"
                      className="max-w-full h-auto border rounded-lg"
                    />
                  </div>
                )}

                {/* Tags */}
                {selectedItem.tags.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Tags</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedItem.tags.map((tag) => (
                        <Badge key={tag.tag} variant="outline">
                          <Tag className="h-3 w-3 mr-1" />
                          {tag.tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Comments */}
                <div>
                  <h4 className="font-medium mb-4">Comments ({selectedItem.comments.length})</h4>
                  
                  {/* Add Comment */}
                  <div className="mb-6">
                    <Textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a comment..."
                      rows={3}
                    />
                    <div className="flex justify-end mt-2">
                      <Button
                        onClick={handleComment}
                        disabled={!newComment.trim() || isSubmittingComment}
                        size="sm"
                      >
                        {isSubmittingComment ? (
                          'Posting...'
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Post Comment
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Comment List */}
                  <div className="space-y-4">
                    {selectedItem.comments.map((comment) => (
                      <div key={comment.id} className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium">
                          {comment.user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">
                              {comment.user.name}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(comment.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {comment.content}
                          </p>
                        </div>
                      </div>
                    ))}
                    
                    {selectedItem.comments.length === 0 && (
                      <p className="text-gray-500 text-center py-8">
                        No comments yet. Be the first to share your thoughts!
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};