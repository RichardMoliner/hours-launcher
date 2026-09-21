export function buildBasicAuthHeader(username, password) {
  const token = btoa(`${username}:${password}`);
  return `Basic ${token}`;
}

export function isValidTimeSpent(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^\d+[wdhm](\s+\d+[wdhm])*$/i.test(trimmed);
}
