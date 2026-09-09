/**
 * Air Quality Readings Repository
 * Handles all SQLite queries and transactions for storing and fetching AQI records.
 */
const { runAsync, getAsync, allAsync } = require('./database');

/**
 * Save a newly ingested reading into SQLite.
 * Uses ON CONFLICT REPLACE on (city, recorded_at) to prevent duplicate timestamps.
 * 
 * @param {object} reading
 * @returns {Promise<object>} Saved reading record ID and details
 */
async function saveReading(reading) {
  const sql = `
    INSERT INTO air_quality_readings (
      city,
      station_name,
      aqi,
      pm25,
      pm10,
      no2,
      so2,
      co,
      o3,
      dominant_pollutant,
      latitude,
      longitude,
      recorded_at,
      raw_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    reading.city,
    reading.stationName || null,
    reading.aqi !== undefined ? reading.aqi : null,
    reading.pollutants?.pm25 ?? null,
    reading.pollutants?.pm10 ?? null,
    reading.pollutants?.no2 ?? null,
    reading.pollutants?.so2 ?? null,
    reading.pollutants?.co ?? null,
    reading.pollutants?.o3 ?? null,
    reading.dominantPollutant || null,
    reading.coordinates?.lat ?? null,
    reading.coordinates?.lng ?? null,
    reading.recordedAt || new Date().toISOString(),
    reading.rawJson ? JSON.stringify(reading.rawJson) : null,
  ];

  const result = await runAsync(sql, params);
  return {
    id: result.lastID,
    city: reading.city,
    aqi: reading.aqi,
    recordedAt: reading.recordedAt,
  };
}

/**
 * Retrieve the latest reading for a specific city
 * @param {string} city
 * @returns {Promise<object|null>}
 */
async function getLatestReadingByCity(city) {
  const sql = `
    SELECT * FROM air_quality_readings
    WHERE LOWER(city) = LOWER(?)
    ORDER BY recorded_at DESC, id DESC
    LIMIT 1
  `;
  return await getAsync(sql, [city]);
}

/**
 * Retrieve historical readings for a given city to display trends
 * @param {string} city - Target city
 * @param {number} limit - Maximum number of data points (default: 50)
 * @returns {Promise<Array<object>>}
 */
async function getHistoricalReadings(city, limit = 50) {
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);
  const sql = `
    SELECT 
      id,
      city,
      station_name,
      aqi,
      pm25,
      pm10,
      no2,
      so2,
      co,
      o3,
      dominant_pollutant,
      latitude,
      longitude,
      recorded_at,
      created_at
    FROM air_quality_readings
    WHERE LOWER(city) = LOWER(?)
    ORDER BY recorded_at DESC
    LIMIT ?
  `;
  
  const rows = await allAsync(sql, [city, parsedLimit]);
  // Return in chronological order (oldest to newest) for trend line charts
  return rows.reverse();
}

/**
 * Retrieve the most recent reading for all cities in the database
 * @returns {Promise<Array<object>>}
 */
async function getAllLatestReadings() {
  const sql = `
    SELECT r.*
    FROM air_quality_readings r
    INNER JOIN (
      SELECT city, MAX(recorded_at) as max_recorded_at
      FROM air_quality_readings
      GROUP BY city
    ) latest ON r.city = latest.city AND r.recorded_at = latest.max_recorded_at
    ORDER BY r.aqi DESC
  `;
  return await allAsync(sql);
}

/**
 * Get total count of stored records and unique cities
 * @returns {Promise<{ totalReadings: number, totalCities: number }>}
 */
async function getDatabaseStats() {
  const countSql = `SELECT COUNT(*) as total FROM air_quality_readings`;
  const citiesSql = `SELECT COUNT(DISTINCT city) as totalCities FROM air_quality_readings`;
  
  const countRow = await getAsync(countSql);
  const citiesRow = await getAsync(citiesSql);

  return {
    totalReadings: countRow?.total || 0,
    totalCities: citiesRow?.totalCities || 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 — Alert Log Queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Persist a threshold-breach event to the alert_log table.
 * Called by the forecast controller whenever AQI ≥ user threshold.
 *
 * @param {{ city, threshold, aqiAtTrigger, pollutant?, message? }} record
 * @returns {Promise<{ id: number }>}
 */
async function saveAlertLog({ city, threshold, aqiAtTrigger, pollutant = null, message = null }) {
  const sql = `
    INSERT INTO alert_log (city, threshold, aqi_at_trigger, pollutant, message)
    VALUES (?, ?, ?, ?, ?)
  `;
  const result = await runAsync(sql, [city, threshold, aqiAtTrigger, pollutant, message]);
  return { id: result.lastID };
}

/**
 * Retrieve alert history, optionally filtered by city.
 *
 * @param {string|null} city   - City filter; pass null for all cities
 * @param {number}      limit  - Maximum records to return (default 50)
 * @returns {Promise<Array<object>>}
 */
async function getAlertHistory(city = null, limit = 50) {
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);

  if (city) {
    const sql = `
      SELECT id, city, threshold, aqi_at_trigger, pollutant, message, triggered_at
      FROM alert_log
      WHERE LOWER(city) = LOWER(?)
      ORDER BY triggered_at DESC
      LIMIT ?
    `;
    return await allAsync(sql, [city, parsedLimit]);
  }

  const sql = `
    SELECT id, city, threshold, aqi_at_trigger, pollutant, message, triggered_at
    FROM alert_log
    ORDER BY triggered_at DESC
    LIMIT ?
  `;
  return await allAsync(sql, [parsedLimit]);
}

module.exports = {
  saveReading,
  getLatestReadingByCity,
  getHistoricalReadings,
  getAllLatestReadings,
  getDatabaseStats,
  saveAlertLog,
  getAlertHistory,
};
