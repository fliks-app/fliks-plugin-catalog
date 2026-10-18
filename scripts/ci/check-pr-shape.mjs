#!/usr/bin/env node
// A published version is immutable: its `versions/<v>.json` and its signed archive under `dist/`
// pin a checksum an installed plugin was verified against, so neither may be modified or deleted.
// `src/` is the input a new version is built from — publishing one necessarily rewrites it.
// Retiring a whole plugin (its directory gone at head) deletes its versions together, never one.
import { execSync } from 'node:child_process';

/** The checksum-pinned artefacts a published version is installed against. */
const PUBLISHED = /^plugins\/[^/]+\/(versions\/.*\.json|dist\/.*)$/;

/** Exported for `check-pr-shape.test.mjs`: the rule is the parse, not the `git diff` around it.
 *  `retired`: ids whose `plugins/<id>/` no longer exists at head. */
export function violationsIn(nameStatusDiff, retired = new Set()) {
  const out = [];
  for (const line of nameStatusDiff.split('\n').filter(Boolean)) {
    const [status, ...pathParts] = line.split('\t');
    if (status === 'A') continue;
    // A rename moves a published file away; its destination is an addition, not a violation.
    const touched = status.startsWith('R') ? pathParts.slice(0, 1) : pathParts;
    for (const path of touched) {
      if (status === 'D' && retired.has(path.split('/')[1])) continue;
      if (PUBLISHED.test(path)) {
        out.push(
          `${path}: status "${status}" — a published version's descriptor and archive are immutable; add a new version instead`,
        );
      }
    }
  }
  return out;
}

function main() {
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

  const deleted = new Set(
    diff.split('\n').filter((l) => l.startsWith('D\t')).map((l) => l.split('\t')[1].split('/')[1]),
  );
  const retired = new Set(
    [...deleted].filter((id) => execSync(`git ls-tree --name-only ${head} plugins/${id}`, { encoding: 'utf8' }).trim() === ''),
  );
  const violations = violationsIn(diff, retired);

  if (violations.length > 0) {
    console.error(`check-pr-shape: ${violations.length} violation(s):\n${violations.map((v) => `  - ${v}`).join('\n')}`);
    process.exit(1);
  }
  console.log(`check-pr-shape: ok (${diff.split('\n').length} file(s) added under plugins/)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
