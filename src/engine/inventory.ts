// Çanta: göz sayısı kuşanılan çantaya bağlı; eşyalar yığın hâlinde göz kaplar.
// Kuşanılan silah, giysi ve çanta göz kaplamaz.
import type { Config } from "./config";
import { type GameState, DAY_MINUTES, log } from "./state";
import { applyGain, type GainReport } from "./progression";
import { wornIds, equipGear, type GearSlot } from "./gear";
import "../content/gear";
import "../content/engineering";
import { GAME_ITEMS, CONFIG_WEAPON_DAMAGE, CONFIG_ARMOR, CONFIG_PRICES, MARKETS, CRAFTS, type ItemKind, type Craft } from "../content/world";

export interface ItemInfo { id: string; name: string; kind: ItemKind; stack: number; desc: string; capacity?: number; satiety?: number; damage?: number; armor?: number; price?: number }
export function itemInfo(cfg: Config, id: string): ItemInfo {
  const g = GAME_ITEMS[id];
  if (g) return { id, name: g.name, kind: g.slot, stack: g.stack ?? 1, desc: g.desc, capacity: g.capacity, satiety: g.satiety, damage: g.damage, armor: g.armor, price: g.price };
  const c = cfg.item.get(id);
  const kind: ItemKind = c?.slot === "Silah" ? "Silah" : c?.slot === "Zırh" || c?.slot === "Giysi" ? "Zırh" : "Eşya";
  return { id, name: c?.name ?? id, kind, stack: 1, desc: c?.desc ?? "", damage: CONFIG_WEAPON_DAMAGE[id], armor: CONFIG_ARMOR[id], price: CONFIG_PRICES[id] };
}
export const DEFAULT_BAG = "bez_torba";
export function bagOf(s: GameState) { return s.equipped.bag ?? DEFAULT_BAG; }
/** Ana çantaya dikilen ek çanta kendi gözünün ancak bir kısmını katar (kayış, dikiş yer kaplar). */
export const POUCH_SHARE = 0.4, MAX_POUCHES = 2;
export const pouchSlots = (cfg: Config, id: string) => Math.max(1, Math.floor((itemInfo(cfg, id).capacity ?? 0) * POUCH_SHARE));
export const pouchesOf = (s: GameState) => s.equipped.pouches ?? [];
export function capacity(cfg: Config, s: GameState): number {
  return (itemInfo(cfg, bagOf(s)).capacity ?? 8) + pouchesOf(s).reduce((a, id) => a + pouchSlots(cfg, id), 0);
}
function equippedIds(s: GameState) { return [...wornIds(s), bagOf(s), ...pouchesOf(s)]; }

/** Bir çantayı ana çantaya ek bölme olarak dik. */
export function attachPouch(cfg: Config, s: GameState, id: string): { ok: boolean; reason?: string; slots?: number } {
  if (itemInfo(cfg, id).kind !== "Çanta") return { ok: false, reason: "Bu bir çanta değil" };
  if (freeCount(cfg, s, id) <= 0) return { ok: false, reason: "Takılı olmayan bir tane yok" };
  if (pouchesOf(s).length >= MAX_POUCHES) return { ok: false, reason: `En çok ${MAX_POUCHES} ek bölme dikilir` };
  (s.equipped.pouches ??= []).push(id);
  return { ok: true, slots: pouchSlots(cfg, id) };
}
/** Ek bölmeyi sök: çantaya geri döner (yer varsa). */
export function detachPouch(cfg: Config, s: GameState, index: number): { ok: boolean; reason?: string } {
  const p = pouchesOf(s); if (!p[index]) return { ok: false };
  const id = p.splice(index, 1)[0];
  if (slotsUsed(cfg, s) > capacity(cfg, s)) { p.splice(index, 0, id); return { ok: false, reason: "Sökersen eşyaların sığmaz" }; }
  return { ok: true };
}

/** Çanta sekmeleri: eşyalar türüne göre ayrılır. */
export type InvTab = "hepsi" | "yiyecek" | "malzeme" | "kusanilir" | "diger";
export const INV_TABS: { id: InvTab; name: string; kinds: ItemKind[] }[] = [
  { id: "hepsi", name: "Hepsi", kinds: [] },
  { id: "yiyecek", name: "Yiyecek", kinds: ["Yiyecek"] },
  { id: "malzeme", name: "Malzeme", kinds: ["Malzeme"] },
  { id: "kusanilir", name: "Kuşanılır", kinds: ["Silah", "Zırh", "Takı", "Çanta"] },
  { id: "diger", name: "Diğer", kinds: ["Eşya"] },
];
export const inTab = (cfg: Config, id: string, tab: InvTab) => tab === "hepsi" || INV_TABS.find(t => t.id === tab)!.kinds.includes(itemInfo(cfg, id).kind);

/** Çantadaki gözler: kuşanılanlar hariç, her yığın bir göz. */
export interface Stack { id: string; count: number }
export function stacks(cfg: Config, s: GameState): Stack[] {
  const out: Stack[] = [];
  for (const [id, n0] of Object.entries(s.inventory)) {
    let n = n0 - equippedIds(s).filter(e => e === id).length;
    const st = itemInfo(cfg, id).stack;
    while (n > 0) { out.push({ id, count: Math.min(st, n) }); n -= st; }
  }
  const order: ItemKind[] = ["Silah", "Zırh", "Çanta", "Yiyecek", "Malzeme", "Eşya"];
  return out.sort((a, b) => order.indexOf(itemInfo(cfg, a.id).kind) - order.indexOf(itemInfo(cfg, b.id).kind));
}
export function slotsUsed(cfg: Config, s: GameState) { return stacks(cfg, s).length; }

