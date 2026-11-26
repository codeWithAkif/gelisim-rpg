// Keşif içeriği: her yerde etrafı arayınca neler bulunabilir, defterin koleksiyon sayfaları
// ve köylülerin günlük küçük istekleri. (Config editöründe karşılığı yok.)

export type CollKind = "bitki" | "hayvan" | "nesne";
export interface Collectible {
  id: string; name: string; kind: CollKind;
  item?: string;             // çantaya giren eşya (yoksa sadece deftere işlenir: görülen hayvan vb.)
  note: string;              // deftere düşülen not
  hint: string;              // bulunmadan önce görünen ipucu
}
export const COLLECTIBLES: Collectible[] = [
  { id: "kekik", name: "Kekik", kind: "bitki", item: "kekik", note: "Taş aralarında, rüzgâr yiyen yerlerde. Kokusu elimde kaldı.", hint: "Yaylada, taşların arasında." },
  { id: "isirgan", name: "Isırgan", kind: "bitki", item: "isirgan", note: "Yaprağın altındaki tüyler yakıyor. Zehra merhem yapıyor.", hint: "Suyun yakınında, nemli toprakta." },
  { id: "nane", name: "Yabani nane", kind: "bitki", item: "nane", note: "Kare gövdeli. Dere kıyısının her yerinde.", hint: "Dere kıyısında." },
  { id: "adacayi", name: "Adaçayı", kind: "bitki", item: "adacayi", note: "Gümüş tüylü yapraklar. Kurutulunca daha güçlü kokar.", hint: "Zehra'nın evinin çevresinde." },
  { id: "mantar", name: "Kanlıca", kind: "bitki", item: "mantar", note: "Kesince turuncu süt verir; zehirlisi beyaz süt verir.", hint: "Korunun çam altlarında." },
  { id: "yaban_mersini", name: "Yaban mersini", kind: "bitki", item: "yaban_mersini", note: "Gölgede, alçak çalılarda. Parmaklarım mora boyandı.", hint: "Korunun gölgesinde." },
  { id: "kartal", name: "Kaya kartalı", kind: "hayvan", item: "kartal_tuyu", note: "Yaylanın üstünde süzülürken bir tüyünü düşürdü.", hint: "Yüksek yerlerde, gökyüzüne bak." },
  { id: "dag_kecisi", name: "Dağ keçisi", kind: "hayvan", note: "Sarp kayada, düşecekmiş gibi duruyor ama düşmüyor.", hint: "Yaylanın sarp yüzünde." },
  { id: "alabalik", name: "Alabalık", kind: "hayvan", note: "Akıntıya karşı duruyor; gölgem düşünce kayboldu.", hint: "Soğuk ve hızlı suda." },
  { id: "tilki", name: "Kızıl tilki", kind: "hayvan", note: "Bir an baktı, sonra kuyruğunu sallayıp çalılara daldı.", hint: "Korunun kenarında, alacakaranlıkta." },
  { id: "karaca", name: "Karaca", kind: "hayvan", note: "Kulakları önce dikildi; ses etmeden uzaklaştı.", hint: "Sık ağaçlıkta, sessiz olursan." },
  { id: "baykus", name: "Kukumav", kind: "hayvan", note: "Gece, Zehra'nın çatısında. Gözleri iki fener.", hint: "Gece, ev çatılarında." },
  { id: "leylek", name: "Leylek", kind: "hayvan", note: "Çınarın tepesindeki yuvada, gagasını takırdatıyor.", hint: "Köyün en yüksek ağacında." },
  { id: "kurt", name: "Kurt", kind: "hayvan", note: "Sürüye dadanan. Zayıf noktalarını Gözlemler'de çizdim.", hint: "Yaylada, sürünün peşinde." },
  { id: "eski_sikke", name: "Eski sikke", kind: "nesne", item: "eski_sikke", note: "Çeşmenin dibinde parladı. Üstünde silik bir taç.", hint: "Meydanda, suyun dibinde." },
];
export const COLL_KIND_NAMES: Record<CollKind, string> = { bitki: "Bitkiler", hayvan: "Hayvanlar", nesne: "Nesneler" };

