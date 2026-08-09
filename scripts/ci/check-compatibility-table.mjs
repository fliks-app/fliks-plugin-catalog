#!/usr/bin/env node
// Every `pluginApi` used under plugins/ must have a row in COMPATIBILITY.md — a
// plugin submission can never be the first thing that tells this repo a
// `pluginApi` value exists.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const COMPAT_FILE = join(ROOT, 'COMPATIBILITY.md');
const PLUGINS_DIR = join(ROOT, 'plugins');

const declared = new Set();
for (const line of readFileSync(COMPAT_FILE, 'utf8').split('\n')) {
  const m = /^\|\s*`(\d+)`\s*\|/.exec(line);
  if (m) declared.add(Number(m[1]));
}
if (declared.size === 0) {
  console.error(`check-compatibility-table: found no "| \`<pluginApi>\` |" row in ${COMPAT_FILE}`);
  process.exit(1);
}

const used = new Set();
if (existsSync(PLUGINS_DIR)) {
  for (const pluginDir of readdirSync(PLUGINS_DIR, { withFileTypes: true })) {
    if (!pluginDir.isDirectory()) continue;
    const versionsDir = join(PLUGINS_DIR, pluginDir.name, 'versions');
    if (!existsSync(versionsDir)) continue;
    for (const file of readdirSync(versionsDir)) {
      if (!file.endsWith('.json')) continue;
      try {
        const entry = JSON.parse(readFileSync(join(versionsDir, file), 'utf8'));
        if (typeof entry.pluginApi === 'number') used.add(entry.pluginApi);
      } catch {
        // Malformed JSON is build-catalog.mjs's job to report; nothing to add here.
      }
    }
  }
}

const missing = [...used].filter((v) => !declared.has(v));
if (missing.length > 0) {
  console.error(`check-compatibility-table: pluginApi ${missing.join(', ')} used under plugins/ but not declared in COMPATIBILITY.md`);
  process.exit(1);
}
console.log(`check-compatibility-table: ok (declared: ${[...declared].join(', ') || '(none)'}; used: ${[...used].join(', ') || '(none)'})`);
