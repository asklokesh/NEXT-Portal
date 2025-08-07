# Vault Policies for Backstage Portal
# These policies define fine-grained access control for different roles and services

# Admin Policy - Full access for administrators
path "admin-policy" {
  policy = "write"
}

rule "admin-policy" {
  path "*" {
    capabilities = ["create", "read", "update", "delete", "list", "sudo"]
  }
  
  # System health and status
  path "sys/health" {
    capabilities = ["read", "list"]
  }
  
  # Audit logs
  path "sys/audit" {
    capabilities = ["read", "list", "create", "update", "delete"]
  }
  
  # Auth methods management
  path "sys/auth/*" {
    capabilities = ["create", "read", "update", "delete", "list"]
  }
  
  # Policy management
  path "sys/policies/acl/*" {
    capabilities = ["create", "read", "update", "delete", "list"]
  }
  
  # Secret engines management
  path "sys/mounts/*" {
    capabilities = ["create", "read", "update", "delete", "list"]
  }
}

# Backstage Application Policy - Primary application access
path "backstage-policy" {
  policy = "write"
}

rule "backstage-policy" {
  # Backstage KV secrets
  path "backstage/*" {
    capabilities = ["create", "read", "update", "delete", "list"]
  }
  
  # Application secrets
  path "secret/data/backstage/*" {
    capabilities = ["create", "read", "update", "delete", "list"]
  }
  
  # Application metadata
  path "secret/metadata/backstage/*" {
    capabilities = ["read", "list", "update", "delete"]
  }
  
  # Database dynamic credentials
  path "database/creds/readwrite" {
    capabilities = ["read"]
  }
  
  path "database/creds/readonly" {
    capabilities = ["read"]
  }
  
  # PKI certificate generation
  path "pki_int/issue/backstage-dot-local" {
    capabilities = ["create", "read", "update"]
  }
  
  # Transit encryption
  path "transit/encrypt/backstage-data" {
    capabilities = ["create", "update"]
  }
  
  path "transit/decrypt/backstage-data" {
    capabilities = ["create", "update"]
  }
  
  # SSH certificate signing
  path "ssh/sign/ca_key_role" {
    capabilities = ["create", "update"]
  }
  
  # Cloud credentials
  path "aws/creds/backstage-readonly" {
    capabilities = ["read"]
  }
  
  path "gcp/roleset/backstage-readonly/token" {
    capabilities = ["read"]
  }
  
  # Token management
  path "auth/token/lookup-self" {
    capabilities = ["read"]
  }
  
  path "auth/token/renew-self" {
    capabilities = ["update"]
  }
}

# Developer Policy - Development team access
path "developer-policy" {
  policy = "write"
}

rule "developer-policy" {
  # Development secrets
  path "secret/data/apps/dev/*" {
    capabilities = ["create", "read", "update", "delete", "list"]
  }
  
  path "secret/metadata/apps/dev/*" {
    capabilities = ["read", "list"]
  }
  
  # Backstage configuration (read-only)
  path "backstage/data/*" {
    capabilities = ["read", "list"]
  }
  
  # Database read access
  path "database/creds/readonly" {
    capabilities = ["read"]
  }
  
  # Development certificates
  path "pki_int/issue/backstage-dot-local" {
    capabilities = ["create", "update"]
  }
  
  # Transit encryption for development
  path "transit/encrypt/backstage-data" {
    capabilities = ["create", "update"]
  }
  
  path "transit/decrypt/backstage-data" {
    capabilities = ["create", "update"]
  }
  
  # Token self-management
  path "auth/token/lookup-self" {
    capabilities = ["read"]
  }
  
  path "auth/token/renew-self" {
    capabilities = ["update"]
  }
}

# User Policy - Standard user access
path "user-policy" {
  policy = "write"
}

rule "user-policy" {
  # Personal secrets
  path "secret/data/users/{{identity.entity.aliases.auth_oidc_xxx.metadata.email}}/*" {
    capabilities = ["create", "read", "update", "delete", "list"]
  }
  
  # Backstage public configuration (read-only)
  path "backstage/data/public/*" {
    capabilities = ["read", "list"]
  }
  
  # User certificates
  path "pki_int/issue/backstage-dot-local" {
    capabilities = ["create", "update"]
  }
  
  # Token self-management
  path "auth/token/lookup-self" {
    capabilities = ["read"]
  }
  
  path "auth/token/renew-self" {
    capabilities = ["update"]
  }
  
  # SSH user certificates
  path "ssh/sign/ca_key_role" {
    capabilities = ["create", "update"]
  }
}

# KV Read-Only Policy - Minimal read access
path "kv-readonly" {
  policy = "write"
}

rule "kv-readonly" {
  path "secret/data/*" {
    capabilities = ["read", "list"]
  }
  
  path "secret/metadata/*" {
    capabilities = ["read", "list"]
  }
  
  path "backstage/data/*" {
    capabilities = ["read", "list"]
  }
  
  path "backstage/metadata/*" {
    capabilities = ["read", "list"]
  }
}

# KV Read-Write Policy - Full KV access
path "kv-readwrite" {
  policy = "write"
}

rule "kv-readwrite" {
  path "secret/*" {
    capabilities = ["create", "read", "update", "delete", "list"]
  }
  
  path "backstage/*" {
    capabilities = ["create", "read", "update", "delete", "list"]
  }
  
  path "apps/*" {
    capabilities = ["create", "read", "update", "delete", "list"]
  }
}

# Monitoring Policy - For observability systems
path "monitoring-policy" {
  policy = "write"
}

