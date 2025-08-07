#!/usr/bin/env node

const puppeteer = require('puppeteer');

const BASE_URL = 'http://localhost:4400';

// Pages to test
const pages = [
 '/dashboard',
 '/catalog',
 '/catalog/relationships',
 '/templates',
 '/plugins',
 '/workflows',
 '/deployments',
 '/health',
 '/analytics',
 '/cost',
 '/monitoring',
 '/activity',
 '/docs',
 '/api-docs',
 '/teams',
 '/settings',
 '/admin'
];

async function testPage(browser, path) {
 const page = await browser.newPage();
 const errors = [];
 
 // Capture console errors
 page.on('console', msg => {
 if (msg.type() === 'error') {
 errors.push(msg.text());
 }
 });
 
 // Capture page errors
 page.on('error', err => {
 errors.push(`Page error: ${err.message}`);
 });
 
 // Capture uncaught exceptions
 page.on('pageerror', err => {
 errors.push(`Uncaught exception: ${err.message}`);
 });
 
 try {
 const response = await page.goto(`${BASE_URL}${path}`, {
 waitUntil: 'networkidle2',
 timeout: 30000
 });
 
 // Wait a bit for any async errors
 await new Promise(resolve => setTimeout(resolve, 1000));
 
 const status = response.status();
 const hasErrors = errors.length > 0;
 
 console.log(`${path}: ${status} - ${hasErrors ? ' HAS ERRORS' : ' NO ERRORS'}`);
 if (hasErrors) {
 errors.forEach(err => console.log(` └─ ${err}`));
 }
 
 await page.close();
 return { path, status, errors };
 } catch (err) {
 console.log(`${path}: FAILED - ${err.message}`);
 await page.close();
 return { path, status: 0, errors: [`Navigation failed: ${err.message}`] };
 }
}

async function runTests() {
 console.log('Starting browser error tests...\n');
 
 const browser = await puppeteer.launch({
 headless: 'new',
 args: ['--no-sandbox', '--disable-setuid-sandbox']
 });
 
 const results = [];
 
 for (const path of pages) {
 const result = await testPage(browser, path);
 results.push(result);
 }
 
 await browser.close();
 
 // Summary
 console.log('\n=== SUMMARY ===');
 const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
 const pagesWithErrors = results.filter(r => r.errors.length > 0).length;
 
 console.log(`Total pages tested: ${results.length}`);
 console.log(`Pages with errors: ${pagesWithErrors}`);
 console.log(`Total errors found: ${totalErrors}`);
 
 if (totalErrors === 0) {
 console.log('\n All pages loaded without client-side errors!');
 } else {
 console.log('\n Some pages have client-side errors that need fixing.');
 }
}

runTests().catch(console.error);