# Oyun modları: hangisi neden var?

Gezgin Defteri'nin vaadi tek cümle: **koştukça daha hızlı koşarsın.** Güç karakterin vücudundan ve
bilgisinden gelir; ayrı puan, kart ya da kalıcı güçlenme ağacı yoktur. Bir mod bu vaatle çelişiyorsa
değiştirilir ya da kaldırılır.

## Çekirdek döngü

Günü planla → bir şey yap (çalış / keşfet / savaş) → uyu ve geliş → hikâyede ilerle.

## Karar ölçütü

Her mod için üç soru:

1. **Gelişimi besliyor mu?** Sonucu karakterin vücudu ve bilgisi mi belirliyor, yoksa modun kendi puanı mı?
2. **Hikâyeye bağlı mı?** Bir görev ya da bölüm onu gerektiriyor mu?
3. **Kendine özgü mü?** Yoksa başka bir modun tekrarı mı?

## Kararlar

| Mod | Karar | Durum |
|---|---|---|
| Plan + altıgen savaş | Tut, çekirdek | Değişmedi. Zayıf noktalar, rüzgâr, ışık ve anatomi burada. |
| Gizlenme | Tut | Değişmedi. Algısal özellikleri (koku, işitme) anlamlı kılan yer. |
| Barikat (kuşatma) | Tut | Ağıl gecesi, Hanın gecesi, Mutfak kapısı. Tekrarlandıkça zorlaşır (aşağıda). |
| Nöbet | Geri geldi, değişti | Sonsuz dalga ve nöbet içi güçlenmeler (kırıntı, yükseltme, kart) geri geldi; hepsi yalnız o nöbet için. "Nöbet izi" ve kalıcı güçlenmeler yok. Kalan: rekor, beşer dalgada kese, karakterin gerçek kullanımla gelişimi. |
| Harabe | Dönüştürüldü | Arama içi kartlar kaldırıldı; her etki bir özellikten gelir (aşağıda). |
| Savaş içi jestler | Tut | Değişmedi. |
| Odak mini oyunları | Tut, isteğe bağlı | En iyi oyunla verim ×1,5 (önceden ×2); oynamamak cezalandırılmaz. |
| Etrafa bak | Tut | Değişmedi. |
| Diyar | Küçültüldü | Sekme "Köy dostu" rütbesinde açılır. İşletme ve görev panosu Bölüm 2'de (Karaçam'a varış) gelir. |
| Finans (ortaklık) | Ertelendi | Ortaklıklar Karaçam'a varınca açılır. Pazarda satış her zaman açık. |
| Evcil hayvan | Tut, küçük | Köpek ve şahin yetenekleri kuşatmada işler. |

## Harabeler: kolaydan zora, tükenen sandıklar

Bir yerde birden çok harabe olabilir (`src/engine/scavenge.ts` içindeki `SCAV_SITES`). Korudaki dört harabe:

| Harabe | Zorluk | Kat · oda | Bekçi | Baskın | Açılış |
|---|---|---|---|---|---|
| Yıkık avcı kulübesi | Kolay | 1 · 3 | 2 | 1 | Kurt derdi |
| Terk edilmiş ağıl | Orta | 2 · 4 | 4 | 2 | Kurt derdi |
| Eski korucu kulesi | Zor | 3 · 5 (kilitli odalar) | 6 | 3 | Kurtların izi |
| Yanık beyler köşkü | Çok zor | 4 · 7 (kilitli odalar) | 9 | 4 | Sürünün başı |

- **Bekçiler uyur.** Biri seni fark ederse (yaklaşınca ya da vurulunca) ötekileri çağırır: kurtlar ulur, insanlar ıslık çalar. Baskın sayacı ancak o an başlar; fark edilmezsen baskın gelmez.
- **Baskın sayısı sınırlı** ve harabeye göre büyür; sonuncusu "Son baskın" diye duyurulur.
- **Tükenen sandık.** Yerleşim her kayıtta sabittir; boşaltılan sandık boş, açılan kapı açık kalır, öldürülen bekçi dönmez (`s.harabe`). Aynı harabeden sürekli ödül alınamaz.
- **Ölünce** çanta düştüğün yerde kalır; geri dönüp alabilirsin.
- Ödül harabenin zorluğuyla artar (daha çok sandık, kilitli odalar, daha değerli eşya).

## Tekrar eden savunmalar (eski nöbet)

`src/engine/siege.ts` içindeki `escalate(def, kez)`: aynı gece görevini kaçıncı kez kazandığına göre

- her tekrarda düşman sayısı %20 artar, dalga aralığı kısalır,
- 2. tekrardan sonra bir dalga eklenir,
- 3. tekrardan sonra son dalgaya bir lider katılır (Ağıl: Akyele, Han ve Mutfak: muhafız),
- 4 tekrarda tavan yapar.

Oyuncunun gücü yalnızca karakterden gelir; tekrar yalnızca düşmanı artırır.
Nöbet kulesi görselleri (`kule_*.webp`) sonsuz nöbetin giriş penceresinde.

