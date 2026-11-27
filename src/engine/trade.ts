// Kervan ticareti: ucuz al, uzağa götür, pahalı sat. Kervan oyun günleriyle yol alır; sonucu her gece uykuda işlenir.
// Yolun tehlikesi yola çıkmadan görünür: izci pusuyu önceden görür, savaşçı ve okçu saldırıyı karşılar. DOM yok.
import type { GameState } from "./state";
import { Rng } from "./rng";
import { dayFactor, ledger, financeOpen } from "./finance";
import { est, heroOf, heroDef, heroStats, gainXp, type Hero } from "./estate";
import { place, isOpen } from "./travel";
import { GOODS, good, TRADE_POSTS, REGION_NAMES, route, CART_CAP, CART_COSTS, PAPERS, paper, FEAST_BONUS, FEAST_COST, type Region } from "../content/trade";
import { lodgingAt } from "./rest";
import { homeBed } from "./estate";

export interface Caravan { id: number; from: Region; to: Region; cargo: Record<string, number>; paid: number; guards: string[]; depart: number; arrive: number }
export interface TradeState { carts: number; caravans: Caravan[]; seq: number; history?: { day: number; text: string; profit: number }[] }
export function tradeOf(s: GameState): TradeState { s.trade ??= { carts: 0, caravans: [], seq: 1 }; return s.trade; }

/** Kervan ticareti Karaçam'da öğrenilir (tüccar şehri). */
export const tradeOpen = (s: GameState) => financeOpen(s);
/** Bu yer bir ticaret yeri mi; öyleyse hangi bölgenin. */
export function postAt(placeId: string): Region | null {
  for (const [r, p] of Object.entries(TRADE_POSTS)) if (p === placeId) return r as Region;
  return null;
}
/** Ticaret yapılabilen yerler: haritada açılmış ve en az bir kez gidilmiş pazarlar (görmediğin pazarın fiyatını bilmezsin). */
export function openPosts(s: GameState): Region[] {
  return (Object.keys(TRADE_POSTS) as Region[]).filter(r => { const id = TRADE_POSTS[r]; const p = place(id); return !!p && isOpen(p, s) && (s.location === id || s.story.flags["v_" + id] !== undefined); });
}

/* ---------- fiyat ---------- */
/** Malın bölgedeki bugünkü değeri (günden güne oynar). */
export function goodValue(s: GameState, r: Region, id: string): number {
  const g = good(id)!; return g.base * g.price[r] * dayFactor(s, TRADE_POSTS[r], "mal:" + id);
}
/** Alış: değerin biraz üstü. Satış: biraz altı; aynı maldan çok satınca birim fiyat düşer. */
export const buyPrice = (s: GameState, r: Region, id: string) => Math.ceil(goodValue(s, r, id) * 1.1);
export function sellTotal(s: GameState, r: Region, id: string, n: number): number {
  if (n <= 0) return 0; const unit = goodValue(s, r, id) * 0.95;
  const glut = Math.max(0.7, 1 - 0.0075 * (n - 1));
  return Math.floor(unit * n * glut);
}

/* ---------- araba ---------- */
export const capacity = (s: GameState) => tradeOf(s).carts * CART_CAP;
export function nextCartCost(s: GameState): number | null { const n = tradeOf(s).carts; return n < CART_COSTS.length ? CART_COSTS[n] : null; }
export function buyCart(s: GameState): { ok: boolean; reason?: string } {
  if (!tradeOpen(s)) return { ok: false, reason: "Ticareti Karaçam'ın tüccarlarından öğrenirsin" };
  if (!postAt(s.location)) return { ok: false, reason: "Araba bir ticaret yerinde alınır" };
  const c = nextCartCost(s); if (c === null) return { ok: false, reason: "Daha fazla araba yönetemezsin" };
  if (s.money < c) return { ok: false, reason: `${c} bakır gerekir` };
  s.money -= c; tradeOf(s).carts++; ledger(s, `Araba aldın (${tradeOf(s).carts}. araba)`, -c);
  return { ok: true };
}
/** Yolda olan arabalar boşta değildir. */
export const cartsBusy = (s: GameState) => tradeOf(s).caravans.reduce((n, c) => n + Math.ceil(Object.values(c.cargo).reduce((a, b) => a + b, 0) / CART_CAP), 0);
export const cartsFree = (s: GameState) => Math.max(0, tradeOf(s).carts - cartsBusy(s));

