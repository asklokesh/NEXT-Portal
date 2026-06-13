# FACTORY TODO 500 — NEXT Portal

Branch: factory/dev-backend Generated: 2026-06-13T02:22:11.172Z

Rules: Only mark **verified** with command output evidence. QA gate re-checks all claims.

1. [verified] **docker** — Service idp-platform healthy in docker compose
   - evidence: docker compose ps idp-platform
   - owner: unassigned

2. [verified] **docker** — Service db healthy in docker compose
   - evidence: docker compose ps db
   - owner: unassigned

3. [verified] **docker** — Service redis healthy in docker compose
   - evidence: docker compose ps redis
   - owner: unassigned

4. [verified] **docker** — Full stack docker compose up -d
   - evidence: docker compose up -d --build && docker compose ps
   - owner: unassigned

5. [verified] **docker** — API health endpoint via compose
   - evidence: curl -sf http://localhost:4400/api/health
   - owner: unassigned

6. [verified] **docker** — API ready endpoint returns 200
   - evidence: curl -sf http://localhost:4400/api/health/ready
   - owner: unassigned

7. [pending] **build** — Production build succeeds
   - evidence: npm run build
   - owner: unassigned

8. [pending] **lint** — Lint build passes
   - evidence: npm run lint:build
   - owner: unassigned

9. [pending] **typecheck** — Typecheck build passes
   - evidence: npm run typecheck:build
   - owner: unassigned

10. [pending] **e2e** — E2E suite lists tests

- evidence: npm run test:e2e -- --list
- owner: unassigned

11. [pending] **test** — Jest pass: backstage/packages/cli/src/tests/transforms/transforms.test.ts

- evidence: npm run test:ci -- backstage/packages/cli/src/tests/transforms/transforms.test.ts
- owner: unassigned

12. [pending] **test** — Jest pass: backstage/packages/cli/src/tests/yaml.test.ts

- evidence: npm run test:ci -- backstage/packages/cli/src/tests/yaml.test.ts
- owner: unassigned

13. [pending] **test** — Jest pass: backstage/packages/codemods/src/tests/core-imports.test.ts

- evidence: npm run test:ci -- backstage/packages/codemods/src/tests/core-imports.test.ts
- owner: unassigned

14. [pending] **test** — Jest pass: backstage/plugins/catalog-backend/src/tests/integration.test.ts

- evidence: npm run test:ci -- backstage/plugins/catalog-backend/src/tests/integration.test.ts
- owner: unassigned

15. [pending] **test** — Jest pass: backstage/plugins/catalog-backend/src/tests/migrations.test.ts

- evidence: npm run test:ci -- backstage/plugins/catalog-backend/src/tests/migrations.test.ts
- owner: unassigned

16. [pending] **test** — Jest pass:
    backstage/plugins/catalog-backend/src/tests/performance/getEntitiesPerformance.test.ts

- evidence: npm run test:ci --
  backstage/plugins/catalog-backend/src/tests/performance/getEntitiesPerformance.test.ts
- owner: unassigned

17. [pending] **test** — Jest pass:
    backstage/plugins/catalog-backend/src/tests/performance/getProcessableEntitiesPerformance.test.ts

- evidence: npm run test:ci --
  backstage/plugins/catalog-backend/src/tests/performance/getProcessableEntitiesPerformance.test.ts
- owner: unassigned

18. [pending] **test** — Jest pass:
    backstage/plugins/catalog-backend/src/tests/performance/providerDeltaMutations.test.ts

- evidence: npm run test:ci --
  backstage/plugins/catalog-backend/src/tests/performance/providerDeltaMutations.test.ts
- owner: unassigned

19. [pending] **test** — Jest pass:
    backstage/plugins/catalog-backend/src/tests/performance/stitchingPerformance.test.ts

- evidence: npm run test:ci --
  backstage/plugins/catalog-backend/src/tests/performance/stitchingPerformance.test.ts
- owner: unassigned

20. [pending] **test** — Jest pass:
    backstage/plugins/notifications-backend/src/tests/migrations.test.ts

- evidence: npm run test:ci -- backstage/plugins/notifications-backend/src/tests/migrations.test.ts
- owner: unassigned

21. [pending] **test** — Jest pass: src/**tests**/integration/api/catalog-routes.test.ts

- evidence: npm run test:ci -- src/**tests**/integration/api/catalog-routes.test.ts
- owner: unassigned

22. [pending] **test** — Jest pass: src/**tests**/integration/api-routes.test.ts

- evidence: npm run test:ci -- src/**tests**/integration/api-routes.test.ts
- owner: unassigned

23. [pending] **test** — Jest pass:
    src/**tests**/integration/websocket/websocket-connections.test.ts

- evidence: npm run test:ci -- src/**tests**/integration/websocket/websocket-connections.test.ts
- owner: unassigned

24. [pending] **test** — Jest pass: src/**tests**/security/authorization.test.ts

- evidence: npm run test:ci -- src/**tests**/security/authorization.test.ts
- owner: unassigned

25. [pending] **test** — Jest pass: src/**tests**/unit/auth/authentication.test.ts

- evidence: npm run test:ci -- src/**tests**/unit/auth/authentication.test.ts
- owner: unassigned

26. [pending] **test** — Jest pass: src/**tests**/websocket/websocket-client.test.ts

- evidence: npm run test:ci -- src/**tests**/websocket/websocket-client.test.ts
- owner: unassigned

27. [pending] **test** — Jest pass: src/**tests**/websocket-functionality.test.ts

- evidence: npm run test:ci -- src/**tests**/websocket-functionality.test.ts
- owner: unassigned

28. [verified] **test** — Jest pass: src/app/api/auth/**tests**/auth.test.ts

- evidence: npm run test:ci -- src/app/api/auth/**tests**/auth.test.ts → Test Suites: 1 passed |
  Tests: 21 passed
- owner: factory/dev-backend

29. [pending] **test** — Jest pass: src/app/api/plugins/**tests**/route.test.ts

- evidence: npm run test:ci -- src/app/api/plugins/**tests**/route.test.ts
- owner: sibling-auth

30. [pending] **test** — Jest pass: src/components/dashboard/**tests**/useWebSocket.test.ts

- evidence: npm run test:ci -- src/components/dashboard/**tests**/useWebSocket.test.ts
- owner: sibling-auth

31. [pending] **test** — Jest pass: src/components/dashboard/**tests**/websocket-simple.test.ts

- evidence: npm run test:ci -- src/components/dashboard/**tests**/websocket-simple.test.ts
- owner: sibling-auth

32. [pending] **test** — Jest pass: src/components/dashboard/**tests**/websocket.test.ts

- evidence: npm run test:ci -- src/components/dashboard/**tests**/websocket.test.ts
- owner: sibling-auth

33. [pending] **test** — Jest pass: src/components/plugins/**tests**/PluginMarketplace.test.tsx

- evidence: npm run test:ci -- src/components/plugins/**tests**/PluginMarketplace.test.tsx
- owner: sibling-auth

34. [pending] **test** — Jest pass:
    src/components/plugins/marketplace/**tests**/AdvancedPluginMarketplace.test.tsx

- evidence: npm run test:ci --
  src/components/plugins/marketplace/**tests**/AdvancedPluginMarketplace.test.tsx
- owner: sibling-auth

35. [pending] **test** — Jest pass:
    src/components/plugins/marketplace/**tests**/CompatibilityChecker.test.tsx

- evidence: npm run test:ci --
  src/components/plugins/marketplace/**tests**/CompatibilityChecker.test.tsx
- owner: sibling-auth

36. [pending] **test** — Jest pass:
    src/components/plugins/marketplace/**tests**/InstallationWizard.test.tsx

- evidence: npm run test:ci --
  src/components/plugins/marketplace/**tests**/InstallationWizard.test.tsx
- owner: sibling-auth

37. [pending] **test** — Jest pass:
    src/components/plugins/marketplace/**tests**/MarketplacePluginCard.test.tsx

- evidence: npm run test:ci --
  src/components/plugins/marketplace/**tests**/MarketplacePluginCard.test.tsx
- owner: sibling-auth

38. [pending] **test** — Jest pass:
    src/components/plugins/marketplace/**tests**/SemanticSearchEngine.test.tsx

- evidence: npm run test:ci --
  src/components/plugins/marketplace/**tests**/SemanticSearchEngine.test.tsx
- owner: sibling-auth

39. [pending] **test** — Jest pass: src/components/ui/**tests**/Skeleton.test.tsx

- evidence: npm run test:ci -- src/components/ui/**tests**/Skeleton.test.tsx
- owner: sibling-auth

40. [pending] **test** — Jest pass: src/hooks/**tests**/useRealtimePlugins.test.ts

- evidence: npm run test:ci -- src/hooks/**tests**/useRealtimePlugins.test.ts
- owner: sibling-auth

41. [pending] **test** — Jest pass: src/lib/auth/**tests**/jwt.test.ts

- evidence: npm run test:ci -- src/lib/auth/**tests**/jwt.test.ts
- owner: sibling-auth

42. [pending] **test** — Jest pass: src/lib/auth/**tests**/rbac-simple.test.ts

- evidence: npm run test:ci -- src/lib/auth/**tests**/rbac-simple.test.ts
- owner: sibling-auth

43. [pending] **test** — Jest pass: src/lib/auth/**tests**/rbac.test.ts

- evidence: npm run test:ci -- src/lib/auth/**tests**/rbac.test.ts
- owner: sibling-auth

44. [pending] **test** — Jest pass: src/lib/auth/**tests**/security-vulnerabilities.test.ts

- evidence: npm run test:ci -- src/lib/auth/**tests**/security-vulnerabilities.test.ts
- owner: unassigned

45. [pending] **test** — Jest pass: src/lib/auth/providers/**tests**/azure-ad.test.ts

- evidence: npm run test:ci -- src/lib/auth/providers/**tests**/azure-ad.test.ts
- owner: unassigned

46. [pending] **test** — Jest pass: src/lib/auth/providers/**tests**/okta.test.ts

- evidence: npm run test:ci -- src/lib/auth/providers/**tests**/okta.test.ts
- owner: unassigned

47. [pending] **test** — Jest pass: src/lib/cost/**tests**/aggregator.test.ts

- evidence: npm run test:ci -- src/lib/cost/**tests**/aggregator.test.ts
- owner: unassigned

48. [pending] **test** — Jest pass: src/lib/cost/**tests**/cost-simple.test.ts

- evidence: npm run test:ci -- src/lib/cost/**tests**/cost-simple.test.ts
- owner: unassigned

49. [pending] **test** — Jest pass: src/lib/cost/**tests**/monitor.test.ts

- evidence: npm run test:ci -- src/lib/cost/**tests**/monitor.test.ts
- owner: unassigned

50. [pending] **test** — Jest pass: src/lib/cost/providers/**tests**/aws.test.ts

- evidence: npm run test:ci -- src/lib/cost/providers/**tests**/aws.test.ts
- owner: unassigned

