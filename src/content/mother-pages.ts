// Annenin deney sayfaları: defterden kopup dünyaya dağılmış bilmeceler. Her biri bir imza büyüyü anlatır;
// cevabı oyuncu kendisi bulur (Defter → Büyüler → Deney ya da savaşta çizerek). Editörde karşılığı yok.
export interface MotherPage {
  id: string; place: string; after: string; giver: string;
  art: string; intro: string; riddle: string; spell: string;
}
export const MOTHER_PAGES: MotherPage[] = [
  { id: "ates_duvari", place: "zehra_evi", after: "kivilcim", giver: "Zehra", art: "hikaye_iz",
    intro: "Zehra sandığın dibinden bir yaprak daha çıkardı. \"Bunu da annen bıraktı. Ateşi tutabildiğinde ver, dedi.\"",
    riddle: "Alevi tek noktada toplama; yere yatır, sıra sıra diz. Kurt o çizgiyi geçmez.", spell: "sy_el_ates_duvar" },
  { id: "sel", place: "karacam_sarnic", after: "k_derya", giver: "Derya", art: "hikaye_k_derya",
    intro: "Derya mumun altından ıslak kenarlı bir sayfa uzattı. \"Annen bunu suyun üstüne eğilip yazmıştı.\"",
    riddle: "Su yalnız akmaz, yükselir de. Dalgayı yere bırak, köşeyi dön: ayaklar yerden kesilir.", spell: "sy_el_su_akinti" },
  { id: "buz_mizragi", place: "ayaz_mutfak", after: "a_anne", giver: "Gülizar", art: "hikaye_a_iceride",
    intro: "Gülizar un çuvallarının arasından katlanmış bir kâğıt çıkardı. \"Kuleden atılmıştı. Sakladım; neden, bilmiyorum.\"",
    riddle: "Suyu ayazla dondur. Top yap, ama yuvarlak değil: ucu sivri kalsın.", spell: "sy_c_buz_top" },
  { id: "donmus_sur", place: "ayaz_kule", after: "a_ocak", giver: "Annem", art: "hikaye_a_anne",
    intro: "Annem duvardaki çentiklerin yanına bir satır daha kazıdı. \"Bunu on iki yıl burada düşündüm.\"",
    riddle: "Toprağı ayazla bağla, sonra duvar diye diz. Ne ateş yıkar, ne su.", spell: "sy_don_duvar" },
  { id: "yildirim_kuresi", place: "ardic_kul", after: "d_kul", giver: "Kül Ana", art: "hikaye_d_kul",
    intro: "Kül Ana ateşi karıştırdı, külün içinden yarısı yanmış bir sayfa çekti. \"O gece bunu da kurtarmıştım.\"",
    riddle: "Ateşe şimşeği kat. Avucunda beyaz bir küre olur; biçimi en basit olanı.", spell: "sy_plazma_top" },
  { id: "kar_korlugu", place: "koy_meydani", after: "d_bahar", giver: "Muhtar Ayşe", art: "hikaye_mektup",
    intro: "Muhtar Ayşe kuzeyden gelen bir mektup uzattı. Kenarında annemin el yazısı.",
    riddle: "Ayazı rüzgâra ver, sonra perde gibi as. Göz göz görmez; düşman kendi elini seçemez.", spell: "sy_tipi_perde" },
  { id: "meteor", place: "ardic_dehliz", after: "d_bahar", giver: "Kırık ocak", art: "yer_ardic_dehliz",
    intro: "Kırık ocağın dibinde isli bir sayfa. Annemin el yazısı; son satırı yarım kalmış.",
    riddle: "Toprağı ateşle erit, sonra rüzgâra ver: gökten düşer. Bunu bitiremedim. Sen bitir.", spell: "sy_magma_firlat" },
];
export const motherPage = (id: string) => MOTHER_PAGES.find(p => p.id === id);
