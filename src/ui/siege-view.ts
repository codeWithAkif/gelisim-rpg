// Kuşatma ekranı: gerçek zamanlı savunma. Kurulum: parmakla barikat çek, köpeği yerleştir.
// Savaş: kendinden geriye çekip bırak → ok; büyüye dokun, sonra hedefe dokun → büyü (dolma süreli).
// Dalga aralarında dinlen, kazık ekle.
import type { Config } from "../engine/config";
import type { GameState } from "../engine/state";
import {
  type Siege, type SiegeDef, ARENA, PLAYER_R, BARRICADE_MAX_LEN, createSiege, placeBarricade, removeBarricade, placePet,
  startWave, step, shoot, canShoot, siegeSpells, cast, restBetween, finishSiege,
} from "../engine/siege";
import { ENEMIES } from "../content/world";
import type { GainReport } from "../engine/progression";
import { artUrl } from "./art";
import { esc } from "./sketch";
import { sfx, buzz } from "./feel";
import { chain, drawBolt, drawImpact, impact, type BoltFx, type Impact, type Pt } from "./lightning";

const CX = ARENA.w / 2, CY = ARENA.h / 2;
const imgCache = new Map<string, HTMLImageElement | null>();
const img = (key: string) => { if (!imgCache.has(key)) { const u = artUrl(key); imgCache.set(key, u ? Object.assign(new Image(), { src: u }) : null); } const i = imgCache.get(key)!; return i && i.complete && i.naturalWidth ? i : null; };

