# Keys

This directory holds **public keys only**. One file per key id, named `<keyId>.pub`,
containing a single line: the raw 32-byte Ed25519 public key, base64-encoded. That is
the exact format `backend/src/modules/plugins/archive/trust-store.ts` expects to find
compiled into `OFFICIAL_KEYS` on the Fliks side, and it is what
`scripts/verify-catalog.mjs <keyId>` reads.

## The model

- **A key file is never deleted, once published.** A signature made in 2026 must
  still verify in 2031, against whatever installed that catalog and cached the key.
  Deleting a key file does not revoke the key — see `../COMPATIBILITY.md`'s sibling
  concept for `pluginApi` rows: old facts don't get retracted, new facts get added.
- **Rotating to a new signing key means adding a new file, not replacing one.**
  `scripts/sign-catalog.mjs` always signs with whichever private key
  `CATALOG_SIGNING_KEY` holds; the corresponding public key must already be
  committed here before that signature is any use to anyone.
- **No private key is ever committed here, or anywhere in this repository.** The
  real signing key lives only in this repo's `CATALOG_SIGNING_KEY` Actions secret.
  See `../docs/key-rotation.md` for how one is generated and where it's kept, and
  for a full rehearsal of this process against disposable test keys.

## Files in this directory

Every `.pub` file here is real and permanently published, **except** the two
prefixed `test-`, which exist only as the artifact of the rehearsal in
`../docs/key-rotation.md` and never verified a real catalog. They stay for the same
reason production keys stay: to prove the "never delete a key" rule holds for the
one case this repo can safely demonstrate in public.
