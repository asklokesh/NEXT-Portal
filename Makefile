
# Makefile for Enhanced Plugin Management System

.PHONY: all build deploy clean test

# Variables
DOCKER_REGISTRY ?= your-docker-registry

# Targets
all: build

build:
	@echo "Building Docker images..."
	docker build -t $(DOCKER_REGISTRY)/portal-frontend:latest -f Dockerfile.frontend .
	docker build -t $(DOCKER_REGISTRY)/backstage-backend:latest -f Dockerfile.backend .
	docker build -t $(DOCKER_REGISTRY)/plugin-orchestrator:latest -f Dockerfile.workflow .

push:
	@echo "Pushing Docker images to registry..."
	docker push $(DOCKER_REGISTRY)/portal-frontend:latest
	docker push $(DOCKER_REGISTRY)/backstage-backend:latest
	docker push $(DOCKER_REGISTRY)/plugin-orchestrator:latest

deploy:
	@echo "Deploying application to Kubernetes..."
	helm upgrade --install portal ./infrastructure/helm/portal -f ./infrastructure/helm/portal/production.yaml --namespace developer-portal --create-namespace
	helm upgrade --install plugin-orchestrator ./infrastructure/helm/plugin-pipeline/helm/plugin-orchestrator -f ./infrastructure/plugin-pipeline/helm/plugin-orchestrator/production.yaml --namespace plugin-pipeline --create-namespace

clean:
	@echo "Cleaning up..."
	docker rmi $(DOCKER_REGISTRY)/portal-frontend:latest
	docker rmi $(DOCKER_REGISTRY)/backstage-backend:latest
	docker rmi $(DOCKER_REGISTRY)/plugin-orchestrator:latest

lint:
	@echo "Linting code..."
	eslint . --ext .ts,.tsx

.PHONY: help

help:
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  all                  Build all Docker images"
	@echo "  build                Build all Docker images"
	@echo "  push                 Push all Docker images to the registry"
	@echo "  deploy               Deploy the application to Kubernetes"
	@echo "  clean                Clean up Docker images"
	@echo "  lint                 Lint the code"
	@echo "  help                 Show this help message"
