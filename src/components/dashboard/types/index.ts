/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */

import type { ReactNode } from 'react';

// Dashboard types
export interface Dashboard {
 id: string;
 name: string;
 description?: string;
 owner: string;
 type: 'personal' | 'team' | 'platform';
 layout: DashboardLayout;
 widgets: Widget[];
 filters?: DashboardFilter[];
 refreshInterval?: number;
 createdAt: string;
 updatedAt: string;
 isPublic?: boolean;
 tags?: string[];
}

export interface DashboardLayout {
 type: 'grid' | 'freeform';
 columns: number;
 rowHeight: number;
 margin: [number, number];
 containerPadding: [number, number];
 layouts: {
 [breakpoint: string]: LayoutItem[];
 };
}

export interface LayoutItem {
 i: string; // widget id
 x: number;
 y: number;
 w: number;
 h: number;
 minW?: number;
 minH?: number;
 maxW?: number;
 maxH?: number;
 static?: boolean;
}

// Widget types
export interface Widget {
 id: string;
 type: WidgetType;
 title: string;
 config: WidgetConfig;
 dataSource?: DataSource;
 refreshInterval?: number;
 alerts?: AlertRule[];
}

export type WidgetType = 
 | 'metric'
 | 'chart'
 | 'serviceHealth'
 | 'deployment'
 | 'custom'
 | 'table'
 | 'heatmap'
 | 'gauge'
 | 'timeline'
 | 'log'
 | 'markdown';

export interface WidgetConfig {
 visualization?: VisualizationConfig;
 thresholds?: ThresholdConfig[];
 display?: DisplayConfig;
 filters?: WidgetFilter[];
 customConfig?: Record<string, any>;
}

export interface VisualizationConfig {
 type: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'radar' | 'gauge' | 'heatmap';
 xAxis?: AxisConfig;
 yAxis?: AxisConfig;
 series?: SeriesConfig[];
 legend?: LegendConfig;
 colors?: string[];
 stacked?: boolean;
 smooth?: boolean;
}

export interface AxisConfig {
 label?: string;
 type?: 'value' | 'category' | 'time' | 'log';
 min?: number;
 max?: number;
 format?: string;
}

export interface SeriesConfig {
 name: string;
 dataKey: string;
 type?: string;
 color?: string;
 yAxisIndex?: number;
}

export interface LegendConfig {
 show: boolean;
 position: 'top' | 'bottom' | 'left' | 'right';
}

export interface DisplayConfig {
 format?: string;
 unit?: string;
 decimals?: number;
 sparkline?: boolean;
 comparison?: 'previous' | 'average' | 'target';
 comparisonValue?: number;
}

export interface ThresholdConfig {
 value: number;
 color: string;
 label?: string;
 operator: '>' | '<' | '>=' | '<=' | '=' | '!=';
}

// Data source types
export interface DataSource {
 type: 'prometheus' | 'elasticsearch' | 'custom' | 'mock';
 query: string | QueryConfig;
 variables?: Record<string, any>;
 transform?: DataTransform[];
}

export interface QueryConfig {
 metric?: string;
 aggregation?: string;
 groupBy?: string[];
 filters?: QueryFilter[];
 timeRange?: TimeRange;
}

export interface QueryFilter {
 field: string;
 operator: string;
 value: any;
}

export interface TimeRange {
 from: string | Date;
 to: string | Date;
 relative?: string; // e.g., 'last-1h', 'last-24h'
}

export interface DataTransform {
 type: 'filter' | 'map' | 'reduce' | 'aggregate' | 'calculate';
 config: Record<string, any>;
}

// Real-time data types
export interface MetricData {
 timestamp: number;
 value: number | string;
 labels?: Record<string, string>;
}

export interface TimeSeriesData {
 name: string;
 data: Array<{
 timestamp: number;
 value: number;
 }>;
}

export interface ServiceHealthData {
 serviceId: string;
 status: 'healthy' | 'degraded' | 'down';
 uptime: number;
 responseTime: number;
 errorRate: number;
 lastChecked: Date;
}

export interface DeploymentData {
 id: string;
 service: string;
 version: string;
 environment: string;
 status: 'pending' | 'in_progress' | 'success' | 'failed' | 'rolled_back';
 startTime: Date;
 endTime?: Date;
 deployer: string;
 commits: number;
}

