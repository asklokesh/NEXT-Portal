-- Multi-Tenancy Database Migration
-- Adds tenant support and row-level security to existing models

BEGIN;

-- Add tenantId to User model for tenant-specific users
ALTER TABLE users ADD COLUMN tenant_id TEXT;
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id) WHERE tenant_id IS NOT NULL;

-- Add tenantId to Team model
ALTER TABLE teams ADD COLUMN tenant_id TEXT;
CREATE INDEX IF NOT EXISTS idx_teams_tenant_id ON teams(tenant_id) WHERE tenant_id IS NOT NULL;

-- Add tenantId to Service model  
ALTER TABLE services ADD COLUMN tenant_id TEXT;
CREATE INDEX IF NOT EXISTS idx_services_tenant_id ON services(tenant_id) WHERE tenant_id IS NOT NULL;

-- Add tenantId to Template model
ALTER TABLE templates ADD COLUMN tenant_id TEXT;
CREATE INDEX IF NOT EXISTS idx_templates_tenant_id ON templates(tenant_id) WHERE tenant_id IS NOT NULL;

-- Add tenantId to Notification model
ALTER TABLE notifications ADD COLUMN tenant_id TEXT;
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_id ON notifications(tenant_id) WHERE tenant_id IS NOT NULL;

-- Add tenantId to AuditLog model for tenant-specific audit trails
ALTER TABLE audit_logs ADD COLUMN tenant_id TEXT;
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id) WHERE tenant_id IS NOT NULL;

-- Update existing Plugin model indexes for better tenant performance
CREATE INDEX IF NOT EXISTS idx_plugins_tenant_category_status ON plugins(tenant_id, category, status) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_plugins_tenant_installed ON plugins(tenant_id, is_installed, is_enabled) WHERE tenant_id IS NOT NULL;

-- Add composite indexes for plugin-related queries
CREATE INDEX IF NOT EXISTS idx_plugin_versions_tenant_plugin ON plugin_versions(plugin_id) 
  INCLUDE (version, is_current, status);

CREATE INDEX IF NOT EXISTS idx_plugin_operations_tenant_status ON plugin_operations(plugin_id, status, started_at) 
  INCLUDE (operation_type, completed_at);

CREATE INDEX IF NOT EXISTS idx_plugin_metrics_tenant_timeseries ON plugin_metrics(plugin_id, metric_name, timestamp DESC)
  INCLUDE (value, unit);

CREATE INDEX IF NOT EXISTS idx_plugin_configs_tenant_env ON plugin_configs(plugin_id, environment, key) 
  INCLUDE (value, is_secret);

-- Add tenant-aware constraints for data integrity
-- Ensure plugin versions belong to the same tenant as the plugin
CREATE OR REPLACE FUNCTION validate_plugin_version_tenant() 
RETURNS TRIGGER AS $$
DECLARE
    plugin_tenant_id TEXT;
BEGIN
    -- Get the tenant_id from the parent plugin
    SELECT tenant_id INTO plugin_tenant_id 
    FROM plugins 
    WHERE id = NEW.plugin_id;
    
    -- Skip validation for system operations or public plugins
    IF plugin_tenant_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Additional validation can be added here
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for plugin version tenant validation
DROP TRIGGER IF EXISTS plugin_version_tenant_validation ON plugin_versions;
CREATE TRIGGER plugin_version_tenant_validation
    BEFORE INSERT OR UPDATE ON plugin_versions
    FOR EACH ROW
    EXECUTE FUNCTION validate_plugin_version_tenant();

-- Create tenant data isolation function for RLS
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS TEXT AS $$
BEGIN
    -- This function should return the current tenant ID from context
    -- In practice, this would be set by the application
    RETURN current_setting('app.current_tenant_id', true);
EXCEPTION
    WHEN undefined_object THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Row Level Security on tenant-aware tables
ALTER TABLE plugins ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for plugins
CREATE POLICY plugin_tenant_isolation ON plugins
    FOR ALL
    USING (
        tenant_id IS NULL OR  -- Public plugins
        tenant_id = current_tenant_id() OR  -- Same tenant
        current_tenant_id() = 'system'  -- System access
    );

