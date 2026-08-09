# Key-rotation drill — executed record

This is a record of an actual run, not a proposal. It was executed once, in this
repository's working tree, on the date of the initial commit, using two disposable
Ed25519 test keypairs generated for this purpose only (`test-2026a`, `test-2026b`).
Neither key was ever used to sign a real catalog and neither private half was ever
committed anywhere — both live only in `/tmp/fliks-catalog-drill/` on the machine
that ran this, and that directory is not part of any git repository.

## 1. Generate two keypairs with `node:crypto`

```
$ mkdir -p /tmp/fliks-catalog-drill
$ node -e "
const { generateKeyPairSync } = require('crypto');
const { writeFileSync } = require('fs');
function gen(name) {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const privB64 = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
  const spki = publicKey.export({ type: 'spki', format: 'der' });
  const pubB64 = spki.subarray(spki.length - 32).toString('base64');
  writeFileSync('/tmp/fliks-catalog-drill/' + name + '.priv.b64', privB64);
  writeFileSync('/tmp/fliks-catalog-drill/' + name + '.pub.b64', pubB64);
  console.log(name + ' public key: ' + pubB64);
}
gen('test-2026a');
gen('test-2026b');
"
test-2026a public key: HkIRt/z2fSPDRJZEga5ztHdd+ZG6LhungXrQbrcQRQQ=
test-2026b public key: hcsjw3L9iTx0tRb0Jw119VwS9dOoP9iIlzRkqCWsDb0=
```