51. [pending] **test** — Jest pass: src/lib/cost/providers/**tests**/azure.test.ts

- evidence: npm run test:ci -- src/lib/cost/providers/**tests**/azure.test.ts
- owner: unassigned

52. [pending] **test** — Jest pass: src/lib/cost/providers/**tests**/cost-providers.test.ts

- evidence: npm run test:ci -- src/lib/cost/providers/**tests**/cost-providers.test.ts
- owner: unassigned

53. [pending] **test** — Jest pass: src/lib/cost/providers/**tests**/gcp.test.ts

- evidence: npm run test:ci -- src/lib/cost/providers/**tests**/gcp.test.ts
- owner: unassigned

54. [verified] **test** — Jest pass: src/lib/database/**tests**/parameterized-sql.test.ts

- evidence: npm run test:ci -- src/lib/database/**tests**/parameterized-sql.test.ts → PASS database
  (2 tests: $queryRaw + $executeRaw)
- owner: factory/dev-backend

55. [pending] **test** — Jest pass: src/lib/db/repositories/**tests**/ServiceRepository.test.ts

- evidence: npm run test:ci -- src/lib/db/repositories/**tests**/ServiceRepository.test.ts
- owner: unassigned

56. [pending] **test** — Jest pass: src/lib/db/repositories/**tests**/UserRepository.test.ts

- evidence: npm run test:ci -- src/lib/db/repositories/**tests**/UserRepository.test.ts
- owner: unassigned

57. [pending] **test** — Jest pass: src/lib/db/repositories/**tests**/repository-interfaces.test.ts

- evidence: npm run test:ci -- src/lib/db/repositories/**tests**/repository-interfaces.test.ts
- owner: unassigned

58. [pending] **test** — Jest pass: src/lib/dnd/**tests**/DragDropContext.test.tsx

- evidence: npm run test:ci -- src/lib/dnd/**tests**/DragDropContext.test.tsx
- owner: unassigned

59. [pending] **test** — Jest pass: src/lib/plugins/**tests**/plugin-installer.test.ts

- evidence: npm run test:ci -- src/lib/plugins/**tests**/plugin-installer.test.ts
- owner: unassigned

60. [pending] **test** — Jest pass: src/lib/websocket/**tests**/cleanup-utils.test.ts

- evidence: npm run test:ci -- src/lib/websocket/**tests**/cleanup-utils.test.ts
- owner: unassigned

61. [pending] **test** — Jest pass: src/services/**tests**/plugin-management.test.ts

- evidence: npm run test:ci -- src/services/**tests**/plugin-management.test.ts
- owner: unassigned

62. [pending] **test** — Jest pass: src/services/backstage/**tests**/auth.client.test.ts

- evidence: npm run test:ci -- src/services/backstage/**tests**/auth.client.test.ts
- owner: unassigned

63. [pending] **test** — Jest pass: src/services/backstage/**tests**/catalog.client.test.ts

- evidence: npm run test:ci -- src/services/backstage/**tests**/catalog.client.test.ts
- owner: unassigned

64. [pending] **test** — Jest pass: src/services/backstage/**tests**/scaffolder.client.test.ts

- evidence: npm run test:ci -- src/services/backstage/**tests**/scaffolder.client.test.ts
- owner: unassigned

65. [pending] **test** — Jest pass: src/services/backstage/**tests**/websocket-simple.test.ts

- evidence: npm run test:ci -- src/services/backstage/**tests**/websocket-simple.test.ts
- owner: unassigned

66. [pending] **test** — Jest pass: src/services/backstage/**tests**/websocket.test.ts

- evidence: npm run test:ci -- src/services/backstage/**tests**/websocket.test.ts
- owner: unassigned

67. [pending] **test** — Jest pass: src/services/catalog/**tests**/ingestion-orchestrator.test.ts

- evidence: npm run test:ci -- src/services/catalog/**tests**/ingestion-orchestrator.test.ts
- owner: unassigned

68. [pending] **test** — Jest pass: src/services/catalog/**tests**/quality-assessor.test.ts

- evidence: npm run test:ci -- src/services/catalog/**tests**/quality-assessor.test.ts
- owner: unassigned

69. [pending] **test** — Jest pass: src/services/catalog/**tests**/relationship-resolver.test.ts

- evidence: npm run test:ci -- src/services/catalog/**tests**/relationship-resolver.test.ts
- owner: unassigned

70. [pending] **test** — Jest pass: src/services/catalog/**tests**/stream-processor.test.ts

- evidence: npm run test:ci -- src/services/catalog/**tests**/stream-processor.test.ts
- owner: unassigned

71. [pending] **test** — Jest pass: src/services/notifications/**tests**/notification-system.test.ts

- evidence: npm run test:ci -- src/services/notifications/**tests**/notification-system.test.ts
- owner: unassigned

72. [pending] **test** — Jest pass:
    src/services/recommendations/**tests**/recommendation-engine.test.ts

- evidence: npm run test:ci -- src/services/recommendations/**tests**/recommendation-engine.test.ts
- owner: unassigned

73. [pending] **test** — Jest pass: src/services/scorecards/**tests**/real-aggregation.test.ts

- evidence: npm run test:ci -- src/services/scorecards/**tests**/real-aggregation.test.ts
- owner: unassigned

74. [pending] **test** — Jest pass: src/tests/api/plugin-billing.test.ts

- evidence: npm run test:ci -- src/tests/api/plugin-billing.test.ts
- owner: unassigned

75. [pending] **test** — Jest pass: src/tests/api/plugin-installer.test.ts

- evidence: npm run test:ci -- src/tests/api/plugin-installer.test.ts
- owner: unassigned

76. [pending] **test** — Jest pass: src/tests/api/plugin-multitenancy.test.ts

- evidence: npm run test:ci -- src/tests/api/plugin-multitenancy.test.ts
- owner: unassigned

77. [pending] **test** — Jest pass: src/tests/api/plugin-observability.test.ts

- evidence: npm run test:ci -- src/tests/api/plugin-observability.test.ts
- owner: unassigned

78. [pending] **test** — Jest pass: src/tests/api/plugin-security-scan.test.ts

- evidence: npm run test:ci -- src/tests/api/plugin-security-scan.test.ts
- owner: unassigned

79. [pending] **test** — Jest pass: tests/accessibility/wcag-compliance.spec.ts

- evidence: npm run test:ci -- tests/accessibility/wcag-compliance.spec.ts
- owner: unassigned

80. [pending] **test** — Jest pass: tests/api/production-endpoints.test.ts

- evidence: npm run test:ci -- tests/api/production-endpoints.test.ts
- owner: unassigned

81. [pending] **test** — Jest pass: tests/compatibility/backstage-version-compatibility.test.ts

- evidence: npm run test:ci -- tests/compatibility/backstage-version-compatibility.test.ts
- owner: unassigned

82. [pending] **test** — Jest pass: tests/compatibility/cross-browser-testing.spec.ts

- evidence: npm run test:ci -- tests/compatibility/cross-browser-testing.spec.ts
- owner: unassigned

83. [pending] **test** — Jest pass: tests/containers/docker-plugin-testing.test.ts

- evidence: npm run test:ci -- tests/containers/docker-plugin-testing.test.ts
- owner: unassigned

84. [pending] **test** — Jest pass: tests/containers/kubernetes-plugin-testing.test.ts

- evidence: npm run test:ci -- tests/containers/kubernetes-plugin-testing.test.ts
- owner: unassigned

85. [pending] **test** — Jest pass: tests/contracts/example-consumer.test.ts

- evidence: npm run test:ci -- tests/contracts/example-consumer.test.ts
- owner: unassigned

86. [pending] **test** — Jest pass: tests/contracts/example-provider.test.ts

- evidence: npm run test:ci -- tests/contracts/example-provider.test.ts
- owner: unassigned

87. [pending] **test** — Jest pass: tests/contracts/plugin-api-consumer.pact.test.ts

- evidence: npm run test:ci -- tests/contracts/plugin-api-consumer.pact.test.ts
- owner: unassigned

88. [pending] **test** — Jest pass: tests/contracts/plugin-api-provider.pact.test.ts

- evidence: npm run test:ci -- tests/contracts/plugin-api-provider.pact.test.ts
- owner: unassigned

89. [pending] **test** — Jest pass: tests/database/plugin-database.test.ts

- evidence: npm run test:ci -- tests/database/plugin-database.test.ts
- owner: unassigned

90. [pending] **test** — Jest pass: tests/e2e/login-flow.spec.ts

- evidence: npm run test:ci -- tests/e2e/login-flow.spec.ts
- owner: unassigned

91. [pending] **test** — Jest pass: tests/e2e/plugin-installation-workflow.spec.ts

- evidence: npm run test:ci -- tests/e2e/plugin-installation-workflow.spec.ts
- owner: unassigned

92. [pending] **test** — Jest pass: tests/e2e/plugin-management-workflow.spec.ts

- evidence: npm run test:ci -- tests/e2e/plugin-management-workflow.spec.ts
- owner: unassigned

93. [pending] **test** — Jest pass: tests/e2e/plugin-marketplace-workflow.spec.ts

- evidence: npm run test:ci -- tests/e2e/plugin-marketplace-workflow.spec.ts
- owner: unassigned

94. [pending] **test** — Jest pass: tests/e2e/service-catalog-crud.spec.ts

- evidence: npm run test:ci -- tests/e2e/service-catalog-crud.spec.ts
- owner: sibling-health

95. [pending] **test** — Jest pass: tests/failure-scenarios/network-failure-testing.spec.ts

- evidence: npm run test:ci -- tests/failure-scenarios/network-failure-testing.spec.ts
- owner: unassigned

96. [pending] **test** — Jest pass: tests/failure-scenarios/system-recovery-testing.test.ts

- evidence: npm run test:ci -- tests/failure-scenarios/system-recovery-testing.test.ts
- owner: unassigned

97. [pending] **test** — Jest pass: tests/integration/api/plugin-endpoints.test.ts

- evidence: npm run test:ci -- tests/integration/api/plugin-endpoints.test.ts
- owner: unassigned

98. [pending] **test** — Jest pass: tests/integration/plugin-configuration-integration.test.ts

- evidence: npm run test:ci -- tests/integration/plugin-configuration-integration.test.ts
- owner: unassigned

99. [pending] **test** — Jest pass: tests/integration/plugin-lifecycle-integration.test.ts

- evidence: npm run test:ci -- tests/integration/plugin-lifecycle-integration.test.ts
- owner: unassigned

100. [pending] **test** — Jest pass: tests/integration/plugin-registry-integration.test.ts

- evidence: npm run test:ci -- tests/integration/plugin-registry-integration.test.ts
- owner: unassigned

101. [pending] **test** — Jest pass: tests/integration/vault-integration.test.ts

- evidence: npm run test:ci -- tests/integration/vault-integration.test.ts
- owner: unassigned

102. [pending] **test** — Jest pass: tests/security/SecurityTestSuite.test.ts

- evidence: npm run test:ci -- tests/security/SecurityTestSuite.test.ts
- owner: unassigned

