#!/usr/bin/env node
// Builds one plugin's `.fkplugin` from `plugins/<id>/src/` and signs `plugin.json`
// with CATALOG_SIGNING_KEY — the same key that signs catalog.json, which is what
// lets the consumer's trust store (backend/src/modules/plugins/archive/trust-store.ts)
// resolve the archive to `official`. Zero dependencies: the ZIP is hand-assembled
// (store method, real CRC32 via node:zlib) to a layout the consumer's guard suite
// accepts by construction — see backend/src/modules/plugins/archive/limits.ts and
// zip-inspector.ts for the rules this mirrors: <=4 entries, no directories, no
// ZIP64, no data descriptor, exact literal names, one EOCD, no archive comment.
// A `runtime: "wasm"` plugin ships `plugin.wasm` instead of `plugin.js` (plugins.md rules 14, 16).
// `.github/workflows/package-plugin.yml` calls this rather than duplicating it.
import { createHash, createPrivateKey, createPublicKey, sign as ed25519Sign, verify as ed25519Verify } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix, win32 } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32 } from 'node:zlib';
import { isValidSemver } from './lib/semver-lite.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// Must match backend/src/modules/plugins/archive/limits.ts's LEGAL_ENTRY_NAMES.
const LOGO_NAMES = ['logo.svg', 'logo.png'];

export function fail(message) {
  console.error(`package-plugin: ${message}`);
  process.exit(1);
}

/** Base64 PKCS8-DER Ed25519 private key -> KeyObject, same parsing as scripts/sign-catalog.mjs. */
export function loadSigningKey(keyB64) {
  if (!keyB64 || keyB64.trim() === '') {
    fail('CATALOG_SIGNING_KEY is not set — refusing to package an unsigned first-party plugin.');
  }
  let privateKey;
  try {
    privateKey = createPrivateKey({ key: Buffer.from(keyB64.trim(), 'base64'), format: 'der', type: 'pkcs8' });
  } catch (err) {
    fail(`CATALOG_SIGNING_KEY is not a valid base64 PKCS8 Ed25519 private key (${err.message}).`);
  }
  if (privateKey.asymmetricKeyType !== 'ed25519') {
    fail(`CATALOG_SIGNING_KEY decodes to a "${privateKey.asymmetricKeyType}" key, not ed25519.`);
  }
  return privateKey;
}

/** Signs `data`, verifying sign-then-verify before returning — a broken key must fail here, not ship a bad signature. */
export function signManifest(privateKey, data) {
  const signature = ed25519Sign(null, data, privateKey);
  const publicKey = createPublicKey(privateKey);
  if (!ed25519Verify(null, data, publicKey, signature)) {
    fail('sign-then-verify failed immediately after signing — refusing to package.');
  }
  return signature;
}

function u16(n) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n, 0);
  return b;
}
function u32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}

/**
 * Hand-assembled ZIP, store method only (compressedSize === uncompressedSize,
 * so the ratio guard is trivially 1:1). No extra fields (no ZIP64), general-purpose
 * flag carries only the UTF-8 bit (no data-descriptor bit), external attributes 0
 * (no directory/symlink bits), single EOCD, no comment, no trailing bytes.
 * `entries` order becomes archive order; names must be the consumer's exact literals.
 */
export function buildPluginZip(entries) {
  const parts = [];
  const central = [];
  let offset = 0;

  for (const { name, content } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(content) >>> 0;
    const local = Buffer.concat([
      u32(0x04034b50),
      u16(20), // version needed
      u16(0x0800), // general purpose: UTF-8 filenames only
      u16(0), // compression method: store
      u16(0), // mod time
      u16(0x21), // mod date (an arbitrary valid DOS date)
      u32(crc),
      u32(content.length), // compressed size == uncompressed size (store)
      u32(content.length),
      u16(nameBuf.length),
      u16(0), // extra field length
    ]);
    parts.push(local, nameBuf, content);

    central.push(
      Buffer.concat([
        u32(0x02014b50),
        u16((3 << 8) | 20), // version made by: unix, spec 2.0
        u16(20), // version needed
        u16(0x0800),
        u16(0),
        u16(0),
        u16(0x21),
        u32(crc),
        u32(content.length),
        u32(content.length),
        u16(nameBuf.length),
        u16(0), // extra field length
        u16(0), // comment length
        u16(0), // disk number start
        u16(0), // internal file attributes
        u32(0), // external file attributes
        u32(offset),
        nameBuf,
      ]),
    );
    offset += local.length + nameBuf.length + content.length;
  }

  const centralDirectory = Buffer.concat(central);
  const eocd = Buffer.concat([
    u32(0x06054b50),
    u16(0), // disk number
    u16(0), // disk where central directory starts
    u16(entries.length),
    u16(entries.length),
    u32(centralDirectory.length),
    u32(offset),
    u16(0), // comment length
  ]);

  return Buffer.concat([...parts, centralDirectory, eocd]);
}

