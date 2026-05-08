const STORAGE_KEY = "manual-ai-agent-dashboard-v2";
const LEGACY_STORAGE_KEY = "manual-ai-agent-dashboard-v1";
const SHEETS_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbwaqZlyTV49-30OK5lfRMHYQ_oqDtbTbYEPT07KiHzdQBcUay9otvZmF_GkdHCb4XTo6A/exec";
const USE_GOOGLE_SHEETS = true;

// Data model is intentionally split like future Google Sheets tabs:
// agents: one row per AI agent
// tasks: one row per next action / task
// logs: append-only memo and activity history
// settings: dashboard-level preferences and daily memo
const statusLabels = {
  active: "稼働中",
  waiting: "確認待ち",
  done: "完了",
  paused: "保留",
};

const priorityLabels = {
  high: "高",
  medium: "中",
  low: "低",
};

const defaultStore = {
  agents: [
    {
      id: "codex",
      name: "Codex",
      role: "ローカル開発、静的サイト制作、コード修正、検証補助",
      status: "active",
      priority: "high",
      progress: 72,
      checkFrequency: "毎日",
      lastChecked: "2026-05-08",
      nextCheck: "2026-05-09",
      memo: "実装の手戻りを減らすため、要件とファイル構成を先に固定する。",
    },
    {
      id: "claude-code",
      name: "Claude Code",
      role: "大きめのリファクタリング案、設計レビュー、文章化補助",
      status: "waiting",
      priority: "medium",
      progress: 48,
      checkFrequency: "週2回",
      lastChecked: "2026-05-06",
      nextCheck: "2026-05-10",
      memo: "抽象化の提案が増えやすいので、実務上必要な範囲に絞って確認。",
    },
    {
      id: "perplexity",
      name: "Perplexity調査",
      role: "最新情報の収集、出典確認、比較調査",
      status: "active",
      priority: "high",
      progress: 61,
      checkFrequency: "必要時",
      lastChecked: "2026-05-08",
      nextCheck: "2026-05-11",
      memo: "出典URLと日付を必ず残す。調査結果は短い箇条書きに整える。",
    },
    {
      id: "notebooklm",
      name: "NotebookLM支援",
      role: "資料読み込み、要約、論点整理、引用候補の抽出",
      status: "paused",
      priority: "low",
      progress: 35,
      checkFrequency: "週1回",
      lastChecked: "2026-05-03",
      nextCheck: "2026-05-12",
      memo: "長文資料の下読み用。最終判断は原文確認を前提にする。",
    },
    {
      id: "canva",
      name: "Canva制作",
      role: "SNS画像、説明資料、バナー案の制作補助",
      status: "waiting",
      priority: "medium",
      progress: 55,
      checkFrequency: "週2回",
      lastChecked: "2026-05-07",
      nextCheck: "2026-05-09",
      memo: "色味と文字量を控えめに。完成前にiPad表示でチェック。",
    },
    {
      id: "local-automation",
      name: "ローカル自動化",
      role: "ファイル整理、定型処理、ローカルスクリプト実行の補助",
      status: "done",
      priority: "low",
      progress: 100,
      checkFrequency: "週1回",
      lastChecked: "2026-05-08",
      nextCheck: "2026-05-15",
      memo: "今週分の整理は完了。自動実行前にバックアップ方針を確認する。",
    },
  ],
  tasks: [
    {
      id: "task-codex-next",
      agentId: "codex",
      title: "作成中のWebプロトタイプを確認し、UIの改善点を洗い出す",
      status: "open",
      dueDate: "2026-05-09",
      updatedAt: "2026-05-08",
    },
    {
      id: "task-claude-code-next",
      agentId: "claude-code",
      title: "Codexの実装後に設計観点のレビューを依頼する",
      status: "open",
      dueDate: "2026-05-10",
      updatedAt: "2026-05-06",
    },
    {
      id: "task-perplexity-next",
      agentId: "perplexity",
      title: "Googleスプレッドシート連携の実装候補を調べる",
      status: "open",
      dueDate: "2026-05-11",
      updatedAt: "2026-05-08",
    },
    {
      id: "task-notebooklm-next",
      agentId: "notebooklm",
      title: "参照資料を更新して、未整理メモを再要約する",
      status: "open",
      dueDate: "2026-05-12",
      updatedAt: "2026-05-03",
    },
    {
      id: "task-canva-next",
      agentId: "canva",
      title: "今週使う告知画像のトーンを確認する",
      status: "open",
      dueDate: "2026-05-09",
      updatedAt: "2026-05-07",
    },
    {
      id: "task-local-automation-next",
      agentId: "local-automation",
      title: "次回レビューで対象フォルダと実行条件を見直す",
      status: "open",
      dueDate: "2026-05-15",
      updatedAt: "2026-05-08",
    },
  ],
  logs: [
    {
      id: "log-initial-daily",
      agentId: "",
      type: "dailyMemo",
      content:
        "Codexは実装作業、Perplexityは調査メモ確認を優先。NotebookLMの要約精度は週次レビューで見直す。",
      createdAt: "2026-05-08",
    },
  ],
  settings: {
    dailyMemo: "Codexは実装作業、Perplexityは調査メモ確認を優先。NotebookLMの要約精度は週次レビューで見直す。",
    lastSavedAt: "",
  },
};