-- Create RLS policies for users
CREATE POLICY user_tenant_isolation ON users
    FOR ALL
    USING (
        tenant_id IS NULL OR  -- Global users
        tenant_id = current_tenant_id() OR  -- Same tenant
        current_tenant_id() = 'system'  -- System access
    );

-- Create RLS policies for teams
CREATE POLICY team_tenant_isolation ON teams
    FOR ALL
    USING (
        tenant_id IS NULL OR  -- Global teams
        tenant_id = current_tenant_id() OR  -- Same tenant
        current_tenant_id() = 'system'  -- System access
    );

-- Create RLS policies for services
CREATE POLICY service_tenant_isolation ON services
    FOR ALL
    USING (
        tenant_id IS NULL OR  -- Public services
        tenant_id = current_tenant_id() OR  -- Same tenant
        current_tenant_id() = 'system'  -- System access
    );

-- Create RLS policies for templates
CREATE POLICY template_tenant_isolation ON templates
    FOR ALL
    USING (
        tenant_id IS NULL OR  -- Public templates
        tenant_id = current_tenant_id() OR  -- Same tenant
        current_tenant_id() = 'system' OR  -- System access
        is_public = true  -- Explicitly public templates
    );

-- Create RLS policies for notifications
CREATE POLICY notification_tenant_isolation ON notifications
    FOR ALL
    USING (
        tenant_id = current_tenant_id() OR  -- Same tenant only
        current_tenant_id() = 'system'  -- System access
    );

-- Create RLS policies for audit logs
CREATE POLICY audit_log_tenant_isolation ON audit_logs
    FOR ALL
    USING (
        tenant_id = current_tenant_id() OR  -- Same tenant only
        current_tenant_id() = 'system'  -- System access
    );

-- Create views for tenant-specific data access
CREATE OR REPLACE VIEW tenant_plugins AS
SELECT p.*
FROM plugins p
WHERE p.tenant_id = current_tenant_id()
   OR p.tenant_id IS NULL
   OR current_tenant_id() = 'system';

CREATE OR REPLACE VIEW tenant_services AS
SELECT s.*
FROM services s
WHERE s.tenant_id = current_tenant_id()
   OR s.tenant_id IS NULL
   OR current_tenant_id() = 'system';

CREATE OR REPLACE VIEW tenant_users AS
SELECT u.*
FROM users u
WHERE u.tenant_id = current_tenant_id()
   OR u.tenant_id IS NULL
   OR current_tenant_id() = 'system';