103. [pending] **test** — Jest pass: tests/security/multi-tenant-security.test.ts

- evidence: npm run test:ci -- tests/security/multi-tenant-security.test.ts
- owner: unassigned

104. [pending] **test** — Jest pass: tests/security/plugin-sandbox.test.ts

- evidence: npm run test:ci -- tests/security/plugin-sandbox.test.ts
- owner: unassigned

105. [pending] **test** — Jest pass: tests/security/plugin-security-testing.test.ts

- evidence: npm run test:ci -- tests/security/plugin-security-testing.test.ts
- owner: unassigned

106. [pending] **test** — Jest pass: tests/security/rbac-integration.test.ts

- evidence: npm run test:ci -- tests/security/rbac-integration.test.ts
- owner: unassigned

107. [pending] **test** — Jest pass: tests/security/security-integration.test.ts

- evidence: npm run test:ci -- tests/security/security-integration.test.ts
- owner: unassigned

108. [pending] **test** — Jest pass: tests/visual/component-visual-regression.spec.ts

- evidence: npm run test:ci -- tests/visual/component-visual-regression.spec.ts
- owner: unassigned

109. [pending] **test** — Jest pass: tests/visual/cross-browser-visual.spec.ts

- evidence: npm run test:ci -- tests/visual/cross-browser-visual.spec.ts
- owner: unassigned

110. [pending] **test** — Jest pass: tests/visual/dashboard-snapshots.spec.ts

- evidence: npm run test:ci -- tests/visual/dashboard-snapshots.spec.ts
- owner: unassigned

111. [pending] **test** — Jest pass: tests/visual/plugin-marketplace-visual.spec.ts

- evidence: npm run test:ci -- tests/visual/plugin-marketplace-visual.spec.ts
- owner: unassigned

112. [pending] **page** — Page renders /activity

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/activity
- owner: unassigned

113. [pending] **page** — Page renders /admin/config

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/admin/config
- owner: unassigned

114. [pending] **page** — Page renders /admin/integrations

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/admin/integrations
- owner: unassigned

115. [pending] **page** — Page renders /admin/maintenance

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/admin/maintenance
- owner: unassigned

116. [pending] **page** — Page renders /admin/monitoring

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/admin/monitoring
- owner: unassigned

117. [pending] **page** — Page renders /admin

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/admin
- owner: unassigned

118. [pending] **page** — Page renders /admin/plugins/installer

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/admin/plugins/installer
- owner: unassigned

119. [pending] **page** — Page renders /admin/plugins

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/admin/plugins
- owner: unassigned

120. [pending] **page** — Page renders /admin/sync

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/admin/sync
- owner: sibling-health

121. [pending] **page** — Page renders /admin/templates

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/admin/templates
- owner: unassigned

122. [pending] **page** — Page renders /admin/users

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/admin/users
- owner: unassigned

123. [pending] **page** — Page renders /admin/version

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/admin/version
- owner: unassigned

124. [pending] **page** — Page renders /analytics

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/analytics
- owner: unassigned

125. [pending] **page** — Page renders /analytics/revenue

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/analytics/revenue
- owner: unassigned

126. [pending] **page** — Page renders /api-docs

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/api-docs
- owner: unassigned

127. [pending] **page** — Page renders /auth/error

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/auth/error
- owner: unassigned

128. [pending] **page** — Page renders /auth/success

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/auth/success
- owner: unassigned

129. [pending] **page** — Page renders /billing

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/billing
- owner: unassigned

130. [pending] **page** — Page renders /catalog/:kind/:namespace/:name/edit

- evidence: curl -sf -o /dev/null -w '%{http_code}'
  http://localhost:4400/catalog/:kind/:namespace/:name/edit
- owner: unassigned

131. [pending] **page** — Page renders /catalog/:kind/create

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/catalog/:kind/create
- owner: unassigned

132. [pending] **page** — Page renders /catalog/advanced

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/catalog/advanced
- owner: unassigned

133. [pending] **page** — Page renders /catalog/bulk

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/catalog/bulk
- owner: sibling-ops

134. [pending] **page** — Page renders /catalog/compare

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/catalog/compare
- owner: unassigned

135. [pending] **page** — Page renders /catalog/create

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/catalog/create
- owner: unassigned

136. [pending] **page** — Page renders /catalog/dependencies

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/catalog/dependencies
- owner: unassigned

137. [pending] **page** — Page renders /catalog/enhanced

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/catalog/enhanced
- owner: unassigned

138. [pending] **page** — Page renders /catalog/import

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/catalog/import
- owner: unassigned

139. [pending] **page** — Page renders /catalog

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/catalog
- owner: unassigned

140. [pending] **page** — Page renders /catalog/relationships

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/catalog/relationships
- owner: unassigned

141. [pending] **page** — Page renders /catalog-v2

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/catalog-v2
- owner: unassigned

142. [pending] **page** — Page renders /ci-cd

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/ci-cd
- owner: unassigned

143. [pending] **page** — Page renders /cost

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/cost
- owner: unassigned

144. [pending] **page** — Page renders /cost-insights

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/cost-insights
- owner: unassigned

145. [pending] **page** — Page renders /create/:templateId

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/create/:templateId
- owner: unassigned

146. [pending] **page** — Page renders /create/duplicate

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/create/duplicate
- owner: unassigned

147. [pending] **page** — Page renders /create/job/:jobId

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/create/job/:jobId
- owner: unassigned

148. [pending] **page** — Page renders /create

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/create
- owner: unassigned

149. [pending] **page** — Page renders /dashboard/builder

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/dashboard/builder
- owner: unassigned

150. [pending] **page** — Page renders /dashboard/enhanced

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/dashboard/enhanced
- owner: sibling-health

151. [pending] **page** — Page renders /dashboard

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/dashboard
- owner: sibling-health

152. [pending] **page** — Page renders /deployments

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/deployments
- owner: sibling-health

153. [pending] **page** — Page renders /developer/submit

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/developer/submit
- owner: sibling-health

154. [pending] **page** — Page renders /docs

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/docs
- owner: unassigned

155. [pending] **page** — Page renders /enterprise

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/enterprise
- owner: unassigned

156. [pending] **page** — Page renders /feature-flags

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/feature-flags
- owner: unassigned

157. [pending] **page** — Page renders /feedback

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/feedback
- owner: unassigned

158. [pending] **page** — Page renders /form-builder

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/form-builder
- owner: unassigned

159. [pending] **page** — Page renders /github

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/github
- owner: unassigned

160. [pending] **page** — Page renders /health

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/health
- owner: unassigned

161. [pending] **page** — Page renders /incidents

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/incidents
- owner: unassigned

162. [pending] **page** — Page renders /insights

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/insights
- owner: unassigned

163. [pending] **page** — Page renders /integrations/config

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/integrations/config
- owner: unassigned

164. [pending] **page** — Page renders /knowledge-base

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/knowledge-base
- owner: unassigned

165. [pending] **page** — Page renders /kubernetes

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/kubernetes
- owner: unassigned

166. [pending] **page** — Page renders /kubernetes-v2

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/kubernetes-v2
- owner: unassigned

167. [pending] **page** — Page renders /login/enterprise

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/login/enterprise
- owner: unassigned

168. [pending] **page** — Page renders /login

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/login
- owner: unassigned

169. [pending] **page** — Page renders /marketplace

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/marketplace
- owner: unassigned

170. [pending] **page** — Page renders /monitoring

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/monitoring
- owner: unassigned

171. [pending] **page** — Page renders /notifications

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/notifications
- owner: unassigned

172. [pending] **page** — Page renders /notifications/settings

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/notifications/settings
- owner: unassigned

173. [pending] **page** — Page renders /onboarding

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/onboarding
- owner: unassigned

174. [pending] **page** — Page renders /onboarding/welcome

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/onboarding/welcome
- owner: unassigned

175. [pending] **page** — Page renders /page.tsx

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/page.tsx
- owner: unassigned

176. [pending] **page** — Page renders /partner

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/partner
- owner: unassigned

177. [pending] **page** — Page renders /plugin-management

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/plugin-management
- owner: unassigned

178. [pending] **page** — Page renders /plugins/approval

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/plugins/approval
- owner: unassigned

179. [pending] **page** — Page renders /plugins/comprehensive

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/plugins/comprehensive
- owner: unassigned

180. [pending] **page** — Page renders /plugins/dependency-resolver

- evidence: curl -sf -o /dev/null -w '%{http_code}'
  http://localhost:4400/plugins/dependency-resolver
- owner: unassigned

181. [pending] **page** — Page renders /plugins/discovery

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/plugins/discovery
- owner: unassigned

182. [pending] **page** — Page renders /plugins/marketplace

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/plugins/marketplace
- owner: unassigned

183. [pending] **page** — Page renders /plugins

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/plugins
- owner: unassigned

184. [pending] **page** — Page renders /rbac

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/rbac
- owner: unassigned

185. [pending] **page** — Page renders /scaffolder

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/scaffolder
- owner: unassigned

186. [pending] **page** — Page renders /search

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/search
- owner: unassigned

187. [pending] **page** — Page renders /settings

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/settings
- owner: unassigned

188. [pending] **page** — Page renders /setup

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/setup
- owner: unassigned

189. [pending] **page** — Page renders /signup

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/signup
- owner: unassigned

190. [pending] **page** — Page renders /skill-exchange

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/skill-exchange
- owner: unassigned

191. [pending] **page** — Page renders /support

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/support
- owner: unassigned

192. [pending] **page** — Page renders /teams

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/teams
- owner: unassigned

193. [pending] **page** — Page renders /techdocs

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/techdocs
- owner: unassigned

194. [pending] **page** — Page renders /techradar

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/techradar
- owner: unassigned

195. [pending] **page** — Page renders /templates/:namespace/:name/use

- evidence: curl -sf -o /dev/null -w '%{http_code}'
  http://localhost:4400/templates/:namespace/:name/use
- owner: unassigned

196. [pending] **page** — Page renders /templates/builder

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/templates/builder
- owner: unassigned

197. [pending] **page** — Page renders /templates/create/bulk

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/templates/create/bulk
- owner: unassigned

198. [pending] **page** — Page renders /templates/create

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/templates/create
- owner: unassigned

199. [pending] **page** — Page renders /templates/execute

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/templates/execute
- owner: unassigned

200. [pending] **page** — Page renders /templates/marketplace

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/templates/marketplace
- owner: unassigned

201. [pending] **page** — Page renders /templates

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/templates
- owner: unassigned

202. [pending] **page** — Page renders /test

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/test
- owner: unassigned

203. [pending] **page** — Page renders /white-label

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/white-label
- owner: sibling-health

204. [pending] **page** — Page renders /workflows

- evidence: curl -sf -o /dev/null -w '%{http_code}' http://localhost:4400/workflows
- owner: unassigned

205. [pending] **api** — Smoke GET/POST /api/actions/:actionId/execute

- evidence: curl -sf http://localhost:4400/api/actions/test/execute || manual
- owner: unassigned

