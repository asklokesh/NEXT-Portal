# Enterprise IDP Platform - Database Schema Documentation

## Table of Contents

1. [Database Overview](#database-overview)
2. [Core Schema](#core-schema)
3. [Plugin Management Schema](#plugin-management-schema)
4. [Service Catalog Schema](#service-catalog-schema)
5. [Analytics & Metrics Schema](#analytics--metrics-schema)
6. [Audit & Compliance Schema](#audit--compliance-schema)
7. [Performance Optimization](#performance-optimization)
8. [Data Governance](#data-governance)

---

## Database Overview

### Database Architecture

```yaml
Primary Database:
  Type: PostgreSQL 15
  Purpose: Transactional data, core entities
  Features:
    - ACID compliance
    - JSONB support for flexible schemas
    - Full-text search
    - Partitioning for large tables
    - Row-level security

Time-Series Database:
  Type: TimescaleDB
  Purpose: Metrics, monitoring data
  Features:
    - Hypertables for automatic partitioning
    - Continuous aggregates
    - Data retention policies
    - Compression

Document Store:
  Type: MongoDB
  Purpose: Unstructured data, logs
  Features:
    - Flexible schema
    - GridFS for large files
    - Change streams
    - Aggregation pipeline

Cache Layer:
  Type: Redis Cluster
  Purpose: Session store, query cache
  Features:
    - In-memory storage
    - Pub/Sub for real-time
    - Lua scripting
    - Cluster mode for HA

Search Engine:
  Type: Elasticsearch
  Purpose: Full-text search, analytics
  Features:
    - Inverted index
    - Faceted search
    - Aggregations
    - Machine learning

Vector Database:
  Type: Pinecone/Weaviate
  Purpose: AI/ML embeddings
  Features:
    - Semantic search
    - Similarity matching
    - Recommendation engine
```

---

## Core Schema

### Users Table

```sql
CREATE TABLE users (
    id VARCHAR(30) PRIMARY KEY DEFAULT generate_cuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(100) UNIQUE,
    avatar VARCHAR(500),
    provider VARCHAR(50) NOT NULL, -- github, google, saml, local
    provider_id VARCHAR(255) NOT NULL,
    password VARCHAR(255), -- Only for local provider, bcrypt hashed
    role user_role DEFAULT 'DEVELOPER',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    
    -- MFA fields
    mfa_enabled BOOLEAN DEFAULT false,
    mfa_secret VARCHAR(255), -- Encrypted TOTP secret
    mfa_method VARCHAR(20), -- TOTP, SMS, EMAIL
    mfa_backup_codes TEXT[], -- Encrypted backup codes
    phone_number VARCHAR(20), -- For SMS MFA
    
    -- Metadata
    preferences JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    
    -- Indexes
    INDEX idx_users_email (email),
    INDEX idx_users_username (username),
    INDEX idx_users_provider (provider, provider_id),
    INDEX idx_users_role (role),
    INDEX idx_users_active (is_active, deleted_at)
);

-- User role enum
CREATE TYPE user_role AS ENUM (
    'ADMIN',
    'PLATFORM_ENGINEER', 
    'DEVELOPER',
    'VIEWER'
);
```

### Teams Table

```sql
CREATE TABLE teams (
    id VARCHAR(30) PRIMARY KEY DEFAULT generate_cuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    avatar VARCHAR(500),
    parent_team_id VARCHAR(30) REFERENCES teams(id),
    
    -- Team settings
    settings JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    
    -- Indexes
    INDEX idx_teams_name (name),
    INDEX idx_teams_parent (parent_team_id),
    INDEX idx_teams_active (is_active, deleted_at)
);

-- Team members junction table
CREATE TABLE team_members (
    id VARCHAR(30) PRIMARY KEY DEFAULT generate_cuid(),
    user_id VARCHAR(30) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_id VARCHAR(30) NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    role team_role DEFAULT 'MEMBER',
    
    -- Timestamps
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(user_id, team_id),
    
    -- Indexes
    INDEX idx_team_members_user (user_id),
    INDEX idx_team_members_team (team_id),
    INDEX idx_team_members_role (role)
);

CREATE TYPE team_role AS ENUM ('OWNER', 'MAINTAINER', 'MEMBER');
```

### Sessions Table

```sql
CREATE TABLE sessions (
    id VARCHAR(30) PRIMARY KEY DEFAULT generate_cuid(),
    user_id VARCHAR(30) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) UNIQUE NOT NULL,
    refresh_token VARCHAR(500) UNIQUE,
    
    -- Session data
    ip_address INET,
    user_agent TEXT,
    device_id VARCHAR(100),
    device_name VARCHAR(255),
    
    -- Expiry
    expires_at TIMESTAMP NOT NULL,
    refresh_expires_at TIMESTAMP,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    revoked_at TIMESTAMP,
    revoked_reason VARCHAR(255),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_sessions_user (user_id),
    INDEX idx_sessions_token (token),
    INDEX idx_sessions_expires (expires_at),
    INDEX idx_sessions_active (is_active, expires_at)
);
```

### API Keys Table

```sql
CREATE TABLE api_keys (
    id VARCHAR(30) PRIMARY KEY DEFAULT generate_cuid(),
    user_id VARCHAR(30) REFERENCES users(id) ON DELETE CASCADE,
    team_id VARCHAR(30) REFERENCES teams(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) UNIQUE NOT NULL, -- SHA256 hash of the key
    key_prefix VARCHAR(10) NOT NULL, -- First 10 chars for identification
    
    -- Permissions
    scopes TEXT[] DEFAULT ARRAY['read'],
    rate_limit INTEGER DEFAULT 1000, -- Requests per hour
    
    -- Restrictions
    allowed_ips INET[],
    allowed_origins TEXT[],
    
    -- Usage tracking
    last_used_at TIMESTAMP,
    usage_count BIGINT DEFAULT 0,
    
    -- Expiry
    expires_at TIMESTAMP,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    revoked_at TIMESTAMP,
    revoked_reason VARCHAR(255),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_api_keys_user (user_id),
    INDEX idx_api_keys_team (team_id),
    INDEX idx_api_keys_prefix (key_prefix),
    INDEX idx_api_keys_active (is_active, expires_at),
    
    -- Constraints
    CHECK (user_id IS NOT NULL OR team_id IS NOT NULL)
);
```

---

## Plugin Management Schema

### Plugins Table

```sql
CREATE TABLE plugins (
    id VARCHAR(30) PRIMARY KEY DEFAULT generate_cuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    long_description TEXT,
    
    -- Version management
    current_version VARCHAR(50) NOT NULL,
    latest_version VARCHAR(50),
    
    -- Plugin metadata
    category VARCHAR(100),
    tags TEXT[],
    author JSONB,
    license VARCHAR(50),
    homepage VARCHAR(500),
    repository VARCHAR(500),
    documentation VARCHAR(500),
    
    -- Installation details
    install_count INTEGER DEFAULT 0,
    rating DECIMAL(2,1),
    rating_count INTEGER DEFAULT 0,
    
    -- Requirements
    requirements JSONB DEFAULT '{}',
    dependencies JSONB DEFAULT '[]',
    peer_dependencies JSONB DEFAULT '[]',
    
    -- Configuration
    config_schema JSONB,
    default_config JSONB DEFAULT '{}',
    
    -- Status
    status plugin_status DEFAULT 'available',
    is_featured BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    is_deprecated BOOLEAN DEFAULT false,
    
    -- Marketplace
    vendor_id VARCHAR(30),
    price JSONB, -- {model: 'free'|'paid'|'subscription', amount: 0, currency: 'USD'}
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP,
    deprecated_at TIMESTAMP,
    
    -- Indexes
    INDEX idx_plugins_name (name),
    INDEX idx_plugins_category (category),
    INDEX idx_plugins_status (status),
    INDEX idx_plugins_featured (is_featured),
    INDEX idx_plugins_tags (tags) USING GIN
);

CREATE TYPE plugin_status AS ENUM (
    'available',
    'installed',
    'installing',
    'updating',
    'disabled',
    'failed',
    'uninstalling'
);
```

### Plugin Installations Table

```sql
CREATE TABLE plugin_installations (
    id VARCHAR(30) PRIMARY KEY DEFAULT generate_cuid(),
    plugin_id VARCHAR(30) NOT NULL REFERENCES plugins(id),
    environment VARCHAR(50) NOT NULL, -- development, staging, production
    
    -- Version
    installed_version VARCHAR(50) NOT NULL,
    previous_version VARCHAR(50),
    
    -- Installation details
    installed_by VARCHAR(30) REFERENCES users(id),
    installation_method VARCHAR(50), -- ui, api, cli, auto
    
    -- Configuration
    config JSONB DEFAULT '{}',
    secrets JSONB DEFAULT '{}', -- Encrypted
    
    -- Health & Monitoring
    health_status health_status DEFAULT 'unknown',
    health_check_url VARCHAR(500),
    last_health_check TIMESTAMP,
    health_metrics JSONB DEFAULT '{}',
    
    -- Resource usage
    cpu_usage DECIMAL(5,2), -- Percentage
    memory_usage INTEGER, -- MB
    disk_usage INTEGER, -- MB
    
    -- Status
    is_enabled BOOLEAN DEFAULT true,
    
    -- Timestamps
    installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    disabled_at TIMESTAMP,
    uninstalled_at TIMESTAMP,
    
    -- Indexes
    INDEX idx_plugin_installations_plugin (plugin_id),
    INDEX idx_plugin_installations_env (environment),
    INDEX idx_plugin_installations_health (health_status),
    
    -- Constraints
    UNIQUE(plugin_id, environment)
);

CREATE TYPE health_status AS ENUM (
    'healthy',
    'degraded',
    'unhealthy',
    'unknown'
);
```

### Plugin Versions Table

```sql
CREATE TABLE plugin_versions (
    id VARCHAR(30) PRIMARY KEY DEFAULT generate_cuid(),
    plugin_id VARCHAR(30) NOT NULL REFERENCES plugins(id),
    version VARCHAR(50) NOT NULL,
    
    -- Version details
    changelog TEXT,
    release_notes TEXT,
    breaking_changes BOOLEAN DEFAULT false,
    
    -- Compatibility
    min_platform_version VARCHAR(50),
    max_platform_version VARCHAR(50),
    min_backstage_version VARCHAR(50),
    max_backstage_version VARCHAR(50),
    
    -- Security
    security_scan_status VARCHAR(50),
    vulnerabilities JSONB DEFAULT '[]',
    
    -- Package details
    package_url VARCHAR(500),
    package_size INTEGER, -- bytes
    checksum VARCHAR(255),
    
    -- Status
    is_stable BOOLEAN DEFAULT true,
    is_beta BOOLEAN DEFAULT false,
    is_deprecated BOOLEAN DEFAULT false,
    
    -- Timestamps
    released_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deprecated_at TIMESTAMP,
    
    -- Indexes
    INDEX idx_plugin_versions_plugin (plugin_id),
    INDEX idx_plugin_versions_version (version),
    INDEX idx_plugin_versions_released (released_at DESC),
    
    -- Constraints
    UNIQUE(plugin_id, version)
);
```

---

## Service Catalog Schema

### Services Table

```sql
CREATE TABLE services (
    id VARCHAR(30) PRIMARY KEY DEFAULT generate_cuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Classification
    type service_type NOT NULL,
    lifecycle lifecycle_stage DEFAULT 'production',
    tier VARCHAR(50), -- frontend, backend, data, infrastructure
    
    -- Ownership
    owner_id VARCHAR(30) REFERENCES users(id),
    team_id VARCHAR(30) REFERENCES teams(id),
    
    -- Technical details
    repository_url VARCHAR(500),
    documentation_url VARCHAR(500),
    api_spec_url VARCHAR(500),
    
    -- Metadata
    tags TEXT[],
    labels JSONB DEFAULT '{}',
    annotations JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    
    -- Health & Status
    health_status health_status DEFAULT 'unknown',
    health_check_url VARCHAR(500),
    last_health_check TIMESTAMP,
    
    -- Metrics
    sla JSONB DEFAULT '{}', -- {availability: 99.9, latency_p99: 500}
    metrics JSONB DEFAULT '{}',
    
    -- Dependencies
    depends_on TEXT[], -- Array of service IDs
    
    -- Compliance
    compliance_status JSONB DEFAULT '{}', -- {soc2: true, gdpr: true}
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    
    -- Indexes
    INDEX idx_services_name (name),
    INDEX idx_services_type (type),
    INDEX idx_services_lifecycle (lifecycle),
    INDEX idx_services_team (team_id),
    INDEX idx_services_owner (owner_id),
    INDEX idx_services_tags (tags) USING GIN,
    INDEX idx_services_metadata (metadata) USING GIN
);

CREATE TYPE service_type AS ENUM (
    'service',
    'website',
    'library',
    'application',
    'tool',
    'infrastructure'
);

CREATE TYPE lifecycle_stage AS ENUM (
    'experimental',
    'development', 
    'staging',
    'production',
    'deprecated'
);
```

### Service Relationships Table

```sql
CREATE TABLE service_relationships (
    id VARCHAR(30) PRIMARY KEY DEFAULT generate_cuid(),
    source_id VARCHAR(30) NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    target_id VARCHAR(30) NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    relationship_type relationship_type NOT NULL,
    
    -- Relationship metadata
    metadata JSONB DEFAULT '{}',
    strength DECIMAL(3,2), -- 0.00 to 1.00
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    validated_at TIMESTAMP,
    
    -- Indexes
    INDEX idx_service_relationships_source (source_id),
    INDEX idx_service_relationships_target (target_id),
    INDEX idx_service_relationships_type (relationship_type),
    
    -- Constraints
    UNIQUE(source_id, target_id, relationship_type),
    CHECK (source_id != target_id)
);

CREATE TYPE relationship_type AS ENUM (
    'depends_on',
    'consumed_by',
    'provides_api',
    'consumes_api',
    'deployed_with',
    'owned_by',
    'part_of'
);
```

### Service Deployments Table

```sql
CREATE TABLE service_deployments (
    id VARCHAR(30) PRIMARY KEY DEFAULT generate_cuid(),
    service_id VARCHAR(30) NOT NULL REFERENCES services(id),
    environment VARCHAR(50) NOT NULL,
    
    -- Deployment details
    version VARCHAR(50) NOT NULL,
    commit_sha VARCHAR(40),
    build_number VARCHAR(50),
    
    -- Deployment metadata
    deployed_by VARCHAR(30) REFERENCES users(id),
    deployment_method VARCHAR(50), -- manual, ci/cd, gitops
    
    -- Status
    status deployment_status NOT NULL,
    health_status health_status,
    
    -- Rollback information
    previous_version VARCHAR(50),
    can_rollback BOOLEAN DEFAULT true,
    
    -- Metrics
    startup_time INTEGER, -- seconds
    deployment_duration INTEGER, -- seconds
    
    -- Timestamps
    deployed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    rolled_back_at TIMESTAMP,
    
    -- Indexes
    INDEX idx_service_deployments_service (service_id),
    INDEX idx_service_deployments_env (environment),
    INDEX idx_service_deployments_status (status),
    INDEX idx_service_deployments_deployed (deployed_at DESC)
);

CREATE TYPE deployment_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'failed',
    'rolled_back'
);
```

---

## Analytics & Metrics Schema

### Metrics Table (TimescaleDB)

```sql
CREATE TABLE metrics (
    time TIMESTAMPTZ NOT NULL,
    metric_name VARCHAR(255) NOT NULL,
    metric_type VARCHAR(50) NOT NULL, -- counter, gauge, histogram
    
    -- Dimensions
    service_id VARCHAR(30),
    plugin_id VARCHAR(30),
    user_id VARCHAR(30),
    team_id VARCHAR(30),
    environment VARCHAR(50),
    
    -- Values
    value DOUBLE PRECISION NOT NULL,
    unit VARCHAR(50),
    
    -- Labels
    labels JSONB DEFAULT '{}',
    
    -- Create hypertable
    PRIMARY KEY (time, metric_name, service_id, plugin_id)
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('metrics', 'time');

-- Create indexes
CREATE INDEX idx_metrics_name ON metrics (metric_name, time DESC);
CREATE INDEX idx_metrics_service ON metrics (service_id, time DESC);
CREATE INDEX idx_metrics_plugin ON metrics (plugin_id, time DESC);

-- Create continuous aggregate for hourly metrics
CREATE MATERIALIZED VIEW metrics_hourly
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 hour', time) AS hour,
    metric_name,
    service_id,
    plugin_id,
    environment,
    AVG(value) as avg_value,
    MAX(value) as max_value,
    MIN(value) as min_value,
    COUNT(*) as sample_count
FROM metrics
GROUP BY hour, metric_name, service_id, plugin_id, environment;

-- Add retention policy (keep raw data for 30 days)
SELECT add_retention_policy('metrics', INTERVAL '30 days');

-- Add compression policy (compress data older than 7 days)
SELECT add_compression_policy('metrics', INTERVAL '7 days');
```

### Events Table

```sql
CREATE TABLE events (
    id VARCHAR(30) PRIMARY KEY DEFAULT generate_cuid(),
    event_type VARCHAR(255) NOT NULL,
    event_category VARCHAR(100),
    
    -- Context
    user_id VARCHAR(30) REFERENCES users(id),
    team_id VARCHAR(30) REFERENCES teams(id),
    service_id VARCHAR(30) REFERENCES services(id),
    plugin_id VARCHAR(30) REFERENCES plugins(id),
    
    -- Event data
    data JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    
    -- Source
    source VARCHAR(100), -- ui, api, system, webhook
    ip_address INET,
    user_agent TEXT,
    
    -- Timestamps
    occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    
    -- Indexes
    INDEX idx_events_type (event_type),
    INDEX idx_events_category (event_category),
    INDEX idx_events_user (user_id),
    INDEX idx_events_occurred (occurred_at DESC),
    INDEX idx_events_data (data) USING GIN
) PARTITION BY RANGE (occurred_at);

-- Create monthly partitions
CREATE TABLE events_2024_01 PARTITION OF events
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### Cost Tracking Table

```sql
CREATE TABLE cost_tracking (
    id VARCHAR(30) PRIMARY KEY DEFAULT generate_cuid(),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Resource identification
    resource_type VARCHAR(100) NOT NULL, -- compute, storage, network, service
    resource_id VARCHAR(255),
    service_id VARCHAR(30) REFERENCES services(id),
    team_id VARCHAR(30) REFERENCES teams(id),
    
    -- Cost details
    cost DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Usage metrics
    usage_amount DECIMAL(15,4),
    usage_unit VARCHAR(50),
    
    -- Cost allocation
    cost_center VARCHAR(100),
    project VARCHAR(100),
    tags JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_cost_tracking_period (period_start, period_end),
    INDEX idx_cost_tracking_service (service_id),
    INDEX idx_cost_tracking_team (team_id),
    INDEX idx_cost_tracking_resource (resource_type)
);
```

---

## Audit & Compliance Schema

### Audit Logs Table

```sql
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(30) REFERENCES users(id),
    
    -- Action details
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(255),
    resource_name VARCHAR(255),
    
    -- Changes
    old_value JSONB,
    new_value JSONB,
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(30),
    request_id VARCHAR(30),
    
    -- Result
    status VARCHAR(20) NOT NULL, -- success, failure, error
    error_message TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamp
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_audit_logs_user (user_id),
    INDEX idx_audit_logs_action (action),
    INDEX idx_audit_logs_resource (resource_type, resource_id),
    INDEX idx_audit_logs_created (created_at DESC),
    INDEX idx_audit_logs_status (status)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE audit_logs_2024_01 PARTITION OF audit_logs
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Archive old partitions to cold storage after 90 days
```

### Compliance Records Table

```sql
CREATE TABLE compliance_records (
    id VARCHAR(30) PRIMARY KEY DEFAULT generate_cuid(),
    framework VARCHAR(50) NOT NULL, -- SOC2, GDPR, HIPAA, ISO27001
    
    -- Compliance details
    control_id VARCHAR(100) NOT NULL,
    control_name VARCHAR(255),
    control_description TEXT,
    
    -- Assessment
    status compliance_status NOT NULL,
    evidence JSONB DEFAULT '[]',
    findings TEXT,
    remediation_plan TEXT,
    
    -- Responsible parties
    assessor_id VARCHAR(30) REFERENCES users(id),
    owner_id VARCHAR(30) REFERENCES users(id),
    
    -- Dates
    assessment_date DATE,
    due_date DATE,
    completed_date DATE,
    next_review_date DATE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_compliance_framework (framework),
    INDEX idx_compliance_status (status),
    INDEX idx_compliance_due (due_date)
);

CREATE TYPE compliance_status AS ENUM (
    'compliant',
    'non_compliant',
    'partially_compliant',
    'not_applicable',
    'pending_assessment'
);
```

### Data Privacy Table

```sql
CREATE TABLE data_privacy_records (
    id VARCHAR(30) PRIMARY KEY DEFAULT generate_cuid(),
    user_id VARCHAR(30) NOT NULL REFERENCES users(id),
    
    -- Request details
    request_type privacy_request_type NOT NULL,
    status request_status NOT NULL,
    
    -- Request metadata
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    requested_by VARCHAR(30) REFERENCES users(id),
    
    -- Processing
    processed_at TIMESTAMP,
    processed_by VARCHAR(30) REFERENCES users(id),
    
    -- Data affected
    data_categories TEXT[],
    systems_affected TEXT[],
    
    -- Result
    result JSONB DEFAULT '{}',
    
    -- Indexes
    INDEX idx_privacy_user (user_id),
    INDEX idx_privacy_type (request_type),
    INDEX idx_privacy_status (status),
    INDEX idx_privacy_requested (requested_at DESC)
);

CREATE TYPE privacy_request_type AS ENUM (
    'access',
    'deletion',
    'portability',
    'rectification',
    'restriction'
);

CREATE TYPE request_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'rejected'
);
```

---

## Performance Optimization

### Indexing Strategy

```sql
-- Composite indexes for common queries
CREATE INDEX idx_services_team_lifecycle ON services(team_id, lifecycle) 
    WHERE deleted_at IS NULL;

CREATE INDEX idx_plugins_category_status ON plugins(category, status) 
    WHERE is_deprecated = false;

CREATE INDEX idx_audit_logs_user_action_date ON audit_logs(user_id, action, created_at DESC);

-- Partial indexes for active records
CREATE INDEX idx_users_active ON users(email) 
    WHERE is_active = true AND deleted_at IS NULL;

CREATE INDEX idx_services_active ON services(name) 
    WHERE deleted_at IS NULL;

-- BRIN indexes for time-series data
CREATE INDEX idx_metrics_time_brin ON metrics USING BRIN(time);
CREATE INDEX idx_events_occurred_brin ON events USING BRIN(occurred_at);

-- GIN indexes for JSONB
CREATE INDEX idx_services_metadata_gin ON services USING GIN(metadata);
CREATE INDEX idx_plugins_requirements_gin ON plugins USING GIN(requirements);

-- Full-text search indexes
CREATE INDEX idx_services_search ON services 
    USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '')));

CREATE INDEX idx_plugins_search ON plugins 
    USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '')));
```

### Query Optimization

```sql
-- Materialized view for service health dashboard
CREATE MATERIALIZED VIEW service_health_summary AS
SELECT 
    s.id,
    s.name,
    s.health_status,
    s.lifecycle,
    t.name as team_name,
    COUNT(DISTINCT sr.target_id) as dependency_count,
    AVG(m.value) FILTER (WHERE m.metric_name = 'latency_p99') as avg_latency,
    AVG(m.value) FILTER (WHERE m.metric_name = 'error_rate') as avg_error_rate
FROM services s
LEFT JOIN teams t ON s.team_id = t.id
LEFT JOIN service_relationships sr ON s.id = sr.source_id
LEFT JOIN metrics m ON s.id = m.service_id 
    AND m.time > NOW() - INTERVAL '1 hour'
WHERE s.deleted_at IS NULL
GROUP BY s.id, s.name, s.health_status, s.lifecycle, t.name;

CREATE INDEX idx_service_health_summary_status ON service_health_summary(health_status);

-- Refresh strategy
REFRESH MATERIALIZED VIEW CONCURRENTLY service_health_summary;
```

### Partitioning Strategy

```sql
-- Range partitioning for audit logs
CREATE TABLE audit_logs_2024_q1 PARTITION OF audit_logs
    FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');

CREATE TABLE audit_logs_2024_q2 PARTITION OF audit_logs
    FOR VALUES FROM ('2024-04-01') TO ('2024-07-01');

-- List partitioning for multi-tenant data
CREATE TABLE tenant_data (
    id VARCHAR(30) PRIMARY KEY,
    tenant_id VARCHAR(30) NOT NULL,
    data JSONB
) PARTITION BY LIST (tenant_id);

CREATE TABLE tenant_data_acme PARTITION OF tenant_data
    FOR VALUES IN ('tenant_acme');

CREATE TABLE tenant_data_globex PARTITION OF tenant_data
    FOR VALUES IN ('tenant_globex');
```

---

## Data Governance

### Data Classification

```sql
-- Table for data classification metadata
CREATE TABLE data_classification (
    table_name VARCHAR(255) PRIMARY KEY,
    column_name VARCHAR(255),
    classification data_classification_level NOT NULL,
    contains_pii BOOLEAN DEFAULT false,
    contains_phi BOOLEAN DEFAULT false,
    encryption_required BOOLEAN DEFAULT false,
    retention_days INTEGER,
    
    UNIQUE(table_name, column_name)
);

CREATE TYPE data_classification_level AS ENUM (
    'public',
    'internal',
    'confidential',
    'restricted'
);

-- Sample classifications
INSERT INTO data_classification VALUES
('users', 'email', 'confidential', true, false, true, 2555),
('users', 'password', 'restricted', false, false, true, 2555),
('services', 'name', 'internal', false, false, false, 1095),
('audit_logs', '*', 'confidential', false, false, true, 2555);
```

### Row-Level Security

```sql
-- Enable RLS on sensitive tables
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE plugin_installations ENABLE ROW LEVEL SECURITY;

-- Policy for team-based access to services
CREATE POLICY team_services_policy ON services
    FOR ALL
    TO application_role
    USING (
        team_id IN (
            SELECT team_id 
            FROM team_members 
            WHERE user_id = current_setting('app.current_user_id')::VARCHAR
        )
    );

-- Policy for plugin installation access
CREATE POLICY plugin_installation_policy ON plugin_installations
    FOR ALL
    TO application_role
    USING (
        installed_by = current_setting('app.current_user_id')::VARCHAR
        OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = current_setting('app.current_user_id')::VARCHAR 
            AND role IN ('ADMIN', 'PLATFORM_ENGINEER')
        )
    );
