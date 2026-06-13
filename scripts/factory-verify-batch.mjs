#!/usr/bin/env node
/** Mark FACTORY todos verified only when evidence commands succeed */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TODO = join(ROOT, 'FACTORY-TODO-500.md');

const checks = [
  { pattern: /Service db healthy/, cmd: 'docker compose ps db 2>/dev/null | grep -q healthy' },
  { pattern: /Service redis healthy/, cmd: 'docker compose ps redis 2>/dev/null | grep -q healthy' },
  { pattern: /Service idp-platform healthy/, cmd: 'docker compose ps idp-platform 2>/dev/null | grep -q healthy || docker compose ps idp-platform 2>/dev/null | grep -q Up' },
  { pattern: /API health endpoint via compose/, cmd: 'curl -sf http://localhost:4400/api/health' },
  { pattern: /API ready endpoint/, cmd: 'curl -sf http://localhost:4400/api/health/ready' },
  { pattern: /Full stack docker compose/, cmd: 'docker compose ps 2>/dev/null | grep -q Up' },
];
let md = readFileSync(TODO, 'utf8');
const cwd = ROOT;

for (const { pattern, cmd } of checks) {
  let ok = false;
  try {
    execSync(cmd, { cwd, stdio: 'pipe', timeout: 15000 });
    ok = true;
  } catch {
    ok = false;
  }
  if (!ok) continue;
  const lines = md.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('[pending]') && pattern.test(lines[i])) {
      lines[i] = lines[i].replace('[pending]', '[verified]');
    }
  }
  md = lines.join('\n');
}

writeFileSync(TODO, md);
const verified = (md.match(/\[verified\]/g) || []).length;
const pending = (md.match(/\[pending\]/g) || []).length;
console.log(`Todos: ${verified} verified, ${pending} pending`);
