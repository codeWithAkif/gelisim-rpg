// Nöbet ekranı: üstte arazi ve kule (menzil çemberi), altta nöbet içi yükseltmeler.
// Kule kendiliğinden vurur; oyuncu kırıntıyla güçlendirir, sayfa dolunca kart seçer, şimşeği zamanlar.
// Nöbetten önce: kalıcı güçlenmeler (nöbet izi ile) ve rekor.
import type { Config } from "../engine/config";
import type { GameState } from "../engine/state";
import {
  type Nobet, type StatId, type NobetResult, NFIELD, TOWER, STAT_NAMES, CARDS, PERMS, createNobet, stepNobet, buyUpgrade, upgradeCost, statValue,
  pickCard, useSkill, finishNobet, nobetSite, nobetSave, permLevel, permCost, buyPerm, canStartNobet, isBossWave,
} from "../engine/nobet";
import { ENEMIES } from "../content/world";
import { artUrl } from "./art";
import { esc } from "./sketch";
import { sfx, buzz } from "./feel";

const imgCache = new Map<string, HTMLImageElement | null>();
const img = (key: string) => { if (!imgCache.has(key)) { const u = artUrl(key); imgCache.set(key, u ? Object.assign(new Image(), { src: u }) : null); } const i = imgCache.get(key)!; return i && i.complete && i.naturalWidth ? i : null; };
const fmt = (id: StatId, v: number) => id === "rate" || id === "regen" ? `${v.toFixed(2)}/sn` : id === "range" ? `${v.toFixed(1)} adım` : v.toFixed(1);

/** Nöbetten önce: kalıcı güçlenmeler ve başla düğmesi. */
export function openNobetHub(cfg: Config, s: GameState, place: string, persist: () => void, onEnd: (r: NobetResult) => void) {
  const site = nobetSite(place)!;
  const bg = document.createElement("div"); bg.className = "modal-bg";
  const draw = () => {
    const sv = nobetSave(s); const can = canStartNobet(s, place);
    bg.innerHTML = `<div class="modal nobet-hub" role="dialog" aria-modal="true"><p class="hand muted" style="margin:0">Nöbet</p><h2>${esc(site.name)}</h2>
      <p style="margin:0">Kulenin tepesindesin; menziline gireni kendin vurursun. Düşenlerden kırıntı toplar, onunla güçlenirsin. Sayfa dolunca bir kart seçersin. Dalgalar bitmez; ne kadar dayanabilirsin?</p>
      <div class="odds"><span>Rekor <b>${sv.best[place] ?? 0}. dalga</b></span><span>Nöbet izi <b>${sv.iz}</b></span><span>Enerji <b>−20</b></span></div>
      <h3 style="margin:4px 0 0">Kalıcı güçlenmeler</h3>
      <div class="perm-list">${PERMS.map(p => { const lv = permLevel(s, p.id); const c = permCost(p, lv); const max = lv >= p.max;
        return `<div class="perm"><div><b>${esc(p.name)}</b> <span class="tiny muted">${lv}/${p.max}</span><div class="tiny muted">${esc(p.desc)}</div></div>
          <button class="btn small" data-perm="${p.id}" ${max || sv.iz < c ? "disabled" : ""}>${max ? "Tam" : `${c} iz`}</button></div>`; }).join("")}</div>
      ${can.ok ? "" : `<p class="tiny red" style="margin:0">${esc(can.reason ?? "")}</p>`}
      <div class="row"><button class="btn" data-x="close">Kapat</button><span style="flex:1"></span><button class="btn primary" data-x="go" ${can.ok ? "" : "disabled"}>Nöbete başla</button></div></div>`;
  };
  draw(); document.body.appendChild(bg);
  bg.addEventListener("click", e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button"); if (!b || b.disabled) return;
    if (b.dataset.perm) { if (buyPerm(s, b.dataset.perm).ok) { sfx("coin"); buzz("light"); persist(); } draw(); return; }
    bg.remove();
    if (b.dataset.x === "go") openNobet(cfg, s, place, persist, onEnd);
  });
}

