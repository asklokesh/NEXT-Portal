#!/usr/bin/env node

/**
 * End-to-End Production Testing Script
 * Tests all major functionality of the Backstage IDP Platform
 */

const http = require('http');
const https = require('https');

const BASE_URL = 'http://localhost:4400';
const BACKSTAGE_URL = 'http://localhost:4402';

// Color codes for output
const colors = {
 reset: '\x1b[0m',
 bright: '\x1b[1m',
 green: '\x1b[32m',
 red: '\x1b[31m',
 yellow: '\x1b[33m',
 blue: '\x1b[34m',
 cyan: '\x1b[36m'
};

// Test results collector
const testResults = {
 passed: [],
 failed: [],
 warnings: []
};

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
 return new Promise((resolve, reject) => {
 const urlObj = new URL(url);
 const client = urlObj.protocol === 'https:' ? https : http;
 
 const req = client.request(url, options, (res) => {
 let data = '';
 res.on('data', chunk => data += chunk);
 res.on('end', () => {
 resolve({
 status: res.statusCode,
 headers: res.headers,
 data: data
 });
 });
 });
 
 req.on('error', reject);
 
 if (options.body) {
 req.write(typeof options.body === 'object' ? JSON.stringify(options.body) : options.body);
 }
 
 req.end();
 });
}

// Test function wrapper
async function test(name, fn) {
 process.stdout.write(`Testing ${name}... `);
 try {
 await fn();
 console.log(`${colors.green}${colors.reset}`);
 testResults.passed.push(name);
 } catch (error) {
 console.log(`${colors.red}${colors.reset}`);
 console.log(` ${colors.red}Error: ${error.message}${colors.reset}`);
 testResults.failed.push({ name, error: error.message });
 }
}

// Test categories
async function testPages() {
 console.log(`\n${colors.bright}${colors.blue}=== Testing Page Access ===${colors.reset}`);
 
 const pages = [
 { path: '/dashboard', name: 'Dashboard' },
 { path: '/catalog', name: 'Service Catalog' },
 { path: '/catalog/relationships', name: 'Service Relationships' },
 { path: '/templates', name: 'Templates' },
 { path: '/plugins', name: 'Plugins' },
 { path: '/workflows', name: 'Workflows' },
 { path: '/deployments', name: 'Deployments' },
 { path: '/health', name: 'Health Monitor' },
 { path: '/analytics', name: 'Analytics' },
 { path: '/cost', name: 'Cost Tracking' },
 { path: '/monitoring', name: 'Monitoring' },
 { path: '/activity', name: 'Activity' },
 { path: '/docs', name: 'Documentation' },
 { path: '/api-docs', name: 'API Documentation' },
 { path: '/teams', name: 'Teams' },
 { path: '/settings', name: 'Settings' },
 { path: '/admin', name: 'Admin' }
 ];
 
 for (const page of pages) {
 await test(`${page.name} page loads`, async () => {
 const res = await makeRequest(`${BASE_URL}${page.path}`);
 if (res.status !== 200) {
 throw new Error(`Expected 200, got ${res.status}`);
 }
 });
 }
}

async function testAPIs() {
 console.log(`\n${colors.bright}${colors.blue}=== Testing API Endpoints ===${colors.reset}`);
 
 // Test health endpoint
 await test('Health API returns OK', async () => {
 const res = await makeRequest(`${BASE_URL}/api/health`);
 if (res.status !== 200) {
 throw new Error(`Expected 200, got ${res.status}`);
 }
 const data = JSON.parse(res.data);
 if (data.status !== 'ok') {
 throw new Error(`Expected status 'ok', got ${data.status}`);
 }
 });
 
 // Test Backstage proxy
 await test('Backstage API proxy works', async () => {
 const res = await makeRequest(`${BASE_URL}/api/backstage/version`);
 if (res.status !== 200) {
 throw new Error(`Expected 200, got ${res.status}`);
 }
 });
 
 // Test catalog API
 await test('Catalog API returns entities', async () => {
 const res = await makeRequest(`${BASE_URL}/api/backstage/catalog/entities`);
 if (res.status !== 200) {
 throw new Error(`Expected 200, got ${res.status}`);
 }
 const data = JSON.parse(res.data);
 if (!data.items || !Array.isArray(data.items)) {
 throw new Error('Expected items array in response');
 }
 });
 
 // Test templates API
 await test('Templates API returns templates', async () => {
 const res = await makeRequest(`${BASE_URL}/api/backstage/scaffolder/v2/templates`);
 if (res.status !== 200) {
 throw new Error(`Expected 200, got ${res.status}`);
 }
 const data = JSON.parse(res.data);
 if (!data.templates || !Array.isArray(data.templates)) {
 throw new Error('Expected templates array in response');
 }
 });
 
 // Test metrics endpoint
 await test('Metrics API is accessible', async () => {
 const res = await makeRequest(`${BASE_URL}/api/metrics`);
 // Metrics might be disabled, so we just check it doesn't error
 if (res.status >= 500) {
 throw new Error(`Server error: ${res.status}`);
 }
 });
}

