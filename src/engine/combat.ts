// Altıgen haritada sıra tabanlı taktik savaş.
// Zemin, hava, ışık ve rüzgâr hem hareketi hem isabeti hem görüşü/koku almayı etkiler.
// Kritik vuruş: silah ustalığı + alışkınlık + türe özel anatomi + gözlem + pozisyon + pusu.
// Savaştan önce hazırlık: zaman seçimi, başlangıç noktası, keşif, rüzgârı okuma, tuzak, meşale.
// Her eylem b.events'e olay yazar; arayüz bunları sırayla canlandırır.
import type { Config } from "./config";
import { type GameState, hourOf, log, DAY_MINUTES } from "./state";
import { derived, effectiveAttr, maxMana, type Context } from "./derived";
import { Rng } from "./rng";
import { applyGain, realUse, summarize, type GainReport } from "./progression";
import { ENEMIES, GAME_ITEMS, MAPS, MAP_CHARS, TERRAIN, CONFIG_WEAPON_DAMAGE, CONFIG_ARMOR, type Terrain, type WeakPoint } from "../content/world";

export type Weather = "acik" | "yagmur" | "sis";
export type XY = [number, number];
export interface Unit {
  uid: string; side: "player" | "enemy"; def?: string; name: string;
  x: number; y: number; hp: number; maxHp: number;
  moveLeft: number; acted: boolean; slowed: number; fled?: boolean;
  blind?: number; scared?: boolean;
  alert?: boolean;      // düşman: seni fark etti mi
  defending?: boolean;  // oyuncu: savunmada
}
export type BattleEvent =
  | { k: "move"; uid: string; path: XY[] }
  | { k: "attack"; uid: string; target: string; hit: boolean; crit: boolean; dmg: number; power?: boolean; ambush?: boolean }
  | { k: "cast"; spell: string; from: XY; to: XY; fizzle: boolean; hits: { uid: string; dmg: number }[] }
  | { k: "ignite"; at: XY }
  | { k: "burn"; uid: string; dmg: number }
  | { k: "flee"; uid: string }
  | { k: "down"; uid: string }
  | { k: "push"; uid: string; from: XY; to: XY; ok: boolean; into?: string }
  | { k: "trap"; uid: string; dmg: number }
  | { k: "alert"; uid: string }
  | { k: "throw"; from: XY; to: XY; lit: boolean }
  | { k: "defend" };

export interface Battle {
  w: number; h: number; tiles: Terrain[][];
  weather: Weather; night: boolean;
  wind: { dir: number; strength: number };   // dir: rüzgârın estiği yön (0 = doğu, saat yönünde 60°)
  units: Unit[]; turn: number;
  phase: "player" | "enemy" | "won" | "lost" | "fled";
  seed: number; log: string[]; events: BattleEvent[];
  stats: { attacks: number; hits: number; crits: number; observed: number; dmgTaken: number; moves: number; casts: number; castMastery: Record<string, number>; ambushes: number; pushes: number };
  fire: Record<string, number>;   // "x,y" → kalan yanma turu
  walls: Record<string, number>;  // "x,y" → kalan buz duvarı turu
  traps: Record<string, number>;  // "x,y" → kurulu tuzak
  torch: { has: boolean; thrown: boolean };
  flock: XY;
  questId?: string;
}

/* ---------- altıgen geometri (odd-r ofset) ---------- */
const N_EVEN = [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
const N_ODD = [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]];
export const key = (x: number, y: number) => x + "," + y;
export function inside(b: { w: number; h: number }, x: number, y: number) { return x >= 0 && y >= 0 && x < b.w && y < b.h; }
export function neighbors(b: { w: number; h: number }, x: number, y: number): XY[] {
  return (y % 2 ? N_ODD : N_EVEN).map(([dx, dy]) => [x + dx, y + dy] as XY).filter(([a, c]) => inside(b, a, c));
}
function toCube(x: number, y: number) { const q = x - (y - (y & 1)) / 2; return { q, r: y, s: -q - y }; }
function fromCube(q: number, r: number): XY { return [q + (r - (r & 1)) / 2, r]; }
export function dist(x1: number, y1: number, x2: number, y2: number): number {
  const a = toCube(x1, y1), c = toCube(x2, y2);
  return Math.max(Math.abs(a.q - c.q), Math.abs(a.r - c.r), Math.abs(a.s - c.s));
}
/** a'dan b'ye bakışın tersine, b'nin arkasındaki altıgen (itme yönü). */
export function behind(ax: number, ay: number, bx: number, by: number): XY {
  const a = toCube(ax, ay), c = toCube(bx, by);
  return fromCube(c.q + (c.q - a.q), c.r + (c.r - a.r));
}
/** Ekran düzlemindeki merkez (birim altıgen); yön ve rüzgâr hesabı için. */
export function planar(x: number, y: number) { return { px: x + (y & 1 ? 0.5 : 0), py: y * 0.866 }; }
export const WIND_NAMES = ["doğuya", "güneydoğuya", "güneybatıya", "batıya", "kuzeybatıya", "kuzeydoğuya"];
function windVec(dir: number) { const a = dir * Math.PI / 3; return { x: Math.cos(a), y: Math.sin(a) }; }

/* ---------- senaryo & hazırlık ---------- */
export interface Scenario { mapId: string; enemies: string[]; weatherNow: Weather; weatherEvening: Weather; wind: { dir: number; strength: number }; seed: number }
export interface Plan { timing: "simdi" | "aksam"; start: number; scout: boolean; readWind: boolean; traps: XY[]; torch: boolean; paid?: ("scout" | "readWind")[]; ambushed?: boolean }
export const DEFAULT_PLAN: Plan = { timing: "simdi", start: 0, scout: false, readWind: false, traps: [], torch: false };

