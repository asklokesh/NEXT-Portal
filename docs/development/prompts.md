# Claude Code Prompts for IDP Wrapper Project

## 1. Project Foundation & Architecture Setup

```
You are the Lead Architect for building an enterprise-grade UI wrapper and no-code platform on top of Backstage.io. Your goal is to create a modern, intuitive interface that consumes Backstage APIs while providing no-code capabilities for platform teams.

TASK: Set up the foundational project architecture for the IDP wrapper.

REQUIREMENTS:
- Create a Next.js 14+ project with TypeScript in strict mode
- Implement micro-frontend architecture with module federation
- Set up Tailwind CSS with a custom design system
- Configure ESLint, Prettier, and Husky for code quality
- Create project structure for: components, services, hooks, types, utils
- Set up environment configuration for multiple deployment environments
- Configure Docker containerization with multi-stage builds
- Initialize package.json with all necessary dependencies

TECHNICAL CONSTRAINTS:
- Must support React 18+ with concurrent features
- TypeScript strict mode with no implicit any
- Follow atomic design principles for component structure
- Include performance monitoring setup (Web Vitals)
- Configure bundle analyzer for optimization tracking

DELIVERABLES:
- Complete project scaffolding with proper folder structure
- Configuration files (tsconfig, next.config, tailwind.config)
- Docker setup with development and production stages
- README with setup instructions and architecture overview
- Package.json with categorized dependencies and scripts

Provide detailed reasoning for each architectural decision and include setup instructions.
```

## 2. Backstage API Integration Layer

```
You are building the core integration layer between the UI wrapper and Backstage.io APIs. This layer must efficiently consume Backstage APIs while providing a clean abstraction for the frontend.

TASK: Create a comprehensive Backstage API integration service layer.

CONTEXT:
- Backstage provides REST APIs for Service Catalog, Software Templates, TechDocs, and Auth
- Need to handle authentication passthrough from wrapper to Backstage
- Must support real-time data synchronization and caching
- Should abstract Backstage-specific data models for UI consumption

REQUIREMENTS:
- Build TypeScript client library for all major Backstage APIs:
 - Catalog API (entities, relationships, search)
 - Scaffolder API (templates, tasks, actions)
 - TechDocs API (documentation, metadata)
 - Auth API (user info, permissions)
- Implement intelligent caching with TTL and invalidation strategies
- Create WebSocket connection for real-time updates
- Add request/response interceptors for error handling and retries
- Build type-safe API client with generated TypeScript interfaces
- Implement connection pooling and rate limiting

TECHNICAL SPECS:
- Use Axios or Fetch with custom interceptors
- Implement Tanstack Query for caching and synchronization
- Create Zod schemas for runtime type validation
- Add comprehensive error boundary handling
- Include API mocking for development and testing

FILE STRUCTURE:
```
src/services/backstage/
├── clients/
│ ├── catalog.client.ts
│ ├── scaffolder.client.ts
│ ├── techdocs.client.ts
│ └── auth.client.ts
├── types/
│ ├── entities.ts
│ ├── templates.ts
│ └── responses.ts
├── hooks/
│ ├── useCatalog.ts
│ ├── useTemplates.ts
│ └── useAuth.ts
└── index.ts
```

ACCEPTANCE CRITERIA:
- All API calls include proper error handling and retries
- TypeScript interfaces match Backstage API responses exactly
- Caching reduces API calls by 70% for repeated requests
- WebSocket connection maintains real-time sync with <1s latency
- Include comprehensive unit tests with 95%+ coverage

Provide implementation with detailed error handling and performance optimization strategies.
```

## 3. No-Code Visual Configuration Builder