/**
 * Entries of an unsigned `.fkplugin` as built by `cargo xtask package`: the store-only layout
 * buildPluginZip writes, refused on anything else. A `plugin.json.sig` is dropped, since this
 * script re-signs (a re-run reads back the archive it published).
 */
export function readPluginZip(zip) {
  const bad = (what) => {
    throw new Error(`archive ${what}`);
  };
  const eocd = zip.length - 22;
  if (eocd < 0 || zip.readUInt32LE(eocd) !== 0x06054b50 || zip.readUInt16LE(eocd + 20) !== 0) bad('has no end record at its tail (or carries a comment)');
  const count = zip.readUInt16LE(eocd + 10);
  if (count < 1 || count > 4) bad(`has ${count} entries, the host takes 1 to 4`);
  const out = new Map();
  let at = zip.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(at) !== 0x02014b50) bad('has a malformed central directory');
    const [flags, method] = [zip.readUInt16LE(at + 8), zip.readUInt16LE(at + 10)];
    const [crc, size, usize] = [zip.readUInt32LE(at + 16), zip.readUInt32LE(at + 20), zip.readUInt32LE(at + 24)];
    const [nameLen, extraLen, commentLen] = [zip.readUInt16LE(at + 28), zip.readUInt16LE(at + 30), zip.readUInt16LE(at + 32)];
    const name = zip.toString('utf8', at + 46, at + 46 + nameLen);
    if (flags & 0x09) bad(`entry ${name} is encrypted or uses a data descriptor`);
    if (method !== 0 || size !== usize) bad(`entry ${name} is not stored`);
    if (extraLen !== 0) bad(`entry ${name} has an extra field (ZIP64)`);
    const local = zip.readUInt32LE(at + 42);
    if (zip.readUInt32LE(local) !== 0x04034b50 || zip.readUInt16LE(local + 28) !== 0) bad(`entry ${name} has a malformed local header`);
    const start = local + 30 + zip.readUInt16LE(local + 26);
    const content = zip.subarray(start, start + size);
    if (content.length !== size || (crc32(content) >>> 0) !== crc) bad(`entry ${name} fails its CRC-32`);
    if (out.has(name)) bad(`has ${name} twice`);
    out.set(name, content);
    at += 46 + nameLen + extraLen + commentLen;
  }
  out.delete('plugin.json.sig');
  const legal = ['plugin.json', 'plugin.wasm', ...LOGO_NAMES];
  const stray = [...out.keys()].filter((n) => !legal.includes(n));
  if (stray.length > 0) bad(`has entries the catalog does not take: ${stray.join(', ')}`);
  return out;
}

/** Unpacks the archive into a fresh directory, refusing one whose manifest is not the reviewed one. */
export function unpackReviewed(zip, reviewedManifest) {
  const entries = readPluginZip(zip);
  if (!entries.get('plugin.json')?.equals(reviewedManifest)) {
    throw new Error('the archive plugin.json differs from the reviewed plugins/<id>/src/plugin.json');
  }
  const dir = mkdtempSync(join(tmpdir(), 'fkplugin-'));
  for (const [name, content] of entries) writeFileSync(join(dir, name), content);
  return dir;
}

