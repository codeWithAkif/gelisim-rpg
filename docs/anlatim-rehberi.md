# Anlatım rehberi

Gezgin Defteri hikâye anlatan bir oyun. Büyük anlar pencereyle değil **sahne** olarak anlatılır:
karanlık zemin, üstte ve altta sinema şeritleri, yavaşça yakınlaşan çizim, satır satır beliren yazı,
sahnenin kendi sesi. Bölüm 1 bu rehbere göre yazıldı; diğer bölümler de aynı sesle yazılmalı.

## Ses ve üslup

- **Birinci tekil şahıs.** Anlatıcı oyuncunun kendisi: "Dağdan iniyorum." Annenin cümleleri onun el yazısıyla (ayrı biçim).
- **Kısa cümle.** Bir satır, telefonda en çok iki satır olmalı. Uzun bir düşünceyi iki satıra böl.
- **Göster, anlatma.** "Korktum" yerine "Hasan sabaha kadar fenerini söndürmedi."
- **Her sahne bir soru bırakır.** Hasan'ın sahnesi "Kurt böyle avlanmaz" ve "Mevsimlerden yazdı, kapıda kırağı vardı" ile biter. Cevap hemen verilmez.
- **Gizem dozu.** Açılışta ne olduğunu değil, *bir şeylerin yanlış olduğunu* söyle. Kötüyü, sebebi, annenin yerini erken açıklama.
- **Konuşmalar doğal ve yöresel, ama okunur.** Hasan kısa konuşur, köy dilinde; ağız taklidi yapılmaz.
- **Mottoya dokun, tekrarlama.** "Sönen her ateş, başka bir ocakta yanar." Bölümler bu cümleye ancak büyük anlarda döner (açılış, final). Arada ima et: "Evler ısınmıyor", "kapıda kırağı".

## Tempo

- **İlk on dakika:** oyuncu bir şey *görür* (sis, fener), bir şey *yapar* (çanın sesini izler), bir soruyla ayrılır.
- **Arka arkaya pencere yok.** Sahne bittiğinde oyuncu oyuna döner. Sistem tanıtımları (pazar, Diyar) ilgili oldukları anda gelir.
- **Ödül emeğe denk.** İlk macera tek bir savaş olmamalı: iz → hazırlık → karşılaşma. Büyük ödül (ev, rütbe) bölümün ortasından önce gelmez.
- **Sahne uzunluğu:** 8–20 satır. Daha uzunsa ikiye böl ya da arada oynanan bir an koy.

## Sahne nasıl yazılır

Sahneler `src/content/scenes.ts` içinde saf veridir. Her sahne bir dizi "vuruş":

| Vuruş | Ne yapar |
|---|---|
| `{ t: "gorsel", art: "hikaye_varis" }` | Arka planı değiştirir (`null` = karanlık). Görsel `src/assets/art/` içinde olmalı. |
| `{ t: "ses", layers: [{ id: "ruzgar", vol: 0.4 }] }` | Sahnenin ortam sesi (`src/assets/ses/ortam_<id>.ogg`). |
| `m("…")` | Anlatıcının satırı. `m("…", true)` ortalı. |
| `anne("…")` | Annenin el yazısı, ortalı. |
| `soz("hasan", "…")` | Konuşma. Konuşan `SPEAKERS` içinde tanımlı olmalı (ad ve portre). `"sen"` oyuncudur. |
| `{ t: "bekle", ms: 900 }` | Sessiz bir an. |
| `{ t: "ad" }` | Oyuncunun adını sorar. Metinde `{ad}` yerine ad konur. |
| `{ t: "sis" }` | Oynanan an: sesin geldiği yana dokunarak ilerle (sisin içinde çan). `{ t: "sis", tur: "damla" }` karanlık sarnıçta su sesi. Yeni oynanan anlar `scene-view.ts`'e eklenir. |
| `{ t: "gorsel", art: "yer_yayla", gece: true }` | Görseli gece gibi karartır (aynı yerin gece hâli için yeni çizim gerekmez). |
| `{ t: "tek", id: "harabe_uluma", vol: 0.8 }` | Tek seferlik ses: uluma, uzaktan kurtlar. Dosya `src/assets/ses/` içinde. |
| `{ t: "incele", prompt: "…", spots: [{ x, y, label, text }] }` | Oyuncu görselin üstünde parlayan yerlere dokunarak inceler; hepsi bulununca sahne sürer. Gizemi oyuncunun kendisi bulsun. |
| `{ t: "baslik", text: "Bölüm 1", sub: "Kıvılcım" }` | Bölüm kartı: büyük el yazısı, görsel kararır. Bölümün ilk ve son sahnesinde. |

