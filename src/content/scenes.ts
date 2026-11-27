// Sahneler: hikâyenin büyük anları sinema gibi anlatılır (karanlık, şeritler, satır satır yazı, yavaş
// yakınlaşan görsel, sahnenin kendi sesi). Yalnız veri; oynatıcı ui/scene-view.ts. Yazım kuralları:
// docs/anlatim-rehberi.md. Metin birinci tekil şahıs ("ben"), kısa cümle, göster-anlatma.

/** Oyunun mottosu: annenin defterindeki son cümle. Fizik (ısı yok olmaz) ve gizem (kimin ocağında?). */
export const MOTTO = "Sönen her ateş, başka bir ocakta yanar.";

export type Voice = "anlatici" | "anne";
export interface AmbCue { id: string; vol: number }
export type Beat =
  | { t: "metin"; text: string; voice?: Voice; center?: boolean }   // anlatıcı (ben) ya da annenin el yazısı
  | { t: "soz"; who: string; text: string }                          // konuşma: who = kişi kimliği ya da "sen"
  | { t: "gorsel"; art: string | null }                               // arka plan: hikaye_/yer_ görsel anahtarı, null = karanlık
  | { t: "ses"; layers: AmbCue[] }                                    // sahnenin ortam sesi (src/assets/ses/ortam_<id>.ogg)
  | { t: "bekle"; ms: number }
  | { t: "ad" }                                                       // oyuncunun adı sorulur
  | { t: "sis" };                                                     // sisin içinde çan sesini izleme (oynanır)
export interface Scene { id: string; beats: Beat[] }

const m = (text: string, center = false): Beat => ({ t: "metin", text, center });
const anne = (text: string): Beat => ({ t: "metin", text, voice: "anne", center: true });
const soz = (who: string, text: string): Beat => ({ t: "soz", who, text });

export const SCENES: Record<string, Scene> = {
  /** Soğuk açılış: defterin son cümlesi, yangının gölgesi, uzayan kış, dağ yolu. Sonunda sis. */
  acilis: { id: "acilis", beats: [
    { t: "ses", layers: [{ id: "ruzgar", vol: 0.45 }] },
    { t: "gorsel", art: null },
    anne(MOTTO),
    { t: "bekle", ms: 900 },
    { t: "gorsel", art: "hikaye_defter" },
    m("Bu cümleyi annem yazdı. Defterinin son dolu sayfasına."),
    m("Annem bir Ölçer'di. Ateşin neden yandığını, suyun neden donduğunu ölçerdi."),
    m("Ona göre büyü dua değildi. Hesaptı."),
    { t: "gorsel", art: "hikaye_yangin" },
    m("On iki yıl önce başkent Ardıç bir gecede yandı."),
    m("Sabah olunca Ölçerlere kundakçı dediler. Defterlerini meydanlarda yaktılar."),
    m("Annem o gece kayboldu. Geriye bu defter kaldı."),
    { t: "ses", layers: [{ id: "kar", vol: 0.4 }] },
    { t: "gorsel", art: "hikaye_kar" },
    m("O günden beri her kış bir öncekinden uzun sürüyor."),
    m("İnsanlar ocaklarını harlıyor, ama evler ısınmıyor."),
    m("Sanki sıcaklık bir yere çekiliyor."),
    { t: "ses", layers: [{ id: "ruzgar", vol: 0.5 }] },
    { t: "gorsel", art: "hikaye_yol" },
    m("Annemin son mektubu Taşpınar diye bir dağ köyünden gelmişti. On iki yıl önce."),
    m("Elimde bir çoban değneği, kesemde altı bakır var. Dağdan iniyorum."),
    m("Akşam oluyor. Sis çöküyor."),
    { t: "gorsel", art: null },
    { t: "sis" },
  ] },

  /** Hasan'la karşılaşma: ad sorulur, ilk gizem (kurt böyle avlanmaz), ilk iş. */
  varis: { id: "varis", beats: [
    { t: "ses", layers: [{ id: "ruzgar", vol: 0.3 }, { id: "koyun", vol: 0.7 }] },
    { t: "gorsel", art: "hikaye_varis" },
    m("Sisin içinden bir fener çıkıyor. Arkasında yaşlı bir yüz."),
    soz("hasan", "Kim var orada? Yolcu musun, eşkıya mı?"),
    soz("sen", "Yolcuyum. Taşpınar'a iniyorum."),
    soz("hasan", "Bu sisle mi? Bu dağ, gece yolcuyu yutar. Gel, ağılın yanında yer var."),
    soz("hasan", "Adın ne senin?"),
    { t: "ad" },
    soz("hasan", "{ad}… Buralı bir ad değil."),
    m("Bir süre yüzüme baktı. Bir şey hatırlamaya çalışır gibiydi. Sonra vazgeçti."),
    soz("hasan", "Ben Hasan. Kusura bakma, üç gecedir gözüme uyku girmiyor."),
    soz("hasan", "Her gece sürüden bir kuzu eksiliyor. Köydekiler kurt diyor."),
    soz("hasan", "Otuz yıldır çobanım. Kurt böyle avlanmaz."),
    { t: "ses", layers: [{ id: "gece", vol: 0.6 }, { id: "ruzgar", vol: 0.25 }] },
    { t: "gorsel", art: "yer_yayla" },
    m("Gece boyu ağılın çevresinde bir şey dolaştı. Hasan sabaha kadar fenerini söndürmedi."),
    m("Sabah, ağılın kapısında kırağı vardı. Mevsimlerden yazdı."),
    { t: "ses", layers: [{ id: "ruzgar", vol: 0.3 }, { id: "koyun", vol: 0.6 }] },
    soz("hasan", "Ben sürüyü bırakamam. Köye in, muhtar Ayşe'ye anlat. Belki seni dinler."),
  ] },
};

/** Konuşanın görünen adı ve portresi: "sen" oyuncudur. */
export const SPEAKERS: Record<string, { name: string; portrait?: string }> = {
  sen: { name: "Ben" },
  hasan: { name: "Hasan", portrait: "portre_hasan" },
};

/** Sis oyunu: çan sesi hangi yandan gelir (0 sol, 1 sağ). Tohumdan, art arda aynı yan en çok iki kez. */
export function sisSides(seed: number, rounds = 3): (0 | 1)[] {
  const out: (0 | 1)[] = []; let a = (seed >>> 0) + 0x6d2b79f5;
  const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };   // mulberry32
  for (let i = 0; i < rounds; i++) {
    let side = (rnd() < 0.5 ? 0 : 1) as 0 | 1;
    if (i >= 2 && out[i - 1] === side && out[i - 2] === side) side = (1 - side) as 0 | 1;
    out.push(side);
  }
  return out;
}
/** Metindeki {ad} yerine oyuncunun adı. */
export const fill = (text: string, name: string) => text.replace(/\{ad\}/g, name || "Yolcu");
