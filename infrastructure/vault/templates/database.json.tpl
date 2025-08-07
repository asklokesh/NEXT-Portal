{{- with secret "database/creds/readwrite" -}}
{
  "database": {
    "host": "postgres.backstage-system.svc.cluster.local",
    "port": 5432,
    "database": "backstage",
    "username": "{{ .Data.username }}",
    "password": "{{ .Data.password }}",
    "ssl": {
      "rejectUnauthorized": false,
      "ca": "{{ file "/vault/secrets/ca.crt" | base64Encode }}"
    },
    "connection": {
      "max": 20,
      "min": 5,
      "acquireTimeoutMillis": 60000,
      "idleTimeoutMillis": 600000
    }
  },
  "redis": {
    {{- with secret "database/creds/redis-readwrite" }}
    "host": "redis.backstage-system.svc.cluster.local",
    "port": 6379,
    "username": "{{ .Data.username }}",
    "password": "{{ .Data.password }}",
    {{- end }}
    "db": 0,
    "maxRetriesPerRequest": 3,
    "retryDelayOnFailover": 100,
    "lazyConnect": true
  }
}
{{- end -}}