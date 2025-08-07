#!/bin/bash
set -e

# Vault authentication methods setup
# This script configures all authentication methods for the Backstage portal

VAULT_ADDR=${VAULT_ADDR:-"https://localhost:8200"}
VAULT_TOKEN=${VAULT_ROOT_TOKEN}

echo "🔐 Initializing Vault Authentication Methods..."

# Check if Vault is ready
vault status > /dev/null 2>&1 || {
    echo "❌ Vault is not accessible at $VAULT_ADDR"
    exit 1
}

# Function to enable auth method if not already enabled
enable_auth() {
    local auth_type=$1
    local path=$2
    local config=${3:-""}
    
    if ! vault auth list | grep -q "^${path}/"; then
        echo "📝 Enabling $auth_type auth method at $path..."
        if [ -n "$config" ]; then
            vault auth enable -path="$path" $config "$auth_type"
        else
            vault auth enable -path="$path" "$auth_type"
        fi
    else
        echo "✅ $auth_type auth method already enabled at $path"
    fi
}

# 1. Kubernetes Auth Method for K8s workloads
echo "☸️ Setting up Kubernetes authentication..."
enable_auth "kubernetes" "kubernetes"

# Configure Kubernetes auth
KUBERNETES_HOST="https://kubernetes.default.svc"
KUBERNETES_CA_CERT=$(cat /var/run/secrets/kubernetes.io/serviceaccount/ca.crt 2>/dev/null || echo "")
TOKEN_REVIEWER_JWT=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token 2>/dev/null || echo "")

if [ -n "$KUBERNETES_CA_CERT" ] && [ -n "$TOKEN_REVIEWER_JWT" ]; then
    vault write auth/kubernetes/config \
        token_reviewer_jwt="$TOKEN_REVIEWER_JWT" \
        kubernetes_host="$KUBERNETES_HOST" \
        kubernetes_ca_cert="$KUBERNETES_CA_CERT" \
        issuer="https://kubernetes.default.svc.cluster.local"
else
    # Fallback configuration for development
    vault write auth/kubernetes/config \
        kubernetes_host="https://kubernetes.docker.internal:6443" \
        kubernetes_ca_cert=@/tmp/k8s-ca.crt \
        issuer="https://kubernetes.docker.internal:6443"
fi

# Create Kubernetes roles
vault write auth/kubernetes/role/backstage \
    bound_service_account_names="backstage,vault,default" \
    bound_service_account_namespaces="backstage-system,vault-system,default" \
    policies="backstage-policy,kv-readonly" \
    ttl="1h" \
    max_ttl="4h"

vault write auth/kubernetes/role/vault-agent \
    bound_service_account_names="vault-agent" \
    bound_service_account_namespaces="backstage-system,vault-system" \
    policies="vault-agent-policy" \
    ttl="1h" \
    max_ttl="24h"

vault write auth/kubernetes/role/secret-injector \
    bound_service_account_names="vault-injector" \
    bound_service_account_namespaces="backstage-system" \
    policies="secret-injector-policy" \
    ttl="15m" \
    max_ttl="1h"

# 2. JWT/OIDC Auth Method for user authentication
echo "🎫 Setting up JWT/OIDC authentication..."
enable_auth "jwt" "jwt"

# Configure JWT auth for various identity providers
# GitHub OIDC
if [ -n "$GITHUB_CLIENT_ID" ]; then
    vault write auth/jwt/config \
        bound_issuer="https://token.actions.githubusercontent.com" \
        oidc_discovery_url="https://token.actions.githubusercontent.com" \
        oidc_client_id="$GITHUB_CLIENT_ID" \
        oidc_client_secret="$GITHUB_CLIENT_SECRET"
        
    vault write auth/jwt/role/github-actions \
        bound_audiences="$GITHUB_CLIENT_ID" \
        bound_claims_type="glob" \
        bound_claims='{"aud":"https://github.com/your-org","repository":"your-org/*"}' \
        user_claim="actor" \
        role_type="jwt" \
        policies="github-actions-policy" \
        ttl="15m"
fi

