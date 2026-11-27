// Gizlenme (gerçek zamanlı): aşağıdan başlarsın, yukarıdaki hedefe görünmeden varmalısın.
// İnsanlar gözle görür (önlerinde bir görüş konisi; gece kısalır), kurtlar kokuyla da bulur
// (rüzgâr kokunu taşır). Duvar ve kaya görüşü keser; çalının içindeyken uzaktan görünmezsin.
// Koşarsan ses çıkar. Taş atıp bakışları başka yere çekebilirsin. Kuşku dolarsa yakalanırsın.
// Saf simülasyon: stepStealth(dt) zamanı ilerletir; çizim ve dokunma arayüzdedir (DOM yok).
import type { Config } from "./config";
import type { GameState } from "./state";
import { DAY_MINUTES } from "./state";
import { applyGain, type GainReport } from "./progression";
import { Rng } from "./rng";
import { ENEMIES } from "../content/world";
import { isBoss, isHuman } from "./encounter";

export const FIELD = { w: 100, h: 160 };
export const PLAYER_R = 2.6;
export interface Block { x: number; y: number; w: number; h: number; kind: "duvar" | "kaya" | "cali" }
export interface Watcher {
  id: number; def: string; human: boolean; boss: boolean; x: number; y: number; dir: number;
  path: [number, number][]; pi: number; wait: number; speed: number;
  sus: number;                         // bu bekçinin kuşkusu 0–1
  look?: { x: number; y: number; t: number }; // dikkatini çeken nokta (taş, ses, gölge)
  sees: boolean; smells: boolean;
}
export type StealthGoal = "sizma" | "pusu" | "kacis";
export type StealthFx = { k: "taş"; x: number; y: number } | { k: "kuşku"; id: number } | { k: "görüldü" } | { k: "vardı" };
export interface Stealth {
  goal: StealthGoal; phase: "play" | "won" | "lost"; time: number;
  px: number; py: number; target?: { x: number; y: number }; run: boolean;
  blocks: Block[]; watchers: Watcher[]; exit: { x: number; y: number; w: number; h: number };
  wind: { x: number; y: number }; night: boolean; skill: number; stones: number;
  seed: number; fx: StealthFx[]; stats: { closest: number; stones: number; ran: number; hidden: number };
}

const lv = (s: GameState, a: string) => s.attrs[a]?.level ?? 10;
/** Sinsilik: çevre farkındalığı, mekân, irade ve aldatma (iz şaşırtma, oyalama). Kuşkunun ne hızla dolduğunu belirler. */
export function stealthSkill(s: GameState): number {
  const v = (lv(s, "cevresel") + lv(s, "mekansal") + lv(s, "irade") + lv(s, "isitme") + lv(s, "aldatma")) / 5;
  const cat = s.pet?.id === "kedi" ? (s.pet.bond >= 75 ? 0.75 : 0.88) : 1;
  return Math.max(0.45, Math.min(1.25, (1.3 - v / 45) * cat));
}

