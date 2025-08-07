import { GrafanaDashboard } from './grafana-integration';

// Pre-built dashboard templates for common monitoring scenarios
export const DASHBOARD_TEMPLATES = {
  SERVICE_OVERVIEW: {
    title: 'Service Overview - {{service_name}}',
    tags: ['backstage', 'service', 'overview'],
    panels: [
      {
        id: 1,
        title: 'Service Health Status',
        type: 'stat',
        gridPos: { h: 6, w: 6, x: 0, y: 0 },
        targets: [
          {
            expr: 'up{service="{{service_name}}"}',
            refId: 'A'
          }
        ],
        fieldConfig: {
          defaults: {
            thresholds: {
              steps: [
                { color: 'red', value: 0 },
                { color: 'green', value: 1 }
              ]
            },
            mappings: [
              { options: { '0': { text: 'DOWN' } } },
              { options: { '1': { text: 'UP' } } }
            ]
          }
        }
      },
      {
        id: 2,
        title: 'Request Rate (req/s)',
        type: 'graph',
        gridPos: { h: 6, w: 12, x: 6, y: 0 },
        targets: [
          {
            expr: 'rate(http_requests_total{service="{{service_name}}"}[5m])',
            refId: 'A',
            legendFormat: '{{method}} {{status}}'
          }
        ],
        yAxes: [
          {
            label: 'Requests/sec',
            min: 0
          }
        ]
      },
      {
        id: 3,
        title: 'Error Rate',
        type: 'stat',
        gridPos: { h: 6, w: 6, x: 18, y: 0 },
        targets: [
          {
            expr: 'rate(http_requests_total{service="{{service_name}}",status=~"5.*"}[5m]) / rate(http_requests_total{service="{{service_name}}"}[5m]) * 100',
            refId: 'A'
          }
        ],
        fieldConfig: {
          defaults: {
            unit: 'percent',
            thresholds: {
              steps: [
                { color: 'green', value: 0 },
                { color: 'yellow', value: 1 },
                { color: 'red', value: 5 }
              ]
            }
          }
        }
      },
      {
        id: 4,
        title: 'Response Time (95th percentile)',
        type: 'graph',
        gridPos: { h: 6, w: 12, x: 0, y: 6 },
        targets: [
          {
            expr: 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{service="{{service_name}}"}[5m]))',
            refId: 'A',
            legendFormat: 'p95'
          },
          {
            expr: 'histogram_quantile(0.50, rate(http_request_duration_seconds_bucket{service="{{service_name}}"}[5m]))',
            refId: 'B',
            legendFormat: 'p50'
          }
        ],
        yAxes: [
          {
            label: 'Response Time (s)',
            min: 0
          }
        ]
      },
      {
        id: 5,
        title: 'Memory Usage',
        type: 'graph',
        gridPos: { h: 6, w: 12, x: 12, y: 6 },
        targets: [
          {
            expr: 'process_resident_memory_bytes{service="{{service_name}}"}',
            refId: 'A',
            legendFormat: 'RSS Memory'
          }
        ],
        yAxes: [
          {
            label: 'Memory (bytes)',
            min: 0
          }
        ]
      }
    ]
  },

  INFRASTRUCTURE_OVERVIEW: {
    title: 'Infrastructure Overview',
    tags: ['backstage', 'infrastructure', 'overview'],
    panels: [
      {
        id: 1,
        title: 'CPU Usage by Node',
        type: 'graph',
        gridPos: { h: 8, w: 12, x: 0, y: 0 },
        targets: [
          {
            expr: '100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) by (instance) * 100)',
            refId: 'A',
            legendFormat: '{{instance}}'
          }
        ],
        yAxes: [
          {
            label: 'CPU Usage (%)',
            max: 100,
            min: 0
          }
        ]
      },
      {
        id: 2,
        title: 'Memory Usage by Node',
        type: 'graph',
        gridPos: { h: 8, w: 12, x: 12, y: 0 },
        targets: [
          {
            expr: '(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100',
            refId: 'A',
            legendFormat: '{{instance}}'
          }
        ],
        yAxes: [
          {
            label: 'Memory Usage (%)',
            max: 100,
            min: 0
          }
        ]
      },
      {
        id: 3,
        title: 'Disk I/O',
        type: 'graph',
        gridPos: { h: 8, w: 12, x: 0, y: 8 },
        targets: [
          {
            expr: 'rate(node_disk_read_bytes_total[5m])',
            refId: 'A',
            legendFormat: '{{instance}} - Read'
          },
          {
            expr: 'rate(node_disk_written_bytes_total[5m])',
            refId: 'B',
            legendFormat: '{{instance}} - Write'
          }
        ],
        yAxes: [
          {
            label: 'Bytes/sec',
            min: 0
          }
        ]
      },
      {
        id: 4,
        title: 'Network I/O',
        type: 'graph',
        gridPos: { h: 8, w: 12, x: 12, y: 8 },
        targets: [
          {
            expr: 'rate(node_network_receive_bytes_total{device!="lo"}[5m])',
            refId: 'A',
            legendFormat: '{{instance}} {{device}} - RX'
          },
          {
            expr: 'rate(node_network_transmit_bytes_total{device!="lo"}[5m])',
            refId: 'B',
            legendFormat: '{{instance}} {{device}} - TX'
          }
        ],
        yAxes: [
          {
            label: 'Bytes/sec',
            min: 0
          }
        ]
      }
    ]
  },

  KUBERNETES_OVERVIEW: {
    title: 'Kubernetes Cluster Overview',
    tags: ['backstage', 'kubernetes', 'cluster'],
    panels: [
      {
        id: 1,
        title: 'Cluster Nodes Status',
        type: 'stat',
        gridPos: { h: 4, w: 6, x: 0, y: 0 },
        targets: [
          {
            expr: 'count(up{job="kubernetes-nodes"} == 1)',
            refId: 'A'
          }
        ],
        fieldConfig: {
          defaults: {
            title: 'Healthy Nodes'
          }
        }
      },
      {
        id: 2,
        title: 'Total Pods',
        type: 'stat',
        gridPos: { h: 4, w: 6, x: 6, y: 0 },
        targets: [
          {
            expr: 'count(kube_pod_info)',
            refId: 'A'
          }
        ]
      },
      {
        id: 3,
        title: 'Failed Pods',
        type: 'stat',
        gridPos: { h: 4, w: 6, x: 12, y: 0 },
        targets: [
          {
            expr: 'count(kube_pod_status_phase{phase="Failed"})',
            refId: 'A'
          }
        ],
        fieldConfig: {
          defaults: {
            thresholds: {
              steps: [
                { color: 'green', value: 0 },
                { color: 'red', value: 1 }
              ]
            }
          }
        }
      },
      {
        id: 4,
        title: 'Namespace Resource Usage',
        type: 'table',
        gridPos: { h: 8, w: 24, x: 0, y: 4 },
        targets: [
          {
            expr: 'sum(rate(container_cpu_usage_seconds_total{container!="POD",container!=""}[5m])) by (namespace)',
            refId: 'A',
            format: 'table',
            legendFormat: 'CPU Usage'
          },
          {
            expr: 'sum(container_memory_usage_bytes{container!="POD",container!=""}) by (namespace)',
            refId: 'B',
            format: 'table',
            legendFormat: 'Memory Usage'
          }
        ]
      },
      {
        id: 5,
        title: 'Pod Restarts by Namespace',
        type: 'graph',
        gridPos: { h: 8, w: 12, x: 0, y: 12 },
        targets: [
          {
            expr: 'sum(increase(kube_pod_container_status_restarts_total[1h])) by (namespace)',
            refId: 'A',
            legendFormat: '{{namespace}}'
          }
        ],
        yAxes: [
          {
            label: 'Restarts per hour',
            min: 0
          }
        ]
      },
      {
        id: 6,
        title: 'Ingress Request Rate',
        type: 'graph',
        gridPos: { h: 8, w: 12, x: 12, y: 12 },
        targets: [
          {
            expr: 'sum(rate(nginx_ingress_controller_requests[5m])) by (ingress)',
            refId: 'A',
            legendFormat: '{{ingress}}'
          }
        ],
        yAxes: [
          {
            label: 'Requests/sec',
            min: 0
          }
        ]
      }
    ]
  },

  APPLICATION_PERFORMANCE: {
    title: 'Application Performance - {{service_name}}',
    tags: ['backstage', 'application', 'performance'],
    panels: [
      {
        id: 1,
        title: 'Throughput (Requests/sec)',
        type: 'graph',
        gridPos: { h: 6, w: 8, x: 0, y: 0 },
        targets: [
          {
            expr: 'sum(rate(http_requests_total{service="{{service_name}}"}[5m]))',
            refId: 'A',
            legendFormat: 'Total RPS'
          }
        ]
      },
      {
        id: 2,
        title: 'Response Time Distribution',
        type: 'heatmap',
        gridPos: { h: 6, w: 8, x: 8, y: 0 },
        targets: [
          {
            expr: 'sum(rate(http_request_duration_seconds_bucket{service="{{service_name}}"}[5m])) by (le)',
            refId: 'A',
            format: 'heatmap',
            legendFormat: '{{le}}'
          }
        ]
      },
      {
        id: 3,
        title: 'Apdex Score',
        type: 'stat',
        gridPos: { h: 6, w: 8, x: 16, y: 0 },
        targets: [
          {
            expr: '(sum(rate(http_request_duration_seconds_bucket{service="{{service_name}}",le="0.5"}[5m])) + sum(rate(http_request_duration_seconds_bucket{service="{{service_name}}",le="2.0"}[5m])) / 2) / sum(rate(http_requests_total{service="{{service_name}}"}[5m]))',
            refId: 'A'
          }
        ],
        fieldConfig: {
          defaults: {
            min: 0,
            max: 1,
            thresholds: {
              steps: [
                { color: 'red', value: 0 },
                { color: 'yellow', value: 0.7 },
                { color: 'green', value: 0.9 }
              ]
            }
          }
        }
      },
      {
        id: 4,
        title: 'Database Connection Pool',
        type: 'graph',
        gridPos: { h: 6, w: 12, x: 0, y: 6 },
        targets: [
          {
            expr: 'db_connections_active{service="{{service_name}}"}',
            refId: 'A',
            legendFormat: 'Active Connections'
          },
          {
            expr: 'db_connections_idle{service="{{service_name}}"}',
            refId: 'B',
            legendFormat: 'Idle Connections'
          }
        ]
      },
      {
        id: 5,
        title: 'Cache Hit Rate',
        type: 'stat',
        gridPos: { h: 6, w: 12, x: 12, y: 6 },
        targets: [
          {
            expr: 'rate(cache_hits{service="{{service_name}}"}[5m]) / (rate(cache_hits{service="{{service_name}}"}[5m]) + rate(cache_misses{service="{{service_name}}"}[5m])) * 100',
            refId: 'A'
          }
        ],
        fieldConfig: {
          defaults: {
            unit: 'percent',
            thresholds: {
              steps: [
                { color: 'red', value: 0 },
                { color: 'yellow', value: 70 },
                { color: 'green', value: 90 }
              ]
            }
          }
        }
      }
    ]
  },

  BUSINESS_METRICS: {
    title: 'Business Metrics Dashboard',
    tags: ['backstage', 'business', 'kpi'],
    panels: [
      {
        id: 1,
        title: 'Daily Active Users',
        type: 'stat',
        gridPos: { h: 4, w: 6, x: 0, y: 0 },
        targets: [
          {
            expr: 'count(count by (user_id) (user_activity_total{time_range="1d"}))',
            refId: 'A'
          }
        ]
      },
      {
        id: 2,
        title: 'Service Deployments Today',
        type: 'stat',
        gridPos: { h: 4, w: 6, x: 6, y: 0 },
        targets: [
          {
            expr: 'count(deployment_events{time_range="1d"})',
            refId: 'A'
          }
        ]
      },
      {
        id: 3,
        title: 'API Calls (Last 24h)',
        type: 'stat',
        gridPos: { h: 4, w: 6, x: 12, y: 0 },
        targets: [
          {
            expr: 'sum(increase(api_requests_total[24h]))',
            refId: 'A'
          }
        ]
      },
      {
        id: 4,
        title: 'Template Usage',
        type: 'piechart',
        gridPos: { h: 8, w: 12, x: 0, y: 4 },
        targets: [
          {
            expr: 'sum by (template_name) (template_usage_total)',
            refId: 'A',
            legendFormat: '{{template_name}}'
          }
        ]
      },
      {
        id: 5,
        title: 'Developer Productivity Metrics',
        type: 'table',
        gridPos: { h: 8, w: 12, x: 12, y: 4 },
        targets: [
          {
            expr: 'avg_over_time(deployment_frequency[7d])',
            refId: 'A',
            format: 'table',
            legendFormat: 'Deployment Frequency'
          },
          {
            expr: 'avg_over_time(lead_time_for_changes[7d])',
            refId: 'B',
            format: 'table',
            legendFormat: 'Lead Time'
          },
          {
            expr: 'avg_over_time(mean_time_to_recovery[7d])',
            refId: 'C',
            format: 'table',
            legendFormat: 'MTTR'
          }
        ]
      }
    ]
  }
};

// Template variable substitution function
export function substituteDashboardVariables(
  template: any,
  variables: Record<string, string>
): GrafanaDashboard {
  const jsonString = JSON.stringify(template);
  const substituted = Object.entries(variables).reduce(
    (str, [key, value]) => str.replace(new RegExp(`{{${key}}}`, 'g'), value),
    jsonString
  );
  return JSON.parse(substituted);
}

// Utility function to create service-specific dashboard
export function createServiceDashboard(
  serviceName: string,
  templateKey: keyof typeof DASHBOARD_TEMPLATES = 'SERVICE_OVERVIEW'
): GrafanaDashboard {
  const template = DASHBOARD_TEMPLATES[templateKey];
  return substituteDashboardVariables(template, {
    service_name: serviceName
  });
}

// Create multiple dashboards for a service
export function createServiceDashboardSuite(serviceName: string): {
  overview: GrafanaDashboard;
  performance: GrafanaDashboard;
} {
  return {
    overview: createServiceDashboard(serviceName, 'SERVICE_OVERVIEW'),
    performance: createServiceDashboard(serviceName, 'APPLICATION_PERFORMANCE')
  };
}

export default DASHBOARD_TEMPLATES;