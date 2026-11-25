// Offline kayıt: tarayıcı/uygulama deposu. Capacitor web görünümünde de kalıcıdır.
import type { Config } from "./config";
import { type GameState, migrate, newGame, SAVE_VERSION } from "./state";

const KEY = "gelisim-rpg-kayit";
export function load(cfg: Config): GameState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const s = JSON.parse(raw) as GameState; if (s.version === SAVE_VERSION) return migrate(cfg, s); }
  } catch { /* bozuk kayıt: yeni oyun */ }
  return newGame(cfg);
}
export function save(s: GameState) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* depolama dolu */ } }
export function reset() { try { localStorage.removeItem(KEY); } catch { /* yok */ } }
