// Structural smoke test for the hand-rolled ZIP writer and the sign/verify
// helpers in package-plugin.mjs — the two pieces of non-obvious binary/crypto
// logic in that script. Uses node:test (stdlib, ships with Node 20+); the full
// consumer-accepts-this-archive proof lives in the PR that ran the real
// backend's inspect() against a built .fkplugin, not here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import { buildPluginZip, readPluginZip, signManifest, unpackReviewed } from './package-plugin.mjs';

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
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertEntryCaps, buildArchive, checkAgainstEntry, checkFiles, checkManifest, checkLogo, ENTRY_CAPS, MAX_ARCHIVE_BYTES, MAX_TOTAL_BYTES,
} from './package-plugin.mjs';

const { privateKey: KEY } = generateKeyPairSync('ed25519');
const WASM = Buffer.concat([Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x0d, 0x00, 0x01, 0x00]), Buffer.from('body')]);
const LOGO = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const MANIFEST = {
  id: 'fliks.x', pluginApi: 2, name: 'X', version: '1.0.0', fliks: '>=5.0.0 <6.0.0', author: 'a', description: 'd',
  license: 'MIT', logo: 'logo.svg', kind: 'process', runtime: 'wasm', memoryMb: 64,
  files: { 'plugin.wasm': sha(WASM), 'logo.svg': sha(LOGO) }, database: { schema: true, coreRefs: [] },
  routes: [{ method: 'GET', path: '/x', policy: 'read:Settings' }], scopes: ['config:rw'], ingestRoots: [],
};
const ENTRY = { id: 'fliks.x', version: '1.0.0', kind: 'process', pluginApi: 2, fliks: '>=5.0.0 <6.0.0' };
const entryFor = () => ENTRY;

function srcDir({ manifest = {}, wasm = WASM, js, logo = LOGO, extraLogoPng } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'pkg-'));
  writeFileSync(join(dir, 'plugin.json'), JSON.stringify({ ...MANIFEST, ...manifest }));
  if (wasm) writeFileSync(join(dir, 'plugin.wasm'), wasm);
  if (js) writeFileSync(join(dir, 'plugin.js'), js);
  if (logo) writeFileSync(join(dir, 'logo.svg'), logo);
  if (extraLogoPng) writeFileSync(join(dir, 'logo.png'), extraLogoPng);
  return dir;
}
const refuses = (dir, re, entry = ENTRY) => assert.throws(() => buildArchive('fliks.x', dir, KEY, () => entry), re);
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
  const { zip, manifest, digest } = buildArchive('fliks.x', srcDir(), KEY, entryFor);
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
  refuses(srcDir({ manifest: { pluginApi: 1 } }), /requires pluginApi 2/, { ...ENTRY, pluginApi: 1 });
});

test('buildArchive: refuses plugin.wasm in a data plugin', () => {
  refuses(srcDir({ manifest: { kind: 'data', runtime: undefined, memoryMb: undefined, files: undefined, database: undefined,
    routes: undefined, scopes: undefined, ingestRoots: undefined } }), /data-tier/, { ...ENTRY, kind: 'data' });
});

test('buildArchive: manifest files must match the shipped files exactly', () => {
  refuses(srcDir({ manifest: { files: { 'plugin.wasm': sha(WASM) } } }), /must list exactly/);
  refuses(srcDir({ manifest: { files: { 'plugin.wasm': sha(WASM), 'logo.svg': '0'.repeat(64) } } }), /does not match the file/);
  refuses(srcDir({ manifest: { files: undefined } }), /"files" must map/);
  refuses(srcDir({ manifest: { files: [sha(WASM), sha(LOGO)] } }), /"files" must map/);
  assert.throws(() => checkFiles({ files: [sha(WASM), sha(LOGO)] }, { name: 'plugin.wasm', content: WASM }, { name: 'logo.svg', content: LOGO }), /must list exactly/);
});

test('buildArchive: refuses a missing logo, both logos, a wrong id and an unparsable manifest', () => {
  refuses(srcDir({ logo: null }), /no logo/);
  refuses(srcDir({ extraLogoPng: Buffer.from([1]) }), /both logo/);
  refuses(srcDir({ manifest: { id: 'other' } }), /does not match/);
  refuses(mkdtempSync(join(tmpdir(), 'pkg-')), /does not exist/);
  const dir = srcDir();
  writeFileSync(join(dir, 'plugin.json'), '{nope');
  refuses(dir, /not valid JSON/);
});

