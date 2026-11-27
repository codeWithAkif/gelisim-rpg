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
