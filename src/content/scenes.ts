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
  | { t: "sis"; tur?: "damla" }                                       // sesi izleme (oynanır): sisin içinde çan, karanlık sarnıçta su damlası
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

  /* ================= Bölüm 2: Karaçam ================= */

  /** Varış: yazın ortasında kar, kürklü insanlar, ısı çeken taşlar. Hancı Yaren Selim'i gösterir. */
  k_varis: { id: "k_varis", beats: [
    { t: "gorsel", art: null },
    { t: "baslik", text: "Bölüm 2", sub: "Karaçam" },
    { t: "ses", layers: [{ id: "ruzgar", vol: 0.5 }, { id: "carsi", vol: 0.35 }] },
    { t: "gorsel", art: "hikaye_k_varis" },
    m("Karaçam'ın kapısından girerken nefesim buğulandı."),
    m("Yazın ortası. Ama yolun kenarında kar var."),
    { t: "incele", prompt: "Kapının önü kalabalık.", spots: [
      { x: 0.86, y: 0.82, label: "Kürkler", text: "Herkes kürk giymiş. Bir çocuk ellerini koltuk altına sokmuş, titriyor." },
      { x: 0.14, y: 0.8, label: "Araba", text: "Kervan arabalarında hasır sepetler. Sepetlerin arasından turuncu bir ışık sızıyor." },
      { x: 0.42, y: 0.72, label: "Kar", text: "Kar, şehrin içine doğru kalınlaşıyor. Soğuk dışarıdan değil, içeriden geliyor." },
    ] },
    { t: "ses", layers: [{ id: "carsi", vol: 0.9 }, { id: "ruzgar", vol: 0.2 }] },
    { t: "gorsel", art: "yer_karacam" },
    m("Çarşıda kehribar renginde taşlar satılıyor. Yanlarından geçince elim ısınıyor."),
    m("Bir sepet taş, bir yük odundan pahalı. Yine de herkes alıyor."),
    { t: "gorsel", art: "yer_karacam_han" },
    m("Han kapısında bir kadın sazını akort ediyordu."),
    soz("yaren", "Yolcu, kuzeyden mi geldin? Yok… kuzeyden gelen kalmadı zaten."),
    soz("sen", "Selim adında bir tüccar arıyorum."),
    soz("yaren", "Selim mi? Çarşının en sıcak dükkânı onunki."),
    soz("yaren", "Ama sorulardan hoşlanmaz. Ben de sormam; o yüzden iyi anlaşırız."),
  ] },

  /** Selim'in dükkânı: "Ölçer" kelimesi yasak; taşlar ısı tutmuyor, çekiyor; kar tanesi mührü. */
  k_muhur: { id: "k_muhur", beats: [
    { t: "ses", layers: [{ id: "carsi", vol: 0.45 }] },
    { t: "gorsel", art: "hikaye_k_selim" },
    m("Selim'in tezgâhının önünde kar erimiş. Dükkânın içi sıcak."),
    soz("sen", "Annemi arıyorum. On iki yıl önce buraya geldi. Bir Ölçerdi."),
    soz("selim", "Sus! Burada o kelimeyi yüksek sesle söyleme."),
    soz("selim", "Tanımam. Kimseyi tanımam. Taş mı alacaksın? Almayacaksan yolu kapatma."),
    { t: "ses", layers: [{ id: "carsi", vol: 0.2 }] },
    { t: "gorsel", art: "hikaye_k_muhur" },
    m("Arkadaki sandığa bir sepet taş taşıdı. Bir taş yere düştü; eğilip aldım."),
    { t: "incele", prompt: "Taş avucumda. Tezgâhta bir mum yanıyor.", spots: [
      { x: 0.3, y: 0.66, label: "Taş", text: "Sıcak. Ama avucumu ısıtmıyor; avucumdan bir şey çekiyor." },
      { x: 0.77, y: 0.58, label: "Mum", text: "Mumun alevi dik yanmıyor. Taşlara doğru eğiliyor." },
      { x: 0.57, y: 0.45, label: "Mühür", text: "Sandığın üstünde lacivert bir mühür: bir kar tanesi. Ayazkale'nin mührü." },
    ] },
    m("Bu taşlar ısı tutmuyor. Isı çekiyor."),
    anne("Isıyı çeken biri var. Kuzeyde değil, aramızda."),
    { t: "gorsel", art: "hikaye_k_selim" },
    soz("selim", "Bir şey diyeceğim. Sonra hiç konuşmadık."),
    soz("selim", "Her gece bir arabamı soyuyorlar. Hep dolu olanı."),
    soz("selim", "Haydutlar hangisinin dolu olduğunu nereden biliyor? Bunu bulursan, sorularını konuşuruz."),
  ] },

  /** İşaretli arabalar (gece, inceleme): dolu arabalarda tebeşir çarpı; işareti koyan handan çıkmış. */
  tebesir: { id: "tebesir", beats: [
    { t: "ses", layers: [{ id: "gece", vol: 0.55 }, { id: "ruzgar", vol: 0.3 }] },
    { t: "gorsel", art: "yer_karacam_han", gece: true },
    m("Gece hanın avlusunda, arabaların arasında bekledim."),
    m("Develer uyuyor. Bekçi kapının dibinde horluyor."),
    { t: "incele", prompt: "Yarın yola çıkacak arabalar burada.", spots: [
      { x: 0.88, y: 0.88, label: "Araba", text: "Bu araba dolu. Tekerleğin iç yüzünde tebeşirle çizilmiş küçük bir çarpı." },
      { x: 0.4, y: 0.62, label: "Kapı", text: "Ahır kapısının dibinde tebeşir tozu. Ayak izleri hanın içine gidiyor." },
      { x: 0.8, y: 0.47, label: "Balkon", text: "Han balkonunda bir mum hâlâ yanıyor. Biri avluyu seyrediyor." },
    ] },
    m("Dolu arabalar işaretli. İşareti koyan handan çıkmış, hana geri girmiş."),
    m("Balkondaki mum söndü."),
    { t: "bekle", ms: 900 },
    { t: "ses", layers: [{ id: "carsi", vol: 0.4 }] },
    { t: "gorsel", art: "hikaye_k_selim" },
    soz("selim", "Tebeşir mi? Hanın içinden?"),
    soz("selim", "İşaretleri silmeyeceğiz. Bırak gelsinler. Kervan yarın gece çıkıyor."),
    soz("selim", "Sen de işaretli arabada ol."),
  ] },

  /** Kervan yolu, savaştan önce (bir kez): işaretli arabanın içinde, taşların ışığında bekleyiş. */
  kervan_once: { id: "kervan_once", beats: [
    { t: "ses", layers: [{ id: "ruzgar", vol: 0.5 }, { id: "gece", vol: 0.35 }] },
    { t: "gorsel", art: "hikaye_yol", gece: true },
    m("Kervan şehirden çıktı. Tekerlekler karda gıcırdıyor."),
    m("İşaretli araba en arkada. Ben içindeyim, sepetlerin arasında."),
    m("Taşların ışığı yüzüme vuruyor. Sıcak değil; üşütüyor."),
    { t: "bekle", ms: 1000 },
    m("Yolun kenarında bir ıslık. Sonra bir tane daha.", true),
    soz("sen", "Geldiler."),
  ] },

  /** Kervandan sonra: haydutun heybesindeki not; Selim annesini anlatır, sarnıcı gösterir. */
  k_selim: { id: "k_selim", beats: [
    { t: "ses", layers: [{ id: "ruzgar", vol: 0.35 }, { id: "gece", vol: 0.3 }] },
    { t: "gorsel", art: "hikaye_yol", gece: true },
    m("Haydutlardan biri kaçarken heybesini düşürdü."),
    m("İçinde kor taşları ve katlanmış bir kâğıt."),
    m("\"Kuzeye. Kayhan Bey'in adamlarına.\"", true),
    { t: "ses", layers: [{ id: "carsi", vol: 0.3 }] },
    { t: "gorsel", art: "hikaye_k_selim" },
    soz("selim", "Kayhan Bey. Ayazkale'nin beyi. Taşları ona satıyorum."),
    soz("selim", "Meğer kendi malını geri çaldırıyormuş."),
    m("Uzun süre sustu. Sonra sesini alçalttı."),
    soz("selim", "Annen on iki yıl önce tezgâhıma bir taş koydu. Mumu yanına tuttu."),
    soz("selim", "\"Bunlar ısıyı yerden çalıyor,\" dedi. Bir hafta sonra kayboldu."),
    soz("selim", "Şehrin altında eski bir sarnıç var. Ölçerlerden biri hâlâ orada saklanıyor."),
    soz("selim", "Suyun sesini takip et."),
  ] },

  /** Sarnıç: karanlıkta su damlasını izleme (oynanır); Usta Derya, SU sayfası. */
  k_derya: { id: "k_derya", beats: [
    { t: "ses", layers: [{ id: "dere", vol: 0.15 }] },
    { t: "gorsel", art: null },
    m("Sarnıcın merdivenleri suya iniyor. Mumum ilk basamakta söndü."),
    m("Karanlık. Bir yerlerden su damlıyor."),
    { t: "sis", tur: "damla" },
    { t: "ses", layers: [{ id: "dere", vol: 0.45 }] },
    { t: "gorsel", art: "hikaye_k_derya" },
    m("Kemerlerin dibinde bir mum yanıyor. Yanında yaşlı bir kadın."),
    soz("derya", "Kimsin? Seni Selim mi gönderdi?"),
    m("Annemin defterini açıp gösterdim. Kadının elleri titredi."),
    soz("derya", "Bu el yazısını tanırım."),
    m("Ağladı. Sonra defterin boş bir sayfasına yazmaya başladı."),
    soz("derya", "Annen bana suyu öğretmişti. Şimdi sıra sende."),
    anne("Su ısıyı emer, taşır ve geri verir."),
    m("Defterime yeni bir sayfa eklendi: SU."),
    soz("derya", "Isı Loncası her ay kuzeye boş taş yollar, dolu taş geri alır."),
    soz("derya", "Kayıtları depoda tutarlar. O defteri getir; ne olduğunu orada göreceğiz."),
  ] },

  /** Loncanın defteri: kayıtları annem tutmuş; en altta başka bir el. Bölüm sonu. */
  k_defter: { id: "k_defter", beats: [
    { t: "ses", layers: [{ id: "dere", vol: 0.2 }] },
    { t: "gorsel", art: "hikaye_k_defter" },
    m("Loncanın kayıt defteri. Ay ay, sepet sepet."),
    m("Kaç sepet boş gitti, kaç sepet dolu döndü."),
    { t: "incele", prompt: "Son sayfalar.", spots: [
      { x: 0.3, y: 0.17, label: "Yazı", text: "Satırların yazısı birden değişiyor. Eğik, sık. Annemin el yazısı." },
      { x: 0.8, y: 0.17, label: "Tarih", text: "Son kayıt geçen aydan." },
      { x: 0.5, y: 0.42, label: "Çizim", text: "Kenara iliştirilmiş bir çizim: Karaçam'ın çarşısı. Sanki biri onu ezberden çizmiş." },
    ] },
    m("Bu kayıtları annem tutmuş. Geçen aya kadar."),
    m("En altta başka bir el, başka bir mürekkep:"),
    m("\"Ölçer L. Soğuk Ocak'ta çalıştırılıyor. Kaçarsa taş akışı durur.\"", true),
    { t: "bekle", ms: 900 },
    m("On iki yıl öldüğünü sandım."),
    m("Annem yaşıyor. Kuzeyde, Ayazkale'de.", true),
    { t: "gorsel", art: "hikaye_k_derya" },
    soz("derya", "Geçit karla kapalı. Ama kar kurtlarından korkmuyorsan yol var."),
    soz("derya", "Bir de geçidin ağzında Kayhan'ın gümrükçüsü var. Loncanın beratı olmadan geçeni geri çevirmez; donmaya bırakır."),
    soz("derya", "Berat ucuz değil. Selim'e git; parayı nasıl çoğaltacağını o bilir."),
    { t: "gorsel", art: null },
    { t: "baslik", text: "Bölüm 2 sona erdi", sub: "Sırada: Ayazkale" },
  ] },

  /* ================= Bölüm 3: Ayazkale ================= */

  /** Kar geçidi, savaştan önce (bir kez): donmuş kervan; tekerlekte aynı tebeşir çarpı; uluma. */
  gecit_once: { id: "gecit_once", beats: [
    { t: "gorsel", art: null },
    { t: "baslik", text: "Bölüm 3", sub: "Ayazkale" },
    { t: "ses", layers: [{ id: "kar", vol: 0.85 }] },
    { t: "gorsel", art: "yer_ayaz_gecit" },
    m("Geçidin yolu karla kapanmış. Rüzgâr yüzümü bıçak gibi kesiyor."),
    m("Yolun ortasında bir kervan. Arabalar yerinde, atlar yerinde. Hepsi donmuş."),
    { t: "incele", prompt: "Donmuş kervan.", spots: [
      { x: 0.16, y: 0.64, label: "Araba", text: "Arabalar kor taşıyla dolu. Taşların ışığı sönmüş; hepsi buz gibi." },
      { x: 0.84, y: 0.76, label: "Tekerlek", text: "Tekerleğin iç yüzünde tebeşirle çizilmiş küçük bir çarpı." },
      { x: 0.52, y: 0.5, label: "İzler", text: "Arabaların arasında iri pençe izleri. Kar kurtları. İzler taze." },
    ] },
    m("Karaçam'daki işaretin aynısı. Bu arabayı da biri seçmiş."),
    { t: "tek", id: "harabe_uluma", vol: 0.8 },
    m("Uluma geçidin iki yanından geldi.", true),
    soz("sen", "Ateşim varsa, şimdi yakmalıyım."),
  ] },

  /** Geçidin tepesi: Ayazkale; tek tüten baca mutfağınki. */
  a_gecit: { id: "a_gecit", beats: [
    { t: "ses", layers: [{ id: "kar", vol: 0.6 }] },
    { t: "gorsel", art: "hikaye_a_gecit" },
    m("Son kurt karın içine çekildi. Nefesim ciğerlerimi yakıyor."),
    m("Geçidin tepesine tırmandım."),
    { t: "gorsel", art: "yer_ayazkale" },
    m("Ayazkale. Buza gömülü surlar."),
    m("Ortada bir kule. Tepesinden mavi bir soğuk sızıyor."),
    m("Göğe doğru değil. Aşağı doğru, kalenin içine akıyor."),
    m("Kalenin bacalarından duman çıkmıyor. Bir tanesi hariç."),
    m("Mutfağın bacası. Bu kalede sıcak bir yer varsa, orası.", true),
  ] },

  /** Mutfak: yamak olarak üç saat; ocağın başında kırağı; yarısı yanmış mektup ve saz çizimi; Gülizar konuşur. */
  a_iceride: { id: "a_iceride", beats: [
    { t: "ses", layers: [{ id: "kar", vol: 0.2 }] },
    { t: "gorsel", art: "yer_ayaz_mutfak" },
    m("Üç saat odun taşıdım, ocak yaktım, sustum."),
    m("Kimse bir aşçı yamağının yüzüne bakmıyor."),
    { t: "incele", prompt: "Gülizar ocağın başından ayrılınca etrafa baktım.", spots: [
      { x: 0.5, y: 0.6, label: "Ocak", text: "Ocak gürül gürül yanıyor. Ama kazanın kenarında kırağı var." },
      { x: 0.86, y: 0.42, label: "Duvar", text: "Duvarda bir çatlak. Kulenin olduğu yandan ince bir soğuk akıyor." },
      { x: 0.16, y: 0.74, label: "Kâğıt", text: "Ocağın ağzında yarısı yanmış bir mektup: \"Karaçam hanından. Bu ay üç dolu araba.\" Altında küçük bir saz çizimi." },
    ] },
    m("Saz. Han kapısında akort edilen o saz."),
    { t: "gorsel", art: "hikaye_a_iceride" },
    soz("gulizar", "Yeterince gördün. Kapıyı kapa."),
    soz("gulizar", "Kulede bir kadın var. On iki yıldır."),
    soz("gulizar", "Geceleri duvarlara formül yazıyor. Muhafızlar siliyor; o yine yazıyor."),
    soz("gulizar", "Kardeşim geçitte dondu. Kayhan'ın ocağı yüzünden."),
    soz("gulizar", "Bu gece sana kulenin merdivenini göstereceğim. Sessiz ol."),
  ] },

  /** Gizli merdiven (gece, inceleme): kulenin dibi, duvarlarda annenin formülleri, çentikler. */
  merdiven: { id: "merdiven", beats: [
    { t: "ses", layers: [{ id: "kar", vol: 0.3 }] },
    { t: "gorsel", art: null },
    m("Gece yarısı. Gülizar kilerin arkasındaki taşı itti."),
    m("Dar bir merdiven. Her basamakta biraz daha soğuk."),
    { t: "gorsel", art: "yer_ayaz_kule" },
    { t: "incele", prompt: "Kulenin dibi. Muhafızlar yukarıda.", spots: [
      { x: 0.18, y: 0.4, label: "Satırlar", text: "Duvara kazınmış satırlar. Silinmiş, üstüne yeniden yazılmış. Annemin el yazısı." },
      { x: 0.5, y: 0.62, label: "Kapı", text: "Ocak odasının kapısı. Aralığından mavi bir ışık ve derin bir uğultu geliyor." },
      { x: 0.82, y: 0.42, label: "Çentikler", text: "Bir duvarda çentikler. Günleri saymış. Saymaya çalıştım; bıraktım." },
    ] },
    anne("Çekilen ısı bir yere toplanır. Bu ocağı kim besliyor?"),
    m("Yukarıdan ayak sesleri. Gülizar kolumu çekti."),
    soz("gulizar", "Üç muhafız var. Yarın gece. Hazırlan."),
  ] },

  /** Kuleye çıkış, savaştan önce (bir kez): yukarıdan tanıdık bir ezgi. */
  kule_once: { id: "kule_once", beats: [
    { t: "ses", layers: [{ id: "kar", vol: 0.3 }] },
    { t: "gorsel", art: "yer_ayaz_kule" },
    m("Merdivenleri ikişer ikişer çıktım."),
    m("Yukarıdan bir ses geliyor. Biri alçak sesle bir ezgi mırıldanıyor."),
    m("Bu ezgiyi bilirim. Çocukken, uyumadan önce…", true),
    { t: "bekle", ms: 1000 },
    m("Merdivenin başında üç muhafız. Biri döndü."),
    soz("sen", "Şimdi."),
  ] },

  /** Annem: tanımaz, sonra defteri görür; AYAZ sayfası. */
  a_anne: { id: "a_anne", beats: [
    { t: "ses", layers: [{ id: "ruzgar", vol: 0.2 }] },
    { t: "gorsel", art: "hikaye_a_anne" },
    m("Kapının ardında, pencerenin önünde bir kadın duruyordu."),
    m("Arkası dönüktü. Omuzları hatırladığımdan dar."),
    soz("sen", "Anne?"),
    m("Döndü. Bana baktı. Tanımadı."),
    { t: "bekle", ms: 1000 },
    m("Defteri uzattım. Kendi el yazısını görünce elleri durdu."),
    soz("anne", "Ateşi buldun. Suyu da."),
    soz("anne", "{ad}…"),
    m("On iki yıl sonra annemin elini tuttum. Soğuktu."),
    soz("anne", "Şimdi ayazı öğren. Ayaz bir madde değil; ısının yokluğu."),
    anne("Isıyı bir yerden çekersen, başka bir yere gider."),
    m("Defterime yeni bir sayfa eklendi: AYAZ."),
    soz("anne", "Önce ocağı kapatmalıyız. Yoksa kaçtığımı anlarlar."),
  ] },

  /** Soğuk Ocak, savaştan önce (bir kez): Kayhan ocağın başında. */
  ocak_once: { id: "ocak_once", beats: [
    { t: "ses", layers: [{ id: "kar", vol: 0.45 }] },
    { t: "gorsel", art: "hikaye_a_ocak" },
    m("Soğuk Ocak bir ocak değil. Taşlarla çevrili, mavi bir ışık."),
    m("Yaklaştıkça avuçlarımdaki sıcaklık çekiliyor. Nefesim donup yere düşüyor."),
    soz("kayhan", "Demek mutfaktaki yamak sendin."),
    soz("kayhan", "Bu ocak dört şehri ısıtıyor, çocuk. Kapatırsan kim donar, biliyor musun?"),
    soz("anne", "Kimse donmayacak. Isı geldiği yere dönecek."),
    soz("anne", "Ben formülü bozarım. Sen onu oyala."),
  ] },

  /** Ocak susar, buzlar damlar; Kayhan'ın son sözleri; annem kalır, TOPRAK; bölüm sonu. */
  a_ocak: { id: "a_ocak", beats: [
    { t: "ses", layers: [{ id: "kar", vol: 0.3 }] },
    { t: "gorsel", art: "hikaye_a_ocak" },
    m("Mavi ışık titredi. Çatladı. Sustu."),
    { t: "ses", layers: [] },
    { t: "bekle", ms: 1000 },
    m("Bir ses duydum. Tıp. Sonra bir tane daha.", true),
    m("Kalenin buzları damlıyor. On iki yıldır ilk kez."),
    soz("kayhan", "Ben yalnızca taşıyıcıyım. Taşları Vezir Sungur alır."),
    soz("kayhan", "On iki yıl önce Ardıç'ı yakan da onun ocağıydı."),
    { t: "ses", layers: [{ id: "ruzgar", vol: 0.2 }] },
    { t: "gorsel", art: "hikaye_a_anne" },
    soz("anne", "Ben burada kalacağım. Bu kalenin insanları bir kışı daha ocaksız geçiremez."),
    soz("anne", "Sana toprağı vereyim. Toprak sabırlıdır; ısıyı derinde saklar."),
    m("Defterime yeni bir sayfa eklendi: TOPRAK."),
    soz("anne", "Bir şey daha. Karaçam hanındaki kadın… Ona sırtını dönme."),
    { t: "gorsel", art: null },
    { t: "baslik", text: "Bölüm 3 sona erdi", sub: "Sırada: Ardıç" },
  ] },

  /* ================= Bölüm 4: Ardıç ================= */

  /** Varış: is kokan başkent, yanık duvardaki adlar, sarayın üstünde titreyen hava. */
  d_varis: { id: "d_varis", beats: [
    { t: "gorsel", art: null },
    { t: "baslik", text: "Bölüm 4", sub: "Ardıç" },
    { t: "ses", layers: [{ id: "ruzgar", vol: 0.4 }, { id: "carsi", vol: 0.25 }] },
    { t: "gorsel", art: "yer_ardic" },
    m("Ardıç'ın kapısında iki muhafız. Yüzüme baktılar, yüküme baktılar, geçirdiler."),
    { t: "gorsel", art: "hikaye_d_varis" },
    m("Şehir is kokuyor. On iki yıl geçmiş; koku gitmemiş."),
    { t: "incele", prompt: "Yanık şehrin üstüne yenisi kurulmuş.", spots: [
      { x: 0.62, y: 0.22, label: "Saray", text: "Sarayın kubbeleri. Bacalarından duman çıkmıyor; ama üstünde hava titriyor, sıcak gibi." },
      { x: 0.16, y: 0.6, label: "Duvar", text: "Yanık bir duvara kazınmış adlar. Asılan Ölçerler. Her adın yanında küçük bir terazi." },
      { x: 0.5, y: 0.78, label: "Kül", text: "Çocuklar küllerin arasında oynuyor. Küller hâlâ ılık." },
    ] },
    m("Kral yıllardır görülmemiş. Şehri Vezir Sungur yönetiyor."),
    m("Kül mahallesinde yaşlı bir kadın, Ölçerlerin çocuklarını soruyormuş."),
  ] },

  /** Kül Ana: o gecenin anlatısı (geçmişe bakış, inceleme); ŞİMŞEK sayfası; gece bir saz. */
  d_kul: { id: "d_kul", beats: [
    { t: "ses", layers: [{ id: "ruzgar", vol: 0.3 }] },
    { t: "gorsel", art: "yer_ardic_kul" },
    m("Yıkıntıların arasında yaşlı bir kadın ateş yakmış."),
    soz("kulana", "Ölçer çocuğu. Gözlerin annene benziyor. Gel, otur."),
    soz("kulana", "Sana o geceyi anlatayım."),
    { t: "ses", layers: [{ id: "ruzgar", vol: 0.55 }] },
    { t: "gorsel", art: "hikaye_d_kul" },
    soz("kulana", "O gece gökten şimşek inmedi."),
    soz("kulana", "Toprak yarıldı. Sarayın altından mavi bir ışık çıktı. Sonra her şey tutuştu."),
    { t: "incele", prompt: "Kül Ana anlatırken o geceyi görür gibi oldum.", spots: [
      { x: 0.3, y: 0.42, label: "Ağaç", text: "Şehre adını veren ardıç. Kökünden yanıyor; ateş yukarıdan değil, aşağıdan gelmiş." },
      { x: 0.62, y: 0.62, label: "Koşanlar", text: "Ellerinde kovalar, yangına doğru koşanlar. Ölçerler. Kaçmıyorlar; söndürmeye gidiyorlar." },
    ] },
    soz("kulana", "Ölçerler yangını söndürmeye koştu. Sungur onları kundakçı diye astırdı."),
    { t: "ses", layers: [{ id: "ruzgar", vol: 0.3 }] },
    { t: "gorsel", art: "yer_ardic_kul" },
    soz("kulana", "Annen bu sayfayı bana bıraktı. \"Çocuğum gelirse ver,\" dedi."),
    anne("Şimşek en kolay yolu seçer: suyu, metali, ıslak teni."),
    m("Defterime yeni bir sayfa eklendi: ŞİMŞEK."),
    { t: "bekle", ms: 900 },
    m("O gece Kül mahallesinde bir saz çaldı."),
    m("Bu ezgiyi Karaçam'da, bir han kapısında duymuştum.", true),
  ] },

  /** Yüzleşme: arabaları Yaren işaretledi; kızı Sungur'un elinde. Avlunun yolunu gösterir. */
  yaren: { id: "yaren", beats: [
    { t: "ses", layers: [{ id: "gece", vol: 0.45 }, { id: "ruzgar", vol: 0.2 }] },
    { t: "gorsel", art: "yer_ardic_kul", gece: true },
    m("Sesi takip ettim. Yıkık bir evin eşiğinde bir kadın oturuyor."),
    m("Saz kucağında. Parmaklarında tebeşir tozu."),
    soz("sen", "Yaren."),
    soz("yaren", "Karaçam'dan buraya kadar geldin demek."),
    soz("sen", "Arabaları sen işaretledin. Mektupları sen yazdın."),
    m("Uzun süre sustu. Bir tel titredi, sustu."),
    soz("yaren", "Kızım saray mutfağında. Sungur'un elinde. Yedi yaşındaydı aldıklarında."),
    soz("yaren", "Her ay üç araba, bir mektup. Karşılığında bir tutam saç; yaşadığını bileyim diye."),
    m("Avucunu açtı. İçinde saç telleri, iple bağlanmış. Ay ay."),
    soz("yaren", "Bu ay gelmedi."),
    { t: "bekle", ms: 900 },
    soz("yaren", "Saray avlusundan dehlize bir kapı iner. Mutfağın yanından geçer. Yolu gösteririm."),
    soz("yaren", "Ama muhafızların ne zaman değiştiğini bilmeden girme. Saray kâtibinin yeğeni çizelgeyi satar. Ucuz değil."),
    soz("yaren", "Kızımı bulursan…"),
    m("Cümlesini bitirmedi. Ben de sormadım."),
  ] },

  /** Saray avlusu, savaştan önce (bir kez): damlardan; mutfağın ışığı yanık. */
  saray_once: { id: "saray_once", beats: [
    { t: "ses", layers: [{ id: "gece", vol: 0.35 }, { id: "ruzgar", vol: 0.3 }] },
    { t: "gorsel", art: "yer_ardic_saray", gece: true },
    m("Kül Ana'nın torunları damlarda önümden koştu. Ayakları kiremitlere hiç ses etmiyor."),
    m("Avlunun ortasında muhafızlar. Sağda mutfağın kapısı; ışığı yanık."),
    soz("sen", "Önce muhafızlar."),
  ] },

  /** Avlu: mutfakta Yaren'in kızı; dehlizin ağzı (inceleme): kırağı ama sıcak hava, içe eğilen alevler. */
  d_saray: { id: "d_saray", beats: [
    { t: "ses", layers: [{ id: "gece", vol: 0.3 }] },
    { t: "gorsel", art: "yer_ardic_saray", gece: true },
    m("Muhafızlar düştü. Mutfağın kapısını açtım."),
    m("Kazanların arasında bir kız çocuğu. Elleri una bulanmış, parmakları mor."),
    soz("sen", "Annen seni bekliyor. Saz çalan bir kadın."),
    m("Cevap vermedi. Saçının ucundan bir tutam kesilmişti."),
    m("Onu Kül Ana'nın torunlarına verdim. Damlardan, annesine."),
    { t: "ses", layers: [{ id: "ruzgar", vol: 0.45 }] },
    { t: "gorsel", art: "hikaye_d_saray" },
    m("Avlunun dibinde, nöbetçilerin bile bakmadığı bir kapı."),
    { t: "incele", prompt: "Dehlizin ağzı.", spots: [
      { x: 0.24, y: 0.45, label: "Kırağı", text: "Taşlarda kırağı var. Ama yüzüme vuran hava sıcak." },
      { x: 0.88, y: 0.55, label: "Meşale", text: "Meşalenin alevi içeri doğru eğiliyor. Selim'in mumu gibi." },
      { x: 0.5, y: 0.5, label: "Karanlık", text: "İçeriden derin bir uğultu. Bütün ülkenin ısısı buraya akıyor." },
    ] },
    m("Taşpınar'ın kırağısı, Karaçam'ın karı, Ayazkale'nin buzu.", true),
    m("Hepsinin ısısı buraya gelmiş."),
  ] },

  /** Büyük Ocak, savaştan önce (bir kez): Sungur mottoyu kendine çevirir. */
  buyuk_once: { id: "buyuk_once", beats: [
    { t: "ses", layers: [{ id: "ruzgar", vol: 0.5 }, { id: "kar", vol: 0.2 }] },
    { t: "gorsel", art: "yer_ardic_dehliz" },
    m("Dehlizin dibinde Büyük Ocak. Mavi bir girdap; ortası kor gibi yanıyor."),
    m("Başında uzun kaftanlı bir adam. Avuçları ocağa uzanmış, buz mavisi."),
    soz("sungur", "Ölçerin çocuğu. Annen de bir zamanlar buraya kadar gelmişti."),
    soz("sungur", "Bilir misin? Sönen her ateş, başka bir ocakta yanar."),
    soz("sungur", "Benimkinde."),
    soz("sen", "O ısı senin değil."),
    soz("sungur", "Isı kimin ki? Toplayanın olur."),
    { t: "bekle", ms: 800 },
  ] },

  /** Bahar: ocak dağılır; ılık yağmur; herkesin evine dönen ısı; defterin son satırı. Son. */
  d_bahar: { id: "d_bahar", beats: [
    { t: "ses", layers: [{ id: "ruzgar", vol: 0.35 }] },
    { t: "gorsel", art: "yer_ardic_dehliz" },
    m("Ocak çatladı."),
    m("Isı patlamadı. Dağıldı. Bir nefes gibi, dehlizden yukarı.", true),
    { t: "ses", layers: [] },
    { t: "gorsel", art: null },
    { t: "bekle", ms: 1200 },
    { t: "ses", layers: [{ id: "dere", vol: 0.45 }, { id: "koyun", vol: 0.25 }] },
    { t: "gorsel", art: "hikaye_d_bahar" },
    m("Dışarı çıktığımda Ardıç'ın üstüne ılık bir yağmur yağıyordu."),
    m("Kuzeyde Ayazkale'nin buzları akıyor. Annem pencereyi açmıştır."),
    m("Karaçam'da, bir han kapısında, bir kız annesinin sazını akort ediyor."),
    m("Taşpınar'da kayısılar çiçek açtı. Hasan sürüyü yaylaya çıkardı; kuzu eksilmedi."),
    { t: "incele", prompt: "Yolun kenarında.", spots: [
      { x: 0.82, y: 0.45, label: "Çiçek", text: "Kayaların arasında bir çiçek. Karın içinden çıkmış." },
    ] },
    m("Annemin defterinin son boş sayfasına ben yazdım:"),
    m("\"Sönen her ateş, başka bir ocakta yanar. Ve bir gün evine döner.\"", true),
    { t: "gorsel", art: null },
    { t: "baslik", text: "Son", sub: "Defterin açık kalıyor" },
  ] },

  /* ================= Selim'in defteri: ticaretin yan hikâyesi ================= */

  /** Selim'in dersi: ucuz al, pahalı sat; ilk araba. */
  selim_ders: { id: "selim_ders", beats: [
    { t: "ses", layers: [{ id: "carsi", vol: 0.6 }] },
    { t: "gorsel", art: "hikaye_k_selim" },
    soz("selim", "Annen sana ısıyı öğretmiş. Ben de sana parayı öğreteyim; ikisi aynı kurala bakar."),
    soz("selim", "Bir yerde bol olan şey ucuzdur. Az olduğu yere götürürsen değerlenir."),
    m("Peynir Taşpınar'da ucuz, Karaçam'da pahalı. Kumaş tam tersi."),
    soz("selim", "Al şu arabayı. Tekeri gıcırdar ama yolu bilir."),
    m("Bir araba. Benim arabam.", true),
    soz("selim", "Bir şey daha: yükü tek başına yollama. Haydudun gözü korumasız arabadadır."),
  ] },

  /** İlk yük: kârla dönen ilk kervan; izci öğüdü. */
  selim_ilk_yuk: { id: "selim_ilk_yuk", beats: [
    { t: "ses", layers: [{ id: "carsi", vol: 0.7 }] },
    { t: "gorsel", art: "yer_karacam" },
    m("İlk kervanım kârla döndü. Avucumda bakırlar; sayıyorum, yeniden sayıyorum."),
    soz("selim", "Gördün mü? Isı gibi: bir yerde birikir, bir yerde eksilir."),
    soz("selim", "Ama yol her zaman sakin geçmez. Bir izci bul. Gözü olmayan kervan kördür."),
  ] },

  /** Kayıp kervan: Selim'in izcisiz kervanı soyulur; tekerlekte yine tebeşir. */
  kayip_kervan: { id: "kayip_kervan", beats: [
    { t: "ses", layers: [{ id: "ruzgar", vol: 0.4 }, { id: "carsi", vol: 0.2 }] },
    { t: "gorsel", art: "yer_karacam_han" },
    m("Selim'in kendi kervanı dönmedi. İki gün sonra arabalar boş geldi."),
    { t: "incele", prompt: "Boş arabalar hanın avlusunda.", spots: [
      { x: 0.88, y: 0.86, label: "Tekerlek", text: "Tekerleğin iç yüzünde tebeşirle çizilmiş küçük bir çarpı. Yine." },
      { x: 0.4, y: 0.62, label: "Sürücü", text: "Sürücü kapının dibinde oturmuş. İzci tutmamışlar; ucuz olsun diye." },
    ] },
    soz("selim", "Tek başına tüccar haydudun lokmasıdır."),
    soz("selim", "Loncaya gir. Lonca kervanına kimse kolay dokunmaz; loncadan mal alan da ucuza alır."),
    soz("selim", "Aidat yüz bakır. Kâtip deponun başında oturur."),
  ] },

  /** Lonca kapısı: annenin adının yazıldığı deftere adın yazılır. */
  lonca_kapisi: { id: "lonca_kapisi", beats: [
    { t: "ses", layers: [{ id: "carsi", vol: 0.3 }] },
    { t: "gorsel", art: "yer_karacam_lonca" },
    m("Isı Loncası'nın defterine adımı yazdılar."),
    m("Annemin adının yazıldığı deftere."),
    m("Kâtip mührü bastı. Kar tanesi değil; terazi.", true),
    soz("selim", "Artık pazarlık senin lehine. Bir de… kendi hanını düşün. Kervanların bir yerde dinlenmeli."),
  ] },

  /** Kendi kervansarayın: ticaret hikâyesinin sonu. */
  kervansaray: { id: "kervansaray", beats: [
    { t: "ses", layers: [{ id: "carsi", vol: 0.5 }] },
    { t: "gorsel", art: "yer_karacam_han" },
    m("Karaçam'ın doğu kapısında eski bir kervansaray. Artık benim."),
    m("Arabalarım avluda dinleniyor. Korumalarım sıcak çorba içiyor."),
    soz("selim", "Annen ısının bir yere toplandığını söylerdi. Para da öyle."),
    soz("selim", "Ama sen onu tutmadın; yola çıkardın. Haydutlar artık bu kapının kimin olduğunu biliyor."),
  ] },
};

/** Konuşanın görünen adı ve portresi: "sen" oyuncudur. */
export const SPEAKERS: Record<string, { name: string; portrait?: string }> = {
  sen: { name: "Ben" },
  hasan: { name: "Hasan", portrait: "portre_hasan" },
  ayse: { name: "Muhtar Ayşe", portrait: "portre_ayse" },
  zehra: { name: "Şifacı Zehra", portrait: "portre_zehra" },
  yaren: { name: "Hancı Yaren", portrait: "portre_yaren" },
  selim: { name: "Tüccar Selim", portrait: "portre_selim" },
  derya: { name: "Usta Derya", portrait: "portre_derya" },
  gulizar: { name: "Aşçı Gülizar", portrait: "portre_gulizar" },
  anne: { name: "Annem", portrait: "portre_anne" },
  kayhan: { name: "Kayhan Bey" },
  kulana: { name: "Kül Ana", portrait: "portre_kulana" },
  sungur: { name: "Vezir Sungur" },
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
