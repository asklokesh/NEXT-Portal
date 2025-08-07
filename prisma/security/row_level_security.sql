-- ============================================
-- ROW LEVEL SECURITY (RLS) IMPLEMENTATION
-- Multi-Tenant Data Security Framework
-- ============================================

-- Enable Row Level Security extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- SECURITY CONTEXT AND ROLES
-- ============================================

-- Create security context function to get current user context
CREATE OR REPLACE FUNCTION auth.current_user_context()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    current_setting('app.current_user_context', true)::jsonb,
    '{}'::jsonb
  );
$$;

-- Function to get current user ID
CREATE OR REPLACE FUNCTION auth.current_user_id()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (auth.current_user_context() ->> 'user_id'),
    ''
  );
$$;

-- Function to get current tenant ID
CREATE OR REPLACE FUNCTION auth.current_tenant_id()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (auth.current_user_context() ->> 'tenant_id'),
    ''
  );
$$;

-- Function to get current user role
CREATE OR REPLACE FUNCTION auth.current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (auth.current_user_context() ->> 'role'),
    'VIEWER'
  );
$$;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT auth.current_user_role() = 'ADMIN';
$$;

-- Function to check if user is platform engineer
CREATE OR REPLACE FUNCTION auth.is_platform_engineer()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT auth.current_user_role() IN ('ADMIN', 'PLATFORM_ENGINEER');
$$;

-- Function to get user's accessible tenant IDs
CREATE OR REPLACE FUNCTION auth.accessible_tenant_ids()
RETURNS text[]
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT CASE
    WHEN auth.is_admin() THEN
      ARRAY(SELECT DISTINCT id FROM organizations WHERE status = 'ACTIVE')
    ELSE
      ARRAY[auth.current_tenant_id()]
  END;
$$;

-- ============================================
-- PLUGIN ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on plugins table
ALTER TABLE plugins ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see plugins from their tenant or public plugins
CREATE POLICY plugin_tenant_access ON plugins
  FOR SELECT
  USING (
    -- Admin can see all plugins
    auth.is_admin() OR
    -- User can see plugins from their tenant
    tenant_id = auth.current_tenant_id() OR
    -- Public plugins are visible to all authenticated users
    tenant_scope = 'PUBLIC' OR
    -- Plugins explicitly shared with user's tenant
    (tenant_scope = 'RESTRICTED' AND 
     tenant_id = ANY(auth.accessible_tenant_ids()))
  );

-- Policy: Only platform engineers and admins can create plugins
CREATE POLICY plugin_create ON plugins
  FOR INSERT
  WITH CHECK (
    auth.is_platform_engineer() AND
    (tenant_id = auth.current_tenant_id() OR auth.is_admin())
  );

-- Policy: Users can only update plugins they own or have permissions for
CREATE POLICY plugin_update ON plugins
  FOR UPDATE
  USING (
    auth.is_admin() OR
    (auth.is_platform_engineer() AND tenant_id = auth.current_tenant_id()) OR
    -- Check if user has explicit update permission
    EXISTS (
      SELECT 1 FROM permissions p
      JOIN team_members tm ON p.team_id = tm.team_id
      WHERE tm.user_id = auth.current_user_id()
        AND p.resource = 'plugin'
        AND p.action = 'write'
        AND (p.scope->>'plugin_id' = plugins.id::text OR p.scope IS NULL)
    )
  )
  WITH CHECK (
    -- Ensure tenant_id doesn't change unless admin
    (tenant_id = auth.current_tenant_id() OR auth.is_admin())
  );

-- Policy: Only admins and platform engineers can delete plugins
CREATE POLICY plugin_delete ON plugins
  FOR DELETE
  USING (
    auth.is_admin() OR
    (auth.is_platform_engineer() AND tenant_id = auth.current_tenant_id())
  );

-- ============================================
-- PLUGIN VERSION ROW LEVEL SECURITY
-- ============================================

ALTER TABLE plugin_versions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see versions of plugins they can access
CREATE POLICY plugin_version_access ON plugin_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plugins p
      WHERE p.id = plugin_versions.plugin_id
        AND (
          auth.is_admin() OR
          p.tenant_id = auth.current_tenant_id() OR
          p.tenant_scope = 'PUBLIC'
        )
    )
  );

-- Policy: Only authorized users can create plugin versions
CREATE POLICY plugin_version_create ON plugin_versions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM plugins p
      WHERE p.id = plugin_versions.plugin_id
        AND (
          auth.is_admin() OR
          (auth.is_platform_engineer() AND p.tenant_id = auth.current_tenant_id())
        )
    )
  );