function rollWeather(rng: Rng): Weather { const r = rng.next(); return r < 0.25 ? "yagmur" : r < 0.4 ? "sis" : "acik"; }
/** Aynı gün aynı iş için aynı koşullar: tekrar açınca hava değişmez. */
export function makeScenario(s: GameState, mapId: string, enemies: string[], questId = ""): Scenario {
  let h = s.seed ^ (s.day * 2654435761); for (const c of questId) h = (h * 31 + c.charCodeAt(0)) | 0;
  const rng = new Rng(h);
  const weatherNow = rollWeather(rng);
  const weatherEvening = rng.chance(55) ? weatherNow : rollWeather(rng);
  return { mapId, enemies, weatherNow, weatherEvening, wind: { dir: rng.int(0, 5), strength: rng.int(0, 2) }, seed: rng.seed };
}

export interface PrepOption { id: "scout" | "readWind" | "trap" | "torch"; name: string; minutes: number; energy: number; money: number; ok: boolean; reason?: string; desc: string }
export function prepOptions(cfg: Config, s: GameState): PrepOption[] {
  const lv = (a: string) => s.attrs[a]?.level ?? 0;
  return [
    { id: "scout", name: "Araziyi keşfet", minutes: 30, energy: 4, money: 0, ok: true, desc: "Kurtların inini ve sayısını görürsün." },
    { id: "readWind", name: "Rüzgârı oku", minutes: 10, energy: 0, money: 0, ok: lv("koku") >= 8 || lv("analiz") >= 12, reason: "Koku 8 ya da gözlem 12 gerekir", desc: "Rüzgârın yönünü bilirsen kokunu kurtlardan saklayabilirsin." },
    { id: "trap", name: "Tuzak kur", minutes: 30, energy: 6, money: 0, ok: lv("el_becerisi") >= 10, reason: "El becerisi 10 gerekir", desc: "Haritada bir altıgene kazık-ilmek tuzağı (en çok 2)." },
    { id: "torch", name: "Meşale hazırla", minutes: 10, energy: 0, money: 2, ok: s.money >= 2, reason: "2 bakır gerekir", desc: "Gece görüşün artar; bir kez fırlatıp otu tutuşturabilirsin." },
  ];
}
const paid = (p: Plan, k: "scout" | "readWind") => p.paid?.includes(k) ?? false;
/** Keşif ve rüzgârı okumayı hemen yapar (bilgi bedava görülmesin diye zaman/enerji o an harcanır). */
export function doPrep(cfg: Config, s: GameState, questId: string, what: "scout" | "readWind") {
  s.prep ??= {};
  const today = s.prep[questId]?.day === s.day ? s.prep[questId] : { day: s.day };
  if (today[what]) return;
  today[what] = true; s.prep[questId] = today;
  if (what === "scout") { s.minute = Math.min(DAY_MINUTES, s.minute + 30); s.energy = Math.max(0, s.energy - 4); applyGain(cfg, s, "analiz", 0.3, {}); applyGain(cfg, s, "mekansal", 0.2, {}); }
  else { s.minute = Math.min(DAY_MINUTES, s.minute + 10); applyGain(cfg, s, "koku", 0.2, {}); }
}
export function prepDone(s: GameState, questId: string): { scout: boolean; readWind: boolean } {
  const p = s.prep?.[questId]; return p && p.day === s.day ? { scout: !!p.scout, readWind: !!p.readWind } : { scout: false, readWind: false };
}
export function planCost(s: GameState, p: Plan): { minutes: number; energy: number; money: number } {
  const wait = p.timing === "aksam" ? Math.max(0, (20 - 6) * 60 - s.minute) : 0;
  return {
    minutes: wait + (p.scout && !paid(p, "scout") ? 30 : 0) + (p.readWind && !paid(p, "readWind") ? 10 : 0) + p.traps.length * 30 + (p.torch ? 10 : 0),
    energy: (p.scout && !paid(p, "scout") ? 4 : 0) + p.traps.length * 6,
    money: p.torch ? 2 : 0,
  };
}

