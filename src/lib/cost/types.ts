export enum CostDataType {
 DAILY = 'daily',
 MONTHLY = 'monthly',
 SERVICE = 'service',
 RESOURCE = 'resource',
 TAG = 'tag',
 ACCOUNT = 'account',
 PROJECT = 'project',
 RESOURCE_GROUP = 'resource_group',
}

export interface CostData {
 date: Date;
 cost: number;
 currency: string;
 type: CostDataType;
 provider: 'aws' | 'azure' | 'gcp';
 service?: string;
 resourceId?: string;
 accountId?: string;
 projectId?: string;
 resourceGroup?: string;
 tags?: Record<string, string>;
 usage?: number;
 usageUnit?: string;
}

export interface CostForecast {
 totalAmount: number;
 currency: string;
 forecasts: Array<{
 date: Date;
 amount: number;
 confidenceLowerBound?: number;
 confidenceUpperBound?: number;
 }>;
}

export interface CostRecommendation {
 id?: string;
 type: string;
 description: string;
 resourceType?: string;
 resource?: string;
 currentCost?: number;
 recommendedCost?: number;
 savingsAmount: number;
 savingsPercentage?: number;
 savingsCurrency?: string;
 priority?: 'high' | 'medium' | 'low';
 actions?: string[];
}

export interface Budget {
 id?: string;
 name: string;
 amount: number;
 spent: number;
 currency: string;
 percentage: number;
 timeGrain: string;
 startDate?: Date;
 endDate?: Date;
 notifications?: Array<{
 threshold: number;
 type: string;
 enabled: boolean;
 contactEmails?: string[];
 }>;
}

export interface CostAlert {
 id: string;
 type: 'threshold' | 'anomaly' | 'forecast';
 severity: 'info' | 'warning' | 'critical';
 message: string;
 details: Record<string, any>;
 timestamp: Date;
 resolved: boolean;
}