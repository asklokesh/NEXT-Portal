-- Production PostgreSQL Initialization Script
-- Enhanced Plugin Management System

-- Create necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "hstore";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Create application schemas
CREATE SCHEMA IF NOT EXISTS plugins;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS governance;
CREATE SCHEMA IF NOT EXISTS monitoring;
CREATE SCHEMA IF NOT EXISTS security;

-- Create application roles
CREATE ROLE plugin_admin WITH LOGIN;
CREATE ROLE plugin_app WITH LOGIN;
CREATE ROLE plugin_reader WITH LOGIN;
CREATE ROLE plugin_analytics WITH LOGIN;
CREATE ROLE plugin_monitoring WITH LOGIN;

-- Grant schema permissions
GRANT ALL PRIVILEGES ON SCHEMA plugins TO plugin_admin;
GRANT ALL PRIVILEGES ON SCHEMA analytics TO plugin_admin;
GRANT ALL PRIVILEGES ON SCHEMA governance TO plugin_admin;
GRANT ALL PRIVILEGES ON SCHEMA monitoring TO plugin_admin;
GRANT ALL PRIVILEGES ON SCHEMA security TO plugin_admin;

-- Application user permissions
GRANT USAGE ON SCHEMA plugins TO plugin_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA plugins TO plugin_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA plugins TO plugin_app;

-- Analytics user permissions
GRANT USAGE ON SCHEMA analytics TO plugin_analytics;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA analytics TO plugin_analytics;

-- Reader permissions
GRANT USAGE ON SCHEMA plugins TO plugin_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA plugins TO plugin_reader;

-- Monitoring permissions
GRANT USAGE ON SCHEMA monitoring TO plugin_monitoring;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA monitoring TO plugin_monitoring;

-- Performance tuning settings
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;

-- Security settings
ALTER SYSTEM SET ssl = on;
ALTER SYSTEM SET log_connections = on;
ALTER SYSTEM SET log_disconnections = on;
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_duration = on;
ALTER SYSTEM SET log_min_duration_statement = 1000;

-- Create audit table
CREATE TABLE IF NOT EXISTS security.audit_log (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id varchar(255),
    action varchar(100) NOT NULL,
    resource varchar(100) NOT NULL,
    resource_id varchar(255),
    old_values jsonb,
    new_values jsonb,
    ip_address inet,
    user_agent text,
    timestamp timestamp with time zone DEFAULT now()
);

-- Create index on audit table
CREATE INDEX idx_audit_log_timestamp ON security.audit_log (timestamp);
CREATE INDEX idx_audit_log_user_id ON security.audit_log (user_id);
CREATE INDEX idx_audit_log_action ON security.audit_log (action);
CREATE INDEX idx_audit_log_resource ON security.audit_log (resource);

-- Row Level Security setup
ALTER TABLE security.audit_log ENABLE ROW LEVEL SECURITY;

-- Create audit function
CREATE OR REPLACE FUNCTION security.audit_trigger_function()
RETURNS trigger AS $$
BEGIN
    INSERT INTO security.audit_log (
        action,
        resource,
        resource_id,
        old_values,
        new_values
    ) VALUES (
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id::text, OLD.id::text),
        CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) END
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Monitoring views
CREATE OR REPLACE VIEW monitoring.database_performance AS
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation,
    most_common_vals,
    most_common_freqs
FROM pg_stats 
WHERE schemaname IN ('plugins', 'analytics', 'governance');

CREATE OR REPLACE VIEW monitoring.query_performance AS
SELECT 
    query,
    calls,
    total_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements 
ORDER BY total_time DESC;

-- Create replication user for read replicas
CREATE ROLE replication_user WITH REPLICATION LOGIN;

-- Create connection limits
ALTER ROLE plugin_admin CONNECTION LIMIT 20;
ALTER ROLE plugin_app CONNECTION LIMIT 100;
ALTER ROLE plugin_reader CONNECTION LIMIT 50;
ALTER ROLE plugin_analytics CONNECTION LIMIT 30;

-- Logging configuration
CREATE TABLE IF NOT EXISTS monitoring.slow_queries (
    id serial PRIMARY KEY,
    query_start timestamp with time zone,
    duration_ms integer,
    query text,
    database_name text,
    user_name text,
    client_addr inet,
    recorded_at timestamp with time zone DEFAULT now()
);

-- Performance monitoring function
CREATE OR REPLACE FUNCTION monitoring.record_slow_query(
    p_query_start timestamp with time zone,
    p_duration_ms integer,
    p_query text,
    p_database_name text,
    p_user_name text,
    p_client_addr inet
) RETURNS void AS $$
BEGIN
    INSERT INTO monitoring.slow_queries (
        query_start, duration_ms, query, database_name, user_name, client_addr
    ) VALUES (
        p_query_start, p_duration_ms, p_query, p_database_name, p_user_name, p_client_addr
    );
END;
$$ LANGUAGE plpgsql;

-- Grant monitoring permissions
GRANT SELECT ON monitoring.database_performance TO plugin_monitoring;
GRANT SELECT ON monitoring.query_performance TO plugin_monitoring;
GRANT SELECT, INSERT ON monitoring.slow_queries TO plugin_monitoring;
GRANT EXECUTE ON FUNCTION monitoring.record_slow_query TO plugin_monitoring;

COMMIT;