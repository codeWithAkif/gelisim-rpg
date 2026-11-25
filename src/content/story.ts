// Ana hikâye: açılış sayfaları, bölümler ve kilometre taşları.
//
// Özet (oyuncuya parça parça açılır):
// Annen bir Ölçer'di: büyüyü dua değil hesap olarak gören, ateşin ve suyun kurallarını ölçen
// bir loncanın üyesi. On iki yıl önce başkent Ardıç bir gecede yandı (Kül Yangını); kral suçu
// Ölçerlere yükledi, büyüyü yasakladı. Annen o gece kayboldu. O günden beri kışlar uzuyor.
// Annenin defterindeki son cümle: "Isı kaybolmaz. Bir yere gider."
// Gerçek: biri ülkenin ısısını çekip bir yerde topluyor. Kül Yangını, bu ısının bir anda
// başkente boşaldığı bir deneyin sonucuydu. Oyuncu köylüden krala doğru tanınırlık kazanarak
// ısının nereye gittiğini ve annesine ne olduğunu bulur.
//
// Bölümler tanınırlık basamaklarını izler: köy → tüccar şehri → lordun kalesi → başkent.
import type { GameState } from "../engine/state";

export interface IntroPage { art: "defter" | "yangin" | "kar" | "yol"; title: string; text: string }
export const INTRO: IntroPage[] = [
  { art: "defter", title: "Annemin defteri", text: "Annem bir Ölçer'di. Ateşin neden yandığını, suyun neden donduğunu ölçer, bu deftere yazardı. Büyü onun için dua değil, hesaptı." },
  { art: "yangin", title: "Kül Yangını", text: "On iki yıl önce başkent Ardıç bir gecede yandı. Kral suçu Ölçerlere yükledi. Defterleri yakıldı, büyü yasaklandı. Annem o gece ortadan kayboldu." },
  { art: "kar", title: "Uzayan kışlar", text: "O günden beri her kış bir öncekinden uzun. Kuzeyde göller yazın bile çözülmüyor. Annemin defterinin son yazılı sayfasında tek bir cümle var: \"Isı kaybolmaz. Bir yere gider.\"" },
  { art: "yol", title: "Taşpınar yolu", text: "Defterin gerisi boş. Elimde bir çoban değneği, cebimde altı bakır var. Annemin son mektubu Taşpınar'dan gönderilmişti. Dağ yolundan vadiye iniyorum." },
];

export interface Milestone {
  id: string; title: string;
  hint: string;                      // henüz ulaşılmadıysa oyuncuya ipucu
  reached: (s: GameState) => boolean;
  text: string;                      // ulaşınca açılan sayfa
  effects?: { learnElement?: string; items?: Record<string, number>; flag?: string };
}
export interface Chapter { id: string; title: string; place: string; milestones: Milestone[]; soon?: boolean }

const done = (s: GameState, q: string) => (s.quests[q]?.count ?? 0) > 0 || s.quests[q]?.status === "bitti";
const has = (s: GameState, m: string) => s.story.reached.includes(m);

