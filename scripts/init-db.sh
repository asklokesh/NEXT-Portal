#!/bin/bash
set -e

# Create multiple databases
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE plugins;
    CREATE DATABASE workflows;
    CREATE DATABASE analytics;
    CREATE DATABASE audit;
    
    GRANT ALL PRIVILEGES ON DATABASE plugins TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE workflows TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE analytics TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE audit TO $POSTGRES_USER;
    
    -- Create tables for plugins database
    \c plugins;
    
    CREATE TABLE IF NOT EXISTS plugins (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        version VARCHAR(50) NOT NULL,
        description TEXT,
        author JSONB,
        metadata JSONB,
        status VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS installations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plugin_id UUID REFERENCES plugins(id),
        organization_id VARCHAR(255),
        environment VARCHAR(50),
        config JSONB,
        status VARCHAR(50),
        installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Create tables for workflows database
    \c workflows;
    
    CREATE TABLE IF NOT EXISTS workflows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        definition JSONB NOT NULL,
        status VARCHAR(50),
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS executions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id UUID REFERENCES workflows(id),
        status VARCHAR(50),
        input JSONB,
        output JSONB,
        error TEXT,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
    );
    
    -- Create tables for analytics database
    \c analytics;
    
    CREATE TABLE IF NOT EXISTS events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type VARCHAR(100) NOT NULL,
        source VARCHAR(100),
        data JSONB,
        user_id VARCHAR(255),
        session_id VARCHAR(255),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        metric_name VARCHAR(100) NOT NULL,
        value NUMERIC,
        tags JSONB,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Create tables for audit database
    \c audit;
    
    CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        level VARCHAR(50),
        event_type VARCHAR(100),
        actor JSONB,
        target JSONB,
        context JSONB,
        outcome JSONB,
        metadata JSONB,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp);
    CREATE INDEX idx_audit_event_type ON audit_logs(event_type);
    CREATE INDEX idx_audit_actor ON audit_logs USING GIN(actor);
EOSQL