#!/usr/bin/env node
// Walks plugins/*/versions/*.json, validates each, and writes catalog.json in the
// shape backend/src/modules/plugins/catalog/catalog.ts's parseCatalogDocument
// accepts. Key order and sort order are fixed so an unchanged input tree produces
// byte-identical output — see docs/key-rotation.md for the determinism proof.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateEntry } from './lib/validate-entry.mjs';
import { compareSemver } from './lib/semver-lite.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PLUGINS_DIR = join(ROOT, 'plugins');
const OUT_FILE = join(ROOT, 'catalog.json');

/**
 * What a descriptor carries between being committed and the packaging workflow signing its
 * archive. Publishing it anyway served an installable version whose checksum matched nothing,
 * and an installer that cached the catalog in that window kept failing the check until its next
 * refresh. It is a placeholder, not a checksum, so the version is held back until its archive
 * exists.
 */
const PLACEHOLDER_SHA256 = '0'.repeat(64);

/** Exported for `build-catalog.test.mjs`: the rule is the comparison, not the loop around it. */
export function isPlaceholderChecksum(sha256) {
  return sha256 === PLACEHOLDER_SHA256;
}

/** @returns {{ path: string, pluginDir: string }[]} */
function listVersionFiles() {
  if (!existsSync(PLUGINS_DIR)) return [];
  const found = [];
  for (const pluginDir of readdirSync(PLUGINS_DIR, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (!pluginDir.isDirectory()) continue;
    const versionsDir = join(PLUGINS_DIR, pluginDir.name, 'versions');
    if (!existsSync(versionsDir)) continue;
    for (const file of readdirSync(versionsDir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (file.isFile() && file.name.endsWith('.json')) {
        found.push({ path: join(versionsDir, file.name), pluginDir: pluginDir.name });
      }
    }
  }
  return found;
}

function main() {
  const errors = [];
  /** @type {Map<string, any[]>} */
  const byId = new Map();

  for (const { path, pluginDir } of listVersionFiles()) {
    const relPath = `plugins/${pluginDir}/versions/${path.split('/').pop()}`;
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(path, 'utf8'));
    } catch (err) {
      errors.push(`${relPath}: invalid JSON (${err.message})`);
      continue;
    }
    const result = validateEntry(parsed);
    if (!result.ok) {
      for (const e of result.errors) errors.push(`${relPath}: ${e}`);
      continue;
    }
    if (parsed.id !== pluginDir) {
      errors.push(`${relPath}: "id" (${JSON.stringify(parsed.id)}) must match its directory name "${pluginDir}"`);
      continue;
    }
    const expectedFile = `${parsed.version}.json`;
    if (path.split('/').pop() !== expectedFile) {
      errors.push(`${relPath}: "version" (${JSON.stringify(parsed.version)}) must match the filename "${expectedFile}"`);
      continue;
    }
    if (isPlaceholderChecksum(parsed.sha256)) {
      console.log(`${relPath}: held back — awaiting its signed archive`);
      continue;
    }
    const list = byId.get(parsed.id) ?? [];
    list.push(parsed);
    byId.set(parsed.id, list);
  }

  const pluginIds = [...byId.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const plugins = [];

  for (const id of pluginIds) {
    const entries = byId.get(id);
    for (const field of ['name', 'description', 'author', 'kind', 'logo']) {
      const values = new Set(entries.map((e) => e[field]));
      if (values.size > 1) {
        errors.push(`plugin "${id}": "${field}" differs across versions (${[...values].map((v) => JSON.stringify(v)).join(' vs ')})`);
      }
    }
    const versionValues = new Set(entries.map((e) => e.version));
    if (versionValues.size !== entries.length) {
      errors.push(`plugin "${id}": duplicate "version" across submitted files`);
    }

    const sorted = [...entries].sort((a, b) => compareSemver(a.version, b.version));
    plugins.push({
      id,
      name: entries[0].name,
      description: entries[0].description,
      author: entries[0].author,
      kind: entries[0].kind,
      // Plugin-level, not per-version: the card shows one logo whichever version it offers.
      ...(entries[0].logo ? { logo: entries[0].logo } : {}),
      versions: sorted.map((e) => ({
        version: e.version,
        pluginApi: e.pluginApi,
        fliks: e.fliks,
        zipUrl: e.zipUrl,
        sha256: e.sha256,
      })),
    });
  }

  if (errors.length > 0) {
    console.error(`build-catalog: ${errors.length} error(s):\n${errors.map((e) => `  - ${e}`).join('\n')}`);
    process.exit(1);
  }

  const document = { plugins };
  writeFileSync(OUT_FILE, JSON.stringify(document, null, 2) + '\n', 'utf8');
  const versionCount = plugins.reduce((n, p) => n + p.versions.length, 0);
  console.log(`wrote ${OUT_FILE} (${plugins.length} plugin${plugins.length === 1 ? '' : 's'}, ${versionCount} version(s))`);
}

// Guarded so importing this module — `build-catalog.test.mjs` does — cannot rewrite catalog.json
// as a side effect. Same shape as `check-pr-shape.mjs`.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
