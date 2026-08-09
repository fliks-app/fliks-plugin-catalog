#!/usr/bin/env node
// "Adds files only, never modifies a published versions/*.json" — the cheapest
// refusal in the review order, because it costs one git diff and nothing else:
// no JSON parsing, no network, no archive.
import { execSync } from 'node:child_process';

const base = process.argv[2];
const head = process.argv[3] ?? 'HEAD';
if (!base) {
  console.error('usage: node scripts/ci/check-pr-shape.mjs <baseRef> [headRef]');
  process.exit(2);
}

const diff = execSync(`git diff --name-status ${base}...${head} -- plugins/`, { encoding: 'utf8' }).trim();
if (diff === '') {
  console.log('no changes under plugins/ — nothing to check');
  process.exit(0);
}

const violations = [];
for (const line of diff.split('\n')) {
  const [status, ...pathParts] = line.split('\t');
  const path = pathParts.join('\t');
  if (status !== 'A') {
    violations.push(
      `${path}: status "${status}" — a PR may only ADD files under plugins/, never modify or delete a published version`,
    );
  }
}

if (violations.length > 0) {
  console.error(`check-pr-shape: ${violations.length} violation(s):\n${violations.map((v) => `  - ${v}`).join('\n')}`);
  process.exit(1);
}
console.log(`check-pr-shape: ok (${diff.split('\n').length} file(s) added under plugins/)`);
