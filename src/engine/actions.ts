// Bir yerde ne yapılabilir: haritadaki yer kartı bunu gösterir, oradan doğrudan yapılır.
import type { Config } from "./config";
import type { GameState } from "./state";
import { questList, npc, questKind, KIND_ORDER } from "./quests";
import { minutesLeft } from "./state";
import { canSearch, dailyRequests } from "./explore";
import { activityPlace, place } from "./travel";
import { nextMilestone, openSideStories } from "./story";
import { NPC_PLACE } from "../content/map";
import { FINDS, SEARCH_MINUTES } from "../content/explore";
import { MARKETS } from "../content/world";
import { partnerAt, partnerLock, stake } from "./finance";
import { lodgingAt } from "./rest";
import { sitesAt, TIER_NAMES } from "./scavenge";
import { olcerOpen, nextLevel, solvedLevels, OLCER_PLACE, OLCER_LEVELS, canStartOlcer } from "./olcer";
import { PET_TYPES, canAdopt } from "./pet";
import { tradeOpen, postAt, tradeOf, cartsFree, papersAt, hasPaper, feastHere } from "./trade";
import { REGION_NAMES, paper } from "../content/trade";
import { homeBed, candidatesAt, canHire, canBuyHouse, HOUSES, HOME_PLACES, ROLE_NAMES } from "./estate";