-- Policy: Update versions with proper permissions
CREATE POLICY plugin_version_update ON plugin_versions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM plugins p
      WHERE p.id = plugin_versions.plugin_id
        AND (
          auth.is_admin() OR
          (auth.is_platform_engineer() AND p.tenant_id = auth.current_tenant_id())
        )
    )
  );

-- ============================================
-- PLUGIN GOVERNANCE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE plugin_governance ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see governance rules for their tenant
CREATE POLICY plugin_governance_access ON plugin_governance
  FOR SELECT
  USING (
    auth.is_admin() OR
    tenant_id = auth.current_tenant_id()
  );

-- Policy: Only platform engineers can manage governance
CREATE POLICY plugin_governance_manage ON plugin_governance
  FOR ALL
  USING (
    auth.is_admin() OR
    (auth.is_platform_engineer() AND tenant_id = auth.current_tenant_id())
  )
  WITH CHECK (
    auth.is_admin() OR
    (auth.is_platform_engineer() AND tenant_id = auth.current_tenant_id())
  );

-- ============================================
-- PLUGIN APPROVALS ROW LEVEL SECURITY
-- ============================================

ALTER TABLE plugin_approvals ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see approvals they requested or are assigned to review
CREATE POLICY plugin_approval_access ON plugin_approvals
  FOR SELECT
  USING (
    auth.is_admin() OR
    requested_by = auth.current_user_id() OR
    approved_by = auth.current_user_id() OR
    reviewed_by = auth.current_user_id() OR
    -- User is in the approvers list for the governance policy
    EXISTS (
      SELECT 1 FROM plugin_governance pg
      WHERE pg.id = plugin_approvals.governance_id
        AND pg.tenant_id = auth.current_tenant_id()
        AND auth.current_user_id() = ANY(pg.approvers || pg.reviewers)
    )
  );

-- Policy: Users can create approvals for plugins in their tenant
CREATE POLICY plugin_approval_create ON plugin_approvals
  FOR INSERT
  WITH CHECK (
    requested_by = auth.current_user_id() AND
    EXISTS (
      SELECT 1 FROM plugin_governance pg
      WHERE pg.id = plugin_approvals.governance_id
        AND pg.tenant_id = auth.current_tenant_id()
    )
  );

-- Policy: Only authorized users can update approvals
CREATE POLICY plugin_approval_update ON plugin_approvals
  FOR UPDATE
  USING (
    auth.is_admin() OR
    -- Approvers can approve/reject
    (auth.current_user_id() = approved_by AND approved_by IS NOT NULL) OR
    -- Reviewers can review
    (auth.current_user_id() = reviewed_by AND reviewed_by IS NOT NULL) OR
    -- User is in approvers list
    EXISTS (
      SELECT 1 FROM plugin_governance pg
      WHERE pg.id = plugin_approvals.governance_id
        AND auth.current_user_id() = ANY(pg.approvers || pg.reviewers)
    )
  );

-- ============================================
-- PLUGIN ANALYTICS ROW LEVEL SECURITY
-- ============================================

ALTER TABLE plugin_analytics ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see analytics for plugins in their tenant
CREATE POLICY plugin_analytics_access ON plugin_analytics
  FOR SELECT
  USING (
    auth.is_admin() OR
    tenant_id = auth.current_tenant_id() OR
    -- Users can see their own analytics
    user_id = auth.current_user_id() OR
    -- Analytics for public plugins
    EXISTS (
      SELECT 1 FROM plugins p
      WHERE p.id = plugin_analytics.plugin_id
        AND p.tenant_scope = 'PUBLIC'
    )
  );

-- Policy: Analytics can be inserted for accessible plugins
CREATE POLICY plugin_analytics_insert ON plugin_analytics
  FOR INSERT
  WITH CHECK (
    tenant_id = auth.current_tenant_id() OR
    auth.is_admin() OR
    EXISTS (
      SELECT 1 FROM plugins p
      WHERE p.id = plugin_analytics.plugin_id
        AND (p.tenant_id = auth.current_tenant_id() OR p.tenant_scope = 'PUBLIC')
    )
  );

-- ============================================
-- PLUGIN PERFORMANCE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE plugin_performance ENABLE ROW LEVEL SECURITY;

