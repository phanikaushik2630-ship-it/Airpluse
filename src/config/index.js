/**
 * Centralized Application Configuration
 * Loads environment variables from .env and provides sensible defaults
 */
const path = require('path');
const dotenv = require('dotenv');

// Load .env file from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  // Server Port
  port: parseInt(process.env.PORT, 10) || 5000,

  // Environment mode
  env: process.env.NODE_ENV || 'development',

  // WAQI API Configuration
  waqi: {
    baseUrl: 'https://api.waqi.info',
    // Token supplied via environment variable or passed dynamically
    token: process.env.WAQI_API_TOKEN || '',
    // Timeout for outgoing API requests (in milliseconds)
    timeoutMs: 12000,
  },

  // Configurable list of cities to monitor and poll
  monitoredCities: (process.env.MONITORED_CITIES || 'Delhi,Mumbai,Hyderabad,Bengaluru,Kolkata,Chennai')
    .split(',')
    .map(city => city.trim())
    .filter(Boolean),

  // Scheduled polling settings
  polling: {
    // Default cron schedule (every 15 minutes: "*/15 * * * *")
    cronSchedule: process.env.POLL_INTERVAL_CRON || '*/15 * * * *',
    // Whether automatic background polling is enabled
    enabled: process.env.AUTO_POLL_ENABLED !== 'false',
  },

  // SQLite Database path
  db: {
    filePath: process.env.DB_PATH 
      ? path.resolve(process.cwd(), process.env.DB_PATH) 
      : path.resolve(__dirname, '../../data/airpulse.sqlite'),
  }
};

module.exports = config;