// plugins.md rules 1-4, 14 and 16: what the host refuses at inspect, checked before signing.
export const MAX_TOTAL_BYTES = 48 * 1024 * 1024;
// The entry caps keep a store-only archive under this (asserted by the tests), so it is not rechecked.
export const MAX_ARCHIVE_BYTES = 33 * 1024 * 1024;
export const ENTRY_CAPS = {
  'plugin.json': 256 * 1024,
  'plugin.json.sig': 256,
  'plugin.wasm': 32 * 1024 * 1024,
  'plugin.js': 8 * 1024 * 1024,
  'logo.svg': 64 * 1024,
  'logo.png': 64 * 1024,
};
const WASM_PREAMBLE = Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x0d, 0x00, 0x01, 0x00]);
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const ID_PATTERN = /^[a-z][a-z0-9]*(\.[a-z0-9]+)*$/;
const MAX_ID_LENGTH = 51;
const RESERVED_IDS = ['ui', 'metrics', 'sources', 'import'];
const BASE_KEYS = ['id', 'pluginApi', 'name', 'version', 'fliks', 'author', 'description', 'license', 'logo', 'homepage', 'ui', 'events', 'i18n', 'kind'];
const PROCESS_KEYS = [...BASE_KEYS, 'runtime', 'memoryMb', 'files', 'database', 'routes', 'scopes', 'ingestRoots', 'jobs', 'permissions', 'checklist', 'network'];
const SCOPES = ['media:read', 'acquisition:candidates', 'releases:score', 'requests:progress', 'ingest:write', 'events:emit', 'config:rw'];

const isRecord = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStrings = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');

function isIngestRoot(root) {
  const flavour = /^[a-zA-Z]:[\\/]/.test(root) ? win32 : posix;
  return flavour.isAbsolute(root) && root === flavour.normalize(root) && flavour.dirname(root) !== root;
}

function readOneLogo(srcDir) {
  const found = LOGO_NAMES.filter((n) => existsSync(join(srcDir, n)));
  if (found.length === 0) throw new Error(`${srcDir} has no logo.svg or logo.png`);
  if (found.length > 1) throw new Error(`${srcDir} has both logo.svg and logo.png — exactly one is legal`);
  return { name: found[0], content: readFileSync(join(srcDir, found[0])) };
}

/** Rules 1-4: the manifest's shape, closed key set and id. */
export function checkManifest(m) {
  const bad = (what) => {
    throw new Error(`plugin.json ${what}`);
  };
  if (!isRecord(m)) bad('must be a JSON object');
  if (typeof m.id !== 'string' || !ID_PATTERN.test(m.id) || m.id.length > MAX_ID_LENGTH || RESERVED_IDS.includes(m.id)) {
    bad(`"id" must match ${ID_PATTERN}, be at most ${MAX_ID_LENGTH} chars and not ${RESERVED_IDS.join('/')}`);
  }
  // The version names the output file and the workflow's outputs, so it must be plain semver.
  if (!isValidSemver(m.version)) bad(`"version" must be semver (got ${JSON.stringify(m.version)})`);
  if (m.kind !== 'data' && m.kind !== 'process') bad(`"kind" must be "data" or "process" (got ${JSON.stringify(m.kind)})`);
  const unknown = Object.keys(m).filter((k) => !(m.kind === 'data' ? BASE_KEYS : PROCESS_KEYS).includes(k));
  if (unknown.length > 0) bad(`has keys a ${m.kind} manifest may not carry: ${unknown.join(', ')}`);
  if (typeof m.pluginApi !== 'number') bad('"pluginApi" must be a number');
  for (const k of ['name', 'fliks']) if (typeof m[k] !== 'string' || m[k] === '') bad(`"${k}" must be a non-empty string`);
  for (const k of ['author', 'description', 'license', 'logo']) if (typeof m[k] !== 'string') bad(`"${k}" must be a string`);
  if (m.homepage !== undefined && typeof m.homepage !== 'string') bad('"homepage" must be a string');
  if (m.kind === 'data') return;

  if (typeof m.memoryMb !== 'number') bad('"memoryMb" must be a number');
  if (!isRecord(m.files) || !Object.values(m.files).every((v) => typeof v === 'string')) bad('"files" must map names to sha256');
  if (!isRecord(m.database) || typeof m.database.schema !== 'boolean' || !isStrings(m.database.coreRefs)) {
    bad('"database" must be {schema: boolean, coreRefs: string[]}');
  }
  const isRoute = (r) =>
    isRecord(r) && ['method', 'path', 'policy'].every((k) => typeof r[k] === 'string') && ['undefined', 'string'].includes(typeof r.objectGuard);
  if (!Array.isArray(m.routes) || !m.routes.every(isRoute)) bad('"routes" must be [{method, path, policy, objectGuard?}]');
  if (!isStrings(m.scopes) || m.scopes.length === 0 || !m.scopes.every((s) => SCOPES.includes(s))) {
    bad(`"scopes" must be a non-empty subset of ${SCOPES.join(' ')}`);
  }
  if (!isStrings(m.ingestRoots) || !m.ingestRoots.every(isIngestRoot)) bad('"ingestRoots" must be absolute, normalised, not volume roots');
  if (m.network !== undefined && JSON.stringify(m.network) !== '{"internal":true}') bad('"network" must be {"internal": true}');
}