/** Bir yerde aranınca bulunabilecekler. w: ağırlık; sense: kolaylaştıran özellik; night: sadece gece / sadece gündüz. */
export interface Find { id: string; w: number; sense: string; night?: boolean }
export const FINDS: Record<string, Find[]> = {
  yayla: [{ id: "kekik", w: 5, sense: "koku" }, { id: "kartal", w: 2, sense: "gorus", night: false }, { id: "dag_kecisi", w: 2, sense: "gorus", night: false }],
  zehra_evi: [{ id: "adacayi", w: 5, sense: "koku" }, { id: "baykus", w: 3, sense: "isitme", night: true }],
  koy_meydani: [{ id: "leylek", w: 3, sense: "gorus", night: false }, { id: "eski_sikke", w: 1, sense: "gorus" }],
  nuri_evi: [{ id: "nane", w: 2, sense: "koku" }],
  dere: [{ id: "isirgan", w: 4, sense: "koku" }, { id: "nane", w: 4, sense: "koku" }, { id: "alabalik", w: 2, sense: "gorus", night: false }],
  koru: [{ id: "mantar", w: 4, sense: "koku" }, { id: "yaban_mersini", w: 4, sense: "gorus" }, { id: "tilki", w: 2, sense: "isitme" }, { id: "karaca", w: 1, sense: "isitme" }],
};
/** Bir yerde günde en çok kaç kez bir şey bulunur (bitkiler tükenir, hayvanlar kaçar). */
/** Kadim çağrıları öğreten eşyalar: yalnız bu yerlerde, vadiyi biraz tanıyınca, nadiren çıkar. */
export interface RelicFind { relic: string; places: string[]; minCollected: number; chance: number; night?: boolean; text: string }
export const RELIC_FINDS: RelicFind[] = [
  { relic: "ardic_koku", places: ["koru"], minCollected: 2, chance: 22, text: "Devrilmiş yaşlı bir ardıcın kökü avucuna dolandı; bırakmadı. Kökün üstünde annenin defterindeki işaret oyulmuş." },
  { relic: "kara_tuy", places: ["yayla", "dere"], minCollected: 3, chance: 22, text: "Bir karga tepende üç kez döndü, önüne kapkara bir tüy bıraktı. Tüy rüzgârsız havada titriyor." },
  { relic: "pasli_kabza", places: ["koy_meydani", "dere"], minCollected: 4, chance: 20, text: "Toprağın içinden paslı bir kılıç kabzası çıktı. Tutunca ayağının altındaki toprak titredi." },
];
export const FINDS_PER_DAY = 3;
export const SEARCH_MINUTES = 20;

/** Köylülerin günlük küçük istekleri. Her gün kayda göre ikisi seçilir. */
export interface RequestDef { id: string; npc: string; want: Record<string, number>; money: number; rep: number; text: string; thanks: string; gift?: Record<string, number> }
export const REQUESTS: RequestDef[] = [
  { id: "z_isirgan", npc: "zehra", want: { isirgan: 3 }, money: 6, rep: 0.6, text: "Merhem bitti. Dereden üç ısırgan getirir misin?", thanks: "Elin yanmadı mı? İyi, demek doğru tuttun." },
  { id: "z_adacayi", npc: "zehra", want: { adacayi: 2 }, money: 4, rep: 0.5, text: "Bahçenin dışındaki yabani adaçayından iki dal lazım.", thanks: "Kokusu tam yerinde." },
  { id: "h_kekik", npc: "hasan", want: { kekik: 2 }, money: 2, rep: 0.5, gift: { peynir: 1 }, text: "Kuzuların karnı şişti. İki tutam kekik bulsan…", thanks: "Al şu peyniri, taze." },
  { id: "n_tuy", npc: "nuri", want: { kartal_tuyu: 1 }, money: 6, rep: 0.6, text: "İnce fırça için bir kartal tüyü arıyorum.", thanks: "Bununla senin portreni de yaparım bir gün." },
  { id: "n_mersin", npc: "nuri", want: { yaban_mersini: 4 }, money: 4, rep: 0.4, text: "Mor boya bitti. Dört avuç yaban mersini getirir misin?", thanks: "Bu mor başka hiçbir yerde yok." },
  { id: "k_deri", npc: "kemal", want: { deri: 1 }, money: 5, rep: 0.5, text: "Körüğün derisi yırtıldı. Bir parça tabaklanmış deri bul.", thanks: "Ocak yine nefes alıyor." },
  { id: "k_mantar", npc: "kemal", want: { mantar: 3 }, money: 4, rep: 0.4, text: "Akşama kanlıca kızartacağım. Üç tane bulursan payın da var.", thanks: "Turuncu süt verenlerden, aferin." },
  { id: "a_sikke", npc: "ayse", want: { eski_sikke: 1 }, money: 10, rep: 1, text: "Çeşmenin dibinde eski para görenler olmuş. Bulursan bana getir.", thanks: "Ardıç sikkesi bu. Kimseye söyleme." },
  { id: "a_nane", npc: "ayse", want: { nane: 3 }, money: 3, rep: 0.4, text: "Ayran için üç demet nane lazım.", thanks: "Sağ ol evladım." },
];
export const REQUESTS_PER_DAY = 2;