let store = loadStore();
let selectedAgentId = loadAgents()[0]?.id || "";
let isCreatingAgent = false;
let pendingSheetWrites = [];

const elements = {
  activeCount: document.getElementById("activeCount"),
  waitingCount: document.getElementById("waitingCount"),
  doneCount: document.getElementById("doneCount"),
  weeklyAverage: document.getElementById("weeklyAverage"),
  agentGrid: document.getElementById("agentGrid"),
  agentSelect: document.getElementById("agentSelect"),
  nameInput: document.getElementById("nameInput"),
  roleInput: document.getElementById("roleInput"),
  statusFilter: document.getElementById("statusFilter"),
  statusInput: document.getElementById("statusInput"),
  priorityInput: document.getElementById("priorityInput"),
  progressInput: document.getElementById("progressInput"),
  progressValue: document.getElementById("progressValue"),
  checkFrequencyInput: document.getElementById("checkFrequencyInput"),
  nextCheckInput: document.getElementById("nextCheckInput"),
  nextTaskInput: document.getElementById("nextTaskInput"),
  noteInput: document.getElementById("noteInput"),
  agentForm: document.getElementById("agentForm"),
  dailyMemo: document.getElementById("dailyMemo"),
  nextActionList: document.getElementById("nextActionList"),
  reviewList: document.getElementById("reviewList"),
  todayLabel: document.getElementById("todayLabel"),
  lastSavedText: document.getElementById("lastSavedText"),
  saveButton: document.getElementById("saveButton"),
  resetButton: document.getElementById("resetButton"),
  newAgentButton: document.getElementById("newAgentButton"),
  deleteAgentButton: document.getElementById("deleteAgentButton"),
  submitAgentButton: document.getElementById("submitAgentButton"),
};

function loadStore() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (saved) {
    try {
      return normalizeStore(JSON.parse(saved));
    } catch (error) {
      console.warn("Saved dashboard data could not be parsed.", error);
    }
  }

  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacy) {
    try {
      return migrateLegacyStore(JSON.parse(legacy));
    } catch (error) {
      console.warn("Legacy dashboard data could not be migrated.", error);
    }
  }

  return cloneDefaultStore();
}

// Data access layer. Swap these functions for Google Sheets API calls later.
function persistStore() {
  store.settings.lastSavedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  renderLastSaved();
  flushPendingSheetWrites();
}

function loadAgents() {
  return store.agents.filter((agent) => agent.status !== "archived");
}

function loadLogs() {
  return store.logs;
}

function loadTasks() {
  return store.tasks.filter((task) => task.status !== "archived");
}

function loadSettings() {
  return store.settings;
}

function saveAgent(agent) {
  const index = store.agents.findIndex((item) => item.id === agent.id);
  if (index >= 0) {
    store.agents[index] = agent;
  } else {
    store.agents.push(agent);
  }
  queueSheetWrite({ action: "saveAgent", agent });
}

