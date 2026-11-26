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
  side?: boolean;                    // yan hikâye: bölümün bitmesini beklemez
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
      { id: "ates_kurt", title: "Ateş ve kurt", hint: "Bir savaşı büyü kullanarak kazan (Defter → Görevler: Meraya devriye).", reached: s => (s.story.flags.buyuluZafer ?? 0) > 0,
        effects: { flag: "zaferGun" },
        text: "Kurtlar ateşi görünce dağıldı. Hasan uzaktan bakıp bir dua mırıldandı. Köyde biri yasak bir şey gördüğünü fısıldıyor." },
      { id: "suru_basi", side: true, title: "Sürünün başı", hint: "Kurtların neden çoğaldığını bul: Hasan'ın 'Kurtlar nereden geliyor?' işi.", reached: s => done(s, "akyele"),
        text: "Akyele düştü, sürü dağıldı. Ama donmuş karacayı unutamıyorsun: kuzeyde bir şey ısıyı çekiyor, ve annenin defterindeki kor taşı şimdi senin cebinde." },
      { id: "mektup", title: "Annenin mektubu", hint: "Bir gece dinlen; Zehra seni bekliyor.", reached: s => has(s, "ates_kurt") && s.day > (s.story.flags.zaferGun ?? 1e9),
        text: "Zehra annenin bıraktığı mühürlü mektubu sana verdi: \"Isıyı çeken biri var. Kuzeyde değil, aramızda. Karaçam'daki tüccar Selim'e git; kimin için çalıştığını o bilir.\" Bölüm 1 burada bitiyor." },
    ],
  },
  {
    id: "b2", title: "Bölüm 2: Karaçam", place: "Tüccar şehri",
    milestones: [
      { id: "k_varis", title: "Karaçam", hint: "Annenin mektubu seni Karaçam'a çağırıyor. Harita'dan demirhanenin doğusundaki yola çık.", reached: s => !!s.story.flags.v_karacam,
        text: "Surlu şehrin kapısından girerken nefesin buğulandı; yazın ortasında herkes kürk giymiş. Çarşıda kehribar renginde taşlar satılıyor; yanlarından geçince elin ısınıyor. Han kapısında bir kadın sazını akort ediyor: Hancı Yaren." },
      { id: "k_muhur", title: "Kar tanesi mührü", hint: "Hancı Yaren'den Selim'i sor (Defter → Görevler).", reached: s => done(s, "selim_dukkan"),
        text: "Kor taşları ısıyı tutuyor, ama bir yerden alıyor. Her birinin altında Ayazkale'nin kar tanesi mührü var. Selim annenin adını duyunca sustu; bir şey biliyor." },
      { id: "k_selim", title: "Selim'in sözü", hint: "Selim'in kervanını haydutlara karşı koru.", reached: s => done(s, "kervan"),
        text: "Haydutlar dolu arabaları seçiyordu, çünkü biri onlara söylüyordu. Selim artık sana güveniyor: annen on iki yıl önce buradaydı, taşların ısıyı yerden çaldığını ilk o anladı." },
      { id: "k_derya", title: "Su", hint: "Eski sarnıca in; suyun sesini takip et.", reached: s => done(s, "sarnic"),
        effects: { learnElement: "el_su" },
        text: "Usta Derya, annenin defterine SU sayfasını ekledi: \"Su ısıyı emer, taşır ve geri verir.\" Artık Su çalışabilirsin; ateşle birleşince buhar olur." },
      { id: "k_defter", title: "Annem yaşıyor", hint: "Derya'nın işi: Isı Loncası'nın deposundan kayıt defterini al.", reached: s => done(s, "lonca_defteri"),
        text: "\"Ölçer L. — Soğuk Ocak'ta çalıştırılıyor.\" On iki yıl boyunca öldüğünü sandığın annen kuzeyde, Ayazkale'de tutsak. Kar geçidinin yolu açıldı (yayladan kuzeye). Bölüm 2 burada bitiyor." },
    ],
  },
  {
    id: "b3", title: "Bölüm 3: Ayazkale", place: "Kayhan Bey'in kalesi",
    milestones: [
      { id: "a_gecit", title: "Kar geçidi", hint: "Derya'nın işi: yayladan kuzeye, Kar geçidine çık ve kar kurtlarını aş.", reached: s => done(s, "gecit"),
        text: "Geçidin tepesinden Ayazkale göründü: buza gömülü surlar, ortasında mavi bir soğuk sızdıran kule. Donmuş kervanların arabaları kor taşıyla dolu." },
      { id: "a_iceride", title: "Kalenin içinde", hint: "Kale mutfağında Aşçı Gülizar'ın güvenini kazan.", reached: s => done(s, "mutfak"),
        text: "Bir aşçı yamağına kimse bakmaz. Gülizar sana kulenin gizli kapısını gösterecek; kardeşini geçitte Kayhan'ın soğuğu öldürmüş." },
      { id: "a_anne", title: "Annem", hint: "Kuleye çık; annenin yanındaki muhafızları geç.", reached: s => done(s, "kule"),
        effects: { learnElement: "el_ayaz" },
        text: "On iki yıl sonra annenin elini tuttun. Soğuktu. \"Ayaz bir madde değil,\" dedi, \"ısının yokluğu.\" Defterine AYAZ sayfası eklendi. Ama asıl kötü haber sonra geldi: Kayhan sadece taşıyıcı." },
      { id: "a_ocak", title: "Soğuk Ocak", hint: "Annenin işi: Kayhan Bey'i ocağın başında durdur.", reached: s => done(s, "soguk_ocak"),
        effects: { learnElement: "el_toprak" },
        text: "Soğuk Ocak sustu; Ayazkale'nin buzları ilk kez damladı. Annen kalıp kalenin insanlarına bakacak; sana TOPRAK sayfasını verdi: \"Toprak sabırlıdır, ısıyı derinde saklar.\" Kayhan'ın son sözleri seni güneye, başkente çağırıyor. Bölüm 3 burada bitiyor." },
    ],
  },
  {
    id: "b4", title: "Bölüm 4: Ardıç", place: "Başkent",
    milestones: [
      { id: "d_varis", title: "Ardıç", hint: "Dere kenarından güneye, başkent Ardıç'a git.", reached: s => !!s.story.flags.v_ardic,
        text: "On iki yıl önce yanan şehrin üstüne yenisi kurulmuş, ama sokaklar hâlâ is kokuyor. Her köşede Vezir Sungur'un muhafızları. Kral yıllardır görülmemiş." },
      { id: "d_kul", title: "O gece", hint: "Kül mahallesinde Kül Ana'yı bul.", reached: s => done(s, "kul_ana"),
        effects: { learnElement: "el_simsek" },
        text: "Kül Yangını gökten gelmedi; sarayın altından, Sungur'un ilk ocağından çıktı. Ölçerler yangını söndürmeye koştu ve kundakçı diye asıldı. Kül Ana sana annenin son sayfasını verdi: ŞİMŞEK." },
      { id: "d_saray", title: "Dehlizin ağzı", hint: "Kül Ana'nın işi: saray avlusundaki muhafızları geç.", reached: s => done(s, "saray_yolu"),
        text: "Avlunun dibinde dehlizin kapısı. Duvarlarda kırağı var, ama hava sıcak: bütün ülkenin ısısı buraya akıyor." },
      { id: "d_bahar", title: "Bahar", hint: "Büyük Ocak'ı kır.", reached: s => done(s, "buyuk_ocak"),
        effects: { learnElement: "el_hava" },
        text: "Ocak kırıldığında ısı patlamadı; dağıldı. Ardıç'a ılık bir yağmur yağdı, Ayazkale'nin buzları çözüldü, Taşpınar'da kayısılar çiçek açtı. Annenin defterinin son boş sayfasına sen yazdın: \"Isı kaybolmaz. Bir yere gider. Ve geri döner.\" SON. (Defterin açık kalıyor: dolaşmaya, öğrenmeye devam edebilirsin.)" },
    ],
  },
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
