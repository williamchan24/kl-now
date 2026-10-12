import { describe, expect, it } from 'vitest';
import { formatDuration, formatHour, isoToHour, klHour, shortHour } from './time';
import { aqiBand, kindFromCode, labelFromCode, uvLabel } from './conditions';
import { demoWeather, parseWeather } from './weather';

describe('time', () => {
  it('reads KL time regardless of the visitor’s timezone', () => {
    // 2026-10-12 11:30 UTC = 7:30 pm in KL (UTC+8)
    expect(klHour(new Date('2026-10-12T11:30:00Z'))).toBeCloseTo(19.5, 5);
    expect(klHour(new Date('2026-10-12T16:05:00Z'))).toBeCloseTo(0 + 5 / 60, 5); // just after midnight
  });

  it('formats hours for people', () => {
    expect(formatHour(19.5)).toBe('7:30 pm');
    expect(formatHour(0)).toBe('12:00 am');
    expect(formatHour(12.25)).toBe('12:15 pm');
    expect(shortHour(15)).toBe('3pm');
    expect(isoToHour('2026-10-12T19:08')).toBeCloseTo(19.1333, 3);
    expect(formatDuration(12.08)).toBe('12h 5m');
  });
});

describe('conditions', () => {
  it('maps WMO weather codes to sky looks', () => {
    expect(kindFromCode(0)).toBe('clear');
    expect(kindFromCode(3)).toBe('cloudy');
    expect(kindFromCode(45)).toBe('haze');
    expect(kindFromCode(63)).toBe('rain');
    expect(kindFromCode(81)).toBe('rain');
    expect(kindFromCode(95)).toBe('storm');
    expect(labelFromCode(95)).toBe('Thunderstorm');
  });

  it('labels AQI and UV', () => {
    expect(aqiBand(42).label).toBe('Good');
    expect(aqiBand(101).label).toBe('Unhealthy for some');
    expect(aqiBand(null).label).toBe('No data');
    expect(uvLabel(11)).toBe('Extreme');
    expect(uvLabel(2)).toBe('Low');
  });
});

describe('weather parsing', () => {
  // A trimmed-down real-shaped Open-Meteo response
  const hours = Array.from({ length: 48 }, (_, i) => `2026-10-${12 + Math.floor(i / 24)}T${String(i % 24).padStart(2, '0')}:00`);
  const forecast = {
    current: { time: '2026-10-12T19:15', temperature_2m: 28.6, apparent_temperature: 33.2, relative_humidity_2m: 81, weather_code: 95, wind_speed_10m: 7.4 },
    hourly: {
      time: hours,
      temperature_2m: hours.map((_, i) => 24 + (i % 10)),
      weather_code: hours.map((_, i) => (i % 24 === 20 ? 61 : 2)),
      precipitation_probability: hours.map((_, i) => (i % 24 === 20 ? 70 : null)),
    },
    daily: { sunrise: ['2026-10-12T07:03', '2026-10-13T07:03'], sunset: ['2026-10-12T19:08', '2026-10-13T19:08'], uv_index_max: [10.6, 11] },
  };

  it('picks the next 12 hours starting from now', () => {
    const w = parseWeather(forecast, { current: { us_aqi: 63, pm2_5: 17.4 } }, 0);
    expect(w.next12).toHaveLength(12);
    expect(w.next12[0].hour).toBe(19);
    expect(w.next12[1]).toMatchObject({ hour: 20, code: 61, rainChance: 70 });
    expect(w.next12[5].hour).toBe(0); // rolls over midnight into tomorrow
    expect(w.next12[2].rainChance).toBe(0); // null → 0
  });

  it('rounds the current conditions and reads sun times', () => {
    const w = parseWeather(forecast, null, 0);
    expect(w.current).toEqual({ temp: 29, feels: 33, humidity: 81, wind: 7, code: 95 });
    expect(w.sunrise).toBeCloseTo(7.05, 2);
    expect(w.sunset).toBeCloseTo(19.133, 2);
    expect(w.uvMax).toBe(11);
    expect(w.aqi).toBeNull(); // air quality failed → no crash
  });

  it('has a sensible demo fallback', () => {
    const d = demoWeather();
    expect(d.source).toBe('demo');
    expect(d.next12).toHaveLength(12);
  });
});
