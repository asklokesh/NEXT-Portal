# Backstage IDP Platform - Quick Reference Guide

## Navigation Map

### Main Features
- **Dashboard** `/dashboard` - Overview and metrics
- **Service Catalog** `/catalog` - Manage services and entities
- **Create Service** `/create` - Create new services
- **Templates** `/templates` - Template marketplace
- **Plugins** `/plugins` - Plugin management
- **Workflows** `/workflows` - Automation workflows
- **Deployments** `/deployments` - Deployment tracking
- **Health Monitor** `/health` - Service health
- **Analytics** `/analytics` - Performance metrics
- **Cost Tracking** `/cost` - Cloud cost management
- **Monitoring** `/monitoring` - System monitoring
- **Activity** `/activity` - Audit logs
- **Search** `/search` - Global search

### Admin Features
- **Admin Dashboard** `/admin` - Administration overview
- **Setup Wizard** `/setup` - Initial configuration
- **Maintenance** `/admin/maintenance` - System maintenance
- **Templates Admin** `/admin/templates` - Template governance
- **Plugin Admin** `/admin/plugins` - Plugin administration
- **Plugin Installer** `/admin/plugins/installer` - Install new plugins
- **Config Editor** `/admin/config` - Visual configuration
- **Integrations** `/admin/integrations` - External integrations
- **User Management** `/admin/users` - User and team management
- **Entity Governance** `/admin/entities` - Entity policies

### Developer Tools
- **API Documentation** `/api-docs` - Interactive API docs
- **Documentation** `/docs` - Platform documentation

## Key Features by Category

### No-Code Tools
1. **Visual Entity Editor** - Create entities without YAML
2. **Template Builder** - Drag-and-drop template creation
3. **Workflow Designer** - Visual workflow automation
4. **Config Editor** - Point-and-click configuration
5. **Plugin Installer** - One-click plugin installation

### Performance Features
1. **Virtual Scrolling** - Smooth handling of large lists
2. **Lazy Loading** - On-demand component loading
3. **Redis Caching** - Fast API responses
4. **Service Worker** - Offline support
5. **CDN Integration** - Global asset delivery

### Integration Points
1. **Backstage API** - Full compatibility
2. **GitHub/GitLab** - Source control integration
3. **Cloud Providers** - AWS, Azure, GCP
4. **Kubernetes** - Container orchestration
5. **Monitoring Tools** - Prometheus, Grafana

## Keyboard Shortcuts

- `Cmd/Ctrl + K` - Open command palette
- `Cmd/Ctrl + /` - Toggle search
- `Cmd/Ctrl + B` - Toggle sidebar
- `Cmd/Ctrl + S` - Save current work
- `Esc` - Close modals/dialogs

## Common Tasks

### Create a New Service
1. Navigate to `/create`
2. Choose a template
3. Fill in the form
4. Review and create

### Install a Plugin
1. Go to `/admin/plugins/installer`
2. Search for plugin
3. Click "Install"
4. Configure settings

### Set Up Integration
1. Visit `/admin/integrations`
2. Select integration type
3. Enter credentials
4. Test connection
5. Save configuration

### Create Workflow
1. Open `/workflows`
2. Click "Create Workflow"
3. Drag and drop actions
4. Configure triggers
5. Activate workflow

## Performance Tips

### For Large Catalogs
- Use search filters
- Enable virtual scrolling
- Leverage faceted search
- Export filtered results

### For Better Performance
- Enable Redis caching
- Configure CDN
- Use lazy loading
- Minimize concurrent tabs

## Search Tips

### Search Operators
- `type:service` - Filter by entity type
- `owner:team-name` - Filter by owner
- `tag:production` - Filter by tags
- `"exact match"` - Exact phrase search
- `*wildcard*` - Wildcard search

### Advanced Filters
- Status filters
- Date ranges
- Custom metadata
- Relationship filters

## Troubleshooting

### Common Issues

**Portal is slow**
- Check Redis connection
- Clear browser cache
- Verify CDN configuration
- Check network latency

**Can't connect to Backstage**
- Verify BACKSTAGE_API_URL
- Check authentication token
- Ensure CORS is configured
- Test with `/api/health`

**Plugins not loading**
- Clear plugin cache
- Check compatibility
- Verify dependencies
- Review console errors

**WebSocket disconnected**
- Check NEXT_PUBLIC_WS_URL
- Verify firewall rules
- Check proxy configuration
- Enable reconnection

## Configuration Files

### Essential Environment Variables
```bash
# Required
BACKSTAGE_API_URL=
DATABASE_URL=

# Recommended
REDIS_URL=
CDN_URL=
NEXTAUTH_SECRET=

# Optional
ENABLE_WEBSOCKET=true
ENABLE_NOTIFICATIONS=true
```

### Database Commands
```bash
npm run db:setup # Initial setup
npm run db:migrate # Run migrations
npm run db:seed # Seed data
npm run db:reset # Reset database
```

### Development Commands
```bash
npm run dev # Start development
npm run build # Build for production
npm run start # Start production
npm run lint # Run linter
npm run test # Run tests
```

## UI Components

### Available Components
- Cards and panels
- Data tables with sorting
- Charts and graphs
- Forms with validation
- Modals and dialogs
- Notifications
- Loading states
- Error boundaries

### Theme Customization
- Dark/light mode toggle
- Custom color schemes
- Font selections
- Layout options

## Metrics and Monitoring

### Key Metrics
- Service health scores
- Deployment frequency
- Error rates
- API latency
- User activity

### Monitoring Endpoints
- `/api/health` - Health check
- `/api/metrics` - Prometheus metrics
- `/api/status` - System status

## Security Best Practices

1. **Use strong authentication**
2. **Enable audit logging**
3. **Regular backups**
4. **Update dependencies**
5. **Monitor access logs**
6. **Use HTTPS everywhere**
7. **Implement RBAC**
8. **Rotate secrets**

## Quick Health Check

Run these checks to ensure everything is working:

1. Dashboard loads at `/dashboard`
2. Can search in catalog
3. WebSocket shows "Connected"
4. API health check passes
5. Can create test entity
6. Notifications appear
7. Lazy loading works
8. Dark mode toggles

## Getting Help

- **Documentation**: `/docs`
- **API Reference**: `/api-docs`
- **Admin Guide**: `/admin/help`
- **GitHub Issues**: Report bugs
- **Community Forum**: Ask questions

---

**Pro Tip**: Keep this guide handy for quick reference. The platform is designed to be intuitive, but these shortcuts and tips will help you work more efficiently!