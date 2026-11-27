// Parmak hareketlerini okumak (DOM yok): kaydırma yönü, kesik çizgisi, işaret (rün) tanıma.
// Noktalar ekran pikseli; t milisaniye.
import type { Config } from "./config";

export interface P { x: number; y: number; t: number }
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function pathLength(pts: { x: number; y: number }[]): number {
  let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return L;
}

/* ---------- kaydırma ---------- */
export interface Swipe { angle: number; len: number; straight: number; dur: number }
/** Açı derece: 0 = sağa, 90 = aşağı (ekran koordinatı). straight: düz çizgiye yakınlık 0–1. */
export function swipeOf(pts: P[]): Swipe {
  if (pts.length < 2) return { angle: 0, len: 0, straight: 0, dur: 0 };
  const a = pts[0], b = pts[pts.length - 1];
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  return { angle: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI, len, straight: len / Math.max(1, pathLength(pts)), dur: b.t - a.t };
}
export function angleDiff(a: number, b: number): number { const d = Math.abs(((a - b) % 360 + 540) % 360 - 180); return d; }
/** İstenen yöne kaydırma kalitesi: yön sapması, uzunluk ve düzlük. tol derecesi beceriyle genişler. */
export function dirScore(sw: Swipe, want: number, tol: number, minLen = 40): number {
  if (sw.len < minLen) return 0;
  const d = angleDiff(sw.angle, want); if (d > tol) return 0;
  return clamp01((1 - d / tol) * 0.7 + sw.straight * 0.3 + 0.1);
}

/* ---------- kesik: çizgi bir daireden geçti mi ---------- */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax, vy = by - ay; const L2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / L2));
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
}
export function strokeHits(pts: { x: number; y: number }[], cx: number, cy: number, r: number): boolean {
  if (pts.length === 1) return Math.hypot(pts[0].x - cx, pts[0].y - cy) <= r;
  for (let i = 1; i < pts.length; i++) if (segDist(cx, cy, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y) <= r) return true;
  return false;
}
/**
 * Kesik kalitesi: gövdeyi kesmeli; hızlı ve düz olmalı. Zayıf noktadan geçerse tam not.
 * body: gövde daireleri; weak: nişan alınan nokta (varsa). ease: beceri çarpanı (hız toleransı).
 */
export function slashScore(pts: P[], body: { x: number; y: number; r: number }[], weak: { x: number; y: number; r: number } | undefined, ease: number): { q: number; weak: boolean } {
  const sw = swipeOf(pts);
  if (sw.len < 50 || !body.some(c => strokeHits(pts, c.x, c.y, c.r))) return { q: 0, weak: false };
  const speed = sw.len / Math.max(1, sw.dur);                 // px/ms
  const fast = clamp01((speed - 0.25) / (0.9 / ease));        // ağır kesik zayıf
  const q = clamp01(0.35 + fast * 0.35 + sw.straight * 0.3);
  const hitWeak = !!weak && strokeHits(pts, weak.x, weak.y, weak.r * ease);
  return { q: hitWeak ? Math.max(1, q) : Math.min(0.85, q), weak: hitWeak };
}

