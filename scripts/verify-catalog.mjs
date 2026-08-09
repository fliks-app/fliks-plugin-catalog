#!/usr/bin/env node
// Verifies catalog.json.sig against a named public key in keys/<keyId>.pub.
// Same trust shape the consumer uses (backend/src/modules/plugins/archive/trust-store.ts):
// a raw 32-byte Ed25519 public key, base64, wrapped in the fixed SPKI/DER prefix
// before being handed to crypto.verify. What the drill and CI both call.
import { readFileSync } from 'node:fs';
import { createPublicKey, verify } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const ROOT = fileURLToPath(new URL('..', import.meta.url));

function fail(message) {
  console.error(`verify-catalog: ${message}`);
  process.exit(1);
}

const keyId = process.argv[2];
if (!keyId) fail('usage: node scripts/verify-catalog.mjs <keyId>   (expects keys/<keyId>.pub)');

const keyPath = join(ROOT, 'keys', `${keyId}.pub`);
let rawKey;
try {
  rawKey = Buffer.from(readFileSync(keyPath, 'utf8').trim(), 'base64');
} catch (err) {
  fail(`could not read ${keyPath} (${err.message})`);
}
if (rawKey.length !== 32) {
  fail(`${keyPath} does not decode to a 32-byte Ed25519 public key (got ${rawKey.length} bytes)`);
}

const publicKey = createPublicKey({
  key: Buffer.concat([ED25519_SPKI_PREFIX, rawKey]),
  format: 'der',
  type: 'spki',
});

let data, signature;
try {
  data = readFileSync(join(ROOT, 'catalog.json'));
  signature = Buffer.from(readFileSync(join(ROOT, 'catalog.json.sig'), 'utf8').trim(), 'base64');
} catch (err) {
  fail(`could not read catalog.json / catalog.json.sig (${err.message})`);
}

if (!verify(null, data, publicKey, signature)) {
  fail(`catalog.json.sig does NOT verify against keys/${keyId}.pub`);
}
console.log(`catalog.json.sig verifies against keys/${keyId}.pub`);
