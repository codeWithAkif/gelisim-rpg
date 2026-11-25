// Açılış: annenin defterinden sayfalar, sonra oyuncunun adını defterin ilk boş sayfasına yazması.
import { INTRO, type IntroPage } from "../content/story";
import { esc, roughPath } from "./sketch";
import { artUrl } from "./art";

export function art(kind: IntroPage["art"]): string {
  // çizilmiş sahne görseli varsa o (hikaye_<tür>.webp), yoksa eskiz
  const url = artUrl("hikaye_" + kind);
  if (url) return `<img class="story-art" src="${url}" alt="">`;
  const g = (d: string, extra = "") => `<path d="${d}" ${extra}/>`;
  let body = "";
  if (kind === "defter") {
    body = g(roughPath([[40, 40], [118, 30], [120, 150], [42, 158]], 1.5, 1, true)) + g(roughPath([[120, 30], [200, 40], [198, 158], [120, 150]], 1.5, 2, true))
      + [0, 1, 2, 3, 4].map(i => g(roughPath([[54, 62 + i * 16], [108, 58 + i * 16]], 1, 10 + i), `opacity=".5"`)).join("")
      + g(roughPath([[134, 70], [150, 54], [166, 70], [150, 92], [134, 70]], 1, 20), `stroke="var(--red)"`)
      + g(roughPath([[134, 112], [186, 108]], 1, 21), `opacity=".5"`) + g(roughPath([[134, 126], [176, 123]], 1, 22), `opacity=".5"`);
  } else if (kind === "yangin") {
    body = g(roughPath([[20, 150], [20, 110], [44, 110], [44, 90], [62, 90], [62, 120], [86, 120], [86, 70], [100, 58], [114, 70], [114, 112], [140, 112], [140, 96], [164, 96], [164, 130], [190, 130], [190, 104], [210, 104], [210, 150]], 1.6, 3))
      + [[60, 84], [104, 52], [150, 88], [196, 98]].map(([x, y], i) => g(roughPath([[x - 10, y], [x - 4, y - 18], [x, y - 8], [x + 5, y - 26], [x + 10, y]], 1.4, 30 + i), `stroke="var(--red)"`)).join("")
      + [0, 1, 2, 3, 4, 5].map(i => g(`M${30 + i * 32},${40 + (i % 2) * 8} q6,-8 12,0`, `opacity=".4"`)).join("");
  } else if (kind === "kar") {
    body = [0, 1, 2].map(i => { const a = i * Math.PI / 3; const c = Math.cos(a) * 46, s = Math.sin(a) * 46;
      return g(roughPath([[100 - c, 92 - s], [100 + c, 92 + s]], 1, 40 + i), `stroke="var(--blue)"`); }).join("")
      + g(roughPath([[170, 40], [170, 130]], 1, 50)) + `<circle cx="170" cy="140" r="9" fill="none"/>` + g(roughPath([[170, 112], [170, 136]], 0.5, 51), `stroke="var(--red)" stroke-width="3"`)
      + [0, 1, 2, 3].map(i => g(`M164,${54 + i * 18} h12`)).join("");
  } else {
    body = g(roughPath([[0, 120], [50, 96], [96, 104], [150, 80], [220, 92]], 1.5, 60))
      + g(roughPath([[96, 160], [104, 140], [112, 124], [118, 110], [122, 100]], 1.4, 61)) + g(roughPath([[140, 160], [132, 140], [128, 124], [126, 110], [125, 100]], 1.4, 62))
      + [[150, 76], [168, 72], [186, 78]].map(([x, y], i) => g(roughPath([[x - 7, y], [x - 7, y - 10], [x, y - 17], [x + 7, y - 10], [x + 7, y]], 0.8, 70 + i))).join("")
      + `<circle cx="46" cy="44" r="14" fill="none" stroke="var(--red)" opacity=".7"/>`;
  }
  return `<svg viewBox="0 0 220 170" width="100%" style="max-width:300px" aria-hidden="true"><g fill="none" stroke="var(--ink)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
}

export function showIntro(onDone: (name: string) => void) {
  const el = document.createElement("div");
  el.className = "intro"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Giriş");
  document.body.appendChild(el);
  let i = 0;
  const render = () => {
    if (i < INTRO.length) {
      const p = INTRO[i];
      el.innerHTML = `<div class="intro-page" key="${i}">
        <div class="intro-art">${art(p.art)}</div>
        <h1>${esc(p.title)}</h1><p class="intro-text">${esc(p.text)}</p>
        <div class="intro-foot"><span class="muted">${i + 1} / ${INTRO.length + 1}</span>
          <span class="row">${i > 0 ? `<button class="btn small" data-x="back">Geri</button>` : `<button class="btn small" data-x="skip">Atla</button>`}<button class="btn primary" data-x="next">Devam</button></span></div></div>`;
    } else {
      el.innerHTML = `<div class="intro-page">
        <div class="intro-art">${art("defter")}</div>
        <h1>İlk boş sayfa</h1><p class="intro-text">Annemin defterinin ilk boş sayfasına adımı yazıyorum. Bundan sonrası benim.</p>
        <label for="introName" class="hand">Adın</label>
        <input id="introName" class="name-input" maxlength="18" autocomplete="off" value="" placeholder="Yolcu">
        <div class="intro-foot"><button class="btn small" data-x="back">Geri</button><button class="btn primary" data-x="start">Yaz ve başla</button></div></div>`;
      setTimeout(() => el.querySelector<HTMLInputElement>("#introName")?.focus(), 50);
    }
  };
  el.addEventListener("click", e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-x]"); if (!b) return;
    const x = b.dataset.x;
    if (x === "next") i++; else if (x === "back") i = Math.max(0, i - 1); else if (x === "skip") i = INTRO.length;
    else if (x === "start") {
      const name = (el.querySelector<HTMLInputElement>("#introName")?.value ?? "").trim().slice(0, 18) || "Yolcu";
      el.remove(); onDone(name); return;
    }
    render();
  });
  el.addEventListener("keydown", e => { if (e.key === "Enter" && (e.target as HTMLElement).id === "introName") el.querySelector<HTMLButtonElement>('[data-x="start"]')?.click(); });
  render();
}