export const CHAPTERS: Chapter[] = [
  {
    id: "b1", title: "Bölüm 1: Kıvılcım", place: "Taşpınar",
    milestones: [
      { id: "varis", title: "Taşpınar'a varış", hint: "", reached: s => s.introDone,
        text: "Dağ yolu bir yaylaya çıkıyor. Yaşlı bir çoban sürüsünü topluyor; gözleri yorgun, geceleri uyumadığı belli. Adı Hasan. Aşağıda vadide Taşpınar köyü görünüyor." },
      { id: "ilk_is", title: "İlk iş", hint: "Hasan'dan işi al, sonra Harita'dan köy meydanına in ve muhtara haber ver.", reached: s => done(s, "mesaj"),
        text: "Muhtar Ayşe haberi dinledi, sonra uzun uzun yüzüne baktı. \"Seni bir yerden tanıyor gibiyim,\" dedi. Sonra vazgeçti." },
      { id: "suru", title: "Sürünün bekçisi", hint: "Hasan'ın sürüsüne dadanan kurtları uzaklaştır.", reached: s => done(s, "kurt"),
        text: "Köyde adın anılmaya başladı. Muhtar Ayşe seni çağırttı: \"On iki yıl önce buraya bir kadın geldi. Bir defteri vardı; seninkine benziyordu. Şifacı Zehra'ya bir şey bıraktı.\"" },
      { id: "iz", title: "Annenin izi", hint: "Muhtardan işi al; Zehra'nın evi yaylaya çıkan patikada.", reached: s => done(s, "annenin_izi"),
        effects: { learnElement: "el_ates" },
        text: "Zehra eski bir sandığı açtı. İçinde annenin elinden çıkmış tek bir yaprak: ATEŞ. \"Isı, maddenin titreşimidir. Titreşimi tek noktada topla; nefesin yakıtındır.\" Defterine yeni bir sayfa eklendi. Artık Ateş çalışabilirsin (Çalış)." },
      { id: "kivilcim", title: "İlk kıvılcım", hint: "Ateş çalışmasıyla Ateş büyüsünü 5'e çıkar.", reached: s => (s.attrs.ates?.level ?? 0) >= 5,
        text: "Avucunda bir an için gerçek bir alev durdu. Nefesin titredi, alev de titredi. Ateş topu artık savaşta kullanılabilir." },
      { id: "ates_kurt", title: "Ateş ve kurt", hint: "Bir savaşı büyü kullanarak kazan (İşler → Meraya devriye).", reached: s => (s.story.flags.buyuluZafer ?? 0) > 0,
        effects: { flag: "zaferGun" },
        text: "Kurtlar ateşi görünce dağıldı. Hasan uzaktan bakıp bir dua mırıldandı. Köyde biri yasak bir şey gördüğünü fısıldıyor." },
      { id: "suru_basi", title: "Sürünün başı", hint: "Kurtların neden çoğaldığını bul: Hasan'ın 'Kurtlar nereden geliyor?' işi.", reached: s => done(s, "akyele"),
        text: "Akyele düştü, sürü dağıldı. Ama donmuş karacayı unutamıyorsun: kuzeyde bir şey ısıyı çekiyor, ve annenin defterindeki kor taşı şimdi senin cebinde." },
      { id: "mektup", title: "Annenin mektubu", hint: "Bir gece dinlen; Zehra seni bekliyor.", reached: s => has(s, "ates_kurt") && s.day > (s.story.flags.zaferGun ?? 1e9),
        text: "Zehra annenin bıraktığı mühürlü mektubu sana verdi: \"Isıyı çeken biri var. Kuzeyde değil, aramızda. Karaçam'daki tüccar Selim'e git; kimin için çalıştığını o bilir.\" Bölüm 1 burada bitiyor." },
    ],
  },
  { id: "b2", title: "Bölüm 2: Karaçam", place: "Tüccar şehri", soon: true, milestones: [] },
  { id: "b3", title: "Bölüm 3: Ayazkale", place: "Lordun kalesi", soon: true, milestones: [] },
  { id: "b4", title: "Bölüm 4: Ardıç", place: "Başkent", soon: true, milestones: [] },
];

/** Element sayfaları: annenin defterinden açılan notlar. */
export const ELEMENT_PAGES: Record<string, string> = {
  el_ates: "Isı, maddenin titreşimidir. Titreşimi tek noktada topla; nefesin yakıtındır. Ateş havasız yanmaz, suda boğulur. Kuru otu sever.",
  el_su: "Su ısıyı emer, akar ve iletir. Ateşi söndürür, şimşeği taşır.",
  el_toprak: "Toprak ağırdır ve sabırlıdır. Sıkıştırırsan taş olur.",
  el_hava: "Hava basınç farkıyla hareket eder. Önce kendi nefesini yönet.",
  el_ayaz: "Ayaz bir madde değil: ısının yokluğu. Isıyı bir yerden çekersen başka yere gider.",
  el_simsek: "Şimşek en kolay yolu seçer: suyu, metali, ıslak teni.",
};
