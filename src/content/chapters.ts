// Bölüm 2–4 içeriği: yerler, yollar, kişiler, düşmanlar, savaş haritaları, görevler ve hikâye sayfaları.
// Ana hikâye: Annem bir Ölçer'di. On iki yıl önce başkent Ardıç bir gecede yandı ve suç Ölçerlere yüklendi.
// O günden beri kışlar uzuyor. "Sönen her ateş, başka bir ocakta yanar." Kimin ocağında?
//  B2 Karaçam: kor taşları ticareti → taşlar Ayazkale'den geliyor → annem yaşıyor, Soğuk Ocak'ta tutsak.
//  B3 Ayazkale: Kayhan Bey'in Soğuk Ocak'ı toprağın ısısını taşa çekiyor → annemi kurtar → asıl ocak Ardıç'ın altında.
//  B4 Ardıç: Vezir Sungur'un Büyük Ocak'ı; Kül Yangını onun ilk denemesiydi → ocağı kır, ısı geri döner, bahar gelir.
import type { Place, Road } from "./map";
import type { Npc, QuestDef, BattleMap, EnemyDef, WeakPoint } from "./world";

/* ---------- yerler ---------- */
// Şehir içi yerler ana şehrin çevresinde kümelenir; ülke ölçeğinde yalnız "merkez" (hub) görünür.
export const CHAPTER_PLACES: Place[] = [
  { id: "karacam", name: "Karaçam çarşısı", x: 796, y: 864, region: "karacam", hub: true, unlock: "mektup", icon: "sehir", chapter: "Bölüm 2", desc: "Surlu tüccar şehri. Çarşıda baharat, deri ve kehribar renginde taşlar satılıyor; herkes kalın kürk giymiş." },
  { id: "karacam_han", name: "Kervan hanı", x: 772, y: 884, region: "karacam", unlock: "mektup", icon: "ev", desc: "Kapısı hiç kapanmayan bir han. Hancı Yaren her yolcunun hikâyesini bilir." },
  { id: "karacam_sarnic", name: "Eski sarnıç", x: 818, y: 886, region: "karacam", unlock: "mektup", icon: "dere", desc: "Şehrin altında, artık kullanılmayan taş kemerli bir su deposu. Kimse inmez; inenler de konuşmaz." },
  { id: "karacam_lonca", name: "Isı Loncası deposu", x: 824, y: 842, region: "karacam", unlock: "mektup", icon: "ocak", desc: "Muhafızların beklediği büyük bir ambar. Kapısında kar tanesi mührü." },

  { id: "ayaz_gecit", name: "Kar geçidi", x: 560, y: 410, region: "ayazkale", unlock: "k_defter", icon: "dag", desc: "Kuzeye çıkan tek yol. Yazın ortasında bile diz boyu kar; donmuş kervanlar yol kenarında duruyor." },
  { id: "ayazkale", name: "Ayazkale kapısı", x: 606, y: 314, region: "ayazkale", hub: true, unlock: "k_defter", icon: "kale", chapter: "Bölüm 3", desc: "Buzla kaplı surlar. Kapıdan içeri girmek için bir sebebin olmalı." },
  { id: "ayaz_mutfak", name: "Kale mutfağı", x: 632, y: 330, region: "ayazkale", unlock: "k_defter", icon: "ocak", desc: "Kalede tek sıcak yer. Aşçı Gülizar her şeyi görür, az konuşur." },
  { id: "ayaz_kule", name: "Soğuk Ocak kulesi", x: 588, y: 292, region: "ayazkale", unlock: "a_iceride", icon: "kale", desc: "Kalenin ortasındaki kule. Dibinden mavi bir soğuk sızıyor; duvarlarına dokunan eli yapışıyor." },

  { id: "ardic", name: "Ardıç kapısı", x: 370, y: 1099, region: "ardic", hub: true, unlock: "a_ocak", icon: "sehir", chapter: "Bölüm 4", desc: "Yanık surların yerine yenileri örülmüş. Başkent küllerinin üstüne kurulmuş, ama sokaklar hâlâ is kokuyor." },
  { id: "ardic_kul", name: "Kül mahallesi", x: 340, y: 1078, region: "ardic", unlock: "a_ocak", icon: "ev", desc: "Yangından kalan yıkıntıların arasında yaşayanlar. Burada Ölçer adı fısıltıyla anılır." },
  { id: "ardic_saray", name: "Saray avlusu", x: 400, y: 1080, region: "ardic", unlock: "a_ocak", icon: "kale", desc: "Vezir Sungur'un muhafızları her köşede. Kral yıllardır görülmedi." },
  { id: "ardic_dehliz", name: "Ocak dehlizi", x: 384, y: 1124, region: "ardic", unlock: "d_saray", icon: "ocak", desc: "Sarayın altına inen dehliz. Taşları buz gibi, ama derinden bir uğultu geliyor." },
];

