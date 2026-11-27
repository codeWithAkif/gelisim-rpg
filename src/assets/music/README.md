# Müzik dosyaları

Bu klasöre konan ses dosyaları uygulama paketine girer ve adlarına göre çalar (ağ isteği yok).
Dosya yoksa oyun sessiz kalır; ortam sesleri ve annenin ezgisi dosyasız üretilir.

| Dosya adı | Ne zaman çalar |
|---|---|
| `muzik_taspinar` | Taşpınar bölgesi (köy, yayla, koru, dere) |
| `muzik_karacam` | Karaçam (çarşı, han, sarnıç, lonca) |
| `muzik_ayazkale` | Ayazkale (kar geçidi, kale) |
| `muzik_ardic` | Ardıç (başkent, kül mahallesi, saray) |
| `muzik_<bölge>_gece` | İsteğe bağlı: o bölgede gece; yoksa gündüz parçası çalar |
| `muzik_savas` | İsteğe bağlı: savaş ve kuşatma sırasında |
| `muzik_olcer` | İsteğe bağlı: Ölçer işi sırasında |

- Biçim: `.ogg` (önerilen, Opus ya da Vorbis), `.opus`, `.mp3` ya da `.m4a`. Örnek: `muzik_taspinar.ogg`.
- Parça kesintisiz döngüyle çalar; başı ve sonu birbirine bağlanacak şekilde kesilmeli (sessiz baş/son olmasın).
- Boyut: 3 dakikalık parça 64–96 kbps ile yaklaşık 1,5–2 MB. Bütün parçalar 10 MB'ı geçmesin.
- Lisans: yalnızca kullanma hakkın olan parçalar (kendi bestesi, ısmarlama ya da CC0). Kaynağı ve lisansı
  aşağıya yaz.

## Kaynaklar

(henüz parça yok)
