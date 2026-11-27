// Sahne oynatıcı: hikâyenin büyük anlarını sinema gibi gösterir. Karanlık zemin, üstte ve altta şerit,
// yavaşça yakınlaşan görsel, satır satır beliren yazı, sahnenin kendi sesi. Dokun: satırı tamamla / sonraki.
// "Geç" sahneyi atlar (ad sorusu ve sis oyunu atlanmaz, onlara gelir). Veri: content/scenes.ts.
import { type Scene, type Beat, type Spot, SPEAKERS, sisSides, fill } from "../content/scenes";
import { artUrl } from "./art";
import { esc } from "./sketch";
import { sfx, sceneAmbience, bellCue, stepsBurst, oneShot } from "./feel";
import { animScale } from "./settings";

export interface SceneOpts { name?: string; seed?: number; onName?: (name: string) => void }

export function playScene(scene: Scene, opts: SceneOpts, onDone: () => void) {
  let name = opts.name ?? "";
  const el = document.createElement("div"); el.className = "scene"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Sahne");
  el.innerHTML = `<div class="sc-art"><img class="a" alt=""><img class="b" alt=""></div><div class="sc-shade"></div>
    <div class="sc-bar top"></div><div class="sc-bar bot"></div>
    <button class="sc-skip" data-s="skip">Geç ›</button>
    <div class="sc-stage" aria-live="polite"></div><div class="sc-tap" aria-hidden="true">dokun</div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("on"));
  const stage = el.querySelector<HTMLElement>(".sc-stage")!; const tapHint = el.querySelector<HTMLElement>(".sc-tap")!;
  const imgs = [el.querySelector<HTMLImageElement>(".sc-art .a")!, el.querySelector<HTMLImageElement>(".sc-art .b")!]; let front = 0;
  const speed = animScale();
  let i = -1; let typing: { full: string; node: HTMLElement; timer: number } | null = null; let waiting = false; let busy = false;

  const setArt = (key: string | null, night = false) => {
    el.classList.toggle("night", night);
    const url = key ? artUrl(key) : undefined; const next = imgs[1 - front];
    if (url) { next.src = url; next.classList.remove("zoom"); void next.offsetWidth; next.classList.add("zoom"); }
    next.classList.toggle("show", !!url); imgs[front].classList.remove("show"); front = 1 - front;
    el.classList.toggle("dark", !url);
  };
  const type = (node: HTMLElement, text: string) => {
    if (!speed) { node.textContent = text; return; }
    let k = 0; node.textContent = "";
    typing = { full: text, node, timer: window.setInterval(() => {
      k += 1; node.textContent = text.slice(0, k);
      if (k >= text.length) { clearInterval(typing!.timer); typing = null; tapHint.classList.add("on"); }
    }, 26 * speed) };
  };
  const show = (b: Extract<Beat, { t: "metin" } | { t: "soz" }>) => {
    tapHint.classList.remove("on");
    const text = fill(b.text, name);
    if (b.t === "soz") {
      const sp = SPEAKERS[b.who] ?? { name: b.who }; const pic = sp.portrait ? artUrl(sp.portrait) : undefined;
      stage.innerHTML = `<div class="sc-line soz${b.who === "sen" ? " sen" : ""}">${pic ? `<img class="sc-face" src="${pic}" alt="">` : ""}<div><div class="sc-who">${esc(sp.name)}</div><p class="sc-text"></p></div></div>`;
    } else stage.innerHTML = `<div class="sc-line ${b.voice === "anne" ? "anne" : "anlatici"}${b.center ? " center" : ""}"><p class="sc-text"></p></div>`;
    type(stage.querySelector<HTMLElement>(".sc-text")!, text);
    if (!speed) tapHint.classList.add("on");
  };
  const finish = () => {
    el.classList.remove("on"); el.classList.add("off"); sceneAmbience(null);
    setTimeout(() => { el.remove(); onDone(); }, 700 * Math.max(0.3, speed || 0.3));
  };

  /* ---------- ad sorusu ---------- */
  const askName = () => {
    busy = true; tapHint.classList.remove("on");
    stage.innerHTML = `<div class="sc-line soz"><div style="flex:1"><label class="sc-who" for="scName">Adın</label>
      <div class="sc-name"><input id="scName" maxlength="18" autocomplete="off" placeholder="Yolcu" value="${esc(name)}"><button class="btn primary" data-s="name">Söyle</button></div></div></div>`;
    const inp = stage.querySelector<HTMLInputElement>("#scName")!; setTimeout(() => inp.focus(), 60);
    const go = () => { name = inp.value.trim().slice(0, 18) || "Yolcu"; opts.onName?.(name); busy = false; sfx("page"); next(); };
    stage.querySelector("[data-s=name]")!.addEventListener("click", e => { e.stopPropagation(); go(); });
    inp.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
    inp.addEventListener("click", e => e.stopPropagation());
  };

  /* ---------- incele: görselin üstünde dokunarak bak ---------- */
  const inspect = (prompt: string, spots: Spot[]) => {
    busy = true; tapHint.classList.remove("on"); el.classList.add("inspect");
    const found = new Set<number>();
    stage.innerHTML = `<div class="sc-line anlatici center"><p class="sc-text">${esc(prompt)}</p><p class="sc-sub">Parlayan yerlere dokun (${spots.length}).</p></div>`;
    const layer = document.createElement("div"); layer.className = "sc-spots";
    layer.innerHTML = spots.map((p, k) => `<button class="sc-spot" data-k="${k}" style="left:${(p.x * 100).toFixed(1)}%;top:${(p.y * 100).toFixed(1)}%" aria-label="${esc(p.label)}"><i></i><span>${esc(p.label)}</span></button>`).join("");
    el.appendChild(layer);
    layer.addEventListener("click", e => {
      e.stopPropagation();
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-k]"); if (!b) return;
      const k = +b.dataset.k!; if (found.has(k)) return; found.add(k); b.classList.add("seen"); sfx("page");
      stage.innerHTML = `<div class="sc-line anlatici"><p class="sc-text">${esc(spots[k].text)}</p>${found.size < spots.length ? `<p class="sc-sub">${spots.length - found.size} yer daha.</p>` : ""}</div>`;
      if (found.size >= spots.length) setTimeout(() => { layer.remove(); el.classList.remove("inspect"); busy = false; tapHint.classList.add("on"); }, 400);
    });
  };

  /* ---------- sis: çanın sesini izle ---------- */
  const fog = () => {
    busy = true; tapHint.classList.remove("on"); el.classList.add("fog");
    const sides = sisSides(opts.seed ?? Date.now()); let r = 0;
    stage.innerHTML = `<div class="sc-line anlatici center"><p class="sc-text">Sis o kadar koyu ki elimi göremiyorum. Bir yerden çan sesi geliyor.</p>
      <p class="sc-sub">Sesin geldiği yana dokun.</p></div>`;
    const halves = document.createElement("div"); halves.className = "sc-fog";
    halves.innerHTML = `<button class="sc-half l" data-side="0" aria-label="Sol"><i></i></button><button class="sc-half r" data-side="1" aria-label="Sağ"><i></i></button>
      <button class="btn small sc-again" data-s="again">Sesi yeniden dinle</button>`;
    el.appendChild(halves);
    const cue = () => {
      const side = sides[r]; bellCue(side ? 0.9 : -0.9);
      // sesi duyamayan için: o yanda belli belirsiz bir fener ışığı
      const glow = halves.querySelector<HTMLElement>(side ? ".r i" : ".l i")!; glow.classList.remove("on"); void glow.offsetWidth; glow.classList.add("on");
    };
    const say = (t: string) => { const p = stage.querySelector<HTMLElement>(".sc-text"); if (p) p.textContent = t; };
    setTimeout(cue, 900);
    halves.addEventListener("click", e => {
      e.stopPropagation();
      const t = e.target as HTMLElement;
      if (t.closest("[data-s=again]")) { cue(); return; }
      const b = t.closest<HTMLElement>("[data-side]"); if (!b) return;
      if (+b.dataset.side! === sides[r]) {
        r++; stepsBurst();
        if (r >= sides.length) { say("Çan sesi artık hemen önümde. Sis aralanıyor."); setTimeout(() => { halves.remove(); el.classList.remove("fog"); busy = false; next(); }, 1600); return; }
        say(["Ses yaklaşıyor. Bir çan daha.", "Taşlara basa basa ilerliyorum. Çan yine çalıyor."][r - 1] ?? "Yaklaşıyorum.");
        setTimeout(cue, 1100);
      } else { say("Hayır… ses öbür yandan geliyor."); sfx("bad"); setTimeout(cue, 900); }
    });
  };

  function next() {
    if (busy) return;
    if (typing) { clearInterval(typing.timer); typing.node.textContent = typing.full; typing = null; tapHint.classList.add("on"); return; }
    if (waiting) return;
    el.classList.remove("titlecard");
    while (++i < scene.beats.length) {
      const b = scene.beats[i];
      if (b.t === "ses") { sceneAmbience(b.layers); continue; }
      if (b.t === "gorsel") { setArt(b.art, !!b.gece); continue; }
      if (b.t === "tek") { oneShot(b.id, b.vol); continue; }
      if (b.t === "incele") { inspect(b.prompt, b.spots); return; }
      if (b.t === "baslik") { el.classList.add("titlecard"); stage.innerHTML = `<div class="sc-line sc-title"><p class="sc-big">${esc(b.text)}</p>${b.sub ? `<p class="sc-small">${esc(b.sub)}</p>` : ""}</div>`; tapHint.classList.add("on"); return; }
      if (b.t === "bekle") { waiting = true; stage.innerHTML = ""; setTimeout(() => { waiting = false; next(); }, b.ms * Math.max(0.3, speed || 0.3)); return; }
      if (b.t === "ad") { askName(); return; }
      if (b.t === "sis") { fog(); return; }
      show(b); return;
    }
    finish();
  }
  el.addEventListener("click", e => {
    if ((e.target as HTMLElement).closest("[data-s=skip]")) {
      e.stopPropagation(); if (busy) return;
      if (typing) { clearInterval(typing.timer); typing = null; }
      // atla: bir sonraki etkileşime ya da sona (ses ve görsel güncellenir)
      while (++i < scene.beats.length) {
        const b = scene.beats[i];
        if (b.t === "ses") sceneAmbience(b.layers); else if (b.t === "gorsel") setArt(b.art, !!b.gece);
        else if (b.t === "ad") { askName(); return; } else if (b.t === "sis") { fog(); return; } else if (b.t === "incele") { inspect(b.prompt, b.spots); return; }
      }
      finish(); return;
    }
    next();
  });
  setTimeout(next, 500);
}
