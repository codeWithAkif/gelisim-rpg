// Oyun tarafı içerik: config editöründe henüz ekranı olmayan veriler.
// İleride editöre "Dünya" sekmesi eklenince buradan taşınacak.

export type ItemKind = "Silah" | "Zırh" | "Yiyecek" | "Malzeme" | "Çanta" | "Eşya";
export interface GameItem {
  id: string; name: string; slot: ItemKind;
  damage?: number;        // silah: taban hasar
  armor?: number;         // zırh: hasar azaltma
  satiety?: number;       // yiyecek: tokluk
  critBonus?: number;
  capacity?: number;      // çanta: göz sayısı
  stack?: number;         // bir gözde kaç tane
  price?: number;         // köy pazarında bakır
  desc: string;
}
/** Config'deki ekipmanlara ek olarak oyun tarafında tanımlı eşyalar. */
export const GAME_ITEMS: Record<string, GameItem> = {
  degnek: { id: "degnek", name: "Çoban değneği", slot: "Silah", damage: 4, desc: "Kuru meşe. Hafif, kırılmaz ama keskin değil." },
  el_yapimi_bicak: { id: "el_yapimi_bicak", name: "El yapımı bıçak", slot: "Silah", damage: 6, critBonus: 3, desc: "Hasan'ın verdiği, sapı sicimle sarılı bıçak. Kısa ama keskin." },
  temiz_giysi: { id: "temiz_giysi", name: "Temiz yün giysi", slot: "Zırh", armor: 1, desc: "Kalın yün. Isıtır, sıyrıkları biraz tutar." },
  ekmek: { id: "ekmek", name: "Ekmek", slot: "Yiyecek", satiety: 35, stack: 5, price: 2, desc: "Taş fırında pişmiş arpa ekmeği." },
  peynir: { id: "peynir", name: "Peynir", slot: "Yiyecek", satiety: 25, stack: 5, price: 3, desc: "Keçi peyniri." },
  elma: { id: "elma", name: "Yaban elması", slot: "Yiyecek", satiety: 12, stack: 5, desc: "Ekşi, küçük ama tok tutar." },
  deri: { id: "deri", name: "Tabaklanmış deri", slot: "Malzeme", stack: 10, price: 3, desc: "Keçi derisi. Çanta, kemer, kın yapılır." },
  ip: { id: "ip", name: "Kenevir ipi", slot: "Malzeme", stack: 10, price: 1, desc: "Sağlam bir sicim. Dikiş ve tuzak için." },
  bez_torba: { id: "bez_torba", name: "Bez torba", slot: "Çanta", capacity: 8, desc: "Omza asılan kaba bir torba. 8 göz." },
  deri_canta: { id: "deri_canta", name: "Deri çanta", slot: "Çanta", capacity: 12, desc: "Kendi diktiğin, iki bölmeli deri çanta. 12 göz." },
  // keşifle toplananlar (content/explore.ts)
  kekik: { id: "kekik", name: "Kekik", slot: "Malzeme", stack: 10, desc: "Yaylanın taşlarında biter. Zehra çayına katar." },
  isirgan: { id: "isirgan", name: "Isırgan", slot: "Malzeme", stack: 10, desc: "Dere kenarında, eldivensiz toplanmaz. Yara merhemine girer." },
  nane: { id: "nane", name: "Yabani nane", slot: "Malzeme", stack: 10, desc: "Suyun kıyısında. Kokusu parmağında kalır." },
  adacayi: { id: "adacayi", name: "Adaçayı", slot: "Malzeme", stack: 10, desc: "Gümüşi yapraklı. Zehra'nın bahçesinin çevresinde yabanisi var." },
  mantar: { id: "mantar", name: "Kanlıca mantarı", slot: "Yiyecek", satiety: 10, stack: 6, desc: "Çam altında. Doğru olanı tanımak bilgi ister." },
  yaban_mersini: { id: "yaban_mersini", name: "Yaban mersini", slot: "Yiyecek", satiety: 8, stack: 8, desc: "Koruda, gölgede biten mor taneler." },
  kartal_tuyu: { id: "kartal_tuyu", name: "Kartal tüyü", slot: "Eşya", stack: 5, desc: "Uzun ve sert. Nuri fırça yapar, avcılar ok yeleği." },
  eski_sikke: { id: "eski_sikke", name: "Eski sikke", slot: "Eşya", stack: 5, desc: "Üstünde silik bir taç. Ardıç'tan kalma olabilir." },
  annenin_heybesi: { id: "annenin_heybesi", name: "Annenin heybesi", slot: "Çanta", capacity: 16, desc: "Eski ama sağlam; iç cebine Ölçer işareti dikilmiş. 16 göz." },
};

