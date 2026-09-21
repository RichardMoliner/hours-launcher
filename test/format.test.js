import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBasicAuthHeader, isValidTimeSpent, buildStartedTimestamp, buildWorklogPayload } from '../lib/format.js';

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

test('buildStartedTimestamp formats a UTC-negative offset (e.g. Brazil, -03:00)', () => {
  // getTimezoneOffset() for UTC-3 is +180 (minutes behind UTC)
  assert.equal(
    buildStartedTimestamp('2026-09-21', '09:00', 180),
    '2026-09-21T09:00:00.000-0300'
  );
});

test('buildStartedTimestamp formats a UTC-positive offset', () => {
  // getTimezoneOffset() for UTC+1 is -60
  assert.equal(
    buildStartedTimestamp('2026-01-10', '14:30', -60),
    '2026-01-10T14:30:00.000+0100'
  );
});

test('buildStartedTimestamp treats zero offset as +0000', () => {
  assert.equal(
    buildStartedTimestamp('2026-01-10', '00:05', 0),
    '2026-01-10T00:05:00.000+0000'
  );
});

test('buildWorklogPayload includes a trimmed comment when present', () => {
  const payload = buildWorklogPayload({
    startedIso: '2026-09-21T09:00:00.000-0300',
    timeSpent: '2h',
    comment: '  revisão de PR  ',
  });
  assert.deepEqual(payload, {
    started: '2026-09-21T09:00:00.000-0300',
    timeSpent: '2h',
    comment: 'revisão de PR',
  });
});

test('buildWorklogPayload omits comment when empty, whitespace, or missing', () => {
  const base = { startedIso: '2026-09-21T09:00:00.000-0300', timeSpent: '2h' };
  assert.deepEqual(buildWorklogPayload(base), {
    started: base.startedIso,
    timeSpent: '2h',
  });
  assert.deepEqual(buildWorklogPayload({ ...base, comment: '' }), {
    started: base.startedIso,
    timeSpent: '2h',
  });
  assert.deepEqual(buildWorklogPayload({ ...base, comment: '   ' }), {
    started: base.startedIso,
    timeSpent: '2h',
  });
});
