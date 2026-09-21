import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBasicAuthHeader, isValidTimeSpent } from '../lib/format.js';

test('buildBasicAuthHeader encodes user:pass as base64 with a Basic prefix', () => {
  const header = buildBasicAuthHeader('rjunior', 'segredo123');
  const expectedToken = Buffer.from('rjunior:segredo123').toString('base64');
  assert.equal(header, `Basic ${expectedToken}`);
});

test('isValidTimeSpent accepts Jira-style duration strings', () => {
  assert.equal(isValidTimeSpent('2h'), true);
  assert.equal(isValidTimeSpent('1h 30m'), true);
  assert.equal(isValidTimeSpent('45m'), true);
  assert.equal(isValidTimeSpent('1d 4h'), true);
  assert.equal(isValidTimeSpent('3w'), true);
});

test('isValidTimeSpent rejects empty, missing-unit, or malformed strings', () => {
  assert.equal(isValidTimeSpent(''), false);
  assert.equal(isValidTimeSpent('   '), false);
  assert.equal(isValidTimeSpent('30'), false);
  assert.equal(isValidTimeSpent('two hours'), false);
  assert.equal(isValidTimeSpent('2h,30m'), false);
});
