#!/usr/bin/env node

/**
 * Comprehensive Health Check Script for NEXT Portal
 * Tests all critical functionality and reports system status
 */

const http = require('http');
const { performance } = require('perf_hooks');

const BASE_URL = 'http://localhost:4400';
const TIMEOUT = 5000;

// Critical routes to test
const ROUTES = [
  { path: '/', name: 'Homepage' },
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/plugins', name: 'Plugins' },
  { path: '/catalog', name: 'Catalog' },
  { path: '/templates', name: 'Templates' },
  { path: '/templates/marketplace', name: 'Templates Marketplace' },
  { path: '/settings', name: 'Settings' }
];

// API endpoints to test
const API_ENDPOINTS = [
  { path: '/api/backstage/entities', name: 'Backstage Entities API', expectAuth: false },
  { path: '/api/catalog/services', name: 'Catalog Services API', expectAuth: false },
  { path: '/api/plugin-health', name: 'Plugin Health API', expectAuth: true },
  { path: '/api/plugins', name: 'Plugins API', expectAuth: true }
];

async function makeRequest(url, timeout = TIMEOUT) {
  return new Promise((resolve, reject) => {
    const startTime = performance.now();
    
    const req = http.get(url, { timeout }, (res) => {
      const endTime = performance.now();
      const responseTime = Math.round(endTime - startTime);
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          responseTime,
          contentLength: data.length,
          headers: res.headers
        });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.on('error', reject);
  });
}

async function testRoute(route) {
  try {
    const result = await makeRequest(`${BASE_URL}${route.path}`);
    const status = result.statusCode >= 200 && result.statusCode < 400 ? 'PASS' : 'WARN';
    
    return {
      name: route.name,
      path: route.path,
      status,
      statusCode: result.statusCode,
      responseTime: result.responseTime,
      contentLength: result.contentLength,
      error: null
    };
  } catch (error) {
    return {
      name: route.name,
      path: route.path,
      status: 'FAIL',
      statusCode: null,
      responseTime: null,
      contentLength: null,
      error: error.message
    };
  }
}

async function testApiEndpoint(endpoint) {
  try {
    const result = await makeRequest(`${BASE_URL}${endpoint.path}`);
    let status = 'PASS';
    
    if (endpoint.expectAuth && result.statusCode === 401) {
      status = 'PASS'; // Expected authentication error
    } else if (result.statusCode >= 400) {
      status = 'WARN';
    }
    
    return {
      name: endpoint.name,
      path: endpoint.path,
      status,
      statusCode: result.statusCode,
      responseTime: result.responseTime,
      expectAuth: endpoint.expectAuth,
      error: null
    };
  } catch (error) {
    return {
      name: endpoint.name,
      path: endpoint.path,
      status: 'FAIL',
      statusCode: null,
      responseTime: null,
      expectAuth: endpoint.expectAuth,
      error: error.message
    };
  }
}

async function runHealthCheck() {
  console.log('🏥 NEXT Portal Health Check');
  console.log('='.repeat(50));
  console.log(`Testing server at: ${BASE_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('');

  // Test routes
  console.log('📄 Testing Page Routes...');
  console.log('-'.repeat(30));
  
  const routeResults = [];
  for (const route of ROUTES) {
    const result = await testRoute(route);
    routeResults.push(result);
    
    const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌';
    const responseTime = result.responseTime ? `${result.responseTime}ms` : 'N/A';
    const statusCode = result.statusCode || 'ERR';
    
    console.log(`${statusIcon} ${result.name.padEnd(20)} [${statusCode}] ${responseTime}`);
    
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }

  console.log('');

  // Test API endpoints
  console.log('🔌 Testing API Endpoints...');
  console.log('-'.repeat(30));
  
  const apiResults = [];
  for (const endpoint of API_ENDPOINTS) {
    const result = await testApiEndpoint(endpoint);
    apiResults.push(result);
    
    const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌';
    const responseTime = result.responseTime ? `${result.responseTime}ms` : 'N/A';
    const statusCode = result.statusCode || 'ERR';
    const authNote = result.expectAuth ? '(Auth Required)' : '';
    
    console.log(`${statusIcon} ${result.name.padEnd(20)} [${statusCode}] ${responseTime} ${authNote}`);
    
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }

  console.log('');

  // Summary
  const allResults = [...routeResults, ...apiResults];
  const passCount = allResults.filter(r => r.status === 'PASS').length;
  const warnCount = allResults.filter(r => r.status === 'WARN').length;
  const failCount = allResults.filter(r => r.status === 'FAIL').length;
  const totalCount = allResults.length;

  const avgResponseTime = Math.round(
    allResults
      .filter(r => r.responseTime)
      .reduce((sum, r) => sum + r.responseTime, 0) / 
    allResults.filter(r => r.responseTime).length || 0
  );

  console.log('📊 Health Check Summary');
  console.log('-'.repeat(30));
  console.log(`✅ Passed: ${passCount}/${totalCount}`);
  console.log(`⚠️  Warnings: ${warnCount}/${totalCount}`);
  console.log(`❌ Failed: ${failCount}/${totalCount}`);
  console.log(`⏱️  Avg Response Time: ${avgResponseTime}ms`);
  console.log('');

  // Overall health status
  let overallStatus = 'HEALTHY';
  let statusIcon = '✅';

  if (failCount > 0) {
    overallStatus = 'CRITICAL';
    statusIcon = '❌';
  } else if (warnCount > 0) {
    overallStatus = 'WARNING';
    statusIcon = '⚠️';
  }

  console.log(`${statusIcon} Overall Status: ${overallStatus}`);
  console.log('='.repeat(50));

  // Exit with appropriate code
  process.exit(failCount > 0 ? 1 : 0);
}

// Run the health check
if (require.main === module) {
  runHealthCheck().catch(error => {
    console.error('❌ Health check failed:', error.message);
    process.exit(1);
  });
}

module.exports = { runHealthCheck, testRoute, testApiEndpoint };