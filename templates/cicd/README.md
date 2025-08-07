# CI/CD Template Library

## Overview

This directory contains production-ready CI/CD pipeline templates for various platforms and technology stacks. Each template is fully configured with best practices, security scanning, quality gates, and deployment strategies.

## Supported Platforms

- **GitHub Actions** - Cloud-native CI/CD integrated with GitHub
- **GitLab CI** - GitLab's built-in CI/CD solution
- **Jenkins** - Self-hosted automation server
- **Azure DevOps** - Microsoft's DevOps platform
- **Tekton** - Cloud-native CI/CD for Kubernetes
- **CircleCI** - Cloud-based CI/CD platform

## Supported Languages & Frameworks

### Backend
- Node.js / TypeScript
- Python
- Java (Spring Boot, Maven, Gradle)
- Go
- .NET Core / C#
- Rust
- Ruby (Rails)
- PHP (Laravel, Symfony)

### Frontend
- React
- Vue.js
- Angular
- Next.js
- Svelte

### Mobile
- React Native
- Flutter
- iOS (Swift)
- Android (Kotlin)

### Infrastructure
- Terraform
- Ansible
- Pulumi
- CloudFormation

## Template Structure

```
cicd/
├── github-actions/
│   ├── nodejs/
│   │   ├── basic.yml
│   │   ├── advanced.yml
│   │   └── microservices.yml
│   ├── python/
│   ├── java/
│   └── ...
├── gitlab-ci/
│   └── ...
├── jenkins/
│   └── ...
└── ...
```

## Features

### 🔒 Security
- SAST (Static Application Security Testing)
- Dependency vulnerability scanning
- Container image scanning
- Secret detection
- License compliance checking

### ✅ Quality Gates
- Code coverage thresholds
- Complexity analysis
- Code duplication detection
- Linting and formatting
- Type checking

### 🚀 Deployment Strategies
- **Rolling Update** - Gradual replacement of instances
- **Blue-Green** - Zero-downtime deployment with instant rollback
- **Canary** - Progressive rollout with metrics monitoring
- **Feature Flags** - Controlled feature releases
- **A/B Testing** - Experiment-driven deployments

### 📊 Monitoring & Observability
- Performance metrics collection
- Error tracking integration
- APM (Application Performance Monitoring)
- Custom dashboards and alerts

### 🔄 Automation
- Automated dependency updates
- Auto-merge for approved PRs
- Scheduled security scans
- Automated rollback on failures
- Progressive delivery

## Quick Start

### 1. Choose Your Platform
Select the CI/CD platform that matches your infrastructure:
- For GitHub repositories: Use GitHub Actions
- For GitLab: Use GitLab CI
- For self-hosted: Consider Jenkins or Tekton
- For cloud-agnostic: CircleCI or Azure DevOps

### 2. Select Your Tech Stack
Navigate to the appropriate directory:
```bash
templates/cicd/<platform>/<language>/
```

### 3. Copy the Template
Choose between:
- `basic.yml` - Simple CI/CD with essential features
- `advanced.yml` - Full-featured pipeline with all bells and whistles
- `microservices.yml` - Multi-service monorepo support

### 4. Configure
Update the template with your specific:
- Repository details
- Environment URLs
- Secret names
- Integration tokens

### 5. Required Secrets
Most templates require these secrets:
- `REGISTRY_USERNAME` / `REGISTRY_PASSWORD` - Container registry
- `SONAR_TOKEN` - SonarQube/SonarCloud
- `SNYK_TOKEN` - Security scanning
- `SLACK_WEBHOOK` - Notifications
- `DEPLOY_KEY` - Deployment credentials

## Template Examples

### Node.js Microservice (GitHub Actions)
```yaml
name: Node.js Microservice CI/CD
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
  
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm audit --audit-level=moderate
      - uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
  
  deploy:
    needs: [test, security]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: echo "Deploy to production"
```

### Python API (GitLab CI)
```yaml
stages:
  - test
  - security
  - build
  - deploy

test:unit:
  stage: test
  image: python:3.11
  script:
    - pip install -r requirements.txt
    - pytest tests/unit --cov=src

security:scan:
  stage: security
  script:
    - pip install safety
    - safety check

deploy:production:
  stage: deploy
  environment: production
  only:
    - main
  script:
    - echo "Deploy to production"
```

## Best Practices

### 1. Security First
- Never commit secrets to version control
- Use secret scanning in every pipeline
- Implement least-privilege access
- Rotate credentials regularly

### 2. Fail Fast
- Run quick checks first (linting, type checking)
- Parallelize independent jobs
- Use caching effectively
- Set reasonable timeouts

### 3. Progressive Deployment
- Always deploy to staging first
- Use canary deployments for production
- Implement automated rollback
- Monitor key metrics during deployment

### 4. Quality Gates
- Set minimum code coverage (80%+)
- Limit code complexity
- Prevent duplicate code
- Enforce coding standards

### 5. Documentation
- Document pipeline requirements
- Include troubleshooting guides
- Maintain runbooks for deployments
- Keep secrets documentation updated

## Customization

### Adding Quality Gates
```yaml
quality-gates:
  stage: quality
  script:
    - coverage_percent=$(cat coverage.txt)
    - if [ "$coverage_percent" -lt "80" ]; then exit 1; fi
    - complexity=$(npx code-complexity . --format json | jq .average)
    - if [ "$complexity" -gt "10" ]; then exit 1; fi
```

### Implementing Canary Deployment
```yaml
deploy:canary:
  script:
    - kubectl set image deployment/app app=$IMAGE:$VERSION --record
    - kubectl scale deployment/app-canary --replicas=1
    - sleep 300  # Monitor for 5 minutes
    - kubectl scale deployment/app-canary --replicas=3
    - sleep 600  # Monitor for 10 minutes
    - kubectl scale deployment/app --replicas=10
    - kubectl scale deployment/app-canary --replicas=0
```

### Adding Performance Testing
```yaml
performance:test:
  stage: test
  script:
    - npm run build
    - npm run start &
    - sleep 10
    - k6 run tests/performance/load-test.js
    - k6 run tests/performance/stress-test.js
```

## Troubleshooting

### Common Issues

#### Build Failures
- Check dependency versions
- Verify build cache integrity
- Review recent code changes
- Check for disk space issues

#### Test Failures
- Review test logs
- Check for flaky tests
- Verify test environment setup
- Check external service dependencies

#### Deployment Failures
- Verify credentials and permissions
- Check target environment health
- Review deployment logs
- Verify network connectivity

#### Security Scan Failures
- Review vulnerability reports
- Update vulnerable dependencies
- Check for false positives
- Apply security patches

## Integration with Backstage

These templates are designed to work seamlessly with Backstage Software Templates:

1. **Template Selection**: Choose templates based on component metadata
2. **Auto-configuration**: Templates auto-configure based on catalog info
3. **Secret Management**: Integrated with Backstage secret management
4. **Monitoring**: Automatic dashboard creation
5. **Documentation**: Auto-generated pipeline docs

## Contributing

To add a new template:

1. Create directory structure: `<platform>/<language>/`
2. Add basic and advanced templates
3. Include configuration examples
4. Document required secrets
5. Add to this README
6. Test with sample project

## Support

- **Documentation**: See individual template files for detailed docs
- **Issues**: Report issues in the platform repository
- **Questions**: Contact the Platform Team
- **Updates**: Templates are updated monthly

## License

These templates are provided under the MIT License. Feel free to modify and use in your projects.