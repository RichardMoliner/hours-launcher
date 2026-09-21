import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeLoginError, describeApiError } from '../lib/jira-api.js';

test('describeLoginError maps 401 to invalid credentials message', () => {
  assert.equal(describeLoginError(401), 'Usuário ou senha inválidos');
});

test('describeLoginError falls back to a generic message with status', () => {
  assert.equal(describeLoginError(500), 'Não foi possível fazer login (status 500).');
});

test('describeApiError maps known statuses', () => {
  assert.equal(describeApiError(401), 'Sessão expirada, faça login novamente');
  assert.equal(
    describeApiError(404, { issueKey: 'DESENV-1234' }),
    'Tarefa DESENV-1234 não encontrada. Confira a chave.'
  );
  assert.equal(
    describeApiError(400),
    'Não foi possível interpretar o tempo informado. Use um formato como 2h, 1h 30m ou 45m.'
  );
});

test('describeApiError maps 404 without issueKey', () => {
  assert.equal(describeApiError(404), 'Tarefa não encontrada. Confira a chave.');
});

test('describeApiError falls back to a generic message with status', () => {
  assert.equal(describeApiError(500), 'Não foi possível completar a operação (status 500).');
});
