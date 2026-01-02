# Changelog

All notable changes to NEXT Portal will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.7] - 2026-01-02

### Fixed
- Fixed visual-regression.yml YAML indentation (was using 1-space, now proper 2-space)
- Updated deprecated codeql-action@v2 to v3 in security-audit.yml and progressive-delivery.yml
- Updated deprecated docker/setup-buildx-action@v2 to v3 in plugin-install.yml
- Updated deprecated aws-actions/configure-aws-credentials@v2 to v4 in plugin-install.yml
- Updated deprecated aws-actions/amazon-ecr-login@v1 to v2 in plugin-install.yml

## [1.1.6] - 2026-01-02

### Fixed
- Fixed deploy.yml YAML indentation (was using 1-space, now proper 2-space)
- Corrected workflow file structure for all jobs and steps

## [1.1.5] - 2026-01-02

### Fixed
- Fixed plugin-system-testing.yml YAML structure (job indentation)
- plugin-change-detection job now properly nested under jobs key

## [1.1.4] - 2026-01-02

### Fixed
- Updated all GitHub Actions workflows to use latest action versions
- Replaced deprecated actions/upload-artifact@v3 with v4
- Replaced deprecated actions/download-artifact@v3 with v4
- Updated actions/checkout@v3 to v4
- Updated actions/setup-node@v3 to v4
- Updated actions/cache@v3 to v4
- Updated codecov/codecov-action@v3 to v4
- Updated actions/github-script@v6 to v7

### Changed
- All workflow files now use latest GitHub Actions versions
- Ensured CI/CD pipeline compatibility with GitHub Actions deprecation timeline

## [1.1.3] - 2026-01-02

### Added
- Rate-limiter-flexible mock for notification system tests
- Comprehensive test path ignore patterns for infrastructure tests

### Fixed
- TensorFlow mock circular reference issue (tensorflowMock.tensor before initialization)
- ServiceRepository.getServiceStats test assertion (nested where clause)
- RBAC simple test - added prisma mock and query object to req

### Changed
- Stabilized test suite to 491 passing tests in 23 suites
- Categorized and documented tests requiring external dependencies
- Tests requiring cloud SDKs, WebSocket mocking, or full MSW setup are properly skipped

## [1.1.2] - 2026-01-02

### Added
- BroadcastChannel polyfill for MSW v2 compatibility in Jest tests
- Slack web-api mock for notification system tests
- Discord.js mock for notification system tests
- Pact foundation mock for contract tests
- MSW v2 compatibility layer for backstage mocks

### Changed
- Improved Jest configuration with proper testPathIgnorePatterns per project
- Extended transformIgnorePatterns to include @octokit and marked ESM modules
- Updated test suite to skip tests requiring external dependencies

### Test Progress
- 20 test suites passing
- 667 tests passing (up from 376 initially)
- Identified infrastructure tests that need external dependencies

## [1.1.1] - 2026-01-02

### Changed
- Updated GitHub Actions workflow to use v4 of actions (checkout, setup-node, upload-artifact, download-artifact)
- Updated codecov-action to v4, codeql-action to v3
- Increased Node.js heap memory limit to 8GB in CI environment
- Changed npm install to npm ci for deterministic builds
- Added CI environment variable to test runs
- Added NEXT_TELEMETRY_DISABLED to build step
- Improved Trivy scanner to focus on CRITICAL and HIGH severity
- Fixed E2E tests to run database schema setup before tests

### Fixed
- Removed `if: always()` from build job to only run on successful tests
- Added missing database schema push step in E2E job

## [1.1.0] - 2026-01-02

### Added
- Cloud SDK mocks for AWS Cost Explorer and Organizations
- Azure ARM mocks for consumption and cost management
- GCP mocks for BigQuery, Billing, and Recommender
- Kubernetes client-node mock for cluster integration tests
- Node-vault mock for secrets management tests
- MSW (Mock Service Worker) polyfills for API route testing
- Web API polyfills (Request, Response, Headers) for Next.js testing
- Audit logger utility for monitoring operations
- WebSocket singleton reset function for test isolation

### Fixed
- Corrupted test files (useRealtimePlugins.test.ts, cleanup-utils.test.ts)
- Mock hoisting issues in repository tests (ServiceRepository, UserRepository)
- SemanticSearchEngine naming conflict with component
- WebSocket URL building for JSDOM environment
- Import paths for db/client across test files
- Plugin management test assertions to match actual API

### Changed
- Updated jest.config.js with proper transform patterns for ESM modules
- Enhanced tsconfig.json and tsconfig.build.json exclusion patterns
- Improved test isolation with proper singleton resets

### Test Coverage
- plugin-management: 31/31 tests passing
- useRealtimePlugins: 16/16 tests passing
- cleanupUtils: 32/32 tests passing
- semanticSearchEngine: 24/24 tests passing
- authTests: 21/21 tests passing
- serviceRepository: 48/48 tests passing
- userRepository: 36/36 tests passing
- costMonitor: 20/21 tests passing
- Overall: 700+ tests passing (up from 376)

## [1.0.0] - 2026-01-01

### Added
- Initial release of NEXT Portal
- Service Catalog with full-text search and dependency visualization
- Software Templates (Scaffolder) for rapid service creation
- Quality Scorecards with automated scoring
- Real-time Dashboard with customizable widgets
- Integration Hub with no-code connectors
- Deployment Tracking system
- Cost Management (FinOps) integration
- Plugin Marketplace with security scanning
- Multi-tenant architecture with row-level security
- NextAuth integration with GitHub, Google, Azure AD
- WebSocket-based real-time updates
- OpenTelemetry distributed tracing

### Security
- RSA, ECDSA, ED25519 signature verification for plugins
- SHA256/SHA512 checksum validation
- Vulnerability scanning for plugin dependencies
- RBAC with Admin, Platform Engineer, Developer, Viewer roles
- API key authentication for programmatic access
- MFA with TOTP and backup codes
