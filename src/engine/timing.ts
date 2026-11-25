// Zamanlama ve mini oyun hesapları (DOM yok).
// Oyuncunun eli ustalaştıkça değil, karakterin becerisi arttıkça "doğru an" genişler:
// refleksi yüksek karakterde savuşturma penceresi geniştir, ressamın çizgi toleransı büyüktür.
import type { GameState } from "./state";

export type MiniKind = "kosu" | "yuzme" | "odun" | "tirmanma" | "dans" | "ezgi" | "ocak" | "mum" | "isaret" | "savustur" | "kesme" | "ayikla" | "yay" | "cizgi" | "hafiza";

/** Hangi çalışma hangi mini oyunla oynanır: her iş kendine benzer. */
const MINI_OF: Record<string, MiniKind> = {
  kosu: "kosu", yuzme: "yuzme", odun: "odun", tirmanma: "tirmanma", dans: "dans", muzik: "ezgi", sarki: "ezgi", demirci: "ocak",
  meditasyon: "mum",
  calisma_ates: "isaret", calisma_su: "isaret", calisma_toprak: "isaret", calisma_hava: "isaret", calisma_ayaz: "isaret", calisma_simsek: "isaret",
  kilic_idman: "kesme",
  okculuk_idman: "yay", avcilik: "yay",
  resim: "cizgi", anatomi: "cizgi", botanik: "ayikla",
  satranc: "hafiza", hitabet_ders: "hafiza",
};
/** Mini oyunu kolaylaştıran özellik. */
const EASE_ATTR: Record<MiniKind, string> = {
  kosu: "kardiyo", yuzme: "nefes", odun: "ust_govde", tirmanma: "kavrama", dans: "esneklik", ezgi: "hafiza", ocak: "refleks",
  mum: "odak", isaret: "odak", savustur: "refleks", kesme: "kilic", ayikla: "hafiza", yay: "gorus", cizgi: "el_becerisi", hafiza: "hafiza",
};
export const MINI_NAMES: Record<MiniKind, string> = {
  kosu: "Patika koşusu", yuzme: "Kulaç", odun: "Balta", tirmanma: "Tutamak", dans: "Adım", ezgi: "Ezgi", ocak: "Örs",
  mum: "Mum", isaret: "İşaret", savustur: "Savuştur", kesme: "Havada kes", ayikla: "Ot ayıklama", yay: "Yay", cizgi: "Çizgi", hafiza: "Hafıza",
};
export function miniFor(actId: string): MiniKind | undefined { return MINI_OF[actId]; }

const lvl = (s: GameState, id: string) => s.attrs[id]?.level ?? 10;
/** Beceri çarpanı: 10 seviyede 1, her 40 seviyede +1; 0.8 ile 2.5 arası. */
export function skillEase(s: GameState, attr: string): number {
  return Math.max(0.8, Math.min(2.5, 1 + (lvl(s, attr) - 10) / 40));
}
export function miniEase(s: GameState, kind: MiniKind): number { return skillEase(s, EASE_ATTR[kind]); }

/* ---------- tek dokunuşluk zamanlama ---------- */
export interface Grade { q: number; label: "Tam an!" | "İyi" | "Geç kaldın" | "Erken" | "Kaçırdın" }
/**
 * offset: hedef andan sapma (pencerenin dışında 1'e yaklaşan oransal değer, işaretli: eksi = erken).
 * win: "iyi" sayılan yarı genişlik (aynı birimde).
 */
export function grade(offset: number, win: number): Grade {
  const a = Math.abs(offset);
  if (a <= win * 0.35) return { q: 1, label: "Tam an!" };
  if (a <= win) return { q: 0.9 - 0.3 * (a - win * 0.35) / (win * 0.65), label: "İyi" };
  if (a <= win * 2) return { q: 0.3, label: offset < 0 ? "Erken" : "Geç kaldın" };
  return { q: 0, label: "Kaçırdın" };
}

/** Saldırı zamanlaması: halka hedefe oturduğunda dokun. Pencere silah becerisi ve refleksle genişler. */
export function attackWindow(s: GameState): number {
  const w = s.equipped.weapon; const fam = w ? (s.familiarity[w] ?? 0) : 0;
  return 0.1 * (skillEase(s, "refleks") * 0.5 + skillEase(s, "kilic") * 0.5) * (1 + fam / 200);
}
/** Saldırıya zamanlama etkisi: isabet ve kritik puanı. q yoksa (komut kapalı) etkisiz. */
export function attackTimingMods(q?: number): { hit: number; crit: number } {
  if (q === undefined) return { hit: 0, crit: 0 };
  if (q >= 1) return { hit: 8, crit: 15 };
  if (q >= 0.6) return { hit: 3, crit: Math.round(8 * q) };
  if (q > 0) return { hit: 0, crit: 0 };
  return { hit: -5, crit: 0 };
}
/** Savunma zamanlaması: kurt atıldığında doğru anda kaçmak. */
export function dodgeWindow(s: GameState): number {
  return 0.11 * (skillEase(s, "refleks") * 0.7 + skillEase(s, "esneklik") * 0.3);
}
/** Düşmanın isabetinden düşülecek puan. */
export function dodgeMod(q?: number): number {
  if (q === undefined) return 0;
  if (q >= 1) return 18;
  if (q >= 0.6) return Math.round(12 * q);
  return 0;
}

/* ---------- ritim ---------- */
/** Vuruş anları (ms) ve dokunuşlar (ms): her vuruşa en yakın dokunuş eşlenir; boş dokunuş ceza. */
export function rhythmScore(beats: number[], taps: number[], winMs: number): number {
  if (!beats.length) return 0;
  const used = new Set<number>(); let sum = 0;
  for (const b of beats) {
    let best = -1, bd = Infinity;
    taps.forEach((t, i) => { if (used.has(i)) return; const d = Math.abs(t - b); if (d < bd) { bd = d; best = i; } });
    if (best >= 0 && bd <= winMs * 2) { used.add(best); sum += grade(bd, winMs).q; }
  }
  const stray = taps.length - used.size;
  return Math.max(0, Math.min(1, sum / beats.length - stray * 0.04));
}

/* ---------- çalışma oturumu verimi ---------- */
/** Uzun oturumda her oyun saati için bir odak turu oynanabilir. */
export function sessionRounds(gameMs: number): number { return Math.max(1, Math.ceil(gameMs / 3_600_000 - 1e-9)); }
/**
 * Mini oyunlar verimi artırır: hiç oynamamak ×1 (bekleyerek çalışma), her tur en çok +1/tur sayısı.
 * Kötü oynamak cezalandırılmaz; sadece ek kazanç gelmez.
 */
export function sessionBoost(scores: number[] | undefined, gameMs: number): number {
  const n = sessionRounds(gameMs);
  const best = [...(scores ?? [])].sort((a, b) => b - a).slice(0, n);
  return 1 + best.reduce((a, b) => a + Math.max(0, Math.min(1, b)), 0) / n;
}