-- Policy: Performance data access based on plugin access
CREATE POLICY plugin_performance_access ON plugin_performance
  FOR SELECT
  USING (
    auth.is_admin() OR
    EXISTS (
      SELECT 1 FROM plugins p
      WHERE p.id = plugin_performance.plugin_id
        AND (
          p.tenant_id = auth.current_tenant_id() OR
          p.tenant_scope = 'PUBLIC'
        )
    )
  );

-- Policy: Performance data can be inserted for accessible plugins
CREATE POLICY plugin_performance_insert ON plugin_performance
  FOR INSERT
  WITH CHECK (
    auth.is_admin() OR
    EXISTS (
      SELECT 1 FROM plugins p
      WHERE p.id = plugin_performance.plugin_id
        AND p.tenant_id = auth.current_tenant_id()
    )
  );

-- ============================================
-- PLUGIN VULNERABILITIES ROW LEVEL SECURITY
-- ============================================

ALTER TABLE plugin_vulnerabilities ENABLE ROW LEVEL SECURITY;

-- Policy: Vulnerability data access (security-sensitive)
CREATE POLICY plugin_vulnerability_access ON plugin_vulnerabilities
  FOR SELECT
  USING (
    auth.is_admin() OR
    auth.is_platform_engineer() OR
    -- Users can see vulnerabilities for plugins they can access
    EXISTS (
      SELECT 1 FROM plugins p
      WHERE p.id = plugin_vulnerabilities.plugin_id
        AND p.tenant_id = auth.current_tenant_id()
    )
  );

-- Policy: Only platform engineers and admins can manage vulnerabilities
CREATE POLICY plugin_vulnerability_manage ON plugin_vulnerabilities
  FOR ALL
  USING (
    auth.is_admin() OR
    auth.is_platform_engineer()
  )
  WITH CHECK (
    auth.is_admin() OR
    auth.is_platform_engineer()
  );

-- ============================================
-- PLUGIN ALERTS ROW LEVEL SECURITY
-- ============================================

ALTER TABLE plugin_alerts ENABLE ROW LEVEL SECURITY;

-- Policy: Alert access based on plugin ownership
CREATE POLICY plugin_alert_access ON plugin_alerts
  FOR SELECT
  USING (
    auth.is_admin() OR
    EXISTS (
      SELECT 1 FROM plugins p
      WHERE p.id = plugin_alerts.plugin_id
        AND p.tenant_id = auth.current_tenant_id()
    )
  );

-- Policy: Alerts can be created for tenant plugins
CREATE POLICY plugin_alert_create ON plugin_alerts
  FOR INSERT
  WITH CHECK (
    auth.is_admin() OR
    auth.is_platform_engineer() OR
    EXISTS (
      SELECT 1 FROM plugins p
      WHERE p.id = plugin_alerts.plugin_id
        AND p.tenant_id = auth.current_tenant_id()
    )
  );

-- Policy: Users can acknowledge/resolve their tenant's alerts
CREATE POLICY plugin_alert_update ON plugin_alerts
  FOR UPDATE
  USING (
    auth.is_admin() OR
    EXISTS (
      SELECT 1 FROM plugins p
      WHERE p.id = plugin_alerts.plugin_id
        AND p.tenant_id = auth.current_tenant_id()
    )
  );

-- ============================================
-- USER AND ORGANIZATION ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own profile and users in their organization
CREATE POLICY user_access ON users
  FOR SELECT
  USING (
    auth.is_admin() OR
    id = auth.current_user_id() OR
    -- Users in same organization (through team memberships)
    EXISTS (
      SELECT 1 FROM team_members tm1
      JOIN team_members tm2 ON tm1.team_id = tm2.team_id
      JOIN teams t ON tm1.team_id = t.id
      WHERE tm1.user_id = users.id
        AND tm2.user_id = auth.current_user_id()
    )
  );

-- Policy: Users can only update their own profile
CREATE POLICY user_update ON users
  FOR UPDATE
  USING (
    auth.is_admin() OR
    id = auth.current_user_id()
  )
  WITH CHECK (
    auth.is_admin() OR
    id = auth.current_user_id()
  );

-- ============================================
-- ORGANIZATION ROW LEVEL SECURITY
-- ============================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own organization
CREATE POLICY organization_access ON organizations
  FOR SELECT
  USING (
    auth.is_admin() OR
    id = auth.current_tenant_id()
  );

-- Policy: Only admins can modify organizations
CREATE POLICY organization_modify ON organizations
  FOR ALL
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

