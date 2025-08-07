#!/bin/bash

# Generate SSL certificates for Kong Gateway
set -e

echo "Generating SSL certificates for Kong Gateway..."

# Create SSL directory if it doesn't exist
mkdir -p /opt/kong/ssl

# Generate private key
openssl genrsa -out kong.key 2048

# Generate certificate signing request
openssl req -new -key kong.key -out kong.csr -subj "/C=US/ST=CA/L=San Francisco/O=Company/OU=IT Department/CN=kong-gateway"

# Generate self-signed certificate
openssl x509 -req -days 365 -in kong.csr -signkey kong.key -out kong.crt

# Set proper permissions
chmod 600 kong.key
chmod 644 kong.crt

echo "SSL certificates generated successfully:"
echo "  - Certificate: kong.crt"
echo "  - Private Key: kong.key"

# Clean up CSR file
rm kong.csr

echo "Certificate generation complete!"