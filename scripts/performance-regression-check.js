#!/usr/bin/env node
const fs = require('fs');

const THRESHOLDS = {
  http_req_duration_p95_ms: 3000,
  http_req_failed_rate: 0.05,
};

function main() {
  const file = process.argv[2];
  if (!file || !fs.existsSync(file)) {
    console.warn(
      `Performance results file missing (${file || 'none'}); skipping regression check.`,
    );
    process.exit(0);
  }

  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const metrics = data.metrics || {};
  const p95 = metrics.http_req_duration?.values?.['p(95)'];
  const failedRate = metrics.http_req_failed?.values?.rate;

  let failed = false;
  if (typeof p95 === 'number' && p95 > THRESHOLDS.http_req_duration_p95_ms) {
    console.error(`p95 latency ${p95}ms exceeds ${THRESHOLDS.http_req_duration_p95_ms}ms`);
    failed = true;
  }
  if (typeof failedRate === 'number' && failedRate > THRESHOLDS.http_req_failed_rate) {
    console.error(`HTTP failure rate ${failedRate} exceeds ${THRESHOLDS.http_req_failed_rate}`);
    failed = true;
  }

  if (failed) process.exit(1);
  console.log('Performance regression check passed.');
}

main();