206. [pending] **api** — Smoke GET/POST /api/actions/:actionId

- evidence: curl -sf http://localhost:4400/api/actions/test || manual
- owner: unassigned

207. [pending] **api** — Smoke GET/POST /api/actions/approvals/:approvalId

- evidence: curl -sf http://localhost:4400/api/actions/approvals/test || manual
- owner: sibling-health

208. [pending] **api** — Smoke GET/POST /api/actions/approvals

- evidence: curl -sf http://localhost:4400/api/actions/approvals || manual
- owner: unassigned

209. [pending] **api** — Smoke GET/POST /api/actions/executions/:executionId

- evidence: curl -sf http://localhost:4400/api/actions/executions/test || manual
- owner: unassigned

210. [pending] **api** — Smoke GET/POST /api/actions/executions

- evidence: curl -sf http://localhost:4400/api/actions/executions || manual
- owner: unassigned

211. [pending] **api** — Smoke GET/POST /api/actions

- evidence: curl -sf http://localhost:4400/api/actions || manual
- owner: sibling-health

212. [pending] **api** — Smoke GET/POST /api/admin/installs

- evidence: curl -sf http://localhost:4400/api/admin/installs || manual
- owner: unassigned

213. [pending] **api** — Smoke GET/POST /api/admin/performance

- evidence: curl -sf http://localhost:4400/api/admin/performance || manual
- owner: unassigned

214. [pending] **api** — Smoke GET/POST /api/admin/plugins/:id/action

- evidence: curl -sf http://localhost:4400/api/admin/plugins/test/action || manual
- owner: unassigned

215. [pending] **api** — Smoke GET/POST /api/admin/plugins

- evidence: curl -sf http://localhost:4400/api/admin/plugins || manual
- owner: unassigned

216. [pending] **api** — Smoke GET/POST /api/admin/revenue

- evidence: curl -sf http://localhost:4400/api/admin/revenue || manual
- owner: unassigned

217. [pending] **api** — Smoke GET/POST /api/admin/stats

- evidence: curl -sf http://localhost:4400/api/admin/stats || manual
- owner: unassigned

218. [pending] **api** — Smoke GET/POST /api/admin/users/:userId

- evidence: curl -sf http://localhost:4400/api/admin/users/test || manual
- owner: unassigned

219. [pending] **api** — Smoke GET/POST /api/admin/users/metrics

- evidence: curl -sf http://localhost:4400/api/admin/users/metrics || manual
- owner: unassigned

220. [pending] **api** — Smoke GET/POST /api/admin/users

- evidence: curl -sf http://localhost:4400/api/admin/users || manual
- owner: unassigned

221. [pending] **api** — Smoke GET/POST /api/ai-assistant

- evidence: curl -sf http://localhost:4400/api/ai-assistant || manual
- owner: unassigned

222. [pending] **api** — Smoke GET/POST /api/alerts

- evidence: curl -sf http://localhost:4400/api/alerts || manual
- owner: unassigned

223. [pending] **api** — Smoke GET/POST /api/analytics/dora

- evidence: curl -sf http://localhost:4400/api/analytics/dora || manual
- owner: unassigned

224. [pending] **api** — Smoke GET/POST /api/analytics/dora/services/:serviceId

- evidence: curl -sf http://localhost:4400/api/analytics/dora/services/test || manual
- owner: unassigned

225. [pending] **api** — Smoke GET/POST /api/analytics/dora/teams/:teamId

- evidence: curl -sf http://localhost:4400/api/analytics/dora/teams/test || manual
- owner: unassigned

226. [pending] **api** — Smoke GET/POST /api/analytics/enhanced

- evidence: curl -sf http://localhost:4400/api/analytics/enhanced || manual
- owner: unassigned

227. [pending] **api** — Smoke GET/POST /api/analytics/revenue/metrics

- evidence: curl -sf http://localhost:4400/api/analytics/revenue/metrics || manual
- owner: unassigned

228. [pending] **api** — Smoke GET/POST /api/audit-logging

- evidence: curl -sf http://localhost:4400/api/audit-logging || manual
- owner: unassigned

229. [pending] **api** — Smoke GET/POST /api/audit-logs/compliance

- evidence: curl -sf http://localhost:4400/api/audit-logs/compliance || manual
- owner: unassigned

230. [pending] **api** — Smoke GET/POST /api/audit-logs/export

- evidence: curl -sf http://localhost:4400/api/audit-logs/export || manual
- owner: unassigned

231. [pending] **api** — Smoke GET/POST /api/audit-logs

- evidence: curl -sf http://localhost:4400/api/audit-logs || manual
- owner: unassigned

232. [pending] **api** — Smoke GET/POST /api/audit-logs/stats

- evidence: curl -sf http://localhost:4400/api/audit-logs/stats || manual
- owner: unassigned

233. [pending] **api** — Smoke GET/POST /api/auth/backstage/callback

- evidence: curl -sf http://localhost:4400/api/auth/backstage/callback || manual
- owner: unassigned

234. [pending] **api** — Smoke GET/POST /api/auth/backstage/login

- evidence: curl -sf http://localhost:4400/api/auth/backstage/login || manual
- owner: sibling-health

235. [pending] **api** — Smoke GET/POST /api/auth/enterprise

- evidence: curl -sf http://localhost:4400/api/auth/enterprise || manual
- owner: unassigned

236. [pending] **api** — Smoke GET/POST /api/auth/github/callback

- evidence: curl -sf http://localhost:4400/api/auth/github/callback || manual
- owner: unassigned

237. [pending] **api** — Smoke GET/POST /api/auth/github

- evidence: curl -sf http://localhost:4400/api/auth/github || manual
- owner: unassigned

238. [pending] **api** — Smoke GET/POST /api/auth/google/callback

- evidence: curl -sf http://localhost:4400/api/auth/google/callback || manual
- owner: unassigned

239. [pending] **api** — Smoke GET/POST /api/auth/google

- evidence: curl -sf http://localhost:4400/api/auth/google || manual
- owner: unassigned

240. [verified] **api** — Smoke GET/POST /api/auth/login

- evidence: npm run test:ci -- src/app/api/auth/**tests**/auth.test.ts → PASS unit (21 tests, POST
  /api/auth/login suite)
- owner: factory/dev-backend

241. [pending] **api** — Smoke GET/POST /api/auth/logout

- evidence: curl -sf http://localhost:4400/api/auth/logout || manual
- owner: unassigned

242. [pending] **api** — Smoke GET/POST /api/auth/me

- evidence: curl -sf http://localhost:4400/api/auth/me || manual
- owner: unassigned

243. [pending] **api** — Smoke GET/POST /api/auth/org/:slug

- evidence: curl -sf http://localhost:4400/api/auth/org/test || manual
- owner: unassigned

244. [pending] **api** — Smoke GET/POST /api/auth/orgs

- evidence: curl -sf http://localhost:4400/api/auth/orgs || manual
- owner: unassigned

245. [pending] **api** — Smoke GET/POST /api/auth/refresh

- evidence: curl -sf http://localhost:4400/api/auth/refresh || manual
- owner: unassigned

246. [pending] **api** — Smoke GET/POST /api/auth/register

- evidence: curl -sf http://localhost:4400/api/auth/register || manual
- owner: unassigned

247. [pending] **api** — Smoke GET/POST /api/auth/secure-login

- evidence: curl -sf http://localhost:4400/api/auth/secure-login || manual
- owner: unassigned

248. [pending] **api** — Smoke GET/POST /api/automation

- evidence: curl -sf http://localhost:4400/api/automation || manual
- owner: unassigned

249. [pending] **api** — Smoke GET/POST /api/autonomous

- evidence: curl -sf http://localhost:4400/api/autonomous || manual
- owner: unassigned

250. [pending] **api** — Smoke GET/POST /api/backstage/:...path

- evidence: curl -sf http://localhost:4400/api/backstage/test || manual
- owner: unassigned

251. [pending] **api** — Smoke GET/POST /api/backstage/catalog/entities

- evidence: curl -sf http://localhost:4400/api/backstage/catalog/entities || manual
- owner: unassigned

252. [pending] **api** — Smoke GET/POST /api/backstage/entities

- evidence: curl -sf http://localhost:4400/api/backstage/entities || manual
- owner: sibling-health

253. [pending] **api** — Smoke GET/POST /api/backstage/integration

- evidence: curl -sf http://localhost:4400/api/backstage/integration || manual
- owner: unassigned

254. [pending] **api** — Smoke GET/POST /api/backstage/plugins/:pluginId/disable

- evidence: curl -sf http://localhost:4400/api/backstage/plugins/test/disable || manual
- owner: unassigned

255. [pending] **api** — Smoke GET/POST /api/backstage/plugins/:pluginId/enable

- evidence: curl -sf http://localhost:4400/api/backstage/plugins/test/enable || manual
- owner: unassigned

256. [pending] **api** — Smoke GET/POST /api/backstage/plugins/configure

- evidence: curl -sf http://localhost:4400/api/backstage/plugins/configure || manual
- owner: unassigned

257. [pending] **api** — Smoke GET/POST /api/backstage/scaffolder/tasks/:taskId

- evidence: curl -sf http://localhost:4400/api/backstage/scaffolder/tasks/test || manual
- owner: unassigned

258. [pending] **api** — Smoke GET/POST /api/backstage/scaffolder/tasks

- evidence: curl -sf http://localhost:4400/api/backstage/scaffolder/tasks || manual
- owner: unassigned

259. [pending] **api** — Smoke GET/POST /api/backstage/scaffolder/templates/:templateRef

- evidence: curl -sf http://localhost:4400/api/backstage/scaffolder/templates/test || manual
- owner: unassigned

260. [pending] **api** — Smoke GET/POST /api/backstage/scaffolder/templates

- evidence: curl -sf http://localhost:4400/api/backstage/scaffolder/templates || manual
- owner: unassigned

261. [pending] **api** — Smoke GET/POST /api/backstage/scaffolder/v2/templates

- evidence: curl -sf http://localhost:4400/api/backstage/scaffolder/v2/templates || manual
- owner: unassigned

262. [pending] **api** — Smoke GET/POST /api/backstage/templates

- evidence: curl -sf http://localhost:4400/api/backstage/templates || manual
- owner: unassigned

263. [pending] **api** — Smoke GET/POST /api/backstage/version

- evidence: curl -sf http://localhost:4400/api/backstage/version || manual
- owner: unassigned

264. [pending] **api** — Smoke GET/POST /api/backstage-generator

- evidence: curl -sf http://localhost:4400/api/backstage-generator || manual
- owner: unassigned

265. [pending] **api** — Smoke GET/POST /api/backstage-plugins

- evidence: curl -sf http://localhost:4400/api/backstage-plugins || manual
- owner: unassigned

266. [pending] **api** — Smoke GET/POST /api/backstage-plugins-real

- evidence: curl -sf http://localhost:4400/api/backstage-plugins-real || manual
- owner: unassigned

267. [pending] **api** — Smoke GET/POST /api/billing/alerts

