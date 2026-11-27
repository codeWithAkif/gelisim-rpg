// Ölçer işi: annenin büyüsü dua değil hesaptır. "Sönen her ateş, başka bir ocakta yanar."
// Küçük bir ısı ağı: düğümler (ocak, pınar, ağıl...) ve aralarındaki yollar. Her hamle bir birim ısıyı
// bir komşuya taşır; toplam ısı hiç değişmez. Bazı düğümlerin ısısı ölçülmeden bilinmez. Soğuk çeken
// taş ("çekici") her iki hamlede bir en sıcak komşusundan bir birim ısıyı kendine alır.
// Karakterin odağı hamle, analizi ölçüm sayısını artırır: gelişim bulmacayı kolaylaştırır. DOM yok.
import type { Config } from "./config";
import type { GameState } from "./state";
import { DAY_MINUTES, addRep, log } from "./state";
import { applyGain, type GainReport } from "./progression";

export interface HNode {
  id: string; name: string; heat: number;
  atLeast?: number; atMost?: number;   // hedef: bulmaca bitince bu aralıkta olmalı
  hidden?: boolean;                    // ölçülmeden ısısı görünmez
  drain?: boolean;                     // soğuk çeken taş
  x: number; y: number;                // çizim için (0–100)
}
export interface HLevel { id: string; title: string; text: string; nodes: HNode[]; links: [string, string][]; moves: number; measures: number }

export const OLCER_LEVELS: HLevel[] = [
  { id: "pinar", title: "Donmuş pınar", moves: 5, measures: 1,
    text: "Taşpınar'ın pınarı donmuş. Ocağın ısısını taş yoldan pınara taşı; ama köylülerin yemeği için ocakta ısı kalsın.",
    nodes: [
      { id: "ocak", name: "Ocak", heat: 5, atLeast: 2, x: 18, y: 30 },
      { id: "yol", name: "Taş yol", heat: 1, hidden: true, x: 50, y: 55 },
      { id: "pinar", name: "Pınar", heat: 0, atLeast: 3, x: 82, y: 30 },
    ],
    links: [["ocak", "yol"], ["yol", "pinar"]] },
  { id: "agil", title: "Ağılın gecesi", moves: 6, measures: 1,
    text: "Gece ayaz bastırdı. Kuzular üşüyor, pınar yine donmak üzere. Isıyı bir yerden almak zorundasın; neresi fazla, önce ölç.",
    nodes: [
      { id: "ocak", name: "Ocak", heat: 3, atLeast: 2, x: 15, y: 25 },
      { id: "agil", name: "Ağıl", heat: 0, atLeast: 3, x: 50, y: 15 },
      { id: "kaya", name: "Güneşli kaya", heat: 5, hidden: true, x: 50, y: 72 },
      { id: "pinar", name: "Pınar", heat: 1, atLeast: 2, atMost: 3, x: 85, y: 30 },
    ],
    links: [["ocak", "agil"], ["agil", "pinar"], ["ocak", "kaya"], ["kaya", "pinar"]] },
  { id: "kor", title: "Soğuk çeken taş", moves: 9, measures: 2,
    text: "Meydanın dibinde mavi bir taş var. Dokunduğu her şeyi soğutuyor. Sönen ateş bir yerde yanar: taş ısıyı kendine topluyor. Ölç ve geri al.",
    nodes: [
      { id: "ev", name: "Muhtarın evi", heat: 3, atLeast: 3, x: 15, y: 30 },
      { id: "tas", name: "Mavi taş", heat: 3, hidden: true, drain: true, atMost: 0, x: 50, y: 70 },
      { id: "ahir", name: "Ahır", heat: 1, atLeast: 2, x: 85, y: 30 },
      { id: "pinar", name: "Pınar", heat: 1, atLeast: 3, x: 50, y: 12 },
    ],
    links: [["ev", "tas"], ["tas", "ahir"], ["ev", "pinar"], ["pinar", "ahir"]] },
];
export const olcerLevel = (id: string) => OLCER_LEVELS.find(l => l.id === id);

export interface HState {
  level: HLevel; heat: Record<string, number>; known: string[]; moves: number; measures: number;
  turn: number; done?: "won" | "lost"; log: string[];
}
const lv = (s: GameState, id: string) => s.attrs[id]?.level ?? 10;
/** Odak her 20 puanda bir hamle, analiz her 15 puanda bir ölçüm ekler (10 başlangıç). */
export const bonusMoves = (s: GameState) => Math.max(0, Math.floor((lv(s, "odak") - 10) / 20));
export const bonusMeasures = (s: GameState) => Math.max(0, Math.floor((lv(s, "analiz") - 10) / 15));

export function createPuzzle(s: GameState | null, level: HLevel): HState {
  return {
    level, heat: Object.fromEntries(level.nodes.map(n => [n.id, n.heat])), known: level.nodes.filter(n => !n.hidden).map(n => n.id),
    moves: level.moves + (s ? bonusMoves(s) : 0), measures: level.measures + (s ? bonusMeasures(s) : 0), turn: 0, log: [],
  };
}
export const totalHeat = (st: HState) => Object.values(st.heat).reduce((a, b) => a + b, 0);
export const linked = (lvl: HLevel, a: string, b: string) => lvl.links.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
const node = (lvl: HLevel, id: string) => lvl.nodes.find(n => n.id === id)!;
export const nodeOk = (n: HNode, h: number) => (n.atLeast === undefined || h >= n.atLeast) && (n.atMost === undefined || h <= n.atMost);
export const allOk = (st: HState) => st.level.nodes.every(n => nodeOk(n, st.heat[n.id]));

