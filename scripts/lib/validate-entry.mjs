// Hand-rolled structural validation of a submitted plugins/<id>/versions/<v>.json
// file, mirroring schema/plugin.schema.v0.json. Deliberately not ajv (or any
// dependency) — this repo ships zero, and the check set is small enough that a
// schema-validator library would cost more than it saves.
import { isValidSemver, hasMandatoryUpperBound } from './semver-lite.mjs';

const ID_PATTERN = /^[a-z][a-z0-9]*(\.[a-z0-9]+)*$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
export const REQUIRED_FIELDS = [
  'id',
  'name',
  'description',
  'author',
  'kind',
  'version',
  'pluginApi',
  'fliks',
  'zipUrl',
  'sha256',
];

/** @returns {{ ok: true } | { ok: false, errors: string[] }} */
export function validateEntry(entry) {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    return { ok: false, errors: ['entry must be a JSON object'] };
  }

  const errors = [];
  for (const key of Object.keys(entry)) {
    if (!REQUIRED_FIELDS.includes(key)) errors.push(`unknown field "${key}"`);
  }
  for (const field of REQUIRED_FIELDS) {
    if (!(field in entry)) errors.push(`missing required field "${field}"`);
  }
  if (errors.length > 0) return { ok: false, errors };

  if (typeof entry.id !== 'string' || !ID_PATTERN.test(entry.id)) {
    errors.push(`"id" must match ${ID_PATTERN} (got ${JSON.stringify(entry.id)})`);
  }
  if (typeof entry.name !== 'string' || entry.name.length === 0) {
    errors.push('"name" must be a non-empty string');
  }
  if (typeof entry.description !== 'string' || entry.description.length === 0) {
    errors.push('"description" must be a non-empty string');
  }
  if (typeof entry.author !== 'string' || entry.author.length === 0) {
    errors.push('"author" must be a non-empty string');
  }
  if (entry.kind !== 'data' && entry.kind !== 'process') {
    errors.push(`"kind" must be "data" or "process" (got ${JSON.stringify(entry.kind)})`);
  }
  if (!isValidSemver(entry.version)) {
    errors.push(`"version" must be a valid semver, e.g. "1.2.3" (got ${JSON.stringify(entry.version)})`);
  }
  if (!Number.isInteger(entry.pluginApi) || entry.pluginApi < 0) {
    errors.push(`"pluginApi" must be a non-negative integer (got ${JSON.stringify(entry.pluginApi)})`);
  }
  if (!hasMandatoryUpperBound(entry.fliks)) {
    errors.push(
      `"fliks" must be a semver range with a mandatory upper bound, e.g. ">=2.1.0 <3.0.0" (got ${JSON.stringify(entry.fliks)})`,
    );
  }
  if (typeof entry.zipUrl !== 'string' || !/^https:\/\//.test(entry.zipUrl)) {
    errors.push('"zipUrl" must be an https URL');
  }
  if (typeof entry.sha256 !== 'string' || !SHA256_PATTERN.test(entry.sha256)) {
    errors.push('"sha256" must be 64 lowercase hex characters');
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}
