/**
 * Forecast & Alert Controller — Phase 3
 * Handles forecast computation, alert threshold evaluation, and alert history retrieval.
 */
'use strict';

const { generateForecast }             = require('../services/forecastService');
const { saveAlertLog, getAlertHistory } = require('../db/readingsRepository');

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/forecast/:city
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a 12-hour AQI forecast for the given city computed via weighted
 * linear regression over its stored historical readings.
 *
 * Response fields explained (useful for viva):
 *   slope     — AQI units per hour (positive = rising, negative = falling)
 *   rSquared  — goodness-of-fit (0–1); higher means the line explains more variance
 *   confidenceInterval — ±σ of residuals; the expected error of each forecast point
 *   trend     — human label: 'worsening' | 'slightly_worsening' | 'stable' | etc.
 *   forecastPoints — array of {time, aqi, hoursAhead, lowerBound, upperBound}
 */
async function getCityForecast(req, res, next) {
  try {
    const { city } = req.params;

    if (!city || !city.trim()) {
      return res.status(400).json({
        error: true,
        code: 'INVALID_CITY',
        message: 'A valid city name is required.',
      });
    }

    const forecast = await generateForecast(city.trim());

    return res.status(200).json({
      success: true,
      ...forecast,
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/alerts/evaluate
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluates whether a city's AQI has crossed a user-defined threshold.
 * If triggered, persists an alert event to the `alert_log` table.
 *
 * Request body: { city, aqi, threshold, pollutant? }
 * Response:     { triggered: boolean, city, aqi, threshold }
 */
async function evaluateAlert(req, res, next) {
  try {
    const { city, aqi, threshold, pollutant } = req.body || {};

    if (!city || aqi === undefined || aqi === null || threshold === undefined) {
      return res.status(400).json({
        error: true,
        code: 'MISSING_PARAMS',
        message: '`city`, `aqi`, and `threshold` are all required in the request body.',
      });
    }

    const numericAqi       = Math.round(Number(aqi));
    const numericThreshold = Math.round(Number(threshold));

    if (isNaN(numericAqi) || isNaN(numericThreshold)) {
      return res.status(400).json({
        error: true,
        code: 'INVALID_PARAMS',
        message: '`aqi` and `threshold` must be numeric values.',
      });
    }

    const triggered = numericAqi >= numericThreshold;

    // Persist to database only when an alert actually fires
    let savedId = null;
    if (triggered) {
      const record = await saveAlertLog({
        city:         city.trim(),
        threshold:    numericThreshold,
        aqiAtTrigger: numericAqi,
        pollutant:    pollutant || null,
        message:      `AQI ${numericAqi} crossed threshold ${numericThreshold} in ${city}`,
      });
      savedId = record?.id ?? null;
      console.log(`[Alert] ⚠ Threshold breach logged → ${city}: AQI ${numericAqi} ≥ ${numericThreshold} (DB id=${savedId})`);
    }

    return res.status(200).json({
      success:   true,
      triggered,
      city:      city.trim(),
      aqi:       numericAqi,
      threshold: numericThreshold,
      loggedId:  savedId,
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/alerts/history
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the stored alert history from the `alert_log` table.
 * Optional query params:
 *   ?city=Delhi     — filter by city
 *   ?limit=50       — max records (default 50, max 200)
 */
async function getAlertHistoryHandler(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const city  = req.query.city ? req.query.city.trim() : null;

    const history = await getAlertHistory(city, limit);

    return res.status(200).json({
      success: true,
      count:   history.length,
      city:    city || 'all',
      history,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getCityForecast,
  evaluateAlert,
  getAlertHistoryHandler,
};
