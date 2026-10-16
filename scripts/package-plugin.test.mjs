// Structural smoke test for the hand-rolled ZIP writer and the sign/verify
// helpers in package-plugin.mjs — the two pieces of non-obvious binary/crypto
// logic in that script. Uses node:test (stdlib, ships with Node 20+); the full
// consumer-accepts-this-archive proof lives in the PR that ran the real
// backend's inspect() against a built .fkplugin, not here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import { buildPluginZip, signManifest } from './package-plugin.mjs';

const EOCD_SIG = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
const ZIP64_EXTRA_ID = Buffer.from([0x01, 0x00]);

test('buildPluginZip: starts with the local-file magic and carries exactly one EOCD', () => {
  const zip = buildPluginZip([
    { name: 'plugin.json', content: Buffer.from('{}') },
    { name: 'logo.svg', content: Buffer.from('<svg></svg>') },
  ]);
  assert.equal(zip.subarray(0, 4).toString('hex'), '504b0304');
  const first = zip.indexOf(EOCD_SIG);
  const last = zip.lastIndexOf(EOCD_SIG);
  assert.notEqual(first, -1);
  assert.equal(first, last, 'exactly one EOCD signature');
});

test('buildPluginZip: EOCD entry count matches, no ZIP64 extra field, no data-descriptor bit', () => {
  const entries = [
    { name: 'plugin.json', content: Buffer.from('{"a":1}') },
    { name: 'plugin.json.sig', content: Buffer.from('sig\n') },
    { name: 'logo.png', content: Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
  ];
  const zip = buildPluginZip(entries);
  const eocdAt = zip.indexOf(EOCD_SIG);
  assert.equal(zip.readUInt16LE(eocdAt + 10), entries.length);
  assert.equal(zip.indexOf(ZIP64_EXTRA_ID), -1, 'no ZIP64 extra field id anywhere in the archive');
  // General-purpose flag lives 6 bytes into each 30-byte local header; every
  // local header in this fixed-layout archive starts right after the previous
  // entry's header+name+content, so just assert the bit is off wherever a
  // local-file-header signature occurs.
  let offset = 0;
  while (true) {
    const at = zip.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), offset);
    if (at === -1) break;
    const flag = zip.readUInt16LE(at + 6);
    assert.equal(flag & 0x0008, 0, 'data-descriptor bit must never be set');
    offset = at + 4;
  }
});

test('buildPluginZip: store method makes compressed size equal uncompressed size', () => {
  const content = Buffer.from('x'.repeat(500));
  const zip = buildPluginZip([{ name: 'plugin.json', content }]);
  const localAt = zip.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  assert.equal(zip.readUInt16LE(localAt + 8), 0, 'compression method must be store (0)');
  assert.equal(zip.readUInt32LE(localAt + 18), content.length);
  assert.equal(zip.readUInt32LE(localAt + 22), content.length);
});

test('signManifest: verifies against the matching public key and rejects a tampered message', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const data = Buffer.from('plugin.json bytes');
  const signature = signManifest(privateKey, data);

  assert.equal(verify(null, data, publicKey, signature), true);
  assert.equal(verify(null, Buffer.from('tampered bytes'), publicKey, signature), false);
});

// --- pluginApi 2: wasm plugins ---------------------------------------------------------------
import { mkdtempSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertEntryCaps, buildArchive, checkWasmPlugin, MAX_ENTRY_BYTES } from './package-plugin.mjs';

const { privateKey: KEY } = generateKeyPairSync('ed25519');
const WASM = Buffer.concat([Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x0d, 0x00, 0x01, 0x00]), Buffer.from('body')]);
const LOGO = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>');
const sha = (b) => createHash('sha256').update(b).digest('hex');

function srcDir({ manifest = {}, wasm = WASM, js, logo = LOGO, extraLogoPng } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'pkg-'));
  const m = {
    id: 'fliks.x', kind: 'process', version: '1.0.0', pluginApi: 2, runtime: 'wasm',
    files: { 'plugin.wasm': sha(WASM), 'logo.svg': sha(LOGO) }, ...manifest,
  };
  writeFileSync(join(dir, 'plugin.json'), JSON.stringify(m));
  if (wasm) writeFileSync(join(dir, 'plugin.wasm'), wasm);
  if (js) writeFileSync(join(dir, 'plugin.js'), js);
  if (logo) writeFileSync(join(dir, 'logo.svg'), logo);
  if (extraLogoPng) writeFileSync(join(dir, 'logo.png'), extraLogoPng);
  return dir;
}
const refuses = (dir, re) => assert.throws(() => buildArchive('fliks.x', dir, KEY), re);
function names(zip) {
  const eocd = zip.indexOf(EOCD_SIG);
  let at = zip.readUInt32LE(eocd + 16);
  const out = [];
  for (let i = zip.readUInt16LE(eocd + 10); i > 0; i--) {
    const len = zip.readUInt16LE(at + 28);
    out.push(zip.toString('utf8', at + 46, at + 46 + len));
    at += 46 + len;
  }
  return out;
}

test('buildArchive: a wasm plugin packs plugin.json, sig, plugin.wasm and the logo, store method', () => {
  const { zip, manifest, digest } = buildArchive('fliks.x', srcDir(), KEY);
  const eocd = zip.indexOf(EOCD_SIG);
  assert.equal(zip.readUInt16LE(eocd + 10), 4);
  assert.equal(manifest.runtime, 'wasm');
  assert.equal(digest, sha(zip));
  assert.ok(zip.includes(WASM));
  assert.equal(names(zip).join(), 'plugin.json,plugin.json.sig,plugin.wasm,logo.svg');
});

