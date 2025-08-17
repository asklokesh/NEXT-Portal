-- Migration: Add performance indexes for plugin filtering and sorting
-- Performance optimization for Plugin model with Spotify Portal-style categories

-- Create indexes for Plugin table performance
-- Category filtering performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_category ON plugins(category);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_tenant_category ON plugins(tenant_id, category);

-- Quality and health filtering performance  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_health ON plugins(health_score);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_quality_grade ON plugins(quality_grade);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_health_category ON plugins(health_score, category);

-- Download and popularity sorting performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_downloads ON plugins(download_count DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_stars ON plugins(star_count DESC);

-- Time-based sorting and filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_updated ON plugins(updated_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_created ON plugins(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_last_updated ON plugins(last_updated DESC);

-- Installation status filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_status ON plugins(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_installed ON plugins(is_installed);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_enabled ON plugins(is_enabled);

-- Tenant-specific performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_tenant_status ON plugins(tenant_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_tenant_scope ON plugins(tenant_id, tenant_scope);

-- Composite indexes for complex queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_category_health_downloads ON plugins(category, health_score DESC, download_count DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_tenant_category_status ON plugins(tenant_id, category, status);

-- Text search performance (for plugin names and descriptions)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_name_gin ON plugins USING gin(to_tsvector('english', name));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_description_gin ON plugins USING gin(to_tsvector('english', description));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_tags_gin ON plugins USING gin(tags);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_keywords_gin ON plugins USING gin(keywords);

-- Plugin Version table indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_versions_plugin_health ON plugin_versions(plugin_id, health_score DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_versions_status ON plugin_versions(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_versions_current ON plugin_versions(plugin_id, is_current) WHERE is_current = true;

-- Plugin Metrics table indexes (for analytics and reporting)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_metrics_plugin_date ON plugin_metrics(plugin_id, recorded_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_metrics_health ON plugin_metrics(health_score DESC, recorded_at DESC);

-- Plugin Installation table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_installations_tenant ON plugin_installations(tenant_id, installed_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_installations_status ON plugin_installations(status, installed_at DESC);

-- Add partial indexes for active/enabled plugins (most common queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_active_category ON plugins(category) WHERE status = 'ACTIVE';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_enabled_health ON plugins(health_score DESC) WHERE is_enabled = true;

-- Performance monitoring indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_performance_metrics ON plugins(response_time_avg, cpu_usage_avg, memory_usage_avg);

-- Security and compliance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_security_scan ON plugins(last_security_scan DESC) WHERE last_security_scan IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_compliance_status ON plugins(compliance_status, updated_at DESC);

-- Refresh materialized views if they exist
-- DO $$ BEGIN
--     REFRESH MATERIALIZED VIEW CONCURRENTLY plugin_stats_mv;
-- EXCEPTION WHEN undefined_table THEN
--     -- Materialized view doesn't exist, skip
-- END $$;

-- Add comments for maintenance
COMMENT ON INDEX idx_plugins_category IS 'Optimizes category-based plugin filtering';
COMMENT ON INDEX idx_plugins_health_category IS 'Optimizes health + category combined filters';
COMMENT ON INDEX idx_plugins_downloads IS 'Optimizes sorting by download count';
COMMENT ON INDEX idx_plugins_name_gin IS 'Enables full-text search on plugin names';
COMMENT ON INDEX idx_plugins_tags_gin IS 'Optimizes tag-based filtering using GIN index';

-- Statistics update for query planner optimization
ANALYZE plugins;
ANALYZE plugin_versions;
ANALYZE plugin_metrics;
ANALYZE plugin_installations;