/**
 * Air Quality API Routes
 * Mounts all air quality telemetry, testing, forecast and alert endpoints.
 */
const express = require('express');
const router = express.Router();
const aqiController      = require('../controllers/aqiController');
const forecastController = require('../controllers/forecastController');

// 1. Live test endpoint for 3 Indian cities (Delhi, Mumbai, Hyderabad)
router.get('/test', aqiController.getTestCities);

// 2. Fetch live AQI & pollutant metrics for a specific city
router.get('/aqi/:city', aqiController.getCityAQI);

// 3. Fetch historical readings for a specific city to display trends
router.get('/history/:city', aqiController.getCityHistory);

// 4. Retrieve all monitored cities with their latest status
router.get('/cities', aqiController.getMonitoredCities);

// 5. Manually trigger a background polling cycle
router.post('/poll', aqiController.triggerManualPoll);

// 6. System and database health status
router.get('/status', aqiController.getSystemStatus);

// ── Phase 3: Forecast & Alert Routes ─────────────────────────────────────────

// 7. Get 12-hour AQI forecast for a city (weighted linear regression)
router.get('/forecast/:city', forecastController.getCityForecast);

// 8. Evaluate if a city's AQI has crossed a threshold and log to DB if so
router.post('/alerts/evaluate', forecastController.evaluateAlert);

// 9. Retrieve the full alert history log from SQLite
router.get('/alerts/history', forecastController.getAlertHistoryHandler);

module.exports = router;

