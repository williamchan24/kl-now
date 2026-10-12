/**
 * Stylised city skylines. Shapes are in "units" with y going UP from the ground,
 * scaled to the screen. Each city defines its landmarks; filler buildings, lit
 * windows and parallax are shared.
 *
 * KL: Merdeka 118, The Exchange 106, Petronas Twin Towers, KL Tower.
 * Melbourne: Arts Centre spire, Rialto, Flinders Street Station, Eureka Tower, Australia 108.
 */
import type { City } from '../lib/cities';

type Pt = [number, number];
type Rect = [x0: number, x1: number, y0: number, y1: number];

/** What a landmark's custom drawing code gets */
interface Paint {
  ctx: CanvasRenderingContext2D;
  x: number; // centre in px
  ground: number;
  k: number; // px per unit
  color: string; // "r,g,b" silhouette colour for this time of day
  night: number; // 0 day → 1 full night
  t: number; // seconds, for blinking
}

interface LandmarkDef {
  at: number; // 0–1 across the screen
  polys: { pts: Pt[]; dx?: number }[];
  windows?: Rect[];
  extra?: (p: Paint) => void; // details: pods, crowns, bridges…
  front?: boolean; // drawn in front of the near buildings (low landmarks)
  beacon?: Pt; // red aircraft light
}

interface SkylineDef {
  tallest: number; // in units, used to size the city to the screen
  landmarks: LandmarkDef[];
  glow?: { landmark: number; y: number; rgb: string }; // soft night glow behind a landmark
}

const fill = (p: Paint, pts: Pt[], dx = 0) => {
  const { ctx, x, ground, k } = p;
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, x + (px + dx) * k, ground - py * k));
  ctx.closePath();
  ctx.fill();
};

// ============================== KUALA LUMPUR ==============================
const PETRONAS: Pt[] = [[-17,0],[17,0],[17,200],[15,200],[15,232],[12,232],[12,258],[9,258],[9,278],[6,278],[6,292],[2,292],[0.8,350],[-0.8,350],[-2,292],[-6,292],[-6,278],[-9,278],[-9,258],[-12,258],[-12,232],[-15,232],[-15,200],[-17,200]];

