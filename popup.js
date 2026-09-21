import {
  buildBasicAuthHeader,
  isValidTimeSpent,
  buildStartedTimestamp,
  buildWorklogPayload,
  normalizeBaseUrl,
  currentLocalDateTime,
  formatDateBR,
} from './lib/format.js';
import {
  validateLogin,
  fetchIssueSummary,
  postWorklog,
  describeApiError,
  fetchAssignedIssues,
} from './lib/jira-api.js';
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
const loginSubmitButton = document.getElementById('login-submit');

const greeting = document.getElementById('greeting');
const logoutLink = document.getElementById('logout-link');
const worklogForm = document.getElementById('worklog-form');
const submitWorklogButton = document.getElementById('submit-worklog');
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

const tabWorklogButton = document.getElementById('tab-worklog');
const tabAssignedButton = document.getElementById('tab-assigned');
const worklogPanel = document.getElementById('worklog-panel');
const assignedPanel = document.getElementById('assigned-panel');
const assignedIssuesLoading = document.getElementById('assigned-issues-loading');
const assignedIssuesError = document.getElementById('assigned-issues-error');
const assignedIssuesErrorDetails = document.getElementById('assigned-issues-error-details');
const assignedIssuesErrorTechnical = document.getElementById('assigned-issues-error-technical');
const assignedIssuesEmpty = document.getElementById('assigned-issues-empty');
const assignedIssuesList = document.getElementById('assigned-issues-list');

let currentAuth = null;

function showLoginScreen() {
  mainScreen.classList.add('hidden');
  loginScreen.classList.remove('hidden');
}

function showMainScreen() {
  loginScreen.classList.add('hidden');
  mainScreen.classList.remove('hidden');
}

function showWorklogTab() {
  tabWorklogButton.classList.add('active');
  tabAssignedButton.classList.remove('active');
  worklogPanel.classList.remove('hidden');
  assignedPanel.classList.add('hidden');
}

function showAssignedTab() {
  tabAssignedButton.classList.add('active');
  tabWorklogButton.classList.remove('active');
  assignedPanel.classList.remove('hidden');
  worklogPanel.classList.add('hidden');
}

function setDefaultDateTime() {
  const { date, time } = currentLocalDateTime(new Date());
  startDateInput.value = date;
  startTimeInput.value = time;
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
    li.textContent = `${item.issueKey} — ${item.timeSpent} — ${formatDateBR(item.date)}`;
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
      await handleSessionExpired();
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

  const baseUrl = normalizeBaseUrl(baseUrlInput.value);
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const keepConnected = keepConnectedInput.checked;

  loginSubmitButton.disabled = true;
  loginSubmitButton.textContent = 'Entrando...';

  try {
    const authHeader = buildBasicAuthHeader(username, password);
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
  } finally {
    loginSubmitButton.disabled = false;
    loginSubmitButton.textContent = 'Entrar';
  }
});

logoutLink.addEventListener('click', async (event) => {
  event.preventDefault();
  await authStore.clearAuth();
  currentAuth = null;
  loginForm.reset();
  baseUrlInput.value = 'https://desenv.betha.com.br';
  worklogForm.reset();
  issueSummary.textContent = '';
  worklogSuccess.classList.add('hidden');
  clearError(worklogError, worklogErrorDetails);
  assignedIssuesList.innerHTML = '';
  assignedIssuesEmpty.classList.add('hidden');
  clearError(assignedIssuesError, assignedIssuesErrorDetails);
  showWorklogTab();
  showLoginScreen();
});

async function lookupIssueSummary(issueKey) {
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
}

function selectAssignedIssue(issueKey) {
  showWorklogTab();
  issueKeyInput.value = issueKey;
  issueSummary.textContent = '';
  lookupIssueSummary(issueKey);
  timeSpentInput.focus();
}

async function loadAssignedIssues() {
  assignedIssuesError.classList.add('hidden');
  assignedIssuesErrorDetails.classList.add('hidden');
  assignedIssuesEmpty.classList.add('hidden');
  assignedIssuesList.innerHTML = '';
  assignedIssuesLoading.classList.remove('hidden');

  try {
    const result = await fetchAssignedIssues({
      baseUrl: currentAuth.baseUrl,
      authHeader: currentAuth.basicToken,
      fetchImpl: fetch,
    });

    if (!result.ok) {
      if (result.status === 401) {
        await handleSessionExpired();
        return;
      }
      assignedIssuesError.textContent = result.message;
      assignedIssuesError.classList.remove('hidden');
      return;
    }

    if (result.issues.length === 0) {
      assignedIssuesEmpty.classList.remove('hidden');
      return;
    }

    for (const issue of result.issues) {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'assigned-issue';
      button.textContent = `${issue.key} — ${issue.summary}`;
      button.addEventListener('click', () => selectAssignedIssue(issue.key));
      li.appendChild(button);
      assignedIssuesList.appendChild(li);
    }
  } catch (error) {
    showNetworkError(assignedIssuesError, assignedIssuesErrorDetails, assignedIssuesErrorTechnical, error);
  } finally {
    assignedIssuesLoading.classList.add('hidden');
  }
}

tabWorklogButton.addEventListener('click', () => {
  showWorklogTab();
});

tabAssignedButton.addEventListener('click', () => {
  showAssignedTab();
  loadAssignedIssues();
});

issueKeyInput.addEventListener('blur', async () => {
  const issueKey = issueKeyInput.value.trim();
  issueSummary.textContent = '';
  await lookupIssueSummary(issueKey);
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
    worklogError.textContent = describeApiError(400);
    worklogError.classList.remove('hidden');
    return;
  }

  submitWorklogButton.disabled = true;
  submitWorklogButton.textContent = 'Lançando...';

  try {
    const startedIso = buildStartedTimestamp(
      startDateInput.value,
      startTimeInput.value,
      new Date().getTimezoneOffset()
    );
    const payload = buildWorklogPayload({ startedIso, timeSpent, comment: commentInput.value });

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

    worklogSuccess.textContent = 'Horas lançadas com sucesso. ';
    const link = document.createElement('a');
    link.href = `${currentAuth.baseUrl}/browse/${encodeURIComponent(issueKey)}`;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'Abrir tarefa no Jira';
    worklogSuccess.appendChild(link);
    worklogSuccess.classList.remove('hidden');
    worklogForm.reset();
    setDefaultDateTime();
    issueSummary.textContent = '';
  } catch (error) {
    showNetworkError(worklogError, worklogErrorDetails, worklogErrorTechnical, error);
  } finally {
    submitWorklogButton.disabled = false;
    submitWorklogButton.textContent = 'Lançar horas';
  }
});

tryRestoreSession();
