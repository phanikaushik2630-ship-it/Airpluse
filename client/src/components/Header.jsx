import React from 'react';
import { RefreshCw, Database, Zap, Cpu } from 'lucide-react';

/** Neural wave SVG — matches the favicon */
function NeuralWaveLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>
      </defs>
      <path
        d="M2 16 Q6 7 10 16 Q14 25 18 16 Q22 7 26 16 Q28 20 30 16"
        stroke="url(#logoGrad)"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="16" r="3" fill="#7C3AED" opacity="0.9" />
      <circle cx="18" cy="16" r="3" fill="#6366F1" opacity="0.9" />
      <circle cx="26" cy="16" r="3" fill="#EC4899" opacity="0.9" />
    </svg>
  );
}

export default function Header({ countdown, isRefreshing, onRefresh, totalRecords }) {
  return (
    <header className="app-header">
      {/* ── Brand ─────────────────────────────────────────────────────────── */}
      <div className="brand-section">
        <div className="brand-logo-wrap">
          <NeuralWaveLogo />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h1 className="brand-title">AirPulse<span className="brand-title-ai"> AI</span></h1>
            <span className="brand-badge">
              <Zap size={10} />
              Phase 3 Live
            </span>
          </div>
          <p className="brand-subtitle">
            Intelligent Air Quality Intelligence &amp; 12-Hour Forecast Engine
          </p>
        </div>
      </div>

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      <div className="header-actions">
        <div className="live-indicator">
          <span className="pulse-dot" />
          <span>Live Ingestion</span>
        </div>

        {totalRecords !== undefined && (
          <div className="header-stat-chip">
            <Database size={13} color="var(--accent-violet)" />
            <span>{totalRecords.toLocaleString()} Data Points</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="countdown-text" title="Automatic poll schedule">
            Refresh in <strong style={{ color: 'var(--text-primary)' }}>{countdown}</strong>
          </span>

          <button
            className={`refresh-btn ${isRefreshing ? 'spinning' : ''}`}
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Force immediate telemetry poll"
          >
            <RefreshCw size={14} />
            <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
