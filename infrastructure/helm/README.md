
# Helm Charts

This directory contains the Helm charts for deploying the Enhanced Plugin Management System.

## Prerequisites

- Helm v3 or later
- A running Kubernetes cluster

## Deployment

To deploy the application, you can use the following commands:

### Portal

```bash
helm upgrade --install portal ./portal -f ./portal/production.yaml --namespace developer-portal --create-namespace
```

### Plugin Orchestrator

```bash
helm upgrade --install plugin-orchestrator ./plugin-pipeline/helm/plugin-orchestrator -f ./plugin-pipeline/helm/plugin-orchestrator/production.yaml --namespace plugin-pipeline --create-namespace
```

## Uninstallation

To uninstall the application, you can use the following commands:

### Portal

```bash
helm uninstall portal --namespace developer-portal
```

### Plugin Orchestrator

```bash
helm uninstall plugin-orchestrator --namespace plugin-pipeline
```