```
You are creating the core no-code functionality that allows platform teams to configure services, templates, and workflows without writing YAML or code.

TASK: Build a visual configuration builder for Backstage entities and templates.

CONTEXT:
- Platform teams currently need to write YAML files for catalog-info.yaml
- Software templates require complex Cookiecutter/JSON Schema knowledge
- Need drag-and-drop interface for building service configurations
- Must generate valid Backstage-compatible YAML/JSON output

REQUIREMENTS:
- Create drag-and-drop form builder for Backstage entity schemas
- Build visual template designer with live preview
- Implement dynamic form generation from JSON Schema
- Add validation with real-time error feedback
- Create reusable component library for common Backstage fields
- Support conditional logic and dynamic field visibility
- Include import/export functionality for existing YAML files

TECHNICAL IMPLEMENTATION:
- Use React DnD or similar for drag-and-drop functionality
- Implement React Hook Form for form state management
- Create custom JSON Schema to React component mapping
- Build YAML parser/generator with proper formatting
- Add Monaco Editor for advanced users who want code view
- Include real-time preview pane showing generated output

COMPONENTS TO BUILD:
```
src/components/no-code/
├── FormBuilder/
│ ├── DragDropCanvas.tsx
│ ├── FieldPalette.tsx
│ ├── PropertyPanel.tsx
│ └── PreviewPane.tsx
├── TemplateDesigner/
│ ├── TemplateCanvas.tsx
│ ├── StepBuilder.tsx
│ ├── ActionBuilder.tsx
│ └── ParameterBuilder.tsx
├── ConfigGenerator/
│ ├── YamlGenerator.ts
│ ├── SchemaValidator.ts
│ └── PreviewRenderer.tsx
└── common/
 ├── FieldComponents/
 └── ValidationRules/
```

FEATURES:
- Drag-and-drop field placement with snap-to-grid
- Real-time YAML/JSON generation with syntax highlighting
- Field validation with inline error messages
- Template preview with sample data injection
- One-click deployment to Backstage
- Version control integration for configuration changes

ACCEPTANCE CRITERIA:
- Generate valid catalog-info.yaml files that pass Backstage validation
- Support all standard Backstage entity types (Component, API, Resource, etc.)
- Handle complex nested schemas with proper validation
- Maintain 60fps performance during drag operations
- Include comprehensive accessibility support (WCAG 2.1 AA)

Create a polished, production-ready visual builder that feels intuitive for non-technical users.
```

## 4. Advanced Service Catalog UI

```
You are building a modern, intuitive replacement for Backstage's default Service Catalog UI that provides superior user experience while maintaining full functionality.

TASK: Create an advanced Service Catalog interface with enhanced search, filtering, and visualization capabilities.

CONTEXT:
- Default Backstage catalog UI is functional but lacks modern UX patterns
- Need to display complex service relationships and dependencies
- Must support large-scale catalogs (1000+ services) with good performance
- Should provide multiple view modes and advanced filtering

REQUIREMENTS:
- Build responsive service catalog with multiple view modes:
 - Grid view with service cards
 - List view with sortable columns 
 - Graph view showing service dependencies
 - Map view for organizational structure
- Implement advanced search with faceted filtering
- Create interactive dependency visualization
- Add bulk operations for service management
- Build detailed service pages with tabs for docs, APIs, dependencies
- Include real-time status indicators and health checks

TECHNICAL IMPLEMENTATION:
- Use React Virtualized for large dataset performance
- Implement Fuse.js or similar for fuzzy search
- Create D3.js or React Flow graphs for dependency visualization
- Add infinite scrolling with intelligent prefetching
- Use Intersection Observer for performance optimization
- Implement URL-based state management for bookmarkable views

COMPONENTS:
```
src/components/catalog/
├── CatalogGrid/
│ ├── ServiceCard.tsx
│ ├── GridContainer.tsx
│ └── GridFilters.tsx
├── CatalogList/
│ ├── ServiceTable.tsx
│ ├── SortableColumns.tsx
│ └── BulkActions.tsx
├── DependencyGraph/
│ ├── ServiceGraph.tsx
│ ├── GraphControls.tsx
│ └── NodeRenderer.tsx
├── ServiceDetail/
│ ├── ServiceOverview.tsx
│ ├── ServiceDocs.tsx
│ ├── ServiceAPIs.tsx
│ └── ServiceDependencies.tsx
└── Search/
 ├── SearchBar.tsx
 ├── FilterPanel.tsx
 └── SavedSearches.tsx
```

ADVANCED FEATURES:
- AI-powered search suggestions and auto-complete
- Custom dashboard creation with service widgets
- Advanced filtering by ownership, technology, lifecycle stage
- Service comparison tool with side-by-side views
- Integration with monitoring tools for live metrics
- Automated service documentation generation
- Tag-based organization with drag-and-drop management

PERFORMANCE REQUIREMENTS:
- Handle 10,000+ services without performance degradation
- Search results appear within 200ms
- Smooth 60fps animations for all interactions
- Lazy load images and metadata for cards not in viewport
- Implement proper error boundaries with graceful fallbacks

ACCEPTANCE CRITERIA:
- All Backstage catalog entities display correctly with proper metadata
- Search functionality includes fuzzy matching and filters
- Dependency graph renders complex relationships clearly
- Mobile-responsive design works on tablets and phones
- Accessibility compliant with keyboard navigation and screen readers

Build a catalog interface that developers will prefer over the default Backstage UI.
```

