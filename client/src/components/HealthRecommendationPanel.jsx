import React, { useMemo } from 'react';
import { Heart, Wind, ShieldCheck, ShieldAlert, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Rules Table
// Based on EPA & WHO AQI Health Guidelines
// ─────────────────────────────────────────────────────────────────────────────

const HEALTH_RULES = [
  {
    aqiMin: 0, aqiMax: 50,
    category: 'Good',
    color: '#10B981',
    bg: 'rgba(16, 185, 129, 0.1)',
    border: 'rgba(16, 185, 129, 0.25)',
    icon: ShieldCheck,
    mask: 'No mask needed',
    outdoor: '✓ Safe for all outdoor activities',
    ventilation: '✓ Open windows — excellent ventilation time',
    vulnerable: 'No restrictions for any group',
    summary: 'Air quality is excellent. A great time to be outdoors.',
    actions: ['Enjoy outdoor exercise freely', 'Open windows for fresh air', 'Great day for outdoor sports'],
  },
  {
    aqiMin: 51, aqiMax: 100,
    category: 'Moderate',
    color: '#F59E0B',
    bg: 'rgba(245, 158, 11, 0.1)',
    border: 'rgba(245, 158, 11, 0.25)',
    icon: AlertTriangle,
    mask: 'Optional light mask for sensitive individuals',
    outdoor: '⚠ Generally fine; sensitive people limit heavy exertion',
    ventilation: '✓ Windows can remain open',
    vulnerable: 'Sensitive people (asthma, elderly) should moderate exercise',
    summary: 'Air quality is acceptable but some pollutants may pose a minor risk to sensitive individuals.',
    actions: ['Light outdoor activity is fine', 'Sensitive groups should limit prolonged outdoor exposure', 'Monitor AQI trend'],
  },
  {
    aqiMin: 101, aqiMax: 150,
    category: 'Unhealthy for Sensitive Groups',
    color: '#F97316',
    bg: 'rgba(249, 115, 22, 0.1)',
    border: 'rgba(249, 115, 22, 0.25)',
    icon: AlertTriangle,
    mask: 'N95 recommended for sensitive groups outdoors',
    outdoor: '⚠ Sensitive groups: avoid prolonged exertion outdoors',
    ventilation: '⚠ Reduce indoor ventilation during peak hours',
    vulnerable: 'Children, elderly, and people with heart/lung conditions at increased risk',
    summary: 'Unhealthy for sensitive individuals. The general public is not likely to be affected.',
    actions: ['Sensitive groups stay indoors', 'Keep windows closed during peak hours', 'Use indoor air purifiers'],
  },
  {
    aqiMin: 151, aqiMax: 200,
    category: 'Unhealthy',
    color: '#EF4444',
    bg: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.3)',
    icon: ShieldAlert,
    mask: 'Wear N95/N99 mask outdoors',
    outdoor: '✗ Everyone should reduce outdoor exertion',
    ventilation: '✗ Keep windows sealed, run air purifiers',
    vulnerable: 'Everyone at risk; sensitive groups should remain indoors',
    summary: 'Everyone may begin to experience health effects. Sensitive groups face more serious effects.',
    actions: ['Wear N95 mask if going outside', 'Run HEPA air purifiers indoors', 'Avoid outdoor exercise', 'Keep windows and doors closed'],
  },
  {
    aqiMin: 201, aqiMax: 300,
    category: 'Very Unhealthy',
    color: '#A855F7',
    bg: 'rgba(168, 85, 247, 0.1)',
    border: 'rgba(168, 85, 247, 0.3)',
    icon: ShieldAlert,
    mask: 'P100 respirator recommended for all',
    outdoor: '✗ Avoid all outdoor physical activity',
    ventilation: '✗ Seal all windows — use indoor air filtration continuously',
    vulnerable: 'Health alert for everyone; emergency conditions for sensitive groups',
    summary: 'Health alert — risk of serious health effects is elevated for the entire population.',
    actions: ['Remain indoors with continuous air filtration', 'Wear P100 respirator if must go out', 'Schools and offices should consider closure', 'Seek medical attention for respiratory symptoms'],
  },
  {
    aqiMin: 301, aqiMax: Infinity,
    category: 'Hazardous',
    color: '#BE123C',
    bg: 'rgba(190, 18, 60, 0.15)',
    border: 'rgba(190, 18, 60, 0.4)',
    icon: ShieldAlert,
    mask: 'Full respirator mandatory if outdoors',
    outdoor: '✗ Do NOT go outside — emergency conditions',
    ventilation: '✗ All openings sealed; highest-rated purifiers on maximum',
    vulnerable: 'Entire population severely affected — emergency conditions',
    summary: 'Emergency conditions. The entire population is likely to be severely affected.',
    actions: ['Remain indoors — do NOT go outside', 'Call emergency services if experiencing symptoms', 'All air intake sealed; purifiers on MAX', 'Evacuate if possible and safe to do so'],
  },
];

