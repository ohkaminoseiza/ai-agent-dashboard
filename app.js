const STORAGE_KEY = "manual-ai-agent-dashboard-v1";

const defaultDashboardData = {
  dailyMemo:
    "Codexは実装作業、Perplexityは調査メモ確認を優先。NotebookLMの要約精度は週次レビューで見直す。",
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
      nextTask: "作成中のWebプロトタイプを確認し、UIの改善点を洗い出す",
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
      nextTask: "Codexの実装後に設計観点のレビューを依頼する",
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
      nextTask: "Googleスプレッドシート連携の実装候補を調べる",
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
      nextTask: "参照資料を更新して、未整理メモを再要約する",
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
      nextTask: "今週使う告知画像のトーンを確認する",
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
      nextTask: "次回レビューで対象フォルダと実行条件を見直す",
      memo: "今週分の整理は完了。自動実行前にバックアップ方針を確認する。",
    },
  ],
};

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

let dashboardData = loadData();
let selectedAgentId = dashboardData.agents[0]?.id || "";
let isCreatingAgent = false;

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

function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return cloneDefaultData();
  }

  try {
    return JSON.parse(saved);
  } catch (error) {
    console.warn("Saved dashboard data could not be parsed.", error);
    return cloneDefaultData();
  }
}

function cloneDefaultData() {
  return JSON.parse(JSON.stringify(defaultDashboardData));
}

function saveData() {
  // Future Google Sheets integration point:
  // Replace or complement this localStorage write with a Sheets API sync adapter.
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dashboardData));
  const savedAt = new Date();
  elements.lastSavedText.textContent = savedAt.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function render() {
  normalizeSelectedAgent();
  renderToday();
  renderSummary();
  renderAgentSelect();
  renderAgentCards();
  renderSideLists();
  syncForm();
}

function normalizeSelectedAgent() {
  if (isCreatingAgent) {
    return;
  }

  const hasSelectedAgent = dashboardData.agents.some((agent) => agent.id === selectedAgentId);
  selectedAgentId = hasSelectedAgent ? selectedAgentId : dashboardData.agents[0]?.id || "";
  isCreatingAgent = dashboardData.agents.length === 0;
}

function renderToday() {
  elements.todayLabel.textContent = new Date().toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
  elements.dailyMemo.value = dashboardData.dailyMemo;
}

function renderSummary() {
  const agents = dashboardData.agents;
  const average = agents.length
    ? agents.reduce((total, agent) => total + Number(agent.progress), 0) / agents.length
    : 0;

  elements.activeCount.textContent = countByStatus("active");
  elements.waitingCount.textContent = countByStatus("waiting");
  elements.doneCount.textContent = countByStatus("done");
  elements.weeklyAverage.textContent = `${Math.round(average)}%`;
}

function countByStatus(status) {
  return dashboardData.agents.filter((agent) => agent.status === status).length;
}

function renderAgentSelect() {
  elements.agentSelect.innerHTML = dashboardData.agents.length
    ? dashboardData.agents
        .map((agent) => `<option value="${agent.id}">${agent.name}</option>`)
        .join("")
    : `<option value="">登録済みエージェントなし</option>`;
  elements.agentSelect.value = selectedAgentId;
  elements.agentSelect.disabled = isCreatingAgent || dashboardData.agents.length === 0;
}

function renderAgentCards() {
  const filter = elements.statusFilter.value;
  const agents =
    filter === "all"
      ? dashboardData.agents
      : dashboardData.agents.filter((agent) => agent.status === filter);

  elements.agentGrid.innerHTML = agents.length
    ? agents.map(createAgentCardMarkup).join("")
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
        <p>${escapeHtml(agent.nextTask)}</p>
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
  const nextActions = dashboardData.agents
    .filter((agent) => agent.status !== "done")
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority))
    .slice(0, 4);

  elements.nextActionList.innerHTML = nextActions
    .map(
      (agent) =>
        `<li><strong>${escapeHtml(agent.name)}</strong>${escapeHtml(agent.nextTask)}</li>`,
    )
    .join("");

  const reviewItems = dashboardData.agents
    .filter((agent) => agent.status === "waiting" || isDueSoon(agent.nextCheck))
    .slice(0, 5);

  elements.reviewList.innerHTML = reviewItems
    .map(
      (agent) =>
        `<li><strong>${escapeHtml(agent.name)}</strong>${formatDate(agent.nextCheck)} に確認</li>`,
    )
    .join("");
}

function syncForm() {
  if (isCreatingAgent || dashboardData.agents.length === 0) {
    syncCreateForm();
    return;
  }

  const agent = getSelectedAgent();

  if (!agent) {
    syncCreateForm();
    return;
  }

  elements.agentSelect.value = agent.id;
  elements.nameInput.value = agent.name;
  elements.roleInput.value = agent.role;
  elements.statusInput.value = agent.status;
  elements.priorityInput.value = agent.priority;
  elements.progressInput.value = agent.progress;
  elements.progressValue.textContent = `${agent.progress}%`;
  elements.checkFrequencyInput.value = agent.checkFrequency;
  elements.nextCheckInput.value = agent.nextCheck;
  elements.nextTaskInput.value = agent.nextTask;
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

function getSelectedAgent() {
  return dashboardData.agents.find((agent) => agent.id === selectedAgentId);
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
    nextTask: elements.nextTaskInput.value.trim(),
    memo: elements.noteInput.value.trim(),
  };
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

  while (dashboardData.agents.some((agent) => agent.id === candidate)) {
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
  dashboardData.dailyMemo = event.target.value;
});

elements.agentForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!validateAgentForm()) {
    return;
  }

  if (isCreatingAgent || !getSelectedAgent()) {
    const newAgent = createAgentFromForm();
    dashboardData.agents.push(newAgent);
    selectedAgentId = newAgent.id;
    isCreatingAgent = false;
    saveData();
    render();
    return;
  }

  const agent = getSelectedAgent();
  if (!agent) {
    return;
  }

  agent.name = elements.nameInput.value.trim();
  agent.role = elements.roleInput.value.trim();
  agent.status = elements.statusInput.value;
  agent.priority = elements.priorityInput.value;
  agent.progress = Number(elements.progressInput.value);
  agent.checkFrequency = elements.checkFrequencyInput.value.trim() || "未設定";
  agent.nextCheck = elements.nextCheckInput.value || agent.nextCheck;
  agent.nextTask = elements.nextTaskInput.value.trim();
  agent.memo = elements.noteInput.value.trim();
  agent.lastChecked = new Date().toISOString().slice(0, 10);

  saveData();
  render();
});

elements.saveButton.addEventListener("click", () => {
  saveData();
});

elements.newAgentButton.addEventListener("click", () => {
  isCreatingAgent = !isCreatingAgent;
  renderAgentSelect();
  syncForm();
});

elements.deleteAgentButton.addEventListener("click", () => {
  const agent = getSelectedAgent();
  if (!agent) {
    return;
  }

  const confirmed = confirm(`${agent.name} を削除しますか？`);
  if (!confirmed) {
    return;
  }

  dashboardData.agents = dashboardData.agents.filter((item) => item.id !== agent.id);
  selectedAgentId = dashboardData.agents[0]?.id || "";
  isCreatingAgent = dashboardData.agents.length === 0;
  saveData();
  render();
});

elements.resetButton.addEventListener("click", () => {
  dashboardData = cloneDefaultData();
  selectedAgentId = dashboardData.agents[0].id;
  isCreatingAgent = false;
  saveData();
  render();
});

render();
