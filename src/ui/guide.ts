// İlk girişte öğüt: konuşanın portresi, sayfa sayfa kısa cümleler, en sonda "Başla". Bir kez gösterilir
// (s.story.flags.ogretici_<anahtar>); sonra doğrudan oyuna geçilir.
import type { GameState } from "../engine/state";
import { GUIDES } from "../content/guides";
import { artUrl } from "./art";
import { esc } from "./sketch";
import { sfx } from "./feel";

export function withGuide(key: keyof typeof GUIDES, s: GameState, run: () => void) {
  if (s.story.flags["ogretici_" + key] !== undefined) { run(); return; }
  const g = GUIDES[key]; let i = 0;
  const bg = document.createElement("div"); bg.className = "modal-bg guide-bg";
  const box = document.createElement("div"); box.className = "modal guide"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
  bg.appendChild(box); document.body.appendChild(bg);
  const pic = g.portrait ? artUrl(g.portrait) : undefined;
  const draw = () => {
    const last = i >= g.steps.length - 1;
    box.innerHTML = `<p class="hand muted" style="margin:0">${esc(g.title)}</p>
      <div class="guide-line">${pic ? `<img src="${pic}" alt="">` : ""}<div><div class="hand" style="font-size:20px">${esc(g.who)}</div><p style="margin:2px 0 0">${esc(g.steps[i])}</p></div></div>
      <div class="guide-dots">${g.steps.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("")}</div>
      <div class="row"><button class="btn small" data-g="skip">Geç</button><span style="flex:1"></span>${i > 0 ? `<button class="btn small" data-g="back">Geri</button>` : ""}<button class="btn primary" data-g="next">${last ? "Başla" : "Sonraki"}</button></div>`;
  };
  box.addEventListener("click", e => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-g]"); if (!b) return;
    if (b.dataset.g === "back") { i = Math.max(0, i - 1); sfx("page"); draw(); return; }
    if (b.dataset.g === "next" && i < g.steps.length - 1) { i++; sfx("page"); draw(); return; }
    s.story.flags["ogretici_" + key] = s.day; bg.remove(); sfx("tap"); run();
  });
  draw();
}