export function openNobet(cfg: Config, s: GameState, place: string, persist: () => void, onEnd: (r: NobetResult) => void) {
  const site = nobetSite(place)!;
  const n: Nobet = createNobet(cfg, s, site, (s.seed * 31 + s.day * 977 + Math.floor(s.minute)) | 0);
  s.energy = Math.max(0, s.energy - 10); persist();
  const el = document.createElement("div"); el.className = "siege nobet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Nöbet");
  el.innerHTML = `<div class="nb-top"><button class="btn small" data-c="pause">Ⅱ</button><div class="nb-waves" id="nbWaves"></div><button class="btn small" data-c="speed">1x</button></div>
    <div class="siege-stage"><canvas></canvas><button class="nb-skill" data-c="skill" aria-label="Şimşek"><span class="cdf" id="nbSkillCd"></span>ϟ</button></div>
    <div class="nb-hp"><div class="gb"><div class="gf" id="nbHp" style="background:var(--red)"></div></div><span id="nbHpT"></span></div>
    <div class="nb-bar"><div class="nb-page" title="Defter sayfası"><div class="gf" id="nbPage"></div></div><span class="nb-coins" id="nbCoins"></span></div>
    <div class="nb-ups" id="nbUps"></div><div class="nb-card" id="nbCard" hidden></div><div class="nb-card" id="nbPause" hidden></div>`;
  document.body.appendChild(el);
  const cv = el.querySelector("canvas")!; const stage = el.querySelector<HTMLElement>(".siege-stage")!; const g = cv.getContext("2d")!;
  const ups = el.querySelector<HTMLElement>("#nbUps")!; const cardEl = el.querySelector<HTMLElement>("#nbCard")!; const pauseEl = el.querySelector<HTMLElement>("#nbPause")!;
  let scale = 4, ox = 0, oy = 0, speed = 1, paused = false;
  const layout = () => {
    const r = stage.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
    cv.width = r.width * dpr; cv.height = r.height * dpr; cv.style.width = r.width + "px"; cv.style.height = r.height + "px";
    scale = Math.max(r.width / NFIELD.w, r.height / NFIELD.h); ox = (r.width - NFIELD.w * scale) / 2; oy = (r.height - NFIELD.h * scale) / 2;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const X = (x: number) => ox + x * scale, Y = (y: number) => oy + y * scale;
  const cs = getComputedStyle(document.documentElement); const C = (v: string) => cs.getPropertyValue(v).trim();
  const pops: { x: number; y: number; t: number; text: string; color: string; big?: boolean }[] = [];
  const zaps: { pts: [number, number][]; t: number }[] = []; const blasts: { x: number; y: number; r: number; t: number }[] = [];
  let shake = 0, flash = 0;

  const STATS: StatId[] = ["dmg", "rate", "hp", "regen", "range"];
  function renderUps() {
    ups.innerHTML = STATS.map(id => { const c = upgradeCost(n.lv[id]);
      return `<button class="nb-up" data-up="${id}" ${n.coins < c ? "disabled" : ""}><span class="nm">${STAT_NAMES[id]}</span><span class="val">${fmt(id, statValue(n, id))}</span><span class="cost">${c} ◉</span></button>`; }).join("");
  }
  function refreshUps() {
    for (const id of STATS) { const b = ups.querySelector<HTMLButtonElement>(`[data-up="${id}"]`); if (!b) continue; b.disabled = n.coins < upgradeCost(n.lv[id]); }
  }
  ups.addEventListener("click", e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-up]"); if (!b || b.disabled) return;
    if (buyUpgrade(n, b.dataset.up as StatId)) { sfx("coin"); buzz("light"); renderUps(); }
  });
  function showCards() {
    cardEl.hidden = false; sfx("perfect"); buzz("medium");
    cardEl.innerHTML = `<p class="hand" style="margin:0;font-size:24px">Defterden bir sayfa</p><p class="tiny muted" style="margin:0">Birini seç; nöbet boyunca seninle.</p>
      ${n.offer.map(id => { const c = CARDS.find(x => x.id === id)!; const lv = n.cards[id] ?? 0;
        return `<button class="choice" data-card="${id}"><b>${esc(c.name)}${lv ? ` ${"I".repeat(lv + 1)}` : ""}</b><span>${esc(c.desc)}</span></button>`; }).join("")}`;
  }
  cardEl.addEventListener("click", e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-card]"); if (!b) return;
    if (pickCard(s, n, b.dataset.card!)) { cardEl.hidden = true; sfx("page"); if (n.phase === "card") showCards(); }
  });
  el.querySelector(".nb-top")!.addEventListener("click", e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-c]"); if (!b) return;
    if (b.dataset.c === "speed") { speed = speed === 1 ? 2 : speed === 2 ? 4 : 1; b.textContent = `${speed}x`; sfx("tap"); }
    if (b.dataset.c === "pause") { paused = true; pauseEl.hidden = false;
      pauseEl.innerHTML = `<p class="hand" style="margin:0;font-size:26px">Mola</p><p class="tiny muted" style="margin:0">${n.wave}. dalga · ${n.stats.kills} düşman</p>
        <button class="btn primary" data-p="go">Devam et</button><button class="btn" data-p="quit">Nöbeti bırak</button>`; }
  });
  pauseEl.addEventListener("click", e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-p]"); if (!b) return;
    pauseEl.hidden = true; paused = false; if (b.dataset.p === "quit") { n.phase = "over"; }
  });
  el.querySelector("[data-c=skill]")!.addEventListener("click", () => { if (useSkill(n)) { sfx("spark"); sfx("crit"); buzz("heavy"); shake = 10; } else sfx("bad"); });

  /* ---------- çizim ---------- */
  const ground = site.ground === "kar" ? ["#EEF1F3", "#C9D3DC"] : site.ground === "tas" ? ["#D8D0BE", "#A9A08C"] : ["#D9D6A6", "#A8A86E"];
  function figure(key: string, x: number, y: number, h: number, faceRight: boolean, filter = "none") {
    const im = img(key); if (!im) return false;
    const w = h * im.naturalWidth / im.naturalHeight;
    g.save(); g.translate(X(x), Y(y)); if (faceRight) g.scale(-1, 1); g.filter = filter;
    g.drawImage(im, -w * scale / 2, -h * scale * 0.85, w * scale, h * scale); g.restore(); return true;
  }
  function tower() {
    const x = X(TOWER.x), y = Y(TOWER.y), r = TOWER.r * scale;
    g.fillStyle = "rgba(42,39,34,.18)"; g.beginPath(); g.ellipse(x, y + r * 0.55, r * 1.25, r * 0.55, 0, 0, 7); g.fill();
    g.fillStyle = "#8A6A45"; g.strokeStyle = C("--ink"); g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(x - r, y - r * 0.2); g.lineTo(x - r * 0.85, y + r * 0.55); g.lineTo(x + r * 0.85, y + r * 0.55); g.lineTo(x + r, y - r * 0.2); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(x - r * 0.9, y + r * 0.5); g.lineTo(x + r * 0.2, y - r * 0.15); g.moveTo(x + r * 0.9, y + r * 0.5); g.lineTo(x - r * 0.2, y - r * 0.15); g.stroke();
    g.fillStyle = "#A9835A"; g.beginPath(); g.ellipse(x, y - r * 0.2, r, r * 0.42, 0, 0, 7); g.fill(); g.stroke();
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI; g.beginPath(); g.moveTo(x + Math.cos(a) * r * 0.95, y - r * 0.2 + Math.sin(a) * r * 0.4); g.lineTo(x - Math.cos(a) * r * 0.95, y - r * 0.2 - Math.sin(a) * r * 0.4); g.globalAlpha = 0.25; g.stroke(); g.globalAlpha = 1; }
  }
  function draw(now: number) {
    const r = stage.getBoundingClientRect(); g.save();
    if (shake > 0) g.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    g.fillStyle = ground[0]; g.fillRect(-20, -20, r.width + 40, r.height + 40);
    g.strokeStyle = ground[1]; g.lineWidth = 1; g.globalAlpha = 0.6;
    for (let i = 0; i < 140; i++) { const x = (i * 37.7) % NFIELD.w, y = (i * 61.3) % NFIELD.h; g.beginPath(); g.moveTo(X(x), Y(y)); g.lineTo(X(x + 1), Y(y - 1.8)); g.stroke(); }
    g.globalAlpha = 1;
    // kenarlarda ağaçlar
    g.fillStyle = site.ground === "kar" ? "#8FA3A8" : "#5E7A45"; g.strokeStyle = C("--ink"); g.lineWidth = 1;
    for (let i = 0; i < 26; i++) { const side = i % 2, t = (i * 0.137) % 1; const x = side ? NFIELD.w - 3 - (i % 3) * 3 : 3 + (i % 3) * 3; const y = t * NFIELD.h;
      g.beginPath(); g.moveTo(X(x), Y(y) - 4 * scale); g.lineTo(X(x) - 2.6 * scale, Y(y) + 1.5 * scale); g.lineTo(X(x) + 2.6 * scale, Y(y) + 1.5 * scale); g.closePath(); g.fill(); g.stroke(); }
    // menzil
    g.setLineDash([6, 6]); g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = 2; g.beginPath(); g.arc(X(TOWER.x), Y(TOWER.y), n.range * scale, 0, 7); g.stroke(); g.setLineDash([]);
    g.fillStyle = "rgba(255,255,255,.08)"; g.beginPath(); g.arc(X(TOWER.x), Y(TOWER.y), n.range * scale, 0, 7); g.fill();
    if (n.cards.buz) { g.fillStyle = `rgba(159,211,232,${0.08 + n.cards.buz * 0.04})`; g.beginPath(); g.arc(X(TOWER.x), Y(TOWER.y), 22 * scale, 0, 7); g.fill(); }
    if (n.cards.kazik) { g.strokeStyle = "#6B4A2E"; g.lineWidth = 2; for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; const x = TOWER.x + Math.cos(a) * (TOWER.r + 2.5), y = TOWER.y + Math.sin(a) * (TOWER.r + 2.5); g.beginPath(); g.moveTo(X(x), Y(y)); g.lineTo(X(x + Math.cos(a) * 2.2), Y(y + Math.sin(a) * 2.2) - scale); g.stroke(); } }
    // düşmanlar (arkadakiler önce)
    for (const f of [...n.foes].sort((a, b) => a.y - b.y)) {
      const d = ENEMIES[f.def]; const right = TOWER.x > f.x; const h = (f.human ? 11 : 7) * (f.boss ? 1.45 : 1);
      const atk = Math.hypot(TOWER.x - f.x, TOWER.y - f.y) < TOWER.r + f.r + 0.5 && f.cd < 0.35;
      const key = f.human ? (artUrl("dusman_" + f.def) ? "dusman_" + f.def : atk ? "poz_kahraman_vurus" : "poz_kahraman_durus") : atk ? "poz_kurt_atilma" : "dusman_kurt";
      const filt = artUrl("dusman_" + f.def) && f.human ? "none" : d.tint ?? "none";
      if (!figure(key, f.x, f.y, h, right, filt)) { g.fillStyle = "#5E5850"; g.beginPath(); g.arc(X(f.x), Y(f.y), f.r * scale, 0, 7); g.fill(); }
      if (f.burn > 0) { g.fillStyle = `rgba(240,140,40,${0.45 + Math.sin(now / 60) * 0.25})`; g.beginPath(); g.ellipse(X(f.x), Y(f.y) - h * scale * 0.45, scale * 1.2, scale * 2.2, 0, 0, 7); g.fill(); }
      if (f.slow > 0) { g.fillStyle = "rgba(159,211,232,.6)"; g.beginPath(); g.arc(X(f.x), Y(f.y), scale * 2, 0, 7); g.fill(); }
      if (f.hp < f.max || f.boss) { const w = f.boss ? 40 : 20; g.fillStyle = "rgba(234,224,200,.9)"; g.fillRect(X(f.x) - w / 2, Y(f.y) - h * scale * 0.95, w, 4); g.fillStyle = C("--red"); g.fillRect(X(f.x) - w / 2, Y(f.y) - h * scale * 0.95, w * Math.max(0, f.hp / f.max), 4); }
    }
    // kule ve sen
    tower();
    if (!figure(n.fireCd > 1 / n.rate - 0.12 ? "poz_kahraman_vurus" : "poz_kahraman_durus", TOWER.x, TOWER.y - 1.5, 13, false)) { g.fillStyle = C("--blue"); g.beginPath(); g.arc(X(TOWER.x), Y(TOWER.y - 4), 2.5 * scale, 0, 7); g.fill(); }
    if (n.pet) { const px = TOWER.x + Math.cos(n.pet.a) * 13, py = TOWER.y + Math.sin(n.pet.a) * 13; figure("dusman_kurt", px, py, 6, Math.sin(n.pet.a) > 0, ENEMIES.kopek.tint ?? "none"); }
    // oklar
    g.strokeStyle = "#4A3826"; g.lineWidth = 2;
    for (const sh of n.shots) { const dx = sh.tx - sh.x, dy = sh.ty - sh.y, L = Math.hypot(dx, dy) || 1; g.strokeStyle = sh.burn ? "#D9682A" : "#4A3826"; g.beginPath(); g.moveTo(X(sh.x), Y(sh.y)); g.lineTo(X(sh.x - dx / L * 3.5), Y(sh.y - dy / L * 3.5)); g.stroke(); }
    // şimşek ve patlamalar
    for (let i = zaps.length - 1; i >= 0; i--) { const z = zaps[i]; const k = (now - z.t) / 260; if (k > 1) { zaps.splice(i, 1); continue; }
      g.strokeStyle = `rgba(120,170,255,${1 - k})`; g.lineWidth = 3; g.beginPath(); z.pts.forEach(([x, y], j) => { const jx = j ? (Math.random() - 0.5) * 3 : 0; j ? g.lineTo(X(x + jx), Y(y + jx)) : g.moveTo(X(x), Y(y)); }); g.stroke(); }
    for (let i = blasts.length - 1; i >= 0; i--) { const b = blasts[i]; const k = (now - b.t) / 500; if (k > 1) { blasts.splice(i, 1); continue; }
      g.fillStyle = `rgba(160,190,255,${0.5 * (1 - k)})`; g.beginPath(); g.arc(X(b.x), Y(b.y), b.r * scale * (0.6 + k * 0.5), 0, 7); g.fill();
      g.strokeStyle = `rgba(255,255,255,${1 - k})`; g.lineWidth = 3; g.beginPath(); g.moveTo(X(b.x), 0); g.lineTo(X(b.x + 2), Y(b.y) * 0.5); g.lineTo(X(b.x - 2), Y(b.y) * 0.7); g.lineTo(X(b.x), Y(b.y)); g.stroke(); }
    for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; const k = (now - p.t) / 800; if (k > 1) { pops.splice(i, 1); continue; } g.globalAlpha = 1 - k; g.fillStyle = p.color; g.font = `700 ${p.big ? 26 : 16}px Caveat, cursive`; g.textAlign = "center"; g.fillText(p.text, X(p.x), Y(p.y) - k * 22); g.globalAlpha = 1; }
    g.restore();
    if (flash > 0) { g.fillStyle = `rgba(158,52,35,${flash * 0.25})`; g.fillRect(0, 0, r.width, r.height); }
  }
  function hud() {
    (el.querySelector("#nbHp") as HTMLElement).style.width = `${(n.hp / n.maxHp) * 100}%`;
    el.querySelector("#nbHpT")!.textContent = `${Math.ceil(n.hp)}/${Math.round(n.maxHp)}`;
    const need = n.pageNeed * (1 - permLevel(s, "deste") * 0.08);
    (el.querySelector("#nbPage") as HTMLElement).style.width = `${Math.min(100, (n.page / need) * 100)}%`;
    el.querySelector("#nbCoins")!.textContent = `◉ ${n.coins} kırıntı`;
    (el.querySelector("#nbSkillCd") as HTMLElement).style.height = `${(n.skillCd / n.skillMax) * 100}%`;
    el.querySelector<HTMLButtonElement>("[data-c=skill]")!.classList.toggle("ready", n.skillCd <= 0);
    const w = Math.max(1, n.wave); const marks = [0, 1, 2, 3].map(i => w + i);
    el.querySelector("#nbWaves")!.innerHTML = marks.map((m, i) => `<span class="${i === 0 ? "now" : ""} ${isBossWave(m) ? "boss" : ""}">${isBossWave(m) ? "☠" : m}</span>`).join("<i></i>");
  }

  /* ---------- döngü ---------- */
  let last = performance.now(); let raf = 0; let ended = false; let tick = 0;
  const loop = (now: number) => {
    const real = Math.min(0.1, (now - last) / 1000); last = now;
    if (!paused && n.phase === "play") { const steps = speed; for (let i = 0; i < steps; i++) stepNobet(s, n, real); }
    for (const f of n.fx.splice(0)) {
      if (f.k === "hit") { if (f.crit || pops.length < 18) pops.push({ x: f.x, y: f.y - 6, t: now, text: `${f.crit ? "Kritik " : ""}${f.dmg}`, color: f.crit ? C("--red") : C("--ink") }); }
      if (f.k === "die") { pops.push({ x: f.x, y: f.y - 3, t: now, text: `+${f.coins} ◉`, color: "#B07A1E", big: f.boss }); if (speed === 1 || f.boss) sfx(f.boss ? "win" : "coin"); }
      if (f.k === "hurt") { shake = Math.max(shake, 4); flash = 0.7; if (speed === 1) sfx("hurt"); buzz("light"); }
      if (f.k === "zap") { zaps.push({ pts: f.pts, t: now }); sfx("spark"); }
      if (f.k === "skill") blasts.push({ x: f.x, y: f.y, r: f.r, t: now });
      if (f.k === "wave") { pops.push({ x: TOWER.x, y: TOWER.y - 22, t: now, text: f.boss ? `${f.n}. dalga: lider geliyor!` : `${f.n}. dalga`, color: C("--red"), big: true }); sfx("beat"); if (f.boss) buzz("medium"); }
      if (f.k === "card") showCards();
    }
    shake = Math.max(0, shake - real * 30); flash = Math.max(0, flash - real * 3);
    if ((tick += real) > 0.2) { tick = 0; refreshUps(); hud(); }
    draw(now);
    if (n.phase === "over" && !ended) { ended = true; sfx("lose"); buzz("long"); setTimeout(finish, 1000); }
    raf = requestAnimationFrame(loop);
  };
  function finish() {
    cancelAnimationFrame(raf); ro.disconnect();
    const r = finishNobet(cfg, s, n); persist(); el.remove(); onEnd(r);
  }
  const ro = new ResizeObserver(layout); ro.observe(stage);
  layout(); renderUps(); hud(); raf = requestAnimationFrame(loop);
}
