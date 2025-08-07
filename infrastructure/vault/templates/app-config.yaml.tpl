app:
  title: Backstage Developer Portal
  baseUrl: https://backstage.local:3000

organization:
  name: Enterprise

backend:
  baseUrl: https://backstage.local:7007
  listen:
    port: 7007
    host: 0.0.0.0
  csp:
    connect-src: ["'self'", 'http:', 'https:']
  cors:
    origin: https://backstage.local:3000
    methods: [GET, HEAD, PATCH, POST, PUT, DELETE]
    credentials: true
  
  database:
    {{- with secret "database/creds/readwrite" }}
    client: pg
    connection:
      host: postgres.backstage-system.svc.cluster.local
      port: 5432
      user: {{ .Data.username }}
      password: {{ .Data.password }}
      database: backstage
      ssl:
        rejectUnauthorized: false
    {{- end }}

  cache:
    {{- with secret "database/creds/redis-readwrite" }}
    store: redis
    connection: redis://{{ .Data.username }}:{{ .Data.password }}@redis.backstage-system.svc.cluster.local:6379/0
    {{- end }}

auth:
  providers:
    github:
      {{- with secret "secret/data/backstage/auth/github" }}
      development:
        clientId: {{ .Data.data.clientId }}
        clientSecret: {{ .Data.data.clientSecret }}
      {{- end }}
    
    microsoft:
      {{- with secret "secret/data/backstage/auth/microsoft" }}
      development:
        clientId: {{ .Data.data.clientId }}
        clientSecret: {{ .Data.data.clientSecret }}
        tenantId: {{ .Data.data.tenantId }}
      {{- end }}
    
    google:
      {{- with secret "secret/data/backstage/auth/google" }}
      development:
        clientId: {{ .Data.data.clientId }}
        clientSecret: {{ .Data.data.clientSecret }}
      {{- end }}

catalog:
  rules:
    - allow: [Component, System, API, Resource, Location]
  locations:
    - type: file
      target: ../../examples/entities.yaml

integrations:
  github:
    {{- with secret "secret/data/backstage/integrations/github" }}
    - host: github.com
      token: {{ .Data.data.token }}
    {{- end }}
  
  gitlab:
    {{- with secret "secret/data/backstage/integrations/gitlab" }}
    - host: gitlab.com
      token: {{ .Data.data.token }}
    {{- end }}
  
  bitbucket:
    {{- with secret "secret/data/backstage/integrations/bitbucket" }}
    - host: bitbucket.org
      username: {{ .Data.data.username }}
      appPassword: {{ .Data.data.appPassword }}
    {{- end }}

proxy:
  '/vault':
    target: 'https://vault.backstage-system.svc.cluster.local:8200'
    headers:
      {{- with secret "secret/data/backstage/vault" }}
      X-Vault-Token: {{ .Data.data.token }}
      {{- end }}

scaffolder:
  {{- with secret "secret/data/backstage/scaffolder" }}
  defaultAuthor:
    name: {{ .Data.data.authorName | default "Backstage" }}
    email: {{ .Data.data.authorEmail | default "noreply@backstage.local" }}
  {{- end }}

techdocs:
  builder: 'local'
  generator:
    runIn: 'local'
  publisher:
    type: 'local'

kubernetes:
  serviceLocatorMethod:
    type: 'multiTenant'
  clusterLocatorMethods:
    - type: 'config'
      clusters:
        - url: https://kubernetes.default.svc
          name: local
          authProvider: 'serviceAccount'
          skipTLSVerify: false
          skipMetricsLookup: false

vault:
  baseUrl: https://vault.backstage-system.svc.cluster.local:8200
  {{- with secret "secret/data/backstage/vault" }}
  token: {{ .Data.data.token }}
  {{- end }}
  secretEngine: secret

# Cloud provider configurations
aws:
  {{- with secret "aws/creds/backstage-readonly" }}
  credentials:
    accessKeyId: {{ .Data.access_key }}
    secretAccessKey: {{ .Data.secret_key }}
  region: us-west-2
  {{- end }}

gcp:
  {{- with secret "gcp/roleset/backstage-readonly/token" }}
  credentials: {{ .Data.token | toJson }}
  projectId: your-gcp-project
  {{- end }}

azure:
  {{- with secret "azure/creds/backstage-contributor" }}
  credentials:
    clientId: {{ .Data.client_id }}
    clientSecret: {{ .Data.client_secret }}
    tenantId: {{ .Data.tenant_id }}
  subscriptionId: your-azure-subscription
  {{- end }}