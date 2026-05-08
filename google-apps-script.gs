/**
 * AI Agent Dashboard Google Apps Script backend.
 *
 * Spreadsheet sheets:
 * - Agents
 * - Logs
 * - Tasks
 * - Settings
 *
 * Put column names in row 1. Run setupSheets() once from the Apps Script editor,
 * then deploy as a Web app.
 */

const SHEET_NAMES = {
  agents: "Agents",
  logs: "Logs",
  tasks: "Tasks",
  settings: "Settings",
};

const HEADERS = {
  Agents: [
    "id",
    "name",
    "role",
    "status",
    "priority",
    "progress",
    "checkFrequency",
    "lastChecked",
    "nextCheck",
    "memo",
    "updatedAt",
  ],
  Logs: ["id", "agentId", "type", "content", "createdAt"],
  Tasks: ["id", "agentId", "title", "status", "dueDate", "updatedAt"],
  Settings: ["key", "value", "updatedAt"],
};

function doGet(e) {
  const data = {
    agents: readSheetAsObjects_(SHEET_NAMES.agents),
    logs: readSheetAsObjects_(SHEET_NAMES.logs),
    tasks: readSheetAsObjects_(SHEET_NAMES.tasks),
    settings: readSettings_(),
  };

  return jsonResponse_(data, e);
}

function doPost(e) {
  const payload = parsePayload_(e);
  const action = payload.action || "";

  if (action === "addLog") {
    const log = addLog_(payload.log || payload);
    return jsonResponse_({ ok: true, action, log });
  }

  if (action === "saveAgent") {
    const agent = saveAgent_(payload.agent || payload);
    return jsonResponse_({ ok: true, action, agent });
  }

  if (action === "updateTask") {
    const task = updateTask_(payload.task || payload);
    return jsonResponse_({ ok: true, action, task });
  }

  if (action === "saveSettings") {
    const settings = saveSettings_(payload.settings || {});
    return jsonResponse_({ ok: true, action, settings });
  }

  return jsonResponse_(
    {
      ok: false,
      error: "Unknown action. Use addLog, saveAgent, updateTask, or saveSettings.",
    },
    e,
  );
}

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  Object.keys(HEADERS).forEach((sheetName) => {
    const sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
    const headers = HEADERS[sheetName];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  });
}

function readSheetAsObjects_(sheetName) {
  const sheet = getSheet_(sheetName);
  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return [];
  }

  const headers = values[0].map(String);
  return values.slice(1).filter(hasAnyValue_).map((row) => rowToObject_(headers, row));
}

function readSettings_() {
  const rows = readSheetAsObjects_(SHEET_NAMES.settings);
  return rows.reduce((settings, row) => {
    settings[row.key] = row.value;
    return settings;
  }, {});
}

function addLog_(input) {
  const now = nowIso_();
  const log = {
    id: input.id || `log-${Date.now()}`,
    agentId: input.agentId || "",
    type: input.type || "manual",
    content: input.content || "",
    createdAt: input.createdAt || now.slice(0, 10),
  };

  appendObject_(SHEET_NAMES.logs, HEADERS.Logs, log);
  return log;
}

function saveAgent_(input) {
  const now = nowIso_();
  const agent = {
    id: required_(input.id, "agent.id"),
    name: input.name || "",
    role: input.role || "",
    status: input.status || "active",
    priority: input.priority || "medium",
    progress: Number(input.progress || 0),
    checkFrequency: input.checkFrequency || "",
    lastChecked: input.lastChecked || now.slice(0, 10),
    nextCheck: input.nextCheck || "",
    memo: input.memo || "",
    updatedAt: now,
  };

  upsertObject_(SHEET_NAMES.agents, HEADERS.Agents, "id", agent);
  return agent;
}

function updateTask_(input) {
  const now = nowIso_();
  const task = {
    id: input.id || `task-${required_(input.agentId, "task.agentId")}-next`,
    agentId: input.agentId || "",
    title: input.title || "",
    status: input.status || "open",
    dueDate: input.dueDate || "",
    updatedAt: now,
  };

  upsertObject_(SHEET_NAMES.tasks, HEADERS.Tasks, "id", task);
  return task;
}

function saveSettings_(settings) {
  const now = nowIso_();

  Object.keys(settings).forEach((key) => {
    upsertObject_(SHEET_NAMES.settings, HEADERS.Settings, "key", {
      key,
      value: settings[key],
      updatedAt: now,
    });
  });

  return readSettings_();
}

function appendObject_(sheetName, headers, object) {
  const sheet = getSheet_(sheetName);
  ensureHeaders_(sheet, headers);
  sheet.appendRow(headers.map((header) => object[header] ?? ""));
}

function upsertObject_(sheetName, headers, keyColumn, object) {
  const sheet = getSheet_(sheetName);
  ensureHeaders_(sheet, headers);

  const values = sheet.getDataRange().getValues();
  const currentHeaders = values[0].map(String);
  const keyIndex = currentHeaders.indexOf(keyColumn);
  const targetKey = String(object[keyColumn] || "");
  const rowIndex = values.findIndex((row, index) => index > 0 && String(row[keyIndex]) === targetKey);
  const rowValues = currentHeaders.map((header) => object[header] ?? "");

  if (rowIndex >= 0) {
    sheet.getRange(rowIndex + 1, 1, 1, currentHeaders.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
}

function getSheet_(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`Sheet not found: ${sheetName}. Run setupSheets() first.`);
  }
  return sheet;
}

function ensureHeaders_(sheet, expectedHeaders) {
  const width = expectedHeaders.length;
  const current = sheet.getRange(1, 1, 1, width).getValues()[0].map(String);
  const missingHeaders = expectedHeaders.some((header, index) => current[index] !== header);

  if (missingHeaders) {
    sheet.getRange(1, 1, 1, width).setValues([expectedHeaders]);
    sheet.setFrozenRows(1);
  }
}

function rowToObject_(headers, row) {
  return headers.reduce((object, header, index) => {
    object[header] = row[index];
    return object;
  }, {});
}

function hasAnyValue_(row) {
  return row.some((cell) => cell !== "");
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }

  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    return e.parameter || {};
  }
}

function jsonResponse_(data, e) {
  const callback = e && e.parameter && e.parameter.callback;
  const body = JSON.stringify(data);

  // Apps Script ContentService cannot set arbitrary CORS response headers.
  // CORS-friendly usage:
  // - Keep fetch requests "simple" by sending text/plain JSON.
  // - Avoid custom request headers that trigger OPTIONS preflight.
  // - For read-only browser integrations that hit CORS limits, use callback
  //   query parameter for JSONP-style GET.
  if (callback) {
    return ContentService.createTextOutput(`${callback}(${body});`).setMimeType(
      ContentService.MimeType.JAVASCRIPT,
    );
  }

  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

function required_(value, fieldName) {
  if (!value) {
    throw new Error(`Missing required field: ${fieldName}`);
  }
  return value;
}

function nowIso_() {
  return new Date().toISOString();
}
