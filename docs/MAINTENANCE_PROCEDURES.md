# Maintenance and Update Procedures

## Overview

This document outlines the maintenance procedures and update guidelines for the NEXT Portal platform. These procedures ensure system reliability, security, and optimal performance.

## Scheduled Maintenance

### Daily Tasks (Automated)

1. **Health Check Monitoring**
   ```bash
   # Automated health check runs every hour
   node scripts/health-check.js
   ```

2. **Error Monitoring**
   ```bash
   # Error tracking runs continuously
   # Check dashboard: /admin/monitoring
   ```

3. **Performance Monitoring**
   ```bash
   # Performance regression detection runs continuously
   # Review metrics dashboard for alerts
   ```

### Weekly Tasks

1. **Dependency Security Scan**
   ```bash
   # Run vulnerability scanner
   node scripts/vulnerability-scanner.js
   
   # Review report
   cat vulnerability-report.json
   ```

2. **Database Cleanup**
   ```bash
   # Clean up old logs and temporary data
   npx prisma db execute --file ./scripts/cleanup-database.sql
   ```

3. **Performance Review**
   ```bash
   # Generate performance report
   node scripts/performance-report.js
   ```

### Monthly Tasks

1. **Full System Backup**
   ```bash
   # Backup database
   pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
   
   # Backup configuration files
   tar -czf config-backup-$(date +%Y%m%d).tar.gz \
     .env* app-config.* docker-compose.yml
   ```

2. **Dependency Updates**
   ```bash
   # Check for outdated packages
   npm outdated
   
   # Update dependencies (with testing)
   npm update
   npm audit fix
   
   # Test thoroughly after updates
   npm test
   node scripts/smoke-tests.js
   ```

3. **Security Audit**
   ```bash
   # Run comprehensive security audit
   npm audit
   node scripts/security-audit.js
   ```

## Update Procedures

### Application Updates

1. **Pre-Update Checklist**
   - [ ] Create full system backup
   - [ ] Review change logs
   - [ ] Plan rollback strategy
   - [ ] Schedule maintenance window
   - [ ] Notify stakeholders

2. **Update Process**
   ```bash
   # 1. Create backup
   git tag backup-$(date +%Y%m%d-%H%M)
   
   # 2. Pull latest changes
   git fetch origin
   git checkout main
   git pull origin main
   
   # 3. Install dependencies
   npm install
   cd backstage && npm install && cd ..
   
   # 4. Run database migrations
   npx prisma migrate deploy
   
   # 5. Build application
   npm run build
   
   # 6. Run tests
   npm test
   node scripts/smoke-tests.js
   
   # 7. Restart services
   npm run restart
   ```

3. **Post-Update Verification**
   ```bash
   # Verify all services are running
   node scripts/health-check.js
   
   # Check error logs
   tail -f logs/application.log
   
   # Monitor performance
   # Visit: /admin/monitoring
   ```

### Dependency Updates

1. **Security Updates (Immediate)**
   ```bash
   # Check for security vulnerabilities
   npm audit
   
   # Fix automatically where possible
   npm audit fix
   
   # Manual review for breaking changes
   npm audit fix --force  # Only if necessary
   
   # Test thoroughly
   npm test
   node scripts/smoke-tests.js
   ```

2. **Regular Updates (Weekly)**
   ```bash
   # Check outdated packages
   npm outdated
   
   # Update patch versions (safe)
   npm update
   
   # Update minor versions (review changes)
   npm install package@^x.y.0
   
   # Update major versions (test extensively)
   npm install package@^x.0.0
   ```

### Database Maintenance

1. **Regular Maintenance**
   ```bash
   # Analyze table statistics
   npx prisma db execute --stdin < scripts/analyze-tables.sql
   
   # Vacuum and analyze (PostgreSQL)
   npx prisma db execute --stdin < scripts/vacuum-analyze.sql
   
   # Reindex if needed
   npx prisma db execute --stdin < scripts/reindex-tables.sql
   ```

2. **Schema Updates**
   ```bash
   # Create migration
   npx prisma migrate dev --name "description"
   
   # Review migration file
   cat prisma/migrations/*/migration.sql
   
   # Deploy to production
   npx prisma migrate deploy
   ```

## Monitoring and Alerting

### Key Metrics to Monitor

1. **Application Health**
   - Response times < 2s for pages
   - API response times < 500ms
   - Error rate < 1%
   - Uptime > 99.9%

2. **Resource Usage**
   - CPU usage < 80%
   - Memory usage < 85%
   - Disk usage < 90%
   - Database connections < 80% of limit

