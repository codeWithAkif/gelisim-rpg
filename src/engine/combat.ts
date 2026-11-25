// Altıgen haritada sıra tabanlı taktik savaş.
// Zemin, hava ve ışık hem hareketi hem isabeti hem görüşü etkiler.
// Kritik vuruş: silah ustalığı + alışkınlık + türe özel anatomi + gözlem + pozisyon.
import type { Config } from "./config";
import { type GameState, hourOf, log } from "./state";
import { derived, effectiveAttr, type Context } from "./derived";
import { Rng } from "./rng";
import { applyGain, realUse, summarize, type GainReport } from "./progression";
import { ENEMIES, GAME_ITEMS, MAPS, MAP_CHARS, TERRAIN, CONFIG_WEAPON_DAMAGE, CONFIG_ARMOR, type Terrain, type WeakPoint } from "../content/world";

export type Weather = "acik" | "yagmur" | "sis";
export interface Unit {
  uid: string; side: "player" | "enemy"; def?: string; name: string;
  x: number; y: number; hp: number; maxHp: number;
  moveLeft: number; acted: boolean; slowed: number; fled?: boolean;
}
export interface Battle {
  w: number; h: number; tiles: Terrain[][];
  weather: Weather; night: boolean;
  units: Unit[]; turn: number;
  phase: "player" | "enemy" | "won" | "lost" | "fled";
  seed: number; log: string[];
  stats: { attacks: number; hits: number; crits: number; observed: number; dmgTaken: number; moves: number };
  questId?: string;
}

/* ---------- altıgen geometri (odd-r ofset) ---------- */
const N_EVEN = [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
const N_ODD = [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]];
export function neighbors(b: Battle, x: number, y: number): [number, number][] {
  return (y % 2 ? N_ODD : N_EVEN).map(([dx, dy]) => [x + dx, y + dy] as [number, number])
    .filter(([a, c]) => a >= 0 && c >= 0 && a < b.w && c < b.h);
}
function toCube(x: number, y: number) { const q = x - (y - (y & 1)) / 2; return { q, r: y, s: -q - y }; }
export function dist(x1: number, y1: number, x2: number, y2: number): number {
  const a = toCube(x1, y1), c = toCube(x2, y2);
  return Math.max(Math.abs(a.q - c.q), Math.abs(a.r - c.r), Math.abs(a.s - c.s));
}

/* ---------- kurulum ---------- */
export function player(b: Battle) { return b.units.find(u => u.side === "player")!; }
export function enemies(b: Battle) { return b.units.filter(u => u.side === "enemy" && u.hp > 0 && !u.fled); }
export function unitAt(b: Battle, x: number, y: number) { return b.units.find(u => u.hp > 0 && !u.fled && u.x === x && u.y === y); }

export function maxHp(cfg: Config, s: GameState): number {
  return Math.round(28 + effectiveAttr(cfg, s, "kardiyo") * 0.3 + effectiveAttr(cfg, s, "core") * 0.2 + effectiveAttr(cfg, s, "agri") * 0.15);
}

