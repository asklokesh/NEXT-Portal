-- Multi-Tenant Data Isolation with Row-Level Security (RLS)
-- This migration adds tenant isolation capabilities to the database

-- Enable Row Level Security on all tenant-aware tables
ALTER TABLE plugins ENABLE ROW LEVEL SECURITY;
ALTER TABLE plugins FORCE ROW LEVEL SECURITY;

-- Add tenant_id column to plugins table if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'plugins' AND column_name = 'tenant_id') THEN
        ALTER TABLE plugins ADD COLUMN tenant_id UUID NOT NULL DEFAULT 'tenant-system'::UUID;
        CREATE INDEX idx_plugins_tenant_id ON plugins(tenant_id);
    END IF;
END $$;

-- Create RLS policy for plugins table
DROP POLICY IF EXISTS plugins_tenant_isolation ON plugins;
CREATE POLICY plugins_tenant_isolation ON plugins
FOR ALL
USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Create tenant contexts table
CREATE TABLE IF NOT EXISTS tenant_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    tier VARCHAR(50) NOT NULL DEFAULT 'starter',
    data_residency VARCHAR(50) NOT NULL DEFAULT 'us-east-1',
    compliance_level VARCHAR(50) NOT NULL DEFAULT 'standard',
    isolation_mode VARCHAR(50) NOT NULL DEFAULT 'shared',
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tenant isolation configs table
CREATE TABLE IF NOT EXISTS tenant_isolation_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenant_contexts(id) ON DELETE CASCADE,
    enable_rls BOOLEAN NOT NULL DEFAULT true,
    enforce_data_residency BOOLEAN NOT NULL DEFAULT false,
    audit_all_queries BOOLEAN NOT NULL DEFAULT false,
    encryption_at_rest BOOLEAN NOT NULL DEFAULT true,
    encryption_in_transit BOOLEAN NOT NULL DEFAULT true,
    audit_logs_retention_days INTEGER NOT NULL DEFAULT 365,
    user_activity_retention_days INTEGER NOT NULL DEFAULT 90,
    system_metrics_retention_days INTEGER NOT NULL DEFAULT 30,
    gdpr_compliant BOOLEAN NOT NULL DEFAULT false,
    soc2_type2 BOOLEAN NOT NULL DEFAULT false,
    hipaa_compliant BOOLEAN NOT NULL DEFAULT false,
    pci_dss_compliant BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id)
);

-- Create data access policies table
CREATE TABLE IF NOT EXISTS data_access_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenant_contexts(id) ON DELETE CASCADE,
    resource_type VARCHAR(255) NOT NULL,
    operation VARCHAR(50) NOT NULL,
    conditions TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_by VARCHAR(255) NOT NULL,
    valid_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tenant audit logs table
CREATE TABLE IF NOT EXISTS tenant_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenant_contexts(id) ON DELETE CASCADE,
    user_id VARCHAR(255),
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(255) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,
    sql_query TEXT,
    client_ip INET,
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    execution_time INTEGER, -- milliseconds
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_accessed_rows INTEGER,
    data_accessed_columns TEXT[],
    data_accessed_sensitive BOOLEAN DEFAULT false
);

-- Create compliance reports table
CREATE TABLE IF NOT EXISTS compliance_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenant_contexts(id) ON DELETE CASCADE,
    report_type VARCHAR(50) NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    overall_score INTEGER NOT NULL,
    findings JSONB DEFAULT '[]',
    recommendations TEXT[],
    next_review_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create compliance findings table
CREATE TABLE IF NOT EXISTS compliance_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES compliance_reports(id) ON DELETE CASCADE,
    severity VARCHAR(50) NOT NULL,
    category VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    evidence TEXT[],
    remediation TEXT NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL DEFAULT 'open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all new tables
ALTER TABLE tenant_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_isolation_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_access_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_findings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tenant_contexts (system-wide access for admin)
CREATE POLICY tenant_contexts_admin_access ON tenant_contexts
FOR ALL
USING (current_setting('app.current_user_role', true) = 'admin')
WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