export interface Advice { good: boolean; text: string }
/** Planın getirdiği avantaj ve dezavantajlar: oyuncu kararını görerek versin. */
export function assessPlan(cfg: Config, s: GameState, sc: Scenario, p: Plan): Advice[] {
  const m = MAPS[sc.mapId]; const st = m.starts[p.start]; const out: Advice[] = [];
  const tiles = m.rows.map(r => [...r].map(c => MAP_CHARS[c] ?? "cayir"));
  const night = p.timing === "aksam" || hourOf(s) >= 20;
  const weather = p.timing === "aksam" ? sc.weatherEvening : sc.weatherNow;
  const knowsFire = s.knownElements.includes("el_ates");
  const t = tiles[st.at[1]][st.at[0]];
  if (t === "tepe") out.push({ good: true, text: "Yüksek zemin: aşağıdakilere vuruşun +8 isabetli." });
  if (st.name.startsWith("Dere")) out.push({ good: true, text: "Dere arkanda: kurtlar seni kuşatamaz." });
  if (t === "cayir" && !st.name.startsWith("Dere")) out.push({ good: false, text: "Açık arazi: kurtlar iki yandan gelebilir." });
  if (weather === "yagmur") out.push({ good: false, text: knowsFire ? "Yağmur: ateş %40 zayıf, ot tutuşmaz. Kurtlar ateşten de korkmaz." : "Yağmur: zemin kaygan, ses örtülü." });
  if (weather === "yagmur") out.push({ good: true, text: "Yağmur kokunu bastırır: kurtlar seni daha geç fark eder." });
  if (weather === "sis") out.push({ good: false, text: "Sis: görüşün kısa; kurtları geç görürsün." });
  if (night) out.push(p.torch ? { good: true, text: "Gece ama meşalen var: görüşün +2 altıgen." } : { good: false, text: "Gece: kurtlar avda ve uyanık; görüşün çok kısa." });
  else out.push({ good: true, text: "Gündüz: kurtlar inde dinleniyor; seni hemen fark etmezler." });
  if (p.readWind) {
    const w = windVec(sc.wind.dir); const a = planar(st.at[0], st.at[1]);
    const toDen = m.enemies.map(([x, y]) => { const b = planar(x, y); return { x: b.px - a.px, y: b.py - a.py }; })
      .reduce((acc, v) => ({ x: acc.x + v.x, y: acc.y + v.y }), { x: 0, y: 0 });
    const L = Math.hypot(toDen.x, toDen.y) || 1; const dot = (toDen.x * w.x + toDen.y * w.y) / L;
    if (sc.wind.strength === 0) out.push({ good: true, text: "Rüzgâr yok denecek kadar hafif: koku pek taşınmaz." });
    else if (dot > 0.4) out.push({ good: false, text: `Rüzgâr ${WIND_NAMES[sc.wind.dir]} esiyor: kokun doğrudan ine gider, seni uzaktan alırlar.` });
    else if (dot < -0.4) out.push({ good: true, text: `Rüzgâr ${WIND_NAMES[sc.wind.dir]} esiyor: kokun arkana gider. Pusu kurabilirsin.` });
    else out.push({ good: true, text: `Rüzgâr ${WIND_NAMES[sc.wind.dir]} esiyor: yandan; kokun ine az ulaşır.` });
  } else out.push({ good: false, text: "Rüzgârı bilmiyorsun: kokun seni ele verebilir." });
  if (!p.scout) out.push({ good: false, text: "Keşif yapmadın: kurtların nerede olduğunu bilmiyorsun." });
  if (p.traps.length) out.push({ good: true, text: `${p.traps.length} tuzak kurulu: basan kurt yaralanır ve topallar.` });
  if (knowsFire && weather !== "yagmur") {
    const grass = tiles.flat().filter(x => x === "uzun_ot").length;
    if (grass > 6) out.push({ good: true, text: "Kuru ot bol: bir Ateş topu yangını kurtlarla arana yayar; kurtlar ateşe girmez." });
  }
  if (s.energy < 30) out.push({ good: false, text: "Yorgunsun: isabetin ve hareketin düşük." });
  const cost = planCost(s, p);
  if (s.energy - cost.energy < 20) out.push({ good: false, text: "Hazırlık seni yoracak; savaşa yorgun girersin." });
  return out;
}

/* ---------- kurulum ---------- */
export function player(b: Battle) { return b.units.find(u => u.side === "player")!; }
export function enemies(b: Battle) { return b.units.filter(u => u.side === "enemy" && u.hp > 0 && !u.fled); }
export function unitAt(b: Battle, x: number, y: number) { return b.units.find(u => u.hp > 0 && !u.fled && u.x === x && u.y === y); }
export function unitById(b: Battle, uid: string) { return b.units.find(u => u.uid === uid); }

export function maxHp(cfg: Config, s: GameState): number {
  return Math.round(28 + effectiveAttr(cfg, s, "kardiyo") * 0.3 + effectiveAttr(cfg, s, "core") * 0.2 + effectiveAttr(cfg, s, "agri") * 0.15);
}

/** Planı uygular (zaman, yorgunluk, para) ve savaşı kurar. */
export function createBattle(cfg: Config, s: GameState, mapId: string, enemyIds: string[], seed: number, questId?: string, plan: Plan = DEFAULT_PLAN, sc?: Scenario): Battle {
  const m = MAPS[mapId]; const rng = new Rng(seed);
  sc ??= { mapId, enemies: enemyIds, weatherNow: rollWeather(rng), weatherEvening: "acik", wind: { dir: rng.int(0, 5), strength: rng.int(0, 2) }, seed };
  const cost = planCost(s, plan);
  s.minute = Math.min(DAY_MINUTES - 20, s.minute + cost.minutes);
  s.energy = Math.max(0, s.energy - cost.energy); s.money -= cost.money;
  if (plan.scout && !paid(plan, "scout")) { applyGain(cfg, s, "analiz", 0.3, {}); applyGain(cfg, s, "mekansal", 0.2, {}); }
  if (plan.readWind && !paid(plan, "readWind")) applyGain(cfg, s, "koku", 0.2, {});
  if (plan.traps.length) applyGain(cfg, s, "el_becerisi", 0.3 * plan.traps.length, {});
  const tiles = m.rows.map(r => [...r].map(c => MAP_CHARS[c] ?? "cayir"));
  const weather = plan.timing === "aksam" ? sc.weatherEvening : sc.weatherNow;
  const night = plan.timing === "aksam" || hourOf(s) >= 20 || hourOf(s) < 6;
  const hpMax = maxHp(cfg, s);
  if (!s.hp || s.hp > hpMax) s.hp = hpMax;
  if (s.mana < 0) s.mana = maxMana(cfg, s);
  const st = m.starts[plan.start] ?? m.starts[0];
  const units: Unit[] = [{ uid: "p", side: "player", name: "Sen", x: st.at[0], y: st.at[1], hp: s.hp, maxHp: hpMax, moveLeft: 0, acted: false, slowed: 0 }];
  enemyIds.forEach((id, i) => {
    const d = ENEMIES[id]; const [x, y] = m.enemies[i % m.enemies.length];
    units.push({ uid: "e" + i, side: "enemy", def: id, name: `${d.name} ${i + 1}`, x, y, hp: d.hp, maxHp: d.hp, moveLeft: 0, acted: false, slowed: 0, alert: night || !!plan.ambushed });
  });
  const traps: Record<string, number> = {};
  for (const [x, y] of plan.traps.slice(0, 2)) traps[key(x, y)] = 1;
  const b: Battle = {
    w: tiles[0].length, h: tiles.length, tiles, weather, night, wind: sc.wind, units, turn: 1, phase: "player",
    seed: rng.seed, log: [], events: [],
    stats: { attacks: 0, hits: 0, crits: 0, observed: 0, dmgTaken: 0, moves: 0, casts: 0, castMastery: {}, ambushes: 0, pushes: 0 }, questId,
    fire: {}, walls: {}, traps, torch: { has: plan.torch, thrown: false }, flock: m.flock,
  };
  startPlayerTurn(cfg, s, b);
  const opening = plan.ambushed ? "Kurt yolunu kesti; gözünü senden ayırmıyor." : night ? "Gece; kurtlar avda." : "Gündüz; kurtlar inde, seni fark etmediler.";
  b.log.unshift(`${opening} ${weather === "yagmur" ? "Yağmur yağıyor." : weather === "sis" ? "Sis var." : "Hava açık."}`);
  return b;
}

