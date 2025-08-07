-- ============================================
-- MIGRATION 001: INITIAL PLUGIN ENHANCEMENT
-- Comprehensive Plugin Management System Enhancement
-- ============================================

-- Migration metadata
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    executed_at TIMESTAMP DEFAULT NOW(),
    execution_time_ms INTEGER,
    checksum VARCHAR(64),
    rollback_sql TEXT,
    status VARCHAR(20) DEFAULT 'PENDING' -- PENDING, RUNNING, COMPLETED, FAILED, ROLLED_BACK
);

INSERT INTO schema_migrations (version, name, checksum, rollback_sql, status) 
VALUES ('001', 'Initial Plugin Enhancement', 'abc123def456', 
$rollback$
-- Rollback script will be populated by the migration system
$rollback$, 'RUNNING');

-- Start transaction for migration
BEGIN;

-- Create backup tables for rollback
CREATE TABLE plugins_backup_001 AS SELECT * FROM plugins;
CREATE TABLE plugin_versions_backup_001 AS SELECT * FROM plugin_versions;

-- ============================================
-- STEP 1: EXTEND EXISTING PLUGIN TABLE
-- ============================================

-- Add new columns to plugins table
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS tenant_scope TEXT DEFAULT 'PRIVATE' CHECK (tenant_scope IN ('PUBLIC', 'PRIVATE', 'RESTRICTED', 'INTERNAL'));
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS subcategory TEXT;
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS maintainer TEXT;
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS documentation TEXT;
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS license TEXT;
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS keywords TEXT[] DEFAULT '{}';
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS compatibility JSONB;
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS requirements JSONB;
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS permissions JSONB;
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS api_version TEXT DEFAULT 'v1';
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS schema_version TEXT DEFAULT '1.0.0';
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS download_count BIGINT DEFAULT 0;
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS star_count INTEGER DEFAULT 0;
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS issue_count INTEGER DEFAULT 0;
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS last_commit TIMESTAMP;
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS health_score FLOAT CHECK (health_score >= 0 AND health_score <= 100);
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS security_score FLOAT CHECK (security_score >= 0 AND security_score <= 100);
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS maintenance_score FLOAT CHECK (maintenance_score >= 0 AND maintenance_score <= 100);
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'DEPRECATED', 'ARCHIVED', 'BLOCKED', 'PENDING_APPROVAL'));
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS lifecycle TEXT DEFAULT 'STABLE' CHECK (lifecycle IN ('ALPHA', 'BETA', 'STABLE', 'DEPRECATED', 'END_OF_LIFE'));
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS deprecated_at TIMESTAMP;
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;

-- Update category column to use new enum values
ALTER TABLE plugins ALTER COLUMN category DROP DEFAULT;
ALTER TABLE plugins ALTER COLUMN category TYPE TEXT;
-- We'll set proper enum constraint after data migration

-- ============================================
-- STEP 2: CREATE NEW PLUGIN MANAGEMENT TABLES
-- ============================================

-- Plugin Dependencies Table
CREATE TABLE IF NOT EXISTS plugin_dependencies (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_id TEXT NOT NULL,
    depends_on_id TEXT NOT NULL,
    dependency_type TEXT NOT NULL DEFAULT 'SOFT' CHECK (dependency_type IN ('HARD', 'SOFT', 'API', 'DATABASE', 'MESSAGING')),
    version_range TEXT,
    is_optional BOOLEAN DEFAULT FALSE,
    is_dev_only BOOLEAN DEFAULT FALSE,
    conflicts_with TEXT[] DEFAULT '{}',
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (plugin_id) REFERENCES plugins(id) ON DELETE CASCADE,
    FOREIGN KEY (depends_on_id) REFERENCES plugins(id) ON DELETE CASCADE,
    UNIQUE(plugin_id, depends_on_id)
);

-- Plugin Environment Configuration
CREATE TABLE IF NOT EXISTS plugin_environments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_id TEXT NOT NULL,
    environment TEXT NOT NULL DEFAULT 'production',
    is_active BOOLEAN DEFAULT TRUE,
    configuration JSONB NOT NULL,
    secrets JSONB,
    variables JSONB,
    resources JSONB,
    scaling JSONB,
    health JSONB,
    deployment TEXT DEFAULT 'ROLLING' CHECK (deployment IN ('ROLLING', 'BLUE_GREEN', 'CANARY', 'IMMEDIATE')),
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (plugin_id) REFERENCES plugins(id) ON DELETE CASCADE,
    UNIQUE(plugin_id, environment)
);