/** Eşya ekler; sığmayanı bırakır ve kaç tanesinin bırakıldığını döner. */
export function addItem(cfg: Config, s: GameState, id: string, n: number): number {
  let dropped = 0;
  for (let i = 0; i < n; i++) {
    s.inventory[id] = (s.inventory[id] ?? 0) + 1;
    if (slotsUsed(cfg, s) <= capacity(cfg, s)) continue;
    // daha büyük bir çanta sığmıyorsa hemen kuşanılır; eskisi içine konur
    const it = itemInfo(cfg, id);
    if (it.kind === "Çanta" && (it.capacity ?? 0) > capacity(cfg, s)) { const prev = bagOf(s); s.equipped.bag = id; if (slotsUsed(cfg, s) <= capacity(cfg, s)) continue; s.equipped.bag = prev; }
    s.inventory[id] -= 1; if (!s.inventory[id]) delete s.inventory[id]; dropped++;
  }
  return dropped;
}
export function removeItem(s: GameState, id: string, n = 1): boolean {
  if ((s.inventory[id] ?? 0) < n) return false;
  s.inventory[id] -= n; if (s.inventory[id] <= 0) delete s.inventory[id];
  return true;
}
export function freeCount(cfg: Config, s: GameState, id: string): number {
  return (s.inventory[id] ?? 0) - equippedIds(s).filter(e => e === id).length;
}

export function equip(cfg: Config, s: GameState, id: string, slot?: GearSlot): { ok: boolean; reason?: string; slot?: GearSlot } {
  const it = itemInfo(cfg, id);
  if (!s.inventory[id]) return { ok: false, reason: "Sende yok" };
  if (it.kind === "Silah" || it.kind === "Zırh" || it.kind === "Takı") {
    // yerinden çıkan eşya çantaya döner; çanta bu yüzden taşacaksa olmaz
    const before = slotsUsed(cfg, s), prev = { ...s.equipped };
    const r = equipGear(s, id, slot);
    if (r.ok && slotsUsed(cfg, s) > capacity(cfg, s) && slotsUsed(cfg, s) > before) { s.equipped = prev; return { ok: false, reason: "Çantanda yer yok" }; }
    return r;
  }
  if (it.kind === "Çanta") {
    // ek bölme olarak dikiliyse önce sökülür; ana çanta olur
    const pi = pouchesOf(s).indexOf(id); if (pi >= 0 && freeCount(cfg, s, id) <= 0) s.equipped.pouches!.splice(pi, 1);
    const prev = bagOf(s); s.equipped.bag = id;
    if (slotsUsed(cfg, s) > capacity(cfg, s)) { s.equipped.bag = prev; return { ok: false, reason: "Eşyaların bu çantaya sığmıyor" }; }
    return { ok: true };
  }
  return { ok: false, reason: "Bu kuşanılmaz" };
}
export function unequip(cfg: Config, s: GameState, slot: GearSlot): { ok: boolean; reason?: string } {
  const id = s.equipped[slot]; if (!id) return { ok: false };
  s.equipped[slot] = undefined;
  if (slotsUsed(cfg, s) > capacity(cfg, s)) { s.equipped[slot] = id; return { ok: false, reason: "Çantanda yer yok" }; }
  return { ok: true };
}
export function drop(cfg: Config, s: GameState, id: string): boolean {
  if (freeCount(cfg, s, id) <= 0) return false;
  removeItem(s, id); log(s, `${itemInfo(cfg, id).name} bırakıldı.`, "info"); return true;
}

export function buy(cfg: Config, s: GameState, id: string): { ok: boolean; reason?: string } {
  const it = itemInfo(cfg, id); const price = it.price ?? 0;
  const market = MARKETS[s.location];
  if (s.journey || !market) return { ok: false, reason: "Burada pazar yok" };
  if (!market.items.includes(id)) return { ok: false, reason: `${market.name} bunu satmıyor` };
  if (s.money < price) return { ok: false, reason: `${price} bakır gerekir` };
  if (addItem(cfg, s, id, 1)) return { ok: false, reason: "Çantan dolu" };
  s.money -= price; s.minute = Math.min(DAY_MINUTES, s.minute + 5);
  return { ok: true };
}

export function craftCheck(cfg: Config, s: GameState, c: Craft): { ok: boolean; reason?: string } {
  for (const [a, v] of Object.entries(c.skill)) if ((s.attrs[a]?.level ?? 0) < v) return { ok: false, reason: `${cfg.attr.get(a)?.name ?? a} ${v} gerekir (${(s.attrs[a]?.level ?? 0).toFixed(1)})` };
  for (const [id, n] of Object.entries(c.needs)) if (freeCount(cfg, s, id) < n) return { ok: false, reason: `${n} ${itemInfo(cfg, id).name} gerekir (${Math.max(0, freeCount(cfg, s, id))})` };
  return { ok: true };
}
export function craftById(id: string) { return CRAFTS.find(c => c.id === id); }
/** El işini tamamlar: malzemeler oturum başında ayrılmıştır, burada ürün eklenir. */
export function completeCraft(cfg: Config, s: GameState, c: Craft, report: GainReport): { dropped: number } {
  for (const [a, v] of Object.entries(c.gains)) applyGain(cfg, s, a, v, report);
  const dropped = addItem(cfg, s, c.product, 1);
  log(s, `${itemInfo(cfg, c.product).name} yaptın.${dropped ? " Çantanda yer yoktu; yere bıraktın." : ""}`, "gain");
  return { dropped };
}
