/**
 * Scheduler Service
 * Periodically polls the WAQI API for configured cities and persists readings into SQLite.
 */
const cron = require('node-cron');
const config = require('../config');
const { fetchCityAQI, isTokenConfigured } = require('./waqiService');
const { saveReading } = require('../db/readingsRepository');

let cronTask = null;
let isPollingInProgress = false;

// Polling status tracking
const pollingStatus = {
  lastRunAt: null,
  lastRunSuccess: null,
  totalCycles: 0,
  lastResults: [],
};

/**
 * Utility helper to sleep for a specified number of milliseconds
 * @param {number} ms
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Executes a full poll cycle for all configured cities
 * @param {object} [options] - Optional settings
 * @param {boolean} [options.allowFallback] - Whether to allow simulated data if token is pending
 * @returns {Promise<object>} Summary of the polling operation
 */
async function pollAllCities(options = {}) {
  const { allowFallback = false } = options;

  if (isPollingInProgress) {
    console.log('[Scheduler] A polling cycle is already in progress. Skipping.');
    return {
      status: 'skipped',
      message: 'A poll cycle is already actively executing.',
      timestamp: new Date().toISOString(),
    };
  }

  const tokenConfigured = isTokenConfigured(config.waqi.token);
  if (!tokenConfigured && !allowFallback) {
    console.warn('[Scheduler] Skipping poll cycle: WAQI_API_TOKEN is not set or using placeholder.');
    return {
      status: 'failed',
      message: 'WAQI_API_TOKEN is not configured in .env. Provide your token or pass ?fallback=true to test with simulated data.',
      timestamp: new Date().toISOString(),
    };
  }

  isPollingInProgress = true;
  const startTime = Date.now();
  const cities = config.monitoredCities;
  const results = [];

  console.log(`[Scheduler] Starting poll cycle for ${cities.length} cities (LiveToken=${tokenConfigured}, Fallback=${allowFallback}) at ${new Date().toISOString()}...`);

  for (const city of cities) {
    try {
      console.log(`[Scheduler] Fetching telemetry for ${city}...`);
      const telemetry = await fetchCityAQI(city, { allowFallback });

      // Save into SQLite database
      const saved = await saveReading({
        city: telemetry.city,
        stationName: telemetry.stationName,
        aqi: telemetry.aqi,
        pollutants: telemetry.rawPollutants,
        dominantPollutant: telemetry.dominantPollutant,
        coordinates: telemetry.coordinates,
        recordedAt: telemetry.recordedAt,
        rawJson: telemetry,
      });

      console.log(`[Scheduler] ✓ Saved reading for ${city} (AQI: ${telemetry.aqi}, Status: ${telemetry.category})`);
      results.push({
        city,
        status: 'success',
        aqi: telemetry.aqi,
        category: telemetry.category,
        recordId: saved.id,
      });

    } catch (err) {
      console.error(`[Scheduler] ✗ Failed to fetch/store data for ${city}:`, err.message || err);
      results.push({
        city,
        status: 'error',
        error: err.message || 'Unknown error occurred',
        code: err.code || 'POLL_ERROR',
      });
    }

    // Small delay between calls to be polite to the WAQI API rate limit
    await sleep(800);
  }

  const durationMs = Date.now() - startTime;
  isPollingInProgress = false;

  // Update status summary
  pollingStatus.lastRunAt = new Date().toISOString();
  pollingStatus.lastRunSuccess = results.some(r => r.status === 'success');
  pollingStatus.totalCycles += 1;
  pollingStatus.lastResults = results;

  console.log(`[Scheduler] Completed poll cycle in ${durationMs}ms. Success: ${results.filter(r => r.status === 'success').length}/${cities.length}`);

  return {
    status: 'completed',
    timestamp: pollingStatus.lastRunAt,
    durationMs,
    totalCities: cities.length,
    successful: results.filter(r => r.status === 'success').length,
    failed: results.filter(r => r.status === 'error').length,
    results,
  };
}

/**
 * Initialize and start the background scheduler
 */
function startScheduler() {
  if (!config.polling.enabled) {
    console.log('[Scheduler] Background polling is disabled by configuration (AUTO_POLL_ENABLED=false).');
    return;
  }

  if (cronTask) {
    console.log('[Scheduler] Scheduler is already active.');
    return;
  }

  console.log(`[Scheduler] Initializing cron job with schedule: "${config.polling.cronSchedule}"`);

  // Validate cron expression
  if (!cron.validate(config.polling.cronSchedule)) {
    console.error(`[Scheduler] Invalid cron expression: "${config.polling.cronSchedule}". Polling scheduler not started.`);
    return;
  }

  cronTask = cron.schedule(config.polling.cronSchedule, async () => {
    try {
      await pollAllCities();
    } catch (err) {
      console.error('[Scheduler] Unhandled error during scheduled poll cycle:', err);
    }
  });

  console.log('[Scheduler] Background air quality ingestion scheduler started successfully.');
}

/**
 * Stop the background scheduler
 */
function stopScheduler() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    console.log('[Scheduler] Background scheduler stopped.');
  }
}

/**
 * Get current scheduler health and status
 */
function getSchedulerStatus() {
  return {
    isActive: Boolean(cronTask),
    schedule: config.polling.cronSchedule,
    monitoredCities: config.monitoredCities,
    isPollingInProgress,
    ...pollingStatus,
  };
}

module.exports = {
  startScheduler,
  stopScheduler,
  pollAllCities,
  getSchedulerStatus,
};
