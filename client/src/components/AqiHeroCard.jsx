import React from 'react';
import { MapPin, AlertTriangle, ShieldCheck, ShieldAlert, Clock, Navigation } from 'lucide-react';

// Helper to determine severity visual properties
function getSeverityProps(aqi) {
  const val = Number(aqi) || 0;
  if (val <= 50) {
    return {
      label: 'Good',
      color: '#10B981',
      bg: 'rgba(16, 185, 129, 0.14)',
      glow: 'rgba(16, 185, 129, 0.35)',
      icon: ShieldCheck,
      advice: 'Air quality is satisfactory. Air pollution poses little or no risk to health. Enjoy outdoor activities.',
    };
  } else if (val <= 100) {
    return {
      label: 'Moderate',
      color: '#F59E0B',
      bg: 'rgba(245, 158, 11, 0.14)',
      glow: 'rgba(245, 158, 11, 0.35)',
      icon: AlertTriangle,
      advice: 'Air quality is acceptable. However, unusually sensitive people should consider reducing prolonged outdoor exertion.',
    };
  } else if (val <= 150) {
    return {
      label: 'Unhealthy for Sensitive Groups',
      color: '#F97316',
      bg: 'rgba(249, 115, 22, 0.14)',
      glow: 'rgba(249, 115, 22, 0.35)',
      icon: AlertTriangle,
      advice: 'Members of sensitive groups (children, elderly, respiratory issues) should avoid prolonged outdoor exposure.',
    };
  } else if (val <= 200) {
    return {
      label: 'Unhealthy',
      color: '#EF4444',
      bg: 'rgba(239, 68, 68, 0.16)',
      glow: 'rgba(239, 68, 68, 0.4)',
      icon: ShieldAlert,
      advice: 'Everyone may begin to experience health effects. Wear an N95 mask outdoors, run indoor air purifiers, and keep windows sealed.',
    };
  } else if (val <= 300) {
    return {
      label: 'Very Unhealthy',
      color: '#A855F7',
      bg: 'rgba(168, 85, 247, 0.16)',
      glow: 'rgba(168, 85, 247, 0.4)',
      icon: ShieldAlert,
      advice: 'Health alert: Risk of health effects is high for all residents. Avoid all outdoor physical activity and wear protective filtration.',
    };
  } else {
    return {
      label: 'Hazardous',
      color: '#BE123C',
      bg: 'rgba(190, 18, 60, 0.2)',
      glow: 'rgba(190, 18, 60, 0.5)',
      icon: ShieldAlert,
      advice: 'Emergency conditions: The entire population is likely to be severely affected. Remain indoors with continuous air filtration.',
    };
  }
}

export default function AqiHeroCard({ data }) {
  if (!data) return null;

  const aqi = data.aqi ?? '--';
  const severity = getSeverityProps(data.aqi);
  const SeverityIcon = severity.icon;

  const formattedDate = data.recordedAt 
    ? new Date(data.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'Just now';

  return (
    <div
      className="hero-card"
      style={{
        '--aqi-color': severity.color,
        '--aqi-bg': severity.bg,
        '--aqi-glow': severity.glow,
        '--glow-color': severity.glow,
      }}
    >
      {/* Top Header: City & Station Info */}
      <div className="hero-top-meta">
        <div className="city-title-group">
          <h2>
            <span>{data.city}</span>
            <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-tertiary)' }}>IN</span>
          </h2>
          <div className="station-label">
            <MapPin size={15} color="var(--accent-cyan)" />
            <span>{data.stationName || `${data.city} Monitoring Hub`}</span>
          </div>
        </div>

        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
          <span className="dominant-badge">
            Primary Pollutant: <strong style={{ color: 'var(--text-primary)', textTransform: 'uppercase' }}>{data.dominantPollutant || 'PM2.5'}</strong>
          </span>
          {data.isSimulated && (
            <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 600 }}>
              • Pre-token Initial Telemetry
            </span>
          )}
        </div>
      </div>

      {/* Center Display: Giant AQI Dial & Severity Advice */}
      <div className="hero-center-gauge">
        <div className="aqi-dial-wrapper">
          <span className="aqi-dial-number">{aqi}</span>
          <span className="aqi-dial-label">AIR QUALITY INDEX</span>
        </div>

        <div className="hero-severity-content">
          <div className="severity-pill">
            <SeverityIcon size={20} strokeWidth={2.5} />
            <span>{severity.label}</span>
          </div>
          <p className="health-advice-box">
            {data.healthAdvice || severity.advice}
          </p>
        </div>
      </div>

      {/* Footer Meta: Coordinates and Timestamp */}
      <div className="hero-footer-meta">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Navigation size={13} color="var(--text-tertiary)" />
          <span>
            {data.coordinates?.lat && data.coordinates?.lng
              ? `${Number(data.coordinates.lat).toFixed(4)}° N, ${Number(data.coordinates.lng).toFixed(4)}° E`
              : 'Station Coordinates Calibrated'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Clock size={13} color="var(--text-tertiary)" />
          <span>Last Station Report: <strong>{formattedDate}</strong></span>
        </div>
      </div>
    </div>
  );
}
