# Developer Onboarding Guide
## Welcome to the Backstage IDP Portal Team

---

## Welcome Aboard!
Welcome to the Backstage IDP Portal development team! This guide will help you get up and running with our codebase, tools, and processes. By the end of this onboarding, you'll be ready to contribute effectively to our enterprise-grade Internal Developer Platform.

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Project Overview](#project-overview)
4. [Development Workflow](#development-workflow)
5. [Testing Guidelines](#testing-guidelines)
6. [Deployment Process](#deployment-process)
7. [Resources & Support](#resources--support)

---

## Prerequisites

### Required Software
Ensure you have the following installed:

```bash
# Check versions
node --version      # Required: v18.17.0 or higher
npm --version       # Required: v9.0.0 or higher
docker --version    # Required: v20.10 or higher
git --version       # Required: v2.30 or higher

# Database tools
psql --version      # PostgreSQL client
redis-cli --version # Redis client
```

### Recommended IDE Setup
We recommend Visual Studio Code with these extensions:
- ESLint
- Prettier - Code formatter
- TypeScript and JavaScript Language Features
- Tailwind CSS IntelliSense
- Prisma
- GitLens
- Docker
- Thunder Client (API testing)

### Access Requirements
Request access to:
- [ ] GitHub repository (read/write)
- [ ] Backstage instance (dev/staging)
- [ ] AWS/Azure/GCP console (read-only initially)
- [ ] Slack workspace (#dev-idp channel)
- [ ] Jira project board
- [ ] Confluence documentation
- [ ] Monitoring dashboards (Grafana, DataDog)
- [ ] CI/CD pipelines (Jenkins/GitHub Actions)

---

## Environment Setup

### 1. Clone the Repository
```bash
# Clone the repository
git clone https://github.com/your-org/saas-idp.git
cd saas-idp

# Create your feature branch
git checkout -b feature/your-name-onboarding
```

### 2. Install Dependencies
```bash
# Install Node dependencies
npm install

# Install Playwright browsers for E2E testing
npx playwright install

# Generate Prisma client
npm run db:generate
```

### 3. Environment Configuration
```bash
# Copy environment template
cp .env.example .env.local

# Edit .env.local with your settings
# Key variables to configure:
DATABASE_URL="postgresql://user:password@localhost:5432/backstage_idp"
REDIS_URL="redis://localhost:6379"
NEXTAUTH_SECRET="generate-a-secret-key"
BACKSTAGE_URL="http://localhost:7007"
```

### 4. Database Setup
```bash
# Start PostgreSQL and Redis using Docker
docker-compose up -d postgres redis

# Run database migrations
npm run db:migrate

# Seed with sample data
npm run db:seed

# Verify database connection
npm run db:studio  # Opens Prisma Studio at http://localhost:5555
```

### 5. Start Development Servers
```bash
# Terminal 1: Start the Next.js development server
npm run dev
# Portal available at http://localhost:4400

# Terminal 2: Start the WebSocket server
npm run ws:dev
# WebSocket server at ws://localhost:8080

# Terminal 3: Start mock Backstage server (for local development)
npm run mock-backstage
# Mock API at http://localhost:7007

# Or start all services at once
npm run start:all
```

### 6. Verify Installation
```bash
# Run tests to verify setup
npm run test

# Check linting
npm run lint

# Type checking
npm run typecheck

# Open the portal
open http://localhost:4400
```

---

## Project Overview

### Architecture Stack
- **Frontend**: Next.js 15.4 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS, Radix UI components
- **State Management**: Zustand, React Query
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL, Redis
- **Real-time**: Socket.io
- **Testing**: Jest, React Testing Library, Playwright
- **Deployment**: Docker, Kubernetes

### Project Structure
```
saas-idp/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── (auth)/          # Authentication pages
│   │   ├── api/             # API routes
│   │   ├── catalog/         # Entity catalog UI
│   │   ├── dashboard/       # Dashboard pages
│   │   └── templates/       # Template marketplace
│   ├── components/          # React components
│   │   ├── ui/             # Base UI components
│   │   └── features/       # Feature-specific components
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utilities and libraries
│   ├── services/           # Business logic services
│   └── types/              # TypeScript type definitions
├── prisma/                 # Database schema and migrations
├── public/                 # Static assets
├── tests/                  # Test suites
├── docs/                   # Documentation
└── scripts/                # Utility scripts
```

### Key Features
1. **Catalog Management**: CRUD operations for Backstage entities
2. **Template Marketplace**: Visual template builder and executor
3. **Plugin System**: Module federation for dynamic plugins
4. **Cost Tracking**: Multi-cloud cost analytics
5. **Monitoring Dashboard**: Real-time metrics and alerts
6. **Search**: Elasticsearch-powered global search
7. **Permissions**: RBAC with fine-grained access control

---

## Development Workflow

### 1. Daily Routine
```bash
# Start your day
git checkout main
git pull origin main
git checkout -b feature/JIRA-123-feature-name

# Start development
npm run dev

# Before committing
npm run lint:fix
npm run typecheck
npm run test
```

### 2. Making Changes

#### Creating a New Component
```bash
# Use the component generator
npm run generate:component MyComponent

# Or manually create
mkdir -p src/components/features/MyComponent
touch src/components/features/MyComponent/index.tsx
touch src/components/features/MyComponent/MyComponent.test.tsx
```

#### Component Template
```typescript
// src/components/features/MyComponent/index.tsx
import React from 'react';
import { cn } from '@/lib/utils';

interface MyComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export const MyComponent: React.FC<MyComponentProps> = ({
  className,
  children
}) => {
  return (
    <div className={cn('component-base-styles', className)}>
      {children}
    </div>
  );
};

// Don't forget the test file!
```

#### Adding an API Route
```typescript
// src/app/api/my-endpoint/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth';

const schema = z.object({
  // Define your schema
});

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const validated = schema.parse(body);
    
    // Your logic here
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
```

### 3. Git Workflow
```bash
# Stage changes
git add .

# Commit with conventional commits
git commit -m "feat(catalog): add entity relationship visualization"
# Types: feat, fix, docs, style, refactor, test, chore

# Push to remote
git push origin feature/JIRA-123-feature-name

# Create pull request
gh pr create --title "[JIRA-123] Add entity visualization" \
             --body "Description of changes"
```

### 4. Code Review Process
1. Self-review your PR
2. Ensure CI/CD passes
3. Request review from 2 team members
4. Address feedback
5. Merge when approved

---

## Testing Guidelines

### Running Tests
```bash
# Unit tests
npm run test
npm run test:watch    # Watch mode
npm run test:coverage # With coverage

# E2E tests
npm run test:e2e
npm run test:e2e:headed # See browser
npm run test:e2e:debug  # Debug mode

# Visual regression tests
npm run test:visual

# All tests
npm run test:all
```

### Writing Tests

#### Unit Test Example
```typescript
// MyComponent.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent>Test Content</MyComponent>);
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should handle click events', () => {
    const handleClick = jest.fn();
    render(<MyComponent onClick={handleClick}>Click me</MyComponent>);
    
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

#### E2E Test Example
```typescript
// tests/e2e/catalog.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Catalog', () => {
  test('should create new entity', async ({ page }) => {
    await page.goto('/catalog');
    await page.click('text=Create Entity');
    
    await page.fill('[name="name"]', 'test-service');
    await page.selectOption('[name="type"]', 'service');
    await page.click('text=Create');
    
    await expect(page).toHaveURL(/\/catalog\/component\/default\/test-service/);
  });
});
```

---

## Deployment Process

### Local Build
```bash
# Production build
npm run build

# Analyze bundle size
npm run build:analyze

# Test production build locally
npm run start
```

### Docker Deployment
```bash
# Build Docker image
docker build -t backstage-idp:latest .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL=$DATABASE_URL \
  -e REDIS_URL=$REDIS_URL \
  backstage-idp:latest
```

### CI/CD Pipeline
Our CI/CD pipeline (GitHub Actions) runs:
1. Linting and type checking
2. Unit tests with coverage
3. E2E tests
4. Security scanning
5. Docker image build
6. Deployment to staging
7. Smoke tests
8. Production deployment (manual approval)

---

## Common Tasks

### Database Operations
```bash
# View database in GUI
npm run db:studio

# Reset database
npm run db:reset

# Create migration after schema change
npx prisma migrate dev --name description_of_change

# Apply migrations
npm run db:migrate
```

### Debugging
```typescript
// Use debug utility
import { debug } from '@/lib/debug';

debug.log('Component rendered', { props });
debug.error('API call failed', error);

// Enable debug mode
localStorage.setItem('debug', 'true');
```

### Performance Profiling
```bash
# Run performance tests
npm run test:performance

# Lighthouse audit
npm run test:lighthouse

# Bundle analysis
npm run analyze
```

---

## Resources & Support

### Documentation
- [Architecture Overview](./ARCHITECTURE.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [Code Review Guidelines](./CODE_REVIEW_GUIDELINES.md)
- [Testing Strategy](./testing/TEST_STRATEGY.md)
- [Backstage Documentation](https://backstage.io/docs)

### Communication Channels
- **Slack**: #dev-idp (daily standup @ 9:30 AM)
- **Email**: idp-team@company.com
- **Weekly Sync**: Tuesdays @ 2:00 PM
- **Office Hours**: Thursdays @ 3:00 PM

### Learning Resources
- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Patterns](https://react.dev/learn)
- [Backstage Architecture](https://backstage.io/docs/overview/architecture-overview)
- [Internal Tech Talks](https://confluence.company.com/idp-tech-talks)

### Getting Help
1. Check documentation first
2. Search in Slack history
3. Ask in #dev-idp-help
4. Schedule pairing session
5. Escalate to tech lead if blocked

### Your Buddy
You'll be paired with a team buddy for your first 2 weeks:
- Daily check-ins
- Code review mentoring
- Architecture walkthrough
- Best practices sharing

---

## First Week Checklist

### Day 1
- [ ] Complete environment setup
- [ ] Run the application locally
- [ ] Join all communication channels
- [ ] Meet your buddy

### Day 2-3
- [ ] Complete a "good first issue"
- [ ] Submit your first PR
- [ ] Attend team standup
- [ ] Review architecture docs

### Day 4-5
- [ ] Pair program on a feature
- [ ] Write your first tests
- [ ] Deploy to staging environment
- [ ] Document learnings

### End of Week 1
- [ ] Completed onboarding checklist
- [ ] Merged at least one PR
- [ ] Familiar with codebase structure
- [ ] Ready for independent work

---

## Tips for Success

### Do's
✅ Ask questions early and often
✅ Document your learnings
✅ Write tests for your code
✅ Follow coding standards
✅ Participate in code reviews
✅ Share knowledge with team

### Don'ts
❌ Skip tests to save time
❌ Commit directly to main
❌ Ignore linting errors
❌ Work in isolation
❌ Assume without asking
❌ Leave console.logs in code

---

## Feedback
Your onboarding experience matters! Please provide feedback:
- What worked well?
- What was confusing?
- What was missing?
- Suggestions for improvement

Share feedback with your buddy or in #dev-idp-feedback.

---

**Welcome to the team! We're excited to have you aboard!** 

**Last Updated**: 2025-08-07
**Version**: 1.0
**Maintainer**: Platform Team Lead