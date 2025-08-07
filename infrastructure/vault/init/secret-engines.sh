#!/bin/bash
set -e

# Vault initialization and secret engines setup
# This script configures all the secret engines for the Backstage portal

VAULT_ADDR=${VAULT_ADDR:-"https://localhost:8200"}
VAULT_TOKEN=${VAULT_ROOT_TOKEN}

echo "🔐 Initializing Vault Secret Engines..."

# Check if Vault is ready
vault status > /dev/null 2>&1 || {
    echo "❌ Vault is not accessible at $VAULT_ADDR"
    exit 1
}

# Function to enable secret engine if not already enabled
enable_engine() {
    local engine_type=$1
    local path=$2
    local config=${3:-""}
    
    if ! vault secrets list | grep -q "^${path}/"; then
        echo "📝 Enabling $engine_type secret engine at $path..."
        if [ -n "$config" ]; then
            vault secrets enable -path="$path" $config "$engine_type"
        else
            vault secrets enable -path="$path" "$engine_type"
        fi
    else
        echo "✅ $engine_type secret engine already enabled at $path"
    fi
}

# 1. Key-Value v2 Secret Engine for application secrets
echo "🔑 Setting up KV v2 secret engines..."
enable_engine "kv-v2" "secret"
enable_engine "kv-v2" "backstage"
enable_engine "kv-v2" "apps"
enable_engine "kv-v2" "infrastructure"

# Configure KV engines with metadata
vault write secret/config max_versions=10 delete_version_after=8760h
vault write backstage/config max_versions=5 delete_version_after=8760h
vault write apps/config max_versions=10 delete_version_after=4380h
vault write infrastructure/config max_versions=20 delete_version_after=8760h

# 2. PKI Secret Engine for certificate management
echo "🏛️ Setting up PKI secret engines..."
enable_engine "pki" "pki" "-max-lease-ttl=87600h"
enable_engine "pki" "pki_int" "-max-lease-ttl=43800h"

# Configure root CA
echo "📜 Configuring Root CA..."
vault write -field=certificate pki/root/generate/internal \
    common_name="Backstage Internal Root CA" \
    ttl=87600h > /tmp/CA_cert.crt

vault write pki/config/urls \
    issuing_certificates="$VAULT_ADDR/v1/pki/ca" \
    crl_distribution_points="$VAULT_ADDR/v1/pki/crl"

# Configure intermediate CA
echo "📋 Configuring Intermediate CA..."
vault write -format=json pki_int/intermediate/generate/internal \
    common_name="Backstage Intermediate Authority" \
    | jq -r '.data.csr' > /tmp/pki_intermediate.csr

vault write -format=json pki/root/sign-intermediate csr=@/tmp/pki_intermediate.csr \
    format=pem_bundle ttl=43800h \
    | jq -r '.data.certificate' > /tmp/intermediate.cert.pem

vault write pki_int/intermediate/set-signed certificate=@/tmp/intermediate.cert.pem

vault write pki_int/config/urls \
    issuing_certificates="$VAULT_ADDR/v1/pki_int/ca" \
    crl_distribution_points="$VAULT_ADDR/v1/pki_int/crl"

# Create role for Backstage services
vault write pki_int/roles/backstage-dot-local \
    allowed_domains="backstage.local,*.backstage.local,localhost" \
    allow_subdomains=true \
    max_ttl="720h"

# 3. Database Secret Engine for dynamic database credentials
echo "🗄️ Setting up Database secret engine..."
enable_engine "database" "database"

# Configure PostgreSQL connection
vault write database/config/postgres \
    plugin_name=postgresql-database-plugin \
    connection_url="postgresql://{{username}}:{{password}}@postgres:5432/backstage?sslmode=disable" \
    allowed_roles="readonly,readwrite,admin" \
    username="vault" \
    password="vault-postgres-password"

# Create database roles
vault write database/roles/readonly \
    db_name=postgres \
    creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; \
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
    default_ttl="1h" \
    max_ttl="24h"

vault write database/roles/readwrite \
    db_name=postgres \
    creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; \
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
    default_ttl="4h" \
    max_ttl="24h"

vault write database/roles/admin \
    db_name=postgres \
    creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; \
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
    default_ttl="1h" \
    max_ttl="4h"

# Configure MySQL connection
vault write database/config/mysql \
    plugin_name=mysql-database-plugin \
    connection_url="{{username}}:{{password}}@tcp(mysql:3306)/" \
    allowed_roles="readonly,readwrite" \
    username="vault" \
    password="vault-mysql-password"

vault write database/roles/mysql-readonly \
    db_name=mysql \
    creation_statements="CREATE USER '{{name}}'@'%' IDENTIFIED BY '{{password}}';GRANT SELECT ON *.* TO '{{name}}'@'%';" \
    default_ttl="1h" \
    max_ttl="24h"

# Configure Redis connection
vault write database/config/redis \
    plugin_name=redis-database-plugin \
    host="redis" \
    port=6379 \
    username="vault" \
    password="vault-redis-password" \
    allowed_roles="readonly,readwrite"

# 4. Transit Secret Engine for encryption as a service
echo "🔒 Setting up Transit secret engine..."
enable_engine "transit" "transit"