export interface PlaceAction {
  act: "accept" | "fight" | "walk" | "search" | "deliver" | "session-pick" | "study" | "market" | "show-place" | "partner" | "sleep" | "scav" | "pet-adopt" | "hire" | "house" | "olcer" | "caravan" | "paper" | "feast";
  id: string; label: string; sub?: string; disabled?: string; primary?: boolean;
}
/** Bulunduğun yerde yapılabilecekler, önem sırasıyla. */
export function placeActions(cfg: Config, s: GameState, placeId: string): PlaceAction[] {
  const out: PlaceAction[] = [];
  const qs = questList(s);
  for (const q of qs) if (q.status === "aktif" && q.def.at === placeId)
    out.push({ act: q.def.battle || q.def.siege ? "fight" : "walk", id: q.def.id, label: q.def.siege ? `Savun: ${q.def.title}` : q.def.battle ? `Savaş: ${q.def.title}` : `${q.def.doneText ?? "Yap"}: ${q.def.title}`, sub: q.def.siege ? "Dalga dalga saldırı; önce barikat kurarsın." : q.def.battle ? "Göğüs göğüse, barikat ya da gizlenerek." : `${q.def.minutes} dk`, primary: true });
  for (const q of qs) if (q.status === "yeni" && NPC_PLACE[q.def.giverNpc] === placeId)
    out.push({ act: "accept", id: q.def.id, label: `İşi üstlen: ${q.def.title}`, sub: `${npc(q.def.giverNpc).name} · ${place(q.def.at)?.name ?? ""}` });
  for (const r of dailyRequests(s)) if (r.place === placeId && !r.done)
    out.push({ act: "deliver", id: r.def.id, label: `${r.npcName}'in isteği`, sub: r.def.text, disabled: r.have ? undefined : "Çantanda yeterince yok" });
  if (FINDS[placeId]) { const c = placeId === s.location ? canSearch(s) : { ok: true }; out.push({ act: "search", id: "", label: `Etrafı ara (${SEARCH_MINUTES} dk)`, disabled: c.ok ? undefined : c.reason }); }
  if (MARKETS[placeId]) out.push({ act: "market", id: placeId, label: MARKETS[placeId].name, sub: "Al, sat" });
  // kervan ticareti: ticaret yerinde yük alıp kervan yollarsın
  const post = postAt(placeId);
  if (post && tradeOpen(s)) { const t = tradeOf(s); out.push({ act: "caravan", id: placeId, label: `Kervan kur: ${REGION_NAMES[post]}`, sub: t.carts ? `${cartsFree(s)}/${t.carts} araba boşta · ${t.caravans.length} kervan yolda` : "Önce bir araba al", disabled: placeId === s.location ? undefined : "Oraya git" }); }
  for (const p of papersAt(s, placeId)) out.push({ act: "paper", id: p.id, label: `Satın al: ${p.name}`, sub: `${p.seller} · ${p.cost} bakır`, disabled: placeId === s.location ? (s.money >= p.cost ? undefined : `${p.cost} bakır gerekir; cebinde ${s.money} var`) : "Oraya git", primary: true });
  if (placeId === s.location) { const f = feastHere(s); if (f) out.push({ act: "feast", id: "", label: `Zengin sofra (${f.cost} bakır)`, sub: "Bu gece uykuda kasların %25 daha çok gelişir", disabled: s.feast === s.day ? "Bu akşam zaten doydun" : s.money < f.cost ? `${f.cost} bakır gerekir` : undefined }); }
  for (const p of partnerAt(placeId)) { const lock = partnerLock(s, p); const st = stake(s, p.id);
    if (!lock || st) out.push({ act: "partner", id: p.id, label: `Ortaklık: ${p.name}`, sub: st ? `Payın: ${st} bakır` : `En az ${p.min} bakır` }); }
  for (const pt of Object.values(PET_TYPES)) if (pt.shop === placeId) { const c = canAdopt(s, pt.id, placeId); out.push({ act: "pet-adopt", id: pt.id, label: `Yavru al: ${pt.species}`, sub: `${pt.price} bakır · ${pt.role}`, disabled: c.ok ? undefined : c.reason }); }
  for (const h of candidatesAt(s, placeId)) { const c = canHire(s, h.id); out.push({ act: "hire", id: h.id, label: `Adam tut: ${h.name}`, sub: `${ROLE_NAMES[h.role]} · ${h.hire} bakır, günlük ${h.wage} · ${h.bio}`, disabled: c.ok ? undefined : c.reason }); }
  if (HOME_PLACES.includes(placeId) && !(s.estate?.house)) { const c = canBuyHouse(cfg, s, placeId); out.push({ act: "house", id: placeId, label: `Ev kur: ${HOUSES[0].name}`, sub: `${HOUSES[0].cost.money} bakır + ${Object.entries(HOUSES[0].cost.items).map(([k, n]) => `${n} ${k}`).join(", ")} · ${HOUSES[0].desc}`, disabled: placeId === s.location ? (c.ok ? undefined : c.reason) : "Oraya git" }); }
  if (placeId === OLCER_PLACE && olcerOpen(s)) { const l = nextLevel(s); const n = solvedLevels(s).length; const c = canStartOlcer(s);
    out.push({ act: "olcer", id: l.id, label: `Ölçer işi: ${l.title}`, sub: n >= OLCER_LEVELS.length ? "Hepsini çözdün · alıştırma" : `Isıyı ölç ve taşı · ${n}/${OLCER_LEVELS.length}`, disabled: c.ok ? undefined : c.reason }); }
  const ruins = sitesAt(placeId).filter(x => !x.unlock(s));
  if (ruins.length) out.push({ act: "scav", id: placeId, label: ruins.length > 1 ? `Harabeler (${ruins.length})` : `Harabeyi ara: ${ruins[0].name}`,
    sub: ruins.map(x => `${x.name} · ${TIER_NAMES[x.tier]}`).join(" / "), disabled: placeId === s.location ? undefined : "Oraya git" });
  if (placeId === s.location) {
    const l = lodgingAt(placeId); const hb = homeBed(s); const ok = !!hb || (!!l && !l.unlock(s));
    out.push({ act: "sleep", id: "", label: ok ? `Konakla: ${hb?.name ?? l!.name}` : "Dinlen ya da kamp kur", sub: ok ? "Güvenli uyku, dinlenme" : "Açıkta uyumak tehlikeli" });
  }
  for (const a of cfg.data.activities) {
    if (a.kind === "kullanim") continue;
    const where = activityPlace(a.id);
    if (where?.includes(placeId)) out.push({ act: "session-pick", id: a.id, label: `Çalış: ${a.name}`, sub: a.kind === "ders" ? "Ders" : "Yalnız burada yapılır" });
  }
  // her yerde yapılabilenler (koşu, idman, büyü...) için Çalış sayfası
  if (placeId === s.location && !s.journey) out.push({ act: "study", id: "", label: "Başka çalışmalar", sub: "Koşu, idman, büyü ve buradaki dersler" });
  return out;
}
/** Burada yapacak bir şey yoksa: sıradaki iş nerede. */
export function nextHint(s: GameState): PlaceAction | null {
  const q = questList(s).find(v => v.status === "aktif" && v.def.at !== s.location);
  if (q) return { act: "show-place", id: q.def.at, label: `Sıradaki iş: ${q.def.title}`, sub: `${place(q.def.at)?.name ?? ""} tarafında` };
  const n = questList(s).find(v => v.status === "yeni" && NPC_PLACE[v.def.giverNpc] !== s.location);
  if (n) return { act: "show-place", id: NPC_PLACE[n.def.giverNpc], label: `Yeni iş: ${n.def.title}`, sub: `${npc(n.def.giverNpc).name} ${place(NPC_PLACE[n.def.giverNpc])?.name ?? ""} tarafında` };
  const m = nextMilestone(s);
  return m?.hint ? { act: "show-place", id: "", label: m.title, sub: m.hint } : null;
}

/** Defter'in üstündeki "Sıradaki adım": tek cümle ve tek düğme. */
export interface NextStep { title: string; text: string; act?: PlaceAction["act"]; id?: string; button?: string; kind?: "ana" | "hikaye" | "yan" | "uyku";
  /** Aynı anda süren ikinci iplik (ör. ana hedefin yanında yan hikâye): kafa karışmasın diye adıyla gösterilir. */
  also?: { title: string; kind: "ana" | "hikaye" | "yan" } }