export function createBattle(cfg: Config, s: GameState, mapId: string, enemyIds: string[], seed: number, questId?: string): Battle {
  const m = MAPS[mapId]; const rng = new Rng(seed);
  const tiles = m.rows.map(r => [...r].map(c => MAP_CHARS[c] ?? "cayir"));
  const h = hourOf(s);
  const roll = rng.next();
  const weather: Weather = roll < 0.25 ? "yagmur" : roll < 0.4 ? "sis" : "acik";
  const hpMax = maxHp(cfg, s);
  if (!s.hp || s.hp > hpMax) s.hp = hpMax;
  const units: Unit[] = [{ uid: "p", side: "player", name: "Sen", x: m.player[0], y: m.player[1], hp: s.hp, maxHp: hpMax, moveLeft: 0, acted: false, slowed: 0 }];
  enemyIds.forEach((id, i) => {
    const d = ENEMIES[id]; const [x, y] = m.enemies[i % m.enemies.length];
    units.push({ uid: "e" + i, side: "enemy", def: id, name: `${d.name} ${i + 1}`, x, y, hp: d.hp, maxHp: d.hp, moveLeft: 0, acted: false, slowed: 0 });
  });
  const b: Battle = {
    w: tiles[0].length, h: tiles.length, tiles, weather, night: h >= 20 || h < 6, units, turn: 1, phase: "player",
    seed: rng.seed, log: [], stats: { attacks: 0, hits: 0, crits: 0, observed: 0, dmgTaken: 0, moves: 0 }, questId,
  };
  startPlayerTurn(cfg, s, b);
  b.log.unshift(`${b.night ? "Gece" : "Gündüz"}, ${weather === "yagmur" ? "yağmur yağıyor" : weather === "sis" ? "sis var" : "hava açık"}.`);
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
  return Math.max(1, 1 + Math.floor(g / 6));
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

export interface AttackPreview { hit: number; crit: number; dmg: [number, number]; critParts: { name: string; amount: number }[] }
export function previewAttack(cfg: Config, s: GameState, b: Battle, target: Unit, aim?: string): AttackPreview {
  const p = player(b), d = ENEMIES[target.def!];
  const ctx = ctxAt(cfg, s, b, p, d.species);
  const w = weaponDamage(cfg, s);
  const fam = s.familiarity[s.equipped.weapon ?? ""] ?? 0;
  const high = b.tiles[p.y][p.x] === "tepe" && b.tiles[target.y][target.x] !== "tepe";
  let hit = 58 + effectiveAttr(cfg, s, "kilic", ctx) * 0.6 + effectiveAttr(cfg, s, "refleks", ctx) * 0.2 + fam * 0.1 - d.evasion
    + (high ? 8 : 0) - (s.energy < 25 ? 10 : 0) - (TERRAIN[b.tiles[p.y][p.x]].env === "camur" ? 8 : 0);
  const kr = derived(cfg, s, "kritik", ctx);
  let crit = kr.value + w.crit + fam * 0.05;
  const parts = [...kr.terms, { name: "Silah", amount: w.crit }, { name: "Alışkınlık", amount: fam * 0.05 }];
  if (kr.envPct) parts.push({ name: "Ortam", amount: kr.value - kr.value / (1 + kr.envPct / 100) });
  const wp = aim ? d.weakPoints.find(x => x.id === aim) : undefined;
  if (wp) { hit -= 12; crit += wp.critBonus; parts.push({ name: wp.name, amount: wp.critBonus }); }
  hit = Math.max(5, Math.min(95, hit));
  crit = Math.max(0, Math.min(75, crit));
  const base = w.dmg + effectiveAttr(cfg, s, "ust_govde", ctx) * 0.08;
  return { hit, crit, dmg: [Math.max(1, Math.round(base * 0.8 - d.armor)), Math.max(1, Math.round(base * 1.2 - d.armor))], critParts: parts.filter(x => Math.abs(x.amount) >= 0.05) };
}

/* ---------- hareket ---------- */
/** Ulaşılabilir altıgenler → kalan hareket. */
export function reachable(b: Battle, u: Unit, budget: number): Map<string, number> {
  const best = new Map<string, number>(); const key = (x: number, y: number) => x + "," + y;
  const q: [number, number, number][] = [[u.x, u.y, budget]]; best.set(key(u.x, u.y), budget);
  while (q.length) {
    q.sort((a, c) => c[2] - a[2]); const [x, y, left] = q.shift()!;
    for (const [nx, ny] of neighbors(b, x, y)) {
      const t = TERRAIN[b.tiles[ny][nx]]; if (t.blocks) continue;
      const occ = unitAt(b, nx, ny); if (occ && occ !== u) continue;
      const rem = left - t.cost; if (rem < 0) continue;
      if ((best.get(key(nx, ny)) ?? -1) < rem) { best.set(key(nx, ny), rem); q.push([nx, ny, rem]); }
    }
  }
  best.delete(key(u.x, u.y));
  return best;
}
export function movePlayer(cfg: Config, s: GameState, b: Battle, x: number, y: number): boolean {
  if (b.phase !== "player") return false;
  const p = player(b); const r = reachable(b, p, p.moveLeft); const left = r.get(x + "," + y);
  if (left === undefined) return false;
  b.stats.moves += dist(p.x, p.y, x, y);
  p.x = x; p.y = y; p.moveLeft = left;
  const t = TERRAIN[b.tiles[y][x]];
  if (t.env === "camur") b.log.unshift("Çamura saplandın; ayağın kayıyor.");
  if (t.env === "yuksek_zemin") b.log.unshift("Yüksek zemindesin: vuruşların daha isabetli.");
  return true;
}

/* ---------- eylemler ---------- */
export interface AttackResult { hit: boolean; crit: boolean; dmg: number; text: string }
export function playerAttack(cfg: Config, s: GameState, b: Battle, target: Unit, aim?: string): AttackResult | null {
  const p = player(b);
  if (b.phase !== "player" || p.acted || dist(p.x, p.y, target.x, target.y) !== 1) return null;
  const rng = new Rng(b.seed); const pv = previewAttack(cfg, s, b, target, aim); const d = ENEMIES[target.def!];
  b.stats.attacks++; p.acted = true; p.moveLeft = 0;
  s.energy = Math.max(0, s.energy - 4);
  const w = s.equipped.weapon; if (w) s.familiarity[w] = Math.min(100, (s.familiarity[w] ?? 0) + 0.8);
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
    res = { hit: true, crit, dmg, text: crit ? `Kritik! ${wp ? wp.name + " hedefine " : ""}${dmg} hasar.` : `${target.name} ${dmg} hasar aldı.` };
    // moral: sürüden biri düşünce ya da kaçınca diğerleri daha erken kaçar
    const packBroken = b.units.some(u => u.side === "enemy" && u !== target && (u.hp <= 0 || u.fled));
    if (target.hp > 0 && target.hp <= target.maxHp * (packBroken ? 0.6 : 0.4)) { target.fled = true; res.text += ` ${target.name} kuyruğunu kısıp kaçtı.`; }
    else if (target.hp === 0) res.text += ` ${target.name} yere serildi.`;
  }
  b.seed = rng.seed; b.log.unshift(res.text);
  checkEnd(b);
  return res;
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

function checkEnd(b: Battle) {
  if (player(b).hp <= 0) b.phase = "lost";
  else if (enemies(b).length === 0) b.phase = "won";
}

export function startPlayerTurn(cfg: Config, s: GameState, b: Battle) {
  const p = player(b); p.acted = false; p.moveLeft = moveRange(cfg, s, b, p); b.phase = "player";
}

/** Düşmanların turu. Her adım için olay listesi döner (arayüz canlandırsın diye). */
export function enemyTurn(cfg: Config, s: GameState, b: Battle): string[] {
  if (b.phase !== "player" && b.phase !== "enemy") return [];
  b.phase = "enemy"; const rng = new Rng(b.seed); const out: string[] = []; const p = player(b);
  for (const e of enemies(b)) {
    const d = ENEMIES[e.def!];
    if (dist(e.x, e.y, p.x, p.y) > 1) {
      const r = reachable(b, e, moveRange(cfg, s, b, e));
      let best: [number, number] | null = null, bestScore = Infinity;
      for (const k of r.keys()) {
        const [x, y] = k.split(",").map(Number);
        const dd = dist(x, y, p.x, p.y);
        // kurtlar yandan dolanır: başka kurdun yanına değil, oyuncunun farklı tarafına
        const crowd = enemies(b).filter(o => o !== e && dist(o.x, o.y, x, y) <= 1).length;
        const score = dd * 10 + crowd * 3 + (TERRAIN[b.tiles[y][x]].env === "camur" ? 2 : 0);
        if (score < bestScore) { bestScore = score; best = [x, y]; }
      }
      if (best) { e.x = best[0]; e.y = best[1]; }
    }
    if (e.slowed > 0) e.slowed--;
    if (dist(e.x, e.y, p.x, p.y) === 1) {
      const ctx = ctxAt(cfg, s, b, p, d.species);
      const dodge = derived(cfg, s, "kacinma", ctx).value;
      const hitChance = Math.max(10, Math.min(90, d.accuracy - dodge + (s.energy < 20 ? 10 : 0)));
      if (rng.chance(hitChance)) {
        const dmg = Math.max(1, rng.int(d.damage[0], d.damage[1]) - playerArmor(s));
        p.hp = Math.max(0, p.hp - dmg); b.stats.dmgTaken += dmg;
        out.push(`${e.name} ısırdı: ${dmg} hasar.`);
      } else out.push(`${e.name} atıldı, son anda kaçtın.`);
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
  const minutes = 20 + b.turn * 3;
  s.minute = Math.min(16 * 60, s.minute + minutes);
  s.energy = Math.max(0, s.energy - 6 - b.stats.moves * 0.5);
  s.satiety = Math.max(0, s.satiety - 6);
  const p = player(b);
  s.hp = b.phase === "lost" ? 1 : p.hp;
  const head = b.phase === "won" ? "Kurtları uzaklaştırdın." : b.phase === "fled" ? "Geri çekildin; kurtlar hâlâ orada." : "Yaralı hâlde kendini köye zor attın.";
  const text = `${head} ${summarize(cfg, gains, 4)}`;
  log(s, text, "battle");
  return { result: b.phase, gains, minutes, text };
}
