import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const DB_PATH = process.env.DB_PATH || path.resolve(process.cwd(), 'printjobs.sqlite');

// Ensure database target folder exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// If configured DB_PATH does not exist yet but a local database exists in workspace root, copy it
const legacyDb = path.resolve(process.cwd(), 'printjobs.sqlite');
if (!fs.existsSync(DB_PATH) && fs.existsSync(legacyDb) && path.resolve(DB_PATH) !== legacyDb) {
  try {
    fs.copyFileSync(legacyDb, DB_PATH);
    console.log(`[PrintJobs DB] Initialized volume database from ${legacyDb} -> ${DB_PATH}`);
  } catch (err: any) {
    console.warn(`[PrintJobs DB] Could not copy initial database:`, err.message);
  }
}

console.log(`[PrintJobs DB] Using SQLite database at: ${DB_PATH}`);
export const db = new DatabaseSync(DB_PATH);

export function initDatabase() {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS printers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      model TEXT NOT NULL,
      make TEXT NOT NULL,
      adapter_type TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      access_code TEXT,
      status TEXT NOT NULL DEFAULT 'offline',
      telemetry_json TEXT,
      last_seen_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      member_number TEXT,
      external_id TEXT UNIQUE,
      avatar_url TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
  `);

  // Migrations for existing DBs
  try {
    db.exec('ALTER TABLE users ADD COLUMN external_id TEXT;');
  } catch {}
  try {
    db.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT;');
  } catch {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS print_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      printer_id TEXT NOT NULL,
      job_name TEXT NOT NULL,
      status TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      material_type TEXT NOT NULL DEFAULT 'PLA',
      material_color_hex TEXT NOT NULL DEFAULT '#10B981',
      material_used_grams REAL NOT NULL DEFAULT 0,
      assigned_user_id INTEGER,
      assigned_at TEXT,
      cost_cents INTEGER NOT NULL DEFAULT 0,
      is_paid INTEGER NOT NULL DEFAULT 0,
      metadata_json TEXT,
      FOREIGN KEY(assigned_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS maintenance_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      printer_id TEXT NOT NULL,
      service_type TEXT NOT NULL,
      notes TEXT NOT NULL,
      performed_by TEXT NOT NULL,
      performed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  migrateCascadeConstraints();

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_print_jobs_printer_status ON print_jobs(printer_id, status);
    CREATE INDEX IF NOT EXISTS idx_print_jobs_user ON print_jobs(assigned_user_id);
  `);

  cleanupMockData();
  seedInitialData();
}

/**
 * Safely migrates legacy tables that had FOREIGN KEY(printer_id) ... ON DELETE CASCADE,
 * preventing accidental deletion of print history and unpaid Materialkasse balances
 * when a printer is removed.
 */
function migrateCascadeConstraints() {
  try {
    const jobsSchema = db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'print_jobs'")
      .get() as { sql?: string } | undefined;

    if (jobsSchema?.sql && /REFERENCES\s+printers\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE/i.test(jobsSchema.sql)) {
      console.log('[PrintJobs DB] Migrating print_jobs table to remove destructive ON DELETE CASCADE on printer_id...');
      db.exec('PRAGMA foreign_keys = OFF;');
      try {
        db.exec(`
          BEGIN TRANSACTION;
          CREATE TABLE print_jobs_migrated (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            printer_id TEXT NOT NULL,
            job_name TEXT NOT NULL,
            status TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT,
            duration_seconds INTEGER NOT NULL DEFAULT 0,
            material_type TEXT NOT NULL DEFAULT 'PLA',
            material_color_hex TEXT NOT NULL DEFAULT '#10B981',
            material_used_grams REAL NOT NULL DEFAULT 0,
            assigned_user_id INTEGER,
            assigned_at TEXT,
            cost_cents INTEGER NOT NULL DEFAULT 0,
            is_paid INTEGER NOT NULL DEFAULT 0,
            metadata_json TEXT,
            FOREIGN KEY(assigned_user_id) REFERENCES users(id) ON DELETE SET NULL
          );
          INSERT INTO print_jobs_migrated (
            id, printer_id, job_name, status, start_time, end_time, duration_seconds,
            material_type, material_color_hex, material_used_grams, assigned_user_id,
            assigned_at, cost_cents, is_paid, metadata_json
          )
          SELECT
            id, printer_id, job_name, status, start_time, end_time, duration_seconds,
            material_type, material_color_hex, material_used_grams, assigned_user_id,
            assigned_at, cost_cents, is_paid, metadata_json
          FROM print_jobs;
          DROP TABLE print_jobs;
          ALTER TABLE print_jobs_migrated RENAME TO print_jobs;
          COMMIT;
        `);
        console.log('[PrintJobs DB] Successfully migrated print_jobs table.');
      } catch (err) {
        try { db.exec('ROLLBACK;'); } catch {}
        throw err;
      } finally {
        db.exec('PRAGMA foreign_keys = ON;');
      }
    }

    const maintSchema = db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'maintenance_logs'")
      .get() as { sql?: string } | undefined;

    if (maintSchema?.sql && /REFERENCES\s+printers\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE/i.test(maintSchema.sql)) {
      console.log('[PrintJobs DB] Migrating maintenance_logs table to remove ON DELETE CASCADE...');
      db.exec('PRAGMA foreign_keys = OFF;');
      try {
        db.exec(`
          BEGIN TRANSACTION;
          CREATE TABLE maintenance_logs_migrated (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            printer_id TEXT NOT NULL,
            service_type TEXT NOT NULL,
            notes TEXT NOT NULL,
            performed_by TEXT NOT NULL,
            performed_at TEXT NOT NULL
          );
          INSERT INTO maintenance_logs_migrated (id, printer_id, service_type, notes, performed_by, performed_at)
          SELECT id, printer_id, service_type, notes, performed_by, performed_at FROM maintenance_logs;
          DROP TABLE maintenance_logs;
          ALTER TABLE maintenance_logs_migrated RENAME TO maintenance_logs;
          COMMIT;
        `);
      } catch (err) {
        try { db.exec('ROLLBACK;'); } catch {}
        throw err;
      } finally {
        db.exec('PRAGMA foreign_keys = ON;');
      }
    }
  } catch (err: any) {
    console.warn('[PrintJobs DB] Schema migration warning:', err.message);
  }
}

export function cleanupMockData() {
  try {
    db.exec(`
      DELETE FROM print_jobs WHERE printer_id LIKE 'sim-%';
      DELETE FROM maintenance_logs WHERE printer_id LIKE 'sim-%';
      DELETE FROM printers WHERE adapter_type = 'mock' OR id LIKE 'sim-%';
      DELETE FROM users WHERE email LIKE '%@makerspace.org';
    `);
    console.log('[PrintJobs DB] Mock data successfully purged.');
  } catch (err: any) {
    console.warn('[PrintJobs DB] Mock purge notice:', err.message);
  }
}

function seedInitialData() {
  // Settings
  const getSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
  const setSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

  if (!getSetting.get('cost_per_gram_cents')) {
    setSetting.run('cost_per_gram_cents', '3'); // 0.03 €/g
  }
  if (!getSetting.get('currency')) {
    setSetting.run('currency', 'EUR');
  }
}
