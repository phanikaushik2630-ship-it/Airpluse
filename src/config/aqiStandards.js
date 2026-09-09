/**
 * AQI Standards and Metadata
 * Provides standard health categories, color codes, and descriptions
 * for AQI levels and common pollutants.
 */

const AQI_LEVELS = [
  {
    range: [0, 50],
    level: 'Good',
    category: 'good',
    color: '#00e400',
    description: 'Air quality is satisfactory, and air pollution poses little or no risk.',
  },
  {
    range: [51, 100],
    level: 'Moderate',
    category: 'moderate',
    color: '#ffff00',
    description: 'Air quality is acceptable; however, some pollutants may be a moderate health concern for a very small number of sensitive individuals.',
  },
  {
    range: [101, 150],
    level: 'Unhealthy for Sensitive Groups',
    category: 'unhealthy_sensitive',
    color: '#ff7e00',
    description: 'Members of sensitive groups may experience health effects. The general public is not likely to be affected.',
  },
  {
    range: [151, 200],
    level: 'Unhealthy',
    category: 'unhealthy',
    color: '#ff0000',
    description: 'Everyone may begin to experience health effects; members of sensitive groups may experience more serious health effects.',
  },
  {
    range: [201, 300],
    level: 'Very Unhealthy',
    category: 'very_unhealthy',
    color: '#8f3f97',
    description: 'Health alert: The risk of health effects is increased for everyone.',
  },
  {
    range: [301, Infinity],
    level: 'Hazardous',
    category: 'hazardous',
    color: '#7e0023',
    description: 'Health warning of emergency conditions: The entire population is more likely to be affected.',
  },
];

/**
 * Returns the classification category for a given AQI number
 * @param {number|null} aqi - Numeric AQI value
 * @returns {object} Category metadata
 */
function getAQICategory(aqi) {
  if (aqi === null || aqi === undefined || isNaN(aqi)) {
    return {
      level: 'Unknown',
      category: 'unknown',
      color: '#999999',
      description: 'Data unavailable or not reported.',
    };
  }

  const numericAqi = Math.round(Number(aqi));
  const matched = AQI_LEVELS.find(lvl => numericAqi >= lvl.range[0] && numericAqi <= lvl.range[1]);
  return matched || AQI_LEVELS[AQI_LEVELS.length - 1];
}

/**
 * Pollutant metadata including full names and standard units
 */
const POLLUTANT_METADATA = {
  pm25: { name: 'Fine Particulate Matter (PM2.5)', unit: 'µg/m³', primaryDanger: 'Deep lung penetration and bloodstream entry' },
  pm10: { name: 'Respirable Particulate Matter (PM10)', unit: 'µg/m³', primaryDanger: 'Nose and throat irritation, respiratory complications' },
  no2:  { name: 'Nitrogen Dioxide (NO2)', unit: 'ppb', primaryDanger: 'Airway inflammation, exacerbation of asthma' },
  so2:  { name: 'Sulfur Dioxide (SO2)', unit: 'ppb', primaryDanger: 'Throat irritation, breathing difficulty' },
  co:   { name: 'Carbon Monoxide (CO)', unit: 'ppm', primaryDanger: 'Reduces oxygen delivery to body organs and tissues' },
  o3:   { name: 'Ozone (O3)', unit: 'ppb', primaryDanger: 'Lung tissue damage, triggers chest pain and coughing' },
};

module.exports = {
  AQI_LEVELS,
  getAQICategory,
  POLLUTANT_METADATA,
};
