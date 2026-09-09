/**
 * AirPulse Server Entry Point
 * Bootstraps database initialization, Express server, and background polling scheduler.
 */
const app = require('./src/app');
const config = require('./src/config');
const { initDatabase, closeDatabase } = require('./src/db/database');
const { startScheduler, stopScheduler } = require('./src/services/schedulerService');
const { isTokenConfigured } = require('./src/services/waqiService');

async function startServer() {
  try {
    console.log('---------------------------------------------------------');
    console.log('   AIRPULSE - Real-Time Air Quality Monitoring API       ');
    console.log('   Phase 1: Ingestion & Backend Setup                    ');
    console.log('---------------------------------------------------------');

    // 1. Initialize SQLite Database & Tables
    await initDatabase();

    // 2. Start Express HTTP Server
    const server = app.listen(config.port, () => {
      console.log(`[Server] AirPulse HTTP Server running on http://localhost:${config.port}`);
      console.log(`[Server] Live test endpoint: http://localhost:${config.port}/api/test`);
      console.log(`[Server] Single city endpoint: http://localhost:${config.port}/api/aqi/Delhi`);
      console.log(`[Server] History endpoint: http://localhost:${config.port}/api/history/Delhi`);
      console.log(`[Server] System status: http://localhost:${config.port}/api/status`);

      // 3. Check WAQI API Token status
      if (isTokenConfigured(config.waqi.token)) {
        console.log('[Auth] ✓ WAQI API token is configured.');
      } else {
        console.log('\n[Auth Warning] !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        console.log('[Auth Warning] WAQI API token is not yet configured in .env');
        console.log('[Auth Warning] Open the .env file and set: WAQI_API_TOKEN=<your_token>');
        console.log('[Auth Warning] Get a free token at: https://aqicn.org/data-platform/token/');
        console.log('[Auth Warning] !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n');
      }

      // 4. Start Background Scheduler
      startScheduler();
    });

    // Handle Graceful Shutdown
    const shutdown = async (signal) => {
      console.log(`\n[Server] Received ${signal}. Initiating graceful shutdown...`);
      stopScheduler();

      server.close(async () => {
        console.log('[Server] HTTP connections closed.');
        try {
          await closeDatabase();
        } catch (dbErr) {
          console.error('[Server] Error closing database:', dbErr);
        }
        console.log('[Server] AirPulse backend shut down cleanly.');
        process.exit(0);
      });

      // Force exit if hanging for more than 5 seconds
      setTimeout(() => {
        console.error('[Server] Forced shutdown after timeout.');
        process.exit(1);
      }, 5000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (err) {
    console.error('[Server Fatal Error] Failed to start AirPulse backend:', err);
    process.exit(1);
  }
}

startServer();
