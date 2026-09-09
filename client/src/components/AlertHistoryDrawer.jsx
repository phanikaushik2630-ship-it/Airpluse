import React, { useState } from 'react';
import { History, ChevronDown, ChevronUp, AlertTriangle, Clock } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getAlertColor(aqi) {
  if (aqi <= 50)  return '#10B981';
  if (aqi <= 100) return '#F59E0B';
  if (aqi <= 150) return '#F97316';
  if (aqi <= 200) return '#EF4444';
  if (aqi <= 300) return '#A855F7';
  return '#BE123C';
}

function formatRelativeTime(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const min  = Math.floor(diff / 60_000);
  const hr   = Math.floor(diff / 3_600_000);
  const day  = Math.floor(diff / 86_400_000);
  if (min < 1)   return 'Just now';
  if (min < 60)  return `${min}m ago`;
  if (hr < 24)   return `${hr}h ago`;
  return `${day}d ago`;
}

// ─────────────────────────────────────────────────────────────────────────────
// AlertHistoryDrawer Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A collapsible drawer at the bottom of the dashboard showing the full
 * alert_log from SQLite. Events are colour-coded by severity.
 */
export default function AlertHistoryDrawer({ alertHistory = [] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="alert-drawer">
      {/* ── Toggle Row ──────────────────────────────────────────────────── */}
      <button
        className="alert-drawer-toggle"
        onClick={() => setOpen((p) => !p)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <History size={16} color="var(--accent-cyan)" />
          <span>Alert History Log</span>
          {alertHistory.length > 0 && (
            <span className="alert-drawer-count">{alertHistory.length}</span>
          )}
        </div>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>

      {/* ── Drawer Body ─────────────────────────────────────────────────── */}
      {open && (
        <div className="alert-drawer-body">
          {alertHistory.length === 0 ? (
            <div className="alert-drawer-empty">
              <AlertTriangle size={28} color="var(--text-tertiary)" />
              <p>No threshold alerts have been triggered yet.</p>
              <p style={{ fontSize: '0.78rem' }}>
                Set an alert threshold above and wait for the AQI to cross it.
              </p>
            </div>
          ) : (
            <div className="alert-history-list">
              {alertHistory.map((entry) => {
                const color = getAlertColor(entry.aqi_at_trigger);
                return (
                  <div
                    key={entry.id}
                    className="alert-history-row"
                    style={{ '--row-color': color }}
                  >
                    {/* City + AQI */}
                    <div className="ahr-city-col">
                      <span className="ahr-dot" style={{ background: color }} />
                      <span className="ahr-city">{entry.city}</span>
                    </div>

                    {/* AQI vs Threshold */}
                    <div className="ahr-aqi-col">
                      <span className="ahr-aqi" style={{ color }}>
                        {entry.aqi_at_trigger}
                      </span>
                      <span className="ahr-threshold">
                        / threshold {entry.threshold}
                      </span>
                    </div>

                    {/* Pollutant */}
                    <div className="ahr-poll-col">
                      {entry.pollutant
                        ? <span className="ahr-poll-badge">{entry.pollutant.toUpperCase()}</span>
                        : <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>—</span>
                      }
                    </div>

                    {/* Timestamp */}
                    <div className="ahr-time-col">
                      <Clock size={11} color="var(--text-tertiary)" />
                      <span title={entry.triggered_at}>
                        {formatRelativeTime(entry.triggered_at)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
