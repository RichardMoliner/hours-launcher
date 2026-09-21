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

import { validateLogin } from '../lib/jira-api.js';

function fakeFetch(response) {
  const calls = [];
  const fn = async (url, options) => {
    calls.push({ url, options });
    return response;
  };
  fn.calls = calls;
  return fn;
}

test('validateLogin returns user info on 200', async () => {
  const fetchImpl = fakeFetch({
    ok: true,
    status: 200,
    json: async () => ({ name: 'rjunior', displayName: 'Richard', emailAddress: 'r@x.com' }),
  });

  const result = await validateLogin({
    baseUrl: 'https://desenv.betha.com.br',
    authHeader: 'Basic abc123',
    fetchImpl,
  });

  assert.deepEqual(result, {
    ok: true,
    name: 'rjunior',
    displayName: 'Richard',
    emailAddress: 'r@x.com',
  });
  assert.equal(fetchImpl.calls[0].url, 'https://desenv.betha.com.br/rest/api/2/myself');
  assert.equal(fetchImpl.calls[0].options.headers.Authorization, 'Basic abc123');
});

test('validateLogin returns a failure message on 401', async () => {
  const fetchImpl = fakeFetch({ ok: false, status: 401 });

  const result = await validateLogin({
    baseUrl: 'https://desenv.betha.com.br',
    authHeader: 'Basic wrong',
    fetchImpl,
  });

  assert.deepEqual(result, {
    ok: false,
    status: 401,
    message: 'Usuário ou senha inválidos',
  });
});
