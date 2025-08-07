{{/*
Expand the name of the chart.
*/}}
{{- define "plugin-orchestrator.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "plugin-orchestrator.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "plugin-orchestrator.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "plugin-orchestrator.labels" -}}
helm.sh/chart: {{ include "plugin-orchestrator.chart" . }}
{{ include "plugin-orchestrator.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/component: plugin-orchestrator
app.kubernetes.io/part-of: plugin-pipeline
{{- end }}

{{/*
Selector labels
*/}}
{{- define "plugin-orchestrator.selectorLabels" -}}
app.kubernetes.io/name: {{ include "plugin-orchestrator.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "plugin-orchestrator.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "plugin-orchestrator.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Create the name of the secret to use
*/}}
{{- define "plugin-orchestrator.secretName" -}}
{{- if .Values.existingSecret }}
{{- .Values.existingSecret }}
{{- else }}
{{- include "plugin-orchestrator.fullname" . }}-secret
{{- end }}
{{- end }}

{{/*
Create PostgreSQL connection URL
*/}}
{{- define "plugin-orchestrator.postgresql.url" -}}
{{- if .Values.postgresql.enabled }}
{{- $host := include "postgresql.primary.fullname" .Subcharts.postgresql }}
{{- $port := .Values.postgresql.primary.service.ports.postgresql | default 5432 }}
{{- $database := .Values.postgresql.auth.database }}
{{- $username := .Values.postgresql.auth.username }}
{{- printf "postgresql://%s:$(POSTGRES_PASSWORD)@%s:%d/%s" $username $host $port $database }}
{{- else }}
{{- .Values.externalDatabase.url }}
{{- end }}
{{- end }}

{{/*
Create Redis connection URL
*/}}
{{- define "plugin-orchestrator.redis.url" -}}
{{- if .Values.redis.enabled }}
{{- $host := include "redis.fullname" .Subcharts.redis }}-master
{{- $port := .Values.redis.master.service.ports.redis | default 6379 }}
{{- if .Values.redis.auth.enabled }}
{{- printf "redis://:$(REDIS_PASSWORD)@%s:%d/0" $host $port }}
{{- else }}
{{- printf "redis://%s:%d/0" $host $port }}
{{- end }}
{{- else }}
{{- .Values.externalRedis.url }}
{{- end }}
{{- end }}

{{/*
Create image pull secrets
*/}}
{{- define "plugin-orchestrator.imagePullSecrets" -}}
{{- $pullSecrets := list }}
{{- if .Values.global.imagePullSecrets }}
{{- $pullSecrets = concat $pullSecrets .Values.global.imagePullSecrets }}
{{- end }}
{{- if .Values.pluginOrchestrator.image.pullSecrets }}
{{- $pullSecrets = concat $pullSecrets .Values.pluginOrchestrator.image.pullSecrets }}
{{- end }}
{{- if $pullSecrets }}
imagePullSecrets:
{{- range $pullSecrets }}
  - name: {{ . }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Validate required values
*/}}
{{- define "plugin-orchestrator.validateValues" -}}
{{- if and (not .Values.postgresql.enabled) (not .Values.externalDatabase.url) }}
{{- fail "Either postgresql.enabled must be true or externalDatabase.url must be provided" }}
{{- end }}
{{- if and (not .Values.redis.enabled) (not .Values.externalRedis.url) }}
{{- fail "Either redis.enabled must be true or externalRedis.url must be provided" }}
{{- end }}
{{- end }}

{{/*
Get the proper image name
*/}}
{{- define "plugin-orchestrator.image" -}}
{{- $registry := .Values.pluginOrchestrator.image.registry -}}
{{- $repository := .Values.pluginOrchestrator.image.repository -}}
{{- $tag := .Values.pluginOrchestrator.image.tag | default .Chart.AppVersion -}}
{{- if .Values.global.imageRegistry }}
{{- printf "%s/%s:%s" .Values.global.imageRegistry $repository $tag -}}
{{- else }}
{{- printf "%s/%s:%s" $registry $repository $tag -}}
{{- end }}
{{- end }}

{{/*
Create storage class name
*/}}
{{- define "plugin-orchestrator.storageClassName" -}}
{{- if .Values.global.storageClass }}
{{- .Values.global.storageClass }}
{{- else if .Values.persistence.storageClass }}
{{- .Values.persistence.storageClass }}
{{- end }}
{{- end }}

{{/*
Create environment-specific labels
*/}}
{{- define "plugin-orchestrator.environmentLabels" -}}
environment: {{ .Values.environment | default "production" }}
{{- if .Values.featureFlags.enableBetaFeatures }}
beta-features: "enabled"
{{- end }}
{{- if .Values.featureFlags.enableExperimentalFeatures }}
experimental-features: "enabled"
{{- end }}
{{- end }}

{{/*
Create resource limits based on environment
*/}}
{{- define "plugin-orchestrator.resources" -}}
{{- if eq .Values.environment "development" }}
requests:
  cpu: 100m
  memory: 256Mi
limits:
  cpu: 500m
  memory: 1Gi
{{- else if eq .Values.environment "staging" }}
requests:
  cpu: 250m
  memory: 512Mi
limits:
  cpu: 1000m
  memory: 2Gi
{{- else }}
{{- toYaml .Values.pluginOrchestrator.resources }}
{{- end }}
{{- end }}

{{/*
Create affinity rules based on environment
*/}}
{{- define "plugin-orchestrator.affinity" -}}
{{- if .Values.pluginOrchestrator.affinity }}
{{- toYaml .Values.pluginOrchestrator.affinity }}
{{- else if eq .Values.environment "production" }}
podAntiAffinity:
  requiredDuringSchedulingIgnoredDuringExecution:
    - labelSelector:
        matchExpressions:
          - key: app.kubernetes.io/name
            operator: In
            values:
              - {{ include "plugin-orchestrator.name" . }}
      topologyKey: kubernetes.io/hostname
nodeAffinity:
  preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 100
      preference:
        matchExpressions:
          - key: node-type
            operator: In
            values:
              - compute-optimized
{{- end }}
{{- end }}

{{/*
Create tolerations based on environment
*/}}
{{- define "plugin-orchestrator.tolerations" -}}
{{- if .Values.pluginOrchestrator.tolerations }}
{{- toYaml .Values.pluginOrchestrator.tolerations }}
{{- else if eq .Values.environment "production" }}
- key: "dedicated"
  operator: "Equal"
  value: "plugin-pipeline"
  effect: "NoSchedule"
{{- end }}
{{- end }}

{{/*
Create security context based on environment
*/}}
{{- define "plugin-orchestrator.securityContext" -}}
{{- if .Values.security.podSecurityStandards.enabled }}
allowPrivilegeEscalation: false
capabilities:
  drop:
    - ALL
readOnlyRootFilesystem: true
runAsNonRoot: true
runAsUser: 10001
runAsGroup: 10001
seccompProfile:
  type: RuntimeDefault
{{- else }}
{{- toYaml .Values.pluginOrchestrator.securityContext }}
{{- end }}
{{- end }}

{{/*
Create network policy ingress rules
*/}}
{{- define "plugin-orchestrator.networkPolicy.ingressRules" -}}
{{- if .Values.networkPolicy.ingress.enabled }}
{{- range .Values.networkPolicy.ingress.rules }}
- from:
  {{- toYaml .from | nindent 4 }}
  ports:
  {{- range .ports }}
  - protocol: {{ .protocol }}
    port: {{ .port }}
  {{- end }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create network policy egress rules
*/}}
{{- define "plugin-orchestrator.networkPolicy.egressRules" -}}
{{- if .Values.networkPolicy.egress.enabled }}
{{- range .Values.networkPolicy.egress.rules }}
- to:
  {{- if .to }}
  {{- toYaml .to | nindent 4 }}
  {{- else }}
  []
  {{- end }}
  ports:
  {{- range .ports }}
  - protocol: {{ .protocol }}
    port: {{ .port }}
  {{- end }}
{{- end }}
{{- end }}
{{- end }}