-- Plugin Governance
CREATE TABLE IF NOT EXISTS plugin_governance (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    policy_version TEXT DEFAULT '1.0',
    required_approvals INTEGER DEFAULT 1,
    approvers TEXT[] DEFAULT '{}',
    reviewers TEXT[] DEFAULT '{}',
    security_review BOOLEAN DEFAULT TRUE,
    compliance_review BOOLEAN DEFAULT FALSE,
    auto_approval BOOLEAN DEFAULT FALSE,
    exemptions JSONB,
    metadata JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (plugin_id) REFERENCES plugins(id) ON DELETE CASCADE,
    UNIQUE(plugin_id, tenant_id)
);

-- Plugin Approvals
CREATE TABLE IF NOT EXISTS plugin_approvals (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    governance_id TEXT NOT NULL,
    plugin_version_id TEXT,
    request_type TEXT NOT NULL CHECK (request_type IN ('INSTALL', 'UPDATE', 'CONFIGURATION_CHANGE', 'UNINSTALL', 'SECURITY_EXEMPTION', 'POLICY_OVERRIDE', 'EMERGENCY_DEPLOYMENT')),
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'CONDITIONALLY_APPROVED')),
    requested_by TEXT NOT NULL,
    approved_by TEXT,
    reviewed_by TEXT,
    priority TEXT DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'EMERGENCY')),
    reason TEXT,
    comments JSONB,
    requirements JSONB,
    evidence JSONB,
    expires_at TIMESTAMP,
    approved_at TIMESTAMP,
    rejected_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (governance_id) REFERENCES plugin_governance(id) ON DELETE CASCADE,
    FOREIGN KEY (plugin_version_id) REFERENCES plugin_versions(id)
);

-- ============================================
-- STEP 3: ANALYTICS AND MONITORING TABLES
-- ============================================

-- Plugin Analytics
CREATE TABLE IF NOT EXISTS plugin_analytics (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_id TEXT NOT NULL,
    tenant_id TEXT,
    user_id TEXT,
    event TEXT NOT NULL CHECK (event IN ('VIEW', 'INSTALL', 'UNINSTALL', 'ENABLE', 'DISABLE', 'CONFIGURE', 'UPDATE', 'ERROR', 'PERFORMANCE_ISSUE', 'SECURITY_ALERT', 'USER_INTERACTION', 'API_CALL', 'RENDER', 'LOAD', 'CRASH')),
    environment TEXT DEFAULT 'production',
    version TEXT,
    session_id TEXT,
    user_agent TEXT,
    ip_address INET,
    country TEXT,
    region TEXT,
    metadata JSONB,
    duration INTEGER,
    error_code TEXT,
    error_message TEXT,
    timestamp TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (plugin_id) REFERENCES plugins(id) ON DELETE CASCADE
);

-- Plugin Performance Metrics
CREATE TABLE IF NOT EXISTS plugin_performance (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_id TEXT NOT NULL,
    environment TEXT DEFAULT 'production',
    version TEXT,
    metric_type TEXT NOT NULL CHECK (metric_type IN ('LOAD_TIME', 'RENDER_TIME', 'MEMORY_USAGE', 'CPU_USAGE', 'NETWORK_LATENCY', 'ERROR_RATE', 'THROUGHPUT', 'RESPONSE_TIME', 'BUNDLE_SIZE', 'CACHE_HIT_RATE', 'GARBAGE_COLLECTION', 'DATABASE_QUERY_TIME')),
    value FLOAT NOT NULL,
    unit TEXT NOT NULL,
    percentile FLOAT,
    threshold FLOAT,
    is_alert BOOLEAN DEFAULT FALSE,
    tags JSONB DEFAULT '{}',
    timestamp TIMESTAMP DEFAULT NOW(),
    sampled_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (plugin_id) REFERENCES plugins(id) ON DELETE CASCADE
);

-- Plugin Vulnerabilities
CREATE TABLE IF NOT EXISTS plugin_vulnerabilities (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_id TEXT NOT NULL,
    cve_id TEXT,
    severity TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO')),
    score FLOAT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    affected_versions TEXT[] DEFAULT '{}',
    patched_versions TEXT[] DEFAULT '{}',
    workaround TEXT,
    exploitability TEXT,
    impact JSONB,
    references TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'PATCHED', 'RESOLVED', 'DISMISSED', 'FALSE_POSITIVE')),
    discovered_by TEXT,
    reported_at TIMESTAMP,
    patched_at TIMESTAMP,
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (plugin_id) REFERENCES plugins(id) ON DELETE CASCADE
);

