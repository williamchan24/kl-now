/**
 * Live KL weather + air quality from Open-Meteo (free, no API key).
 * https://open-meteo.com — data is CC BY 4.0, so the app shows a credit link.
 */
import { isoToHour, klHour } from './time';

export const KL = { lat: 3.139, lon: 101.6869 };

export interface HourForecast {
  hour: number; // 0–23
  code: number;
  temp: number;
  rainChance: number; // %
}

export interface Weather {
  source: 'live' | 'demo';
  fetchedAt: number; // ms timestamp
  current: { temp: number; feels: number; humidity: number; wind: number; code: number };
  next12: HourForecast[];
  sunrise: number; // decimal hour
  sunset: number;
  uvMax: number;
  aqi: number | null;
  pm25: number | null;
}

// ---------- raw API shapes (only the bits we use) ----------
interface ForecastResponse {
  current: { time: string; temperature_2m: number; apparent_temperature: number; relative_humidity_2m: number; weather_code: number; wind_speed_10m: number };
  hourly: { time: string[]; temperature_2m: number[]; weather_code: number[]; precipitation_probability: (number | null)[] };
  daily: { sunrise: string[]; sunset: string[]; uv_index_max: number[] };
}
interface AirResponse {
  current?: { us_aqi?: number | null; pm2_5?: number | null };
}

const params = `latitude=${KL.lat}&longitude=${KL.lon}&timezone=Asia%2FKuala_Lumpur`;
export const FORECAST_URL =
  `https://api.open-meteo.com/v1/forecast?${params}` +
  '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m' +
  '&hourly=temperature_2m,weather_code,precipitation_probability' +
  '&daily=sunrise,sunset,uv_index_max&forecast_days=2';
export const AIR_URL = `https://air-quality-api.open-meteo.com/v1/air-quality?${params}&current=us_aqi,pm2_5`;

/** Turn the two API responses into our tidy Weather object. Pure, so it's unit tested. */
export function parseWeather(f: ForecastResponse, a: AirResponse | null, now = Date.now()): Weather {
  // Hourly data starts at midnight today; find the current hour and take the next 12
  const nowKey = f.current.time.slice(0, 13); // "2026-10-12T19"
  const start = Math.max(0, f.hourly.time.findIndex((t) => t.startsWith(nowKey)));
  const next12: HourForecast[] = [];
  for (let i = start; i < Math.min(start + 12, f.hourly.time.length); i++) {
    next12.push({
      hour: Math.floor(isoToHour(f.hourly.time[i])),
      code: f.hourly.weather_code[i],
      temp: Math.round(f.hourly.temperature_2m[i]),
      rainChance: f.hourly.precipitation_probability[i] ?? 0,
    });
  }
  return {
    source: 'live',
    fetchedAt: now,
    current: {
      temp: Math.round(f.current.temperature_2m),
      feels: Math.round(f.current.apparent_temperature),
      humidity: Math.round(f.current.relative_humidity_2m),
      wind: Math.round(f.current.wind_speed_10m),
      code: f.current.weather_code,
    },
    next12,
    sunrise: isoToHour(f.daily.sunrise[0]),
    sunset: isoToHour(f.daily.sunset[0]),
    uvMax: Math.round(f.daily.uv_index_max[0] ?? 0),
    aqi: a?.current?.us_aqi ?? null,
    pm25: a?.current?.pm2_5 ?? null,
  };
}

/** A believable KL day, used if the weather service can't be reached (offline, blocked…). */
export function demoWeather(now = Date.now()): Weather {
  const h0 = Math.floor(klHour(new Date(now)));
  const codeAt = (h: number) => (h >= 15 && h <= 17 ? 95 : h >= 13 && h < 15 ? 3 : h === 18 ? 61 : h >= 19 || h < 7 ? 2 : 1);
  const tempAt = (h: number) => Math.round(25 + 7 * Math.max(0, Math.sin(((h - 7) / 12) * Math.PI)));
  const rainAt = (h: number) => (h >= 14 && h <= 18 ? 60 + (h % 3) * 10 : 10 + (h % 4) * 5);
  return {
    source: 'demo',
    fetchedAt: now,
    current: { temp: tempAt(h0), feels: tempAt(h0) + 4, humidity: 75, wind: 8, code: codeAt(h0) },
    next12: Array.from({ length: 12 }, (_, i) => {
      const h = (h0 + i) % 24;
      return { hour: h, code: codeAt(h), temp: tempAt(h), rainChance: rainAt(h) };
    }),
    sunrise: 7.05,
    sunset: 19.13,
    uvMax: 11,
    aqi: 58,
    pm25: 16,
  };
}

// ---------- fetching, with a 10-minute cache so refreshes don't hammer the API ----------
const CACHE_KEY = 'kl-now:weather:v1';
export const CACHE_MS = 10 * 60 * 1000;

function readCache(): Weather | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const w = JSON.parse(raw) as Weather;
    return Date.now() - w.fetchedAt < CACHE_MS ? w : null;
  } catch {
    return null;
  }
}

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
  return res.json() as Promise<T>;
}

export async function loadWeather({ force = false } = {}): Promise<Weather> {
  if (!force) {
    const cached = readCache();
    if (cached) return cached;
  }
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const [forecast, air] = await Promise.all([
      getJson<ForecastResponse>(FORECAST_URL, ctrl.signal),
      getJson<AirResponse>(AIR_URL, ctrl.signal).catch(() => null), // air quality is a nice-to-have
    ]);
    const w = parseWeather(forecast, air);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(w));
    } catch {
      /* storage blocked: fine, just no cache */
    }
    return w;
  } finally {
    clearTimeout(timeout);
  }
}
