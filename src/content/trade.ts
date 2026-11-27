// Kervan ticareti: mallar, ticaret yerleri, yollar ve belgeler (parayla alınan, hikâyenin kapısını açan kâğıtlar).
// Kurallar engine/trade.ts içinde. Editörde karşılığı yok.
import type { Place } from "./map";

export type Region = Place["region"];
export interface Good { id: string; name: string; base: number; desc: string; price: Record<Region, number> }
/** Her bölge bir şeyi ucuza üretir (çarpan < 1), başka şeyleri pahalıya alır (> 1). */
export const GOODS: Good[] = [
  { id: "peynir_kalibi", name: "Peynir kalıbı", base: 10, desc: "Taşpınar keçisinin tuzlu peyniri.", price: { taspinar: 0.7, karacam: 1.3, ayazkale: 1.5, ardic: 1.35 } },
  { id: "yun", name: "Yün balyası", base: 12, desc: "Yaylanın yünü; kuzeyde altın değerinde.", price: { taspinar: 0.7, karacam: 1.2, ayazkale: 1.6, ardic: 1.1 } },
  { id: "deri_denk", name: "Deri dengi", base: 14, desc: "Tabaklanmış keçi ve koyun derisi.", price: { taspinar: 0.75, karacam: 1.25, ayazkale: 1.2, ardic: 1.3 } },
  { id: "kumas", name: "Kumaş topu", base: 20, desc: "Karaçam tezgâhlarının dokuması.", price: { taspinar: 1.35, karacam: 0.75, ayazkale: 1.3, ardic: 1.2 } },
  { id: "baharat", name: "Baharat kesesi", base: 26, desc: "Güneyden gelir, Karaçam'da el değiştirir.", price: { taspinar: 1.4, karacam: 0.8, ayazkale: 1.5, ardic: 1.1 } },
  { id: "demir_kulce", name: "Demir külçesi", base: 16, desc: "Karaçam ocaklarından.", price: { taspinar: 1.3, karacam: 0.8, ayazkale: 1.1, ardic: 1.25 } },
  { id: "kurk", name: "Kürk balyası", base: 30, desc: "Ayazkale avcılarının kürkü.", price: { taspinar: 1.1, karacam: 1.35, ayazkale: 0.7, ardic: 1.5 } },
  { id: "balmumu", name: "Balmumu", base: 14, desc: "Kalenin arıcılarından; mum ve mühür için.", price: { taspinar: 1.1, karacam: 1.2, ayazkale: 0.75, ardic: 1.4 } },
  { id: "tuz", name: "Tuz çuvalı", base: 10, desc: "Ardıç'ın tuzlasından.", price: { taspinar: 1.4, karacam: 1.2, ayazkale: 1.5, ardic: 0.75 } },
  { id: "kagit", name: "Kâğıt destesi", base: 22, desc: "Başkentin kâğıthanesi; kâtipler kapışır.", price: { taspinar: 1.3, karacam: 1.35, ayazkale: 1.2, ardic: 0.75 } },
];
export const good = (id: string) => GOODS.find(g => g.id === id);

/** Bölgenin ticaret yeri (kervanın yükleyip boşalttığı yer). */
export const TRADE_POSTS: Record<Region, string> = { taspinar: "koy_meydani", karacam: "karacam", ayazkale: "ayaz_mutfak", ardic: "ardic_kul" };
export const REGION_NAMES: Record<Region, string> = { taspinar: "Taşpınar", karacam: "Karaçam", ayazkale: "Ayazkale", ardic: "Ardıç" };

/** Yollar: kaç günde gidilir, ne kadar tehlikeli (0–100), başına ne gelir. */
export interface Route { a: Region; b: Region; days: number; danger: number; threat: string }
export const ROUTES: Route[] = [
  { a: "taspinar", b: "karacam", days: 2, danger: 20, threat: "Yol kenarında haydutlar" },
  { a: "taspinar", b: "ardic", days: 2, danger: 25, threat: "Dere boyunca soyguncular" },
  { a: "karacam", b: "ardic", days: 3, danger: 30, threat: "Vezirin muhafızları ve haydutlar" },
  { a: "karacam", b: "ayazkale", days: 3, danger: 42, threat: "Kar geçidi ve kar kurtları" },
  { a: "taspinar", b: "ayazkale", days: 4, danger: 46, threat: "Uzun yol, kar geçidi, kar kurtları" },
  { a: "ayazkale", b: "ardic", days: 5, danger: 55, threat: "Ülkenin boyu: kar, kurt, haydut" },
];
export const route = (a: Region, b: Region) => ROUTES.find(r => (r.a === a && r.b === b) || (r.a === b && r.b === a));

/** Araba: her biri 8 yük taşır. Sıradaki arabanın fiyatı. */
export const CART_CAP = 8;
export const CART_COSTS = [40, 90, 160];

/* ---------- belgeler: parayla alınır, hikâyenin kapısını açar ---------- */
export interface Paper { id: string; name: string; cost: number; place: string; seller: string; after: string; desc: string }
export const PAPERS: Paper[] = [
  { id: "berat", name: "Geçiş beratı", cost: 150, place: "karacam_lonca", seller: "Lonca kâtibi", after: "k_defter",
    desc: "Isı Loncası'nın mühürlü kâğıdı. Kar geçidindeki gümrükçü beratsız geçeni geri çevirmez; donmaya bırakır." },
  { id: "cizelge", name: "Nöbet çizelgesi", cost: 250, place: "ardic_kul", seller: "Saray kâtibinin yeğeni", after: "d_yaren",
    desc: "Saray muhafızlarının hangi saatte değiştiği. Kül Ana'nın torunları damları bilir, saati bilmez." },
];
export const paper = (id: string) => PAPERS.find(p => p.id === id);

/* ---------- iyi sofra: para gelişime dönüşür ---------- */
/** Zengin bir akşam yemeği: o gece uykuda işlenen gelişim %25 fazla. Handa pahalı, evde ucuz. */
export const FEAST_BONUS = 1.25;
export const FEAST_COST = { lodging: 12, home: 8 };
