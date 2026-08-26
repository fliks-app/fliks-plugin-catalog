// A descriptor is committed before its archive is built and signed, and carries a zeroed
// checksum until then. Serving it made the catalog advertise a version whose checksum matched
// nothing — an installer that cached the catalog in that window failed the check on every
// attempt until its next refresh, which is how a published release read as a corrupt download.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPlaceholderChecksum } from './build-catalog.mjs';

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