/* ---------- bağlam & değerler ---------- */
export function weatherEnv(b: Battle): string[] {
  const e: string[] = [];
  if (b.weather === "yagmur") e.push("yagmur");
  if (b.weather === "sis") e.push("sis");
  if (b.night) e.push("gece");
  return e;
}
export function ctxAt(cfg: Config, s: GameState, b: Battle, u: Unit, species?: "hayvan" | "insan"): Context {
  const t = TERRAIN[b.tiles[u.y][u.x]];
  const envIds = [...weatherEnv(b)]; if (t.env) envIds.push(t.env);
  const equipped = [s.equipped.weapon, s.equipped.armor].filter((x): x is string => !!x && cfg.item.has(x));
  return { envIds, targetSpecies: species, equipped };
}
export function moveRange(cfg: Config, s: GameState, b: Battle, u: Unit): number {
  if (u.side === "enemy") return Math.max(1, ENEMIES[u.def!].move - (u.slowed > 0 ? 2 : 0));
  const bacak = effectiveAttr(cfg, s, "bacak", ctxAt(cfg, s, b, u));
  return 3 + Math.floor(bacak / 30) - (s.energy < 20 ? 1 : 0);
}
export function sightRange(cfg: Config, s: GameState, b: Battle): number {
  const p = player(b);
  const g = effectiveAttr(cfg, s, "gorus", ctxAt(cfg, s, b, p));
  if (!b.night && b.weather !== "sis") return 99;
  return Math.max(1, 1 + Math.floor(g / 6) + (b.night && b.torch.has && !b.torch.thrown ? 2 : 0));
}
export function visible(cfg: Config, s: GameState, b: Battle, u: Unit): boolean {
  const p = player(b); return u.side === "player" || dist(p.x, p.y, u.x, u.y) <= sightRange(cfg, s, b);
}

function weaponDamage(cfg: Config, s: GameState): { dmg: number; crit: number; name: string } {
  const w = s.equipped.weapon;
  if (!w) return { dmg: 2, crit: 0, name: "Yumruk" };
  const gi = GAME_ITEMS[w]; if (gi) return { dmg: gi.damage ?? 3, crit: gi.critBonus ?? 0, name: gi.name };
  return { dmg: CONFIG_WEAPON_DAMAGE[w] ?? 5, crit: 0, name: cfg.item.get(w)?.name ?? w };
}
function playerArmor(s: GameState): number {
  const a = s.equipped.armor; if (!a) return 0;
  return GAME_ITEMS[a]?.armor ?? CONFIG_ARMOR[a] ?? 0;
}
export function knownWeakPoints(cfg: Config, s: GameState, enemyDef: string): WeakPoint[] {
  const seen = s.journal?.[enemyDef] ?? [];
  return ENEMIES[enemyDef].weakPoints.filter(w => seen.includes(w.id));
}
/** Gözlemle açılabilecek zayıf noktalar (yeterli bilgi var mı). */
export function discoverable(cfg: Config, s: GameState, enemyDef: string): WeakPoint[] {
  return ENEMIES[enemyDef].weakPoints.filter(w => Object.entries(w.need).every(([a, v]) => (s.attrs[a]?.level ?? 0) >= v));
}

export type Stance = "normal" | "guclu";
export interface AttackPreview { hit: number; crit: number; dmg: [number, number]; critParts: { name: string; amount: number }[]; ambush: boolean }
export function previewAttack(cfg: Config, s: GameState, b: Battle, target: Unit, aim?: string, stance: Stance = "normal"): AttackPreview {
  const p = player(b), d = ENEMIES[target.def!];
  const ctx = ctxAt(cfg, s, b, p, d.species);
  const w = weaponDamage(cfg, s);
  const fam = s.familiarity[s.equipped.weapon ?? ""] ?? 0;
  const high = b.tiles[p.y][p.x] === "tepe" && b.tiles[target.y][target.x] !== "tepe";
  const ambush = !target.alert;
  let hit = 58 + effectiveAttr(cfg, s, "kilic", ctx) * 0.6 + effectiveAttr(cfg, s, "refleks", ctx) * 0.2 + fam * 0.1 - d.evasion
    + (high ? 8 : 0) - (s.energy < 25 ? 10 : 0) - (TERRAIN[b.tiles[p.y][p.x]].env === "camur" ? 8 : 0) + (ambush ? 15 : 0) - (stance === "guclu" ? 15 : 0);
  const kr = derived(cfg, s, "kritik", ctx);
  let crit = kr.value + w.crit + fam * 0.05;
  const parts = [...kr.terms, { name: "Silah", amount: w.crit }, { name: "Alışkınlık", amount: fam * 0.05 }];
  if (kr.envPct) parts.push({ name: "Ortam", amount: kr.value - kr.value / (1 + kr.envPct / 100) });
  if (ambush) { crit += 25; parts.push({ name: "Pusu", amount: 25 }); }
  const wp = aim ? d.weakPoints.find(x => x.id === aim) : undefined;
  if (wp) { hit -= 12; crit += wp.critBonus; parts.push({ name: wp.name, amount: wp.critBonus }); }
  hit = Math.max(5, Math.min(95, hit));
  crit = Math.max(0, Math.min(80, crit));
  const base = (w.dmg + effectiveAttr(cfg, s, "ust_govde", ctx) * 0.08) * (stance === "guclu" ? 1.5 : 1);
  return { hit, crit, dmg: [Math.max(1, Math.round(base * 0.8 - d.armor)), Math.max(1, Math.round(base * 1.2 - d.armor))], critParts: parts.filter(x => Math.abs(x.amount) >= 0.05), ambush };
}

