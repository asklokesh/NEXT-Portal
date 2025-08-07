-- ============================================
-- POSTGRESQL PERFORMANCE OPTIMIZATIONS
-- FOR PLUGIN MANAGEMENT SYSTEM
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- ============================================
-- CORE PLUGIN INDEXES
-- ============================================

-- Primary plugin search and filtering indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_tenant_category_status ON plugins(tenantId, category, status) WHERE status = 'ACTIVE';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_name_trgm ON plugins USING gin(name gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_displayName_trgm ON plugins USING gin(displayName gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_description_trgm ON plugins USING gin(description gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_keywords_gin ON plugins USING gin(keywords);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_tags_gin ON plugins USING gin(tags);

-- Performance and quality metrics indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_health_score ON plugins(healthScore DESC NULLS LAST) WHERE healthScore IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_security_score ON plugins(securityScore DESC NULLS LAST) WHERE securityScore IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_download_count ON plugins(downloadCount DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_star_count ON plugins(starCount DESC);

-- Tenant-specific filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_tenant_scope ON plugins(tenantScope, isFeatured, isPremium);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_lifecycle_status ON plugins(lifecycle, status) WHERE status = 'ACTIVE';

-- Plugin version indexes for fast lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_versions_current ON plugin_versions(pluginId, isCurrent) WHERE isCurrent = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_versions_deployed ON plugin_versions(pluginId, isDeployed, deployedAt DESC) WHERE isDeployed = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_versions_status_deployed ON plugin_versions(status, deployedAt DESC) WHERE deployedAt IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_versions_semver ON plugin_versions(pluginId, semverMajor DESC, semverMinor DESC, semverPatch DESC);

-- ============================================
-- DEPENDENCY GRAPH OPTIMIZATION
-- ============================================

-- Plugin dependency graph traversal indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_deps_plugin_type ON plugin_dependencies(pluginId, dependencyType);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_deps_depends_type ON plugin_dependencies(dependsOnId, dependencyType);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_deps_optional ON plugin_dependencies(pluginId, isOptional) WHERE isOptional = false;

-- Conflict detection index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_deps_conflicts ON plugin_dependencies USING gin(conflictsWith);

-- ============================================
-- ANALYTICS AND MONITORING INDEXES
-- ============================================

-- Time-series indexes for analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_analytics_plugin_time ON plugin_analytics(pluginId, timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_analytics_tenant_time ON plugin_analytics(tenantId, timestamp DESC) WHERE tenantId IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_analytics_event_time ON plugin_analytics(event, timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_analytics_user_time ON plugin_analytics(userId, timestamp DESC) WHERE userId IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_analytics_error ON plugin_analytics(pluginId, event) WHERE event = 'ERROR';

-- Performance monitoring indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_performance_plugin_metric_time ON plugin_performance(pluginId, metricType, timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_performance_alert ON plugin_performance(pluginId, metricType, isAlert) WHERE isAlert = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_performance_env_time ON plugin_performance(environment, timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_performance_percentile ON plugin_performance(metricType, percentile, timestamp DESC) WHERE percentile IS NOT NULL;

-- ============================================
-- GOVERNANCE AND APPROVAL WORKFLOW INDEXES
-- ============================================

-- Approval workflow indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_approvals_status_priority ON plugin_approvals(status, priority) WHERE status = 'PENDING';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_approvals_requested_by ON plugin_approvals(requestedBy, status, createdAt DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_approvals_approved_by ON plugin_approvals(approvedBy, approvedAt DESC) WHERE approvedBy IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_approvals_expires ON plugin_approvals(expiresAt) WHERE expiresAt IS NOT NULL AND status = 'PENDING';

-- Governance policy indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_governance_tenant_active ON plugin_governance(tenantId, isActive) WHERE isActive = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_governance_auto_approval ON plugin_governance(pluginId, autoApproval) WHERE autoApproval = true;

-- ============================================
-- SECURITY AND VULNERABILITY INDEXES
-- ============================================

-- Vulnerability tracking indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_vulnerabilities_severity_status ON plugin_vulnerabilities(pluginId, severity, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_vulnerabilities_cve ON plugin_vulnerabilities(cveId) WHERE cveId IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_vulnerabilities_open ON plugin_vulnerabilities(severity, reportedAt DESC) WHERE status = 'OPEN';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_vulnerabilities_affected_versions ON plugin_vulnerabilities USING gin(affectedVersions);

-- Alert management indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_alerts_active_severity ON plugin_alerts(pluginId, severity, isActive) WHERE isActive = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_alerts_unacknowledged ON plugin_alerts(alertType, severity) WHERE acknowledgedBy IS NULL AND isActive = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_alerts_environment ON plugin_alerts(environment, severity, createdAt DESC);

-- ============================================
-- BACKUP AND DISASTER RECOVERY INDEXES
-- ============================================

-- Backup management indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_backups_plugin_status ON plugin_backups(pluginId, status, createdAt DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_backups_expires ON plugin_backups(expiresAt) WHERE expiresAt IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_backups_type_source ON plugin_backups(backupType, source, createdAt DESC);

-- Deployment tracking indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_deployments_version_env ON plugin_deployments(pluginVersionId, environment);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_deployments_status_started ON plugin_deployments(status, startedAt DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_deployments_rollback_deadline ON plugin_deployments(rollbackDeadline) WHERE rollbackDeadline IS NOT NULL;

-- ============================================
-- ENVIRONMENT AND CONFIGURATION INDEXES
-- ============================================

-- Environment configuration indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_environments_plugin_env ON plugin_environments(pluginId, environment);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_environments_active ON plugin_environments(environment, isActive) WHERE isActive = true;

-- Configuration management indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_configurations_plugin_env ON plugin_configurations(pluginId, environment);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_configurations_active ON plugin_configurations(isActive, updatedAt DESC) WHERE isActive = true;

-- ============================================
-- TESTING AND QUALITY ASSURANCE INDEXES
-- ============================================

-- Test result indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_test_results_plugin_type_status ON plugin_test_results(pluginId, testType, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_test_results_version_type ON plugin_test_results(pluginVersionId, testType) WHERE pluginVersionId IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_test_results_status_executed ON plugin_test_results(status, executedAt DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_test_results_coverage ON plugin_test_results(pluginId, coverage DESC NULLS LAST) WHERE coverage IS NOT NULL;

-- ============================================
-- WORKFLOW AUTOMATION INDEXES
-- ============================================

-- Workflow execution indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_workflows_plugin_active ON plugin_workflows(pluginId, isActive) WHERE isActive = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_workflows_trigger ON plugin_workflows(trigger, isActive) WHERE isActive = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_workflow_executions_workflow_started ON plugin_workflow_executions(workflowId, startedAt DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_workflow_executions_status ON plugin_workflow_executions(status, completedAt DESC) WHERE completedAt IS NOT NULL;

-- ============================================
-- COMPOSITE INDEXES FOR COMPLEX QUERIES
-- ============================================

-- Multi-tenant plugin discovery
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_discovery ON plugins(category, tenantScope, status, healthScore DESC NULLS LAST) WHERE status = 'ACTIVE';

-- Plugin marketplace optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_marketplace ON plugins(category, isPremium, downloadCount DESC, healthScore DESC NULLS LAST) WHERE status = 'ACTIVE' AND lifecycle = 'STABLE';

-- Security dashboard queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_security_overview ON plugins(securityScore ASC NULLS FIRST, updatedAt DESC) WHERE status = 'ACTIVE';

-- Performance monitoring dashboard
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_perf_dashboard ON plugin_performance(environment, metricType, isAlert, timestamp DESC) WHERE timestamp > NOW() - INTERVAL '24 hours';

-- ============================================
-- PARTITIONING STRATEGY
-- ============================================

-- Partition large analytics tables by time
-- This should be done during table creation, but can be retrofitted

-- Example partitioning for plugin_analytics (monthly partitions)
/*
CREATE TABLE plugin_analytics_y2025m01 PARTITION OF plugin_analytics
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
*/

-- ============================================
-- MATERIALIZED VIEWS FOR ANALYTICS
-- ============================================

-- Plugin usage summary
CREATE MATERIALIZED VIEW IF NOT EXISTS plugin_usage_summary AS
SELECT 
    p.id,
    p.name,
    p.displayName,
    p.category,
    COUNT(DISTINCT pa.userId) as unique_users,
    COUNT(pa.id) as total_events,
    AVG(CASE WHEN pa.event = 'LOAD' THEN pa.duration END) as avg_load_time,
    MAX(pa.timestamp) as last_used,
    COUNT(CASE WHEN pa.event = 'ERROR' THEN 1 END) as error_count
FROM plugins p
LEFT JOIN plugin_analytics pa ON p.id = pa.pluginId
WHERE p.status = 'ACTIVE'
  AND pa.timestamp >= NOW() - INTERVAL '30 days'
GROUP BY p.id, p.name, p.displayName, p.category;

CREATE UNIQUE INDEX IF NOT EXISTS idx_plugin_usage_summary_id ON plugin_usage_summary(id);
CREATE INDEX IF NOT EXISTS idx_plugin_usage_summary_category ON plugin_usage_summary(category, unique_users DESC);

-- Plugin health summary
CREATE MATERIALIZED VIEW IF NOT EXISTS plugin_health_summary AS
SELECT 
    p.id,
    p.name,
    p.healthScore,
    p.securityScore,
    p.maintenanceScore,
    COUNT(DISTINCT pv.id) as version_count,
    MAX(pv.deployedAt) as last_deployment,
    COUNT(CASE WHEN pal.severity = 'CRITICAL' AND pal.isActive THEN 1 END) as critical_alerts,
    COUNT(CASE WHEN pvu.severity = 'HIGH' AND pvu.status = 'OPEN' THEN 1 END) as high_vulnerabilities
FROM plugins p
LEFT JOIN plugin_versions pv ON p.id = pv.pluginId
LEFT JOIN plugin_alerts pal ON p.id = pal.pluginId
LEFT JOIN plugin_vulnerabilities pvu ON p.id = pvu.pluginId
WHERE p.status = 'ACTIVE'
GROUP BY p.id, p.name, p.healthScore, p.securityScore, p.maintenanceScore;

CREATE UNIQUE INDEX IF NOT EXISTS idx_plugin_health_summary_id ON plugin_health_summary(id);
CREATE INDEX IF NOT EXISTS idx_plugin_health_summary_health ON plugin_health_summary(healthScore DESC NULLS LAST);

-- ============================================
-- MAINTENANCE AND MONITORING QUERIES
-- ============================================

-- Index usage statistics query
CREATE OR REPLACE FUNCTION get_index_usage_stats()
RETURNS TABLE(
    schemaname text,
    tablename text,
    indexname text,
    idx_tup_read bigint,
    idx_tup_fetch bigint,
    idx_scan bigint,
    size_mb numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.schemaname::text,
        s.tablename::text,
        s.indexrelname::text,
        s.idx_tup_read,
        s.idx_tup_fetch,
        s.idx_scan,
        ROUND((pg_relation_size(s.indexrelid) / 1024.0 / 1024.0)::numeric, 2) as size_mb
    FROM pg_stat_user_indexes s
    WHERE s.schemaname = 'public'
      AND (s.tablename LIKE 'plugin%' OR s.tablename IN ('users', 'organizations'))
    ORDER BY s.idx_scan DESC;
END;
$$ LANGUAGE plpgsql;

-- Table size and row count statistics
CREATE OR REPLACE FUNCTION get_table_stats()
RETURNS TABLE(
    table_name text,
    row_count bigint,
    table_size_mb numeric,
    index_size_mb numeric,
    total_size_mb numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.table_name::text,
        c.reltuples::bigint as row_count,
        ROUND((pg_table_size(c.oid) / 1024.0 / 1024.0)::numeric, 2) as table_size_mb,
        ROUND((pg_indexes_size(c.oid) / 1024.0 / 1024.0)::numeric, 2) as index_size_mb,
        ROUND((pg_total_relation_size(c.oid) / 1024.0 / 1024.0)::numeric, 2) as total_size_mb
    FROM information_schema.tables t
    JOIN pg_class c ON c.relname = t.table_name
    WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND (t.table_name LIKE 'plugin%' OR t.table_name IN ('users', 'organizations'))
    ORDER BY pg_total_relation_size(c.oid) DESC;
END;
$$ LANGUAGE plpgsql;

-- Refresh materialized views function
CREATE OR REPLACE FUNCTION refresh_plugin_analytics_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY plugin_usage_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY plugin_health_summary;
    
    -- Update statistics after refresh
    ANALYZE plugin_usage_summary;
    ANALYZE plugin_health_summary;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- AUTOMATIC MAINTENANCE
-- ============================================

-- Function to maintain plugin analytics partitions
CREATE OR REPLACE FUNCTION maintain_plugin_analytics_partitions()
RETURNS void AS $$
DECLARE
    current_month date := date_trunc('month', current_date);
    next_month date := current_month + interval '1 month';
    future_month date := next_month + interval '1 month';
BEGIN
    -- Create next month's partition if it doesn't exist
    EXECUTE format('CREATE TABLE IF NOT EXISTS plugin_analytics_%s PARTITION OF plugin_analytics FOR VALUES FROM (%L) TO (%L)',
                   to_char(next_month, 'YYYY_MM'),
                   next_month,
                   future_month);
    
    -- Drop partitions older than 12 months
    EXECUTE format('DROP TABLE IF EXISTS plugin_analytics_%s',
                   to_char(current_month - interval '12 months', 'YYYY_MM'));
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- CONFIGURATION RECOMMENDATIONS
-- ============================================

-- Set appropriate PostgreSQL configuration for plugin management workload
-- Add these to postgresql.conf:

-- Memory settings
-- shared_buffers = 25% of RAM (e.g., 4GB for 16GB RAM)
-- effective_cache_size = 75% of RAM (e.g., 12GB for 16GB RAM)
-- work_mem = 256MB (for complex queries)
-- maintenance_work_mem = 2GB (for index creation)

-- Connection settings
-- max_connections = 200
-- max_prepared_transactions = 200

-- WAL settings
-- wal_buffers = 64MB
-- checkpoint_completion_target = 0.9
-- wal_compression = on

-- Query planning
-- random_page_cost = 1.1 (for SSD)
-- seq_page_cost = 1.0
-- cpu_tuple_cost = 0.01
-- cpu_index_tuple_cost = 0.005

-- Monitoring
-- log_min_duration_statement = 1000
-- log_checkpoints = on
-- log_connections = on
-- log_disconnections = on
-- log_lock_waits = on

-- Extensions
-- shared_preload_libraries = 'pg_stat_statements'
-- pg_stat_statements.max = 10000
-- pg_stat_statements.track = all

COMMENT ON FUNCTION get_index_usage_stats() IS 'Returns index usage statistics for plugin management tables';
COMMENT ON FUNCTION get_table_stats() IS 'Returns table size and row count statistics for plugin management tables';
COMMENT ON FUNCTION refresh_plugin_analytics_views() IS 'Refreshes materialized views for plugin analytics';
COMMENT ON FUNCTION maintain_plugin_analytics_partitions() IS 'Creates future partitions and drops old ones for plugin analytics';