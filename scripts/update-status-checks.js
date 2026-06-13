#!/usr/bin/env node
const fs = require('fs');

async function main() {
  const sha = process.argv[2] || process.env.GITHUB_SHA || 'local';
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;

  if (!token || !repo || !process.env.GITHUB_API_URL) {
    console.log(`Skipping GitHub status update for ${sha} (not running in GitHub Actions).`);
    process.exit(0);
  }

  const summaryPath = 'test-summary.json';
  const failed = fs.existsSync(summaryPath)
    ? JSON.parse(fs.readFileSync(summaryPath, 'utf8')).failedTests > 0
    : false;

  const [owner, name] = repo.split('/');
  const state = failed ? 'failure' : 'success';
  const res = await fetch(`${process.env.GITHUB_API_URL}/repos/${owner}/${name}/statuses/${sha}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      state,
      context: 'plugin-system/comprehensive-tests',
      description: failed ? 'One or more test suites failed' : 'All aggregated tests passed',
    }),
  });

  if (!res.ok) {
    console.error(`Failed to publish status: ${res.status} ${await res.text()}`);
    process.exit(1);
  }

  console.log(`Published GitHub status ${state} for ${sha}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