function addLog(log) {
  store.logs.unshift(log);
  queueSheetWrite({ action: "addLog", log });
}

function updateTask(task) {
  const index = store.tasks.findIndex((item) => item.id === task.id);
  if (index >= 0) {
    store.tasks[index] = task;
  } else {
    store.tasks.push(task);
  }
  queueSheetWrite({ action: "updateTask", task });
}

function queueSheetWrite(operation) {
  if (!USE_GOOGLE_SHEETS || !SHEETS_WEB_APP_URL) {
    return;
  }

  pendingSheetWrites.push(operation);
}

async function hydrateStoreFromSheets() {
  if (!USE_GOOGLE_SHEETS || !SHEETS_WEB_APP_URL) {
    return;
  }

  try {
    elements.lastSavedText.textContent = "同期中";
    const rawRemoteStore = await fetchSheetsStore();
    const remoteIsEmpty =
      (!rawRemoteStore.agents || rawRemoteStore.agents.length === 0) &&
      (!rawRemoteStore.tasks || rawRemoteStore.tasks.length === 0) &&
      (!rawRemoteStore.logs || rawRemoteStore.logs.length === 0) &&
      (!rawRemoteStore.settings || Object.keys(rawRemoteStore.settings).length === 0);

    if (remoteIsEmpty) {
      await seedSheetsFromCurrentStore();
      persistLocalOnly();
      render();
      return;
    }

    const remoteStore = normalizeStore(rawRemoteStore);
    store = remoteStore;
    persistLocalOnly();
    selectedAgentId = loadAgents()[0]?.id || "";
    isCreatingAgent = loadAgents().length === 0;
    render();
  } catch (error) {
    console.warn("Google Sheets sync failed. Falling back to localStorage.", error);
    renderLastSaved();
  }
}

async function fetchSheetsStore() {
  return fetchSheetsStoreJsonp();
}

function fetchSheetsStoreJsonp() {
  return new Promise((resolve, reject) => {
    const callbackName = `handleSheetsData_${Date.now()}`;
    const script = document.createElement("script");
    const separator = SHEETS_WEB_APP_URL.includes("?") ? "&" : "?";

    window[callbackName] = (data) => {
      resolve(data);
      script.remove();
      delete window[callbackName];
    };

    script.onerror = () => {
      reject(new Error("Sheets JSONP load failed."));
      script.remove();
      delete window[callbackName];
    };

    script.src = `${SHEETS_WEB_APP_URL}${separator}callback=${callbackName}`;
    document.body.appendChild(script);
  });
}

async function flushPendingSheetWrites() {
  if (!USE_GOOGLE_SHEETS || pendingSheetWrites.length === 0) {
    return;
  }

  const writes = [...pendingSheetWrites];
  pendingSheetWrites = [];

  try {
    await postToSheets({
      action: "saveSettings",
      settings: {
        dailyMemo: store.settings.dailyMemo,
        lastSavedAt: store.settings.lastSavedAt,
      },
    });

    for (const operation of writes) {
      await postToSheets(operation);
    }
  } catch (error) {
    console.warn("Google Sheets save failed. Changes remain in localStorage.", error);
    pendingSheetWrites.unshift(...writes);
  }
}

async function seedSheetsFromCurrentStore() {
  store.settings.lastSavedAt = new Date().toISOString();

  await postToSheets({
    action: "saveSettings",
    settings: {
      dailyMemo: store.settings.dailyMemo,
      lastSavedAt: store.settings.lastSavedAt,
    },
  });

  for (const agent of store.agents) {
    await postToSheets({ action: "saveAgent", agent });
  }

  for (const task of store.tasks) {
    await postToSheets({ action: "updateTask", task });
  }

  for (const log of store.logs) {
    await postToSheets({ action: "addLog", log });
  }
}

async function postToSheets(payload) {
  await fetch(SHEETS_WEB_APP_URL, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify(payload),
  });

  return { ok: true };
}

function persistLocalOnly() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function cloneDefaultStore() {
  return JSON.parse(JSON.stringify(defaultStore));
}

