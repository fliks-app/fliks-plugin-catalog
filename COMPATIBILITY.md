# Compatibility

Two axes, checked independently, at three points: **catalog** (this repo, and the
filter Fliks applies to what it fetched), **install** (`POST /api/plugins/import/*`),
and **handshake** (`hello`, for the `process` tier only, every time the plugin is
spawned).

- **`pluginApi` is an integer, checked for exact equality.** Not a range, not
  a minimum. Within one `pluginApi` value the method set is **additive only** — a
  new method or a new optional field can never break a plugin written against an
  older minor of the same `pluginApi`. Any removal or change in existing behaviour
  requires a new `pluginApi` value.
- **`fliks` is a semver range with a mandatory upper bound.** `">=2.1.0"` alone is
  refused by every validator in this repo and by the consumer's own parser
  (`semver.validRange` still accepts it, but `validate-pr.yml` and
  `scripts/build-catalog.mjs` do not). A lower-bound-only range is the single
  most-reported plugin failure in comparable ecosystems: it installs clean and dies
  at load, on a version nobody tested against. Every range here looks like
  `">=2.1.0 <3.0.0"`.

## `pluginApi` -> Fliks core version

| `pluginApi` | Compatible `fliks` core versions | Status |
|---|---|---|
| `0` | `>=2.1.0 <3.0.0` | current |

Source of truth for the current value: `PLUGIN_API_VERSION` in
`backend/src/common/plugin-contract/protocol.ts` in the `fliks-app/fliks` repo.

## When this table changes

- **A new row is added, never an existing one edited**, when core bumps
  `PLUGIN_API_VERSION` (plan skew case 4: an ABI break). The old row stays exactly as
  it is — plugins built against it do not retroactively change what they support.
- `validate-pr.yml` refuses any submitted `pluginApi` that has no row here. A plugin
  cannot be the first thing that tells this repo a new `pluginApi` exists.
- Bumping `PLUGIN_API_VERSION` in core is a breaking change for every plugin on the
  old value: they disappear from the catalog for users on the new core major (they
  are not deleted, just no longer `installable` — see `filterCatalog` in the
  consumer) until republished against the new `pluginApi`.
