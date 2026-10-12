/**
 * The live sky: colour follows the KL time of day, the weather adds clouds,
 * rain, lightning or haze, and the KL skyline sits along the bottom.
 * Drawn on a <canvas> with requestAnimationFrame; pauses when the tab is hidden.
 */
import type { SkyKind } from '../lib/conditions';
import type { City } from '../lib/cities';
import { solarHour } from '../lib/time';
import { Skyline } from './skyline';

type RGB = [number, number, number];

/** Sky colour stops through a KL-shaped day: [hour, top colour, horizon colour]. Other cities are mapped onto this with solarHour(). */
const STOPS: [number, string, string][] = [
  [0, '#0b1026', '#1b2350'], [5.5, '#141b3d', '#3b2f63'], [6.7, '#f59e9b', '#fcd8a8'], [8, '#7cc4f2', '#cfeaff'],
  [12, '#4aa3e8', '#bfe3ff'], [17.5, '#5fa9e0', '#ffd9a0'], [19, '#f0786a', '#ffb877'], [19.8, '#3a2a63', '#b05a7a'],
  [21, '#0d1330', '#232b5c'], [24, '#0b1026', '#1b2350'],
];
const hex = (h: string): RGB => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a: RGB, b: RGB, f: number): RGB => a.map((v, i) => Math.round(v + (b[i] - v) * f)) as RGB;
const grey = (c: RGB): RGB => { const g = (c[0] + c[1] + c[2]) / 3; return [g, g, g * 1.04]; };

/** How cloudy each kind of weather looks (0–1) */
export const CLOUD_COVER: Record<SkyKind, number> = { clear: 0.1, cloudy: 0.55, rain: 0.85, storm: 1, haze: 0.4 };

/** Sky gradient for a given hour + weather. Pure, so it's tested. */
export function skyColors(hour: number, kind: SkyKind): { top: RGB; bottom: RGB } {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (h >= STOPS[i + 1][0]) i++;
  const f = (h - STOPS[i][0]) / (STOPS[i + 1][0] - STOPS[i][0]);
  let top = mix(hex(STOPS[i][1]), hex(STOPS[i + 1][1]), f);
  let bottom = mix(hex(STOPS[i][2]), hex(STOPS[i + 1][2]), f);
  const c = CLOUD_COVER[kind];
  top = mix(top, grey(top), c * 0.65);
  bottom = mix(bottom, grey(bottom), c * 0.6);
  if (kind === 'rain' || kind === 'storm') {
    top = mix(top, [40, 44, 58], 0.35);
    bottom = mix(bottom, [70, 74, 90], 0.3);
  }
  return { top, bottom };
}

export interface Scene {
  city: City['id'];
  hour: number; // local time in the city
  sunrise: number; // local, decimal hours
  sunset: number;
  kind: SkyKind;
}

