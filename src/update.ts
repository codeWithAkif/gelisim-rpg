// Açılışta güncelleme: GitHub'daki son sürümü kontrol eder.
// - Yeni web paketi (dist.zip) varsa indirip uygular; uygulama bir kez yeniden yüklenir.
// - Yeni yerel sürüm (native) gerekiyorsa kullanıcıya yeni APK'yı önerir.
// İnternet yoksa sessizce atlar; oyun offline çalışmaya devam eder.
// Her adım bir günlüğe yazılır (Ayarlar → Güncelleme); sorun olursa nerede takıldığı görünür.
import { Capacitor, CapacitorHttp } from "@capacitor/core";

export const RELEASE_REPO = "codeWithAkif/gelisim-rpg";
export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? "0.1.0-dev";
export const APK_URL = `https://github.com/${RELEASE_REPO}/releases/latest/download/gezgin-defteri.apk`;
const VERSION_URL = `https://github.com/${RELEASE_REPO}/releases/latest/download/version.json`;
const zipUrl = (v: string) => `https://github.com/${RELEASE_REPO}/releases/download/v${v}/dist.zip`;

/** "0.1.12" > "0.1.9" gibi sayısal karşılaştırma. */
export function newer(a: string, b: string): boolean {
  const pa = a.split(/[.-]/).map(n => parseInt(n, 10) || 0), pb = b.split(/[.-]/).map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) { if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0); }
  return false;
}

/* ---------- durum ve günlük ---------- */
const STATUS_KEY = "gelisim-guncelleme", LOG_KEY = "gelisim-guncelleme-gunluk", PENDING_KEY = "gelisim-guncelleme-bekleyen";
export interface UpdateStatus { at: number; text: string; ok: boolean }
function setStatus(text: string, ok: boolean) { try { localStorage.setItem(STATUS_KEY, JSON.stringify({ at: Date.now(), text, ok })); } catch { /* yok */ } note(text); }
export function lastUpdateStatus(): UpdateStatus | null { try { return JSON.parse(localStorage.getItem(STATUS_KEY) ?? "null"); } catch { return null; } }
/** Güncelleme günlüğü: son 25 adım, en yenisi önde. */
export function updateLog(): { at: number; text: string }[] { try { return JSON.parse(localStorage.getItem(LOG_KEY) ?? "[]"); } catch { return []; } }
export function note(text: string) {
  try { const l = updateLog(); l.unshift({ at: Date.now(), text }); localStorage.setItem(LOG_KEY, JSON.stringify(l.slice(0, 25))); } catch { /* yok */ }
}

/**
 * Paket sağlam açıldı. Eklenti, yeni paket açıldıktan sonra belirli süre içinde bunu duymazsa
 * paketi bozuk sayıp önceki pakete döner; bu yüzden uygulama başlar başlamaz çağrılır.
 * Ayrıca bir önceki açılışta uygulanan sürümün gerçekten açılıp açılmadığını yazar.
 */
export async function markReady() {
  if (!Capacitor.isNativePlatform()) return;
  try { const { CapacitorUpdater } = await import("@capgo/capacitor-updater"); await CapacitorUpdater.notifyAppReady(); } catch (e) { note(`Hazır bildirimi gönderilemedi: ${(e as Error)?.message ?? e}`); }
  try {
    const pending = localStorage.getItem(PENDING_KEY);
    if (pending) {
      localStorage.removeItem(PENDING_KEY);
      if (pending === APP_VERSION) setStatus(`${APP_VERSION} kuruldu ve açıldı.`, true);
      else setStatus(`${pending} uygulandı ama açılmadı; ${APP_VERSION} ile devam edildi (eklenti geri döndürdü).`, false);
    }
  } catch { /* yok */ }
}

export interface UpdateHooks {
  onDownloading(version: string): void;
  onProgress?(percent: number): void;
  onDone(): void;
  onNativeUpdate(version: string, apkUrl: string): void;
}