test('checkManifest (rules 1-4): id, version, kind and the base fields', () => {
  const id = (v) => buildArchive(v, srcDir({ manifest: { id: v } }), KEY, () => ({ ...ENTRY, id: v }));
  assert.throws(() => id(`a${'b'.repeat(51)}`), /"id" must match/);
  id(`a${'b'.repeat(50)}`);
  for (const reserved of ['ui', 'metrics', 'sources', 'import']) assert.throws(() => id(reserved), /"id" must match/);
  refuses(srcDir({ manifest: { version: '1.0.0\nsha256=x' } }), /"version" must be semver/);
  refuses(srcDir({ manifest: { version: '../1.0.0' } }), /"version" must be semver/);
  refuses(srcDir({ manifest: { kind: 'weird' } }), /"kind" must be/);
  refuses(srcDir({ manifest: { pluginApi: '2' } }), /"pluginApi" must be a number/);
  refuses(srcDir({ manifest: { name: '' } }), /"name" must be a non-empty string/);
  refuses(srcDir({ manifest: { license: undefined } }), /"license" must be a string/);
  refuses(srcDir({ manifest: { homepage: 1 } }), /"homepage" must be a string/);
});

test('checkManifest (rules 1-3): the closed key set of each tier', () => {
  refuses(srcDir({ manifest: { pad: 1 } }), /may not carry: pad/);
  refuses(srcDir({ wasm: null, manifest: { kind: 'data' } }), /data manifest may not carry: runtime, memoryMb/, { ...ENTRY, kind: 'data' });
  buildArchive('fliks.x', srcDir({ manifest: { network: { internal: true }, checklist: [], jobs: [], permissions: [] } }), KEY, entryFor);
});

test('checkManifest (rules 3-4): the required process keys', () => {
  refuses(srcDir({ manifest: { memoryMb: undefined } }), /"memoryMb"/);
  refuses(srcDir({ manifest: { database: { schema: 'yes', coreRefs: [] } } }), /"database"/);
  refuses(srcDir({ manifest: { routes: [{ method: 'GET', path: '/x' }] } }), /"routes"/);
  refuses(srcDir({ manifest: { scopes: [] } }), /"scopes"/);
  refuses(srcDir({ manifest: { scopes: ['root'] } }), /"scopes"/);
  for (const root of ['downloads', '/a/../b', '/', 'C:\\']) refuses(srcDir({ manifest: { ingestRoots: [root] } }), /"ingestRoots"/);
  buildArchive('fliks.x', srcDir({ manifest: { ingestRoots: ['/downloads', 'D:\\media'] } }), KEY, entryFor);
  refuses(srcDir({ manifest: { network: { internal: false } } }), /"network"/);
});

test('checkLogo (rule 14): PNG magic, and an SVG without script, handlers or javascript:', () => {
  checkLogo({ name: 'logo.png', content: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]) });
  assert.throws(() => checkLogo({ name: 'logo.png', content: Buffer.from('GIF89a') }), /PNG magic/);
  checkLogo({ name: 'logo.svg', content: LOGO });
  for (const [svg, re] of [
    ['<html></html>', /no <svg> root/],
    ['<svg><script>alert(1)</script></svg>', /<script>/],
    ['<svg onload="x()"></svg>', /event-handler/],
    ['<svg><a href="javascript:x()"/></svg>', /javascript:/],
  ]) {
    assert.throws(() => checkLogo({ name: 'logo.svg', content: Buffer.from(svg) }), re);
  }
  const evil = Buffer.from('<svg onclick="x()"/>');
  refuses(srcDir({ logo: evil, manifest: { files: { 'plugin.wasm': sha(WASM), 'logo.svg': sha(evil) } } }), /event-handler/);
});

test('checkAgainstEntry: id, version, kind, pluginApi and fliks match the version entry', () => {
  checkAgainstEntry(MANIFEST, ENTRY);
  for (const [k, v] of [['id', 'fliks.y'], ['version', '1.0.1'], ['kind', 'data'], ['pluginApi', 1], ['fliks', '>=5.0.0 <7.0.0']]) {
    refuses(srcDir(), new RegExp(`"${k}"`), { ...ENTRY, [k]: v });
  }
});

