// Kaydedilen oyun durumu. Saf veri: JSON'a yazılıp okunabilir.
import type { Config } from "./config";

export const SAVE_VERSION = 1;
export const DAY_START_HOUR = 6;     // uyanış
export const DAY_MINUTES = 16 * 60;  // 06:00 – 22:00 arası uyanık

export interface AttrState {
  level: number;      // işlenmiş seviye
  pending: number;    // dinlenince işlenecek kazanç (fiziksel)
  peak: number;       // ulaşılan en yüksek seviye (körelme tabanı için)
  lastUsedDay: number;
}
export interface LogEntry { day: number; minute: number; text: string; kind?: "gain" | "quest" | "battle" | "info" | "warn" }
export interface QuestState { status: "aktif" | "bitti" | "basarisiz"; step?: number }

export interface GameState {
  version: number;
  seed: number;
  day: number;
  minute: number;          // gün başından (06:00) beri geçen dakika
  energy: number;          // 0–100
  satiety: number;         // tokluk 0–100
  money: number;           // bakır
  region: string;
  attrs: Record<string, AttrState>;
  rep: Record<string, Record<string, number>>; // bölge → boyut → değer
  inventory: Record<string, number>;           // eşya → adet
  equipped: { weapon?: string; armor?: string };
  familiarity: Record<string, number>;         // silah → alışkınlık (0–100)
  quests: Record<string, QuestState>;
  metNpcs: string[];
  hp: number;
  journal: Record<string, string[]>;           // düşman → deftere işlenmiş zayıf noktalar
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
    region: "taspinar", attrs, rep: {}, inventory: { ekmek: 1, degnek: 1 },
    equipped: { weapon: "degnek" }, familiarity: { degnek: 30 }, quests: {}, metNpcs: [],
    hp: 0, journal: {}, log: [],
  };
  return s;
}

/** Config'e sonradan eklenen özellikleri eski kayda ekler. */
export function migrate(cfg: Config, s: GameState): GameState {
  s.journal ??= {};
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

export function log(s: GameState, text: string, kind?: LogEntry["kind"]) {
  s.log.unshift({ day: s.day, minute: s.minute, text, kind });
  if (s.log.length > 120) s.log.length = 120;
}
