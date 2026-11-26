// Diyar: ev, işletmeler, adamlar (işçi ve kahramanlar), görev panosu, rütbe. DOM yok.
// Adamlar evde yaşar; yanında gezenler (en çok 2) savaşta yardım eder. Yanında olmayan birine haber salarsan
// gelmesi vakit alır. Evdekiler günlük işlere atanır; sonuç ertesi sabah belli olur.
import type { Config } from "./config";
import { type GameState, DAY_MINUTES, repOf, log } from "./state";
import { addItem, removeItem, freeCount, itemInfo } from "./inventory";
import { route, MIN_PER_UNIT } from "./travel";
import { Rng } from "./rng";
import { QUESTS } from "../content/world";
import { RANKS, HOUSES, HOME_PLACES, VENTURES, HEROES, JOBS, heroDef, jobDef, ROLE_NAMES, type RankDef, type HeroRole, type VentureDef, type JobDef } from "../content/estate";

export { RANKS, HOUSES, HOME_PLACES, VENTURES, HEROES, JOBS, heroDef, jobDef, ROLE_NAMES };
export interface Hero { id: string; lv: number; xp: number; loyalty: number; hp: number; status: "evde" | "yolda" | "gorevde" | "yarali"; until?: number }
export interface Mission { job: string; hero: string; end: number }
export interface Venture { lv: number; worker?: string; stock: number; acc: number }
export interface Estate { house?: number; homePlace?: string; ventures?: Record<string, Venture>; heroes?: Hero[]; party?: string[]; missions?: Mission[]; reports?: string[] }

export function est(s: GameState): Estate { s.estate ??= {}; const e = s.estate as Estate; e.ventures ??= {}; e.heroes ??= []; e.party ??= []; e.missions ??= []; e.reports ??= []; return e; }
const done = (s: GameState, q: string) => (s.quests[q]?.count ?? 0) > 0 || s.quests[q]?.status === "bitti";

/* ---------- rütbe ---------- */
export function score(s: GameState): number {
  const e = est(s);
  const rep = Object.values(s.rep ?? {}).reduce((n, r) => n + (r.taninirlik ?? 0) + (r.guven ?? 0) * 0.5, 0);
  const quests = Object.values(s.quests).filter(q => q.status === "bitti" || (q.count ?? 0) > 0).length;
  return Math.floor(rep + quests * 2 + (e.house ? 8 + (e.house - 1) * 6 : 0) + Object.values(e.ventures!).reduce((n, v) => n + 5 * v.lv, 0) + e.heroes!.reduce((n, h) => n + 4 + h.lv, 0));
}
export function rankOf(s: GameState): { rank: RankDef; next?: RankDef; score: number; frac: number } {
  const sc = score(s); const rank = [...RANKS].reverse().find(r => sc >= r.at)!; const next = RANKS.find(r => r.id === rank.id + 1);
  return { rank, next, score: sc, frac: next ? (sc - rank.at) / (next.at - rank.at) : 1 };
}
export const rankNo = (s: GameState) => rankOf(s).rank.id;

/* ---------- ev ---------- */
export interface Check { ok: boolean; reason?: string }
const afford = (cfg: Config, s: GameState, c: { money: number; items: Record<string, number> }): Check => {
  if (s.money < c.money) return { ok: false, reason: `${c.money} bakır gerekir` };
  for (const [m, n] of Object.entries(c.items)) if (freeCount(cfg, s, m) < n) return { ok: false, reason: "Malzeme yetmiyor" };
  return { ok: true };
};
const pay = (s: GameState, c: { money: number; items: Record<string, number> }) => { s.money -= c.money; for (const [m, n] of Object.entries(c.items)) removeItem(s, m, n); };
export function canBuyHouse(cfg: Config, s: GameState, placeId = s.location): Check {
  const e = est(s); const lv = e.house ?? 0;
  if (lv === 0) {
    if (!HOME_PLACES.includes(placeId)) return { ok: false, reason: "Burada ev kurulmaz (köy meydanı, Karaçam ya da Ayazkale mutfağı)" };
    if (rankNo(s) < 1) return { ok: false, reason: "Önce biraz tanın (rütbe: Köy dostu)" };
    return afford(cfg, s, HOUSES[0].cost);
  }
  if (lv >= HOUSES.length) return { ok: false, reason: "Ev en büyük hâlinde" };
  if (s.location !== e.homePlace) return { ok: false, reason: "Evini büyütmek için evinde olmalısın" };
  if (rankNo(s) < lv + 1) return { ok: false, reason: `Rütbe ${lv + 1} gerekir` };
  return afford(cfg, s, HOUSES[lv].cost);
}
export function buyHouse(cfg: Config, s: GameState): Check {
  const c = canBuyHouse(cfg, s); if (!c.ok) return c; const e = est(s); const lv = e.house ?? 0;
  pay(s, HOUSES[lv].cost); e.house = lv + 1; if (lv === 0) e.homePlace = s.location;
  log(s, lv === 0 ? `Ev kurdun: ${HOUSES[0].name}.` : `Evi büyüttün: ${HOUSES[lv].name}.`, "quest"); return { ok: true };
}
export const houseOf = (s: GameState) => { const lv = est(s).house ?? 0; return lv ? HOUSES[lv - 1] : null; };
/** Evde uykunun kalitesi: ev büyüdükçe artar, güvenli ve parasız. */
export function homeBed(s: GameState): { name: string; quality: number } | null { const h = houseOf(s); return h && s.location === est(s).homePlace ? { name: h.name, quality: h.bed } : null; }

