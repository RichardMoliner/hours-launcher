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