/* ---------- korumalar ve tehlike ---------- */
const ROLE_FIGHT: Record<string, number> = { savasci: 1.2, okcu: 1.1, izci: 0.8, sifaci: 0.5, isci: 0.5, usta: 0.5 };
/** Korumaların gücü ve izci olup olmadığı. */
export function guardPower(s: GameState, ids: string[]): { power: number; scout: boolean } {
  let power = 0, scout = false;
  for (const id of ids) { const h = heroOf(s, id); if (!h) continue; const d = heroDef(h.id)!; power += heroStats(h).power * (ROLE_FIGHT[d.role] ?? 0.5); if (d.role === "izci") scout = true; }
  return { power, scout };
}
/** Pusu olasılığı (0–1): izci pusuyu önceden görüp yolu değiştirir. */
export const ambushChance = (danger: number, scout: boolean) => Math.max(0.05, Math.min(0.7, danger / 100 * (scout ? 0.5 : 1)));
/** Pusuyu püskürtmek için gereken güç (ortalama). */
export const repelNeed = (danger: number) => danger / 2.4;

export interface CaravanPlan { ok: boolean; reason?: string; cost: number; units: number; carts: number; days: number; danger: number; threat: string; ambush: number; power: number; need: number; estimate: number }
export function planCaravan(s: GameState, to: Region, cargo: Record<string, number>, guards: string[]): CaravanPlan {
  const from = postAt(s.location);
  const units = Object.values(cargo).reduce((a, b) => a + Math.max(0, b), 0);
  const r = from ? route(from, to) : undefined;
  const { power, scout } = guardPower(s, guards);
  const cost = from ? Object.entries(cargo).reduce((n, [id, k]) => n + buyPrice(s, from, id) * Math.max(0, k), 0) : 0;
  const estimate = Object.entries(cargo).reduce((n, [id, k]) => n + sellTotal(s, to, id, k), 0);
  const base: CaravanPlan = { ok: false, cost, units, carts: Math.ceil(units / CART_CAP), days: r?.days ?? 0, danger: r?.danger ?? 0, threat: r?.threat ?? "", ambush: r ? ambushChance(r.danger, scout) : 0, power, need: r ? repelNeed(r.danger) : 0, estimate };
  if (!tradeOpen(s)) return { ...base, reason: "Ticareti Karaçam'ın tüccarlarından öğrenirsin" };
  if (!from) return { ...base, reason: "Kervan bir ticaret yerinden çıkar" };
  if (s.journey) return { ...base, reason: "Yoldasın" };
  if (!r || from === to) return { ...base, reason: "Bu yöne yol yok" };
  if (!openPosts(s).includes(to)) return { ...base, reason: `${REGION_NAMES[to]} pazarını henüz görmedin` };
  if (Object.keys(cargo).some(id => !good(id))) return { ...base, reason: "Bilinmeyen mal" };
  if (units <= 0) return { ...base, reason: "Yük yok" };
  if (units > cartsFree(s) * CART_CAP) return { ...base, reason: cartsFree(s) ? `Boştaki arabaların ${cartsFree(s) * CART_CAP} yük alır` : "Boşta araban yok" };
  if (cost > s.money) return { ...base, reason: `Yük ${cost} bakır tutuyor; cebinde ${s.money} var` };
  for (const id of guards) { const h = heroOf(s, id); if (!h) return { ...base, reason: "Böyle bir adamın yok" }; if (h.status !== "evde") return { ...base, reason: `${heroDef(id)!.name} şu an boşta değil` }; }
  return { ...base, ok: true };
}
export function sendCaravan(s: GameState, to: Region, cargo: Record<string, number>, guards: string[]): CaravanPlan {
  const p = planCaravan(s, to, cargo, guards); if (!p.ok) return p;
  const t = tradeOf(s); const from = postAt(s.location)!;
  const clean = Object.fromEntries(Object.entries(cargo).filter(([, k]) => k > 0));
  s.money -= p.cost;
  for (const id of guards) { const h = heroOf(s, id)!; h.status = "gorevde"; }
  t.caravans.push({ id: t.seq++, from, to, cargo: clean, paid: p.cost, guards, depart: s.day, arrive: s.day + p.days });
  ledger(s, `Kervan yola çıktı: ${REGION_NAMES[from]} → ${REGION_NAMES[to]}`, -p.cost);
  return p;
}

