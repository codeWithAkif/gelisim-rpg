// Uyku ve dinlenme: nerede uyuduğun önemli. Seni misafir eden birinin evinde güvenle dinlenirsin;
// çadırda ya da açıkta uyumak tehlikelidir (hırsız, kurt, soğuk, yağmur). Dinlenmek enerji verir ama acıktırır.
import type { Config } from "./config";
import { type GameState, DAY_MINUTES, minutesLeft, log } from "./state";
import { sleep, type SleepReport } from "./progression";
import { maxHp } from "./combat";
import { maxMana } from "./derived";
import { Rng } from "./rng";
import { place } from "./travel";
import { hasRelic } from "./relics";
import { stake } from "./finance";

const done = (s: GameState, q: string) => (s.quests[q]?.count ?? 0) > 0 || s.quests[q]?.status === "bitti";
/** Konaklanabilecek yerler: kim misafir eder, ne ister, ne kadar dinlendirir. */
export interface Lodging { place: string; name: string; host: string; cost: number; quality: number; unlock: (s: GameState) => string | null; free?: (s: GameState) => boolean }
export const LODGINGS: Lodging[] = [
  { place: "yayla", name: "Hasan'ın ağılındaki saman", host: "Hasan", cost: 0, quality: 0.9, unlock: s => done(s, "mesaj") ? null : "Hasan seni henüz tanımıyor" },
  { place: "zehra_evi", name: "Zehra'nın misafir odası", host: "Zehra", cost: 0, quality: 1.05, unlock: s => done(s, "annenin_izi") ? null : "Zehra kapısını yabancıya açmıyor" },
  { place: "koy_meydani", name: "Muhtarlığın köy odası", host: "Muhtar Ayşe", cost: 2, quality: 1, unlock: s => done(s, "mesaj") ? null : "Muhtar seni henüz tanımıyor", free: s => done(s, "kurt") },
  { place: "karacam_han", name: "Yaren'in hanında oda", host: "Yaren", cost: 4, quality: 1, unlock: () => null, free: s => stake(s, "han") > 0 },
  { place: "karacam_sarnic", name: "Derya'nın köşesi", host: "Derya", cost: 0, quality: 0.85, unlock: s => done(s, "sarnic") ? null : "Sarnıçta kimseyi tanımıyorsun" },
  { place: "ayaz_mutfak", name: "Gülizar'ın kileri", host: "Gülizar", cost: 0, quality: 0.95, unlock: s => done(s, "mutfak") ? null : "Gülizar sana henüz güvenmiyor" },
  { place: "ardic_kul", name: "Kül Ana'nın ateş başı", host: "Kül Ana", cost: 0, quality: 0.95, unlock: s => done(s, "kul_ana") ? null : "Kül Ana seni tanımıyor" },
];
export const lodgingAt = (placeId: string) => LODGINGS.find(l => l.place === placeId);

/** Açıkta gecenin tehlikesi: bölgeye ve yere göre. */
function baseRisk(placeId: string): number {
  const p = place(placeId); const byRegion: Record<string, number> = { taspinar: 0.18, karacam: 0.24, ayazkale: 0.4, ardic: 0.3 };
  return (byRegion[p?.region ?? "taspinar"] ?? 0.2) + (["koru", "ayaz_gecit"].includes(placeId) ? 0.12 : 0);
}

export type SleepKind = "lodging" | "tent" | "open";
export interface SleepOption { kind: SleepKind; name: string; quality: number; cost: number; risk: number; ok: boolean; reason?: string; note: string }
export function sleepOptions(s: GameState): SleepOption[] {
  const out: SleepOption[] = [];
  const l = lodgingAt(s.location);
  if (l) {
    const lock = l.unlock(s); const cost = l.free?.(s) ? 0 : l.cost;
    out.push({ kind: "lodging", name: l.name, quality: l.quality, cost, risk: 0, ok: !lock && s.money >= cost, reason: lock ?? (s.money < cost ? `${cost} bakır gerekir` : undefined),
      note: `${l.host} seni misafir eder. Güvenli${cost ? `, ${cost} bakır` : ", parasız"}.` });
  }
  const r = campRisk(s);
  const tent = (s.inventory.cadir ?? 0) > 0;
  out.push({ kind: "tent", name: "Çadır kur", quality: 0.8, cost: 0, risk: r * 0.7, ok: tent, reason: tent ? undefined : "Çadırın yok (pazarda satılır)", note: "Yağmur ve rüzgâr keser; hırsız ve kurt yine gelebilir." });
  out.push({ kind: "open", name: "Açıkta uyu", quality: 0.65, cost: 0, risk: r, ok: true, note: "Kötü dinlenirsin; gece başına bir şey gelebilir." });
  return out;
}
/** Kampın tehlikesi: köpek havlar, ateş hayvanları uzak tutar. */
export function campRisk(s: GameState): number {
  let r = baseRisk(s.location);
  if (s.pet) r *= 0.55 - Math.min(0.15, s.pet.bond / 400);
  if (s.knownElements.includes("el_ates")) r *= 0.85;
  return Math.max(0.03, Math.min(0.7, r));
}