/* ---------- işaret (rün) tanıma: tek çizgi, $1 benzeri ---------- */
/** Element işaretleri: 0–1 karede tek çizgi. Annenin defterindeki sayfalarla aynı. */
export const RUNES: Record<string, { name: string; pts: [number, number][] }> = {
  el_ates: { name: "Alev", pts: [[0, 1], [0.17, 0.35], [0.33, 0.75], [0.5, 0], [0.67, 0.75], [0.83, 0.35], [1, 1]] },
  el_su: { name: "Dalga", pts: Array.from({ length: 17 }, (_, i) => [i / 16, 0.5 - Math.sin(i / 16 * Math.PI * 4) * 0.35] as [number, number]) },
  el_toprak: { name: "Kaya", pts: [[0, 1], [0, 0.15], [0.5, 0], [1, 0.15], [1, 1]] },
  el_hava: { name: "Girdap", pts: Array.from({ length: 25 }, (_, i) => { const a = i / 24 * Math.PI * 3.2, r = 0.08 + i / 24 * 0.42; return [0.5 + Math.cos(a) * r, 0.5 + Math.sin(a) * r] as [number, number]; }) },
  el_ayaz: { name: "Kristal", pts: [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5], [0.5, 0]] },
  el_simsek: { name: "Yıldırım", pts: [[0.65, 0], [0.2, 0.5], [0.75, 0.5], [0.3, 1]] },
  // biçim işaretleri: büyünün en son çizilen işareti (content/synthesis.ts FORMS)
  f_top: { name: "Hilal", pts: Array.from({ length: 19 }, (_, i) => { const a = -Math.PI * 0.25 - i / 18 * Math.PI * 1.5; return [0.5 + Math.cos(a) * 0.5, 0.5 - Math.sin(a) * 0.5] as [number, number]; }) },
  f_duvar: { name: "Yatay çizgi", pts: [[0, 0.5], [1, 0.5]] },
  f_perde: { name: "Dikey çizgi", pts: [[0.5, 0], [0.5, 1]] },
  f_akinti: { name: "Köşe", pts: [[0, 0], [0, 1], [1, 1]] },
  f_zincir: { name: "Sekiz", pts: Array.from({ length: 33 }, (_, i) => { const t = i / 32 * Math.PI * 2; return [0.5 + Math.sin(t) * 0.5, 0.5 + Math.sin(2 * t) * 0.3] as [number, number]; }) },
  f_firlat: { name: "Çatı", pts: [[0, 1], [0.5, 0], [1, 1]] },
};
export const ELEMENT_RUNES = ["el_ates", "el_su", "el_toprak", "el_hava", "el_ayaz", "el_simsek"];
export const FORM_RUNES = ["f_top", "f_duvar", "f_akinti", "f_zincir", "f_perde", "f_firlat"];
function resample(pts: { x: number; y: number }[], n: number): { x: number; y: number }[] {
  const I = pathLength(pts) / (n - 1); if (!I) return Array(n).fill(pts[0]);
  const src = pts.map(p => ({ x: p.x, y: p.y })); const out = [src[0]]; let D = 0;
  for (let i = 1; i < src.length; i++) {
    const d = Math.hypot(src[i].x - src[i - 1].x, src[i].y - src[i - 1].y);
    if (D + d >= I && d > 0) {
      const t = (I - D) / d; const q = { x: src[i - 1].x + t * (src[i].x - src[i - 1].x), y: src[i - 1].y + t * (src[i].y - src[i - 1].y) };
      out.push(q); src.splice(i, 0, q); D = 0;
    } else D += d;
  }
  while (out.length < n) out.push(src[src.length - 1]);
  return out.slice(0, n);
}
/** Boyut ve yerden bağımsız hâle getir: en uzun kenar 1, ağırlık merkezi 0. */
function normalize(pts: { x: number; y: number }[]): { x: number; y: number }[] {
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys); const s = Math.max(w, h) || 1;
  const cx = xs.reduce((a, b) => a + b, 0) / pts.length, cy = ys.reduce((a, b) => a + b, 0) / pts.length;
  return pts.map(p => ({ x: (p.x - cx) / s, y: (p.y - cy) / s }));
}
const N = 32;
const tmpl = new Map<string, { x: number; y: number }[]>();
function template(id: string) {
  let t = tmpl.get(id); if (!t) { t = normalize(resample(RUNES[id].pts.map(([x, y]) => ({ x, y })), N)); tmpl.set(id, t); } return t;
}
/** Çizimin bir işarete benzerliği 0–1 (iki yönde de çizilebilir). ease: beceri toleransı. */
export function runeScore(pts: { x: number; y: number }[], id: string, ease = 1): number {
  if (pts.length < 2 || pathLength(pts) < 40) return 0;
  const c = normalize(resample(pts, N)); const t = template(id);
  const d1 = c.reduce((a, p, i) => a + Math.hypot(p.x - t[i].x, p.y - t[i].y), 0) / N;
  const d2 = c.reduce((a, p, i) => a + Math.hypot(p.x - t[N - 1 - i].x, p.y - t[N - 1 - i].y), 0) / N;
  return clamp01(1 - (Math.min(d1, d2) - 0.06) / (0.2 * ease));
}
export function recognize(pts: { x: number; y: number }[], ids = Object.keys(RUNES), ease = 1): { id: string; q: number } {
  let best = { id: ids[0], q: 0 };
  for (const id of ids) { const q = runeScore(pts, id, ease); if (q > best.q) best = { id, q }; }
  return best;
}
/** Bir büyü için çizilecek işaretler: birleşimler temel elementlere açılır (magma → alev + kaya). */
export function spellRunes(cfg: Config, sources: string[]): string[] {
  const out: string[] = [];
  const open = (id: string, depth = 0) => {
    if (RUNES[id]) { out.push(id); return; }
    const c = cfg.combo.get(id); if (!c || depth > 3) return;
    for (const ing of c.ingredients) open(ing.id, depth + 1);
  };
  for (const s of sources) open(s);
  return out;
}
/** Rün dizisinden büyü kalitesi: en zayıf halka belirler. */
export function castQuality(scores: number[]): number { return scores.length ? Math.min(...scores) : 0; }
