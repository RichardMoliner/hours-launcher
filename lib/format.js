export function buildBasicAuthHeader(username, password) {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  const binary = String.fromCharCode(...bytes);
  const token = btoa(binary);
  return `Basic ${token}`;
}

export function normalizeBaseUrl(url) {
  return url.trim().replace(/\/$/, '');
}

export function currentLocalDateTime(now) {
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return { date, time };
}

export function isValidTimeSpent(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^\d+[wdhm](\s+\d+[wdhm])*$/i.test(trimmed);
}

export function buildStartedTimestamp(dateStr, timeStr, offsetMinutes) {
  const sign = offsetMinutes > 0 ? '-' : '+';
  const abs = Math.abs(offsetMinutes);
  const offsetHours = String(Math.floor(abs / 60)).padStart(2, '0');
  const offsetMins = String(abs % 60).padStart(2, '0');
  return `${dateStr}T${timeStr}:00.000${sign}${offsetHours}${offsetMins}`;
}

export function buildWorklogPayload({ startedIso, timeSpent, comment }) {
  const payload = { started: startedIso, timeSpent };
  const trimmedComment = (comment ?? '').trim();
  if (trimmedComment) {
    payload.comment = trimmedComment;
  }
  return payload;
}

export function addToHistoryEntry(history, entry, maxItems = 5) {
  const next = [entry, ...history];
  return next.slice(0, maxItems);
}
