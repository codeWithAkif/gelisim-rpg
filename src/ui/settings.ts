// Oyuncu ayarları (kayıttan ayrı tutulur; yeni oyun başlatmak ayarları silmez).
export interface Settings { anim: "yavas" | "normal" | "hizli" | "kapali"; text: "normal" | "buyuk"; notify: boolean; sound: boolean; ambient: boolean; music: boolean; haptic: boolean; timing: boolean }
export type BoolSetting = "notify" | "sound" | "ambient" | "music" | "haptic" | "timing";
const KEY = "gelisim-ayarlar";
const DEF: Settings = { anim: "normal", text: "normal", notify: true, sound: true, ambient: true, music: true, haptic: true, timing: true };
let cache: Settings | null = null;

export function settings(): Settings {
  if (cache) return cache;
  try { cache = { ...DEF, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { cache = { ...DEF }; }
  return cache!;
}
export function saveSettings(s: Settings) { cache = s; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* yok */ } applySettings(); window.dispatchEvent(new Event("gelisim-ayar")); }
export function applySettings() {
  document.documentElement.classList.toggle("big-text", settings().text === "buyuk");
}
/** Canlandırma süre çarpanı; 0 = kapalı. */
export function animScale(): number {
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const a = settings().anim;
  if (a === "kapali" || (reduced && a === "normal")) return 0;
  return a === "yavas" ? 1.6 : a === "hizli" ? 0.55 : 1;
}
