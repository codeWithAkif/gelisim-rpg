// Telefon bildirimi: çalışma/el işi bittiğinde haber verir (uygulama kapalı olsa da).
// Eski APK'da eklenti yoksa sessizce atlanır.
import { Capacitor } from "@capacitor/core";
import { settings } from "./ui/settings";

const ID = 1001;
const available = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("LocalNotifications");

export async function notifyAt(title: string, body: string, atMs: number): Promise<"ok" | "kapali" | "izin-yok" | "yok"> {
  if (!available()) return "yok";
  if (!settings().notify) return "kapali";
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    let p = await LocalNotifications.checkPermissions();
    if (p.display !== "granted") p = await LocalNotifications.requestPermissions();
    if (p.display !== "granted") return "izin-yok";
    await LocalNotifications.cancel({ notifications: [{ id: ID }] });
    await LocalNotifications.schedule({ notifications: [{
      id: ID, title, body, schedule: { at: new Date(atMs), allowWhileIdle: true },
      smallIcon: "ic_stat_defter", iconColor: "#9E3423",
    }] });
    return "ok";
  } catch { return "yok"; }
}

/** Bekleyen bildirimi iptal eder; uygulama açıkken gelmişse kaldırır. */
export async function clearNotify() {
  if (!available()) return;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.cancel({ notifications: [{ id: ID }] });
    await LocalNotifications.removeAllDeliveredNotifications();
  } catch { /* yok */ }
}
