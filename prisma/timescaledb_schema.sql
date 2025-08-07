-- ============================================
-- TIMESCALEDB SCHEMA FOR PLUGIN METRICS
-- Time-Series Analytics and Monitoring
-- ============================================

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- ============================================
-- PLUGIN PERFORMANCE METRICS
-- ============================================

-- Plugin Performance Time-Series Table
CREATE TABLE IF NOT EXISTS plugin_performance_metrics (
    time TIMESTAMPTZ NOT NULL,
    plugin_id TEXT NOT NULL,
    tenant_id TEXT,
    environment TEXT NOT NULL DEFAULT 'production',
    version TEXT,
    
    -- Performance Metrics
    load_time_ms DOUBLE PRECISION,
    render_time_ms DOUBLE PRECISION,
    memory_usage_mb DOUBLE PRECISION,
    cpu_usage_percent DOUBLE PRECISION,
    network_latency_ms DOUBLE PRECISION,
    bundle_size_kb DOUBLE PRECISION,
    
    -- Error Metrics
    error_rate DOUBLE PRECISION,
    error_count INTEGER DEFAULT 0,
    
    -- Throughput Metrics
    requests_per_second DOUBLE PRECISION,
    concurrent_users INTEGER,
    
    -- Cache Metrics
    cache_hit_rate DOUBLE PRECISION,
    cache_miss_count INTEGER DEFAULT 0,
    
    -- Database Metrics
    db_query_time_ms DOUBLE PRECISION,
    db_connection_count INTEGER DEFAULT 0,
    
    -- Custom Metrics (JSON for flexibility)
    custom_metrics JSONB,
    
    -- Metadata
    user_agent TEXT,
    browser TEXT,
    platform TEXT,
    country TEXT,
    region TEXT,
    
    -- Tags for grouping
    tags JSONB DEFAULT '{}'::jsonb,
    
    PRIMARY KEY (time, plugin_id, environment)
);

