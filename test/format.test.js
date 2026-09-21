import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBasicAuthHeader,
  isValidTimeSpent,
  buildStartedTimestamp,
  buildWorklogPayload,
  addToHistoryEntry,
  normalizeBaseUrl,
  currentLocalDateTime,
} from '../lib/format.js';

test('buildBasicAuthHeader encodes user:pass as base64 with a Basic prefix', () => {
  const header = buildBasicAuthHeader('rjunior', 'segredo123');
  const expectedToken = Buffer.from('rjunior:segredo123').toString('base64');
  assert.equal(header, `Basic ${expectedToken}`);
});

test('buildBasicAuthHeader correctly encodes UTF-8 characters like accents', () => {
  const header = buildBasicAuthHeader('rjunior', 'senhã123');
  const expectedToken = Buffer.from('rjunior:senhã123', 'utf8').toString('base64');
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

test('addToHistoryEntry adds the new entry to the front', () => {
  const result = addToHistoryEntry([], { issueKey: 'DESENV-1' });
  assert.deepEqual(result, [{ issueKey: 'DESENV-1' }]);
});

test('addToHistoryEntry caps the list at maxItems, dropping the oldest', () => {
  const existing = [
    { issueKey: 'A' }, { issueKey: 'B' }, { issueKey: 'C' },
    { issueKey: 'D' }, { issueKey: 'E' },
  ];
  const result = addToHistoryEntry(existing, { issueKey: 'NEW' }, 5);
  assert.equal(result.length, 5);
  assert.deepEqual(result[0], { issueKey: 'NEW' });
  assert.deepEqual(result[4], { issueKey: 'D' });
});

test('addToHistoryEntry defaults maxItems to 5', () => {
  const existing = [
    { issueKey: 'A' }, { issueKey: 'B' }, { issueKey: 'C' },
    { issueKey: 'D' }, { issueKey: 'E' },
  ];
  const result = addToHistoryEntry(existing, { issueKey: 'NEW' });
  assert.equal(result.length, 5);
});

test('normalizeBaseUrl strips a trailing slash', () => {
  assert.equal(normalizeBaseUrl('https://desenv.betha.com.br/'), 'https://desenv.betha.com.br');
});

test('normalizeBaseUrl trims surrounding whitespace', () => {
  assert.equal(normalizeBaseUrl('  https://desenv.betha.com.br  '), 'https://desenv.betha.com.br');
});

test('normalizeBaseUrl leaves a clean URL unchanged', () => {
  assert.equal(normalizeBaseUrl('https://desenv.betha.com.br'), 'https://desenv.betha.com.br');
});

test('currentLocalDateTime keeps the local date for a late-evening time (no UTC roll-over)', () => {
  const now = new Date(2026, 8, 21, 23, 30);
  assert.deepEqual(currentLocalDateTime(now), { date: '2026-09-21', time: '23:30' });
});

test('currentLocalDateTime zero-pads single-digit month, day, hour, and minute', () => {
  const now = new Date(2026, 0, 5, 4, 5);
  assert.deepEqual(currentLocalDateTime(now), { date: '2026-01-05', time: '04:05' });
});