const at = (id: string): [number, number] => { const p = CHAPTER_PLACES.find(q => q.id === id)!; return [p.x, p.y]; };
const short = (a: string, b: string): Road => ({ a, b, kind: "yol", pts: [at(a), [(at(a)[0] + at(b)[0]) / 2, (at(a)[1] + at(b)[1]) / 2 + 4], at(b)] });
export const CHAPTER_ROADS: Road[] = [
  short("karacam", "karacam_han"), short("karacam", "karacam_sarnic"), short("karacam", "karacam_lonca"),
  short("ayaz_gecit", "ayazkale"), short("ayazkale", "ayaz_mutfak"), short("ayaz_mutfak", "ayaz_kule"),
  short("ardic", "ardic_kul"), short("ardic", "ardic_saray"), short("ardic_saray", "ardic_dehliz"),
];

/* ---------- kişiler ---------- */
export const CHAPTER_NPCS: Npc[] = [
  { id: "yaren", name: "Hancı Yaren", role: "Hancı", region: "karacam", giver: "koylu", teaches: ["muzik"], fee: 4, minRep: 3, note: "Sazıyla yolcuların dilini çözer. Herkesin borcunu, herkesin sırrını bilir." },
  { id: "selim", name: "Tüccar Selim", role: "Kor taşı tüccarı", region: "karacam", giver: "tuccar", teaches: ["hitabet_ders"], fee: 6, minRep: 8, note: "Pazarlığı sever, soruyu sevmez. Dükkânı şehrin en sıcak yeri." },
  { id: "derya", name: "Usta Derya", role: "Saklanan Ölçer", region: "karacam", giver: "lonca", teaches: ["satranc"], fee: 5, minRep: 6, note: "Annenin eski yol arkadaşı. On iki yıldır sarnıçta, suyun sesini dinleyerek yaşıyor." },
  { id: "gulizar", name: "Aşçı Gülizar", role: "Kale aşçısı", region: "ayazkale", giver: "koylu", note: "Kayhan Bey'in mutfağını yirmi yıldır çeviriyor. Kardeşi geçitte donarak öldü." },
  { id: "leyla", name: "Ölçer Leyla", role: "Annen", region: "ayazkale", giver: "lonca", note: "On iki yıl Soğuk Ocak'a zincirli kaldı. Defterinin kalan sayfaları onun aklında." },
  { id: "kulana", name: "Kül Ana", role: "Yıkıntıların sesi", region: "ardic", giver: "muhtar", teaches: ["anatomi"], fee: 3, minRep: 4, note: "Yangın gecesi üç torununu kaybetti. Ölçerleri suçlamayan tek kişi." },
];
export const CHAPTER_NPC_PLACE: Record<string, string> = { yaren: "karacam_han", selim: "karacam", derya: "karacam_sarnic", gulizar: "ayaz_mutfak", leyla: "ayaz_kule", kulana: "ardic_kul" };

