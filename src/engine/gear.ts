// Kuşam: baş, üst, alt, eller, iki takı; sağ el, sol el (ikinci silah ya da kalkan), yay.
// İki elli silah sol eli de kaplar. Yay ayrı yuvadadır: kılıçla birlikte taşınır.
// Korumalar toplanır; takılar ve bazı giysiler özelliklere düz ek verir. DOM yok.
import type { Config } from "./config";
import type { GameState } from "./state";
import { GAME_ITEMS, CONFIG_WEAPON_DAMAGE, CONFIG_ARMOR } from "../content/world";
import { GEAR, type GearMeta } from "../content/gear";

export type GearSlot = "head" | "armor" | "legs" | "hands" | "trinket1" | "trinket2" | "weapon" | "offhand" | "bow";
export const WEAR_SLOTS: GearSlot[] = ["head", "armor", "legs", "hands", "trinket1", "trinket2"];
export const HAND_SLOTS: GearSlot[] = ["weapon", "offhand", "bow"];
export const SLOT_NAMES: Record<GearSlot, string> = { head: "Baş", armor: "Üst", legs: "Alt", hands: "Eller", trinket1: "Takı", trinket2: "Takı", weapon: "Sağ el", offhand: "Sol el", bow: "Yay" };
const PART_SLOT = { bas: "head", govde: "armor", alt: "legs", el: "hands" } as const;

/** Eşyanın kuşam bilgisi (tanımlı değilse türünden çıkarılır). */
export function gearOf(id: string): GearMeta {
  const g = GEAR[id]; if (g) return g;
  const it = GAME_ITEMS[id];
  if (it?.slot === "Zırh") return { part: "govde" };
  if (it?.slot === "Takı") return { part: "taki" };
  if (it?.slot === "Silah" || CONFIG_WEAPON_DAMAGE[id] !== undefined) return { hands: 1 };
  if (CONFIG_ARMOR[id] !== undefined) return { part: "govde" };
  return {};
}
export const isTwoHanded = (id?: string) => !!id && gearOf(id).hands === 2;
export function wornIds(s: GameState): string[] {
  return [...WEAR_SLOTS, ...HAND_SLOTS].map(k => s.equipped[k]).filter((x): x is string => !!x);
}
const armorOf = (id: string) => gearOf(id).armor ?? GAME_ITEMS[id]?.armor ?? CONFIG_ARMOR[id] ?? 0;
/** Toplam koruma: giyilenler ve kalkan. */
export function totalArmor(s: GameState): number {
  let a = WEAR_SLOTS.reduce((n, k) => n + (s.equipped[k] ? armorOf(s.equipped[k]!) : 0), 0);
  const off = s.equipped.offhand; if (off && gearOf(off).shield) a += armorOf(off);
  return a;
}
/** Kaçınmaya ek/eksi: kalkan artırır, ağır demir azaltır. */
export function totalDodge(s: GameState): number { return wornIds(s).reduce((n, id) => n + (gearOf(id).dodge ?? 0), 0); }
/** Kuşamın bir özelliğe düz katkısı (takılar). */
export function gearBonus(s: GameState, attr: string): number {
  let b = 0; for (const id of wornIds(s)) b += gearOf(id).bonus?.[attr] ?? 0; return b;
}
const dmgOf = (cfg: Config, id: string) => GAME_ITEMS[id]?.damage ?? CONFIG_WEAPON_DAMAGE[id] ?? 5;
export interface WeaponSet { dmg: number; crit: number; name: string; dual: boolean; twoHanded: boolean; acc: number; shield: boolean }
/** Elindekiler: tek silah, iki silah (sol el yarım vurur, isabet biraz düşer), iki elli ya da kalkanlı. */
export function weaponSet(cfg: Config, s: GameState): WeaponSet {
  const w = s.equipped.weapon, o = s.equipped.offhand;
  const nm = (id: string) => GAME_ITEMS[id]?.name ?? cfg.item.get(id)?.name ?? id;
  const shield = !!o && !!gearOf(o).shield;
  if (!w) return { dmg: 2, crit: 0, name: "Yumruk", dual: false, twoHanded: false, acc: 0, shield };
  const base = { dmg: dmgOf(cfg, w), crit: GAME_ITEMS[w]?.critBonus ?? 0, name: nm(w), dual: false, twoHanded: isTwoHanded(w), acc: 0, shield };
  if (o && !shield) {
    const off = dmgOf(cfg, o); const skill = (s.attrs.kavrama?.level ?? 10) + (s.attrs.refleks?.level ?? 10);
    return { ...base, dmg: base.dmg + off * 0.5, crit: Math.max(base.crit, GAME_ITEMS[o]?.critBonus ?? 0), name: `${nm(w)} ve ${nm(o)}`, dual: true, acc: -Math.max(0, 10 - (skill - 20) / 4) };
  }
  if (base.twoHanded) return { ...base, acc: -3 };
  return base;
}
/** Yay: yay yuvasındaki; yuva boşsa çantadaki bir yay da iş görür (çıkarıp takarsın). */
export function hasBow(s: GameState) { return !!s.equipped.bow || Object.keys(s.inventory).some(id => (s.inventory[id] ?? 0) > 0 && !!gearOf(id).bow); }

/** Bir eşya hangi yuvalara takılabilir. */
export function slotsFor(id: string): GearSlot[] {
  const g = gearOf(id);
  if (g.bow) return ["bow"];
  if (g.shield) return ["offhand"];
  if (g.part === "taki") return ["trinket1", "trinket2"];
  if (g.part) return [PART_SLOT[g.part]];
  if (g.hands === 2) return ["weapon"];
  if (g.hands === 1) return ["weapon", "offhand"];
  return [];
}
/** Kuşan: yuva verilmezse en uygun boş yuva. İki elli silah sol eli boşaltır; sol ele bir şey alınca iki elli bırakılır. */
export function equipGear(s: GameState, id: string, slot?: GearSlot): { ok: boolean; reason?: string; slot?: GearSlot } {
  const can = slotsFor(id); if (!can.length) return { ok: false, reason: "Bu kuşanılmaz" };
  const free = (k: GearSlot) => !s.equipped[k];
  const have = (s.inventory[id] ?? 0) - wornIds(s).filter(x => x === id).length;
  if (have <= 0) return { ok: false, reason: "Takılı olmayan bir tane yok" };
  let k = slot && can.includes(slot) ? slot : can.find(free) ?? can[0];
  if (k === "offhand" && isTwoHanded(s.equipped.weapon)) s.equipped.weapon = undefined;
  if (k === "weapon" && isTwoHanded(id)) s.equipped.offhand = undefined;
  s.equipped[k] = id;
  if (k === "weapon" || k === "offhand") s.familiarity[id] ??= 0;
  return { ok: true, slot: k };
}
export function unequipGear(s: GameState, slot: GearSlot) { s.equipped[slot] = undefined; }
/** Eski kayıtlar: yay silah elindeyse ya da çantadaysa yay yuvasına geçer. */
export function normalizeGear(s: GameState) {
  if (s.equipped.weapon === "av_yayi") { s.equipped.weapon = undefined; s.equipped.bow = "av_yayi"; }
  if (!s.equipped.bow && (s.inventory.av_yayi ?? 0) > 0) s.equipped.bow = "av_yayi";
}
