// Dünya haritası: yerler, yollar ve kim nerede. Koordinatlar ülke haritası birimidir (1000 × 1400).
// Taşpınar vadisi haritanın ortasında; uzak yerler sonraki bölümlerde açılır.

export interface Place {
  id: string; name: string; x: number; y: number; desc: string;
  region: "taspinar" | "uzak";
  chapter?: string;       // kilitliyse hangi bölümde açılacağı
  icon: "dag" | "ev" | "meydan" | "ocak" | "dere" | "koru" | "sehir" | "kale";
}
export const PLACES: Place[] = [
  { id: "yayla", name: "Hasan'ın yaylası", x: 505, y: 735, region: "taspinar", icon: "dag", desc: "Köyün üstünde, rüzgârlı bir yayla. Hasan'ın sürüsü burada otluyor; kurtlar kuzeydeki ağaçlıktan iniyor." },
  { id: "zehra_evi", name: "Zehra'nın evi", x: 470, y: 800, region: "taspinar", icon: "ev", desc: "Yamaçta, otların arasında tek başına bir ev. Kapıda kuruyan şifalı bitkiler asılı." },
  { id: "koy_meydani", name: "Taşpınar meydanı", x: 540, y: 858, region: "taspinar", icon: "meydan", desc: "Çeşmenin başı. Muhtar Ayşe'nin evi, fırın ve küçük pazar burada." },
  { id: "demirhane", name: "Kemal'in demirhanesi", x: 576, y: 850, region: "taspinar", icon: "ocak", desc: "Ocağın isi duvarlara sinmiş. Örsün sesi meydana kadar gelir." },
  { id: "nuri_evi", name: "Nuri'nin evi", x: 500, y: 886, region: "taspinar", icon: "ev", desc: "Derenin yanında, pencereleri büyük bir ev. İçeriden yağlı boya kokusu gelir." },
  { id: "dere", name: "Dere kenarı", x: 452, y: 906, region: "taspinar", icon: "dere", desc: "Soğuk, berrak bir dere. Yüzmek için derin bir göl yeri var." },
  { id: "koru", name: "Meşe korusu", x: 612, y: 798, region: "taspinar", icon: "koru", desc: "Sık meşeler, devrik kütükler. Odun kesmek ve avlanmak için." },
  { id: "karacam", name: "Karaçam", x: 820, y: 640, region: "uzak", icon: "sehir", chapter: "Bölüm 2", desc: "Tüccarların şehri. Annenin mektubu seni buraya yönlendiriyor." },
  { id: "ayazkale", name: "Ayazkale", x: 430, y: 240, region: "uzak", icon: "kale", chapter: "Bölüm 3", desc: "Kuzeyde, yazın bile buzla çevrili lordun kalesi." },
  { id: "ardic", name: "Ardıç", x: 190, y: 1180, region: "uzak", icon: "sehir", chapter: "Bölüm 4", desc: "Başkent. On iki yıl önce bir gecede yanan şehir." },
];

export interface Road { a: string; b: string; pts: [number, number][]; kind?: "patika" | "yol" }
export const ROADS: Road[] = [
  { a: "yayla", b: "zehra_evi", kind: "patika", pts: [[505, 735], [492, 758], [480, 780], [470, 800]] },
  { a: "zehra_evi", b: "koy_meydani", kind: "patika", pts: [[470, 800], [492, 822], [516, 842], [540, 858]] },
  { a: "yayla", b: "koru", kind: "patika", pts: [[505, 735], [540, 752], [580, 774], [612, 798]] },
  { a: "koru", b: "demirhane", kind: "patika", pts: [[612, 798], [600, 824], [576, 850]] },
  { a: "koy_meydani", b: "demirhane", kind: "yol", pts: [[540, 858], [558, 856], [576, 850]] },
  { a: "koy_meydani", b: "nuri_evi", kind: "yol", pts: [[540, 858], [520, 872], [500, 886]] },
  { a: "nuri_evi", b: "dere", kind: "patika", pts: [[500, 886], [476, 898], [452, 906]] },
  { a: "demirhane", b: "karacam", kind: "yol", pts: [[576, 850], [640, 805], [700, 740], [760, 690], [820, 640]] },
  { a: "yayla", b: "ayazkale", kind: "patika", pts: [[505, 735], [495, 640], [470, 520], [450, 380], [430, 240]] },
  { a: "dere", b: "ardic", kind: "yol", pts: [[452, 906], [400, 980], [320, 1060], [250, 1130], [190, 1180]] },
];

/** Kimin nerede olduğu. */
export const NPC_PLACE: Record<string, string> = { hasan: "yayla", ayse: "koy_meydani", nuri: "nuri_evi", kemal: "demirhane", zehra: "zehra_evi" };
/** Belli yerlerde yapılabilen çalışmalar (yoksa her yerde). Dersler öğretmenin yerinde. */
export const ACTIVITY_PLACES: Record<string, string[]> = {
  yuzme: ["dere"], tirmanma: ["yayla"], odun: ["koru"], avcilik: ["koru"],
};
export const SHOP_PLACE = "koy_meydani";
export const START_PLACE = "yayla";