const KL: SkylineDef = {
  tallest: 440,
  glow: { landmark: 2, y: 200, rgb: '210,220,255' },
  landmarks: [
    { at: 0.22, polys: [{ pts: [[-26,0],[26,0],[22,170],[17,300],[9,345],[3,372],[1,440],[-1,440],[-3,372],[-9,345],[-17,300],[-22,170]] }], windows: [[-20, 20, 10, 300]], beacon: [0, 440] }, // Merdeka 118
    { at: 0.42, polys: [{ pts: [[-24,0],[24,0],[23,265],[16,300],[4,312],[-4,312],[-16,300],[-23,265]] }], windows: [[-19, 19, 10, 255]] }, // The Exchange 106
    {
      at: 0.66, // Petronas Twin Towers + skybridge
      polys: [{ pts: PETRONAS, dx: -32 }, { pts: PETRONAS, dx: 32 }],
      windows: [[-45, -19, 10, 195], [19, 45, 10, 195]],
      extra: ({ ctx, x, ground, k, color }) => {
        ctx.fillRect(x - 17 * k, ground - 124 * k, 34 * k, 5 * k);
        ctx.strokeStyle = `rgb(${color})`;
        ctx.lineWidth = 2.5 * k;
        ctx.beginPath();
        ctx.moveTo(x, ground - 120 * k); ctx.lineTo(x - 17 * k, ground - 78 * k);
        ctx.moveTo(x, ground - 120 * k); ctx.lineTo(x + 17 * k, ground - 78 * k);
        ctx.stroke();
      },
    },
    {
      at: 0.9, // KL Tower: shaft, pod, deck, antenna
      polys: [{ pts: [[-4,0],[4,0],[3,200],[-3,200]] }],
      beacon: [0, 320],
      extra: ({ ctx, x, ground, k }) => {
        ctx.beginPath(); ctx.ellipse(x, ground - 214 * k, 24 * k, 13 * k, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(x - 9 * k, ground - 236 * k, 18 * k, 12 * k);
        ctx.fillRect(x - 1.2 * k, ground - 320 * k, 2.4 * k, 86 * k);
      },
    },
  ],
};

// ============================== MELBOURNE ==============================
const MELBOURNE: SkylineDef = {
  tallest: 405,
  glow: { landmark: 3, y: 360, rgb: '255,214,140' }, // Eureka's gold crown
  landmarks: [
    {
      at: 0.1, // Arts Centre spire: lattice cone on a base, lit up at night
      polys: [{ pts: [[-16,0],[16,0],[16,38],[-16,38]] }, { pts: [[-11,38],[11,38],[1,205],[-1,205]] }],
      beacon: [0, 205],
      extra: ({ ctx, x, ground, k, night }) => {
        // lattice criss-cross
        ctx.strokeStyle = night > 0.3 ? `rgba(200,225,255,${0.35 + 0.5 * night})` : 'rgba(255,255,255,.18)';
        ctx.lineWidth = 0.8 * k;
        ctx.beginPath();
        for (let y = 50; y < 190; y += 16) {
          const w0 = 11 * (1 - (y - 38) / 167), w1 = 11 * (1 - (y + 16 - 38) / 167);
          ctx.moveTo(x - w0 * k, ground - y * k); ctx.lineTo(x + w1 * k, ground - (y + 16) * k);
          ctx.moveTo(x + w0 * k, ground - y * k); ctx.lineTo(x - w1 * k, ground - (y + 16) * k);
        }
        ctx.stroke();
      },
    },
    {
      at: 0.33, // Rialto Towers: tall + shorter twin with angled tops
      polys: [
        { pts: [[-20,0],[20,0],[20,292],[8,300],[-20,300]], dx: -14 },
        { pts: [[-17,0],[17,0],[17,222],[-17,232]], dx: 26 },
      ],
      windows: [[-32, 4, 10, 285], [11, 41, 10, 215]],
      beacon: [-14, 300],
    },
    {
      at: 0.44, // Flinders Street Station: long facade, dome, clock tower (in front)
      front: true,
      polys: [
        { pts: [[-80,0],[80,0],[80,26],[-80,26]] },
        { pts: [[30,0],[44,0],[44,62],[40,62],[37,74],[34,62],[30,62]] }, // clock tower
      ],
      extra: ({ ctx, x, ground, k, night }) => {
        ctx.beginPath(); ctx.arc(x - 18 * k, ground - 26 * k, 17 * k, Math.PI, 0); ctx.fill(); // dome
        ctx.fillRect(x - 19 * k, ground - 49 * k, 2 * k, 7 * k);
        // clock face + the arched windows glow warm at night
        ctx.fillStyle = night > 0.2 ? `rgba(255,220,150,${0.5 + 0.5 * night})` : 'rgba(255,255,255,.25)';
        ctx.beginPath(); ctx.arc(x + 37 * k, ground - 52 * k, 3.2 * k, 0, Math.PI * 2); ctx.fill();
        if (night > 0.2) {
          ctx.fillStyle = `rgba(255,200,110,${0.55 * night})`;
          for (let wx = -74; wx <= 74; wx += 10) if (Math.abs(wx + 18) > 14) ctx.fillRect(x + wx * k, ground - 18 * k, 4 * k, 8 * k);
          // the famous strings of lights along the roofline
          ctx.fillStyle = `rgba(255,230,170,${0.8 * night})`;
          for (let wx = -80; wx <= 80; wx += 4) ctx.fillRect(x + wx * k, ground - 27 * k, 1.4 * k, 1.4 * k);
        }
      },
    },
    {
      at: 0.6, // Eureka Tower, with its gold crown
      polys: [{ pts: [[-21,0],[21,0],[21,330],[-21,345]] }],
      windows: [[-17, 17, 10, 320]],
      beacon: [0, 378],
      extra: ({ ctx, x, ground, k, night }) => {
        ctx.fillStyle = `rgba(212,168,72,${0.55 + 0.4 * night})`; // gold glass crown
        ctx.beginPath();
        ctx.moveTo(x - 21 * k, ground - 345 * k); ctx.lineTo(x + 21 * k, ground - 330 * k);
        ctx.lineTo(x + 15 * k, ground - 372 * k); ctx.lineTo(x - 15 * k, ground - 378 * k);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = `rgba(200,40,40,${0.5 + 0.3 * night})`; // the red stripe
        ctx.fillRect(x - 3 * k, ground - 340 * k, 3 * k, 300 * k);
      },
    },
    {
      at: 0.82, // Australia 108, with its "starburst" bulge two-thirds up
      polys: [{ pts: [[-24,0],[24,0],[22,250],[35,262],[35,274],[21,286],[18,382],[9,405],[-9,405],[-18,382],[-21,286],[-35,274],[-35,262],[-22,250]] }],
      windows: [[-19, 19, 10, 240], [-16, 16, 292, 375]],
      beacon: [0, 405],
    },
  ],
};

const DEFS: Record<City['id'], SkylineDef> = { kl: KL, melbourne: MELBOURNE };

interface Block { x: number; w: number; h: number; step: boolean }
interface Win { cx: number; x: number; y: number; layer: 'lm' | 'near'; phase: number; speed: number; on: number }

export class Skyline {
  private def: SkylineDef = KL;
  private far: Block[] = [];
  private near: Block[] = [];
  private windows: Win[] = [];
  private width = 0;

  get tallest() { return this.def.tallest; }

  /** Rebuild for a city + screen width. A seeded random keeps each city identical on every visit. */
  layout(width: number, city: City['id']) {
    this.def = DEFS[city];
    this.width = width;
    let seed = city === 'kl' ? 11 : 37;
    const rand = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const blocks = (n: number, minH: number, maxH: number): Block[] =>
      Array.from({ length: n }, () => ({ x: rand() * width, w: 18 + rand() * 34, h: minH + rand() * (maxH - minH), step: rand() < 0.3 }));
    this.far = blocks(Math.round(width / 24), 40, 170);
    this.near = blocks(Math.round(width / 38), 20, 110);
    this.windows = [];
    const add = (cx: number, [x0, x1, y0, y1]: Rect, layer: Win['layer']) => {
      for (let y = y0; y < y1; y += 9)
        for (let x = x0; x < x1; x += 6)
          if (rand() < 0.55) this.windows.push({ cx, x, y, layer, phase: rand() * 6.3, speed: 0.2 + rand() * 0.6, on: rand() });
    };
    for (const l of this.def.landmarks) for (const r of l.windows ?? []) add(this.xOf(l), r, 'lm');
    for (const b of this.near) add(b.x, [3, b.w - 3, 6, b.h - 6], 'near');
  }

  private xOf(l: LandmarkDef) { return this.width * 0.06 + l.at * this.width * 0.88; }

  /**
   * @param darkness 0 = daytime blue-grey, 1 = black night silhouettes
   * @param parallax mouse offset from the centre, in px (0 on touch screens)
   */
  draw(ctx: CanvasRenderingContext2D, ground: number, k: number, darkness: number, parallax: number, t: number) {
    const night = Math.max(0, Math.min(1, (darkness - 0.45) / 0.35));
    const mix = (a: number[], b: number[]) => a.map((v, i) => Math.round(v + (b[i] - v) * darkness)).join(',');
    const farC = mix([150, 170, 195], [22, 24, 44]);
    const nearC = mix([95, 115, 145], [10, 11, 24]);
    const lmC = mix([80, 98, 128], [8, 9, 20]);
    const offFar = parallax * -0.006, offLm = parallax * -0.012, offNear = parallax * -0.02;

    ctx.fillStyle = `rgb(${farC})`;
    for (const b of this.far) ctx.fillRect(b.x + offFar, ground - b.h * k, b.w * k, b.h * k);

    // soft glow behind the star landmark at night
    const glow = this.def.glow;
    if (glow && night > 0) {
      const cx = this.xOf(this.def.landmarks[glow.landmark]) + offLm, cy = ground - glow.y * k, r = 170 * k;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(${glow.rgb},${0.22 * night})`);
      g.addColorStop(1, `rgba(${glow.rgb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }

    const paintLandmark = (l: LandmarkDef) => {
      const p: Paint = { ctx, x: this.xOf(l) + offLm, ground, k, color: lmC, night, t };
      ctx.fillStyle = `rgb(${lmC})`;
      for (const poly of l.polys) fill(p, poly.pts, poly.dx);
      if (l.extra) { ctx.fillStyle = `rgb(${lmC})`; l.extra(p); }
    };
    for (const l of this.def.landmarks) if (!l.front) paintLandmark(l);

    ctx.fillStyle = `rgb(${nearC})`;
    for (const b of this.near) {
      ctx.fillRect(b.x + offNear, ground - b.h * k, b.w * k, b.h * k);
      if (b.step) ctx.fillRect(b.x + offNear + b.w * k * 0.25, ground - (b.h + 10) * k, b.w * k * 0.5, 10 * k);
    }
    for (const l of this.def.landmarks) if (l.front) paintLandmark(l);

    // windows switch on after sunset and slowly flicker
    if (night > 0) {
      for (const w of this.windows) {
        if (w.on <= 0.35 + 0.25 * Math.sin(t * w.speed * 0.3 + w.phase)) continue;
        const a = night * (0.55 + 0.3 * Math.sin(t * 2 + w.phase));
        ctx.fillStyle = w.layer === 'lm' ? `rgba(255,226,170,${a})` : `rgba(255,205,130,${a})`;
        ctx.fillRect(w.cx + w.x * k + (w.layer === 'lm' ? offLm : offNear), ground - w.y * k, 2.2 * k, 3 * k);
      }
    }

    // blinking red aircraft warning lights
    const blink = Math.sin(t * 3) > 0.2 ? 1 : 0.15;
    ctx.fillStyle = `rgba(255,60,60,${blink * (0.35 + 0.65 * night)})`;
    for (const l of this.def.landmarks) {
      if (!l.beacon) continue;
      ctx.beginPath();
      ctx.arc(this.xOf(l) + l.beacon[0] * k + offLm, ground - l.beacon[1] * k, 2.6 * k, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