/* ---------- düşmanlar ---------- */
// İnsan zayıf noktaları anatomi_insan ile açılır; resim dersi (anatomi_insan) ve Kül Ana'nın dersi işe yarar.
const HUMAN_WEAK: WeakPoint[] = [
  { id: "diz", name: "Diz", need: { anatomi_insan: 3 }, critBonus: 8, effect: "slow", at: [0.5, 0.82], artAt: [0.5, 0.74] },
  { id: "bilek", name: "Silah bileği", need: { anatomi_insan: 6, analiz: 12 }, critBonus: 6, at: [0.3, 0.5], artAt: [0.16, 0.44] },
  { id: "boyun", name: "Boyun", need: { anatomi_insan: 10, analiz: 15 }, critBonus: 14, at: [0.55, 0.22], artAt: [0.56, 0.2] },
];
const HUMAN = { species: "insan" as const, weakPoints: HUMAN_WEAK, anatomyOf: "insan" };
export const CHAPTER_ENEMIES: Record<string, EnemyDef> = {
  haydut: { id: "haydut", name: "Haydut", ...HUMAN, hp: 18, damage: [3, 6], move: 3, evasion: 14, accuracy: 58, armor: 1, tint: "hue-rotate(160deg) saturate(.7) brightness(.85)",
    words: { one: "haydut", pl: "haydutlar", rest: "kampta uyukluyor", hunt: "nöbette, tetikte", den: "kampa" },
    desc: "Kervan yolunun soyguncuları. Kor taşı taşıyan arabaları seçiyorlar; biri onlara hangisinin dolu olduğunu söylüyor." },
  muhafiz: { id: "muhafiz", name: "Muhafız", ...HUMAN, hp: 24, damage: [3, 7], move: 3, evasion: 12, accuracy: 62, armor: 3, tint: "hue-rotate(200deg) saturate(.5) brightness(.75)",
    words: { one: "muhafız", pl: "muhafızlar", rest: "nöbet yerinde uyukluyor", hunt: "meşalelerle dolaşıyor", den: "nöbet yerine" },
    desc: "Zırhlı, düzenli, yorgun. Para için çalışıyorlar; kaybedecekleri bir şey görürlerse kaçarlar." },
  kar_kurdu: { id: "kar_kurdu", name: "Kar kurdu", species: "hayvan", hp: 26, damage: [4, 7], move: 4, evasion: 18, accuracy: 62, armor: 1, anatomyOf: "kurt", weakPoints: [], tint: "brightness(1.5) saturate(.15)",
    words: { one: "kar kurdu", pl: "kar kurtları", rest: "karın içinde yatıyor", hunt: "açlıktan çıldırmış", den: "ine" },
    desc: "Kuzeyin beyaz kurdu. Soğuk onları da aşağı itiyor; geçitte donan her şeyi yiyorlar." },
  kayhan: { id: "kayhan", name: "Kayhan Bey", ...HUMAN, hp: 46, damage: [5, 9], move: 3, evasion: 16, accuracy: 68, armor: 4, scale: 1.15, tint: "hue-rotate(190deg) saturate(.4) brightness(1.2)",
    words: { one: "Kayhan Bey", pl: "Kayhan Bey'in adamları", rest: "ocağın başında", hunt: "seni bekliyor", den: "ocağa" },
    desc: "Ayazkale'nin beyi. Kılıcı buz gibi; elleri hiç ısınmıyor. Soğuk Ocak'ın taşlarıyla zenginleşti." },
  sungur: { id: "sungur", name: "Vezir Sungur", ...HUMAN, hp: 56, damage: [5, 10], move: 3, evasion: 18, accuracy: 70, armor: 3, scale: 1.15, tint: "hue-rotate(250deg) saturate(.6) brightness(.9)",
    words: { one: "Vezir Sungur", pl: "Sungur'un muhafızları", rest: "ocağın başında", hunt: "seni bekliyor", den: "ocağa" },
    desc: "Kralın gölgesi. Kül Yangını'nı o başlattı, suçu Ölçerlere o yükledi. Isıyı toplayıp ölümsüz olmak istiyor." },
};
// kurt zayıf noktaları kar kurduna da geçer (aynı anatomi)

