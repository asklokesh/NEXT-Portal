/**
 * Support Dashboard Component
 * 
 * Multi-channel support ticketing system with:
 * - Ticket creation and management
 * - SLA tracking and escalation
 * - Multi-channel support integration
 * - Customer satisfaction surveys
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
  Plus,
  Search,
  Filter,
  Clock,
  AlertCircle,
  CheckCircle,
  MessageSquare,
  Phone,
  Mail,
  Zap,
  TrendingUp,
  Star,
  Send,
  Paperclip,
  Calendar,
  User,
  BarChart3
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface SupportTicket {
  id: string;
  ticketNumber: string;
  userId: string;
  channel: string;
  category: string;
  priority: string;
  status: string;
  subject: string;
  description: string;
  slaLevel?: string;
  slaResponseTime?: number;
  slaResolveTime?: number;
  assignedTo?: string;
  assignedTeam?: string;
  escalationLevel: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  closedAt?: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  messages?: Array<{
    id: string;
    senderId: string;
    senderType: string;
    message: string;
    isInternal: boolean;
    createdAt: string;
  }>;
  _count: {
    messages: number;
  };
}

const channelIcons = {
  'EMAIL': Mail,
  'CHAT': MessageSquare,
  'IN_APP': Zap,
  'PHONE': Phone,
  'SOCIAL': TrendingUp,
  'API': BarChart3
};

const statusConfig = {
  'NEW': { label: 'New', color: 'bg-blue-100 text-blue-800', icon: Clock },
  'OPEN': { label: 'Open', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  'IN_PROGRESS': { label: 'In Progress', color: 'bg-yellow-100 text-yellow-800', icon: TrendingUp },
  'WAITING_CUSTOMER': { label: 'Waiting Customer', color: 'bg-orange-100 text-orange-800', icon: Clock },
  'WAITING_INTERNAL': { label: 'Waiting Internal', color: 'bg-purple-100 text-purple-800', icon: Clock },
  'ESCALATED': { label: 'Escalated', color: 'bg-red-100 text-red-800', icon: AlertCircle },
  'RESOLVED': { label: 'Resolved', color: 'bg-green-200 text-green-900', icon: CheckCircle },
  'CLOSED': { label: 'Closed', color: 'bg-gray-100 text-gray-800', icon: CheckCircle }
};

const priorityConfig = {
  'LOW': { color: 'bg-gray-100 text-gray-800' },
  'MEDIUM': { color: 'bg-blue-100 text-blue-800' },
  'HIGH': { color: 'bg-orange-100 text-orange-800' },
  'URGENT': { color: 'bg-red-100 text-red-800' },
  'CRITICAL': { color: 'bg-red-200 text-red-900' }
};

interface NewTicketForm {
  channel: string;
  category: string;
  priority: string;
  subject: string;
  description: string;
  accountId?: string;
}

export const SupportDashboard: React.FC = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newTicket, setNewTicket] = useState<NewTicketForm>({
    channel: 'IN_APP',
    category: 'TECHNICAL',
    priority: 'MEDIUM',
    subject: '',
    description: ''
  });
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [isSubmittingMessage, setIsSubmittingMessage] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    priority: '',
    category: '',
    channel: '',
    sortBy: 'created',
    sortOrder: 'desc'
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    resolved: 0,
    overdue: 0
  });
  const { toast } = useToast();

  const loadTickets = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      params.append('page', pagination.page.toString());
      params.append('limit', pagination.limit.toString());

      const response = await fetch(`/api/support/tickets?${params}`, {
        headers: {
          'x-user-id': 'current-user-id', // This would come from auth context
          'x-user-role': 'DEVELOPER' // This would come from auth context
        }
      });
      
      const result = await response.json();

      if (result.success) {
        setTickets(result.data.tickets);
        setPagination(result.data.pagination);
        
        // Calculate stats
        const allTickets = result.data.tickets;
        setStats({
          total: allTickets.length,
          open: allTickets.filter((t: SupportTicket) => ['NEW', 'OPEN', 'IN_PROGRESS'].includes(t.status)).length,
          resolved: allTickets.filter((t: SupportTicket) => ['RESOLVED', 'CLOSED'].includes(t.status)).length,
          overdue: allTickets.filter((t: SupportTicket) => {
            // Simple overdue logic - tickets older than 24 hours without response
            const createdDate = new Date(t.createdAt);
            const now = new Date();
            const hoursDiff = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
            return t.status === 'NEW' && hoursDiff > 24;
          }).length
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        title: 'Loading Failed',
        description: error.message || 'Failed to load tickets.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const createTicket = async () => {
    if (!newTicket.subject.trim() || !newTicket.description.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in both subject and description.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsSubmittingTicket(true);

      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'current-user-id' // This would come from auth context
        },
        body: JSON.stringify(newTicket)
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Ticket Created',
          description: `Ticket ${result.data.ticketNumber} has been created successfully.`,
        });
        
        setNewTicket({
          channel: 'IN_APP',
          category: 'TECHNICAL',
          priority: 'MEDIUM',
          subject: '',
          description: ''
        });
        
        setIsCreateDialogOpen(false);
        loadTickets(); // Refresh the list
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        title: 'Creation Failed',
        description: error.message || 'Failed to create ticket.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const addMessage = async () => {
    if (!selectedTicket || !newMessage.trim()) return;

    try {
      setIsSubmittingMessage(true);

      const response = await fetch(`/api/support/tickets/${selectedTicket.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'current-user-id' // This would come from auth context
        },
        body: JSON.stringify({
          message: newMessage.trim(),
          isInternal: false
        })
      });

      const result = await response.json();

      if (result.success) {
        // Add the new message to the selected ticket
        setSelectedTicket(prev => prev ? {
          ...prev,
          messages: [...(prev.messages || []), result.data]
        } : null);

        setNewMessage('');
        
        toast({
          title: 'Message Sent',
          description: 'Your message has been sent successfully.',
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        title: 'Message Failed',
        description: error.message || 'Failed to send message.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmittingMessage(false);
    }
  };

  const loadTicketDetails = async (ticketId: string) => {
    try {
      const response = await fetch(`/api/support/tickets/${ticketId}`, {
        headers: {
          'x-user-id': 'current-user-id', // This would come from auth context
          'x-user-role': 'DEVELOPER' // This would come from auth context
        }
      });
      
      const result = await response.json();

      if (result.success) {
        setSelectedTicket(result.data);
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        title: 'Loading Failed',
        description: error.message || 'Failed to load ticket details.',
        variant: 'destructive'
      });
    }
  };

  useEffect(() => {
    loadTickets();
  }, [filters, pagination.page]);

  const calculateSLAStatus = (ticket: SupportTicket) => {
    if (!ticket.slaResponseTime) return null;
    
    const createdDate = new Date(ticket.createdAt);
    const now = new Date();
    const minutesElapsed = (now.getTime() - createdDate.getTime()) / (1000 * 60);
    const remainingMinutes = ticket.slaResponseTime - minutesElapsed;
    
    if (remainingMinutes <= 0) {
      return { status: 'violated', message: 'SLA Violated' };
    } else if (remainingMinutes <= 60) {
      return { status: 'warning', message: `${Math.round(remainingMinutes)}m remaining` };
    } else {
      return { status: 'ok', message: `${Math.round(remainingMinutes / 60)}h remaining` };
    }
  };

  const TicketCard: React.FC<{ ticket: SupportTicket }> = ({ ticket }) => {
    const statusInfo = statusConfig[ticket.status as keyof typeof statusConfig];
    const StatusIcon = statusInfo.icon;
    const ChannelIcon = channelIcons[ticket.channel as keyof typeof channelIcons];
    const slaStatus = calculateSLAStatus(ticket);
    
    return (
      <Card 
        className="hover:shadow-md transition-shadow cursor-pointer"
        onClick={() => {
          loadTicketDetails(ticket.id);
          setSelectedTicket(ticket);
        }}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge 
                  variant="secondary"
                  className={statusInfo.color}
                >
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusInfo.label}
                </Badge>
                <Badge 
                  variant="outline"
                  className={priorityConfig[ticket.priority as keyof typeof priorityConfig].color}
                >
                  {ticket.priority}
                </Badge>
                <div className="flex items-center gap-1">
                  <ChannelIcon className="h-3 w-3" />
                  <span className="text-xs text-gray-500">{ticket.channel}</span>
                </div>
              </div>
              <CardTitle className="text-lg leading-tight mb-1">
                {ticket.subject}
              </CardTitle>
              <div className="text-sm text-gray-600">
                #{ticket.ticketNumber}
              </div>
            </div>
            
            {slaStatus && (
              <div className={`text-xs px-2 py-1 rounded ${
                slaStatus.status === 'violated' ? 'bg-red-100 text-red-800' :
                slaStatus.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }`}>
                {slaStatus.message}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <p className="text-gray-600 text-sm mb-3 line-clamp-2">
            {ticket.description}
          </p>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {ticket.user.name}
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {ticket._count.messages} messages
              </span>
              {ticket.escalationLevel > 0 && (
                <Badge variant="destructive" className="text-xs">
                  Escalated L{ticket.escalationLevel}
                </Badge>
              )}
            </div>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(ticket.createdAt).toLocaleDateString()}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-2">Support Dashboard</h1>
          <p className="text-gray-600">
            Manage your support tickets and get help from our team.
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Ticket
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Support Ticket</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Channel</label>
                  <Select
                    value={newTicket.channel}
                    onValueChange={(value) => setNewTicket(prev => ({ ...prev, channel: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IN_APP">In-App</SelectItem>
                      <SelectItem value="EMAIL">Email</SelectItem>
                      <SelectItem value="CHAT">Chat</SelectItem>
                      <SelectItem value="PHONE">Phone</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Category</label>
                  <Select
                    value={newTicket.category}
                    onValueChange={(value) => setNewTicket(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TECHNICAL">Technical</SelectItem>
                      <SelectItem value="BILLING">Billing</SelectItem>
                      <SelectItem value="ACCOUNT">Account</SelectItem>
                      <SelectItem value="FEATURE_REQUEST">Feature Request</SelectItem>
                      <SelectItem value="INTEGRATION">Integration</SelectItem>
                      <SelectItem value="SECURITY">Security</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Priority</label>
                  <Select
                    value={newTicket.priority}
                    onValueChange={(value) => setNewTicket(prev => ({ ...prev, priority: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="URGENT">Urgent</SelectItem>
                      <SelectItem value="CRITICAL">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Subject</label>
                <Input
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Brief description of the issue..."
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Description</label>
                <Textarea
                  value={newTicket.description}
                  onChange={(e) => setNewTicket(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Please provide detailed information about your issue..."
                  rows={5}
                />
              </div>

              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={createTicket}
                  disabled={isSubmittingTicket}
                >
                  {isSubmittingTicket ? 'Creating...' : 'Create Ticket'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <MessageSquare className="h-5 w-5 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Tickets</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Clock className="h-5 w-5 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Open</p>
                <p className="text-2xl font-bold">{stats.open}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Resolved</p>
                <p className="text-2xl font-bold">{stats.resolved}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Overdue</p>
                <p className="text-2xl font-bold">{stats.overdue}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search tickets..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>
            
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
              value={filters.category}
              onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Categories</SelectItem>
                <SelectItem value="TECHNICAL">Technical</SelectItem>
                <SelectItem value="BILLING">Billing</SelectItem>
                <SelectItem value="ACCOUNT">Account</SelectItem>
                <SelectItem value="FEATURE_REQUEST">Feature Request</SelectItem>
                <SelectItem value="INTEGRATION">Integration</SelectItem>
                <SelectItem value="SECURITY">Security</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
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
                <SelectItem value="created-desc">Newest First</SelectItem>
                <SelectItem value="created-asc">Oldest First</SelectItem>
                <SelectItem value="updated-desc">Recently Updated</SelectItem>
                <SelectItem value="priority-desc">High Priority First</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      <div className="grid gap-4">
        {loading ? (
          [...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-3 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))
        ) : tickets.length > 0 ? (
          tickets.map(ticket => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No tickets found</h3>
              <p className="text-gray-600 mb-4">
                You don't have any support tickets yet.
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Ticket
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

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

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedTicket && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <DialogTitle className="text-xl mb-2">
                      {selectedTicket.subject}
                    </DialogTitle>
                    <div className="flex gap-2">
                      <Badge 
                        variant="secondary"
                        className={statusConfig[selectedTicket.status as keyof typeof statusConfig].color}
                      >
                        {statusConfig[selectedTicket.status as keyof typeof statusConfig].label}
                      </Badge>
                      <Badge 
                        variant="outline"
                        className={priorityConfig[selectedTicket.priority as keyof typeof priorityConfig].color}
                      >
                        {selectedTicket.priority}
                      </Badge>
                      <Badge variant="outline">
                        #{selectedTicket.ticketNumber}
                      </Badge>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-6">
                {/* Original Description */}
                <div>
                  <h4 className="font-medium mb-2">Original Request</h4>
                  <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded">
                    {selectedTicket.description}
                  </p>
                </div>

                <Separator />

                {/* Messages */}
                <div>
                  <h4 className="font-medium mb-4">Conversation</h4>
                  
                  {selectedTicket.messages && selectedTicket.messages.length > 0 ? (
                    <div className="space-y-4 mb-6">
                      {selectedTicket.messages.map((message) => (
                        <div 
                          key={message.id} 
                          className={`flex gap-3 ${
                            message.senderType === 'CUSTOMER' ? 'flex-row-reverse' : ''
                          }`}
                        >
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium">
                            {message.senderType === 'CUSTOMER' ? 'C' : 
                             message.senderType === 'AGENT' ? 'A' : 'S'}
                          </div>
                          <div className={`flex-1 max-w-xs ${
                            message.senderType === 'CUSTOMER' ? 'text-right' : ''
                          }`}>
                            <div className={`p-3 rounded-lg ${
                              message.senderType === 'CUSTOMER' 
                                ? 'bg-blue-100 text-blue-900' 
                                : 'bg-gray-100 text-gray-900'
                            }`}>
                              <p className="text-sm whitespace-pre-wrap">
                                {message.message}
                              </p>
                              {message.isInternal && (
                                <Badge variant="destructive" className="text-xs mt-1">
                                  Internal
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(message.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">
                      No messages yet. Start the conversation!
                    </p>
                  )}

                  {/* Add Message */}
                  {selectedTicket.status !== 'CLOSED' && (
                    <div className="border-t pt-4">
                      <Textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your message..."
                        rows={3}
                      />
                      <div className="flex justify-between items-center mt-2">
                        <Button variant="outline" size="sm">
                          <Paperclip className="h-4 w-4 mr-2" />
                          Attach File
                        </Button>
                        <Button
                          onClick={addMessage}
                          disabled={!newMessage.trim() || isSubmittingMessage}
                          size="sm"
                        >
                          {isSubmittingMessage ? (
                            'Sending...'
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-2" />
                              Send Message
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Satisfaction Survey (for resolved tickets) */}
                {selectedTicket.status === 'RESOLVED' && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium mb-4">How was our support?</h4>
                      <div className="flex items-center gap-2 mb-4">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <Star
                            key={rating}
                            className="h-6 w-6 cursor-pointer text-gray-300 hover:text-yellow-400"
                          />
                        ))}
                      </div>
                      <Textarea
                        placeholder="Tell us about your experience (optional)..."
                        rows={3}
                      />
                      <Button size="sm" className="mt-2">
                        Submit Feedback
                      </Button>
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