/** Rule 14: PNG by magic bytes; an SVG rooted at <svg> with no script, handler or javascript: URI. */
export function checkLogo({ name, content }) {
  if (name === 'logo.png') {
    if (!content.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) throw new Error('logo.png does not start with the PNG magic bytes');
    return;
  }
  const text = content.toString('utf8');
  if (!/<svg[\s>]/i.test(text)) throw new Error('logo.svg has no <svg> root element');
  if (/<script[\s>]/i.test(text)) throw new Error('logo.svg contains a <script> element');
  if (/\son[a-z]+\s*=/i.test(text)) throw new Error('logo.svg contains an event-handler attribute');
  if (/javascript:/i.test(text)) throw new Error('logo.svg contains a javascript: URI');
}

/** The catalog filters on the entry and the host installs the manifest: they must agree. */
export function checkAgainstEntry(manifest, entry) {
  for (const k of ['id', 'version', 'kind', 'pluginApi', 'fliks']) {
    if (manifest[k] !== entry[k]) {
      throw new Error(`plugin.json "${k}" ${JSON.stringify(manifest[k])} differs from the version entry's ${JSON.stringify(entry[k])}`);
    }
  }
}

/** Rule 16: the entry set equals `files`, every hash matches, and plugin.wasm is a component. */
export function checkFiles(manifest, code, logo) {
  if (code.name === 'plugin.wasm' && !code.content.subarray(0, WASM_PREAMBLE.length).equals(WASM_PREAMBLE)) {
    throw new Error('plugin.wasm does not start with the component preamble (\\0asm, version 0d 00, layer 01 00)');
  }
  const expected = { [code.name]: code.content, [logo.name]: logo.content };
  const files = manifest.files;
  const listed = isRecord(files) ? Object.keys(files).sort() : [];
  if (listed.join() !== Object.keys(expected).sort().join()) {
    throw new Error(`plugin.json "files" must list exactly ${Object.keys(expected).sort().join(', ')} (got ${listed.join(', ') || 'none'})`);
  }
  for (const [name, content] of Object.entries(expected)) {
    if (files[name] !== createHash('sha256').update(content).digest('hex')) {
      throw new Error(`plugin.json "files" sha256 for ${name} does not match the file`);
    }
  }
}

export function assertEntryCaps(entries) {
  for (const { name, content } of entries) {
    if (content.length > ENTRY_CAPS[name]) throw new Error(`${name} is over its ${ENTRY_CAPS[name]} byte cap`);
  }
  if (entries.reduce((n, e) => n + e.content.length, 0) > MAX_TOTAL_BYTES) {
    throw new Error('uncompressed entries exceed the 48 MiB total cap');
  }
}

/** Tier and runtime rules; returns the code entry to ship, or null for a data plugin. */
function readCodeEntry(srcDir, manifest) {
  const hasJs = existsSync(join(srcDir, 'plugin.js'));
  const hasWasm = existsSync(join(srcDir, 'plugin.wasm'));
  if (manifest.kind === 'data') {
    if (hasJs || hasWasm) throw new Error('a data-tier plugin may not ship plugin.js or plugin.wasm');
    return null;
  }
  if (hasJs && hasWasm) throw new Error('a process-tier plugin ships plugin.js or plugin.wasm, not both');
  if (manifest.runtime === 'wasm') {
    if (manifest.pluginApi !== 2) throw new Error('runtime "wasm" requires pluginApi 2');
    if (!hasWasm) throw new Error('a wasm process-tier plugin must ship plugin.wasm');
    return 'plugin.wasm';
  }
  if (manifest.pluginApi >= 2) throw new Error('a pluginApi 2 process-tier plugin must declare runtime "wasm"');
  if (manifest.runtime !== 'node') throw new Error('runtime must be "wasm" (pluginApi 2) or "node"');
  if (hasWasm) throw new Error('plugin.wasm requires runtime "wasm" in plugin.json');
  if (!hasJs) throw new Error('a process-tier plugin must ship plugin.js');
  return 'plugin.js';
}