export interface Craft { id: string; product: string; needs: Record<string, number>; skill: Record<string, number>; minutes: number; gains: Record<string, number> }
/** El işleri: malzeme + beceri + zaman. */
export const CRAFTS: Craft[] = [
  { id: "canta_dik", product: "deri_canta", needs: { deri: 2, ip: 2 }, skill: { el_becerisi: 12 }, minutes: 60, gains: { el_becerisi: 0.8, odak: 0.2 } },
];
/** Köy pazarında satılanlar. */
export const SHOP = ["ekmek", "peynir", "deri", "ip"];

/** Config'deki ekipmanların silah değerleri (config'de hasar alanı gelene kadar). */
export const CONFIG_WEAPON_DAMAGE: Record<string, number> = { dede_kilici: 10, av_yayi: 7 };
export const CONFIG_ARMOR: Record<string, number> = { deri_zirh: 3, zincir_zirh: 7 };

export interface Npc { id: string; name: string; role: string; giver: string; teaches?: string[]; fee?: number; minRep?: number; note: string }
export const NPCS: Npc[] = [
  { id: "hasan", name: "Hasan", role: "Çoban", giver: "koylu", note: "Köyün yukarısında koyun güder. Az konuşur." },
  { id: "ayse", name: "Muhtar Ayşe", role: "Köy muhtarı", giver: "muhtar", minRep: 3, note: "Köyün işlerini o çevirir; yabancıya mesafeli." },
  { id: "nuri", name: "Ressam Nuri", role: "Ressam", giver: "koylu", teaches: ["resim"], fee: 3, minRep: 5, note: "Şehirden kaçmış bir ressam. Kimseye ders vermiyor… şimdilik." },
  { id: "kemal", name: "Demirci Kemal", role: "Demirci", giver: "koylu", teaches: ["demirci"], fee: 2, minRep: 5, note: "Çırak arıyor ama güvenmediği birini ocağına sokmaz." },
  { id: "zehra", name: "Şifacı Zehra", role: "Şifacı", giver: "koylu", teaches: ["anatomi", "botanik"], fee: 4, minRep: 15, note: "Yaralı hayvanlara da bakar. Bilgisini kolay paylaşmaz." },
];
/** Ders tipi aktiviteyi kimin verdiği. */
export function teacherOf(activityId: string): Npc | undefined { return NPCS.find(n => n.teaches?.includes(activityId)); }

export type Terrain = "cayir" | "uzun_ot" | "camur" | "kaya" | "tepe" | "su" | "agac";
export interface TerrainInfo { name: string; cost: number; env?: string; color: string; ink: string; blocks?: boolean; cover?: number }
export const TERRAIN: Record<Terrain, TerrainInfo> = {
  cayir: { name: "Çayır", cost: 1, color: "#C9CB98", ink: "#8E9154" },
  uzun_ot: { name: "Uzun ot", cost: 1, env: "uzun_ot", color: "#A9B774", ink: "#6E7C3C", cover: 1 },
  camur: { name: "Çamur", cost: 2, env: "camur", color: "#A08A66", ink: "#6B5534" },
  kaya: { name: "Kayalık", cost: 1, env: "kayalik", color: "#B7B2A4", ink: "#76705F" },
  tepe: { name: "Yüksek zemin", cost: 2, env: "yuksek_zemin", color: "#C7B583", ink: "#8C7744" },
  su: { name: "Dere", cost: 99, color: "#8DB3BF", ink: "#4E7F8F", blocks: true },
  agac: { name: "Ağaçlık", cost: 2, color: "#7F9A62", ink: "#4D6837", cover: 2 },
};

export interface WeakPoint { id: string; name: string; need: Record<string, number>; critBonus: number; effect?: "slow" | "bleed"; at: [number, number]; artAt?: [number, number] /* dusman_kurt görselinde (0–1) */ }
export interface EnemyDef {
  id: string; name: string; species: "hayvan" | "insan"; hp: number; damage: [number, number];
  move: number; evasion: number; accuracy: number; armor: number; weakPoints: WeakPoint[]; desc: string;
}
export const ENEMIES: Record<string, EnemyDef> = {
  kurt: {
    id: "kurt", name: "Kurt", species: "hayvan", hp: 22, damage: [3, 6], move: 4, evasion: 16, accuracy: 60, armor: 0,
    desc: "Aç ve cesur. Sürüyle avlanır, yandan dolanmayı sever.",
    weakPoints: [
      { id: "boyun", name: "Boyun", need: { analiz: 12, anatomi_hayvan: 3 }, critBonus: 12, at: [0.25, 0.42], artAt: [0.24, 0.47] },
      { id: "arka_bacak", name: "Sol arka bacak (eski yara)", need: { analiz: 18 }, critBonus: 6, effect: "slow", at: [0.78, 0.78], artAt: [0.8, 0.74] },
      { id: "burun", name: "Burun", need: { anatomi_hayvan: 8 }, critBonus: 8, at: [0.08, 0.5], artAt: [0.03, 0.39] },
    ],
  },
};

