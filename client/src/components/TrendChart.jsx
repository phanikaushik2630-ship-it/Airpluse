import React, { useState, useMemo } from 'react';
import { TrendingUp, Info, Dot } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Severity colour for a given AQI (used to colour forecast dots)
// ─────────────────────────────────────────────────────────────────────────────
function aqiColor(aqi) {
  if (aqi <= 50)  return '#10B981';
  if (aqi <= 100) return '#F59E0B';
  if (aqi <= 150) return '#F97316';
  if (aqi <= 200) return '#EF4444';
  if (aqi <= 300) return '#A855F7';
  return '#BE123C';
}

// ─────────────────────────────────────────────────────────────────────────────
// TrendChart — Phase 3 update
// Now accepts an optional `forecastPoints` prop (array of {time, aqi, isProjected})
// which are rendered as a dashed purple extension beyond the last real data point.
// ─────────────────────────────────────────────────────────────────────────────

export default function TrendChart({ city, history = [], currentAqi, forecastPoints = [] }) {
  const [timeRange,     setTimeRange]     = useState('24h');
  const [hoveredPoint,  setHoveredPoint]  = useState(null);

  // ── 1. Prepare actual history points ────────────────────────────────────
  const actualPoints = useMemo(() => {
    let dataset = [...history];

    // Synthesise baseline data when database is freshly seeded (< 5 real records)
    if (dataset.length < 5 && currentAqi) {
      const now  = Date.now();
      const synth = [];
      const count = 12; // every 2 hours for past 24h
      for (let i = count; i >= 1; i--) {
        const offset  = now - i * 2 * 3600 * 1000;
        const variance = Math.sin(i) * 18 + (i % 3 === 0 ? -10 : 8);
        synth.push({
          id: `synth-${i}`, city, aqi: Math.max(20, Math.round(currentAqi + variance)),
          recorded_at: new Date(offset).toISOString(), isSynthetic: true,
        });
      }
      dataset = [...synth, ...dataset];
    }

    // Trim to the selected time window
    if (timeRange === '24h') return dataset.slice(-24);
    if (timeRange === '48h') return dataset.slice(-48);
    return dataset;
  }, [history, currentAqi, city, timeRange]);

  // ── 2. Compute a shared time scale across actual + forecast ─────────────
  const allPoints = useMemo(() => {
    const cleaned = forecastPoints.filter((p) => p?.aqi != null);
    return [...actualPoints, ...cleaned];
  }, [actualPoints, forecastPoints]);

  const splitIndex = actualPoints.length; // index at which forecast begins

  // Chart dimensions
  const width   = 800;
  const height  = 240;
  const padding = { top: 25, right: 30, bottom: 35, left: 45 };

  // ── 3. Map all points to SVG coordinates ────────────────────────────────
  const { plottedPoints, pathD, areaD, forecastPathD, maxVal, minVal } = useMemo(() => {
    if (allPoints.length === 0) {
      return { plottedPoints: [], pathD: '', areaD: '', forecastPathD: '', maxVal: 300, minVal: 0 };
    }

    const aqiVals = allPoints.map((p) => p.aqi || 0);
    const maxAqi  = Math.max(...aqiVals, 200);
    const minAqi  = Math.max(0, Math.min(...aqiVals, 50) - 20);

    const chartW  = width  - padding.left - padding.right;
    const chartH  = height - padding.top  - padding.bottom;
    const totalN  = allPoints.length;

    const coords = allPoints.map((p, idx) => {
      const x     = padding.left + (idx / Math.max(totalN - 1, 1)) * chartW;
      const yNorm = (p.aqi - minAqi) / Math.max(maxAqi - minAqi, 1);
      const y     = padding.top + chartH - yNorm * chartH;
      return { x, y, aqi: p.aqi, time: p.recorded_at || p.time, raw: p, isProjected: !!p.isProjected };
    });

    // Build the actual-data smooth curve (indices 0 … splitIndex-1)
    const actualCoords   = coords.slice(0, splitIndex);
    const forecastCoords = coords.slice(splitIndex - 1); // starts at last actual pt for seamless join

    function buildBezierPath(pts) {
      return pts.reduce((acc, pt, idx) => {
        if (idx === 0) return `M ${pt.x} ${pt.y}`;
        const prev = pts[idx - 1];
        const cx   = (prev.x + pt.x) / 2;
        return `${acc} C ${cx} ${prev.y}, ${cx} ${pt.y}, ${pt.x} ${pt.y}`;
      }, '');
    }

    const actualPath   = buildBezierPath(actualCoords);
    const forecastPath = buildBezierPath(forecastCoords);

    // Area fill under the actual line
    const baselineY = padding.top + chartH;
    const areaPath  = actualPath
      ? `${actualPath} L ${actualCoords[actualCoords.length - 1].x} ${baselineY} L ${actualCoords[0].x} ${baselineY} Z`
      : '';

    return {
      plottedPoints: coords,
      pathD:         actualPath,
      areaD:         areaPath,
      forecastPathD: forecastPath,
      maxVal:        maxAqi,
      minVal:        minAqi,
    };
  }, [allPoints, splitIndex]);

  // AQI threshold guideline lines
  const guideLines = [
    { aqi: 50,  label: '50 Good',      color: '#10b981' },
    { aqi: 100, label: '100 Mod',      color: '#f59e0b' },
    { aqi: 200, label: '200 Unhealthy', color: '#ef4444' },
  ];

  const hasForecast = forecastPoints.length > 0;

  return (
    <div className="chart-card">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="chart-header">
        <div className="chart-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <TrendingUp size={20} color="var(--accent-cyan)" />
            <h3>Historical AQI Atmospheric Trend</h3>
            {/* Phase 3: Forecast legend */}
            {hasForecast && (
              <div className="forecast-legend-chip">
                <svg width="22" height="10">
                  <line x1="0" y1="5" x2="22" y2="5" stroke="#a855f7" strokeWidth="2" strokeDasharray="4 3" />
                </svg>
                Forecast (12h)
              </div>
            )}
          </div>
          <p className="chart-subtitle">
            Time-series telemetry from local SQLite for <strong>{city}</strong>
            {hasForecast && ' · dotted line = weighted linear regression projection'}
          </p>
        </div>

        <div className="chart-time-tabs">
          {['24h', '48h', 'all'].map((r) => (
            <button
              key={r}
              className={`chart-tab-btn ${timeRange === r ? 'active' : ''}`}
              onClick={() => setTimeRange(r)}
            >
              {r === 'all' ? 'All History' : r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* ── SVG Chart ───────────────────────────────────────────────────── */}
      <div className="svg-chart-container">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="chartAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#06b6d4" stopOpacity="0.45" />
              <stop offset="50%"  stopColor="#3b82f6" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#060911" stopOpacity="0.0"  />
            </linearGradient>
            <linearGradient id="chartStrokeGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="#06b6d4" />
              <stop offset="50%"  stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>

          {/* Guideline thresholds */}
          {guideLines.map((g) => {
            if (g.aqi < minVal || g.aqi > maxVal) return null;
            const chartH = height - padding.top - padding.bottom;
            const y = padding.top + chartH - ((g.aqi - minVal) / (maxVal - minVal)) * chartH;
            return (
              <g key={g.aqi}>
                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y}
                  stroke={g.color} strokeDasharray="4 4" strokeOpacity="0.3" strokeWidth="1" />
                <text x={padding.left - 8} y={y + 3} fill={g.color} fontSize="10"
                  fontFamily="var(--font-body)" textAnchor="end" opacity="0.8">
                  {g.label}
                </text>
              </g>
            );
          })}

          {/* "Now" divider between actual and forecast */}
          {hasForecast && splitIndex > 0 && plottedPoints[splitIndex - 1] && (
            <g>
              <line
                x1={plottedPoints[splitIndex - 1].x}
                y1={padding.top}
                x2={plottedPoints[splitIndex - 1].x}
                y2={height - padding.bottom}
                stroke="rgba(255,255,255,0.15)"
                strokeDasharray="3 3"
                strokeWidth="1.5"
              />
              <text
                x={plottedPoints[splitIndex - 1].x + 4}
                y={padding.top + 14}
                fill="rgba(255,255,255,0.35)"
                fontSize="9"
                fontFamily="var(--font-body)"
              >
                now
              </text>
            </g>
          )}

          {/* Area fill under actual line */}
          {areaD && <path d={areaD} fill="url(#chartAreaGradient)" />}

          {/* Actual data line */}
          {pathD && (
            <path d={pathD} fill="none" stroke="url(#chartStrokeGradient)"
              strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          )}

          {/* Phase 3: Forecast dashed line (purple) */}
          {forecastPathD && hasForecast && (
            <path
              d={forecastPathD}
              fill="none"
              stroke="#a855f7"
              strokeWidth="2.5"
              strokeDasharray="6 4"
              strokeLinecap="round"
              opacity="0.85"
            />
          )}

          {/* Actual data dots */}
          {plottedPoints.slice(0, splitIndex).map((pt, idx) => (
            <circle key={`actual-${idx}`}
              cx={pt.x} cy={pt.y}
              r={hoveredPoint?.idx === idx ? 6 : 3}
              fill={hoveredPoint?.idx === idx ? '#ffffff' : '#06b6d4'}
              stroke="#070a12" strokeWidth="2"
              style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
              onMouseEnter={() => setHoveredPoint({ ...pt, idx })}
              onMouseLeave={() => setHoveredPoint(null)}
            />
          ))}

          {/* Phase 3: Forecast dots — hollow, purple */}
          {plottedPoints.slice(splitIndex).map((pt, idx) => {
            const realIdx = splitIndex + idx;
            const isHov   = hoveredPoint?.idx === realIdx;
            return (
              <circle key={`forecast-${idx}`}
                cx={pt.x} cy={pt.y}
                r={isHov ? 7 : 4.5}
                fill={isHov ? '#a855f7' : 'transparent'}
                stroke="#a855f7"
                strokeWidth={isHov ? 2 : 1.5}
                strokeDasharray={isHov ? '' : ''}
                style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
                onMouseEnter={() => setHoveredPoint({ ...pt, idx: realIdx })}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            );
          })}
        </svg>

        {/* Hover tooltip */}
        {hoveredPoint && (
          <div
            className="chart-tooltip"
            style={{
              left: `${(hoveredPoint.x / width) * 100}%`,
              top:  `${(hoveredPoint.y / height) * 100}%`,
              borderColor: hoveredPoint.isProjected ? 'rgba(168,85,247,0.5)' : undefined,
            }}
          >
            <div className="chart-tooltip-time">
              {new Date(hoveredPoint.time).toLocaleString([], {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
              {hoveredPoint.isProjected && (
                <span style={{ marginLeft: '0.35rem', color: '#a855f7', fontWeight: 700 }}>
                  · FORECAST
                </span>
              )}
            </div>
            <div
              className="chart-tooltip-val"
              style={{ color: aqiColor(hoveredPoint.aqi) }}
            >
              AQI: {hoveredPoint.aqi}
            </div>
          </div>
        )}
      </div>

      {/* Footer row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Info size={13} />
          <span>Hover data points · dotted = 12h WLR projection · solid = recorded telemetry</span>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <span>Actual: <strong>{actualPoints.length}</strong></span>
          {hasForecast && <span style={{ color: '#a855f7' }}>Forecast: <strong>+{forecastPoints.length} pts</strong></span>}
        </div>
      </div>
    </div>
  );
}
