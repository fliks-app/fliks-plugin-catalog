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
