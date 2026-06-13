#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function walkJsonFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJsonFiles(full, out);
    else if (entry.isFile() && entry.name.endsWith('.json')) out.push(full);
  }
  return out;
}

function summarizeJest(filePath, data) {
  if (typeof data.numTotalTests !== 'number') return null;
  return {
    tests: data.numTotalTests,
    passed: data.numPassedTests || 0,
    failed: data.numFailedTests || 0,
    skipped: (data.numPendingTests || 0) + (data.numTodoTests || 0),
  };
}

function summarizeGeneric(data) {
  if (typeof data.tests !== 'number') return null;
  return {
    tests: data.tests,
    passed: data.passed || 0,
    failed: data.failed || 0,
    skipped: data.skipped || 0,
  };
}

async function main() {
  const resultsPath = process.argv[2] || './test-results';
  if (!fs.existsSync(resultsPath)) {
    console.error(`Results path does not exist: ${resultsPath}`);
    process.exit(1);
  }

  const summary = {
    timestamp: new Date().toISOString(),
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    skippedTests: 0,
    successRate: 0,
    files: [],
  };

  for (const file of walkJsonFiles(resultsPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      const partial = summarizeJest(file, data) || summarizeGeneric(data);
      if (!partial) continue;
      summary.totalTests += partial.tests;
      summary.passedTests += partial.passed;
      summary.failedTests += partial.failed;
      summary.skippedTests += partial.skipped;
      summary.files.push({ file, ...partial });
    } catch {
      // ignore unreadable artifacts
    }
  }

  summary.successRate = summary.totalTests > 0 ? summary.passedTests / summary.totalTests : 1;

  fs.writeFileSync('test-summary.json', JSON.stringify(summary, null, 2));
  fs.writeFileSync(
    'test-summary.md',
    `# Test Summary\n\n- Total: ${summary.totalTests}\n- Passed: ${summary.passedTests}\n- Failed: ${summary.failedTests}\n- Success rate: ${(summary.successRate * 100).toFixed(1)}%\n`,
  );
  fs.writeFileSync(
    'test-summary.html',
    `<!doctype html><html><body><h1>Test Summary</h1><pre>${JSON.stringify(summary, null, 2)}</pre></body></html>`,
  );

  console.log('Aggregated test results written to test-summary.{json,md,html}');
  process.exit(summary.failedTests > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