/** Telefonun kendi bağlantısıyla GET (tarayıcı kısıtı ve yönlendirme sorunu olmaz). */
async function nativeGet(url: string): Promise<{ status: number; data: unknown }> {
  const r = await CapacitorHttp.get({ url, headers: { Accept: "application/json" }, connectTimeout: 8000, readTimeout: 8000 });
  return { status: r.status, data: typeof r.data === "string" ? (() => { try { return JSON.parse(r.data); } catch { return r.data; } })() : r.data };
}
interface LatestInfo { version: string; native: number }
/** Son sürüm: önce yayındaki küçük sürüm dosyası, olmazsa GitHub API. */
async function latestRelease(): Promise<LatestInfo> {
  try {
    const r = await nativeGet(VERSION_URL);
    const d = r.data as Partial<LatestInfo>;
    if (r.status === 200 && d?.version) return { version: String(d.version), native: Number(d.native) || 0 };
    note(`Sürüm dosyası okunamadı (${r.status}); GitHub'a soruluyor.`);
  } catch (e) { note(`Sürüm dosyasına ulaşılamadı: ${(e as Error)?.message ?? e}`); }
  const r = await nativeGet(`https://api.github.com/repos/${RELEASE_REPO}/releases/latest`);
  if (r.status !== 200) throw new Error(`GitHub yanıt vermedi (${r.status})`);
  const rel = r.data as { tag_name?: string; body?: string };
  return { version: (rel.tag_name ?? "").replace(/^v/, ""), native: parseInt(/native:\s*(\d+)/.exec(rel.body ?? "")?.[1] ?? "0", 10) };
}

let running = false;
export async function checkForUpdates(h: UpdateHooks): Promise<void> {
  if (!Capacitor.isNativePlatform()) { setStatus("Tarayıcıda güncelleme denetlenmez.", true); return; }
  if (running) return; running = true;
  const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
  let step = "sürüm denetimi";
  try {
    note(`Denetim başladı (yüklü: ${APP_VERSION}).`);
    const latest = await latestRelease();
    if (!latest.version) { setStatus("Son sürüm okunamadı.", false); return; }
    if (!newer(latest.version, APP_VERSION)) { setStatus(`En son sürümdesin (${APP_VERSION}).`, true); return; }

    step = "yerel sürüm karşılaştırma";
    const { App } = await import("@capacitor/app");
    const localNative = parseInt((await App.getInfo()).build, 10) || 0;
    note(`Yeni sürüm: ${latest.version} (yerel ${latest.native}, telefondaki ${localNative}).`);
    if (latest.native > localNative) {
      setStatus(`${latest.version} için yeni APK gerekiyor.`, false);
      h.onNativeUpdate(latest.version, APK_URL);
      return;
    }

    step = "eski paketleri temizleme";
    try {
      const { bundles } = await CapacitorUpdater.list();
      const old = bundles.find(b => b.version === latest.version);
      if (old && old.status === "success") { note(`${latest.version} zaten indirilmiş; uygulanıyor.`); localStorage.setItem(PENDING_KEY, latest.version); await CapacitorUpdater.set({ id: old.id }); return; }
      if (old) { note(`${latest.version} daha önce bozuk inmiş (${old.status}); siliniyor.`); await CapacitorUpdater.delete({ id: old.id }); }
    } catch (e) { note(`Paket listesi alınamadı: ${(e as Error)?.message ?? e}`); }

    step = "indirme";
    h.onDownloading(latest.version);
    const sub = await CapacitorUpdater.addListener("download", ev => h.onProgress?.(ev.percent)).catch(() => null);
    let bundle;
    try { bundle = await CapacitorUpdater.download({ url: zipUrl(latest.version), version: latest.version }); }
    catch (e) { note(`İlk indirme olmadı: ${(e as Error)?.message ?? e}; tekrar deneniyor.`); bundle = await CapacitorUpdater.download({ url: zipUrl(latest.version), version: latest.version }); }
    void sub?.remove();
    note(`${latest.version} indirildi (${bundle.status}).`);

    step = "uygulama";
    localStorage.setItem(PENDING_KEY, latest.version);
    setStatus(`${latest.version} indirildi, uygulanıyor.`, true);
    await CapacitorUpdater.set(bundle); // uygulamayı yeni paketle yeniden yükler; kayıt korunur
  } catch (e) {
    setStatus(`${step} adımında olmadı: ${(e as Error)?.message ?? e} (yüklü: ${APP_VERSION})`, false);
    h.onDone();
  } finally { running = false; }
}
