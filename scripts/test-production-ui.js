#!/usr/bin/env node

/**
 * Production UI Functional Testing Script
 * Tests all pages visually and functionally using Puppeteer
 */

const fs = require('fs');
const path = require('path');
let puppeteer;
try {
 puppeteer = require('puppeteer');
} catch (e) {
 // Puppeteer not installed, will use basic tests
}

const BASE_URL = 'http://localhost:4400';

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

// Test results
const results = {
 passed: [],
 failed: [],
 screenshots: []
};

// Pages to test with their expected elements and interactions
const pagesToTest = [
 {
 name: 'Dashboard',
 path: '/dashboard',
 waitFor: '.grid', // Wait for metrics grid
 elements: [
 { selector: 'h1', text: 'Dashboard' },
 { selector: '.grid', count: 1, desc: 'Metrics grid' }
 ],
 interactions: []
 },
 {
 name: 'Service Catalog',
 path: '/catalog',
 waitFor: 'h1',
 elements: [
 { selector: 'h1', text: 'Service Catalog' },
 { selector: 'button', text: 'Add Service', desc: 'Add service button' }
 ],
 interactions: [
 { action: 'click', selector: 'text/Search', desc: 'Open search' }
 ]
 },
 {
 name: 'Service Relationships',
 path: '/catalog/relationships',
 waitFor: 'canvas',
 elements: [
 { selector: 'h1', text: 'Service Relationships' },
 { selector: 'canvas', count: 1, desc: 'Relationship visualization' }
 ],
 interactions: []
 },
 {
 name: 'Templates',
 path: '/templates',
 waitFor: 'h1',
 elements: [
 { selector: 'h1', text: 'Template Marketplace' },
 { selector: '.grid', desc: 'Templates grid' }
 ],
 interactions: []
 },
 {
 name: 'Plugins',
 path: '/plugins',
 waitFor: 'h1',
 elements: [
 { selector: 'h1', text: 'Plugin Marketplace' },
 { selector: 'input[placeholder*="Search plugins"]', desc: 'Plugin search' }
 ],
 interactions: [
 { action: 'type', selector: 'input[placeholder*="Search plugins"]', value: 'kubernetes', desc: 'Search for kubernetes plugin' }
 ]
 },
 {
 name: 'Workflows',
 path: '/workflows',
 waitFor: '.react-flow',
 elements: [
 { selector: 'h1', text: 'Workflow Automation' },
 { selector: '.react-flow', desc: 'Workflow designer canvas' }
 ],
 interactions: []
 },
 {
 name: 'Deployments',
 path: '/deployments',
 waitFor: 'h1',
 elements: [
 { selector: 'h1', text: 'Deployment Pipeline' },
 { selector: '.pipeline-stage', count: 5, desc: 'Pipeline stages' }
 ],
 interactions: []
 },
 {
 name: 'Health Monitor',
 path: '/health',
 waitFor: 'h1',
 elements: [
 { selector: 'h1', text: 'Service Health Dashboard' },
 { selector: '.health-card', desc: 'Health status cards' }
 ],
 interactions: []
 },
 {
 name: 'Analytics',
 path: '/analytics',
 waitFor: 'h1',
 elements: [
 { selector: 'h1', text: 'Service Analytics Dashboard' },
 { selector: 'canvas', desc: 'Analytics charts' }
 ],
 interactions: []
 },
 {
 name: 'Cost Tracking',
 path: '/cost',
 waitFor: 'h1',
 elements: [
 { selector: 'h1', text: 'Service Cost Tracker' },
 { selector: '.cost-card', desc: 'Cost breakdown cards' }
 ],
 interactions: []
 },
 {
 name: 'Monitoring',
 path: '/monitoring',
 waitFor: 'h1',
 elements: [
 { selector: 'h1', text: 'Service Monitoring Dashboard' },
 { selector: '.metric-card', desc: 'Monitoring metrics' }
 ],
 interactions: []
 },
 {
 name: 'Activity Feed',
 path: '/activity',
 waitFor: 'h1',
 elements: [
 { selector: 'h1', text: 'Activity Feed' },
 { selector: '.activity-item', desc: 'Activity entries' }
 ],
 interactions: []
 },
 {
 name: 'Documentation',
 path: '/docs',
 waitFor: 'h1',
 elements: [
 { selector: 'h1', text: 'Service Documentation' },
 { selector: 'input[placeholder*="Search documentation"]', desc: 'Doc search' }
 ],
 interactions: []
 },
 {
 name: 'API Docs',
 path: '/api-docs',
 waitFor: 'h1',
 elements: [
 { selector: 'h1', text: 'API Documentation' },
 { selector: '.endpoint-card', desc: 'API endpoint cards' }
 ],
 interactions: []
 },
 {
 name: 'Teams',
 path: '/teams',
 waitFor: 'h1',
 elements: [
 { selector: 'h1', text: 'Team Management' },
 { selector: 'button', text: 'Create Team', desc: 'Create team button' }
 ],
 interactions: []
 },
 {
 name: 'Settings',
 path: '/settings',
 waitFor: 'h1',
 elements: [
 { selector: 'h1', text: 'Settings' },
 { selector: '.settings-section', desc: 'Settings sections' }
 ],
 interactions: []
 },
 {
 name: 'Admin',
 path: '/admin',
 waitFor: 'h1',
 elements: [
 { selector: 'h1', text: 'Admin Dashboard' },
 { selector: '.admin-card', desc: 'Admin feature cards' }
 ],
 interactions: []
 }
];