/** Yol pususu için küçük harita. */
export const AMBUSH_MAP = "patika";

export interface QuestDef {
  id: string; title: string; giverNpc: string; importance: "basit" | "onemli" | "hayati";
  text: string; minutes: number; battle?: { enemies: string[]; map: string };
  rewards: { items?: Record<string, number>; money?: number; note: string };
  requires?: string[];
  repeatable?: boolean;
  at: string;            // işin yapıldığı yer (haber verilecek kişi ya da savaş alanı)
  doneText?: string;     // yerinde yapılınca düğme metni
}
export const QUESTS: QuestDef[] = [
  {
    id: "mesaj", title: "Muhtara haber", giverNpc: "hasan", importance: "basit", minutes: 15, at: "koy_meydani", doneText: "Haberi ver",
    text: "Hasan sürüyü bırakamıyor. Kurt izlerini köydeki muhtara haber vermeni istiyor. Yayladan köy meydanına inmen gerek.",
    rewards: { items: { ekmek: 1, peynir: 1 }, note: "Ekmek ve peynir. Hasan'ın verebileceği bu kadar." },
  },
  {
    id: "kurt", title: "Sürüye dadanan kurtlar", giverNpc: "hasan", importance: "onemli", minutes: 90, requires: ["mesaj"], at: "yayla",
    text: "İki kurt her gece bir kuzu kapıyor. Hasan yalvarıyor: 'Onları uzak tut, elimde ne varsa senin.'",
    battle: { enemies: ["kurt", "kurt"], map: "mera" },
    rewards: { items: { temiz_giysi: 1, el_yapimi_bicak: 1 }, note: "Temiz giysi ve kendi yaptığı bıçak. Bir çoban için büyük fedakârlık." },
  },
  {
    id: "annenin_izi", title: "Annenin izi", giverNpc: "ayse", importance: "onemli", minutes: 30, requires: ["kurt"], at: "zehra_evi", doneText: "Zehra'yla konuş",
    text: "Muhtar Ayşe, on iki yıl önce köye gelen defterli kadının Şifacı Zehra'ya bir şey bıraktığını söylüyor. Zehra köyün en üst evinde, otların arasında yaşıyor.",
    rewards: { items: { annenin_heybesi: 1 }, note: "Zehra'nın sandığından annenin elinden çıkmış bir sayfa ve onun eski heybesi." },
  },
  {
    id: "devriye", title: "Meraya devriye", giverNpc: "hasan", importance: "basit", minutes: 60, requires: ["kurt"], repeatable: true, at: "yayla",
    text: "Kurtlar tamamen gitmedi. Hasan geceleri meraya bir göz atmanı istiyor; karşılığında ne bulursa paylaşacak.",
    battle: { enemies: ["kurt", "kurt"], map: "mera" },
    rewards: { items: { peynir: 1 }, money: 1, note: "Bir parça peynir ve bir bakır." },
  },
];

/** Savaş haritaları: satırlar üstten alta, her karakter bir altıgen. */
export interface MapStart { name: string; at: [number, number]; note: string }
export interface BattleMap { name: string; rows: string[]; starts: MapStart[]; enemies: [number, number][]; flock: [number, number] }
/** Savaş haritaları: satırlar kuzeyden güneye, her karakter bir altıgen. */
export const MAPS: Record<string, BattleMap> = {
  // . çayır  , uzun ot  ~ çamur  ^ kaya  T tepe  = su  * ağaç
  mera: {
    name: "Hasan'ın merası",
    rows: [
      "**,,,**",
      "*,,.,,*",
      ",,..,..",
      "..,~~.^",
      ".~~~,.^",
      "..~,,TT",
      "==.,,.T",
      ".=...,.",
      "..^.,,*",
      ".^^..**",
      "..^..,*",
    ],
    starts: [
      { name: "Güney çayırı", at: [3, 10], note: "Açık arazi; sürünün yanında. Her yönden gelinebilir." },
      { name: "Doğu tepesi", at: [6, 5], note: "Yüksek zemin. Önünde kuru ot şeridi var." },
      { name: "Dere kenarı", at: [0, 7], note: "Arkan ve solun dere; kurtlar ancak önden gelebilir. Önü çamur." },
    ],
    enemies: [[2, 1], [4, 1]],
    flock: [3, 9],
  },
  patika: {
    name: "Patika",
    rows: [
      "*,,..**",
      ",,..,.*",
      ".,.~..,",
      "..^..,.",
      ".,...^.",
      "*..,..,",
      "**..,,*",
    ],
    starts: [{ name: "Patika", at: [3, 5], note: "Yolun ortası." }],
    enemies: [[3, 3], [5, 2]],
    flock: [3, 6],
  },
};
export const MAP_CHARS: Record<string, Terrain> = { ".": "cayir", ",": "uzun_ot", "~": "camur", "^": "kaya", T: "tepe", "=": "su", "*": "agac" };
