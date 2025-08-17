/**
 * Partner Dashboard Component
 * 
 * Partner portal with:
 * - Registration and onboarding
 * - Deal registration and protection
 * - Training and certification
 * - Co-marketing resources
 * - Revenue sharing and commissions
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
import { Progress } from '@/components/ui/progress';
import {
  Plus,
  DollarSign,
  TrendingUp,
  Award,
  Users,
  BookOpen,
  Download,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Star,
  Building,
  Globe,
  Shield,
  Target
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface PartnerAnalytics {
  deals: {
    total: number;
    won: number;
    winRate: number;
  };
  revenue: {
    total: number;
    won: number;
  };
  commissions: {
    paid: number;
  };
  training: {
    completed: number;
  };
}

interface DealRegistration {
  id: string;
  dealNumber: string;
  customerName: string;
  customerEmail: string;
  customerCompany: string;
  dealValue: number;
  currency: string;
  probability: number;
  expectedClose: string;
  status: string;
  description: string;
  protectionEnd: string;
  createdAt: string;
  updatedAt: string;
}

interface Commission {
  id: string;
  amount: number;
  currency: string;
  rate: number;
  status: string;
  period: string;
  dueDate: string;
  paidAt?: string;
}

interface PartnerResource {
  id: string;
  title: string;
  type: string;
  description: string;
  fileUrl?: string;
  category: string;
  downloadCount: number;
  createdAt: string;
}

const dealStatusConfig = {
  'PENDING': { label: 'Pending Review', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  'APPROVED': { label: 'Approved', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  'REJECTED': { label: 'Rejected', color: 'bg-red-100 text-red-800', icon: AlertCircle },
  'WON': { label: 'Won', color: 'bg-green-200 text-green-900', icon: TrendingUp },
  'LOST': { label: 'Lost', color: 'bg-gray-100 text-gray-800', icon: AlertCircle },
  'EXPIRED': { label: 'Expired', color: 'bg-red-100 text-red-800', icon: Clock }
};

const commissionStatusConfig = {
  'PENDING': { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  'APPROVED': { label: 'Approved', color: 'bg-blue-100 text-blue-800' },
  'PAID': { label: 'Paid', color: 'bg-green-100 text-green-800' },
  'DISPUTED': { label: 'Disputed', color: 'bg-red-100 text-red-800' }
};

export const PartnerDashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<PartnerAnalytics>({
    deals: { total: 0, won: 0, winRate: 0 },
    revenue: { total: 0, won: 0 },
    commissions: { paid: 0 },
    training: { completed: 0 }
  });
  const [deals, setDeals] = useState<DealRegistration[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [resources, setResources] = useState<PartnerResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDealOpen, setIsCreateDealOpen] = useState(false);
  const [newDeal, setNewDeal] = useState({
    customerName: '',
    customerEmail: '',
    customerCompany: '',
    dealValue: '',
    probability: '50',
    expectedClose: '',
    description: '',
    competitors: [] as string[],
    notes: ''
  });
  const [isSubmittingDeal, setIsSubmittingDeal] = useState(false);
  const { toast } = useToast();

  const partnerId = 'current-partner-id'; // This would come from auth context

  const loadAnalytics = async () => {
    try {
      const response = await fetch(`/api/partners/${partnerId}/analytics`);
      const result = await response.json();

      if (result.success) {
        setAnalytics(result.data);
      }
    } catch (error: any) {
      console.error('Failed to load analytics:', error);
    }
  };

  const loadDeals = async () => {
    try {
      const response = await fetch(`/api/partners/${partnerId}/deals`);
      const result = await response.json();

      if (result.success) {
        setDeals(result.data.deals);
      }
    } catch (error: any) {
      console.error('Failed to load deals:', error);
    }
  };

  const loadCommissions = async () => {
    try {
      const response = await fetch(`/api/partners/${partnerId}/commissions`);
      const result = await response.json();

      if (result.success) {
        setCommissions(result.data.commissions);
      }
    } catch (error: any) {
      console.error('Failed to load commissions:', error);
    }
  };

  const loadResources = async () => {
    try {
      const response = await fetch(`/api/partners/${partnerId}/resources`);
      const result = await response.json();

      if (result.success) {
        setResources(result.data);
      }
    } catch (error: any) {
      console.error('Failed to load resources:', error);
    }
  };

  const createDeal = async () => {
    if (!newDeal.customerName || !newDeal.customerEmail || !newDeal.customerCompany || !newDeal.dealValue) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsSubmittingDeal(true);

      const response = await fetch(`/api/partners/${partnerId}/deals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...newDeal,
          dealValue: parseFloat(newDeal.dealValue),
          probability: parseInt(newDeal.probability),
          expectedClose: new Date(newDeal.expectedClose).toISOString()
        })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Deal Registered',
          description: `Deal ${result.data.dealNumber} has been registered successfully.`,
        });
        
        setNewDeal({
          customerName: '',
          customerEmail: '',
          customerCompany: '',
          dealValue: '',
          probability: '50',
          expectedClose: '',
          description: '',
          competitors: [],
          notes: ''
        });
        
        setIsCreateDealOpen(false);
        loadDeals();
        loadAnalytics();
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        title: 'Registration Failed',
        description: error.message || 'Failed to register deal.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmittingDeal(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          loadAnalytics(),
          loadDeals(),
          loadCommissions(),
          loadResources()
        ]);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  const DealCard: React.FC<{ deal: DealRegistration }> = ({ deal }) => {
    const statusInfo = dealStatusConfig[deal.status as keyof typeof dealStatusConfig];
    const StatusIcon = statusInfo.icon;
    
    return (
      <Card>
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
                <Badge variant="outline">
                  #{deal.dealNumber}
                </Badge>
              </div>
              <CardTitle className="text-lg">
                {deal.customerCompany}
              </CardTitle>
              <p className="text-sm text-gray-600">
                Contact: {deal.customerName} ({deal.customerEmail})
              </p>
            </div>
            
            <div className="text-right">
              <div className="text-2xl font-bold text-green-600">
                ${deal.dealValue.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500">
                {deal.probability}% probability
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="space-y-3">
            <Progress value={deal.probability} className="w-full" />
            
            <p className="text-sm text-gray-700 line-clamp-2">
              {deal.description}
            </p>

            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Expected: {new Date(deal.expectedClose).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Protected until {new Date(deal.protectionEnd).toLocaleDateString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const CommissionCard: React.FC<{ commission: Commission }> = ({ commission }) => {
    const statusInfo = commissionStatusConfig[commission.status as keyof typeof commissionStatusConfig];
    
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">
                ${commission.amount.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500">
                Period: {commission.period}
              </div>
              <div className="text-xs text-gray-500">
                Rate: {(commission.rate * 100).toFixed(1)}%
              </div>
            </div>
            <div className="text-right">
              <Badge 
                variant="secondary"
                className={statusInfo.color}
              >
                {statusInfo.label}
              </Badge>
              <div className="text-sm text-gray-500 mt-1">
                Due: {new Date(commission.dueDate).toLocaleDateString()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const ResourceCard: React.FC<{ resource: PartnerResource }> = ({ resource }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline">{resource.type.replace('_', ' ')}</Badge>
              <Badge variant="secondary">{resource.category}</Badge>
            </div>
            <CardTitle className="text-lg">{resource.title}</CardTitle>
          </div>
          {resource.fileUrl && (
            <Button size="sm" variant="outline">
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
          {resource.description}
        </p>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{resource.downloadCount} downloads</span>
          <span>{new Date(resource.createdAt).toLocaleDateString()}</span>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-2">Partner Portal</h1>
          <p className="text-gray-600">
            Manage your partnership, track deals, and access resources.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-gold-100 text-gold-800">
            <Star className="h-3 w-3 mr-1" />
            Gold Partner
          </Badge>
          <Dialog open={isCreateDealOpen} onOpenChange={setIsCreateDealOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Register Deal
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Register New Deal</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Customer Name *</label>
                    <Input
                      value={newDeal.customerName}
                      onChange={(e) => setNewDeal(prev => ({ ...prev, customerName: e.target.value }))}
                      placeholder="John Smith"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Customer Email *</label>
                    <Input
                      type="email"
                      value={newDeal.customerEmail}
                      onChange={(e) => setNewDeal(prev => ({ ...prev, customerEmail: e.target.value }))}
                      placeholder="john@company.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Customer Company *</label>
                  <Input
                    value={newDeal.customerCompany}
                    onChange={(e) => setNewDeal(prev => ({ ...prev, customerCompany: e.target.value }))}
                    placeholder="Acme Corporation"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Deal Value (USD) *</label>
                    <Input
                      type="number"
                      value={newDeal.dealValue}
                      onChange={(e) => setNewDeal(prev => ({ ...prev, dealValue: e.target.value }))}
                      placeholder="50000"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Probability (%)</label>
                    <Select
                      value={newDeal.probability}
                      onValueChange={(value) => setNewDeal(prev => ({ ...prev, probability: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10% - Initial Interest</SelectItem>
                        <SelectItem value="25">25% - Qualified Lead</SelectItem>
                        <SelectItem value="50">50% - Proposal Sent</SelectItem>
                        <SelectItem value="75">75% - Negotiation</SelectItem>
                        <SelectItem value="90">90% - Verbal Agreement</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Expected Close</label>
                    <Input
                      type="date"
                      value={newDeal.expectedClose}
                      onChange={(e) => setNewDeal(prev => ({ ...prev, expectedClose: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Description</label>
                  <Textarea
                    value={newDeal.description}
                    onChange={(e) => setNewDeal(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe the opportunity, customer needs, and solution..."
                    rows={3}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Notes (Optional)</label>
                  <Textarea
                    value={newDeal.notes}
                    onChange={(e) => setNewDeal(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional notes, next steps, etc..."
                    rows={2}
                  />
                </div>

                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Deal registration provides you with 90 days of deal protection for Gold partners.
                    This ensures you receive full commission credit for successful closures.
                  </AlertDescription>
                </Alert>

                <div className="flex gap-3 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setIsCreateDealOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={createDeal}
                    disabled={isSubmittingDeal}
                  >
                    {isSubmittingDeal ? 'Registering...' : 'Register Deal'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Target className="h-5 w-5 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Deals</p>
                <p className="text-2xl font-bold">{analytics.deals.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Win Rate</p>
                <p className="text-2xl font-bold">{analytics.deals.winRate.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Commissions Paid</p>
                <p className="text-2xl font-bold">${analytics.commissions.paid.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Award className="h-5 w-5 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Training Complete</p>
                <p className="text-2xl font-bold">{analytics.training.completed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="deals" className="space-y-6">
        <TabsList>
          <TabsTrigger value="deals">Deal Pipeline</TabsTrigger>
          <TabsTrigger value="commissions">Commissions</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="training">Training</TabsTrigger>
        </TabsList>

        <TabsContent value="deals" className="space-y-4">
          {loading ? (
            <div className="grid gap-4">
              {[...Array(3)].map((_, i) => (
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
          ) : deals.length > 0 ? (
            <div className="grid gap-4">
              {deals.map(deal => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No deals registered</h3>
                <p className="text-gray-600 mb-4">
                  Start by registering your first deal to protect your commission.
                </p>
                <Button onClick={() => setIsCreateDealOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Register First Deal
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="commissions" className="space-y-4">
          <div className="grid gap-4">
            {commissions.length > 0 ? (
              commissions.map(commission => (
                <CommissionCard key={commission.id} commission={commission} />
              ))
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No commissions yet</h3>
                  <p className="text-gray-600">
                    Commissions will appear here once your registered deals are won.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {resources.length > 0 ? (
              resources.map(resource => (
                <ResourceCard key={resource.id} resource={resource} />
              ))
            ) : (
              <Card className="md:col-span-2 lg:col-span-3">
                <CardContent className="text-center py-12">
                  <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No resources available</h3>
                  <p className="text-gray-600">
                    Partner resources will appear here once they are published.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="training" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Available Courses
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Platform Fundamentals</h4>
                    <p className="text-sm text-gray-600">Basic level • 2 hours</p>
                  </div>
                  <Button size="sm">Start</Button>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Sales Methodology</h4>
                    <p className="text-sm text-gray-600">Intermediate • 3 hours</p>
                  </div>
                  <Button size="sm" variant="outline">Locked</Button>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Technical Deep Dive</h4>
                    <p className="text-sm text-gray-600">Advanced • 5 hours</p>
                  </div>
                  <Button size="sm" variant="outline">Locked</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Certifications
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <Award className="h-4 w-4" />
                  <AlertDescription>
                    Complete training courses to unlock higher partner tiers and increased commission rates.
                  </AlertDescription>
                </Alert>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Partner Fundamentals</span>
                    <Badge variant="outline">Not Started</Badge>
                  </div>
                  <Progress value={0} className="w-full" />
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Sales Specialist</span>
                    <Badge variant="outline">Locked</Badge>
                  </div>
                  <Progress value={0} className="w-full" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};