/* ---------- hareket ---------- */
function search(b: Battle, u: Unit, budget: number) {
  const best = new Map<string, number>(); const prev = new Map<string, string>();
  const q: [number, number, number][] = [[u.x, u.y, budget]]; best.set(key(u.x, u.y), budget);
  while (q.length) {
    q.sort((a, c) => c[2] - a[2]); const [x, y, left] = q.shift()!;
    for (const [nx, ny] of neighbors(b, x, y)) {
      const t = TERRAIN[b.tiles[ny][nx]]; if (t.blocks) continue;
      const k = key(nx, ny);
      if (b.walls[k]) continue;
      if (u.side === "enemy" && b.fire[k]) continue; // hayvanlar ateşe girmez
      const occ = unitAt(b, nx, ny); if (occ && occ !== u) continue;
      const rem = left - t.cost; if (rem < 0) continue;
      if ((best.get(k) ?? -1) < rem) { best.set(k, rem); prev.set(k, key(x, y)); q.push([nx, ny, rem]); }
    }
  }
  best.delete(key(u.x, u.y));
  return { best, prev };
}
/** Ulaşılabilir altıgenler → kalan hareket. */
export function reachable(b: Battle, u: Unit, budget: number): Map<string, number> { return search(b, u, budget).best; }
function pathTo(b: Battle, u: Unit, budget: number, x: number, y: number): XY[] {
  const { prev } = search(b, u, budget); const out: XY[] = []; let k: string | undefined = key(x, y);
  while (k && k !== key(u.x, u.y)) { out.unshift(k.split(",").map(Number) as XY); k = prev.get(k); }
  return out;
}

export function movePlayer(cfg: Config, s: GameState, b: Battle, x: number, y: number): boolean {
  if (b.phase !== "player") return false;
  const p = player(b); const left = reachable(b, p, p.moveLeft).get(key(x, y));
  if (left === undefined) return false;
  const path = pathTo(b, p, p.moveLeft, x, y);
  b.stats.moves += path.length;
  b.events.push({ k: "move", uid: p.uid, path: [[p.x, p.y], ...path] });
  p.x = x; p.y = y; p.moveLeft = left;
  const t = TERRAIN[b.tiles[y][x]];
  if (t.env === "camur") b.log.unshift("Çamura saplandın; ayağın kayıyor.");
  if (t.env === "yuksek_zemin") b.log.unshift("Yüksek zemindesin: vuruşların daha isabetli.");
  if (b.fire[key(x, y)]) b.log.unshift("Alevlerin içine girdin!");
  detect(b, false);
  return true;
}

/* ---------- algılama ---------- */
/** Kurtlar seni görür ya da kokunu alır mı. Rüzgâr kokuyu taşır, ot ve yağmur saklar. */
export function detectChance(b: Battle, e: Unit): { smell: number; sight: number } {
  const p = player(b);
  const d = dist(p.x, p.y, e.x, e.y);
  const a = planar(p.x, p.y), c = planar(e.x, e.y);
  const v = { x: c.px - a.px, y: c.py - a.py }; const L = Math.hypot(v.x, v.y) || 1;
  const w = windVec(b.wind.dir); const along = (v.x * w.x + v.y * w.y) / L;
  let smell = b.wind.strength === 0 ? 2 : along > 0.4 ? 4 + b.wind.strength * 2 : along > -0.4 ? 2 : 1;
  if (b.weather === "yagmur") smell -= 2;
  const cover = TERRAIN[b.tiles[p.y][p.x]].cover ?? 0;
  let sight = 4 - cover - (b.night ? 1 : 0) - (b.weather === "sis" ? 2 : 0);
  if (b.night) { smell += 1; sight += 1; } // gece avdalar
  return { smell: d <= Math.max(0, smell) ? 1 : 0, sight: d <= Math.max(1, sight) ? 1 : 0 };
}
export function detect(b: Battle, force: boolean) {
  const pack = enemies(b);
  const spotted = force || pack.some(e => { const c = detectChance(b, e); return c.smell || c.sight; });
  if (!spotted) return;
  let woke = false;
  for (const e of pack) if (!e.alert) { e.alert = true; woke = true; b.events.push({ k: "alert", uid: e.uid }); }
  if (woke) b.log.unshift("Kurtlar seni fark etti! Kulaklar dikildi.");
}

/* ---------- eylemler ---------- */
export interface AttackResult { hit: boolean; crit: boolean; dmg: number; text: string }
export function playerAttack(cfg: Config, s: GameState, b: Battle, target: Unit, aim?: string, stance: Stance = "normal"): AttackResult | null {
  const p = player(b);
  if (b.phase !== "player" || p.acted || dist(p.x, p.y, target.x, target.y) !== 1) return null;
  const rng = new Rng(b.seed); const pv = previewAttack(cfg, s, b, target, aim, stance); const d = ENEMIES[target.def!];
  b.stats.attacks++; p.acted = true; p.moveLeft = 0;
  s.energy = Math.max(0, s.energy - (stance === "guclu" ? 8 : 4));
  const w = s.equipped.weapon; if (w) s.familiarity[w] = Math.min(100, (s.familiarity[w] ?? 0) + 0.8);
  if (pv.ambush) b.stats.ambushes++;
  let res: AttackResult;
  if (!rng.chance(pv.hit)) {
    res = { hit: false, crit: false, dmg: 0, text: `${target.name} sıyrıldı.` };
  } else {
    b.stats.hits++;
    const crit = rng.chance(pv.crit);
    let dmg = rng.int(pv.dmg[0], pv.dmg[1]);
    const wp = aim ? d.weakPoints.find(x => x.id === aim) : undefined;
    if (crit) { dmg = Math.round(dmg * 1.8); b.stats.crits++; if (wp?.effect === "slow") target.slowed = 3; }
    target.hp = Math.max(0, target.hp - dmg);
    res = { hit: true, crit, dmg, text: `${pv.ambush ? "Pusu! " : ""}${crit ? `Kritik! ${wp ? wp.name + " hedefine " : ""}${dmg} hasar.` : `${target.name} ${dmg} hasar aldı.`}` };
  }
  b.events.push({ k: "attack", uid: p.uid, target: target.uid, hit: res.hit, crit: res.crit, dmg: res.dmg, power: stance === "guclu", ambush: pv.ambush });
  if (res.hit) res.text += moraleCheck(b, target);
  b.seed = rng.seed; b.log.unshift(res.text);
  detect(b, true);
  checkEnd(b);
  return res;
}