/* ---------- savaş haritaları ---------- */
// . çayır  , uzun ot  ~ çamur  ^ kaya/duvar/sandık  T yüksek zemin  = su  * ağaç  k kar
export const CHAPTER_MAPS: Record<string, BattleMap> = {
  kervan_yolu: {
    name: "Kervan yolu",
    rows: ["*,..,**", ",,.^.,*", ".,...,.", "..~~..^", ".,..,.^", "^,.TT..", "..,..,*", "*..,..*"],
    starts: [
      { name: "Arabaların yanı", at: [3, 6], note: "Kervanın yanında; haydutlar arabaya gelirken önüne çıkarsın." },
      { name: "Doğu tümseği", at: [4, 5], note: "Yüksek zemin. Yolu yukarıdan görürsün." },
    ],
    enemies: [[2, 1], [5, 2]], flock: [3, 6],
  },
  depo: {
    name: "Lonca deposu",
    rows: ["^^^^^^^", "^..^..^", "^.,..,^", "^^..^.^", "^..,..^", "^.^..^^", "^.....^", "^^^.^^^"],
    starts: [
      { name: "Arka kapı", at: [3, 7], note: "Dar kapı; içeri sessizce girersin ama geri çekilecek yer yok." },
      { name: "Çatı penceresi", at: [5, 4], note: "Sandıkların arasına inersin; muhafızlara yakın ama gizli." },
    ],
    enemies: [[2, 1], [5, 1]], flock: [3, 2],
  },
  gecit: {
    name: "Kar geçidi",
    rows: ["^kk^kk^", "kk.kk^k", "k^kkk.k", "kk.^kkk", "k.kk.k^", "^kk.kkk", "kk.kk^k", "^k.k.kk"],
    starts: [
      { name: "Patika", at: [3, 7], note: "Karı ezilmiş patika; yürümek kolay ama her yerden görünürsün." },
      { name: "Kaya siperi", at: [5, 5], note: "Kayaların dibi; rüzgâr kesik, kokun az gider." },
    ],
    enemies: [[2, 1], [5, 2]], flock: [3, 1],
  },
  kule: {
    name: "Soğuk Ocak kulesi",
    rows: ["^^k^k^^", "^k...k^", "k..T..k", "^.~.~.^", "k.....k", "^k.^.k^", "^.....^", "^^^.^^^"],
    starts: [
      { name: "Merdiven başı", at: [3, 7], note: "Dar merdivenden çıkarsın; ocağın soğuğu yüzüne vurur." },
      { name: "Mutfak geçidi", at: [1, 6], note: "Gülizar'ın gösterdiği gizli kapı; muhafızlar seni beklemiyor." },
    ],
    enemies: [[3, 2], [1, 3], [5, 3]], flock: [3, 2],
  },
  sokak: {
    name: "Saray sokağı",
    rows: ["^^.^.^^", "^.,..,^", "..^..^.", ".,...,.", "^..^..^", ".,...,.", "^.^.^.^", "^..,..^"],
    starts: [
      { name: "Kül mahallesi ağzı", at: [3, 7], note: "Yıkıntıların arasından; arkan güvenli, önün açık." },
      { name: "Damlar", at: [6, 5], note: "Yıkık damların üstünden; muhafızları yukarıdan görürsün." },
    ],
    enemies: [[2, 1], [4, 1], [3, 2]], flock: [3, 0],
  },
  dehliz: {
    name: "Büyük Ocak",
    rows: ["^^^.^^^", "^k.T.k^", "^.~.~.^", "k.....k", "^.^.^.^", "k..,..k", "^.....^", "^^^.^^^"],
    starts: [
      { name: "Dehliz ağzı", at: [3, 7], note: "Uğultunun içine dosdoğru yürürsün." },
      { name: "Yan galeri", at: [1, 5], note: "Kül Ana'nın torunlarının açtığı dar galeri; Sungur seni geç fark eder." },
    ],
    enemies: [[3, 1], [1, 3], [5, 3]], flock: [3, 1],
  },
};

