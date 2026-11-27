// Kaydedilen oyun durumu. Saf veri: JSON'a yazılıp okunabilir.
import type { Config } from "./config";
import type { Session } from "./session";
import type { Journey } from "./journey";
import { normalizeGear } from "./gear";
import type { Pet } from "./pet";
import type { Estate } from "./estate";

export const SAVE_VERSION = 1;
export const DAY_START_HOUR = 6;     // uyanış
export const DAY_MINUTES = 22 * 60;  // 06:00 – 04:00 arası uyanık kalınabilir (gece tehlikeli)
export const NIGHT_START = 14 * 60;  // 20:00: gece başlar

export interface AttrState {
  level: number;      // işlenmiş seviye
  pending: number;    // dinlenince işlenecek kazanç (fiziksel)
  peak: number;       // ulaşılan en yüksek seviye (körelme kapalı; yalnız kayıt için)
  lastUsedDay: number;
}
export interface LogEntry { day: number; minute: number; text: string; kind?: "gain" | "quest" | "battle" | "info" | "warn" }
export interface QuestState { status: "yeni" | "aktif" | "bitti" | "basarisiz"; step?: number; count?: number }

export interface GameState {
  version: number;
  seed: number;
  day: number;
  minute: number;          // gün başından (06:00) beri geçen dakika
  energy: number;          // 0–100
  satiety: number;         // tokluk 0–100
  money: number;           // bakır
  region: string;
  location: string;                            // haritada bulunduğun yer
  attrs: Record<string, AttrState>;
  rep: Record<string, Record<string, number>>; // bölge → boyut → değer
  inventory: Record<string, number>;           // eşya → adet
  equipped: {                                  // kuşam (engine/gear.ts)
    weapon?: string; offhand?: string; bow?: string;                         // sağ el, sol el, yay
    head?: string; armor?: string; legs?: string; hands?: string; trinket1?: string; trinket2?: string; // baş, üst, alt, eller, takılar
    bag?: string; pouches?: string[];                                        // çanta ve ana çantaya dikilmiş ek bölmeler
  };
  familiarity: Record<string, number>;         // silah → alışkınlık (0–100)
  quests: Record<string, QuestState>;
  metNpcs: string[];
  hp: number;
  journal: Record<string, string[]>;           // düşman → deftere işlenmiş zayıf noktalar
  name: string;
  introDone: boolean;
  knownElements: string[];                     // annenin defterinden açılmış element sayfaları
  mana: number;
  story: { reached: string[]; flags: Record<string, number> };
  session?: Session;
  journey?: Journey;                           // süren yolculuk                           // süren gerçek zamanlı çalışma
  alerts?: Record<string, boolean>;            // gösterilmiş uyarılar (tekrar etmesin)
  olcer?: { solved: string[] };                 // çözülen Ölçer işleri (ısı bulmacası)
  harabe?: Record<string, { stages: Record<number, number>; opened: number[]; keys: number[]; killed: number[]; ground: { item: string; x: number; floor: number }[] }>;   // harabelerde boşaltılan sandıklar, açılan kapılar, öldürülen bekçiler, yerde kalanlar
  nightGains?: { day: number; gains: Record<string, number> }; // son uykuda işlenen gelişme (sabah Vücut'ta parlar)
  prep?: Record<string, { day: number; scout?: boolean; readWind?: boolean }>; // savaş öncesi yapılmış keşifler
  seen?: string[];                             // haritada açılmış yerler (yoksa hepsi açık: eski kayıt)
  collection?: Record<string, number>;         // defterdeki koleksiyon: bulunan → ilk bulunduğu gün
  searched?: { day: number; found: Record<string, number>; tries: Record<string, number> };
  requests?: { day: number; ids: string[]; done: string[] };
  relics?: string[];                           // kadim eşyalar
  pet?: Pet; homePets?: Pet[];                   // evcil hayvan (yanında) ve evde yaşayanlar (engine/pet.ts)
  estate?: Estate;                               // Diyar: ev, işletme, adamlar (engine/estate.ts)
  market?: { day: number; sold: Record<string, number> };          // bugün ne sattın (fiyat düşer)
  partners?: Record<string, { amount: number; since: number; earned: number; acc?: number }>; // acc: henüz bütün bakıra varmamış pay // ortaklıklar
  yapi?: Record<string, { n: number; lv: number }>; // mühendislik: kalıcı yapılar (engine/engineering.ts)
  ledger?: { day: number; text: string; amount: number }[];         // hesap defteri
  trade?: import("./trade").TradeState;           // kervan ticareti: arabalar, yoldaki kervanlar (engine/trade.ts)
  feast?: number;
  spellbook?: string[];
  nobet?: { best: Record<string, number>; runs: number };   // sonsuz nöbet: yalnız rekorlar (geçici güçlenmeler nöbette kalır)                           // keşfedilen büyüler (sentez; engine/synthesis.ts)                                 // zengin sofranın kurulduğu gün: o gece uykuda gelişim fazla
  log: LogEntry[];
}