/** İtme: güçle bitişik düşmanı bir altıgen geriye. Ateşe, çamura ya da dereye itmek taktiktir. */
export function pushChance(cfg: Config, s: GameState, b: Battle, target: Unit): number {
  const ctx = ctxAt(cfg, s, b, player(b));
  return Math.max(10, Math.min(90, 35 + (effectiveAttr(cfg, s, "ust_govde", ctx) + effectiveAttr(cfg, s, "core", ctx)) * 0.6 + (target.alert ? 0 : 15)));
}
export function pushTarget(b: Battle, target: Unit): { to: XY; into: string; blocked: boolean } {
  const p = player(b); const to = behind(p.x, p.y, target.x, target.y);
  if (!inside(b, to[0], to[1])) return { to, into: "kenar", blocked: true };
  if (unitAt(b, to[0], to[1]) || b.walls[key(to[0], to[1])]) return { to, into: "engel", blocked: true };
  const t = b.tiles[to[1]][to[0]];
  if (b.fire[key(to[0], to[1])]) return { to, into: "ateş", blocked: false };
  if (t === "su") return { to, into: "dere", blocked: false };
  if (t === "camur") return { to, into: "çamur", blocked: false };
  return { to, into: TERRAIN[t].name.toLowerCase(), blocked: false };
}
export function playerPush(cfg: Config, s: GameState, b: Battle, target: Unit): string | null {
  const p = player(b);
  if (b.phase !== "player" || p.acted || dist(p.x, p.y, target.x, target.y) !== 1) return null;
  const rng = new Rng(b.seed); const chance = pushChance(cfg, s, b, target); const pt = pushTarget(b, target);
  p.acted = true; p.moveLeft = 0; s.energy = Math.max(0, s.energy - 6); b.stats.pushes++;
  const from: XY = [target.x, target.y];
  let text: string;
  if (pt.blocked || !rng.chance(chance)) {
    target.slowed = Math.max(target.slowed, 1);
    text = pt.blocked ? `${target.name} sendeledi ama arkası dolu.` : `${target.name} ayak dirdi; itemedin.`;
    b.events.push({ k: "push", uid: target.uid, from, to: from, ok: false });
  } else {
    target.x = pt.to[0]; target.y = pt.to[1];
    b.events.push({ k: "push", uid: target.uid, from, to: pt.to, ok: true, into: pt.into });
    text = `${target.name} geriye savruldu.`;
    if (pt.into === "ateş") { target.hp = Math.max(0, target.hp - 6); target.scared = true; text = `${target.name} alevlerin içine düştü! 6 hasar.`; b.events.push({ k: "burn", uid: target.uid, dmg: 6 }); }
    else if (pt.into === "dere") { target.slowed = 3; target.scared = true; text = `${target.name} dereye yuvarlandı; ıslak ve sersem.`; }
    else if (pt.into === "çamur") { target.slowed = 2; text = `${target.name} çamura saplandı.`; }
    const tk = key(target.x, target.y);
    if (b.traps[tk]) { delete b.traps[tk]; target.hp = Math.max(0, target.hp - 5); target.slowed = Math.max(target.slowed, 2); b.events.push({ k: "trap", uid: target.uid, dmg: 5 }); text += " Tuzağa bastı!"; }
    text += moraleCheck(b, target);
  }
  b.seed = rng.seed; b.log.unshift(text);
  detect(b, true); checkEnd(b);
  return text;
}

export function playerDefend(b: Battle): boolean {
  const p = player(b); if (b.phase !== "player" || p.acted) return false;
  p.defending = true; p.acted = true; p.moveLeft = 0;
  b.events.push({ k: "defend" }); b.log.unshift("Değneği önünde tutup savunmaya geçtin.");
  return true;
}

/** Meşaleyi fırlat: iki altıgene kadar, yağmurda tutuşmaz. */
export function canThrowTorch(b: Battle, x: number, y: number): boolean {
  const p = player(b);
  return b.torch.has && !b.torch.thrown && !p.acted && b.phase === "player" && dist(p.x, p.y, x, y) <= 2 && !(x === p.x && y === p.y);
}
export function throwTorch(b: Battle, x: number, y: number): string | null {
  if (!canThrowTorch(b, x, y)) return null;
  const p = player(b); const rng = new Rng(b.seed);
  b.torch.thrown = true; p.acted = true;
  const t = b.tiles[y][x]; const burnable = t === "uzun_ot" || t === "agac" || t === "cayir";
  const lit = b.weather !== "yagmur" && burnable && rng.chance(t === "cayir" ? 60 : 95);
  if (lit) b.fire[key(x, y)] = 3;
  b.events.push({ k: "throw", from: [p.x, p.y], to: [x, y], lit });
  const u = unitAt(b, x, y); if (u && u.side === "enemy") { u.scared = true; }
  const text = lit ? `Meşaleyi fırlattın: ${TERRAIN[t].name.toLowerCase()} tutuştu.` : b.weather === "yagmur" ? "Meşale yağmurda cızırdayıp söndü." : "Meşale yere düştü ama bir şey tutuşmadı.";
  b.seed = rng.seed; b.log.unshift(text); detect(b, true);
  return text;
}

