/**
 * SQLite Database Connection & Initialization
 * Provides promisified query wrappers around sqlite3 driver.
 */
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const config = require('../config');

let dbInstance = null;

/**
 * Initializes database file and creates required tables and indexes
 * @returns {Promise<sqlite3.Database>}
 */
function initDatabase() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      return resolve(dbInstance);
    }

    const dbDir = path.dirname(config.db.filePath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    const db = new sqlite3.Database(config.db.filePath, (err) => {
      if (err) {
        console.error(`[DB Error] Failed to open SQLite database at ${config.db.filePath}:`, err.message);
        return reject(err);
      }

      console.log(`[DB] Connected to SQLite database at: ${config.db.filePath}`);

      // Enable WAL mode for better concurrent read/write performance
      db.run('PRAGMA journal_mode = WAL;');

      // Create air_quality_readings table
      const createTableSql = `
        CREATE TABLE IF NOT EXISTS air_quality_readings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          city TEXT NOT NULL,
          station_name TEXT,
          aqi INTEGER,
          pm25 REAL,
          pm10 REAL,
          no2 REAL,
          so2 REAL,
          co REAL,
          o3 REAL,
          dominant_pollutant TEXT,
          latitude REAL,
          longitude REAL,
          recorded_at TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          raw_json TEXT,
          UNIQUE(city, recorded_at) ON CONFLICT REPLACE
        );
      `;

      db.run(createTableSql, (err) => {
        if (err) {
          console.error('[DB Error] Failed to create air_quality_readings table:', err.message);
          return reject(err);
        }

        // Create indexes for fast lookup and time-series charting
        const createIndexesSql = `
          CREATE INDEX IF NOT EXISTS idx_readings_city_time 
          ON air_quality_readings(city, recorded_at DESC);

          CREATE INDEX IF NOT EXISTS idx_readings_created 
          ON air_quality_readings(created_at DESC);
        `;

        db.exec(createIndexesSql, (indexErr) => {
          if (indexErr) {
            console.error('[DB Error] Failed to create indexes:', indexErr.message);
            return reject(indexErr);
          }

          // ── Phase 3: Alert Log table ────────────────────────────────────
          // Stores every threshold-breach event so users can review a
          // timeline of when cities crossed their personal AQI limits.
          const createAlertLogSql = `
            CREATE TABLE IF NOT EXISTS alert_log (
              id             INTEGER PRIMARY KEY AUTOINCREMENT,
              city           TEXT    NOT NULL,
              threshold      INTEGER NOT NULL,
              aqi_at_trigger INTEGER NOT NULL,
              pollutant      TEXT,
              message        TEXT,
              triggered_at   DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_alert_log_city_time
            ON alert_log(city, triggered_at DESC);
          `;

          db.exec(createAlertLogSql, (alertErr) => {
            if (alertErr) {
              console.error('[DB Error] Failed to create alert_log table:', alertErr.message);
              return reject(alertErr);
            }

            console.log('[DB] air_quality_readings schema and indexes verified.');
            console.log('[DB] alert_log table verified.');
            dbInstance = db;
            resolve(db);
          });
        });
      });
    });
  });
}

/**
 * Execute SQL statement with parameters (INSERT, UPDATE, DELETE)
 * @param {string} sql
 * @param {Array} params
 * @returns {Promise<{ lastID: number, changes: number }>}
 */
function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!dbInstance) {
      return reject(new Error('Database not initialized. Call initDatabase() first.'));
    }
    dbInstance.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

/**
 * Fetch a single row
 * @param {string} sql
 * @param {Array} params
 * @returns {Promise<object|null>}
 */
function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!dbInstance) {
      return reject(new Error('Database not initialized. Call initDatabase() first.'));
    }
    dbInstance.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

/**
 * Fetch all matching rows
 * @param {string} sql
 * @param {Array} params
 * @returns {Promise<Array<object>>}
 */
function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!dbInstance) {
      return reject(new Error('Database not initialized. Call initDatabase() first.'));
    }
    dbInstance.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

/**
 * Close the database connection gracefully
 */
function closeDatabase() {
  return new Promise((resolve, reject) => {
    if (!dbInstance) return resolve();
    dbInstance.close((err) => {
      if (err) return reject(err);
      dbInstance = null;
      console.log('[DB] SQLite connection closed.');
      resolve();
    });
  });
}

module.exports = {
  initDatabase,
  runAsync,
  getAsync,
  allAsync,
  closeDatabase,
  getDbInstance: () => dbInstance,
};