## Sonsuz nöbet (geri geldi)

"Ne kadar dayanacaksın" oyunu: dört kule (yayla, han, Ayazkale suru, Kül mahallesi damı), sonsuz ve gittikçe zorlaşan
dalgalar, her beşinci dalgada bir lider ve bir kese. Kırıntıyla hasar, atış hızı, can, yenilenme ve menzil yükseltilir;
defter sayfası dolunca üç karttan biri seçilir. **Bunların hepsi o nöbetle biter.** İlk çıkarılış sebebi (ayrı para birimi
ve kalıcı güçlenme ağacının gelişim sistemiyle yarışması) böylece ortadan kalktı. Büyü burada da çizilir; çizerken ve
hedefe dokunana kadar zaman durur.

Uzun dayanmanın karşılığı (güç değil, gelişim, bilgi, ün ve para):
- Gelişim dalgayla azalan hızla büyür (atış karşılığı 5. dalgada 60, 20.de 120, 30.da ~147); okçuluk 5/20/30 dalgada ≈ +2,8 / +5,5 / +6,7.
- Her beşinci dalganın lideri, o düşmanın açılmamış bir zayıf noktasını Gözlemler'e yazdırır.
- Bir kulede ilk kez 10, 20, 30. dalgayı geçmek o bölgede tanınırlık ve güven verir (bir kez).
- Kese dalgayla belirgin büyür (yaylada 30 dalga ≈ 100 bakır; handa iki katı).

## Harabe: hangi özellik neyi değiştirir

`src/engine/scavenge.ts` içindeki `scavTraits`. 10 başlangıç seviyesidir, her 30 puan bir basamaktır (en çok 3).

| Etki | Özellik | Basamak başına |
|---|---|---|
| Yürüyüş hızı | Bacak kası, esneklik | +%12 |
| Tırmanma hızı | Kavrama gücü, esneklik | +%12 |
| Arama süresi | El becerisi, analiz | ×0,75 |
| Yakın dövüş vuruşu | Kılıç ustalığı, üst gövde | +%15 |
| Harabedeki can | Ağrı toleransı, gövde | +%15 |
| Çanta | Kuşandığın çanta | gözü kadar (en az 8) |
| Sadak | Okçuluk | +6 ok (12'den başlar) |
| İlk baskına kalan süre | İşitme, çevresel farkındalık | +10 sn (40'tan başlar) |
| Büyü dolumu | Nefes kapasitesi | ×0,8 |
| Büyü gücü | Mana | +%30 |
| Üst üste büyü | Odak | 1,5 basamakta 2, 2,5 basamakta 3 |

Harabe giriş ekranındaki "Vücudun burada ne yapar?" bölümü bu tabloyu oyuncuya gösterir.

## Bekleme ritmi

Karar: **başlat, bırak, bildirimle dön.** Çalışma başlayınca ekran "Arka plana al" ile kapanır; üst şeritte
kalan süre görünür. Bu arada Defter, Vücut, Çanta ve Harita'ya bakılabilir; bir şey yapmak (yola çıkmak,
savaşmak, uyumak, yemek) çalışmanın bitmesini bekler. Uygulama kapalıyken de süre işler, bitince bildirim gelir.
Odak turları isteğe bağlı bir ikramdır: en çok ×1,5.

## Ölçer işi (prototip)

Annenin büyüsü "dua değil hesap": `src/engine/olcer.ts`. Küçük bir ısı ağında her hamle bir birim ısıyı
yolla bağlı komşuya taşır; **toplam ısı hiç değişmez**. Bazı yerlerin ısısı ölçülmeden görünmez; ölçmeden
boş bir yerden taşımaya kalkan hamlesini boşa harcar. "Soğuk çeken taş" her iki hamlede bir en sıcak
komşusundan ısı alır: ısı kaybolmaz, bir yere toplanır (Soğuk Ocak'ın küçük bir habercisi).

- Yer: köy meydanı, annenin defterinden ilk sayfa öğrenilince ("Annemin işi" tanıtımı).
- Üç iş: Donmuş pınar (5 hamle), Ağılın gecesi (6), Soğuk çeken taş (9). Her biri temel karakterle tam
  bütçede çözülür, bir eksikle çözülmez (testte çözücüyle kanıtlı).
- Karakter: odak her 20 puanda +1 hamle, analiz her 15 puanda +1 ölçüm.
- Kazanç: analiz, odak, mana, ateş; ilk çözümde Taşpınar'da güven +1.

Sonraki adım (karar bekliyor): bu kural savaşa ve Soğuk Ocak bölümüne taşınacak mı, mevcut büyü kartlarının yerine mi geçecek?

## Dondurma kuralı (kaldırıldı)

Yeni mod eklenmez kuralı iki bilinçli istisnayla kaldırıldı: kervan ticareti (finans ve adamlar) ve büyü sentezi.
Tasarım: `docs/finans-ve-buyu.md`. Kalıcı güçlenme ya da kart sistemi yine eklenmez; güç karakterden ve bilgisinden gelir.