## 5. Software Template Management System

```
You are building a comprehensive template management system that allows platform teams to create, modify, and deploy Backstage software templates without coding.

TASK: Create a visual template builder and management system for Backstage scaffolder templates.

CONTEXT:
- Backstage templates use complex Cookiecutter syntax and JSON Schema
- Platform teams need to create templates for different project types
- Must support template versioning, testing, and deployment
- Should include marketplace-style template discovery

REQUIREMENTS:
- Visual template builder with step-by-step wizard
- WYSIWYG editor for template files with variable substitution preview
- JSON Schema form builder for template parameters
- Template testing environment with sample data
- Version control integration with approval workflows
- Template marketplace with categories and ratings
- Automated template validation and security scanning

IMPLEMENTATION DETAILS:
- Build Monaco Editor integration with custom language support
- Create template preview system with live variable substitution
- Implement Git integration for template storage and versioning
- Add template execution environment for testing
- Build approval workflow system for template changes
- Create analytics dashboard for template usage metrics

COMPONENTS:
```
src/components/templates/
├── TemplateBuilder/
│ ├── StepWizard.tsx
│ ├── ParameterBuilder.tsx
│ ├── ActionBuilder.tsx
│ └── FileEditor.tsx
├── TemplateMarketplace/
│ ├── TemplateGrid.tsx
│ ├── TemplateDetail.tsx
│ ├── CategoryFilter.tsx
│ └── RatingSystem.tsx
├── TemplatePreview/
│ ├── LivePreview.tsx
│ ├── VariableSubstitution.tsx
│ └── OutputViewer.tsx
├── TemplateManagement/
│ ├── VersionControl.tsx
│ ├── ApprovalWorkflow.tsx
│ └── UsageAnalytics.tsx
└── Testing/
 ├── TestRunner.tsx
 ├── SampleDataGenerator.tsx
 └── ValidationReports.tsx
```

ADVANCED FEATURES:
- Template inheritance and composition
- Conditional steps based on parameter values
- Integration with external APIs and services
- Custom action builder for reusable template steps
- Template security scanning for vulnerabilities
- Automated documentation generation from templates
- A/B testing framework for template optimization

VALIDATION & TESTING:
- JSON Schema validation for parameters
- Template dry-run execution with sample data
- Security scanning for malicious code patterns
- Performance testing for large template executions
- Integration testing with target repositories
- User acceptance testing with real developers

ACCEPTANCE CRITERIA:
- Generate valid Backstage templates that pass validation
- Support all Backstage scaffolder actions and custom actions
- Template preview accurately shows final output
- Version control maintains complete template history
- Approval workflow enforces proper review process
- Analytics provide actionable insights on template usage

Create a template management system that makes it easy for platform teams to maintain high-quality, secure templates.
```

## 6. Real-Time Dashboard and Analytics

```
You are building a comprehensive analytics and monitoring dashboard that provides insights into developer productivity, platform usage, and system health.

TASK: Create a real-time dashboard system with customizable widgets and advanced analytics.

CONTEXT:
- Platform teams need visibility into how the IDP is being used
- Developers want personalized dashboards for their services
- Must integrate with monitoring tools and provide actionable insights
- Should support custom metrics and KPI tracking

REQUIREMENTS:
- Build widget-based dashboard system with drag-and-drop customization
- Implement real-time data streaming with WebSocket connections
- Create pre-built widgets for common metrics (deployments, incidents, usage)
- Add custom widget builder for team-specific metrics
- Include alerting system with configurable thresholds
- Support data export and reporting functionality
- Build mobile-responsive design for on-the-go monitoring

TECHNICAL IMPLEMENTATION:
- Use React Grid Layout for dashboard customization
- Implement Chart.js or Recharts for data visualization
- Create WebSocket service for real-time data updates
- Add data caching layer with Redis or similar
- Build metric aggregation service for historical data
- Implement notification system with multiple channels

COMPONENTS:
```
src/components/dashboard/
├── DashboardBuilder/
│ ├── DashboardCanvas.tsx
│ ├── WidgetPalette.tsx
│ ├── GridLayout.tsx
│ └── WidgetConfigurator.tsx
├── Widgets/
│ ├── MetricWidget.tsx
│ ├── ChartWidget.tsx
│ ├── ServiceHealthWidget.tsx
│ ├── DeploymentWidget.tsx
│ └── CustomWidget.tsx
├── Analytics/
│ ├── UsageAnalytics.tsx
│ ├── PerformanceMetrics.tsx
│ ├── UserBehavior.tsx
│ └── TrendAnalysis.tsx
├── Alerts/
│ ├── AlertManager.tsx
│ ├── AlertRules.tsx
│ └── NotificationCenter.tsx
└── Reports/
 ├── ReportBuilder.tsx
 ├── ScheduledReports.tsx
 └── DataExport.tsx