/** Turu harcayarak düşmanı inceler: bilgin yetiyorsa zayıf noktaları deftere işlenir. */
export function observe(cfg: Config, s: GameState, b: Battle, target: Unit): string {
  const p = player(b); if (b.phase !== "player" || p.acted) return "";
  p.acted = true; b.stats.observed++;
  s.journal ??= {}; const seen = (s.journal[target.def!] ??= []);
  const found = discoverable(cfg, s, target.def!).filter(w => !seen.includes(w.id));
  found.forEach(w => seen.push(w.id));
  const total = ENEMIES[target.def!].weakPoints.length;
  const text = found.length
    ? `Dikkatle baktın: ${found.map(w => w.name.toLowerCase()).join(", ")} deftere işlendi.`
    : seen.length === total ? "Bildiğin her şeyi zaten görüyorsun." : "Bir şey seziyorsun ama ne olduğunu çıkaramıyorsun. Daha fazla bilgi gerek.";
  b.log.unshift(text);
  return text;
}

export function tryFlee(b: Battle): boolean {
  const p = player(b);
  if (b.phase !== "player") return false;
  if (p.x === 0 || p.y === 0 || p.x === b.w - 1 || p.y === b.h - 1) { b.phase = "fled"; b.log.unshift("Geri çekildin."); return true; }
  return false;
}

/** Moral: sürüden biri düşünce, kaçınca ya da ateşle karşılaşınca kurtlar daha erken kaçar. */
export function moraleCheck(b: Battle, target: Unit): string {
  if (target.hp === 0) { b.events.push({ k: "down", uid: target.uid }); return ` ${target.name} yere serildi.`; }
  if (target.side !== "enemy" || target.fled) return "";
  const packBroken = b.units.some(u => u.side === "enemy" && u !== target && (u.hp <= 0 || u.fled));
  const limit = target.scared ? 0.7 : packBroken ? 0.6 : 0.4;
  if (target.hp <= target.maxHp * limit) { target.fled = true; b.events.push({ k: "flee", uid: target.uid }); return ` ${target.name} kuyruğunu kısıp kaçtı.`; }
  return "";
}

/** Tur başı ortam: yanan alanlar hasar verir ve yayılır, buz duvarları erir. */
const FLAMMABLE: Partial<Record<Terrain, number>> = { uzun_ot: 30, agac: 25, cayir: 8 };
export function tickEnvironment(b: Battle, rng: Rng): string[] {
  const out: string[] = []; const rain = b.weather === "yagmur";
  for (const u of b.units) {
    if (u.hp <= 0 || u.fled || !b.fire[key(u.x, u.y)]) continue;
    u.hp = Math.max(0, u.hp - 4); if (u.side === "player") b.stats.dmgTaken += 4; else u.scared = true;
    b.events.push({ k: "burn", uid: u.uid, dmg: 4 });
    out.push(`${u.name} alevlerin içinde: 4 hasar.` + (u.side === "enemy" ? moraleCheck(b, u) : ""));
  }
  const next: Record<string, number> = {};
  for (const [k, left] of Object.entries(b.fire)) {
    const [x, y] = k.split(",").map(Number);
    if (!rain) for (const [nx, ny] of neighbors(b, x, y)) {
      const nk = key(nx, ny), pct = (FLAMMABLE[b.tiles[ny][nx]] ?? 0) * (1 + b.wind.strength * 0.4);
      if (!b.fire[nk] && !next[nk] && rng.chance(pct)) { next[nk] = 3; b.events.push({ k: "ignite", at: [nx, ny] }); }
    }
    const l = left - (rain ? 2 : 1); if (l > 0) next[k] = Math.max(next[k] ?? 0, l);
    else if (b.tiles[y][x] !== "kaya" && b.tiles[y][x] !== "su") b.tiles[y][x] = "cayir"; // yanan ot küle döner
  }
  if (Object.keys(next).length > Object.keys(b.fire).length) out.push("Ateş otlara yayılıyor.");
  b.fire = next;
  for (const k of Object.keys(b.walls)) { if (--b.walls[k] <= 0) delete b.walls[k]; }
  return out;
}

function checkEnd(b: Battle) {
  if (player(b).hp <= 0) b.phase = "lost";
  else if (enemies(b).length === 0) b.phase = "won";
}

export function startPlayerTurn(cfg: Config, s: GameState, b: Battle) {
  const p = player(b); p.acted = false; p.defending = false; p.moveLeft = moveRange(cfg, s, b, p); b.phase = "player";
}

/** Bir sonraki turda düşmanların saldırabileceği altıgenler (tehdit alanı) → kaç kurt. */
export function threatMap(cfg: Config, s: GameState, b: Battle): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of enemies(b)) {
    if (!e.alert || !visible(cfg, s, b, e)) continue;
    const spots = [key(e.x, e.y), ...reachable(b, e, moveRange(cfg, s, b, e)).keys()];
    const hit = new Set<string>();
    for (const k of spots) { const [x, y] = k.split(",").map(Number); for (const [nx, ny] of neighbors(b, x, y)) hit.add(key(nx, ny)); }
    for (const k of hit) out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}

