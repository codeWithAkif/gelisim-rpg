// Dünya haritası: yerler, yollar ve kim nerede. Koordinatlar ülke haritası birimidir (1000 × 1400).
// Taşpınar vadisi haritanın ortasında; uzak yerler sonraki bölümlerde açılır.

export interface Place {
  id: string; name: string; x: number; y: number; desc: string;
  region: "taspinar" | "uzak";
  chapter?: string;       // kilitliyse hangi bölümde açılacağı
  icon: "dag" | "ev" | "meydan" | "ocak" | "dere" | "koru" | "sehir" | "kale";
}
export const PLACES: Place[] = [
  { id: "yayla", name: "Hasan'ın yaylası", x: 440, y: 563, region: "taspinar", icon: "dag", desc: "Köyün üstünde, rüzgârlı bir yayla. Hasan'ın sürüsü burada otluyor; kurtlar kuzeydeki ağaçlıktan iniyor." },
  { id: "zehra_evi", name: "Zehra'nın evi", x: 434, y: 621, region: "taspinar", icon: "ev", desc: "Yamaçta, otların arasında tek başına bir ev. Kapıda kuruyan şifalı bitkiler asılı." },
  { id: "koy_meydani", name: "Taşpınar meydanı", x: 516, y: 709, region: "taspinar", icon: "meydan", desc: "Çeşmenin başı. Muhtar Ayşe'nin evi, fırın ve küçük pazar burada." },
  { id: "demirhane", name: "Kemal'in demirhanesi", x: 564, y: 693, region: "taspinar", icon: "ocak", desc: "Ocağın isi duvarlara sinmiş. Örsün sesi meydana kadar gelir." },
  { id: "nuri_evi", name: "Nuri'nin evi", x: 463, y: 727, region: "taspinar", icon: "ev", desc: "Derenin yanında, pencereleri büyük bir ev. İçeriden yağlı boya kokusu gelir." },
  { id: "dere", name: "Dere kenarı", x: 463, y: 772, region: "taspinar", icon: "dere", desc: "Soğuk, berrak bir dere. Yüzmek için derin bir göl yeri var." },
  { id: "koru", name: "Meşe korusu", x: 543, y: 597, region: "taspinar", icon: "koru", desc: "Sık meşeler, devrik kütükler. Odun kesmek ve avlanmak için." },
  { id: "karacam", name: "Karaçam", x: 796, y: 864, region: "uzak", icon: "sehir", chapter: "Bölüm 2", desc: "Tüccarların şehri. Annenin mektubu seni buraya yönlendiriyor." },
  { id: "ayazkale", name: "Ayazkale", x: 606, y: 314, region: "uzak", icon: "kale", chapter: "Bölüm 3", desc: "Kuzeyde, yazın bile buzla çevrili lordun kalesi." },
  { id: "ardic", name: "Ardıç", x: 370, y: 1099, region: "uzak", icon: "sehir", chapter: "Bölüm 4", desc: "Başkent. On iki yıl önce bir gecede yanan şehir." },
];

export interface Road { a: string; b: string; pts: [number, number][]; kind?: "patika" | "yol" }
// Yerler harita görsellerine göre konumlandı (harita_ulke 1400 boy, harita_vadi 384..604 × 497..827 kutusunda).
const P = (id: string): [number, number] => { const p = PLACES.find(q => q.id === id)!; return [p.x, p.y]; };
/** Kısa köy patikası: iki yer arası hafif kıvrımlı. */
const via = (a: string, b: string): [number, number][] => { const [ax, ay] = P(a), [bx, by] = P(b); return [[ax, ay], [(ax + bx) / 2 + (by - ay) * 0.12, (ay + by) / 2 - (bx - ax) * 0.12], [bx, by]]; };
export const ROADS: Road[] = [
  { a: "yayla", b: "zehra_evi", kind: "patika", pts: via("yayla", "zehra_evi") },
  { a: "zehra_evi", b: "koy_meydani", kind: "patika", pts: via("zehra_evi", "koy_meydani") },
  { a: "yayla", b: "koru", kind: "patika", pts: via("yayla", "koru") },
  { a: "koru", b: "demirhane", kind: "patika", pts: via("koru", "demirhane") },
  { a: "koy_meydani", b: "demirhane", kind: "yol", pts: via("koy_meydani", "demirhane") },
  { a: "koy_meydani", b: "nuri_evi", kind: "yol", pts: via("koy_meydani", "nuri_evi") },
  { a: "nuri_evi", b: "dere", kind: "patika", pts: via("nuri_evi", "dere") },
  { a: "demirhane", b: "karacam", kind: "yol", pts: [P("demirhane"), [662, 718], [729, 808], P("karacam")] },
  { a: "yayla", b: "ayazkale", kind: "patika", pts: [P("yayla"), [505, 505], [538, 393], P("ayazkale")] },
  { a: "dere", b: "ardic", kind: "yol", pts: [P("dere"), [538, 875], [404, 987], P("ardic")] },
];

/** Kimin nerede olduğu. */
export const NPC_PLACE: Record<string, string> = { hasan: "yayla", ayse: "koy_meydani", nuri: "nuri_evi", kemal: "demirhane", zehra: "zehra_evi" };
/** Belli yerlerde yapılabilen çalışmalar (yoksa her yerde). Dersler öğretmenin yerinde. */
export const ACTIVITY_PLACES: Record<string, string[]> = {
  yuzme: ["dere"], tirmanma: ["yayla"], odun: ["koru"], avcilik: ["koru"],
};
export const SHOP_PLACE = "koy_meydani";
export const START_PLACE = "yayla";
