/**
 * Stylised KL skyline. Shapes are in "units" with y going UP from the ground,
 * then scaled to the screen. Landmarks: Merdeka 118, The Exchange 106,
 * Petronas Twin Towers and KL Tower, plus generic buildings for depth.
 */

type Pt = [number, number];

const PETRONAS: Pt[] = [[-17,0],[17,0],[17,200],[15,200],[15,232],[12,232],[12,258],[9,258],[9,278],[6,278],[6,292],[2,292],[0.8,350],[-0.8,350],[-2,292],[-6,292],[-6,278],[-9,278],[-9,258],[-12,258],[-12,232],[-15,232],[-15,200],[-17,200]];
const MERDEKA_118: Pt[] = [[-26,0],[26,0],[22,170],[17,300],[9,345],[3,372],[1,440],[-1,440],[-3,372],[-9,345],[-17,300],[-22,170]];
const EXCHANGE_106: Pt[] = [[-24,0],[24,0],[23,265],[16,300],[4,312],[-4,312],[-16,300],[-23,265]];
const KL_TOWER_SHAFT: Pt[] = [[-4,0],[4,0],[3,200],[-3,200]];
export const TALLEST = 440; // Merdeka 118's spire, in units

interface Landmark { pts: Pt[]; x: number; dx?: number; windows?: [number, number, number, number]; klTower?: boolean }
interface Block { x: number; w: number; h: number; step: boolean }
interface Win { cx: number; x: number; y: number; layer: 'lm' | 'near'; phase: number; speed: number; on: number }

export class Skyline {
  private landmarks: Landmark[] = [];
  private far: Block[] = [];
  private near: Block[] = [];
  private windows: Win[] = [];

  /** Rebuild for a new screen width. A seeded random keeps the city identical on every visit. */
  layout(width: number) {
    let seed = 11;
    const rand = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const at = (f: number) => width * 0.06 + f * width * 0.88;
    this.landmarks = [
      { pts: MERDEKA_118, x: at(0.22), windows: [-20, 20, 10, 300] },
      { pts: EXCHANGE_106, x: at(0.42), windows: [-19, 19, 10, 255] },
      { pts: PETRONAS, x: at(0.66), dx: -32, windows: [-45, -19, 10, 195] },
      { pts: PETRONAS, x: at(0.66), dx: 32, windows: [19, 45, 10, 195] },
      { pts: KL_TOWER_SHAFT, x: at(0.9), klTower: true },
    ];
    const blocks = (n: number, minH: number, maxH: number): Block[] =>
      Array.from({ length: n }, () => ({ x: rand() * width, w: 18 + rand() * 34, h: minH + rand() * (maxH - minH), step: rand() < 0.3 }));
    this.far = blocks(Math.round(width / 24), 40, 170);
    this.near = blocks(Math.round(width / 38), 20, 110);

    this.windows = [];
    const addWindows = (cx: number, x0: number, x1: number, y0: number, y1: number, layer: Win['layer']) => {
      for (let y = y0; y < y1; y += 9)
        for (let x = x0; x < x1; x += 6)
          if (rand() < 0.55) this.windows.push({ cx, x, y, layer, phase: rand() * 6.3, speed: 0.2 + rand() * 0.6, on: rand() });
    };
    for (const l of this.landmarks) if (l.windows) addWindows(l.x, ...l.windows, 'lm');
    for (const b of this.near) addWindows(b.x, 3, b.w - 3, 6, b.h - 6, 'near');
  }

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
    const poly = (pts: Pt[], ox: number) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(ox + x * k, ground - y * k) : ctx.moveTo(ox + x * k, ground - y * k)));
      ctx.closePath();
      ctx.fill();
    };

    // far layer
    ctx.fillStyle = `rgb(${farC})`;
    for (const b of this.far) ctx.fillRect(b.x + offFar, ground - b.h * k, b.w * k, b.h * k);

    // soft glow behind the Twin Towers at night
    const twins = this.landmarks[2];
    if (night > 0) {
      const cx = twins.x + offLm, cy = ground - 200 * k, r = 170 * k;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(210,220,255,${0.22 * night})`);
      g.addColorStop(1, 'rgba(210,220,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }

    // landmarks
    ctx.fillStyle = `rgb(${lmC})`;
    for (const l of this.landmarks) {
      const x = l.x + (l.dx ?? 0) * k + offLm;
      poly(l.pts, x);
      if (l.klTower) {
        ctx.beginPath();
        ctx.ellipse(x, ground - 214 * k, 24 * k, 13 * k, 0, 0, Math.PI * 2); // pod
        ctx.fill();
        ctx.fillRect(x - 9 * k, ground - 236 * k, 18 * k, 12 * k); // top deck
        ctx.fillRect(x - 1.2 * k, ground - 320 * k, 2.4 * k, 86 * k); // antenna
      }
    }
    // Petronas skybridge + V legs
    const t1 = twins.x - 32 * k + offLm, t2 = twins.x + 32 * k + offLm, mid = (t1 + t2) / 2;
    ctx.fillRect(t1 + 15 * k, ground - 124 * k, t2 - t1 - 30 * k, 5 * k);
    ctx.strokeStyle = `rgb(${lmC})`;
    ctx.lineWidth = 2.5 * k;
    ctx.beginPath();
    ctx.moveTo(mid, ground - 120 * k); ctx.lineTo(t1 + 15 * k, ground - 78 * k);
    ctx.moveTo(mid, ground - 120 * k); ctx.lineTo(t2 - 15 * k, ground - 78 * k);
    ctx.stroke();

    // near layer
    ctx.fillStyle = `rgb(${nearC})`;
    for (const b of this.near) {
      ctx.fillRect(b.x + offNear, ground - b.h * k, b.w * k, b.h * k);
      if (b.step) ctx.fillRect(b.x + offNear + b.w * k * 0.25, ground - (b.h + 10) * k, b.w * k * 0.5, 10 * k);
    }

    // windows switch on after sunset and slowly flicker
    if (night > 0) {
      for (const w of this.windows) {
        if (w.on <= 0.35 + 0.25 * Math.sin(t * w.speed * 0.3 + w.phase)) continue;
        const off = w.layer === 'lm' ? offLm : offNear;
        const a = night * (0.55 + 0.3 * Math.sin(t * 2 + w.phase));
        ctx.fillStyle = w.layer === 'lm' ? `rgba(255,226,170,${a})` : `rgba(255,205,130,${a})`;
        ctx.fillRect(w.cx + w.x * k + off, ground - w.y * k, 2.2 * k, 3 * k);
      }
    }

    // blinking aircraft warning lights on the tallest tips
    const blink = Math.sin(t * 3) > 0.2 ? 1 : 0.15;
    ctx.fillStyle = `rgba(255,60,60,${blink * (0.35 + 0.65 * night)})`;
    for (const [x, y] of [[this.landmarks[0].x, TALLEST], [this.landmarks[4].x, 320]] as const) {
      ctx.beginPath();
      ctx.arc(x + offLm, ground - y * k, 2.6 * k, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
