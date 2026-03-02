const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const dbFile = path.resolve(process.cwd(), process.env.DB_FILE || "data/app.sqlite");
const dbDir = path.dirname(dbFile);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(dbFile);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA synchronous = NORMAL;");

db.exec(`
  CREATE TABLE IF NOT EXISTS coupon_generations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    size INTEGER,
    league TEXT,
    risk TEXT,
    source TEXT,
    summary_json TEXT,
    coupon_json TEXT
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS coupon_validations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    drift_threshold REAL,
    status TEXT,
    request_json TEXT,
    report_json TEXT,
    error_text TEXT
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS telegram_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    kind TEXT,
    status TEXT,
    message TEXT,
    payload_json TEXT,
    response_json TEXT,
    error_text TEXT
  );
`);

const insertCouponGenerationStmt = db.prepare(`
  INSERT INTO coupon_generations (size, league, risk, source, summary_json, coupon_json)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const insertCouponValidationStmt = db.prepare(`
  INSERT INTO coupon_validations (drift_threshold, status, request_json, report_json, error_text)
  VALUES (?, ?, ?, ?, ?)
`);

const insertTelegramLogStmt = db.prepare(`
  INSERT INTO telegram_logs (kind, status, message, payload_json, response_json, error_text)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const selectCouponHistoryStmt = db.prepare(`
  SELECT id, created_at, size, league, risk, source, summary_json, coupon_json
  FROM coupon_generations
  ORDER BY id DESC
  LIMIT ?
`);

const selectTelegramHistoryStmt = db.prepare(`
  SELECT id, created_at, kind, status, message, payload_json, response_json, error_text
  FROM telegram_logs
  ORDER BY id DESC
  LIMIT ?
`);

function parseJsonSafe(v, fallback = null) {
  if (!v) return fallback;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

function saveCouponGeneration(entry = {}) {
  const result = insertCouponGenerationStmt.run(
    Number(entry.size) || null,
    entry.league ? String(entry.league) : null,
    entry.risk ? String(entry.risk) : null,
    entry.source ? String(entry.source) : null,
    JSON.stringify(entry.summary || {}),
    JSON.stringify(entry.coupon || [])
  );
  return result.lastInsertRowid;
}

function saveCouponValidation(entry = {}) {
  const result = insertCouponValidationStmt.run(
    Number(entry.driftThreshold) || null,
    entry.status ? String(entry.status) : "unknown",
    JSON.stringify(entry.request || {}),
    JSON.stringify(entry.report || {}),
    entry.error ? String(entry.error) : null
  );
  return result.lastInsertRowid;
}

function saveTelegramLog(entry = {}) {
  const result = insertTelegramLogStmt.run(
    entry.kind ? String(entry.kind) : "coupon",
    entry.status ? String(entry.status) : "unknown",
    entry.message ? String(entry.message) : null,
    JSON.stringify(entry.payload || {}),
    JSON.stringify(entry.response || {}),
    entry.error ? String(entry.error) : null
  );
  return result.lastInsertRowid;
}

function getCouponHistory(limit = 20) {
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 20));
  return selectCouponHistoryStmt.all(safeLimit).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    size: row.size,
    league: row.league,
    risk: row.risk,
    source: row.source,
    summary: parseJsonSafe(row.summary_json, {}),
    coupon: parseJsonSafe(row.coupon_json, []),
  }));
}

function getTelegramHistory(limit = 20) {
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 20));
  return selectTelegramHistoryStmt.all(safeLimit).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    kind: row.kind,
    status: row.status,
    message: row.message,
    payload: parseJsonSafe(row.payload_json, {}),
    response: parseJsonSafe(row.response_json, {}),
    error: row.error_text || null,
  }));
}

function getDbStatus() {
  const couponCount = db.prepare("SELECT COUNT(*) AS c FROM coupon_generations").get().c;
  const validationCount = db.prepare("SELECT COUNT(*) AS c FROM coupon_validations").get().c;
  const telegramCount = db.prepare("SELECT COUNT(*) AS c FROM telegram_logs").get().c;
  return {
    ok: true,
    file: dbFile,
    tables: {
      coupon_generations: Number(couponCount) || 0,
      coupon_validations: Number(validationCount) || 0,
      telegram_logs: Number(telegramCount) || 0,
    },
  };
}

module.exports = {
  saveCouponGeneration,
  saveCouponValidation,
  saveTelegramLog,
  getCouponHistory,
  getTelegramHistory,
  getDbStatus,
};
