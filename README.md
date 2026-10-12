# KL Now 🌆

Kuala Lumpur, right now. Live time, weather, the next 12 hours of rain, sunrise and sunset, and air quality, all over a sky that matches the real thing.

**Live:** https://williamchan24.github.io/kl-now/

## Features
- **A live sky** drawn on a canvas. It follows the actual time in KL (sunrise, blue sky, golden sunset, stars and moon) and the actual weather (clouds, rain, thunderstorms with lightning, haze).
- **The KL skyline** along the bottom: Merdeka 118, The Exchange 106, the Petronas Twin Towers and KL Tower. Blue-grey by day, black silhouettes at sunset, lit-up windows and blinking tower lights at night, plus a little parallax depth on desktop.
- **Glass cards** showing:
  - current temperature and "feels like" (it's always hotter than it says 🥵)
  - humidity, wind and UV index
  - an hourly strip with rain chances
  - sunrise and sunset, with a live sun position
  - US AQI and PM2.5
- **Haze season aware:** if the air quality is unhealthy, the sky turns hazy even when the forecast says "clear".
- Works offline-ish: if the weather service can't be reached it says so and shows a sample day instead of breaking.
- Respects **reduced motion**: the sky becomes a still picture (no rain or lightning flashes) and still updates through the day.

**Try it at different times or weather:** add `?hour=19&sky=clear` (sunset) or `?hour=22&sky=storm` to the URL. Sky options are `clear`, `cloudy`, `rain`, `storm` and `haze`.

## How it works
- **Data:** [Open-Meteo](https://open-meteo.com/) forecast + air quality APIs. They're free, with no API key, so there's no backend. Responses are cached in `localStorage` for 10 minutes, and the app refreshes in the background and when you come back to the tab.
- **Time:** everything uses `Intl.DateTimeFormat` with `Asia/Kuala_Lumpur`, so someone opening it in London still sees KL's time and sky.
- **Sky:** `src/sky/sky.ts` blends colour stops through the day, greys them out by cloud cover, then layers stars, sun or moon, clouds, the skyline, rain and lightning. `requestAnimationFrame` pauses when the tab is hidden, and the canvas resolution is capped at 2× to keep phones smooth.
- **Skyline:** `src/sky/skyline.ts` draws the landmarks from simple polygons in "units", scaled to the screen. A seeded random generator places the filler buildings and windows, so the city looks the same on every visit.
- **Tested:** time zones, weather-code mapping, API parsing (including midnight rollover and missing air-quality data) and sky colours (`npm test`).

## Tech
TypeScript · Canvas 2D · Vite · Vitest · Open-Meteo API · no framework

## Run it
```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests
npm run build    # production build → dist/
```

## Structure
```
src/
├── main.ts            wiring: clock, cards, refresh, preview mode
├── style.css          glass UI
├── lib/weather.ts     fetch + parse Open-Meteo, cache, sample-day fallback
├── lib/conditions.ts  weather codes → sky look, labels, icons; AQI + UV bands
├── lib/time.ts        KL time helpers
├── sky/sky.ts         the animated sky + weather effects
└── sky/skyline.ts     the KL skyline
```

Weather data by [Open-Meteo.com](https://open-meteo.com/) (CC BY 4.0).
