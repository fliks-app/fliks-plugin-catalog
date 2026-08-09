// Structural semver helpers. Not a semver-range engine (no `satisfies`) — the
// consumer (`semver.validRange`/`semver.satisfies` in the fliks backend) is the
// authority on install-time compatibility. This only has to (a) sort published
// versions deterministically and (b) refuse what the consumer would treat as
// unbounded above, without adding a dependency to a repo that has none.

const CORE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const COMPARATOR = /^(>=|<=|>|<|=)?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/;

export function isValidSemver(version) {
  return typeof version === 'string' && CORE.test(version);
}

/** Every OR-branch (split on `||`) must carry at least one `<`/`<=` comparator. */
export function hasMandatoryUpperBound(range) {
  if (typeof range !== 'string' || range.trim() === '') return false;
  const branches = range.split('||').map((s) => s.trim());
  return branches.every((branch) => {
    const tokens = branch.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return false;
    let hasUpper = false;
    for (const token of tokens) {
      const m = COMPARATOR.exec(token);
      if (!m) return false;
      if (m[1] === '<' || m[1] === '<=') hasUpper = true;
    }
    return hasUpper;
  });
}

function stripBuildMetadata(version) {
  return version.split('+')[0];
}

function splitPrerelease(version) {
  const i = version.indexOf('-');
  return i === -1 ? [version, null] : [version.slice(0, i), version.slice(i + 1)];
}

function comparePrerelease(a, b) {
  if (a === b) return 0;
  if (a === null) return 1; // no prerelease outranks any prerelease
  if (b === null) return -1;
  const as = a.split('.');
  const bs = b.split('.');
  const len = Math.max(as.length, bs.length);
  for (let i = 0; i < len; i++) {
    if (as[i] === undefined) return -1;
    if (bs[i] === undefined) return 1;
    const aNum = /^\d+$/.test(as[i]);
    const bNum = /^\d+$/.test(bs[i]);
    if (aNum && bNum) {
      const diff = Number(as[i]) - Number(bs[i]);
      if (diff !== 0) return diff < 0 ? -1 : 1;
    } else if (aNum !== bNum) {
      return aNum ? -1 : 1; // numeric identifiers have lower precedence than alphanumeric
    } else if (as[i] !== bs[i]) {
      return as[i] < bs[i] ? -1 : 1;
    }
  }
  return 0;
}

/** Ascending semver precedence order. Assumes both inputs already passed {@link isValidSemver}. */
export function compareSemver(a, b) {
  const [coreA, preA] = splitPrerelease(stripBuildMetadata(a));
  const [coreB, preB] = splitPrerelease(stripBuildMetadata(b));
  const partsA = coreA.split('.').map(Number);
  const partsB = coreB.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (partsA[i] !== partsB[i]) return partsA[i] < partsB[i] ? -1 : 1;
  }
  return comparePrerelease(preA, preB);
}
