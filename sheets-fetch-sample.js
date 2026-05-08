const SHEETS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwaqZlyTV49-30OK5lfRMHYQ_oqDtbTbYEPT07KiHzdQBcUay9otvZmF_GkdHCb4XTo6A/exec";

async function fetchDashboardData() {
  return fetchDashboardDataJsonp();
}

function fetchDashboardDataJsonp() {
  return new Promise((resolve, reject) => {
    const callbackName = `handleDashboardData_${Date.now()}`;
    const script = document.createElement("script");
    const separator = SHEETS_WEB_APP_URL.includes("?") ? "&" : "?";

    window[callbackName] = (data) => {
      resolve(data);
      script.remove();
      delete window[callbackName];
    };

    script.onerror = () => {
      reject(new Error("Failed to load dashboard data."));
      script.remove();
      delete window[callbackName];
    };

    script.src = `${SHEETS_WEB_APP_URL}${separator}callback=${callbackName}`;
    document.body.appendChild(script);
  });
}

async function appendWorkLog({ agentId, content, type = "manual" }) {
  return postToSheets({
    action: "addLog",
    log: {
      agentId,
      type,
      content,
      createdAt: new Date().toISOString().slice(0, 10),
    },
  });
}

async function saveAgentProgress(agent) {
  return postToSheets({
    action: "saveAgent",
    agent: {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      status: agent.status,
      priority: agent.priority,
      progress: agent.progress,
      checkFrequency: agent.checkFrequency,
      lastChecked: new Date().toISOString().slice(0, 10),
      nextCheck: agent.nextCheck,
      memo: agent.memo,
    },
  });
}

async function saveTask(task) {
  return postToSheets({
    action: "updateTask",
    task: {
      id: task.id,
      agentId: task.agentId,
      title: task.title,
      status: task.status,
      dueDate: task.dueDate,
    },
  });
}

async function postToSheets(payload) {
  // Use no-cors and no custom headers because Apps Script ContentService
  // cannot set arbitrary CORS response headers. The request is fire-and-forget.
  await fetch(SHEETS_WEB_APP_URL, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify(payload),
  });

  return { ok: true };
}
