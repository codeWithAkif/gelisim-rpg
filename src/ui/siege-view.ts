// Kuşatma ekranı: gerçek zamanlı savunma. Kurulum: parmakla barikat çek, köpeği yerleştir.
// Savaş: kendinden geriye çekip bırak → ok; büyüye dokun, sonra hedefe dokun → büyü (dolma süreli).
// Dalga aralarında dinlen, kazık ekle.
import { withGuide } from "./guide";
import type { Config } from "../engine/config";
import type { GameState } from "../engine/state";
import {
  type Siege, type SiegeDef, ARENA, PLAYER_R, BARRICADE_MAX_LEN, createSiege, placeBarricade, removeBarricade, placePet,
  startWave, step, shoot, canShoot, siegeSpells, cast, restBetween, finishSiege, spellAim, castThrow, castWall, THROW_RANGE, wallLen,
} from "../engine/siege";
import { ENEMIES } from "../content/world";
import type { GainReport } from "../engine/progression";
import { artUrl } from "./art";
import { esc } from "./sketch";
import { sfx, buzz } from "./feel";
import { quad, drawQuad, walkFrame, gait } from "./anim";
import { chainFx, skyFx, drawBolt, drawImpact, impact, type BoltFx, type Impact, type Pt } from "./lightning";
import { castDrawPrompt } from "./gesture-view";
import { drawFlames, drawEmbers, type Ember } from "./fire-fx";
import { SPELL_FX } from "../engine/magic";
import { settings } from "./settings";
import { skillEase } from "../engine/timing";
import { synthesize, discover } from "../engine/synthesis";
import { ELEMENT_RUNES, FORM_RUNES } from "../engine/gesture";
import type { FormId } from "../content/synthesis";

const CX = ARENA.w / 2, CY = ARENA.h / 2;
const imgCache = new Map<string, HTMLImageElement | null>();
const img = (key: string) => { if (!imgCache.has(key)) { const u = artUrl(key); imgCache.set(key, u ? Object.assign(new Image(), { src: u }) : null); } const i = imgCache.get(key)!; return i && i.complete && i.naturalWidth ? i : null; };

