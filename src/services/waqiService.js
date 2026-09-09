/**
 * WAQI (World Air Quality Index) API Service
 * Fetches live atmospheric telemetry for specified cities and normalizes pollutant data.
 */
const axios = require('axios');
const config = require('../config');
const { getAQICategory, POLLUTANT_METADATA } = require('../config/aqiStandards');

/**
 * Validate whether an API token has been configured
 * @param {string} token
 * @returns {boolean}
 */
function isTokenConfigured(token) {
  return Boolean(
    token && 
    token !== 'your_waqi_api_token_here' && 
    token.trim().length > 0 &&
    token !== 'demo'
  );
}

/**
 * Generates realistic fallback telemetry for known Indian cities
 * Used only when WAQI_API_TOKEN is not yet set by the user.
 */
function getSimulatedCityTelemetry(city) {
  const cityKey = city.toLowerCase().trim();
  const presets = {
    delhi: {
      station: 'Anand Vihar, New Delhi - DPCC',
      geo: [28.6508, 77.3152],
      aqi: 215,
      dominant: 'pm25',
      pm25: 215.4,
      pm10: 168.2,
      no2: 44.8,
      so2: 14.2,
      co: 28.5,
      o3: 31.0,
    },
    mumbai: {
      station: 'Bandra Kurla Complex, Mumbai - MPCB',
      geo: [19.0688, 72.8685],
      aqi: 128,
      dominant: 'pm10',
      pm25: 72.6,
      pm10: 128.0,
      no2: 26.4,
      so2: 9.8,
      co: 15.2,
      o3: 21.5,
    },
    hyderabad: {
      station: 'Sanathnagar, Hyderabad - TSPCB',
      geo: [17.4575, 78.4411],
      aqi: 94,
      dominant: 'pm25',
      pm25: 94.0,
      pm10: 82.5,
      no2: 18.2,
      so2: 6.4,
      co: 11.0,
      o3: 16.3,
    },
    bengaluru: {
      station: 'BTM Layout, Bengaluru - KSPCB',
      geo: [12.9165, 77.6101],
      aqi: 65,
      dominant: 'pm25',
      pm25: 65.0,
      pm10: 58.2,
      no2: 14.5,
      so2: 4.8,
      co: 8.5,
      o3: 19.2,
    },
    kolkata: {
      station: 'Victoria Memorial, Kolkata - WBPCB',
      geo: [22.5448, 88.3426],
      aqi: 156,
      dominant: 'pm25',
      pm25: 156.2,
      pm10: 118.0,
      no2: 38.6,
      so2: 11.4,
      co: 22.0,
      o3: 27.8,
    },
    chennai: {
      station: 'Alandur, Chennai - CPCB',
      geo: [13.0034, 80.2014],
      aqi: 82,
      dominant: 'pm10',
      pm25: 54.0,
      pm10: 82.0,
      no2: 16.8,
      so2: 5.2,
      co: 9.4,
      o3: 18.0,
    }
  };

  const p = presets[cityKey] || {
    station: `${city} Central Monitoring Station`,
    geo: [20.5937, 78.9629],
    aqi: 110,
    dominant: 'pm25',
    pm25: 110,
    pm10: 95,
    no2: 25,
    so2: 8,
    co: 12,
    o3: 20,
  };

  return normalizeWaqiData(city, {
    aqi: p.aqi,
    dominentpol: p.dominant,
    city: {
      name: p.station,
      geo: p.geo,
    },
    iaqi: {
      pm25: { v: p.pm25 },
      pm10: { v: p.pm10 },
      no2:  { v: p.no2 },
      so2:  { v: p.so2 },
      co:   { v: p.co },
      o3:   { v: p.o3 },
    },
    time: {
      iso: new Date().toISOString(),
    },
    attributions: [
      { name: 'Simulated Local Station (Provide WAQI_API_TOKEN in .env for live API)' }
    ],
  });
}

/**
 * Normalizes the raw WAQI API JSON response into a clean AirPulse data contract
 * @param {string} queryCity - City name originally queried
 * @param {object} rawData - Data payload from WAQI
 * @returns {object} Normalized air quality data object
 */
function normalizeWaqiData(queryCity, rawData) {
  const iaqi = rawData.iaqi || {};
  const aqiValue = typeof rawData.aqi === 'number' ? rawData.aqi : null;
  const categoryInfo = getAQICategory(aqiValue);

  // Extract individual pollutants (PM2.5, PM10, NO2, SO2, CO, O3)
  const extractPollutant = (key) => {
    const val = iaqi[key]?.v;
    return typeof val === 'number' ? Math.round(val * 10) / 10 : null;
  };

  const pollutants = {
    pm25: extractPollutant('pm25'),
    pm10: extractPollutant('pm10'),
    no2: extractPollutant('no2'),
    so2: extractPollutant('so2'),
    co: extractPollutant('co'),
    o3: extractPollutant('o3'),
  };

  // Extract coordinates (WAQI gives geo as [lat, lng])
  const geo = Array.isArray(rawData.city?.geo) ? rawData.city.geo : [];
  const coordinates = {
    lat: geo.length >= 2 ? geo[0] : null,
    lng: geo.length >= 2 ? geo[1] : null,
  };

  // Normalize recorded timestamp
  const recordedAt = rawData.time?.iso 
    || rawData.time?.s 
    || new Date().toISOString();

  return {
    city: queryCity,
    stationName: rawData.city?.name || `${queryCity} Monitoring Station`,
    aqi: aqiValue,
    category: categoryInfo.level,
    categoryCode: categoryInfo.category,
    colorCode: categoryInfo.color,
    healthAdvice: categoryInfo.description,
    dominantPollutant: rawData.dominentpol || 'unknown',
    pollutants: {
      pm25: { value: pollutants.pm25, ...POLLUTANT_METADATA.pm25 },
      pm10: { value: pollutants.pm10, ...POLLUTANT_METADATA.pm10 },
      no2:  { value: pollutants.no2,  ...POLLUTANT_METADATA.no2 },
      so2:  { value: pollutants.so2,  ...POLLUTANT_METADATA.so2 },
      co:   { value: pollutants.co,   ...POLLUTANT_METADATA.co },
      o3:   { value: pollutants.o3,   ...POLLUTANT_METADATA.o3 },
    },
    // Raw numeric values for database storage
    rawPollutants: pollutants,
    coordinates,
    recordedAt,
    attributions: rawData.attributions || [],
  };
}

