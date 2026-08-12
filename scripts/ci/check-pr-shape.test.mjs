// The gate exists so a checksum an installed plugin verified against cannot be swapped
// underneath it. Both directions are pinned: what it must refuse, and what publishing needs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { violationsIn } from './check-pr-shape.mjs';

test('a legitimate release adds a version and rewrites the source it is built from', () => {
  const diff = [
    'A\tplugins/fliks.download/versions/0.1.7.json',
    'M\tplugins/fliks.download/src/plugin.js',
    'M\tplugins/fliks.download/src/plugin.json',
    'M\tplugins/fliks.download/README.md',
  ].join('\n');
  assert.deepEqual(violationsIn(diff), []);
});

test('VERDICT: refuses touching a published descriptor or archive, however it is touched', () => {
  const cases = [
    'M\tplugins/fliks.webhooks/versions/1.1.2.json',
    'D\tplugins/fliks.download/dist/fliks.download-0.1.4.fkplugin',
    'R071\tplugins/fliks.download/versions/0.1.5.json\tplugins/fliks.download/versions/0.1.6.json',
  ];
  for (const line of cases) assert.equal(violationsIn(line).length, 1, line);
});

test('a rename away from a published descriptor is caught on its old path', () => {
  const [only] = violationsIn('R071\tplugins/x/versions/1.0.0.json\tplugins/x/versions/1.1.0.json');
  assert.match(only, /versions\/1\.0\.0\.json/);
});