async function testPage(browser, page, pageConfig) {
 console.log(`\nTesting ${colors.bright}${pageConfig.name}${colors.reset} (${pageConfig.path})`);
 
 try {
 // Navigate to page
 await page.goto(`${BASE_URL}${pageConfig.path}`, { 
 waitUntil: 'networkidle2',
 timeout: 30000 
 });
 
 // Wait for main element
 await page.waitForSelector(pageConfig.waitFor, { timeout: 10000 });
 
 // Take screenshot
 const screenshotPath = `screenshots/${pageConfig.name.toLowerCase().replace(/\s+/g, '-')}.png`;
 await page.screenshot({ 
 path: screenshotPath,
 fullPage: true 
 });
 results.screenshots.push(screenshotPath);
 console.log(` ${colors.green}${colors.reset} Screenshot saved`);
 
 // Test for expected elements
 for (const element of pageConfig.elements) {
 try {
 if (element.text) {
 // Check for text content
 const found = await page.evaluate((selector, text) => {
 const el = document.querySelector(selector);
 return el && el.textContent.includes(text);
 }, element.selector, element.text);
 
 if (found) {
 console.log(` ${colors.green}${colors.reset} Found: ${element.desc || `${element.selector} with text "${element.text}"`}`);
 results.passed.push(`${pageConfig.name}: ${element.desc || element.selector}`);
 } else {
 throw new Error(`Element not found or text mismatch`);
 }
 } else if (element.count) {
 // Check element count
 const count = await page.$$eval(element.selector, els => els.length);
 if (count >= element.count) {
 console.log(` ${colors.green}${colors.reset} Found: ${count} ${element.desc || element.selector}`);
 results.passed.push(`${pageConfig.name}: ${element.desc || element.selector}`);
 } else {
 throw new Error(`Expected at least ${element.count}, found ${count}`);
 }
 } else {
 // Just check existence
 await page.waitForSelector(element.selector, { timeout: 5000 });
 console.log(` ${colors.green}${colors.reset} Found: ${element.desc || element.selector}`);
 results.passed.push(`${pageConfig.name}: ${element.desc || element.selector}`);
 }
 } catch (error) {
 console.log(` ${colors.red}${colors.reset} Missing: ${element.desc || element.selector}`);
 results.failed.push({
 page: pageConfig.name,
 element: element.desc || element.selector,
 error: error.message
 });
 }
 }
 
 // Perform interactions
 for (const interaction of pageConfig.interactions) {
 try {
 if (interaction.action === 'click') {
 await page.click(interaction.selector);
 await page.waitForTimeout(1000); // Wait for action to complete
 console.log(` ${colors.green}${colors.reset} Interaction: ${interaction.desc}`);
 results.passed.push(`${pageConfig.name}: ${interaction.desc}`);
 } else if (interaction.action === 'type') {
 await page.type(interaction.selector, interaction.value);
 await page.waitForTimeout(500);
 console.log(` ${colors.green}${colors.reset} Interaction: ${interaction.desc}`);
 results.passed.push(`${pageConfig.name}: ${interaction.desc}`);
 }
 } catch (error) {
 console.log(` ${colors.red}${colors.reset} Failed interaction: ${interaction.desc}`);
 results.failed.push({
 page: pageConfig.name,
 interaction: interaction.desc,
 error: error.message
 });
 }
 }
 
 // Check for console errors
 const consoleErrors = [];
 page.on('console', msg => {
 if (msg.type() === 'error') {
 consoleErrors.push(msg.text());
 }
 });
 
 // Check page performance
 const metrics = await page.metrics();
 console.log(` ${colors.cyan}${colors.reset} Load time: ${Math.round(metrics.TaskDuration * 1000)}ms`);
 
 } catch (error) {
 console.log(` ${colors.red}${colors.reset} Page failed to load: ${error.message}`);
 results.failed.push({
 page: pageConfig.name,
 error: `Page load failed: ${error.message}`
 });
 }
}

