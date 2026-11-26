// Bir yerde ne yapılabilir: haritadaki yer kartı bunu gösterir, İşler'e gitmeden oradan yapılır.
import type { Config } from "./config";
import type { GameState } from "./state";
import { questList, npc } from "./quests";
import { canSearch, dailyRequests } from "./explore";
import { activityPlace, place } from "./travel";
import { nextMilestone } from "./story";
import { NPC_PLACE } from "../content/map";
import { FINDS, SEARCH_MINUTES } from "../content/explore";
import { MARKETS } from "../content/world";
import { partnerAt, stake } from "./finance";
import { lodgingAt } from "./rest";

export interface PlaceAction {
  act: "accept" | "fight" | "walk" | "search" | "deliver" | "session-pick" | "market" | "show-place" | "partner" | "sleep";
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
  for (const p of partnerAt(placeId)) { const lock = p.unlock(s); const st = stake(s, p.id);
    if (!lock || st) out.push({ act: "partner", id: p.id, label: `Ortaklık: ${p.name}`, sub: st ? `Payın: ${st} bakır` : `En az ${p.min} bakır` }); }
  if (placeId === s.location) {
    const l = lodgingAt(placeId); const ok = !!l && !l.unlock(s);
    out.push({ act: "sleep", id: "", label: ok ? `Konakla: ${l!.name}` : "Dinlen ya da kamp kur", sub: ok ? "Güvenli uyku, dinlenme" : "Açıkta uyumak tehlikeli" });
  }
  for (const a of cfg.data.activities) {
    if (a.kind === "kullanim") continue;
    const where = activityPlace(a.id);
    if (where?.includes(placeId)) out.push({ act: "session-pick", id: a.id, label: `Çalış: ${a.name}`, sub: a.kind === "ders" ? "Ders" : "Yalnız burada yapılır" });
  }
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
