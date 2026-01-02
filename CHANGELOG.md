# Changelog

All notable changes to NEXT Portal will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
