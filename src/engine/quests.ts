// Görevler ve mantıklı ödüller: ödülü verenin imkânı ve görevin onun için önemi belirler.
import type { Config } from "./config";
import { type GameState, addRep, log, repOf, DAY_MINUTES } from "./state";
import { NPCS, QUESTS, GAME_ITEMS, type QuestDef } from "../content/world";

export function npc(id: string) { return NPCS.find(n => n.id === id)!; }

export type QuestView = { def: QuestDef; status: "yeni" | "aktif" | "bitti" | "kilitli"; reason?: string };
export function questList(s: GameState): QuestView[] {
  return QUESTS.map(def => {
    const st = s.quests[def.id]?.status;
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

export interface RewardReport { items: Record<string, number>; money: number; rep: number; note: string }
export function completeQuest(cfg: Config, s: GameState, id: string): RewardReport {
  const def = QUESTS.find(q => q.id === id)!;
  const count = (s.quests[id]?.count ?? 0) + 1;
  s.quests[id] = { status: "bitti", count };
  const imp = cfg.importance(def.importance);
  // tekrarlanan iş aynı tanınırlığı her seferinde vermez
  const rep = (imp?.repGain ?? 1) / (def.repeatable ? Math.min(4, count) : 1);
  addRep(s, s.region, "taninirlik", rep);
  addRep(s, s.region, "guven", rep * 0.6);
  if (def.importance !== "basit") addRep(s, s.region, "onur", rep * 0.5);
  const items = def.rewards.items ?? {};
  for (const [k, v] of Object.entries(items)) s.inventory[k] = (s.inventory[k] ?? 0) + v;
  s.money += def.rewards.money ?? 0;
  const giver = npc(def.giverNpc);
  for (const n of [def.giverNpc, "ayse"]) if (!s.metNpcs.includes(n)) s.metNpcs.push(n);
  if (id === "annenin_izi" && !s.metNpcs.includes("zehra")) s.metNpcs.push("zehra");
  log(s, `${giver.name} teşekkür etti. ${def.rewards.note} Taşpınar'da tanınırlığın ${Math.floor(repOf(s, s.region, "taninirlik"))}.`, "quest");
  return { items, money: def.rewards.money ?? 0, rep, note: def.rewards.note };
}

/** Savaşsız görevi yürüyerek bitirir. */
export function walkQuest(cfg: Config, s: GameState, id: string): RewardReport | { error: string } {
  const def = QUESTS.find(q => q.id === id)!;
  if (DAY_MINUTES - s.minute < def.minutes) return { error: "Bugün buna vakit yok" };
  s.minute += def.minutes; s.energy = Math.max(0, s.energy - 3); s.satiety = Math.max(0, s.satiety - 3);
  return completeQuest(cfg, s, id);
}

export function itemName(cfg: Config, id: string) { return GAME_ITEMS[id]?.name ?? cfg.item.get(id)?.name ?? id; }