- evidence: curl -sf http://localhost:4400/api/billing/alerts || manual
- owner: unassigned

268. [pending] **api** — Smoke GET/POST /api/billing/invoices

- evidence: curl -sf http://localhost:4400/api/billing/invoices || manual
- owner: unassigned

269. [pending] **api** — Smoke GET/POST /api/billing/portal

- evidence: curl -sf http://localhost:4400/api/billing/portal || manual
- owner: unassigned

270. [pending] **api** — Smoke GET/POST /api/billing/subscription

- evidence: curl -sf http://localhost:4400/api/billing/subscription || manual
- owner: unassigned

271. [pending] **api** — Smoke GET/POST /api/billing/usage

- evidence: curl -sf http://localhost:4400/api/billing/usage || manual
- owner: unassigned

272. [pending] **api** — Smoke GET/POST /api/billing/webhooks/stripe

- evidence: curl -sf http://localhost:4400/api/billing/webhooks/stripe || manual
- owner: unassigned

273. [pending] **api** — Smoke GET/POST /api/builder/export

- evidence: curl -sf http://localhost:4400/api/builder/export || manual
- owner: unassigned

274. [pending] **api** — Smoke GET/POST /api/builder/import

- evidence: curl -sf http://localhost:4400/api/builder/import || manual
- owner: unassigned

275. [pending] **api** — Smoke GET/POST /api/builder/pages/:pageId

- evidence: curl -sf http://localhost:4400/api/builder/pages/test || manual
- owner: unassigned

276. [pending] **api** — Smoke GET/POST /api/builder/pages/:pageId/versions

- evidence: curl -sf http://localhost:4400/api/builder/pages/test/versions || manual
- owner: unassigned

277. [pending] **api** — Smoke GET/POST /api/builder/pages

- evidence: curl -sf http://localhost:4400/api/builder/pages || manual
- owner: unassigned

278. [pending] **api** — Smoke GET/POST /api/builder/templates

- evidence: curl -sf http://localhost:4400/api/builder/templates || manual
- owner: unassigned

279. [pending] **api** — Smoke GET/POST /api/builder/widgets

- evidence: curl -sf http://localhost:4400/api/builder/widgets || manual
- owner: unassigned

280. [pending] **api** — Smoke GET/POST /api/cached/backstage/catalog

- evidence: curl -sf http://localhost:4400/api/cached/backstage/catalog || manual
- owner: unassigned

281. [pending] **api** — Smoke GET/POST /api/cached/backstage/templates

- evidence: curl -sf http://localhost:4400/api/cached/backstage/templates || manual
- owner: unassigned

282. [pending] **api** — Smoke GET/POST /api/catalog/compliance/rules

- evidence: curl -sf http://localhost:4400/api/catalog/compliance/rules || manual
- owner: unassigned

283. [pending] **api** — Smoke GET/POST /api/catalog/compliance/scan

- evidence: curl -sf http://localhost:4400/api/catalog/compliance/scan || manual
- owner: unassigned

284. [pending] **api** — Smoke GET/POST /api/catalog/discovery/config

- evidence: curl -sf http://localhost:4400/api/catalog/discovery/config || manual
- owner: unassigned

285. [pending] **api** — Smoke GET/POST /api/catalog/discovery/github/import

- evidence: curl -sf http://localhost:4400/api/catalog/discovery/github/import || manual
- owner: unassigned

286. [pending] **api** — Smoke GET/POST /api/catalog/discovery/github/scan

- evidence: curl -sf http://localhost:4400/api/catalog/discovery/github/scan || manual
- owner: unassigned

287. [pending] **api** — Smoke GET/POST /api/catalog/discovery/github/scheduler/actions

- evidence: curl -sf http://localhost:4400/api/catalog/discovery/github/scheduler/actions || manual
- owner: unassigned

288. [pending] **api** — Smoke GET/POST /api/catalog/discovery/github/scheduler

- evidence: curl -sf http://localhost:4400/api/catalog/discovery/github/scheduler || manual
- owner: unassigned

289. [pending] **api** — Smoke GET/POST /api/catalog/discovery/run

- evidence: curl -sf http://localhost:4400/api/catalog/discovery/run || manual
- owner: unassigned

290. [pending] **api** — Smoke GET/POST /api/catalog/entities/:uid

- evidence: curl -sf http://localhost:4400/api/catalog/entities/test || manual
- owner: unassigned

291. [pending] **api** — Smoke GET/POST /api/catalog/entities/by-name/:kind/:namespace/:name/metrics

- evidence: curl -sf http://localhost:4400/api/catalog/entities/by-name/test/test/test/metrics ||
  manual
- owner: unassigned

292. [pending] **api** — Smoke GET/POST
     /api/catalog/entities/by-name/:kind/:namespace/:name/relations

- evidence: curl -sf http://localhost:4400/api/catalog/entities/by-name/test/test/test/relations ||
  manual
- owner: unassigned

293. [pending] **api** — Smoke GET/POST /api/catalog/entities/by-name/:kind/:namespace/:name

- evidence: curl -sf http://localhost:4400/api/catalog/entities/by-name/test/test/test || manual
- owner: unassigned

294. [pending] **api** — Smoke GET/POST /api/catalog/entities/graph

- evidence: curl -sf http://localhost:4400/api/catalog/entities/graph || manual
- owner: unassigned

295. [pending] **api** — Smoke GET/POST /api/catalog/entities

- evidence: curl -sf http://localhost:4400/api/catalog/entities || manual
- owner: unassigned

296. [pending] **api** — Smoke GET/POST /api/catalog/export

- evidence: curl -sf http://localhost:4400/api/catalog/export || manual
- owner: unassigned

297. [pending] **api** — Smoke GET/POST /api/catalog/github/scan

- evidence: curl -sf http://localhost:4400/api/catalog/github/scan || manual
- owner: unassigned

298. [pending] **api** — Smoke GET/POST /api/catalog/health

- evidence: curl -sf http://localhost:4400/api/catalog/health || manual
- owner: sibling-health

299. [pending] **api** — Smoke GET/POST /api/catalog/import

- evidence: curl -sf http://localhost:4400/api/catalog/import || manual
- owner: unassigned

300. [pending] **api** — Smoke GET/POST /api/catalog/import-export

- evidence: curl -sf http://localhost:4400/api/catalog/import-export || manual
- owner: unassigned

301. [pending] **api** — Smoke GET/POST /api/catalog/import-url

- evidence: curl -sf http://localhost:4400/api/catalog/import-url || manual
- owner: unassigned

302. [pending] **api** — Smoke GET/POST /api/catalog/metadata/schemas/:id/export

- evidence: curl -sf http://localhost:4400/api/catalog/metadata/schemas/test/export || manual
- owner: unassigned

303. [pending] **api** — Smoke GET/POST /api/catalog/metadata/schemas/:id/fields

- evidence: curl -sf http://localhost:4400/api/catalog/metadata/schemas/test/fields || manual
- owner: unassigned

304. [pending] **api** — Smoke GET/POST /api/catalog/metadata/schemas/import

- evidence: curl -sf http://localhost:4400/api/catalog/metadata/schemas/import || manual
- owner: unassigned

305. [pending] **api** — Smoke GET/POST /api/catalog/metadata/schemas

- evidence: curl -sf http://localhost:4400/api/catalog/metadata/schemas || manual
- owner: unassigned

306. [pending] **api** — Smoke GET/POST /api/catalog/metadata/update

- evidence: curl -sf http://localhost:4400/api/catalog/metadata/update || manual
- owner: unassigned

307. [pending] **api** — Smoke GET/POST /api/catalog/organization

- evidence: curl -sf http://localhost:4400/api/catalog/organization || manual
- owner: unassigned

308. [pending] **api** — Smoke GET/POST /api/catalog/organization/save

- evidence: curl -sf http://localhost:4400/api/catalog/organization/save || manual
- owner: unassigned

309. [pending] **api** — Smoke GET/POST /api/catalog/providers/status

- evidence: curl -sf http://localhost:4400/api/catalog/providers/status || manual
- owner: unassigned

310. [pending] **api** — Smoke GET/POST /api/catalog/providers/toggle

- evidence: curl -sf http://localhost:4400/api/catalog/providers/toggle || manual
- owner: unassigned

311. [pending] **api** — Smoke GET/POST /api/catalog/relationships/confirm

- evidence: curl -sf http://localhost:4400/api/catalog/relationships/confirm || manual
- owner: unassigned

312. [pending] **api** — Smoke GET/POST /api/catalog/relationships/discover

- evidence: curl -sf http://localhost:4400/api/catalog/relationships/discover || manual
- owner: unassigned

313. [pending] **api** — Smoke GET/POST /api/catalog/relationships

- evidence: curl -sf http://localhost:4400/api/catalog/relationships || manual
- owner: unassigned

314. [pending] **api** — Smoke GET/POST /api/catalog/search

- evidence: curl -sf http://localhost:4400/api/catalog/search || manual
- owner: unassigned

315. [pending] **api** — Smoke GET/POST /api/catalog/search/semantic

- evidence: curl -sf http://localhost:4400/api/catalog/search/semantic || manual
- owner: unassigned

316. [pending] **api** — Smoke GET/POST /api/catalog/search/semantic/suggestions

- evidence: curl -sf http://localhost:4400/api/catalog/search/semantic/suggestions || manual
- owner: unassigned

317. [pending] **api** — Smoke GET/POST /api/catalog/services

- evidence: curl -sf http://localhost:4400/api/catalog/services || manual
- owner: unassigned

318. [pending] **api** — Smoke GET/POST /api/catalog/smart-categorization

- evidence: curl -sf http://localhost:4400/api/catalog/smart-categorization || manual
- owner: unassigned

319. [pending] **api** — Smoke GET/POST /api/catalog/stats

- evidence: curl -sf http://localhost:4400/api/catalog/stats || manual
- owner: unassigned

320. [pending] **api** — Smoke GET/POST /api/catalog/validate-url

- evidence: curl -sf http://localhost:4400/api/catalog/validate-url || manual
- owner: unassigned

321. [pending] **api** — Smoke GET/POST /api/catalog-graph/analysis

- evidence: curl -sf http://localhost:4400/api/catalog-graph/analysis || manual
- owner: unassigned

322. [pending] **api** — Smoke GET/POST /api/catalog-graph/export

- evidence: curl -sf http://localhost:4400/api/catalog-graph/export || manual
- owner: unassigned

323. [pending] **api** — Smoke GET/POST /api/catalog-graph/graph

- evidence: curl -sf http://localhost:4400/api/catalog-graph/graph || manual
- owner: unassigned

324. [pending] **api** — Smoke GET/POST /api/catalog-graph/health

- evidence: curl -sf http://localhost:4400/api/catalog-graph/health || manual
- owner: unassigned

325. [pending] **api** — Smoke GET/POST /api/catalog-v2

- evidence: curl -sf http://localhost:4400/api/catalog-v2 || manual
- owner: unassigned

326. [pending] **api** — Smoke GET/POST /api/config/visual/deploy

