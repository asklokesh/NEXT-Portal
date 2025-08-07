# Monitoring & Observability Guide

This guide covers the monitoring, health checks, and observability features of the Backstage IDP Wrapper.

## Table of Contents

- [Health Checks](#health-checks)
- [Metrics](#metrics)
- [Logging](#logging)
- [Error Tracking](#error-tracking)
- [Performance Monitoring](#performance-monitoring)
- [Alerting](#alerting)

## Health Checks

### Available Endpoints

#### 1. Comprehensive Health Check
```bash
GET /api/health
GET /api/health?verbose=true # Include detailed information
```

Returns overall system health including all service statuses:
```json
{
 "status": "ok", // ok | degraded | error
 "timestamp": "2024-01-01T00:00:00Z",
 "version": "1.0.0",
 "uptime": 3600,
 "services": {
 "database": {
 "status": "ok",
 "message": "PostgreSQL connection healthy",
 "responseTime": 5
 },
 "backstage": {
 "status": "ok",
 "message": "Backstage API accessible",
 "responseTime": 123
 },
 "cache": {
 "status": "degraded",
 "message": "Redis unavailable, using memory fallback"
 },
 "memory": {
 "status": "ok",
 "message": "Memory usage: 45%",
 "details": {
 "heapUsed": "450 MB",
 "heapTotal": "1024 MB"
 }
 }
 }
}
```

#### 2. Liveness Probe
```bash
GET /api/health/live
HEAD /api/health/live
```

Simple check to verify the application is running. Used by Kubernetes liveness probes.

#### 3. Readiness Probe
```bash
GET /api/health/ready
HEAD /api/health/ready
```

Checks if the application is ready to serve traffic. Returns 503 if critical dependencies are unavailable.

### Kubernetes Configuration

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
 name: backstage-idp-wrapper
spec:
 template:
 spec:
 containers:
 - name: app
 livenessProbe:
 httpGet:
 path: /api/health/live
 port: 3000
 initialDelaySeconds: 30
 periodSeconds: 10
 timeoutSeconds: 5
 failureThreshold: 3
 readinessProbe:
 httpGet:
 path: /api/health/ready
 port: 3000
 initialDelaySeconds: 10
 periodSeconds: 5
 timeoutSeconds: 3
 failureThreshold: 3
```

## Metrics

### Prometheus Endpoint

```bash
GET /api/metrics
```

Exposes metrics in Prometheus format. Optionally protected by authentication:

```bash
# With authentication
curl -H "Authorization: Bearer ${METRICS_AUTH_TOKEN}" http://localhost:3000/api/metrics
```

### Available Metrics

#### HTTP Metrics
- `http_requests_total` - Total HTTP requests (labels: method, route, status_code)
- `http_request_duration_seconds` - Request duration histogram

#### Business Metrics
- `catalog_entities_total` - Number of catalog entities (labels: kind, namespace)
- `template_executions_total` - Template execution counter (labels: template, status)
- `active_users_total` - Number of active users

#### Performance Metrics
- `page_load_duration_seconds` - Page load times (labels: page)
- `cache_hits_total` - Cache hit counter (labels: cache_type)
- `cache_misses_total` - Cache miss counter (labels: cache_type)
- `db_query_duration_seconds` - Database query duration (labels: operation, table)

#### System Metrics
- `process_cpu_seconds_total` - CPU usage
- `process_resident_memory_bytes` - Memory usage
- `nodejs_heap_size_bytes` - Heap size metrics
- `nodejs_eventloop_lag_seconds` - Event loop lag

### Prometheus Configuration

```yaml
# prometheus.yml
global:
 scrape_interval: 15s

scrape_configs:
 - job_name: 'backstage-idp-wrapper'
 static_configs:
 - targets: ['localhost:3000']
 metrics_path: '/api/metrics'
 bearer_token: 'your-metrics-token'
```

### Grafana Dashboard

Import the provided dashboard JSON from `monitoring/grafana-dashboard.json` or create custom dashboards using these queries:

```promql
# Request rate
rate(http_requests_total[5m])

# P95 latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Error rate
rate(http_requests_total{status_code=~"5.."}[5m])

# Cache hit ratio
rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))
```

## Logging

### Log Levels

Set log level via environment variable:
```bash
LOG_LEVEL=debug # debug | info | warn | error
```

### Structured Logging

All logs are output as structured JSON:
```json
{
 "timestamp": "2024-01-01T00:00:00Z",
 "level": "info",
 "message": "Template execution completed",
 "context": {
 "templateId": "react-app",
 "executionId": "abc123",
 "duration": 5432,
 "userId": "user@example.com"
 }
}
```

### Log Aggregation

Configure log shipping to your preferred platform:

#### Datadog
```bash
DD_API_KEY=your-api-key
DD_SITE=datadoghq.com
DD_SERVICE=backstage-idp-wrapper
DD_ENV=production
```

#### ELK Stack
```bash
LOGSTASH_HOST=logstash.example.com
LOGSTASH_PORT=5044
```

## Error Tracking

### Sentry Integration

Error tracking is automatically configured when Sentry DSN is provided:

```bash
SENTRY_DSN=https://xxx@sentry.io/yyy
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=1.0.0
```

Features:
- Automatic error capture
- Performance monitoring
- Release tracking
- User context
- Custom breadcrumbs

### Error Types

Errors are categorized for better tracking:
- `ApplicationError` - Business logic errors
- `APIError` - External API failures
- `ValidationError` - Input validation failures

## Performance Monitoring

### Real User Monitoring (RUM)

Track actual user experience metrics:

```javascript
// Automatically tracked metrics:
- Page load time
- Time to interactive
- First contentful paint
- Largest contentful paint
- Cumulative layout shift
```

### Application Performance Monitoring (APM)

Monitor backend performance:
- Database query timing
- API call latency
- Cache performance
- Background job duration

### Performance Budgets

Configure performance budgets in `next.config.js`:
```javascript
{
 performance: {
 maxEntrypointSize: 512000,
 maxAssetSize: 256000
 }
}
```

## Alerting

### Alert Rules

Example Prometheus alerting rules:

```yaml
groups:
 - name: backstage-idp-wrapper
 rules:
 - alert: HighErrorRate
 expr: rate(http_requests_total{status_code=~"5.."}[5m]) > 0.05
 for: 5m
 annotations:
 summary: "High error rate detected"
 
 - alert: HighMemoryUsage
 expr: process_resident_memory_bytes > 1e9
 for: 10m
 annotations:
 summary: "Memory usage exceeds 1GB"
 
 - alert: BackstageAPIDown
 expr: up{job="backstage-api"} == 0
 for: 2m
 annotations:
 summary: "Backstage API is down"
```

### Notification Channels

Configure alert notifications:

1. **Slack**
 ```bash
 SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx
 ```

2. **PagerDuty**
 ```bash
 PAGERDUTY_INTEGRATION_KEY=xxx
 ```

3. **Email**
 ```bash
 SMTP_HOST=smtp.example.com
 SMTP_PORT=587
 ALERT_EMAIL=oncall@example.com
 ```

## Troubleshooting

### Debug Mode

Enable detailed debugging:
```bash
DEBUG=backstage-idp:*
LOG_LEVEL=debug
```

### Health Check Failures

1. **Database Connection Issues**
 ```bash
 # Check database connectivity
 psql $DATABASE_URL -c "SELECT 1"
 
 # Verify connection string
 echo $DATABASE_URL
 ```

2. **Backstage API Issues**
 ```bash
 # Test Backstage API directly
 curl http://localhost:7007/api/catalog/entities
 
 # Check network connectivity
 nc -zv localhost 7007
 ```

3. **Memory Issues**
 ```bash
 # Increase memory limit
 NODE_OPTIONS="--max-old-space-size=4096"
 
 # Monitor memory usage
 node --trace-gc app.js
 ```

### Performance Issues

1. **Enable profiling**
 ```bash
 NODE_ENV=production
 NODE_OPTIONS="--prof"
 ```

2. **Analyze flame graphs**
 ```bash
 npm run profile
 ```

3. **Database query analysis**
 ```sql
 -- Enable query logging
 SET log_statement = 'all';
 SET log_duration = on;
 ```

## Best Practices

1. **Monitor Key Business Metrics**
 - Service creation rate
 - Template usage
 - User activity
 - Error rates by service

2. **Set Up Dashboards**
 - Executive dashboard (high-level KPIs)
 - Operations dashboard (system health)
 - Developer dashboard (detailed metrics)

3. **Configure Alerts Thoughtfully**
 - Alert on symptoms, not causes
 - Include runbooks in alert descriptions
 - Test alerts regularly

4. **Regular Health Checks**
 - Automated synthetic monitoring
 - Manual verification procedures
 - Disaster recovery testing

5. **Data Retention**
 - Metrics: 30 days high-resolution, 1 year aggregated
 - Logs: 7 days hot storage, 90 days cold storage
 - Traces: 7 days

## Integration Examples

### Datadog
```javascript
// datadog.yaml
init_config:
instances:
 - prometheus_url: http://localhost:3000/api/metrics
 namespace: "backstage_idp"
 metrics:
 - http_*
 - catalog_*
 - template_*
```

### New Relic
```javascript
// newrelic.js
exports.config = {
 app_name: ['backstage-idp-wrapper'],
 distributed_tracing: {
 enabled: true
 },
 logging: {
 level: 'info'
 }
}
```

### CloudWatch
```json
{
 "metrics": {
 "namespace": "BackstageIDP",
 "metrics_collected": {
 "prometheus": {
 "prometheus_config_path": "/api/metrics",
 "metrics_path": "/api/metrics"
 }
 }
 }
}