// Giyim ve silah kuşamı: hangi eşya nereye takılır, ne kadar korur, neyi güçlendirir.
// Baş, üst, alt, eller, iki takı; sağ el, sol el (ikinci silah ya da kalkan), iki elli silahlar;
// yay ayrı taşınır (normal silahla birlikte).
import { GAME_ITEMS, CRAFTS, MARKETS, type GameItem, type Craft } from "./world";

export type WearPart = "bas" | "govde" | "alt" | "el" | "taki";
export interface GearMeta {
  part?: WearPart;            // giyilen yer
  hands?: 1 | 2;              // silah: tek elli / iki elli
  shield?: boolean;           // sol elde kalkan
  bow?: boolean;              // yay yuvasına takılır
  armor?: number; dodge?: number;                 // koruma, kaçınma (kalkan, hafif giysi)
  bonus?: Record<string, number>;                 // takılar ve bazı giysiler: özelliğe düz ek
}

/** Var olan eşyaların kuşam bilgisi. */
export const GEAR: Record<string, GearMeta> = {
  degnek: { hands: 2 },
  el_yapimi_bicak: { hands: 1 },
  dede_kilici: { hands: 1 },
  av_yayi: { bow: true },
  temiz_giysi: { part: "govde" },
  deri_zirh: { part: "govde" },
  zincir_zirh: { part: "govde", dodge: -4 },
  kurt_postu: { part: "govde", bonus: { irade: 1 } },
};

/** Yeni giyim, silah ve takılar. */
const NEW_ITEMS: GameItem[] = [
  // baş
  { id: "yun_bork", name: "Yün börk", slot: "Zırh", armor: 1, price: 4, desc: "Kulakları örten kalın yün başlık. Ayazda iş görür." },
  { id: "deri_baslik", name: "Deri başlık", slot: "Zırh", armor: 2, price: 9, desc: "Sertleştirilmiş deri; kafaya inen sopayı yumuşatır." },
  { id: "demir_migfer", name: "Demir miğfer", slot: "Zırh", armor: 4, price: 30, desc: "Ağır ve sağlam. Görüşü biraz daraltır." },
  // alt
  { id: "yun_salvar", name: "Yün şalvar", slot: "Zırh", armor: 1, price: 5, desc: "Bol, sıcak, dizde dikişli." },
  { id: "deri_tozluk", name: "Deri tozluk", slot: "Zırh", armor: 2, price: 12, desc: "Baldırı dişten ve dikenden korur." },
  // eller
  { id: "deri_eldiven", name: "Deri eldiven", slot: "Zırh", armor: 1, price: 6, desc: "Isırgan da toplanır, kılıç da tutulur." },
  { id: "demir_eldiven", name: "Demir zırhlı eldiven", slot: "Zırh", armor: 2, price: 22, desc: "Parmak boğumlarında demir pullar." },
  // takılar
  { id: "kemik_kolye", name: "Kurt dişi kolye", slot: "Takı", price: 8, desc: "İpe dizilmiş kurt dişleri. Takanı sert gösterir; içini de sertleştirir." },
  { id: "bakir_yuzuk", name: "Bakır yüzük", slot: "Takı", price: 10, desc: "Ardıç işi, iç yüzünde bir dua yazılı. Dikkati toplar." },
  { id: "nazar_boncugu", name: "Nazar boncuğu", slot: "Takı", price: 3, desc: "Mavi cam göz. İnanırsan korkuyu azaltır." },
  { id: "gumus_kupe", name: "Gümüş küpe", slot: "Takı", price: 18, desc: "İnce işçilik. Kulağın her sesi daha iyi seçiyor sanki." },
  // silahlar
  { id: "hancer", name: "Hançer", slot: "Silah", damage: 5, critBonus: 6, price: 10, desc: "Kısa, sivri. Sol elde ikinci silah olarak iyi gider." },
  { id: "odun_baltasi", name: "Odun baltası", slot: "Silah", damage: 9, price: 14, desc: "İki elle savrulur. Yavaş ama ağır." },
  { id: "mizrak", name: "Av mızrağı", slot: "Silah", damage: 8, critBonus: 4, price: 16, desc: "İki elle tutulur; uzun sapı kurdu uzakta tutar." },
  { id: "agac_kalkan", name: "Ağaç kalkan", slot: "Silah", price: 8, desc: "Deri kaplı yuvarlak kalkan. Sol ele takılır." },
];
for (const it of NEW_ITEMS) GAME_ITEMS[it.id] = it;
Object.assign(GEAR, {
  yun_bork: { part: "bas", bonus: { stres: 0.5 } }, deri_baslik: { part: "bas" }, demir_migfer: { part: "bas", bonus: { gorus: -2 } },
  yun_salvar: { part: "alt" }, deri_tozluk: { part: "alt" },
  deri_eldiven: { part: "el", bonus: { kavrama: 1 } }, demir_eldiven: { part: "el", bonus: { kavrama: 1 }, dodge: -2 },
  kemik_kolye: { part: "taki", bonus: { irade: 2, stres: 1 } }, bakir_yuzuk: { part: "taki", bonus: { odak: 2 } },
  nazar_boncugu: { part: "taki", bonus: { stres: 1.5 } }, gumus_kupe: { part: "taki", bonus: { isitme: 2, gorus: 1 } },
  hancer: { hands: 1 }, odun_baltasi: { hands: 2 }, mizrak: { hands: 2 },
  agac_kalkan: { shield: true, armor: 2, dodge: 4 },
} satisfies Record<string, GearMeta>);

/** Elle yapılanlar ve nerede satıldıkları content/world.ts içinde (CRAFTS, MARKETS). */
export const GEAR_CRAFTS: Craft[] = [
  { id: "baslik_dik", product: "deri_baslik", needs: { deri: 1, ip: 1 }, skill: { el_becerisi: 11 }, minutes: 40, gains: { el_becerisi: 0.5 } },
  { id: "eldiven_dik", product: "deri_eldiven", needs: { deri: 1, ip: 1 }, skill: { el_becerisi: 10 }, minutes: 40, gains: { el_becerisi: 0.5, kavrama: 0.1 } },
  { id: "tozluk_dik", product: "deri_tozluk", needs: { deri: 2, ip: 1 }, skill: { el_becerisi: 12 }, minutes: 60, gains: { el_becerisi: 0.7 } },
];
CRAFTS.push(...GEAR_CRAFTS);
// pazarlar: köyde yün ve ağaç, çarşıda deri ve demir
MARKETS.koy_meydani.items.push("yun_bork", "yun_salvar", "nazar_boncugu", "agac_kalkan", "odun_baltasi");
MARKETS.karacam.items.push("deri_baslik", "deri_eldiven", "deri_tozluk", "hancer", "mizrak", "bakir_yuzuk", "kemik_kolye");
MARKETS.ardic_kul.items.push("demir_migfer", "demir_eldiven", "gumus_kupe");
