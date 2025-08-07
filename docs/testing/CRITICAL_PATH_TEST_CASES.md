# Critical Path Test Cases
## NEXT Internal Developer Portal

### Test Suite Organization
Each test case follows the standard format:
- **Test ID**: Unique identifier
- **Test Name**: Descriptive name
- **Priority**: P0 (Critical), P1 (High), P2 (Medium), P3 (Low)
- **Type**: Unit/Integration/E2E
- **Preconditions**: Required setup
- **Test Steps**: Detailed execution steps
- **Expected Results**: Success criteria
- **Postconditions**: Cleanup required

---

## 1. Authentication & Authorization Test Cases

### TC-AUTH-001: User Login with Valid Credentials
**Priority:** P0  
**Type:** E2E  
**Preconditions:**
- Test user account exists in database
- Application is running on test environment
- No active sessions for test user

**Test Steps:**
1. Navigate to /login
2. Enter valid username: "test.user@example.com"
3. Enter valid password: "TestPassword123!"
4. Click "Sign In" button
5. Wait for redirect

**Expected Results:**
- User redirected to dashboard within 3 seconds
- JWT token stored in session
- User profile loaded in header
- Navigation menu shows user-specific options
- Audit log entry created

**Postconditions:**
- Clear browser session
- Remove audit log entries

---

### TC-AUTH-002: Role-Based Access Control Validation
**Priority:** P0  
**Type:** Integration  
**Preconditions:**
- Three test users with roles: admin, developer, viewer
- RBAC policies configured

**Test Steps:**
1. Login as viewer role
2. Attempt to access /admin
3. Login as developer role
4. Attempt to create new service
5. Login as admin role
6. Access all protected routes

**Expected Results:**
- Viewer: 403 on admin routes
- Developer: Can create/edit own services
- Admin: Full access to all routes
- Proper error messages displayed
- Permissions cached correctly

---

### TC-AUTH-003: OAuth/OIDC Provider Integration
**Priority:** P0  
**Type:** E2E  
**Preconditions:**
- OAuth providers configured (Google, GitHub, Azure AD)
- Test accounts on each provider

**Test Steps:**
1. Click "Sign in with Google"
2. Complete Google authentication
3. Verify account linking
4. Logout and login with GitHub
5. Test Azure AD SSO flow

**Expected Results:**
- Successful authentication with each provider
- User profile synchronized
- Correct role assignment based on provider groups
- Session established correctly
- Refresh token working

---

### TC-AUTH-004: Session Management & Timeout
**Priority:** P1  
**Type:** Integration  
**Preconditions:**
- Session timeout set to 30 minutes
- Remember me option available

**Test Steps:**
1. Login without "Remember me"
2. Keep browser idle for 31 minutes
3. Attempt to access protected resource
4. Login with "Remember me" checked
5. Close and reopen browser

**Expected Results:**
- Session expires after timeout
- User redirected to login
- Remember me maintains session
- Proper cleanup of expired sessions
- Security headers present

---

## 2. Dashboard Performance Test Cases

### TC-DASH-001: Dashboard Initial Load Performance
**Priority:** P0  
**Type:** Performance  
**Preconditions:**
- Dashboard with 10 widgets configured
- Test data seeded (1000 services, 50 users)
- Browser cache cleared

**Test Steps:**
1. Measure Time to First Byte (TTFB)
2. Measure First Contentful Paint (FCP)
3. Measure Largest Contentful Paint (LCP)
4. Measure Time to Interactive (TTI)
5. Check all widgets loaded

**Expected Results:**
- TTFB < 200ms
- FCP < 1.5s
- LCP < 2.5s
- TTI < 3.5s
- All widgets rendered < 5s
- No JavaScript errors

---

### TC-DASH-002: Real-time Data Updates via WebSocket
**Priority:** P0  
**Type:** Integration  
**Preconditions:**
- WebSocket server running
- Dashboard with real-time widgets
- Multiple browser tabs open

**Test Steps:**
1. Open dashboard in two browser tabs
2. Trigger service status change
3. Monitor WebSocket messages
4. Simulate connection drop
5. Verify reconnection logic

**Expected Results:**
- Updates appear within 500ms
- All tabs receive updates
- Reconnection within 5 seconds
- No duplicate messages
- Proper error handling

---

### TC-DASH-003: Dashboard Customization & Persistence
**Priority:** P1  
**Type:** E2E  
**Preconditions:**
- User logged in with saved dashboard
- Widget library available

**Test Steps:**
1. Add new widget to dashboard
2. Rearrange widget positions
3. Resize widgets
4. Remove widget
5. Refresh page

**Expected Results:**
- Changes saved automatically
- Layout persisted correctly
- Smooth drag-and-drop
- Undo/redo functionality works
- Responsive on mobile

---

## 3. Service Catalog CRUD Operations

### TC-CAT-001: Create New Service Entity
**Priority:** P0  
**Type:** E2E  
**Preconditions:**
- User has create permissions
- Service template available

