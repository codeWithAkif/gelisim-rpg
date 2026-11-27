// Ses haritası: bulunduğun yerde hangi ortam sesi ve hangi müzik çalar. Yalnız karar; ses üretimi ui/feel.ts
// ve ui/music.ts içinde. Müzik dosyası yoksa sessiz kalınır (ortam sesi ve annenin ezgisi dosyasızdır). DOM yok.
import type { Place } from "../content/map";

export type ScapeKind = "yayla" | "dere" | "meydan" | "koru" | "ocak" | "ev" | "sehir" | "kale" | "kar" | "yol";
export interface Scape { kind: ScapeKind; cold: boolean }

/** Yerin türünden ortam sesi. Ayazkale'de her şeyin altında soğuk rüzgâr eser. */
export function scapeOf(place: Pick<Place, "id" | "icon" | "region"> | undefined, onRoad = false): Scape {
  const cold = place?.region === "ayazkale";
  if (onRoad || !place) return { kind: "yol", cold };
  const byIcon: Record<Place["icon"], ScapeKind> = { dag: cold ? "kar" : "yayla", dere: "dere", meydan: "meydan", koru: "koru", ocak: "ocak", ev: "ev", sehir: "sehir", kale: "kale" };
  return { kind: byIcon[place.icon], cold };
}

/** Müzik bağlamı: savaş ve Ölçer işi kendi parçasını ister; yoksa bölgenin parçası. */
export type MusicContext = "bolge" | "savas" | "olcer";
/**
 * Denenecek parça adları, en uygundan başlayarak. Dosya adları: muzik_<ad>.ogg (ya da .opus/.mp3/.m4a).
 * Örnek: gece Taşpınar → muzik_taspinar_gece, yoksa muzik_taspinar.
 */
export function musicCandidates(region: Place["region"], night: boolean, ctx: MusicContext = "bolge"): string[] {
  const out: string[] = [];
  if (ctx === "savas") out.push("muzik_savas");
  if (ctx === "olcer") out.push("muzik_olcer");
  if (night) out.push(`muzik_${region}_gece`);
  out.push(`muzik_${region}`);
  return out;
}
/** Elde olan ilk parça; hiçbiri yoksa null (sessizlik). */
export const pickTrack = (candidates: string[], available: Set<string> | string[]) => {
  const has = available instanceof Set ? available : new Set(available);
  return candidates.find(c => has.has(c)) ?? null;
};

/* ---------- annenin ezgisi ---------- */
// Kopuz gibi tellerde, beşli dizide kısa bir motif. Notalar note()'taki dizinin sıraları (0–5), süreler vuruş.
export interface MotifNote { n: number; d: number }
export const MOTIF: Record<"kisa" | "tam", MotifNote[]> = {
  // "Isı kaybolmaz" — iniş, sonra yerine dönüş
  kisa: [{ n: 3, d: 1 }, { n: 2, d: 1 }, { n: 1, d: 1 }, { n: 2, d: 2 }],
  // "… bir yere gider" — aynı iniş, ardından bir üst oktavda kapanış
  tam: [{ n: 3, d: 1 }, { n: 2, d: 1 }, { n: 1, d: 1 }, { n: 2, d: 2 }, { n: 0, d: 1 }, { n: 1, d: 1 }, { n: 3, d: 1 }, { n: 5, d: 3 }],
};
/** Motifin saniye cinsinden süresi (bir vuruş beat saniye). */
export const motifLength = (m: MotifNote[], beat: number) => m.reduce((a, x) => a + x.d, 0) * beat;
