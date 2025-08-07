apiVersion: v1
kind: Secret
metadata:
  name: backstage-secrets
  namespace: backstage-system
  labels:
    app: backstage
    managed-by: vault-agent
type: Opaque
stringData:
  # Database credentials
  {{- with secret "database/creds/readwrite" }}
  POSTGRES_USER: {{ .Data.username }}
  POSTGRES_PASSWORD: {{ .Data.password }}
  POSTGRES_HOST: postgres.backstage-system.svc.cluster.local
  POSTGRES_PORT: "5432"
  POSTGRES_DB: backstage
  {{- end }}

  # Redis credentials
  {{- with secret "database/creds/redis-readwrite" }}
  REDIS_USER: {{ .Data.username }}
  REDIS_PASSWORD: {{ .Data.password }}
  REDIS_HOST: redis.backstage-system.svc.cluster.local
  REDIS_PORT: "6379"
  {{- end }}

  # GitHub integration
  {{- with secret "secret/data/backstage/integrations/github" }}
  GITHUB_TOKEN: {{ .Data.data.token }}
  {{- end }}

  # Auth providers
  {{- with secret "secret/data/backstage/auth/github" }}
  GITHUB_CLIENT_ID: {{ .Data.data.clientId }}
  GITHUB_CLIENT_SECRET: {{ .Data.data.clientSecret }}
  {{- end }}

  {{- with secret "secret/data/backstage/auth/microsoft" }}
  MICROSOFT_CLIENT_ID: {{ .Data.data.clientId }}
  MICROSOFT_CLIENT_SECRET: {{ .Data.data.clientSecret }}
  MICROSOFT_TENANT_ID: {{ .Data.data.tenantId }}
  {{- end }}

  # Vault configuration
  {{- with secret "secret/data/backstage/vault" }}
  VAULT_TOKEN: {{ .Data.data.token }}
  VAULT_ADDR: https://vault.backstage-system.svc.cluster.local:8200
  {{- end }}

  # Cloud credentials
  {{- with secret "aws/creds/backstage-readonly" }}
  AWS_ACCESS_KEY_ID: {{ .Data.access_key }}
  AWS_SECRET_ACCESS_KEY: {{ .Data.secret_key }}
  AWS_REGION: us-west-2
  {{- end }}

---
apiVersion: v1
kind: Secret
metadata:
  name: backstage-tls
  namespace: backstage-system
  labels:
    app: backstage
    managed-by: vault-agent
type: kubernetes.io/tls
data:
  {{- with secret "pki_int/issue/backstage-dot-local" "common_name=backstage.local" "alt_names=*.backstage.local" }}
  tls.crt: {{ .Data.certificate | base64Encode }}
  tls.key: {{ .Data.private_key | base64Encode }}
  ca.crt: {{ .Data.issuing_ca | base64Encode }}
  {{- end }}

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: backstage-vault-config
  namespace: backstage-system
  labels:
    app: backstage
    managed-by: vault-agent
data:
  vault-config.yaml: |
    vault:
      baseUrl: https://vault.backstage-system.svc.cluster.local:8200
      secretEngine: secret
      kvVersion: 2
      timeout: 30000
      retries: 3
      namespaces:
        - backstage
        - secret
        - apps
        - infrastructure