/** Ölç: gizli düğümün ısısını açar. */
export function measure(st: HState, id: string): boolean {
  if (st.done || st.known.includes(id) || st.measures <= 0) return false;
  st.measures--; st.known.push(id); st.log.push(`${node(st.level, id).name} ölçüldü: ${st.heat[id]}`);
  return true;
}

/** Soğuk çeken taş, her iki hamlede bir en sıcak komşusundan bir birim alır. */
function drainStep(st: HState) {
  for (const d of st.level.nodes.filter(n => n.drain)) {
    const ns = st.level.links.filter(([a, b]) => a === d.id || b === d.id).map(([a, b]) => (a === d.id ? b : a));
    const rich = ns.filter(id => st.heat[id] > 0).sort((a, b) => st.heat[b] - st.heat[a] || a.localeCompare(b))[0];
    if (rich) { st.heat[rich]--; st.heat[d.id]++; st.log.push(`${d.name}, ${node(st.level, rich).name}'dan ısı çekti`); }
  }
}

export type MoveResult = "ok" | "bos" | "yasak";
/** Bir birim ısıyı komşuya taşır. Kaynak boşsa hamle boşa gider (ölçmeden taşıyanın cezası). */
export function transfer(st: HState, from: string, to: string): MoveResult {
  if (st.done || st.moves <= 0 || from === to || !linked(st.level, from, to)) return "yasak";
  st.moves--; st.turn++;
  let r: MoveResult = "ok";
  if (st.heat[from] <= 0) { r = "bos"; if (!st.known.includes(from)) st.known.push(from); st.log.push(`${node(st.level, from).name} boş çıktı`); }
  else { st.heat[from]--; st.heat[to]++; }
  if (st.turn % 2 === 0) drainStep(st);
  if (allOk(st)) st.done = "won"; else if (st.moves <= 0) st.done = "lost";
  return r;
}

/** Bulmacayı en az hamlede çözer (yalnız aktarım; ölçüm bilgi verir, sonucu değiştirmez). Yoksa null. */
export function solve(level: HLevel, maxMoves: number): [string, string][] | null {
  const start = createPuzzle(null, level); start.moves = maxMoves;
  const ids = level.nodes.map(n => n.id);
  const key = (st: HState) => `${st.turn % 2}|${ids.map(i => st.heat[i]).join(",")}`;
  type Q = { st: HState; path: [string, string][] };
  let frontier: Q[] = [{ st: start, path: [] }]; const seen = new Set([key(start)]);
  if (allOk(start)) return [];
  for (let depth = 0; depth < maxMoves; depth++) {
    const next: Q[] = [];
    for (const { st, path } of frontier) for (const [a, b] of level.links) for (const [f, t] of [[a, b], [b, a]] as const) {
      if (st.heat[f] <= 0) continue;
      const c: HState = { ...st, heat: { ...st.heat }, known: [...st.known], log: [] };
      transfer(c, f, t);
      if (c.done === "won") return [...path, [f, t]];
      const k = key(c); if (seen.has(k)) continue; seen.add(k); next.push({ st: c, path: [...path, [f, t]] });
    }
    frontier = next;
  }
  return null;
}

/* ---------- oyundaki karşılığı ---------- */
export const OLCER_PLACE = "koy_meydani";
export const OLCER_MINUTES = 30;
export const olcerOpen = (s: GameState) => s.knownElements.length > 0;
export const solvedLevels = (s: GameState) => s.olcer?.solved ?? [];
/** Sıradaki çözülmemiş iş; hepsi çözüldüyse son iş (alıştırma). */
export const nextLevel = (s: GameState) => OLCER_LEVELS.find(l => !solvedLevels(s).includes(l.id)) ?? OLCER_LEVELS[OLCER_LEVELS.length - 1];
export function canStartOlcer(s: GameState): { ok: boolean; reason?: string } {
  if (!olcerOpen(s)) return { ok: false, reason: "Önce annenin defterinden bir sayfa öğren" };
  if (s.location !== OLCER_PLACE) return { ok: false, reason: "Köy meydanına git" };
  if (s.energy < 5) return { ok: false, reason: "Çok yorgunsun" };
  if (DAY_MINUTES - s.minute < OLCER_MINUTES) return { ok: false, reason: "Bugün buna vakit kalmadı" };
  return { ok: true };
}
/** Bitiş: süre ve enerji harcanır; kafa çalışır. İlk çözümde köyün güveni artar. */
export function finishOlcer(cfg: Config, s: GameState, st: HState): { gains: GainReport; first: boolean } {
  const gains: GainReport = {}; const won = st.done === "won";
  s.minute = Math.min(DAY_MINUTES, s.minute + OLCER_MINUTES); s.energy = Math.max(0, s.energy - 5);
  const k = won ? 1 : 0.4; const measured = st.level.nodes.filter(n => n.hidden && st.known.includes(n.id)).length;
  applyGain(cfg, s, "analiz", (0.3 + measured * 0.15) * k, gains); applyGain(cfg, s, "odak", 0.3 * k, gains);
  applyGain(cfg, s, "mana", 0.2 * k, gains);
  for (const el of s.knownElements.includes("el_ates") ? ["ates"] : []) applyGain(cfg, s, el, 0.25 * k, gains);
  const first = won && !solvedLevels(s).includes(st.level.id);
  if (first) { (s.olcer ??= { solved: [] }).solved.push(st.level.id); addRep(s, "taspinar", "guven", 1); log(s, `Ölçer işi: ${st.level.title} çözüldü.`, "quest"); }
  return { gains, first };
}
