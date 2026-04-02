const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const mysql = require("mysql2/promise");

require("dotenv").config({ path: path.join(process.cwd(), ".env") });

const sqliteFile = path.resolve(process.cwd(), process.env.DB_FILE || "data/app.sqlite");
const sqliteDir = path.dirname(sqliteFile);

if (!fs.existsSync(sqliteDir)) {
  fs.mkdirSync(sqliteDir, { recursive: true });
}

const sqliteDb = new DatabaseSync(sqliteFile);
sqliteDb.exec("PRAGMA journal_mode = WAL;");
sqliteDb.exec("PRAGMA synchronous = NORMAL;");

sqliteDb.exec(`
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

sqliteDb.exec(`
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

sqliteDb.exec(`
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

sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS audit_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    audit_id TEXT NOT NULL,
    action TEXT,
    payload_json TEXT,
    result_json TEXT
  );
`);

const sqliteInsertCouponGenerationStmt = sqliteDb.prepare(`
  INSERT INTO coupon_generations (size, league, risk, source, summary_json, coupon_json)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const sqliteInsertCouponValidationStmt = sqliteDb.prepare(`
  INSERT INTO coupon_validations (drift_threshold, status, request_json, report_json, error_text)
  VALUES (?, ?, ?, ?, ?)
`);

const sqliteInsertTelegramLogStmt = sqliteDb.prepare(`
  INSERT INTO telegram_logs (kind, status, message, payload_json, response_json, error_text)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const sqliteInsertAuditReportStmt = sqliteDb.prepare(`
  INSERT INTO audit_reports (audit_id, action, payload_json, result_json)
  VALUES (?, ?, ?, ?)
`);

const sqliteSelectCouponHistoryStmt = sqliteDb.prepare(`
  SELECT id, created_at, size, league, risk, source, summary_json, coupon_json
  FROM coupon_generations
  ORDER BY id DESC
  LIMIT ?
`);

const sqliteSelectTelegramHistoryStmt = sqliteDb.prepare(`
  SELECT id, created_at, kind, status, message, payload_json, response_json, error_text
  FROM telegram_logs
  ORDER BY id DESC
  LIMIT ?
`);

const sqliteSelectAuditHistoryStmt = sqliteDb.prepare(`
  SELECT id, created_at, audit_id, action, payload_json, result_json
  FROM audit_reports
  ORDER BY id DESC
  LIMIT ?
`);

const mysqlConfig = {
  host: String(process.env.DB_HOST || "").trim(),
  port: Number(process.env.DB_PORT) || 3306,
  database: String(process.env.DB_NAME || "").trim(),
  user: String(process.env.DB_USER || "").trim(),
  password: String(process.env.DB_PASSWORD || "").trim(),
};

const mysqlRequested = Boolean(mysqlConfig.host && mysqlConfig.database && mysqlConfig.user && mysqlConfig.password);
let mysqlPool = null;
let mysqlReady = false;
let mysqlInitError = null;
let mysqlInitPromise = null;

function parseJsonSafe(v, fallback = null) {
  if (!v) return fallback;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function toJson(value, fallback) {
  return JSON.stringify(value ?? fallback);
}

function buildSavedOptions(entry = {}) {
  return {
    size: Number(entry.size) || null,
    league: entry.league ? String(entry.league) : null,
    risk: entry.risk ? String(entry.risk) : null,
    source: entry.source ? String(entry.source) : null,
    driftThreshold: Number(entry.driftThreshold) || null,
    status: entry.status ? String(entry.status) : null,
    kind: entry.kind ? String(entry.kind) : null,
    message: entry.message ? String(entry.message) : null,
    action: entry.action ? String(entry.action) : null,
  };
}

async function initMySql() {
  if (!mysqlRequested) return false;
  if (mysqlInitPromise) return mysqlInitPromise;

  mysqlInitPromise = (async () => {
    try {
      mysqlPool = mysql.createPool({
        host: mysqlConfig.host,
        port: mysqlConfig.port,
        database: mysqlConfig.database,
        user: mysqlConfig.user,
        password: mysqlConfig.password,
        connectTimeout: 5000,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS coupon_generations (
          id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          size INT NULL,
          league VARCHAR(255) NULL,
          risk VARCHAR(255) NULL,
          source VARCHAR(255) NULL,
          saved_options_json LONGTEXT NULL,
          summary_json LONGTEXT NULL,
          coupon_json LONGTEXT NULL
        )
      `);

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS coupon_validations (
          id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          drift_threshold DOUBLE NULL,
          status VARCHAR(100) NULL,
          saved_options_json LONGTEXT NULL,
          request_json LONGTEXT NULL,
          report_json LONGTEXT NULL,
          error_text TEXT NULL
        )
      `);

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS telegram_logs (
          id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          kind VARCHAR(100) NULL,
          status VARCHAR(100) NULL,
          message TEXT NULL,
          saved_options_json LONGTEXT NULL,
          payload_json LONGTEXT NULL,
          response_json LONGTEXT NULL,
          error_text TEXT NULL
        )
      `);

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS audit_reports (
          id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          audit_id VARCHAR(255) NOT NULL,
          action VARCHAR(255) NULL,
          saved_options_json LONGTEXT NULL,
          payload_json LONGTEXT NULL,
          result_json LONGTEXT NULL
        )
      `);

      mysqlReady = true;
      mysqlInitError = null;
      return true;
    } catch (error) {
      mysqlReady = false;
      mysqlInitError = error;
      return false;
    }
  })();

  return mysqlInitPromise;
}

async function canUseMySql() {
  if (!mysqlRequested) return false;
  if (mysqlReady && mysqlPool) return true;
  return initMySql();
}

async function saveCouponGeneration(entry = {}) {
  const savedOptions = buildSavedOptions(entry);
  if (await canUseMySql()) {
    const [result] = await mysqlPool.execute(
      `INSERT INTO coupon_generations (size, league, risk, source, saved_options_json, summary_json, coupon_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(entry.size) || null,
        entry.league ? String(entry.league) : null,
        entry.risk ? String(entry.risk) : null,
        entry.source ? String(entry.source) : null,
        toJson(savedOptions, {}),
        toJson(entry.summary || {}, {}),
        toJson(entry.coupon || [], []),
      ]
    );
    return result.insertId;
  }

  const result = sqliteInsertCouponGenerationStmt.run(
    Number(entry.size) || null,
    entry.league ? String(entry.league) : null,
    entry.risk ? String(entry.risk) : null,
    entry.source ? String(entry.source) : null,
    toJson(entry.summary || {}, {}),
    toJson(entry.coupon || [], [])
  );
  return result.lastInsertRowid;
}

async function saveCouponValidation(entry = {}) {
  const savedOptions = buildSavedOptions(entry);
  if (await canUseMySql()) {
    const [result] = await mysqlPool.execute(
      `INSERT INTO coupon_validations (drift_threshold, status, saved_options_json, request_json, report_json, error_text)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        Number(entry.driftThreshold) || null,
        entry.status ? String(entry.status) : "unknown",
        toJson(savedOptions, {}),
        toJson(entry.request || {}, {}),
        toJson(entry.report || {}, {}),
        entry.error ? String(entry.error) : null,
      ]
    );
    return result.insertId;
  }

  const result = sqliteInsertCouponValidationStmt.run(
    Number(entry.driftThreshold) || null,
    entry.status ? String(entry.status) : "unknown",
    toJson(entry.request || {}, {}),
    toJson(entry.report || {}, {}),
    entry.error ? String(entry.error) : null
  );
  return result.lastInsertRowid;
}

async function saveTelegramLog(entry = {}) {
  const savedOptions = buildSavedOptions(entry);
  if (await canUseMySql()) {
    const [result] = await mysqlPool.execute(
      `INSERT INTO telegram_logs (kind, status, message, saved_options_json, payload_json, response_json, error_text)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.kind ? String(entry.kind) : "coupon",
        entry.status ? String(entry.status) : "unknown",
        entry.message ? String(entry.message) : null,
        toJson(savedOptions, {}),
        toJson(entry.payload || {}, {}),
        toJson(entry.response || {}, {}),
        entry.error ? String(entry.error) : null,
      ]
    );
    return result.insertId;
  }

  const result = sqliteInsertTelegramLogStmt.run(
    entry.kind ? String(entry.kind) : "coupon",
    entry.status ? String(entry.status) : "unknown",
    entry.message ? String(entry.message) : null,
    toJson(entry.payload || {}, {}),
    toJson(entry.response || {}, {}),
    entry.error ? String(entry.error) : null
  );
  return result.lastInsertRowid;
}

async function saveAuditReport(entry = {}) {
  const auditId = entry.auditId ? String(entry.auditId) : `AUD-${Date.now()}`;
  const savedOptions = buildSavedOptions(entry);

  if (await canUseMySql()) {
    const [result] = await mysqlPool.execute(
      `INSERT INTO audit_reports (audit_id, action, saved_options_json, payload_json, result_json)
       VALUES (?, ?, ?, ?, ?)`,
      [
        auditId,
        entry.action ? String(entry.action) : "unknown",
        toJson(savedOptions, {}),
        toJson(entry.payload || {}, {}),
        toJson(entry.result || {}, {}),
      ]
    );
    return { id: result.insertId, auditId };
  }

  const result = sqliteInsertAuditReportStmt.run(
    auditId,
    entry.action ? String(entry.action) : "unknown",
    toJson(entry.payload || {}, {}),
    toJson(entry.result || {}, {})
  );
  return { id: result.lastInsertRowid, auditId };
}

async function getCouponHistory(limit = 20) {
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 20));

  if (await canUseMySql()) {
    const [rows] = await mysqlPool.execute(
      `SELECT id, created_at, size, league, risk, source, saved_options_json, summary_json, coupon_json
       FROM coupon_generations
       ORDER BY id DESC
       LIMIT ?`,
      [safeLimit]
    );
    return rows.map((row) => ({
      id: row.id,
      createdAt: normalizeDate(row.created_at),
      size: row.size,
      league: row.league,
      risk: row.risk,
      source: row.source,
      savedOptions: parseJsonSafe(row.saved_options_json, {}),
      summary: parseJsonSafe(row.summary_json, {}),
      coupon: parseJsonSafe(row.coupon_json, []),
    }));
  }

  return sqliteSelectCouponHistoryStmt.all(safeLimit).map((row) => ({
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

async function getTelegramHistory(limit = 20) {
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 20));

  if (await canUseMySql()) {
    const [rows] = await mysqlPool.execute(
      `SELECT id, created_at, kind, status, message, saved_options_json, payload_json, response_json, error_text
       FROM telegram_logs
       ORDER BY id DESC
       LIMIT ?`,
      [safeLimit]
    );
    return rows.map((row) => ({
      id: row.id,
      createdAt: normalizeDate(row.created_at),
      kind: row.kind,
      status: row.status,
      message: row.message,
      savedOptions: parseJsonSafe(row.saved_options_json, {}),
      payload: parseJsonSafe(row.payload_json, {}),
      response: parseJsonSafe(row.response_json, {}),
      error: row.error_text || null,
    }));
  }

  return sqliteSelectTelegramHistoryStmt.all(safeLimit).map((row) => ({
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

async function getAuditHistory(limit = 20) {
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 20));

  if (await canUseMySql()) {
    const [rows] = await mysqlPool.execute(
      `SELECT id, created_at, audit_id, action, saved_options_json, payload_json, result_json
       FROM audit_reports
       ORDER BY id DESC
       LIMIT ?`,
      [safeLimit]
    );
    return rows.map((row) => ({
      id: row.id,
      createdAt: normalizeDate(row.created_at),
      auditId: row.audit_id,
      action: row.action,
      savedOptions: parseJsonSafe(row.saved_options_json, {}),
      payload: parseJsonSafe(row.payload_json, {}),
      result: parseJsonSafe(row.result_json, {}),
    }));
  }

  return sqliteSelectAuditHistoryStmt.all(safeLimit).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    auditId: row.audit_id,
    action: row.action,
    payload: parseJsonSafe(row.payload_json, {}),
    result: parseJsonSafe(row.result_json, {}),
  }));
}

async function getDbStatus() {
  if (await canUseMySql()) {
    const [couponRows] = await mysqlPool.query("SELECT COUNT(*) AS c FROM coupon_generations");
    const [validationRows] = await mysqlPool.query("SELECT COUNT(*) AS c FROM coupon_validations");
    const [telegramRows] = await mysqlPool.query("SELECT COUNT(*) AS c FROM telegram_logs");
    const [auditRows] = await mysqlPool.query("SELECT COUNT(*) AS c FROM audit_reports");

    return {
      ok: true,
      mode: "mysql",
      host: mysqlConfig.host,
      database: mysqlConfig.database,
      tables: {
        coupon_generations: Number(couponRows?.[0]?.c) || 0,
        coupon_validations: Number(validationRows?.[0]?.c) || 0,
        telegram_logs: Number(telegramRows?.[0]?.c) || 0,
        audit_reports: Number(auditRows?.[0]?.c) || 0,
      },
    };
  }

  const couponCount = sqliteDb.prepare("SELECT COUNT(*) AS c FROM coupon_generations").get().c;
  const validationCount = sqliteDb.prepare("SELECT COUNT(*) AS c FROM coupon_validations").get().c;
  const telegramCount = sqliteDb.prepare("SELECT COUNT(*) AS c FROM telegram_logs").get().c;
  const auditCount = sqliteDb.prepare("SELECT COUNT(*) AS c FROM audit_reports").get().c;

  return {
    ok: true,
    mode: "sqlite",
    file: sqliteFile,
    mysqlRequested,
    mysqlError: mysqlInitError ? String(mysqlInitError.message || mysqlInitError) : null,
    tables: {
      coupon_generations: Number(couponCount) || 0,
      coupon_validations: Number(validationCount) || 0,
      telegram_logs: Number(telegramCount) || 0,
      audit_reports: Number(auditCount) || 0,
    },
  };
}

module.exports = {
  saveCouponGeneration,
  saveCouponValidation,
  saveTelegramLog,
  saveAuditReport,
  getCouponHistory,
  getTelegramHistory,
  getAuditHistory,
  getDbStatus,
};
