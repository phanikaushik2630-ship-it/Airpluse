import React from 'react';
import { Activity, Wind, Flame, CloudRain, AlertCircle, Sparkles } from 'lucide-react';

// Recommended 24h safety reference levels (WHO / Indian NAAQS standards)
const POLLUTANT_THRESHOLDS = {
  pm25: { maxGood: 30, maxMod: 60, maxHigh: 120, unit: 'µg/m³', name: 'Fine Particulates (PM2.5)', icon: Wind },
  pm10: { maxGood: 50, maxMod: 100, maxHigh: 200, unit: 'µg/m³', name: 'Respirable Particulates (PM10)', icon: Activity },
  no2:  { maxGood: 40, maxMod: 80, maxHigh: 180, unit: 'ppb', name: 'Nitrogen Dioxide (NO2)', icon: Flame },
  so2:  { maxGood: 20, maxMod: 50, maxHigh: 100, unit: 'ppb', name: 'Sulfur Dioxide (SO2)', icon: CloudRain },
  co:   { maxGood: 10, maxMod: 20, maxHigh: 40, unit: 'ppm', name: 'Carbon Monoxide (CO)', icon: AlertCircle },
  o3:   { maxGood: 50, maxMod: 100, maxHigh: 168, unit: 'ppb', name: 'Ozone (O3)', icon: Sparkles },
};

function getPollutantStatus(key, val) {
  if (val === null || val === undefined) {
    return { label: 'N/A', color: 'var(--text-tertiary)', bg: 'rgba(255, 255, 255, 0.05)', pct: 0 };
  }
  const th = POLLUTANT_THRESHOLDS[key];
  if (!th) {
    return { label: 'Active', color: 'var(--accent-cyan)', bg: 'rgba(6, 182, 212, 0.1)', pct: 50 };
  }

  const num = Number(val);
  const pct = Math.min(Math.round((num / th.maxHigh) * 100), 100);

  if (num <= th.maxGood) {
    return { label: 'Good', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', pct };
  } else if (num <= th.maxMod) {
    return { label: 'Moderate', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', pct };
  } else if (num <= th.maxHigh) {
    return { label: 'High', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)', pct };
  } else {
    return { label: 'Severe', color: '#BE123C', bg: 'rgba(190, 18, 60, 0.2)', pct };
  }
}

export default function PollutantGrid({ pollutants = {} }) {
  const pollutantKeys = ['pm25', 'pm10', 'no2', 'so2', 'co', 'o3'];

  return (
    <section className="pollutants-section">
      <div className="section-title">
        <Activity size={20} color="var(--accent-cyan)" />
        <span>Individual Atmospheric Pollutants Breakdown</span>
      </div>

      <div className="pollutants-grid">
        {pollutantKeys.map((key) => {
          const item = pollutants[key] || {};
          const meta = POLLUTANT_THRESHOLDS[key] || {};
          const Icon = meta.icon || Activity;
          const val = item.value ?? null;
          const status = getPollutantStatus(key, val);

          return (
            <div key={key} className="pollutant-card">
              {/* Top Row: Code & Status Tag */}
              <div className="pollutant-card-top">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{
                    padding: '0.4rem',
                    borderRadius: '8px',
                    background: 'var(--bg-surface-subtle)',
                    color: status.color,
                  }}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <h4 className="pollutant-code">{key.toUpperCase()}</h4>
                    <p className="pollutant-name">{meta.name}</p>
                  </div>
                </div>

                <span
                  className="pollutant-badge"
                  style={{ color: status.color, background: status.bg }}
                >
                  {status.label}
                </span>
              </div>

              {/* Value and Unit */}
              <div className="pollutant-value-row">
                <span className="pollutant-value">
                  {val !== null ? val : '--'}
                </span>
                <span className="pollutant-unit">
                  {item.unit || meta.unit}
                </span>
              </div>

              {/* Safety Progress Bar */}
              <div>
                <div className="pollutant-bar-wrap">
                  <div
                    className="pollutant-bar-fill"
                    style={{
                      width: `${status.pct}%`,
                      backgroundColor: status.color,
                      boxShadow: `0 0 10px ${status.color}`,
                    }}
                  />
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.65rem',
                  color: 'var(--text-tertiary)',
                  marginTop: '0.35rem',
                }}>
                  <span>Safe: 0 - {meta.maxGood}</span>
                  <span>Max Scale: {meta.maxHigh}+</span>
                </div>
              </div>

              {/* Health Danger Info */}
              {item.primaryDanger && (
                <p className="pollutant-danger-info">
                  ⚠️ {item.primaryDanger}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
