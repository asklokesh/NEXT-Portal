-- ============================================
-- GDPR COMPLIANCE AND DATA PROTECTION
-- Personal Data Management and Privacy Controls
-- ============================================

-- ============================================
-- PERSONAL DATA IDENTIFICATION AND CLASSIFICATION
-- ============================================

-- Create data classification enum
CREATE TYPE data_classification AS ENUM (
  'PUBLIC',           -- No privacy concerns
  'INTERNAL',         -- Internal business data
  'CONFIDENTIAL',     -- Confidential business data
  'PERSONAL',         -- Personal data under GDPR
  'SENSITIVE_PERSONAL', -- Special category personal data
  'RESTRICTED'        -- Highly restricted data
);

-- Create data retention policy table
CREATE TABLE IF NOT EXISTS data_retention_policies (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  data_type TEXT NOT NULL,
  classification data_classification NOT NULL,
  retention_period_days INTEGER NOT NULL,
  legal_basis TEXT NOT NULL, -- GDPR legal basis
  auto_deletion BOOLEAN DEFAULT TRUE,
  notification_before_deletion_days INTEGER DEFAULT 30,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default retention policies
INSERT INTO data_retention_policies (data_type, classification, retention_period_days, legal_basis, description) VALUES
('user_analytics', 'PERSONAL', 730, 'Legitimate Interest', 'User behavior analytics for service improvement'),
('user_preferences', 'PERSONAL', 2555, 'Contract', 'User preferences and settings'),
('audit_logs_user_actions', 'PERSONAL', 2555, 'Legal Obligation', 'Security and compliance audit logs'),
('plugin_usage_data', 'PERSONAL', 365, 'Legitimate Interest', 'Plugin usage analytics'),
('user_profile_data', 'PERSONAL', 2555, 'Contract', 'User profile information'),
('session_data', 'PERSONAL', 90, 'Contract', 'User session and authentication data'),
('error_logs_with_user_data', 'PERSONAL', 365, 'Legitimate Interest', 'Error logs containing user information'),
('support_tickets', 'PERSONAL', 2190, 'Contract', 'Customer support communications'),
('billing_data', 'PERSONAL', 2555, 'Legal Obligation', 'Billing and payment information'),
('consent_records', 'PERSONAL', 2555, 'Legal Obligation', 'GDPR consent management records');

-- ============================================
-- GDPR CONSENT MANAGEMENT
-- ============================================

-- Create consent categories
CREATE TYPE consent_category AS ENUM (
  'NECESSARY',          -- Strictly necessary cookies/processing
  'FUNCTIONAL',         -- Functionality and personalization
  'ANALYTICS',          -- Analytics and performance monitoring
  'MARKETING',          -- Marketing and advertising
  'THIRD_PARTY'         -- Third-party integrations
);

-- Create consent records table
CREATE TABLE IF NOT EXISTS user_consent_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  tenant_id TEXT,
  category consent_category NOT NULL,
  purpose TEXT NOT NULL,
  consent_given BOOLEAN NOT NULL,
  consent_method TEXT NOT NULL, -- 'explicit', 'implied', 'opt_out'
  consent_source TEXT, -- 'web_form', 'api', 'admin', 'import'
  ip_address INET,
  user_agent TEXT,
  consent_text TEXT, -- The actual consent text shown to user
  version TEXT NOT NULL DEFAULT '1.0',
  expires_at TIMESTAMP,
  withdrawn_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create consent history for audit trail
CREATE TABLE IF NOT EXISTS consent_history (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_record_id TEXT NOT NULL,
  action TEXT NOT NULL, -- 'granted', 'withdrawn', 'updated', 'expired'
  previous_value BOOLEAN,
  new_value BOOLEAN,
  reason TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (consent_record_id) REFERENCES user_consent_records(id) ON DELETE CASCADE
);

-- ============================================
-- DATA SUBJECT ACCESS REQUESTS (DSAR)
-- ============================================

-- Create DSAR request types
CREATE TYPE dsar_type AS ENUM (
  'ACCESS',           -- Right to access personal data
  'RECTIFICATION',    -- Right to rectify inaccurate data
  'ERASURE',          -- Right to be forgotten
  'PORTABILITY',      -- Right to data portability
  'RESTRICTION',      -- Right to restrict processing
  'OBJECTION'         -- Right to object to processing
);

CREATE TYPE dsar_status AS ENUM (
  'SUBMITTED',
  'ACKNOWLEDGED',
  'IN_PROGRESS',
  'COMPLETED',
  'REJECTED',
  'EXPIRED'
);

-- Create DSAR requests table
CREATE TABLE IF NOT EXISTS dsar_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number TEXT UNIQUE NOT NULL DEFAULT 'DSAR-' || to_char(NOW(), 'YYYY-MM-DD') || '-' || substring(gen_random_uuid()::text, 1, 8),
  user_id TEXT,
  requester_email TEXT NOT NULL,
  requester_name TEXT,
  tenant_id TEXT,
  request_type dsar_type NOT NULL,
  status dsar_status DEFAULT 'SUBMITTED',
  description TEXT,
  verification_method TEXT, -- 'email', 'id_document', 'security_questions'
  verified_at TIMESTAMP,
  verified_by TEXT,
  
  -- Request details
  data_categories TEXT[], -- What types of data are requested
  date_range_from TIMESTAMP,
  date_range_to TIMESTAMP,
  specific_systems TEXT[], -- Which systems to extract data from
  
  -- Processing details
  assigned_to TEXT,
  estimated_completion_date TIMESTAMP,
  actual_completion_date TIMESTAMP,
  
  -- Response details
  response_method TEXT, -- 'email', 'download_link', 'physical_mail'
  response_data JSONB, -- Links to data files, summaries, etc.
  rejection_reason TEXT,
  
  -- Legal and compliance
  legal_basis_for_processing TEXT,
  impact_assessment_required BOOLEAN DEFAULT FALSE,
  third_parties_notified TEXT[],
  
  -- Audit
  submitted_at TIMESTAMP DEFAULT NOW(),
  due_date TIMESTAMP DEFAULT NOW() + INTERVAL '30 days', -- GDPR 30-day response time
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create DSAR processing log
CREATE TABLE IF NOT EXISTS dsar_processing_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  dsar_request_id TEXT NOT NULL,
  action TEXT NOT NULL,
  performed_by TEXT,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (dsar_request_id) REFERENCES dsar_requests(id) ON DELETE CASCADE
);