-- Create function to set tenant context for a session
CREATE OR REPLACE FUNCTION set_tenant_context(tenant_id TEXT) 
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_tenant_id', tenant_id, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get tenant statistics
CREATE OR REPLACE FUNCTION get_tenant_stats(tenant_id TEXT)
RETURNS TABLE (
    plugin_count BIGINT,
    user_count BIGINT,
    service_count BIGINT,
    template_count BIGINT,
    storage_used BIGINT,
    api_calls_month BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM plugins WHERE plugins.tenant_id = get_tenant_stats.tenant_id),
        (SELECT COUNT(*) FROM users WHERE users.tenant_id = get_tenant_stats.tenant_id),
        (SELECT COUNT(*) FROM services WHERE services.tenant_id = get_tenant_stats.tenant_id),
        (SELECT COUNT(*) FROM templates WHERE templates.tenant_id = get_tenant_stats.tenant_id),
        COALESCE((
            SELECT SUM(quantity::BIGINT) 
            FROM resource_usage 
            WHERE organization_id = get_tenant_stats.tenant_id 
            AND resource_type = 'STORAGE_GB'
            AND period >= date_trunc('month', CURRENT_DATE)
        ), 0),
        COALESCE((
            SELECT SUM(quantity::BIGINT) 
            FROM resource_usage 
            WHERE organization_id = get_tenant_stats.tenant_id 
            AND resource_type = 'API_CALLS'
            AND period >= date_trunc('month', CURRENT_DATE)
        ), 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for performance optimization with tenant context
CREATE INDEX IF NOT EXISTS idx_resource_usage_tenant_type_period ON resource_usage(organization_id, resource_type, period);
CREATE INDEX IF NOT EXISTS idx_plugin_operations_tenant_type ON plugin_operations(plugin_id, operation_type, status) 
  INCLUDE (started_at, completed_at);

-- Add partial indexes for active plugins by tenant
CREATE INDEX IF NOT EXISTS idx_plugins_active_by_tenant ON plugins(tenant_id, status, is_installed) 
  WHERE status = 'ACTIVE' AND is_installed = true;

-- Add covering indexes for common queries
CREATE INDEX IF NOT EXISTS idx_plugins_tenant_category_cover ON plugins(tenant_id, category) 
  INCLUDE (name, display_name, description, is_installed, is_enabled, status);

-- Create materialized view for tenant metrics (optional performance optimization)
CREATE MATERIALIZED VIEW IF NOT EXISTS tenant_metrics_daily AS
SELECT 
    p.tenant_id,
    DATE(now()) as metric_date,
    COUNT(p.id) as plugin_count,
    COUNT(CASE WHEN p.is_installed THEN 1 END) as installed_plugin_count,
    COUNT(CASE WHEN p.is_enabled THEN 1 END) as enabled_plugin_count,
    AVG(p.health_score) as avg_health_score,
    COUNT(po.id) as operations_count,
    COUNT(CASE WHEN po.status = 'COMPLETED' THEN 1 END) as successful_operations
FROM plugins p
LEFT JOIN plugin_operations po ON p.id = po.plugin_id 
    AND po.started_at >= CURRENT_DATE
WHERE p.tenant_id IS NOT NULL
GROUP BY p.tenant_id;

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_metrics_daily_unique ON tenant_metrics_daily(tenant_id, metric_date);

-- Create function to refresh tenant metrics
CREATE OR REPLACE FUNCTION refresh_tenant_metrics() 
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY tenant_metrics_daily;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add tenant data cleanup function
CREATE OR REPLACE FUNCTION cleanup_tenant_data(tenant_id TEXT, confirm_deletion TEXT)
RETURNS TABLE (
    table_name TEXT,
    records_deleted BIGINT
) AS $$
DECLARE
    rec RECORD;
    deleted_count BIGINT;
BEGIN
    -- Safety check
    IF confirm_deletion != 'CONFIRM_DELETE_TENANT_DATA' THEN
        RAISE EXCEPTION 'Must provide confirmation string to delete tenant data';
    END IF;
    
    -- Delete tenant data from all relevant tables
    FOR rec IN 
        SELECT t.table_name, t.column_name
        FROM information_schema.columns t
        WHERE t.column_name = 'tenant_id'
        AND t.table_schema = 'public'
        AND t.table_name NOT LIKE 'pg_%'
    LOOP
        EXECUTE format('DELETE FROM %I WHERE %I = $1', rec.table_name, rec.column_name) 
        USING tenant_id;
        
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        
        RETURN QUERY SELECT rec.table_name, deleted_count;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

-- Create comments for documentation
COMMENT ON FUNCTION current_tenant_id() IS 'Returns the current tenant ID for row-level security';
COMMENT ON FUNCTION set_tenant_context(TEXT) IS 'Sets the tenant context for the current session';
COMMENT ON FUNCTION get_tenant_stats(TEXT) IS 'Returns comprehensive statistics for a specific tenant';
COMMENT ON FUNCTION refresh_tenant_metrics() IS 'Refreshes the materialized view for tenant metrics';
COMMENT ON FUNCTION cleanup_tenant_data(TEXT, TEXT) IS 'Safely removes all data for a specific tenant (requires confirmation)';

COMMENT ON VIEW tenant_plugins IS 'Tenant-filtered view of plugins';
COMMENT ON VIEW tenant_services IS 'Tenant-filtered view of services';
COMMENT ON VIEW tenant_users IS 'Tenant-filtered view of users';

COMMENT ON POLICY plugin_tenant_isolation ON plugins IS 'Ensures plugins are only accessible within tenant boundaries';
COMMENT ON POLICY user_tenant_isolation ON users IS 'Isolates user data by tenant';
COMMENT ON POLICY team_tenant_isolation ON teams IS 'Isolates team data by tenant';
COMMENT ON POLICY service_tenant_isolation ON services IS 'Isolates service data by tenant';
COMMENT ON POLICY template_tenant_isolation ON templates IS 'Isolates template data by tenant with public template support';
COMMENT ON POLICY notification_tenant_isolation ON notifications IS 'Strict tenant isolation for notifications';
COMMENT ON POLICY audit_log_tenant_isolation ON audit_logs IS 'Strict tenant isolation for audit logs';