function normalizeStore(value) {
  const fallback = cloneDefaultStore();
  return {
    agents: Array.isArray(value.agents) ? value.agents : fallback.agents,
    tasks: Array.isArray(value.tasks) ? value.tasks : fallback.tasks,
    logs: Array.isArray(value.logs) ? value.logs : fallback.logs,
    settings: { ...fallback.settings, ...(value.settings || {}) },
  };
}

function migrateLegacyStore(legacyData) {
  const agents = Array.isArray(legacyData.agents) ? legacyData.agents : [];
  const today = new Date().toISOString().slice(0, 10);

  return normalizeStore({
    agents: agents.map(({ nextTask, ...agent }) => agent),
    tasks: agents.map((agent) => ({
      id: `task-${agent.id}-next`,
      agentId: agent.id,
      title: agent.nextTask || "",
      status: agent.status === "done" ? "done" : "open",
      dueDate: agent.nextCheck || today,
      updatedAt: agent.lastChecked || today,
    })),
    logs: [
      {
        id: `log-${Date.now()}`,
        agentId: "",
        type: "dailyMemo",
        content: legacyData.dailyMemo || "",
        createdAt: today,
      },
    ],
    settings: {
      dailyMemo: legacyData.dailyMemo || "",
      lastSavedAt: "",
    },
  });
}

// Render layer. These functions should receive data through load* helpers,
// keeping UI updates separate from storage details.
function render() {
  normalizeSelectedAgent();
  renderToday();
  renderSummary();
  renderAgentSelect();
  renderAgentCards();
  renderSideLists();
  renderLastSaved();
  syncForm();
}

function renderToday() {
  elements.todayLabel.textContent = new Date().toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
  elements.dailyMemo.value = loadSettings().dailyMemo;
}

function renderSummary() {
  const agents = loadAgents();
  const average = agents.length
    ? agents.reduce((total, agent) => total + Number(agent.progress), 0) / agents.length
    : 0;

  elements.activeCount.textContent = countByStatus("active");
  elements.waitingCount.textContent = countByStatus("waiting");
  elements.doneCount.textContent = countByStatus("done");
  elements.weeklyAverage.textContent = `${Math.round(average)}%`;
}

function renderAgentSelect() {
  const agents = loadAgents();
  elements.agentSelect.innerHTML = agents.length
    ? agents.map((agent) => `<option value="${agent.id}">${escapeHtml(agent.name)}</option>`).join("")
    : `<option value="">登録済みエージェントなし</option>`;
  elements.agentSelect.value = selectedAgentId;
  elements.agentSelect.disabled = isCreatingAgent || agents.length === 0;
}

function renderAgentCards() {
  const filter = elements.statusFilter.value;
  const agents =
    filter === "all" ? loadAgents() : loadAgents().filter((agent) => agent.status === filter);
  const rows = agents.map((agent) => ({ ...agent, task: findPrimaryTask(agent.id) }));

  elements.agentGrid.innerHTML = rows.length
    ? rows.map(createAgentCardMarkup).join("")
    : `<div class="empty-state">表示できるエージェントがありません。入力フォームから新規追加できます。</div>`;

  document.querySelectorAll("[data-select-agent]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedAgentId = button.dataset.selectAgent;
      isCreatingAgent = false;
      render();
      document.getElementById("editHeading").scrollIntoView({ behavior: "smooth" });
    });
  });
}

