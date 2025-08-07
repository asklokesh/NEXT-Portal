export { GrafanaIntegration, createGrafanaClient } from './grafana-integration';
export { EnhancedMetricsCollector, getMetricsCollector } from './metrics-collector';
export { AlertManager } from './alert-manager';
export { DASHBOARD_TEMPLATES, substituteDashboardVariables, createServiceDashboard, createServiceDashboardSuite } from './dashboard-templates';

export type {
  GrafanaDashboard,
  GrafanaDataSource,
  AlertRule,
  AlertCondition,
  AlertInstance,
  NotificationChannel
} from './grafana-integration';

export type {
  MetricsCollectorConfig
} from './metrics-collector';

// Re-export commonly used types
export type {
  AlertRule as AlertManagerRule,
  AlertCondition as AlertManagerCondition,
  AlertInstance as AlertManagerInstance,
  NotificationChannel as AlertManagerChannel
} from './alert-manager';