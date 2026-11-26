// Telefonda bir şey ters giderse boş ekran yerine ne olduğunu gösterir.
// Ayrıca açılışta arayüzün gerçekten ekranda olduğunu denetler; değilse tanı bilgisini gösterir.
import { Capacitor } from "@capacitor/core";
import { APP_VERSION } from "./update";

let shown = false;
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export function showProblem(title: string, detail: string) {
  if (shown) return; shown = true;
  const el = document.createElement("div");
  el.setAttribute("role", "alertdialog");
  el.style.cssText = "position:fixed;inset:0;z-index:9999;background:#EAE0C8;color:#2A2722;padding:calc(env(safe-area-inset-top,0px) + 20px) 18px 20px;overflow:auto;font-family:Georgia,serif;font-size:15px;line-height:1.45";
  el.innerHTML = `<h2 style="font-size:24px;margin:0 0 8px">${esc(title)}</h2>
    <p style="margin:0 0 10px">Ekranın görüntüsünü alıp gönderirsen sorunu bulabilirim. Kaydın silinmedi.</p>
    <pre style="white-space:pre-wrap;word-break:break-word;background:rgba(0,0,0,.06);padding:10px;border-radius:6px;font-size:12px;margin:0 0 14px">${esc(detail)}</pre>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button data-a="reload" style="font:inherit;padding:10px 14px;border:1.5px solid #2A2722;background:#2A2722;color:#EAE0C8;border-radius:6px">Yeniden yükle</button>
      ${Capacitor.isNativePlatform() ? `<button data-a="reset" style="font:inherit;padding:10px 14px;border:1.5px solid #9E3423;background:transparent;color:#9E3423;border-radius:6px">Önceki sürüme dön</button>` : ""}
    </div>`;
  document.body.appendChild(el);
  el.addEventListener("click", async e => {
    const a = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-a]")?.dataset.a;
    if (a === "reload") location.reload();
    if (a === "reset") { try { const { CapacitorUpdater } = await import("@capgo/capacitor-updater"); await CapacitorUpdater.reset({ toLastSuccessful: true }); } catch { location.reload(); } }
  });
}

export function installErrorScreen() {
  window.addEventListener("error", e => showProblem("Bir hata oluştu", `${e.message}\n${e.filename ?? ""}:${e.lineno ?? ""}\nSürüm ${APP_VERSION}`));
  window.addEventListener("unhandledrejection", e => {
    const r = e.reason as { message?: string; stack?: string } | undefined;
    // güncelleme denetimindeki ağ hataları sessiz geçsin
    if (String(r?.message ?? r).match(/fetch|network|abort/i)) return;
    showProblem("Bir hata oluştu", `${r?.message ?? String(r)}\n${(r?.stack ?? "").split("\n").slice(0, 4).join("\n")}\nSürüm ${APP_VERSION}`);
  });
}

function layoutReport(): { ok: boolean; text: string } {
  const head = document.querySelector(".status"), nav = document.querySelector(".tabs"), main = document.querySelector("main");
  const vh = window.innerHeight, vw = window.innerWidth, vv = window.visualViewport;
  const r = (el: Element | null) => { if (!el) return "yok"; const b = el.getBoundingClientRect(); return `${Math.round(b.top)}..${Math.round(b.bottom)}`; };
  const desc = (el: Element) => { const cs = getComputedStyle(el); return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${el.className && typeof el.className === "string" ? "." + el.className.split(" ").join(".") : ""} [${cs.position} z${cs.zIndex}]`; };
  const stack = document.elementsFromPoint(vw / 2, vh / 2).slice(0, 5).map(desc).join(" > ");
  const h = head?.getBoundingClientRect(), n = nav?.getBoundingClientRect(), m = main?.getBoundingClientRect();
  const top = h ? document.elementFromPoint(vw / 2, Math.max(1, h.top + h.height / 2)) : null;
  const ok = !!(h && n && m && h.height > 10 && h.top > -5 && h.top < vh / 2 && n.bottom <= vh + 5 && n.top > vh / 2 && m.height > 60 && top && head!.contains(top));
  return { ok, text: [
    `Sürüm ${APP_VERSION}`,
    `pencere ${vw}×${vh}, görünür ${vv ? `${Math.round(vv.width)}×${Math.round(vv.height)}` : "?"}, dpr ${window.devicePixelRatio}`,
    `kaydırma ${window.scrollX},${window.scrollY} · belge ${document.documentElement.scrollHeight}`,
    `üst şerit ${r(head)} · içerik ${r(main)} · sekmeler ${r(nav)}`,
    `üst şeridin üstündeki: ${top ? desc(top) : "?"}`,
    `ortadaki katmanlar: ${stack}`,
    navigator.userAgent,
  ].join("\n") };
}

/** Açılıştan sonra üst şerit ve sekmeler gerçekten görünüyor mu? Pencere açıksa kapanmasını bekler. */
export function checkLayout(onOk: () => void) {
  let tries = 0;
  const tick = () => {
    if (document.querySelector(".intro, .battle[role=dialog], .modal-bg, .session-screen, .minigame, .siege")) { if (tries++ < 60) setTimeout(tick, 2000); else onOk(); return; }
    const rep = layoutReport();
    if (rep.ok) onOk(); else showProblem("Ekran düzgün yerleşmedi", rep.text);
  };
  setTimeout(tick, 2500);
  // elle tanı: ekrana 2 saniye basılı tut
  let timer = 0;
  // oyun alanlarında (mini oyun, savaş haritası) basılı tutmak oyunun parçası; tanı açılmasın
  window.addEventListener("pointerdown", e => { clearTimeout(timer); if ((e.target as Element | null)?.closest?.("canvas, .minigame, .qt, .siege")) return; timer = window.setTimeout(() => { shown = false; showProblem("Tanı bilgisi", layoutReport().text); }, 2000); });
  for (const ev of ["pointerup", "pointercancel", "pointermove"]) window.addEventListener(ev, () => clearTimeout(timer));
}
