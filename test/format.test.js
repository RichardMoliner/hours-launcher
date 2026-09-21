import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBasicAuthHeader } from '../lib/format.js';

test('buildBasicAuthHeader encodes user:pass as base64 with a Basic prefix', () => {
  const header = buildBasicAuthHeader('rjunior', 'segredo123');
  const expectedToken = Buffer.from('rjunior:segredo123').toString('base64');
  assert.equal(header, `Basic ${expectedToken}`);
});
