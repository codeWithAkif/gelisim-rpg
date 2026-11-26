// Keşif: etrafı aramak, koleksiyon, günlük istekler ve gezdikçe açılan harita (DOM yok).
import type { Config } from "./config";
import { type GameState, DAY_MINUTES, addRep, log, minutesLeft, hourOf } from "./state";
import { applyGain, type GainReport } from "./progression";
import { addItem, removeItem } from "./inventory";
import { Rng } from "./rng";
import { COLLECTIBLES, FINDS, FINDS_PER_DAY, RELIC_FINDS, SEARCH_MINUTES, REQUESTS, REQUESTS_PER_DAY, type Collectible, type RequestDef } from "../content/explore";
import { PLACES, ROADS, NPC_PLACE } from "../content/map";
import { QUESTS, NPCS } from "../content/world";
import { grantRelic, hasRelic } from "./relics";
import type { Relic } from "../content/relics";

/* ---------- gezdikçe açılan harita ---------- */
/** Bir yere varınca o yer ve yolla bağlı komşuları haritada belirir. */
export function markSeen(s: GameState, placeId: string) {
  s.seen ??= [];
  const add = (id: string) => { if (!s.seen!.includes(id)) s.seen!.push(id); };
  add(placeId);
  for (const r of ROADS) { if (r.a === placeId) add(r.b); if (r.b === placeId) add(r.a); }
}
/** Haritada görünüyor mu: görülmüş, ya da bir işin/tanıdığın orada olduğunu biliyorsun. */
export function isSeen(s: GameState, placeId: string): boolean {
  if (!s.seen) return true; // eski kayıt: hepsi açık
  if (PLACES.find(p => p.id === placeId)?.hub) return true; // şehir merkezleri hep görünür (kilitliyse soru işaretiyle)
  if (s.seen.includes(placeId)) return true;
  if (QUESTS.some(q => q.at === placeId && s.quests[q.id]?.status === "aktif")) return true;
  if (QUESTS.some(q => NPC_PLACE[q.giverNpc] === placeId && s.quests[q.id]?.status === "aktif")) return true;
  return s.metNpcs.some(n => NPC_PLACE[n] === placeId);
}
export function seenCount(s: GameState): { seen: number; total: number } {
  const open = PLACES.filter(p => p.region === "taspinar");
  return { seen: open.filter(p => isSeen(s, p.id)).length, total: open.length };
}

/* ---------- koleksiyon ---------- */
export function collected(s: GameState): Set<string> {
  const c = new Set(Object.keys(s.collection ?? {}));
  if (s.journal.kurt !== undefined || s.quests.kurt) c.add("kurt");
  return c;
}
export function collectible(id: string): Collectible | undefined { return COLLECTIBLES.find(c => c.id === id); }

