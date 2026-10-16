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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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

// plugins.md rules 14 and 16: caps and the component preamble the host enforces on inspect.
export const MAX_ENTRY_BYTES = 32 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 48 * 1024 * 1024;
export const MAX_ARCHIVE_BYTES = 33 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 256 * 1024;
const MAX_LOGO_BYTES = 64 * 1024;
const WASM_PREAMBLE = Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x0d, 0x00, 0x01, 0x00]);

function readOneLogo(srcDir) {
  const found = LOGO_NAMES.filter((n) => existsSync(join(srcDir, n)));
  if (found.length === 0) throw new Error(`${srcDir} has no logo.svg or logo.png`);
  if (found.length > 1) throw new Error(`${srcDir} has both logo.svg and logo.png — exactly one is legal`);
  return { name: found[0], content: readFileSync(join(srcDir, found[0])) };
}

/** Refuses what the host would refuse at inspect, before a signature is spent on it. */
export function checkWasmPlugin(manifest, manifestBytes, wasm, logo) {
  if (!wasm.subarray(0, WASM_PREAMBLE.length).equals(WASM_PREAMBLE)) {
    throw new Error('plugin.wasm does not start with the component preamble (\\0asm, version 0d 00, layer 01 00)');
  }
  if (manifestBytes.length > MAX_MANIFEST_BYTES) throw new Error('plugin.json is over 256 KiB');
  if (logo.content.length > MAX_LOGO_BYTES) throw new Error(`${logo.name} is over 64 KiB`);
  const expected = { 'plugin.wasm': wasm, [logo.name]: logo.content };
  const files = manifest.files;
  const listed = files && typeof files === 'object' ? Object.keys(files).sort() : [];
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
    if (content.length > MAX_ENTRY_BYTES) throw new Error(`${name} is over the 32 MiB entry cap`);
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
  if (hasWasm) throw new Error('plugin.wasm requires runtime "wasm" in plugin.json');
  if (!hasJs) throw new Error('a process-tier plugin must ship plugin.js');
  return 'plugin.js';
}

/** Builds and signs the archive for the plugin sources in `srcDir`. Throws on any refusal. */
export function buildArchive(pluginId, srcDir, privateKey) {
  const manifestPath = join(srcDir, 'plugin.json');
  if (!existsSync(manifestPath)) throw new Error(`${manifestPath} does not exist`);
  const manifestBytes = readFileSync(manifestPath);
  let manifest;
  try {
    manifest = JSON.parse(manifestBytes.toString('utf8'));
  } catch (err) {
    throw new Error(`${manifestPath} is not valid JSON (${err.message})`);
  }
  if (manifest.id !== pluginId) {
    throw new Error(`plugin.json "id" (${JSON.stringify(manifest.id)}) does not match "${pluginId}"`);
  }
  // The version names the output file and the workflow's outputs, so it must be plain semver.
  if (!isValidSemver(manifest.version)) {
    throw new Error(`plugin.json "version" must be semver (got ${JSON.stringify(manifest.version)})`);
  }
  if (manifest.kind !== 'data' && manifest.kind !== 'process') {
    throw new Error(`plugin.json "kind" must be "data" or "process" (got ${JSON.stringify(manifest.kind)})`);
  }

  const codeName = readCodeEntry(srcDir, manifest);
  const logo = readOneLogo(srcDir);
  const code = codeName && { name: codeName, content: readFileSync(join(srcDir, codeName)) };
  if (codeName === 'plugin.wasm') checkWasmPlugin(manifest, manifestBytes, code.content, logo);

  const signature = signManifest(privateKey, manifestBytes);
  const entries = [
    { name: 'plugin.json', content: manifestBytes },
    { name: 'plugin.json.sig', content: Buffer.from(`${signature.toString('base64')}\n`, 'utf8') },
    ...(code ? [code] : []),
    logo,
  ];
  assertEntryCaps(entries);
  const zip = buildPluginZip(entries);
  if (zip.length > MAX_ARCHIVE_BYTES) throw new Error('archive is over the 33 MiB compressed cap');
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
  const pluginId = args[0];
  if (!pluginId) fail('usage: node scripts/package-plugin.mjs <pluginId> [--src <dir> --out <dir>]');

  const srcDir = srcOpt ?? join(ROOT, 'plugins', pluginId, 'src');
  let built;
  try {
    built = buildArchive(pluginId, srcDir, loadSigningKey(process.env.CATALOG_SIGNING_KEY));
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