/* ---------- kurulum: her seferinde başka bir arazi ---------- */
export function createStealth(s: GameState, foes: string[], goal: StealthGoal, seed: number, night: boolean): Stealth {
  const rng = new Rng(seed);
  const human = foes.some(isHuman);
  const blocks: Block[] = [];
  // engel sıraları: her sırada en az bir geçit bırakılır, böylece hep bir yol vardır
  const rows = [36, 66, 96, 124];
  for (const y of rows) {
    const gap = 14 + rng.next() * 72, gw = 16 + rng.next() * 6;
    const parts: [number, number][] = [[2, gap - gw / 2], [gap + gw / 2, 98]];
    for (const [a, b] of parts) {
      if (b - a < 8) continue;
      // parçanın bir kısmını kapla; geri kalanı açık kalsın
      const len = Math.min(b - a, 10 + rng.next() * (b - a) * 0.8); const x = a + rng.next() * (b - a - len);
      const kind: Block["kind"] = human ? (rng.chance(65) ? "duvar" : "kaya") : (rng.chance(55) ? "kaya" : "cali");
      blocks.push({ x, y: y - 2.5, w: len, h: kind === "duvar" ? 4 : 6 + rng.next() * 3, kind });
    }
  }
  // dağınık çalılar: saklanma yerleri
  for (let i = 0; i < 7; i++) {
    const w = 9 + rng.next() * 7, h = 6 + rng.next() * 4;
    const x = 4 + rng.next() * (FIELD.w - w - 8), y = 20 + rng.next() * 118;
    if (blocks.some(b => b.kind !== "cali" && x < b.x + b.w + 2 && x + w > b.x - 2 && y < b.y + b.h + 2 && y + h > b.y - 2)) continue;
    blocks.push({ x, y, w, h, kind: "cali" });
  }
  // bekçiler: sıralar arasında devriye gezerler
  const bands = [[18, 32], [42, 62], [72, 92], [102, 120]];
  const n = Math.min(6, foes.length);
  const watchers: Watcher[] = foes.slice(0, n).map((def, i) => {
    const band = bands[(i + (n < 3 ? 1 : 0)) % bands.length]; const hum = isHuman(def); const boss = isBoss(def);
    const y = band[0] + rng.next() * (band[1] - band[0]);
    let path: [number, number][];
    if (boss) { const x = 25 + rng.next() * 50; path = [[x, y]]; }                       // lider yerinde durur, etrafa bakar
    else if (hum) { const a = 8 + rng.next() * 30, b = 62 + rng.next() * 30; path = rng.chance(50) ? [[a, y], [b, y]] : [[b, y], [a, y]]; }
    else path = Array.from({ length: 4 }, () => [8 + rng.next() * 84, band[0] + rng.next() * (band[1] - band[0])] as [number, number]);
    const d = ENEMIES[def];
    return { id: i + 1, def, human: hum, boss, x: path[0][0], y: path[0][1], dir: rng.next() < 0.5 ? 0 : Math.PI, path, pi: 0, wait: rng.next() * 1.5,
      speed: hum ? 7 : 9 * ((d?.move ?? 4) / 4), sus: 0, sees: false, smells: false };
  });
  const ex = 20 + rng.next() * 60;
  const wa = rng.next() * Math.PI * 2;
  return {
    goal, phase: "play", time: 0, px: 50, py: FIELD.h - 8, run: false, blocks, watchers,
    exit: { x: ex - 10, y: 2, w: 20, h: 9 }, wind: { x: Math.cos(wa), y: Math.sin(wa) }, night, skill: stealthSkill(s), stones: 3,
    seed: rng.seed, fx: [], stats: { closest: 99, stones: 0, ran: 0, hidden: 0 },
  };
}

