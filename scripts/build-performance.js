#!/usr/bin/env node
/**
 * Build entrypoint used by `npm run build`.
 * Runs Next.js production build with enterprise memory defaults.
 */
const { spawnSync } = require('child_process');

const nodeOptions = process.env.NODE_OPTIONS || '';
if (!nodeOptions.includes('--max_old_space_size')) {
  process.env.NODE_OPTIONS = `${nodeOptions} --max_old_space_size=8192`.trim();
}

const start = Date.now();
console.log('Starting NEXT Portal production build...');

const result = spawnSync('npx', ['next', 'build'], {
  stdio: 'inherit',
  env: process.env,
  shell: false,
});

const elapsedMs = Date.now() - start;
console.log(`Build finished in ${(elapsedMs / 1000).toFixed(1)}s (exit ${result.status ?? 1})`);
process.exit(result.status === 0 ? 0 : 1);