-- Create hypertable for time-series optimization
SELECT create_hypertable('plugin_performance_metrics', 'time', 
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Add space partitioning for better query performance
SELECT add_dimension('plugin_performance_metrics', 'plugin_id', 
    number_partitions => 4,
    if_not_exists => TRUE
);

-- ============================================
-- PLUGIN USAGE ANALYTICS
-- ============================================

-- Plugin Usage Events Time-Series Table
CREATE TABLE IF NOT EXISTS plugin_usage_events (
    time TIMESTAMPTZ NOT NULL,
    plugin_id TEXT NOT NULL,
    tenant_id TEXT,
    user_id TEXT,
    session_id TEXT,
    
    -- Event Details
    event_type TEXT NOT NULL, -- 'view', 'install', 'configure', 'error', 'interaction'
    event_name TEXT,
    event_category TEXT,
    
    -- Context
    environment TEXT NOT NULL DEFAULT 'production',
    version TEXT,
    page_url TEXT,
    referrer TEXT,
    
    -- User Context
    user_agent TEXT,
    browser TEXT,
    browser_version TEXT,
    platform TEXT,
    screen_resolution TEXT,
    language TEXT,
    timezone TEXT,
    
    -- Geographic Data
    country TEXT,
    region TEXT,
    city TEXT,
    
    -- Performance Context
    load_time_ms DOUBLE PRECISION,
    interaction_time_ms DOUBLE PRECISION,
    
    -- Custom Event Data
    event_properties JSONB DEFAULT '{}'::jsonb,
    user_properties JSONB DEFAULT '{}'::jsonb,
    
    -- Feature Flags
    feature_flags JSONB DEFAULT '{}'::jsonb,
    
    PRIMARY KEY (time, plugin_id, user_id)
);

-- Create hypertable
SELECT create_hypertable('plugin_usage_events', 'time',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Add space partitioning
SELECT add_dimension('plugin_usage_events', 'plugin_id',
    number_partitions => 8,
    if_not_exists => TRUE
);

-- ============================================
-- RESOURCE UTILIZATION METRICS
-- ============================================

-- Resource Usage Time-Series Table
CREATE TABLE IF NOT EXISTS plugin_resource_usage (
    time TIMESTAMPTZ NOT NULL,
    plugin_id TEXT NOT NULL,
    tenant_id TEXT,
    environment TEXT NOT NULL DEFAULT 'production',
    instance_id TEXT,
    
    -- Compute Resources
    cpu_cores_used DOUBLE PRECISION,
    cpu_percent DOUBLE PRECISION,
    memory_mb_used DOUBLE PRECISION,
    memory_percent DOUBLE PRECISION,
    
    -- Storage Resources
    disk_space_mb_used DOUBLE PRECISION,
    disk_io_read_mb DOUBLE PRECISION,
    disk_io_write_mb DOUBLE PRECISION,
    
    -- Network Resources
    network_in_mb DOUBLE PRECISION,
    network_out_mb DOUBLE PRECISION,
    network_connections INTEGER DEFAULT 0,
    
    -- Application Resources
    active_sessions INTEGER DEFAULT 0,
    database_connections INTEGER DEFAULT 0,
    cache_size_mb DOUBLE PRECISION,
    
    -- Cost Metrics
    compute_cost_usd DOUBLE PRECISION,
    storage_cost_usd DOUBLE PRECISION,
    network_cost_usd DOUBLE PRECISION,
    total_cost_usd DOUBLE PRECISION,
    
    -- Metadata
    tags JSONB DEFAULT '{}'::jsonb,
    
    PRIMARY KEY (time, plugin_id, environment, instance_id)
);

-- Create hypertable
SELECT create_hypertable('plugin_resource_usage', 'time',
    chunk_time_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

-- Add space partitioning
SELECT add_dimension('plugin_resource_usage', 'plugin_id',
    number_partitions => 4,
    if_not_exists => TRUE
);

-- ============================================
-- ERROR AND ALERT METRICS
-- ============================================

-- Plugin Error Events Time-Series Table
CREATE TABLE IF NOT EXISTS plugin_error_events (
    time TIMESTAMPTZ NOT NULL,
    plugin_id TEXT NOT NULL,
    tenant_id TEXT,
    environment TEXT NOT NULL DEFAULT 'production',
    version TEXT,
    
    -- Error Details
    error_type TEXT NOT NULL,
    error_code TEXT,
    error_message TEXT,
    error_severity TEXT, -- 'low', 'medium', 'high', 'critical'
    error_category TEXT, -- 'frontend', 'backend', 'api', 'database'
    
    -- Context
    user_id TEXT,
    session_id TEXT,
    request_id TEXT,
    
    -- Technical Details
    stack_trace TEXT,
    source_file TEXT,
    line_number INTEGER,
    function_name TEXT,
    
    -- Environment Context
    user_agent TEXT,
    browser TEXT,
    platform TEXT,
    
    -- Impact Metrics
    affected_users INTEGER DEFAULT 1,
    duration_ms DOUBLE PRECISION,
    
    -- Resolution
    is_resolved BOOLEAN DEFAULT FALSE,
    resolution_time_ms DOUBLE PRECISION,
    resolver_id TEXT,
    
    -- Custom Data
    error_context JSONB DEFAULT '{}'::jsonb,
    
    PRIMARY KEY (time, plugin_id, error_type)
);

-- Create hypertable
SELECT create_hypertable('plugin_error_events', 'time',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- ============================================
-- BUSINESS METRICS AND KPIs
-- ============================================

-- Plugin Business Metrics Time-Series Table
CREATE TABLE IF NOT EXISTS plugin_business_metrics (
    time TIMESTAMPTZ NOT NULL,
    plugin_id TEXT NOT NULL,
    tenant_id TEXT,
    
    -- Adoption Metrics
    total_installations INTEGER DEFAULT 0,
    active_installations INTEGER DEFAULT 0,
    new_installations INTEGER DEFAULT 0,
    churned_installations INTEGER DEFAULT 0,
    
    -- Usage Metrics
    daily_active_users INTEGER DEFAULT 0,
    weekly_active_users INTEGER DEFAULT 0,
    monthly_active_users INTEGER DEFAULT 0,
    average_session_duration_ms DOUBLE PRECISION,
    
    -- Engagement Metrics
    feature_adoption_rate DOUBLE PRECISION,
    user_satisfaction_score DOUBLE PRECISION,
    support_ticket_count INTEGER DEFAULT 0,
    
    -- Revenue Metrics (for premium plugins)
    revenue_usd DOUBLE PRECISION DEFAULT 0,
    subscription_count INTEGER DEFAULT 0,
    conversion_rate DOUBLE PRECISION,
    
    -- Quality Metrics
    uptime_percent DOUBLE PRECISION,
    response_time_p95_ms DOUBLE PRECISION,
    error_rate_percent DOUBLE PRECISION,
    
    -- Custom Business Metrics
    custom_kpis JSONB DEFAULT '{}'::jsonb,
    
    PRIMARY KEY (time, plugin_id)
);

-- Create hypertable
SELECT create_hypertable('plugin_business_metrics', 'time',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- ============================================
-- SLA AND AVAILABILITY METRICS
-- ============================================

-- Plugin SLA Tracking Time-Series Table
CREATE TABLE IF NOT EXISTS plugin_sla_metrics (
    time TIMESTAMPTZ NOT NULL,
    plugin_id TEXT NOT NULL,
    tenant_id TEXT,
    environment TEXT NOT NULL DEFAULT 'production',
    
    -- Availability Metrics
    uptime_seconds DOUBLE PRECISION,
    downtime_seconds DOUBLE PRECISION,
    availability_percent DOUBLE PRECISION,
    
    -- Performance SLA
    response_time_ms DOUBLE PRECISION,
    response_time_p50_ms DOUBLE PRECISION,
    response_time_p95_ms DOUBLE PRECISION,
    response_time_p99_ms DOUBLE PRECISION,
    
    -- Reliability Metrics
    success_rate_percent DOUBLE PRECISION,
    error_rate_percent DOUBLE PRECISION,
    failure_count INTEGER DEFAULT 0,
    
    -- SLA Compliance
    sla_target_availability_percent DOUBLE PRECISION DEFAULT 99.9,
    sla_target_response_time_ms DOUBLE PRECISION DEFAULT 500,
    sla_compliance_status TEXT, -- 'compliant', 'at_risk', 'breached'
    
    -- Incident Tracking
    incident_count INTEGER DEFAULT 0,
    mttr_minutes DOUBLE PRECISION, -- Mean Time To Recovery
    mtbf_hours DOUBLE PRECISION,   -- Mean Time Between Failures
    
    -- Custom SLA Metrics
    custom_sla_metrics JSONB DEFAULT '{}'::jsonb,
    
    PRIMARY KEY (time, plugin_id, environment)
);

-- Create hypertable
SELECT create_hypertable('plugin_sla_metrics', 'time',
    chunk_time_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

-- ============================================
-- SECURITY METRICS
-- ============================================

-- Plugin Security Events Time-Series Table
CREATE TABLE IF NOT EXISTS plugin_security_events (
    time TIMESTAMPTZ NOT NULL,
    plugin_id TEXT NOT NULL,
    tenant_id TEXT,
    environment TEXT NOT NULL DEFAULT 'production',
    
    -- Event Details
    event_type TEXT NOT NULL, -- 'vulnerability', 'scan', 'compliance_check', 'access_denied'
    severity TEXT NOT NULL,   -- 'info', 'low', 'medium', 'high', 'critical'
    category TEXT,           -- 'authentication', 'authorization', 'data_leak', 'malware'
    
    -- Security Context
    user_id TEXT,
    ip_address INET,
    user_agent TEXT,
    location_country TEXT,
    location_region TEXT,
    
    -- Vulnerability Details
    cve_id TEXT,
    vulnerability_score DOUBLE PRECISION,
    vulnerability_vector TEXT,
    
    -- Compliance Details
    compliance_framework TEXT, -- 'SOC2', 'GDPR', 'HIPAA', 'PCI_DSS'
    compliance_status TEXT,    -- 'compliant', 'non_compliant', 'at_risk'
    
    -- Remediation
    is_remediated BOOLEAN DEFAULT FALSE,
    remediation_time_hours DOUBLE PRECISION,
    remediation_action TEXT,
    
    -- Event Details
    event_details JSONB DEFAULT '{}'::jsonb,
    
    PRIMARY KEY (time, plugin_id, event_type)
);

-- Create hypertable
SELECT create_hypertable('plugin_security_events', 'time',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- ============================================
-- CONTINUOUS AGGREGATION VIEWS
-- ============================================

-- Hourly Performance Aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS plugin_performance_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS hour,
    plugin_id,
    environment,
    COUNT(*) as sample_count,
    AVG(load_time_ms) as avg_load_time,
    percentile_agg(load_time_ms) as load_time_percentiles,
    AVG(memory_usage_mb) as avg_memory_usage,
    MAX(memory_usage_mb) as max_memory_usage,
    AVG(cpu_usage_percent) as avg_cpu_usage,
    AVG(error_rate) as avg_error_rate,
    SUM(error_count) as total_errors
FROM plugin_performance_metrics
GROUP BY hour, plugin_id, environment;

-- Daily Usage Aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS plugin_usage_daily
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', time) AS day,
    plugin_id,
    tenant_id,
    event_type,
    COUNT(*) as event_count,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT session_id) as unique_sessions,
    AVG(load_time_ms) as avg_load_time,
    COUNT(DISTINCT country) as country_diversity
FROM plugin_usage_events
GROUP BY day, plugin_id, tenant_id, event_type;

-- Hourly Resource Usage Aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS plugin_resource_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS hour,
    plugin_id,
    tenant_id,
    environment,
    AVG(cpu_percent) as avg_cpu_usage,
    MAX(cpu_percent) as max_cpu_usage,
    AVG(memory_percent) as avg_memory_usage,
    MAX(memory_percent) as max_memory_usage,
    SUM(total_cost_usd) as total_cost_usd
FROM plugin_resource_usage
GROUP BY hour, plugin_id, tenant_id, environment;

-- Daily Error Aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS plugin_errors_daily
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', time) AS day,
    plugin_id,
    environment,
    error_severity,
    COUNT(*) as error_count,
    COUNT(DISTINCT user_id) as affected_users,
    AVG(duration_ms) as avg_duration,
    COUNT(*) FILTER (WHERE is_resolved = true) as resolved_count,
    AVG(resolution_time_ms) FILTER (WHERE is_resolved = true) as avg_resolution_time
FROM plugin_error_events
GROUP BY day, plugin_id, environment, error_severity;

-- ============================================
-- RETENTION POLICIES
-- ============================================

-- Raw data retention (keep detailed data for 3 months)
SELECT add_retention_policy('plugin_performance_metrics', INTERVAL '90 days', if_not_exists => TRUE);
SELECT add_retention_policy('plugin_usage_events', INTERVAL '90 days', if_not_exists => TRUE);
SELECT add_retention_policy('plugin_resource_usage', INTERVAL '90 days', if_not_exists => TRUE);
SELECT add_retention_policy('plugin_error_events', INTERVAL '180 days', if_not_exists => TRUE);
SELECT add_retention_policy('plugin_security_events', INTERVAL '365 days', if_not_exists => TRUE);

-- Aggregated data retention (keep aggregated data for 2 years)
SELECT add_retention_policy('plugin_performance_hourly', INTERVAL '730 days', if_not_exists => TRUE);
SELECT add_retention_policy('plugin_usage_daily', INTERVAL '730 days', if_not_exists => TRUE);
SELECT add_retention_policy('plugin_resource_hourly', INTERVAL '730 days', if_not_exists => TRUE);
SELECT add_retention_policy('plugin_errors_daily', INTERVAL '730 days', if_not_exists => TRUE);

-- ============================================
-- COMPRESSION POLICIES
-- ============================================

-- Enable compression on older data to save space
SELECT add_compression_policy('plugin_performance_metrics', INTERVAL '7 days', if_not_exists => TRUE);
SELECT add_compression_policy('plugin_usage_events', INTERVAL '7 days', if_not_exists => TRUE);
SELECT add_compression_policy('plugin_resource_usage', INTERVAL '7 days', if_not_exists => TRUE);
SELECT add_compression_policy('plugin_error_events', INTERVAL '7 days', if_not_exists => TRUE);
SELECT add_compression_policy('plugin_security_events', INTERVAL '7 days', if_not_exists => TRUE);

-- ============================================
-- INDEXES FOR QUERY OPTIMIZATION
-- ============================================

-- Performance metrics indexes
CREATE INDEX IF NOT EXISTS idx_perf_plugin_time ON plugin_performance_metrics (plugin_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_perf_tenant_time ON plugin_performance_metrics (tenant_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_perf_environment ON plugin_performance_metrics (environment, time DESC);
CREATE INDEX IF NOT EXISTS idx_perf_tags ON plugin_performance_metrics USING gin (tags);

-- Usage events indexes
CREATE INDEX IF NOT EXISTS idx_usage_plugin_event ON plugin_usage_events (plugin_id, event_type, time DESC);
CREATE INDEX IF NOT EXISTS idx_usage_user_time ON plugin_usage_events (user_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_usage_session ON plugin_usage_events (session_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_usage_properties ON plugin_usage_events USING gin (event_properties);

-- Resource usage indexes
CREATE INDEX IF NOT EXISTS idx_resource_plugin_env ON plugin_resource_usage (plugin_id, environment, time DESC);
CREATE INDEX IF NOT EXISTS idx_resource_tenant_time ON plugin_resource_usage (tenant_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_resource_cost ON plugin_resource_usage (total_cost_usd, time DESC);

-- Error events indexes
CREATE INDEX IF NOT EXISTS idx_error_plugin_severity ON plugin_error_events (plugin_id, error_severity, time DESC);
CREATE INDEX IF NOT EXISTS idx_error_type_time ON plugin_error_events (error_type, time DESC);
CREATE INDEX IF NOT EXISTS idx_error_unresolved ON plugin_error_events (plugin_id, is_resolved, time DESC);

-- Security events indexes
CREATE INDEX IF NOT EXISTS idx_security_plugin_severity ON plugin_security_events (plugin_id, severity, time DESC);
CREATE INDEX IF NOT EXISTS idx_security_cve ON plugin_security_events (cve_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_security_compliance ON plugin_security_events (compliance_framework, compliance_status, time DESC);

-- ============================================
-- REAL-TIME ALERTING FUNCTIONS
-- ============================================

-- Function to check performance thresholds
CREATE OR REPLACE FUNCTION check_performance_alerts()
RETURNS void AS $$
DECLARE
    alert_record RECORD;
BEGIN
    -- Check for high load times in the last 5 minutes
    FOR alert_record IN
        SELECT 
            plugin_id,
            AVG(load_time_ms) as avg_load_time,
            COUNT(*) as sample_count
        FROM plugin_performance_metrics
        WHERE time >= NOW() - INTERVAL '5 minutes'
          AND load_time_ms > 5000  -- 5 second threshold
        GROUP BY plugin_id
        HAVING AVG(load_time_ms) > 5000 AND COUNT(*) > 10
    LOOP
        -- Insert alert (this would typically trigger external alerting)
        INSERT INTO plugin_alerts (plugin_id, alert_type, severity, title, message, current_value, created_at)
        VALUES (
            alert_record.plugin_id,
            'PERFORMANCE_ISSUE',
            'HIGH',
            'High Load Time Detected',
            format('Plugin %s has average load time of %.2f ms over %s samples', 
                   alert_record.plugin_id, alert_record.avg_load_time, alert_record.sample_count),
            alert_record.avg_load_time,
            NOW()
        )
        ON CONFLICT (plugin_id, alert_type) WHERE is_active = true 
        DO UPDATE SET 
            current_value = EXCLUDED.current_value,
            updated_at = NOW();
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate plugin health scores
CREATE OR REPLACE FUNCTION calculate_plugin_health_score(p_plugin_id TEXT, p_days INTEGER DEFAULT 7)
RETURNS DOUBLE PRECISION AS $$
DECLARE
    health_score DOUBLE PRECISION DEFAULT 100.0;
    error_rate DOUBLE PRECISION;
    avg_load_time DOUBLE PRECISION;
    availability DOUBLE PRECISION;
BEGIN
    -- Calculate error rate (last 7 days)
    SELECT COALESCE(AVG(error_rate), 0) INTO error_rate
    FROM plugin_performance_metrics
    WHERE plugin_id = p_plugin_id
      AND time >= NOW() - (p_days || ' days')::INTERVAL;
    
    -- Calculate average load time
    SELECT COALESCE(AVG(load_time_ms), 0) INTO avg_load_time
    FROM plugin_performance_metrics
    WHERE plugin_id = p_plugin_id
      AND time >= NOW() - (p_days || ' days')::INTERVAL;
    
    -- Calculate availability
    SELECT COALESCE(AVG(availability_percent), 100) INTO availability
    FROM plugin_sla_metrics
    WHERE plugin_id = p_plugin_id
      AND time >= NOW() - (p_days || ' days')::INTERVAL;
    
    -- Calculate composite health score
    health_score := health_score 
                   - (error_rate * 30)  -- Error rate impact
                   - GREATEST(0, (avg_load_time - 1000) / 100)  -- Load time penalty
                   - (100 - availability);  -- Availability impact
    
    RETURN GREATEST(0, LEAST(100, health_score));
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- UTILITY FUNCTIONS
-- ============================================

-- Function to get plugin performance summary
CREATE OR REPLACE FUNCTION get_plugin_performance_summary(
    p_plugin_id TEXT,
    p_start_time TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours',
    p_end_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    avg_load_time DOUBLE PRECISION,
    p95_load_time DOUBLE PRECISION,
    avg_memory_usage DOUBLE PRECISION,
    avg_cpu_usage DOUBLE PRECISION,
    total_errors INTEGER,
    error_rate DOUBLE PRECISION,
    unique_users BIGINT,
    total_requests BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        AVG(ppm.load_time_ms) as avg_load_time,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY ppm.load_time_ms) as p95_load_time,
        AVG(ppm.memory_usage_mb) as avg_memory_usage,
        AVG(ppm.cpu_usage_percent) as avg_cpu_usage,
        SUM(ppm.error_count)::INTEGER as total_errors,
        AVG(ppm.error_rate) as error_rate,
        COUNT(DISTINCT pue.user_id) as unique_users,
        COUNT(pue.*) as total_requests
    FROM plugin_performance_metrics ppm
    LEFT JOIN plugin_usage_events pue ON ppm.plugin_id = pue.plugin_id 
        AND pue.time BETWEEN p_start_time AND p_end_time
    WHERE ppm.plugin_id = p_plugin_id
      AND ppm.time BETWEEN p_start_time AND p_end_time;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh continuous aggregates
CREATE OR REPLACE FUNCTION refresh_plugin_aggregates()
RETURNS void AS $$
BEGIN
    CALL refresh_continuous_aggregate('plugin_performance_hourly', NULL, NULL);
    CALL refresh_continuous_aggregate('plugin_usage_daily', NULL, NULL);
    CALL refresh_continuous_aggregate('plugin_resource_hourly', NULL, NULL);
    CALL refresh_continuous_aggregate('plugin_errors_daily', NULL, NULL);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- MONITORING AND MAINTENANCE
-- ============================================

-- Create a maintenance function to run daily
CREATE OR REPLACE FUNCTION daily_timescale_maintenance()
RETURNS void AS $$
BEGIN
    -- Update table statistics
    ANALYZE plugin_performance_metrics;
    ANALYZE plugin_usage_events;
    ANALYZE plugin_resource_usage;
    ANALYZE plugin_error_events;
    ANALYZE plugin_security_events;
    
    -- Refresh continuous aggregates
    PERFORM refresh_plugin_aggregates();
    
    -- Check and alert on performance issues
    PERFORM check_performance_alerts();
    
    -- Log maintenance completion
    RAISE NOTICE 'TimescaleDB maintenance completed at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS AND DOCUMENTATION
-- ============================================

COMMENT ON TABLE plugin_performance_metrics IS 'Time-series data for plugin performance monitoring including load times, resource usage, and error metrics';
COMMENT ON TABLE plugin_usage_events IS 'Time-series data for plugin usage analytics including user interactions and behavior tracking';
COMMENT ON TABLE plugin_resource_usage IS 'Time-series data for plugin resource consumption and cost tracking';
COMMENT ON TABLE plugin_error_events IS 'Time-series data for plugin error tracking and debugging';
COMMENT ON TABLE plugin_security_events IS 'Time-series data for plugin security events and compliance monitoring';
COMMENT ON TABLE plugin_business_metrics IS 'Time-series data for plugin business KPIs and adoption metrics';
COMMENT ON TABLE plugin_sla_metrics IS 'Time-series data for plugin SLA tracking and availability monitoring';

COMMENT ON FUNCTION calculate_plugin_health_score IS 'Calculates a composite health score (0-100) for a plugin based on performance, reliability, and error metrics';
COMMENT ON FUNCTION get_plugin_performance_summary IS 'Returns a summary of plugin performance metrics for a specified time range';
COMMENT ON FUNCTION check_performance_alerts IS 'Checks for performance threshold violations and creates alerts';
COMMENT ON FUNCTION daily_timescale_maintenance IS 'Performs daily maintenance tasks for TimescaleDB plugin metrics';

-- ============================================
-- SAMPLE QUERIES FOR COMMON USE CASES
-- ============================================

/*
-- Top 10 slowest plugins by average load time (last 24 hours)
SELECT 
    plugin_id,
    AVG(load_time_ms) as avg_load_time,
    COUNT(*) as sample_count
FROM plugin_performance_metrics
WHERE time >= NOW() - INTERVAL '24 hours'
GROUP BY plugin_id
ORDER BY avg_load_time DESC
LIMIT 10;

-- Plugin usage trends over time (daily)
SELECT 
    time_bucket('1 day', time) as day,
    plugin_id,
    COUNT(DISTINCT user_id) as daily_active_users,
    COUNT(*) as total_events
FROM plugin_usage_events
WHERE time >= NOW() - INTERVAL '30 days'
GROUP BY day, plugin_id
ORDER BY day DESC, daily_active_users DESC;

-- Cost analysis by plugin (last 30 days)
SELECT 
    plugin_id,
    tenant_id,
    SUM(total_cost_usd) as total_cost,
    AVG(cpu_percent) as avg_cpu_usage,
    AVG(memory_percent) as avg_memory_usage
FROM plugin_resource_usage
WHERE time >= NOW() - INTERVAL '30 days'
GROUP BY plugin_id, tenant_id
ORDER BY total_cost DESC;

-- Error rate trends
SELECT 
    time_bucket('1 hour', time) as hour,
    plugin_id,
    error_severity,
    COUNT(*) as error_count,
    COUNT(DISTINCT user_id) as affected_users
FROM plugin_error_events
WHERE time >= NOW() - INTERVAL '7 days'
GROUP BY hour, plugin_id, error_severity
ORDER BY hour DESC, error_count DESC;

-- Security posture overview
SELECT 
    plugin_id,
    COUNT(*) FILTER (WHERE severity = 'critical') as critical_issues,
    COUNT(*) FILTER (WHERE severity = 'high') as high_issues,
    COUNT(*) FILTER (WHERE severity = 'medium') as medium_issues,
    COUNT(*) FILTER (WHERE is_remediated = false) as open_issues
FROM plugin_security_events
WHERE time >= NOW() - INTERVAL '30 days'
GROUP BY plugin_id
ORDER BY critical_issues DESC, high_issues DESC;
*/