export function newGame(cfg: Config, seed = Date.now() % 2147483647): GameState {
  const attrs: Record<string, AttrState> = {};
  for (const a of cfg.data.attributes) {
    const lv = a.base ?? 0;
    attrs[a.id] = { level: lv, pending: 0, peak: lv, lastUsedDay: 0 };
  }
  const s: GameState = {
    version: SAVE_VERSION, seed, day: 1, minute: 60, energy: 90, satiety: 70, money: 6,
    region: "taspinar", location: "yayla", attrs, rep: {}, inventory: { ekmek: 1, degnek: 1, bez_torba: 1 },
    equipped: { weapon: "degnek", bag: "bez_torba" }, familiarity: { degnek: 30 }, quests: {}, metNpcs: [],
    hp: 0, journal: {}, name: "Yolcu", introDone: false, knownElements: [], mana: -1,
    story: { reached: [], flags: {} }, log: [], seen: ["yayla", "zehra_evi", "koru"], collection: {},
  };
  return s;
}

/** Config'e sonradan eklenen özellikleri eski kayda ekler. */
export function migrate(cfg: Config, s: GameState): GameState {
  s.journal ??= {};
  s.location ??= "koy_meydani"; // eski kayıtlar köyde
  if (!s.equipped.bag) { s.equipped.bag = "bez_torba"; s.inventory.bez_torba = (s.inventory.bez_torba ?? 0) + 1; }
  normalizeGear(s);
  s.name ??= "Yolcu";
  // eski kayıtlar: açılışı zaten geçmiş say
  s.introDone ??= true;
  s.knownElements ??= [];
  s.mana ??= -1;
  s.story ??= { reached: [], flags: {} };
  for (const a of cfg.data.attributes) {
    if (!s.attrs[a.id]) { const lv = a.base ?? 0; s.attrs[a.id] = { level: lv, pending: 0, peak: lv, lastUsedDay: s.day }; }
  }
  return s;
}

export function level(s: GameState, id: string): number { return s.attrs[id]?.level ?? 0; }

export function repOf(s: GameState, region: string, dim: string): number { return s.rep[region]?.[dim] ?? 0; }
export function addRep(s: GameState, region: string, dim: string, v: number) {
  s.rep[region] ??= {};
  s.rep[region][dim] = Math.max(-100, Math.min(100, (s.rep[region][dim] ?? 0) + v));
}

export function clock(s: GameState): string {
  const total = DAY_START_HOUR * 60 + s.minute;
  const h = Math.floor(total / 60) % 24, m = Math.floor(total % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
export function hourOf(s: GameState): number { return (DAY_START_HOUR * 60 + s.minute) / 60; }
export function minutesLeft(s: GameState): number { return DAY_MINUTES - s.minute; }
/** Gece mi: 20:00'den sonra. Gece kurtlar avlanır, yollar tehlikeli, işler daha çok kazandırır. */
export function isNight(s: GameState): boolean { return s.minute >= NIGHT_START; }
/** Karanlığa (20:00) kaç dakika var; gece olduysa 0. */
export function minutesToDark(s: GameState): number { return Math.max(0, NIGHT_START - s.minute); }

export function log(s: GameState, text: string, kind?: LogEntry["kind"]) {
  s.log.unshift({ day: s.day, minute: s.minute, text, kind });
  if (s.log.length > 120) s.log.length = 120;
}
