// Harabe araması ekranı: yan kesit, çok katlı yapı. Dokun: oraya yürür; mercek simgesine dokun: arar; çıkışa varınca çıkarsın.
import type { Config } from "../engine/config";
import type { GameState } from "../engine/state";
import {
  type Scav, SW, EXIT_X, LADDER_XS, createScav, stepScav, goTo, goToSpot, goToExit, leave, atExit, rerollScav, pickScavCard, finishScav, scavSite, canStartScav,
  SCARDS, bagUsed, searchTime, danger, SCAV_ENERGY, type ScavResult,
} from "../engine/scavenge";
import { hasBow } from "../engine/gear";
import { itemInfo } from "../engine/inventory";
import { ENEMIES } from "../content/world";
import { artUrl, itemPic } from "./art";
import { esc } from "./sketch";
import { sfx, buzz } from "./feel";
import { quad, drawQuad, walkFrame } from "./anim";

const imgCache = new Map<string, HTMLImageElement | null>();
const img = (key: string) => { if (!imgCache.has(key)) { const u = artUrl(key); imgCache.set(key, u ? Object.assign(new Image(), { src: u }) : null); } const i = imgCache.get(key)!; return i && i.complete && i.naturalWidth ? i : null; };
const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || "#2A2722";

/** Başlamadan önce: yapı hakkında bilgi, yay/ok durumu, başlat düğmesi. */
export function openScavHub(cfg: Config, s: GameState, place: string, persist: () => void, onEnd: (r: ScavResult) => void) {
  const site = scavSite(place)!; const bg = document.createElement("div"); bg.className = "modal-bg";
  const can = canStartScav(s, place); const arrows = Math.min(12, s.inventory.ok ?? 0);
  bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><p class="hand muted" style="margin:0">Harabe araması</p><h2>${esc(site.name)}</h2>
    <p style="margin:0">${esc(site.desc)}</p>
    <p class="tiny" style="margin:0">Odaları gez, mercek simgelerine dokunup ara. Sayaç dolunca <b>baskın</b> gelir. ${hasBow(s) && arrows > 0 ? `Yayınla ${arrows} okla uzaktan vurursun.` : hasBow(s) ? "<b>Okun yok</b>; yakın dövüşürsün." : "<b>Yayın yok</b>; yakın dövüşte elindeki silahla vurursun."}
      Bulduklarını çantanda (8 göz) taşırsın; <b>çıkışa varırsan</b> hepsi senin, <b>ölürsen</b> çanta gider.</p>
    <div class="odds"><span>Kat <b>${site.floors}</b></span><span>Enerji <b>−${SCAV_ENERGY}</b></span><span>Süre <b>~30 dk</b></span></div>
    ${can.ok ? "" : `<p class="tiny red" style="margin:0">${esc(can.reason ?? "")}</p>`}
    <div class="row"><button class="btn" data-x="close">Kapat</button><span style="flex:1"></span><button class="btn primary" data-x="go" ${can.ok ? "" : "disabled"}>Gir</button></div></div>`;
  document.body.appendChild(bg);
  bg.addEventListener("click", e => { const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button"); if (!b || b.disabled) return; bg.remove(); if (b.dataset.x === "go") openScav(cfg, s, place, persist, onEnd); });
}

export function openScav(cfg: Config, s: GameState, place: string, persist: () => void, onEnd: (r: ScavResult) => void) {
  const site = scavSite(place)!; const n: Scav = createScav(cfg, s, site, (s.seed * 29 + s.day * 811 + Math.floor(s.minute)) | 0);
  const el = document.createElement("div"); el.className = "siege nobet scav"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Harabe araması");
  el.innerHTML = `<div class="nb-top"><button class="btn small" data-c="pause">Ⅱ</button><div class="sc-hud"><span id="scMoney"></span><span id="scRaid"></span><span id="scDanger"></span></div></div>
    <div class="siege-stage"><canvas></canvas><div class="nb-tip" id="scTip"></div></div>
    <div class="nb-hp"><div class="gb"><div class="gf" id="scHp" style="background:var(--red)"></div></div><span id="scHpT"></span></div>
    <div class="sc-bar"><span id="scAmmo"></span><span id="scBag"></span><button class="btn small primary" data-c="exit" id="scExit" hidden>Çık</button></div>
    <div class="nb-card" id="scCard" hidden></div><div class="nb-card" id="scPause" hidden></div>`;
  document.body.appendChild(el);
  const cv = el.querySelector("canvas")!; const stage = el.querySelector<HTMLElement>(".siege-stage")!; const g = cv.getContext("2d")!;
  const cardEl = el.querySelector<HTMLElement>("#scCard")!; const pauseEl = el.querySelector<HTMLElement>("#scPause")!; const tip = el.querySelector<HTMLElement>("#scTip")!;
  let W = 300, H = 400, paused = false, raf = 0, ended = false, last = performance.now(); let shake = 0; let walkT = 0;
  const pops: { x: number; floor: number; t: number; text: string; color: string }[] = []; const shots: { a: number; b: number; floor: number; t: number }[] = [];
  const F = site.floors; const VIEW = 84;
  const layout = () => { const r = stage.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1; W = r.width; H = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + "px"; cv.style.height = H + "px"; g.setTransform(dpr, 0, 0, dpr, 0, 0); };
  const sc = () => W / VIEW; const camX = () => Math.max(VIEW / 2, Math.min(SW - VIEW / 2, n.px));
  const X = (x: number) => (x - camX()) * sc() + W / 2;
  const fh = () => Math.min(H / F, 300);
  const top = () => (H - fh() * F) / 2;
  const floorBottom = (f: number) => top() + fh() * (F - f);           // f=0 en altta
  const groundY = (f: number) => floorBottom(f) - 10;
  window.addEventListener("resize", layout); const ro = new ResizeObserver(() => layout()); ro.observe(stage);

  /* ---------- çizim yardımcıları ---------- */
  function figure(key: string, x: number, f: number, h: number, faceRight: boolean, alpha = 1) {
    const im = img(key); if (!im) return false; const hh = h * sc(), w = hh * im.naturalWidth / im.naturalHeight;
    g.save(); g.globalAlpha = alpha; g.translate(X(x), groundY(f)); if (faceRight) g.scale(-1, 1); g.drawImage(im, -w / 2, -hh, w, hh); g.restore(); return true;
  }
  function room(f: number, dim: boolean) {
    const y0 = floorBottom(f) - fh(), y1 = floorBottom(f); const ink = css("--ink");
    g.fillStyle = f === 0 && site.floors > 1 ? "#6F6450" : "#7C705A"; g.fillRect(0, y0, W, fh());
    // tuğla/tahta çizgileri
    g.strokeStyle = "rgba(0,0,0,.12)"; g.lineWidth = 1; for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(0, y0 + (fh() / 5) * k); g.lineTo(W, y0 + (fh() / 5) * k); g.stroke(); }
    // oda ayırıcı duvarlar (x=100, 200)
    g.strokeStyle = "rgba(20,16,10,.55)"; g.lineWidth = 3; for (const wx of [100, 200]) { const px = X(wx); g.beginPath(); g.moveTo(px, y0); g.lineTo(px, y0 + fh() * 0.12); g.moveTo(px, y0 + fh() * 0.78); g.lineTo(px, y1); g.stroke(); }
    // zemin ve tavan
    g.fillStyle = "#2A2218"; g.fillRect(0, y1 - 10, W, 10); g.fillRect(0, y0, W, 5);
    g.strokeStyle = ink; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, y1 - 10); g.lineTo(W, y1 - 10); g.stroke();
    if (dim) { g.fillStyle = "rgba(10,8,6,.55)"; g.fillRect(0, y0, W, fh()); }
  }
  function ladders() {
    for (let gap = 0; gap < F - 1; gap++) {
      const x = X(LADDER_XS[gap % 2]); const yLow = floorBottom(gap) - 10, yHigh = floorBottom(gap + 1) - 10;
      g.strokeStyle = "#3A2A1A"; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 9, yLow); g.lineTo(x - 9, yHigh); g.moveTo(x + 9, yLow); g.lineTo(x + 9, yHigh); g.stroke();
      g.lineWidth = 2; for (let y = yLow - 8; y > yHigh + 4; y -= 11) { g.beginPath(); g.moveTo(x - 9, y); g.lineTo(x + 9, y); g.stroke(); }
    }
  }
  function furniture(name: string, x: number, f: number, done: boolean) {
    const px = X(x), gy = groundY(f) + 10, w = 22 * sc() / 2.4, h = 16 * sc() / 2.4; g.save(); g.globalAlpha = done ? 0.55 : 1; g.strokeStyle = "#1E160E"; g.lineWidth = 1.6;
    g.fillStyle = /Fıçı/.test(name) ? "#7A5A34" : /Yatak/.test(name) ? "#8E8A6A" : /Dolap|Raf/.test(name) ? "#6B4E2E" : "#835F36";
    if (/Fıçı/.test(name)) { g.beginPath(); g.ellipse(px, gy - h / 2, w * 0.45, h / 2, 0, 0, 7); g.fill(); g.stroke(); g.beginPath(); g.moveTo(px - w * 0.45, gy - h * 0.7); g.lineTo(px + w * 0.45, gy - h * 0.7); g.stroke(); }
    else if (/Çuval/.test(name)) { g.beginPath(); g.moveTo(px - w * 0.4, gy); g.quadraticCurveTo(px - w * 0.55, gy - h, px - w * 0.15, gy - h * 1.1); g.lineTo(px + w * 0.15, gy - h * 1.1); g.quadraticCurveTo(px + w * 0.55, gy - h, px + w * 0.4, gy); g.closePath(); g.fillStyle = "#A69870"; g.fill(); g.stroke(); }
    else if (/Dolap|Raf/.test(name)) { g.fillRect(px - w * 0.45, gy - h * 1.9, w * 0.9, h * 1.9); g.strokeRect(px - w * 0.45, gy - h * 1.9, w * 0.9, h * 1.9); g.beginPath(); g.moveTo(px, gy - h * 1.9); g.lineTo(px, gy); g.moveTo(px - w * 0.45, gy - h); g.lineTo(px + w * 0.45, gy - h); g.stroke(); }
    else { g.fillRect(px - w * 0.5, gy - h, w, h); g.strokeRect(px - w * 0.5, gy - h, w, h); g.beginPath(); g.moveTo(px - w * 0.5, gy - h * 0.6); g.lineTo(px + w * 0.5, gy - h * 0.6); g.stroke(); }
    g.restore();
  }
  function lens(x: number, f: number, prog: number, done: boolean, near: boolean, now: number) {
    const px = X(x), py = groundY(f) - 26 * sc() / 2.4 - Math.sin(now / 300 + x) * 2; const r = 9 * sc() / 2.4 + 3;
    g.save(); g.globalAlpha = done ? 0.35 : 1; g.strokeStyle = done ? "#9AA" : "#F2E7C9"; g.lineWidth = 3;
    g.fillStyle = "rgba(255,255,255,.15)"; g.beginPath(); g.arc(px, py, r, 0, 7); g.fill(); g.stroke();
    g.strokeStyle = "#2E4C7A"; g.lineWidth = 2; g.beginPath(); g.arc(px, py, r - 2, 0, 7); g.stroke();
    g.strokeStyle = "#F2E7C9"; g.lineWidth = 4; g.lineCap = "round"; g.beginPath(); g.moveTo(px + r * 0.7, py + r * 0.7); g.lineTo(px + r * 1.5, py + r * 1.5); g.stroke();
    if (done) { g.strokeStyle = "#6FBF4A"; g.lineWidth = 3; g.beginPath(); g.moveTo(px - 4, py); g.lineTo(px - 1, py + 3); g.lineTo(px + 5, py - 4); g.stroke(); }
    if (prog > 0 && !done) { g.strokeStyle = "#F1C14A"; g.lineWidth = 4; g.beginPath(); g.arc(px, py, r + 5, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2); g.stroke(); }
    void near; g.restore();
  }

  function draw(now: number) {
    g.save(); if (shake > 0) g.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    g.fillStyle = "#14110C"; g.fillRect(-10, -10, W + 20, H + 20);
    for (let f = F - 1; f >= 0; f--) {
      const cur = f === (n.climb ? n.climb.to : n.floor) || f === n.floor; room(f, !cur);
      for (const sp of n.spots) if (sp.floor === f) furniture(sp.name, sp.x, f, sp.done);
    }
    ladders();
    // çıkış
    { const ex = X(EXIT_X), gy = groundY(0); g.fillStyle = "#2E4C7A"; g.beginPath(); g.moveTo(ex + 18, gy - 26); g.lineTo(ex - 4, gy - 14); g.lineTo(ex + 18, gy - 2); g.closePath(); g.fill();
      g.fillStyle = "#EFE6CC"; g.font = `700 ${Math.max(13, sc() * 1.9)}px Caveat, cursive`; g.textAlign = "left"; g.fillText("Çıkış", ex + 22, gy - 10); }
    for (const sp of n.spots) lens(sp.x, sp.floor, sp.prog, sp.done, Math.abs(sp.x - n.px) < 4, now);
    // düşmanlar
    for (const f of n.foes) {
      const d = ENEMIES[f.def]; const h = (f.def === "kurt" || f.def === "kar_kurdu" ? 13 : 21) * (d?.scale ?? 1); const right = n.px > f.x;
      const key = artUrl("dusman_" + f.def) ? "dusman_" + f.def : "dusman_kurt"; const climbing = f.climbT > 0;
      const wq = quad("anim_kurt_yuru", walkFrame(now / 1000 * 2.2)); void wq;
      if (!figure(key, f.x, f.floor, h, key === "dusman_kurt" ? right : !right, climbing ? 0.5 : 1)) { g.fillStyle = "#B03A2A"; g.beginPath(); g.arc(X(f.x), groundY(f.floor) - 12, 7, 0, 7); g.fill(); }
      if (f.hp < f.max) { const w = 26, yy = groundY(f.floor) - h * sc() - 6; g.fillStyle = "rgba(20,16,10,.8)"; g.fillRect(X(f.x) - w / 2, yy, w, 4); g.fillStyle = "#D9503A"; g.fillRect(X(f.x) - w / 2, yy, w * Math.max(0, f.hp / f.max), 4); }
    }
    // sen
    { const moving = !!n.target && !n.climb && Math.abs((n.target?.x ?? n.px) - n.px) > 1; const climbing = !!n.climb;
      const x = n.px; const f = n.climb ? (n.climb.t > 0.55 ? n.floor : n.climb.to) : n.floor;
      const q = n.bow && n.atkFx > 0 ? quad("anim_kahraman_yay", 4) : moving ? quad("anim_kahraman_yuru", walkFrame(walkT)) : null; walkT += moving ? 0.07 : 0;
      if (q) { const hh = 20 * sc(); drawQuad(g, q, X(x), groundY(f), hh, n.face === 1); }
      else figure(n.atkFx > 0 ? "poz_kahraman_vurus" : "poz_kahraman_durus", x, f, 20, n.face === 1, climbing ? 0.7 : 1);
      if (n.searchT) { g.fillStyle = "#F1C14A"; g.font = `700 ${Math.max(14, sc() * 2)}px Caveat, cursive`; g.textAlign = "center"; g.fillText("aranıyor…", X(x), groundY(f) - 20 * sc() - 6); } }
    // ok izleri ve yazılar
    for (const sh of [...shots]) { const a = (now - sh.t) / 160; if (a > 1) { shots.splice(shots.indexOf(sh), 1); continue; } g.strokeStyle = `rgba(255,245,210,${1 - a})`; g.lineWidth = 2; g.beginPath(); g.moveTo(X(sh.a), groundY(sh.floor) - 12 * sc()); g.lineTo(X(sh.b), groundY(sh.floor) - 8 * sc()); g.stroke(); }
    for (const p of [...pops]) { const a = (now - p.t) / 1100; if (a > 1) { pops.splice(pops.indexOf(p), 1); continue; } g.globalAlpha = 1 - a; g.fillStyle = p.color; g.strokeStyle = "rgba(0,0,0,.7)"; g.lineWidth = 3; g.font = `700 ${Math.max(16, sc() * 2.3)}px Caveat, cursive`; g.textAlign = "center";
      const px = X(p.x), py = groundY(p.floor) - 24 * sc() / 2.4 - a * 26; g.strokeText(p.text, px, py); g.fillText(p.text, px, py); g.globalAlpha = 1; }
    g.restore();
  }

  /* ---------- HUD ---------- */
  const q = (id: string) => el.querySelector<HTMLElement>(id)!;
  function hud() {
    q("#scMoney").textContent = `◉ ${n.money}`; q("#scRaid").textContent = `Sıradaki baskın: ${Math.max(0, Math.ceil(n.raidT))} sn`; q("#scRaid").classList.toggle("hot", n.raidT < 10);
    q("#scDanger").textContent = `Tehlike ${danger(n)}`;
    (q("#scHp") as HTMLElement).style.width = `${Math.max(0, n.hp / n.maxHp * 100)}%`; q("#scHpT").textContent = `${Math.round(n.hp)}/${n.maxHp}`;
    q("#scAmmo").textContent = n.bow ? `Ok ${n.ammo}/${n.ammoMax}` : "Yakın dövüş"; q("#scBag").textContent = `Çanta ${bagUsed(n)}/${n.bagCap}`;
    (q("#scExit") as HTMLElement).hidden = !atExit(n);
  }
  function popFx() {
    for (const f of n.fx.splice(0)) {
      const now = performance.now();
      if (f.k === "loot") { const nm = f.text.replace(/^\+(\d+) ([a-z_]+)$/, (_m, c, id) => `+${c} ${itemInfo(cfg, id).name}`); pops.push({ x: f.x, floor: f.floor, t: now, text: nm, color: "#F4E3A1" }); sfx(f.text === "boş" ? "page" : "coin"); }
      if (f.k === "full") { pops.push({ x: f.x, floor: f.floor, t: now, text: "Çanta dolu!", color: "#E36A55" }); sfx("bad"); }
      if (f.k === "hit") pops.push({ x: f.x, floor: f.floor, t: now, text: `${f.crit ? "Kritik " : ""}${f.dmg}`, color: f.crit ? "#E36A55" : "#F2E7C9" });
      if (f.k === "hurt") { shake = Math.max(shake, 5); sfx("hurt"); buzz("light"); }
      if (f.k === "raid") { tip.hidden = false; tip.textContent = `Baskın! ${f.n} düşman geliyor`; setTimeout(() => { tip.hidden = true; }, 2200); sfx("beat"); buzz("medium"); }
      if (f.k === "shot") { shots.push({ a: f.from, b: f.to, floor: f.floor, t: now }); sfx("whoosh"); }
      if (f.k === "die") sfx("hit");
      if (f.k === "spot") sfx("good");
      if (f.k === "card") showCards();
    }
  }
  function showCards() {
    cardEl.hidden = false; sfx("perfect"); buzz("medium");
    const owned = Object.entries(n.cards).filter(([, v]) => v > 0);
    cardEl.innerHTML = `<p class="hand" style="margin:0;font-size:26px">Bir şey öğrendin</p><p class="tiny muted" style="margin:0">Birini seç; bu aramada seninle.</p>
      ${owned.length ? `<div class="nb-owned">${owned.map(([id, v]) => `<span class="nb-own"><b>${esc(SCARDS.find(c => c.id === id)?.name ?? id)}</b><i>${v}</i></span>`).join("")}</div>` : ""}
      ${n.offer.map(id => { const c = SCARDS.find(x => x.id === id)!; const lv = n.cards[id] ?? 0; const stars = Array.from({ length: c.max }, (_, k) => `<i class="${k <= lv ? "on" : ""}">★</i>`).join("");
        return `<button class="choice" data-card="${id}"><b>${esc(c.name)}${lv ? ` ${"I".repeat(lv + 1)}` : ""}</b><span>${esc(c.desc)}</span><em class="nb-stars">${stars}</em></button>`; }).join("")}
      <button class="btn small" data-reroll ${n.rerolls > 0 ? "" : "disabled"}>Yeniden dene (${n.rerolls}/2)</button>`;
  }
  cardEl.addEventListener("click", e => {
    if ((e.target as HTMLElement).closest("[data-reroll]")) { if (rerollScav(n)) { sfx("page"); showCards(); } else sfx("bad"); return; }
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-card]"); if (!b) return;
    if (pickScavCard(n, b.dataset.card!)) { cardEl.hidden = true; sfx("page"); }
  });

  /* ---------- dokunma ---------- */
  cv.addEventListener("pointerdown", e => {
    if (n.phase !== "play" || paused) return; const rc = cv.getBoundingClientRect(); const px = e.clientX - rc.left, py = e.clientY - rc.top;
    const wx = camX() + (px - W / 2) / sc(); let fl = F - 1; for (let f = 0; f < F; f++) if (py >= floorBottom(f) - fh() && py <= floorBottom(f)) fl = f;
    // arama noktası (mercek simgesine ya da mobilyaya)
    const sp = n.spots.filter(q => !q.done && q.floor === fl).sort((a, b) => Math.abs(a.x - wx) - Math.abs(b.x - wx))[0];
    if (sp && Math.abs(sp.x - wx) < 11) { goToSpot(n, sp.id); sfx("tap"); return; }
    if (fl === 0 && wx < EXIT_X + 14) { goToExit(n); sfx("tap"); return; }
    goTo(n, wx, fl); sfx("step");
  });
  el.querySelector(".nb-top")!.addEventListener("click", e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-c]"); if (!b || b.dataset.c !== "pause") return;
    paused = true; pauseEl.hidden = false; sfx("page");
    pauseEl.innerHTML = `<p class="hand" style="margin:0;font-size:26px">Mola</p><p class="tiny muted" style="margin:0">${n.searched} yer arandı · çantada ${bagUsed(n)} şey</p>
      <button class="choice" data-p="resume"><b>Devam</b></button><button class="choice" data-p="quit"><b>Pes et</b><span>Çanta gider, kaçarsın.</span></button>`;
  });
  pauseEl.addEventListener("click", e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-p]"); if (!b) return;
    if (b.dataset.p === "resume") { paused = false; pauseEl.hidden = true; last = performance.now(); } else { paused = false; pauseEl.hidden = true; n.phase = "over"; n.result = "dead"; }
  });
  el.querySelector("[data-c=exit]")!.addEventListener("click", () => { if (leave(n)) sfx("win"); });

  /* ---------- döngü ---------- */
  function end() {
    if (ended) return; ended = true; cancelAnimationFrame(raf); window.removeEventListener("resize", layout); ro.disconnect();
    const r = finishScav(cfg, s, n); persist(); sfx(r.result === "exit" ? "win" : "lose"); setTimeout(() => { el.remove(); onEnd(r); }, 350);
  }
  const loop = (now: number) => {
    const real = Math.min(0.1, (now - last) / 1000); last = now;
    if (!paused && n.phase === "play") stepScav(n, real);
    popFx(); shake = Math.max(0, shake - 0.5);
    if (n.phase === "over") { end(); return; }
    draw(now); hud(); raf = requestAnimationFrame(loop);
  };
  layout(); tip.hidden = false; tip.textContent = `Dokun: yürü · mercek: ara · ilk baskın ${Math.ceil(n.raidT)} sn sonra`; setTimeout(() => { tip.hidden = true; }, 3500);
  void searchTime; raf = requestAnimationFrame(loop);
  void itemPic;
}
