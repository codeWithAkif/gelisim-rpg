// Mühendislik atölyesi: kalıcı yapılar yapılır, geliştirilir, sökülür. DOM yok.
// Yapılar tükenmez: kuşatmada ve savaş hazırlığında kullanılır, sonra yerinde durur.
// Seviye türe aittir (örn. "Kazık barikatı" seviye 3 → bütün barikatlar sağlamlaşır); sökmek seviyeyi silmez.
import type { Config } from "./config";
import { type GameState, DAY_MINUTES, log } from "./state";
import { applyGain, type GainReport } from "./progression";
import { freeCount, removeItem, addItem } from "./inventory";
import { STRUCTURES, structure, type StructureDef } from "../content/engineering";

export { STRUCTURES, structure };
export const REFUND = 0.8;
export interface Yapi { n: number; lv: number }
export const yapiOf = (s: GameState, id: string): Yapi => (s.yapi ??= {})[id] ?? { n: 0, lv: 0 };
export const owned = (s: GameState, id: string) => yapiOf(s, id).n;
export const levelOf = (s: GameState, id: string) => Math.max(1, yapiOf(s, id).lv || 1);

/** Mühendislik düzeyi: el becerisi, taktik, gözlem ve güçten türer (yeni özellik gerekmez). */
export function engLevel(s: GameState): number {
  const a = (id: string) => s.attrs[id]?.level ?? 0;
  return a("el_becerisi") * 0.45 + a("taktik") * 0.25 + a("analiz") * 0.15 + a("ust_govde") * 0.15;
}
const lvAttr = (s: GameState, a: string) => s.attrs[a]?.level ?? 0;
const have = (cfg: Config, s: GameState, id: string) => freeCount(cfg, s, id);