test('assertEntryCaps: per-name caps (signature 256 B) and 48 MiB in total', () => {
  const entry = (name, n) => ({ name, content: Buffer.alloc(n) });
  for (const [name, cap] of Object.entries(ENTRY_CAPS)) {
    assertEntryCaps([entry(name, cap)]);
    assert.throws(() => assertEntryCaps([entry(name, cap + 1)]), new RegExp(`${name.replace('.', '\\.')} is over`));
  }
  assert.equal(ENTRY_CAPS['plugin.json.sig'], 256);
  assert.throws(() => assertEntryCaps([entry('plugin.wasm', 32 << 20), entry('plugin.js', 8 << 20), entry('plugin.js', 8 << 20), entry('logo.svg', 1)]), /48 MiB total/);
  assert.equal(MAX_TOTAL_BYTES, 48 << 20);
  const big = Buffer.from(`<svg>${'a'.repeat(64 * 1024)}</svg>`);
  refuses(srcDir({ logo: big, manifest: { files: { 'plugin.wasm': sha(WASM), 'logo.svg': sha(big) } } }), /logo\.svg is over/);
  refuses(srcDir({ manifest: { description: 'a'.repeat(256 * 1024) } }), /plugin\.json is over/);
});

test('MAX_ARCHIVE_BYTES: the largest archive the entry caps allow fits under 33 MiB', () => {
  const zip = buildPluginZip(['plugin.json', 'plugin.json.sig', 'plugin.wasm', 'logo.png'].map((name) => ({ name, content: Buffer.alloc(ENTRY_CAPS[name]) })));
  assert.equal(MAX_ARCHIVE_BYTES, 33 << 20);
  assert.ok(zip.length <= MAX_ARCHIVE_BYTES, `${zip.length} > ${MAX_ARCHIVE_BYTES}`);
});

test('buildArchive: the in-repo sources still pass every check against their entries', () => {
  const root = new URL('../plugins/', import.meta.url).pathname;
  for (const id of readdirSync(root).filter((id) => existsSync(join(root, id, 'src', 'plugin.json')))) {
    const dir = join(root, id);
    const entryFor = (v) => JSON.parse(readFileSync(join(dir, 'versions', `${v}.json`), 'utf8'));
    const manifest = JSON.parse(readFileSync(join(dir, 'src', 'plugin.json'), 'utf8'));
    // A wasm plugin's code and logo come from its release, so only its reviewed manifest is in the tree.
    if (manifest.runtime === 'wasm') {
      checkManifest(manifest);
      checkAgainstEntry(manifest, entryFor(manifest.version));
    } else {
      buildArchive(id, join(dir, 'src'), KEY, entryFor);
    }
  }
});

test('buildArchive: the legacy node tier and the data tier still package', () => {
  const v1 = { ...ENTRY, pluginApi: 1 };
  const nodeFiles = { 'plugin.js': sha(Buffer.from('x')), 'logo.svg': sha(LOGO) };
  const node = srcDir({ wasm: null, js: 'x', manifest: { pluginApi: 1, runtime: 'node', files: nodeFiles } });
  assert.deepEqual(names(buildArchive('fliks.x', node, KEY, () => v1).zip), ['plugin.json', 'plugin.json.sig', 'plugin.js', 'logo.svg']);
  const dataManifest = Object.fromEntries(Object.entries(MANIFEST).filter(([k]) => !['runtime', 'memoryMb', 'files', 'database', 'routes', 'scopes', 'ingestRoots'].includes(k)));
  const data = srcDir({ wasm: null });
  writeFileSync(join(data, 'plugin.json'), JSON.stringify({ ...dataManifest, kind: 'data', pluginApi: 1 }));
  assert.equal(buildArchive('fliks.x', data, KEY, () => ({ ...v1, kind: 'data' })).manifest.kind, 'data');
  refuses(srcDir({ wasm: null, manifest: { pluginApi: 1, runtime: 'node' } }), /must ship plugin\.js/, v1);
  refuses(srcDir({ js: 'x', manifest: { pluginApi: 1, runtime: 'node' } }), /not both/, v1);
});

