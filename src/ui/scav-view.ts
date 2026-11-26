// Harabe araması ekranı: yan kesit, çok katlı yapı. Dokun: oraya yürür; mercek simgesine dokun: arar; çıkışa varınca çıkarsın.
import type { Config } from "../engine/config";
import type { GameState } from "../engine/state";
import {
  type Scav, type Spot, type Loadout, SW, EXIT_X, LADDER_XS, SPOT_STAGES, createScav, stepScav, setInput, beginSearch, nearSpot, placeTrap, trapsInHand, castSpell, shootArrow, aimTarget, leave, rerollScav, pickScavCard, finishScav, scavSite, canStartScav,
  SCARDS, bagUsed, dropBag, healRun, healItemsAvailable, nearGround, groundNear, pickGround, danger, SCAV_ENERGY, type ScavResult, loadoutOptions, defaultLoadout, atExit,
} from "../engine/scavenge";
import { itemInfo } from "../engine/inventory";
import { ENEMIES } from "../content/world";
import { artUrl, itemPic } from "./art";
import { esc } from "./sketch";
import { sfx, buzz } from "./feel";
import { quad, drawQuad, walkFrame, gait } from "./anim";

const imgCache = new Map<string, HTMLImageElement | null>();
const img = (key: string) => { if (!imgCache.has(key)) { const u = artUrl(key); imgCache.set(key, u ? Object.assign(new Image(), { src: u }) : null); } const i = imgCache.get(key)!; return i && i.complete && i.naturalWidth ? i : null; };
const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || "#2A2722";