/* ---------- adamlar ---------- */
export function heroLimit(s: GameState): number { const h = houseOf(s); return h ? Math.min(rankNo(s), h.rooms) : 0; }
export function heroStats(h: Hero) {
  const d = heroDef(h.id)!; const power = d.power + (h.lv - 1) * 1.5;
  return { power, maxHp: Math.round(20 + power * 3 + h.lv * 4), dmg: [2 + Math.floor(power / 2), 4 + Math.round(power)] as [number, number], accuracy: 55 + power * 2, range: d.role === "okcu" ? 3 : 1 };
}
export const heroOf = (s: GameState, id: string) => est(s).heroes!.find(h => h.id === id);
export function candidatesAt(s: GameState, place: string) { const have = est(s).heroes!.map(h => h.id); return HEROES.filter(h => h.place === place && !have.includes(h.id)); }
export function canHire(s: GameState, id: string): Check {
  const d = heroDef(id); if (!d) return { ok: false, reason: "Yok" }; const e = est(s);
  if (e.heroes!.some(h => h.id === id)) return { ok: false, reason: "Zaten yanında" };
  if (!e.house) return { ok: false, reason: "Adamlar için bir ev gerekir" };
  if (rankNo(s) < d.minRank) return { ok: false, reason: `Rütbe ${d.minRank} gerekir` };
  if (e.heroes!.length >= heroLimit(s)) return { ok: false, reason: `En çok ${heroLimit(s)} adam tutabilirsin (rütbe ve ev odası)` };
  if (s.location !== d.place) return { ok: false, reason: `${d.name} burada değil` };
  if (s.money < d.hire) return { ok: false, reason: `${d.hire} bakır gerekir` };
  return { ok: true };
}
export function hire(s: GameState, id: string): Check {
  const c = canHire(s, id); if (!c.ok) return c; const d = heroDef(id)!;
  s.money -= d.hire; const h: Hero = { id, lv: 1, xp: 0, loyalty: 60, hp: 0, status: "evde" }; h.hp = heroStats(h).maxHp; est(s).heroes!.push(h);
  log(s, `${d.name} (${ROLE_NAMES[d.role]}) artık sana bağlı.`, "quest"); return { ok: true };
}
export function dismiss(s: GameState, id: string): Check {
  const e = est(s); const i = e.heroes!.findIndex(h => h.id === id); if (i < 0) return { ok: false, reason: "Yok" };
  e.heroes!.splice(i, 1); e.party = e.party!.filter(x => x !== id); e.missions = e.missions!.filter(m => m.hero !== id);
  for (const v of Object.values(e.ventures!)) if (v.worker === id) v.worker = undefined; return { ok: true };
}
export function xpFor(lv: number) { return 8 + lv * 6; }
export function gainXp(s: GameState, h: Hero, xp: number): string | null {
  h.xp += xp; let up: string | null = null;
  while (h.xp >= xpFor(h.lv) && h.lv < 10) { h.xp -= xpFor(h.lv); h.lv++; h.hp = heroStats(h).maxHp; up = `${heroDef(h.id)!.name} seviye atladı: ${h.lv}.`; }
  return up;
}
export const heroFree = (h: Hero) => h.status === "evde";

