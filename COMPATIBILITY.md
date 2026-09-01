# Compatibility

Two axes, checked independently, at three points: **catalog** (this repo, and the
filter Fliks applies to what it fetched), **install** (`POST /api/plugins/import/*`),
and **handshake** (`hello`, for the `process` tier only, every time the plugin is
spawned).

- **`pluginApi` is an integer, and core accepts every value it still supports.** Not
  a range and not a minimum: an explicit set, `SUPPORTED_PLUGIN_API_VERSIONS` in the
  consumer. Within one `pluginApi` value the method set is **additive only** — a new
  method or a new optional field can never break a plugin written against an older
  minor of the same `pluginApi`. Any removal or change in existing behaviour requires
  a new `pluginApi` value.
- **A prerelease core matches as its own release.** `3.0.0-rc.1` is checked as
  `3.0.0`, because a prerelease sorts *below* its release and would otherwise satisfy
  no range that admits it — leaving a release candidate unable to run any plugin, and
  a major upgrade impossible to rehearse.
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
| `0` | `>=2.0.0 <3.0.0` | retired: core 3.8.0 dropped it from `SUPPORTED_PLUGIN_API_VERSIONS` |
| `1` | `>=3.8.0 <4.0.0` | current |

The `0` row records the range its first manifests declared; later `0` submissions raised
their own floor into the 3.x line without changing the revision, which stayed additive
throughout. It ends at core 3.8.0: the upgrade window left `AcquisitionTarget.want` so that
core applies the whole quality profile itself, and a removal inside one revision would have
handed an acquisition plugin an absent bound it filtered releases on. A `0` plugin is refused
with `incompatible-api` from that release, which is the loud form of the same news.

Source of truth: `SUPPORTED_PLUGIN_API_VERSIONS` (what core accepts) and
`PLUGIN_API_VERSION` (what core sends at `hello`) in
`backend/src/common/plugin-contract/protocol.ts` in the `fliks-app/fliks` repo.

## When this table changes

- **A new row is added, never an existing one edited**, when core bumps
  `PLUGIN_API_VERSION` (plan skew case 4: an ABI break). The old row stays exactly as
  it is — plugins built against it do not retroactively change what they support.
- `validate-pr.yml` refuses any submitted `pluginApi` that has no row here. A plugin
  cannot be the first thing that tells this repo a new `pluginApi` exists.
- Bumping `PLUGIN_API_VERSION` in core does **not** immediately orphan plugins on the
  old value: core keeps accepting every entry in `SUPPORTED_PLUGIN_API_VERSIONS`. They
  stop being `installable` only once a later core release drops the old entry — and the
  window between the two is when authors republish. Plan the drop as its own release,
  and announce it with the bump.
