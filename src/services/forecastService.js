/**
 * AQI Forecast Service — Phase 3
 *
 * Algorithm (fully explainable for viva/interview):
 * ─────────────────────────────────────────────────
 * 1. Load the last N AQI readings for a city from SQLite (chronological order).
 * 2. Convert each timestamp to X = hours elapsed since the oldest reading.
 *    This gives us a 2D dataset: [(x0,y0), (x1,y1), …] where y = AQI.
 * 3. Assign increasing weights: w_i = i+1 so that the most recent reading
 *    counts N times more than the oldest one. This prevents stale data from
 *    dominating the trend line.
 * 4. Solve the Weighted Least-Squares formula to get the best-fit line:
 *      AQI = slope × hours + intercept
 *    The slope tells us: "the AQI is rising/falling by X units per hour."
 * 5. Plug future hour values (now+2h, +4h, … +12h) into the line equation
 *    to produce 6 projected data points.
 * 6. Compute σ = RMS of residuals (how wrong we were on historical data).
 *    Report ±σ as the confidence interval around each forecast point.
 *
 * Why this model?
 * • Zero dependencies — pure arithmetic, no npm packages needed.
 * • Runs in <1ms on any hardware.
 * • Transparent: every coefficient has a simple physical meaning.
 * • Handles sparse data gracefully (falls back if < 3 points).
 */

'use strict';

const { getHistoricalReadings } = require('../db/readingsRepository');

const FORECAST_HORIZON_HOURS = 12;   // How far ahead to project
const FORECAST_STEP_HOURS    = 2;    // Gap between forecast points
const MIN_POINTS_REQUIRED    = 3;    // Minimum readings to compute a meaningful line

// ─────────────────────────────────────────────────────────────────────────────
// Core Math
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Weighted Ordinary Least-Squares (OLS) linear regression.
 *
 * Given N points each with a weight, finds the line y = slope·x + intercept
 * that minimises the weighted squared error Σ w_i·(y_i − ŷ_i)².
 *
 * Closed-form formulas (no iterative optimisation needed):
 *   slope     = (Σw·Σwxy − Σwx·Σwy)  /  (Σw·Σwx² − Σwx²)
 *   intercept = (Σwy − slope·Σwx)    /  Σw
 *
 * @param {Array<{x: number, y: number, w: number}>} pts
 * @returns {{ slope: number, intercept: number, rSquared: number, sigma: number }}
 */
