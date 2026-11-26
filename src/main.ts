import "@fontsource/caveat/500.css";
import "@fontsource/caveat/700.css";
import "@fontsource/alegreya/400.css";
import "@fontsource/alegreya/500.css";
import "@fontsource/alegreya/400-italic.css";
import "./ui/style.css";
import { installErrorScreen, showProblem, checkLayout } from "./fatal";
import { checkForUpdates, markReady } from "./update";

installErrorScreen();
// bu paket açıldı: güncelleme eklentisine hemen bildir (gecikirse eklenti önceki pakete döner)
markReady();
// yeniden yüklemede eski kaydırma konumu geri gelmesin
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
window.scrollTo(0, 0);

// arayüz çökse bile güncelleme denetimi çalışsın: düzeltilmiş sürüm gelebilsin
let veil: HTMLElement | null = null;
const updates = () => checkForUpdates({
  onDownloading(v) {
    veil = document.createElement("div"); veil.className = "modal-bg"; veil.style.alignItems = "center";
    veil.innerHTML = `<div class="modal" style="text-align:center"><h2>Defterin yeni sayfaları geliyor</h2><p class="lede">Sürüm ${v.replace(/[^0-9.]/g, "")} indiriliyor. Kaydın korunur.</p><div class="gb big"><div class="gf" id="upPct" style="width:0%;background:var(--green)"></div></div><p class="muted tiny" id="upTxt" style="margin:0">Bağlanıyor…</p></div>`;
    document.body.appendChild(veil);
  },
  onProgress(p) {
    const bar = document.getElementById("upPct"), txt = document.getElementById("upTxt");
    if (bar) bar.style.width = `${Math.max(0, Math.min(100, p))}%`; if (txt) txt.textContent = `%${Math.round(p)}`;
  },
  onDone() { veil?.remove(); veil = null; },
  onNativeUpdate(v, url) {
    const el = document.createElement("div"); el.className = "modal-bg";
    el.innerHTML = `<div class="modal"><h2>Yeni sürüm: ${v.replace(/[^0-9.]/g, "")}</h2><p>Bu sürüm uygulamanın kendisini de değiştiriyor; yeni APK'yı indirip kurman gerekiyor. Kaydın silinmez.</p>
      <div class="row"><button class="btn" data-x="later">Sonra</button><button class="btn primary" data-x="get">APK'yı indir</button></div></div>`;
    document.body.appendChild(el);
    el.addEventListener("click", e => { const x = (e.target as HTMLElement).closest<HTMLElement>("[data-x]")?.dataset.x; if (x === "later") el.remove(); if (x === "get") window.location.href = url; });
  },
});

import("./ui/app")
  .then(({ startApp }) => { startApp(document.getElementById("app")!); checkLayout(() => {}); })
  .catch(e => showProblem("Oyun açılamadı", `${e?.message ?? e}\n${(e?.stack ?? "").split("\n").slice(0, 5).join("\n")}`))
  .finally(updates);

// Ayarlar'daki "Güncellemeleri denetle" düğmesi
window.addEventListener("gelisim-guncelle", () => { updates(); });