async function runTests() {
 console.log(`${colors.bright}${colors.cyan}Starting Production UI Tests${colors.reset}`);
 console.log(`Testing: ${BASE_URL}\n`);
 
 // Create screenshots directory
 if (!fs.existsSync('screenshots')) {
 fs.mkdirSync('screenshots');
 }
 
 let browser;
 
 try {
 // Check if Puppeteer is installed
 if (!puppeteer) {
 console.log(`${colors.yellow}Puppeteer not installed. Running basic HTTP tests only.${colors.reset}`);
 return runBasicTests();
 }
 
 // Launch browser
 browser = await puppeteer.launch({
 headless: 'new',
 args: ['--no-sandbox', '--disable-setuid-sandbox']
 });
 
 const page = await browser.newPage();
 await page.setViewport({ width: 1280, height: 800 });
 
 // Test each page
 for (const pageConfig of pagesToTest) {
 await testPage(browser, page, pageConfig);
 }
 
 } catch (error) {
 console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
 } finally {
 if (browser) {
 await browser.close();
 }
 }
 
 generateReport();
}

async function runBasicTests() {
 // Fallback to basic HTTP tests if Puppeteer is not available
 const http = require('http');
 
 for (const pageConfig of pagesToTest) {
 console.log(`\nTesting ${colors.bright}${pageConfig.name}${colors.reset} (${pageConfig.path})`);
 
 try {
 const response = await new Promise((resolve, reject) => {
 http.get(`${BASE_URL}${pageConfig.path}`, (res) => {
 let data = '';
 res.on('data', chunk => data += chunk);
 res.on('end', () => resolve({ status: res.statusCode, data }));
 }).on('error', reject);
 });
 
 if (response.status === 200) {
 console.log(` ${colors.green}${colors.reset} Page loads successfully`);
 results.passed.push(`${pageConfig.name}: Page loads`);
 
 // Basic content checks
 if (response.data.includes(pageConfig.elements[0]?.text || pageConfig.name)) {
 console.log(` ${colors.green}${colors.reset} Page title found`);
 results.passed.push(`${pageConfig.name}: Title present`);
 }
 
 // Check for CSS
 if (response.data.includes('stylesheet')) {
 console.log(` ${colors.green}${colors.reset} CSS loaded`);
 results.passed.push(`${pageConfig.name}: Styles present`);
 }
 } else {
 throw new Error(`HTTP ${response.status}`);
 }
 } catch (error) {
 console.log(` ${colors.red}${colors.reset} Failed: ${error.message}`);
 results.failed.push({
 page: pageConfig.name,
 error: error.message
 });
 }
 }
}

function generateReport() {
 console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(60)}${colors.reset}`);
 console.log(`${colors.bright}${colors.cyan}Production UI Test Report${colors.reset}`);
 console.log(`${colors.bright}${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
 
 const totalTests = results.passed.length + results.failed.length;
 const passRate = totalTests > 0 ? ((results.passed.length / totalTests) * 100).toFixed(1) : 0;
 
 console.log(`${colors.bright}Summary:${colors.reset}`);
 console.log(` Total Tests: ${totalTests}`);
 console.log(` ${colors.green}Passed: ${results.passed.length}${colors.reset}`);
 console.log(` ${colors.red}Failed: ${results.failed.length}${colors.reset}`);
 console.log(` Pass Rate: ${passRate}%`);
 
 if (results.screenshots.length > 0) {
 console.log(`\n${colors.bright}Screenshots:${colors.reset}`);
 results.screenshots.forEach(path => {
 console.log(` • ${path}`);
 });
 }
 
 if (results.failed.length > 0) {
 console.log(`\n${colors.bright}${colors.red}Failed Tests:${colors.reset}`);
 results.failed.forEach(failure => {
 console.log(` • ${failure.page}: ${failure.element || failure.interaction || 'Page load'}`);
 console.log(` ${colors.red}${failure.error}${colors.reset}`);
 });
 }
 
 console.log(`\n${colors.bright}Pages Tested:${colors.reset}`);
 const testedPages = [...new Set([
 ...results.passed.map(p => p.split(':')[0]),
 ...results.failed.map(f => f.page)
 ])];
 testedPages.forEach(page => {
 console.log(` ${page}`);
 });
 
 const verdict = results.failed.length === 0 ? 
 `${colors.green}${colors.bright} All UI tests passed!${colors.reset}` :
 `${colors.yellow}${colors.bright} Some tests failed. Check screenshots for visual verification.${colors.reset}`;
 
 console.log(`\n${verdict}\n`);
 
 // Save report
 const reportData = {
 timestamp: new Date().toISOString(),
 summary: {
 total: totalTests,
 passed: results.passed.length,
 failed: results.failed.length,
 passRate
 },
 results,
 testedPages
 };
 
 fs.writeFileSync('ui-test-report.json', JSON.stringify(reportData, null, 2));
 console.log(`Report saved to: ui-test-report.json`);
}

// Run the tests
runTests().catch(console.error);