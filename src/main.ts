import './style.css';
import { createSky } from './sky/sky';
import { aqiBand, iconFor, kindFromCode, labelFromCode, labelFromKind, SKY_KINDS, uvLabel, type SkyKind } from './lib/conditions';
import { CACHE_MS, demoWeather, loadWeather, type Weather } from './lib/weather';
import { formatDuration, formatHour, klHour, KL_TZ, shortHour } from './lib/time';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const el = (tag: string, cls: string, text?: string) => {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

// ---------------------------------------------------------------------------
// Preview mode via the URL, handy for demos: ?hour=19.5&sky=storm
// ---------------------------------------------------------------------------
const params = new URLSearchParams(location.search);
const previewHour = params.has('hour') ? Math.min(23.99, Math.max(0, Number(params.get('hour')) || 0)) : null;
const previewSky = SKY_KINDS.includes(params.get('sky') as SkyKind) ? (params.get('sky') as SkyKind) : null;
const isPreview = previewHour !== null || previewSky !== null;

let weather: Weather | null = null;

const hourNow = () => previewHour ?? klHour();
const isDaytime = (h: number) => (weather ? h >= weather.sunrise && h < weather.sunset : h >= 7 && h < 19.2);

/** What the sky should look like right now */
function skyKind(): SkyKind {
  if (previewSky) return previewSky;
  if (!weather) return 'cloudy';
  const kind = kindFromCode(weather.current.code);
  // Real KL haze season: if the air is bad, show it even on a "clear" day
  if ((kind === 'clear' || kind === 'cloudy') && (weather.aqi ?? 0) > 150) return 'haze';
  return kind;
}

const sky = createSky($<HTMLCanvasElement>('sky'), () => ({ hour: hourNow(), kind: skyKind() }));

// ---------------------------------------------------------------------------
// Clock (every second)
// ---------------------------------------------------------------------------
const dateFmt = new Intl.DateTimeFormat('en-MY', { timeZone: KL_TZ, weekday: 'long', day: 'numeric', month: 'long' });
function tickClock() {
  const h = hourNow();
  const [time, ampm] = formatHour(h).split(' ');
  $('clock').replaceChildren(document.createTextNode(time), el('small', '', ampm));
  $('date').textContent = dateFmt.format(new Date());
  document.title = `KL Now · ${formatHour(h)}`;
}

// ---------------------------------------------------------------------------
// Weather cards
// ---------------------------------------------------------------------------
function render() {
  if (!weather) return;
  const w = weather;
  const h = hourNow();
  const kind = skyKind();

  $('icon').textContent = iconFor(kind, isDaytime(h));
  $('temp').textContent = `${w.current.temp}°`;
  $('cond').textContent = previewSky ? labelFromKind(kind) : kind === 'haze' && w.current.code < 45 ? 'Hazy' : labelFromCode(w.current.code);
  $('feels').textContent = `Feels like ${w.current.feels}°`;
  $('humidity').textContent = `${w.current.humidity}%`;
  $('wind').textContent = `${w.current.wind} km/h`;
  $('uv').textContent = `${w.uvMax} · ${uvLabel(w.uvMax)}`;

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
  $('sun-note').textContent =
    toSunset > 0 && h >= w.sunrise ? `Sunset in ${formatDuration(toSunset)}` : `Sunrise in ${formatDuration(toSunrise)}`;

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
  if (!weather) return;
  const mins = Math.round((Date.now() - weather.fetchedAt) / 60000);
  $('updated').textContent = weather.source === 'demo' ? 'Sample data' : mins < 1 ? 'Updated just now' : `Updated ${mins} min ago`;
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
  const btn = $<HTMLButtonElement>('refresh');
  btn.disabled = true;
  try {
    weather = await loadWeather({ force });
    if (!isPreview) $('banner').hidden = true;
  } catch {
    // Offline, or the weather service is down: show a sample day instead of a broken page
    weather ??= demoWeather();
    const retry = el('button', '', 'Try again') as HTMLButtonElement;
    retry.type = 'button';
    retry.addEventListener('click', () => refresh(true));
    if (!isPreview) showBanner(["Couldn't reach the weather service, so this is a sample KL day. ", retry]);
  } finally {
    btn.disabled = false;
  }
  render();
}

if (isPreview) {
  const back = document.createElement('a');
  back.href = location.pathname;
  back.textContent = 'Back to live';
  const what = [previewHour !== null ? formatHour(previewHour) : null, previewSky ? labelFromKind(previewSky) : null].filter(Boolean).join(' · ');
  showBanner([`Preview mode: ${what}. `, back]);
}

$('refresh').addEventListener('click', () => refresh(true));
// Refresh in the background every 10 minutes, and when you come back to the tab
setInterval(() => refresh(), CACHE_MS);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && weather && Date.now() - weather.fetchedAt > CACHE_MS) refresh();
});
setInterval(() => { tickClock(); updateStatus(); }, 1000);
setInterval(render, 60_000); // sun dot, "sunset in…" etc.

tickClock();
refresh();
