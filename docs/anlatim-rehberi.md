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
| `{ t: "sis" }` | Oynanan an (çanın sesini izleme). Yeni oynanan anlar `scene-view.ts`'e eklenir. |

Bir hikâye sayfasını (`src/content/story.ts` içindeki kilometre taşı) sahneye bağlamak için ona
`scene: "<sahne kimliği>"` ekle. O sayfa açıldığında "Yeni sayfa" penceresi yerine sahne oynar.

## Kontrol listesi

- [ ] Her satır telefonda en çok iki satır.
- [ ] Sahne bir görselle ve bir sesle başlıyor.
- [ ] Sahne bir soruyla ya da bir işle bitiyor.
- [ ] Yeni konuşan `SPEAKERS`'a eklendi; portresi varsa `portre_<id>.webp`.
- [ ] `npm test` geçiyor (`tests/scenes.test.ts` görsel, ses ve konuşanları denetler).
- [ ] Telefonda baştan sona oynandı; "Geç" düğmesiyle de denendi.
