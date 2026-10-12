/**
 * Turns weather codes and AQI numbers into things people understand.
 * Weather codes are the WMO codes used by Open-Meteo: https://open-meteo.com/en/docs
 */

/** The five looks the sky can have */
export type SkyKind = 'clear' | 'cloudy' | 'rain' | 'storm' | 'haze';

export const SKY_KINDS: SkyKind[] = ['clear', 'cloudy', 'rain', 'storm', 'haze'];

export function kindFromCode(code: number): SkyKind {
  if (code >= 95) return 'storm'; // thunderstorm
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain'; // drizzle, rain, showers
  if (code === 45 || code === 48) return 'haze'; // fog
  if (code >= 2) return 'cloudy'; // partly cloudy / overcast
  return 'clear';
}

/** Short human label for a weather code */
export function labelFromCode(code: number): string {
  const labels: Record<number, string> = {
    0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Foggy', 48: 'Foggy',
    51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
    80: 'Light showers', 81: 'Showers', 82: 'Heavy showers', 95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Severe thunderstorm',
  };
  return labels[code] ?? labelFromKind(kindFromCode(code));
}

export function labelFromKind(kind: SkyKind): string {
  return { clear: 'Clear', cloudy: 'Cloudy', rain: 'Rain', storm: 'Thunderstorm', haze: 'Hazy' }[kind];
}

export function iconFor(kind: SkyKind, isDay: boolean): string {
  return {
    clear: isDay ? '☀️' : '🌙',
    cloudy: isDay ? '⛅' : '☁️',
    rain: '🌧️',
    storm: '⛈️',
    haze: '🌫️',
  }[kind];
}

/** US AQI bands: https://www.airnow.gov/aqi/aqi-basics/ */
export function aqiBand(aqi: number | null): { label: string; color: string } {
  if (aqi === null || Number.isNaN(aqi)) return { label: 'No data', color: '#9ca3af' };
  if (aqi <= 50) return { label: 'Good', color: '#22c55e' };
  if (aqi <= 100) return { label: 'Moderate', color: '#eab308' };
  if (aqi <= 150) return { label: 'Unhealthy for some', color: '#f97316' };
  if (aqi <= 200) return { label: 'Unhealthy', color: '#ef4444' };
  if (aqi <= 300) return { label: 'Very unhealthy', color: '#a855f7' };
  return { label: 'Hazardous', color: '#7f1d1d' };
}

/** UV index wording (WHO scale) */
export function uvLabel(uv: number): string {
  if (uv >= 11) return 'Extreme';
  if (uv >= 8) return 'Very high';
  if (uv >= 6) return 'High';
  if (uv >= 3) return 'Moderate';
  return 'Low';
}
