import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEntry } from './validate-entry.mjs';

const base = {
  id: 'fliks.download', name: 'n', description: 'd', author: 'a', kind: 'process', version: '1.0.0',
  pluginApi: 2, fliks: '>=5.0.0 <6.0.0', sha256: 'a'.repeat(64),
  zipUrl: 'https://github.com/fliks-app/fk-plugin-download/releases/download/v1.0.0/fliks.download-1.0.0.fkplugin',
};
const errors = (e) => validateEntry(e).errors ?? [];

test('a pluginApi 2 entry pointing at its release asset is valid, with the zeroed placeholder too', () => {
  assert.equal(validateEntry(base).ok, true);
  assert.equal(validateEntry({ ...base, sha256: '0'.repeat(64) }).ok, true);
});

test('a pluginApi 2 entry refuses any other archive location or name', () => {
  for (const zipUrl of [
    'https://fliks-app.github.io/fliks-plugin-catalog/plugins/fliks.download/dist/fliks.download-1.0.0.fkplugin',
    base.zipUrl.replace('1.0.0.fkplugin', '1.0.1.fkplugin'),
    base.zipUrl.replace('fliks.download-', 'fk-plugin-download-'),
    'https://github.com/fliks-app/fk-plugin-download/archive/v1.0.0.zip',
    base.zipUrl.replace('fliks-app/', 'someone/'),
    base.zipUrl.replace('/v1.0.0/', '/1.0.0/'),
    base.zipUrl.replace('/v1.0.0/', '/v1.0.1/'),
    `${base.zipUrl}?x=1`,
    `${base.zipUrl}/`,
  ]) {
    assert.match(errors({ ...base, zipUrl }).join(), /GitHub Release asset/, zipUrl);
  }
});

test('a pluginApi 1 entry keeps any https zipUrl, and a non-https one is still refused once', () => {
  const v1 = { ...base, pluginApi: 1, fliks: '>=4.0.0 <5.0.0', zipUrl: 'https://example.org/x.fkplugin' };
  assert.equal(validateEntry(v1).ok, true);
  assert.deepEqual(errors({ ...base, zipUrl: 'http://example.org/x' }), ['"zipUrl" must be an https URL']);
});

test('a pluginApi 2 data entry keeps the Pages path', () => {
  const zipUrl = 'https://fliks-app.github.io/fliks-plugin-catalog/plugins/fliks.webhooks/dist/fliks.webhooks-2.0.0.fkplugin';
  assert.equal(validateEntry({ ...base, kind: 'data', zipUrl }).ok, true);
});
