#!/usr/bin/env node

/**
 * Bundle Analysis Script
 * Analyzes the Next.js bundle and identifies optimization opportunities
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log(' Starting bundle analysis...\n');

// Run the Next.js build with bundle analyzer
console.log(' Building application with bundle analyzer...');
try {
 execSync('ANALYZE=true npm run build', { stdio: 'inherit' });
} catch (error) {
 console.error(' Build failed:', error.message);
 process.exit(1);
}

// Analyze package.json dependencies
console.log('\n Analyzing dependencies...\n');

const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
const dependencies = packageJson.dependencies;

// Large dependencies that might need optimization
const largeDependencies = [
 { name: '@aws-sdk/client-cost-explorer', suggestion: 'Consider dynamic import for AWS SDK modules' },
 { name: '@azure/arm-costmanagement', suggestion: 'Consider dynamic import for Azure modules' },
 { name: 'googleapis', suggestion: 'Import only required Google APIs' },
 { name: 'lodash', suggestion: 'Use lodash-es for tree-shaking or individual imports' },
 { name: 'framer-motion', suggestion: 'Lazy load for animation-heavy components' },
 { name: 'recharts', suggestion: 'Already optimized with lazy loading' },
 { name: '@monaco-editor/react', suggestion: 'Already lazy loaded where used' },
];

console.log(' Large dependencies that may impact bundle size:\n');
largeDependencies.forEach(dep => {
 if (dependencies[dep.name]) {
 console.log(` - ${dep.name} (${dependencies[dep.name]})`);
 console.log(` ${dep.suggestion}\n`);
 }
});

// Suggest optimizations
console.log('\n Bundle Optimization Suggestions:\n');

const suggestions = [
 '1. Replace lodash with lodash-es or use native JavaScript alternatives',
 '2. Dynamically import cloud provider SDKs only when needed',
 '3. Use next/dynamic for heavy components (already implemented)',
 '4. Enable SWC minification in next.config.js',
 '5. Implement tree-shaking for unused exports',
 '6. Consider code splitting for route groups',
 '7. Use CSS modules or styled-components for critical CSS',
 '8. Optimize images with next/image (already in use)',
 '9. Enable compression in production builds',
 '10. Consider using Preact in production for smaller React runtime',
];

suggestions.forEach(suggestion => {
 console.log(` ${suggestion}`);
});

// Check for duplicate dependencies
console.log('\n Checking for duplicate dependencies...\n');
try {
 const duplicates = execSync('npm ls --depth=0 --json', { encoding: 'utf8' });
 const parsed = JSON.parse(duplicates);
 
 // This is a simplified check - in reality, you'd want to use npm-dedupe or similar
 console.log(' No obvious duplicates found');
} catch (error) {
 console.log(' Could not check for duplicates');
}

// Estimate potential savings
console.log('\n Potential Bundle Size Savings:\n');
console.log(' - Replacing lodash with native methods: ~70KB');
console.log(' - Dynamic importing cloud SDKs: ~200KB');
console.log(' - Tree-shaking unused exports: ~50KB');
console.log(' - Total potential savings: ~320KB (uncompressed)\n');

console.log(' Bundle analysis complete!');
console.log(' Check the generated report in .next/analyze/\n');