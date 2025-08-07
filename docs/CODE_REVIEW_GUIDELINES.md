# Code Review Guidelines & Standards
## Backstage IDP Portal Development Team

---

## Purpose
These guidelines ensure consistent, high-quality code across our Backstage IDP portal, facilitating maintainability, security, and team collaboration.

---

## Code Review Process

### 1. Pre-Review Checklist (Author)
Before requesting review, ensure:
- [ ] Code compiles without warnings
- [ ] All tests pass locally
- [ ] Test coverage meets minimum threshold (>80% for new code)
- [ ] Linting passes (`npm run lint`)
- [ ] Type checking passes (`npm run typecheck`)
- [ ] Self-review completed
- [ ] PR description is comprehensive
- [ ] Linked to issue/ticket
- [ ] Documentation updated if needed

### 2. Pull Request Structure

#### PR Title Format
```
[TYPE][SCOPE] Brief description

Examples:
[FEAT][Catalog] Add entity relationship visualization
[FIX][Auth] Resolve JWT validation issue
[PERF][Dashboard] Optimize widget rendering
[TEST][API] Add integration tests for cost endpoints
```

#### PR Description Template
```markdown
## Summary
Brief description of what this PR does

## Changes
- List of specific changes
- Breaking changes (if any)

## Testing
- How to test these changes
- Test coverage added/modified

## Screenshots (if UI changes)
Before | After comparison

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No console.log statements
- [ ] No commented code
- [ ] Follows coding standards

## Related Issues
Fixes #123
```

### 3. Review Timeline
- **Critical/Blocking**: Review within 2 hours
- **High Priority**: Review within 4 hours
- **Normal**: Review within 1 business day
- **Low Priority**: Review within 2 business days

---

## Code Standards

### TypeScript/JavaScript

#### Naming Conventions
```typescript
// Components: PascalCase
export const UserProfile: React.FC = () => { }

// Functions/Methods: camelCase
function calculateTotalCost() { }

// Constants: UPPER_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;

// Interfaces/Types: PascalCase with 'I' or 'T' prefix for clarity
interface IUserData { }
type TApiResponse = { }

// Enums: PascalCase with UPPER_SNAKE_CASE values
enum ServiceStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded'
}
```

#### File Organization
```typescript
// 1. Imports (grouped and ordered)
import React from 'react';                    // React
import { useRouter } from 'next/router';      // Next.js
import { Button } from '@/components/ui';     // Internal components
import { fetchData } from '@/lib/api';        // Internal utilities
import type { User } from '@/types';          // Types

// 2. Type definitions
interface Props { }

// 3. Constants
const DEFAULT_TIMEOUT = 5000;

// 4. Component/Function
export const Component: React.FC<Props> = () => { }

// 5. Helper functions
function helperFunction() { }

// 6. Exports
export default Component;
```

#### Best Practices
```typescript
// Use explicit types
const fetchUser = async (id: string): Promise<User> => { }

// Prefer const over let
const user = await fetchUser(id);

// Use optional chaining
const name = user?.profile?.name ?? 'Unknown';

// Use template literals
const message = `Welcome, ${name}!`;

// Destructure objects
const { id, name, email } = user;

// Async/await over promises
// Good
const data = await fetchData();

// Avoid
fetchData().then(data => { });
```

### React Components

#### Component Structure
```typescript
// Functional components with TypeScript
interface ComponentProps {
  title: string;
  onAction?: () => void;
  children?: React.ReactNode;
}

export const Component: React.FC<ComponentProps> = ({ 
  title, 
  onAction,
  children 
}) => {
  // 1. Hooks (grouped by type)
  const router = useRouter();
  const [state, setState] = useState<string>('');
  
  // 2. Derived state
  const isValid = useMemo(() => state.length > 0, [state]);
  
  // 3. Effects
  useEffect(() => {
    // Effect logic
  }, [dependency]);
  
  // 4. Handlers
  const handleClick = useCallback(() => {
    onAction?.();
  }, [onAction]);
  
  // 5. Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
};
```

#### Hooks Rules
```typescript
// Custom hooks must start with 'use'
function useCustomHook() { }

// Document complex hooks
/**
 * Hook for managing user authentication state
 * @returns {AuthState} Current auth state and methods
 */
function useAuth(): AuthState { }

// Memoize expensive computations
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data);
}, [data]);

// Use useCallback for function props
const handleSubmit = useCallback((data: FormData) => {
  // Handle submission
}, [dependency]);
```

### API Routes