function weightedLinearRegression(pts) {
  const n = pts.length;

  // Edge cases
  if (n === 0) return { slope: 0, intercept: 0, rSquared: 0, sigma: 0 };
  if (n === 1) return { slope: 0, intercept: pts[0].y, rSquared: 1, sigma: 0 };

  // Accumulate weighted sums
  let Sw = 0, Swx = 0, Swy = 0, Swx2 = 0, Swxy = 0;
  for (const { x, y, w } of pts) {
    Sw   += w;
    Swx  += w * x;
    Swy  += w * y;
    Swx2 += w * x * x;
    Swxy += w * x * y;
  }

  const denom = Sw * Swx2 - Swx * Swx;

  // Degenerate: all x values are identical → flat line at the mean
  if (Math.abs(denom) < 1e-10) {
    return { slope: 0, intercept: Swy / Sw, rSquared: 0, sigma: 0 };
  }

  const slope     = (Sw * Swxy - Swx * Swy) / denom;
  const intercept = (Swy - slope * Swx) / Sw;

  // ── Goodness-of-fit metrics ──────────────────────────────────────────────
  const yMean = Swy / Sw;
  let ssTot = 0, ssRes = 0;

  for (const { x, y, w } of pts) {
    const predicted = slope * x + intercept;
    ssTot += w * (y - yMean) ** 2;
    ssRes += w * (y - predicted) ** 2;
  }

  // R²: fraction of variance explained by the line (0 = noise, 1 = perfect fit)
  const rSquared = ssTot > 1e-10 ? Math.max(0, 1 - ssRes / ssTot) : 1;

  // σ: root-mean-square weighted residual → used as confidence band radius
  const sigma = Math.sqrt(ssRes / Sw);

  return { slope, intercept, rSquared, sigma };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classify the rate of AQI change into a human-readable trend label.
 * Thresholds are in AQI-units per hour.
 *   > +3 / hr  → actively worsening
 *   > +1 / hr  → slightly worsening
 *   < -3 / hr  → actively improving
 *   < -1 / hr  → slightly improving
 *   otherwise  → stable
 *
 * @param {number} slope  AQI units per hour
 * @returns {string}
 */
function classifyTrend(slope) {
  if (slope >  3) return 'worsening';
  if (slope >  1) return 'slightly_worsening';
  if (slope < -3) return 'improving';
  if (slope < -1) return 'slightly_improving';
  return 'stable';
}

/**
 * Generate a 12-hour AQI forecast for a city using its stored SQLite history.
 *
 * @param {string}        city        - City name to forecast
 * @param {Array<object>} [preloaded] - Optional pre-loaded history rows (for unit tests)
 * @returns {Promise<object>} Complete forecast result object
 */
async function generateForecast(city, preloaded = null) {
  // ── 1. Load data ──────────────────────────────────────────────────────────
  const rows = preloaded ?? (await getHistoricalReadings(city, 24));

  // Keep only rows with a numeric AQI value
  const valid = rows.filter((r) => typeof r.aqi === 'number' && r.aqi !== null);

  if (valid.length < MIN_POINTS_REQUIRED) {
    return {
      city,
      status: 'insufficient_data',
      message: `Need at least ${MIN_POINTS_REQUIRED} readings to compute a forecast. ` +
               `Currently have ${valid.length}. Keep the scheduler running to collect more data.`,
      forecastPoints: [],
      trend: 'unknown',
      slope: null,
      rSquared: null,
      confidenceInterval: null,
      computedAt: new Date().toISOString(),
    };
  }

  // ── 2. Build regression dataset ───────────────────────────────────────────
  // t0 = epoch of the first (oldest) reading — becomes x = 0
  const t0Ms = new Date(valid[0].recorded_at).getTime();

  const pts = valid.map((r, i) => ({
    x: (new Date(r.recorded_at).getTime() - t0Ms) / 3_600_000,  // hours since t0
    y: r.aqi,
    w: i + 1,  // weight: index 0 → weight 1, last index → weight N
  }));

  // ── 3. Fit weighted line ───────────────────────────────────────────────────
  const { slope, intercept, rSquared, sigma } = weightedLinearRegression(pts);

  // ── 4. Project forward ────────────────────────────────────────────────────
  const lastPt      = pts[pts.length - 1];
  const lastReadMs  = new Date(valid[valid.length - 1].recorded_at).getTime();
  const forecastPoints = [];

  for (let h = FORECAST_STEP_HOURS; h <= FORECAST_HORIZON_HOURS; h += FORECAST_STEP_HOURS) {
    const futureX   = lastPt.x + h;
    const rawAqi    = slope * futureX + intercept;
    const aqi       = Math.round(Math.max(0, Math.min(500, rawAqi)));

    forecastPoints.push({
      time:        new Date(lastReadMs + h * 3_600_000).toISOString(),
      aqi,
      isProjected: true,
      hoursAhead:  h,
      // ±σ confidence band (clamped to valid AQI range)
      lowerBound:  Math.max(0,   Math.round(aqi - sigma)),
      upperBound:  Math.min(500, Math.round(aqi + sigma)),
    });
  }

  // ── 5. Summarise ──────────────────────────────────────────────────────────
  const trend = classifyTrend(slope);

  // 12-hour predicted delta (positive = getting worse)
  const deltaAqi = forecastPoints.length > 0
    ? forecastPoints[forecastPoints.length - 1].aqi - valid[valid.length - 1].aqi
    : 0;

  return {
    city,
    status:             'ok',
    inputReadings:      valid.length,
    // Regression coefficients — useful for viva explanation
    slope:              Math.round(slope * 100) / 100,
    intercept:          Math.round(intercept * 100) / 100,
    rSquared:           Math.round(rSquared * 1000) / 1000,
    confidenceInterval: Math.round(sigma),
    trend,
    deltaAqi12h:        deltaAqi,
    forecastPoints,
    computedAt:         new Date().toISOString(),
  };
}

module.exports = {
  generateForecast,
  weightedLinearRegression, // exported for unit testing
  classifyTrend,
};