-- ============================================
-- AUDIT LOGGING ROW LEVEL SECURITY
-- ============================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see audit logs for their actions and their tenant's resources
CREATE POLICY audit_log_access ON audit_logs
  FOR SELECT
  USING (
    auth.is_admin() OR
    user_id = auth.current_user_id() OR
    -- Logs related to tenant resources
    (resource LIKE 'plugin%' AND 
     resource_id IN (
       SELECT id FROM plugins WHERE tenant_id = auth.current_tenant_id()
     ))
  );

-- Policy: Audit logs are system-generated only
CREATE POLICY audit_log_insert ON audit_logs
  FOR INSERT
  WITH CHECK (true); -- System can always insert audit logs

-- No update/delete policies - audit logs are immutable

-- ============================================
-- SECURITY HELPER FUNCTIONS
-- ============================================

-- Function to check if user has specific permission
CREATE OR REPLACE FUNCTION auth.has_permission(
  resource_name text,
  action_name text,
  resource_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM permissions p
    JOIN team_members tm ON p.team_id = tm.team_id
    WHERE tm.user_id = auth.current_user_id()
      AND p.resource = resource_name
      AND p.action = action_name
      AND (
        resource_id IS NULL OR
        p.scope->>'resource_id' = resource_id OR
        p.scope IS NULL
      )
  ) OR auth.is_admin();
$$;

-- Function to get user's team IDs
CREATE OR REPLACE FUNCTION auth.user_team_ids()
RETURNS text[]
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT array_agg(team_id::text)
  FROM team_members
  WHERE user_id = auth.current_user_id();
$$;

