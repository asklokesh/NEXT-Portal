# OPERATIONAL RUNBOOK
## SaaS Internal Developer Portal (IDP)

**Document Version:** 1.0.0  
**Last Updated:** August 14, 2025  
**Owner:** Platform Engineering Team  
**Classification:** Internal Use Only

---

## TABLE OF CONTENTS

1. [Emergency Contacts](#emergency-contacts)
2. [System Architecture Overview](#system-architecture-overview)
3. [Service Health Monitoring](#service-health-monitoring)
4. [Incident Response Procedures](#incident-response-procedures)
5. [Common Troubleshooting Scenarios](#common-troubleshooting-scenarios)
6. [Deployment Procedures](#deployment-procedures)
7. [Backup and Recovery](#backup-and-recovery)
8. [Security Operations](#security-operations)
9. [Performance Monitoring](#performance-monitoring)
10. [Maintenance Procedures](#maintenance-procedures)

---

## EMERGENCY CONTACTS

### Primary On-Call Rotation
- **Platform Team Lead:** +1-555-PLATFORM (24/7)
- **DevOps Engineer:** +1-555-DEVOPS (24/7)
- **Security Engineer:** +1-555-SECURITY (Business hours + P0/P1)

### Escalation Chain
- **Engineering Manager:** +1-555-ENG-MGR
- **CTO:** +1-555-CTO-OFFICE
- **CEO:** +1-555-CEO (P0 only)

### External Vendors
- **AWS Support:** Enterprise Support (Case Priority: High)
- **DataDog Support:** +1-866-329-4466
- **PagerDuty:** support@pagerduty.com

---

## SYSTEM ARCHITECTURE OVERVIEW

### Core Components
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │────│  SaaS IDP App   │────│   PostgreSQL    │
│   (AWS ALB)     │    │  (Kubernetes)   │    │   (RDS Multi-AZ)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐    ┌─────────────────┐
                       │     Redis       │    │   Backstage     │
                       │  (ElastiCache)  │    │   Backend       │
                       └─────────────────┘    └─────────────────┘
```

### Service Dependencies
- **Critical:** PostgreSQL, Redis, Kubernetes
- **Important:** Backstage Backend, External APIs
- **Optional:** Monitoring stack, Logging

### Infrastructure Details
- **Cluster:** AWS EKS (Production)
- **Namespace:** saas-idp-production
- **Ingress:** Application Load Balancer
- **DNS:** Route53 with health checks

---

## SERVICE HEALTH MONITORING

### Health Check Endpoints
```bash
# Primary health check
curl https://app.saas-idp.company.com/api/health

# Database health
curl https://app.saas-idp.company.com/api/health/database

# Metrics endpoint
curl https://app.saas-idp.company.com/api/metrics

# Kubernetes probes
kubectl get pods -n saas-idp-production
```

### Monitoring Dashboards
- **Primary Dashboard:** https://grafana.company.com/d/saas-idp-overview
- **SLA Dashboard:** https://grafana.company.com/d/sla-dashboard
- **Infrastructure:** https://grafana.company.com/d/k8s-cluster
- **Database:** https://grafana.company.com/d/postgresql-metrics

### Key Metrics to Monitor
- **Availability:** > 99.99%
- **Response Time:** P95 < 200ms, P99 < 500ms
- **Error Rate:** < 0.1%
- **Database Connections:** < 80% of pool
- **Memory Usage:** < 85%
- **CPU Usage:** < 70%

---

## INCIDENT RESPONSE PROCEDURES

### Incident Classification

#### P0 - Critical (Response: Immediate)
- Complete service outage
- Data loss or corruption
- Security breach
- Database unavailable

#### P1 - High (Response: 15 minutes)
- Significant feature degradation
- Authentication failures
- API rate limiting issues
- Performance degradation > 50%

#### P2 - Medium (Response: 1 hour)
- Minor feature issues
- Non-critical API failures
- UI/UX problems
- Monitoring alerts

#### P3 - Low (Response: Next business day)
- Documentation issues
- Cosmetic bugs
- Enhancement requests

### Response Procedures

#### Step 1: Incident Detection
- **Automated:** Alert received via PagerDuty/Slack
- **Manual:** User report or internal discovery

#### Step 2: Initial Assessment (< 5 minutes)
1. Acknowledge the alert
2. Check primary health endpoints
3. Review monitoring dashboards
4. Determine incident severity
5. Notify on-call engineer

#### Step 3: Investigation & Diagnosis
```bash
# Quick health check
kubectl get pods -n saas-idp-production
kubectl get events -n saas-idp-production --sort-by='.lastTimestamp'

# Check logs
kubectl logs -n saas-idp-production deployment/saas-idp --tail=100

# Database status
psql $DATABASE_URL -c "SELECT version();"

# Redis status
redis-cli -u $REDIS_URL ping
```

#### Step 4: Communication
- Update status page
- Notify stakeholders via Slack #incidents
- Create incident record in ticketing system

#### Step 5: Resolution
- Implement fix or workaround
- Verify fix resolves issue
- Monitor for recurrence

#### Step 6: Post-Incident
- Conduct post-mortem for P0/P1 incidents
- Update runbooks
- Implement preventive measures

---

## COMMON TROUBLESHOOTING SCENARIOS

### Scenario 1: Application Pods Crashing

#### Symptoms:
- 503 errors from load balancer
- Pods in CrashLoopBackOff state
- High restart count

#### Investigation:
```bash
# Check pod status
kubectl get pods -n saas-idp-production

# Check pod logs
kubectl logs -n saas-idp-production pod/saas-idp-xxx --previous

# Check resource usage
kubectl top pods -n saas-idp-production

# Check events
kubectl describe pod -n saas-idp-production saas-idp-xxx
```

#### Common Causes & Solutions:
1. **Memory Leak:** Restart pods, check memory limits
2. **Database Connection Issues:** Check database health, connection pool
3. **Configuration Error:** Validate environment variables, secrets
4. **Resource Limits:** Increase CPU/memory limits if needed

### Scenario 2: Database Connection Failures

#### Symptoms:
- Database health check failing
- "connection refused" errors
- Application timeouts

#### Investigation:
```bash
# Test database connectivity
psql $DATABASE_URL -c "SELECT now();"

# Check connection pool status
curl https://app.saas-idp.company.com/api/health/database

# Check RDS status (AWS)
aws rds describe-db-instances --db-instance-identifier production-db
```

#### Common Causes & Solutions:
1. **Connection Pool Exhaustion:** Check pool configuration, slow queries
2. **Network Issues:** Verify security groups, VPC connectivity
3. **Database Overload:** Scale read replicas, optimize queries
4. **Credential Issues:** Rotate credentials, update secrets

### Scenario 3: High Response Times

#### Symptoms:
- P95/P99 latency alerts
- User complaints about slowness
- Timeouts in monitoring

#### Investigation:
```bash
# Check application metrics
curl https://app.saas-idp.company.com/api/metrics | grep http_request_duration

# Check database performance
# Monitor slow queries, connection count

# Check external API latency
# Review third-party service status
```

#### Common Causes & Solutions:
1. **Database Slow Queries:** Optimize queries, add indexes
2. **External API Delays:** Implement timeouts, circuit breakers
3. **Resource Constraints:** Scale pods horizontally
4. **Cache Issues:** Verify Redis connectivity, cache hit rates

### Scenario 4: Authentication Failures

#### Symptoms:
- Users cannot log in
- JWT validation errors
- OAuth provider issues

#### Investigation:
```bash
# Check auth service health
curl https://app.saas-idp.company.com/api/auth/health

# Verify OAuth configuration
# Check GitHub/Google OAuth app status

# Test token validation
# Review NEXTAUTH_SECRET configuration
```

#### Common Causes & Solutions:
1. **OAuth Provider Issues:** Check GitHub/Google service status
2. **Secret Rotation:** Update NEXTAUTH_SECRET, restart pods
3. **Session Store Issues:** Check Redis connectivity
4. **Certificate Expiry:** Renew SSL certificates

---

## DEPLOYMENT PROCEDURES

### Pre-Deployment Checklist
- [ ] Code reviewed and approved
- [ ] Tests passing (unit, integration, e2e)
- [ ] Security scans completed
- [ ] Database migrations reviewed
- [ ] Rollback plan prepared
- [ ] Stakeholders notified

### Rolling Deployment (Standard)
```bash
# 1. Update image tag in deployment
kubectl set image deployment/saas-idp -n saas-idp-production \
  saas-idp=registry.company.com/saas-idp:v1.2.3

# 2. Monitor rollout
kubectl rollout status deployment/saas-idp -n saas-idp-production

# 3. Verify health
curl https://app.saas-idp.company.com/api/health

# 4. Monitor metrics for 10 minutes
# Check Grafana dashboards for anomalies
```

### Blue-Green Deployment (Major Changes)
```bash
# 1. Deploy green environment
kubectl apply -f k8s/green-deployment.yaml

# 2. Run smoke tests against green
curl https://green.saas-idp.company.com/api/health

# 3. Switch traffic to green
kubectl patch service saas-idp -n saas-idp-production \
  -p '{"spec":{"selector":{"version":"green"}}}'

# 4. Monitor and keep blue for rollback
```

### Rollback Procedure
```bash
# Quick rollback to previous version
kubectl rollout undo deployment/saas-idp -n saas-idp-production

# Rollback to specific revision
kubectl rollout undo deployment/saas-idp -n saas-idp-production --to-revision=2

# Verify rollback
kubectl rollout status deployment/saas-idp -n saas-idp-production
```

### Emergency Hotfix Deployment
```bash
# 1. Create hotfix branch from production
git checkout production
git checkout -b hotfix/critical-fix

# 2. Apply minimal fix
# Make necessary changes

# 3. Fast-track testing
npm test
npm run build

# 4. Emergency deployment
kubectl set image deployment/saas-idp -n saas-idp-production \
  saas-idp=registry.company.com/saas-idp:hotfix-v1.2.3-1

# 5. Monitor closely
```

---

## BACKUP AND RECOVERY

### Database Backup Strategy

#### Automated Backups:
- **Full Backup:** Daily at 02:00 UTC
- **Incremental:** Every 6 hours
- **Transaction Log:** Real-time
- **Retention:** 30 days (production), 7 days (staging)

#### Manual Backup:
```bash
# Create backup before major changes
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup to S3
aws s3 cp backup_*.sql s3://company-db-backups/manual/
```

### Recovery Procedures

#### Point-in-Time Recovery:
```bash
# Restore to specific timestamp
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier production-db \
  --target-db-instance-identifier production-db-restored \
  --restore-time 2025-08-14T10:30:00Z
```

#### Application Data Recovery:
```bash
# Restore from backup file
psql $DATABASE_URL < backup_20250814_023000.sql

# Verify data integrity
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
```

### Configuration Backup:
- **Kubernetes Manifests:** Git repository (automatic)
- **Secrets:** Encrypted in HashiCorp Vault
- **Environment Variables:** Documented in .env.production.template

### Disaster Recovery Testing:
- **Monthly:** Database restore test
- **Quarterly:** Full DR simulation
- **Annually:** Cross-region failover test

---

## SECURITY OPERATIONS

### Security Monitoring

#### Real-time Monitoring:
- **SIEM:** Splunk/ELK stack integration
- **Runtime Security:** Falco alerts
- **Network Monitoring:** VPC Flow Logs
- **Application Security:** WAF logs

#### Security Alerts:
```bash
# Check security events
kubectl logs -n falco-system daemonset/falco | grep CRITICAL

# Review authentication failures
grep "authentication failed" /var/log/application.log

# Check for privilege escalation
kubectl get pods --all-namespaces -o jsonpath='{.items[*].spec.securityContext.runAsUser}'
```

### Incident Response

#### Security Incident Classification:
- **S1 (Critical):** Active breach, data exfiltration
- **S2 (High):** Attempted breach, vulnerability exploitation
- **S3 (Medium):** Policy violations, suspicious activity
- **S4 (Low):** Failed login attempts, reconnaissance

#### Security Incident Response:
1. **Immediate Actions:**
   - Isolate affected systems
   - Preserve evidence
   - Notify security team
   - Begin incident log

2. **Investigation:**
   - Analyze logs and forensics
   - Determine scope and impact
   - Identify attack vectors
   - Document findings

3. **Containment:**
   - Block malicious traffic
   - Rotate compromised credentials
   - Patch vulnerabilities
   - Update security policies

4. **Recovery:**
   - Restore from clean backups
   - Verify system integrity
   - Monitor for recurrence
   - Update documentation

### Security Maintenance

#### Regular Security Tasks:
- **Weekly:** Vulnerability scan review
- **Monthly:** Access review and cleanup
- **Quarterly:** Security configuration audit
- **Annually:** Penetration testing

#### Security Updates:
```bash
# Update base images
docker pull node:20-alpine
docker build -t saas-idp:latest .

# Update dependencies
npm audit fix
npm update

# Apply security patches
kubectl patch daemonset falco -n falco-system --patch '{"spec":{"template":{"spec":{"containers":[{"name":"falco","image":"falcosecurity/falco:latest"}]}}}}'
```

---

## PERFORMANCE MONITORING

### Key Performance Indicators

#### Application Metrics:
- **Response Time:** P50, P95, P99 percentiles
- **Throughput:** Requests per second
- **Error Rate:** HTTP 4xx/5xx percentage
- **Availability:** Uptime percentage

#### Infrastructure Metrics:
- **CPU Utilization:** Per pod and cluster
- **Memory Usage:** Working set and limits
- **Network I/O:** Ingress/egress traffic
- **Storage I/O:** IOPS and throughput

#### Database Metrics:
- **Connection Count:** Active and idle connections
- **Query Performance:** Slow query analysis
- **Lock Contention:** Blocking queries
- **Replication Lag:** Read replica delay

### Performance Tuning

#### Application Optimization:
```bash
# Check memory usage
kubectl top pods -n saas-idp-production

# Profile CPU usage
kubectl exec -n saas-idp-production deployment/saas-idp -- node --prof index.js

# Analyze heap dumps
kubectl exec -n saas-idp-production deployment/saas-idp -- kill -USR2 1
```

#### Database Optimization:
```sql
-- Find slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Check index usage
SELECT schemaname, tablename, attname, n_distinct, correlation 
FROM pg_stats 
WHERE schemaname = 'public';

-- Monitor connection pool
SELECT state, count(*) 
FROM pg_stat_activity 
GROUP BY state;
```

#### Cache Optimization:
```bash
# Check Redis performance
redis-cli --latency-history

# Monitor cache hit rate
redis-cli info stats | grep keyspace_hits

# Check memory usage
redis-cli info memory
```

---

## MAINTENANCE PROCEDURES

### Scheduled Maintenance

#### Monthly Maintenance Window:
- **Time:** First Sunday of month, 02:00-06:00 UTC
- **Duration:** 4 hours maximum
- **Notification:** 72 hours advance notice

#### Maintenance Tasks:
1. **Security Updates:** OS and runtime patches
2. **Dependency Updates:** NPM package updates
3. **Database Maintenance:** Index rebuilding, statistics update
4. **Monitoring Review:** Alert threshold tuning
5. **Documentation Updates:** Runbook and procedure updates

### Pre-Maintenance Checklist:
- [ ] Maintenance window scheduled and communicated
- [ ] Backup verification completed
- [ ] Rollback plan prepared
- [ ] On-call engineer identified
- [ ] Stakeholders notified

### Maintenance Procedures:

#### OS and Runtime Updates:
```bash
# Update node base image
docker build --no-cache -t saas-idp:latest .

# Rolling update with health checks
kubectl set image deployment/saas-idp -n saas-idp-production \
  saas-idp=registry.company.com/saas-idp:latest

# Monitor rollout
kubectl rollout status deployment/saas-idp -n saas-idp-production
```

#### Database Maintenance:
```sql
-- Update statistics
ANALYZE;

-- Rebuild indexes if needed
REINDEX INDEX CONCURRENTLY idx_name;

-- Check for bloat
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

#### Certificate Renewal:
```bash
# Check certificate expiry
openssl x509 -in cert.pem -noout -dates

# Renew Let's Encrypt certificates
certbot renew --nginx

# Update Kubernetes secrets
kubectl create secret tls saas-idp-tls \
  --cert=cert.pem --key=key.pem -n saas-idp-production --dry-run=client -o yaml | \
  kubectl apply -f -
```

### Post-Maintenance Checklist:
- [ ] All services healthy
- [ ] Performance metrics normal
- [ ] User acceptance testing passed
- [ ] Monitoring alerts reviewed
- [ ] Documentation updated
- [ ] Stakeholders notified of completion

---

## ESCALATION PROCEDURES

### When to Escalate:
- P0 incident not resolved within 30 minutes
- P1 incident not resolved within 2 hours
- Security incidents
- Data integrity issues
- Multiple system failures
- Customer escalations

### Escalation Contacts:
1. **Technical Escalation:** Engineering Manager
2. **Business Escalation:** Product Manager
3. **Executive Escalation:** CTO
4. **External Escalation:** CEO (customer-facing issues)

### Communication During Incidents:
- **Internal:** Slack #incidents channel
- **External:** Status page updates
- **Customers:** Email notifications for P0/P1
- **Leadership:** Executive summary for P0

---

## APPENDIX

### Useful Commands Reference:
```bash
# Kubernetes
kubectl get pods -n saas-idp-production
kubectl logs -f deployment/saas-idp -n saas-idp-production
kubectl describe pod -n saas-idp-production saas-idp-xxx

# Database
psql $DATABASE_URL -c "SELECT version();"
pg_dump $DATABASE_URL > backup.sql

# Redis
redis-cli -u $REDIS_URL ping
redis-cli -u $REDIS_URL info

# Docker
docker ps
docker logs container-id
docker exec -it container-id /bin/sh

# Monitoring
curl https://app.saas-idp.company.com/api/health
curl https://app.saas-idp.company.com/api/metrics
```

### Log Locations:
- **Application Logs:** Kubernetes pod logs
- **Database Logs:** RDS CloudWatch logs
- **Load Balancer Logs:** ALB access logs in S3
- **Security Logs:** Falco events in Elasticsearch

### Documentation Links:
- **Architecture Diagrams:** Confluence space
- **API Documentation:** https://api.saas-idp.company.com/docs
- **Monitoring Dashboards:** https://grafana.company.com
- **Status Page:** https://status.saas-idp.company.com

---

**Document Owner:** Platform Engineering Team  
**Review Schedule:** Monthly  
**Last Reviewed:** August 14, 2025  
**Next Review:** September 14, 2025