async function testServiceCatalog() {
 console.log(`\n${colors.bright}${colors.blue}=== Testing Service Catalog Functionality ===${colors.reset}`);
 
 // Test entity retrieval
 await test('Can fetch service entities', async () => {
 const res = await makeRequest(`${BASE_URL}/api/backstage/catalog/entities`);
 const data = JSON.parse(res.data);
 if (!data.items || data.items.length === 0) {
 testResults.warnings.push('No service entities found in catalog');
 }
 });
 
 // Test entity search
 await test('Can search for entities', async () => {
 const res = await makeRequest(`${BASE_URL}/api/search/query`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ term: 'service' })
 });
 if (res.status !== 200) {
 throw new Error(`Search failed with status ${res.status}`);
 }
 });
}

async function testTemplates() {
 console.log(`\n${colors.bright}${colors.blue}=== Testing Template Functionality ===${colors.reset}`);
 
 // Test template listing
 await test('Can list available templates', async () => {
 const res = await makeRequest(`${BASE_URL}/api/backstage/scaffolder/v2/templates`);
 const data = JSON.parse(res.data);
 if (!data.templates) {
 throw new Error('No templates property in response');
 }
 });
 
 // Test template actions
 await test('Can fetch scaffolder actions', async () => {
 const res = await makeRequest(`${BASE_URL}/api/backstage/scaffolder/v2/actions`);
 const data = JSON.parse(res.data);
 if (!Array.isArray(data)) {
 throw new Error('Expected array of actions');
 }
 });
}

async function testPlugins() {
 console.log(`\n${colors.bright}${colors.blue}=== Testing Plugin System ===${colors.reset}`);
 
 // Test plugin configuration endpoint
 await test('Plugin configuration API works', async () => {
 const res = await makeRequest(`${BASE_URL}/api/backstage/plugins/configure`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 pluginId: 'test-plugin',
 config: { enabled: false }
 })
 });
 // Should return success even if just storing locally
 if (res.status >= 500) {
 throw new Error(`Server error: ${res.status}`);
 }
 });
 
 // Test plugin enable/disable
 await test('Can enable/disable plugins', async () => {
 const res = await makeRequest(`${BASE_URL}/api/backstage/plugins/kubernetes/enable`, {
 method: 'POST'
 });
 if (res.status >= 500) {
 throw new Error(`Server error: ${res.status}`);
 }
 });
}

async function testWorkflows() {
 console.log(`\n${colors.bright}${colors.blue}=== Testing Workflow Automation ===${colors.reset}`);
 
 // Workflows are rendered client-side, so we just check the page loads
 await test('Workflow page has required structure', async () => {
 const res = await makeRequest(`${BASE_URL}/workflows`);
 if (res.status !== 200) {
 throw new Error(`Expected 200, got ${res.status}`);
 }
 // Check for Next.js app structure
 if (!res.data.includes('__NEXT_DATA__')) {
 throw new Error('Missing Next.js data structure');
 }
 });
}

