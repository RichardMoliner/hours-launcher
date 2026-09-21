import {
  buildBasicAuthHeader,
  isValidTimeSpent,
  buildStartedTimestamp,
  buildWorklogPayload,
} from './lib/format.js';
import { validateLogin, fetchIssueSummary, postWorklog } from './lib/jira-api.js';
import { createAuthStore, createHistoryStore } from './lib/storage.js';

const authStore = createAuthStore(chrome.storage.session, chrome.storage.local);
const historyStore = createHistoryStore(chrome.storage.local);

const loginScreen = document.getElementById('login-screen');
const mainScreen = document.getElementById('main-screen');
const loginForm = document.getElementById('login-form');
const baseUrlInput = document.getElementById('base-url');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const keepConnectedInput = document.getElementById('keep-connected');
const loginError = document.getElementById('login-error');
const loginErrorDetails = document.getElementById('login-error-details');
const loginErrorTechnical = document.getElementById('login-error-technical');

const greeting = document.getElementById('greeting');
const logoutLink = document.getElementById('logout-link');
const worklogForm = document.getElementById('worklog-form');
const issueKeyInput = document.getElementById('issue-key');
const issueSummary = document.getElementById('issue-summary');
const timeSpentInput = document.getElementById('time-spent');
const startDateInput = document.getElementById('start-date');
const startTimeInput = document.getElementById('start-time');
const commentInput = document.getElementById('comment');
const worklogError = document.getElementById('worklog-error');
const worklogErrorDetails = document.getElementById('worklog-error-details');
const worklogErrorTechnical = document.getElementById('worklog-error-technical');
const worklogSuccess = document.getElementById('worklog-success');
const historyList = document.getElementById('history-list');

let currentAuth = null;

function showLoginScreen() {
  mainScreen.classList.add('hidden');
  loginScreen.classList.remove('hidden');
}

function showMainScreen() {
  loginScreen.classList.add('hidden');
  mainScreen.classList.remove('hidden');
}

function setDefaultDateTime() {
  const now = new Date();
  startDateInput.value = now.toISOString().slice(0, 10);
  startTimeInput.value = now.toTimeString().slice(0, 5);
}

function showNetworkError(errorEl, detailsEl, technicalEl, error) {
  errorEl.textContent = 'Não foi possível conectar ao Jira. Verifique sua conexão.';
  errorEl.classList.remove('hidden');
  technicalEl.textContent = String(error);
  detailsEl.classList.remove('hidden');
}

function clearError(errorEl, detailsEl) {
  errorEl.textContent = '';
  errorEl.classList.add('hidden');
  detailsEl.classList.add('hidden');
}

async function renderHistory() {
  const history = await historyStore.loadHistory();
  historyList.innerHTML = '';
  for (const item of history) {
    const li = document.createElement('li');
    li.textContent = `${item.issueKey} — ${item.timeSpent} — ${item.date}`;
    historyList.appendChild(li);
  }
}

async function handleSessionExpired() {
  await authStore.clearAuth();
  currentAuth = null;
  showLoginScreen();
  loginError.textContent = 'Sessão expirada, faça login novamente';
  loginError.classList.remove('hidden');
}