-- Plugin Test Results
CREATE TABLE IF NOT EXISTS plugin_test_results (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_id TEXT NOT NULL,
    plugin_version_id TEXT,
    test_suite TEXT NOT NULL,
    test_type TEXT NOT NULL CHECK (test_type IN ('UNIT', 'INTEGRATION', 'E2E', 'PERFORMANCE', 'SECURITY', 'ACCESSIBILITY', 'COMPATIBILITY', 'SMOKE', 'REGRESSION', 'LOAD')),
    environment TEXT DEFAULT 'test',
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'RUNNING', 'PASSED', 'FAILED', 'UNSTABLE', 'CANCELLED', 'SKIPPED')),
    passed INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    skipped INTEGER DEFAULT 0,
    coverage FLOAT,
    duration INTEGER,
    artifacts JSONB,
    results JSONB,
    logs TEXT,
    executed_by TEXT,
    executed_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (plugin_id) REFERENCES plugins(id) ON DELETE CASCADE,
    FOREIGN KEY (plugin_version_id) REFERENCES plugin_versions(id)
);

-- Plugin Alerts
CREATE TABLE IF NOT EXISTS plugin_alerts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_id TEXT NOT NULL,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('BUDGET_EXCEEDED', 'BUDGET_THRESHOLD', 'PAYMENT_FAILED', 'SUBSCRIPTION_EXPIRING', 'UNUSUAL_USAGE', 'CREDIT_LOW')),
    severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    details JSONB,
    threshold FLOAT,
    current_value FLOAT,
    environment TEXT DEFAULT 'production',
    is_active BOOLEAN DEFAULT TRUE,
    is_muted BOOLEAN DEFAULT FALSE,
    acknowledged_by TEXT,
    acknowledged_at TIMESTAMP,
    resolved_by TEXT,
    resolved_at TIMESTAMP,
    muted_until TIMESTAMP,
    escalated_at TIMESTAMP,
    escalation_level INTEGER DEFAULT 0,
    notification_channels JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (plugin_id) REFERENCES plugins(id) ON DELETE CASCADE
);

-- Plugin Workflows
CREATE TABLE IF NOT EXISTS plugin_workflows (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    trigger TEXT NOT NULL CHECK (trigger IN ('MANUAL', 'SCHEDULED', 'ON_INSTALL', 'ON_UPDATE', 'ON_CONFIGURE', 'ON_ERROR', 'ON_PERFORMANCE_ALERT', 'ON_SECURITY_ALERT', 'ON_APPROVAL', 'WEBHOOK')),
    conditions JSONB,
    actions JSONB NOT NULL,
    schedule TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMP,
    last_run_status TEXT CHECK (last_run_status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'SKIPPED')),
    last_run_duration INTEGER,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (plugin_id) REFERENCES plugins(id) ON DELETE CASCADE
);

-- Plugin Workflow Executions
CREATE TABLE IF NOT EXISTS plugin_workflow_executions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id TEXT NOT NULL,
    trigger TEXT NOT NULL CHECK (trigger IN ('MANUAL', 'SCHEDULED', 'ON_INSTALL', 'ON_UPDATE', 'ON_CONFIGURE', 'ON_ERROR', 'ON_PERFORMANCE_ALERT', 'ON_SECURITY_ALERT', 'ON_APPROVAL', 'WEBHOOK')),
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'SKIPPED')),
    input JSONB,
    output JSONB,
    error TEXT,
    duration INTEGER,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES plugin_workflows(id) ON DELETE CASCADE
);

-- ============================================
-- STEP 4: CREATE INDEXES FOR PERFORMANCE
-- ============================================

-- Plugin indexes
CREATE INDEX IF NOT EXISTS idx_plugins_tenant_category_status ON plugins(tenant_id, category, status) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_plugins_name_trgm ON plugins USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_plugins_keywords_gin ON plugins USING gin(keywords);
CREATE INDEX IF NOT EXISTS idx_plugins_tags_gin ON plugins USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_plugins_health_score ON plugins(health_score DESC) WHERE health_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_plugins_download_count ON plugins(download_count DESC);