# Create encryption keys for different use cases
vault write -f transit/keys/backstage-data
vault write -f transit/keys/user-pii
vault write -f transit/keys/api-tokens
vault write -f transit/keys/session-data

# Configure key policies
vault write transit/keys/backstage-data/config \
    min_decryption_version=1 \
    min_encryption_version=0 \
    deletion_allowed=false \
    exportable=false

vault write transit/keys/user-pii/config \
    min_decryption_version=1 \
    min_encryption_version=0 \
    deletion_allowed=false \
    exportable=false

# 5. SSH Secret Engine for SSH certificate authority
echo "🔐 Setting up SSH secret engine..."
enable_engine "ssh" "ssh"

# Configure SSH CA
vault write ssh/config/ca generate_signing_key=true

# Create SSH roles
vault write ssh/roles/otp_key_role \
    key_type=otp \
    default_user=backstage \
    cidr_list=10.0.0.0/8,192.168.0.0/16

vault write ssh/roles/ca_key_role \
    key_type=ca \
    ttl=30m \
    max_ttl=1h \
    allow_user_certificates=true \
    allowed_users="*" \
    allowed_extensions="permit-pty,permit-port-forwarding" \
    default_extensions_template=true \
    default_user="{{identity.entity.aliases.auth_kubernetes_xxx.name}}"

# 6. TOTP Secret Engine for time-based one-time passwords
echo "🕐 Setting up TOTP secret engine..."
enable_engine "totp" "totp"

# 7. AWS Secret Engine for dynamic AWS credentials
echo "☁️ Setting up AWS secret engine..."
enable_engine "aws" "aws"

# Configure AWS root credentials (these should be injected from environment)
if [ -n "$AWS_ACCESS_KEY_ID" ] && [ -n "$AWS_SECRET_ACCESS_KEY" ]; then
    vault write aws/config/root \
        access_key="$AWS_ACCESS_KEY_ID" \
        secret_key="$AWS_SECRET_ACCESS_KEY" \
        region="us-west-2"

    # Create AWS roles
    vault write aws/roles/backstage-readonly \
        credential_type=iam_user \
        policy_document=-<<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": "*"
    }
  ]
}
EOF

    vault write aws/roles/backstage-admin \
        credential_type=iam_user \
        policy_arns="arn:aws:iam::aws:policy/AdministratorAccess" \
        default_sts_ttl="15m" \
        max_sts_ttl="60m"
fi

# 8. GCP Secret Engine for dynamic GCP credentials
echo "🌐 Setting up GCP secret engine..."
enable_engine "gcp" "gcp"

# Configure GCP if service account key is provided
if [ -f "/vault/config/gcp-service-account.json" ]; then
    vault write gcp/config \
        credentials=@/vault/config/gcp-service-account.json

    # Create GCP roles
    vault write gcp/roleset/backstage-readonly \
        project="your-gcp-project" \
        bindings=-<<EOF
resource "//cloudresourcemanager.googleapis.com/projects/your-gcp-project" {
  roles = ["roles/viewer"]
}
EOF
fi

# 9. Azure Secret Engine for dynamic Azure credentials
echo "🔵 Setting up Azure secret engine..."
enable_engine "azure" "azure"

# Configure Azure if credentials are provided
if [ -n "$AZURE_SUBSCRIPTION_ID" ] && [ -n "$AZURE_TENANT_ID" ]; then
    vault write azure/config \
        subscription_id="$AZURE_SUBSCRIPTION_ID" \
        tenant_id="$AZURE_TENANT_ID" \
        client_id="$AZURE_CLIENT_ID" \
        client_secret="$AZURE_CLIENT_SECRET"

    # Create Azure roles
    vault write azure/roles/backstage-contributor \
        azure_roles=-<<EOF
[
  {
    "role_name": "Contributor",
    "scope":  "/subscriptions/$AZURE_SUBSCRIPTION_ID"
  }
]
EOF
fi

# 10. LDAP Secret Engine for dynamic LDAP passwords
echo "📁 Setting up LDAP secret engine..."
enable_engine "ldap" "ldap"

# Configure LDAP if connection details are provided
if [ -n "$LDAP_URL" ]; then
    vault write ldap/config \
        binddn="$LDAP_BIND_DN" \
        bindpass="$LDAP_BIND_PASSWORD" \
        url="$LDAP_URL" \
        userdn="$LDAP_USER_DN"

    # Create LDAP roles
    vault write ldap/static-role/readonly-user \
        dn="$LDAP_READONLY_USER_DN" \
        username="readonly-user" \
        rotation_period="24h"
fi

echo "✅ All secret engines configured successfully!"

# Clean up temporary files
rm -f /tmp/CA_cert.crt /tmp/pki_intermediate.csr /tmp/intermediate.cert.pem

echo "🎉 Vault secret engines initialization complete!"
echo "📋 Summary:"
echo "   - KV v2: secret/, backstage/, apps/, infrastructure/"
echo "   - PKI: pki/ (root), pki_int/ (intermediate)"
echo "   - Database: postgresql, mysql, redis"
echo "   - Transit: encryption keys for data protection"
echo "   - SSH: certificate authority"
echo "   - Cloud: AWS, GCP, Azure (if configured)"
echo "   - LDAP: dynamic password rotation"
echo "   - TOTP: time-based one-time passwords"