#### Structure
```typescript
// app/api/[resource]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Input validation schema
const schema = z.object({
  name: z.string().min(1),
  email: z.string().email()
});

export async function POST(request: NextRequest) {
  try {
    // 1. Parse and validate input
    const body = await request.json();
    const validated = schema.parse(body);
    
    // 2. Business logic
    const result = await createResource(validated);
    
    // 3. Return response
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    // 4. Error handling
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Testing

#### Test Structure
```typescript
describe('ComponentName', () => {
  // Setup
  beforeEach(() => {
    // Setup code
  });
  
  // Group related tests
  describe('when user is authenticated', () => {
    it('should display user profile', () => {
      // Arrange
      const user = { id: '1', name: 'Test User' };
      
      // Act
      const { getByText } = render(<Component user={user} />);
      
      // Assert
      expect(getByText('Test User')).toBeInTheDocument();
    });
  });
  
  // Test edge cases
  it('should handle null user gracefully', () => {
    // Test implementation
  });
});
```

#### Test Coverage Requirements
- New code: Minimum 80%
- Critical paths: Minimum 90%
- UI Components: Minimum 70%
- Utilities: 100%

---

## Review Checklist

### Security
- [ ] No hardcoded secrets or API keys
- [ ] Input validation implemented
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (no dangerouslySetInnerHTML without sanitization)
- [ ] Authentication/authorization checks
- [ ] Rate limiting on APIs
- [ ] CORS properly configured

### Performance
- [ ] No unnecessary re-renders (React.memo, useMemo, useCallback)
- [ ] Images optimized and lazy loaded
- [ ] API calls debounced/throttled where appropriate
- [ ] Database queries optimized (indexes, joins)
- [ ] Bundle size impact considered
- [ ] No memory leaks (cleanup in useEffect)

### Code Quality
- [ ] DRY principle followed (no code duplication)
- [ ] SOLID principles applied
- [ ] Functions are single-purpose
- [ ] Complex logic is documented
- [ ] Error handling is comprehensive
- [ ] Edge cases handled
- [ ] Magic numbers replaced with constants

### Testing
- [ ] Unit tests for business logic
- [ ] Integration tests for APIs
- [ ] Component tests for UI
- [ ] Error cases tested
- [ ] Loading states tested
- [ ] Accessibility tested

### Documentation
- [ ] Code comments for complex logic
- [ ] JSDoc for public APIs
- [ ] README updated if needed
- [ ] API documentation updated
- [ ] Changelog entry added

---

## Review Comments

### Effective Comments
```
// Good
"Consider using useMemo here to prevent recalculation on every render"
"This could cause an N+1 query problem. Consider using a join or batch loading"
"The error message could be more specific to help with debugging"

// Not helpful
"This is wrong"
"Fix this"
"Why?"
```

### Comment Levels
- **Must Fix** 🔴: Blocking issues (security, bugs, breaking changes)
- **Should Fix** 🟡: Important but not blocking (performance, best practices)
- **Consider** 🟢: Suggestions for improvement (style, minor optimizations)
- **Nitpick** 💭: Minor style issues (optional)

---

## Approval Requirements

### Merge Requirements
- Minimum 2 approvals for production code
- 1 approval for documentation/test-only changes
- All "Must Fix" comments resolved
- CI/CD pipeline passing
- No merge conflicts

### Principal Engineer Review Required For:
- Architecture changes
- New dependencies
- Security-critical code
- Performance-critical paths
- Database schema changes
- API contract changes

---

## Continuous Improvement

### Metrics to Track
- Review turnaround time
- Defect escape rate
- Review effectiveness (bugs caught)
- Code coverage trends
- Technical debt

### Monthly Review
- Analyze metrics
- Update guidelines based on learnings
- Share best practices
- Recognize excellent reviews

---

## Tools & Automation

### Pre-commit Hooks
```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "commit-msg": "commitlint -E HUSKY_GIT_PARAMS"
    }
  }
}
```

### CI/CD Checks
- Linting (ESLint)
- Type checking (TypeScript)
- Unit tests (Jest)
- Integration tests (Playwright)
- Security scanning (Snyk)
- Bundle size analysis
- Code coverage report

### IDE Setup
- ESLint extension
- Prettier extension
- TypeScript error checking
- Auto-import organization
- Spell checker

---

## References
- [TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
- [React Best Practices](https://react.dev/learn/thinking-in-react)
- [Next.js Best Practices](https://nextjs.org/docs/pages/building-your-application)
- [OWASP Secure Coding](https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/)

---

**Version**: 1.0
**Last Updated**: 2025-08-07
**Owner**: Principal Engineering Team