-- ============================================
-- DATA MAPPING AND INVENTORY
-- ============================================

-- Create data mapping table for GDPR compliance
CREATE TABLE IF NOT EXISTS personal_data_mapping (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  column_name TEXT NOT NULL,
  data_category TEXT NOT NULL, -- 'identity', 'contact', 'profile', 'usage', 'technical'
  classification data_classification NOT NULL,
  contains_personal_data BOOLEAN NOT NULL,
  is_sensitive_personal_data BOOLEAN DEFAULT FALSE,
  purpose TEXT NOT NULL,
  legal_basis TEXT NOT NULL,
  retention_period_days INTEGER,
  encryption_required BOOLEAN DEFAULT FALSE,
  pseudonymization_required BOOLEAN DEFAULT FALSE,
  third_party_sharing BOOLEAN DEFAULT FALSE,
  third_parties TEXT[],
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(table_name, column_name)
);

-- Insert personal data mappings for our schema
INSERT INTO personal_data_mapping (table_name, column_name, data_category, classification, contains_personal_data, purpose, legal_basis, retention_period_days) VALUES
-- Users table
('users', 'email', 'identity', 'PERSONAL', true, 'User identification and communication', 'Contract', 2555),
('users', 'name', 'identity', 'PERSONAL', true, 'User identification', 'Contract', 2555),
('users', 'username', 'identity', 'PERSONAL', true, 'User identification', 'Contract', 2555),
('users', 'avatar', 'profile', 'PERSONAL', true, 'User profile customization', 'Contract', 2555),
('users', 'last_login', 'usage', 'PERSONAL', true, 'Security monitoring', 'Legitimate Interest', 730),