export function createSky(canvas: HTMLCanvasElement, getScene: () => Scene) {
  const ctx = canvas.getContext('2d')!;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const skyline = new Skyline();
  let cityId: City['id'] = getScene().city;
  let W = 0, H = 0, k = 1, t = 0, raf = 0, flash = 0;
  let bolt: [number, number][] | null = null;
  const mouse = { x: NaN };
  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  let stars: { x: number; y: number; r: number; ph: number }[] = [];
  let clouds: { x: number; y: number; s: number; v: number }[] = [];
  let drops: { x: number; y: number; l: number; v: number }[] = [];

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2); // cap: phones don't need 3x for a background
    W = innerWidth;
    H = innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // tallest tower takes up to ~42% of the screen height
    skyline.layout(W, cityId);
    k = Math.max(0.45, Math.min(1.05, W / 1350, (H * 0.42) / skyline.tallest));
    stars = Array.from({ length: Math.round((W * H) / 4500) }, () => ({ x: rand(0, W), y: rand(0, H * 0.7), r: rand(0.3, 1.3), ph: rand(0, 6.3) }));
    clouds = Array.from({ length: 12 }, () => ({ x: rand(-200, W), y: rand(20, H * 0.45), s: rand(0.6, 1.5) * Math.min(1, W / 1000), v: rand(0.06, 0.22) }));
    drops = Array.from({ length: Math.round(Math.min(380, (W * H) / 3500)) }, () => ({ x: rand(0, W), y: rand(0, H), l: rand(10, 22), v: rand(9, 15) }));
  }

  function makeBolt() {
    let x = rand(W * 0.1, W * 0.9), y = 0;
    const pts: [number, number][] = [[x, y]];
    while (y < H * 0.55) { x += rand(-30, 30); y += rand(20, 45); pts.push([x, y]); }
    return pts;
  }

  function frame() {
    t += 0.016;
    const scene = getScene();
    if (scene.city !== cityId) { cityId = scene.city; resize(); }
    const kind = scene.kind;
    // map the city's local time onto the sky's reference day, so sunset colours happen at the real sunset
    const h = solarHour(scene.hour, scene.sunrise, scene.sunset);
    const cover = CLOUD_COVER[kind];
    const { top, bottom } = skyColors(h, kind);

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgb(${top})`);
    g.addColorStop(1, `rgb(${bottom})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const lum = (top[0] * 0.3 + top[1] * 0.59 + top[2] * 0.11) / 255;

    // stars (fade in at dusk, hidden by clouds)
    const nightTime = h < 6 || h > 19.6;
    const starA = (nightTime ? 1 : h < 6.8 ? (6.8 - h) / 1.3 : h > 19 ? (h - 19) / 0.6 : 0) * (1 - cover * 0.8);
    if (starA > 0)
      for (const s of stars) {
        ctx.fillStyle = `rgba(255,255,255,${starA * (0.35 + 0.5 * Math.sin(t * 1.5 + s.ph) ** 2)})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }

    // sun or moon travelling in an arc
    const isSun = h >= 6.5 && h <= 19.5;
    const prog = isSun ? (h - 6.5) / 13 : ((h < 6.5 ? h + 24 : h) - 19.5) / 11;
    const cx = W * (0.1 + 0.8 * prog), cy = H * 0.55 - Math.sin(prog * Math.PI) * H * 0.42;
    const bodyA = 1 - cover * 0.85;
    if (isSun) {
      const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 120);
      sg.addColorStop(0, `rgba(255,240,200,${0.95 * bodyA})`);
      sg.addColorStop(0.25, `rgba(255,214,140,${0.6 * bodyA})`);
      sg.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(cx, cy, 120, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = `rgba(245,245,255,${0.9 * bodyA})`; ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgb(${top})`; ctx.beginPath(); ctx.arc(cx + 8, cy - 5, 18, 0, Math.PI * 2); ctx.fill(); // crescent
    }

    // clouds: more and darker in bad weather
    const count = Math.round(3 + cover * 9);
    const wet = kind === 'rain' || kind === 'storm';
    const shade = mix([255, 255, 255], [120, 126, 140], wet ? 0.7 : cover * 0.3);
    ctx.fillStyle = `rgba(${shade},${(isSun ? 0.85 : 0.25) * (0.5 + cover * 0.5)})`;
    for (let i = 0; i < count; i++) {
      const c = clouds[i];
      c.x += c.v * (1 + cover);
      if (c.x > W + 220) c.x = -240;
      ctx.beginPath(); // one combined shape so the puffs don't show overlapping edges
      for (const [dx, dy, r] of [[0, 0, 30], [32, -16, 36], [70, 0, 28], [34, 8, 32], [100, 4, 22]]) {
        const X = c.x + dx * c.s, Y = c.y + dy * c.s, R = r * c.s * (1 + cover * 0.4);
        ctx.moveTo(X + R, Y); ctx.arc(X, Y, R, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    // skyline: silhouettes go black at golden hour and night
    const golden = Math.max(0, 1 - Math.abs(h - 19.1) / 1.3, 1 - Math.abs(h - 6.7) / 1) * 0.9;
    const darkness = Math.max(golden, Math.min(1, Math.max(0, 1 - lum * 1.25)));
    skyline.draw(ctx, H, k, darkness, Number.isNaN(mouse.x) ? 0 : mouse.x - W / 2, t);

    if (kind === 'haze') { ctx.fillStyle = 'rgba(214,200,170,.38)'; ctx.fillRect(0, 0, W, H); }

    // rain
    if (wet) {
      const n = kind === 'storm' ? drops.length : Math.round(drops.length * 0.6);
      ctx.strokeStyle = 'rgba(200,215,255,.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const d = drops[i];
        d.y += d.v; d.x -= d.v * 0.18;
        if (d.y > H) { d.y = rand(-40, 0); d.x = rand(0, W + 100); }
        ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + d.l * 0.18, d.y - d.l);
      }
      ctx.stroke();
    }

    // lightning (never for people who asked for reduced motion: flashes can be uncomfortable)
    if (kind === 'storm' && !reduceMotion && Math.random() < 0.004) { flash = 1; bolt = makeBolt(); }
    if (flash > 0.02) {
      ctx.fillStyle = `rgba(255,255,255,${flash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
      if (bolt && flash > 0.5) {
        ctx.strokeStyle = `rgba(255,255,255,${flash})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        bolt.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
      flash *= 0.88;
    }
  }

  function loop() {
    if (!document.hidden) frame();
    raf = requestAnimationFrame(loop);
  }

  let resizeTimer = 0;
  addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = window.setTimeout(resize, 150); });
  if (matchMedia('(hover: hover)').matches) addEventListener('pointermove', (e) => { mouse.x = e.clientX; }, { passive: true });

  resize();
  if (reduceMotion) {
    // a still picture, redrawn every 30s so it still follows the time of day
    frame();
    setInterval(frame, 30_000);
  } else {
    loop();
  }
  return { redraw: frame, stop: () => cancelAnimationFrame(raf) };
}