# Azure AD OIDC
enable_auth "oidc" "oidc"
if [ -n "$AZURE_TENANT_ID" ]; then
    vault write auth/oidc/config \
        oidc_discovery_url="https://login.microsoftonline.com/$AZURE_TENANT_ID/v2.0" \
        oidc_client_id="$AZURE_CLIENT_ID" \
        oidc_client_secret="$AZURE_CLIENT_SECRET" \
        default_role="azure-default"

    vault write auth/oidc/role/azure-default \
        bound_audiences="$AZURE_CLIENT_ID" \
        allowed_redirect_uris="$VAULT_ADDR/ui/vault/auth/oidc/oidc/callback" \
        allowed_redirect_uris="$VAULT_ADDR/v1/auth/oidc/oidc/callback" \
        user_claim="email" \
        policies="azure-user-policy" \
        ttl="1h" \
        max_ttl="12h"
fi

# Google OIDC
if [ -n "$GOOGLE_CLIENT_ID" ]; then
    vault write auth/oidc/config \
        oidc_discovery_url="https://accounts.google.com" \
        oidc_client_id="$GOOGLE_CLIENT_ID" \
        oidc_client_secret="$GOOGLE_CLIENT_SECRET" \
        default_role="google-default"

    vault write auth/oidc/role/google-default \
        bound_audiences="$GOOGLE_CLIENT_ID" \
        allowed_redirect_uris="$VAULT_ADDR/ui/vault/auth/oidc/oidc/callback" \
        user_claim="email" \
        policies="google-user-policy" \
        ttl="1h"
fi

# 3. LDAP Auth Method for enterprise directory integration
echo "📁 Setting up LDAP authentication..."
enable_auth "ldap" "ldap"

if [ -n "$LDAP_URL" ]; then
    vault write auth/ldap/config \
        url="$LDAP_URL" \
        userdn="$LDAP_USER_DN" \
        userattr="uid" \
        groupdn="$LDAP_GROUP_DN" \
        groupfilter="(&(objectClass=groupOfNames)(member={{.UserDN}}))" \
        groupattr="cn" \
        binddn="$LDAP_BIND_DN" \
        bindpass="$LDAP_BIND_PASSWORD" \
        insecure_tls=false \
        starttls=true

    # Map LDAP groups to Vault policies
    vault write auth/ldap/groups/backstage-admins \
        policies="admin-policy,backstage-admin"

    vault write auth/ldap/groups/backstage-developers \
        policies="developer-policy,kv-readwrite"

    vault write auth/ldap/groups/backstage-users \
        policies="user-policy,kv-readonly"
fi

# 4. AppRole Auth Method for applications and services
echo "🎭 Setting up AppRole authentication..."
enable_auth "approle" "approle"

# Create AppRole for Backstage application
vault write auth/approle/role/backstage \
    token_policies="backstage-policy,kv-readwrite" \
    token_ttl="1h" \
    token_max_ttl="4h" \
    bind_secret_id=true \
    secret_id_ttl="24h" \
    secret_id_num_uses=0

# Create AppRole for monitoring systems
vault write auth/approle/role/monitoring \
    token_policies="monitoring-policy,kv-readonly" \
    token_ttl="30m" \
    token_max_ttl="2h" \
    bind_secret_id=true

# Create AppRole for CI/CD systems
vault write auth/approle/role/cicd \
    token_policies="cicd-policy,kv-readwrite" \
    token_ttl="15m" \
    token_max_ttl="1h" \
    bind_secret_id=true \
    secret_id_ttl="1h"

# Get role IDs and secret IDs for configuration
echo "📋 AppRole Credentials:"
echo "Backstage Role ID: $(vault read -field=role_id auth/approle/role/backstage/role-id)"
vault write -f -field=secret_id auth/approle/role/backstage/secret-id > /tmp/backstage-secret-id

echo "Monitoring Role ID: $(vault read -field=role_id auth/approle/role/monitoring/role-id)"
vault write -f -field=secret_id auth/approle/role/monitoring/secret-id > /tmp/monitoring-secret-id

# 5. AWS IAM Auth Method for AWS workloads
echo "☁️ Setting up AWS IAM authentication..."
enable_auth "aws" "aws"