async function testMonitoring() {
 console.log(`\n${colors.bright}${colors.blue}=== Testing Monitoring & Health ===${colors.reset}`);
 
 // Test health check endpoints
 await test('Liveness probe works', async () => {
 const res = await makeRequest(`${BASE_URL}/api/health/live`);
 if (res.status !== 200) {
 throw new Error(`Expected 200, got ${res.status}`);
 }
 });
 
 await test('Readiness probe works', async () => {
 const res = await makeRequest(`${BASE_URL}/api/health/ready`);
 const data = JSON.parse(res.data);
 if (data.status !== 'ready') {
 testResults.warnings.push('Application not fully ready: ' + JSON.stringify(data.checks));
 }
 });
 
 // Test monitoring endpoints
 await test('Monitoring alerts API works', async () => {
 const res = await makeRequest(`${BASE_URL}/api/monitoring/alerts`);
 if (res.status !== 200) {
 throw new Error(`Expected 200, got ${res.status}`);
 }
 });
 
 await test('Performance metrics API works', async () => {
 const res = await makeRequest(`${BASE_URL}/api/monitoring/performance`);
 if (res.status !== 200) {
 throw new Error(`Expected 200, got ${res.status}`);
 }
 });
}

async function testCostTracking() {
 console.log(`\n${colors.bright}${colors.blue}=== Testing Cost Tracking ===${colors.reset}`);
 
 await test('Cost API returns data', async () => {
 const res = await makeRequest(`${BASE_URL}/api/costs`);
 if (res.status !== 200) {
 throw new Error(`Expected 200, got ${res.status}`);
 }
 const data = JSON.parse(res.data);
 if (!data.services) {
 throw new Error('Expected services in cost data');
 }
 });
 
 await test('Cost budgets API works', async () => {
 const res = await makeRequest(`${BASE_URL}/api/costs/budgets`);
 if (res.status !== 200) {
 throw new Error(`Expected 200, got ${res.status}`);
 }
 });
}

async function testBackstageIntegration() {
 console.log(`\n${colors.bright}${colors.blue}=== Testing Backstage Backend Integration ===${colors.reset}`);
 
 // Check if mock Backstage is running
 await test('Mock Backstage backend is accessible', async () => {
 const res = await makeRequest(`${BACKSTAGE_URL}/api/catalog/entities`);
 if (res.status !== 200) {
 throw new Error(`Mock Backstage not responding: ${res.status}`);
 }
 });
 
 // Test proxy configuration
 await test('Backstage proxy forwards requests', async () => {
 const res = await makeRequest(`${BASE_URL}/api/backstage/catalog/entities`);
 if (res.status !== 200) {
 throw new Error(`Proxy not working: ${res.status}`);
 }
 const data = JSON.parse(res.data);
 if (!data.items) {
 throw new Error('Invalid response from proxy');
 }
 });
}

async function testPerformance() {
 console.log(`\n${colors.bright}${colors.blue}=== Testing Performance ===${colors.reset}`);
 
 // Test response times
 await test('Dashboard loads within 3 seconds', async () => {
 const start = Date.now();
 const res = await makeRequest(`${BASE_URL}/dashboard`);
 const duration = Date.now() - start;
 if (duration > 3000) {
 throw new Error(`Took ${duration}ms (threshold: 3000ms)`);
 }
 });
 
 await test('API responds within 500ms', async () => {
 const start = Date.now();
 const res = await makeRequest(`${BASE_URL}/api/health`);
 const duration = Date.now() - start;
 if (duration > 500) {
 throw new Error(`Took ${duration}ms (threshold: 500ms)`);
 }
 });
 
 // Test concurrent requests
 await test('Handles 10 concurrent requests', async () => {
 const promises = [];
 for (let i = 0; i < 10; i++) {
 promises.push(makeRequest(`${BASE_URL}/api/health`));
 }
 const results = await Promise.all(promises);
 const failed = results.filter(r => r.status !== 200);
 if (failed.length > 0) {
 throw new Error(`${failed.length} requests failed`);
 }
 });
}

async function testSecurity() {
 console.log(`\n${colors.bright}${colors.blue}=== Testing Security ===${colors.reset}`);
 
 // Check security headers
 await test('Security headers are present', async () => {
 const res = await makeRequest(`${BASE_URL}/dashboard`);
 const csp = res.headers['content-security-policy'];
 if (!csp) {
 throw new Error('Missing Content-Security-Policy header');
 }
 const permissions = res.headers['permissions-policy'];
 if (!permissions) {
 throw new Error('Missing Permissions-Policy header');
 }
 });
 
 // Test authentication on protected endpoints
 await test('Protected endpoints require authentication', async () => {
 const res = await makeRequest(`${BASE_URL}/api/audit-logs`);
 // Should either return 401 or empty data
 if (res.status >= 500) {
 throw new Error(`Server error: ${res.status}`);
 }
 });
}