```

WIDGET TYPES:
- Service health and uptime monitoring
- Deployment frequency and success rates
- Code quality metrics and technical debt
- Developer productivity indicators
- Platform adoption and usage statistics
- Cost optimization recommendations
- Security vulnerability tracking
- Performance benchmarks and SLA compliance

REAL-TIME FEATURES:
- Live metric updates with <1 second latency
- Collaborative dashboard editing with conflict resolution
- Push notifications for critical alerts
- Auto-refresh with intelligent polling strategies
- Offline capability with data sync when reconnected

ADVANCED ANALYTICS:
- Machine learning-powered anomaly detection
- Predictive analytics for capacity planning
- Correlation analysis between metrics
- Custom data source integration via APIs
- Advanced filtering and drill-down capabilities
- Export to business intelligence tools

ACCEPTANCE CRITERIA:
- Dashboard loads within 2 seconds with all widgets
- Real-time updates maintain 60fps performance
- Support for 50+ concurrent dashboard viewers
- Mobile interface provides full functionality
- Data accuracy verified against source systems
- Alerting system has <30 second notification latency

Build a dashboard system that provides actionable insights and improves decision-making for platform teams.
```

## 7. Testing and Quality Assurance Framework

```
You are implementing a comprehensive testing strategy that ensures the IDP wrapper maintains high quality, performance, and reliability.

TASK: Create a complete testing framework covering unit, integration, E2E, and performance testing.

CONTEXT:
- The wrapper must maintain compatibility with Backstage API changes
- User workflows must be thoroughly tested to prevent regressions
- Performance must be monitored and maintained across releases
- Security testing is critical for enterprise deployment

REQUIREMENTS:
- Implement comprehensive unit test suite with >95% coverage
- Create integration tests for all Backstage API interactions
- Build E2E test suite covering critical user workflows
- Add performance testing with load simulation
- Implement visual regression testing for UI components
- Create accessibility testing automation
- Build security testing pipeline with vulnerability scanning

TESTING STACK:
- Jest + Testing Library for unit and integration tests
- Playwright for E2E testing across browsers
- Lighthouse CI for performance regression testing
- Storybook for component testing and documentation
- MSW for API mocking and test isolation
- K6 or Artillery for load testing
- Axe for accessibility testing automation

TEST STRUCTURE:
```
tests/
├── unit/
│ ├── components/
│ ├── services/
│ ├── hooks/
│ └── utils/
├── integration/
│ ├── api-clients/
│ ├── data-flow/
│ └── auth/
├── e2e/
│ ├── user-workflows/
│ ├── admin-workflows/
│ └── cross-browser/
├── performance/
│ ├── load-tests/
│ ├── stress-tests/
│ └── benchmark/
├── visual/
│ ├── component-snapshots/
│ └── page-screenshots/
├── accessibility/
│ └── a11y-tests/
└── security/
 ├── vulnerability-scans/
 └── penetration-tests/
