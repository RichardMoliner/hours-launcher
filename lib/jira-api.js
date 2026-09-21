export function describeLoginError(status) {
  if (status === 401) return 'Usuário ou senha inválidos';
  return `Não foi possível fazer login (status ${status}).`;
}

export function describeApiError(status, { issueKey } = {}) {
  switch (status) {
    case 401:
      return 'Sessão expirada, faça login novamente';
    case 404:
      return issueKey
        ? `Tarefa ${issueKey} não encontrada. Confira a chave.`
        : 'Tarefa não encontrada. Confira a chave.';
    case 400:
      return 'Não foi possível interpretar o tempo informado. Use um formato como 2h, 1h 30m ou 45m.';
    default:
      return `Não foi possível completar a operação (status ${status}).`;
  }
}

export async function validateLogin({ baseUrl, authHeader, fetchImpl }) {
  const response = await fetchImpl(`${baseUrl}/rest/api/2/myself`, {
    headers: { Authorization: authHeader },
  });

  if (!response.ok) {
    return { ok: false, status: response.status, message: describeLoginError(response.status) };
  }

  const body = await response.json();
  return {
    ok: true,
    name: body.name,
    displayName: body.displayName,
    emailAddress: body.emailAddress,
  };
}

export async function fetchIssueSummary({ baseUrl, issueKey, authHeader, fetchImpl }) {
  const url = `${baseUrl}/rest/api/2/issue/${encodeURIComponent(issueKey)}?fields=summary,status`;
  const response = await fetchImpl(url, { headers: { Authorization: authHeader } });

  if (!response.ok) {
    return { ok: false, status: response.status, message: describeApiError(response.status, { issueKey }) };
  }

  const body = await response.json();
  return { ok: true, summary: body.fields.summary };
}

export async function postWorklog({ baseUrl, issueKey, authHeader, payload, fetchImpl }) {
  const url = `${baseUrl}/rest/api/2/issue/${encodeURIComponent(issueKey)}/worklog`;
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    return { ok: false, status: response.status, message: describeApiError(response.status, { issueKey }) };
  }

  return { ok: true };
}