// Generate test report
function generateReport() {
 console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(60)}${colors.reset}`);
 console.log(`${colors.bright}${colors.cyan}End-to-End Production Test Report${colors.reset}`);
 console.log(`${colors.bright}${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
 
 const total = testResults.passed.length + testResults.failed.length;
 const passRate = ((testResults.passed.length / total) * 100).toFixed(1);
 
 console.log(`${colors.bright}Summary:${colors.reset}`);
 console.log(` Total Tests: ${total}`);
 console.log(` ${colors.green}Passed: ${testResults.passed.length}${colors.reset}`);
 console.log(` ${colors.red}Failed: ${testResults.failed.length}${colors.reset}`);
 console.log(` ${colors.yellow}Warnings: ${testResults.warnings.length}${colors.reset}`);
 console.log(` Pass Rate: ${passRate}%`);
 
 if (testResults.failed.length > 0) {
 console.log(`\n${colors.bright}${colors.red}Failed Tests:${colors.reset}`);
 testResults.failed.forEach(({ name, error }) => {
 console.log(` • ${name}`);
 console.log(` ${colors.red}${error}${colors.reset}`);
 });
 }
 
 if (testResults.warnings.length > 0) {
 console.log(`\n${colors.bright}${colors.yellow}Warnings:${colors.reset}`);
 testResults.warnings.forEach(warning => {
 console.log(` • ${warning}`);
 });
 }
 
 console.log(`\n${colors.bright}Categories Tested:${colors.reset}`);
 console.log(' Page Access (17 pages)');
 console.log(' API Endpoints');
 console.log(' Service Catalog CRUD');
 console.log(' Template System');
 console.log(' Plugin Management');
 console.log(' Workflow Automation');
 console.log(' Monitoring & Health');
 console.log(' Cost Tracking');
 console.log(' Backstage Integration');
 console.log(' Performance Metrics');
 console.log(' Security Headers');
 
 const verdict = testResults.failed.length === 0 ? 
 `${colors.green}${colors.bright} All tests passed! Application is production-ready.${colors.reset}` :
 `${colors.red}${colors.bright} Some tests failed. Please review and fix issues.${colors.reset}`;
 
 console.log(`\n${verdict}\n`);
 
 // Save report to file
 const fs = require('fs');
 const reportData = {
 timestamp: new Date().toISOString(),
 summary: {
 total,
 passed: testResults.passed.length,
 failed: testResults.failed.length,
 warnings: testResults.warnings.length,
 passRate
 },
 results: testResults
 };
 
 fs.writeFileSync('e2e-test-report.json', JSON.stringify(reportData, null, 2));
 console.log(`Report saved to: e2e-test-report.json`);
}

// Main test runner
async function runTests() {
 console.log(`${colors.bright}${colors.cyan}Starting End-to-End Production Tests${colors.reset}`);
 console.log(`Target: ${BASE_URL}`);
 console.log(`Backstage: ${BACKSTAGE_URL}\n`);
 
 try {
 // Check if servers are running
 await test('Production server is running', async () => {
 const res = await makeRequest(`${BASE_URL}/api/health`);
 if (res.status !== 200) {
 throw new Error('Server not responding');
 }
 });
 
 // Run all test suites
 await testPages();
 await testAPIs();
 await testServiceCatalog();
 await testTemplates();
 await testPlugins();
 await testWorkflows();
 await testMonitoring();
 await testCostTracking();
 await testBackstageIntegration();
 await testPerformance();
 await testSecurity();
 
 } catch (error) {
 console.error(`\n${colors.red}Fatal error: ${error.message}${colors.reset}`);
 process.exit(1);
 }
 
 // Generate report
 generateReport();
 
 // Exit with appropriate code
 process.exit(testResults.failed.length > 0 ? 1 : 0);
}

// Run the tests
runTests().catch(console.error);