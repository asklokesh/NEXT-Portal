#!/bin/bash

# HashiCorp Vault Initialization Script
# Sets up a production-ready Vault cluster with all secret engines

set -e

VAULT_ADDR=${VAULT_ADDR:-"https://localhost:8200"}
VAULT_TOKEN=""
UNSEAL_KEYS=()

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Vault is already initialized
check_initialization() {
    log_info "Checking Vault initialization status..."
    
    STATUS=$(vault status -format=json 2>/dev/null || echo '{"initialized": false}')
    INITIALIZED=$(echo $STATUS | jq -r '.initialized')
    
    if [ "$INITIALIZED" == "true" ]; then
        log_warn "Vault is already initialized"
        return 0
    else
        log_info "Vault needs initialization"
        return 1
    fi
}

# Initialize Vault
initialize_vault() {
    log_info "Initializing Vault..."
    
    INIT_OUTPUT=$(vault operator init \
        -key-shares=5 \
        -key-threshold=3 \
        -format=json)
    
    # Extract keys and token
    VAULT_TOKEN=$(echo $INIT_OUTPUT | jq -r '.root_token')
    for i in {0..4}; do
        KEY=$(echo $INIT_OUTPUT | jq -r ".unseal_keys_b64[$i]")
        UNSEAL_KEYS+=($KEY)
    done
    
    # Save credentials securely
    mkdir -p ~/.vault
    chmod 700 ~/.vault
    
    cat > ~/.vault/init.json <<EOF
{
    "root_token": "$VAULT_TOKEN",
    "unseal_keys": [
        "${UNSEAL_KEYS[0]}",
        "${UNSEAL_KEYS[1]}",
        "${UNSEAL_KEYS[2]}",
        "${UNSEAL_KEYS[3]}",
        "${UNSEAL_KEYS[4]}"
    ]
}
EOF
    chmod 600 ~/.vault/init.json
    
    log_info "Vault initialized successfully"
    log_warn "IMPORTANT: Securely backup the file ~/.vault/init.json"
}

