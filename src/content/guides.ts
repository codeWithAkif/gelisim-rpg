// İlk girişte kısa öğütler: barikat, gizlenme, harabe ve Ölçer işi. Sayfa sayfa gösterilir, bir kez.
// Kim söylüyor, hangi portreyle. Savaştaki adım adım dersler (Hasan, Zehra) engine/coach.ts içinde.
export interface Guide { who: string; portrait?: string; title: string; steps: string[] }
export const GUIDES: Record<"barikat" | "gizlenme" | "harabe" | "olcer", Guide> = {
  barikat: { who: "Hasan", portrait: "portre_hasan", title: "Barikat gecesi", steps: [
    "Dalga dalga gelecekler. Önce barikat: parmağını haritada sürükle, kısa bir çit kurarsın. Kazığın sınırlı.",
    "Çiti yolun ağzına kur. Kurt etrafından dolanmaya çalışır; dolandıkça sana vakit kalır.",
    "Savaş başlayınca: yayın varsa kendinden geriye çek, bırak. Yanına geleni kılıcınla kendin vurursun.",
    "Büyü için \"Büyü çiz\": diziyi aklından çiz, sonra hedefe dokun. Her büyü kullanıldıktan sonra dolmayı bekler.",
  ] },
  gizlenme: { who: "Hasan", portrait: "portre_hasan", title: "Gizlenmek", steps: [
    "Parmağını basılı tut: oraya sinsice yürürsün. Bırakınca durursun.",
    "Sarı koniler bakışlardır. Kurdun kokusu rüzgârla uzar: rüzgâra karşı yürü, çalının içinden geç.",
    "Kuşku çubuğu dolarsa görülürsün. Taş at: dokunduğun yere düşer, bakışlar oraya döner.",
    "Pusu yerine fark edilmeden varırsan savaş bir kurdun dibinde başlar; ilk vuruşun iki kat.",
  ] },
  harabe: { who: "Hasan", portrait: "portre_hasan", title: "Harabeye girmeden", steps: [
    "Sol alttaki çubukla yürürsün; merdivenin dibindeyken yukarı ya da aşağı it.",
    "Sandığa, rafa yaklaşınca \"Ara\" çıkar. Aramak vakit ister; bulduğun çantana girer, çantan sınırlı.",
    "Bekçiler uyur. Biri seni fark ederse ötekileri çağırır ve baskın sayacı başlar. Sessiz ol, çabuk ol.",
    "Çıkış zemin katın solunda. Sayaç azalınca çık; ölürsen çantan düştüğün yerde kalır.",
  ] },
  olcer: { who: "Annemin defteri", portrait: "portre_anne", title: "Ölçer işi", steps: [
    "Isı kaybolmaz, bir yerden bir yere gider. Önce ısıyı alacağın yere, sonra yolla bağlı komşusuna dokun: bir birim taşınır.",
    "Bazı yerlerin ısısı görünmez. \"Ölç\" ile önce bak; ölçmeden boş yerden taşımaya kalkarsan hamlen boşa gider.",
    "Hamlen de ölçümün de sınırlı. Hesabı önce kafanda yap, sonra taşı.",
  ] },
};
