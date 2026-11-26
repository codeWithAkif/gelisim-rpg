// Yara bakımı: sargı bezi, merhem gibi eşyalar canı doldurur (DOM yok).
import type { Config } from "./config";
import type { GameState } from "./state";
import { DAY_MINUTES } from "./state";
import { maxHp } from "./combat";
import { itemInfo } from "./inventory";
import { applyGain, type GainReport } from "./progression";

export const healOf = (cfg: Config, id: string) => itemInfo(cfg, id).heal ?? 0;
/** İlk yardım ne kadar yüksekse sargı ve merhem o kadar çok can verir (seviye 50'de iki kat). */
export const aidMul = (s: GameState) => 1 + (s.attrs.ilk_yardim?.level ?? 0) / 50;
/** Uykuda yaraların kapanma payı (maxHp oranı): ilk yardımla artar. */
export const restHealBonus = (s: GameState) => (s.attrs.ilk_yardim?.level ?? 0) / 400;
/** Çantadaki bir yara bakım eşyasını kullanır: can artar, birkaç dakika geçer. */
export function useHeal(cfg: Config, s: GameState, id: string): { ok: boolean; reason?: string; healed?: number; gains?: GainReport } {
  const h = healOf(cfg, id); if (!h) return { ok: false, reason: "Bu yarayı sarmaz" };
  if (!s.inventory[id]) return { ok: false, reason: "Yok" };
  const mh = maxHp(cfg, s); const cur = s.hp || mh; if (cur >= mh) return { ok: false, reason: "Yaran yok" };
  s.inventory[id]--; if (s.inventory[id] <= 0) delete s.inventory[id];
  const nv = Math.min(mh, cur + h * aidMul(s)); s.hp = Math.round(nv); const gains: GainReport = {}; applyGain(cfg, s, "ilk_yardim", 0.3, gains); s.minute = Math.min(DAY_MINUTES, s.minute + 10);
  return { ok: true, healed: Math.round(nv - cur), gains };
}