/* ---------- görevler ---------- */
export const CHAPTER_QUESTS: QuestDef[] = [
  // Bölüm 2: Karaçam
  { id: "selim_dukkan", after: "k_varis", title: "Kor taşları", giverNpc: "yaren", importance: "basit", story: true, minutes: 30, at: "karacam", doneText: "Selim'le konuş",
    text: "Hancı Yaren güldü: \"Selim'i mi arıyorsun? Çarşıdaki en sıcak dükkân onunki. Ama dikkat et, sorulardan hoşlanmaz.\"",
    rewards: { money: 2, gains: { insan_okuma: 1, hitabet: 0.6 }, note: "Selim sana bir şey söylemedi, ama yüzü çok şey söyledi." },
    afterText: "Selim annenin adını duyunca durdu, sonra güldü: \"Tanımam.\" Tezgâhta kehribar renginde taşlar duruyor; ellerin onlara yaklaşınca ısınıyor. Her birinin altında aynı mühür: bir kar tanesi. Ayazkale'nin mührü." },
  { id: "isaretli_arabalar", after: "k_muhur", title: "İşaretli arabalar", giverNpc: "selim", importance: "onemli", story: true, night: true, minutes: 90, at: "karacam_han", doneText: "Avluyu kolla",
    text: "Selim: \"Haydutlar hangi arabanın dolu olduğunu nereden biliyor?\" Gece hanın avlusunda, yola çıkacak arabaların arasında bekle.",
    rewards: { gains: { gorus: 0.6, isitme: 0.6 }, note: "Gece boyunca avluyu kolladın; gözün karanlığa alıştı." } },
  { id: "kervan", after: "k_tebesir", title: "Kervan yolu", giverNpc: "selim", importance: "onemli", story: true, before: "kervan_once", minutes: 120, at: "karacam_han",
    text: "Selim işaretleri silmedi. \"Bırak gelsinler. Kervan bu gece çıkıyor; sen işaretli arabada ol.\"",
    battle: { enemies: ["haydut", "haydut"], map: "kervan_yolu" },
    rewards: { money: 12, items: { ok: 6 }, note: "Selim on iki bakır ve bir deste ok verdi; sözünü de tuttu." },
    afterText: "Haydutların heybesinde kor taşları ve bir not: \"Kuzeye, Kayhan Bey'in adamlarına.\" Selim notu okuyunca sesini alçalttı: \"Annen on iki yıl önce buraya geldi. Taşları ilk o tanıdı: 'Bunlar ısıyı yerden çalıyor.' Sonra kayboldu. Eski sarnıca in; Ölçerlerden biri orada saklanıyor.\"" },
  { id: "han_gecesi", after: "k_selim", title: "Hanın gecesi", giverNpc: "yaren", importance: "onemli", minutes: 150, repeatable: true, at: "karacam_han", siege: "han",
    text: "\"Selim'in kervanını korudun diye haydutlar hana diş biledi,\" diyor Yaren. \"Bu gece avluya girecekler. Avlunun ortasında dur, kapılara barikat çek.\"",
    rewards: { money: 14, items: { ok: 6 }, note: "Yaren on dört bakır ve bir deste ok verdi; hanın kapısı artık sana hep açık." } },
  { id: "sarnic", after: "k_selim", title: "Sarnıçtaki ses", giverNpc: "selim", importance: "onemli", story: true, minutes: 40, at: "karacam_sarnic", doneText: "Sarnıca in",
    text: "Şehrin altındaki eski sarnıca in. Selim, \"Suyun sesini takip et,\" dedi.",
    rewards: { money: 3, gains: { isitme: 1, odak: 0.8 }, note: "Karanlıkta suyun sesini takip etmek kulağını açtı." },
    afterText: "Sarnıcın dibinde, mumla aydınlanmış bir köşede yaşlı bir kadın: Usta Derya. Annenin defterini görünce ağladı. \"Su ısıyı emer, taşır ve geri verir. Annen bunu bana öğretti.\" Defterine yeni bir sayfa ekledi: SU." },
  { id: "lonca_defteri", after: "k_derya", title: "Loncanın defteri", giverNpc: "derya", importance: "hayati", story: true, minutes: 90, at: "karacam_lonca",
    text: "\"Isı Loncası her ay kuzeye boş taş yollar, dolu taş geri alır,\" diyor Derya. \"Kayıtlar depoda. Gece gir, defteri al. Muhafızlar var; hazırlanmadan gitme.\"",
    battle: { enemies: ["muhafiz", "muhafiz"], map: "depo" },
    rewards: { money: 10, items: { deri_zirh: 1 }, relics: ["olcer_muhuru"], note: "Depoda bir deri zırh ve annenin eski Ölçer mühürü." },
    afterText: "Defterin son sayfasında, titrek bir yazıyla: \"Ölçer L. — Soğuk Ocak'ta çalıştırılıyor. Kayhan Bey'in emriyle. Kaçarsa taş akışı durur.\" Annen yaşıyor. Ayazkale'de." },

  // Bölüm 3: Ayazkale
  { id: "gecit", after: "k_defter", title: "Kar geçidi", giverNpc: "derya", importance: "onemli", minutes: 120, at: "ayaz_gecit",
    text: "\"Ayazkale'ye tek yol geçitten geçer,\" diyor Derya. \"Kar kurtları donan kervanları yiyor; seni de yemeye kalkacaklar. Ateşin varsa yak.\"",
    battle: { enemies: ["kar_kurdu", "kar_kurdu"], map: "gecit" },
    rewards: { money: 4, gains: { kardiyo: 1, agri: 1 }, note: "Geçidi aştın. Soğuk ciğerlerine işledi ama seni güçlendirdi." },
    afterText: "Geçidin tepesinde Ayazkale göründü: buza gömülü surlar ve ortada mavi bir soğuk sızan kule. Yol kenarında donmuş bir kervan; arabaların hepsi kor taşıyla dolu." },
  { id: "mutfak", after: "a_gecit", title: "Kalenin mutfağı", giverNpc: "gulizar", importance: "onemli", minutes: 180, at: "ayaz_mutfak", doneText: "Mutfakta çalış",
    text: "Kapıdaki muhafız seni aşçı yamağı sandı. Gülizar sana bir önlük attı: \"Üç saat odun taşı, ocak yak, sus. Sonra konuşuruz.\"",
    rewards: { money: 2, items: { ekmek: 2, peynir: 1 }, gains: { ust_govde: 1, ates: 0.5, el_becerisi: 0.5 }, note: "Gülizar sana sıcak ekmek ve peynir verdi; kimse yamağa bakmıyor." },
    afterText: "Gülizar kapıyı kapadı: \"Kulede bir kadın var. On iki yıldır. Geceleri duvarlara formül yazıyor; muhafızlar siliyor, o yine yazıyor. Kardeşim geçitte dondu; Kayhan'ın ocağı yüzünden. Sana kulenin gizli kapısını göstereceğim.\"" },
  { id: "mutfak_kapisi", after: "a_iceride", title: "Mutfak kapısı", giverNpc: "gulizar", importance: "onemli", minutes: 150, repeatable: true, at: "ayaz_mutfak", siege: "mutfak",
    text: "\"Muhafızlar mutfakta yabancı olduğunu sezdi,\" diyor Gülizar. \"Kar kurtları da kokuya geliyor. Kapıları tut; dalga dalga gelecekler.\"",
    rewards: { money: 10, items: { ekmek: 2 }, gains: { stres: 1 }, note: "Gülizar sıcak ekmek ve on bakır verdi." } },
  { id: "kule", after: "a_iceride", title: "Kuledeki kadın", giverNpc: "gulizar", importance: "hayati", minutes: 90, at: "ayaz_kule",
    text: "Gizli kapı mutfaktan kuleye çıkıyor. Kulede üç muhafız var. Annen orada.",
    battle: { enemies: ["muhafiz", "muhafiz", "muhafiz"], map: "kule" },
    rewards: { money: 6, relics: ["annenin_kalemi"], note: "Annen zincirlerinden kurtuldu. Elindeki kalemi sana uzattı." },
    afterText: "Annen seni görünce önce tanımadı. Sonra defteri gördü. \"Ateşi buldun. Suyu da. Şimdi ayazı öğren: ayaz bir madde değil, ısının yokluğu. Isıyı bir yerden çekersen başka yere gider.\" Sonra fısıldadı: \"Kayhan sadece taşıyıcı. Asıl ocak Ardıç'ın altında.\"" },
  { id: "soguk_ocak", after: "a_anne", title: "Soğuk Ocak", giverNpc: "leyla", importance: "hayati", minutes: 120, at: "ayaz_kule",
    text: "\"Ocağı kapatmazsak kaçtığımızı anlarlar,\" diyor annen. \"Kayhan ocağın başında. Ben formülü bozarım; sen onu oyala.\"",
    battle: { enemies: ["kayhan", "muhafiz"], map: "kule" },
    rewards: { money: 25, items: { zincir_zirh: 1 }, relics: ["ayaz_cekirdegi"], note: "Kayhan'ın zincir zırhı ve ocağın donmuş çekirdeği." },
    afterText: "Kayhan dizlerinin üstüne çöktü; Soğuk Ocak çatlayarak sustu. Kalenin buzları ilk kez damladı. Kayhan'ın son sözleri: \"Ben sadece taşıyıcıyım. Taşları Vezir Sungur alır. On iki yıl önce Ardıç'ı yakan da onun ocağıydı.\"" },

  // Bölüm 4: Ardıç
  { id: "kul_ana", after: "a_ocak", title: "Kül mahallesi", giverNpc: "kulana", importance: "onemli", minutes: 60, at: "ardic_kul", doneText: "Kül Ana'yı dinle",
    text: "Yıkıntıların arasında yaşlı bir kadın ateş yakmış. \"Ölçer çocuğu,\" dedi seni görünce. \"Gel otur. Sana o geceyi anlatayım.\"",
    rewards: { money: 2, gains: { hafiza: 1, insan_okuma: 1 }, note: "Kül Ana'nın anlattıklarını defterine yazdın." },
    afterText: "\"O gece gökten şimşek inmedi,\" dedi Kül Ana. \"Toprak yarıldı, sarayın altından mavi bir ışık çıktı, sonra her şey tutuştu. Ölçerler yangını söndürmeye koştu; Sungur onları kundakçı diye astırdı.\" Elini defterine koydu: \"Annenin bana bıraktığı son sayfa bu.\" ŞİMŞEK." },
  { id: "saray_yolu", after: "d_kul", title: "Saray yolu", giverNpc: "kulana", importance: "hayati", minutes: 90, at: "ardic_saray",
    text: "\"Dehlize inmek için saray avlusunu geçmelisin,\" diyor Kül Ana. \"Torunlarım seni damlardan götürür; ama muhafızlarla karşılaşmadan olmaz.\"",
    battle: { enemies: ["muhafiz", "muhafiz", "muhafiz"], map: "sokak" },
    rewards: { money: 12, relics: ["kul_ana_muskasi"], note: "Kül Ana'nın torunları muhafızların anahtarını getirdi; Kül Ana boynuna bir muska taktı." },
    afterText: "Avlunun dibinde, nöbetçilerin bile bakmadığı bir kapı: dehlizin ağzı. İçeriden uğultu geliyor; duvarlarda kırağı, ama hava sıcak. Isı buraya akıyor." },
  { id: "buyuk_ocak", after: "d_saray", title: "Büyük Ocak", giverNpc: "kulana", importance: "hayati", minutes: 120, at: "ardic_dehliz",
    text: "Dehlizin dibinde Büyük Ocak: bütün ülkenin ısısını içine çeken mavi bir girdap. Başında Vezir Sungur. \"Sönen her ateş,\" diyor gülümseyerek, \"başka bir ocakta yanar. Benimkinde.\"",
    battle: { enemies: ["sungur", "muhafiz", "muhafiz"], map: "dehliz" },
    rewards: { money: 40, relics: ["buyuk_kor"], note: "Büyük Ocak kırıldı. Elinde, onun kalbinden kalan son kor." },
    afterText: "Ocak çatladığında içindeki ısı patlamadı; dağıldı. Dehlizden çıktığında Ardıç'ın üstüne ılık bir yağmur yağıyordu. Kuzeyde Ayazkale'nin buzları çözülüyor, Taşpınar'da kayısılar yeniden çiçek açacak. Ateş sönmemişti; yalnız evinden uzaktaydı. Şimdi döndü." },
];

