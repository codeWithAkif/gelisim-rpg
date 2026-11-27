// Gizlenme ekranı: parmağını basılı tut, oraya doğru sinsice yürürsün; bırakınca durursun.
// "Koş" hızlı ama sesli. "Taş at": dokunduğun yere taş düşer, yakın bekçiler oraya bakar.
// Bekçilerin görüş konisi çizilir; kurtların koku alanı rüzgârla uzar. Kuşku dolarsa yakalanırsın.
import type { Config } from "../engine/config";
import type { GameState } from "../engine/state";
import {
  type Stealth, type StealthGoal, type Watcher, FIELD, createStealth, stepStealth, moveTo, stop, throwStone,
  sight, lineOfSight, inBush, suspicion, finishStealth,
} from "../engine/stealth";
import { ENEMIES } from "../content/world";
import type { GainReport } from "../engine/progression";
import { artUrl } from "./art";
import { esc } from "./sketch";
import { sfx, buzz } from "./feel";
import { quad, drawQuad, walkFrame, gait } from "./anim";

const imgCache = new Map<string, HTMLImageElement | null>();
const img = (key: string) => { if (!imgCache.has(key)) { const u = artUrl(key); imgCache.set(key, u ? Object.assign(new Image(), { src: u }) : null); } const i = imgCache.get(key)!; return i && i.complete && i.naturalWidth ? i : null; };

const GOAL_TEXT: Record<StealthGoal, { exit: string; hint: string }> = {
  sizma: { exit: "Giriş", hint: "Muhafızlara görünmeden yukarıdaki girişe var." },
  pusu: { exit: "Pusu yeri", hint: "Fark edilmeden yukarıdaki pusu yerine var: savaş bir kurdun dibinde başlar, ilk vuruşun iki kat." },
  kacis: { exit: "Yol", hint: "Görünmeden yukarıdaki yola çık; sıyrılıp gidersin." },
};

