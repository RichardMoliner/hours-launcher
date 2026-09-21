import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeLoginError, describeApiError, fetchIssueSummary } from '../lib/jira-api.js';

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

test('fetchIssueSummary returns the summary on 200', async () => {
  const fetchImpl = fakeFetch({
    ok: true,
    status: 200,
    json: async () => ({ fields: { summary: 'Corrigir bug X' } }),
  });

  const result = await fetchIssueSummary({
    baseUrl: 'https://desenv.betha.com.br',
    issueKey: 'DESENV-1234',
    authHeader: 'Basic abc123',
    fetchImpl,
  });

  assert.deepEqual(result, { ok: true, summary: 'Corrigir bug X' });
  assert.equal(
    fetchImpl.calls[0].url,
    'https://desenv.betha.com.br/rest/api/2/issue/DESENV-1234?fields=summary,status'
  );
});

test('fetchIssueSummary returns a not-found message on 404', async () => {
  const fetchImpl = fakeFetch({ ok: false, status: 404 });

  const result = await fetchIssueSummary({
    baseUrl: 'https://desenv.betha.com.br',
    issueKey: 'DESENV-9999',
    authHeader: 'Basic abc123',
    fetchImpl,
  });

  assert.deepEqual(result, {
    ok: false,
    status: 404,
    message: 'Tarefa DESENV-9999 não encontrada. Confira a chave.',
  });
});

import { postWorklog } from '../lib/jira-api.js';

test('postWorklog sends a POST with the payload and returns ok on 201', async () => {
  const fetchImpl = fakeFetch({ ok: true, status: 201 });
  const payload = { started: '2026-09-21T09:00:00.000-0300', timeSpent: '2h' };

  const result = await postWorklog({
    baseUrl: 'https://desenv.betha.com.br',
    issueKey: 'DESENV-1234',
    authHeader: 'Basic abc123',
    payload,
    fetchImpl,
  });

  assert.deepEqual(result, { ok: true });
  const call = fetchImpl.calls[0];
  assert.equal(call.url, 'https://desenv.betha.com.br/rest/api/2/issue/DESENV-1234/worklog');
  assert.equal(call.options.method, 'POST');
  assert.equal(call.options.headers.Authorization, 'Basic abc123');
  assert.equal(call.options.headers['Content-Type'], 'application/json');
  assert.equal(call.options.body, JSON.stringify(payload));
});

test('postWorklog returns an invalid-time message on 400', async () => {
  const fetchImpl = fakeFetch({ ok: false, status: 400 });

  const result = await postWorklog({
    baseUrl: 'https://desenv.betha.com.br',
    issueKey: 'DESENV-1234',
    authHeader: 'Basic abc123',
    payload: { started: 'x', timeSpent: 'not-a-duration' },
    fetchImpl,
  });

  assert.deepEqual(result, {
    ok: false,
    status: 400,
    message: 'Não foi possível interpretar o tempo informado. Use um formato como 2h, 1h 30m ou 45m.',
  });
});
