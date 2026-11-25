// Gün ışığı: oyun saatine göre arayüzün renkleri kademeli değişir.
// Şafakta açılır, akşam önce sıcak alacakaranlığa sonra geceye kararır.
type RGB = [number, number, number];
const hex = (h: string): RGB => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as RGB;
const css = (c: RGB) => `rgb(${c.map(v => Math.round(v)).join(",")})`;
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map(i => a[i] + (b[i] - a[i]) * t) as RGB;
/** Üç duraklı renk: gündüz → alacakaranlık (0.45) → gece. */
function ramp(day: string, dusk: string, night: string, d: number): string {
  const D = hex(day), K = hex(dusk), N = hex(night);
  return css(d < 0.45 ? mix(D, K, d / 0.45) : mix(K, N, (d - 0.45) / 0.55));
}
const two = (day: string, night: string, d: number) => css(mix(hex(day), hex(night), d));

/** 0 = tam gündüz, 1 = tam gece. minute: 06:00'dan beri geçen dakika. */
export function darkness(minute: number): number {
  const h = 6 + minute / 60;
  if (h < 7) return 0.6 * (7 - h);
  if (h < 17.5) return 0;
  if (h < 20.5) return (h - 17.5) / 3 * 0.85;
  return Math.min(1, 0.85 + (h - 20.5) / 1.5 * 0.15);
}
export function phase(minute: number): { name: string; icon: "gunes" | "ay" | "safak" | "aksam" } {
  const h = 6 + minute / 60;
  if (h < 7.5) return { name: "Şafak", icon: "safak" };
  if (h < 11.5) return { name: "Sabah", icon: "gunes" };
  if (h < 15) return { name: "Öğle", icon: "gunes" };
  if (h < 18) return { name: "İkindi", icon: "gunes" };
  if (h < 20.5) return { name: "Akşam", icon: "aksam" };
  return { name: "Gece", icon: "ay" };
}
export const PHASE_ICONS = {
  gunes: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5" fill="#E8B84A" stroke="var(--ink)" stroke-width="1.2"/><g stroke="var(--ink)" stroke-width="1.3" stroke-linecap="round"><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/></g></svg>`,
  safak: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16a7 7 0 0 1 14 0z" fill="#F0B070" stroke="var(--ink)" stroke-width="1.2"/><path d="M2 17h20M12 4v3M5 8l2 2M19 8l-2 2" stroke="var(--ink)" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  aksam: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16a7 7 0 0 1 14 0z" fill="#D9704A" stroke="var(--ink)" stroke-width="1.2"/><path d="M2 17h20M4 20h16" stroke="var(--ink)" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  ay: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3a8 8 0 1 0 6 12A7 7 0 0 1 15 3z" fill="#E6DFC2" stroke="var(--ink)" stroke-width="1.2"/><circle cx="6" cy="6" r=".9" fill="var(--ink)"/><circle cx="19" cy="20" r=".7" fill="var(--ink)"/></svg>`,
};

let last = -1;
/** Renk değişkenlerini saate göre ayarlar. */
export function applyDaylight(minute: number) {
  const d = Math.round(darkness(minute) * 100) / 100;
  if (d === last) return; last = d;
  const r = document.documentElement.style;
  r.setProperty("--paper", ramp("#EAE0C8", "#C9A882", "#23252E", d));
  r.setProperty("--paper-2", ramp("#E1D5B8", "#BC9A76", "#1C1E26", d));
  r.setProperty("--paper-edge", ramp("#CDBE9A", "#A8845F", "#33353F", d));
  // yazı rengi, kâğıt orta tona inince açığa döner (okunurluk)
  const light = d >= 0.55;
  r.setProperty("--ink", light ? two("#D9D2BE", "#ECE5D2", (d - 0.55) / 0.45) : "#2A2722");
  r.setProperty("--ink-soft", light ? "#CFC8B5" : two("#5B5447", "#3E3830", d / 0.55));
  r.setProperty("--pencil", light ? "#B3AD9D" : two("#8B8270", "#6E624E", d / 0.55));
  r.setProperty("--blue", light ? "#9FBDE8" : two("#2E4C7A", "#203A63", d / 0.55));
  r.setProperty("--red", light ? "#E8907E" : two("#9E3423", "#7E2414", d / 0.55));
  r.setProperty("--green", light ? "#A8CC86" : two("#4F6A34", "#3B5224", d / 0.55));
  document.documentElement.classList.toggle("night", light);
  document.documentElement.style.setProperty("--dark", String(d));
  const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute("content", ramp("#E9DFC9", "#C9A882", "#23252E", d));
}