export function openStealth(cfg: Config, s: GameState, title: string, foes: string[], goal: StealthGoal, seed: number, night: boolean,
  onEnd: (won: boolean, gains: GainReport) => void, persist: () => void) {
  const st: Stealth = createStealth(s, foes, goal, seed, night);
  const el = document.createElement("div"); el.className = "siege stealth"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Gizlenme");
  el.innerHTML = `<div class="siege-top"><div class="siege-title hand">${esc(title)}</div>
      <div class="sus-row"><span class="tiny">Kuşku</span><div class="gb"><div class="gf" id="stSus" style="background:var(--red);width:0"></div></div></div></div>
    <div class="siege-stage"><canvas></canvas></div>
    <div class="siege-panel"><p class="tiny" style="margin:0" id="stHint"></p>
      <div class="row"><button class="btn small" data-s="run">Koş</button><button class="btn small" data-s="stone">Taş at (3)</button><span style="flex:1"></span><button class="btn small" data-s="quit">Çık ve savaş</button></div></div>`;
  document.body.appendChild(el);
  const cv = el.querySelector("canvas")!; const stage = el.querySelector<HTMLElement>(".siege-stage")!;
  const hint = el.querySelector<HTMLElement>("#stHint")!; const g = cv.getContext("2d")!;
  let scale = 4, ox = 0, oy = 0;
  const layout = () => {
    const r = stage.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
    cv.width = r.width * dpr; cv.height = r.height * dpr; cv.style.width = r.width + "px"; cv.style.height = r.height + "px";
    scale = Math.min(r.width / FIELD.w, r.height / FIELD.h); ox = (r.width - FIELD.w * scale) / 2; oy = (r.height - FIELD.h * scale) / 2;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const toField = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left - ox) / scale, y: (e.clientY - r.top - oy) / scale }; };
  const X = (x: number) => ox + x * scale, Y = (y: number) => oy + y * scale;
  const cs = getComputedStyle(document.documentElement); const C = (n: string) => cs.getPropertyValue(n).trim();
  let stoneMode = false; let holding = false; let faceRight = false;
  const pops: { x: number; y: number; t: number; text: string; color: string }[] = [];
  const stones: { x: number; y: number; t: number }[] = [];

  function renderPanel() {
    const run = el.querySelector<HTMLButtonElement>("[data-s=run]")!, stone = el.querySelector<HTMLButtonElement>("[data-s=stone]")!;
    run.classList.toggle("primary", st.run); run.textContent = st.run ? "Koşuyorsun" : "Koş";
    stone.classList.toggle("primary", stoneMode); stone.textContent = `Taş at (${st.stones})`; stone.disabled = st.stones <= 0;
    hint.textContent = stoneMode ? "Taşın düşeceği yere dokun (yakınına)." : `${GOAL_TEXT[goal].hint} Basılı tut: oraya yürürsün. ${foes.some(f => ENEMIES[f]?.species !== "insan") ? "Kurtlar kokuyu rüzgârla alır: rüzgâra karşı yürü." : "Çalının içindeyken uzaktan görünmezsin."}`;
  }
  el.querySelector(".siege-panel")!.addEventListener("click", e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button"); if (!b || b.disabled) return;
    if (b.dataset.s === "run") { st.run = !st.run; sfx("tap"); }
    if (b.dataset.s === "stone") { stoneMode = !stoneMode; sfx("tap"); }
    if (b.dataset.s === "quit") { st.phase = "lost"; }
    renderPanel();
  });
  cv.addEventListener("pointerdown", e => {
    const p = toField(e); cv.setPointerCapture(e.pointerId);
    if (stoneMode) {
      if (throwStone(st, p.x, p.y)) { stones.push({ x: p.x, y: p.y, t: performance.now() }); sfx("thunk"); buzz("light"); }
      else pops.push({ x: p.x, y: p.y, t: performance.now(), text: "Çok uzak", color: C("--red") });
      stoneMode = false; renderPanel(); return;
    }
    holding = true; moveTo(st, p.x, p.y);
  });
  cv.addEventListener("pointermove", e => { if (!holding) return; const p = toField(e); moveTo(st, p.x, p.y); });
  const up = () => { if (!holding) return; holding = false; stop(st); };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);

  /* ---------- çizim ---------- */
  const human = foes.some(f => ENEMIES[f]?.species === "insan");
  const ground = s.region === "ayazkale" ? ["#EEF1F3", "#C9D3DC"] : human ? ["#D8D0BE", "#A9A08C"] : ["#D9D6A6", "#A8A86E"];
  function figure(key: string, x: number, y: number, h: number, faceRight: boolean, filter = "none", alpha = 1) {
    const im = img(key); if (!im) return false;
    const w = h * im.naturalWidth / im.naturalHeight;
    g.save(); g.globalAlpha = alpha; g.translate(X(x), Y(y)); if (faceRight) g.scale(-1, 1); g.filter = filter;
    g.drawImage(im, -w * scale / 2, -h * scale * 0.85, w * scale, h * scale); g.restore(); return true;
  }
  /** Görüş konisi: duvarla kesilen ışınlardan bir çokgen. */
  function cone(w: Watcher) {
    const { range, half } = sight(st, w); const n = 18;
    g.beginPath(); g.moveTo(X(w.x), Y(w.y));
    for (let i = 0; i <= n; i++) {
      const a = w.dir - half + (2 * half * i) / n; let d = range;
      for (let k = 2; k <= range; k += 2) { if (!lineOfSight(st, w.x, w.y, w.x + Math.cos(a) * k, w.y + Math.sin(a) * k)) { d = k - 1; break; } }
      g.lineTo(X(w.x + Math.cos(a) * d), Y(w.y + Math.sin(a) * d));
    }
    g.closePath();
    const hot = w.sus;
    g.fillStyle = `rgba(${Math.round(230 + 20 * hot)},${Math.round(200 - 150 * hot)},${Math.round(90 - 60 * hot)},${0.18 + hot * 0.25})`; g.fill();
    g.strokeStyle = `rgba(158,52,35,${0.25 + hot * 0.5})`; g.lineWidth = 1; g.stroke();
  }
  function draw(now: number) {
    const r = stage.getBoundingClientRect();
    g.fillStyle = C("--paper"); g.fillRect(0, 0, r.width, r.height);
    g.fillStyle = ground[0]; g.fillRect(X(0), Y(0), FIELD.w * scale, FIELD.h * scale);
    g.strokeStyle = ground[1]; g.lineWidth = 1; g.globalAlpha = 0.6;
    for (let i = 0; i < 110; i++) { const x = (i * 37.7) % FIELD.w, y = (i * 61.3) % FIELD.h; g.beginPath(); g.moveTo(X(x), Y(y)); g.lineTo(X(x + 1), Y(y - 1.8)); g.stroke(); }
    g.globalAlpha = 1;
    // çıkış
    const ex = st.exit; g.setLineDash([6, 5]); g.strokeStyle = C("--green"); g.lineWidth = 2; g.strokeRect(X(ex.x), Y(ex.y), ex.w * scale, ex.h * scale); g.setLineDash([]);
    g.fillStyle = C("--green"); g.font = `700 ${Math.max(14, scale * 3.6)}px Caveat, cursive`; g.textAlign = "center"; g.fillText(GOAL_TEXT[goal].exit, X(ex.x + ex.w / 2), Y(ex.y + ex.h / 2) + 5);
    // engeller
    for (const b of st.blocks) {
      if (b.kind === "cali") {
        g.fillStyle = "rgba(88,120,60,.55)"; g.strokeStyle = "#4F6B35"; g.lineWidth = 1.2;
        const n = Math.max(3, Math.round(b.w / 3.5));
        for (let i = 0; i < n; i++) { const cx = b.x + (i + 0.5) * (b.w / n), cy = b.y + b.h / 2 + Math.sin(i * 2.1) * b.h * 0.15; g.beginPath(); g.ellipse(X(cx), Y(cy), (b.w / n) * scale * 0.75, b.h * scale * 0.55, 0, 0, 7); g.fill(); g.stroke(); }
      } else if (b.kind === "duvar") {
        g.fillStyle = "#9C8F78"; g.fillRect(X(b.x), Y(b.y), b.w * scale, b.h * scale); g.strokeStyle = C("--ink"); g.lineWidth = 1.5; g.strokeRect(X(b.x), Y(b.y), b.w * scale, b.h * scale);
        g.lineWidth = 1; for (let x = b.x + 4; x < b.x + b.w; x += 4) { g.beginPath(); g.moveTo(X(x), Y(b.y)); g.lineTo(X(x), Y(b.y + b.h)); g.stroke(); }
      } else {
        g.fillStyle = "#8E8A80"; g.strokeStyle = C("--ink"); g.lineWidth = 1.5; g.beginPath(); g.ellipse(X(b.x + b.w / 2), Y(b.y + b.h / 2), b.w * scale / 2, b.h * scale / 2, 0, 0, 7); g.fill(); g.stroke();
      }
    }
    // koku alanı ve rüzgâr
    for (const w of st.watchers) if (!w.human) {
      g.strokeStyle = "rgba(120,90,40,.35)"; g.setLineDash([2, 4]); g.lineWidth = 1;
      g.beginPath(); g.ellipse(X(w.x - st.wind.x * 7), Y(w.y - st.wind.y * 7), 17 * scale, 13 * scale, Math.atan2(st.wind.y, st.wind.x), 0, 7); g.stroke(); g.setLineDash([]);
    }
    { const wx = FIELD.w - 9, wy = 14; g.strokeStyle = C("--blue"); g.lineWidth = 2; g.beginPath(); g.moveTo(X(wx - st.wind.x * 5), Y(wy - st.wind.y * 5)); g.lineTo(X(wx + st.wind.x * 5), Y(wy + st.wind.y * 5)); g.stroke();
      const a = Math.atan2(st.wind.y, st.wind.x); g.beginPath(); g.moveTo(X(wx + st.wind.x * 5), Y(wy + st.wind.y * 5)); g.lineTo(X(wx + st.wind.x * 5) - Math.cos(a - 0.5) * 8, Y(wy + st.wind.y * 5) - Math.sin(a - 0.5) * 8); g.moveTo(X(wx + st.wind.x * 5), Y(wy + st.wind.y * 5)); g.lineTo(X(wx + st.wind.x * 5) - Math.cos(a + 0.5) * 8, Y(wy + st.wind.y * 5) - Math.sin(a + 0.5) * 8); g.stroke();
      g.fillStyle = C("--blue"); g.font = "12px serif"; g.fillText("rüzgâr", X(wx), Y(wy + 9)); }
    for (const w of st.watchers) cone(w);
    // taşlar
    for (let i = stones.length - 1; i >= 0; i--) { const t = (now - stones[i].t) / 1000; if (t > 3) { stones.splice(i, 1); continue; } g.strokeStyle = `rgba(42,39,34,${1 - t / 3})`; g.lineWidth = 1.5; g.beginPath(); g.arc(X(stones[i].x), Y(stones[i].y), (2 + t * 6) * scale, 0, 7); g.stroke(); }
    // bekçiler
    for (const w of st.watchers) {
      const d = ENEMIES[w.def]; const right = Math.cos(w.dir) > 0;
      const h = w.human ? 13 * (d?.scale ?? 1) : 8 * (d?.scale ?? 1);
      const key = w.human ? (artUrl("dusman_" + w.def) ? "dusman_" + w.def : "poz_kahraman_durus") : "dusman_kurt";
      const wmv = !w.wait || w.wait <= 0; const wq = wmv && !(w.human && artUrl("dusman_" + w.def)) ? quad(w.human ? "anim_kahraman_yuru" : "anim_kurt_yuru", walkFrame(now, w.id)) : null; const wfil = artUrl("dusman_" + w.def) && w.human ? "none" : d?.tint ?? "none";
      if (wq) drawQuad(g, wq, X(w.x), Y(w.y), h * scale, right, wfil);
      else if (!figure(key, w.x, w.y + gait(now, w.id, wmv).dy * h * 0.2, h, right, wfil)) { g.fillStyle = "#5E5850"; g.beginPath(); g.arc(X(w.x), Y(w.y), 3 * scale, 0, 7); g.fill(); }
      if (w.sus > 0.05) { g.fillStyle = w.sus > 0.6 ? C("--red") : "#B07A1E"; g.font = `700 ${16 + w.sus * 10}px Caveat, cursive`; g.textAlign = "center"; g.fillText(w.sus > 0.6 ? "!" : "?", X(w.x), Y(w.y) - h * scale * 0.95); }
    }
    // oyuncu
    const hid = inBush(st);
    // sinsice: çömelmiş yürür (anim_kahraman_ara'nın eğilmiş kareleri 0 ve 2); koşarken dik yürür
    const pm = !!st.target && holding;
    const pq = pm && st.run ? quad("anim_kahraman_yuru", walkFrame(now, 0, 13)) : quad("anim_kahraman_ara", pm ? (walkFrame(now, 0, 3) % 2) * 2 : 0);
    if (st.target && st.target.x !== st.px) faceRight = st.target.x > st.px;
    if (pq) drawQuad(g, pq, X(st.px), Y(st.py) + (pm ? gait(now, 0, true).dy * scale * 1.5 : 0), (st.run && pm ? 12 : 10.5) * scale, faceRight, "none", hid ? 0.55 : 1);
    else if (!figure("poz_kahraman_durus", st.px, st.py + gait(now, 0, pm).dy * 2.5, 12, false, "none", hid ? 0.55 : 1)) { g.fillStyle = C("--blue"); g.beginPath(); g.arc(X(st.px), Y(st.py), 2.6 * scale, 0, 7); g.fill(); }
    if (st.target && holding) { g.setLineDash([3, 5]); g.strokeStyle = C("--ink-soft"); g.lineWidth = 1.5; g.beginPath(); g.moveTo(X(st.px), Y(st.py)); g.lineTo(X(st.target.x), Y(st.target.y)); g.stroke(); g.setLineDash([]); }
    if (stoneMode) { g.strokeStyle = C("--blue"); g.setLineDash([4, 4]); g.beginPath(); g.arc(X(st.px), Y(st.py), 45 * scale, 0, 7); g.stroke(); g.setLineDash([]); }
    // gece: oyuncunun çevresi dışında karanlık
    if (night) {
      const gr = g.createRadialGradient(X(st.px), Y(st.py), scale * 12, X(st.px), Y(st.py), scale * 70);
      gr.addColorStop(0, "rgba(16,18,30,0)"); gr.addColorStop(1, "rgba(16,18,30,.55)"); g.fillStyle = gr; g.fillRect(0, 0, r.width, r.height);
    }
    for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; const k = (now - p.t) / 900; if (k > 1) { pops.splice(i, 1); continue; } g.globalAlpha = 1 - k; g.fillStyle = p.color; g.font = "700 20px Caveat, cursive"; g.textAlign = "center"; g.fillText(p.text, X(p.x), Y(p.y) - k * 24); g.globalAlpha = 1; }
    const sus = suspicion(st); const bar = el.querySelector<HTMLElement>("#stSus")!; bar.style.width = `${sus * 100}%`; bar.style.background = sus > 0.6 ? "var(--red)" : "#B07A1E";
  }

  /* ---------- döngü ---------- */
  let last = performance.now(); let raf = 0; let ended = false; let beat = 0;
  const loop = (now: number) => {
    const dt = (now - last) / 1000; last = now;
    stepStealth(st, dt);
    for (const f of st.fx.splice(0)) {
      if (f.k === "kuşku") { const w = st.watchers.find(x => x.id === f.id); if (w) pops.push({ x: w.x, y: w.y - 14, t: now, text: w.human ? "Kim var orada?" : "Hırr…", color: "#B07A1E" }); sfx("bad"); buzz("light"); }
      if (f.k === "görüldü") { pops.push({ x: st.px, y: st.py - 14, t: now, text: "Görüldün!", color: C("--red") }); sfx("hurt"); buzz("long"); }
      if (f.k === "vardı") { pops.push({ x: st.px, y: st.py - 14, t: now, text: "Başardın", color: C("--green") }); sfx("perfect"); buzz("medium"); }
    }
    const sus = suspicion(st); if (sus > 0.5 && (beat -= dt) <= 0) { sfx("beat"); beat = 1.1 - sus * 0.6; }
    draw(now);
    if (st.phase !== "play" && !ended) { ended = true; setTimeout(finish, 900); }
    raf = requestAnimationFrame(loop);
  };
  function finish() {
    cancelAnimationFrame(raf); ro.disconnect();
    const r = finishStealth(cfg, s, st); persist(); el.remove();
    onEnd(r.won, r.gains);
  }
  const ro = new ResizeObserver(layout); ro.observe(stage);
  layout(); renderPanel(); raf = requestAnimationFrame(loop);
}
