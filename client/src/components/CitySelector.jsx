import React, { useState } from 'react';
import { Search, MapPin } from 'lucide-react';
import { MONITORED_CITIES } from '../hooks/useAirQuality';

export default function CitySelector({
  selectedCity,
  onSelectCity,
}) {
  const [searchInput, setSearchInput] = useState('');

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onSelectCity(searchInput.trim());
      setSearchInput('');
    }
  };

  return (
    <div className="city-nav-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        {/* City Pills */}
        <div className="city-pills-row">
          {MONITORED_CITIES.map((city) => {
            const isActive = selectedCity.toLowerCase() === city.toLowerCase();
            return (
              <button
                key={city}
                className={`city-pill ${isActive ? 'active' : ''}`}
                onClick={() => onSelectCity(city)}
              >
                <MapPin size={14} color={isActive ? 'var(--accent-cyan)' : 'var(--text-tertiary)'} />
                <span>{city}</span>
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="search-input-wrap">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="city-search-input"
            placeholder="Search any global city or station..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </form>
      </div>
    </div>
  );
}