function openSiegeInner(cfg: Config, s: GameState, def: SiegeDef, seed: number, onEnd: (won: boolean, gains: GainReport, heroes: string[]) => void, persist: () => void, called: string[] = []) {
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
  let bowSwing = 0; let lastShotRight = false;
  const streaks: { x1: number; y1: number; x2: number; y2: number; t: number }[] = [];
  let armed: string | null = null; let petMode = false;
  // büyü avuçtayken zaman durur: uygulayana ya da vazgeçene kadar kurtlar kıpırdamaz
  let aimDrag: { x: number; y: number; cx: number; cy: number } | null = null;
  const arm = (id: string | null) => { armed = id; aimDrag = null; frozen = !!id; if (!id) last = performance.now(); }; let drag: { x: number; y: number; cx: number; cy: number; bow: boolean } | null = null;
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
      // zamanlama oyunları açıksa büyü burada da aklından çizilir; düğmeler yalnız dolma süresini gösterir
      const drawMode = settings().timing && s.knownElements.length > 0;
      const armedName = armed ? sp.find(x => x.id === armed)?.name ?? "" : "";
      if (drawMode) {
        panel.innerHTML = `<div class="row"><button class="btn small blue" data-s="draw" ${sg.mana >= 3 ? "" : "disabled"}>Büyü çiz · mana ${Math.floor(sg.mana)}</button>${armed ? `<span class="hand">${esc(armedName)}</span><button class="btn small" data-s="disarm">Vazgeç</button>` : ""}</div>
          ${armed ? `<p class="tiny" style="margin:0"><b>${spellAim(armed) === "wall" ? "Duvarı haritaya çiz: parmağını sürükle, bırak." : spellAim(armed) === "throw" ? "Kahramandan gitmesini istediğin yere doğru ileri sürükle, bırak." : "Hedefe dokun."}</b> Zaman durdu.</p>` : ""}
          <div class="siege-spells">${sp.map(x => `<span class="spell-btn off ${armed === x.id ? "on" : ""}" data-spell-cd="${x.id}"><span class="cdf" data-cd="${x.id}" style="height:${x.left > 0 ? (x.left / x.cd) * 100 : 0}%"></span><b>${esc(x.name)}</b><small>${x.left > 0 ? "doluyor" : `${x.mana} mana`}</small></span>`).join("")}</div>
          <p class="tiny" style="margin:0">${bow === "Yayın yok" ? "Yanına gelene kılıcınla kendin vurursun." : `Ok: kendinden geriye doğru çek, bırak (${s.inventory.ok ?? 0} ok).`} Büyü çizerken zaman durur.</p>`;
        return;
      }
      panel.innerHTML = `<div class="siege-spells">${sp.map(x => `<button class="spell-btn ${armed === x.id ? "on" : ""}" data-spell="${x.id}" ${x.ok ? "" : "disabled"}><span class="cdf" data-cd="${x.id}" style="height:${x.left > 0 ? (x.left / x.cd) * 100 : 0}%"></span><b>${esc(x.name)}</b><small>${x.mana} mana</small></button>`).join("") || `<span class="muted tiny">Büyün yok.</span>`}</div>
        <p class="tiny" style="margin:0">${armed ? (spellAim(armed) === "wall" ? "Duvarı haritaya çiz. Zaman durdu." : spellAim(armed) === "throw" ? "Kahramandan ileri sürükle, bırak. Zaman durdu." : "Hedefe dokun. Zaman durdu.") : bow === "Yayın yok" ? "Yanına gelene kılıcınla kendin vurursun. (Yay pazarda satılır.)" : `Ok: kendinden geriye doğru çek, bırak (${s.inventory.ok ?? 0} ok). Yanına geleni kılıçla kendin vurursun.`}</p>`;
      return;
    }
  }
  function refreshCooldowns() {
    if (sg.phase !== "fight") return;
    for (const x of siegeSpells(cfg, s, sg)) {
      const b = panel.querySelector<HTMLButtonElement>(`[data-spell="${x.id}"]`);
      if (b) b.disabled = !x.ok;
      const f = panel.querySelector<HTMLElement>(`[data-cd="${x.id}"]`); if (f) f.style.height = `${x.left > 0 ? (x.left / x.cd) * 100 : 0}%`;
    }
  }
  panel.addEventListener("click", e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button"); if (!b || b.disabled) return;
    if (b.dataset.s === "pet") { petMode = !petMode; renderPanel(); return; }
    if (b.dataset.s === "go") { if (sg.phase === "rest") restBetween(s, sg); petMode = false; startWave(sg); sfx("beat"); buzz("medium"); renderPanel(); return; }
    if (b.dataset.spell) { arm(armed === b.dataset.spell ? null : b.dataset.spell); sfx("tap"); renderPanel(); }
    if (b.dataset.s === "disarm") { arm(null); sfx("tap"); renderPanel(); }
    if (b.dataset.s === "draw") void drawSpell();
  });
  /** Büyüyü çiz: zaman durur; dizi bir büyü ederse ve dolmuşsa hedefe dokunulur. Uymazsa söner, biraz mana yanar. */
  async function drawSpell() {
    if (sg.phase !== "fight" || frozen) return;
    frozen = true; armed = null; aimDrag = null;
    const allowed = [...ELEMENT_RUNES.filter(r => s.knownElements.includes(r)), ...FORM_RUNES];
    const res = await castDrawPrompt(stage, { allowed, ease: skillEase(s, "odak"), limitMs: 9000 });
    frozen = false; last = performance.now();
    const say = (t: string, c = C("--ink-soft")) => pops.push({ x: CX, y: CY - 14, t: performance.now(), text: t, color: c });
    if (!res) { renderPanel(); return; }
    const f = res.runes[res.runes.length - 1]?.startsWith("f_") ? res.runes[res.runes.length - 1].slice(2) as FormId : undefined;
    const r = f ? synthesize(s, res.runes.filter(x => !x.startsWith("f_")), f) : { ok: false, reason: "Biçimsiz büyü dağıldı." };
    if (!r.ok) { sg.mana = Math.max(0, sg.mana - 3); say("Söndü"); sfx("bad"); renderPanel(); return; }
    if (r.spellId!.startsWith("sy_") && discover(s, r.spellId!)) { say(`Yeni büyü: ${cfg.spell.get(r.spellId!)!.name}!`, C("--blue")); sfx("perfect"); buzz("heavy"); persist(); }
    const x = siegeSpells(cfg, s, sg).find(q => q.id === r.spellId);
    if (!x) { say("Ustalığın yetmiyor"); sfx("bad"); renderPanel(); return; }
    if (!x.ok) { say(x.reason ?? "Olmadı"); sfx("bad"); renderPanel(); return; }
    arm(x.id); sfx("spark"); renderPanel();
  }

  /* ---------- dokunma ---------- */
  cv.addEventListener("pointerdown", e => {
    const p = toArena(e); cv.setPointerCapture(e.pointerId);
    if (sg.phase === "fight") {
      if (armed) {
        if (spellAim(armed) === "at") { if (cast(cfg, s, sg, armed, p.x, p.y)) { sfx("fire"); buzz("medium"); } arm(null); renderPanel(); return; }
        aimDrag = { x: p.x, y: p.y, cx: p.x, cy: p.y }; return;
      }
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
  cv.addEventListener("pointermove", e => { const p = toArena(e); if (aimDrag) { aimDrag.cx = p.x; aimDrag.cy = p.y; return; } if (!drag) return; drag.cx = p.x; drag.cy = p.y; });
  const up = () => {
    if (aimDrag && armed) {
      const a = aimDrag; aimDrag = null; const id = armed;
      if (spellAim(id) === "wall") {
        const r = castWall(cfg, s, sg, id, a.x, a.y, a.cx, a.cy);
        if (r.ok) { sfx("fire"); buzz("medium"); arm(null); } else pops.push({ x: a.cx, y: a.cy, t: performance.now(), text: r.reason ?? "", color: C("--red") });
      } else {
        if (Math.hypot(a.cx - CX, a.cy - CY) < 4) { pops.push({ x: CX, y: CY - 8, t: performance.now(), text: "İleri doğru sürükle", color: C("--ink-soft") }); return; }
        if (castThrow(cfg, s, sg, id, a.cx, a.cy)) { sfx("whoosh"); buzz("medium"); arm(null); }
      }
      renderPanel(); return;
    }
    if (!drag) return; const d = drag; drag = null;
    if (d.bow) {
      const dx = d.cx - CX, dy = d.cy - CY, L = Math.hypot(dx, dy);
      if (L > 4) { const r = canShoot(s, sg); if (r) { pops.push({ x: CX, y: CY - 8, t: performance.now(), text: r, color: C("--ink-soft") }); return; }
        if (shoot(s, sg, Math.atan2(-dy, -dx), Math.min(1, L / 20))) { sfx("whoosh"); buzz("light"); bowSwing = performance.now() + 180; lastShotRight = Math.cos(Math.atan2(-dy, -dx)) > 0; renderPanel(); } }
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
  const embers: Ember[] = [];
  function draw(now: number) {
    const r = stage.getBoundingClientRect(); g.save();
    if (shake > 0) g.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    drawGround(r.width, r.height);
    // çamur lekesi; alev: kavrulmuş toprak, sıcak hale, titreşen alev dilleri (altıgen savaştaki mürekkep alevlerin kardeşi)
    for (const z of sg.zones) if (z.kind !== "ates") { const gr = g.createRadialGradient(X(z.x), Y(z.y), 0, X(z.x), Y(z.y), z.r * scale); gr.addColorStop(0, "rgba(110,85,50,.55)"); gr.addColorStop(1, "rgba(110,85,50,0)"); g.fillStyle = gr; g.beginPath(); g.arc(X(z.x), Y(z.y), z.r * scale, 0, 7); g.fill(); }
    sg.zones.forEach((z, i) => { if (z.kind === "ates") drawFlames(g, embers, X(z.x), Y(z.y), z.r * scale * 1.05, i * 13 + Math.round(z.x * 7), now, Math.min(1, z.t)); });
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
      const pid = s.pet?.id ?? "kopek"; const own = !!artUrl("dusman_" + pid); const pmv = Math.hypot(p.x - p.px, p.y - p.py) > 1 || sg.phase === "fight"; const pq = !p.down && pmv ? quad(`anim_${pid}_yuru`, walkFrame(now, 3, 8)) : null;
      const pf = p.down ? "grayscale(1) opacity(.5)" : own ? "none" : ENEMIES[pid]?.tint ?? "none";
      if (pq) drawQuad(g, pq, X(p.x), Y(p.y), 8 * scale, p.x < CX, pf);
      else if (!figure(own ? "dusman_" + pid : "dusman_kurt", p.x, p.y, 8, false, pf)) { g.fillStyle = "#6B4A2E"; g.beginPath(); g.ellipse(X(p.x), Y(p.y), scale * 2.5, scale * 1.4, 0, 0, 7); g.fill(); }
    }
    // adamlar
    for (const h of sg.helpers) { const tint = ENEMIES["h_" + h.role]?.tint ?? "none"; figure("poz_kahraman_durus", h.x, h.y, 13, h.x < CX, tint);
      g.fillStyle = C("--ink"); g.font = "700 13px Caveat, cursive"; g.textAlign = "center"; g.fillText(h.name.split(" ")[0], X(h.x), Y(h.y) + 10); }
    // düşmanlar
    for (const f of sg.foes) {
      const d = ENEMIES[f.def]; const right = CX > f.x; const h = f.human ? 15 * (d.scale ?? 1) : 9.5 * (d.scale ?? 1);
      const key = f.human ? (artUrl("dusman_" + f.def) ? "dusman_" + f.def : f.atkCd > 1.5 ? "poz_kahraman_vurus" : "poz_kahraman_durus") : (f.atkCd > 1.5 ? "poz_kurt_atilma" : "dusman_kurt");
      const filt = (artUrl("dusman_" + f.def) && f.human) ? "none" : d.tint ?? "none";
      const mv = f.stunT <= 0; const wq = mv && !(f.human && artUrl("dusman_" + f.def)) ? quad(f.human ? "anim_kahraman_yuru" : "anim_kurt_yuru", walkFrame(now, f.id)) : null; const gt = gait(now, f.id, mv && !wq);
      if (wq) drawQuad(g, wq, X(f.x), Y(f.y), h * scale, right, filt, f.flee ? 0.6 : 1);
      else if (!figure(key, f.x, f.y + gt.dy * h * 0.25, h, f.human ? right : right, filt, f.flee ? 0.6 : 1)) { g.fillStyle = "#5E5850"; g.beginPath(); g.arc(X(f.x), Y(f.y), f.r * scale, 0, 7); g.fill(); }
      if (f.burnT > 0) { g.fillStyle = `rgba(240,140,40,${0.5 + Math.sin(now / 60) * 0.3})`; g.beginPath(); g.ellipse(X(f.x), Y(f.y) - h * scale * 0.5, scale * 1.4, scale * 2.6, 0, 0, 7); g.fill(); }
      if (f.stunT > 0) { g.fillStyle = C("--blue"); g.font = `${scale * 3}px serif`; g.fillText("✦", X(f.x), Y(f.y) - h * scale); }
      g.fillStyle = "rgba(234,224,200,.9)"; g.fillRect(X(f.x) - 12, Y(f.y) - h * scale * 0.95, 24, 4); g.fillStyle = C("--red"); g.fillRect(X(f.x) - 12, Y(f.y) - h * scale * 0.95, 24 * Math.max(0, f.hp / f.max), 4);
    }
    // oyuncu
    const pw = drag?.bow ? Math.min(1, Math.hypot(drag.cx - CX, drag.cy - CY) / 20) : 0; const bq = bowSwing > now ? quad("anim_kahraman_yay", 3) : drag?.bow ? quad("anim_kahraman_yay", pw < 0.3 ? 0 : pw < 0.75 ? 1 : 2) : null;
    if (bq) drawQuad(g, bq, X(CX), Y(CY), 17 * scale, drag?.bow ? drag.cx < CX : lastShotRight);
    else if (!figure(swing > now ? "poz_kahraman_vurus" : "poz_kahraman_durus", CX, CY, 17, false)) { g.fillStyle = C("--blue"); g.beginPath(); g.arc(X(CX), Y(CY), PLAYER_R * scale, 0, 7); g.fill(); }
    // tutuşan düşmanın sırtında alev
    for (const f of sg.foes) if (f.hp > 0 && f.burnT > 0) drawFlames(g, embers, X(f.x), Y(f.y) - f.r * scale * 0.9, f.r * scale * 0.9, f.id * 7, now, Math.min(1, f.burnT));
    // ok
    g.strokeStyle = "#5B4630"; g.lineWidth = 2; for (const a of sg.arrows) { const L = Math.hypot(a.vx, a.vy) || 1; g.beginPath(); g.moveTo(X(a.x), Y(a.y)); g.lineTo(X(a.x - a.vx / L * 4), Y(a.y - a.vy / L * 4)); g.stroke(); }
    if (drag?.bow) {
      const dx = drag.cx - CX, dy = drag.cy - CY, L = Math.hypot(dx, dy); const p = Math.min(1, L / 20);
      g.strokeStyle = C("--ink"); g.lineWidth = 2; g.beginPath(); g.moveTo(X(CX), Y(CY)); g.lineTo(X(drag.cx), Y(drag.cy)); g.stroke();
      g.setLineDash([2, 6]); g.strokeStyle = C("--red"); g.globalAlpha = 0.5 + p * 0.5; g.beginPath(); g.moveTo(X(CX), Y(CY)); g.lineTo(X(CX - dx / (L || 1) * (25 + 45 * p)), Y(CY - dy / (L || 1) * (25 + 45 * p))); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
    }
    if (armed) { g.strokeStyle = C("--red"); g.setLineDash([4, 4]); g.lineWidth = 1.5; g.beginPath(); g.arc(X(CX), Y(CY), scale * 6, 0, 7); g.stroke(); g.setLineDash([]); }
    // nişan önizlemesi: duvar çizgisi ya da kahramandan ileri ok ve düşeceği yer
    if (armed && aimDrag) {
      const aim = spellAim(armed); const fire = !!SPELL_FX[armed]?.ignite;
      if (aim === "wall") {
        const L = Math.hypot(aimDrag.cx - aimDrag.x, aimDrag.cy - aimDrag.y); const k = L > wallLen(armed) ? wallLen(armed) / L : 1;
        g.strokeStyle = fire ? "rgba(230,110,40,.85)" : "rgba(120,180,220,.9)"; g.lineWidth = scale * 1.6; g.lineCap = "round"; g.setLineDash([6, 4]);
        g.beginPath(); g.moveTo(X(aimDrag.x), Y(aimDrag.y)); g.lineTo(X(aimDrag.x + (aimDrag.cx - aimDrag.x) * k), Y(aimDrag.y + (aimDrag.cy - aimDrag.y) * k)); g.stroke(); g.setLineDash([]);
      } else {
        const dx = aimDrag.cx - CX, dy = aimDrag.cy - CY, L = Math.hypot(dx, dy) || 1; const k = Math.min(1, THROW_RANGE / L);
        const tx = CX + dx * k, ty = CY + dy * k; const rr = siegeSpells(cfg, s, sg).find(q => q.id === armed)?.r ?? 6;
        g.strokeStyle = C("--red"); g.lineWidth = 2.5; g.beginPath(); g.moveTo(X(CX), Y(CY)); g.lineTo(X(tx), Y(ty)); g.stroke();
        const ang = Math.atan2(ty - CY, tx - CX); g.beginPath(); g.moveTo(X(tx), Y(ty)); g.lineTo(X(tx) - Math.cos(ang - 0.4) * 12, Y(ty) - Math.sin(ang - 0.4) * 12); g.moveTo(X(tx), Y(ty)); g.lineTo(X(tx) - Math.cos(ang + 0.4) * 12, Y(ty) - Math.sin(ang + 0.4) * 12); g.stroke();
        g.setLineDash([4, 4]); g.globalAlpha = 0.7; g.beginPath(); g.arc(X(tx), Y(ty), rr * scale, 0, 7); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
      }
    }
    // atılan büyünün izi
    for (let i = streaks.length - 1; i >= 0; i--) { const t = (now - streaks[i].t) / 260; if (t > 1) { streaks.splice(i, 1); continue; } const st = streaks[i];
      g.strokeStyle = `rgba(240,140,50,${1 - t})`; g.lineWidth = scale * 1.4 * (1 - t * 0.5); g.beginPath(); g.moveTo(X(st.x1), Y(st.y1)); g.lineTo(X(st.x1 + (st.x2 - st.x1) * Math.min(1, t * 2)), Y(st.y1 + (st.y2 - st.y1) * Math.min(1, t * 2))); g.stroke(); }
    drawEmbers(g, embers, now);
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
  let last = performance.now(); let raf = 0; let cdTick = 0; let ended = false; let frozen = false;   // frozen: büyü çizilirken zaman durur
  const loop = (now: number) => {
    const dt = (now - last) / 1000; last = now;
    const before = sg.phase; if (!frozen) step(cfg, s, sg, dt);
    for (const f of sg.fx.splice(0)) {
      if (f.k === "hit") { pops.push({ x: f.x, y: f.y - 6, t: now, text: `${f.crit ? "Kritik! " : ""}−${f.dmg}`, color: f.by === "kopek" ? C("--green") : f.by === "ates" ? "#C2571E" : f.crit ? C("--red") : C("--ink"), big: f.crit }); if (f.by === "kilic") { swing = now + 180; sfx(f.crit ? "crit" : "hit"); } else if (f.by === "ok") sfx("hit"); }
      if (f.k === "hurt") { shake = 8; flash = 1; sfx("hurt"); buzz("medium"); }
      if (f.k === "die") sfx("thunk");
      if (f.k === "bar" && f.broken) { sfx("clang"); buzz("light"); }
      if (f.k === "cast" && f.from) streaks.push({ x1: f.from[0], y1: f.from[1], x2: f.x, y2: f.y, t: now });
      if (f.k === "cast") {
        if (f.chain && f.bolt === "sky") {
          // yıldırım: üstten aşağı, her vurulana ayrı
          const seed = (now | 0) % 9973; const tg: Pt[] = (f.chain.length ? f.chain : [[f.x, f.y] as [number, number]]).map(([x, y]) => [X(x), Y(y) - scale * 3] as Pt);
          const fx = skyFx(tg, -10, seed, now, scale * 6); lbolts.push(...fx.bolts); limpacts.push(...fx.impacts); sfx("thunder"); wflash = 1; }
        else if (f.chain) {
          // zincir şimşek: kahramanın elinden hedeften hedefe
          const pts: Pt[] = [[X(CX), Y(CY) - scale * 8], ...f.chain.map(([x, y]) => [X(x), Y(y) - scale * 4] as Pt)]; const seed = (now | 0) % 9973;
          if (pts.length < 2) pts.push([X(f.x), Y(f.y)]);
          const fx = chainFx(pts, seed, now, scale * 5); lbolts.push(...fx.bolts); limpacts.push(...fx.impacts); sfx("thunder"); wflash = 0.7; }
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

/** İlk girişte öğüt, sonra ekran. */
export function openSiege(...a: Parameters<typeof openSiegeInner>) { withGuide("barikat", a[1], () => openSiegeInner(...a)); }