export function nextStep(s: GameState): NextStep | null {
  const r = stepCore(s);
  // ana iş gösterilirken süren bir yan hikâye varsa kartın altında adıyla anılır
  if (r && r.kind === "ana" && !r.also) {
    const side = questList(s).find(v => (v.status === "aktif" || v.status === "yeni") && questKind(v.def) === "hikaye" && v.def.title !== r.title);
    if (side) r.also = { title: side.def.title, kind: "hikaye" };
    else { const ss = openSideStories(s)[0]; if (ss) r.also = { title: ss.title, kind: "hikaye" }; }
  }
  return r;
}
function stepCore(s: GameState): NextStep | null {
  if (!s.journey && (minutesLeft(s) <= 0 || s.energy < 15))
    return { title: minutesLeft(s) <= 0 ? "Gün bitti" : "Bitkinsin", text: "Uyu ya da dinlen; kasların uykuda gelişir.", act: "sleep", id: "", button: "Uyu", kind: "uyku" };
  const local = (at: string) => (place(at)?.region ?? "taspinar") === (s.region ?? "taspinar") ? 0 : 1;
  const open = questList(s).filter(q => q.status === "aktif" || q.status === "yeni")
    .sort((a, b) => (a.status === "aktif" ? 0 : 1) - (b.status === "aktif" ? 0 : 1) || KIND_ORDER[questKind(a.def)] - KIND_ORDER[questKind(b.def)] || local(a.def.at) - local(b.def.at));
  // ana hikâyenin sıradaki sayfası bir göreve bağlı değilse (ör. Ateş çalış) ve önde ana görev yoksa, önce o gösterilir
  const m0 = nextMilestone(s);
  const side = open.find(v => questKind(v.def) !== "ana");
  if (m0?.go && !s.journey && !open.some(v => questKind(v.def) === "ana"))
    return { title: m0.title, text: m0.hint, act: m0.go.act, id: m0.go.id, button: m0.go.button, kind: "ana",
      also: side ? { title: side.def.title, kind: questKind(side.def) } : undefined };
  const q = open[0];
  if (q) {
    const kind = questKind(q.def); const giverAt = NPC_PLACE[q.def.giverNpc]; const g = npc(q.def.giverNpc);
    if (s.journey) return { title: q.def.title, text: `Yoldasın: ${place(s.journey.to)?.name ?? ""} tarafına gidiyorsun.`, kind };
    if (q.status === "yeni") return giverAt === s.location
      ? { title: q.def.title, text: `${g.name} burada. İşi üstlen.`, act: "accept", id: q.def.id, button: "Üstlen", kind }
      : { title: q.def.title, text: `${g.name} ile konuş: ${place(giverAt)?.name ?? ""}.`, act: "show-place", id: giverAt, button: "Haritada göster", kind };
    // parayla alınan belge gerekiyorsa önce o
    if (q.def.needPaper && !hasPaper(s, q.def.needPaper)) { const pp = paper(q.def.needPaper)!;
      return s.money >= pp.cost
        ? { title: `Önce: ${pp.name}`, text: `${pp.seller} satıyor (${pp.cost} bakır): ${place(pp.place)?.name ?? ""}.`, act: s.location === pp.place ? "paper" : "show-place", id: s.location === pp.place ? pp.id : pp.place, button: s.location === pp.place ? "Satın al" : "Haritada göster", kind }
        : { title: `Önce: ${pp.name}`, text: `${pp.cost} bakır gerekir; cebinde ${s.money} var. Kervanla ticaret yap, adamlarını işe yolla.`, act: "show-place", id: pp.place, button: "Kâtibi göster", kind }; }
    if (q.def.at !== s.location) return { title: q.def.title, text: `${place(q.def.at)?.name ?? ""} tarafına git.`, act: "show-place", id: q.def.at, button: "Haritada göster", kind };
    const fight = !!(q.def.battle || q.def.siege);
    return { title: q.def.title, text: fight ? (q.def.siege ? "Buradasın. Savunmaya hazırlan." : "Buradasın. Savaşa hazırlan.") : `Buradasın. ${q.def.doneText ?? "İşi yap"} (${q.def.minutes} dk).`,
      act: fight ? "fight" : "walk", id: q.def.id, button: fight ? "Hazırlan" : (q.def.doneText ?? "Yap"), kind };
  }
  const m = m0;
  if (m?.go && !s.journey) return { title: m.title, text: m.hint, act: m.go.act, id: m.go.id, button: m.go.button, kind: "ana" };
  return m ? { title: m.title, text: m.hint ?? "Defterin bir sonraki sayfası seni bekliyor." } : null;
}