3. **Security Metrics**
   - Failed login attempts
   - Unusual access patterns
   - Vulnerability scan results
   - Security header compliance

### Alert Configurations

1. **Critical Alerts (Immediate Response)**
   - Service downtime
   - Database connection failures
   - High error rates (>5%)
   - Security breaches

2. **Warning Alerts (Response within 1 hour)**
   - High response times
   - Resource usage approaching limits
   - Failed background jobs
   - Dependency vulnerabilities

3. **Info Alerts (Daily Review)**
   - Performance degradation
   - Capacity planning metrics
   - Security scan results
   - Update notifications

## Backup and Recovery

### Backup Strategy

1. **Automated Daily Backups**
   ```bash
   # Database backup (automated)
   0 2 * * * pg_dump $DATABASE_URL | gzip > /backups/db-$(date +\%Y\%m\%d).sql.gz
   
   # Configuration backup
   0 3 * * * tar -czf /backups/config-$(date +\%Y\%m\%d).tar.gz \
     /app/.env* /app/app-config.* /app/docker-compose.yml
   ```

2. **Weekly Full Backups**
   ```bash
   # Complete application backup
   0 4 * * 0 tar -czf /backups/full-$(date +\%Y\%m\%d).tar.gz \
     /app --exclude=node_modules --exclude=.git
   ```

### Recovery Procedures

1. **Database Recovery**
   ```bash
   # Stop application
   npm run stop
   
   # Restore database
   gunzip -c backup.sql.gz | psql $DATABASE_URL
   
   # Start application
   npm run start
   
   # Verify integrity
   node scripts/health-check.js
   ```

2. **Full System Recovery**
   ```bash
   # Restore from backup
   tar -xzf full-backup.tar.gz -C /
   
   # Reinstall dependencies
   npm install
   cd backstage && npm install && cd ..
   
   # Start services
   npm run start
   
   # Verify functionality
   node scripts/smoke-tests.js
   ```

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   ```bash
   # Check Node.js processes
   ps aux | grep node
   
   # Monitor memory usage
   htop
   
   # Restart services if needed
   npm run restart
   ```

2. **Database Connection Issues**
   ```bash
   # Check database status
   pg_isready -h $DB_HOST -p $DB_PORT
   
   # Check connection pool
   npx prisma db execute --stdin < scripts/check-connections.sql
   
   # Restart database connections
   npm run restart
   ```

3. **Performance Issues**
   ```bash
   # Check performance metrics
   node scripts/performance-report.js
   
   # Monitor system resources
   htop
   iostat -x 1
   
   # Review application logs
   tail -f logs/application.log
   ```

## Security Maintenance

### Regular Security Tasks

1. **Weekly Security Scans**
   ```bash
   # Dependency vulnerability scan
   node scripts/vulnerability-scanner.js
   
   # Security headers check
   curl -I http://localhost:4400 | grep -E '(X-|Content-Security)'
   ```

2. **Monthly Security Audit**
   ```bash
   # Comprehensive security audit
   node scripts/security-audit.js
   
   # Review access logs
   grep "401\|403\|failed" logs/access.log
   
   # Check for suspicious activity
   grep "unusual\|suspicious\|attack" logs/security.log
   ```

### Security Update Process

1. **Critical Security Updates**
   - Apply immediately
   - Test in staging first if possible
   - Monitor for 24 hours post-deployment

2. **Regular Security Updates**
   - Schedule during maintenance windows
   - Follow standard update procedures
   - Document all changes

## Documentation Maintenance

### Keep Updated

1. **API Documentation**
   - Update after any API changes
   - Verify examples work
   - Update version numbers

2. **Deployment Documentation**
   - Update after infrastructure changes
   - Verify deployment steps
   - Update configuration examples

3. **User Documentation**
   - Update after UI changes
   - Verify screenshots are current
   - Update feature descriptions

## Contact Information

### Emergency Contacts

- **System Administrator**: [admin@company.com]
- **Database Administrator**: [dba@company.com]
- **Security Team**: [security@company.com]
- **On-Call Engineer**: [oncall@company.com]

### Escalation Procedures

1. **Level 1**: Development Team (Response: 1 hour)
2. **Level 2**: Technical Lead (Response: 30 minutes)
3. **Level 3**: Engineering Manager (Response: 15 minutes)
4. **Level 4**: CTO (Response: Immediate)

---

**Last Updated**: $(date +%Y-%m-%d)  
**Version**: 1.0  
**Review Schedule**: Monthly