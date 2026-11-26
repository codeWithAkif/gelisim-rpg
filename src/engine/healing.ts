// Yara bakımı: sargı bezi, merhem gibi eşyalar canı doldurur (DOM yok).
import type { Config } from "./config";
import type { GameState } from "./state";
import { DAY_MINUTES } from "./state";
import { maxHp } from "./combat";
import { itemInfo } from "./inventory";

export const healOf = (cfg: Config, id: string) => itemInfo(cfg, id).heal ?? 0;
/** Çantadaki bir yara bakım eşyasını kullanır: can artar, birkaç dakika geçer. */
export function useHeal(cfg: Config, s: GameState, id: string): { ok: boolean; reason?: string; healed?: number } {
  const h = healOf(cfg, id); if (!h) return { ok: false, reason: "Bu yarayı sarmaz" };
  if (!s.inventory[id]) return { ok: false, reason: "Yok" };
  const mh = maxHp(cfg, s); const cur = s.hp || mh; if (cur >= mh) return { ok: false, reason: "Yaran yok" };
  s.inventory[id]--; if (s.inventory[id] <= 0) delete s.inventory[id];
  const nv = Math.min(mh, cur + h); s.hp = Math.round(nv); s.minute = Math.min(DAY_MINUTES, s.minute + 10);
  return { ok: true, healed: Math.round(nv - cur) };
}
