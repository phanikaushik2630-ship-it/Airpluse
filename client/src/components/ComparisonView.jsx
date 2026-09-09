import React from 'react';
import { Layers, ArrowRight } from 'lucide-react';
import { MONITORED_CITIES } from '../hooks/useAirQuality';

function getCityAqiColor(aqi) {
  const num = Number(aqi) || 0;
  if (num <= 50) return { color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', label: 'Good' };
  if (num <= 100) return { color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', label: 'Moderate' };
  if (num <= 150) return { color: '#F97316', bg: 'rgba(249, 115, 22, 0.15)', label: 'Sensitive' };
  if (num <= 200) return { color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)', label: 'Unhealthy' };
  if (num <= 300) return { color: '#A855F7', bg: 'rgba(168, 85, 247, 0.15)', label: 'Very Unhealthy' };
  return { color: '#BE123C', bg: 'rgba(190, 18, 60, 0.2)', label: 'Hazardous' };
}

// Fallback baseline map for cities when backend has only partial records
const CITY_DEFAULTS = {
  Delhi: { aqi: 215, dominant: 'pm25' },
  Mumbai: { aqi: 128, dominant: 'pm10' },
  Hyderabad: { aqi: 94, dominant: 'pm25' },
  Bengaluru: { aqi: 65, dominant: 'pm25' },
  Kolkata: { aqi: 156, dominant: 'pm25' },
  Chennai: { aqi: 82, dominant: 'pm10' },
};

export default function ComparisonView({
  comparisonCities = [],
  selectedCity,
  onSelectCity,
}) {
  // Aggregate data for all standard monitored cities
  const cityCards = MONITORED_CITIES.map((cityName) => {
    // Find matching record from database readings or fallback defaults
    const found = comparisonCities.find(
      (c) => (c.city || '').toLowerCase() === cityName.toLowerCase()
    );

    const aqi = found?.aqi ?? CITY_DEFAULTS[cityName]?.aqi ?? 100;
    const dominant = found?.dominant_pollutant || found?.dominantPollutant || CITY_DEFAULTS[cityName]?.dominant || 'PM2.5';
    const status = getCityAqiColor(aqi);

    return {
      cityName,
      aqi,
      dominant,
      status,
      stationName: found?.station_name || found?.station || `${cityName} Hub`,
    };
  });

  // Sort cities from cleanest (lowest AQI) to most polluted (highest AQI)
  const sortedCities = [...cityCards].sort((a, b) => a.aqi - b.aqi);

  return (
    <section className="comparison-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="section-title">
          <Layers size={20} color="var(--accent-cyan)" />
          <span>Multi-City Air Quality Matrix (Ranked by Cleanliness)</span>
        </div>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
          Click any city to switch active dashboard view
        </span>
      </div>

      <div className="comparison-grid">
        {sortedCities.map((item, index) => {
          const isSelected = selectedCity.toLowerCase() === item.cityName.toLowerCase();

          return (
            <div
              key={item.cityName}
              className={`comparison-card ${isSelected ? 'active' : ''}`}
              onClick={() => onSelectCity(item.cityName)}
              style={{
                '--comp-color': item.status.color,
              }}
            >
              <div className="comp-card-top">
                <span className="comp-city-name">{item.cityName}</span>
                <span className="comp-rank-badge">#{index + 1}</span>
              </div>

              <div className="comp-aqi-row">
                <span className="comp-aqi-val" style={{ color: item.status.color }}>
                  {item.aqi}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                  AQI
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  className="comp-status-tag"
                  style={{ color: item.status.color, background: item.status.bg }}
                >
                  {item.status.label}
                </span>

                <span className="comp-dominant">
                  {item.dominant.toUpperCase()}
                </span>
              </div>

              {isSelected && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.7rem',
                  color: 'var(--accent-cyan)',
                  marginTop: '0.2rem',
                }}>
                  <span>Active View</span>
                  <ArrowRight size={11} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
