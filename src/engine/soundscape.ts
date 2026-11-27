// Ses haritası: bulunduğun yerde hangi ortam kaydı ve hangi müzik çalar. Yalnız karar; çalma ui/feel.ts
// ve ui/music.ts içinde. Kaydı ya da müzik dosyası olmayan katman sessiz kalır. DOM yok.
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

/* ---------- ortam katmanları (kayıtlar: src/assets/ses/ortam_<ad>.ogg) ---------- */
export type AmbId = "ruzgar" | "kar" | "dere" | "koyun" | "meydan" | "carsi" | "demirhane" | "koru" | "gece" | "muzik_orman";
export interface AmbLayer { id: AmbId; vol: number }
export interface AmbPlan { layers: AmbLayer[]; owls: boolean; wolves: boolean }
/**
 * Bu yerde ve vakitte hangi kayıtlar döngüyle çalar (ses düzeyi 0–1). Gece kuşlar ve kalabalık susar,
 * açıkta cırcır başlar; koruda ve yaylada ara ara baykuş öter; koruda ve dere kenarında gece ürkütücü
 * bir orman müziği, uzaktan kurt sesleri. Ayazkale'de rüzgârın yerini kar fırtınası alır.
 */
export function ambientPlan(sc: Scape, night: boolean): AmbPlan {
  const L = (id: AmbId, vol: number): AmbLayer => ({ id, vol });
  const wind = (v: number) => (sc.cold ? L("kar", v) : L("ruzgar", v));
  let layers: AmbLayer[];
  switch (sc.kind) {
    case "yayla": layers = night ? [wind(0.4), L("gece", 0.7)] : [wind(0.6), L("koyun", 0.8)]; break;
    case "dere": layers = night ? [L("dere", 0.8), L("gece", 0.5), L("muzik_orman", 0.35)] : [L("dere", 0.9), wind(0.2)]; break;
    case "meydan": layers = night ? [L("gece", 0.5), wind(0.2)] : [L("meydan", 1)]; break;
    case "koru": layers = night ? [L("gece", 0.8), wind(0.15), L("muzik_orman", 0.35)] : [L("koru", 1), wind(0.15)]; break;
    case "ocak": layers = night ? [wind(0.15)] : [L("demirhane", 1)]; break;
    case "ev": layers = [wind(0.1)]; break;   // içeride: dışarıdan hafif rüzgâr
    case "sehir": layers = night ? [wind(0.3), L("gece", 0.3)] : [L("carsi", 1)]; break;
    case "kale": layers = [wind(0.6)]; break;
    case "kar": layers = [L("kar", 1)]; break;
    case "yol": layers = night ? [wind(0.4), L("gece", 0.5)] : [wind(0.6)]; break;
  }
  // uzaktan kurt sesleri: koruda her zaman, yaylada ve derede gece (kurtlar ormanda; "kurt böyle avlanmaz")
  const wolves = !sc.cold && (sc.kind === "koru" || (night && (sc.kind === "yayla" || sc.kind === "dere")));
  return { layers, owls: night && (sc.kind === "koru" || sc.kind === "yayla"), wolves };
}
/** Elde kaydı olmayan katmanlar çıkarılır. */
export const playableLayers = (p: AmbPlan, available: Set<string>) => p.layers.filter(l => available.has(l.id));

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
