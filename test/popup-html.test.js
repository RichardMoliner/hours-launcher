import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('popup.html defines the required screens and form fields', () => {
  const html = readFileSync(new URL('../popup.html', import.meta.url), 'utf8');
  const requiredIds = [
    'login-screen', 'main-screen', 'login-form', 'base-url', 'username',
    'password', 'keep-connected', 'login-error', 'login-error-details',
    'login-error-technical', 'greeting', 'logout-link', 'worklog-form',
    'issue-key', 'issue-summary', 'time-spent', 'start-date', 'start-time',
    'comment', 'submit-worklog', 'worklog-error', 'worklog-error-details',
    'worklog-error-technical', 'worklog-success', 'history-list',
    'tab-worklog', 'tab-assigned', 'worklog-panel', 'assigned-panel',
    'assigned-issues-loading', 'assigned-issues-error', 'assigned-issues-error-details',
    'assigned-issues-error-technical', 'assigned-issues-empty', 'assigned-issues-list',
  ];

  for (const id of requiredIds) {
    assert.ok(html.includes(`id="${id}"`), `expected popup.html to contain id="${id}"`);
  }

  assert.ok(html.includes('popup.css'));
  assert.ok(html.includes('type="module"'));
  assert.ok(html.includes('logo.jpg'));
});