/* ---------- geometri ---------- */
const inRect = (x: number, y: number, b: { x: number; y: number; w: number; h: number }, pad = 0) => x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad;
function segHitsRect(x1: number, y1: number, x2: number, y2: number, b: Block): boolean {
  // örnekleme: kısa mesafeler için yeterli ve sade
  const L = Math.hypot(x2 - x1, y2 - y1); const n = Math.max(2, Math.ceil(L / 1.5));
  for (let i = 1; i < n; i++) { const t = i / n; if (inRect(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, b)) return true; }
  return false;
}
/** Bekçiden oyuncuya bakış açık mı: duvar ve kaya keser. */
export function lineOfSight(st: Stealth, x1: number, y1: number, x2: number, y2: number): boolean {
  return !st.blocks.some(b => b.kind !== "cali" && segHitsRect(x1, y1, x2, y2, b));
}
export const inBush = (st: Stealth, x = st.px, y = st.py) => st.blocks.some(b => b.kind === "cali" && inRect(x, y, b));
/** Görüş: menzil ve koninin yarı açısı. Gece insan gözü kısalır; kurt pek etkilenmez. */
export function sight(st: Stealth, w: Watcher): { range: number; half: number } {
  const base = w.human ? 34 : 24; const night = st.night ? (w.human ? 0.6 : 0.9) : 1;
  return { range: base * night * (w.boss ? 1.15 : 1) * (w.sus > 0.5 ? 1.2 : 1), half: w.human ? 0.55 : 0.75 };
}
const angDiff = (a: number, b: number) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return Math.abs(d); };
export function canSee(st: Stealth, w: Watcher): boolean {
  const dx = st.px - w.x, dy = st.py - w.y, d = Math.hypot(dx, dy); const { range, half } = sight(st, w);
  if (d > range) return false;
  if (d > 4 && angDiff(Math.atan2(dy, dx), w.dir) > half) return false;
  if (inBush(st) && d > 7 && !st.run) return false;
  return lineOfSight(st, w.x, w.y, st.px, st.py);
}
/** Koku: kurtlar yakındakini, rüzgâr kokunu onlara doğru taşıyorsa uzaktakini de alır. */
export function canSmell(st: Stealth, w: Watcher): boolean {
  if (w.human) return false;
  const dx = w.x - st.px, dy = w.y - st.py, d = Math.hypot(dx, dy) || 1;
  const down = (dx / d) * st.wind.x + (dy / d) * st.wind.y; // 1: rüzgâr kokunu tam ona götürüyor
  return d < 10 + Math.max(0, down) * 16;
}

/* ---------- oyuncu ---------- */
export function moveTo(st: Stealth, x: number, y: number) { st.target = { x: Math.max(2, Math.min(FIELD.w - 2, x)), y: Math.max(2, Math.min(FIELD.h - 2, y)) }; }
export function stop(st: Stealth) { st.target = undefined; }
/** Taş at: düştüğü yere yakın bekçiler bir süre oraya bakar (kuşkulanmadan). */
export function throwStone(st: Stealth, x: number, y: number): boolean {
  if (st.stones <= 0 || st.phase !== "play") return false;
  if (Math.hypot(x - st.px, y - st.py) > 45) return false;
  st.stones--; st.stats.stones++; st.fx.push({ k: "taş", x, y });
  for (const w of st.watchers) if (Math.hypot(w.x - x, w.y - y) < 30) w.look = { x, y, t: 3.5 };
  return true;
}
function blockedAt(st: Stealth, x: number, y: number) { return st.blocks.some(b => b.kind !== "cali" && inRect(x, y, b, PLAYER_R * 0.8)); }

