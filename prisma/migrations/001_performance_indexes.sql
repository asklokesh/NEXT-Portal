-- Performance Optimization Indexes for Enterprise SaaS IDP Platform
-- Strategic indexes for high-traffic queries and multi-tenant operations

-- ============================================================================
-- CORE ENTITY INDEXES
-- ============================================================================

-- Users table - Authentication and authorization queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_active ON users(email) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_provider_provider_id ON users(provider, provider_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_active ON users(role) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_last_login ON users(last_login DESC) WHERE last_login IS NOT NULL;

-- Teams table - Multi-tenant queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teams_name_active ON teams(name) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teams_active_created ON teams(created_at DESC) WHERE is_active = true;

-- Team members - Join table optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_members_user_role ON team_members(user_id, role);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_members_team_role ON team_members(team_id, role);

-- ============================================================================
-- SERVICE CATALOG INDEXES
-- ============================================================================

-- Services table - Core catalog queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_name_namespace ON services(name, namespace);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_type_lifecycle ON services(type, lifecycle);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_owner_team ON services(owner_id, team_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_active_updated ON services(updated_at DESC) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_domain_system ON services(domain, system) WHERE domain IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_tags_gin ON services USING gin(tags);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_labels_gin ON services USING gin(labels);

-- Service dependencies - Graph queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_service_deps_service_type ON service_dependencies(service_id, dependency_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_service_deps_depends_type ON service_dependencies(depends_on_id, dependency_type);

-- ============================================================================
-- PLUGIN MANAGEMENT INDEXES
-- ============================================================================

-- Plugins table - Core plugin queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_name_tenant ON plugins(name, tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_status_tenant ON plugins(status, tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_category_tenant ON plugins(category, tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_updated_tenant ON plugins(updated_at DESC, tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_tags_gin ON plugins USING gin(tags);

-- Plugin deployments - Deployment tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_deployments_plugin_status ON plugin_deployments(plugin_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_deployments_env_status ON plugin_deployments(environment, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_deployments_created ON plugin_deployments(created_at DESC);

-- Plugin configurations - Multi-tenant config
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_configs_plugin_tenant ON plugin_configurations(plugin_id, tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_configs_tenant_active ON plugin_configurations(tenant_id) WHERE is_active = true;

-- Plugin dependencies - Dependency resolution
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_deps_plugin_type ON plugin_dependencies(plugin_id, dependency_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_deps_dep_version ON plugin_dependencies(dependency_name, required_version);

-- ============================================================================
-- MONITORING AND HEALTH INDEXES
-- ============================================================================

-- Health checks - Real-time monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_health_checks_service_enabled ON service_health_checks(service_id) WHERE is_enabled = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_health_checks_type_enabled ON service_health_checks(type) WHERE is_enabled = true;

-- Health check results - Time series data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_health_results_check_timestamp ON health_check_results(health_check_id, timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_health_results_status_timestamp ON health_check_results(status, timestamp DESC);

-- Service metrics - Performance monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_service_metrics_service_timestamp ON service_metrics(service_id, timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_service_metrics_name_timestamp ON service_metrics(metric_name, timestamp DESC);

-- Plugin metrics - Plugin performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_metrics_plugin_timestamp ON plugin_metrics(plugin_id, timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_metrics_tenant_timestamp ON plugin_metrics(tenant_id, timestamp DESC);

-- ============================================================================
-- SECURITY AND AUDIT INDEXES
-- ============================================================================

-- Audit logs - Security and compliance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_timestamp ON audit_logs(user_id, timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_action_timestamp ON audit_logs(action, timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_resource_timestamp ON audit_logs(resource_type, resource_id, timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_timestamp_only ON audit_logs(timestamp DESC);

-- API keys - Authentication
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_keys_user_active ON api_keys(user_id) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash) WHERE is_active = true;

-- Sessions - Authentication state
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_user_expires ON sessions(user_id, expires_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_token ON sessions(session_token);

-- ============================================================================
-- NOTIFICATION AND COMMUNICATION INDEXES
-- ============================================================================

-- Notifications - Real-time delivery
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_type_created ON notifications(type, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_unread ON notifications(created_at DESC) WHERE is_read = false;

-- ============================================================================
-- COST MANAGEMENT INDEXES
-- ============================================================================

-- Service costs - Financial tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_service_costs_service_date ON service_costs(service_id, cost_date DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_service_costs_date_amount ON service_costs(cost_date DESC, total_cost DESC);

-- Cost allocations - Multi-tenant billing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cost_allocations_team_date ON cost_allocations(team_id, allocation_date DESC);

-- ============================================================================
-- SEARCH AND DISCOVERY INDEXES
-- ============================================================================

-- Search index - Full-text search optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_index_entity_type ON search_index(entity_type, tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_index_updated ON search_index(last_updated DESC);

-- Templates - Template discovery
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_templates_type_active ON templates(type) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_templates_tags_gin ON templates USING gin(tags);

-- ============================================================================
-- BILLING AND MARKETPLACE INDEXES
-- ============================================================================

-- Organizations - Multi-tenant billing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organizations_subscription ON organizations(subscription_id) WHERE subscription_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organizations_plan ON organizations(billing_plan);

-- Plugin sales - Marketplace tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_sales_plugin_date ON plugin_sales(plugin_id, sale_date DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_sales_org_date ON plugin_sales(organization_id, sale_date DESC);

-- ============================================================================
-- COMPOSITE INDEXES FOR COMPLEX QUERIES
-- ============================================================================

-- Multi-tenant service queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_tenant_complex ON services(team_id, lifecycle, type, updated_at DESC) WHERE is_active = true;

-- Plugin discovery queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_discovery ON plugins(tenant_id, category, status, updated_at DESC);

-- Health monitoring queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_health_monitoring ON health_check_results(timestamp DESC, status, health_check_id);

-- Audit trail queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_comprehensive ON audit_logs(resource_type, timestamp DESC, user_id, action);

-- ============================================================================
-- PARTIAL INDEXES FOR EFFICIENCY
-- ============================================================================

-- Active plugins only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_active_only ON plugins(tenant_id, name) WHERE status = 'active';

-- Failed deployments for monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugin_deployments_failed ON plugin_deployments(plugin_id, created_at DESC) WHERE status = 'failed';

-- Recent notifications for real-time updates
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_recent ON notifications(user_id, created_at DESC) WHERE created_at > NOW() - INTERVAL '30 days';

-- ============================================================================
-- PERFORMANCE STATISTICS UPDATE
-- ============================================================================

-- Update table statistics for query planner optimization
ANALYZE users;
ANALYZE teams;
ANALYZE team_members;
ANALYZE services;
ANALYZE service_dependencies;
ANALYZE plugins;
ANALYZE plugin_deployments;
ANALYZE plugin_configurations;
ANALYZE health_check_results;
ANALYZE service_metrics;
ANALYZE audit_logs;
ANALYZE notifications;

-- Index usage statistics
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats 
WHERE schemaname = 'public' 
    AND tablename IN ('users', 'services', 'plugins', 'audit_logs')
ORDER BY tablename, attname;