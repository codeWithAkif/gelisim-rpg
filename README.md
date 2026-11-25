# Gezgin Defteri

Gerçekçi gelişim sistemli, offline, dikey ekran bir mobil RPG.
Klasik level/XP yok: koştukça daha hızlı koşarsın, resim dersi aldıkça gözlemin keskinleşir,
anatomi bildikçe kritik vuruşların artar. Kaslar uykuda gelişir; aç uyursan yarım gelişir.
Arayüz, karakterin kendi defteri gibi çizilir.

## Hikâye

Annen bir Ölçer'di: büyüyü dua değil hesap olarak gören bir loncanın üyesi. On iki yıl önce başkent Ardıç
bir gecede yandı (Kül Yangını); kral suçu Ölçerlere yükledi, büyüyü yasakladı, annen kayboldu. O günden beri
kışlar uzuyor. Annenin defterindeki son cümle: "Isı kaybolmaz. Bir yere gider."
Köylüden krala doğru tanınarak ısının nereye gittiğini ve annene ne olduğunu bulursun.

Bölümler tanınırlık basamaklarını izler: Taşpınar (köy) → Karaçam (tüccar şehri) → Ayazkale (lordun kalesi) →
Ardıç (başkent). Kilometre taşları `src/content/story.ts` içinde.

## Telefona kurulum ve güncelleme

**İlk kurulum:** telefonda şu bağlantıyı aç, APK'yı indir ve kur (tarayıcıya "bilinmeyen kaynaklardan yükleme" izni vermen istenebilir):
https://github.com/codeWithAkif/gelisim-rpg/releases/latest/download/gezgin-defteri.apk

**Sonrası:** `main` dalına her gönderilen değişiklik GitHub Actions ile yeni bir sürüm olarak yayınlanır
(`.github/workflows/release.yml`). Uygulama açılırken son sürümü kontrol eder, yeni oyun paketini
indirip kendini günceller. Kayıt korunur. İnternet yoksa mevcut sürümle offline açılır.

Yalnız Android tarafı değiştiğinde (yeni Capacitor eklentisi vb.) `native-version.txt` içindeki sayı artırılır;
uygulama o zaman yeni APK'yı indirmeyi önerir.

**APK imzalama:** repo ayarlarında `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
`ANDROID_KEY_PASSWORD` secret'ları varsa APK kalıcı anahtarla imzalanır. Yoksa geçici anahtar kullanılır;
bu durumda yeni bir APK kurmak için eskisini kaldırmak gerekir (web güncellemeleri etkilenmez).

## Çalıştırma

```bash
npm install
npm run dev        # tarayıcıda http://localhost:5173 (telefon görünümünde aç)
npm test           # motor ve denge testleri
npm run build      # dist/ klasörüne üretim derlemesi
```

## Oyun verisini güncelleme (config editörü)

Özellikler, aktiviteler, büyüler, ortam etkenleri ve itibar tabloları config editöründe düzenlenir.
Editörde **Dışa aktar → oyun-config.json indir**, sonra:

```bash
node tools/editor-to-config.mjs ~/Downloads/oyun-config.json
```

Dosya `src/config/oyun-config.json` olarak yazılır. Eski kayıtlar yeni özellikleri otomatik alır.

## Android'e kurma

Bilgisayarında Android Studio kurulu olmalı.

```bash
npm run cap:sync          # derler ve android/ projesine kopyalar
npx cap open android      # Android Studio'da açar; oradan telefona Çalıştır (▶)
```

İnternet izni gerekmez; tüm veriler (fontlar dahil) uygulamanın içindedir. Kayıt cihazda tutulur.

## Yapı

| Klasör | İçerik |
|---|---|
| `src/engine/` | Arayüzden bağımsız oyun motoru: gelişim, türetilmiş değerler, savaş, görevler, kayıt |
| `src/content/world.ts` | Editörde henüz ekranı olmayan içerik: köy, kişiler, görevler, düşmanlar, haritalar |
| `src/config/oyun-config.json` | Config editöründen gelen veri |
| `src/ui/` | Defter görünümlü arayüz (DOM + SVG) ve savaş haritası (canvas) |
| `tools/` | Editör çıktısını oyuna alan dönüştürücü |
| `tests/` | Vitest testleri, denge koruması dahil |