test('buildArchive: refuses a wasm file without the component preamble', () => {
  refuses(srcDir({ wasm: Buffer.from('\0asm\x01\0\0\0core module') }), /component preamble/);
});

test('buildArchive: refuses runtime wasm without plugin.wasm, and the mixes', () => {
  refuses(srcDir({ wasm: null }), /must ship plugin\.wasm/);
  refuses(srcDir({ js: 'x' }), /not both/);
  refuses(srcDir({ manifest: { runtime: 'node' } }), /must declare runtime "wasm"/);
  refuses(srcDir({ manifest: { pluginApi: 1 } }), /requires pluginApi 2/);
});

test('buildArchive: refuses plugin.wasm in a data plugin', () => {
  refuses(srcDir({ manifest: { kind: 'data', runtime: undefined } }), /data-tier/);
});

test('buildArchive: manifest files must match the shipped files exactly', () => {
  refuses(srcDir({ manifest: { files: { 'plugin.wasm': sha(WASM) } } }), /must list exactly/);
  refuses(srcDir({ manifest: { files: { 'plugin.wasm': sha(WASM), 'logo.svg': '0'.repeat(64) } } }), /does not match the file/);
  refuses(srcDir({ manifest: { files: undefined } }), /must list exactly/);
});

test('buildArchive: refuses a missing logo, both logos, a wrong id and a bad manifest', () => {
  refuses(srcDir({ logo: null }), /no logo/);
  refuses(srcDir({ extraLogoPng: Buffer.from([1]) }), /both logo/);
  refuses(srcDir({ manifest: { id: 'other' } }), /does not match/);
  refuses(srcDir({ manifest: { kind: 'weird' } }), /"kind" must be/);
  refuses(srcDir({ manifest: { version: '1.0.0\nsha256=x' } }), /"version" must be semver/);
  refuses(srcDir({ manifest: { version: '../1.0.0' } }), /"version" must be semver/);
  refuses(mkdtempSync(join(tmpdir(), 'pkg-')), /does not exist/);
  const dir = srcDir();
  writeFileSync(join(dir, 'plugin.json'), '{nope');
  refuses(dir, /not valid JSON/);
});

test('buildArchive: oversize manifest and logo are refused', () => {
  const big = Buffer.from(`<svg>${'a'.repeat(64 * 1024)}</svg>`);
  refuses(srcDir({ logo: big, manifest: { files: { 'plugin.wasm': sha(WASM), 'logo.svg': sha(big) } } }), /logo\.svg is over 64 KiB/);
  refuses(srcDir({ manifest: { pad: 'a'.repeat(256 * 1024) } }), /plugin\.json is over 256 KiB/);
});

test('buildArchive: the legacy node tier and the data tier still package', () => {
  const node = srcDir({ wasm: null, js: 'x', manifest: { pluginApi: 1, runtime: 'node', files: undefined } });
  assert.deepEqual(names(buildArchive('fliks.x', node, KEY).zip), ['plugin.json', 'plugin.json.sig', 'plugin.js', 'logo.svg']);
  const data = srcDir({ wasm: null, manifest: { kind: 'data', pluginApi: 1, runtime: undefined, files: undefined } });
  assert.equal(buildArchive('fliks.x', data, KEY).manifest.kind, 'data');
  refuses(srcDir({ wasm: null, manifest: { pluginApi: 1, runtime: 'node' } }), /must ship plugin\.js/);
  refuses(srcDir({ js: 'x', manifest: { pluginApi: 1, runtime: 'node' } }), /not both/);
});

test('assertEntryCaps: 32 MiB per entry and 48 MiB in total', () => {
  const mib = (n) => ({ name: 'a', content: Buffer.alloc(n * 1024 * 1024) });
  assertEntryCaps([mib(32), { name: 'b', content: Buffer.alloc(16 * 1024 * 1024) }]);
  assert.throws(() => assertEntryCaps([{ name: 'plugin.wasm', content: Buffer.alloc(MAX_ENTRY_BYTES + 1) }]), /32 MiB entry cap/);
  assert.throws(() => assertEntryCaps([mib(30), mib(30)]), /48 MiB total cap/);
});

test('checkWasmPlugin: accepts a consistent set', () => {
  const m = { files: { 'plugin.wasm': sha(WASM), 'logo.svg': sha(LOGO) } };
  checkWasmPlugin(m, Buffer.from('{}'), WASM, { name: 'logo.svg', content: LOGO });
});

test('cli: a wasm plugin refuses to package without --out, and writes the archive there with it', async () => {
  const { spawnSync } = await import('node:child_process');
  const { existsSync } = await import('node:fs');
  const key = KEY.export({ format: 'der', type: 'pkcs8' }).toString('base64');
  const run = (...extra) =>
    spawnSync('node', [new URL('./package-plugin.mjs', import.meta.url).pathname, 'fliks.x', '--src', srcDir(), ...extra], {
      env: { ...process.env, CATALOG_SIGNING_KEY: key, GITHUB_OUTPUT: '' },
      encoding: 'utf8',
    });
  const refused = run();
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /needs --out/);
  const out = mkdtempSync(join(tmpdir(), 'out-'));
  const ok = run('--out', out);
  assert.equal(ok.status, 0, ok.stderr);
  assert.ok(existsSync(join(out, 'fliks.x-1.0.0.fkplugin')));
});
