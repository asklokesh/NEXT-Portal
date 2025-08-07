-- Add indexes for improved query performance

-- User indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_provider_providerId ON users(provider, providerId);
CREATE INDEX idx_users_lastLogin ON users(lastLogin DESC);

-- Service indexes
CREATE INDEX idx_services_teamId ON services(teamId);
CREATE INDEX idx_services_ownerId ON services(ownerId);
CREATE INDEX idx_services_type_lifecycle ON services(type, lifecycle);
CREATE INDEX idx_services_namespace_name ON services(namespace, name);
CREATE INDEX idx_services_tags ON services USING GIN(tags);
CREATE INDEX idx_services_createdAt ON services(createdAt DESC);
CREATE INDEX idx_services_isActive ON services(isActive);

-- Service dependencies indexes
CREATE INDEX idx_service_dependencies_serviceId ON service_dependencies(serviceId);
CREATE INDEX idx_service_dependencies_dependsOnId ON service_dependencies(dependsOnId);

-- Health check indexes
CREATE INDEX idx_service_health_checks_serviceId ON service_health_checks(serviceId);
CREATE INDEX idx_health_check_results_healthCheckId_checkedAt ON health_check_results(healthCheckId, checkedAt DESC);
CREATE INDEX idx_health_check_results_status ON health_check_results(status);

-- Metrics indexes
CREATE INDEX idx_service_metrics_serviceId_timestamp ON service_metrics(serviceId, timestamp DESC);
CREATE INDEX idx_service_metrics_name_timestamp ON service_metrics(name, timestamp DESC);

-- Template indexes
CREATE INDEX idx_templates_ownerId ON templates(ownerId);
CREATE INDEX idx_templates_tags ON templates USING GIN(tags);
CREATE INDEX idx_templates_isPublic_isActive ON templates(isPublic, isActive);

-- Template execution indexes
CREATE INDEX idx_template_executions_templateId ON template_executions(templateId);
CREATE INDEX idx_template_executions_userId ON template_executions(userId);
CREATE INDEX idx_template_executions_status ON template_executions(status);
CREATE INDEX idx_template_executions_startedAt ON template_executions(startedAt DESC);

-- Deployment indexes
CREATE INDEX idx_deployments_serviceId_environment ON deployments(serviceId, environment);
CREATE INDEX idx_deployments_status ON deployments(status);
CREATE INDEX idx_deployments_startedAt ON deployments(startedAt DESC);

-- Cost indexes
CREATE INDEX idx_service_costs_serviceId_date ON service_costs(serviceId, date DESC);
CREATE INDEX idx_service_costs_provider_service ON service_costs(provider, service);
CREATE INDEX idx_service_costs_date ON service_costs(date DESC);

-- Session indexes
CREATE INDEX idx_sessions_userId ON sessions(userId);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expiresAt ON sessions(expiresAt);

-- API key indexes
CREATE INDEX idx_api_keys_userId ON api_keys(userId);
CREATE INDEX idx_api_keys_keyHash ON api_keys(keyHash);

-- Audit log indexes
CREATE INDEX idx_audit_logs_userId ON audit_logs(userId);
CREATE INDEX idx_audit_logs_resource_resourceId ON audit_logs(resource, resourceId);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- Notification indexes
CREATE INDEX idx_notifications_userId_read ON notifications(userId, read);
CREATE INDEX idx_notifications_userId_createdAt ON notifications(userId, createdAt DESC);
CREATE INDEX idx_notifications_type_priority ON notifications(type, priority);

-- Search index
CREATE INDEX idx_search_index_entityType ON search_index(entityType);
CREATE INDEX idx_search_index_tags ON search_index USING GIN(tags);
CREATE INDEX idx_search_index_title_trgm ON search_index USING gin(title gin_trgm_ops);
CREATE INDEX idx_search_index_content_trgm ON search_index USING gin(content gin_trgm_ops);

-- Enable trigram extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;