/* ---------- etrafı aramak ---------- */
export interface SearchResult { ok: boolean; reason?: string; found?: Collectible; first?: boolean; count?: number; dropped?: number; gains: GainReport; text: string; relic?: Relic }
const isNight = (s: GameState) => { const h = hourOf(s); return h >= 20.5 || h < 6.5; };
function todaySearch(s: GameState) { if (!s.searched || s.searched.day !== s.day) s.searched = { day: s.day, found: {}, tries: {} }; return s.searched; }
export function searchInfo(s: GameState, place = s.location): { left: number; finds: number } {
  const t = s.searched?.day === s.day ? s.searched : undefined;
  return { left: Math.max(0, FINDS_PER_DAY + (s.pet ? 1 : 0) - (t?.found[place] ?? 0)), finds: FINDS[place]?.length ?? 0 };
}
export function canSearch(s: GameState): { ok: boolean; reason?: string } {
  if (!FINDS[s.location]) return { ok: false, reason: "Burada aranacak bir şey yok" };
  if (s.session) return { ok: false, reason: "Çalışırken olmaz" };
  if (s.journey) return { ok: false, reason: "Yoldasın" };
  if (minutesLeft(s) < SEARCH_MINUTES) return { ok: false, reason: "Çok geç oldu; artık uyu" };
  if (s.energy < 3) return { ok: false, reason: "Çok yorgunsun" };
  if (searchInfo(s).left <= 0) return { ok: false, reason: "Bugün burada bulunacak bir şey kalmadı" };
  return { ok: true };
}
/** Bulma şansı (%): ilgili duyu ve gözlemle artar. */
export function findChance(s: GameState, sense: string): number {
  const lv = (s.attrs[sense]?.level ?? 10) * 0.7 + (s.attrs.analiz?.level ?? 10) * 0.3;
  // köpeğin burnu kokuyla bulunanlarda çok, diğerlerinde biraz yardım eder; bağ büyüdükçe artar
  const pet = s.pet ? (sense === "koku" ? 12 : 6) + s.pet.bond / 8 : 0;
  return Math.max(25, Math.min(92, 40 + (lv - 10) * 1.5 + pet));
}
/** 20 dakika etrafı arar. Bulunanlar çantaya, ilk kez bulunanlar deftere. */
export function searchHere(cfg: Config, s: GameState): SearchResult {
  const gains: GainReport = {};
  const can = canSearch(s); if (!can.ok) return { ok: false, reason: can.reason, gains, text: can.reason ?? "" };
  const t = todaySearch(s); const rng = new Rng((s.seed * 31 + s.day * 977 + Math.round(s.minute) * 13) | 0);
  t.tries[s.location] = (t.tries[s.location] ?? 0) + 1;
  s.minute = Math.min(DAY_MINUTES, s.minute + SEARCH_MINUTES); s.energy = Math.max(0, s.energy - 3); s.satiety = Math.max(0, s.satiety - 1);
  const night = isNight(s);
  const pool = FINDS[s.location].filter(f => f.night === undefined || f.night === night);
  // önce ne çıkacağı, sonra fark edip etmediğin
  const total = pool.reduce((a, f) => a + f.w, 0); let r = rng.next() * total; let pick = pool[0];
  for (const f of pool) { r -= f.w; if (r <= 0) { pick = f; break; } }
  applyGain(cfg, s, pick.sense, 0.04, gains); applyGain(cfg, s, "analiz", 0.02, gains);
  if (!pick || !rng.chance(findChance(s, pick.sense))) {
    return { ok: true, gains, text: night ? "Karanlıkta pek bir şey seçemedin." : "Uzun uzun baktın ama gözüne bir şey çarpmadı." };
  }
  // nadir: vadiyi iyi tanıyan biri, çamurda annenin pusulasını bulabilir
  if (!hasRelic(s, "olcer_pusulasi") && ["dere", "yayla"].includes(s.location) && collected(s).size >= 6 && rng.chance(30)) {
    const relic = grantRelic(cfg, s, "olcer_pusulasi", gains)!;
    return { ok: true, gains, relic, text: "Ayağın çamurda sert bir şeye takıldı. Pirinçten bir pusula; kapağında annenin işareti." };
  }
  // kadim çağrılar: bazı yerlerde, bir kez, nadiren bir büyü öğreten eşya çıkar
  for (const rf of RELIC_FINDS) {
    if (hasRelic(s, rf.relic) || !rf.places.includes(s.location) || collected(s).size < rf.minCollected) continue;
    if (rf.night !== undefined && rf.night !== night) continue;
    if (!rng.chance(rf.chance)) continue;
    const relic = grantRelic(cfg, s, rf.relic, gains)!;
    return { ok: true, gains, relic, text: rf.text };
  }
  const c = collectible(pick.id)!;
  t.found[s.location] = (t.found[s.location] ?? 0) + 1;
  if (s.pet) s.pet.bond = Math.min(100, s.pet.bond + 0.5);
  s.collection ??= {};
  const first = !(c.id in s.collection) && !(c.id === "kurt" && collected(s).has("kurt"));
  if (first) s.collection[c.id] = s.day;
  let count = 0, dropped = 0;
  if (c.item) { count = c.kind === "bitki" ? rng.int(1, 2) : 1; dropped = addItem(cfg, s, c.item, count); }
  if (c.kind === "hayvan") applyGain(cfg, s, "iz_surme", 0.03, gains);
  const text = c.item ? `${c.name} buldun${count > 1 ? ` (${count})` : ""}.${dropped ? " Çantanda yer yoktu; bıraktın." : ""}` : `${c.name} gördün.`;
  if (first) log(s, `Deftere yeni sayfa: ${c.name}.`, "info");
  return { ok: true, found: c, first, count, dropped, gains, text };
}

/* ---------- günlük istekler ---------- */
export interface RequestView { def: RequestDef; done: boolean; have: boolean; here: boolean; npcName: string; place: string }
export function dailyRequests(s: GameState): RequestView[] {
  if (!s.requests || s.requests.day !== s.day || (!s.requests.ids.length && s.metNpcs.length)) {
    const pool = REQUESTS.filter(r => s.metNpcs.includes(r.npc));
    const rng = new Rng((s.seed ^ (s.day * 2654435761)) | 0);
    const order = pool.map(r => ({ r, k: rng.next() })).sort((a, b) => a.k - b.k).map(x => x.r);
    const ids: string[] = [];
    for (const r of order) if (ids.length < REQUESTS_PER_DAY && !ids.some(i => REQUESTS.find(x => x.id === i)!.npc === r.npc)) ids.push(r.id); // farklı kişilerden
    for (const r of order) if (ids.length < REQUESTS_PER_DAY && !ids.includes(r.id)) ids.push(r.id);
    s.requests = { day: s.day, ids, done: [] };
  }
  return s.requests.ids.map(id => {
    const def = REQUESTS.find(r => r.id === id)!;
    return { def, done: s.requests!.done.includes(id), have: Object.entries(def.want).every(([k, n]) => (s.inventory[k] ?? 0) >= n),
      here: s.location === NPC_PLACE[def.npc], npcName: NPCS.find(n => n.id === def.npc)?.name ?? def.npc, place: NPC_PLACE[def.npc] };
  });
}
export function deliverRequest(cfg: Config, s: GameState, id: string): { ok: boolean; reason?: string; text?: string } {
  const v = dailyRequests(s).find(r => r.def.id === id);
  if (!v) return { ok: false, reason: "Böyle bir istek yok" };
  if (v.done) return { ok: false, reason: "Bunu zaten getirdin" };
  if (!v.here) return { ok: false, reason: `${v.npcName} burada değil` };
  if (!v.have) return { ok: false, reason: "Çantanda yeterince yok" };
  for (const [k, n] of Object.entries(v.def.want)) removeItem(s, k, n);
  s.money += v.def.money;
  for (const [k, n] of Object.entries(v.def.gift ?? {})) addItem(cfg, s, k, n);
  addRep(s, s.region, "taninirlik", v.def.rep); addRep(s, s.region, "guven", v.def.rep);
  s.requests!.done.push(id);
  log(s, `${v.npcName}: "${v.def.thanks}" (+${v.def.money} bakır)`, "quest");
  return { ok: true, text: v.def.thanks };
}
