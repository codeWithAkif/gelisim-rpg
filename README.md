# Gezgin Defteri

Gerçekçi gelişim sistemli, offline, dikey ekran bir mobil RPG.
Klasik level/XP yok: koştukça daha hızlı koşarsın, resim dersi aldıkça gözlemin keskinleşir,
anatomi bildikçe kritik vuruşların artar. Kaslar uykuda gelişir; aç uyursan yarım gelişir.
Arayüz, karakterin kendi defteri gibi çizilir.

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