/**
 * Fetch real-time air quality metrics for a given city from WAQI API
 * @param {string} city - Name of the city (e.g., 'Delhi', 'Mumbai', 'Hyderabad')
 * @param {object} [options] - Optional settings
 * @param {string} [options.customToken] - Custom WAQI token override
 * @param {boolean} [options.allowFallback] - Whether to allow simulated data if token is not yet set
 * @returns {Promise<object>} Normalized telemetry reading
 */
async function fetchCityAQI(city, options = {}) {
  const { customToken = null, allowFallback = false } = options;

  if (!city || typeof city !== 'string' || !city.trim()) {
    throw {
      statusCode: 400,
      code: 'INVALID_CITY_PARAM',
      message: 'A valid city name must be provided.',
    };
  }

  const cleanCity = city.trim();
  const token = customToken || config.waqi.token;

  if (!isTokenConfigured(token)) {
    if (allowFallback) {
      const simulated = getSimulatedCityTelemetry(cleanCity);
      return {
        ...simulated,
        isSimulated: true,
        notice: 'Displaying simulated telemetry because WAQI_API_TOKEN is not yet configured in .env. Set your token in .env for live API feeds.',
      };
    }

    throw {
      statusCode: 401,
      code: 'TOKEN_NOT_CONFIGURED',
      message: 'WAQI API token is not configured. Please set WAQI_API_TOKEN in your .env file.',
      helpUrl: 'https://aqicn.org/data-platform/token/',
    };
  }

  const url = `${config.waqi.baseUrl}/feed/${encodeURIComponent(cleanCity)}/?token=${token}`;

  try {
    const response = await axios.get(url, {
      timeout: config.waqi.timeoutMs,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AirPulse-Monitoring-App/1.0',
      },
    });

    const body = response.data;

    // Check WAQI status field
    if (body.status !== 'ok') {
      const errorMsg = typeof body.data === 'string' ? body.data : 'WAQI API returned an error status.';
      
      // Handle known WAQI error responses
      if (errorMsg.toLowerCase().includes('invalid key') || errorMsg.toLowerCase().includes('token')) {
        throw {
          statusCode: 401,
          code: 'INVALID_TOKEN',
          message: 'The WAQI API token is invalid or expired. Please verify your token in .env.',
          details: errorMsg,
        };
      }

      if (errorMsg.toLowerCase().includes('unknown station') || errorMsg.toLowerCase().includes('not found')) {
        throw {
          statusCode: 404,
          code: 'CITY_NOT_FOUND',
          message: `No active monitoring station found for "${cleanCity}". Try a nearby city or specific station name.`,
          details: errorMsg,
        };
      }

      if (errorMsg.toLowerCase().includes('over quota') || errorMsg.toLowerCase().includes('limit')) {
        throw {
          statusCode: 429,
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'WAQI API rate limit exceeded. Please wait a few minutes before trying again.',
          details: errorMsg,
        };
      }

      throw {
        statusCode: 502,
        code: 'UPSTREAM_API_ERROR',
        message: `WAQI API returned error: ${errorMsg}`,
        details: body,
      };
    }

    if (!body.data) {
      throw {
        statusCode: 502,
        code: 'EMPTY_RESPONSE',
        message: 'WAQI API returned an empty payload.',
      };
    }

    // Successfully received data; normalize it
    return normalizeWaqiData(cleanCity, body.data);

  } catch (err) {
    // If it's already an application error object with statusCode, rethrow it
    if (err.statusCode) {
      throw err;
    }

    // Handle Axios connection/timeout errors
    if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
      throw {
        statusCode: 504,
        code: 'GATEWAY_TIMEOUT',
        message: `Connection to WAQI API timed out after ${config.waqi.timeoutMs}ms.`,
      };
    }

    if (err.response) {
      // Upstream HTTP status >= 400
      throw {
        statusCode: err.response.status === 429 ? 429 : 502,
        code: err.response.status === 429 ? 'RATE_LIMIT_EXCEEDED' : 'UPSTREAM_HTTP_ERROR',
        message: `WAQI API responded with HTTP status ${err.response.status}`,
        details: err.response.data,
      };
    }

    // Generic network/connectivity failure
    throw {
      statusCode: 503,
      code: 'NETWORK_ERROR',
      message: `Failed to connect to WAQI API: ${err.message}`,
    };
  }
}

module.exports = {
  fetchCityAQI,
  isTokenConfigured,
  normalizeWaqiData,
  getSimulatedCityTelemetry,
};