/* ---------- kadim eşyalar (bölümler) ---------- */
export const CHAPTER_RELICS = {
  olcer_muhuru: { id: "olcer_muhuru", name: "Ölçer mühürü", source: "Isı Loncası deposu", desc: "Annenin adının baş harfi kazılı pirinç bir mühür. Elinde tutunca sesin daha emin çıkıyor; insanlar sana inanıyor.", boosts: { hitabet: 3, irade: 2, insan_okuma: 2 } },
  annenin_kalemi: { id: "annenin_kalemi", name: "Annenin kalemi", source: "Soğuk Ocak kulesi", desc: "On iki yıl duvarlara formül yazan kalem. Ucunda hâlâ kırağı var. Elinde düşüncelerin keskinleşiyor.", boosts: { odak: 3, hafiza: 3, analiz: 2, mana: 2 } },
  ayaz_cekirdegi: { id: "ayaz_cekirdegi", name: "Ayaz çekirdeği", source: "Soğuk Ocak", desc: "Ocağın donmuş kalbi. Avucunda erimiyor; ısıyı nasıl çektiğini sana gösteriyor.", boosts: { ayaz_buyu: 5, mana: 3, irade: 2 } },
  kul_ana_muskasi: { id: "kul_ana_muskasi", name: "Kül Ana'nın muskası", source: "Kül mahallesi", desc: "İçinde yangın gecesinden bir avuç kül. Takanı korkusuz yapar, derler.", boosts: { stres: 4, irade: 3, agri: 2 } },
  buyuk_kor: { id: "buyuk_kor", name: "Büyük Ocak'ın son koru", source: "Büyük Ocak", desc: "Ülkenin ısısını bir avuçta tutmanın ne demek olduğunu bilen tek kor. Ateşle, ayazla ve şimşekle aynı anda konuşuyor.", boosts: { ates: 5, ayaz_buyu: 3, simsek_buyu: 3, mana: 5 } },
};
