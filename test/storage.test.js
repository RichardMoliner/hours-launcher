import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthStore, createHistoryStore } from '../lib/storage.js';

function createFakeArea(initial = {}) {
  let store = { ...initial };
  return {
    async get(keys) {
      const result = {};
      for (const key of keys) {
        if (key in store) result[key] = store[key];
      }
      return result;
    },
    async set(items) {
      store = { ...store, ...items };
    },
    async remove(keys) {
      for (const key of keys) delete store[key];
    },
    _dump() {
      return store;
    },
  };
}

test('loadAuth returns null when nothing is stored', async () => {
  const authStore = createAuthStore(createFakeArea(), createFakeArea());
  assert.equal(await authStore.loadAuth(), null);
});

test('saveAuth without keepConnected only writes to session', async () => {
  const session = createFakeArea();
  const local = createFakeArea();
  const authStore = createAuthStore(session, local);
  const auth = { baseUrl: 'https://desenv.betha.com.br', basicToken: 'Basic abc' };

  await authStore.saveAuth(auth, false);

  assert.deepEqual(await authStore.loadAuth(), auth);
  assert.deepEqual(local._dump(), {});
});

test('saveAuth with keepConnected writes to both session and local', async () => {
  const session = createFakeArea();
  const local = createFakeArea();
  const authStore = createAuthStore(session, local);
  const auth = { baseUrl: 'https://desenv.betha.com.br', basicToken: 'Basic abc' };

  await authStore.saveAuth(auth, true);

  assert.deepEqual(session._dump().auth, auth);
  assert.deepEqual(local._dump().auth, auth);
});

test('loadAuth falls back to local when session is empty', async () => {
  const auth = { baseUrl: 'https://desenv.betha.com.br', basicToken: 'Basic abc' };
  const session = createFakeArea();
  const local = createFakeArea({ auth });
  const authStore = createAuthStore(session, local);

  assert.deepEqual(await authStore.loadAuth(), auth);
});

test('clearAuth removes from both areas', async () => {
  const auth = { baseUrl: 'https://desenv.betha.com.br', basicToken: 'Basic abc' };
  const session = createFakeArea({ auth });
  const local = createFakeArea({ auth });
  const authStore = createAuthStore(session, local);

  await authStore.clearAuth();

  assert.equal(await authStore.loadAuth(), null);
});

test('history store starts empty and keeps the 5 most recent entries', async () => {
  const local = createFakeArea();
  const historyStore = createHistoryStore(local);

  assert.deepEqual(await historyStore.loadHistory(), []);

  for (const issueKey of ['A', 'B', 'C', 'D', 'E', 'F']) {
    await historyStore.addHistoryEntry({ issueKey });
  }

  const history = await historyStore.loadHistory();
  assert.equal(history.length, 5);
  assert.equal(history[0].issueKey, 'F');
  assert.equal(history[4].issueKey, 'B');
});
