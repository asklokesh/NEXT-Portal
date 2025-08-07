# Production Deployment Checklist

This checklist ensures a smooth and secure production deployment of the Backstage IDP Platform.

## Pre-Deployment

### Infrastructure Setup
- [ ] **Cloud Provider Account**
 - [ ] AWS/GCP/Azure account configured
 - [ ] IAM roles and service accounts created
 - [ ] Resource quotas verified
 - [ ] Billing alerts configured

- [ ] **Kubernetes Cluster**
 - [ ] Cluster provisioned (minimum 3 nodes)
 - [ ] RBAC configured
 - [ ] Network policies enabled
 - [ ] Ingress controller installed
 - [ ] cert-manager installed for SSL
 - [ ] Monitoring stack deployed (Prometheus/Grafana)

- [ ] **Database**
 - [ ] PostgreSQL 15+ provisioned
 - [ ] High availability configured
 - [ ] Automated backups enabled
 - [ ] Connection pooling configured
 - [ ] SSL/TLS enforced

- [ ] **Redis**
 - [ ] Redis cluster deployed
 - [ ] Persistence enabled
 - [ ] Password protection configured
 - [ ] Backup schedule configured

- [ ] **DNS and SSL**
 - [ ] Domain name registered
 - [ ] DNS records configured
 - [ ] SSL certificates obtained
 - [ ] Wildcard certificate for subdomains

### Security Configuration
- [ ] **Secrets Management**
 - [ ] All secrets stored in Kubernetes secrets or vault
 - [ ] Database passwords rotated
 - [ ] API keys generated
 - [ ] JWT secrets configured
 - [ ] Encryption keys set (32 characters)

- [ ] **Network Security**
 - [ ] Firewall rules configured
 - [ ] VPN access set up for admin
 - [ ] IP whitelisting for sensitive endpoints
 - [ ] DDoS protection enabled

- [ ] **Authentication**
 - [ ] OAuth providers configured
 - [ ] Admin users created
 - [ ] MFA enabled for admin accounts
 - [ ] Session timeout configured

### Application Configuration
- [ ] **Environment Variables**
 ```bash
 # Review and set all variables in .env.production
 cp .env.production .env.production.local
 # Edit with production values
 ```

- [ ] **Feature Flags**
 - [ ] Review enabled features
 - [ ] Disable development features
 - [ ] Configure rate limits
 - [ ] Set cache TTLs

- [ ] **External Services**
 - [ ] Backstage API URL verified
 - [ ] SMTP server configured
 - [ ] Sentry DSN configured
 - [ ] Cloud cost provider credentials set

## Deployment Process

### 1. Build and Test
```bash
# Run full test suite
npm run test
npm run test:e2e

# Build production image
docker build -f Dockerfile.production -t backstage-idp-wrapper:latest .

# Test the image locally
docker run -p 3000:3000 --env-file .env.production.local backstage-idp-wrapper:latest
```

### 2. Database Migration
```bash
# Test migrations on staging first
npx prisma migrate deploy --preview-feature

# Create backup before production migration
./scripts/backup.sh production database

# Run production migrations
kubectl exec -it deploy/backstage-idp -- npx prisma migrate deploy
```

### 3. Deploy to Kubernetes
```bash
# Create namespace and secrets
kubectl apply -f k8s/namespace.yaml
kubectl create secret generic backstage-idp-secret --from-env-file=.env.production.local -n backstage-idp

# Deploy infrastructure components
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml

# Wait for databases to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n backstage-idp --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis -n backstage-idp --timeout=300s

# Deploy application
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/network-policy.yaml

# Configure ingress with your domain
sed -i 's/backstage-idp.example.com/your-domain.com/g' k8s/ingress.yaml
kubectl apply -f k8s/ingress.yaml
```

### 4. Post-Deployment Verification
- [ ] **Health Checks**
 ```bash
 # Check pod status
 kubectl get pods -n backstage-idp
 
 # Check application health
 curl https://your-domain.com/api/health
 curl https://your-domain.com/api/health/ready
 ```

- [ ] **Functionality Tests**
 - [ ] Login/logout working
 - [ ] Service catalog loading
 - [ ] Template execution functional
 - [ ] Search working
 - [ ] Monitoring dashboard accessible

- [ ] **Performance Tests**
 ```bash
 # Load test with k6 or similar
 k6 run scripts/load-test.js
 ```

### 5. Monitoring Setup
- [ ] **Metrics**
 - [ ] Prometheus scraping metrics
 - [ ] Grafana dashboards imported
 - [ ] Alerts configured
 - [ ] SLOs defined

- [ ] **Logging**
 - [ ] Log aggregation working
 - [ ] Error tracking in Sentry
 - [ ] Audit logs enabled
 - [ ] Log retention configured

- [ ] **Alerting**
 - [ ] Slack webhooks configured
 - [ ] PagerDuty integration tested
 - [ ] On-call schedule set
 - [ ] Runbooks created

## Post-Deployment

### Documentation
- [ ] **Operational Docs**
 - [ ] Runbooks for common issues
 - [ ] Architecture diagram updated
 - [ ] API documentation published
 - [ ] User guide created

- [ ] **Team Training**
 - [ ] Operations team trained
 - [ ] Support team briefed
 - [ ] Developers have access
 - [ ] Incident response plan shared

### Backup and Recovery
- [ ] **Backup Configuration**
 - [ ] Automated backups scheduled
 - [ ] Backup retention policy set
 - [ ] Off-site backup storage configured
 - [ ] Restore procedure tested

- [ ] **Disaster Recovery**
 - [ ] RTO/RPO defined
 - [ ] Failover procedure documented
 - [ ] DR drills scheduled
 - [ ] Recovery runbook created

### Security Hardening
- [ ] **Security Scan**
 ```bash
 # Run security scan
 trivy image backstage-idp-wrapper:latest
 
 # Check for vulnerabilities
 npm audit --production
 ```

- [ ] **Penetration Testing**
 - [ ] Schedule pentest
 - [ ] Fix critical findings
 - [ ] Update security policies
 - [ ] Security training completed

### Performance Optimization
- [ ] **CDN Configuration**
 - [ ] Static assets on CDN
 - [ ] Cache headers optimized
 - [ ] Image optimization enabled
 - [ ] Compression configured

- [ ] **Database Optimization**
 - [ ] Indexes created
 - [ ] Query performance analyzed
 - [ ] Connection pooling tuned
 - [ ] Vacuum schedule set

## Rollback Plan

If issues occur during deployment:

1. **Immediate Rollback**
 ```bash
 # Rollback deployment
 kubectl rollout undo deployment/backstage-idp -n backstage-idp
 
 # Verify rollback
 kubectl rollout status deployment/backstage-idp -n backstage-idp
 ```

2. **Database Rollback**
 ```bash
 # Restore from backup
 ./scripts/restore.sh production <timestamp>
 ```

3. **Communication**
 - [ ] Notify stakeholders
 - [ ] Update status page
 - [ ] Create incident report
 - [ ] Schedule postmortem

## Sign-off

- [ ] **Technical Lead**: ___________________ Date: ___________
- [ ] **Security Team**: ___________________ Date: ___________
- [ ] **Operations Team**: _________________ Date: ___________
- [ ] **Product Owner**: ___________________ Date: ___________

## Notes

Add any deployment-specific notes here:

---

**Emergency Contacts:**
- On-call Engineer: +1-XXX-XXX-XXXX
- Escalation: escalation@example.com
- Status Page: https://status.example.com