```

CRITICAL TEST SCENARIOS:
- Service onboarding workflow from start to finish
- Template creation and deployment process
- Backstage API integration under various failure conditions
- Dashboard customization and real-time updates
- Authentication and authorization flows
- Data migration and backup/restore procedures
- High-load scenarios with 1000+ concurrent users

AUTOMATION AND CI/CD:
- Automated test execution on every pull request
- Performance budgets that fail builds if exceeded
- Visual regression detection with approval workflows
- Security scanning integrated into deployment pipeline
- Automated accessibility audits with blocking violations
- Cross-browser testing matrix for major browsers
- API contract testing to catch Backstage compatibility issues

MONITORING AND REPORTING:
- Test execution analytics and flaky test detection
- Performance trend analysis across releases
- Coverage reporting with detailed gap analysis
- Security vulnerability tracking and remediation
- User behavior analytics from E2E test insights
- Synthetic monitoring for production health checks

ACCEPTANCE CRITERIA:
- 95%+ unit test coverage with meaningful assertions
- E2E tests cover 100% of critical user paths
- Performance tests validate <3 second page load times
- Security scans detect and prevent vulnerable dependencies
- Accessibility tests ensure WCAG 2.1 AA compliance
- All tests run in <10 minutes for rapid feedback

DELIVERABLES:
- Complete test suite with documentation
- CI/CD pipeline configuration
- Test data management and cleanup scripts
- Performance baseline and monitoring setup
- Security testing automation and reporting
- Test maintenance guidelines and best practices

Create a robust testing framework that ensures the IDP wrapper maintains enterprise-grade quality and reliability.
```

## 8. Production Deployment and DevOps Pipeline

```
You are setting up the production deployment infrastructure and DevOps pipeline for the IDP wrapper platform.

TASK: Create a complete production-ready deployment pipeline with monitoring, scaling, and disaster recovery.

CONTEXT:
- The platform will serve 500+ developers across multiple teams
- Must maintain 99.9% uptime with automated failover
- Need to support multiple environments (dev, staging, production)
- Requires sophisticated monitoring and alerting
- Must integrate securely with existing Backstage infrastructure

REQUIREMENTS:
- Container orchestration with Kubernetes
- Multi-environment deployment pipeline with GitOps
- Auto-scaling based on load and performance metrics
- Comprehensive monitoring and observability stack
- Disaster recovery with automated backup and restore
- Security hardening and compliance automation
- Performance optimization and CDN integration

INFRASTRUCTURE COMPONENTS:
```
infrastructure/
├── kubernetes/
│ ├── namespaces/
│ ├── deployments/
│ ├── services/
│ ├── ingress/
│ └── configmaps/
├── terraform/
│ ├── aws/ (or cloud provider)
│ ├── networking/
│ ├── security/
│ └── monitoring/
├── helm-charts/
│ ├── idp-wrapper/
│ ├── dependencies/
│ └── monitoring/
├── ci-cd/
│ ├── github-actions/
│ ├── build-scripts/
│ └── deployment-scripts/
└── monitoring/
 ├── prometheus/
 ├── grafana/
 ├── alertmanager/
 └── jaeger/
```

DEPLOYMENT PIPELINE:
- Automated builds triggered by Git commits
- Multi-stage testing (unit, integration, E2E, security)
- Container image building and security scanning
- Progressive deployment with canary releases
- Automated rollback on failure detection
- Environment promotion with approval gates
- Post-deployment verification and health checks

MONITORING AND OBSERVABILITY:
- Application performance monitoring (APM)
- Infrastructure metrics and alerting
- Distributed tracing for request flows
- Log aggregation and analysis
- User experience monitoring
- Business metrics and KPI tracking
- Cost monitoring and optimization alerts

SECURITY IMPLEMENTATION:
- Network policies and service mesh security
- Secrets management with rotation
- Image vulnerability scanning
- Runtime security monitoring
- Compliance automation (SOC2, ISO 27001)
- Audit logging and forensics capabilities
- Backup encryption and secure storage

SCALING AND PERFORMANCE:
- Horizontal Pod Autoscaler (HPA) configuration
- Vertical Pod Autoscaler (VPA) for resource optimization
- Cluster autoscaling for node management
- CDN integration for static asset delivery
- Database connection pooling and caching
- Load balancing with health checks
- Performance testing in production environment

DISASTER RECOVERY:
- Multi-region deployment with active-passive setup
- Automated backup scheduling and verification
- Recovery time objective (RTO) of <15 minutes
- Recovery point objective (RPO) of <5 minutes
- Runbook automation for common failure scenarios
- Chaos engineering practices for resilience testing

ACCEPTANCE CRITERIA:
- Zero-downtime deployments with <1 minute rollback capability
- Auto-scaling responds to load changes within 2 minutes
- Monitoring provides complete visibility into system health
- Security hardening passes enterprise compliance audits
- Disaster recovery procedures tested monthly
- Performance meets SLA requirements under peak load

DELIVERABLES:
- Complete Kubernetes manifests and Helm charts
- Terraform infrastructure as code
- CI/CD pipeline configuration and documentation
- Monitoring dashboard and alerting rules
- Disaster recovery procedures and testing plan
- Security hardening checklist and compliance reports
- Operations runbooks and troubleshooting guides

Create a production-grade deployment that can scale with organizational growth and maintain enterprise-level reliability.
```

