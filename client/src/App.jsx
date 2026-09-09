import React from 'react';
import Header                    from './components/Header';
import CitySelector              from './components/CitySelector';
import AqiHeroCard               from './components/AqiHeroCard';
import PollutantGrid             from './components/PollutantGrid';
import TrendChart                from './components/TrendChart';
import ComparisonView            from './components/ComparisonView';
import AlertPanel                from './components/AlertPanel';
import HealthRecommendationPanel from './components/HealthRecommendationPanel';
import AlertHistoryDrawer        from './components/AlertHistoryDrawer';
import { useAirQuality }         from './hooks/useAirQuality';
import { AlertCircle }           from 'lucide-react';

export default function App() {
  const {
    // Core
    selectedCity,
    selectCity,
    cityData,
    historyData,
    comparisonCities,
    dbStats,
    isLoading,
    isRefreshing,
    error,
    countdownFormatted,
    triggerManualRefresh,
    // Phase 3 — Forecast
    forecastData,
    // Phase 3 — Alerts
    alertThreshold,
    setAlertThreshold,
    activeAlert,
    dismissAlert,
    alertHistory,
    notificationsEnabled,
    enableNotifications,
  } = useAirQuality();

  return (
    <div className="app-container">
      {/* 1. Header — branding, live indicator, auto-poll timer */}
      <Header
        countdown={countdownFormatted}
        isRefreshing={isRefreshing}
        onRefresh={triggerManualRefresh}
        totalRecords={dbStats?.totalReadings}
      />

      {/* Error alert banner */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '1rem 1.25rem',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 'var(--radius-md)',
          color: '#fca5a5', fontSize: '0.9rem',
        }}>
          <AlertCircle size={18} color="#ef4444" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. City selector & search */}
      <CitySelector selectedCity={selectedCity} onSelectCity={selectCity} />

      {/* 3. Phase 3 — Alert threshold panel */}
      <AlertPanel
        selectedCity={selectedCity}
        currentAqi={cityData?.aqi ?? null}
        dominantPollutant={cityData?.dominantPollutant}
        alertThreshold={alertThreshold}
        onThresholdChange={setAlertThreshold}
        activeAlert={activeAlert}
        onDismissAlert={dismissAlert}
        notificationsEnabled={notificationsEnabled}
        onEnableNotifications={enableNotifications}
      />

      {/* 4. Hero: AQI card (left) + Trend chart with forecast (right) */}
      <div className="hero-dashboard-grid">
        {isLoading && !cityData ? (
          <div className="hero-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '340px' }}>
            <p style={{ color: 'var(--text-secondary)' }}>
              Ingesting atmospheric telemetry for {selectedCity}...
            </p>
          </div>
        ) : (
          <AqiHeroCard data={cityData} />
        )}

        <TrendChart
          city={selectedCity}
          history={historyData}
          currentAqi={cityData?.aqi}
          forecastPoints={forecastData?.forecastPoints ?? []}
        />
      </div>

      {/* 5. Pollutant breakdown (6 cards) */}
      <PollutantGrid pollutants={cityData?.pollutants} />

      {/* 6. Phase 3 — Health recommendation + worst pollutant panel */}
      <HealthRecommendationPanel
        cityData={cityData}
        forecastData={forecastData}
      />

      {/* 7. Multi-city comparison grid */}
      <ComparisonView
        comparisonCities={comparisonCities}
        selectedCity={selectedCity}
        onSelectCity={selectCity}
      />

      {/* 8. Footer + system metrics */}
      <footer className="app-footer">
        <div className="footer-db-status">
          <span className="status-dot-green" />
          <span>
            AirPulse SQLite Ingestion Engine: <strong>Operational (WAL Mode)</strong>
          </span>
          {dbStats && (
            <span style={{ color: 'var(--text-secondary)' }}>
              • {dbStats.totalReadings} historical readings · {dbStats.totalCities} cities
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <span>Source: <strong>WAQI World Air Quality API</strong></span>
          <span>Forecast: <strong>Weighted Linear Regression</strong></span>
        </div>
      </footer>

      {/* 9. Phase 3 — Alert history drawer (collapsible at page bottom) */}
      <AlertHistoryDrawer alertHistory={alertHistory} />
    </div>
  );
}