/* ---------- zaman ---------- */
export function stepStealth(st: Stealth, dt: number) {
  if (st.phase !== "play") return;
  dt = Math.min(dt, 0.05); st.time += dt;
  // oyuncu hareketi: çalıda yavaş, koşarken hızlı ama sesli
  if (st.target) {
    const dx = st.target.x - st.px, dy = st.target.y - st.py, d = Math.hypot(dx, dy);
    if (d < 0.6) st.target = undefined;
    else {
      const sp = (st.run ? 21 : 10) * (inBush(st) ? 0.7 : 1) * dt; const k = Math.min(1, sp / d);
      const nx = st.px + dx * k, ny = st.py + dy * k;
      if (!blockedAt(st, nx, st.py)) st.px = nx;
      if (!blockedAt(st, st.px, ny)) st.py = ny;
      if (st.run) st.stats.ran += dt;
    }
  }
  if (inBush(st)) st.stats.hidden += dt;
  // bekçiler
  for (const w of st.watchers) {
    w.sees = canSee(st, w); w.smells = canSmell(st, w);
    const d = Math.hypot(st.px - w.x, st.py - w.y); st.stats.closest = Math.min(st.stats.closest, d);
    const heard = st.run && !!st.target && d < (w.human ? 20 : 24);
    let rate = 0;
    if (w.sees) rate += (0.5 + 2.2 * (1 - d / sight(st, w).range)) * (st.run ? 1.6 : 1);
    if (w.smells) rate += 0.55;
    if (heard) rate += 0.45;
    const before = w.sus;
    if (rate > 0) { w.sus = Math.min(1, w.sus + rate * st.skill * dt); w.look = { x: st.px, y: st.py, t: 2.5 }; }
    else w.sus = Math.max(0, w.sus - 0.18 * dt);
    if (before < 0.35 && w.sus >= 0.35) st.fx.push({ k: "kuşku", id: w.id });
    if (w.sus >= 1) { st.phase = "lost"; st.fx.push({ k: "görüldü" }); return; }
    // hareket: dikkat çeken bir şey varsa ona dön (kuşku yüksekse oraya yürü), yoksa devriye
    if (w.look) {
      w.look.t -= dt; const a = Math.atan2(w.look.y - w.y, w.look.x - w.x); turn(w, a, dt * 3);
      if (w.sus > 0.55 && !w.boss) walk(st, w, w.look.x, w.look.y, dt * 0.8);
      if (w.look.t <= 0) w.look = undefined;
      continue;
    }
    if (w.wait > 0) { w.wait -= dt; w.dir += Math.sin(st.time * 1.3 + w.id) * dt * (w.boss ? 1.1 : 0.8); continue; }
    const [tx, ty] = w.path[w.pi];
    if (Math.hypot(tx - w.x, ty - w.y) < 1) { w.pi = (w.pi + 1) % w.path.length; w.wait = w.human ? 1.4 : 0.8; continue; }
    turn(w, Math.atan2(ty - w.y, tx - w.x), dt * 4); walk(st, w, tx, ty, dt);
  }
  if (inRect(st.px, st.py, st.exit)) { st.phase = "won"; st.fx.push({ k: "vardı" }); }
}
function turn(w: Watcher, a: number, k: number) { let d = a - w.dir; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; w.dir += Math.max(-k, Math.min(k, d)); }
function walk(st: Stealth, w: Watcher, tx: number, ty: number, dt: number) {
  const dx = tx - w.x, dy = ty - w.y, d = Math.hypot(dx, dy); if (d < 0.5) return;
  const k = Math.min(1, w.speed * dt / d); const nx = w.x + dx * k, ny = w.y + dy * k;
  if (!st.blocks.some(b => b.kind !== "cali" && inRect(nx, ny, b, 1.5))) { w.x = nx; w.y = ny; }
  else if (w.path.length > 1) w.pi = (w.pi + 1) % w.path.length;
}
/** En kuşkulu bekçinin kuşkusu: ekrandaki gösterge. */
export const suspicion = (st: Stealth) => st.watchers.reduce((m, w) => Math.max(m, w.sus), 0);

/** Bitince: gelişim, zaman, yorgunluk. */
export function finishStealth(cfg: Config, s: GameState, st: Stealth): { gains: GainReport; minutes: number; won: boolean } {
  const gains: GainReport = {}; const won = st.phase === "won";
  const k = won ? 1 : 0.5;
  applyGain(cfg, s, "cevresel", 0.35 * k, gains); applyGain(cfg, s, "mekansal", 0.25 * k, gains);
  applyGain(cfg, s, "isitme", 0.2 * k, gains); applyGain(cfg, s, "irade", 0.15 + (st.stats.closest < 10 ? 0.2 : 0), gains);
  if (st.stats.stones) applyGain(cfg, s, "aldatma", 0.15 * st.stats.stones, gains);
  if (st.watchers.some(w => !w.human)) applyGain(cfg, s, "koku", 0.15 * k, gains);
  applyGain(cfg, s, "stres", 0.2, gains);
  const minutes = 20 + Math.round(st.time / 6);
  s.minute = Math.min(DAY_MINUTES, s.minute + minutes);
  s.energy = Math.max(0, s.energy - 5); s.satiety = Math.max(0, s.satiety - 3);
  return { gains, minutes, won };
}