**Test Steps:**
1. Navigate to /catalog/create
2. Fill in service details:
   - Name: "test-service"
   - Type: "backend"
   - Owner: "platform-team"
   - Repository: "github.com/org/repo"
3. Add metadata tags
4. Upload service icon
5. Submit form

**Expected Results:**
- Service created successfully
- Appears in catalog within 5s
- Metadata indexed for search
- Git webhook configured
- Notification sent to owner

**Validation:**
```javascript
expect(service).toMatchObject({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'test-service',
    namespace: 'default',
    tags: ['backend', 'nodejs']
  },
  spec: {
    type: 'service',
    lifecycle: 'production',
    owner: 'platform-team'
  }
});
```

---

### TC-CAT-002: Update Service Configuration
**Priority:** P0  
**Type:** Integration  
**Preconditions:**
- Existing service in catalog
- User has edit permissions

**Test Steps:**
1. Search for service
2. Click edit button
3. Update configuration
4. Add dependency relationship
5. Save changes

**Expected Results:**
- Changes persisted immediately
- Version history created
- Relationships updated in graph
- Cache invalidated
- Webhooks triggered

---

### TC-CAT-003: Bulk Import Services
**Priority:** P1  
**Type:** E2E  
**Preconditions:**
- CSV file with 100 services
- Import permissions granted

**Test Steps:**
1. Navigate to /catalog/import
2. Upload CSV file
3. Map columns to fields
4. Validate import preview
5. Execute import

**Expected Results:**
- Progress bar shows status
- Validation errors displayed
- 100 services imported < 30s
- Duplicate detection works
- Rollback available

---

### TC-CAT-004: Service Dependency Mapping
**Priority:** P1  
**Type:** Integration  
**Preconditions:**
- Services with dependencies exist
- Graph visualization enabled

**Test Steps:**
1. Navigate to service details
2. View dependency graph
3. Click on dependency node
4. Add new dependency
5. Remove dependency

**Expected Results:**
- Graph renders correctly
- Interactive navigation
- Circular dependency detection
- Impact analysis shown
- Changes reflected immediately

---

## 4. Template System Test Cases

### TC-TEMP-001: Template Creation Workflow
**Priority:** P0  
**Type:** E2E  
**Preconditions:**
- Template builder access
- Git repository configured

**Test Steps:**
1. Navigate to /templates/create
2. Select template type
3. Define input parameters
4. Add workflow steps
5. Test template execution
6. Publish template

**Expected Results:**
- Template validated successfully
- Parameters render correctly
- Steps execute in order
- Template available in marketplace
- Version control integrated

**Template Structure Validation:**
```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: test-template
  title: Test Service Template
spec:
  owner: platform-team
  type: service
  parameters:
    - title: Service Details
      required:
        - name
        - description
      properties:
        name:
          type: string
          pattern: '^[a-z0-9-]+$'
  steps:
    - id: fetch
      name: Fetch Base
      action: fetch:template
    - id: publish
      name: Publish to GitHub
      action: publish:github
```

---

### TC-TEMP-002: Template Execution with Parameters
**Priority:** P0  
**Type:** Integration  
**Preconditions:**
- Published template available
- GitHub integration configured

**Test Steps:**
1. Select template from catalog
2. Fill in all parameters
3. Validate input
4. Execute template
5. Monitor execution status

**Expected Results:**
- Validation prevents invalid input
- Execution completes < 60s
- Repository created in GitHub
- Service registered in catalog
- Notifications sent

---

### TC-TEMP-003: Template Marketplace Search & Filter
**Priority:** P2  
**Type:** E2E  
**Preconditions:**
- 50+ templates in marketplace
- Various categories and tags

**Test Steps:**
1. Search by keyword
2. Filter by category
3. Sort by popularity
4. View template details
5. Rate template

**Expected Results:**
- Search returns relevant results
- Filters work correctly
- Sorting accurate
- Details page loads < 2s
- Rating updates immediately

---

## 5. Kubernetes Integration Test Cases

### TC-K8S-001: Cluster Connection & Discovery
**Priority:** P1  
**Type:** Integration  
**Preconditions:**
- Kubernetes clusters configured
- Service account with permissions

**Test Steps:**
1. Add new cluster configuration
2. Test connection
3. Discover namespaces
4. List deployments
5. View pod logs

**Expected Results:**
- Connection established < 5s
- All namespaces discovered
- Deployments listed correctly
- Real-time log streaming
- Metrics displayed

---

### TC-K8S-002: Service Deployment Status
**Priority:** P1  
**Type:** E2E  
**Preconditions:**
- Services deployed to K8s
- Monitoring configured

**Test Steps:**
1. Navigate to service page
2. View Kubernetes tab
3. Check deployment status
4. Scale deployment
5. Rollback version

**Expected Results:**
- Current status accurate
- Scaling completes < 30s
- Rollback successful
- Events logged
- Alerts triggered if needed

---

## 6. Cost Management Test Cases

### TC-COST-001: Multi-Cloud Cost Aggregation
**Priority:** P1  
**Type:** Integration  
**Preconditions:**
- AWS, Azure, GCP accounts linked
- Cost data available for last 30 days