// Alert types
export interface AlertRule {
 id: string;
 name: string;
 condition: AlertCondition;
 severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
 actions: AlertAction[];
 enabled: boolean;
 cooldown?: number; // seconds
 annotations?: Record<string, string>;
}

export interface AlertCondition {
 type: 'threshold' | 'absence' | 'anomaly';
 metric: string;
 operator: '>' | '<' | '>=' | '<=' | '=' | '!=';
 value: number;
 duration?: number; // seconds
 aggregation?: 'avg' | 'min' | 'max' | 'sum' | 'count';
}

export interface AlertAction {
 type: 'email' | 'slack' | 'webhook' | 'pagerduty';
 config: Record<string, any>;
}

export interface Alert {
 id: string;
 ruleId: string;
 dashboardId: string;
 widgetId: string;
 status: 'firing' | 'resolved';
 severity: string;
 message: string;
 value: number;
 threshold: number;
 startTime: Date;
 endTime?: Date;
 annotations?: Record<string, string>;
}

// Filter types
export interface DashboardFilter {
 id: string;
 name: string;
 type: 'select' | 'multiselect' | 'daterange' | 'text';
 key: string;
 options?: FilterOption[];
 defaultValue?: any;
}

export interface FilterOption {
 label: string;
 value: string;
}

export interface WidgetFilter {
 key: string;
 value: any;
}

// Report types
export interface Report {
 id: string;
 name: string;
 dashboardId: string;
 schedule?: ReportSchedule;
 format: 'pdf' | 'csv' | 'excel' | 'json';
 recipients: string[];
 filters?: Record<string, any>;
 includeWidgets?: string[];
 createdAt: Date;
 lastRun?: Date;
}

export interface ReportSchedule {
 frequency: 'daily' | 'weekly' | 'monthly';
 time: string; // HH:mm
 dayOfWeek?: number; // 0-6
 dayOfMonth?: number; // 1-31
 timezone: string;
}

// Analytics types
export interface UsageMetrics {
 period: string;
 totalViews: number;
 uniqueUsers: number;
 avgSessionDuration: number;
 topWidgets: Array<{
 widgetId: string;
 views: number;
 }>;
 userEngagement: Array<{
 date: string;
 activeUsers: number;
 }>;
}

export interface PerformanceMetrics {
 dashboardId: string;
 loadTime: number;
 widgetRenderTimes: Record<string, number>;
 dataFetchTime: number;
 totalRenderTime: number;
 timestamp: Date;
}

// WebSocket types
export interface WebSocketMessage {
 type: 'metric' | 'alert' | 'deployment' | 'health';
 action: 'update' | 'create' | 'delete';
 payload: any;
 timestamp: number;
}

export interface WebSocketSubscription {
 dashboardId: string;
 widgetIds?: string[];
 metrics?: string[];
 interval?: number;
}

// Widget component props
export interface BaseWidgetProps {
 widget: Widget;
 data?: any;
 loading?: boolean;
 error?: Error | null;
 onConfig?: () => void;
 onRefresh?: () => void;
 onRemove?: () => void;
 isEditing?: boolean;
}

// Dashboard context
export interface DashboardContextValue {
 dashboard: Dashboard | null;
 widgets: Widget[];
 filters: Record<string, any>;
 isEditing: boolean;
 selectedWidget: string | null;
 setDashboard: (dashboard: Dashboard) => void;
 updateWidget: (widgetId: string, updates: Partial<Widget>) => void;
 removeWidget: (widgetId: string) => void;
 addWidget: (widget: Widget) => void;
 setFilters: (filters: Record<string, any>) => void;
 setEditing: (editing: boolean) => void;
 selectWidget: (widgetId: string | null) => void;
}

// Hook return types
export interface UseDashboardDataReturn {
 data: Record<string, any>;
 loading: boolean;
 error: Error | null;
 refetch: () => void;
}

export interface UseWebSocketReturn {
 connected: boolean;
 subscribe: (subscription: WebSocketSubscription) => void;
 unsubscribe: (subscriptionId: string) => void;
 send: (message: any) => void;
}