- evidence: curl -sf http://localhost:4400/api/config/visual/deploy || manual
- owner: unassigned

327. [pending] **api** — Smoke GET/POST /api/config/visual

- evidence: curl -sf http://localhost:4400/api/config/visual || manual
- owner: unassigned

328. [pending] **api** — Smoke GET/POST /api/cost-analytics

- evidence: curl -sf http://localhost:4400/api/cost-analytics || manual
- owner: unassigned

329. [pending] **api** — Smoke GET/POST /api/costs/alerts

- evidence: curl -sf http://localhost:4400/api/costs/alerts || manual
- owner: unassigned

330. [pending] **api** — Smoke GET/POST /api/costs/budgets

- evidence: curl -sf http://localhost:4400/api/costs/budgets || manual
- owner: unassigned

331. [pending] **api** — Smoke GET/POST /api/costs

- evidence: curl -sf http://localhost:4400/api/costs || manual
- owner: unassigned

332. [pending] **api** — Smoke GET/POST /api/dashboard

- evidence: curl -sf http://localhost:4400/api/dashboard || manual
- owner: unassigned

333. [pending] **api** — Smoke GET/POST /api/dashboard/widget

- evidence: curl -sf http://localhost:4400/api/dashboard/widget || manual
- owner: unassigned

334. [pending] **api** — Smoke GET/POST /api/database/dashboard

- evidence: curl -sf http://localhost:4400/api/database/dashboard || manual
- owner: unassigned

335. [pending] **api** — Smoke GET/POST /api/debug/env

- evidence: curl -sf http://localhost:4400/api/debug/env || manual
- owner: unassigned

336. [pending] **api** — Smoke GET/POST /api/discovery

- evidence: curl -sf http://localhost:4400/api/discovery || manual
- owner: unassigned

337. [pending] **api** — Smoke GET/POST /api/docker-compose

- evidence: curl -sf http://localhost:4400/api/docker-compose || manual
- owner: unassigned

338. [pending] **api** — Smoke GET/POST /api/docs/extract

- evidence: curl -sf http://localhost:4400/api/docs/extract || manual
- owner: unassigned

339. [pending] **api** — Smoke GET/POST /api/docs/generate

- evidence: curl -sf http://localhost:4400/api/docs/generate || manual
- owner: unassigned

340. [pending] **api** — Smoke GET/POST /api/enterprise/metrics

- evidence: curl -sf http://localhost:4400/api/enterprise/metrics || manual
- owner: unassigned

341. [pending] **api** — Smoke GET/POST /api/events

- evidence: curl -sf http://localhost:4400/api/events || manual
- owner: unassigned

342. [pending] **api** — Smoke GET/POST /api/feature-flags/:flagKey/evaluate

- evidence: curl -sf http://localhost:4400/api/feature-flags/test/evaluate || manual
- owner: unassigned

343. [pending] **api** — Smoke GET/POST /api/feature-flags/:flagKey

- evidence: curl -sf http://localhost:4400/api/feature-flags/test || manual
- owner: unassigned

344. [pending] **api** — Smoke GET/POST /api/feature-flags/evaluate/bulk

- evidence: curl -sf http://localhost:4400/api/feature-flags/evaluate/bulk || manual
- owner: unassigned

345. [pending] **api** — Smoke GET/POST /api/feature-flags/metrics

- evidence: curl -sf http://localhost:4400/api/feature-flags/metrics || manual
- owner: unassigned

346. [pending] **api** — Smoke GET/POST /api/feature-flags

- evidence: curl -sf http://localhost:4400/api/feature-flags || manual
- owner: unassigned

347. [pending] **api** — Smoke GET/POST /api/feedback/:id/comments

- evidence: curl -sf http://localhost:4400/api/feedback/test/comments || manual
- owner: unassigned

348. [pending] **api** — Smoke GET/POST /api/feedback/:id/vote

- evidence: curl -sf http://localhost:4400/api/feedback/test/vote || manual
- owner: unassigned

349. [pending] **api** — Smoke GET/POST /api/feedback/analytics

- evidence: curl -sf http://localhost:4400/api/feedback/analytics || manual
- owner: unassigned

350. [pending] **api** — Smoke GET/POST /api/feedback/roadmap

- evidence: curl -sf http://localhost:4400/api/feedback/roadmap || manual
- owner: unassigned

351. [pending] **api** — Smoke GET/POST /api/feedback

- evidence: curl -sf http://localhost:4400/api/feedback || manual
- owner: unassigned

352. [pending] **api** — Smoke GET/POST /api/global-edge

- evidence: curl -sf http://localhost:4400/api/global-edge || manual
- owner: unassigned

353. [pending] **api** — Smoke GET/POST /api/graphql

- evidence: curl -sf http://localhost:4400/api/graphql || manual
- owner: unassigned

354. [pending] **api** — Smoke GET/POST /api/health/database

- evidence: curl -sf http://localhost:4400/api/health/database || manual
- owner: unassigned

355. [pending] **api** — Smoke GET/POST /api/health/live

- evidence: curl -sf http://localhost:4400/api/health/live || manual
- owner: unassigned

356. [pending] **api** — Smoke GET/POST /api/health/ready

- evidence: curl -sf http://localhost:4400/api/health/ready || manual
- owner: unassigned

357. [pending] **api** — Smoke GET/POST /api/health

- evidence: curl -sf http://localhost:4400/api/health || manual
- owner: unassigned

358. [pending] **api** — Smoke GET/POST /api/incidents/:id/acknowledge

- evidence: curl -sf http://localhost:4400/api/incidents/test/acknowledge || manual
- owner: unassigned

359. [pending] **api** — Smoke GET/POST /api/incidents/:id/escalate

- evidence: curl -sf http://localhost:4400/api/incidents/test/escalate || manual
- owner: unassigned

360. [pending] **api** — Smoke GET/POST /api/incidents/:id/resolve

- evidence: curl -sf http://localhost:4400/api/incidents/test/resolve || manual
- owner: unassigned

361. [pending] **api** — Smoke GET/POST /api/incidents/:id

- evidence: curl -sf http://localhost:4400/api/incidents/test || manual
- owner: unassigned

362. [pending] **api** — Smoke GET/POST /api/incidents/metrics

- evidence: curl -sf http://localhost:4400/api/incidents/metrics || manual
- owner: unassigned

363. [pending] **api** — Smoke GET/POST /api/incidents

- evidence: curl -sf http://localhost:4400/api/incidents || manual
- owner: unassigned

364. [pending] **api** — Smoke GET/POST /api/integrations/config

- evidence: curl -sf http://localhost:4400/api/integrations/config || manual
- owner: sibling-health

365. [pending] **api** — Smoke GET/POST /api/integrations/generate-yaml

- evidence: curl -sf http://localhost:4400/api/integrations/generate-yaml || manual
- owner: unassigned

366. [pending] **api** — Smoke GET/POST /api/integrations

- evidence: curl -sf http://localhost:4400/api/integrations || manual
- owner: unassigned

367. [pending] **api** — Smoke GET/POST /api/integrations/test

- evidence: curl -sf http://localhost:4400/api/integrations/test || manual
- owner: unassigned

368. [pending] **api** — Smoke GET/POST /api/intelligence

- evidence: curl -sf http://localhost:4400/api/intelligence || manual
- owner: unassigned

369. [pending] **api** — Smoke GET/POST /api/knowledge-base/:slug

- evidence: curl -sf http://localhost:4400/api/knowledge-base/test || manual
- owner: unassigned

370. [pending] **api** — Smoke GET/POST /api/knowledge-base

- evidence: curl -sf http://localhost:4400/api/knowledge-base || manual
- owner: unassigned

371. [pending] **api** — Smoke GET/POST /api/kong/admin/consumers

- evidence: curl -sf http://localhost:4400/api/kong/admin/consumers || manual
- owner: unassigned

372. [pending] **api** — Smoke GET/POST /api/kong/admin/metrics

- evidence: curl -sf http://localhost:4400/api/kong/admin/metrics || manual
- owner: unassigned

373. [pending] **api** — Smoke GET/POST /api/kong/admin/node-info

- evidence: curl -sf http://localhost:4400/api/kong/admin/node-info || manual
- owner: unassigned

374. [pending] **api** — Smoke GET/POST /api/kong/admin/node-status

- evidence: curl -sf http://localhost:4400/api/kong/admin/node-status || manual
- owner: unassigned

375. [pending] **api** — Smoke GET/POST /api/kong/admin/plugins

- evidence: curl -sf http://localhost:4400/api/kong/admin/plugins || manual
- owner: unassigned

376. [pending] **api** — Smoke GET/POST /api/kong/admin/routes

- evidence: curl -sf http://localhost:4400/api/kong/admin/routes || manual
- owner: unassigned

377. [pending] **api** — Smoke GET/POST /api/kong/admin/services

- evidence: curl -sf http://localhost:4400/api/kong/admin/services || manual
- owner: unassigned

378. [pending] **api** — Smoke GET/POST /api/kubernetes/clusters

- evidence: curl -sf http://localhost:4400/api/kubernetes/clusters || manual
- owner: unassigned

379. [pending] **api** — Smoke GET/POST /api/kubernetes/custom-resources

- evidence: curl -sf http://localhost:4400/api/kubernetes/custom-resources || manual
- owner: unassigned

380. [pending] **api** — Smoke GET/POST /api/kubernetes/proxy/:cluster/:...path

- evidence: curl -sf http://localhost:4400/api/kubernetes/proxy/test/test || manual
- owner: unassigned

381. [pending] **api** — Smoke GET/POST /api/kubernetes/resources

- evidence: curl -sf http://localhost:4400/api/kubernetes/resources || manual
- owner: unassigned

382. [pending] **api** — Smoke GET/POST /api/kubernetes/workloads

- evidence: curl -sf http://localhost:4400/api/kubernetes/workloads || manual
- owner: unassigned

383. [pending] **api** — Smoke GET/POST /api/kubernetes-v2/clusters

- evidence: curl -sf http://localhost:4400/api/kubernetes-v2/clusters || manual
- owner: unassigned

384. [pending] **api** — Smoke GET/POST /api/kubernetes-v2

- evidence: curl -sf http://localhost:4400/api/kubernetes-v2 || manual
- owner: sibling-tenant

385. [pending] **api** — Smoke GET/POST /api/lifecycle/rules

- evidence: curl -sf http://localhost:4400/api/lifecycle/rules || manual
- owner: sibling-tenant

386. [pending] **api** — Smoke GET/POST /api/lifecycle/schedule

- evidence: curl -sf http://localhost:4400/api/lifecycle/schedule || manual
- owner: sibling-tenant

387. [pending] **api** — Smoke GET/POST /api/lifecycle/transition

- evidence: curl -sf http://localhost:4400/api/lifecycle/transition || manual
- owner: sibling-tenant

388. [pending] **api** — Smoke GET/POST /api/marketplace/approval

- evidence: curl -sf http://localhost:4400/api/marketplace/approval || manual
- owner: sibling-tenant