-- Plugin analytics
('plugin_analytics', 'user_id', 'usage', 'PERSONAL', true, 'Usage analytics and service improvement', 'Legitimate Interest', 365),
('plugin_analytics', 'session_id', 'technical', 'PERSONAL', true, 'Session tracking for analytics', 'Legitimate Interest', 90),
('plugin_analytics', 'ip_address', 'technical', 'PERSONAL', true, 'Security and fraud prevention', 'Legitimate Interest', 365),
('plugin_analytics', 'user_agent', 'technical', 'PERSONAL', true, 'Compatibility and optimization', 'Legitimate Interest', 365),
('plugin_analytics', 'country', 'usage', 'PERSONAL', true, 'Localization and service optimization', 'Legitimate Interest', 365),
('plugin_analytics', 'region', 'usage', 'PERSONAL', true, 'Localization and service optimization', 'Legitimate Interest', 365),

-- Audit logs
('audit_logs', 'user_id', 'usage', 'PERSONAL', true, 'Security monitoring and compliance', 'Legal Obligation', 2555),
('audit_logs', 'ip_address', 'technical', 'PERSONAL', true, 'Security monitoring', 'Legal Obligation', 2555),
('audit_logs', 'user_agent', 'technical', 'PERSONAL', true, 'Security monitoring', 'Legal Obligation', 2555),

-- Notifications
('notifications', 'user_id', 'usage', 'PERSONAL', true, 'User communication', 'Contract', 730),
('notification_settings', 'user_id', 'profile', 'PERSONAL', true, 'User preferences', 'Contract', 2555);

-- ============================================
-- GDPR COMPLIANCE FUNCTIONS
-- ============================================

