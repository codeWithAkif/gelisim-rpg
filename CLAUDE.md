# Gezgin Defteri — çalışma notları

- Dil: oyun metinleri ve kod yorumları Türkçe.
- `src/engine/` saf TypeScript kalmalı (DOM yok); her mekanik için `tests/` altına test ekle.
- Oyun verisinin kaynağı config editörü; `src/config/oyun-config.json` dosyasını elle düzenleme, `tools/editor-to-config.mjs` ile üret.
- Editörde karşılığı olmayan içerik `src/content/world.ts` içinde.
- Denge değişince `npm test` içindeki `tests/balance.test.ts` aralıklarını kontrol et.
- Görsel yön: kâğıt/mürekkep defter. Renkler `src/ui/style.css` başındaki değişkenlerde; yeni görsel öğeler `src/ui/sketch.ts` içindeki titrek çizgi yardımcılarıyla çizilir.
- Hedef: dikey ekran telefon, tamamen offline (dış ağ isteği yok, fontlar `@fontsource` ile paketli).
