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
  | { t: "gorsel"; art: string | null; gece?: boolean }               // arka plan: hikaye_/yer_ görsel anahtarı, null = karanlık; gece = karartılmış
  | { t: "tek"; id: string; vol?: number }                            // tek seferlik ses (src/assets/ses/ içinden: harabe_uluma, kurt_uzak…)
  | { t: "incele"; prompt: string; spots: Spot[] }                    // görselin üstünde dokunarak incelenecek yerler (hepsi bulununca sürer)
  | { t: "ses"; layers: AmbCue[] }                                    // sahnenin ortam sesi (src/assets/ses/ortam_<id>.ogg)
  | { t: "bekle"; ms: number }
  | { t: "ad" }                                                       // oyuncunun adı sorulur
  | { t: "sis" }                                                       // sisin içinde çan sesini izleme (oynanır)
  | { t: "baslik"; text: string; sub?: string };                      // bölüm kartı: karanlıkta büyük başlık
export interface Spot { x: number; y: number; label: string; text: string }   // x, y: görselin üstünde 0–1
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
    { t: "baslik", text: "Bölüm 1", sub: "Kıvılcım" },
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

  /** Muhtar Ayşe: kurda inanıyor, ama seni tanır gibi. Gece ağılda bekleyip kendi gözünle görmeni ister. */
  ayse: { id: "ayse", beats: [
    { t: "ses", layers: [{ id: "meydan", vol: 0.8 }] },
    { t: "gorsel", art: "hikaye_ilk_is" },
    m("Köy meydanında taştan bir pınar. Başında su dolduran kadınlar beni görünce sustu."),
    soz("ayse", "Yabancısın. Hasan mı gönderdi seni?"),
    soz("sen", "Her gece sürüden bir kuzu eksiliyor. Hasan, kurt böyle avlanmaz diyor."),
    soz("ayse", "Hasan yaşlandı. Kurt kurttur."),
    m("Sonra yüzüme baktı. Uzun uzun."),
    soz("ayse", "Seni bir yerden tanıyor gibiyim."),
    m("Bir şey diyecekti. Vazgeçti."),
    soz("ayse", "Madem merak ettin, bu gece Hasan'la ağılda bekle. Kendi gözünle gör, sonra gel bana anlat."),
  ] },

  /** Ağılda nöbet: gece, uzaktan kurtlar, kuzu meler; fenerle ağılı incelersin. Kuzu donmuş. */
  donmus_kuzu: { id: "donmus_kuzu", beats: [
    { t: "ses", layers: [{ id: "gece", vol: 0.6 }, { id: "ruzgar", vol: 0.3 }, { id: "muzik_orman", vol: 0.3 }] },
    { t: "gorsel", art: "yer_yayla", gece: true },
    m("Gece yarısı. Hasan'la ağılın taş duvarının dibinde bekliyoruz."),
    m("Fener söndü. Ay bulutların arkasında."),
    { t: "bekle", ms: 900 },
    { t: "tek", id: "kurt_uzak", vol: 0.7 },
    soz("hasan", "Duydun mu? Geldiler."),
    m("Ağılın öbür ucunda koyunlar birden sustu. Sonra bir kuzu meledi. Bir kez."),
    m("Koştuğumuzda gölgeler kayalıklara doğru çoktan kaybolmuştu."),
    { t: "incele", prompt: "Feneri yaktım. Ağılın içine bakıyorum.", spots: [
      { x: 0.3, y: 0.68, label: "Kuzu", text: "Kuzu yerde. Üstünde ne diş izi var ne kan. Tüyleri kırağı tutmuş; buz gibi." },
      { x: 0.62, y: 0.74, label: "İzler", text: "Pençe izleri. Ama basılan yerlerde toprak donmuş; sanki ayaklarının altı soğumuş." },
      { x: 0.8, y: 0.5, label: "Duvar", text: "Duvarın taşlarında ince bir kırağı. Mevsimlerden yaz." },
    ] },
    soz("hasan", "Otuz yıldır çobanım. Kurt kuzuyu yer. Dondurmaz."),
    m("Kuzuyu elime aldım. Soğuğu avucuma işledi. Annemin defterindeki cümle aklımdan çıkmadı."),
    anne(MOTTO),
    soz("hasan", "İzler meradaki kayalıklara gidiyor. Yarın gece orada bekleyelim."),
  ] },

  /** Pusudan önce Hasan öğretir: rüzgâr, meşale, yüksek yer. Ardından plan senin. */
  pusu: { id: "pusu", beats: [
    { t: "ses", layers: [{ id: "ruzgar", vol: 0.5 }, { id: "gece", vol: 0.3 }] },
    { t: "gorsel", art: "hikaye_suru" },
    m("Hasan beni meraya çıkardı. Kayalıkların dibinde, kuzunun yanındaki izlerin aynısı."),
    soz("hasan", "Kurt rüzgârı arkasına alır. Kokunu alırsa ya yaklaşmaz, ya da ansızın gelir."),
    soz("hasan", "Meşale yak ama elinde tutma. Kayaya dik; ışık onların gözünü alır."),
    soz("hasan", "Yüksek yere çık. Yukarıdan vuran, aşağıdan vurulandan uzun yaşar."),
    m("Nereden gireceğim, ne zaman bekleyeceğim, ne kuracağım: gerisi bana kaldı."),
  ] },

  /** Sürünün bekçisi: bir kurt yaralı kaçar, kuzeyden uluma; "kovalanıyorlar"; Ayşe seni annenin izine yollar. */
  suru: { id: "suru", beats: [
    { t: "ses", layers: [{ id: "ruzgar", vol: 0.4 }, { id: "gece", vol: 0.5 }] },
    { t: "gorsel", art: "hikaye_suru", gece: true },
    m("Kurtlardan biri yere serildi. Öbürü yaralı, kayalıklara kaçtı."),
    m("Peşinden gitmedim. Dağın arkasından, kuzeyden bir uluma cevap verdi."),
    { t: "tek", id: "harabe_uluma", vol: 0.85 },
    { t: "bekle", ms: 700 },
    soz("hasan", "Bu kurtlar aç değil, evlat. Kovalanıyorlar."),
    soz("hasan", "Kuzeyde bir şey onları aşağı itiyor. Soğuk gibi bir şey."),
    { t: "ses", layers: [{ id: "meydan", vol: 0.8 }] },
    { t: "gorsel", art: "yer_koy_meydani" },
    m("Ertesi sabah köyde adım anılmaya başlamıştı. Muhtar Ayşe beni çağırttı."),
    soz("ayse", "On iki yıl önce buraya bir kadın geldi. Bir defteri vardı; seninkine benziyordu."),
    soz("ayse", "Gitmeden önce Şifacı Zehra'ya bir şey bıraktı. Git, ona sor."),
  ] },

  /** Annenin izi: Zehra'nın sandığı, ATEŞ yaprağı, kenarda bir taş çizimi. */
  zehra: { id: "zehra", beats: [
    { t: "ses", layers: [{ id: "ruzgar", vol: 0.25 }] },
    { t: "gorsel", art: "hikaye_iz" },
    m("Zehra'nın evi yaylaya çıkan patikanın en ucunda. Kapıda kurumaya asılmış otlar."),
    soz("zehra", "Ayşe gönderdi seni. Biliyorum."),
    soz("zehra", "Yüzün ona benziyor. Gözlerin değil; bakışın."),
    m("İçeride eski bir sandık. Zehra kilidi açmadan önce elini bir süre kapağın üstünde tuttu."),
    soz("zehra", "On iki yıl önce bir kış gecesi geldi. Yanında bu heybe vardı, bir de defter."),
    soz("zehra", "Defteri götürdü. Bir yaprağı bıraktı. \"Çocuğum gelirse ona ver,\" dedi."),
    anne("ATEŞ. Isı, maddenin titreşimidir. Titreşimi tek noktada topla; nefesin yakıtındır."),
    m("Annemin el yazısı. Kenarında küçük bir çizim: ortası parlayan, yuvarlak bir taş."),
    soz("zehra", "Bunu okumak yasak, biliyorsun. Yakmak da."),
    soz("zehra", "Ama annen bana bir şey daha dedi: \"Ateşi öğrenmeyen, kimin ocağında yandığını da bilemez.\""),
    m("Yaprağı defterime koydum. Ateşi çalışmam gerek; avucumda tutabilene kadar."),
  ] },

  /** İlk kıvılcım: avuçta ilk alev. */
  kivilcim: { id: "kivilcim", beats: [
    { t: "ses", layers: [{ id: "gece", vol: 0.4 }, { id: "ruzgar", vol: 0.2 }] },
    { t: "gorsel", art: "hikaye_kivilcim" },
    m("Günlerdir avuçlarıma bakıyorum. Isıyı tek noktada toplamaya çalışıyorum."),
    m("Nefes al. Topla. Bırakma.", true),
    { t: "bekle", ms: 800 },
    m("Avucumda bir an için gerçek bir alev durdu."),
    m("Nefesim titredi; alev de titredi. Söndüğünde avucum hâlâ sıcaktı."),
    m("Sönen ateş bir yere gider. Bu sefer benim avucuma geldi."),
  ] },

  /** Ateş ve kurt: büyüyle kazanılan ilk savaş; Hasan gördü; köyde fısıltı. */
  ates_kurt: { id: "ates_kurt", beats: [
    { t: "ses", layers: [{ id: "gece", vol: 0.5 }, { id: "ruzgar", vol: 0.3 }] },
    { t: "gorsel", art: "hikaye_ates_kurt" },
    m("Kurtlar ateşi görünce dağıldı."),
    m("Ama meranın kenarında Hasan duruyordu. Her şeyi görmüştü."),
    soz("hasan", "Bunu kimseye gösterme, evlat."),
    soz("hasan", "On iki yıl önce bunun için insan astılar."),
    { t: "ses", layers: [{ id: "meydan", vol: 0.8 }] },
    { t: "gorsel", art: "yer_koy_meydani" },
    m("Ertesi gün meydandan geçerken konuşmalar kesiliyordu."),
    m("Biri, yasak bir şey gördüğünü fısıldıyordu."),
    soz("ayse", "Dikkat et. Herkes Hasan kadar dilini tutmaz."),
  ] },

  /** Kurtlar nereden geliyor: kaya yarığında donmuş karaca (yan hikâye). */
  karaca: { id: "karaca", beats: [
    { t: "ses", layers: [{ id: "koru", vol: 0.7 }, { id: "ruzgar", vol: 0.3 }] },
    { t: "gorsel", art: "yer_koru" },
    m("İzler korunun kuzeyine, eski bir kaya yarığına çıkıyor."),
    { t: "tek", id: "kurt_uzak", vol: 0.5 },
    { t: "incele", prompt: "Yarığın ağzında bir şey yatıyor.", spots: [
      { x: 0.45, y: 0.68, label: "Karaca", text: "Bir karaca. Yazın ortasında donmuş; tüyleri kırağı tutmuş." },
      { x: 0.72, y: 0.48, label: "Yarık", text: "Yarıktan soğuk bir hava esiyor. İçeriden derin bir uğultu geliyor." },
      { x: 0.24, y: 0.58, label: "İzler", text: "Kurt izleri karacanın izlerinin üstüne basıyor. Avlarının peşinden inmişler." },
    ] },
    m("Kurtlar aç değil. Avları kaçıyor; onlar da peşinden aşağı iniyor."),
    m("Avlarını donduran ise başka bir şey."),
  ] },

  /** Donmuş karacayı Zehra'ya anlatınca: kuzeyde ısı çekiliyor; sürünün başı Akyele. */
  akyele_haber: { id: "akyele_haber", beats: [
    { t: "ses", layers: [{ id: "ruzgar", vol: 0.25 }] },
    { t: "gorsel", art: "hikaye_iz" },
    soz("zehra", "Yazın donmuş bir karaca, öyle mi?"),
    m("Uzun süre sustu."),
    soz("zehra", "Kuzeyde ısı çekiliyor. Önce otlar gider, sonra karacalar, sonra kurtlar iner."),
    soz("zehra", "Sürüyü Akyele dediğimiz yaşlı bir dişi yönetiyor. Boynunda beyaz bir yele var."),
    soz("zehra", "O düşerse sürü dağılır. Yoksa her gece yenisi gelir."),
  ] },

  /** Sürünün başı: Akyele düşer; inin dibinde sönmemiş bir kor. */
  suru_basi: { id: "suru_basi", beats: [
    { t: "ses", layers: [{ id: "gece", vol: 0.4 }, { id: "ruzgar", vol: 0.35 }, { id: "muzik_orman", vol: 0.3 }] },
    { t: "gorsel", art: "hikaye_suru_basi" },
    m("Akyele düştü. Beyaz yelesi karın üstünde."),
    m("Yazın ortasında, kar."),
    m("Sürü kuzeye kaçtı. Bir süre uzaktan ulumaları geldi; sonra sustular."),
    { t: "tek", id: "kurt_uzak", vol: 0.45 },
    { t: "incele", prompt: "İnin dibinde bir şey parlıyor.", spots: [
      { x: 0.52, y: 0.64, label: "Kor", text: "Karın içinde sönmemiş bir kor. Avucuma aldım: sıcak, ama yakmıyor." },
    ] },
    m("Annemin yaprağındaki çizimin aynısı. Ortası parlayan, yuvarlak bir taş."),
    m("Kuzeyde bir şey ısıyı çekiyor. Bu taş da bir zamanlar oradaydı."),
  ] },

  /** Annenin mektubu: bölüm sonu. Kâğıt eski, son satırın mürekkebi taze. */
  mektup: { id: "mektup", beats: [
    { t: "ses", layers: [{ id: "ruzgar", vol: 0.3 }] },
    { t: "gorsel", art: "hikaye_mektup" },
    m("Sabah kapımda Zehra vardı. Elinde mühürlü bir mektup."),
    soz("zehra", "Bunu da annen bıraktı. \"Ateşi öğrendiğinde ver,\" dedi."),
    m("Mühürde küçük bir terazi vardı. Ölçerlerin işareti. Kırdım."),
    anne("Isıyı çeken biri var. Kuzeyde değil, aramızda."),
    anne("Karaçam'daki tüccar Selim'e git. Kimin için çalıştığını o bilir."),
    m("Kâğıt sararmıştı. Ama son satırın mürekkebi tazeydi."),
    m("Sanki biri onu, geçen kış eklemişti."),
    soz("zehra", "Yolun açık olsun. Taşpınar seni unutmaz."),
    { t: "gorsel", art: null },
    { t: "baslik", text: "Bölüm 1 sona erdi", sub: "Sırada: Karaçam" },
  ] },
};

/** Konuşanın görünen adı ve portresi: "sen" oyuncudur. */
export const SPEAKERS: Record<string, { name: string; portrait?: string }> = {
  sen: { name: "Ben" },
  hasan: { name: "Hasan", portrait: "portre_hasan" },
  ayse: { name: "Muhtar Ayşe", portrait: "portre_ayse" },
  zehra: { name: "Şifacı Zehra", portrait: "portre_zehra" },
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