## General Prompt Guidelines for Claude Code

### Context Setting Patterns:
```
You are [specific role] building [specific component] for [broader context].
TASK: [clear, actionable objective]
CONTEXT: [relevant background and constraints]
REQUIREMENTS: [specific deliverables and acceptance criteria]
```

### Technical Specification Format:
```
TECHNICAL SPECS:
- [specific technology choices with versions]
- [performance requirements with metrics]
- [integration requirements]
- [security considerations]

FILE STRUCTURE:
[clear directory/file organization]

ACCEPTANCE CRITERIA:
- [measurable success conditions]
- [performance benchmarks]
- [quality gates]
```

### Best Practices for Claude Code Prompts:

1. **Be Specific**: Include exact technologies, versions, and patterns
2. **Provide Context**: Explain how this component fits into the larger system
3. **Set Clear Boundaries**: Define what should and shouldn't be included
4. **Include Examples**: Show expected file structures and code patterns
5. **Define Success**: Provide measurable acceptance criteria
6. **Consider Integration**: Specify how components interact with each other
7. **Address Non-Functionals**: Include performance, security, and scalability requirements

These prompts are designed to work iteratively - each one builds on the previous work while being self-contained enough for Claude Code to understand the full context and requirements.

---- FINAL Product prompt

# Complete IDP Wrapper Product Integration Prompt

```
You are the Lead Architect finalizing the IDP Wrapper MVP that transforms all foundation components into a fully functional, production-ready product. The scaffolding is complete - now build the actual working product.

OBJECTIVE: Create a complete, working IDP wrapper that demonstrates the full value proposition through integrated, functional features rather than isolated components.

CURRENT STATE ANALYSIS:
- Foundation: Next.js project with TypeScript and component structure [DONE]
- API Layer: Backstage client services and type definitions [DONE] 
- UI Components: Basic component scaffolding and design system [DONE]
- Testing: Test framework setup [DONE]
- Infrastructure: Deployment configurations [DONE]

MISSING: Integration of components into working user workflows with real functionality

TASK: Build the complete MVP that integrates all components into working features with these core user journeys:

## 1. WORKING SERVICE CATALOG MANAGEMENT

BUILD COMPLETE FEATURE:
- Service discovery page that actually loads from Backstage Catalog API
- Functional service cards with real metadata, owner info, and health status
- Working search that filters services in real-time
- Clickable service details that show APIs, dependencies, and documentation
- Bulk operations that actually update Backstage entities
- Live dependency graph visualization using real service relationships

INTEGRATION REQUIREMENTS:
- Connect to actual Backstage instance (use demo data if no real instance)
- Implement real CRUD operations on Backstage catalog entities
- Show loading states, error handling, and success notifications
- Make search performant with debouncing and caching
- Ensure all clicks and interactions actually do something meaningful

## 2. FUNCTIONAL NO-CODE SERVICE CREATION

BUILD COMPLETE FEATURE:
- Step-by-step wizard that creates real Backstage catalog entries
- Form builder that generates valid catalog-info.yaml files
- Live preview that shows exactly what gets created in Backstage
- One-click deployment that actually registers services in Backstage
- Template selection that loads real Backstage software templates
- Service onboarding flow from start to registered service

INTEGRATION REQUIREMENTS:
- Generate valid YAML that passes Backstage validation
- Actually call Backstage Scaffolder API to create services
- Handle template execution with real progress tracking
- Show generated repository links and next steps
- Implement proper error handling for failed service creation

## 3. LIVE DASHBOARD WITH REAL DATA

BUILD COMPLETE FEATURE:
- Dashboard that displays actual metrics from connected services
- Customizable widgets that pull real data from Backstage and external sources
- Real-time updates for service health, deployments, and incidents
- Drag-and-drop dashboard customization that persists
- Alert system that monitors actual service conditions
- Personalized view based on user's owned services

INTEGRATION REQUIREMENTS:
- Connect to real monitoring APIs (or realistic mock data)
- Implement WebSocket connections for live updates
- Store dashboard configurations in persistent storage
- Show real deployment metrics and service health status
- Make widgets interactive with drill-down capabilities

## 4. TEMPLATE MARKETPLACE AND EXECUTION

BUILD COMPLETE FEATURE:
- Template marketplace showing available Backstage software templates
- Template preview with parameter configuration
- Template execution that creates real repositories and services
- Progress tracking during template execution
- Success confirmation with links to created resources
- Template rating and feedback system

INTEGRATION REQUIREMENTS:
- Load templates from Backstage Scaffolder API
- Execute templates through Backstage with real progress updates
- Handle template parameters and validation
- Show actual results (repositories, pull requests, services)
- Implement proper error handling and rollback capabilities

## 5. UNIFIED USER EXPERIENCE

CRITICAL INTEGRATION POINTS:
- Single sign-on that works with Backstage authentication
- Navigation that maintains context across all features
- Consistent state management across the entire application
- Proper loading states and error boundaries throughout
- Mobile-responsive design that actually works on all features
- Breadcrumb navigation and deep linking for all pages

## TECHNICAL IMPLEMENTATION REQUIREMENTS:

### Real API Integration:
```typescript
// Connect to actual Backstage instance
const backstageConfig = {
 baseUrl: process.env.BACKSTAGE_URL || 'http://localhost:7007',
 auth: {
 // Implement real auth passthrough
 }
}

