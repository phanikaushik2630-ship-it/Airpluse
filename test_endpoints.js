/**
 * Verification Test Script for AirPulse Backend
 * Hits all Phase 1 endpoints to verify correct operation.
 */
const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function runVerification() {
  console.log('====================================================');
  console.log('   AIRPULSE PHASE 1 AUTOMATED VERIFICATION SUITE    ');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}: ${err.message}`);
      if (err.response) {
        console.error('       Response:', JSON.stringify(err.response.data));
      }
    }
  }

  // 1. Root / Sitemaps
  await test('GET / (API Sitemap)', async () => {
    const res = await axios.get(`${BASE_URL}/`);
    if (!res.data.documentation || res.data.status !== 'online') {
      throw new Error('Invalid root response');
    }
  });

  // 2. Health / Status
  await test('GET /api/status (Health & Database Status)', async () => {
    const res = await axios.get(`${BASE_URL}/api/status`);
    if (res.data.status !== 'healthy' || !res.data.database) {
      throw new Error('Health check failed');
    }
    console.log(`       Database: ${res.data.database.type}, Total Readings: ${res.data.database.totalReadings}`);
    console.log(`       Scheduler: Active=${res.data.scheduler.isActive}, Cron="${res.data.scheduler.schedule}"`);
  });

  // 3. Test Endpoint for 3 Indian Cities
  await test('GET /api/test (Live Verification for Delhi, Mumbai, Hyderabad)', async () => {
    const res = await axios.get(`${BASE_URL}/api/test`);
    if (!res.data.readings || res.data.readings.length !== 3) {
      throw new Error(`Expected 3 city readings, received: ${res.data.readings?.length}`);
    }
    for (const r of res.data.readings) {
      console.log(`       -> ${r.city}: AQI=${r.aqi} (${r.category}), PM2.5=${r.pollutants.pm25}, PM10=${r.pollutants.pm10}, NO2=${r.pollutants.no2}, Persisted=${r.persistedToSqlite}`);
      if (typeof r.aqi !== 'number' || !r.persistedToSqlite) {
        throw new Error(`Invalid telemetry for ${r.city}`);
      }
    }
  });

  // 4. Single City Endpoint (with all 6 pollutants)
  await test('GET /api/aqi/Delhi (All 6 Pollutants Inspection)', async () => {
    const res = await axios.get(`${BASE_URL}/api/aqi/Delhi`);
    const d = res.data.data;
    if (!d || d.city !== 'Delhi' || typeof d.aqi !== 'number') {
      throw new Error('Invalid single city response structure');
    }
    const p = d.pollutants;
    console.log(`       City: ${d.city}, Station: ${d.stationName}`);
    console.log(`       AQI: ${d.aqi} | Dominant: ${d.dominantPollutant}`);
    console.log(`       PM2.5: ${p.pm25.value} ${p.pm25.unit}`);
    console.log(`       PM10:  ${p.pm10.value} ${p.pm10.unit}`);
    console.log(`       NO2:   ${p.no2.value} ${p.no2.unit}`);
    console.log(`       SO2:   ${p.so2.value} ${p.so2.unit}`);
    console.log(`       CO:    ${p.co.value} ${p.co.unit}`);
    console.log(`       O3:    ${p.o3.value} ${p.o3.unit}`);
  });

  // 5. History Endpoint
  await test('GET /api/history/Delhi (Historical SQLite Records)', async () => {
    const res = await axios.get(`${BASE_URL}/api/history/Delhi?limit=10`);
    if (!res.data.success || !Array.isArray(res.data.history)) {
      throw new Error('History query failed');
    }
    console.log(`       Retrieved ${res.data.count} historical records for Delhi from SQLite.`);
    if (res.data.history.length > 0) {
      const latest = res.data.history[res.data.history.length - 1];
      console.log(`       Latest stored point: ${latest.recorded_at} (AQI: ${latest.aqi})`);
    }
  });

  // 6. Monitored Cities Endpoint
  await test('GET /api/cities (Monitored Cities Summary)', async () => {
    const res = await axios.get(`${BASE_URL}/api/cities`);
    if (!res.data.configuredCities || res.data.configuredCities.length === 0) {
      throw new Error('Cities query failed');
    }
    console.log(`       Configured Cities: ${res.data.configuredCities.join(', ')}`);
    console.log(`       Total database records: ${res.data.stats.totalReadings}`);
  });

  // 7. Error Handling: 404 on non-existent route
  await test('404 Handling on unknown route', async () => {
    try {
      await axios.get(`${BASE_URL}/api/non-existent-route`);
      throw new Error('Expected 404 but got success');
    } catch (err) {
      if (err.response && err.response.status === 404) {
        console.log(`       Correctly received 404: "${err.response.data.message}"`);
      } else {
        throw err;
      }
    }
  });

  console.log('\n====================================================');
  console.log(`VERIFICATION RESULT: ${passed}/${total} Tests Passed (${Math.round((passed/total)*100)}%)`);
  console.log('====================================================\n');
}

runVerification();