The private key format is base64 PKCS8 DER — what `createPrivateKey({ format: 'der',
type: 'pkcs8' })` reads back, and what `scripts/sign-catalog.mjs` expects in
`CATALOG_SIGNING_KEY`. The public key format is the raw 32-byte Ed25519 key, base64
— what `keys/*.pub` holds and what
`backend/src/modules/plugins/archive/trust-store.ts`'s `OFFICIAL_KEYS` map stores on
the Fliks side. Same technique the consumer's own test helper uses
(`backend/src/modules/plugins/archive/ed25519-test-keys.ts`'s `generateTestKeypair`).

## 2. Commit both public halves to `keys/`

```
$ cp /tmp/fliks-catalog-drill/test-2026a.pub.b64 keys/test-2026a.pub
$ cp /tmp/fliks-catalog-drill/test-2026b.pub.b64 keys/test-2026b.pub
$ git add keys/test-2026a.pub keys/test-2026b.pub
$ git commit -m "docs: commit test keypair public halves for the rotation drill"
```

Both files stay in `keys/` permanently — see `keys/README.md`. That is the entire
point being rehearsed: a public key, once published, is never deleted, so whatever
it once verified keeps verifying.

## 3. Build a catalog to sign

The real `plugins/` tree was empty at the time of this drill (no plugin has been
submitted yet), so the first build is the trivial case:

```
$ node scripts/build-catalog.mjs
wrote catalog.json (0 plugins, 0 version(s))
$ cat catalog.json
{
  "plugins": []
}
```

`{"plugins": []}` is accepted by the consumer's `parseCatalogDocument` — an empty
array trivially satisfies `.every(isPluginEntry)` — but it doesn't exercise
per-entry validation. For a signal-carrying rehearsal, a drill fixture plugin was
added temporarily (`plugins/fliks.examplenotify/versions/1.0.0.json`, `kind: data`,
`pluginApi: 0`, `fliks: ">=2.1.0 <3.0.0"`), the catalog was rebuilt, and it is this
version of `catalog.json` that the rest of this document signs and verifies. The
fixture was removed after the drill — it was never a real submission and is not in
`plugins/` in this repository. Its shape is reproduced in `README.md`'s "how a
plugin gets in" section.

## 4. Sign with A, verify with A

```
$ CATALOG_SIGNING_KEY=$(cat /tmp/fliks-catalog-drill/test-2026a.priv.b64) node scripts/sign-catalog.mjs
signed catalog.json -> catalog.json.sig
$ cat catalog.json.sig
PYt0sWb3lxBryanO0a7oD7GIA2opv0pJ+yiVp315tZVu4qJJkzWoFsGgLCjAlCxxh/6u5Myp/T0GhP29/OB/DQ==

$ node scripts/verify-catalog.mjs test-2026a
catalog.json.sig verifies against keys/test-2026a.pub
$ echo $?
0
```

A copy of this signature was saved to `/tmp/fliks-catalog-drill/catalog.json.sig.signed-by-a`
for step 6.

## 5. Rotate to B, re-sign, verify with B

```
$ CATALOG_SIGNING_KEY=$(cat /tmp/fliks-catalog-drill/test-2026b.priv.b64) node scripts/sign-catalog.mjs
signed catalog.json -> catalog.json.sig
$ cat catalog.json.sig
NMOSq5dXzAm4w3n6XgU+NmPwWYucanMIr7ASYhlLgHs/lkjMAKNz0K5ntxhScCpTgx868vmIaJuf48o04uHRCQ==

$ node scripts/verify-catalog.mjs test-2026b
catalog.json.sig verifies against keys/test-2026b.pub
$ echo $?
0

$ node scripts/verify-catalog.mjs test-2026a
verify-catalog: catalog.json.sig does NOT verify against keys/test-2026a.pub
$ echo $?
1
```

Expected: the freshly-rotated signature verifies against the new key and correctly
fails against the old one — it was never signed by A, so it must not.

## 6. The point of the drill: A's *old* signature still verifies against A's retained key

This is what "never delete a key" is actually for. It is not that A keeps signing
things — A is retired. It is that whatever A already signed, before rotation, must
still check out today, because some installation out there cached that exact
`catalog.json` + `catalog.json.sig` pair and will re-verify it against whichever key
id `verifiedByKeyId` says signed it, possibly a long time from now.

```
$ cp /tmp/fliks-catalog-drill/catalog.json.sig.signed-by-a catalog.json.sig
$ node scripts/verify-catalog.mjs test-2026a
catalog.json.sig verifies against keys/test-2026a.pub
$ echo $?
0
```

Passes. `keys/test-2026a.pub` was never touched by the rotation in step 5 — rotation
added `test-2026b.pub`, it did not remove `test-2026a.pub` — so the signature A made
before B ever existed verifies identically after B exists and after B has signed
something else. That is the guarantee this repo makes to every install that cached
an older catalog.

## 7. And that same retained A-signature must not verify against B

```
$ node scripts/verify-catalog.mjs test-2026b
verify-catalog: catalog.json.sig does NOT verify against keys/test-2026b.pub
$ echo $?
1
```

Confirms the negative: a signature is bound to the key that made it, not to "some
key this repo currently trusts." Rotation does not retroactively make A's old
signatures wearable by B, and it does not make B's signatures pass under A's key
either — the two checks in steps 6 and 7 together are the whole rotation contract in
two commands.

## Consumer check — does the real Fliks parser accept this?

Every step above only proves this repo's own scripts agree with each other. The
question that matters is whether `backend/src/modules/plugins/catalog/catalog.ts`'s
`parseCatalogDocument` — the actual code that ships in Fliks and that every install
runs against a fetched catalog — accepts the bytes `build-catalog.mjs` produces. It
does; this imports the real file from a checked-out `fliks-app/fliks`, unmodified,
via `ts-node`, rather than reimplementing its logic to check:

```
$ cd <fliks checkout>/backend
$ cat > src/__tmp_catalog_consumer_check.ts <<'EOF'
import { readFileSync } from 'fs';
import { parseCatalogDocument, filterCatalog } from './modules/plugins/catalog/catalog';
import { PLUGIN_API_VERSION } from './common/plugin-contract';

const path = process.argv[2];
const fliksVersion = process.argv[3] ?? '2.4.0';
const bytes = readFileSync(path);
const doc = parseCatalogDocument(bytes);
console.log(JSON.stringify({ accepted: doc !== null, fliksVersion }, null, 2));
if (doc) {
  console.log(JSON.stringify(filterCatalog(doc, PLUGIN_API_VERSION, fliksVersion), null, 2));
}
EOF
$ node_modules/.bin/ts-node --transpile-only src/__tmp_catalog_consumer_check.ts \
    <path-to-this-repo>/catalog.json 2.4.0
```

Output, against the fixture-backed `catalog.json` from step 3, on a simulated core
version `2.4.0` (inside the fixture's declared `">=2.1.0 <3.0.0"` range):

```json
{
  "accepted": true,
  "fliksVersion": "2.4.0"
}
{
  "plugins": [
    {
      "id": "fliks.examplenotify",
      "name": "Example notification target",
      "description": "Drill fixture only, not a real published plugin.",
      "author": "Fliks",
      "kind": "data",
      "installable": [
        {
          "version": "1.0.0",
          "pluginApi": 0,
          "fliks": ">=2.1.0 <3.0.0",
          "zipUrl": "https://example.invalid/fliks.examplenotify-1.0.0.fkplugin",
          "sha256": "1297f90736ec3ab49c5451aa30fe86acb9d54bd666de9c471265d6354c59f6f3"
        }
      ],
      "hidden": null
    }
  ]
}
```

And the same catalog against a simulated core version `3.0.0` — past the fixture's
declared upper bound — to prove the compat filter, not just the parser, agrees with
this repo's understanding of "installable":

```
$ node_modules/.bin/ts-node --transpile-only src/__tmp_catalog_consumer_check.ts \
    <path-to-this-repo>/catalog.json 3.0.0
```

```json
{
  "accepted": true,
  "fliksVersion": "3.0.0"
}
{
  "plugins": [
    {
      "id": "fliks.examplenotify",
      "name": "Example notification target",
      "description": "Drill fixture only, not a real published plugin.",
      "author": "Fliks",
      "kind": "data",
      "installable": [],
      "hidden": { "count": 1, "minFliksVersion": null }
    }
  ]
}
```

Matches skew case 1 in `plans/plugin-system.plan.md` exactly: past the declared
upper bound, the version is `hidden` with `installable: []`, and `minFliksVersion`
is `null` because no future core version can fix a range that is already behind it
— there is nothing to recommend upgrading to.

`src/__tmp_catalog_consumer_check.ts` was a scratch file inside the `fliks` checkout,
never committed — `git status` was clean there both before and after.

## How a real key is generated and stored (not done here)

Nothing above used or produced a real signing key, deliberately. The keys in this
drill are named `test-2026a`/`test-2026b` and are exactly as disposable as they
sound. A real key:

1. Is generated the same way — `generateKeyPairSync('ed25519')` — but on an
   operator's own machine, or in a short-lived, throwaway CI job that never
   persists its environment, not by an assistant in a shared clone.
2. Never touches disk unencrypted longer than it takes to copy it into a secret
   store. The base64 PKCS8 private half becomes the value of the
   `CATALOG_SIGNING_KEY` repository secret (Settings → Secrets and variables →
   Actions) on `fliks-app/fliks-plugin-catalog`. It is never written to a file
   that survives the terminal session that created it.
3. Has its public half — the raw 32-byte key, base64, the same transform this
   drill used — committed to `keys/<real-key-id>.pub`, permanently, following the
   same "never delete" rule this drill rehearsed.
4. Needs one more piece of repository configuration this drill did not touch: a
   `CATALOG_KEY_ID` repository **variable** (Settings → Secrets and variables →
   Actions → Variables) set to that key's id, so `.github/workflows/publish.yml`
   knows which `keys/*.pub` file to independently re-verify the fresh signature
   against after signing. And GitHub Pages needs to be switched to "GitHub
   Actions" as its source once, for `actions/deploy-pages` to have somewhere to
   publish.
5. Should have its public half's fingerprint (or the raw base64 itself) posted
   somewhere out-of-band — a release note, a pinned issue — so a future signer
   change is detectable even by someone who never re-reads `keys/`.

`OFFICIAL_KEYS` in `backend/src/modules/plugins/archive/trust-store.ts` is an empty
map today, with a comment marking this repository as the place that mints the first
one. That step — generating the actual production key and wiring its public half
into that file in a `fliks` PR — is intentionally left undone by this drill: it is a
one-way action with real consequences (`docs/key-rotation.md`'s own rule above,
"never delete"), so it belongs to whoever owns that key going forward, not to a
scratch clone that generated a demo pair to prove the mechanism.

## Cleanup

`/tmp/fliks-catalog-drill/` (all four files: two `.priv.b64`, two `.pub.b64`, plus
the two saved `.sig` copies) is scratch and was left on the machine that ran this,
outside any git repository. `catalog.json` and `catalog.json.sig` produced during
the drill were removed from the working tree afterward — this repository does not
ship a hand-signed catalog; see `README.md` for why `catalog.json` is a CI-produced
artifact, not a committed one.