389. [pending] **api** — Smoke GET/POST /api/marketplace/environments

- evidence: curl -sf http://localhost:4400/api/marketplace/environments || manual
- owner: sibling-tenant

390. [pending] **api** — Smoke GET/POST /api/marketplace/federation

- evidence: curl -sf http://localhost:4400/api/marketplace/federation || manual
- owner: sibling-tenant

391. [pending] **api** — Smoke GET/POST /api/marketplace/installations

- evidence: curl -sf http://localhost:4400/api/marketplace/installations || manual
- owner: sibling-tenant

392. [pending] **api** — Smoke GET/POST /api/marketplace/plugins/:id/reviews

- evidence: curl -sf http://localhost:4400/api/marketplace/plugins/test/reviews || manual
- owner: unassigned

393. [pending] **api** — Smoke GET/POST /api/marketplace/plugins/:id

- evidence: curl -sf http://localhost:4400/api/marketplace/plugins/test || manual
- owner: unassigned

394. [pending] **api** — Smoke GET/POST /api/marketplace/plugins/:id/versions

- evidence: curl -sf http://localhost:4400/api/marketplace/plugins/test/versions || manual
- owner: unassigned

395. [pending] **api** — Smoke GET/POST /api/marketplace/plugins

- evidence: curl -sf http://localhost:4400/api/marketplace/plugins || manual
- owner: unassigned

396. [pending] **api** — Smoke GET/POST /api/marketplace/revenue

- evidence: curl -sf http://localhost:4400/api/marketplace/revenue || manual
- owner: unassigned

397. [pending] **api** — Smoke GET/POST /api/marketplace/reviews

- evidence: curl -sf http://localhost:4400/api/marketplace/reviews || manual
- owner: unassigned

398. [pending] **api** — Smoke GET/POST /api/marketplace

- evidence: curl -sf http://localhost:4400/api/marketplace || manual
- owner: unassigned

399. [pending] **api** — Smoke GET/POST /api/marketplace/security/scan

- evidence: curl -sf http://localhost:4400/api/marketplace/security/scan || manual
- owner: unassigned

400. [pending] **api** — Smoke GET/POST /api/marketplace/v1/plugins/:pluginId/install

- evidence: curl -sf http://localhost:4400/api/marketplace/v1/plugins/test/install || manual
- owner: unassigned

401. [pending] **api** — Smoke GET/POST /api/marketplace/v1/plugins/:pluginId

- evidence: curl -sf http://localhost:4400/api/marketplace/v1/plugins/test || manual
- owner: unassigned

402. [pending] **api** — Smoke GET/POST /api/marketplace/v1/plugins

- evidence: curl -sf http://localhost:4400/api/marketplace/v1/plugins || manual
- owner: unassigned

403. [pending] **api** — Smoke GET/POST /api/metrics

- evidence: curl -sf http://localhost:4400/api/metrics || manual
- owner: unassigned

404. [pending] **api** — Smoke GET/POST /api/ml-predictions

- evidence: curl -sf http://localhost:4400/api/ml-predictions || manual
- owner: unassigned

405. [pending] **api** — Smoke GET/POST /api/monitoring/alerts

- evidence: curl -sf http://localhost:4400/api/monitoring/alerts || manual
- owner: unassigned

406. [pending] **api** — Smoke GET/POST /api/monitoring/collector

- evidence: curl -sf http://localhost:4400/api/monitoring/collector || manual
- owner: unassigned

407. [pending] **api** — Smoke GET/POST /api/monitoring/comprehensive-health

- evidence: curl -sf http://localhost:4400/api/monitoring/comprehensive-health || manual
- owner: unassigned

408. [pending] **api** — Smoke GET/POST /api/monitoring/errors

- evidence: curl -sf http://localhost:4400/api/monitoring/errors || manual
- owner: unassigned

409. [pending] **api** — Smoke GET/POST /api/monitoring/export/prometheus

- evidence: curl -sf http://localhost:4400/api/monitoring/export/prometheus || manual
- owner: unassigned

410. [pending] **api** — Smoke GET/POST /api/monitoring/grafana

- evidence: curl -sf http://localhost:4400/api/monitoring/grafana || manual
- owner: unassigned

411. [pending] **api** — Smoke GET/POST /api/monitoring/health

- evidence: curl -sf http://localhost:4400/api/monitoring/health || manual
- owner: unassigned

412. [pending] **api** — Smoke GET/POST /api/monitoring/metrics

- evidence: curl -sf http://localhost:4400/api/monitoring/metrics || manual
- owner: unassigned

413. [pending] **api** — Smoke GET/POST /api/monitoring/performance

- evidence: curl -sf http://localhost:4400/api/monitoring/performance || manual
- owner: unassigned

414. [pending] **api** — Smoke GET/POST /api/monitoring/slo

- evidence: curl -sf http://localhost:4400/api/monitoring/slo || manual
- owner: unassigned

415. [pending] **api** — Smoke GET/POST /api/monitoring/tenant-health

- evidence: curl -sf http://localhost:4400/api/monitoring/tenant-health || manual
- owner: sibling-auth

416. [pending] **api** — Smoke GET/POST /api/notifications/bulk/mock-route.ts

- evidence: curl -sf http://localhost:4400/api/notifications/bulk/mock-route.ts || manual
- owner: sibling-auth

417. [pending] **api** — Smoke GET/POST /api/notifications/bulk

- evidence: curl -sf http://localhost:4400/api/notifications/bulk || manual
- owner: unassigned

418. [pending] **api** — Smoke GET/POST /api/notifications/demo

- evidence: curl -sf http://localhost:4400/api/notifications/demo || manual
- owner: unassigned

419. [pending] **api** — Smoke GET/POST /api/notifications/mock-route.ts

- evidence: curl -sf http://localhost:4400/api/notifications/mock-route.ts || manual
- owner: sibling-auth

420. [pending] **api** — Smoke GET/POST /api/notifications

- evidence: curl -sf http://localhost:4400/api/notifications || manual
- owner: unassigned

421. [pending] **api** — Smoke GET/POST /api/notifications/settings

- evidence: curl -sf http://localhost:4400/api/notifications/settings || manual
- owner: unassigned

422. [pending] **api** — Smoke GET/POST /api/notifications/webhooks/:id/deliveries

- evidence: curl -sf http://localhost:4400/api/notifications/webhooks/test/deliveries || manual
- owner: unassigned

423. [pending] **api** — Smoke GET/POST /api/notifications/webhooks/:id/stats

- evidence: curl -sf http://localhost:4400/api/notifications/webhooks/test/stats || manual
- owner: unassigned

424. [pending] **api** — Smoke GET/POST /api/notifications/webhooks

- evidence: curl -sf http://localhost:4400/api/notifications/webhooks || manual
- owner: unassigned

425. [pending] **api** — Smoke GET/POST /api/notifications/webhooks/test

- evidence: curl -sf http://localhost:4400/api/notifications/webhooks/test || manual
- owner: unassigned

426. [pending] **api** — Smoke GET/POST /api/onboarding/analytics

- evidence: curl -sf http://localhost:4400/api/onboarding/analytics || manual
- owner: unassigned

427. [pending] **api** — Smoke GET/POST /api/onboarding/complete

- evidence: curl -sf http://localhost:4400/api/onboarding/complete || manual
- owner: unassigned

428. [pending] **api** — Smoke GET/POST /api/onboarding/signup

- evidence: curl -sf http://localhost:4400/api/onboarding/signup || manual
- owner: unassigned

429. [pending] **api** — Smoke GET/POST /api/onboarding/verify

- evidence: curl -sf http://localhost:4400/api/onboarding/verify || manual
- owner: unassigned

430. [pending] **api** — Smoke GET/POST /api/onboarding/wizards/analytics

- evidence: curl -sf http://localhost:4400/api/onboarding/wizards/analytics || manual
- owner: unassigned

431. [pending] **api** — Smoke GET/POST /api/onboarding/wizards

- evidence: curl -sf http://localhost:4400/api/onboarding/wizards || manual
- owner: unassigned

432. [pending] **api** — Smoke GET/POST /api/ownership/analyze

- evidence: curl -sf http://localhost:4400/api/ownership/analyze || manual
- owner: sibling-auth

433. [pending] **api** — Smoke GET/POST /api/ownership/assign

- evidence: curl -sf http://localhost:4400/api/ownership/assign || manual
- owner: sibling-auth

434. [pending] **api** — Smoke GET/POST /api/ownership/teams

- evidence: curl -sf http://localhost:4400/api/ownership/teams || manual
- owner: sibling-auth

435. [pending] **api** — Smoke GET/POST /api/permissions/audit

- evidence: curl -sf http://localhost:4400/api/permissions/audit || manual
- owner: sibling-auth

436. [pending] **api** — Smoke GET/POST /api/permissions/check

- evidence: curl -sf http://localhost:4400/api/permissions/check || manual
- owner: sibling-auth

437. [pending] **api** — Smoke GET/POST /api/permissions/roles

- evidence: curl -sf http://localhost:4400/api/permissions/roles || manual
- owner: sibling-auth

438. [pending] **api** — Smoke GET/POST /api/platform/health

- evidence: curl -sf http://localhost:4400/api/platform/health || manual
- owner: unassigned

439. [pending] **api** — Smoke GET/POST /api/plugin-ab-testing

- evidence: curl -sf http://localhost:4400/api/plugin-ab-testing || manual
- owner: unassigned

440. [pending] **api** — Smoke GET/POST /api/plugin-actions

- evidence: curl -sf http://localhost:4400/api/plugin-actions || manual
- owner: unassigned

441. [pending] **api** — Smoke GET/POST /api/plugin-administration/enhanced

- evidence: curl -sf http://localhost:4400/api/plugin-administration/enhanced || manual
- owner: unassigned

442. [pending] **api** — Smoke GET/POST /api/plugin-ai-search

- evidence: curl -sf http://localhost:4400/api/plugin-ai-search || manual
- owner: unassigned

443. [pending] **api** — Smoke GET/POST /api/plugin-analytics

- evidence: curl -sf http://localhost:4400/api/plugin-analytics || manual
- owner: unassigned

444. [pending] **api** — Smoke GET/POST /api/plugin-billing

- evidence: curl -sf http://localhost:4400/api/plugin-billing || manual
- owner: unassigned

445. [pending] **api** — Smoke GET/POST /api/plugin-cache

- evidence: curl -sf http://localhost:4400/api/plugin-cache || manual
- owner: sibling-tenant

446. [pending] **api** — Smoke GET/POST /api/plugin-certification

- evidence: curl -sf http://localhost:4400/api/plugin-certification || manual
- owner: unassigned

447. [pending] **api** — Smoke GET/POST /api/plugin-ci-cd

- evidence: curl -sf http://localhost:4400/api/plugin-ci-cd || manual
- owner: unassigned

448. [pending] **api** — Smoke GET/POST /api/plugin-collaboration

- evidence: curl -sf http://localhost:4400/api/plugin-collaboration || manual
- owner: unassigned

