// Şimşek efekti: kırılan ana hat + dallar, üç katman parlama, vuruş patlaması, kıvılcım.
// Geometri saf ve tohumludur (test edilir); çizim canvas'a eklemeli (lighter) karışımla yapılır.
export type Pt = [number, number];
export interface Bolt { main: Pt[]; forks: Pt[][]; seed: number }

function rng(seed: number) { let a = seed | 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Orta nokta kaydırma: iki nokta arasında kırık bir çizgi. */
function jag(a: Pt, b: Pt, rough: number, depth: number, r: () => number): Pt[] {
  if (depth === 0) return [a, b];
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; const dx = b[0] - a[0], dy = b[1] - a[1]; const L = Math.hypot(dx, dy) || 1;
  const off = (r() - 0.5) * rough * L; const m: Pt = [mx - dy / L * off, my + dx / L * off];
  return [...jag(a, m, rough, depth - 1, r).slice(0, -1), ...jag(m, b, rough, depth - 1, r)];
}
/** Bir çakma: uçlar tam yerinde; dallar ana hattın bir noktasından çıkar. */
export function bolt(from: Pt, to: Pt, seed: number, opts: { rough?: number; forks?: number; depth?: number } = {}): Bolt {
  const r = rng(seed); const depth = opts.depth ?? 5;
  const main = jag(from, to, opts.rough ?? 0.42, depth, r);
  const forks: Pt[][] = []; const L = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const n = opts.forks ?? 3;
  for (let i = 0; i < n; i++) {
    const idx = 3 + Math.floor(r() * Math.max(1, main.length - 8)); const s = main[Math.min(idx, main.length - 2)];
    const ang = Math.atan2(to[1] - from[1], to[0] - from[0]) + (r() - 0.5) * 1.7; const len = L * (0.14 + r() * 0.2);
    forks.push(jag(s, [s[0] + Math.cos(ang) * len, s[1] + Math.sin(ang) * len], 0.5, Math.max(2, depth - 2), r));
  }
  return { main, forks, seed };
}
/** Zincir: noktalar sırayla bağlanır; her halka bir önceki halkadan kısa bir gecikmeyle çakar. */
export function chain(points: Pt[], seed: number): { bolt: Bolt; delay: number }[] {
  const out: { bolt: Bolt; delay: number }[] = [];
  for (let i = 1; i < points.length; i++) out.push({ bolt: bolt(points[i - 1], points[i], seed * 31 + i, { forks: 2, rough: 0.5, depth: 4 }), delay: (i - 1) * 70 });
  return out;
}
/** Gökten düşen çakma: hedefin üstünden başlar. */
export function skyBolt(target: Pt, topY: number, seed: number): Bolt { return bolt([target[0] + (rng(seed)() - 0.5) * 30, topY], target, seed, { rough: 0.3, forks: 4, depth: 6 }); }

export interface BoltFx { b: Bolt; t0: number; delay: number; dur: number; color?: string }
const path = (g: CanvasRenderingContext2D, pts: Pt[]) => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); };
/** Yaşa göre parlaklık: ilk anda sert, sonra iki kez titreyerek söner. */
export function boltLife(age: number): number { if (age < 0 || age > 1) return 0; const f = age < 0.12 ? 1 : 1 - (age - 0.12) / 0.88; return Math.max(0, f * (age > 0.3 && age < 0.4 ? 0.45 : age > 0.55 && age < 0.62 ? 0.6 : 1)); }
/** Dört katman: koyu kontur (açık zeminde okunur), mavi gövde, parlak hale, beyaz çekirdek. Normal karışım: hem kâğıtta hem gecede görünür. */
export function drawBolt(g: CanvasRenderingContext2D, fx: BoltFx, now: number, scale = 1): boolean {
  const age = (now - fx.t0 - fx.delay) / fx.dur; if (age >= 1) return false; if (age < 0) return true;
  const life = boltLife(age); if (life <= 0) return true;
  const tint = fx.color ?? "90,150,255";
  g.save(); g.lineCap = "round"; g.lineJoin = "round"; g.shadowColor = `rgba(${tint},${0.9 * life})`; g.shadowBlur = 18 * scale;
  const layers: [number, string][] = [[7.5, `rgba(20,36,96,${0.75 * life})`], [5, `rgba(${tint},${0.95 * life})`], [2.2, `rgba(255,255,255,${life})`]];
  for (const [w, c] of layers) { g.strokeStyle = c; g.lineWidth = w * scale; path(g, fx.b.main); g.lineWidth = w * scale * 0.55; for (const f of fx.b.forks) path(g, f); }
  g.restore(); return true;
}
export interface Impact { x: number; y: number; t0: number; r: number; sparks: { a: number; v: number }[]; color?: string }
export function impact(x: number, y: number, r: number, seed: number, now: number): Impact {
  const q = rng(seed); return { x, y, t0: now, r, sparks: Array.from({ length: 10 }, () => ({ a: q() * Math.PI * 2, v: 0.5 + q() * 1.1 })) };
}
export function drawImpact(g: CanvasRenderingContext2D, i: Impact, now: number): boolean {
  const k = (now - i.t0) / 420; if (k >= 1) return false; if (k < 0) return true;
  const col = i.color ?? "110,160,255"; const R = i.r * (0.5 + k);
  g.save();
  const gr = g.createRadialGradient(i.x, i.y, 0, i.x, i.y, Math.max(1, R)); gr.addColorStop(0, `rgba(255,255,255,${0.95 * (1 - k)})`); gr.addColorStop(0.3, `rgba(${col},${0.55 * (1 - k)})`); gr.addColorStop(1, `rgba(${col},0)`);
  g.fillStyle = gr; g.beginPath(); g.arc(i.x, i.y, Math.max(1, R), 0, 7); g.fill();
  g.lineCap = "round";
  for (const s of i.sparks) { const d = s.v * i.r * k; const x1 = i.x + Math.cos(s.a) * d * 0.6, y1 = i.y + Math.sin(s.a) * d * 0.6, x2 = i.x + Math.cos(s.a) * d, y2 = i.y + Math.sin(s.a) * d;
    g.strokeStyle = `rgba(20,36,96,${0.8 * (1 - k)})`; g.lineWidth = 4; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    g.strokeStyle = `rgba(255,255,255,${1 - k})`; g.lineWidth = 1.8; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
  g.restore(); return true;
}