/* ---------- her gece: varan kervanlar ---------- */
export interface CaravanReport { id: number; text: string; profit: number; lost: number; sold: number }
export function nightlyTrade(s: GameState): CaravanReport[] {
  const t = tradeOf(s); const out: CaravanReport[] = [];
  for (const c of [...t.caravans]) {
    if (c.arrive > s.day) continue;
    t.caravans = t.caravans.filter(x => x !== c);
    const rng = new Rng((s.seed * 31337 + c.id * 7919 + s.day * 131) | 0);
    const r = route(c.from, c.to)!; const guards = c.guards.map(id => heroOf(s, id)).filter((h): h is Hero => !!h);
    const { power, scout } = guardPower(s, guards.map(h => h.id));
    const cargo = { ...c.cargo }; let story = ""; let lostUnits = 0;
    if (rng.chance(ambushChance(r.danger, scout) * 100)) {
      const need = repelNeed(r.danger) * (0.7 + rng.next() * 0.6);
      if (power >= need) {
        story = `${r.threat.split(",")[0]} yolu kesti; korumalar püskürttü.`;
        for (const h of guards) { if (rng.chance(20)) { h.status = "yarali"; h.until = s.day + 1; h.hp = Math.max(1, Math.round(heroStats(h).maxHp * 0.5)); story += ` ${heroDef(h.id)!.name} yaralandı.`; } }
      } else {
        // korumasız kervan yükün çoğunu kaybeder ama her şeyini değil; korumalar zayıfsa kayıp azalır
        const frac = Math.max(0.35, Math.min(0.85, 0.35 + 0.5 * (1 - power / need)));
        for (const [id, k] of Object.entries(cargo)) { const l = Math.round(k * frac); cargo[id] = k - l; lostUnits += l; }
        story = `${r.threat.split(",")[0]} kervanı bastı; yükün ${lostUnits} denki gitti.`;
        for (const h of guards) { h.status = "yarali"; h.until = s.day + 2; h.hp = Math.max(1, Math.round(heroStats(h).maxHp * 0.3)); h.loyalty -= 2; }
      }
    } else story = "Yol sakin geçti.";
    const sold = Object.entries(cargo).reduce((n, [id, k]) => n + sellTotal(s, c.to, id, k), 0);
    s.money += sold; const profit = sold - c.paid;
    for (const h of guards) { if (h.status === "gorevde") h.status = "evde"; gainXp(s, h, 3 + Math.floor(r.danger / 10)); h.loyalty = Math.min(100, h.loyalty + 1); }
    const text = `${REGION_NAMES[c.from]} → ${REGION_NAMES[c.to]}: ${story} ${sold ? `Yük ${sold} bakıra satıldı` : "Satacak bir şey kalmadı"} (${profit >= 0 ? "+" : ""}${profit}).`;
    ledger(s, text, sold); (t.history ??= []).unshift({ day: s.day, text, profit }); t.history.length = Math.min(t.history.length, 12);
    out.push({ id: c.id, text, profit, lost: lostUnits, sold });
  }
  return out;
}

/* ---------- belgeler ---------- */
export const hasPaper = (s: GameState, id: string) => s.story.flags["belge_" + id] !== undefined;
/** Bu yerde satılan ve artık alınabilir olan belgeler. */
export const papersAt = (s: GameState, placeId: string) => PAPERS.filter(p => p.place === placeId && s.story.reached.includes(p.after) && !hasPaper(s, p.id));
export function buyPaper(s: GameState, id: string): { ok: boolean; reason?: string } {
  const p = paper(id); if (!p) return { ok: false, reason: "Böyle bir belge yok" };
  if (hasPaper(s, id)) return { ok: false, reason: "Zaten sende" };
  if (s.location !== p.place) return { ok: false, reason: `${p.seller} ${place(p.place)?.name ?? ""} tarafında` };
  if (!s.story.reached.includes(p.after)) return { ok: false, reason: "Henüz kimse sana bundan söz etmedi" };
  if (s.money < p.cost) return { ok: false, reason: `${p.cost} bakır gerekir; cebinde ${s.money} var` };
  s.money -= p.cost; s.story.flags["belge_" + id] = s.day; ledger(s, `${p.name} aldın`, -p.cost);
  return { ok: true };
}

/* ---------- iyi sofra ---------- */
/** Burada zengin sofra kurulabilir mi; bedeli. Handa ve konaklanan yerlerde pahalı, kendi evinde ucuz. */
export function feastHere(s: GameState): { cost: number; where: string } | null {
  if (homeBed(s)) return { cost: FEAST_COST.home, where: "Evinde" };
  const l = lodgingAt(s.location); if (l && !l.unlock(s) && l.cost > 0) return { cost: FEAST_COST.lodging, where: l.name };
  return null;
}
export function feast(s: GameState): { ok: boolean; reason?: string } {
  const f = feastHere(s); if (!f) return { ok: false, reason: "Burada sofra kurulmaz" };
  if (s.feast === s.day) return { ok: false, reason: "Bu akşam zaten doydun" };
  if (s.money < f.cost) return { ok: false, reason: `${f.cost} bakır gerekir` };
  s.money -= f.cost; s.feast = s.day; s.satiety = 100; ledger(s, "Zengin sofra", -f.cost);
  return { ok: true };
}
export { FEAST_BONUS, GOODS, REGION_NAMES };
