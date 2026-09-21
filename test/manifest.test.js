import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('manifest.json is a valid MV3 config for the extension', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../manifest.json', import.meta.url))
  );

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.action.default_popup, 'popup.html');
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.deepEqual(manifest.host_permissions, ['https://desenv.betha.com.br/*']);
  assert.equal(manifest.background, undefined);
  assert.equal(manifest.icons['128'], 'logo.jpg');
  assert.equal(manifest.action.default_icon['128'], 'logo.jpg');
});
