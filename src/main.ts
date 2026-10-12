import './style.css';
import { createSky } from './sky/sky';
import { aqiBand, iconFor, kindFromCode, labelFromCode, labelFromKind, SKY_KINDS, uvLabel, type SkyKind } from './lib/conditions';
import { CITIES, cityById, type City } from './lib/cities';
import { CACHE_MS, demoWeather, loadWeather, type Weather } from './lib/weather';
import { cityHour, formatDuration, formatHour, shortHour } from './lib/time';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const el = (tag: string, cls: string, text?: string) => {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

// ---------------------------------------------------------------------------
// Which city: ?city=melbourne in the URL, else the last one you picked, else KL
// ---------------------------------------------------------------------------
const params = new URLSearchParams(location.search);
const savedCity = (() => { try { return localStorage.getItem('kl-now:city'); } catch { return null; } })();
let city: City = cityById(params.get('city')) ?? cityById(savedCity) ?? CITIES[0];

// Preview mode via the URL, handy for demos: ?hour=19.5&sky=storm
const previewHour = params.has('hour') ? Math.min(23.99, Math.max(0, Number(params.get('hour')) || 0)) : null;
const previewSky = SKY_KINDS.includes(params.get('sky') as SkyKind) ? (params.get('sky') as SkyKind) : null;
const isPreview = previewHour !== null || previewSky !== null;

// weather per city, so switching back and forth is instant
const weatherByCity = new Map<City['id'], Weather>();
const weather = () => weatherByCity.get(city.id) ?? null;

const hourNow = () => previewHour ?? cityHour(city.tz);
const sunTimes = () => weather() ?? { sunrise: city.id === 'kl' ? 7.05 : 6.5, sunset: city.id === 'kl' ? 19.13 : 19.7 };
const isDaytime = (h: number) => h >= sunTimes().sunrise && h < sunTimes().sunset;

/** What the sky should look like right now */
function skyKind(): SkyKind {
  if (previewSky) return previewSky;
  const w = weather();
  if (!w) return 'cloudy';
  const kind = kindFromCode(w.current.code);
  // Haze season: if the air is bad, show it even on a "clear" day
  if ((kind === 'clear' || kind === 'cloudy') && (w.aqi ?? 0) > 150) return 'haze';
  return kind;
}

const sky = createSky($<HTMLCanvasElement>('sky'), () => ({
  city: city.id,
  hour: hourNow(),
  sunrise: sunTimes().sunrise,
  sunset: sunTimes().sunset,
  kind: skyKind(),
}));

// ---------------------------------------------------------------------------
// City switcher
// ---------------------------------------------------------------------------
function renderCitySwitch() {
  $('cities').replaceChildren(
    ...CITIES.map((c) => {
      const b = el('button', '', `${c.flag} ${c.short}`) as HTMLButtonElement;
      b.type = 'button';
      b.setAttribute('aria-pressed', String(c.id === city.id));
      b.setAttribute('aria-label', c.name);
      b.addEventListener('click', () => switchCity(c));
      return b;
    }),
  );
}

function switchCity(c: City) {
  if (c.id === city.id) return;
  city = c;
  try { localStorage.setItem('kl-now:city', c.id); } catch { /* fine */ }
  const url = new URL(location.href);
  if (c.id === 'kl') url.searchParams.delete('city'); else url.searchParams.set('city', c.id);
  history.replaceState(null, '', url);
  renderCitySwitch();
  applyCity();
  render();
  refresh();
}

function applyCity() {
  $('brand-city').textContent = city.short;
  $('place').textContent = city.name;
  dateFmt = new Intl.DateTimeFormat('en-AU', { timeZone: city.tz, weekday: 'long', day: 'numeric', month: 'long' });
  tickClock();
}

// ---------------------------------------------------------------------------
// Clock (every second)
// ---------------------------------------------------------------------------
let dateFmt: Intl.DateTimeFormat;
function tickClock() {
  const h = hourNow();
  const [time, ampm] = formatHour(h).split(' ');
  $('clock').replaceChildren(document.createTextNode(time), el('small', '', ampm));
  $('date').textContent = dateFmt.format(new Date());
  document.title = `${city.short} Now · ${formatHour(h)}`;
}

// ---------------------------------------------------------------------------
// Weather cards
// ---------------------------------------------------------------------------
function render() {
  const w = weather();
  if (!w) {
    $('cond').textContent = 'Loading weather…';
    $('quirk').hidden = true;
    return;
  }
  const h = hourNow();
  const kind = skyKind();

  $('icon').textContent = iconFor(kind, isDaytime(h));
  $('temp').textContent = `${w.current.temp}°`;
  $('cond').textContent = previewSky ? labelFromKind(kind) : kind === 'haze' && w.current.code < 45 ? 'Hazy' : labelFromCode(w.current.code);
  $('feels').textContent = `Feels like ${w.current.feels}°`;
  $('humidity').textContent = `${w.current.humidity}%`;
  $('wind').textContent = `${w.current.wind} km/h`;
  $('uv').textContent = `${w.uvMax} · ${uvLabel(w.uvMax)}`;

  // A little Melbourne in-joke: big temperature swings or a mix of weather → "four seasons in one day"
  const temps = w.next12.map((x) => x.temp);
  const kinds = new Set(w.next12.map((x) => kindFromCode(x.code)));
  const fourSeasons = city.id === 'melbourne' && (Math.max(...temps) - Math.min(...temps) >= 8 || kinds.size >= 3);
  $('quirk').textContent = 'Classic Melbourne: four seasons in one day 🧥☀️🌧️';
  $('quirk').hidden = !fourSeasons;

  // Next 12 hours
  $('hours').replaceChildren(
    ...w.next12.map((x, i) => {
      const card = el('div', i === 0 ? 'hour now' : 'hour');
      const day = x.hour >= Math.floor(w.sunrise) && x.hour < Math.floor(w.sunset);
      card.append(
        el('div', 'h', i === 0 ? 'Now' : shortHour(x.hour)),
        el('div', 'i', iconFor(kindFromCode(x.code), day)),
        el('div', 't', `${x.temp}°`),
        el('div', 'r', x.rainChance >= 20 ? `💧${x.rainChance}%` : ''),
      );
      card.setAttribute('aria-label', `${i === 0 ? 'Now' : shortHour(x.hour)}: ${labelFromCode(x.code)}, ${x.temp} degrees, ${x.rainChance}% chance of rain`);
      return card;
    }),
  );

  // Sun: dot travels along the arc during daylight
  const p = Math.min(1, Math.max(0, (h - w.sunrise) / (w.sunset - w.sunrise)));
  const dot = $('sun-dot');
  dot.setAttribute('cx', String(10 + p * 280));
  dot.setAttribute('cy', String(85 - Math.sin(p * Math.PI) * 70));
  dot.setAttribute('opacity', h > w.sunrise && h < w.sunset ? '1' : '0.25');
  $('sunrise').textContent = `🌅 ${formatHour(w.sunrise)}`;
  $('sunset').textContent = `🌇 ${formatHour(w.sunset)}`;
  $('daylight').textContent = `${formatDuration(w.sunset - w.sunrise)} of daylight`;
  const toSunset = w.sunset - h, toSunrise = (w.sunrise - h + 24) % 24;
  $('sun-note').textContent = toSunset > 0 && h >= w.sunrise ? `Sunset in ${formatDuration(toSunset)}` : `Sunrise in ${formatDuration(toSunrise)}`;

  // Air quality
  const band = aqiBand(w.aqi);
  $('aqi').textContent = w.aqi === null ? '--' : String(Math.round(w.aqi));
  $('aqi-label').textContent = band.label;
  $('aqi-label').style.background = band.color;
  $('pm25').textContent = w.pm25 !== null ? `PM2.5: ${Math.round(w.pm25)} µg/m³` : '';
  $('aqi-mark').style.left = `calc(${Math.min(100, ((w.aqi ?? 0) / 300) * 100)}% - 2px)`;

  updateStatus();
  sky.redraw(); // matters for reduced-motion users, whose sky is a still picture
}

function updateStatus() {
  const w = weather();
  if (!w) { $('updated').textContent = 'Loading…'; return; }
  const mins = Math.round((Date.now() - w.fetchedAt) / 60000);
  $('updated').textContent = w.source === 'demo' ? 'Sample data' : mins < 1 ? 'Updated just now' : `Updated ${mins} min ago`;
}

function showBanner(content: (string | Node)[]) {
  const b = $('banner');
  b.replaceChildren(...content);
  b.hidden = false;
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------
async function refresh(force = false) {
  const forCity = city; // the user might switch city while this is loading
  const btn = $<HTMLButtonElement>('refresh');
  btn.disabled = true;
  try {
    weatherByCity.set(forCity.id, await loadWeather(forCity, { force }));
    if (!isPreview) $('banner').hidden = true;
  } catch {
    // Offline, or the weather service is down: show a sample day instead of a broken page
    if (!weatherByCity.has(forCity.id)) weatherByCity.set(forCity.id, demoWeather(forCity));
    const retry = el('button', '', 'Try again') as HTMLButtonElement;
    retry.type = 'button';
    retry.addEventListener('click', () => refresh(true));
    if (!isPreview && forCity === city) showBanner([`Couldn't reach the weather service, so this is a sample ${forCity.name} day. `, retry]);
  } finally {
    btn.disabled = false;
  }
  if (forCity === city) render();
}

if (isPreview) {
  const back = document.createElement('a');
  back.href = location.pathname + (city.id === 'kl' ? '' : `?city=${city.id}`);
  back.textContent = 'Back to live';
  const what = [previewHour !== null ? formatHour(previewHour) : null, previewSky ? labelFromKind(previewSky) : null].filter(Boolean).join(' · ');
  showBanner([`Preview mode: ${what}. `, back]);
}

$('refresh').addEventListener('click', () => refresh(true));
// Refresh in the background every 10 minutes, and when you come back to the tab
setInterval(() => refresh(), CACHE_MS);
document.addEventListener('visibilitychange', () => {
  const w = weather();
  if (!document.hidden && (!w || Date.now() - w.fetchedAt > CACHE_MS)) refresh();
});
setInterval(() => { tickClock(); updateStatus(); }, 1000);
setInterval(render, 60_000); // sun dot, "sunset in…" etc.

renderCitySwitch();
applyCity();
refresh();