/**
 * Builds and signs the archive for the plugin sources in `srcDir`; `entryFor(version)` returns
 * that version's catalog entry. Throws on any refusal.
 */
export function buildArchive(pluginId, srcDir, privateKey, entryFor) {
  const manifestPath = join(srcDir, 'plugin.json');
  if (!existsSync(manifestPath)) throw new Error(`${manifestPath} does not exist`);
  const manifestBytes = readFileSync(manifestPath);
  let manifest;
  try {
    manifest = JSON.parse(manifestBytes.toString('utf8'));
  } catch (err) {
    throw new Error(`${manifestPath} is not valid JSON (${err.message})`);
  }
  if (manifest?.id !== pluginId) {
    throw new Error(`plugin.json "id" (${JSON.stringify(manifest?.id)}) does not match "${pluginId}"`);
  }
  checkManifest(manifest);
  checkAgainstEntry(manifest, entryFor(manifest.version));

  const codeName = readCodeEntry(srcDir, manifest);
  const logo = readOneLogo(srcDir);
  checkLogo(logo);
  const code = codeName && { name: codeName, content: readFileSync(join(srcDir, codeName)) };
  if (code) checkFiles(manifest, code, logo);

  const signature = signManifest(privateKey, manifestBytes);
  const entries = [
    { name: 'plugin.json', content: manifestBytes },
    { name: 'plugin.json.sig', content: Buffer.from(`${signature.toString('base64')}\n`, 'utf8') },
    ...(code ? [code] : []),
    logo,
  ];
  assertEntryCaps(entries);
  const zip = buildPluginZip(entries);
  return { zip, manifest, digest: createHash('sha256').update(zip).digest('hex') };
}


function main() {
  const args = process.argv.slice(2);
  const opt = (name) => {
    const i = args.indexOf(name);
    return i === -1 ? undefined : args.splice(i, 2)[1];
  };
  const srcOpt = opt('--src');
  const outOpt = opt('--out');
  const versionsOpt = opt('--versions');
  const archiveOpt = opt('--archive');
  const pluginId = args[0];
  if (!pluginId) fail('usage: node scripts/package-plugin.mjs <pluginId> [--archive <file.fkplugin>] [--src <dir> --out <dir> --versions <dir>]');

  let srcDir = srcOpt ?? join(ROOT, 'plugins', pluginId, 'src');
  const versionsDir = versionsOpt ?? join(ROOT, 'plugins', pluginId, 'versions');
  const entryFor = (version) => {
    const path = join(versionsDir, `${version}.json`);
    if (!existsSync(path)) throw new Error(`${path} does not exist: commit the version entry first`);
    return JSON.parse(readFileSync(path, 'utf8'));
  };
  let built;
  try {
    if (archiveOpt) srcDir = unpackReviewed(readFileSync(archiveOpt), readFileSync(join(srcDir, 'plugin.json')));
    built = buildArchive(pluginId, srcDir, loadSigningKey(process.env.CATALOG_SIGNING_KEY), entryFor);
  } catch (err) {
    fail(err.message);
  }
  const { zip, manifest, digest } = built;

  // A wasm archive is a release asset, never committed: it has no default output directory.
  if (manifest.runtime === 'wasm' && !outOpt) fail('a wasm plugin needs --out <dir> (its archive is not stored in this repo)');
  const outDir = outOpt ?? join(ROOT, 'plugins', pluginId, 'dist');
  mkdirSync(outDir, { recursive: true });
  const fileName = `${pluginId}-${manifest.version}.fkplugin`;
  const outPath = join(outDir, fileName);
  writeFileSync(outPath, zip);

  const relPath = outOpt ? outPath : `plugins/${pluginId}/dist/${fileName}`;
  console.log(`packaged ${relPath}`);
  console.log(`  id:      ${manifest.id}`);
  console.log(`  version: ${manifest.version}`);
  console.log(`  kind:    ${manifest.kind}`);
  console.log(`  sha256:  ${digest}`);

  if (process.env.GITHUB_OUTPUT) {
    writeFileSync(process.env.GITHUB_OUTPUT, `distPath=${relPath}\nversion=${manifest.version}\nsha256=${digest}\n`, { flag: 'a' });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