export interface NightEvent { id: "hirsiz" | "kurt" | "soguk" | "yagmur"; text: string }
export interface SleepResult { report: SleepReport; option: SleepOption; event?: NightEvent; hpBefore: number }
/** Uyur: yer kalitesi dinlenmeyi, kamp tehlikesi geceyi belirler. */
export function sleepAt(cfg: Config, s: GameState, kind: SleepKind): SleepResult | { error: string } {
  if (s.journey) return { error: "Yoldayken uyuyamazsın" };
  const opt = sleepOptions(s).find(o => o.kind === kind); if (!opt) return { error: "Burada böyle uyuyamazsın" };
  if (!opt.ok) return { error: opt.reason ?? "Olmaz" };
  const rng = new Rng((s.seed * 9973 + s.day * 7919 + s.location.length * 131) | 0);
  s.money -= opt.cost;
  let event: NightEvent | undefined; let quality = opt.quality;
  // gece yarısını geçirdiysen uyku kısalır: 22:00'den sonraki her saat dinlenmeyi azaltır
  const late = Math.max(0, s.minute - 16 * 60) / 60; quality *= 1 - Math.min(0.45, late * 0.08);
  if (kind !== "lodging" && rng.chance(opt.risk * 100)) {
    const pool: NightEvent["id"][] = place(s.location)?.region === "ayazkale" ? ["soguk", "kurt", "soguk"] : place(s.location)?.region === "taspinar" ? ["kurt", "yagmur", "hirsiz"] : ["hirsiz", "yagmur", "kurt"];
    let id = rng.pick(pool);
    if (id === "yagmur" && kind === "tent") id = "hirsiz";          // çadır yağmuru keser
    if (id === "soguk" && hasRelic(s, "kor_tasi")) id = "kurt";      // kor taşı ısıtır
    if (id === "hirsiz") {
      const lost = Math.min(s.money, rng.int(3, 9));
      if (lost > 0) { s.money -= lost; event = { id, text: `Gece biri heybeni karıştırdı: ${lost} bakır gitti.` }; }
      else event = { id, text: "Gece biri heybeni karıştırdı ama alacak bir şey bulamadı." };
    } else if (id === "kurt") {
      const dmg = rng.int(4, 9); s.hp = Math.max(1, (s.hp || maxHp(cfg, s)) - dmg); quality *= 0.6;
      event = { id, text: s.pet ? `Gece bir kurt yaklaştı; ${s.pet.name} havlayıp kovaladı ama sen de yara aldın (−${dmg} can).` : `Gece bir kurt saldırdı; kovalayana kadar yaralandın (−${dmg} can). Uykun bölündü.` };
    } else if (id === "soguk") { quality *= 0.5; event = { id, text: "Gece ayaz bastırdı; titremekten uyuyamadın." }; }
    else { quality *= 0.7; s.satiety = Math.max(0, s.satiety - 8); event = { id, text: "Gece sağanak bastırdı; sırılsıklam uyandın." }; }
  }
  const hpBefore = s.hp;
  const report = sleep(cfg, s, quality);
  // can: iyi uykuda çok, kötüsünde az toparlanır
  const m = maxHp(cfg, s); s.hp = Math.min(m, Math.round((s.hp || m) + m * 0.6 * Math.min(1, quality)));
  if (event) log(s, event.text, "warn");
  return { report, option: opt, event, hpBefore };
}

/* ---------- dinlenmek ---------- */
export interface RestResult { minutes: number; energy: number; satiety: number; mana: number }
/** Bir süre oturup dinlenmek: enerji ve mana döner, ama zaman geçer ve acıkırsın. Konakta daha iyi dinlenirsin. */
export function rest(cfg: Config, s: GameState, minutes: number): RestResult | { error: string } {
  if (s.journey) return { error: "Yoldayken dinlenemezsin" };
  if (s.session) return { error: "Çalışırken olmaz" };
  const m = Math.min(minutes, minutesLeft(s)); if (m < 10) return { error: "Gecenin sonu; artık uyuman lazım" };
  const h = m / 60; const l = lodgingAt(s.location); const good = !!l && !l.unlock(s);
  const e0 = s.energy, f0 = s.satiety, mana0 = s.mana;
  s.energy = Math.min(100, s.energy + h * (good ? 14 : 10) * (s.satiety < 15 ? 0.5 : 1));
  s.satiety = Math.max(0, s.satiety - h * 6);
  if (s.mana >= 0) s.mana = Math.min(maxMana(cfg, s), s.mana + maxMana(cfg, s) * 0.12 * h);
  s.minute = Math.min(DAY_MINUTES, s.minute + m);
  return { minutes: m, energy: s.energy - e0, satiety: s.satiety - f0, mana: s.mana - mana0 };
}
