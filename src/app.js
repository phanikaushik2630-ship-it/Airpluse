/**
 * Express Application Setup
 * Configures middleware, API routes, request logging, and error handling.
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const aqiRoutes = require('./routes/aqiRoutes');

const app = express();

// Enable Cross-Origin Resource Sharing (for Phase 2 frontend integration)
app.use(cors());

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Lightweight request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Mount Air Quality API routes
app.use('/api', aqiRoutes);

// API Documentation & Sitemap Route
app.get('/api', (req, res) => {
  res.json({
    app: 'AirPulse Real-Time Air Quality Monitoring API',
    phase: 'Phase 2 - Live Dashboard & Ingestion Engine',
    status: 'online',
    documentation: {
      liveTestEndpoint: {
        method: 'GET',
        path: '/api/test',
        description: 'Hits WAQI API for Delhi, Mumbai, and Hyderabad, persists to SQLite, and returns live status.',
      },
      cityAqiEndpoint: {
        method: 'GET',
        path: '/api/aqi/:city',
        description: 'Fetches live AQI, PM2.5, PM10, NO2, SO2, CO, and O3 for any city (e.g., /api/aqi/Delhi).',
      },
      historicalTrendsEndpoint: {
        method: 'GET',
        path: '/api/history/:city?limit=50',
        description: 'Returns chronological historical readings from SQLite for trend line charts.',
      },
      monitoredCitiesEndpoint: {
        method: 'GET',
        path: '/api/cities',
        description: 'Lists all monitored cities with their latest stored atmospheric telemetry.',
      },
      manualPollTrigger: {
        method: 'POST',
        path: '/api/poll',
        description: 'Forces an immediate background ingestion cycle across all monitored cities.',
      },
      systemStatus: {
        method: 'GET',
        path: '/api/status',
        description: 'Returns server health, database record counts, and scheduler status.',
      },
    },
  });
});

// Serve compiled React frontend if client/dist exists
const clientDistPath = path.resolve(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  console.log(`[Static] Serving React frontend dashboard from: ${clientDistPath}`);
  app.use(express.static(clientDistPath));

  // SPA fallback for all GET requests outside /api
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(clientDistPath, 'index.html'));
    }
    next();
  });
} else {
  // Fallback to API directory if client is not yet built
  app.get('/', (req, res) => {
    res.redirect('/api');
  });
}

// Catch-all 404 Handler for undefined API routes
app.use((req, res) => {
  res.status(404).json({
    error: 'Route Not Found',
    path: req.originalUrl,
    method: req.method,
    message: 'The requested API endpoint does not exist. Visit GET /api for the API sitemap.',
  });
});

// Global Centralized Error Handler
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_SERVER_ERROR';

  console.error(`[Error] [${errorCode}] ${err.message || 'Unknown server error'}`);
  if (err.details) {
    console.error('[Error Details]', err.details);
  }

  res.status(statusCode).json({
    error: true,
    code: errorCode,
    message: err.message || 'An unexpected error occurred processing your request.',
    details: err.details || undefined,
    helpUrl: err.helpUrl || undefined,
    timestamp: new Date().toISOString(),
  });
});

module.exports = app;