/** Başlamadan önce: yapı bilgisi ve TEK bir şey seçmek (silah, yay, köpek, tuzak ya da büyü). */
export function openScavHub(cfg: Config, s: GameState, place: string, persist: () => void, onEnd: (r: ScavResult) => void) {
  const site = scavSite(place)!; const bg = document.createElement("div"); bg.className = "modal-bg";
  const can = canStartScav(s, place); const opts = loadoutOptions(cfg, s); let sel: Loadout = defaultLoadout(cfg, s);
  const isSel = (o: { kind: string; id?: string }) => sel.kind === o.kind && sel.id === o.id;
  const draw = () => {
    bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><p class="hand muted" style="margin:0">Harabe araması</p><h2>${esc(site.name)}</h2>
      <p style="margin:0">${esc(site.desc)}</p>
      <p class="tiny" style="margin:0">Kutunun yanında durunca <b>kendiliğinden aranır</b>, hareket edersen durur; aranırken ateş etmezsin. Her kutu 3 ayrı kez aranır; değerli şey çıkacaksa yavaş aranır. Sayaç dolunca <b>baskın</b> gelir. <b>Çıkışa varırsan</b> bulduklarının hepsi senin, <b>ölürsen</b> çanta gider.</p>
      <h3 style="margin:4px 0 0">Yanına ne alırsın? <span class="tiny muted">(yalnız bir tane)</span></h3>
      <div class="load-list">${opts.map((o, i) => `<button class="load-opt ${isSel(o) ? "on" : ""}" data-i="${i}"><b>${esc(o.label)}</b><span>${esc(o.note)}</span></button>`).join("")}
        <button class="load-opt ${sel.kind === "yumruk" ? "on" : ""}" data-i="-1"><b>Yumruk</b><span>hiçbir şey almazsın</span></button></div>
      <div class="odds"><span>Kat <b>${site.floors}</b></span><span>Enerji <b>−${SCAV_ENERGY}</b></span><span>Süre <b>~30 dk</b></span></div>
      ${can.ok ? "" : `<p class="tiny red" style="margin:0">${esc(can.reason ?? "")}</p>`}
      <div class="row"><button class="btn" data-x="close">Kapat</button><span style="flex:1"></span><button class="btn primary" data-x="go" ${can.ok ? "" : "disabled"}>Gir</button></div></div>`;
  };
  draw(); document.body.appendChild(bg);
  bg.addEventListener("click", e => {
    const o = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-i]");
    if (o) { const i = +o.dataset.i!; sel = i < 0 ? { kind: "yumruk" } : { kind: opts[i].kind, id: opts[i].id }; sfx("tap"); draw(); return; }
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button"); if (!b || b.disabled) return; bg.remove();
    if (b.dataset.x === "go") openScav(cfg, s, place, persist, onEnd, sel);
  });
}

export function openScav(cfg: Config, s: GameState, place: string, persist: () => void, onEnd: (r: ScavResult) => void, load: Loadout = defaultLoadout(cfg, s)) {
  const site = scavSite(place)!; const n: Scav = createScav(cfg, s, site, (s.seed * 29 + s.day * 811 + Math.floor(s.minute)) | 0, load);
  const el = document.createElement("div"); el.className = "siege nobet scav"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Harabe araması");
  el.innerHTML = `<div class="nb-top"><button class="btn small" data-c="pause">Ⅱ</button><div class="sc-hud"><span id="scMoney"></span><span class="raid-pill" id="scRaid"></span><span id="scDanger"></span></div></div>
    <div class="siege-stage"><canvas></canvas><div class="nb-tip" id="scTip"></div>
      <div class="sc-heal" id="scHeal"></div><div class="sc-stick" id="scStick"><i id="scKnob"></i></div>
      <div class="sc-acts"><button class="sc-act" data-a="search" id="scSearch" hidden>Ara</button><button class="sc-act" data-a="pick" id="scPick" hidden></button><button class="sc-act" data-a="trap" id="scTrap" hidden></button><button class="sc-act aim" data-a="shoot" id="scShoot" hidden></button><button class="sc-act aim" data-a="spell" id="scSpell" hidden></button><button class="sc-act go" data-c="exit" id="scExit" hidden>Çık</button></div></div>
    <div class="sc-bar"><span id="scAmmo"></span><button class="btn small" id="scBag" data-c="bag"></button></div>
    <div class="nb-card" id="scCard" hidden></div><div class="nb-card" id="scPause" hidden></div>`;
  document.body.appendChild(el);
  const cv = el.querySelector("canvas")!; const stage = el.querySelector<HTMLElement>(".siege-stage")!; const g = cv.getContext("2d")!;
  const cardEl = el.querySelector<HTMLElement>("#scCard")!; const pauseEl = el.querySelector<HTMLElement>("#scPause")!; const tip = el.querySelector<HTMLElement>("#scTip")!;
  let W = 300, H = 400, paused = false, raf = 0, ended = false, last = performance.now(); let shake = 0; let walkT = 0; let lastLockedMsg = 0;
  const rings: { x: number; floor: number; t: number; r: number; color: string }[] = []; const pops: { x: number; floor: number; t: number; text: string; color: string }[] = []; const shots: { a: number; b: number; floor: number; t: number }[] = [];
  const F = site.floors; const VIEW = 110;
  const layout = () => { const r = stage.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1; W = r.width; H = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + "px"; cv.style.height = H + "px"; g.setTransform(dpr, 0, 0, dpr, 0, 0); };
  const sc = () => W / VIEW; const camX = () => Math.max(VIEW / 2, Math.min(SW - VIEW / 2, n.px));
  const X = (x: number) => (x - camX()) * sc() + W / 2;
  const fh = () => Math.min(H / F, 200);
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
    const rimg = img("harabe_oda_" + site.place);
    if (rimg) {
      // oda panelleri yan yana dizilir (her oda 100 birim); çift odalar aynalanır, böylece kenarlar birbirine uyar
      for (let k = 0; k < SW / 100; k++) { const x0 = X(k * 100), x1 = X((k + 1) * 100); if (x1 < -2 || x0 > W + 2) continue;
        g.save(); g.beginPath(); g.rect(x0, y0, x1 - x0, fh()); g.clip(); if (k % 2) { g.translate(x0 + x1, 0); g.scale(-1, 1); } g.drawImage(rimg, k % 2 ? x0 : x0, y0, x1 - x0, fh()); g.restore(); }
      g.strokeStyle = "rgba(20,16,10,.7)"; g.lineWidth = 2; g.beginPath(); g.moveTo(0, y1 - 10); g.lineTo(W, y1 - 10); g.stroke();
      const lk0 = n.locks.find(l => l.floor === f);
      if (lk0) { const dim2 = img(lk0.open ? "harabe_kapi_acik" : "harabe_kilit_kapi"); if (dim2) { const hh = fh() * 0.82, ww = hh * dim2.naturalWidth / dim2.naturalHeight; g.drawImage(dim2, X(lk0.x) - ww / 2, y1 - 8 - hh, ww, hh); } }
      if (lk0 && !lk0.open && !img("harabe_kilit_kapi")) { const px = X(lk0.x); g.fillStyle = "#1B150E"; g.fillRect(px - 5, y0 + 5, 10, fh() - 15); g.strokeStyle = "#B08A3A"; g.lineWidth = 3; g.strokeRect(px - 5, y0 + 5, 10, fh() - 15);
        const cy = y0 + fh() * 0.5; g.fillStyle = "#D9B84A"; g.fillRect(px - 9, cy - 3, 18, 14); g.strokeStyle = "#D9B84A"; g.lineWidth = 3; g.beginPath(); g.arc(px, cy - 3, 6, Math.PI, 0); g.stroke();
      }
      if (lk0 && !lk0.open) { const px2 = X(lk0.x); g.fillStyle = "rgba(0,0,0,.4)"; if (lk0.side === "R") g.fillRect(px2 + 5, y0, W, fh()); else g.fillRect(-W, y0, px2 - 5 + W, fh()); }
      if (dim) { g.fillStyle = "rgba(10,8,6,.6)"; g.fillRect(0, y0, W, fh()); }
      return;
    }
    g.fillStyle = f === 0 && site.floors > 1 ? "#6F6450" : "#7C705A"; g.fillRect(0, y0, W, fh());
    // tuğla/tahta çizgileri
    g.strokeStyle = "rgba(0,0,0,.12)"; g.lineWidth = 1; for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(0, y0 + (fh() / 5) * k); g.lineTo(W, y0 + (fh() / 5) * k); g.stroke(); }
    // oda ayırıcı duvarlar (x=100, 200)
    g.strokeStyle = "rgba(20,16,10,.55)"; g.lineWidth = 3; for (const wx of [100, 200, 300, 400, 500, 600]) { if (n.locks.some(l => l.floor === f && !l.open && l.x === wx)) continue; const px = X(wx); g.beginPath(); g.moveTo(px, y0); g.lineTo(px, y0 + fh() * 0.12); g.moveTo(px, y0 + fh() * 0.78); g.lineTo(px, y1); g.stroke(); }
    // zemin ve tavan
    g.fillStyle = "#2A2218"; g.fillRect(0, y1 - 10, W, 10); g.fillRect(0, y0, W, 5);
    g.strokeStyle = ink; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, y1 - 10); g.lineTo(W, y1 - 10); g.stroke();
    const lk = n.locks.find(l => l.floor === f);
    if (lk && !lk.open) { const px = X(lk.x); g.fillStyle = "#1B150E"; g.fillRect(px - 5, y0 + 5, 10, fh() - 15); g.strokeStyle = "#B08A3A"; g.lineWidth = 3; g.strokeRect(px - 5, y0 + 5, 10, fh() - 15);
      const cy = y0 + fh() * 0.5; g.fillStyle = "#D9B84A"; g.fillRect(px - 9, cy - 3, 18, 14); g.strokeStyle = "#D9B84A"; g.lineWidth = 3; g.beginPath(); g.arc(px, cy - 3, 6, Math.PI, 0); g.stroke();
      g.fillStyle = "rgba(0,0,0,.28)"; if (lk.side === "R") g.fillRect(px + 5, y0, W, fh()); else g.fillRect(-W, y0, px - 5 + W, fh()); }
    if (dim) { g.fillStyle = "rgba(10,8,6,.55)"; g.fillRect(0, y0, W, fh()); }
  }
  function ladders() {
    const lim = img("harabe_merdiven");
    if (lim) { for (let gap = 0; gap < F - 1; gap++) { const x = X(LADDER_XS[gap % 2]); const yLow = floorBottom(gap) - 6, yHigh = floorBottom(gap + 1) - 10; const h = yLow - yHigh + 6, w = h * lim.naturalWidth / lim.naturalHeight; g.drawImage(lim, x - Math.max(w, 22) / 2, yHigh - 6, Math.max(w, 22), h); } return; }
    for (let gap = 0; gap < F - 1; gap++) {
      const x = X(LADDER_XS[gap % 2]); const yLow = floorBottom(gap) - 10, yHigh = floorBottom(gap + 1) - 10;
      g.strokeStyle = "#3A2A1A"; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 9, yLow); g.lineTo(x - 9, yHigh); g.moveTo(x + 9, yLow); g.lineTo(x + 9, yHigh); g.stroke();
      g.lineWidth = 2; for (let y = yLow - 8; y > yHigh + 4; y -= 11) { g.beginPath(); g.moveTo(x - 9, y); g.lineTo(x + 9, y); g.stroke(); }
    }
  }
  const FURN_ART: Record<string, [string, number]> = { "Sandık": ["sandik", 8], "Kömürleşmiş sandık": ["sandik", 8], "Kasa": ["sandik", 8], "Dolap": ["dolap", 17], "Fıçı": ["fici", 10], "Çuval": ["cuval", 9] };
  function furniture(name: string, x: number, f: number, done: boolean) {
    const fa = FURN_ART[name]; const fim = fa ? img("harabe_" + fa[0]) : null;
    if (fim && fa) { const hh = fa[1] * sc(), ww = hh * fim.naturalWidth / fim.naturalHeight; g.save(); g.globalAlpha = done ? 0.55 : 1; g.drawImage(fim, X(x) - ww / 2, floorBottom(f) - 8 - hh, ww, hh); g.restore(); return; }
    const px = X(x), gy = groundY(f) + 10, w = 22 * sc() / 2.4, h = 16 * sc() / 2.4; g.save(); g.globalAlpha = done ? 0.55 : 1; g.strokeStyle = "#1E160E"; g.lineWidth = 1.6;
    g.fillStyle = /Fıçı/.test(name) ? "#7A5A34" : /Yatak/.test(name) ? "#8E8A6A" : /Dolap|Raf/.test(name) ? "#6B4E2E" : "#835F36";
    if (/Fıçı/.test(name)) { g.beginPath(); g.ellipse(px, gy - h / 2, w * 0.45, h / 2, 0, 0, 7); g.fill(); g.stroke(); g.beginPath(); g.moveTo(px - w * 0.45, gy - h * 0.7); g.lineTo(px + w * 0.45, gy - h * 0.7); g.stroke(); }
    else if (/Çuval/.test(name)) { g.beginPath(); g.moveTo(px - w * 0.4, gy); g.quadraticCurveTo(px - w * 0.55, gy - h, px - w * 0.15, gy - h * 1.1); g.lineTo(px + w * 0.15, gy - h * 1.1); g.quadraticCurveTo(px + w * 0.55, gy - h, px + w * 0.4, gy); g.closePath(); g.fillStyle = "#A69870"; g.fill(); g.stroke(); }
    else if (/Dolap|Raf/.test(name)) { g.fillRect(px - w * 0.45, gy - h * 1.9, w * 0.9, h * 1.9); g.strokeRect(px - w * 0.45, gy - h * 1.9, w * 0.9, h * 1.9); g.beginPath(); g.moveTo(px, gy - h * 1.9); g.lineTo(px, gy); g.moveTo(px - w * 0.45, gy - h); g.lineTo(px + w * 0.45, gy - h); g.stroke(); }
    else { g.fillRect(px - w * 0.5, gy - h, w, h); g.strokeRect(px - w * 0.5, gy - h, w, h); g.beginPath(); g.moveTo(px - w * 0.5, gy - h * 0.6); g.lineTo(px + w * 0.5, gy - h * 0.6); g.stroke(); }
    g.restore();
  }
  /** Kutunun üstünde yalnız aşama noktaları ve arama çubuğu (mercek simgesi yok). */
  function lens(sp: Spot, near: boolean, now: number) {
    void now; const px = X(sp.x), top = groundY(sp.floor) - 26 * sc() / 2.4; const done = sp.done;
    g.save(); g.globalAlpha = done ? 0.5 : 1;
    if (done) { g.strokeStyle = "#6FBF4A"; g.lineWidth = 3; g.beginPath(); g.moveTo(px - 6, top - 6); g.lineTo(px - 1, top - 1); g.lineTo(px + 8, top - 12); g.stroke(); }
    else {
      for (let k = 0; k < SPOT_STAGES; k++) { g.fillStyle = k < sp.stage ? "#F1C14A" : "rgba(0,0,0,.45)"; g.strokeStyle = near ? "#FFFFFF" : "#F2E7C9"; g.lineWidth = 1.5; g.beginPath(); g.arc(px - 10 + k * 10, top - 6, 3.8, 0, 7); g.fill(); g.stroke(); }
      if (sp.prog > 0) { const w = 34; g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(px - w / 2, top + 2, w, 5); g.fillStyle = "#F1C14A"; g.fillRect(px - w / 2, top + 2, w * sp.prog, 5); }
    }
    g.restore();
  }
  const gy = (fl: number) => floorBottom(fl) - 10;     // fl float olabilir (merdivende)
  const drawFoeOrDog = (key: string, sheet: string | null, moving: boolean, x: number, fl: number, h: number, right: boolean, now: number, alpha = 1, tint = "none") => {
    const qd = sheet && moving ? quad(sheet, walkFrame(now, x)) : null;
    if (qd) { drawQuad(g, qd, X(x), gy(fl), h * sc(), right, tint, alpha); return true; }
    const im = img(key); if (!im) return false; const gt = gait(now, x, moving); const hh = h * sc(), w = hh * im.naturalWidth / im.naturalHeight;
    g.save(); g.globalAlpha = alpha; g.translate(X(x), gy(fl) + gt.dy * sc()); g.rotate(gt.rot); if (right) g.scale(-1, 1); g.filter = tint; g.drawImage(im, -w / 2, -hh, w, hh); g.restore(); return true;
  };
  function draw(now: number) {
    g.save(); if (shake > 0) g.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    g.fillStyle = "#14110C"; g.fillRect(-10, -10, W + 20, H + 20);
    for (let f = F - 1; f >= 0; f--) {
      const cur = f === n.floor || (n.climbing && (f === Math.floor(n.py) || f === Math.ceil(n.py))); room(f, !cur);
      for (const sp of n.spots) if (sp.floor === f) furniture(sp.name, sp.x, f, sp.done);
    }
    ladders();
    const eim = img("harabe_cikis");
    if (eim) { const hh = Math.min(fh() * 0.8, 120), ww = hh * eim.naturalWidth / eim.naturalHeight; g.drawImage(eim, X(EXIT_X) - ww * 0.35, floorBottom(0) - 8 - hh, ww, hh);
      g.fillStyle = "#EFE6CC"; g.font = `700 ${Math.max(13, sc() * 1.9)}px Caveat, cursive`; g.textAlign = "left"; g.strokeStyle = "rgba(0,0,0,.7)"; g.lineWidth = 3; g.strokeText("Çıkış", X(EXIT_X) + ww * 0.7, gy(0) - 12); g.fillText("Çıkış", X(EXIT_X) + ww * 0.7, gy(0) - 12); } else
    { const ex = X(EXIT_X), gyy = gy(0); g.fillStyle = "#2E4C7A"; g.beginPath(); g.moveTo(ex + 18, gyy - 26); g.lineTo(ex - 4, gyy - 14); g.lineTo(ex + 18, gyy - 2); g.closePath(); g.fill();
      g.fillStyle = "#EFE6CC"; g.font = `700 ${Math.max(13, sc() * 1.9)}px Caveat, cursive`; g.textAlign = "left"; g.fillText("Çıkış", ex + 22, gyy - 10); }
    const ns = nearSpot(n);
    for (const sp of n.spots) lens(sp, ns?.id === sp.id, now);
    // yerdeki eşyalar
    for (const gI of n.ground) { const im = img("esya_" + gI.item); const x = X(gI.x), y = gy(gI.floor) - 6 - Math.abs(Math.sin(now / 400 + gI.id)) * 2; const sz = 7 * sc();
      g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(x, gy(gI.floor) + 4, sz * 0.4, 3, 0, 0, 7); g.fill();
      if (im) g.drawImage(im, x - sz / 2, y - sz, sz, sz); else { g.fillStyle = "#C9B27A"; g.strokeStyle = "#1E160E"; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y - sz / 2, sz * 0.3, 0, 7); g.fill(); g.stroke(); } }
    // kurulu tuzaklar
    for (const tr of n.traps) { if (tr.state === "hand") continue; const x = X(tr.x), y = gy(tr.floor) + 4; g.globalAlpha = tr.state === "cool" ? 0.4 : 1; g.strokeStyle = "#1E160E"; g.lineWidth = 2; g.fillStyle = tr.id === "ates_tuzagi" ? "#C4552B" : "#8A6A45";
      g.beginPath(); g.ellipse(x, y, 11, 4.5, 0, 0, 7); g.fill(); g.stroke(); for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(x + k * 5, y); g.lineTo(x + k * 5, y - 9); g.stroke(); }
      if (tr.state === "cool") { g.fillStyle = "#F2E7C9"; g.font = "700 14px Caveat, cursive"; g.textAlign = "center"; g.fillText(`${Math.ceil(tr.t)}`, x, y - 12); } g.globalAlpha = 1; }
    // düşmanlar
    for (const f of n.foes) {
      const d = ENEMIES[f.def]; const wolf = f.def === "kurt" || f.def === "kar_kurdu"; const h = (wolf ? 9 : 20) * (d?.scale ?? 1); const right = n.px > f.x; const climbing = f.climbT > 0; const moving = f.root <= 0 && !climbing;
      const key = artUrl("dusman_" + f.def) ? "dusman_" + f.def : "dusman_kurt";
      const tint = f.burn > 0 ? "sepia(1) saturate(4) hue-rotate(-20deg)" : f.root > 0 ? "hue-rotate(160deg) saturate(2)" : "none";
      if (!drawFoeOrDog(key, wolf ? "anim_kurt_yuru" : null, moving, f.x, f.floor + (climbing ? ((1.6 - f.climbT) / 1.6) * (f.toFloor - f.floor) : 0), h, key === "dusman_kurt" ? right : !right, now, climbing ? 0.7 : 1, tint)) { g.fillStyle = "#B03A2A"; g.beginPath(); g.arc(X(f.x), gy(f.floor) - 12, 7, 0, 7); g.fill(); }
      if (f.hp < f.max) { const w = 26, yy = gy(f.floor) - h * sc() - 6; g.fillStyle = "rgba(20,16,10,.8)"; g.fillRect(X(f.x) - w / 2, yy, w, 4); g.fillStyle = "#D9503A"; g.fillRect(X(f.x) - w / 2, yy, w * Math.max(0, f.hp / f.max), 4); }
    }
    // köpek
    if (n.dog) { const dg = n.dog; const petId = s.pet?.id ?? "kopek"; drawFoeOrDog(artUrl("dusman_" + petId) ? "dusman_" + petId : "dusman_kurt", `anim_${petId}_yuru`, dg.moving, dg.x, dg.floor, 8, dg.face === 1, now, 1, artUrl("dusman_" + petId) ? "none" : ENEMIES[petId]?.tint ?? "none"); }
    // sen: merdivende yavaş yavaş çıkar
    { const x = n.px; const fl = n.py; const climbing = n.climbing; const key = n.atkFx > 0 ? "poz_kahraman_vurus" : "poz_kahraman_durus";
      const walkQ = n.moving ? quad("anim_kahraman_yuru", walkFrame(now, 0, 9)) : null; const bowQ = n.bow && n.atkFx > 0 ? quad("anim_kahraman_yay", 3) : null;
      if (bowQ) drawQuad(g, bowQ, X(x), gy(fl), 20 * sc(), n.face === 1);
      else if (walkQ) drawQuad(g, walkQ, X(x), gy(fl), 20 * sc(), n.face === 1);
      else { const im = img(key); if (im) { const hh = 20 * sc(), w = hh * im.naturalWidth / im.naturalHeight; const bob = climbing ? Math.sin(fl * 16) * 3 : 0; g.save(); g.globalAlpha = climbing ? 0.85 : 1; g.translate(X(x), gy(fl) + bob); if (n.face === 1) g.scale(-1, 1); g.drawImage(im, -w / 2, -hh, w, hh); g.restore(); } }
      { const w = 44, hx = X(x) - w / 2, hy = gy(fl) - 20 * sc() - 14; g.fillStyle = "rgba(20,16,10,.85)"; g.fillRect(hx - 1, hy - 1, w + 2, 8); g.fillStyle = n.hp / n.maxHp < 0.3 ? "#E0483A" : "#D9503A"; g.fillRect(hx, hy, w * Math.max(0, n.hp / n.maxHp), 6);
        g.fillStyle = "#F2E7C9"; g.font = "700 11px sans-serif"; g.textAlign = "center"; g.fillText(`${Math.round(n.hp)}`, X(x), hy - 3); }
      if (n.searchId) { g.fillStyle = "#F1C14A"; g.font = `700 ${Math.max(14, sc() * 2)}px Caveat, cursive`; g.textAlign = "center"; g.fillText("aranıyor…", X(x), gy(fl) - 20 * sc() - 28); } }
    for (const pj of n.proj) { const x = X(pj.x), y = gy(pj.floor) - 11 * sc(); const col = pj.kind === "buz" ? ["#BFE6FA", "#6BB6E0"] : pj.kind === "ates" ? ["#FFE08A", "#E8602A"] : pj.kind === "simsek" ? ["#FFFFFF", "#7FA8FF"] : ["#E4D3FF", "#8A6BE0"];
      for (let k = 4; k >= 1; k--) { g.globalAlpha = 0.14 * (5 - k); g.fillStyle = col[1]; g.beginPath(); g.arc(x - pj.dir * k * 6, y, 6 + (5 - k), 0, 7); g.fill(); }
      g.globalAlpha = 1; const gr = g.createRadialGradient(x, y, 1, x, y, 11); gr.addColorStop(0, col[0]); gr.addColorStop(1, col[1]); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 10 + Math.sin(now / 60) * 1.5, 0, 7); g.fill(); }
    for (const sh of [...shots]) { const a = Math.max(0, (now - sh.t) / 160); if (a > 1) { shots.splice(shots.indexOf(sh), 1); continue; } g.strokeStyle = `rgba(255,245,210,${1 - a})`; g.lineWidth = 2; g.beginPath(); g.moveTo(X(sh.a), gy(sh.floor) - 12 * sc()); g.lineTo(X(sh.b), gy(sh.floor) - 8 * sc()); g.stroke(); }
    for (const r of [...rings]) { const a = Math.max(0, (now - r.t) / 500); if (a > 1) { rings.splice(rings.indexOf(r), 1); continue; } g.strokeStyle = `${r.color}${(1 - a).toFixed(2)})`; g.lineWidth = 4; g.beginPath(); g.ellipse(X(r.x), gy(r.floor) - 8 * sc(), Math.max(0.1, r.r * sc() * a), Math.max(0.1, r.r * sc() * 0.5 * a), 0, 0, 7); g.stroke(); }
    if (aim && Math.hypot(aim.dx, aim.dy) > 0.25) {
      const rv = { dx: -aim.dx, dy: -aim.dy }; const tg = aimTarget(n, rv); const hx = X(n.px), hy = gy(n.py) - 11 * sc(); const len = 90 + Math.hypot(aim.dx, aim.dy) * 60; const ty = tg.floor === n.floor ? 0 : (tg.floor > n.floor ? -1 : 1);
      g.save(); g.setLineDash([8, 6]); g.strokeStyle = "rgba(255,240,180,.9)"; g.lineWidth = 3; g.beginPath(); g.moveTo(hx, hy);
      const ex = hx + tg.dir * len, ey = hy + ty * Math.min(fh() * 0.7, 60); g.lineTo(ex, ey); g.stroke(); g.setLineDash([]);
      g.fillStyle = "rgba(255,240,180,.95)"; g.beginPath(); g.arc(ex, ey, 6, 0, 7); g.fill();
      if (ty) { g.font = `700 ${Math.max(14, sc() * 1.8)}px Caveat, cursive`; g.textAlign = "center"; g.fillText(ty < 0 ? "üst kat" : "alt kat", ex, ey + (ty < 0 ? -10 : 18)); } g.restore(); }
    for (const p of [...pops]) { const a = Math.max(0, (now - p.t) / 1100); if (a > 1) { pops.splice(pops.indexOf(p), 1); continue; } g.globalAlpha = 1 - a; g.fillStyle = p.color; g.strokeStyle = "rgba(0,0,0,.7)"; g.lineWidth = 3; g.font = `700 ${Math.max(16, sc() * 2.3)}px Caveat, cursive`; g.textAlign = "center";
      const px = X(p.x), py = gy(p.floor) - 24 * sc() / 2.4 - a * 26; g.strokeText(p.text, px, py); g.fillText(p.text, px, py); g.globalAlpha = 1; }
    g.restore();
  }

  /* ---------- HUD ---------- */
  const q = (id: string) => el.querySelector<HTMLElement>(id)!;
  function hud() {
    q("#scMoney").textContent = `◉ ${n.money}`; const rs = Math.max(0, Math.ceil(n.raidT)); const rp = q("#scRaid"); rp.textContent = `BASKIN ${rs}`; rp.className = `raid-pill ${rs <= 5 ? "red" : rs <= 9 ? "amber" : "green"}`;
    q("#scDanger").textContent = `Tehlike ${danger(n)}`;
    q("#scAmmo").textContent = `${n.weaponName}${n.bow ? ` · ok ${n.ammo}` : ""}`; q("#scBag").textContent = `Çanta ${bagUsed(n)}/${n.bagCap}${n.keys.length ? ` · 🔑${n.keys.length}` : ""}`;
    (q("#scExit") as HTMLElement).hidden = !atExit(n);
    (q("#scSearch") as HTMLElement).hidden = true;
    const gnear = nearGround(n); const pk = q("#scPick") as HTMLButtonElement; pk.hidden = !gnear; if (gnear) { pk.textContent = `Al: ${itemInfo(cfg, gnear.item).name}`; pk.classList.toggle("busy", bagUsed(n) >= n.bagCap); }
    const tb = q("#scTrap") as HTMLButtonElement; tb.hidden = !n.traps.length; if (n.traps.length) { const hand = trapsInHand(n); const cool = n.traps.filter(x => x.state === "cool").map(x => Math.ceil(x.t)); tb.textContent = hand ? `Tuzak ${hand}` : cool.length ? `Tuzak ${Math.min(...cool)} sn` : "Tuzak 0"; tb.disabled = !hand || n.climbing; }
    const hl = healItemsAvailable(s, n); const hk = hl.map(x => x.id + x.n).join() + (n.hp < n.maxHp); const he = q("#scHeal");
    if (he.dataset.k !== hk) { he.dataset.k = hk; he.innerHTML = hl.map(x => `<button class="sc-sup" data-heal="${x.id}" ${n.hp >= n.maxHp ? "disabled" : ""} aria-label="${esc(itemInfo(cfg, x.id).name)}">${itemPic(x.id, 30)}<i>${x.n}</i></button>`).join(""); }
    const ob = q("#scShoot") as HTMLButtonElement; ob.hidden = !(n.bow && n.ammo > 0); ob.textContent = `Ok ${n.ammo}`; ob.disabled = n.atkCd > 0;
    const pb = q("#scSpell") as HTMLButtonElement; pb.hidden = !n.spell; if (n.spell) { pb.textContent = n.spell.cd > 0 ? `${n.spell.name} ${Math.ceil(n.spell.cd)}` : n.spell.name; pb.disabled = n.spell.cd > 0; }
  }
  function popFx() {
    for (const f of n.fx.splice(0)) {
      const now = performance.now();
      if (f.k === "loot") { const nm = f.text.replace(/^\+(\d+) ([a-z_]+)$/, (_m, c, id) => `+${c} ${itemInfo(cfg, id).name}`); pops.push({ x: f.x, floor: f.floor, t: now, text: nm, color: "#F4E3A1" }); sfx(f.text === "boş" ? "page" : "coin"); }
      if (f.k === "weapon") { pops.push({ x: f.x, floor: f.floor, t: now, text: `${f.name} buldun!`, color: "#9BD36B" }); sfx("perfect"); buzz("medium"); }
      if (f.k === "full") { pops.push({ x: f.x, floor: f.floor, t: now, text: "Çanta dolu: yere düştü", color: "#E36A55" }); sfx("bad"); }
      if (f.k === "hit") pops.push({ x: f.x, floor: f.floor, t: now, text: `${f.crit ? "Kritik " : ""}${f.dmg}`, color: f.crit ? "#E36A55" : "#F2E7C9" });
      if (f.k === "hurt") { shake = Math.max(shake, 5); sfx("hurt"); buzz("light"); }
      if (f.k === "raid") { tip.hidden = false; tip.textContent = `Baskın! ${f.n} düşman geliyor`; setTimeout(() => { tip.hidden = true; }, 2200); sfx("beat"); buzz("medium"); }
      if (f.k === "shot") { shots.push({ a: f.from, b: f.to, floor: f.floor, t: now }); sfx("whoosh"); }
      if (f.k === "trap") { rings.push({ x: f.x, floor: f.floor, t: now, r: 14, color: "rgba(241,193,74," }); sfx("thunk"); pops.push({ x: f.x, floor: f.floor, t: now, text: "Tuzak!", color: "#F1C14A" }); }
      if (f.k === "spell") { rings.push({ x: f.x, floor: f.floor, t: now, r: f.r, color: f.kind === "buz" ? "rgba(159,211,232," : f.kind === "ates" ? "rgba(230,110,50," : "rgba(160,140,255," }); sfx("crit"); buzz("heavy"); shake = 8; }
      if (f.k === "bite") sfx("hit");
      if (f.k === "cast") buzz("light");
      if (f.k === "dodge") { pops.push({ x: f.x, floor: f.floor, t: now, text: "Sıyrıldın", color: "#9BD36B" }); sfx("whoosh"); }
      if (f.k === "key") { pops.push({ x: f.x, floor: f.floor, t: now, text: "Anahtar buldun!", color: "#F4D35E" }); sfx("perfect"); buzz("medium"); }
      if (f.k === "unlock") { pops.push({ x: f.x, floor: f.floor, t: now, text: "Kapı açıldı", color: "#9BD36B" }); sfx("win"); buzz("medium"); }
      if (f.k === "locked") { if (now - lastLockedMsg > 1500) { lastLockedMsg = now; tip.hidden = false; tip.textContent = "Kilitli: başka bir odada anahtar var"; setTimeout(() => { tip.hidden = true; }, 1400); sfx("bad"); } }
      if (f.k === "die") sfx("hit");
      if (f.k === "spot") sfx("good");
      if (f.k === "card") showCards();
    }
  }
  function showCards() {
    cardEl.hidden = false; sfx("perfect"); buzz("medium"); setInput(n, 0, 0); stickReset();
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

  /* ---------- joystick ve düğmeler ---------- */
  const stick = q("#scStick"), knob = q("#scKnob"); let stickId = -1;
  const stickReset = () => { stickId = -1; knob.style.transform = "translate(0,0)"; setInput(n, 0, 0); };
  const stickMove = (e: PointerEvent) => {
    const r = stick.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2; const R = r.width / 2 - 8;
    let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy); if (d > R) { dx = dx / d * R; dy = dy / d * R; }
    knob.style.transform = `translate(${dx}px,${dy}px)`; setInput(n, dx / R, dy / R);
  };
  stick.addEventListener("pointerdown", e => { if (n.phase !== "play" || paused) return; stickId = e.pointerId; stick.setPointerCapture(e.pointerId); stickMove(e); });
  stick.addEventListener("pointermove", e => { if (e.pointerId === stickId) stickMove(e); });
  const stickEnd = (e: PointerEvent) => { if (e.pointerId === stickId) stickReset(); };
  stick.addEventListener("pointerup", stickEnd); stick.addEventListener("pointercancel", stickEnd);
  // nişan: düğmeye basıp sürükle (ok atar gibi), bırakınca fırlar; kısa dokunuş otomatik nişandır
  let aim: { kind: "spell" | "shoot"; sx: number; sy: number; dx: number; dy: number; id: number } | null = null; const AIM_R = 70;
  const acts = el.querySelector<HTMLElement>(".sc-acts")!;
  acts.addEventListener("pointerdown", e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-a=spell], button[data-a=shoot]"); if (!b || b.disabled || n.phase !== "play" || paused) return;
    aim = { kind: b.dataset.a as "spell" | "shoot", sx: e.clientX, sy: e.clientY, dx: 0, dy: 0, id: e.pointerId }; (b as HTMLElement).setPointerCapture(e.pointerId); e.preventDefault();
  });
  acts.addEventListener("pointermove", e => { if (!aim || e.pointerId !== aim.id) return; aim.dx = Math.max(-1, Math.min(1, (e.clientX - aim.sx) / AIM_R)); aim.dy = Math.max(-1, Math.min(1, (e.clientY - aim.sy) / AIM_R)); });
  const aimEnd = (e: PointerEvent) => {
    if (!aim || e.pointerId !== aim.id) return; const a = aim; aim = null; if (n.phase !== "play" || paused) return;
    const manual = Math.hypot(a.dx, a.dy) > 0.25; const av = manual ? { dx: a.dx, dy: a.dy } : undefined;
    // sürüklemenin ters yönü: ok gibi geriye çekip bırakınca ters yöne fırlar
    const rv = av ? { dx: -av.dx, dy: -av.dy } : undefined;
    if (a.kind === "spell") { if (castSpell(n, rv)) sfx("whoosh"); else sfx("bad"); } else { if (shootArrow(n, rv)) sfx("whoosh"); else sfx("bad"); }
  };
  acts.addEventListener("pointerup", aimEnd); acts.addEventListener("pointercancel", () => { aim = null; });
  acts.addEventListener("click", e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button"); if (!b || b.disabled || n.phase !== "play" || paused) return;
    if (b.dataset.c === "exit") { if (leave(n)) sfx("win"); return; }
    if (b.dataset.a === "pick") { const r = pickGround(n); if (r === "ok") sfx("coin"); else { sfx("bad"); if (r === "full") { tip.hidden = false; tip.textContent = "Çanta dolu: önce bir şey at"; setTimeout(() => { tip.hidden = true; }, 1500); } } }
    if (b.dataset.a === "search") { if (beginSearch(n)) { sfx("tap"); stickReset(); } else sfx("bad"); }
    if (b.dataset.a === "trap") { if (placeTrap(n)) sfx("thunk"); else sfx("bad"); }
  });
  const bagEl = el.querySelector<HTMLElement>("#scPause")!;
  let bagSel = "";
  function showBag() {
    paused = true; bagEl.hidden = false; stickReset(); sfx("page");
    const cells: string[] = []; for (const [id, c] of Object.entries(n.bag)) for (let i = 0; i < c; i++) cells.push(id);
    const grid = Array.from({ length: n.bagCap }, (_, i) => { const id = cells[i]; return id ? `<button class="cell ${bagSel === id ? "sel" : ""}" data-bag="${id}" aria-label="${esc(itemInfo(cfg, id).name)}">${itemPic(id, 36)}</button>` : `<div class="cell empty"></div>`; }).join("");
    const sel = bagSel && n.bag[bagSel] ? bagSel : ""; const near = groundNear(n);
    bagEl.innerHTML = `<p class="hand" style="margin:0;font-size:26px">Çanta <span class="muted">${bagUsed(n)}/${n.bagCap}</span></p>
      <div class="grid bag-grid">${grid}</div>
      ${sel ? `<div class="choice bagrow">${itemPic(sel, 40)}<b>${esc(itemInfo(cfg, sel).name)} ×${n.bag[sel]}</b><button class="btn small red" data-drop="${sel}">Yere at</button></div>` : `<p class="tiny muted" style="margin:0">Bir eşyaya dokun; yere atıp yer açabilirsin. Atılan eşya burada durur, çanta boşalınca geri alırsın.</p>`}
      ${near.length ? `<p class="tiny muted" style="margin:0">Yerde (yanında):</p>` : ""}${near.map(gi => `<div class="choice bagrow">${itemPic(gi.item, 36)}<b>${esc(itemInfo(cfg, gi.item).name)}</b><button class="btn small" data-take="${gi.id}" ${bagUsed(n) >= n.bagCap ? "disabled" : ""}>Al</button></div>`).join("")}
      <button class="choice" data-p="resume"><b>Kapat</b></button>`;
  }
  q("#scHeal").addEventListener("click", e => { const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-heal]"); if (!b || b.disabled || n.phase !== "play" || paused) return; const r = healRun(cfg, s, n, b.dataset.heal!); if (r.ok) { sfx("good"); buzz("light"); pops.push({ x: n.px, floor: n.floor, t: performance.now(), text: `+${r.healed} can`, color: "#9BD36B" }); (q("#scHeal") as HTMLElement).dataset.k = ""; } else sfx("bad"); });
  el.querySelector(".sc-bar")!.addEventListener("click", e => { if ((e.target as HTMLElement).closest("[data-c=bag]") && n.phase === "play" && !paused) showBag(); });
  el.querySelector(".nb-top")!.addEventListener("click", e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-c]"); if (!b || b.dataset.c !== "pause") return;
    paused = true; pauseEl.hidden = false; sfx("page"); stickReset();
    pauseEl.innerHTML = `<p class="hand" style="margin:0;font-size:26px">Mola</p><p class="tiny muted" style="margin:0">${n.searched} yer arandı · çantada ${bagUsed(n)} şey</p>
      <button class="choice" data-p="resume"><b>Devam</b></button><button class="choice" data-p="quit"><b>Pes et</b><span>Çanta gider, kaçarsın.</span></button>`;
  });
  pauseEl.addEventListener("click", e => {
    const bg2 = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-bag]"); if (bg2) { bagSel = bg2.dataset.bag!; sfx("tap"); showBag(); return; }
    const tk = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-take]"); if (tk) { if (pickGround(n, +tk.dataset.take!) === "ok") sfx("coin"); else sfx("bad"); showBag(); return; }
    const dr = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-drop]"); if (dr) { dropBag(n, dr.dataset.drop!); sfx("tap"); showBag(); return; }
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-p]"); if (!b) return;
    if (b.dataset.p === "resume") { paused = false; pauseEl.hidden = true; last = performance.now(); } else { paused = false; pauseEl.hidden = true; n.phase = "over"; n.result = "dead"; }
  });

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
  layout(); tip.hidden = false; tip.textContent = `Kutunun yanında dur: kendiliğinden arar. Hareket edersen durur.`; setTimeout(() => { tip.hidden = true; }, 4000);
  raf = requestAnimationFrame(loop); void itemPic; void LADDER_XS; void walkT;
}
