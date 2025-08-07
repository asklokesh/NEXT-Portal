'use client';

import { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Cloud,
  Database,
  Package,
  Shield,
  Activity,
  Calendar,
  Clock,
  Filter,
  Download,
  Settings,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Info,
  AlertCircle,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  BarChart3,
  PieChart,
  LineChart,
  Calculator,
  CreditCard,
  Receipt,
  Wallet,
  Target,
  Zap,
  Server,
  HardDrive,
  Network,
  Globe,
  Users,
  Building,
  Briefcase,
  Tag,
  Hash,
  MoreVertical,
  RefreshCw,
  Save,
  FileText,
  Mail,
  Bell,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';

// Dynamic imports for charts
const AreaChart = dynamic(() => import('@/components/charts/AreaChart'), { ssr: false });
const BarChart = dynamic(() => import('@/components/charts/BarChart'), { ssr: false });
const PieChartComponent = dynamic(() => import('@/components/charts/PieChart'), { ssr: false });
const LineChartComponent = dynamic(() => import('@/components/charts/LineChart'), { ssr: false });

interface CostData {
  period: string;
  total: number;
  compute: number;
  storage: number;
  network: number;
  other: number;
  trend: number;
  forecast?: number;
}

interface ServiceCost {
  id: string;
  name: string;
  category: 'compute' | 'storage' | 'network' | 'database' | 'other';
  provider: 'aws' | 'gcp' | 'azure' | 'other';
  owner: string;
  tags: string[];
  currentMonth: number;
  lastMonth: number;
  trend: number;
  budget: number;
  utilization: number;
  instances: number;
  recommendations?: string[];
}

interface CostAnomaly {
  id: string;
  service: string;
  type: 'spike' | 'unusual_pattern' | 'budget_exceeded' | 'forecast_alert';
  severity: 'low' | 'medium' | 'high' | 'critical';
  amount: number;
  percentage: number;
  description: string;
  detectedAt: string;
  resolved: boolean;
}

interface CostAllocation {
  team: string;
  department: string;
  currentMonth: number;
  lastMonth: number;
  budget: number;
  services: string[];
  projects: number;
}

interface SavingsOpportunity {
  id: string;
  type: 'reserved_instances' | 'spot_instances' | 'rightsizing' | 'unused_resources' | 'data_transfer';
  service: string;
  currentCost: number;
  estimatedSavings: number;
  savingsPercentage: number;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  description: string;
  actions: string[];
}

export default function CostInsightsPage() {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [showForecast, setShowForecast] = useState(true);
  const [showAnomalies, setShowAnomalies] = useState(true);
  const [costData, setCostData] = useState<CostData[]>([]);
  const [serviceCosts, setServiceCosts] = useState<ServiceCost[]>([]);
  const [anomalies, setAnomalies] = useState<CostAnomaly[]>([]);
  const [allocations, setAllocations] = useState<CostAllocation[]>([]);
  const [opportunities, setOpportunities] = useState<SavingsOpportunity[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'services' | 'allocation' | 'optimization' | 'reports'>('overview');

  useEffect(() => {
    fetchCostData();
  }, [timeRange, selectedProvider, selectedTeam]);

  const fetchCostData = async () => {
    setLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Generate mock data based on time range
    const periods = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
    const mockCostData: CostData[] = [];
    
    for (let i = periods; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      const baseTotal = 50000 + Math.random() * 20000;
      mockCostData.push({
        period: date.toISOString().split('T')[0],
        total: baseTotal,
        compute: baseTotal * 0.4,
        storage: baseTotal * 0.25,
        network: baseTotal * 0.2,
        other: baseTotal * 0.15,
        trend: i === 0 ? 0 : (Math.random() - 0.5) * 10,
        forecast: i < 7 ? baseTotal * (1 + Math.random() * 0.1) : undefined,
      });
    }
    
    // Mock service costs
    const mockServiceCosts: ServiceCost[] = [
      {
        id: 'ec2-production',
        name: 'EC2 Production Instances',
        category: 'compute',
        provider: 'aws',
        owner: 'team:platform',
        tags: ['production', 'critical'],
        currentMonth: 15234,
        lastMonth: 14567,
        trend: 4.6,
        budget: 16000,
        utilization: 78,
        instances: 42,
        recommendations: ['Consider reserved instances', 'Optimize instance types'],
      },
      {
        id: 's3-storage',
        name: 'S3 Storage',
        category: 'storage',
        provider: 'aws',
        owner: 'team:data',
        tags: ['storage', 'data-lake'],
        currentMonth: 8956,
        lastMonth: 8234,
        trend: 8.8,
        budget: 10000,
        utilization: 65,
        instances: 12,
        recommendations: ['Enable lifecycle policies', 'Move cold data to Glacier'],
      },
      {
        id: 'rds-databases',
        name: 'RDS Databases',
        category: 'database',
        provider: 'aws',
        owner: 'team:backend',
        tags: ['database', 'production'],
        currentMonth: 12345,
        lastMonth: 11890,
        trend: 3.8,
        budget: 13000,
        utilization: 82,
        instances: 8,
        recommendations: ['Review backup retention', 'Consider Aurora Serverless'],
      },
      {
        id: 'cloudfront-cdn',
        name: 'CloudFront CDN',
        category: 'network',
        provider: 'aws',
        owner: 'team:frontend',
        tags: ['cdn', 'performance'],
        currentMonth: 4567,
        lastMonth: 4123,
        trend: 10.8,
        budget: 5000,
        utilization: 91,
        instances: 3,
      },
      {
        id: 'gke-clusters',
        name: 'GKE Clusters',
        category: 'compute',
        provider: 'gcp',
        owner: 'team:platform',
        tags: ['kubernetes', 'microservices'],
        currentMonth: 18976,
        lastMonth: 17234,
        trend: 10.1,
        budget: 20000,
        utilization: 73,
        instances: 5,
        recommendations: ['Enable cluster autoscaling', 'Use preemptible nodes'],
      },
    ];
    
    // Mock anomalies
    const mockAnomalies: CostAnomaly[] = [
      {
        id: 'anomaly-1',
        service: 'EC2 Production Instances',
        type: 'spike',
        severity: 'high',
        amount: 2340,
        percentage: 45,
        description: 'Unusual spike in compute costs detected',
        detectedAt: new Date(Date.now() - 86400000).toISOString(),
        resolved: false,
      },
      {
        id: 'anomaly-2',
        service: 'S3 Storage',
        type: 'budget_exceeded',
        severity: 'medium',
        amount: 956,
        percentage: 10,
        description: 'Monthly budget exceeded by 10%',
        detectedAt: new Date(Date.now() - 172800000).toISOString(),
        resolved: false,
      },
      {
        id: 'anomaly-3',
        service: 'CloudFront CDN',
        type: 'forecast_alert',
        severity: 'low',
        amount: 567,
        percentage: 12,
        description: 'Forecasted to exceed budget by month end',
        detectedAt: new Date().toISOString(),
        resolved: false,
      },
    ];
    
    // Mock allocations
    const mockAllocations: CostAllocation[] = [
      {
        team: 'Platform',
        department: 'Engineering',
        currentMonth: 34210,
        lastMonth: 31780,
        budget: 36000,
        services: ['EC2', 'GKE', 'Lambda'],
        projects: 12,
      },
      {
        team: 'Data',
        department: 'Engineering',
        currentMonth: 18956,
        lastMonth: 17234,
        budget: 20000,
        services: ['S3', 'EMR', 'Redshift'],
        projects: 8,
      },
      {
        team: 'Backend',
        department: 'Engineering',
        currentMonth: 15678,
        lastMonth: 14890,
        budget: 16000,
        services: ['RDS', 'DynamoDB', 'ElastiCache'],
        projects: 6,
      },
      {
        team: 'Frontend',
        department: 'Engineering',
        currentMonth: 8765,
        lastMonth: 8123,
        budget: 10000,
        services: ['CloudFront', 'S3', 'Route53'],
        projects: 4,
      },
      {
        team: 'DevOps',
        department: 'Operations',
        currentMonth: 12345,
        lastMonth: 11567,
        budget: 13000,
        services: ['CloudWatch', 'X-Ray', 'Systems Manager'],
        projects: 5,
      },
    ];
    
    // Mock savings opportunities
    const mockOpportunities: SavingsOpportunity[] = [
      {
        id: 'opp-1',
        type: 'reserved_instances',
        service: 'EC2 Production Instances',
        currentCost: 15234,
        estimatedSavings: 4570,
        savingsPercentage: 30,
        effort: 'low',
        impact: 'high',
        description: 'Purchase reserved instances for stable workloads',
        actions: [
          'Analyze usage patterns',
          'Identify stable workloads',
          'Purchase 1-year reserved instances',
        ],
      },
      {
        id: 'opp-2',
        type: 'rightsizing',
        service: 'GKE Clusters',
        currentCost: 18976,
        estimatedSavings: 2846,
        savingsPercentage: 15,
        effort: 'medium',
        impact: 'medium',
        description: 'Rightsize underutilized instances',
        actions: [
          'Review CPU and memory utilization',
          'Identify oversized instances',
          'Resize to appropriate instance types',
        ],
      },
      {
        id: 'opp-3',
        type: 'unused_resources',
        service: 'Various',
        currentCost: 3456,
        estimatedSavings: 3456,
        savingsPercentage: 100,
        effort: 'low',
        impact: 'medium',
        description: 'Delete unused resources',
        actions: [
          'Identify unattached EBS volumes',
          'Remove unused Elastic IPs',
          'Delete old snapshots',
        ],
      },
      {
        id: 'opp-4',
        type: 'spot_instances',
        service: 'Non-critical workloads',
        currentCost: 8900,
        estimatedSavings: 5340,
        savingsPercentage: 60,
        effort: 'high',
        impact: 'high',
        description: 'Use spot instances for batch processing',
        actions: [
          'Identify fault-tolerant workloads',
          'Implement spot fleet',
          'Configure interruption handling',
        ],
      },
      {
        id: 'opp-5',
        type: 'data_transfer',
        service: 'Cross-region transfers',
        currentCost: 2345,
        estimatedSavings: 1172,
        savingsPercentage: 50,
        effort: 'medium',
        impact: 'low',
        description: 'Optimize data transfer costs',
        actions: [
          'Use CloudFront for static content',
          'Implement caching strategies',
          'Consolidate resources in single region',
        ],
      },
    ];
    
    setCostData(mockCostData);
    setServiceCosts(mockServiceCosts);
    setAnomalies(mockAnomalies);
    setAllocations(mockAllocations);
    setOpportunities(mockOpportunities);
    setLoading(false);
  };

  const currentMonthTotal = costData.length > 0 ? costData[costData.length - 1].total : 0;
  const lastMonthTotal = costData.length > 30 ? costData[costData.length - 31].total : 0;
  const monthlyTrend = lastMonthTotal > 0 ? ((currentMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : 0;
  const totalBudget = allocations.reduce((sum, a) => sum + a.budget, 0);
  const totalSpend = allocations.reduce((sum, a) => sum + a.currentMonth, 0);
  const budgetUtilization = totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0;
  const potentialSavings = opportunities.reduce((sum, o) => sum + o.estimatedSavings, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <DollarSign className="w-16 h-16 animate-pulse text-green-600 mx-auto mb-4" />
          <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Loading Cost Insights
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Analyzing cloud spending...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl p-8 text-white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center mb-2">
              <DollarSign className="w-8 h-8 mr-3" />
              <h1 className="text-3xl font-bold">Cost Insights & FinOps</h1>
              <Badge className="ml-3 bg-white/20 text-white">
                Real-time
              </Badge>
            </div>
            <p className="text-xl text-green-100">
              Cloud cost management and optimization platform
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="bg-white text-green-600 hover:bg-green-50"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </Button>
            <Button
              variant="ghost"
              className="text-white hover:bg-white/20"
            >
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>
        
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold">
                  ${(currentMonthTotal / 1000).toFixed(1)}k
                </div>
                <div className="text-sm text-green-100">Current Month</div>
              </div>
              <div className={cn(
                "flex items-center text-sm",
                monthlyTrend > 0 ? "text-red-300" : "text-green-300"
              )}>
                {monthlyTrend > 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                {Math.abs(monthlyTrend).toFixed(1)}%
              </div>
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold">
                  ${(totalBudget / 1000).toFixed(1)}k
                </div>
                <div className="text-sm text-green-100">Monthly Budget</div>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={budgetUtilization} className="w-16 h-2" />
                <span className="text-sm">{budgetUtilization.toFixed(0)}%</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <div className="flex items-center">
              <AlertTriangle className="w-6 h-6 mr-3 text-yellow-300" />
              <div>
                <div className="text-3xl font-bold">{anomalies.filter(a => !a.resolved).length}</div>
                <div className="text-sm text-green-100">Active Anomalies</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <div className="flex items-center">
              <TrendingDown className="w-6 h-6 mr-3 text-green-300" />
              <div>
                <div className="text-3xl font-bold">
                  ${(potentialSavings / 1000).toFixed(1)}k
                </div>
                <div className="text-sm text-green-100">Potential Savings</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Time Range */}
              <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Time range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="1y">Last year</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Provider Filter */}
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Providers</SelectItem>
                  <SelectItem value="aws">AWS</SelectItem>
                  <SelectItem value="gcp">Google Cloud</SelectItem>
                  <SelectItem value="azure">Azure</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Team Filter */}
              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  <SelectItem value="platform">Platform</SelectItem>
                  <SelectItem value="data">Data</SelectItem>
                  <SelectItem value="backend">Backend</SelectItem>
                  <SelectItem value="frontend">Frontend</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={showForecast}
                  onCheckedChange={setShowForecast}
                />
                <Label className="text-sm">Show Forecast</Label>
              </div>
              
              <div className="flex items-center gap-2">
                <Switch
                  checked={showAnomalies}
                  onCheckedChange={setShowAnomalies}
                />
                <Label className="text-sm">Show Anomalies</Label>
              </div>
              
              <Button variant="outline" size="icon">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="allocation">Allocation</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Anomaly Alerts */}
          {showAnomalies && anomalies.filter(a => !a.resolved).length > 0 && (
            <div className="space-y-2">
              {anomalies.filter(a => !a.resolved).map(anomaly => (
                <Alert
                  key={anomaly.id}
                  variant={anomaly.severity === 'critical' || anomaly.severity === 'high' ? 'destructive' : 'default'}
                >
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{anomaly.service}</AlertTitle>
                  <AlertDescription className="flex items-center justify-between">
                    <div>
                      {anomaly.description} - ${anomaly.amount.toFixed(0)} ({anomaly.percentage}% increase)
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        anomaly.severity === 'critical' ? 'destructive' :
                        anomaly.severity === 'high' ? 'destructive' :
                        anomaly.severity === 'medium' ? 'secondary' : 'outline'
                      }>
                        {anomaly.severity}
                      </Badge>
                      <Button size="sm" variant="outline">Investigate</Button>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          {/* Cost Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Cost Trend</CardTitle>
              <CardDescription>
                Cloud spending over time with breakdown by category
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                <LineChart className="h-8 w-8 mr-2" />
                Cost trend chart would be rendered here
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Cost by Category */}
            <Card>
              <CardHeader>
                <CardTitle>Cost by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4" />
                      <span>Compute</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">${(currentMonthTotal * 0.4 / 1000).toFixed(1)}k</span>
                      <div className="w-24">
                        <Progress value={40} className="h-2" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-4 w-4" />
                      <span>Storage</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">${(currentMonthTotal * 0.25 / 1000).toFixed(1)}k</span>
                      <div className="w-24">
                        <Progress value={25} className="h-2" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Network className="h-4 w-4" />
                      <span>Network</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">${(currentMonthTotal * 0.2 / 1000).toFixed(1)}k</span>
                      <div className="w-24">
                        <Progress value={20} className="h-2" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      <span>Database</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">${(currentMonthTotal * 0.1 / 1000).toFixed(1)}k</span>
                      <div className="w-24">
                        <Progress value={10} className="h-2" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      <span>Other</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">${(currentMonthTotal * 0.05 / 1000).toFixed(1)}k</span>
                      <div className="w-24">
                        <Progress value={5} className="h-2" />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Spending Services */}
            <Card>
              <CardHeader>
                <CardTitle>Top Spending Services</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {serviceCosts.slice(0, 5).map(service => (
                    <div key={service.id} className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{service.name}</div>
                        <div className="text-sm text-muted-foreground">{service.owner}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">${(service.currentMonth / 1000).toFixed(1)}k</div>
                        <div className={cn(
                          "text-sm flex items-center justify-end",
                          service.trend > 0 ? "text-red-600" : "text-green-600"
                        )}>
                          {service.trend > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {Math.abs(service.trend).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Service Cost Details</CardTitle>
              <CardDescription>
                Detailed breakdown of costs by service
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead className="text-right">Current Month</TableHead>
                    <TableHead className="text-right">Last Month</TableHead>
                    <TableHead className="text-right">Trend</TableHead>
                    <TableHead className="text-right">Budget</TableHead>
                    <TableHead>Utilization</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {serviceCosts.map(service => (
                    <TableRow key={service.id}>
                      <TableCell className="font-medium">{service.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{service.category}</Badge>
                      </TableCell>
                      <TableCell>{service.owner}</TableCell>
                      <TableCell className="text-right">${service.currentMonth.toLocaleString()}</TableCell>
                      <TableCell className="text-right">${service.lastMonth.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <div className={cn(
                          "flex items-center justify-end",
                          service.trend > 0 ? "text-red-600" : "text-green-600"
                        )}>
                          {service.trend > 0 ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                          {Math.abs(service.trend).toFixed(1)}%
                        </div>
                      </TableCell>
                      <TableCell className="text-right">${service.budget.toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={service.utilization} className="w-16 h-2" />
                          <span className="text-sm">{service.utilization}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="allocation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cost Allocation by Team</CardTitle>
              <CardDescription>
                How costs are distributed across teams and departments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Current Month</TableHead>
                    <TableHead className="text-right">Last Month</TableHead>
                    <TableHead className="text-right">Budget</TableHead>
                    <TableHead>Budget Usage</TableHead>
                    <TableHead className="text-right">Projects</TableHead>
                    <TableHead>Services</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocations.map(allocation => (
                    <TableRow key={allocation.team}>
                      <TableCell className="font-medium">{allocation.team}</TableCell>
                      <TableCell>{allocation.department}</TableCell>
                      <TableCell className="text-right">${allocation.currentMonth.toLocaleString()}</TableCell>
                      <TableCell className="text-right">${allocation.lastMonth.toLocaleString()}</TableCell>
                      <TableCell className="text-right">${allocation.budget.toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={(allocation.currentMonth / allocation.budget) * 100} 
                            className="w-20 h-2" 
                          />
                          <span className="text-sm">
                            {((allocation.currentMonth / allocation.budget) * 100).toFixed(0)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{allocation.projects}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {allocation.services.slice(0, 3).map(service => (
                            <Badge key={service} variant="secondary" className="text-xs">
                              {service}
                            </Badge>
                          ))}
                          {allocation.services.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{allocation.services.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="optimization" className="space-y-4">
          {/* Savings Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Opportunities</p>
                    <p className="text-2xl font-bold">{opportunities.length}</p>
                  </div>
                  <Target className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Potential Monthly Savings</p>
                    <p className="text-2xl font-bold text-green-600">
                      ${(potentialSavings / 1000).toFixed(1)}k
                    </p>
                  </div>
                  <TrendingDown className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Average Savings</p>
                    <p className="text-2xl font-bold">
                      {(potentialSavings / currentMonthTotal * 100).toFixed(0)}%
                    </p>
                  </div>
                  <Calculator className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Optimization Opportunities */}
          <Card>
            <CardHeader>
              <CardTitle>Optimization Opportunities</CardTitle>
              <CardDescription>
                Identified cost savings opportunities ranked by impact
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {opportunities.map(opportunity => (
                <div key={opportunity.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{opportunity.service}</h4>
                        <Badge variant="outline">
                          {opportunity.type.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {opportunity.description}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">
                        ${(opportunity.estimatedSavings / 1000).toFixed(1)}k
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {opportunity.savingsPercentage}% savings
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Effort:</span>
                      <Badge variant={
                        opportunity.effort === 'low' ? 'default' :
                        opportunity.effort === 'medium' ? 'secondary' : 'destructive'
                      }>
                        {opportunity.effort}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Impact:</span>
                      <Badge variant={
                        opportunity.impact === 'high' ? 'default' :
                        opportunity.impact === 'medium' ? 'secondary' : 'outline'
                      }>
                        {opportunity.impact}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Current:</span>
                      <span className="text-sm font-medium">
                        ${(opportunity.currentCost / 1000).toFixed(1)}k/mo
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-1 mb-3">
                    <p className="text-sm font-medium">Recommended Actions:</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {opportunity.actions.map((action, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle className="h-3 w-3 mt-0.5 text-green-600" />
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button size="sm">
                      Implement
                    </Button>
                    <Button size="sm" variant="outline">
                      Schedule
                    </Button>
                    <Button size="sm" variant="ghost">
                      Learn More
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cost Reports</CardTitle>
              <CardDescription>
                Generate and schedule cost reports
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        <h4 className="font-medium">Monthly Cost Report</h4>
                      </div>
                      <Badge>Scheduled</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Comprehensive monthly cost analysis with trends and recommendations
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                      <Button size="sm" variant="ghost">
                        <Mail className="h-4 w-4 mr-2" />
                        Email
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Receipt className="h-5 w-5" />
                        <h4 className="font-medium">Budget vs Actual</h4>
                      </div>
                      <Badge variant="outline">On-demand</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Compare actual spending against budgeted amounts by team and service
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Generate
                      </Button>
                      <Button size="sm" variant="ghost">
                        <Calendar className="h-4 w-4 mr-2" />
                        Schedule
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        <h4 className="font-medium">Optimization Report</h4>
                      </div>
                      <Badge variant="secondary">Weekly</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Weekly report on cost optimization opportunities and savings achieved
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                      <Button size="sm" variant="ghost">
                        <Settings className="h-4 w-4 mr-2" />
                        Configure
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        <h4 className="font-medium">Invoice Breakdown</h4>
                      </div>
                      <Badge variant="outline">Monthly</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Detailed breakdown of cloud provider invoices with allocation
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                      <Button size="sm" variant="ghost">
                        <Bell className="h-4 w-4 mr-2" />
                        Notify
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}