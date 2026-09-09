import { useState, useEffect, useCallback, useRef } from 'react';

// Default monitored cities
export const MONITORED_CITIES = [
  'Delhi',
  'Mumbai',
  'Hyderabad',
  'Bengaluru',
  'Kolkata',
  'Chennai',
];

const AUTO_REFRESH_SECONDS = 600; // 10 minutes auto-poll interval
const ALERT_STORAGE_KEY    = 'airpulse_alert_thresholds'; // localStorage key
const DEFAULT_THRESHOLD    = 150; // Unhealthy for Sensitive Groups

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Load per-city thresholds from localStorage, returning defaults if missing. */
function loadThresholds() {
  try {
    const raw = localStorage.getItem(ALERT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Persist per-city thresholds to localStorage. */
function saveThresholds(thresholds) {
  try {
    localStorage.setItem(ALERT_STORAGE_KEY, JSON.stringify(thresholds));
  } catch {
    // Silently ignore quota errors
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useAirQuality() {
  // ── Core data state ────────────────────────────────────────────────────────
  const [selectedCity,    setSelectedCity]    = useState('Delhi');
  const [cityData,        setCityData]        = useState(null);
  const [historyData,     setHistoryData]     = useState([]);
  const [comparisonCities, setComparisonCities] = useState([]);
  const [dbStats,         setDbStats]         = useState(null);

  // ── Phase 3: Forecast state ────────────────────────────────────────────────
  const [forecastData,    setForecastData]    = useState(null);

  // ── Phase 3: Alert state ───────────────────────────────────────────────────
  const [alertThresholds, setAlertThresholds] = useState(loadThresholds);
  const [activeAlert,     setActiveAlert]     = useState(null);   // currently displayed alert
  const [alertHistory,    setAlertHistory]    = useState([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    () => typeof Notification !== 'undefined' && Notification.permission === 'granted'
  );

  // ── UI state ───────────────────────────────────────────────────────────────
  const [isLoading,    setIsLoading]    = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error,        setError]        = useState(null);
  const [countdown,    setCountdown]    = useState(AUTO_REFRESH_SECONDS);

  const countdownTimerRef = useRef(null);
  // Prevent duplicate alert evaluations within the same data cycle
  const lastAlertEvalRef  = useRef({ city: null, aqi: null });

  // ─────────────────────────────────────────────────────────────────────────
  // Data fetchers
  // ─────────────────────────────────────────────────────────────────────────

  const fetchCityTelemetry = useCallback(async (city) => {
    const res = await fetch(`/api/aqi/${encodeURIComponent(city)}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `HTTP error ${res.status}`);
    }
    const json = await res.json();
    return json.data;
  }, []);

  const fetchHistory = useCallback(async (city) => {
    try {
      const res = await fetch(`/api/history/${encodeURIComponent(city)}?limit=48`);
      if (!res.ok) return [];
      const json = await res.json();
      return json.history || [];
    } catch {
      return [];
    }
  }, []);

  /** Phase 3: Fetch 12-hour forecast from the backend forecast service */
  const fetchForecast = useCallback(async (city) => {
    try {
      const res = await fetch(`/api/forecast/${encodeURIComponent(city)}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }, []);

  const fetchComparisonSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/cities');
      if (res.ok) {
        const json = await res.json();
        if (json.latestReadings?.length > 0) {
          setComparisonCities(json.latestReadings);
          if (json.stats) setDbStats(json.stats);
          return;
        }
      }
      const testRes = await fetch('/api/test');
      if (testRes.ok) {
        const testJson = await testRes.json();
        if (testJson.readings)       setComparisonCities(testJson.readings);
        if (testJson.databaseStatus) setDbStats(testJson.databaseStatus);
      }
    } catch {
      // Non-fatal
    }
  }, []);

  /** Phase 3: Load the full alert history from SQLite */
  const fetchAlertHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts/history?limit=50');
      if (!res.ok) return;
      const json = await res.json();
      setAlertHistory(json.history || []);
    } catch {
      // Non-fatal
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 3: Alert evaluation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Check if the city's AQI has crossed the user's personal threshold.
   * If triggered:
   *   1. Show in-app banner
   *   2. Fire browser push notification (if permission granted)
   *   3. POST to /api/alerts/evaluate → persists to SQLite alert_log
   *   4. Reload alert history so the drawer updates
   */
  const evaluateAlertThreshold = useCallback(async (city, aqi, threshold, dominantPollutant) => {
    // Deduplicate: don't re-fire for the same city+aqi we already evaluated
    if (
      lastAlertEvalRef.current.city === city &&
      lastAlertEvalRef.current.aqi  === aqi
    ) return;
    lastAlertEvalRef.current = { city, aqi };

    const triggered = aqi >= threshold;
    if (!triggered) return;

    // 1. Show in-app banner
    setActiveAlert({ city, aqi, threshold });

    // 2. Browser push notification
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(`⚠ AirPulse: ${city} AQI Alert`, {
          body:    `AQI ${aqi} has crossed your threshold of ${threshold}. ${aqi > 200 ? 'Consider staying indoors.' : ''}`,
          icon:    '/favicon.svg',
          tag:     `airpulse-alert-${city}`,  // deduplicates notifications for the same city
          silent:  false,
        });
      } catch {
        // Notification API not available (e.g., file:// context)
      }
    }

    // 3. POST to backend → logs to SQLite
    try {
      await fetch('/api/alerts/evaluate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ city, aqi, threshold, pollutant: dominantPollutant }),
      });
    } catch {
      // Non-critical — we still show the in-app banner
    }

    // 4. Refresh alert history so the drawer shows the new event
    fetchAlertHistory();
  }, [fetchAlertHistory]);

  // ─────────────────────────────────────────────────────────────────────────
  // Full refresh orchestrator
  // ─────────────────────────────────────────────────────────────────────────

  const refreshAll = useCallback(async (targetCity = selectedCity, isBackground = false) => {
    if (!isBackground) setIsRefreshing(true);
    setError(null);

    try {
      const [telemetryResult, historyResult, , forecastResult] = await Promise.allSettled([
        fetchCityTelemetry(targetCity),
        fetchHistory(targetCity),
        fetchComparisonSummary(),
        fetchForecast(targetCity),
      ]);

      if (telemetryResult.status === 'fulfilled') {
        const telemetry = telemetryResult.value;
        setCityData(telemetry);

        // Phase 3: run alert check after new data arrives
        const threshold = alertThresholds[targetCity] ?? DEFAULT_THRESHOLD;
        evaluateAlertThreshold(
          targetCity,
          telemetry.aqi,
          threshold,
          telemetry.dominantPollutant
        );
      } else {
        setError(telemetryResult.reason?.message || 'Failed to load air quality telemetry.');
      }

      if (historyResult.status === 'fulfilled') {
        setHistoryData(historyResult.value);
      }

      if (forecastResult.status === 'fulfilled') {
        setForecastData(forecastResult.value);
      }

      setCountdown(AUTO_REFRESH_SECONDS);

    } catch (err) {
      setError(err.message || 'An error occurred fetching atmospheric data.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [
    selectedCity,
    alertThresholds,
    fetchCityTelemetry,
    fetchHistory,
    fetchForecast,
    fetchComparisonSummary,
    evaluateAlertThreshold,
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // Threshold management (Phase 3)
  // ─────────────────────────────────────────────────────────────────────────

  const setAlertThreshold = useCallback((city, threshold) => {
    setAlertThresholds((prev) => {
      const next = { ...prev, [city]: threshold };
      saveThresholds(next);
      return next;
    });
    // Reset last-eval so the new threshold is immediately re-evaluated
    lastAlertEvalRef.current = { city: null, aqi: null };
  }, []);

  const dismissAlert = useCallback(() => setActiveAlert(null), []);

  const enableNotifications = useCallback(async () => {
    if (typeof Notification === 'undefined') {
      alert('Your browser does not support push notifications.');
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === 'granted');
    if (permission === 'granted') {
      new Notification('AirPulse Alerts Enabled ✓', {
        body: 'You will now receive a push notification when any monitored city crosses your AQI threshold.',
        icon: '/favicon.svg',
      });
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // City switching
  // ─────────────────────────────────────────────────────────────────────────

  const selectCity = (city) => {
    if (city === selectedCity) return;
    setSelectedCity(city);
    setIsLoading(true);
    setForecastData(null);
    setActiveAlert(null);
    lastAlertEvalRef.current = { city: null, aqi: null };
    refreshAll(city);
  };

  const triggerManualRefresh = () => {
    lastAlertEvalRef.current = { city: null, aqi: null };
    refreshAll(selectedCity, false);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Effects
  // ─────────────────────────────────────────────────────────────────────────

  // Initial load + alert history
  useEffect(() => {
    refreshAll(selectedCity);
    fetchAlertHistory();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown + periodic auto-refresh
  useEffect(() => {
    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          refreshAll(selectedCity, true);
          return AUTO_REFRESH_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [selectedCity, refreshAll]);

  // Format countdown mm:ss
  const minutes  = Math.floor(countdown / 60);
  const seconds  = countdown % 60;
  const countdownFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return {
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
    alertThresholds,
    alertThreshold: alertThresholds[selectedCity] ?? DEFAULT_THRESHOLD,
    setAlertThreshold,
    activeAlert,
    dismissAlert,
    alertHistory,
    notificationsEnabled,
    enableNotifications,
  };
}
