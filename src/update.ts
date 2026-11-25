// Açılışta güncelleme: GitHub'daki son sürümü kontrol eder.
// - Yeni web paketi (dist.zip) varsa indirip uygular; uygulama bir kez yeniden yüklenir.
// - Yeni yerel sürüm (native) gerekiyorsa kullanıcıya yeni APK'yı önerir.
// İnternet yoksa sessizce atlar; oyun offline çalışmaya devam eder.
import { Capacitor } from "@capacitor/core";

export const RELEASE_REPO = "codeWithAkif/gelisim-rpg";
export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? "0.1.0-dev";
export const APK_URL = `https://github.com/${RELEASE_REPO}/releases/latest/download/gezgin-defteri.apk`;

/** "0.1.12" > "0.1.9" gibi sayısal karşılaştırma. */
export function newer(a: string, b: string): boolean {
  const pa = a.split(/[.-]/).map(n => parseInt(n, 10) || 0), pb = b.split(/[.-]/).map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) { if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0); }
  return false;
}

/** Oyun gerçekten açıldı: bu paketi sağlam say. Çağrılmazsa eklenti 15 sn sonra önceki pakete döner. */
export async function markReady() {
  if (!Capacitor.isNativePlatform()) return;
  try { const { CapacitorUpdater } = await import("@capgo/capacitor-updater"); await CapacitorUpdater.notifyAppReady(); } catch { /* yok */ }
}

export interface UpdateHooks {
  onDownloading(version: string): void;
  onDone(): void;
  onNativeUpdate(version: string, apkUrl: string): void;
}

export async function checkForUpdates(h: UpdateHooks): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`https://api.github.com/repos/${RELEASE_REPO}/releases/latest`, { headers: { Accept: "application/vnd.github+json" }, signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return;
    const rel = await res.json() as { tag_name?: string; body?: string; assets?: { name: string; browser_download_url: string }[] };
    const latest = (rel.tag_name ?? "").replace(/^v/, "");
    if (!latest || !newer(latest, APP_VERSION)) return;

    // yerel sürüm farkı: yeni APK gerekiyor mu?
    const remoteNative = parseInt(/native:\s*(\d+)/.exec(rel.body ?? "")?.[1] ?? "0", 10);
    const { App } = await import("@capacitor/app");
    const localNative = parseInt((await App.getInfo()).build, 10) || 0;
    if (remoteNative > localNative) {
      const apk = rel.assets?.find(a => a.name.endsWith(".apk"));
      h.onNativeUpdate(latest, apk?.browser_download_url ?? APK_URL);
      return;
    }

    const zip = rel.assets?.find(a => a.name === "dist.zip");
    if (!zip) return;
    h.onDownloading(latest);
    const bundle = await CapacitorUpdater.download({ url: zip.browser_download_url, version: latest });
    await CapacitorUpdater.set(bundle); // uygulamayı yeni paketle yeniden yükler; kayıt korunur
  } catch {
    h.onDone();
  }
}
