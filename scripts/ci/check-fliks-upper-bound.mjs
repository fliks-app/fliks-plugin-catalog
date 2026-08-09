#!/usr/bin/env node
// Named separately from general schema validity (plan, "Registry CI": "mandatory
// fliks upper bound" is its own bullet) — a lower-bound-only range is the single
// most-reported plugin failure upstream and earns its own named refusal.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasMandatoryUpperBound } from '../lib/semver-lite.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PLUGINS_DIR = join(ROOT, 'plugins');

const violations = [];
if (existsSync(PLUGINS_DIR)) {
  for (const pluginDir of readdirSync(PLUGINS_DIR, { withFileTypes: true })) {
    if (!pluginDir.isDirectory()) continue;
    const versionsDir = join(PLUGINS_DIR, pluginDir.name, 'versions');
    if (!existsSync(versionsDir)) continue;
    for (const file of readdirSync(versionsDir)) {
      if (!file.endsWith('.json')) continue;
      const path = `plugins/${pluginDir.name}/versions/${file}`;
      let entry;
      try {
        entry = JSON.parse(readFileSync(join(versionsDir, file), 'utf8'));
      } catch {
        continue; // build-catalog.mjs's job to report malformed JSON
      }
      if (!hasMandatoryUpperBound(entry.fliks)) {
        violations.push(`${path}: "fliks" (${JSON.stringify(entry.fliks)}) has no mandatory upper bound`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error(`check-fliks-upper-bound: ${violations.length} violation(s):\n${violations.map((v) => `  - ${v}`).join('\n')}`);
  process.exit(1);
}
console.log('check-fliks-upper-bound: ok');