# Unseal Vault
unseal_vault() {
    log_info "Unsealing Vault..."
    
    if [ ${#UNSEAL_KEYS[@]} -eq 0 ]; then
        # Load keys from saved file
        if [ -f ~/.vault/init.json ]; then
            for i in {0..2}; do
                KEY=$(jq -r ".unseal_keys[$i]" ~/.vault/init.json)
                vault operator unseal $KEY
            done
        else
            log_error "No unseal keys available"
            exit 1
        fi
    else
        # Use provided keys
        for i in {0..2}; do
            vault operator unseal ${UNSEAL_KEYS[$i]}
        done
    fi
    
    log_info "Vault unsealed successfully"
}

# Login to Vault
login_vault() {
    if [ -z "$VAULT_TOKEN" ]; then
        if [ -f ~/.vault/init.json ]; then
            VAULT_TOKEN=$(jq -r '.root_token' ~/.vault/init.json)
        else
            log_error "No root token available"
            exit 1
        fi
    fi
    
    export VAULT_TOKEN
    vault login $VAULT_TOKEN
    
    log_info "Logged in to Vault"
}

# Enable audit logging
enable_audit() {
    log_info "Enabling audit devices..."
    
    # File audit
    vault audit enable file \
        file_path=/vault/audit/audit.log \
        log_raw=false \
        hmac_accessor=true \
        mode=0600 \
        format=json || log_warn "File audit already enabled"
    
    # Syslog audit (if available)
    vault audit enable syslog \
        tag="vault" \
        facility="LOCAL0" || log_warn "Syslog audit already enabled or not available"
    
    log_info "Audit devices configured"
}

# Enable secret engines
enable_secret_engines() {
    log_info "Enabling secret engines..."
    
    # KV v2 (usually at secret/)
    vault secrets enable -path=secret -version=2 kv || log_warn "KV v2 already enabled"
    
    # Database engine
    vault secrets enable -path=database database || log_warn "Database engine already enabled"
    
    # PKI engine
    vault secrets enable -path=pki pki || log_warn "PKI engine already enabled"
    vault secrets tune -max-lease-ttl=87600h pki
    
    # PKI Intermediate
    vault secrets enable -path=pki_int pki || log_warn "PKI intermediate already enabled"
    vault secrets tune -max-lease-ttl=43800h pki_int
    
    # Transit engine
    vault secrets enable -path=transit transit || log_warn "Transit engine already enabled"
    
    # TOTP engine
    vault secrets enable -path=totp totp || log_warn "TOTP engine already enabled"
    
    # SSH engine
    vault secrets enable -path=ssh ssh || log_warn "SSH engine already enabled"
    
    # AWS secrets engine
    vault secrets enable -path=aws aws || log_warn "AWS engine already enabled"
    
    # Azure secrets engine
    vault secrets enable -path=azure azure || log_warn "Azure engine already enabled"
    
    # GCP secrets engine
    vault secrets enable -path=gcp gcp || log_warn "GCP engine already enabled"
    
    log_info "Secret engines enabled"
}

# Configure PKI
configure_pki() {
    log_info "Configuring PKI..."
    
    # Generate root CA
    vault write -format=json pki/root/generate/internal \
        common_name="Developer Portal Root CA" \
        issuer_name="root-2024" \
        ttl=87600h | jq -r '.data.certificate' > ~/vault-ca-cert.pem
    
    # Configure CA and CRL URLs
    vault write pki/config/urls \
        issuing_certificates="$VAULT_ADDR/v1/pki/ca" \
        crl_distribution_points="$VAULT_ADDR/v1/pki/crl"
    
    # Generate intermediate CSR
    vault write -format=json pki_int/intermediate/generate/internal \
        common_name="Developer Portal Intermediate CA" \
        issuer_name="portal-intermediate" | jq -r '.data.csr' > ~/pki_intermediate.csr
    
    # Sign intermediate certificate
    vault write -format=json pki/root/sign-intermediate \
        issuer_ref="root-2024" \
        csr=@~/pki_intermediate.csr \
        format=pem_bundle \
        ttl="43800h" | jq -r '.data.certificate' > ~/intermediate.cert.pem
    
    # Set signed intermediate certificate
    vault write pki_int/intermediate/set-signed certificate=@~/intermediate.cert.pem
    
    # Configure intermediate URLs
    vault write pki_int/config/urls \
        issuing_certificates="$VAULT_ADDR/v1/pki_int/ca" \
        crl_distribution_points="$VAULT_ADDR/v1/pki_int/crl"
    
    # Create role for issuing certificates
    vault write pki_int/roles/service-cert \
        allowed_domains="portal.local,*.portal.local,localhost" \
        allow_subdomains=true \
        allow_glob_domains=true \
        allow_any_name=true \
        max_ttl="720h" \
        key_type="rsa" \
        key_bits=2048
    
    log_info "PKI configured"
}

# Configure database secrets
configure_database() {
    log_info "Configuring database secrets engine..."
    
    # PostgreSQL configuration
    vault write database/config/postgresql \
        plugin_name=postgresql-database-plugin \
        allowed_roles="readonly,readwrite,admin" \
        connection_url="postgresql://{{username}}:{{password}}@postgres:5432/portal?sslmode=disable" \
        username="vault_admin" \
        password="vault_admin_password" || log_warn "PostgreSQL already configured"
    
    # Create database roles
    vault write database/roles/readonly \
        db_name=postgresql \
        creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; \
        GRANT SELECT ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
        default_ttl="1h" \
        max_ttl="24h" || log_warn "Readonly role already exists"
    
    vault write database/roles/readwrite \
        db_name=postgresql \
        creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; \
        GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
        default_ttl="1h" \
        max_ttl="24h" || log_warn "Readwrite role already exists"
    
    log_info "Database secrets configured"
}

# Configure transit encryption
configure_transit() {
    log_info "Configuring transit encryption..."
    
    # Create encryption keys
    vault write -f transit/keys/portal-encryption \
        type=aes256-gcm96 \
        derived=false \
        exportable=false || log_warn "Encryption key already exists"
    
    vault write -f transit/keys/portal-signing \
        type=rsa-4096 \
        derived=false \
        exportable=false || log_warn "Signing key already exists"
    
    # Create convergent encryption key for deduplication
    vault write -f transit/keys/portal-convergent \
        type=aes256-gcm96 \
        derived=true \
        convergent_encryption=true || log_warn "Convergent key already exists"
    
    log_info "Transit encryption configured"
}

# Configure authentication methods
configure_auth() {
    log_info "Configuring authentication methods..."
    
    # Enable Kubernetes auth
    vault auth enable kubernetes || log_warn "Kubernetes auth already enabled"
    
    # Enable AppRole auth
    vault auth enable approle || log_warn "AppRole auth already enabled"
    
    # Enable OIDC auth
    vault auth enable oidc || log_warn "OIDC auth already enabled"
    
    # Enable JWT auth
    vault auth enable jwt || log_warn "JWT auth already enabled"
    
    # Enable LDAP auth
    vault auth enable ldap || log_warn "LDAP auth already enabled"
    
    log_info "Authentication methods configured"
}

# Create policies
create_policies() {
    log_info "Creating policies..."
    
    # Admin policy
    cat <<EOF | vault policy write admin -
# Admin policy - full access
path "*" {
  capabilities = ["create", "read", "update", "delete", "list", "sudo"]
}
EOF
    
    # Developer policy
    cat <<EOF | vault policy write developer -
# Developer policy
path "secret/data/apps/+/dev/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "secret/data/apps/+/staging/*" {
  capabilities = ["read", "list"]
}

path "database/creds/readonly" {
  capabilities = ["read"]
}

path "transit/encrypt/portal-encryption" {
  capabilities = ["update"]
}

path "transit/decrypt/portal-encryption" {
  capabilities = ["update"]
}

path "pki_int/issue/service-cert" {
  capabilities = ["create", "update"]
}
EOF
    
    # Application policy
    cat <<EOF | vault policy write application -
# Application policy
path "secret/data/apps/{{identity.entity.aliases.auth_kubernetes_*.metadata.service_account_namespace}}/*" {
  capabilities = ["read", "list"]
}

path "database/creds/readwrite" {
  capabilities = ["read"]
}

path "transit/encrypt/portal-encryption" {
  capabilities = ["update"]
}

path "transit/decrypt/portal-encryption" {
  capabilities = ["update"]
}

path "pki_int/issue/service-cert" {
  capabilities = ["create", "update"]
}
EOF
    
    # CI/CD policy
    cat <<EOF | vault policy write cicd -
# CI/CD policy
path "secret/data/cicd/*" {
  capabilities = ["read", "list"]
}

path "pki_int/issue/service-cert" {
  capabilities = ["create", "update"]
}

path "auth/token/create" {
  capabilities = ["create", "update"]
}
EOF
    
    log_info "Policies created"
}

# Configure AppRole for applications
configure_approle() {
    log_info "Configuring AppRole..."
    
    # Create role for portal application
    vault write auth/approle/role/portal \
        token_policies="application" \
        token_ttl=1h \
        token_max_ttl=4h \
        secret_id_ttl=0 \
        secret_id_num_uses=0
    
    # Get role ID
    ROLE_ID=$(vault read -format=json auth/approle/role/portal/role-id | jq -r '.data.role_id')
    
    # Generate secret ID
    SECRET_ID=$(vault write -format=json -f auth/approle/role/portal/secret-id | jq -r '.data.secret_id')
    
    # Save AppRole credentials
    cat > ~/.vault/approle.json <<EOF
{
    "role_id": "$ROLE_ID",
    "secret_id": "$SECRET_ID"
}
EOF
    chmod 600 ~/.vault/approle.json
    
    log_info "AppRole configured. Credentials saved to ~/.vault/approle.json"
}

# Setup monitoring
setup_monitoring() {
    log_info "Setting up monitoring..."
    
    # Enable metrics
    cat <<EOF | vault write sys/metrics/config prometheus_retention_time=24h
EOF
    
    log_info "Monitoring configured"
}

# Main execution
main() {
    log_info "Starting Vault initialization and configuration..."
    
    # Check and initialize if needed
    if ! check_initialization; then
        initialize_vault
    fi
    
    # Unseal Vault
    unseal_vault
    
    # Login
    login_vault
    
    # Configure components
    enable_audit
    enable_secret_engines
    configure_pki
    configure_database
    configure_transit
    configure_auth
    create_policies
    configure_approle
    setup_monitoring
    
    log_info "Vault initialization and configuration complete!"
    log_info "Root token and unseal keys saved to ~/.vault/init.json"
    log_info "AppRole credentials saved to ~/.vault/approle.json"
    log_warn "IMPORTANT: Securely backup these files and remove them from the system"
}

# Run main function
main "$@"