-- Function to get all personal data for a user (for DSAR access requests)
CREATE OR REPLACE FUNCTION gdpr.get_user_personal_data(target_user_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB := '{}';
  mapping_record RECORD;
  table_data JSONB;
  query_text TEXT;
BEGIN
  -- Only allow access for admins or the user themselves
  IF NOT (auth.is_admin() OR auth.current_user_id() = target_user_id) THEN
    RAISE EXCEPTION 'Access denied: Insufficient permissions';
  END IF;
  
  -- Loop through all personal data mappings
  FOR mapping_record IN 
    SELECT DISTINCT table_name 
    FROM personal_data_mapping 
    WHERE contains_personal_data = true
  LOOP
    -- Build dynamic query to extract user data from each table
    query_text := format('
      SELECT row_to_json(t) 
      FROM (
        SELECT * FROM %I 
        WHERE user_id = %L 
           OR id = %L
           OR requested_by = %L
           OR approved_by = %L
           OR reviewed_by = %L
      ) t
    ', mapping_record.table_name, target_user_id, target_user_id, target_user_id, target_user_id, target_user_id);
    
    BEGIN
      EXECUTE query_text INTO table_data;
      IF table_data IS NOT NULL THEN
        result := jsonb_set(result, ARRAY[mapping_record.table_name], COALESCE(result->mapping_record.table_name, '[]'::jsonb) || table_data);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Skip tables that don't have the expected columns
      CONTINUE;
    END;
  END LOOP;
  
  -- Add metadata
  result := jsonb_set(result, '{metadata}', jsonb_build_object(
    'exported_at', NOW(),
    'exported_by', auth.current_user_id(),
    'user_id', target_user_id,
    'export_type', 'gdpr_dsar_access'
  ));
  
  RETURN result;
END;
$$;

-- Function to pseudonymize user data (for data minimization)
CREATE OR REPLACE FUNCTION gdpr.pseudonymize_user_data(target_user_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB := '{}';
  tables_updated TEXT[] := '{}';
  pseudo_id TEXT;
BEGIN
  -- Only allow for admins
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  -- Generate pseudonymous ID
  pseudo_id := 'pseudo_' || substring(md5(target_user_id || extract(epoch from now())::text), 1, 12);
  
  -- Pseudonymize data in key tables
  -- Update user email to pseudonymized version
  UPDATE users 
  SET email = pseudo_id || '@pseudonymized.local',
      name = 'Pseudonymized User',
      username = pseudo_id,
      avatar = NULL
  WHERE id = target_user_id;
  
  tables_updated := array_append(tables_updated, 'users');
  
  -- Update analytics data
  UPDATE plugin_analytics
  SET ip_address = '0.0.0.0'::inet,
      user_agent = 'Pseudonymized',
      country = 'XX',
      region = 'Pseudonymized'
  WHERE user_id = target_user_id;
  
  tables_updated := array_append(tables_updated, 'plugin_analytics');
  
  -- Update audit logs
  UPDATE audit_logs
  SET ip_address = '0.0.0.0'::inet,
      user_agent = 'Pseudonymized'
  WHERE user_id = target_user_id;
  
  tables_updated := array_append(tables_updated, 'audit_logs');
  
  result := jsonb_build_object(
    'pseudonymized_at', NOW(),
    'pseudonymized_by', auth.current_user_id(),
    'original_user_id', target_user_id,
    'pseudo_id', pseudo_id,
    'tables_updated', tables_updated
  );
  
  -- Log the pseudonymization
  INSERT INTO audit_logs (user_id, action, resource, resource_id, metadata)
  VALUES (auth.current_user_id(), 'pseudonymize', 'user', target_user_id, result);
  
  RETURN result;
END;
$$;

-- Function to delete user data (for GDPR erasure/right to be forgotten)
CREATE OR REPLACE FUNCTION gdpr.delete_user_data(
  target_user_id TEXT,
  deletion_type TEXT DEFAULT 'soft', -- 'soft', 'hard', 'anonymize'
  reason TEXT DEFAULT 'gdpr_erasure'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB := '{}';
  tables_affected TEXT[] := '{}';
  deletion_summary JSONB := '{}';
BEGIN
  -- Only allow for admins or the user themselves
  IF NOT (auth.is_admin() OR auth.current_user_id() = target_user_id) THEN
    RAISE EXCEPTION 'Access denied: Insufficient permissions';
  END IF;
  
  -- Create deletion record first
  INSERT INTO audit_logs (user_id, action, resource, resource_id, metadata)
  VALUES (auth.current_user_id(), 'gdpr_deletion_start', 'user', target_user_id, 
          jsonb_build_object('deletion_type', deletion_type, 'reason', reason));
  
  CASE deletion_type
    WHEN 'soft' THEN
      -- Soft delete: mark as deleted but keep for legal/business requirements
      UPDATE users 
      SET is_active = false,
          email = target_user_id || '@deleted.local',
          name = 'Deleted User',
          avatar = NULL,
          updated_at = NOW()
      WHERE id = target_user_id;
      
      tables_affected := array_append(tables_affected, 'users');
      
    WHEN 'anonymize' THEN
      -- Anonymize: remove personal identifiers but keep statistical data
      PERFORM gdpr.pseudonymize_user_data(target_user_id);
      tables_affected := array_append(tables_affected, 'users');
      tables_affected := array_append(tables_affected, 'plugin_analytics');
      tables_affected := array_append(tables_affected, 'audit_logs');
      
    WHEN 'hard' THEN
      -- Hard delete: actually remove data (use with caution)
      
      -- Delete user consent records
      DELETE FROM user_consent_records WHERE user_id = target_user_id;
      tables_affected := array_append(tables_affected, 'user_consent_records');
      
      -- Delete analytics data
      DELETE FROM plugin_analytics WHERE user_id = target_user_id;
      tables_affected := array_append(tables_affected, 'plugin_analytics');
      
      -- Delete notifications
      DELETE FROM notifications WHERE user_id = target_user_id;
      DELETE FROM notification_settings WHERE user_id = target_user_id;
      tables_affected := array_append(tables_affected, 'notifications');
      tables_affected := array_append(tables_affected, 'notification_settings');
      
      -- Delete sessions
      DELETE FROM sessions WHERE user_id = target_user_id;
      DELETE FROM api_keys WHERE user_id = target_user_id;
      tables_affected := array_append(tables_affected, 'sessions');
      tables_affected := array_append(tables_affected, 'api_keys');
      
      -- Remove from teams (but keep team structure)
      DELETE FROM team_members WHERE user_id = target_user_id;
      tables_affected := array_append(tables_affected, 'team_members');
      
      -- Finally delete user record
      DELETE FROM users WHERE id = target_user_id;
      tables_affected := array_append(tables_affected, 'users');
      
  END CASE;
  
  result := jsonb_build_object(
    'deleted_at', NOW(),
    'deleted_by', auth.current_user_id(),
    'user_id', target_user_id,
    'deletion_type', deletion_type,
    'reason', reason,
    'tables_affected', tables_affected
  );
  
  -- Log completion
  INSERT INTO audit_logs (user_id, action, resource, resource_id, metadata)
  VALUES (auth.current_user_id(), 'gdpr_deletion_completed', 'user', target_user_id, result);
  
  RETURN result;
END;
$$;

-- Function to check consent status
CREATE OR REPLACE FUNCTION gdpr.check_user_consent(
  target_user_id TEXT,
  consent_category consent_category
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT consent_given 
     FROM user_consent_records 
     WHERE user_id = target_user_id 
       AND category = consent_category
       AND (expires_at IS NULL OR expires_at > NOW())
       AND withdrawn_at IS NULL
     ORDER BY created_at DESC 
     LIMIT 1),
    CASE 
      WHEN consent_category = 'NECESSARY' THEN true
      ELSE false
    END
  );
$$;

-- Function to record consent
CREATE OR REPLACE FUNCTION gdpr.record_consent(
  target_user_id TEXT,
  consent_category consent_category,
  purpose_text TEXT,
  consent_given BOOLEAN,
  consent_method TEXT DEFAULT 'explicit',
  consent_source TEXT DEFAULT 'web_form',
  consent_text TEXT DEFAULT NULL,
  version TEXT DEFAULT '1.0'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  consent_id TEXT;
  existing_record RECORD;
BEGIN
  -- Check for existing consent record
  SELECT * INTO existing_record
  FROM user_consent_records
  WHERE user_id = target_user_id
    AND category = consent_category
    AND withdrawn_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- If consent is being withdrawn, update existing record
  IF existing_record IS NOT NULL AND NOT consent_given THEN
    UPDATE user_consent_records
    SET withdrawn_at = NOW(),
        updated_at = NOW()
    WHERE id = existing_record.id;
    
    consent_id := existing_record.id;
  ELSE
    -- Create new consent record
    INSERT INTO user_consent_records (
      user_id, tenant_id, category, purpose, consent_given,
      consent_method, consent_source, ip_address, user_agent,
      consent_text, version
    ) VALUES (
      target_user_id,
      auth.current_tenant_id(),
      consent_category,
      purpose_text,
      consent_given,
      consent_method,
      consent_source,
      inet_client_addr(),
      current_setting('app.user_agent', true),
      consent_text,
      version
    )
    RETURNING id INTO consent_id;
  END IF;
  
  -- Record in consent history
  INSERT INTO consent_history (
    consent_record_id, action, previous_value, new_value,
    ip_address, user_agent
  ) VALUES (
    consent_id,
    CASE WHEN consent_given THEN 'granted' ELSE 'withdrawn' END,
    COALESCE(existing_record.consent_given, NULL),
    consent_given,
    inet_client_addr(),
    current_setting('app.user_agent', true)
  );
  
  RETURN consent_id;
END;
$$;

-- ============================================
-- AUTOMATED DATA RETENTION AND DELETION
-- ============================================

-- Function to identify data eligible for automatic deletion
CREATE OR REPLACE FUNCTION gdpr.identify_expired_data()
RETURNS TABLE (
  table_name TEXT,
  data_type TEXT,
  retention_period_days INTEGER,
  expired_records BIGINT,
  oldest_record_age_days INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This is a simplified implementation
  -- In production, you'd want more sophisticated queries for each data type
  
  RETURN QUERY
  SELECT 
    pdm.table_name::TEXT,
    drp.data_type::TEXT,
    drp.retention_period_days,
    0::BIGINT as expired_records, -- Would be calculated with proper queries
    0 as oldest_record_age_days   -- Would be calculated with proper queries
  FROM personal_data_mapping pdm
  JOIN data_retention_policies drp ON pdm.data_category = drp.data_type
  WHERE drp.auto_deletion = true;
END;
$$;

-- Function to perform automatic data cleanup
CREATE OR REPLACE FUNCTION gdpr.cleanup_expired_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cleanup_results JSONB := '{}';
  cleanup_summary JSONB;
BEGIN
  -- Clean up old analytics data
  DELETE FROM plugin_analytics 
  WHERE timestamp < NOW() - INTERVAL '365 days';
  
  GET DIAGNOSTICS cleanup_summary = ROW_COUNT;
  cleanup_results := jsonb_set(cleanup_results, '{plugin_analytics_deleted}', to_jsonb(cleanup_summary));
  
  -- Clean up old session data
  DELETE FROM sessions 
  WHERE created_at < NOW() - INTERVAL '90 days'
    OR (expires_at < NOW() AND is_active = false);
    
  GET DIAGNOSTICS cleanup_summary = ROW_COUNT;
  cleanup_results := jsonb_set(cleanup_results, '{sessions_deleted}', to_jsonb(cleanup_summary));
  
  -- Clean up expired consent records
  UPDATE user_consent_records 
  SET withdrawn_at = NOW()
  WHERE expires_at < NOW() AND withdrawn_at IS NULL;
  
  GET DIAGNOSTICS cleanup_summary = ROW_COUNT;
  cleanup_results := jsonb_set(cleanup_results, '{expired_consents}', to_jsonb(cleanup_summary));
  
  -- Add cleanup timestamp
  cleanup_results := jsonb_set(cleanup_results, '{cleanup_performed_at}', to_jsonb(NOW()));
  
  -- Log the cleanup
  INSERT INTO audit_logs (user_id, action, resource, metadata)
  VALUES ('system', 'gdpr_automated_cleanup', 'system', cleanup_results);
  
  RETURN cleanup_results;
END;
$$;

-- ============================================
-- GDPR REPORTING FUNCTIONS
-- ============================================

-- Function to generate GDPR compliance report
CREATE OR REPLACE FUNCTION gdpr.compliance_report()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'report_generated_at', NOW(),
    'total_users', (SELECT COUNT(*) FROM users WHERE is_active = true),
    'total_personal_data_fields', (SELECT COUNT(*) FROM personal_data_mapping WHERE contains_personal_data = true),
    'consent_statistics', (
      SELECT jsonb_object_agg(category, stats)
      FROM (
        SELECT 
          category,
          jsonb_build_object(
            'total_records', COUNT(*),
            'active_consents', COUNT(*) FILTER (WHERE consent_given = true AND withdrawn_at IS NULL),
            'withdrawn_consents', COUNT(*) FILTER (WHERE withdrawn_at IS NOT NULL)
          ) as stats
        FROM user_consent_records
        GROUP BY category
      ) consent_stats
    ),
    'dsar_statistics', (
      SELECT jsonb_build_object(
        'total_requests', COUNT(*),
        'pending_requests', COUNT(*) FILTER (WHERE status IN ('SUBMITTED', 'ACKNOWLEDGED', 'IN_PROGRESS')),
        'completed_requests', COUNT(*) FILTER (WHERE status = 'COMPLETED'),
        'overdue_requests', COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('COMPLETED', 'REJECTED'))
      )
      FROM dsar_requests
      WHERE submitted_at >= NOW() - INTERVAL '12 months'
    ),
    'data_retention_compliance', (
      SELECT jsonb_build_object(
        'total_policies', COUNT(*),
        'auto_deletion_enabled', COUNT(*) FILTER (WHERE auto_deletion = true)
      )
      FROM data_retention_policies
    )
  );
$$;

-- ============================================
-- GDPR TRIGGERS AND AUTOMATION
-- ============================================

-- Trigger function to log GDPR-relevant events
CREATE OR REPLACE FUNCTION gdpr.log_personal_data_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Log when personal data is accessed
  IF TG_OP = 'SELECT' AND auth.current_user_id() != '' THEN
    INSERT INTO audit_logs (user_id, action, resource, resource_id, metadata)
    VALUES (
      auth.current_user_id(),
      'personal_data_access',
      TG_TABLE_NAME,
      COALESCE(NEW.id, OLD.id),
      jsonb_build_object(
        'operation', TG_OP,
        'gdpr_event', true,
        'accessed_at', NOW()
      )
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers for GDPR logging on key tables
-- (You would add these to tables containing personal data)

-- ============================================
-- INDEXES FOR GDPR OPERATIONS
-- ============================================

-- Indexes for consent management
CREATE INDEX IF NOT EXISTS idx_consent_records_user_category ON user_consent_records(user_id, category);
CREATE INDEX IF NOT EXISTS idx_consent_records_expires ON user_consent_records(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_consent_records_withdrawn ON user_consent_records(withdrawn_at) WHERE withdrawn_at IS NOT NULL;

-- Indexes for DSAR operations
CREATE INDEX IF NOT EXISTS idx_dsar_requests_status ON dsar_requests(status);
CREATE INDEX IF NOT EXISTS idx_dsar_requests_due_date ON dsar_requests(due_date);
CREATE INDEX IF NOT EXISTS idx_dsar_requests_user_email ON dsar_requests(requester_email);

-- Indexes for data retention
CREATE INDEX IF NOT EXISTS idx_plugin_analytics_timestamp ON plugin_analytics(timestamp);
CREATE INDEX IF NOT EXISTS idx_sessions_created_expires ON sessions(created_at, expires_at);

-- ============================================
-- GDPR VIEWS FOR EASY ACCESS
-- ============================================

-- View for active consents
CREATE OR REPLACE VIEW gdpr.active_consents AS
SELECT 
  ucr.*,
  u.email,
  u.name
FROM user_consent_records ucr
JOIN users u ON ucr.user_id = u.id
WHERE ucr.consent_given = true
  AND ucr.withdrawn_at IS NULL
  AND (ucr.expires_at IS NULL OR ucr.expires_at > NOW());

-- View for pending DSAR requests
CREATE OR REPLACE VIEW gdpr.pending_dsar_requests AS
SELECT *
FROM dsar_requests
WHERE status IN ('SUBMITTED', 'ACKNOWLEDGED', 'IN_PROGRESS')
  AND due_date > NOW()
ORDER BY submitted_at ASC;

-- View for overdue DSAR requests
CREATE OR REPLACE VIEW gdpr.overdue_dsar_requests AS
SELECT *
FROM dsar_requests
WHERE status IN ('SUBMITTED', 'ACKNOWLEDGED', 'IN_PROGRESS')
  AND due_date <= NOW()
ORDER BY due_date ASC;

-- ============================================
-- COMMENTS AND DOCUMENTATION
-- ============================================

COMMENT ON TABLE data_retention_policies IS 'Defines retention periods and policies for different types of personal data under GDPR';
COMMENT ON TABLE user_consent_records IS 'Records user consent for different categories of data processing under GDPR';
COMMENT ON TABLE dsar_requests IS 'Manages Data Subject Access Requests under GDPR Articles 15-22';
COMMENT ON TABLE personal_data_mapping IS 'Maps database fields that contain personal data for GDPR compliance';

COMMENT ON FUNCTION gdpr.get_user_personal_data(TEXT) IS 'Extracts all personal data for a user to fulfill GDPR access requests';
COMMENT ON FUNCTION gdpr.delete_user_data(TEXT, TEXT, TEXT) IS 'Implements right to be forgotten with different deletion strategies';
COMMENT ON FUNCTION gdpr.check_user_consent(TEXT, consent_category) IS 'Checks if user has given valid consent for a specific category';
COMMENT ON FUNCTION gdpr.record_consent(TEXT, consent_category, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT) IS 'Records user consent with full audit trail';
COMMENT ON FUNCTION gdpr.compliance_report() IS 'Generates comprehensive GDPR compliance report';

-- Grant permissions to GDPR compliance role
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO gdpr_compliance_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gdpr TO gdpr_compliance_role;