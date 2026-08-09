# fliks-plugin-catalog

This is a plugin repository (called a **source** in Fliks). It is the official,
PR-reviewed index of plugins a Fliks server can discover and install. It does not
contain plugin code — a plugin's code lives in its own repository (`fk-plugin-<name>`)
and is distributed as a signed ZIP; this repository only publishes a signed pointer
to it (a download URL and its checksum) plus the compatibility metadata Fliks needs
to decide whether that version is installable.

## Three nouns, on purpose

Fliks's plugin docs are careful to keep three words apart, because they name three
different things:

| Noun | Is | Lives |
|---|---|---|
| **source** | a URL an admin adds to their server; there can be several, this repo's published catalog is just the seeded first one | the `plugin_sources` table, and the word the admin UI uses |
| **catalog** | the signed JSON document served at a source's URL | `catalog.json` in this repo |
| **plugin repo** | the git repository holding one plugin's source code | `fk-plugin-<name>`, e.g. `fk-plugin-download` |

This repository *is* a plugin repo in the generic sense — hence the name above — but
inside Fliks itself it is only ever referred to as a **source**, and it holds a
**catalog**. Using "repository" for all three would make "the plugin repository
repository" a sentence someone eventually has to say out loud.

## What's in here

```
catalog.json            generated — the signed index Fliks fetches
catalog.json.sig        generated — Ed25519 signature over catalog.json's exact bytes
schema/                 JSON Schema for a submitted plugins/*/versions/*.json file
COMPATIBILITY.md         pluginApi <-> Fliks core version table
keys/                   published Ed25519 public keys, one file per key id, never deleted
scripts/                the build/sign/verify pipeline (plain Node, no dependencies)
plugins/<id>/versions/<version>.json   one file per published plugin version
```

`catalog.json` and `catalog.json.sig` are build artifacts produced by CI
(`.github/workflows/publish.yml`) on every push to `main`. They are not hand-edited,
and this repository does not ship a pre-signed one — a real signature needs the real
signing key, which lives only in this repo's `CATALOG_SIGNING_KEY` secret. See
`docs/key-rotation.md` for a full dry run of the signing pipeline against disposable
test keys.

## How a plugin gets in

1. Fork, and add exactly one new file: `plugins/<pluginId>/versions/<version>.json`.
   Never edit a version file that already exists — a published version's metadata is
   immutable; if something about it changes, publish a new version.
2. The file must validate against `schema/plugin.schema.v0.json`. Minimal example:

   ```json
   {
     "id": "fliks.download",
     "name": "Download & indexers",
     "description": "Torznab indexers, download clients and the acquisition queue.",
     "author": "Fliks",
     "kind": "process",
     "version": "1.0.0",
     "pluginApi": 0,
     "fliks": ">=2.1.0 <3.0.0",
     "zipUrl": "https://github.com/fliks-app/fk-plugin-download/releases/download/v1.0.0/fk-plugin-download-1.0.0.fkplugin",
     "sha256": "<sha256 of that exact zip, lowercase hex>"
   }
   ```

   `name`, `description`, `author` and `kind` must be identical across every version
   of the same plugin `id` — the catalog carries one of each per plugin, not per
   version.
3. Open a PR. `.github/workflows/validate-pr.yml` runs the cheapest checks first —
   PR shape, schema, `pluginApi` present in `COMPATIBILITY.md`, a mandatory `fliks`
   upper bound, deterministic regeneration — and refuses long before it would need to
   download your archive.
4. A maintainer reviews and merges. `.github/workflows/publish.yml` regenerates
   `catalog.json`, signs it, and republishes to GitHub Pages. No separate release
   step.

`pluginApi` is currently **0** — see `COMPATIBILITY.md` for what that maps to on the
core side.

## Why "no dependencies"

Every script here is plain Node (`node:crypto`, `node:fs`, `node:path` — nothing
else). There is no `package.json` and nothing to `npm install`. A registry that
gatekeeps supply-chain risk for every other plugin should not import its own.