function createAgentCardMarkup(agent) {
  const selectedClass = agent.id === selectedAgentId ? " is-selected" : "";
  const taskTitle = agent.task?.title || "未設定";

  return `
    <article class="agent-card${selectedClass}">
      <div class="card-head">
        <div>
          <h3 class="agent-name">${escapeHtml(agent.name)}</h3>
          <p class="agent-role">${escapeHtml(agent.role)}</p>
        </div>
        <div class="badge-row">
          <span class="badge ${agent.status}">${statusLabels[agent.status]}</span>
          <span class="badge ${agent.priority}">優先度 ${priorityLabels[agent.priority]}</span>
        </div>
      </div>

      <div class="progress-block" aria-label="${escapeHtml(agent.name)}の進捗率">
        <div class="progress-top">
          <span>進捗率</span>
          <strong>${agent.progress}%</strong>
        </div>
        <div class="progress-track">
          <div class="progress-bar" style="width: ${agent.progress}%"></div>
        </div>
      </div>

      <div class="meta-grid">
        <div class="meta-item">
          <span>確認頻度</span>
          <strong>${escapeHtml(agent.checkFrequency)}</strong>
        </div>
        <div class="meta-item">
          <span>最終確認日</span>
          <strong>${formatDate(agent.lastChecked)}</strong>
        </div>
        <div class="meta-item">
          <span>次回確認日</span>
          <strong>${formatDate(agent.nextCheck)}</strong>
        </div>
        <div class="meta-item">
          <span>状態</span>
          <strong>${statusLabels[agent.status]}</strong>
        </div>
      </div>

      <div class="task-box">
        <span class="task-label">次の作業</span>
        <p>${escapeHtml(taskTitle)}</p>
      </div>
      <div class="task-box">
        <span class="task-label">メモ</span>
        <p>${escapeHtml(agent.memo)}</p>
      </div>

      <button class="card-button" type="button" data-select-agent="${agent.id}">このカードを編集</button>
    </article>
  `;
}

function renderSideLists() {
  const nextActions = loadAgents()
    .filter((agent) => agent.status !== "done")
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority))
    .slice(0, 4);

  elements.nextActionList.innerHTML = nextActions
    .map((agent) => {
      const task = findPrimaryTask(agent.id);
      return `<li><strong>${escapeHtml(agent.name)}</strong>${escapeHtml(task?.title || "未設定")}</li>`;
    })
    .join("");

  const reviewItems = loadAgents()
    .filter((agent) => agent.status === "waiting" || isDueSoon(agent.nextCheck))
    .slice(0, 5);

  elements.reviewList.innerHTML = reviewItems
    .map(
      (agent) =>
        `<li><strong>${escapeHtml(agent.name)}</strong>${formatDate(agent.nextCheck)} に確認</li>`,
    )
    .join("");
}

function renderLastSaved() {
  const lastSavedAt = loadSettings().lastSavedAt;
  if (!lastSavedAt) {
    elements.lastSavedText.textContent = "未保存";
    return;
  }

  elements.lastSavedText.textContent = new Date(lastSavedAt).toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function syncForm() {
  if (isCreatingAgent || loadAgents().length === 0) {
    syncCreateForm();
    return;
  }

  const agent = getSelectedAgent();
  if (!agent) {
    syncCreateForm();
    return;
  }

  const task = findPrimaryTask(agent.id);

  elements.agentSelect.value = agent.id;
  elements.nameInput.value = agent.name;
  elements.roleInput.value = agent.role;
  elements.statusInput.value = agent.status;
  elements.priorityInput.value = agent.priority;
  elements.progressInput.value = agent.progress;
  elements.progressValue.textContent = `${agent.progress}%`;
  elements.checkFrequencyInput.value = agent.checkFrequency;
  elements.nextCheckInput.value = agent.nextCheck;
  elements.nextTaskInput.value = task?.title || "";
  elements.noteInput.value = agent.memo;
  elements.newAgentButton.textContent = "新規追加モード";
  elements.deleteAgentButton.disabled = false;
  elements.submitAgentButton.textContent = "編集内容を反映";
}

function syncCreateForm() {
  selectedAgentId = "";
  elements.agentSelect.value = "";
  elements.nameInput.value = "";
  elements.roleInput.value = "";
  elements.statusInput.value = "active";
  elements.priorityInput.value = "medium";
  elements.progressInput.value = 0;
  elements.progressValue.textContent = "0%";
  elements.checkFrequencyInput.value = "週1回";
  elements.nextCheckInput.value = new Date().toISOString().slice(0, 10);
  elements.nextTaskInput.value = "";
  elements.noteInput.value = "";
  elements.newAgentButton.textContent = "選択中を編集";
  elements.deleteAgentButton.disabled = true;
  elements.submitAgentButton.textContent = "新しいエージェントを追加";
}

function normalizeSelectedAgent() {
  if (isCreatingAgent) {
    return;
  }

  const hasSelectedAgent = loadAgents().some((agent) => agent.id === selectedAgentId);
  selectedAgentId = hasSelectedAgent ? selectedAgentId : loadAgents()[0]?.id || "";
  isCreatingAgent = loadAgents().length === 0;
}

function countByStatus(status) {
  return loadAgents().filter((agent) => agent.status === status).length;
}

function getSelectedAgent() {
  return loadAgents().find((agent) => agent.id === selectedAgentId);
}

function findPrimaryTask(agentId) {
  return loadTasks().find((task) => task.agentId === agentId && task.status !== "archived");
}

function createAgentFromForm() {
  const today = new Date().toISOString().slice(0, 10);
  const name = elements.nameInput.value.trim();

  return {
    id: createUniqueAgentId(name),
    name,
    role: elements.roleInput.value.trim(),
    status: elements.statusInput.value,
    priority: elements.priorityInput.value,
    progress: Number(elements.progressInput.value),
    checkFrequency: elements.checkFrequencyInput.value.trim() || "未設定",
    lastChecked: today,
    nextCheck: elements.nextCheckInput.value || today,
    memo: elements.noteInput.value.trim(),
  };
}

function createTaskFromForm(agentId) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: `task-${agentId}-next`,
    agentId,
    title: elements.nextTaskInput.value.trim(),
    status: elements.statusInput.value === "done" ? "done" : "open",
    dueDate: elements.nextCheckInput.value || today,
    updatedAt: today,
  };
}

