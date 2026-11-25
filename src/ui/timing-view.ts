// Savaşta zamanlama komutu: halka ortadaki daireye kapanınca dokun.
// Saldırıda iyi an isabet ve kritiği artırır; kurt atılırken iyi an kaçmayı sağlar.
import { grade } from "../engine/timing";
import { sfx, buzz } from "./feel";

/** host üzerinde kısa bir komut gösterir; 0–1 kalite döner. */
export function quickTiming(host: HTMLElement, kind: "attack" | "dodge", win: number): Promise<number> {
  return new Promise(resolve => {
    const el = document.createElement("div"); el.className = "qt " + kind;
    const label = kind === "attack" ? "Vur!" : "Kurt atılıyor, kaç!";
    el.innerHTML = `<div class="qt-box"><canvas></canvas><div class="qt-label hand">${label}</div><div class="qt-result hand"></div></div>`;
    host.appendChild(el);
    const cv = el.querySelector("canvas")!; const S = 200; const dpr = window.devicePixelRatio || 1;
    cv.width = S * dpr; cv.height = S * dpr; cv.style.width = cv.style.height = S + "px";
    const g = cv.getContext("2d")!; g.scale(dpr, dpr);
    const cs = getComputedStyle(document.documentElement); const ink = cs.getPropertyValue("--ink").trim(), col = cs.getPropertyValue(kind === "attack" ? "--blue" : "--red").trim();
    const lead = kind === "attack" ? 650 : 450; // halka görünmeden önceki bekleme (kurt daha ani)
    const dur = kind === "attack" ? 1000 : 850 + Math.random() * 250;
    const t0 = performance.now() + lead; let done = false; let raf = 0;
    const end = (q: number, text: string) => {
      if (done) return; done = true; cancelAnimationFrame(raf);
      const r = el.querySelector<HTMLElement>(".qt-result")!; r.textContent = text; r.dataset.q = q >= 1 ? "1" : q >= 0.6 ? "g" : "0";
      if (q >= 1) { sfx("perfect"); buzz("medium"); } else if (q >= 0.6) sfx("good"); else sfx("bad");
      setTimeout(() => { el.remove(); resolve(q); }, 520);
    };
    const tap = (e: Event) => {
      e.preventDefault(); e.stopPropagation(); const now = performance.now();
      if (now < t0) { end(0, kind === "attack" ? "Çok erken" : "Erken davrandın"); return; }
      const gr = grade((now - (t0 + dur)) / dur, win); end(gr.q, gr.label);
    };
    el.addEventListener("pointerdown", tap);
    const loop = () => {
      const now = performance.now(); g.clearRect(0, 0, S, S);
      const R0 = 34; g.strokeStyle = ink; g.lineWidth = 3; g.beginPath(); g.arc(S / 2, S / 2, R0, 0, 7); g.stroke();
      if (now >= t0) {
        const p = Math.min(1.4, (now - t0) / dur); const r = R0 + Math.max(0, 1 - p) * 62;
        g.strokeStyle = col; g.lineWidth = 4; g.beginPath(); g.arc(S / 2, S / 2, r, 0, 7); g.stroke();
        if (p >= 1.35) { end(0, kind === "attack" ? "Geç kaldın" : "Geç kaldın"); return; }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  });
}
