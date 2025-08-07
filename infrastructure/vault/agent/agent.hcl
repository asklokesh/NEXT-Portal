# Vault Agent Configuration for Automatic Authentication and Token Management
# This configuration enables automatic token renewal and secret templating

pid_file = "/vault/agent/pidfile"

# Vault server connection
vault {
  address = "https://vault-1:8200"
  ca_cert = "/vault/ssl/ca.crt"
  client_cert = "/vault/ssl/client.crt"
  client_key = "/vault/ssl/client.key"
  tls_skip_verify = false
}

# Auto-authentication configuration
auto_auth {
  # Primary auth method: Kubernetes
  method "kubernetes" {
    mount_path = "auth/kubernetes"
    config = {
      role = "vault-agent"
      token_path = "/var/run/secrets/kubernetes.io/serviceaccount/token"
    }
  }

  # Fallback auth method: AppRole
  method "approle" {
    mount_path = "auth/approle"
    config = {
      role_id_file_path = "/vault/config/role_id"
      secret_id_file_path = "/vault/config/secret_id"
      remove_secret_id_file_after_reading = false
    }
  }

  # Token sink for storing the authenticated token
  sink "file" {
    config = {
      path = "/vault/agent/token"
      mode = 0600
    }
  }

  # Additional sink for backup token storage
  sink "file" {
    config = {
      path = "/vault/tokens/vault-token"
      mode = 0600
    }
  }
}

# API proxy for applications
api_proxy {
  use_auto_auth_token = true
  enforce_consistency = "always"
  when_inconsistent = "retry"
}

# Listener for proxy
listener "tcp" {
  address = "0.0.0.0:8100"
  tls_disable = true
}

# Cache configuration for performance
cache {
  # Use auto-auth token for cache requests
  use_auto_auth_token = true
  
  # Persist cache to disk
  persist = {
    type = "kubernetes"
    path = "/vault/agent/cache"
    keep_after_import = true
    exit_on_err = true
    service_account_token_file = "/var/run/secrets/kubernetes.io/serviceaccount/token"
  }
  
  # Cache static secrets for 5 minutes
  static_secret_token_ttl = "5m"
}

# Template configurations for secret injection
template_config {
  static_secret_render_interval = "5m"
  exit_on_retry_failure = true
  max_connections_per_host = 10
}

# Database connection template
template {
  source = "/vault/templates/database.json.tpl"
  destination = "/vault/secrets/database.json"
  perms = 0600
  command = "sh -c 'echo Database secrets updated at $(date)'"
  wait {
    min = "5s"
    max = "10s"
  }
  error_on_missing_key = true
  backup = true
}

# Application configuration template
template {
  source = "/vault/templates/app-config.yaml.tpl"
  destination = "/vault/secrets/app-config.yaml"
  perms = 0644
  command = "sh -c 'echo App config updated at $(date)'"
  wait {
    min = "2s"
    max = "5s"
  }
}

# PKI certificate template
template {
  source = "/vault/templates/tls-cert.pem.tpl"
  destination = "/vault/secrets/tls.crt"
  perms = 0644
  command = "sh -c 'echo Certificate updated at $(date)'"
  wait {
    min = "30s"
    max = "60s"
  }
}

template {
  source = "/vault/templates/tls-key.pem.tpl"
  destination = "/vault/secrets/tls.key"
  perms = 0600
  command = "sh -c 'echo Private key updated at $(date)'"
  wait {
    min = "30s"
    max = "60s"
  }
}

# AWS credentials template
template {
  source = "/vault/templates/aws-credentials.json.tpl"
  destination = "/vault/secrets/aws-credentials.json"
  perms = 0600
  command = "sh -c 'echo AWS credentials updated at $(date)'"
  wait {
    min = "10s"
    max = "20s"
  }
}

# Environment variables template for containers
template {
  source = "/vault/templates/env-vars.env.tpl"
  destination = "/vault/secrets/.env"
  perms = 0600
  command = "sh -c 'echo Environment variables updated at $(date)'"
  wait {
    min = "5s"
    max = "10s"
  }
}

# Kubernetes secret template
template {
  source = "/vault/templates/k8s-secret.yaml.tpl"
  destination = "/vault/secrets/backstage-secrets.yaml"
  perms = 0644
  command = "kubectl apply -f /vault/secrets/backstage-secrets.yaml"
  wait {
    min = "15s"
    max = "30s"
  }
}

# Service mesh certificates template (for Istio)
template {
  source = "/vault/templates/service-mesh-cert.pem.tpl"
  destination = "/vault/secrets/service-mesh.crt"
  perms = 0644
  command = "sh -c 'echo Service mesh certificate updated at $(date)'"
  wait {
    min = "60s"
    max = "120s"
  }
}

# Logging configuration
log_level = "INFO"
log_format = "json"
log_file = "/vault/logs/agent.log"
log_rotate_duration = "24h"
log_rotate_max_files = 7

# Process configuration
disable_idle_connections = ["templating", "caching"]
disable_keep_alives = ["templating", "caching"]

# Exit after auth for one-shot mode (comment out for daemon mode)
# exit_after_auth = true

# Telemetry
telemetry {
  prometheus_retention_time = "24h"
  disable_hostname = true
}