```

### Data Encryption

```sql
-- Transparent Data Encryption (TDE) for sensitive columns
-- Using pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function to encrypt sensitive data
CREATE OR REPLACE FUNCTION encrypt_sensitive(data TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN encode(
        encrypt(
            data::bytea,
            current_setting('app.encryption_key')::bytea,
            'aes'
        ),
        'base64'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrypt sensitive data
CREATE OR REPLACE FUNCTION decrypt_sensitive(encrypted_data TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN convert_from(
        decrypt(
            decode(encrypted_data, 'base64'),
            current_setting('app.encryption_key')::bytea,
            'aes'
        ),
        'UTF8'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically encrypt MFA secrets
CREATE OR REPLACE FUNCTION encrypt_mfa_secret()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.mfa_secret IS NOT NULL THEN
        NEW.mfa_secret := encrypt_sensitive(NEW.mfa_secret);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER encrypt_mfa_trigger
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW
WHEN (NEW.mfa_secret IS DISTINCT FROM OLD.mfa_secret)
EXECUTE FUNCTION encrypt_mfa_secret();
```

### Backup & Recovery Procedures

```sql
-- Backup configuration
-- Full backup daily at 2 AM UTC
-- Incremental backup every hour
-- WAL archiving for point-in-time recovery

-- Backup validation
CREATE TABLE backup_validation (
    id SERIAL PRIMARY KEY,
    backup_date DATE NOT NULL,
    backup_type VARCHAR(50), -- full, incremental, wal
    validation_status VARCHAR(50),
    validated_at TIMESTAMP,
    validation_details JSONB,
    
    INDEX idx_backup_validation_date (backup_date DESC)
);

-- Recovery test results
CREATE TABLE recovery_tests (
    id SERIAL PRIMARY KEY,
    test_date DATE NOT NULL,
    recovery_type VARCHAR(50), -- full, pitr
    rto_target INTEGER, -- minutes
    rto_actual INTEGER, -- minutes
    rpo_target INTEGER, -- minutes
    rpo_actual INTEGER, -- minutes
    test_result VARCHAR(50),
    notes TEXT,
    
    INDEX idx_recovery_tests_date (test_date DESC)
);
```

---

## Database Maintenance

### Vacuum and Analyze Schedule

```sql
-- Automated vacuum settings
ALTER SYSTEM SET autovacuum = on;
ALTER SYSTEM SET autovacuum_max_workers = 4;
ALTER SYSTEM SET autovacuum_naptime = '30s';

-- Table-specific vacuum settings for high-churn tables
ALTER TABLE metrics SET (autovacuum_vacuum_scale_factor = 0.01);
ALTER TABLE events SET (autovacuum_vacuum_scale_factor = 0.01);
ALTER TABLE audit_logs SET (autovacuum_vacuum_scale_factor = 0.05);

-- Statistics target for better query planning
ALTER TABLE services SET STATISTICS 1000;
ALTER TABLE plugins SET STATISTICS 1000;
```

### Connection Pool Configuration

```yaml
PgBouncer Configuration:
  pool_mode: transaction
  max_client_conn: 10000
  default_pool_size: 25
  reserve_pool_size: 5
  reserve_pool_timeout: 3
  max_db_connections: 100
  max_user_connections: 100
  
Application Connection Settings:
  min_pool_size: 10
  max_pool_size: 100
  connection_timeout: 5000
  idle_timeout: 300000
  max_lifetime: 1800000
```

### Monitoring Queries

```sql
-- Active connections
SELECT 
    pid,
    usename,
    application_name,
    client_addr,
    state,
    query_start,
    state_change,
    query
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_start DESC;

-- Table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;

-- Slow queries
SELECT 
    calls,
    total_time,
    mean,
    max,
    stddev_time,
    query
FROM pg_stat_statements
WHERE calls > 100
ORDER BY mean DESC
LIMIT 20;

-- Index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC
LIMIT 20;
```

---

*Database Schema Documentation Version: 1.0.0*  
*Last Updated: 2025-08-08*  
*Database Version: PostgreSQL 15, TimescaleDB 2.13*