-- Create RLS policies for tenant-specific tables
CREATE POLICY tenant_isolation_configs_tenant_access ON tenant_isolation_configs
FOR ALL
USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY data_access_policies_tenant_access ON data_access_policies
FOR ALL
USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_audit_logs_tenant_access ON tenant_audit_logs
FOR ALL
USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY compliance_reports_tenant_access ON compliance_reports
FOR ALL
USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY compliance_findings_tenant_access ON compliance_findings
FOR ALL
USING (
    report_id IN (
        SELECT id FROM compliance_reports 
        WHERE tenant_id = current_setting('app.current_tenant_id', true)::UUID
    )
)
WITH CHECK (
    report_id IN (
        SELECT id FROM compliance_reports 
        WHERE tenant_id = current_setting('app.current_tenant_id', true)::UUID
    )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenant_audit_logs_tenant_id ON tenant_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_audit_logs_timestamp ON tenant_audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_tenant_audit_logs_action ON tenant_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_tenant_id ON compliance_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_type ON compliance_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_data_access_policies_tenant_id ON data_access_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_data_access_policies_resource ON data_access_policies(resource_type);

-- Insert default system tenants
INSERT INTO tenant_contexts (id, slug, name, tier, data_residency, compliance_level, isolation_mode)
VALUES 
    ('tenant-system'::UUID, 'system', 'System Tenant', 'enterprise', 'us-east-1', 'strict', 'dedicated'),
    ('tenant-demo'::UUID, 'demo', 'Demo Tenant', 'professional', 'us-east-1', 'standard', 'shared')
ON CONFLICT (slug) DO NOTHING;

-- Insert default isolation configs
INSERT INTO tenant_isolation_configs (
    tenant_id, enable_rls, enforce_data_residency, audit_all_queries,
    audit_logs_retention_days, gdpr_compliant, soc2_type2
)
VALUES 
    (
        'tenant-system'::UUID, true, true, true,
        2555, true, true  -- 7 years retention for system tenant
    ),
    (
        'tenant-demo'::UUID, true, false, false,
        365, false, false  -- 1 year retention for demo tenant
    )
ON CONFLICT (tenant_id) DO NOTHING;

-- Create function to set tenant context
CREATE OR REPLACE FUNCTION set_tenant_context(tenant_uuid UUID)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_tenant_id', tenant_uuid::text, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get current tenant context
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN current_setting('app.current_tenant_id', true)::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to validate tenant access
CREATE OR REPLACE FUNCTION validate_tenant_access(check_tenant_id UUID)
RETURNS boolean AS $$
DECLARE
    current_tenant UUID;
    tenant_active boolean;
BEGIN
    current_tenant := get_current_tenant_id();
    
    -- Check if tenant context matches
    IF current_tenant IS NULL OR current_tenant != check_tenant_id THEN
        RETURN false;
    END IF;
    
    -- Check if tenant is active
    SELECT enabled INTO tenant_active 
    FROM tenant_contexts 
    WHERE id = check_tenant_id;
    
    RETURN COALESCE(tenant_active, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
CREATE TRIGGER update_tenant_contexts_updated_at BEFORE UPDATE ON tenant_contexts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_tenant_isolation_configs_updated_at BEFORE UPDATE ON tenant_isolation_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_data_access_policies_updated_at BEFORE UPDATE ON data_access_policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_compliance_findings_updated_at BEFORE UPDATE ON compliance_findings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO PUBLIC;

-- Create view for tenant statistics
CREATE OR REPLACE VIEW tenant_statistics AS
SELECT 
    tc.id,
    tc.slug,
    tc.name,
    tc.tier,
    tc.compliance_level,
    tc.enabled,
    COUNT(DISTINCT tal.id) as audit_log_count,
    COUNT(DISTINCT cr.id) as compliance_report_count,
    MAX(tal.timestamp) as last_activity,
    tc.created_at
FROM tenant_contexts tc
LEFT JOIN tenant_audit_logs tal ON tc.id = tal.tenant_id
LEFT JOIN compliance_reports cr ON tc.id = cr.tenant_id
GROUP BY tc.id, tc.slug, tc.name, tc.tier, tc.compliance_level, tc.enabled, tc.created_at;

-- Comment the tables and important columns
COMMENT ON TABLE tenant_contexts IS 'Core tenant configuration and metadata';
COMMENT ON TABLE tenant_isolation_configs IS 'Tenant-specific isolation and compliance settings';
COMMENT ON TABLE data_access_policies IS 'Fine-grained access control policies per tenant';
COMMENT ON TABLE tenant_audit_logs IS 'Comprehensive audit trail for all tenant operations';
COMMENT ON TABLE compliance_reports IS 'Generated compliance reports for various standards';
COMMENT ON TABLE compliance_findings IS 'Individual compliance findings and remediation tracking';

COMMENT ON COLUMN tenant_contexts.data_residency IS 'AWS region where tenant data must reside';
COMMENT ON COLUMN tenant_contexts.compliance_level IS 'Required compliance level: standard, enhanced, strict';
COMMENT ON COLUMN tenant_contexts.isolation_mode IS 'Tenant isolation mode: shared, dedicated';
COMMENT ON COLUMN tenant_audit_logs.sql_query IS 'Sanitized SQL query for audit purposes';
COMMENT ON COLUMN tenant_audit_logs.execution_time IS 'Query execution time in milliseconds';
COMMENT ON COLUMN compliance_reports.overall_score IS 'Compliance score from 0-100';

-- Refresh the statistics view
REFRESH MATERIALIZED VIEW IF EXISTS tenant_statistics;