-- Dependency indexes
CREATE INDEX IF NOT EXISTS idx_plugin_deps_plugin_type ON plugin_dependencies(plugin_id, dependency_type);
CREATE INDEX IF NOT EXISTS idx_plugin_deps_depends_type ON plugin_dependencies(depends_on_id, dependency_type);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_plugin_analytics_plugin_time ON plugin_analytics(plugin_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_plugin_analytics_event_time ON plugin_analytics(event, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_plugin_analytics_tenant_time ON plugin_analytics(tenant_id, timestamp DESC) WHERE tenant_id IS NOT NULL;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_plugin_performance_plugin_metric_time ON plugin_performance(plugin_id, metric_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_plugin_performance_alert ON plugin_performance(plugin_id, metric_type, is_alert) WHERE is_alert = true;

-- Approval workflow indexes
CREATE INDEX IF NOT EXISTS idx_plugin_approvals_status_priority ON plugin_approvals(status, priority) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_plugin_approvals_requested_by ON plugin_approvals(requested_by, status, created_at DESC);

-- Vulnerability indexes
CREATE INDEX IF NOT EXISTS idx_plugin_vulnerabilities_severity_status ON plugin_vulnerabilities(plugin_id, severity, status);
CREATE INDEX IF NOT EXISTS idx_plugin_vulnerabilities_open ON plugin_vulnerabilities(severity, reported_at DESC) WHERE status = 'OPEN';

-- Test results indexes
CREATE INDEX IF NOT EXISTS idx_plugin_test_results_plugin_type_status ON plugin_test_results(plugin_id, test_type, status);
CREATE INDEX IF NOT EXISTS idx_plugin_test_results_status_executed ON plugin_test_results(status, executed_at DESC);

-- Alert indexes
CREATE INDEX IF NOT EXISTS idx_plugin_alerts_active_severity ON plugin_alerts(plugin_id, severity, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_plugin_alerts_unacknowledged ON plugin_alerts(alert_type, severity) WHERE acknowledged_by IS NULL AND is_active = true;

-- Workflow indexes
CREATE INDEX IF NOT EXISTS idx_plugin_workflows_plugin_active ON plugin_workflows(plugin_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_plugin_workflow_executions_workflow_started ON plugin_workflow_executions(workflow_id, started_at DESC);

-- ============================================
-- STEP 5: ADD FOREIGN KEY CONSTRAINTS
-- ============================================

-- Add foreign key for tenant_id (assuming tenants table exists or will be created)
-- ALTER TABLE plugins ADD CONSTRAINT fk_plugins_tenant_id FOREIGN KEY (tenant_id) REFERENCES organizations(id);

-- ============================================
-- STEP 6: DATA MIGRATION
-- ============================================

-- Migrate existing plugin data to new structure
UPDATE plugins SET 
    tenant_scope = 'PUBLIC' 
WHERE tenant_scope IS NULL;

-- Set default health scores based on existing data
UPDATE plugins SET 
    health_score = CASE 
        WHEN is_enabled = true AND is_installed = true THEN 85.0
        WHEN is_installed = true THEN 70.0
        ELSE 50.0
    END
WHERE health_score IS NULL;

-- Migrate category values to new enum structure
UPDATE plugins SET category = 
    CASE category
        WHEN 'other' THEN 'OTHER'
        WHEN 'authentication' THEN 'AUTHENTICATION'
        WHEN 'cicd' THEN 'CICD'
        WHEN 'monitoring' THEN 'MONITORING_OBSERVABILITY'
        WHEN 'security' THEN 'SECURITY_COMPLIANCE'
        ELSE UPPER(category)
    END;

-- ============================================
-- STEP 7: CREATE TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_plugins_updated_at BEFORE UPDATE ON plugins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plugin_environments_updated_at BEFORE UPDATE ON plugin_environments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plugin_governance_updated_at BEFORE UPDATE ON plugin_governance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plugin_approvals_updated_at BEFORE UPDATE ON plugin_approvals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plugin_vulnerabilities_updated_at BEFORE UPDATE ON plugin_vulnerabilities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plugin_alerts_updated_at BEFORE UPDATE ON plugin_alerts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plugin_workflows_updated_at BEFORE UPDATE ON plugin_workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STEP 8: CREATE VIEWS FOR COMMON QUERIES
-- ============================================

-- Plugin summary view
CREATE OR REPLACE VIEW plugin_summary AS
SELECT 
    p.id,
    p.name,
    p.display_name,
    p.category,
    p.status,
    p.lifecycle,
    p.tenant_id,
    p.is_installed,
    p.is_enabled,
    p.health_score,
    p.security_score,
    p.download_count,
    p.star_count,
    COUNT(pv.id) as version_count,
    MAX(pv.deployed_at) as last_deployment,
    COUNT(pa.id) FILTER (WHERE pa.is_active = true AND pa.severity = 'CRITICAL') as critical_alerts,
    COUNT(pvu.id) FILTER (WHERE pvu.status = 'OPEN' AND pvu.severity IN ('HIGH', 'CRITICAL')) as high_vulnerabilities
FROM plugins p
LEFT JOIN plugin_versions pv ON p.id = pv.plugin_id
LEFT JOIN plugin_alerts pa ON p.id = pa.plugin_id
LEFT JOIN plugin_vulnerabilities pvu ON p.id = pvu.plugin_id
GROUP BY p.id, p.name, p.display_name, p.category, p.status, p.lifecycle, 
         p.tenant_id, p.is_installed, p.is_enabled, p.health_score, 
         p.security_score, p.download_count, p.star_count;

-- Active plugins view
CREATE OR REPLACE VIEW active_plugins AS
SELECT * FROM plugin_summary 
WHERE status = 'ACTIVE' AND lifecycle != 'END_OF_LIFE';

-- Plugin health dashboard view
CREATE OR REPLACE VIEW plugin_health_dashboard AS
SELECT 
    category,
    COUNT(*) as total_plugins,
    AVG(health_score) as avg_health_score,
    COUNT(*) FILTER (WHERE health_score >= 80) as healthy_plugins,
    COUNT(*) FILTER (WHERE health_score < 50) as unhealthy_plugins,
    SUM(critical_alerts) as total_critical_alerts,
    SUM(high_vulnerabilities) as total_high_vulnerabilities
FROM plugin_summary
WHERE status = 'ACTIVE'
GROUP BY category
ORDER BY avg_health_score DESC;

-- ============================================
-- STEP 9: VALIDATION AND CONSTRAINTS
-- ============================================

-- Add check constraints
ALTER TABLE plugins ADD CONSTRAINT chk_health_score_range 
    CHECK (health_score IS NULL OR (health_score >= 0 AND health_score <= 100));

ALTER TABLE plugins ADD CONSTRAINT chk_security_score_range 
    CHECK (security_score IS NULL OR (security_score >= 0 AND security_score <= 100));

ALTER TABLE plugins ADD CONSTRAINT chk_maintenance_score_range 
    CHECK (maintenance_score IS NULL OR (maintenance_score >= 0 AND maintenance_score <= 100));

-- Validate data integrity
DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    -- Check for invalid plugin references
    SELECT COUNT(*) INTO invalid_count
    FROM plugin_dependencies pd
    LEFT JOIN plugins p1 ON pd.plugin_id = p1.id
    LEFT JOIN plugins p2 ON pd.depends_on_id = p2.id
    WHERE p1.id IS NULL OR p2.id IS NULL;
    
    IF invalid_count > 0 THEN
        RAISE EXCEPTION 'Data validation failed: % invalid plugin dependencies found', invalid_count;
    END IF;
    
    RAISE NOTICE 'Data validation passed successfully';
END $$;

-- ============================================
-- STEP 10: FINALIZATION
-- ============================================

-- Update migration status
UPDATE schema_migrations 
SET status = 'COMPLETED', 
    execution_time_ms = EXTRACT(EPOCH FROM (NOW() - executed_at)) * 1000
WHERE version = '001';

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO plugin_service_role;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO plugin_service_role;

-- Commit the migration
COMMIT;

-- Create rollback script
UPDATE schema_migrations 
SET rollback_sql = $rollback_script$
BEGIN;

-- Drop new tables in reverse order
DROP VIEW IF EXISTS plugin_health_dashboard;
DROP VIEW IF EXISTS active_plugins; 
DROP VIEW IF EXISTS plugin_summary;

DROP TABLE IF EXISTS plugin_workflow_executions;
DROP TABLE IF EXISTS plugin_workflows;
DROP TABLE IF EXISTS plugin_alerts;
DROP TABLE IF EXISTS plugin_test_results;
DROP TABLE IF EXISTS plugin_vulnerabilities;
DROP TABLE IF EXISTS plugin_performance;
DROP TABLE IF EXISTS plugin_analytics;
DROP TABLE IF EXISTS plugin_approvals;
DROP TABLE IF EXISTS plugin_governance;
DROP TABLE IF EXISTS plugin_environments;
DROP TABLE IF EXISTS plugin_dependencies;

-- Restore original plugins table
DROP TABLE plugins;
ALTER TABLE plugins_backup_001 RENAME TO plugins;

-- Restore plugin_versions table
DROP TABLE plugin_versions;
ALTER TABLE plugin_versions_backup_001 RENAME TO plugin_versions;

-- Drop triggers
DROP TRIGGER IF EXISTS update_plugins_updated_at ON plugins;
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Update migration status
UPDATE schema_migrations SET status = 'ROLLED_BACK' WHERE version = '001';

COMMIT;
$rollback_script$
WHERE version = '001';

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 001 completed successfully at %', NOW();
    RAISE NOTICE 'New tables created: 11';
    RAISE NOTICE 'New indexes created: 20+';
    RAISE NOTICE 'New views created: 3';
END $$;