function applyAgentFormChanges() {
  if (!validateAgentForm()) {
    return false;
  }

  const isNewAgent = isCreatingAgent || !getSelectedAgent();
  const agent = isNewAgent ? createAgentFromForm() : { ...getSelectedAgent() };
  const previousMemo = isNewAgent ? "" : getSelectedAgent().memo;
  const today = new Date().toISOString().slice(0, 10);

  agent.name = elements.nameInput.value.trim();
  agent.role = elements.roleInput.value.trim();
  agent.status = elements.statusInput.value;
  agent.priority = elements.priorityInput.value;
  agent.progress = Number(elements.progressInput.value);
  agent.checkFrequency = elements.checkFrequencyInput.value.trim() || "未設定";
  agent.nextCheck = elements.nextCheckInput.value || agent.nextCheck;
  agent.memo = elements.noteInput.value.trim();
  agent.lastChecked = today;

  saveAgent(agent);
  updateTask(createTaskFromForm(agent.id));

  if (agent.memo && agent.memo !== previousMemo) {
    addLog({
      id: `log-${Date.now()}`,
      agentId: agent.id,
      type: "agentMemo",
      content: agent.memo,
      createdAt: today,
    });
  }

  selectedAgentId = agent.id;
  isCreatingAgent = false;
  return true;
}

function deleteSelectedAgent() {
  const agent = getSelectedAgent();
  if (!agent) {
    return;
  }

  const confirmed = confirm(`${agent.name} を削除しますか？`);
  if (!confirmed) {
    return;
  }

  queueSheetWrite({
    action: "saveAgent",
    agent: { ...agent, status: "archived", updatedAt: new Date().toISOString() },
  });

  loadTasks()
    .filter((task) => task.agentId === agent.id)
    .forEach((task) => {
      queueSheetWrite({
        action: "updateTask",
        task: { ...task, status: "archived", updatedAt: new Date().toISOString() },
      });
    });

  store.agents = loadAgents().filter((item) => item.id !== agent.id);
  store.tasks = loadTasks().filter((task) => task.agentId !== agent.id);
  addLog({
    id: `log-${Date.now()}`,
    agentId: agent.id,
    type: "agentDeleted",
    content: `${agent.name} を削除`,
    createdAt: new Date().toISOString().slice(0, 10),
  });
  selectedAgentId = loadAgents()[0]?.id || "";
  isCreatingAgent = loadAgents().length === 0;
}