// Implement these working API calls:
- GET /api/catalog/entities (with real filtering)
- POST /api/catalog/entities (create new services)
- POST /api/scaffolder/v2/tasks (execute templates)
- GET /api/techdocs/default/namespace/default/{entity-name}
- WebSocket connection for real-time updates
```

### Data Flow Implementation:
```typescript
// Implement complete data flow:
User Input Form Validation API Call Backstage Update UI Refresh Success Notification

// With proper error handling:
API Error User Notification Retry Option Fallback UI Recovery Flow
```

### State Management:
```typescript
// Implement global state that actually manages:
- User authentication and permissions
- Selected services and current context 
- Dashboard configurations and preferences
- Active template executions and progress
- Real-time notifications and alerts
```

## ACCEPTANCE CRITERIA FOR COMPLETE PRODUCT:

### Functional Requirements:
- [ ] User can browse and search services from real Backstage catalog
- [ ] User can create new service through no-code wizard that registers in Backstage
- [ ] User can execute software templates that create real repositories
- [ ] Dashboard shows live metrics and updates in real-time
- [ ] All navigation and interactions work seamlessly
- [ ] Error handling provides useful feedback and recovery options

### Technical Requirements:
- [ ] All API calls work with real or realistic data
- [ ] Loading states appear during all async operations
- [ ] Error boundaries prevent app crashes
- [ ] Performance is acceptable with 100+ services
- [ ] Works on desktop and mobile devices
- [ ] Proper authentication and authorization

### Integration Requirements:
- [ ] Successful integration with Backstage APIs
- [ ] Real-time data updates work reliably
- [ ] State management works across all features
- [ ] Navigation context is maintained
- [ ] Deep linking works for all major pages

## DELIVERABLES:

1. **Working Application**: Complete Next.js app that runs and demonstrates all features
2. **Integration Documentation**: How to connect to real Backstage instance
3. **Demo Data**: Realistic sample data for testing without Backstage
4. **User Workflows**: Complete user journeys that actually work end-to-end
5. **Error Handling**: Comprehensive error scenarios with user-friendly messages
6. **Performance Optimization**: Lazy loading, caching, and efficient re-renders

## CRITICAL SUCCESS FACTORS:

The MVP must feel like a **complete product**, not a collection of components. Every click should do something meaningful, every form should actually work, and every feature should integrate seamlessly with the others.

**User Test**: A developer should be able to:
1. Log in and see their services
2. Create a new service through the no-code builder
3. Execute a template to generate a repository
4. View live metrics on their dashboard
5. Navigate between features without losing context

**All of this should work without the user needing to understand Backstage internals.**

BUILD THE ACTUAL WORKING PRODUCT NOW - focus on integration, functionality, and user experience over additional scaffolding or component architecture.
```

------ Continuation prompts

# Claude Code Continuation Prompt