/** Düşmanların turu. Olayları b.events'e yazar. */
export function enemyTurn(cfg: Config, s: GameState, b: Battle): string[] {
  if (b.phase !== "player" && b.phase !== "enemy") return [];
  b.phase = "enemy"; const rng = new Rng(b.seed); const p = player(b);
  const out: string[] = tickEnvironment(b, rng);
  checkEnd(b);
  for (const e of b.phase === "enemy" ? enemies(b) : []) {
    const d = ENEMIES[e.def!];
    // habersiz kurtlar sürüye doğru sinsice ilerler
    const goal: XY = e.alert ? [p.x, p.y] : b.flock;
    const budget = e.alert ? moveRange(cfg, s, b, e) : 2;
    if (dist(e.x, e.y, p.x, p.y) > 1 || !e.alert) {
      const r = reachable(b, e, budget);
      let best: XY | null = null, bestScore = e.alert ? Infinity : dist(e.x, e.y, goal[0], goal[1]) * 10;
      for (const k of r.keys()) {
        const [x, y] = k.split(",").map(Number);
        const dd = dist(x, y, goal[0], goal[1]);
        // kurtlar yandan dolanır: başka kurdun yanına değil, oyuncunun farklı tarafına
        const crowd = enemies(b).filter(o => o !== e && dist(o.x, o.y, x, y) <= 1).length;
        const nearFire = neighbors(b, x, y).some(([fx, fy]) => b.fire[key(fx, fy)]) ? 6 : 0;
        const score = dd * 10 + crowd * 3 + (TERRAIN[b.tiles[y][x]].env === "camur" ? 2 : 0) + nearFire;
        if (score < bestScore) { bestScore = score; best = [x, y]; }
      }
      if (best) {
        const path = pathTo(b, e, budget, best[0], best[1]);
        let stop = path.length;
        for (let i = 0; i < path.length; i++) if (b.traps[key(...path[i])]) { stop = i + 1; break; }
        const walked = path.slice(0, stop);
        b.events.push({ k: "move", uid: e.uid, path: [[e.x, e.y], ...walked] });
        const end = walked[walked.length - 1] ?? [e.x, e.y]; e.x = end[0]; e.y = end[1];
        const tk = key(e.x, e.y);
        if (b.traps[tk]) {
          delete b.traps[tk]; e.hp = Math.max(0, e.hp - 5); e.slowed = Math.max(e.slowed, 2); e.alert = true;
          b.events.push({ k: "trap", uid: e.uid, dmg: 5 }); out.push(`${e.name} tuzağa bastı! 5 hasar, topallıyor.` + moraleCheck(b, e));
          if (e.fled || e.hp <= 0) continue;
        }
      }
      detect(b, false);
    }
    if (e.slowed > 0) e.slowed--;
    const blind = (e.blind ?? 0) > 0; if (blind) e.blind!--;
    if (e.alert && dist(e.x, e.y, p.x, p.y) === 1) {
      const ctx = ctxAt(cfg, s, b, p, d.species);
      const dodge = derived(cfg, s, "kacinma", ctx).value;
      const hitChance = Math.max(10, Math.min(90, d.accuracy - dodge + (s.energy < 20 ? 10 : 0) - (blind ? 30 : 0) - (p.defending ? 22 : 0)));
      const hit = rng.chance(hitChance);
      let dmg = 0;
      if (hit) {
        dmg = Math.max(1, rng.int(d.damage[0], d.damage[1]) - playerArmor(s) - (p.defending ? 1 : 0));
        p.hp = Math.max(0, p.hp - dmg); b.stats.dmgTaken += dmg;
        out.push(`${e.name} ısırdı: ${dmg} hasar.`);
      } else out.push(p.defending ? `${e.name} atıldı; değneğe çarpıp geri sekti.` : `${e.name} atıldı, son anda kaçtın.`);
      b.events.push({ k: "attack", uid: e.uid, target: p.uid, hit, crit: false, dmg });
      if (p.hp <= 0) break;
    }
  }
  b.seed = rng.seed; out.forEach(t => b.log.unshift(t));
  b.turn++; checkEnd(b);
  if (b.phase === "enemy") startPlayerTurn(cfg, s, b);
  return out;
}

export interface BattleOutcome { result: Battle["phase"]; gains: GainReport; minutes: number; text: string }
/** Savaş bitince: gerçek kullanım gelişimi, yorgunluk, zaman, can. */
export function finishBattle(cfg: Config, s: GameState, b: Battle): BattleOutcome {
  // tek bir saldırı bir idman oturumunun ~üçte biri kadar öğretir; gerçek kullanım çarpanı config'den
  const gains = realUse(cfg, s, "kilic_dovus", b.stats.attacks, 0.15);
  if (b.stats.observed) { applyGain(cfg, s, "analiz", 0.4 * b.stats.observed, gains); applyGain(cfg, s, "anatomi_hayvan", 0.3 * b.stats.observed, gains); }
  if (b.stats.dmgTaken) applyGain(cfg, s, "agri", b.stats.dmgTaken * 0.03, gains);
  if (b.stats.moves) applyGain(cfg, s, "bacak", b.stats.moves * 0.03, gains);
  if (b.stats.pushes) { applyGain(cfg, s, "ust_govde", b.stats.pushes * 0.15, gains); applyGain(cfg, s, "core", b.stats.pushes * 0.15, gains); }
  if (b.stats.ambushes) applyGain(cfg, s, "taktik", b.stats.ambushes * 0.4, gains);
  // büyü: her başarılı/başarısız deneme ilgili ustalığı, odağı ve kapasiteyi geliştirir
  for (const [attr, n] of Object.entries(b.stats.castMastery)) applyGain(cfg, s, attr, n * 0.5, gains);
  if (b.stats.casts) { applyGain(cfg, s, "odak", b.stats.casts * 0.15, gains); applyGain(cfg, s, "mana", b.stats.casts * 0.15, gains); }
  if (b.phase === "won" && b.stats.casts > 0) s.story.flags.buyuluZafer = (s.story.flags.buyuluZafer ?? 0) + 1;
  const minutes = 20 + b.turn * 3;
  s.minute = Math.min(DAY_MINUTES, s.minute + minutes);
  s.energy = Math.max(0, s.energy - 6 - b.stats.moves * 0.5);
  s.satiety = Math.max(0, s.satiety - 6);
  const p = player(b);
  s.hp = b.phase === "lost" ? 1 : p.hp;
  const head = b.phase === "won" ? "Kurtları uzaklaştırdın." : b.phase === "fled" ? "Geri çekildin; kurtlar hâlâ orada." : "Yaralı hâlde kendini köye zor attın.";
  const text = `${head} ${summarize(cfg, gains, 4)}`;
  log(s, text, "battle");
  return { result: b.phase, gains, minutes, text };
}
