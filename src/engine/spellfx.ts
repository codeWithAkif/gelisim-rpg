// Büyülerin görsel kuralı, her savaş sahnesinde aynı (altıgen savaş, barikat, nöbet, harabe).
// Şimşek: ZİNCİR kahramanın elinden çıkar, hedeften hedefe atlar; YILDIRIM üstten aşağı düşer.
// Tek kural burada; sahneler yalnız bu kurala göre çizer. Yeni büyü eklerken önce buraya bak.
import type { Config } from "./config";
import { baseElements } from "./magic";
import { spellSequence } from "./synthesis";

export type BoltStyle = "chain" | "sky";
/** Şimşek içeren her büyü ya zincirdir (elden, hedeften hedefe) ya yıldırımdır (üstten aşağı).
 * Zincir biçimli olanlar zincir; duvar biçimi yere çizilen şerit olarak kalır (çizgi, bolt değil); geri kalan her şey
 * (top, akıntı, perde, yağmur) ve adı Yıldırım fırtınası olan hedefin üstüne düşer. Şimşeksizse null. */
export function boltStyle(cfg: Config, id: string): BoltStyle | null {
  const sp = cfg.spell.get(id); if (!sp) return null;
  if (!sp.sources.some(x => baseElements(cfg, x.id).includes("el_simsek"))) return null;
  if (id.includes("yildirim") || id.includes("firtina")) return "sky";
  const form = spellSequence(id)?.form;
  if (form === "zincir") return "chain";
  if (form === "duvar") return null;
  return "sky";
}

/* ---------- büyü taktiği: dört savaş sahnesinde aynı kurallar ----------
 * Islak: buz ve çamur büyüsü hedefi ıslatır (WET_SECS sn). Islaklık yağmur ve su/çamur zemininde zaten vardır.
 * İletken: ıslak hedefe şimşek ×1,7. Buhar: ıslak hedefe ateş ×0,6 ve alev söner. Çatlama: yanan hedefe buz ×1,5.
 * Sekme: ateş topu ve buz topu çarptığı yerden bir kez sekip en yakın ikinci düşmana BOUNCE_MUL gücüyle vurur;
 * uçan toplar (harabe) ayrıca duvara, kapalı kapıya ve yapı kenarına çarpınca bir kez geri döner.
 * Yeni bir sahne ya da büyü eklerken yalnız bu fonksiyonları çağır; sayıları burada değiştir. */
export const WET_SECS = 6;
export const BOUNCE_MUL = 0.6;
export const BOUNCE_RANGE = 16;      // harabe/nöbet/barikat birimi; altıgen savaşta 2 altıgen
export const BOUNCE_HEX = 2;
export interface FoeState { wet: boolean; burn: boolean }
export interface Combo { mul: number; tag: string; quench?: boolean }
export const wets = (kind: string) => kind === "buz" || kind === "camur";
export const bounces = (kind: string) => kind === "ates" || kind === "buz";
export function combo(kind: string, st: FoeState): Combo | null {
  if (kind === "simsek" && st.wet) return { mul: 1.7, tag: "İletken!" };
  if (kind === "ates" && st.wet) return { mul: 0.6, tag: "Buhar", quench: true };
  if (kind === "buz" && st.burn) return { mul: 1.5, tag: "Çatlama!" };
  return null;
}
/** Etki bayraklarından büyü türü (altıgen savaş ve barikatta SPELL_FX bayrakları var, tür yok). */
export function fxKind(fx: { chain?: boolean; ignite?: boolean; slow?: number; mud?: boolean; root?: number } | undefined): string {
  if (!fx) return "other"; if (fx.chain) return "simsek"; if (fx.ignite) return "ates"; if (fx.mud) return "camur"; if (fx.root) return "sarmasik"; if (fx.slow) return "buz"; return "other";
}

/** Ateş ve buz topu uçarken odadan çıkmaz: duvara, tavana, tabana ve kapıya (açık ya da kapalı) çarpınca sekip kalır; her seferinde biraz güç kaybeder. */
export const WALL_BOUNCE_MUL = 0.85;
export const MAX_WALL_BOUNCES = 4;
export const ROOM_CEIL = 0.85;   // oda tavanı, kat cinsinden (zemin 0)