/* ---------- yanında gezenler ---------- */
export const PARTY_MAX = 2;
export function partyHeroes(s: GameState): Hero[] { return est(s).party!.map(id => heroOf(s, id)).filter((h): h is Hero => !!h && h.status !== "yarali"); }
export function togglePartyCheck(s: GameState, id: string): Check {
  const e = est(s); const h = heroOf(s, id); if (!h) return { ok: false, reason: "Yok" };
  if (e.party!.includes(id)) return { ok: true };
  if (h.status === "yarali") return { ok: false, reason: "Yaralı" };
  if (h.status === "gorevde") return { ok: false, reason: "Görevde" };
  if (e.party!.length >= PARTY_MAX) return { ok: false, reason: `Yanında en çok ${PARTY_MAX} kişi gezebilir` };
  if (s.location !== e.homePlace) return { ok: false, reason: "Yanına almak için evde olmalısın; uzaktakine haber salarsın" };
  return { ok: true };
}
export function toggleParty(s: GameState, id: string): Check {
  const c = togglePartyCheck(s, id); if (!c.ok) return c; const e = est(s); const h = heroOf(s, id)!;
  if (e.party!.includes(id)) { e.party = e.party!.filter(x => x !== id); h.status = "evde"; } else { e.party!.push(id); h.status = "yolda"; }
  return { ok: true };
}

/* ---------- haber salma (uzaktaki savaşa yardım) ---------- */
/** Evdeki adamın savaş yerine varma süresi (dakika): yol + haberin gitmesi. */
export function etaTo(s: GameState, place: string): number {
  const home = est(s).homePlace; if (!home) return 0; if (home === place) return 15;
  const r = route(home, place, s); return Math.max(20, Math.round((r?.length ?? 300) * MIN_PER_UNIT * 0.85) + 20);
}
export function callable(s: GameState, place: string) {
  const e = est(s); const eta = etaTo(s, place);
  return e.heroes!.filter(h => h.status === "evde" && !e.party!.includes(h.id)).map(h => ({ hero: h, eta, ok: DAY_MINUTES - s.minute > eta + 60 }));
}
/** Çağır: süre geçer; savaş boyunca yanında sayılır, sonra evine döner. */
export function callHero(s: GameState, id: string, place: string): { ok: boolean; reason?: string; minutes?: number } {
  const h = heroOf(s, id); if (!h || h.status !== "evde") return { ok: false, reason: "Çağrılamaz" };
  const c = callable(s, place).find(x => x.hero.id === id); if (!c?.ok) return { ok: false, reason: "Yetişemez; gün bitiyor" };
  s.minute = Math.min(DAY_MINUTES, s.minute + c.eta); return { ok: true, minutes: c.eta };
}
/** Birkaç kişiyi birlikte çağır: hepsi birlikte yola çıkar, süre bir kez geçer. */
export function callMany(s: GameState, ids: string[], place: string): { ok: boolean; reason?: string; minutes: number } {
  if (!ids.length) return { ok: true, minutes: 0 };
  const list = callable(s, place); for (const id of ids) if (!list.find(x => x.hero.id === id)?.ok) return { ok: false, reason: "Yetişemezler; gün bitiyor", minutes: 0 };
  const eta = etaTo(s, place); s.minute = Math.min(DAY_MINUTES, s.minute + eta); return { ok: true, minutes: eta };
}
/** Savaştan sonra: deneyim, yaralanma. */
export function afterBattle(s: GameState, ids: string[], result: "won" | "lost" | "fled", hp?: Record<string, number>): string[] {
  const out: string[] = []; const rng = new Rng((s.seed * 31 + s.day * 977 + s.minute) | 0);
  for (const id of ids) {
    const h = heroOf(s, id); if (!h) continue;
    if (hp?.[id] !== undefined) h.hp = Math.max(1, Math.min(heroStats(h).maxHp, Math.round(hp[id])));   // savaştan kalan can
    const up = gainXp(s, h, result === "won" ? 6 : 2); if (up) out.push(up);
    if (result !== "won" && rng.chance(result === "lost" ? 55 : 20)) { h.status = "yarali"; h.until = s.day + 2; h.hp = Math.max(1, Math.round(heroStats(h).maxHp * 0.3)); est(s).party = est(s).party!.filter(x => x !== id); out.push(`${heroDef(id)!.name} yaralandı.`); }
    else h.loyalty = Math.min(100, h.loyalty + (result === "won" ? 2 : 0));
  }
  return out;
}

