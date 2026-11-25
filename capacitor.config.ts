import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.codewithakif.gelisimrpg",
  appName: "Gezgin Defteri",
  webDir: "dist",
  android: { backgroundColor: "#EAE0C8" },
  plugins: {
    // Güncellemeleri kendimiz GitHub Releases'tan yönetiyoruz (src/update.ts); Capgo bulutu kullanılmaz.
    CapacitorUpdater: { autoUpdate: false, appReadyTimeout: 15000 },
    LocalNotifications: { smallIcon: "ic_stat_defter", iconColor: "#9E3423" },
  },
};
export default config;