rule "monitoring-policy" {
  # Health checks
  path "sys/health" {
    capabilities = ["read", "list"]
  }
  
  # Metrics
  path "sys/metrics" {
    capabilities = ["read", "list"]
  }
  
  # Audit logs (read-only)
  path "sys/audit" {
    capabilities = ["read", "list"]
  }
  
  # Monitoring secrets
  path "secret/data/monitoring/*" {
    capabilities = ["read", "list"]
  }
  
  # Database monitoring credentials
  path "database/creds/readonly" {
    capabilities = ["read"]
  }
}

# CI/CD Policy - For continuous integration systems
path "cicd-policy" {
  policy = "write"
}

rule "cicd-policy" {
  # CI/CD secrets
  path "secret/data/cicd/*" {
    capabilities = ["create", "read", "update", "delete", "list"]
  }
  
  # Application deployment secrets
  path "secret/data/apps/*/deploy" {
    capabilities = ["read", "list"]
  }
  
  # Database deployment credentials
  path "database/creds/admin" {
    capabilities = ["read"]
  }
  
  # PKI for deployment certificates
  path "pki_int/issue/backstage-dot-local" {
    capabilities = ["create", "update"]
  }
  
  # Cloud credentials for deployment
  path "aws/creds/backstage-admin" {
    capabilities = ["read"]
  }
  
  path "gcp/roleset/backstage-admin/token" {
    capabilities = ["read"]
  }
  
  # Transit encryption for CI/CD
  path "transit/encrypt/*" {
    capabilities = ["create", "update"]
  }
}

# Vault Agent Policy - For Vault Agent auto-auth
path "vault-agent-policy" {
  policy = "write"
}

rule "vault-agent-policy" {
  # Token lookup and renewal
  path "auth/token/lookup-self" {
    capabilities = ["read"]
  }
  
  path "auth/token/renew-self" {
    capabilities = ["update"]
  }
  
  # AppRole auth
  path "auth/approle/login" {
    capabilities = ["create", "update"]
  }
  
  # Kubernetes auth
  path "auth/kubernetes/login" {
    capabilities = ["create", "update"]
  }
}

# Secret Injector Policy - For Kubernetes secret injection
path "secret-injector-policy" {
  policy = "write"
}

rule "secret-injector-policy" {
  # Read secrets for injection
  path "secret/data/apps/*/k8s" {
    capabilities = ["read"]
  }
  
  path "backstage/data/k8s/*" {
    capabilities = ["read"]
  }
  
  # Database credentials for injection
  path "database/creds/readwrite" {
    capabilities = ["read"]
  }
  
  # PKI certificates for injection
  path "pki_int/issue/backstage-dot-local" {
    capabilities = ["create", "update"]
  }
  
  # Token self-management
  path "auth/token/lookup-self" {
    capabilities = ["read"]
  }
  
  path "auth/token/renew-self" {
    capabilities = ["update"]
  }
}

# GitHub Actions Policy - For GitHub Actions workflows
path "github-actions-policy" {
  policy = "write"
}

rule "github-actions-policy" {
  # CI/CD secrets
  path "secret/data/github/*" {
    capabilities = ["read", "list"]
  }
  
  # Deployment credentials
  path "aws/creds/github-actions" {
    capabilities = ["read"]
  }
  
  # Container registry credentials
  path "secret/data/registry/*" {
    capabilities = ["read"]
  }
  
  # PKI for deployment certificates
  path "pki_int/issue/backstage-dot-local" {
    capabilities = ["create", "update"]
  }
}

# Azure User Policy - For Azure AD users
path "azure-user-policy" {
  policy = "write"
}

rule "azure-user-policy" {
  # User-specific secrets
  path "secret/data/users/{{identity.entity.aliases.auth_oidc_xxx.metadata.preferred_username}}/*" {
    capabilities = ["create", "read", "update", "delete", "list"]
  }
  
  # Azure resources
  path "azure/creds/backstage-contributor" {
    capabilities = ["read"]
  }
  
  # General application access
  path "backstage/data/public/*" {
    capabilities = ["read", "list"]
  }
}

# Google User Policy - For Google SSO users
path "google-user-policy" {
  policy = "write"
}

rule "google-user-policy" {
  # User-specific secrets
  path "secret/data/users/{{identity.entity.aliases.auth_oidc_xxx.metadata.email}}/*" {
    capabilities = ["create", "read", "update", "delete", "list"]
  }
  
  # GCP resources
  path "gcp/roleset/backstage-readonly/token" {
    capabilities = ["read"]
  }
  
  # General application access
  path "backstage/data/public/*" {
    capabilities = ["read", "list"]
  }
}

# EC2 Policy - For AWS EC2 instances
path "ec2-policy" {
  policy = "write"
}

rule "ec2-policy" {
  # EC2-specific secrets
  path "secret/data/ec2/*" {
    capabilities = ["read", "list"]
  }
  
  # AWS credentials
  path "aws/creds/ec2-role" {
    capabilities = ["read"]
  }
  
  # Database access
  path "database/creds/readonly" {
    capabilities = ["read"]
  }
}

# EKS Policy - For AWS EKS workloads
path "eks-policy" {
  policy = "write"
}

rule "eks-policy" {
  # EKS-specific secrets
  path "secret/data/eks/*" {
    capabilities = ["read", "list"]
  }
  
  # Kubernetes secrets
  path "secret/data/k8s/*" {
    capabilities = ["read", "list"]
  }
  
  # Database credentials
  path "database/creds/readwrite" {
    capabilities = ["read"]
  }
}