/* ---------- görev panosu ---------- */
export function jobsFor(s: GameState): JobDef[] { return JOBS.filter(j => rankNo(s) >= j.minRank && (!j.needsQuest || done(s, j.needsQuest))); }
export function successChance(h: Hero, j: JobDef): number {
  const d = heroDef(h.id)!; const power = heroStats(h).power * (j.role.includes(d.role) ? 1.8 : 0.9) + h.lv * 1.5;
  return Math.max(0.1, Math.min(0.95, 0.5 + (power - j.diff) / 25 + (h.loyalty - 50) / 400));
}
export function canAssign(s: GameState, jobId: string, heroId: string): Check {
  const j = jobDef(jobId); const h = heroOf(s, heroId); if (!j || !h) return { ok: false, reason: "Yok" };
  if (!jobsFor(s).includes(j)) return { ok: false, reason: "Bu iş henüz açılmadı" };
  if (h.status !== "evde") return { ok: false, reason: h.status === "yarali" ? "Yaralı" : h.status === "gorevde" ? "Zaten bir işte" : "Seninle geziyor" };
  if (est(s).missions!.some(m => m.job === jobId)) return { ok: false, reason: "Bu işe biri gitti" };
  return { ok: true };
}
export function assign(s: GameState, jobId: string, heroId: string): Check {
  const c = canAssign(s, jobId, heroId); if (!c.ok) return c; const j = jobDef(jobId)!;
  est(s).missions!.push({ job: jobId, hero: heroId, end: s.day + j.days }); heroOf(s, heroId)!.status = "gorevde"; return { ok: true };
}
export function recall(s: GameState, heroId: string) { const e = est(s); e.missions = e.missions!.filter(m => m.hero !== heroId); const h = heroOf(s, heroId); if (h?.status === "gorevde") h.status = "evde"; }

/* ---------- işletmeler ---------- */
export function canFound(cfg: Config, s: GameState, id: string): Check {
  const d = VENTURES.find(v => v.id === id); const e = est(s); if (!d) return { ok: false, reason: "Yok" };
  if (e.ventures![id]) return { ok: false, reason: "Zaten kurulu" };
  if (!e.house) return { ok: false, reason: "Önce bir ev" };
  if (rankNo(s) < d.minRank) return { ok: false, reason: `Rütbe ${d.minRank} gerekir` };
  if (s.location !== e.homePlace) return { ok: false, reason: "Evinde olmalısın" };
  return afford(cfg, s, d.cost);
}
export function found(cfg: Config, s: GameState, id: string): Check { const c = canFound(cfg, s, id); if (!c.ok) return c; pay(s, VENTURES.find(v => v.id === id)!.cost); est(s).ventures![id] = { lv: 1, stock: 0, acc: 0 }; log(s, `${VENTURES.find(v => v.id === id)!.name} kurdun.`, "quest"); return { ok: true }; }
export const ventureUpCost = (d: VentureDef, lv: number) => ({ money: Math.round(d.cost.money * (0.8 + lv * 0.7)), items: Object.fromEntries(Object.entries(d.cost.items).map(([k, n]) => [k, n + lv * 2])) });
export function canUpVenture(cfg: Config, s: GameState, id: string): Check {
  const d = VENTURES.find(v => v.id === id)!; const v = est(s).ventures![id]; if (!v) return { ok: false, reason: "Kurulu değil" };
  if (v.lv >= 3) return { ok: false, reason: "En üst seviyede" }; if (rankNo(s) < d.minRank + v.lv - 1) return { ok: false, reason: `Rütbe ${d.minRank + v.lv - 1} gerekir` };
  return afford(cfg, s, ventureUpCost(d, v.lv));
}
export function upVenture(cfg: Config, s: GameState, id: string): Check { const c = canUpVenture(cfg, s, id); if (!c.ok) return c; const v = est(s).ventures![id]; pay(s, ventureUpCost(VENTURES.find(x => x.id === id)!, v.lv)); v.lv++; return { ok: true }; }
export function setWorker(s: GameState, ventureId: string, heroId?: string): Check {
  const e = est(s); const v = e.ventures![ventureId]; if (!v) return { ok: false, reason: "Yok" };
  if (heroId) { const h = heroOf(s, heroId); if (!h) return { ok: false, reason: "Yok" }; for (const o of Object.values(e.ventures!)) if (o.worker === heroId) o.worker = undefined; if (e.party!.includes(heroId)) return { ok: false, reason: "Seninle geziyor" }; }
  v.worker = heroId; return { ok: true };
}
export function collect(cfg: Config, s: GameState, id: string): { ok: boolean; got: number; lost: number } {
  const d = VENTURES.find(v => v.id === id)!; const v = est(s).ventures![id]; if (!v || v.stock < 1) return { ok: false, got: 0, lost: 0 };
  const n = Math.floor(v.stock); const lost = addItem(cfg, s, d.makes, n); v.stock -= n - lost; return { ok: true, got: n - lost, lost };
}

