// İlk savaşta Hasan'ın dersi: oyuncu bir şey yaptıkça bir sonraki adıma geçilir. DOM yok; balon ui/battle-view.ts içinde.
export type CoachStep = "giris" | "sec" | "yuru" | "vur" | "kac" | "son" | "bitti";
/** Oyuncunun yaptığı ya da savaşta olan şey. */
export type CoachEvent = "tamam" | "sec" | "yanında" | "saldir" | "kacis" | "tur_bitti";

export interface CoachLine { text: string; button?: string }
/** timing: zamanlama oyunları açık mı (kapalıysa kesme ve kaçma anlatılmaz). */
export function coachLine(step: CoachStep, timing: boolean): CoachLine | null {
  switch (step) {
    case "giris": return { text: "Dur, acele etme. Başlarındaki \"z\": kurtlar seni daha görmedi. Kırmızı gölge: uyanırlarsa atılabilecekleri yer.", button: "Tamam" };
    case "sec": return { text: "Önce birini gözüne kestir. Bir kurda dokun." };
    case "yuru": return { text: "Mavi yerlere yürüyebilirsin. Kurdun yanına git; kırmızıya basma, rüzgâra karşı yaklaş." };
    case "vur": return { text: timing ? "Şimdi Saldır'a bas. Üstünde açık parlayınca parmağını içinden hızla geçir." : "Şimdi Saldır'a bas." };
    case "kac": return { text: timing ? "Sıra kurtlarda. Biri atılırsa çalımına kanma; havadayken yana kaydır." : "Sıra kurtlarda. Turu bitir; bakalım ne yapacaklar." };
    case "son": return { text: "İşte böyle. Gerisi sende: Gözle ile zayıf yerini bul, Savun ile korun, iş kötüye giderse Geri çekil.", button: "Anladım" };
    case "bitti": return null;
  }
}
/** Bir olay adımı ilerletir mi? Uymayan olay adımı değiştirmez. */
export function coachNext(step: CoachStep, ev: CoachEvent, timing: boolean): CoachStep {
  if (step === "giris" && ev === "tamam") return "sec";
  if (step === "sec" && ev === "sec") return "yuru";
  if ((step === "sec" || step === "yuru") && ev === "yanında") return "vur";
  if (step === "vur" && ev === "saldir") return "kac";
  // kaçma oyunu oynandıysa (ya da oyunlar kapalıyken tur bittiyse) son söz
  if (step === "kac" && (ev === "kacis" || (!timing && ev === "tur_bitti"))) return "son";
  if (step === "son" && ev === "tamam") return "bitti";
  return step;
}
/** Ders bitti sayılır mı: saldırıyı ve kaçmayı gördüyse savaş erken bitse de bir daha gösterilmez. */
export const coachLearned = (step: CoachStep) => step === "son" || step === "bitti";

/* ---------- Zehra'nın dersi: ilk kez büyü çizerken ---------- */
export type SpellStep = "ac" | "ciz" | "hedef" | "son" | "bitti";
export type SpellEvent = "acildi" | "cizildi" | "sondu" | "yapti" | "tamam" | "vazgecti";
export function spellCoachLine(step: SpellStep): CoachLine | null {
  switch (step) {
    case "ac": return { text: "Büyüyü listeden seçmezsin; aklından çizersin. \"Büyü çiz\"e bas." };
    case "ciz": return { text: "Önce maddenin işareti, en sonda biçimi. Ateş topu: Alev, sonra Hilal." };
    case "hedef": return { text: "Avucunda tutuyorsun. Kırmızı kesikli altıgenlerin içindeki bir hedefe dokun, sonra \"Büyüyü yap\". Uzaksa Vazgeç, yaklaş, yeniden çiz." };
    case "son": return { text: "Dizileri Defter → Büyüler'de bulursun. Savaşta kimse hatırlatmaz; aklında tut. Yeni bir dizi denersen yeni bir büyü bulabilirsin.", button: "Anladım" };
    case "bitti": return null;
  }
}
export function spellCoachNext(step: SpellStep, ev: SpellEvent): SpellStep {
  if (step === "ac" && ev === "acildi") return "ciz";
  if (step === "ciz" && (ev === "sondu" || ev === "vazgecti")) return "ac";
  if (step === "ciz" && ev === "cizildi") return "hedef";
  if (step === "hedef" && ev === "yapti") return "son";
  if (step === "hedef" && ev === "vazgecti") return "ac";
  if (step === "son" && ev === "tamam") return "bitti";
  return step;
}

/* ---------- Selim'in öğüdü: kervan penceresinde sıradaki adım ---------- */
/** İlk kervanda pencerenin üstünde tek cümle: o an yapılması gereken. */
export function caravanTip(o: { carts: number; freeCarts: number; dests: number; to?: string; units: number; heroes: number; guards: number }): string {
  if (!o.carts) return "Önce bir araba al. Her araba sekiz yük taşır.";
  if (!o.freeCarts) return "Bütün arabaların yolda. Dönmelerini bekle ya da bir araba daha al.";
  if (!o.dests) return "Mal götürebileceğin başka bir pazar görmedin. Önce oralara bir kez git.";
  if (!o.to) return "Nereye gideceğini seç.";
  if (!o.units) return "Yük ekle: + ile. Yeşil sayı birim başına kârdır; kırmızıysa orada zarar edersin.";
  if (o.heroes && !o.guards) return "Korumalardan birini seç. İzci pusuyu önceden görür; savaşçı püskürtür. Korumasız kervan soyulur.";
  return "Hazır. Yola çıkar; sonucu bu gece uyuyunca öğrenirsin.";
}
