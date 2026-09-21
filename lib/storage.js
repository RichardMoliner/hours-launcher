import { addToHistoryEntry } from './format.js';

export function createAuthStore(sessionArea, localArea) {
  async function loadAuth() {
    const sessionResult = await sessionArea.get(['auth']);
    if (sessionResult.auth) return sessionResult.auth;
    const localResult = await localArea.get(['auth']);
    return localResult.auth ?? null;
  }

  async function saveAuth(auth, keepConnected) {
    await sessionArea.set({ auth });
    if (keepConnected) {
      await localArea.set({ auth });
    }
  }

  async function clearAuth() {
    await sessionArea.remove(['auth']);
    await localArea.remove(['auth']);
  }

  return { loadAuth, saveAuth, clearAuth };
}

export function createHistoryStore(localArea) {
  async function loadHistory() {
    const result = await localArea.get(['worklogHistory']);
    return result.worklogHistory ?? [];
  }

  async function addHistoryEntry(entry) {
    const current = await loadHistory();
    const next = addToHistoryEntry(current, entry, 5);
    await localArea.set({ worklogHistory: next });
    return next;
  }

  return { loadHistory, addHistoryEntry };
}