if [ -n "$AWS_REGION" ]; then
    vault write auth/aws/config/client \
        region="$AWS_REGION" \
        sts_endpoint="https://sts.$AWS_REGION.amazonaws.com" \
        sts_region="$AWS_REGION"

    # Create role for EC2 instances
    vault write auth/aws/role/ec2-role \
        auth_type=ec2 \
        policies="ec2-policy,kv-readonly" \
        max_ttl="1h" \
        disallow_reauthentication=false

    # Create role for EKS service accounts
    vault write auth/aws/role/eks-role \
        auth_type=iam \
        policies="eks-policy,kv-readonly" \
        max_ttl="1h" \
        bound_iam_principal_arns="arn:aws:iam::*:role/eks-*"
fi

# 6. GitHub Auth Method for GitHub users
echo "🐙 Setting up GitHub authentication..."
enable_auth "github" "github"

if [ -n "$GITHUB_ORG" ]; then
    vault write auth/github/config \
        organization="$GITHUB_ORG" \
        base_url="https://api.github.com"

    # Map GitHub teams to policies
    vault write auth/github/map/teams/backstage-admins \
        value="admin-policy,backstage-admin"

    vault write auth/github/map/teams/backstage-developers \
        value="developer-policy,kv-readwrite"

    vault write auth/github/map/teams/backstage-users \
        value="user-policy,kv-readonly"
fi

# 7. TLS Certificate Auth Method for mutual TLS
echo "🔒 Setting up TLS Certificate authentication..."
enable_auth "cert" "cert"

# Configure certificate auth
vault write auth/cert/certs/backstage \
    display_name="Backstage Services" \
    policies="backstage-policy,kv-readwrite" \
    certificate=@/vault/ssl/client-ca.crt \
    ttl="1h"

# 8. Radius Auth Method for network authentication
echo "📡 Setting up Radius authentication..."
enable_auth "radius" "radius"

if [ -n "$RADIUS_HOST" ]; then
    vault write auth/radius/config \
        host="$RADIUS_HOST" \
        port=1812 \
        secret="$RADIUS_SECRET"

    # Map Radius users to policies
    vault write auth/radius/users/admin \
        policies="admin-policy"
fi

# 9. Token Auth Method (enabled by default but configure roles)
echo "🎟️ Configuring Token roles..."

# Create token roles for different use cases
vault write auth/token/roles/backstage-service \
    allowed_policies="backstage-policy,kv-readwrite" \
    orphan=true \
    renewable=true \
    token_ttl="1h" \
    token_max_ttl="4h"

vault write auth/token/roles/short-lived \
    allowed_policies="user-policy,kv-readonly" \
    orphan=false \
    renewable=true \
    token_ttl="15m" \
    token_max_ttl="1h"

# 10. UserPass Auth Method for username/password authentication
echo "👤 Setting up UserPass authentication..."
enable_auth "userpass" "userpass"

# Create default admin user (change password in production!)
vault write auth/userpass/users/admin \
    password="change-this-password" \
    policies="admin-policy"

vault write auth/userpass/users/backstage \
    password="backstage-default-password" \
    policies="backstage-policy,kv-readwrite"

# Create service accounts
vault write auth/userpass/users/monitoring \
    password="monitoring-service-password" \
    policies="monitoring-policy,kv-readonly"

echo "✅ All authentication methods configured successfully!"
echo "📋 Summary of enabled auth methods:"
echo "   - Kubernetes: For K8s workloads and service accounts"
echo "   - JWT/OIDC: For GitHub Actions, Azure AD, Google SSO"
echo "   - LDAP: For enterprise directory integration"
echo "   - AppRole: For applications and automated systems"
echo "   - AWS IAM: For AWS workloads (EC2, EKS)"
echo "   - GitHub: For GitHub organization members"
echo "   - TLS Cert: For mutual TLS authentication"
echo "   - Radius: For network-based authentication"
echo "   - Token: For programmatic access"
echo "   - UserPass: For username/password authentication"

# Clean up sensitive files
rm -f /tmp/backstage-secret-id /tmp/monitoring-secret-id

echo "🎉 Vault authentication methods initialization complete!"
echo "⚠️  Remember to:"
echo "   1. Change default passwords"
echo "   2. Configure proper RBAC policies"
echo "   3. Set up secret rotation schedules"
echo "   4. Review and adjust TTL values"