function updateDailyMemo(value) {
  const today = new Date().toISOString().slice(0, 10);
  store.settings.dailyMemo = value;
  const latestDailyLog = loadLogs().find((log) => log.type === "dailyMemo");

  if (latestDailyLog) {
    latestDailyLog.content = value;
    latestDailyLog.createdAt = today;
    return;
  }

  addLog({
    id: `log-${Date.now()}`,
    agentId: "",
    type: "dailyMemo",
    content: value,
    createdAt: today,
  });
}

function resetToDefaultData() {
  const previousAgents = [...store.agents];
  const previousTasks = [...store.tasks];
  store = cloneDefaultStore();
  selectedAgentId = loadAgents()[0]?.id || "";
  isCreatingAgent = false;

  const defaultAgentIds = new Set(store.agents.map((agent) => agent.id));
  const defaultTaskIds = new Set(store.tasks.map((task) => task.id));

  previousAgents
    .filter((agent) => !defaultAgentIds.has(agent.id))
    .forEach((agent) => {
      queueSheetWrite({
        action: "saveAgent",
        agent: { ...agent, status: "archived", updatedAt: new Date().toISOString() },
      });
    });

  previousTasks
    .filter((task) => !defaultTaskIds.has(task.id))
    .forEach((task) => {
      queueSheetWrite({
        action: "updateTask",
        task: { ...task, status: "archived", updatedAt: new Date().toISOString() },
      });
    });

  store.agents.forEach((agent) => {
    queueSheetWrite({ action: "saveAgent", agent });
  });
  store.tasks.forEach((task) => {
    queueSheetWrite({ action: "updateTask", task });
  });
}

function createUniqueAgentId(name) {
  const baseId =
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]+/g, "-")
      .replace(/^-+|-+$/g, "") || "agent";
  let candidate = baseId;
  let index = 2;

  while (loadAgents().some((agent) => agent.id === candidate)) {
    candidate = `${baseId}-${index}`;
    index += 1;
  }

  return candidate;
}

function validateAgentForm() {
  if (!elements.nameInput.value.trim()) {
    elements.nameInput.focus();
    return false;
  }

  if (!elements.roleInput.value.trim()) {
    elements.roleInput.focus();
    return false;
  }

  return true;
}

function hasAgentDraft() {
  return Boolean(
    elements.nameInput.value.trim() ||
      elements.roleInput.value.trim() ||
      elements.nextTaskInput.value.trim() ||
      elements.noteInput.value.trim(),
  );
}

function priorityRank(priority) {
  return { high: 1, medium: 2, low: 3 }[priority] || 4;
}

function isDueSoon(dateString) {
  const today = new Date();
  const target = new Date(`${dateString}T00:00:00`);
  const diff = target.getTime() - today.setHours(0, 0, 0, 0);
  return diff <= 1000 * 60 * 60 * 24 * 3;
}

function formatDate(dateString) {
  if (!dateString) {
    return "未設定";
  }

  return new Date(`${dateString}T00:00:00`).toLocaleDateString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

elements.agentSelect.addEventListener("change", (event) => {
  selectedAgentId = event.target.value;
  isCreatingAgent = false;
  syncForm();
  renderAgentCards();
});

elements.statusFilter.addEventListener("change", renderAgentCards);

elements.progressInput.addEventListener("input", (event) => {
  elements.progressValue.textContent = `${event.target.value}%`;
});

elements.dailyMemo.addEventListener("input", (event) => {
  updateDailyMemo(event.target.value);
});

elements.agentForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!applyAgentFormChanges()) {
    return;
  }

  persistStore();
  render();
});

elements.saveButton.addEventListener("click", () => {
  if (isCreatingAgent && !hasAgentDraft()) {
    persistStore();
    return;
  }

  if (!applyAgentFormChanges()) {
    return;
  }

  persistStore();
  render();
});

elements.newAgentButton.addEventListener("click", () => {
  isCreatingAgent = !isCreatingAgent;
  renderAgentSelect();
  syncForm();
});

elements.deleteAgentButton.addEventListener("click", () => {
  deleteSelectedAgent();
  persistStore();
  render();
});

elements.resetButton.addEventListener("click", () => {
  resetToDefaultData();
  persistStore();
  render();
});

render();
hydrateStoreFromSheets();
