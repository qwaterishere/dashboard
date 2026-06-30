#!/usr/bin/env node
/**
 * Fail CI if dangerous patterns appear in frontend/src.
 * See AGENTS.md §8.10
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', 'src');
const FORBIDDEN = [
  /\binnerHTML\b/,
  /bypassSecurityTrust/,
  /\beval\s*\(/,
  /new Function\s*\(/,
  /document\.write\s*\(/,
];

const violations = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) {
      walk(path);
      continue;
    }
    if (!/\.(ts|html)$/.test(name)) continue;
    if (/\.spec\.ts$/.test(name)) continue;
    if (name === 'xss-test.utils.ts') continue;
    const text = readFileSync(path, 'utf8');
    for (const pattern of FORBIDDEN) {
      if (pattern.test(text)) {
        violations.push(`${path}: ${pattern}`);
      }
    }
  }
}

walk(ROOT);

if (violations.length) {
  console.error('Security grep failed:\n' + violations.join('\n'));
  process.exit(1);
}

console.log('Security grep: OK');