449. [pending] **api** — Smoke GET/POST /api/plugin-compatibility

- evidence: curl -sf http://localhost:4400/api/plugin-compatibility || manual
- owner: unassigned

450. [pending] **api** — Smoke GET/POST /api/plugin-compliance

- evidence: curl -sf http://localhost:4400/api/plugin-compliance || manual
- owner: unassigned

451. [pending] **api** — Smoke GET/POST /api/plugin-dependencies

- evidence: curl -sf http://localhost:4400/api/plugin-dependencies || manual
- owner: unassigned

452. [pending] **api** — Smoke GET/POST /api/plugin-docs

- evidence: curl -sf http://localhost:4400/api/plugin-docs || manual
- owner: unassigned

453. [pending] **api** — Smoke GET/POST /api/plugin-federation

- evidence: curl -sf http://localhost:4400/api/plugin-federation || manual
- owner: sibling-auth

454. [pending] **api** — Smoke GET/POST /api/plugin-gateway

- evidence: curl -sf http://localhost:4400/api/plugin-gateway || manual
- owner: unassigned

455. [pending] **api** — Smoke GET/POST /api/plugin-gitops

- evidence: curl -sf http://localhost:4400/api/plugin-gitops || manual
- owner: unassigned

456. [pending] **api** — Smoke GET/POST /api/plugin-health

- evidence: curl -sf http://localhost:4400/api/plugin-health || manual
- owner: unassigned

457. [pending] **api** — Smoke GET/POST /api/plugin-installer

- evidence: curl -sf http://localhost:4400/api/plugin-installer || manual
- owner: unassigned

458. [pending] **api** — Smoke GET/POST /api/plugin-lifecycle

- evidence: curl -sf http://localhost:4400/api/plugin-lifecycle || manual
- owner: unassigned

459. [pending] **api** — Smoke GET/POST /api/plugin-migration

- evidence: curl -sf http://localhost:4400/api/plugin-migration || manual
- owner: unassigned

460. [pending] **api** — Smoke GET/POST /api/plugin-monitor

- evidence: curl -sf http://localhost:4400/api/plugin-monitor || manual
- owner: unassigned

461. [pending] **api** — Smoke GET/POST /api/plugin-multitenancy

- evidence: curl -sf http://localhost:4400/api/plugin-multitenancy || manual
- owner: unassigned

462. [pending] **api** — Smoke GET/POST /api/plugin-notifications

- evidence: curl -sf http://localhost:4400/api/plugin-notifications || manual
- owner: unassigned

463. [pending] **api** — Smoke GET/POST /api/plugin-profiling

- evidence: curl -sf http://localhost:4400/api/plugin-profiling || manual
- owner: unassigned

464. [pending] **api** — Smoke GET/POST /api/plugin-recommendations

- evidence: curl -sf http://localhost:4400/api/plugin-recommendations || manual
- owner: unassigned

465. [pending] **api** — Smoke GET/POST /api/plugin-revenue

- evidence: curl -sf http://localhost:4400/api/plugin-revenue || manual
- owner: unassigned

466. [pending] **api** — Smoke GET/POST /api/plugin-sdk

- evidence: curl -sf http://localhost:4400/api/plugin-sdk || manual
- owner: unassigned

467. [pending] **api** — Smoke GET/POST /api/plugin-security

- evidence: curl -sf http://localhost:4400/api/plugin-security || manual
- owner: unassigned

468. [pending] **api** — Smoke GET/POST /api/plugin-security-scan

- evidence: curl -sf http://localhost:4400/api/plugin-security-scan || manual
- owner: unassigned

469. [pending] **api** — Smoke GET/POST /api/plugin-templates

- evidence: curl -sf http://localhost:4400/api/plugin-templates || manual
- owner: unassigned

470. [pending] **api** — Smoke GET/POST /api/plugin-test

- evidence: curl -sf http://localhost:4400/api/plugin-test || manual
- owner: unassigned

471. [pending] **api** — Smoke GET/POST /api/plugin-testing

- evidence: curl -sf http://localhost:4400/api/plugin-testing || manual
- owner: unassigned

472. [pending] **api** — Smoke GET/POST /api/plugin-version-check

- evidence: curl -sf http://localhost:4400/api/plugin-version-check || manual
- owner: unassigned

473. [pending] **api** — Smoke GET/POST /api/plugin-versions

- evidence: curl -sf http://localhost:4400/api/plugin-versions || manual
- owner: unassigned

474. [pending] **api** — Smoke GET/POST /api/plugin-webhooks

- evidence: curl -sf http://localhost:4400/api/plugin-webhooks || manual
- owner: sibling-ops

475. [pending] **api** — Smoke GET/POST /api/plugins/:id/configurations

- evidence: curl -sf http://localhost:4400/api/plugins/test/configurations || manual
- owner: unassigned

476. [pending] **api** — Smoke GET/POST /api/plugins/:id/quality/evaluate

- evidence: curl -sf http://localhost:4400/api/plugins/test/quality/evaluate || manual
- owner: unassigned

477. [pending] **api** — Smoke GET/POST /api/plugins/:id/quality/history

- evidence: curl -sf http://localhost:4400/api/plugins/test/quality/history || manual
- owner: unassigned

478. [pending] **api** — Smoke GET/POST /api/plugins/:id/quality/issues/:issueId/resolve

- evidence: curl -sf http://localhost:4400/api/plugins/test/quality/issues/test/resolve || manual
- owner: unassigned

479. [pending] **api** — Smoke GET/POST /api/plugins/:id/quality/issues

- evidence: curl -sf http://localhost:4400/api/plugins/test/quality/issues || manual
- owner: unassigned

480. [pending] **api** — Smoke GET/POST /api/plugins/:id/quality

- evidence: curl -sf http://localhost:4400/api/plugins/test/quality || manual
- owner: sibling-tenant

481. [pending] **api** — Smoke GET/POST /api/plugins/:id/schema

- evidence: curl -sf http://localhost:4400/api/plugins/test/schema || manual
- owner: unassigned

482. [pending] **api** — Smoke GET/POST /api/plugins/ai-recommendations

- evidence: curl -sf http://localhost:4400/api/plugins/ai-recommendations || manual
- owner: unassigned

483. [pending] **api** — Smoke GET/POST /api/plugins/approval/requests/:requestId/approve

- evidence: curl -sf http://localhost:4400/api/plugins/approval/requests/test/approve || manual
- owner: unassigned

484. [pending] **api** — Smoke GET/POST /api/plugins/approval/requests/:requestId/comments

- evidence: curl -sf http://localhost:4400/api/plugins/approval/requests/test/comments || manual
- owner: unassigned

485. [pending] **api** — Smoke GET/POST /api/plugins/approval/requests/:requestId/reject

- evidence: curl -sf http://localhost:4400/api/plugins/approval/requests/test/reject || manual
- owner: unassigned

486. [pending] **api** — Smoke GET/POST /api/plugins/approval/requests/:requestId

- evidence: curl -sf http://localhost:4400/api/plugins/approval/requests/test || manual
- owner: unassigned

487. [pending] **api** — Smoke GET/POST /api/plugins/approval/requests/:requestId/security-scan

- evidence: curl -sf http://localhost:4400/api/plugins/approval/requests/test/security-scan ||
  manual
- owner: unassigned

488. [pending] **api** — Smoke GET/POST /api/plugins/approval/requests

- evidence: curl -sf http://localhost:4400/api/plugins/approval/requests || manual
- owner: unassigned

489. [pending] **api** — Smoke GET/POST /api/plugins/builder

- evidence: curl -sf http://localhost:4400/api/plugins/builder || manual
- owner: unassigned

490. [pending] **api** — Smoke GET/POST /api/plugins/canary-deployment

- evidence: curl -sf http://localhost:4400/api/plugins/canary-deployment || manual
- owner: unassigned

491. [pending] **api** — Smoke GET/POST /api/plugins/changelog-analysis

- evidence: curl -sf http://localhost:4400/api/plugins/changelog-analysis || manual
- owner: unassigned

492. [pending] **api** — Smoke GET/POST /api/plugins/compatibility

- evidence: curl -sf http://localhost:4400/api/plugins/compatibility || manual
- owner: unassigned

493. [pending] **api** — Smoke GET/POST /api/plugins/compatibility-check

- evidence: curl -sf http://localhost:4400/api/plugins/compatibility-check || manual
- owner: unassigned

494. [pending] **api** — Smoke GET/POST /api/plugins/comprehensive

- evidence: curl -sf http://localhost:4400/api/plugins/comprehensive || manual
- owner: sibling-tenant

495. [pending] **api** — Smoke GET/POST /api/plugins/config

- evidence: curl -sf http://localhost:4400/api/plugins/config || manual
- owner: unassigned

496. [pending] **api** — Smoke GET/POST /api/plugins/dependencies

- evidence: curl -sf http://localhost:4400/api/plugins/dependencies || manual
- owner: unassigned

497. [pending] **api** — Smoke GET/POST /api/plugins/discovery/details/:packageName

- evidence: curl -sf http://localhost:4400/api/plugins/discovery/details/test || manual
- owner: unassigned

498. [pending] **api** — Smoke GET/POST /api/plugins/discovery/featured

- evidence: curl -sf http://localhost:4400/api/plugins/discovery/featured || manual
- owner: unassigned

499. [pending] **api** — Smoke GET/POST /api/plugins/discovery/search

- evidence: curl -sf http://localhost:4400/api/plugins/discovery/search || manual
- owner: unassigned

500. [pending] **api** — Smoke GET/POST /api/plugins/discovery/trending

- evidence: curl -sf http://localhost:4400/api/plugins/discovery/trending || manual
- owner: unassigned

---

## Dev Frontend — factory/dev-backend (verified 2026-06-13)

1. [verified] **frontend** — `FeedbackWidget.tsx` type/build errors fixed
   - evidence: `npx tsc --noEmit --project tsconfig.client.json 2>&1 | rg FeedbackWidget` → no
     output; `useCallback((): FeedbackMetadata =>` syntax; screenshot clear via destructure;
     `npm install html2canvas`
   - owner: dev-frontend

2. [verified] **frontend** — `FeedbackPortal.tsx` type/build errors fixed
   - evidence: `npx tsc --noEmit --project tsconfig.client.json 2>&1 | rg FeedbackPortal` → no
     output; removed unused imports; `sortBy`/`sortOrder` split defaults
   - owner: dev-frontend

3. [verified] **frontend** — `PluginManagementDashboard.tsx` type/build errors fixed
   - evidence: `npx tsc --noEmit --project tsconfig.client.json 2>&1 | rg PluginManagementDashboard`
     → no output; pruned unused lucide imports; `useEffect` cleanup on all paths
   - owner: dev-frontend

4. [verified] **frontend** — Re-enabled tsconfig/eslint for feedback + plugin dashboard
   - evidence: removed paths from `tsconfig.json`, `tsconfig.build.json`, `.eslintignore` exclude
     lists
   - owner: dev-frontend