test('cli: a wasm plugin refuses to package without --out, and writes the archive there with it', async () => {
  const { spawnSync } = await import('node:child_process');
  const { existsSync } = await import('node:fs');
  const key = KEY.export({ format: 'der', type: 'pkcs8' }).toString('base64');
  const versions = mkdtempSync(join(tmpdir(), 'versions-'));
  writeFileSync(join(versions, '1.0.0.json'), JSON.stringify(ENTRY));
  const run = (...extra) =>
    spawnSync('node', [new URL('./package-plugin.mjs', import.meta.url).pathname, 'fliks.x', '--src', srcDir(), ...extra], {
      env: { ...process.env, CATALOG_SIGNING_KEY: key, GITHUB_OUTPUT: '' },
      encoding: 'utf8',
    });
  assert.match(run('--out', mkdtempSync(join(tmpdir(), 'out-'))).stderr, /versions\/1\.0\.0\.json does not exist/);
  const refused = run('--versions', versions);
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /needs --out/);
  const out = mkdtempSync(join(tmpdir(), 'out-'));
  const ok = run('--out', out, '--versions', versions);
  assert.equal(ok.status, 0, ok.stderr);
  assert.ok(existsSync(join(out, 'fliks.x-1.0.0.fkplugin')));
});

// --- the unsigned archive `cargo xtask package` publishes --------------------------------------
const MANIFEST_BYTES = Buffer.from(JSON.stringify(MANIFEST));
const release = (extra = []) =>
  buildPluginZip([
    { name: 'plugin.json', content: MANIFEST_BYTES },
    { name: 'plugin.wasm', content: WASM },
    { name: 'logo.svg', content: LOGO },
    ...extra,
  ]);

test('readPluginZip: reads the entries and drops a previous signature', () => {
  const signed = release([{ name: 'plugin.json.sig', content: Buffer.from('sig\n') }]);
  assert.deepEqual([...readPluginZip(signed).keys()], ['plugin.json', 'plugin.wasm', 'logo.svg']);
});

test('readPluginZip: refuses a stray entry, a data descriptor, an extra field and a bad CRC', () => {
  assert.throws(() => readPluginZip(release([{ name: 'plugin.js', content: Buffer.from('x') }])), /does not take: plugin\.js/);
  const flagged = Buffer.from(release());
  flagged.writeUInt16LE(0x0808, flagged.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])) + 8);
  assert.throws(() => readPluginZip(flagged), /data descriptor/);
  const extra = Buffer.from(release());
  extra.writeUInt16LE(4, extra.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])) + 30);
  assert.throws(() => readPluginZip(extra), /extra field/);
  const corrupt = Buffer.from(release());
  corrupt[corrupt.indexOf(WASM)] ^= 0xff;
  assert.throws(() => readPluginZip(corrupt), /CRC-32/);
  assert.throws(() => readPluginZip(Buffer.from('PK')), /end record/);
});

test('unpackReviewed: the archive manifest must be the reviewed one', () => {
  assert.throws(() => unpackReviewed(release(), Buffer.from('{}')), /differs from the reviewed/);
  const dir = unpackReviewed(release(), MANIFEST_BYTES);
  assert.ok(readFileSync(join(dir, 'plugin.wasm')).equals(WASM));
});

test('cli: --archive signs the release archive against the committed manifest', async () => {
  const { spawnSync } = await import('node:child_process');
  const key = KEY.export({ format: 'der', type: 'pkcs8' }).toString('base64');
  const versions = mkdtempSync(join(tmpdir(), 'versions-'));
  writeFileSync(join(versions, '1.0.0.json'), JSON.stringify(ENTRY));
  const src = mkdtempSync(join(tmpdir(), 'src-'));
  writeFileSync(join(src, 'plugin.json'), MANIFEST_BYTES);
  const archive = join(mkdtempSync(join(tmpdir(), 'rel-')), 'fliks.x-1.0.0.fkplugin');
  writeFileSync(archive, release());
  const out = mkdtempSync(join(tmpdir(), 'out-'));
  const run = () =>
    spawnSync('node', [new URL('./package-plugin.mjs', import.meta.url).pathname, 'fliks.x', '--archive', archive, '--src', src, '--out', out, '--versions', versions], {
      env: { ...process.env, CATALOG_SIGNING_KEY: key, GITHUB_OUTPUT: '' },
      encoding: 'utf8',
    });
  const first = run();
  assert.equal(first.status, 0, first.stderr);
  const signed = readFileSync(join(out, 'fliks.x-1.0.0.fkplugin'));
  assert.deepEqual([...readPluginZip(signed).keys()], ['plugin.json', 'plugin.wasm', 'logo.svg']);
  assert.equal(names(signed).join(), 'plugin.json,plugin.json.sig,plugin.wasm,logo.svg');
  // A re-run reads back the signed archive it published and reproduces it byte for byte.
  writeFileSync(archive, signed);
  assert.equal(run().status, 0);
  assert.ok(readFileSync(join(out, 'fliks.x-1.0.0.fkplugin')).equals(signed));
});