// Safe limits for worst-pollutant computation
// (WHO + Indian NAAQS 24h standards)
const POLLUTANT_SAFE_LIMITS = {
  pm25: { safe: 30,  label: 'PM2.5', full: 'Fine Particulates (PM2.5)',      unit: 'µg/m³' },
  pm10: { safe: 50,  label: 'PM10',  full: 'Respirable Particulates (PM10)', unit: 'µg/m³' },
  no2:  { safe: 40,  label: 'NO2',   full: 'Nitrogen Dioxide (NO2)',          unit: 'ppb' },
  so2:  { safe: 20,  label: 'SO2',   full: 'Sulfur Dioxide (SO2)',            unit: 'ppb' },
  co:   { safe: 10,  label: 'CO',    full: 'Carbon Monoxide (CO)',            unit: 'ppm' },
  o3:   { safe: 50,  label: 'O3',    full: 'Ozone (O3)',                      unit: 'ppb' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getRuleForAqi(aqi) {
  const val = Number(aqi) || 0;
  return HEALTH_RULES.find((r) => val >= r.aqiMin && val <= r.aqiMax) ?? HEALTH_RULES[0];
}

/**
 * Determine the worst pollutant by computing each pollutant's value as a
 * multiple of its safe limit. The highest ratio is the "worst".
 * Explainable: "PM2.5 at 215 µg/m³ is 7.2× its safe limit of 30 µg/m³."
 */
function computeWorstPollutant(pollutants) {
  if (!pollutants) return null;

  const ranked = Object.entries(POLLUTANT_SAFE_LIMITS)
    .map(([key, meta]) => {
      const val = pollutants[key]?.value;
      if (val == null || typeof val !== 'number') return null;
      return { key, value: val, meta, ratio: val / meta.safe };
    })
    .filter(Boolean)
    .sort((a, b) => b.ratio - a.ratio);

  return ranked[0] ?? null;
}

function TrendIcon({ trend }) {
  if (!trend || trend === 'unknown' || trend === 'stable') {
    return <Minus size={16} color="#94A3B8" />;
  }
  if (trend.includes('worsening')) {
    return <TrendingUp size={16} color="#EF4444" />;
  }
  return <TrendingDown size={16} color="#10B981" />;
}

// ─────────────────────────────────────────────────────────────────────────────
// HealthRecommendationPanel Component
// ─────────────────────────────────────────────────────────────────────────────

export default function HealthRecommendationPanel({
  cityData,
  forecastData,
}) {
  const aqi       = cityData?.aqi ?? null;
  const pollutants = cityData?.pollutants ?? {};
  const forecast  = forecastData;

  const currentRule = useMemo(() => getRuleForAqi(aqi), [aqi]);
  const worstPollutant = useMemo(() => computeWorstPollutant(pollutants), [pollutants]);

  // Forecast context: is the situation getting worse in the next 12h?
  const forecastAqi12h = forecast?.forecastPoints?.[forecast.forecastPoints.length - 1]?.aqi ?? null;
  const forecastRule   = forecastAqi12h != null ? getRuleForAqi(forecastAqi12h) : null;
  const forecastDelta  = forecast?.deltaAqi12h ?? null;
  const trend          = forecast?.trend ?? 'unknown';

  const RuleIcon = currentRule.icon;

  if (aqi == null) return null;

  return (
    <section className="health-panel">
      {/* ── Section Header ──────────────────────────────────────────────── */}
      <div className="health-panel-header">
        <div className="section-title">
          <Heart size={20} color="var(--accent-cyan)" />
          <span>Health Intelligence &amp; Recommendations</span>
        </div>
        {forecast?.status === 'ok' && (
          <div className="forecast-trend-pill" style={{ color: trend.includes('worsening') ? '#EF4444' : trend.includes('improving') ? '#10B981' : '#94A3B8' }}>
            <TrendIcon trend={trend} />
            <span>
              {trend === 'stable' && '12h Forecast: Stable'}
              {trend === 'slightly_worsening' && '12h Forecast: Slightly Worsening'}
              {trend === 'worsening' && '12h Forecast: Worsening ↑'}
              {trend === 'slightly_improving' && '12h Forecast: Slightly Improving'}
              {trend === 'improving' && '12h Forecast: Improving ↓'}
              {trend === 'unknown' && '12h Forecast: Insufficient Data'}
            </span>
          </div>
        )}
      </div>

      <div className="health-panel-grid">

        {/* ── Worst Pollutant Card ─────────────────────────────────────── */}
        <div className="health-card worst-pollutant-card">
          <div className="health-card-title">
            <Wind size={16} color="var(--accent-cyan)" />
            Primary Driver
          </div>

          {worstPollutant ? (
            <>
              <div className="worst-poll-name">
                {worstPollutant.meta.label}
              </div>
              <div className="worst-poll-full">{worstPollutant.meta.full}</div>
              <div className="worst-poll-value">
                <span style={{ fontSize: '2.4rem', fontWeight: 900, fontFamily: 'var(--font-display)', color: currentRule.color }}>
                  {worstPollutant.value}
                </span>
                <span style={{ color: 'var(--text-tertiary)', marginLeft: '0.35rem' }}>{worstPollutant.meta.unit}</span>
              </div>
              <div className="worst-poll-ratio" style={{ color: currentRule.color }}>
                {worstPollutant.ratio >= 2
                  ? `${worstPollutant.ratio.toFixed(1)}× safe limit — primary contributor`
                  : worstPollutant.ratio >= 1
                    ? `${worstPollutant.ratio.toFixed(1)}× safe limit — exceeds WHO standard`
                    : `${Math.round(worstPollutant.ratio * 100)}% of safe limit — within guideline`
                }
              </div>
              <div className="worst-poll-bar-wrap">
                <div
                  className="worst-poll-bar"
                  style={{
                    width: `${Math.min(100, Math.round(worstPollutant.ratio * 50))}%`,
                    background: currentRule.color,
                    boxShadow: `0 0 8px ${currentRule.color}`,
                  }}
                />
              </div>
            </>
          ) : (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
              Pollutant data unavailable.
            </p>
          )}
        </div>

        {/* ── Current Recommendations Card ─────────────────────────────── */}
        <div
          className="health-card current-rec-card"
          style={{
            '--rule-color': currentRule.color,
            background: currentRule.bg,
            borderColor: currentRule.border,
          }}
        >
          <div className="health-card-title">
            <RuleIcon size={16} color={currentRule.color} />
            <span style={{ color: currentRule.color }}>Now — {currentRule.category}</span>
          </div>

          <div className="rec-item-list">
            <RecItem icon="😷" label={currentRule.mask} />
            <RecItem icon="🏃" label={currentRule.outdoor} />
            <RecItem icon="🪟" label={currentRule.ventilation} />
            <RecItem icon="⚕️" label={currentRule.vulnerable} />
          </div>
        </div>

        {/* ── Forecast Actions Card ─────────────────────────────────────── */}
        <div className="health-card forecast-rec-card">
          <div className="health-card-title">
            <TrendIcon trend={trend} />
            12-Hour Outlook
          </div>

          {forecastAqi12h != null ? (
            <>
              {/* Worsening pre-warning */}
              {forecastDelta > 20 && (
                <div className="forecast-warning-chip">
                  ⚠ AQI projected to rise by <strong>+{forecastDelta} pts</strong> — take precautions early
                </div>
              )}
              {forecastDelta < -20 && (
                <div className="forecast-good-chip">
                  ↓ Conditions improving — AQI projected to drop by <strong>{Math.abs(forecastDelta)} pts</strong>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.5rem 0' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Now</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, fontFamily: 'var(--font-display)', color: currentRule.color }}>{aqi}</div>
                </div>
                <div style={{ flex: 1, height: '2px', background: `linear-gradient(to right, ${currentRule.color}, ${forecastRule?.color ?? currentRule.color})`, borderRadius: '2px' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>+12h</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, fontFamily: 'var(--font-display)', color: forecastRule?.color ?? 'var(--text-secondary)' }}>{forecastAqi12h}</div>
                </div>
              </div>

              {forecastRule && forecastRule.category !== currentRule.category && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Category shift: <span style={{ color: currentRule.color, fontWeight: 700 }}>{currentRule.category}</span>
                  {' → '}
                  <span style={{ color: forecastRule.color, fontWeight: 700 }}>{forecastRule.category}</span>
                </div>
              )}

              <div className="rec-item-list" style={{ marginTop: '0.5rem' }}>
                {(forecastRule ?? currentRule).actions.slice(0, 3).map((action) => (
                  <RecItem key={action} icon="→" label={action} />
                ))}
              </div>

              {forecast?.rSquared != null && (
                <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
                  Model R² = {forecast.rSquared} · σ ± {forecast.confidenceInterval} AQI pts
                  · slope = {forecast.slope} AQI/hr
                </div>
              )}
            </>
          ) : (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', lineHeight: 1.6 }}>
              {forecast?.message ?? 'Collecting data… forecast available after 3+ readings.'}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: single recommendation line item
// ─────────────────────────────────────────────────────────────────────────────

function RecItem({ icon, label }) {
  return (
    <div className="rec-item">
      <span className="rec-item-icon">{icon}</span>
      <span className="rec-item-label">{label}</span>
    </div>
  );
}
