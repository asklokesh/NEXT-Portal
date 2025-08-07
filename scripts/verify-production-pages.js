#!/usr/bin/env node

/**
 * Simple production page verification script
 * Verifies all pages load correctly and have basic structure
 */

const http = require('http');
const https = require('https');

const BASE_URL = 'http://localhost:4400';

// Color codes
const colors = {
 reset: '\x1b[0m',
 bright: '\x1b[1m',
 green: '\x1b[32m',
 red: '\x1b[31m',
 yellow: '\x1b[33m',
 blue: '\x1b[34m',
 cyan: '\x1b[36m'
};

// Pages to verify
const pages = [
 { name: 'Home', path: '/' },
 { name: 'Dashboard', path: '/dashboard' },
 { name: 'Service Catalog', path: '/catalog' },
 { name: 'Service Relationships', path: '/catalog/relationships' },
 { name: 'Templates', path: '/templates' },
 { name: 'Plugins', path: '/plugins' },
 { name: 'Workflows', path: '/workflows' },
 { name: 'Deployments', path: '/deployments' },
 { name: 'Health Monitor', path: '/health' },
 { name: 'Analytics', path: '/analytics' },
 { name: 'Cost Tracking', path: '/cost' },
 { name: 'Monitoring', path: '/monitoring' },
 { name: 'Activity Feed', path: '/activity' },
 { name: 'Documentation', path: '/docs' },
 { name: 'API Docs', path: '/api-docs' },
 { name: 'Teams', path: '/teams' },
 { name: 'Settings', path: '/settings' },
 { name: 'Admin', path: '/admin' }
];

const results = {
 passed: [],
 failed: []
};

async function checkPage(page) {
 return new Promise((resolve) => {
 const startTime = Date.now();
 
 http.get(`${BASE_URL}${page.path}`, (res) => {
 let data = '';
 res.on('data', chunk => data += chunk);
 res.on('end', () => {
 const loadTime = Date.now() - startTime;
 
 if (res.statusCode === 200) {
 // Check for essential elements
 const hasHTML = data.includes('<!DOCTYPE html>') || data.includes('<html');
 const hasCSS = data.includes('stylesheet') || data.includes('/_next/static/css/');
 const hasJS = data.includes('script') || data.includes('/_next/static/');
 const hasContent = data.length > 1000; // Basic content check
 
 if (hasHTML && hasCSS && hasJS && hasContent) {
 console.log(`${colors.green}${colors.reset} ${page.name.padEnd(25)} - ${loadTime}ms`);
 results.passed.push(page.name);
 } else {
 console.log(`${colors.yellow}${colors.reset} ${page.name.padEnd(25)} - Missing: ${!hasHTML ? 'HTML ' : ''}${!hasCSS ? 'CSS ' : ''}${!hasJS ? 'JS ' : ''}${!hasContent ? 'Content' : ''}`);
 results.failed.push({ page: page.name, issue: 'Incomplete page structure' });
 }
 } else {
 console.log(`${colors.red}${colors.reset} ${page.name.padEnd(25)} - HTTP ${res.statusCode}`);
 results.failed.push({ page: page.name, issue: `HTTP ${res.statusCode}` });
 }
 
 resolve();
 });
 }).on('error', (err) => {
 console.log(`${colors.red}${colors.reset} ${page.name.padEnd(25)} - ${err.message}`);
 results.failed.push({ page: page.name, issue: err.message });
 resolve();
 });
 });
}

async function verifyProduction() {
 console.log(`${colors.bright}${colors.cyan}Production Page Verification${colors.reset}`);
 console.log(`${colors.cyan}Testing: ${BASE_URL}${colors.reset}\n`);
 
 // Check if server is running
 try {
 await checkPage({ name: 'Server Health', path: '/api/health' });
 } catch (err) {
 console.error(`${colors.red}Server not running at ${BASE_URL}${colors.reset}`);
 process.exit(1);
 }
 
 console.log(`\n${colors.bright}Page Status:${colors.reset}`);
 console.log('-'.repeat(40));
 
 // Check all pages
 for (const page of pages) {
 await checkPage(page);
 }
 
 // Summary
 console.log('\n' + '='.repeat(50));
 console.log(`${colors.bright}Summary:${colors.reset}`);
 console.log(` Total Pages: ${pages.length}`);
 console.log(` ${colors.green}Working: ${results.passed.length}${colors.reset}`);
 console.log(` ${colors.red}Issues: ${results.failed.length}${colors.reset}`);
 console.log(` Success Rate: ${((results.passed.length / pages.length) * 100).toFixed(1)}%`);
 
 if (results.failed.length > 0) {
 console.log(`\n${colors.yellow}Pages with issues:${colors.reset}`);
 results.failed.forEach(f => {
 console.log(` - ${f.page}: ${f.issue}`);
 });
 }
 
 const allWorking = results.failed.length === 0;
 console.log(`\n${allWorking ? colors.green : colors.yellow}${colors.bright}${allWorking ? ' All pages are functioning properly!' : ' Some pages need attention.'}${colors.reset}\n`);
}

// Run verification
verifyProduction().catch(console.error);