/* ---------- her gece ---------- */
export function nightly(cfg: Config, s: GameState): string[] {
  const e = est(s); const out: string[] = []; const rng = new Rng((s.seed * 7 + s.day * 104729 + 13) | 0);
  // Karabaş (bağ 75) her gün bir şey bulup getirir
  if (s.pet?.id === "kopek" && (s.pet.bond ?? 0) >= 75) { const it = rng.chance(50) ? "kekik" : "odun"; if (addItem(cfg, s, it, 1) === 0) out.push(`${s.pet.name} ağzında bir ${itemInfo(cfg, it).name.toLowerCase()} getirdi.`); }
  if (!e.house && !e.heroes!.length) return out;
  // maaşlar
  let wages = 0; for (const h of e.heroes!) wages += heroDef(h.id)!.wage;
  if (wages) {
    if (s.money >= wages) { s.money -= wages; out.push(`Adamların maaşı: −${wages} bakır.`); for (const h of e.heroes!) h.loyalty = Math.min(100, h.loyalty + 0.5); }
    else { out.push(`Maaşı ödeyemedin (${wages} bakır); adamların huysuzlandı.`); for (const h of e.heroes!) h.loyalty -= 6; }
  }
  // iyileşme
  const healer = e.heroes!.some(h => heroDef(h.id)!.role === "sifaci" && h.status === "evde");
  for (const h of e.heroes!) if (h.status === "yarali") { if ((h.until ?? 0) - (healer ? 1 : 0) <= s.day) { h.status = "evde"; h.hp = heroStats(h).maxHp; out.push(`${heroDef(h.id)!.name} iyileşti.`); } }
    else h.hp = Math.min(heroStats(h).maxHp, h.hp + 8);
  // işler
  for (const m of [...e.missions!]) {
    if (m.end > s.day) continue; const h = heroOf(s, m.hero); const j = jobDef(m.job)!; e.missions = e.missions!.filter(x => x !== m);
    if (!h) continue; const d = heroDef(h.id)!;
    if (rng.chance(successChance(h, j) * 100)) {
      s.money += j.money; let lost = 0; for (const [k, n] of Object.entries(j.items)) lost += addItem(cfg, s, k, n);
      const up = gainXp(s, h, 5 + Math.floor(j.diff / 6)); h.loyalty = Math.min(100, h.loyalty + 2); h.status = "evde";
      out.push(`${d.name}: "${j.name}" tamam${j.money ? ` · +${j.money} bakır` : ""}${Object.keys(j.items).length ? ` · ${Object.entries(j.items).map(([k, n]) => `${n} ${k}`).join(", ")}` : ""}${lost ? " (çantaya sığmayanlar kaldı)" : ""}.`); if (up) out.push(up);
    } else { h.status = "yarali"; h.until = s.day + 2; h.hp = Math.max(1, Math.round(heroStats(h).maxHp * 0.3)); h.loyalty -= 3; out.push(`${d.name}: "${j.name}" kötü gitti; yaralı döndü.`); }
  }
  // işletmeler
  for (const d of VENTURES) {
    const v = e.ventures![d.id]; if (!v) continue; const w = v.worker ? heroOf(s, v.worker) : undefined;
    if (!w || w.status !== "evde") continue; const up = d.upkeep * v.lv;
    if (s.money < up) { out.push(`${d.name}: bakım parası yok, iş durdu.`); continue; }
    s.money -= up; const hd = heroDef(w.id)!; const fit = hd.role === d.need ? 1 : 0.55;
    v.acc += d.per * v.lv * fit * (0.7 + heroStats(w).power / 14) * (s.pet?.id === "kedi" && (s.pet.bond ?? 0) >= 50 ? 1.1 : 1); const k = Math.floor(v.acc); v.acc -= k; v.stock = Math.min(10 * v.lv, v.stock + k);
    if (k) out.push(`${d.name}: +${k} ${d.makes}.`);
  }
  // sadakat bitmiş olanlar gider
  for (const h of [...e.heroes!]) if (h.loyalty < 15) { out.push(`${heroDef(h.id)!.name} küstü ve gitti.`); dismiss(s, h.id); }
  e.reports = out.slice(0, 12); return out;
}