**Test Steps:**
1. Navigate to /cost-insights
2. Select date range
3. View aggregated costs
4. Drill down by service
5. Export report

**Expected Results:**
- Data loads < 5s
- Costs accurate to source
- Breakdown charts render
- CSV export works
- Currency conversion correct

---

### TC-COST-002: Cost Anomaly Detection
**Priority:** P2  
**Type:** Integration  
**Preconditions:**
- Historical cost data available
- Anomaly thresholds configured

**Test Steps:**
1. Simulate 50% cost spike
2. Wait for detection
3. View anomaly alert
4. Acknowledge alert
5. Create incident

**Expected Results:**
- Anomaly detected < 1 hour
- Alert sent to owners
- Details accurate
- Incident tracking works
- Recommendations provided

---

## 7. Documentation (TechDocs) Test Cases

### TC-DOCS-001: Documentation Generation from Markdown
**Priority:** P2  
**Type:** Integration  
**Preconditions:**
- Service with docs/ folder
- Markdown files present

**Test Steps:**
1. Trigger doc generation
2. Monitor build process
3. View generated docs
4. Test search functionality
5. Check mobile responsiveness

**Expected Results:**
- Build completes < 2 min
- HTML generated correctly
- Search indexes content
- Navigation works
- Mobile layout responsive

---

## 8. Performance Test Scenarios

### TC-PERF-001: Load Test - 1000 Concurrent Users
**Priority:** P0  
**Type:** Performance  
**Preconditions:**
- Production-like environment
- Test data seeded
- Monitoring enabled

**Test Steps:**
```javascript
// k6 load test script
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '5m', target: 100 },
    { duration: '10m', target: 1000 },
    { duration: '5m', target: 1000 },
    { duration: '5m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.1'],
  },
};

export default function() {
  let response = http.get('https://portal.example.com/api/catalog');
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}
```

**Expected Results:**
- 95% requests < 500ms
- Error rate < 1%
- No memory leaks
- CPU < 80%
- No database locks

---

## 9. Security Test Cases

### TC-SEC-001: SQL Injection Prevention
**Priority:** P0  
**Type:** Security  
**Preconditions:**
- OWASP ZAP configured
- Test payloads ready

**Test Steps:**
1. Test all input fields with SQL payloads
2. Test URL parameters
3. Test API endpoints
4. Check error messages
5. Verify logging

**Expected Results:**
- All injections blocked
- Parameterized queries used
- No sensitive data in errors
- Attempts logged
- WAF rules triggered

---

### TC-SEC-002: XSS Attack Prevention
**Priority:** P0  
**Type:** Security  
**Preconditions:**
- XSS payloads prepared
- CSP headers configured

**Test Steps:**
1. Inject script tags in forms
2. Test stored XSS vectors
3. Test reflected XSS
4. Check CSP headers
5. Verify sanitization

**Expected Results:**
- Scripts blocked/escaped
- CSP prevents execution
- Input sanitized
- Output encoded
- No alerts executed

---

## 10. Accessibility Test Cases

### TC-A11Y-001: Keyboard Navigation
**Priority:** P1  
**Type:** Accessibility  
**Preconditions:**
- Screen reader installed
- Keyboard navigation enabled

**Test Steps:**
1. Navigate using Tab key only
2. Test all interactive elements
3. Check focus indicators
4. Test skip links
5. Verify shortcuts

**Expected Results:**
- All elements reachable
- Focus visible
- Logical tab order
- Skip links work
- No keyboard traps

---

## Test Execution Matrix

| Test Suite | Frequency | Duration | Environment |
|------------|-----------|----------|-------------|
| Smoke Tests | Every commit | 5 min | CI |
| Unit Tests | Every commit | 10 min | CI |
| Integration | Every PR | 20 min | Staging |
| E2E Critical | Daily | 30 min | Staging |
| E2E Full | Weekly | 2 hours | Staging |
| Performance | Weekly | 1 hour | Load Env |
| Security | Weekly | 3 hours | Security Env |
| Accessibility | Per Release | 1 hour | Staging |

## Test Data Requirements

### User Accounts
```json
{
  "admin": {
    "email": "admin@test.com",
    "password": "Admin123!",
    "role": "admin"
  },
  "developer": {
    "email": "dev@test.com",
    "password": "Dev123!",
    "role": "developer"
  },
  "viewer": {
    "email": "viewer@test.com",
    "password": "View123!",
    "role": "viewer"
  }
}
```

### Service Catalog Seed Data
- 1000 services across 10 namespaces
- 50 templates in marketplace
- 100 users with various roles
- 500 documentation pages
- 30 days of cost data
- 5 Kubernetes clusters

## Success Metrics

**Test Coverage Goals:**
- Critical Paths: 100% E2E coverage
- API Endpoints: 90% integration coverage
- Components: 80% unit test coverage
- Overall: 70% code coverage

**Quality Metrics:**
- Zero P0 bugs in production
- < 5% test flakiness
- < 45 min full test execution
- > 95% test reliability