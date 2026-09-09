import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Bell, BellOff, BellRing, X, ChevronDown, ChevronUp } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// AQI severity helper (same thresholds as the rest of the app)
// ─────────────────────────────────────────────────────────────────────────────
function getSeverityColor(aqi) {
  if (aqi <= 50)  return '#10B981';
  if (aqi <= 100) return '#F59E0B';
  if (aqi <= 150) return '#F97316';
  if (aqi <= 200) return '#EF4444';
  if (aqi <= 300) return '#A855F7';
  return '#BE123C';
}

// ─────────────────────────────────────────────────────────────────────────────
// AlertPanel Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AlertPanel — Phase 3 threshold-based alerting.
 *
 * Features:
 * • Per-city AQI threshold slider (50–300, stored in localStorage)
 * • Animated alert banner when current AQI ≥ threshold
 * • "Enable Push Notifications" button using the browser Notification API
 * • Calls POST /api/alerts/evaluate to log every breach to SQLite
 */
export default function AlertPanel({
  selectedCity,
  currentAqi,
  dominantPollutant,
  alertThreshold,
  onThresholdChange,
  activeAlert,
  onDismissAlert,
  notificationsEnabled,
  onEnableNotifications,
}) {
  const [expanded, setExpanded] = useState(true);
  const threshold = alertThreshold ?? 150;
  const isTriggered = currentAqi != null && currentAqi >= threshold;

  return (
    <section className="alert-panel-section">
      {/* ── Panel Header ──────────────────────────────────────────────────── */}
      <div
        className="alert-panel-header"
        onClick={() => setExpanded((p) => !p)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded((p) => !p)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div
            className="alert-icon-wrap"
            style={{
              background: isTriggered
                ? 'rgba(239, 68, 68, 0.2)'
                : 'rgba(6, 182, 212, 0.15)',
              border: `1px solid ${isTriggered ? '#ef4444' : 'rgba(6,182,212,0.3)'}`,
            }}
          >
            {isTriggered
              ? <BellRing size={18} color="#ef4444" />
              : <Bell size={18} color="var(--accent-cyan)" />
            }
          </div>
          <div>
            <h3 className="alert-panel-title">
              Threshold Alerts
              {isTriggered && (
                <span className="alert-triggered-badge">⚠ TRIGGERED</span>
              )}
            </h3>
            <p className="alert-panel-sub">
              Alert when {selectedCity} AQI ≥ <strong>{threshold}</strong>
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Notification permission button */}
          <button
            className="notif-btn"
            onClick={(e) => { e.stopPropagation(); onEnableNotifications(); }}
            title={notificationsEnabled ? 'Push notifications enabled' : 'Enable browser push notifications'}
          >
            {notificationsEnabled
              ? <><Bell size={13} /> Notifications On</>
              : <><BellOff size={13} /> Enable Alerts</>
            }
          </button>
          <span style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="alert-panel-body">
          {/* ── Alert Banner ──────────────────────────────────────────────── */}
          {activeAlert && (
            <AlertBanner alert={activeAlert} onDismiss={onDismissAlert} />
          )}

          {/* ── Threshold Slider ──────────────────────────────────────────── */}
          <div className="threshold-control">
            <div className="threshold-label-row">
              <span className="threshold-label">
                Alert Threshold for <strong>{selectedCity}</strong>
              </span>
              <span
                className="threshold-value-badge"
                style={{ color: getSeverityColor(threshold) }}
              >
                AQI {threshold}
              </span>
            </div>

            <div className="slider-track-wrap">
              <input
                type="range"
                className="threshold-slider"
                min={30}
                max={300}
                step={5}
                value={threshold}
                onChange={(e) => onThresholdChange(selectedCity, Number(e.target.value))}
                style={{
                  '--thumb-color': getSeverityColor(threshold),
                }}
              />
              <div className="slider-legend">
                <span style={{ color: '#10B981' }}>30 — Good</span>
                <span style={{ color: '#F59E0B' }}>100 — Mod</span>
                <span style={{ color: '#EF4444' }}>200 — Unhealthy</span>
                <span style={{ color: '#BE123C' }}>300 — Hazardous</span>
              </div>
            </div>

            {/* Current vs Threshold status row */}
            <div className="threshold-status-row">
              <div className="threshold-status-chip">
                <span style={{ color: 'var(--text-tertiary)' }}>Current AQI:</span>
                <span
                  className="threshold-aqi-val"
                  style={{ color: getSeverityColor(currentAqi ?? 0) }}
                >
                  {currentAqi ?? '--'}
                </span>
              </div>
              <div className="threshold-status-chip">
                <span style={{ color: 'var(--text-tertiary)' }}>Your Threshold:</span>
                <span
                  className="threshold-aqi-val"
                  style={{ color: getSeverityColor(threshold) }}
                >
                  {threshold}
                </span>
              </div>
              <div
                className="threshold-gap-chip"
                style={{
                  background: isTriggered
                    ? 'rgba(239, 68, 68, 0.15)'
                    : 'rgba(16, 185, 129, 0.1)',
                  border: `1px solid ${isTriggered ? 'rgba(239,68,68,0.35)' : 'rgba(16,185,129,0.25)'}`,
                  color: isTriggered ? '#ef4444' : '#10B981',
                }}
              >
                {currentAqi == null
                  ? 'No data'
                  : isTriggered
                    ? `⚠ Exceeds by ${currentAqi - threshold} AQI pts`
                    : `✓ Safe — ${threshold - currentAqi} pts headroom`
                }
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Alert Banner sub-component
// ─────────────────────────────────────────────────────────────────────────────

function AlertBanner({ alert, onDismiss }) {
  const { city, aqi, threshold } = alert;
  const color = getSeverityColor(aqi);

  return (
    <div
      className="alert-banner"
      style={{
        '--alert-color': color,
        borderColor: `${color}55`,
      }}
    >
      <div className="alert-banner-left">
        <span className="alert-banner-icon">⚠</span>
        <div>
          <div className="alert-banner-title">
            Air Quality Alert — {city}
          </div>
          <div className="alert-banner-body">
            AQI reached <strong style={{ color }}>{aqi}</strong>, exceeding
            your personal threshold of <strong>{threshold}</strong>.
            {aqi > 200 && ' Consider staying indoors and wearing an N95 mask if going out.'}
          </div>
        </div>
      </div>
      <button className="alert-banner-close" onClick={onDismiss} title="Dismiss alert">
        <X size={16} />
      </button>
    </div>
  );
}
