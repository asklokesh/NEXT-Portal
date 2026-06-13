#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const summaryPath = path.resolve('test-summary.json');
if (!fs.existsSync(summaryPath)) {
  const resultsPath = process.argv[2] || './test-results';
  const agg = spawnSync(
    process.execPath,
    [path.join(__dirname, 'aggregate-test-results.js'), resultsPath],
    {
      stdio: 'inherit',
    },
  );
  if (agg.status !== 0 && !fs.existsSync(summaryPath)) {
    process.exit(agg.status || 1);
  }
}

if (!fs.existsSync(summaryPath)) {
  console.error('test-summary.json not found after aggregation');
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
const report = {
  generatedAt: new Date().toISOString(),
  summary,
  status: summary.failedTests > 0 ? 'failed' : 'passed',
};

fs.writeFileSync('test-report.json', JSON.stringify(report, null, 2));
console.log(`Generated test-report.json (status: ${report.status})`);
process.exit(summary.failedTests > 0 ? 1 : 0);