```
CONTINUATION: Complete the IDP Wrapper MVP implementation.

CONTEXT: You were building a complete, functional IDP wrapper product that integrates all foundation components into working user workflows. Continue from where you left off.

CURRENT STATUS ASSESSMENT:
Review the existing codebase and identify:
- Which features are fully implemented and working
- Which features are partially complete
- Which integrations are still missing
- What API connections need to be finalized

IMMEDIATE PRIORITIES (in order):
1. **Complete the highest-priority incomplete feature** from the previous work
2. **Fix any broken integrations** between components
3. **Ensure API connections are working** with proper error handling
4. **Test the most critical user workflow** end-to-end

FOCUS AREAS FOR COMPLETION:

## If Service Catalog is incomplete:
- Finish the service listing with real API integration
- Complete search and filtering functionality
- Ensure service detail pages load and display correctly
- Add working navigation between catalog views

## If No-Code Builder is incomplete:
- Finish the form builder that generates valid YAML
- Complete the service creation workflow with API calls
- Ensure preview functionality shows accurate output
- Add success/error handling for service registration

## If Dashboard is incomplete:
- Finish widget implementation with real data connections
- Complete drag-and-drop dashboard customization
- Ensure real-time updates are working
- Add proper loading states and error boundaries

## If Template System is incomplete:
- Finish template loading from Backstage API
- Complete template execution workflow
- Ensure progress tracking and status updates work
- Add proper error handling and retry mechanisms

IMPLEMENTATION REQUIREMENTS:

### Code Quality Standards:
- Every function should handle errors gracefully
- All async operations should have loading states
- Components should be properly typed with TypeScript
- API calls should include proper retry logic and timeouts

### Integration Checklist:
- [ ] All components can access shared state
- [ ] Navigation works between all major sections
- [ ] Authentication state is consistent across features
- [ ] Error boundaries prevent crashes
- [ ] Loading states appear during API calls
- [ ] Success/error notifications work globally

### Functionality Validation:
- [ ] At least one complete user workflow works end-to-end
- [ ] All major buttons and forms actually do something
- [ ] API integration works with either real Backstage or mock data
- [ ] Error scenarios are handled with user-friendly messages
- [ ] Performance is acceptable with realistic data volumes

SPECIFIC NEXT STEPS:
1. **Assess current state**: Identify what's working vs. what needs completion
2. **Pick the most important incomplete feature** and finish it completely
3. **Test the feature** with realistic data to ensure it works
4. **Fix any integration issues** that prevent smooth user experience
5. **Add proper error handling** and loading states where missing

COMPLETION CRITERIA:
The feature you're working on should be **completely functional** - meaning:
- User can complete the entire workflow without errors
- All API calls work and return appropriate responses
- UI provides clear feedback for all user actions
- Error cases are handled gracefully
- The feature integrates properly with the rest of the application

DELIVERABLE:
Complete implementation of the highest-priority feature that makes the overall product demonstrably functional for end users.

If you encounter response limits again, save your progress and I'll provide another continuation prompt focusing on the next highest priority feature.

CONTINUE THE IMPLEMENTATION NOW.
```

--------------- ## Alternative Focused Continuation Prompts

If you need even more specific continuation prompts, use these based on what needs completion:

### For Service Catalog Completion:
```
FOCUS: Complete the Service Catalog feature with full Backstage API integration.

Make the service catalog completely functional:
- Service listing loads from Backstage Catalog API
- Search filters services in real-time
- Service cards show actual metadata and status
- Service detail pages display APIs, docs, and dependencies
- All navigation and interactions work smoothly

Ensure this one feature works perfectly before moving to other features.
```

### For No-Code Builder Completion:
```
FOCUS: Complete the No-Code Service Builder with working YAML generation and Backstage integration.

Make the service builder completely functional:
- Step-by-step wizard captures all required service information
- Form generates valid catalog-info.yaml that passes validation
- Preview shows exactly what will be created
- Submission actually registers the service in Backstage
- Success/error handling guides users through the process

Ensure this workflow works end-to-end before adding other features.
```

### For Dashboard Completion:
```
FOCUS: Complete the Dashboard with real-time data and widget customization.

Make the dashboard completely functional:
- Widgets display real metrics from connected services
- Drag-and-drop customization works and persists
- Real-time updates refresh data automatically
- Dashboard responds to user's owned services
- All widgets are interactive with proper loading states

Ensure the dashboard provides real value before adding other features.
```

### For Template System Completion:
```
FOCUS: Complete the Template Marketplace with working template execution.

Make the template system completely functional:
- Templates load from Backstage Scaffolder API
- Template preview shows parameters and configuration
- Template execution creates real repositories/services
- Progress tracking shows real-time status updates
- Success confirmation provides links to created resources

Ensure template execution works end-to-end before adding other features.
```
