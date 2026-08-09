#!/usr/bin/env node
// Signs catalog.json with CATALOG_SIGNING_KEY (a base64 PKCS8-DER Ed25519 private
// key) and writes catalog.json.sig as base64 text — the exact shape
// PluginCatalogClientService.parseSignature expects at `<source url>.sig`.
// Verifies against the key's own public half before writing: a broken or
// wrong-algorithm key must fail loudly here, not ship a garbage signature.
import { readFileSync, writeFileSync } from 'node:fs';
import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CATALOG_FILE = join(ROOT, 'catalog.json');
const SIG_FILE = join(ROOT, 'catalog.json.sig');

function fail(message) {
  console.error(`sign-catalog: ${message}`);
  process.exit(1);
}

const keyB64 = process.env.CATALOG_SIGNING_KEY;
if (!keyB64 || keyB64.trim() === '') {
  fail('CATALOG_SIGNING_KEY is not set — refusing to publish an unsigned catalog.');
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

let data;
try {
  data = readFileSync(CATALOG_FILE);
} catch (err) {
  fail(`could not read ${CATALOG_FILE} (${err.message}). Run scripts/build-catalog.mjs first.`);
}

const signature = sign(null, data, privateKey);

const publicKey = createPublicKey(privateKey);
if (!verify(null, data, publicKey, signature)) {
  fail('sign-then-verify failed immediately after signing — refusing to write catalog.json.sig.');
}

writeFileSync(SIG_FILE, `${signature.toString('base64')}\n`, 'utf8');
console.log(`signed ${CATALOG_FILE} -> ${SIG_FILE}`);
