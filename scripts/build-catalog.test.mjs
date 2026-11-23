// A descriptor is committed before its archive is built and signed, and carries a zeroed
// checksum until then. Serving it made the catalog advertise a version whose checksum matched
// nothing — an installer that cached the catalog in that window failed the check on every
// attempt until its next refresh, which is how a published release read as a corrupt download.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatedAt, isPlaceholderChecksum, newestEntry } from './build-catalog.mjs';

test('a zeroed checksum is recognised as the placeholder it is', () => {
  assert.equal(isPlaceholderChecksum('0'.repeat(64)), true);
});

test('a real checksum is never mistaken for one, including one that merely starts with zeros', () => {
  assert.equal(isPlaceholderChecksum('f98043576be26def0b57f21d1ad6a78230be5116ba79ae5984743702cc85298b'), false);
  assert.equal(isPlaceholderChecksum('0'.repeat(63) + '1'), false);
  assert.equal(isPlaceholderChecksum('00' + 'a'.repeat(62)), false);
});

test('a wrong-length or absent value is not the placeholder — validateEntry owns rejecting those', () => {
  assert.equal(isPlaceholderChecksum('0'.repeat(63)), false);
  assert.equal(isPlaceholderChecksum(''), false);
  assert.equal(isPlaceholderChecksum(undefined), false);
});

test('the plugin name comes from its newest version, by semver not by file order', () => {
  const entries = [{ version: '3.1.0', name: 'Torrent manager' }, { version: '3.0.0', name: 'Download' }, { version: '10.0.0', name: 'Newest' }];
  assert.equal(newestEntry(entries).name, 'Newest');
  assert.equal(newestEntry(entries.slice(0, 2)).name, 'Torrent manager');
});

test('generatedAt is the build time, in RFC 3339, so a host can order two catalogs', () => {
  const now = new Date('2026-11-23T10:00:00.000Z');
  assert.equal(generatedAt({}, now), '2026-11-23T10:00:00.000Z');
  assert.equal(generatedAt({ SOURCE_DATE_EPOCH: '' }, now), '2026-11-23T10:00:00.000Z');
});

test('SOURCE_DATE_EPOCH pins generatedAt, which keeps two builds of one tree byte-identical', () => {
  assert.equal(generatedAt({ SOURCE_DATE_EPOCH: '1795428000' }), '2026-11-23T10:00:00.000Z');
  assert.throws(() => generatedAt({ SOURCE_DATE_EPOCH: 'yesterday' }), /whole seconds/);
});
