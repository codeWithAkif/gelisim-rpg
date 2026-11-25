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
export function save(s: GameState) { if (frozen) return; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* depolama dolu */ } }
export function reset() { try { localStorage.removeItem(KEY); } catch { /* yok */ } }

/* ---------- yedek: kaydı tek satırlık bir koda çevirip geri almak ---------- */
// Uygulama silinince depo da silinir; oyuncu kodu bir yere yapıştırıp saklar, yeniden kurunca geri yükler.
const PREFIX = "GD1:";
const SETTINGS_KEY = "gelisim-ayarlar";
let frozen = false;
/** Geri yüklemeden sonra sayfa yenilenirken eski kaydın üstüne yazılmasın. */
export function freezeSaves() { frozen = true; }
const b64e = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const b64d = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s), c => c.charCodeAt(0)));
export function encodeBackup(saveJson: string, settingsJson: string | null): string {
  return PREFIX + b64e(JSON.stringify({ save: saveJson, settings: settingsJson }));
}
export interface BackupInfo { save: string; settings: string | null; name: string; day: number }
/** Kodu çözer; bozuksa null. Boşluk ve satır sonları yok sayılır. */
export function decodeBackup(code: string): BackupInfo | null {
  try {
    const c = code.replace(/\s+/g, ""); if (!c.startsWith(PREFIX)) return null;
    const o = JSON.parse(b64d(c.slice(PREFIX.length))) as { save: string; settings: string | null };
    const s = JSON.parse(o.save) as Partial<GameState>;
    if (s.version !== SAVE_VERSION || typeof s.day !== "number") return null;
    return { save: o.save, settings: o.settings ?? null, name: s.name ?? "Yolcu", day: s.day };
  } catch { return null; }
}
export function currentBackup(): string | null {
  try { const raw = localStorage.getItem(KEY); return raw ? encodeBackup(raw, localStorage.getItem(SETTINGS_KEY)) : null; } catch { return null; }
}
export function restoreBackup(b: BackupInfo) {
  localStorage.setItem(KEY, b.save); if (b.settings) localStorage.setItem(SETTINGS_KEY, b.settings); frozen = true;
}
