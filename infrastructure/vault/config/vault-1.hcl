# Vault Server 1 Configuration - Primary Node
# Enterprise-grade HA configuration with Raft consensus

ui = true
disable_mlock = false
disable_cache = false
max_lease_ttl = "768h"
default_lease_ttl = "12h"

# API and Cluster addresses
api_addr = "https://172.20.0.20:8200"
cluster_addr = "https://172.20.0.20:8201"

# Raft Storage Backend - Superior to Consul for simplicity and performance
storage "raft" {
  path = "/vault/data"
  node_id = "vault-1"
  
  retry_join {
    leader_api_addr = "https://172.20.0.21:8200"
    leader_ca_cert_file = "/vault/ssl/ca.crt"
    leader_client_cert_file = "/vault/ssl/vault.crt"
    leader_client_key_file = "/vault/ssl/vault.key"
  }
  
  retry_join {
    leader_api_addr = "https://172.20.0.22:8200"
    leader_ca_cert_file = "/vault/ssl/ca.crt"
    leader_client_cert_file = "/vault/ssl/vault.crt"
    leader_client_key_file = "/vault/ssl/vault.key"
  }
  
  performance_multiplier = 1
  max_entry_size = "1048576"
  autopilot_reconcile_interval = "10s"
  autopilot_update_interval = "2s"
}

# TLS Configuration for secure communication
listener "tcp" {
  address = "0.0.0.0:8200"
  tls_cert_file = "/vault/ssl/vault.crt"
  tls_key_file = "/vault/ssl/vault.key"
  tls_client_ca_file = "/vault/ssl/ca.crt"
  tls_require_and_verify_client_cert = false
  tls_disable_client_certs = false
  
  # Performance tuning
  max_request_size = 33554432
  max_request_duration = "90s"
  
  # HTTP/2 support for better performance
  http2 = true
  
  # X-Forwarded-For headers
  x_forwarded_for_authorized_addrs = ["127.0.0.1", "172.20.0.0/16"]
  x_forwarded_for_reject_not_authorized = false
}

# Internal cluster communication
listener "tcp" {
  address = "0.0.0.0:8201"
  tls_cert_file = "/vault/ssl/vault.crt"
  tls_key_file = "/vault/ssl/vault.key"
  tls_client_ca_file = "/vault/ssl/ca.crt"
  tls_require_and_verify_client_cert = true
  tls_disable = false
}

# Auto-unseal using AWS KMS (production)
seal "awskms" {
  region = "us-west-2"
  kms_key_id = "alias/vault-auto-unseal"
  endpoint = ""
  
  # For local development, use Shamir seal instead
  # Comment out for local dev
  disabled = "false"
}

# Alternative: Transit auto-unseal for multi-cloud
# seal "transit" {
#   address = "https://vault-transit:8200"
#   token = ""
#   disable_renewal = false
#   key_name = "autounseal"
#   mount_path = "transit/"
#   namespace = ""
# }

# Telemetry for monitoring
telemetry {
  prometheus_retention_time = "24h"
  disable_hostname = false
  
  # StatsD integration
  statsd_address = "172.20.0.50:8125"
  statsite_address = ""
  
  # Metrics prefix
  metrics_prefix = "vault"
}

# Service registration for discovery
service_registration "consul" {
  address = "172.20.0.10:8500"
  token = ""
  service = "vault"
  service_tags = "primary,active"
  service_address = "172.20.0.20"
  
  # Health check configuration
  check_timeout = "5s"
  disable_registration = false
}

# Audit devices for compliance
audit {
  # File audit device with rotation
  file {
    file_path = "/vault/audit/audit.log"
    log_raw = false
    hmac_accessor = true
    mode = 0600
    format = "json"
    prefix = ""
  }
  
  # Syslog audit device for centralized logging
  syslog {
    facility = "LOCAL0"
    tag = "vault-audit"
    log_raw = false
    hmac_accessor = true
    format = "json"
  }
}

# Plugin directory for custom plugins
plugin_directory = "/vault/plugins"

# Performance and cache settings
cache_size = 131072
disable_clustering = false
disable_performance_standby = false
performance_standby_elasticsearch = false

# License configuration (Enterprise)
license_path = "/vault/license/license.hclic"

# Entropy augmentation for better randomness
entropy "seal" {
  mode = "augmentation"
}

# Log level and format
log_level = "info"
log_format = "json"
log_requests_level = "trace"

# PID file for process management
pid_file = "/vault/data/vault.pid"

# Raw storage endpoint for debugging (disable in production)
raw_storage_endpoint = false

# Introspection endpoint for profiling
introspection_endpoint = false

# Enable response wrapping by default
enable_response_header_hostname = true
enable_response_header_raft_node_id = true

# UI specific settings
ui_content_security_policy = "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self';"