export interface Check { ok: boolean; reason?: string }
export function canBuild(cfg: Config, s: GameState, id: string): Check {
  const d = structure(id); if (!d) return { ok: false, reason: "Böyle bir yapı yok" };
  if (s.journey) return { ok: false, reason: "Yoldasın" };
  if (d.needsElement && !s.knownElements.includes(d.needsElement)) return { ok: false, reason: "Ateş sayfası gerekir" };
  for (const [a, v] of Object.entries(d.skill)) if (lvAttr(s, a) < v) return { ok: false, reason: `${cfg.attr.get(a)?.name ?? a} ${v} gerekir (${lvAttr(s, a).toFixed(1)})` };
  for (const [m, n] of Object.entries(d.cost)) if (have(cfg, s, m) < n) return { ok: false, reason: "Malzeme yetmiyor" };
  if (DAY_MINUTES - s.minute < d.minutes) return { ok: false, reason: "Bugün buna vakit yok" };
  if (s.energy < d.energy + 5) return { ok: false, reason: "Çok yorgunsun" };
  return { ok: true };
}
export function build(cfg: Config, s: GameState, id: string): { ok: boolean; reason?: string; gains?: GainReport } {
  const c = canBuild(cfg, s, id); if (!c.ok) return c;
  const d = structure(id)!;
  for (const [m, n] of Object.entries(d.cost)) removeItem(s, m, n);
  const y = (s.yapi ??= {}); y[id] ??= { n: 0, lv: 0 }; y[id].n++; if (!y[id].lv) y[id].lv = 1;
  s.minute = Math.min(DAY_MINUTES, s.minute + d.minutes); s.energy = Math.max(0, s.energy - d.energy); s.satiety = Math.max(0, s.satiety - 3);
  const gains: GainReport = {};
  applyGain(cfg, s, "el_becerisi", 0.5 + d.cost.demir_parca * 0.1, gains); applyGain(cfg, s, "taktik", 0.2, gains); applyGain(cfg, s, "odak", 0.1, gains);
  log(s, `${d.name} yaptın (${y[id].n} adet).`, "info");
  return { ok: true, gains };
}
/** Seviye geliştirme: türün en az bir parçası olmalı; düzey ve malzeme ister. */
export function upgradeNeed(s: GameState, id: string): { lv: number; cost: Record<string, number>; eng: number } | null {
  const d = structure(id); if (!d) return null; const lv = levelOf(s, id);
  if (lv >= d.maxLv) return null;
  return { lv, cost: d.upCost(lv), eng: 9 + lv * 4 };
}
export function canUpgrade(cfg: Config, s: GameState, id: string): Check {
  const need = upgradeNeed(s, id); if (!need) return { ok: false, reason: "En üst seviyede" };
  if (owned(s, id) < 1) return { ok: false, reason: "Önce bir tane yap" };
  if (engLevel(s) < need.eng) return { ok: false, reason: `Mühendislik ${need.eng} gerekir (${engLevel(s).toFixed(1)})` };
  for (const [m, n] of Object.entries(need.cost)) if (n > 0 && have(cfg, s, m) < n) return { ok: false, reason: "Malzeme yetmiyor" };
  if (DAY_MINUTES - s.minute < 60) return { ok: false, reason: "Bugün buna vakit yok" };
  return { ok: true };
}
export function upgrade(cfg: Config, s: GameState, id: string): { ok: boolean; reason?: string; gains?: GainReport } {
  const c = canUpgrade(cfg, s, id); if (!c.ok) return c;
  const need = upgradeNeed(s, id)!;
  for (const [m, n] of Object.entries(need.cost)) if (n > 0) removeItem(s, m, n);
  s.yapi![id].lv = need.lv + 1; s.minute = Math.min(DAY_MINUTES, s.minute + 60); s.energy = Math.max(0, s.energy - 5);
  const gains: GainReport = {}; applyGain(cfg, s, "el_becerisi", 0.4, gains); applyGain(cfg, s, "analiz", 0.3, gains); applyGain(cfg, s, "taktik", 0.2, gains);
  log(s, `${structure(id)!.name} geliştirildi: seviye ${need.lv + 1}.`, "info");
  return { ok: true, gains };
}
/** Sök: malzemelerin %80'i geri gelir (çantaya sığmayan düşer); seviye kalır. */
export function refundOf(d: StructureDef): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [m, n] of Object.entries(d.cost)) { const r = Math.floor(n * REFUND); if (r > 0) out[m] = r; }
  return out;
}
export function dismantle(cfg: Config, s: GameState, id: string): { ok: boolean; reason?: string; back?: Record<string, number>; lost?: number } {
  const d = structure(id); if (!d || owned(s, id) < 1) return { ok: false, reason: "Sökecek bir şey yok" };
  s.yapi![id].n--; const back = refundOf(d); let lost = 0;
  for (const [m, n] of Object.entries(back)) lost += addItem(cfg, s, m, n);
  s.minute = Math.min(DAY_MINUTES, s.minute + 20); s.energy = Math.max(0, s.energy - 2);
  log(s, `${d.name} söktün.`, "info");
  return { ok: true, back, lost };
}

/* ---------- savaşta kullanım ---------- */
/** Barikat dayanıklılık çarpanı (seviyeye göre). */
export const barricadeMul = (s: GameState) => 1 + 0.3 * (levelOf(s, "kazik_barikat") - 1);
/** Kuşatmada kurulabilecek barikat sayısı: ücretsiz iki geçici kazık + yaptıkların. */
export const FREE_STAKES = 2;
export const barricadeCount = (s: GameState) => FREE_STAKES + owned(s, "kazik_barikat");
export interface TrapEffect { dmg: number; slow: number; fire: boolean }
export function trapEffect(s: GameState, id: string): TrapEffect {
  const lv = levelOf(s, id);
  if (id === "kazik_cukuru") return { dmg: 8 + lv * 3, slow: lv >= 4 ? 4 : 3, fire: false };
  if (id === "ates_tuzagi") return { dmg: 6 + lv * 2, slow: 1, fire: true };
  return { dmg: 4 + lv * 2, slow: lv >= 3 ? 3 : 2, fire: false };
}
/** Elinde olan tuzak türleri ve adetleri. */
export function trapsOwned(s: GameState): { id: string; n: number }[] {
  return STRUCTURES.filter(d => d.kind === "tuzak" && owned(s, d.id) > 0).map(d => ({ id: d.id, n: owned(s, d.id) }));
}