export function openSiege(cfg: Config, s: GameState, def: SiegeDef, seed: number, onEnd: (won: boolean, gains: GainReport, heroes: string[]) => void, persist: () => void, called: string[] = []) {
  const sg: Siege = createSiege(cfg, s, def, seed, called);
  const el = document.createElement("div"); el.className = "siege"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Kuşatma");
  el.innerHTML = `<div class="siege-top"><div class="siege-title hand"></div><div class="siege-bars"><div class="gb"><div class="gf" id="sgHp" style="background:var(--red)"></div></div><div class="gb"><div class="gf" id="sgMana" style="background:var(--blue)"></div></div></div></div>
    <div class="siege-stage"><canvas></canvas></div><div class="siege-panel"></div>`;
  document.body.appendChild(el);
  const cv = el.querySelector("canvas")!; const stage = el.querySelector<HTMLElement>(".siege-stage")!; const panel = el.querySelector<HTMLElement>(".siege-panel")!;
  const g = cv.getContext("2d")!;
  let scale = 4, ox = 0, oy = 0;
  const layout = () => {
    const r = stage.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
    cv.width = r.width * dpr; cv.height = r.height * dpr; cv.style.width = r.width + "px"; cv.style.height = r.height + "px";
    scale = Math.min(r.width / ARENA.w, r.height / ARENA.h); ox = (r.width - ARENA.w * scale) / 2; oy = (r.height - ARENA.h * scale) / 2;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const toArena = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left - ox) / scale, y: (e.clientY - r.top - oy) / scale }; };
  const X = (x: number) => ox + x * scale, Y = (y: number) => oy + y * scale;

  const lbolts: BoltFx[] = []; const limpacts: Impact[] = []; let wflash = 0;
  let armed: string | null = null; let petMode = false; let drag: { x: number; y: number; cx: number; cy: number; bow: boolean } | null = null;
  const pops: { x: number; y: number; t: number; text: string; color: string; big?: boolean }[] = []; let shake = 0, flash = 0, swing = 0;
  const cs = getComputedStyle(document.documentElement); const C = (n: string) => cs.getPropertyValue(n).trim();

  /* ---------- panel ---------- */
  function renderPanel() {
    const t = el.querySelector<HTMLElement>(".siege-title")!;
    t.textContent = `${def.name} · ${sg.phase === "build" ? "hazırlık" : `dalga ${Math.min(sg.wave + 1, def.waves.length)}/${def.waves.length}`}`;
    if (sg.phase === "build" || sg.phase === "rest") {
      const restCard = sg.phase === "rest" ? `<p class="hand green" style="margin:0">Dalga ${sg.wave}/${def.waves.length} geride kaldı. Soluklan: can, mana ve barikatlar biraz toparlandı, bir kazık daha var.</p>` : "";
      panel.innerHTML = `${restCard}<p class="tiny" style="margin:0">${petMode ? "Karabaş'ın bekleyeceği yere dokun." : "Barikat kurmak için parmağını harita üstünde sürükle (en çok kısa bir çit). Kurduğun barikata dokunursan kaldırırsın."}</p>
        <div class="row"><span class="hand">Kazık: <b>${sg.budget}</b></span>${sg.pet ? `<button class="btn small ${petMode ? "primary" : ""}" data-s="pet">Karabaş'ı yerleştir</button>` : ""}
        <span style="flex:1"></span><button class="btn primary" data-s="go">${sg.phase === "rest" ? "Sonraki dalga" : "Savaşı başlat"}</button></div>`;
      return;
    }
    if (sg.phase === "fight") {
      const sp = siegeSpells(cfg, s, sg); const bow = canShoot(s, sg);
      panel.innerHTML = `<div class="siege-spells">${sp.map(x => `<button class="spell-btn ${armed === x.id ? "on" : ""}" data-spell="${x.id}" ${x.ok ? "" : "disabled"}><span class="cdf" data-cd="${x.id}" style="height:${x.left > 0 ? (x.left / x.cd) * 100 : 0}%"></span><b>${esc(x.name)}</b><small>${x.mana} mana</small></button>`).join("") || `<span class="muted tiny">Büyün yok.</span>`}</div>
        <p class="tiny" style="margin:0">${armed ? "Hedefe dokun." : bow === "Yayın yok" ? "Yanına gelene kılıcınla kendin vurursun. (Yay pazarda satılır.)" : `Ok: kendinden geriye doğru çek, bırak (${s.inventory.ok ?? 0} ok). Yanına geleni kılıçla kendin vurursun.`}</p>`;
      return;
    }
  }
  function refreshCooldowns() {
    if (sg.phase !== "fight") return;
    for (const x of siegeSpells(cfg, s, sg)) {
      const b = panel.querySelector<HTMLButtonElement>(`[data-spell="${x.id}"]`); if (!b) continue;
      b.disabled = !x.ok; const f = b.querySelector<HTMLElement>(".cdf"); if (f) f.style.height = `${x.left > 0 ? (x.left / x.cd) * 100 : 0}%`;
    }
  }
  panel.addEventListener("click", e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button"); if (!b || b.disabled) return;
    if (b.dataset.s === "pet") { petMode = !petMode; renderPanel(); return; }
    if (b.dataset.s === "go") { if (sg.phase === "rest") restBetween(s, sg); petMode = false; startWave(sg); sfx("beat"); buzz("medium"); renderPanel(); return; }
    if (b.dataset.spell) { armed = armed === b.dataset.spell ? null : b.dataset.spell; sfx("tap"); renderPanel(); }
  });

  /* ---------- dokunma ---------- */
  cv.addEventListener("pointerdown", e => {
    const p = toArena(e); cv.setPointerCapture(e.pointerId);
    if (sg.phase === "fight") {
      if (armed) { if (cast(cfg, s, sg, armed, p.x, p.y)) { sfx("fire"); buzz("medium"); } armed = null; renderPanel(); return; }
      if (Math.hypot(p.x - CX, p.y - CY) < 18) drag = { x: p.x, y: p.y, cx: p.x, cy: p.y, bow: true };
      return;
    }
    if (sg.phase === "build" || sg.phase === "rest") {
      if (petMode) { placePet(sg, p.x, p.y); petMode = false; sfx("tap"); renderPanel(); return; }
      const hit = sg.barricades.find(b => b.kind === "kazik" && distSeg(p.x, p.y, b) < 2.5);
      if (hit) { removeBarricade(sg, hit.id); sfx("tap"); renderPanel(); return; }
      drag = { x: p.x, y: p.y, cx: p.x, cy: p.y, bow: false };
    }
  });
  cv.addEventListener("pointermove", e => { if (!drag) return; const p = toArena(e); drag.cx = p.x; drag.cy = p.y; });
  const up = () => {
    if (!drag) return; const d = drag; drag = null;
    if (d.bow) {
      const dx = d.cx - CX, dy = d.cy - CY, L = Math.hypot(dx, dy);
      if (L > 4) { const r = canShoot(s, sg); if (r) { pops.push({ x: CX, y: CY - 8, t: performance.now(), text: r, color: C("--ink-soft") }); return; }
        if (shoot(s, sg, Math.atan2(-dy, -dx), Math.min(1, L / 20))) { sfx("whoosh"); buzz("light"); renderPanel(); } }
      return;
    }
    const r = placeBarricade(s, sg, d.x, d.y, d.cx, d.cy);
    if (r.ok) { sfx("thunk"); buzz("light"); } else if (Math.hypot(d.cx - d.x, d.cy - d.y) > 2) pops.push({ x: d.cx, y: d.cy, t: performance.now(), text: r.reason ?? "", color: C("--red") });
    renderPanel();
  };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  const distSeg = (px: number, py: number, b: { x1: number; y1: number; x2: number; y2: number }) => { const vx = b.x2 - b.x1, vy = b.y2 - b.y1, L2 = vx * vx + vy * vy || 1; const t = Math.max(0, Math.min(1, ((px - b.x1) * vx + (py - b.y1) * vy) / L2)); return Math.hypot(px - b.x1 - vx * t, py - b.y1 - vy * t); };

  /* ---------- çizim ---------- */
  const ground = def.ground === "kar" ? ["#EEF1F3", "#C9D3DC"] : def.ground === "tas" ? ["#D8D0BE", "#A9A08C"] : ["#D9D6A6", "#A8A86E"];
  function drawGround(w: number, h: number) {
    g.fillStyle = C("--paper"); g.fillRect(0, 0, w, h);
    g.fillStyle = ground[0]; g.fillRect(X(0), Y(0), ARENA.w * scale, ARENA.h * scale);
    g.strokeStyle = ground[1]; g.lineWidth = 1; g.globalAlpha = 0.6;
    for (let i = 0; i < 90; i++) { const x = (i * 37.7) % ARENA.w, y = (i * 61.3) % ARENA.h; g.beginPath(); g.moveTo(X(x), Y(y)); g.lineTo(X(x + 1), Y(y - 1.8)); g.stroke(); }
    g.globalAlpha = 1;
    const v = g.createRadialGradient(X(CX), Y(CY), scale * 20, X(CX), Y(CY), scale * 80); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(42,39,34,.25)"); g.fillStyle = v; g.fillRect(X(0), Y(0), ARENA.w * scale, ARENA.h * scale);
  }
  function figure(key: string | null, x: number, y: number, h: number, faceRight: boolean, filter = "none", alpha = 1) {
    const im = key ? img(key) : null; if (!im) return false;
    const w = h * im.naturalWidth / im.naturalHeight;
    g.save(); g.globalAlpha = alpha; g.translate(X(x), Y(y)); if (faceRight) g.scale(-1, 1); g.filter = filter;
    g.drawImage(im, -w * scale / 2, -h * scale * 0.85, w * scale, h * scale); g.restore(); return true;
  }
  function draw(now: number) {
    const r = stage.getBoundingClientRect(); g.save();
    if (shake > 0) g.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    drawGround(r.width, r.height);
    for (const z of sg.zones) { const gr = g.createRadialGradient(X(z.x), Y(z.y), 0, X(z.x), Y(z.y), z.r * scale); if (z.kind === "ates") { gr.addColorStop(0, `rgba(255,170,60,${0.55 * Math.min(1, z.t)})`); gr.addColorStop(1, "rgba(200,60,20,0)"); } else { gr.addColorStop(0, "rgba(110,85,50,.55)"); gr.addColorStop(1, "rgba(110,85,50,0)"); } g.fillStyle = gr; g.beginPath(); g.arc(X(z.x), Y(z.y), z.r * scale, 0, 7); g.fill(); }
    for (const b of sg.barricades) {
      const L = Math.hypot(b.x2 - b.x1, b.y2 - b.y1); const n = Math.max(2, Math.round(L / 2.2)); const f = b.hp / b.max;
      g.strokeStyle = b.kind === "buz" ? "#9FD3E8" : "#6B4A2E"; g.lineWidth = scale * 1.1; g.lineCap = "round";
      g.beginPath(); g.moveTo(X(b.x1), Y(b.y1)); g.lineTo(X(b.x2), Y(b.y2)); g.stroke();
      g.strokeStyle = C("--ink"); g.lineWidth = 1.5;
      for (let i = 0; i <= n; i++) { const t = i / n; const x = b.x1 + (b.x2 - b.x1) * t, y = b.y1 + (b.y2 - b.y1) * t; g.fillStyle = b.kind === "buz" ? "#E6F4FA" : "#8A6A45"; g.beginPath(); g.moveTo(X(x) - scale * 0.6, Y(y)); g.lineTo(X(x), Y(y) - scale * 2.4); g.lineTo(X(x) + scale * 0.6, Y(y)); g.closePath(); g.fill(); g.stroke(); }
      if (f < 1) { g.fillStyle = f > 0.4 ? C("--green") : C("--red"); g.fillRect(X((b.x1 + b.x2) / 2) - 10, Y((b.y1 + b.y2) / 2) - scale * 3.5, 20 * f, 3); }
    }
    if (drag && !drag.bow) { g.setLineDash([5, 5]); g.strokeStyle = C("--ink"); g.lineWidth = 2; const L = Math.hypot(drag.cx - drag.x, drag.cy - drag.y); const k = L > BARRICADE_MAX_LEN ? BARRICADE_MAX_LEN / L : 1; g.beginPath(); g.moveTo(X(drag.x), Y(drag.y)); g.lineTo(X(drag.x + (drag.cx - drag.x) * k), Y(drag.y + (drag.cy - drag.y) * k)); g.stroke(); g.setLineDash([]); }
    // köpek
    if (sg.pet) {
      const p = sg.pet; if (sg.phase !== "fight") { g.strokeStyle = C("--blue"); g.setLineDash([3, 4]); g.beginPath(); g.arc(X(p.px), Y(p.py), 16 * scale, 0, 7); g.stroke(); g.setLineDash([]); }
      if (!figure("dusman_kurt", p.x, p.y, 8, false, p.down ? "grayscale(1) opacity(.5)" : ENEMIES.kopek.tint ?? "none")) { g.fillStyle = "#6B4A2E"; g.beginPath(); g.ellipse(X(p.x), Y(p.y), scale * 2.5, scale * 1.4, 0, 0, 7); g.fill(); }
    }
    // adamlar
    for (const h of sg.helpers) { const tint = ENEMIES["h_" + h.role]?.tint ?? "none"; figure("poz_kahraman_durus", h.x, h.y, 13, h.x < CX, tint);
      g.fillStyle = C("--ink"); g.font = "700 13px Caveat, cursive"; g.textAlign = "center"; g.fillText(h.name.split(" ")[0], X(h.x), Y(h.y) + 10); }
    // düşmanlar
    for (const f of sg.foes) {
      const d = ENEMIES[f.def]; const right = CX > f.x; const h = f.human ? 15 * (d.scale ?? 1) : 9.5 * (d.scale ?? 1);
      const key = f.human ? (artUrl("dusman_" + f.def) ? "dusman_" + f.def : f.atkCd > 1.5 ? "poz_kahraman_vurus" : "poz_kahraman_durus") : (f.atkCd > 1.5 ? "poz_kurt_atilma" : "dusman_kurt");
      const filt = (artUrl("dusman_" + f.def) && f.human) ? "none" : d.tint ?? "none";
      if (!figure(key, f.x, f.y, h, f.human ? right : right, filt, f.flee ? 0.6 : 1)) { g.fillStyle = "#5E5850"; g.beginPath(); g.arc(X(f.x), Y(f.y), f.r * scale, 0, 7); g.fill(); }
      if (f.burnT > 0) { g.fillStyle = `rgba(240,140,40,${0.5 + Math.sin(now / 60) * 0.3})`; g.beginPath(); g.ellipse(X(f.x), Y(f.y) - h * scale * 0.5, scale * 1.4, scale * 2.6, 0, 0, 7); g.fill(); }
      if (f.stunT > 0) { g.fillStyle = C("--blue"); g.font = `${scale * 3}px serif`; g.fillText("✦", X(f.x), Y(f.y) - h * scale); }
      g.fillStyle = "rgba(234,224,200,.9)"; g.fillRect(X(f.x) - 12, Y(f.y) - h * scale * 0.95, 24, 4); g.fillStyle = C("--red"); g.fillRect(X(f.x) - 12, Y(f.y) - h * scale * 0.95, 24 * Math.max(0, f.hp / f.max), 4);
    }
    // oyuncu
    if (!figure(swing > now ? "poz_kahraman_vurus" : "poz_kahraman_durus", CX, CY, 17, false)) { g.fillStyle = C("--blue"); g.beginPath(); g.arc(X(CX), Y(CY), PLAYER_R * scale, 0, 7); g.fill(); }
    // ok
    g.strokeStyle = "#5B4630"; g.lineWidth = 2; for (const a of sg.arrows) { const L = Math.hypot(a.vx, a.vy) || 1; g.beginPath(); g.moveTo(X(a.x), Y(a.y)); g.lineTo(X(a.x - a.vx / L * 4), Y(a.y - a.vy / L * 4)); g.stroke(); }
    if (drag?.bow) {
      const dx = drag.cx - CX, dy = drag.cy - CY, L = Math.hypot(dx, dy); const p = Math.min(1, L / 20);
      g.strokeStyle = C("--ink"); g.lineWidth = 2; g.beginPath(); g.moveTo(X(CX), Y(CY)); g.lineTo(X(drag.cx), Y(drag.cy)); g.stroke();
      g.setLineDash([2, 6]); g.strokeStyle = C("--red"); g.globalAlpha = 0.5 + p * 0.5; g.beginPath(); g.moveTo(X(CX), Y(CY)); g.lineTo(X(CX - dx / (L || 1) * (25 + 45 * p)), Y(CY - dy / (L || 1) * (25 + 45 * p))); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
    }
    if (armed) { g.strokeStyle = C("--red"); g.setLineDash([4, 4]); g.lineWidth = 1.5; g.beginPath(); g.arc(X(CX), Y(CY), scale * 6, 0, 7); g.stroke(); g.setLineDash([]); }
    for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; const k = (now - p.t) / 800; if (k > 1) { pops.splice(i, 1); continue; } g.globalAlpha = 1 - k; g.fillStyle = p.color; g.font = `700 ${p.big ? 24 : 18}px Caveat, cursive`; g.textAlign = "center"; g.fillText(p.text, X(p.x), Y(p.y) - k * 26); g.globalAlpha = 1; }
    g.restore();
    if (flash > 0) { g.fillStyle = `rgba(158,52,35,${flash * 0.3})`; g.fillRect(0, 0, r.width, r.height); }
    for (let i = lbolts.length - 1; i >= 0; i--) if (!drawBolt(g, lbolts[i], now, Math.max(0.8, scale / 4.5))) lbolts.splice(i, 1);
    for (let i = limpacts.length - 1; i >= 0; i--) if (!drawImpact(g, limpacts[i], now)) limpacts.splice(i, 1);
    if (wflash > 0) { g.fillStyle = `rgba(210,225,255,${wflash * 0.4})`; g.fillRect(0, 0, r.width, r.height); wflash = Math.max(0, wflash - 0.07); }
    (el.querySelector("#sgHp") as HTMLElement).style.width = `${(sg.hp / sg.maxHp) * 100}%`;
    (el.querySelector("#sgMana") as HTMLElement).style.width = `${(sg.mana / Math.max(1, sg.maxMana)) * 100}%`;
  }

  /* ---------- döngü ---------- */
  let last = performance.now(); let raf = 0; let cdTick = 0; let ended = false;
  const loop = (now: number) => {
    const dt = (now - last) / 1000; last = now;
    const before = sg.phase; step(cfg, s, sg, dt);
    for (const f of sg.fx.splice(0)) {
      if (f.k === "hit") { pops.push({ x: f.x, y: f.y - 6, t: now, text: `${f.crit ? "Kritik! " : ""}−${f.dmg}`, color: f.by === "kopek" ? C("--green") : f.crit ? C("--red") : C("--ink"), big: f.crit }); if (f.by === "kilic") { swing = now + 180; sfx(f.crit ? "crit" : "hit"); } else if (f.by === "ok") sfx("hit"); }
      if (f.k === "hurt") { shake = 8; flash = 1; sfx("hurt"); buzz("medium"); }
      if (f.k === "die") sfx("thunk");
      if (f.k === "bar" && f.broken) { sfx("clang"); buzz("light"); }
      if (f.k === "cast") {
        if (f.chain) { const pts: Pt[] = [[X(CX), Y(CY) - scale * 8], ...f.chain.map(([x, y]) => [X(x), Y(y) - scale * 4] as Pt)]; const seed = (now | 0) % 9973;
          if (pts.length < 2) pts.push([X(f.x), Y(f.y)]);
          for (const c of chain(pts, seed)) lbolts.push({ b: c.bolt, t0: now, delay: c.delay, dur: 380 });
          pts.slice(1).forEach(([x, y], i) => limpacts.push(Object.assign(impact(x, y, scale * 5, seed + i, now), { t0: now + i * 70 }))); sfx("thunder"); wflash = 0.7; }
        else if (f.fire) { limpacts.push(Object.assign(impact(X(f.x), Y(f.y), f.r * scale, (now | 0) % 997, now), { color: "255,150,60" })); sfx("fire"); }
        else limpacts.push(Object.assign(impact(X(f.x), Y(f.y), f.r * scale * 0.8, (now | 0) % 997, now), { color: "150,200,150" }));
      }
      if (f.k === "wave") pops.push({ x: CX, y: CY - 22, t: now, text: `Dalga ${f.n}!`, color: C("--red"), big: true });
    }
    shake = Math.max(0, shake - dt * 30); flash = Math.max(0, flash - dt * 3);
    if (before === "fight" && sg.phase !== "fight") { renderPanel(); if (sg.phase === "rest") sfx("good"); }
    if ((cdTick += dt) > 0.15) { cdTick = 0; refreshCooldowns(); }
    draw(now);
    if ((sg.phase === "won" || sg.phase === "lost") && !ended) { ended = true; setTimeout(finish, 900); }
    raf = requestAnimationFrame(loop);
  };
  function finish() {
    cancelAnimationFrame(raf); ro.disconnect();
    const r = finishSiege(cfg, s, sg); persist(); el.remove();
    sfx(r.won ? "win" : "lose"); if (!r.won) buzz("long");
    onEnd(r.won, r.gains, sg.helpers.map(h => h.id));
  }
  const ro = new ResizeObserver(layout); ro.observe(stage);
  layout(); renderPanel(); raf = requestAnimationFrame(loop);
}
