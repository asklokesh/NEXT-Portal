ui = true
api_addr = "https://172.20.0.21:8200"
cluster_addr = "https://172.20.0.21:8201"

# High availability backend using Consul
storage "consul" {
  address = "consul-1:8500,consul-2:8500,consul-3:8500"
  path    = "vault/"
  
  # Consul configuration
  scheme = "http"
  service = "vault"
  service_tags = "active,standby"
  
  # Performance tuning
  max_parallel = "128"
  
  # Session TTL for locks
  session_ttl = "15s"
  lock_wait_time = "15s"
}

# Listener configuration with TLS
listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_cert_file = "/vault/ssl/vault.crt"
  tls_key_file  = "/vault/ssl/vault.key"
  tls_min_version = "tls12"
  tls_cipher_suites = "TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305,TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305"
  tls_require_and_verify_client_cert = false
  tls_disable_client_certs = true
}

# Cluster listener for inter-node communication
cluster_addr = "https://172.20.0.21:8201"
listener "tcp" {
  address     = "0.0.0.0:8201"
  purpose     = "cluster"
  tls_cert_file = "/vault/ssl/vault.crt"
  tls_key_file  = "/vault/ssl/vault.key"
}

# Auto-unsealing with cloud KMS
seal "awskms" {
  region     = "us-west-2"
  kms_key_id = "alias/vault-unseal-key"
  endpoint   = "https://kms.us-west-2.amazonaws.com"
}

# Performance and caching
default_lease_ttl = "768h"
max_lease_ttl = "8760h"
default_max_request_duration = "90s"

# Logging and audit
log_level = "INFO"
log_format = "json"

# Disable mlock for containerized environments
disable_mlock = true

# Enable raw endpoint
raw_storage_endpoint = true

# Cluster name
cluster_name = "vault-ha-cluster"

# Enable performance standby nodes
disable_performance_standby = false

# Plugin directory
plugin_directory = "/vault/plugins"

# Telemetry
telemetry {
  prometheus_retention_time = "24h"
  disable_hostname = true
  statsd_address = "statsd:8125"
}

# License path (if using Vault Enterprise)
# license_path = "/vault/license/vault.hclic"