async function tryRestoreSession() {
  const auth = await authStore.loadAuth();
  if (!auth) {
    showLoginScreen();
    return;
  }

  try {
    const result = await validateLogin({
      baseUrl: auth.baseUrl,
      authHeader: auth.basicToken,
      fetchImpl: fetch,
    });

    if (!result.ok) {
      await authStore.clearAuth();
      showLoginScreen();
      return;
    }

    currentAuth = { ...auth, displayName: result.displayName };
    greeting.textContent = `Olá, ${result.displayName}`;
    setDefaultDateTime();
    await renderHistory();
    showMainScreen();
  } catch (error) {
    showNetworkError(loginError, loginErrorDetails, loginErrorTechnical, error);
    showLoginScreen();
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError(loginError, loginErrorDetails);

  const baseUrl = baseUrlInput.value.trim().replace(/\/$/, '');
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const keepConnected = keepConnectedInput.checked;
  const authHeader = buildBasicAuthHeader(username, password);

  try {
    const result = await validateLogin({ baseUrl, authHeader, fetchImpl: fetch });
    if (!result.ok) {
      loginError.textContent = result.message;
      loginError.classList.remove('hidden');
      return;
    }

    const auth = { baseUrl, basicToken: authHeader, displayName: result.displayName };
    await authStore.saveAuth(auth, keepConnected);
    currentAuth = auth;
    greeting.textContent = `Olá, ${result.displayName}`;
    passwordInput.value = '';
    setDefaultDateTime();
    await renderHistory();
    showMainScreen();
  } catch (error) {
    showNetworkError(loginError, loginErrorDetails, loginErrorTechnical, error);
  }
});

logoutLink.addEventListener('click', async (event) => {
  event.preventDefault();
  await authStore.clearAuth();
  currentAuth = null;
  loginForm.reset();
  baseUrlInput.value = 'https://desenv.betha.com.br';
  showLoginScreen();
});

issueKeyInput.addEventListener('blur', async () => {
  const issueKey = issueKeyInput.value.trim();
  issueSummary.textContent = '';
  if (!issueKey || !currentAuth) return;

  try {
    const result = await fetchIssueSummary({
      baseUrl: currentAuth.baseUrl,
      issueKey,
      authHeader: currentAuth.basicToken,
      fetchImpl: fetch,
    });

    if (result.ok) {
      issueSummary.textContent = `Título: ${result.summary}`;
    } else if (result.status === 401) {
      await handleSessionExpired();
    } else {
      issueSummary.textContent = result.message;
    }
  } catch (error) {
    showNetworkError(worklogError, worklogErrorDetails, worklogErrorTechnical, error);
  }
});

worklogForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError(worklogError, worklogErrorDetails);
  worklogSuccess.classList.add('hidden');

  const issueKey = issueKeyInput.value.trim();
  const timeSpent = timeSpentInput.value.trim();

  if (!issueKey) {
    issueKeyInput.focus();
    worklogError.textContent = 'Informe a chave da tarefa.';
    worklogError.classList.remove('hidden');
    return;
  }

  if (!timeSpent || !isValidTimeSpent(timeSpent)) {
    timeSpentInput.focus();
    worklogError.textContent =
      'Não foi possível interpretar o tempo informado. Use um formato como 2h, 1h 30m ou 45m.';
    worklogError.classList.remove('hidden');
    return;
  }

  const startedIso = buildStartedTimestamp(
    startDateInput.value,
    startTimeInput.value,
    new Date().getTimezoneOffset()
  );
  const payload = buildWorklogPayload({ startedIso, timeSpent, comment: commentInput.value });

  try {
    const result = await postWorklog({
      baseUrl: currentAuth.baseUrl,
      issueKey,
      authHeader: currentAuth.basicToken,
      payload,
      fetchImpl: fetch,
    });

    if (!result.ok) {
      if (result.status === 401) {
        await handleSessionExpired();
        return;
      }
      worklogError.textContent = result.message;
      worklogError.classList.remove('hidden');
      return;
    }

    await historyStore.addHistoryEntry({
      issueKey,
      timeSpent,
      date: startDateInput.value,
      comment: commentInput.value.trim(),
      loggedAt: new Date().toISOString(),
    });
    await renderHistory();

    worklogSuccess.innerHTML =
      `Horas lançadas com sucesso. ` +
      `<a href="${currentAuth.baseUrl}/browse/${issueKey}" target="_blank" rel="noopener">Abrir tarefa no Jira</a>`;
    worklogSuccess.classList.remove('hidden');
    worklogForm.reset();
    setDefaultDateTime();
    issueSummary.textContent = '';
  } catch (error) {
    showNetworkError(worklogError, worklogErrorDetails, worklogErrorTechnical, error);
  }
});

tryRestoreSession();
