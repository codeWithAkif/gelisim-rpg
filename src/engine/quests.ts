// Görevler ve mantıklı ödüller: ödülü verenin imkânı ve görevin onun için önemi belirler.
import type { Config } from "./config";
import { type Bonus, bonusMoney } from "./encounter";
import { type GameState, addRep, log, repOf, DAY_MINUTES } from "./state";
import { NPCS, QUESTS, GAME_ITEMS, type QuestDef } from "../content/world";
import { addItem } from "./inventory";
import { REGION_NAMES } from "../content/map";
import { applyGain, type GainReport } from "./progression";
import { grantRelic } from "./relics";
import type { Relic } from "../content/relics";

export function npc(id: string) { return NPCS.find(n => n.id === id)!; }

export type QuestView = { def: QuestDef; status: "yeni" | "aktif" | "bitti" | "kilitli"; reason?: string };
export function questList(s: GameState): QuestView[] {
  return QUESTS.filter(def => !def.after || s.story.reached.includes(def.after) || s.quests[def.id]).map(def => {
    const st = s.quests[def.id]?.status;
    if (def.retiredBy && s.quests[def.retiredBy]?.status === "bitti") return { def, status: "bitti" as const };
    if (st === "bitti" && !def.repeatable) return { def, status: "bitti" };
    if (st === "aktif") return { def, status: "aktif" };
    const missing = (def.requires ?? []).filter(r => s.quests[r]?.status !== "bitti");
    if (missing.length) return { def, status: "kilitli", reason: "Önce: " + missing.map(m => QUESTS.find(q => q.id === m)?.title).join(", ") };
    return { def, status: "yeni" };
  });
}

export function acceptQuest(s: GameState, id: string) {
  const def = QUESTS.find(q => q.id === id)!;
  s.quests[id] = { ...s.quests[id], status: "aktif" };
  if (!s.metNpcs.includes(def.giverNpc)) s.metNpcs.push(def.giverNpc);
  log(s, `${npc(def.giverNpc).name}: "${def.title}" işini üstlendin.`, "quest");
}

export interface RewardReport { items: Record<string, number>; money: number; rep: number; note: string; dropped: Record<string, number>; gains: GainReport; relics: Relic[]; after?: string; bonus?: string }
export function completeQuest(cfg: Config, s: GameState, id: string, bonus?: Bonus): RewardReport {
  const def = QUESTS.find(q => q.id === id)!;
  const count = (s.quests[id]?.count ?? 0) + 1;
  s.quests[id] = { status: "bitti", count };
  const imp = cfg.importance(def.importance);
  // tekrarlanan iş aynı tanınırlığı her seferinde vermez
  const rep = (imp?.repGain ?? 1) / (def.repeatable ? Math.min(4, count) : 1) * (bonus?.night ? 1.3 : 1);
  addRep(s, s.region, "taninirlik", rep);
  addRep(s, s.region, "guven", rep * 0.6);
  if (def.importance !== "basit") addRep(s, s.region, "onur", rep * 0.5);
  const items = def.rewards.items ?? {};
  const dropped: Record<string, number> = {};
  for (const [k, v] of Object.entries(items)) { const d = addItem(cfg, s, k, v); if (d) dropped[k] = d; }
  const extra = bonus ? bonusMoney(def.rewards.money ?? 0, bonus) : 0;
  s.money += (def.rewards.money ?? 0) + extra;
  const bonusText = extra ? `${bonus!.night ? "Gece işi" : "Beklenenden kalabalıktı"}${bonus!.night && bonus!.extraFoes ? ", üstelik kalabalık" : ""}: +${extra} bakır.` : undefined;
  const gains: GainReport = {};
  for (const [a, n] of Object.entries(def.rewards.gains ?? {})) applyGain(cfg, s, a, n, gains);
  if (def.rewards.pet && !s.pet) s.pet = { id: def.rewards.pet, name: "Karabaş", bond: 5 };
  const relics: Relic[] = [];
  for (const r of def.rewards.relics ?? []) { const g = grantRelic(cfg, s, r, gains); if (g) relics.push(g); }
  const giver = npc(def.giverNpc);
  for (const n of [def.giverNpc, "ayse"]) if (!s.metNpcs.includes(n)) s.metNpcs.push(n);
  if (id === "annenin_izi" && !s.metNpcs.includes("zehra")) s.metNpcs.push("zehra");
  log(s, `${giver.name} teşekkür etti. ${def.rewards.note} ${REGION_NAMES[s.region as keyof typeof REGION_NAMES] ?? "Burada"} tanınırlığın ${Math.floor(repOf(s, s.region, "taninirlik"))}.`, "quest");
  if (def.afterText && count === 1) log(s, def.afterText, "quest");
  return { items, money: (def.rewards.money ?? 0) + extra, rep, note: def.rewards.note, dropped, gains, relics, after: count === 1 ? def.afterText : undefined, bonus: bonusText };
}

/** Savaşsız görevi yerinde bitirir (yolculuk ayrıca haritadan yapılır). */
export function walkQuest(cfg: Config, s: GameState, id: string): RewardReport | { error: string } {
  const def = QUESTS.find(q => q.id === id)!;
  if (s.journey) return { error: "Yoldasın" };
  if (DAY_MINUTES - s.minute < def.minutes) return { error: "Bugün buna vakit yok" };
  s.minute += def.minutes; s.energy = Math.max(0, s.energy - 3); s.satiety = Math.max(0, s.satiety - 3);
  return completeQuest(cfg, s, id);
}

export function itemName(cfg: Config, id: string) { return GAME_ITEMS[id]?.name ?? cfg.item.get(id)?.name ?? id; }