Bir hikâye sayfasını (`src/content/story.ts` içindeki kilometre taşı) sahneye bağlamak için ona
`scene: "<sahne kimliği>"` ekle. O sayfa açıldığında "Yeni sayfa" penceresi yerine sahne oynar.
Sahnede bir işe söz veriliyorsa (`"Yarın gece orada bekleyelim"`) `accept: "<iş>"` ile o iş kendiliğinden üstlenilir.
Ana hikâyenin işlerine (`src/content/world.ts`) `story: true` ver: "Ana görev" diye görünür, ödül penceresi araya girmez.
Gece geçen işlere `night: true` ver: gündüz başlanırsa akşam beklenir.
Savaştan önce bir kez oynanacak bir an için işe `before: "<sahne kimliği>"` ver (Kurt avı → `pusu`, Kervan yolu → `kervan_once`).
Bir iş bitince ödül penceresi yerine sahne oynasın istiyorsan işe `scene: "<sahne kimliği>"` ver (örnek: Kurtların izi → `karaca`).

## Bölüm 1 örneği

Açılış → sis → Hasan → **Muhtara haber** (Ayşe sahnesi) → **Ağılda nöbet** (gece, inceleme: donmuş kuzu) →
Hasan pusuyu öğretir → **Kurt avı** (savaş) → kaçan kurt, kuzeyden uluma, "Kovalanıyorlar" → Ayşe: annenin izi.
Her adım bir soru bırakır; rütbe ve ev ancak annenin izi bulununca gelir.

Sonrası: Zehra (annenin ATEŞ yaprağı) → ilk kıvılcım → ateş ve kurt (Hasan gördü) → yan hikâye: donmuş karaca,
Akyele → annenin mektubu ("Kuzeyde değil, aramızda.") → "Bölüm 1 sona erdi" kartı. Bölüm 1'in bütün sayfaları sahnedir;
`tests/scenes.test.ts` bunu denetler. Diğer bölümler de aynı kuralla yazılmalı.

## Bölüm 2 örneği

"Bölüm 2 · Karaçam" kartı → varış (inceleme: yazın ortasında kar, kürkler, ışık sızan sepetler) → Hancı Yaren →
**Kor taşları** (Selim'in dükkânı; inceleme: taş ısı çekiyor, mum alevi taşa eğiliyor, kar tanesi mührü) →
**İşaretli arabalar** (gece, inceleme: tebeşir çarpı, izler hana giriyor, balkonda biri) →
**Kervan yolu** (önce `kervan_once`: işaretli arabanın içinde bekleyiş, ıslıklar; sonra savaş) →
haydudun notu, Selim annesini anlatır → **Sarnıçtaki ses** (karanlıkta su sesini izle, Usta Derya, SU) →
**Loncanın defteri** → kayıtları annem tutmuş, en altta başka bir el: "Ölçer L." → "Bölüm 2 sona erdi" kartı.

## Bölüm 3 örneği

**Kar geçidi** (önce `gecit_once`: "Bölüm 3 · Ayazkale" kartı, donmuş kervan; tekerlekte aynı tebeşir çarpı, uluma;
sonra savaş) → geçidin tepesi: aşağı akan soğuk, tüten tek baca → **Kalenin mutfağı** (yamak; inceleme: ocağın başında
kırağı, kuleden sızan soğuk, yarısı yanmış mektup ve saz çizimi) → **Gizli merdiven** (gece, inceleme: duvarlarda annenin
formülleri, çentikler) → **Kuledeki kadın** (önce `kule_once`: yukarıdan tanıdık ezgi) → Annem: önce tanımaz, sonra
defteri görür; AYAZ → **Soğuk Ocak** (önce `ocak_once`: Kayhan ocağın başında) → buzlar damlar, Kayhan Sungur'u söyler,
annem kalır, TOPRAK → "Bölüm 3 sona erdi" kartı.

## Bölüm 4 örneği (final)

"Bölüm 4 · Ardıç" kartı → varış (inceleme: sarayın üstünde titreyen hava, asılan Ölçerlerin adları, ılık küller) →
**Kül mahallesi** (Kül Ana o geceyi anlatır; geçmişe bakış incelemesi: ardıç kökünden yanıyor, Ölçerler yangına koşuyor;
ŞİMŞEK) → **Sazın sesi** (gece) → Yaren'le yüzleşme → **Saray yolu** (önce `saray_once`: damlardan; sonra savaş) →
Yaren'in kızı mutfakta; dehlizin ağzı (inceleme: kırağı ama sıcak hava, içe eğilen meşale) → **Büyük Ocak** (önce
`buyuk_once`: Sungur mottoyu kendine çevirir, "Benimkinde.") → bahar: ısı dağılır, herkesin evine döner; defterin son
satırı → "Son · Defterin açık kalıyor".

Bölüm 2'de açılan iz burada kapanır: arabaları Hancı Yaren işaretledi; kızı yedi yaşından beri Sungur'un elindeydi.
Her ay bir tutam saç; o ay gelmemişti. Kötü değil, çaresiz: oyuncu onu cezalandırmaz, kızını kurtarır.

## Kontrol listesi

- [ ] Her satır telefonda en çok iki satır.
- [ ] Sahne bir görselle ve bir sesle başlıyor.
- [ ] Sahne bir soruyla ya da bir işle bitiyor.
- [ ] Yeni konuşan `SPEAKERS`'a eklendi; portresi varsa `portre_<id>.webp`.
- [ ] `npm test` geçiyor (`tests/scenes.test.ts` görsel, ses ve konuşanları denetler).
- [ ] Telefonda baştan sona oynandı; "Geç" düğmesiyle de denendi.
