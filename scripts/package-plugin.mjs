#!/usr/bin/env node
// Builds one plugin's `.fkplugin` from `plugins/<id>/src/` and signs `plugin.json`
// with CATALOG_SIGNING_KEY — the same key that signs catalog.json, which is what
// lets the consumer's trust store (backend/src/modules/plugins/archive/trust-store.ts)
// resolve the archive to `official`. Zero dependencies: the ZIP is hand-assembled
// (store method, real CRC32 via node:zlib) to a layout the consumer's guard suite
// accepts by construction — see backend/src/modules/plugins/archive/limits.ts and
// zip-inspector.ts for the rules this mirrors: <=4 entries, no directories, no
// ZIP64, no data descriptor, exact literal names, one EOCD, no archive comment.
// `.github/workflows/package-plugin.yml` calls this rather than duplicating it.
import { createHash, createPrivateKey, createPublicKey, sign as ed25519Sign, verify as ed25519Verify } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32 } from 'node:zlib';

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

function readOneLogo(srcDir) {
  const found = LOGO_NAMES.filter((n) => existsSync(join(srcDir, n)));
  if (found.length === 0) fail(`${srcDir} has no logo.svg or logo.png`);
  if (found.length > 1) fail(`${srcDir} has both logo.svg and logo.png — exactly one is legal`);
  return { name: found[0], content: readFileSync(join(srcDir, found[0])) };
}

function main() {
  const pluginId = process.argv[2];
  if (!pluginId) fail('usage: node scripts/package-plugin.mjs <pluginId>');

  const srcDir = join(ROOT, 'plugins', pluginId, 'src');
  const manifestPath = join(srcDir, 'plugin.json');
  if (!existsSync(manifestPath)) fail(`${manifestPath} does not exist`);

  const manifestBytes = readFileSync(manifestPath);
  let manifest;
  try {
    manifest = JSON.parse(manifestBytes.toString('utf8'));
  } catch (err) {
    fail(`${manifestPath} is not valid JSON (${err.message})`);
  }
  if (manifest.id !== pluginId) {
    fail(`plugin.json "id" (${JSON.stringify(manifest.id)}) does not match directory "${pluginId}"`);
  }
  if (manifest.kind !== 'data' && manifest.kind !== 'process') {
    fail(`plugin.json "kind" must be "data" or "process" (got ${JSON.stringify(manifest.kind)})`);
  }

  const pluginJsPath = join(srcDir, 'plugin.js');
  const hasPluginJs = existsSync(pluginJsPath);
  if (manifest.kind === 'data' && hasPluginJs) fail('a data-tier plugin may not ship plugin.js');
  if (manifest.kind === 'process' && !hasPluginJs) fail('a process-tier plugin must ship plugin.js');

  const privateKey = loadSigningKey(process.env.CATALOG_SIGNING_KEY);
  const signature = signManifest(privateKey, manifestBytes);
  const logo = readOneLogo(srcDir);

  const entries = [
    { name: 'plugin.json', content: manifestBytes },
    { name: 'plugin.json.sig', content: Buffer.from(`${signature.toString('base64')}\n`, 'utf8') },
  ];
  if (hasPluginJs) entries.push({ name: 'plugin.js', content: readFileSync(pluginJsPath) });
  entries.push(logo);

  const zip = buildPluginZip(entries);
  const digest = createHash('sha256').update(zip).digest('hex');

  const outDir = join(ROOT, 'plugins', pluginId, 'dist');
  mkdirSync(outDir, { recursive: true });
  const fileName = `${pluginId}-${manifest.version}.fkplugin`;
  const outPath = join(outDir, fileName);
  writeFileSync(outPath, zip);

  const relPath = `plugins/${pluginId}/dist/${fileName}`;
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