-- Function to check team membership
CREATE OR REPLACE FUNCTION auth.is_team_member(team_id_param text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT team_id_param = ANY(auth.user_team_ids()) OR auth.is_admin();
$$;

-- Function to set user context (to be called by application)
CREATE OR REPLACE FUNCTION auth.set_user_context(
  user_id text,
  tenant_id text,
  user_role text,
  additional_context jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  context jsonb;
BEGIN
  context := jsonb_build_object(
    'user_id', user_id,
    'tenant_id', tenant_id,
    'role', user_role,
    'set_at', extract(epoch from now()),
    'additional', additional_context
  );
  
  PERFORM set_config('app.current_user_context', context::text, true);
END;
$$;

-- Function to clear user context
CREATE OR REPLACE FUNCTION auth.clear_user_context()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT set_config('app.current_user_context', '', true);
$$;

-- ============================================
-- DATA MASKING AND ENCRYPTION
-- ============================================

-- Function to mask sensitive data for non-authorized users
CREATE OR REPLACE FUNCTION auth.mask_sensitive_data(
  data text,
  mask_char text DEFAULT '*'
)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT CASE
    WHEN auth.is_admin() OR auth.is_platform_engineer() THEN data
    WHEN data IS NULL OR data = '' THEN data
    ELSE regexp_replace(data, '.', mask_char, 'g')
  END;
$$;

-- Function to encrypt sensitive configuration data
CREATE OR REPLACE FUNCTION auth.encrypt_config(config_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb := config_data;
  sensitive_keys text[] := ARRAY['password', 'secret', 'key', 'token', 'api_key'];
  key_name text;
BEGIN
  -- Only encrypt if user is not admin/platform engineer
  IF NOT (auth.is_admin() OR auth.is_platform_engineer()) THEN
    FOREACH key_name IN ARRAY sensitive_keys
    LOOP
      IF result ? key_name THEN
        result := jsonb_set(result, ARRAY[key_name], '"[ENCRYPTED]"'::jsonb);
      END IF;
    END LOOP;
  END IF;
  
  RETURN result;
END;
$$;

-- ============================================
-- RLS MONITORING AND DEBUGGING
-- ============================================

-- Function to check RLS status
CREATE OR REPLACE FUNCTION auth.rls_status()
RETURNS table(
  table_name text,
  rls_enabled boolean,
  policy_count bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    t.tablename::text,
    t.rowsecurity,
    COUNT(p.policyname)
  FROM pg_tables t
  LEFT JOIN pg_policies p ON t.tablename = p.tablename
  WHERE t.schemaname = 'public'
    AND t.tablename LIKE '%plugin%'
     OR t.tablename IN ('users', 'organizations', 'teams', 'audit_logs')
  GROUP BY t.tablename, t.rowsecurity
  ORDER BY t.tablename;
$$;

-- Function to test RLS policies (for debugging)
CREATE OR REPLACE FUNCTION auth.test_rls_access(
  test_user_id text,
  test_tenant_id text,
  test_role text DEFAULT 'DEVELOPER'
)
RETURNS table(
  table_name text,
  operation text,
  accessible_rows bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set test context
  PERFORM auth.set_user_context(test_user_id, test_tenant_id, test_role);
  
  -- Test access to key tables
  RETURN QUERY
  SELECT 'plugins'::text, 'SELECT'::text, COUNT(*)
  FROM plugins;
  
  RETURN QUERY
  SELECT 'plugin_versions'::text, 'SELECT'::text, COUNT(*)
  FROM plugin_versions;
  
  RETURN QUERY
  SELECT 'plugin_analytics'::text, 'SELECT'::text, COUNT(*)
  FROM plugin_analytics;
  
  -- Clear test context
  PERFORM auth.clear_user_context();
END;
$$;

-- ============================================
-- SECURITY AUDIT FUNCTIONS
-- ============================================

-- Function to log security events
CREATE OR REPLACE FUNCTION auth.log_security_event(
  event_type text,
  resource_type text,
  resource_id text,
  details jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO audit_logs (
    user_id,
    action,
    resource,
    resource_id,
    metadata,
    ip_address,
    user_agent,
    timestamp
  ) VALUES (
    auth.current_user_id(),
    event_type,
    resource_type,
    resource_id,
    jsonb_build_object(
      'security_event', true,
      'details', details,
      'tenant_id', auth.current_tenant_id(),
      'user_role', auth.current_user_role()
    ),
    inet_client_addr(),
    current_setting('app.user_agent', true),
    NOW()
  );
END;
$$;

-- Function to detect potential security violations
CREATE OR REPLACE FUNCTION auth.detect_security_violations()
RETURNS table(
  violation_type text,
  resource_id text,
  user_id text,
  details text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  -- Detect cross-tenant access attempts
  SELECT 
    'cross_tenant_access'::text,
    al.resource_id,
    al.user_id,
    format('User attempted to access resource from different tenant: %s', al.metadata->>'details')
  FROM audit_logs al
  WHERE al.timestamp > NOW() - INTERVAL '1 hour'
    AND al.metadata->>'security_event' = 'true'
    AND al.action LIKE '%unauthorized%'
  
  UNION ALL
  
  -- Detect privilege escalation attempts
  SELECT 
    'privilege_escalation'::text,
    al.resource_id,
    al.user_id,
    format('User attempted privilege escalation: %s', al.action)
  FROM audit_logs al
  WHERE al.timestamp > NOW() - INTERVAL '1 hour'
    AND al.action IN ('admin_access_attempt', 'platform_engineer_access_attempt')
    AND al.metadata->>'user_role' NOT IN ('ADMIN', 'PLATFORM_ENGINEER');
$$;

-- ============================================
-- COMMENTS AND DOCUMENTATION
-- ============================================

COMMENT ON FUNCTION auth.current_user_context() IS 'Returns the current user context set by the application';
COMMENT ON FUNCTION auth.current_user_id() IS 'Returns the current user ID from the security context';
COMMENT ON FUNCTION auth.current_tenant_id() IS 'Returns the current tenant ID from the security context';
COMMENT ON FUNCTION auth.has_permission(text, text, text) IS 'Checks if the current user has a specific permission';
COMMENT ON FUNCTION auth.set_user_context(text, text, text, jsonb) IS 'Sets the user security context (should be called by application on each request)';
COMMENT ON FUNCTION auth.mask_sensitive_data(text, text) IS 'Masks sensitive data for non-authorized users';
COMMENT ON FUNCTION auth.rls_status() IS 'Returns the RLS status for all relevant tables';
COMMENT ON FUNCTION auth.log_security_event(text, text, text, jsonb) IS 'Logs security-related events to the audit log';

-- Grant necessary permissions to application roles
GRANT EXECUTE ON FUNCTION auth.current_user_context() TO plugin_service_role;
GRANT EXECUTE ON FUNCTION auth.current_user_id() TO plugin_service_role;
GRANT EXECUTE ON FUNCTION auth.current_tenant_id() TO plugin_service_role;
GRANT EXECUTE ON FUNCTION auth.has_permission(text, text, text) TO plugin_service_role;
GRANT EXECUTE ON FUNCTION auth.set_user_context(text, text, text, jsonb) TO plugin_service_role;
GRANT EXECUTE ON FUNCTION auth.clear_user_context() TO plugin_service_role;
GRANT EXECUTE ON FUNCTION auth.log_security_event(text, text, text, jsonb) TO plugin_service_role;