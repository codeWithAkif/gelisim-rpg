// Savaş ekranı: altıgen minyatür harita (canvas) + alt panelde düşman eskizi ve olasılıklar.
import type { Config } from "../engine/config";
import type { GameState } from "../engine/state";
import {
  type Battle, type Unit, type BattleOutcome, createBattle, player, enemies, reachable, movePlayer, playerAttack,
  observe, enemyTurn, tryFlee, finishBattle, previewAttack, knownWeakPoints, dist, visible, sightRange,
} from "../engine/combat";
import { TERRAIN, ENEMIES, type Terrain } from "../content/world";
import { esc, wolfSketch } from "./sketch";

const SQ3 = Math.sqrt(3);
const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function hashXY(x: number, y: number) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

export function openBattle(cfg: Config, s: GameState, mapId: string, enemyIds: string[], questId: string | undefined,
  onEnd: (o: BattleOutcome, b: Battle) => void, persist: () => void) {
  const b = createBattle(cfg, s, mapId, enemyIds, (s.seed + s.day * 977 + s.minute) | 0, questId);
  let selected: string | null = enemies(b)[0]?.uid ?? null;
  let aim: string | undefined;
  let busy = false;

  const el = document.createElement("div");
  el.className = "battle"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Savaş");
  el.innerHTML = `<div class="battle-top"><h2>Mera</h2><span class="hand" id="bInfo"></span></div>
    <div class="battle-canvas"><canvas id="bCanvas" aria-label="Savaş haritası"></canvas></div>
    <div class="battle-panel" id="bPanel"></div>`;
  document.body.appendChild(el);
  const canvas = el.querySelector("canvas")!; const ctx = canvas.getContext("2d")!;
  const panel = el.querySelector<HTMLElement>("#bPanel")!;
  let geo = { size: 20, ox: 0, oy: 0, sy: 0.88 };
  let raf = 0; let rainT = 0;
  const raining = b.weather === "yagmur" && !reduced();

  function layout() {
    const r = canvas.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sy = 0.88;
    const size = Math.min(r.width / (SQ3 * (b.w + 0.5)), r.height / ((1.5 * (b.h - 1) + 2) * sy)) * 0.95;
    const tw = SQ3 * size * (b.w + 0.5), th = (1.5 * (b.h - 1) + 2) * size * sy;
    geo = { size, ox: (r.width - tw) / 2 + SQ3 * size / 2, oy: (r.height - th) / 2 + size * sy, sy };
  }
  const center = (x: number, y: number) => ({ cx: geo.ox + SQ3 * geo.size * (x + (y & 1 ? 0.5 : 0)), cy: geo.oy + 1.5 * geo.size * y * geo.sy });
  function hexPath(cx: number, cy: number, sz: number, wob = 0, seed = 0) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 180 * (60 * i - 30);
      const j = wob ? (hashXY(seed + i, i * 7) - 0.5) * wob : 0;
      const px = cx + (sz + j) * Math.cos(a), py = cy + (sz + j) * Math.sin(a) * geo.sy;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  }
  function glyph(t: Terrain, cx: number, cy: number, sz: number, seed: number) {
    const info = TERRAIN[t]; ctx.strokeStyle = info.ink; ctx.fillStyle = info.ink; ctx.lineWidth = 1.1; ctx.lineCap = "round";
    const r = (k: number) => hashXY(seed, k) - 0.5;
    if (t === "uzun_ot" || t === "cayir") {
      const n = t === "uzun_ot" ? 6 : 3;
      for (let i = 0; i < n; i++) { const x = cx + r(i) * sz * 1.1, y = cy + r(i + 9) * sz * 0.8; const h = t === "uzun_ot" ? sz * 0.32 : sz * 0.16;
        ctx.beginPath(); ctx.moveTo(x - 2, y); ctx.lineTo(x - 3, y - h); ctx.moveTo(x, y); ctx.lineTo(x, y - h * 1.15); ctx.moveTo(x + 2, y); ctx.lineTo(x + 3, y - h); ctx.stroke(); }
    } else if (t === "camur") {
      for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(cx + r(i) * sz * 1.2, cy + r(i + 5) * sz * 0.8, 1 + Math.abs(r(i + 2)) * 1.5, 0, 7); ctx.fill(); }
      ctx.beginPath(); ctx.moveTo(cx - sz * 0.5, cy + sz * 0.15); ctx.quadraticCurveTo(cx, cy + sz * 0.3, cx + sz * 0.5, cy + sz * 0.1); ctx.stroke();
    } else if (t === "kaya") {
      for (let i = 0; i < 2; i++) { const x = cx + (i ? sz * 0.28 : -sz * 0.22), y = cy + (i ? sz * 0.12 : -sz * 0.05), k = sz * (i ? 0.26 : 0.34);
        ctx.beginPath(); ctx.moveTo(x - k, y + k * 0.5); ctx.lineTo(x - k * 0.4, y - k * 0.6); ctx.lineTo(x + k * 0.5, y - k * 0.4); ctx.lineTo(x + k, y + k * 0.5); ctx.closePath();
        ctx.fillStyle = "rgba(255,255,255,.25)"; ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - k * 0.4, y - k * 0.6); ctx.lineTo(x, y + k * 0.5); ctx.stroke(); }
    } else if (t === "tepe") {
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(cx, cy + sz * 0.12, sz * (0.75 - i * 0.22), sz * (0.4 - i * 0.12) * geo.sy, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); }
    } else if (t === "su") {
      for (let i = 0; i < 3; i++) { const y = cy + (i - 1) * sz * 0.3; ctx.beginPath(); ctx.moveTo(cx - sz * 0.6, y);
        for (let k = 0; k < 4; k++) ctx.quadraticCurveTo(cx - sz * 0.6 + (k + 0.5) * sz * 0.3, y + (k % 2 ? 3 : -3), cx - sz * 0.6 + (k + 1) * sz * 0.3, y); ctx.stroke(); }
    } else if (t === "agac") {
      for (let i = 0; i < 3; i++) { const x = cx + (i - 1) * sz * 0.42, y = cy + (i === 1 ? -sz * 0.2 : sz * 0.12), k = sz * 0.3;
        ctx.beginPath(); ctx.arc(x, y - k * 0.3, k, 0, 7); ctx.fillStyle = "rgba(77,104,55,.35)"; ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y + k * 0.6); ctx.lineTo(x, y + k * 1.2); ctx.stroke(); }
    }
  }
  function drawUnit(u: Unit) {
    const { cx, cy } = center(u.x, u.y); const r = geo.size * 0.5;
    const isP = u.side === "player";
    ctx.save();
    ctx.fillStyle = "rgba(42,39,34,.18)"; ctx.beginPath(); ctx.ellipse(cx + 2, cy + r * 0.75, r * 0.9, r * 0.32, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy - 2, r, 0, 7); ctx.fillStyle = isP ? "#F3ECDA" : "#4A4540"; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = isP ? "#2E4C7A" : "#2A2722"; ctx.stroke();
    ctx.strokeStyle = isP ? "#2E4C7A" : "#E8DFC9"; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 1.6; ctx.lineCap = "round";
    if (isP) { // küçük insan figürü
      ctx.beginPath(); ctx.arc(cx, cy - r * 0.45, r * 0.17, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.25); ctx.lineTo(cx, cy + r * 0.2); ctx.moveTo(cx - r * 0.3, cy - r * 0.05); ctx.lineTo(cx + r * 0.3, cy - r * 0.15);
      ctx.moveTo(cx, cy + r * 0.2); ctx.lineTo(cx - r * 0.22, cy + r * 0.5); ctx.moveTo(cx, cy + r * 0.2); ctx.lineTo(cx + r * 0.22, cy + r * 0.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + r * 0.3, cy - r * 0.15); ctx.lineTo(cx + r * 0.55, cy - r * 0.6); ctx.stroke();
    } else { // kurt başı
      ctx.beginPath(); ctx.moveTo(cx - r * 0.45, cy - r * 0.1); ctx.lineTo(cx - r * 0.3, cy - r * 0.62); ctx.lineTo(cx - r * 0.08, cy - r * 0.25);
      ctx.lineTo(cx + r * 0.08, cy - r * 0.25); ctx.lineTo(cx + r * 0.3, cy - r * 0.62); ctx.lineTo(cx + r * 0.45, cy - r * 0.1);
      ctx.lineTo(cx + r * 0.12, cy + r * 0.5); ctx.lineTo(cx - r * 0.12, cy + r * 0.5); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx - r * 0.16, cy, 1.6, 0, 7); ctx.arc(cx + r * 0.16, cy, 1.6, 0, 7); ctx.fill();
    }
    // can yayı
    const f = u.hp / u.maxHp;
    ctx.beginPath(); ctx.arc(cx, cy - 2, r + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f);
    ctx.strokeStyle = f > 0.5 ? "#4F6A34" : f > 0.25 ? "#A35A12" : "#9E3423"; ctx.lineWidth = 3; ctx.stroke();
    if (u.uid === selected) { ctx.setLineDash([4, 3]); ctx.strokeStyle = "#9E3423"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(cx, cy - 2, r + 9, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
    if (u.slowed > 0) { ctx.fillStyle = "#9E3423"; ctx.font = `700 ${Math.round(r * 0.7)}px Caveat, cursive`; ctx.fillText("topal", cx + r * 0.6, cy + r); }
    ctx.restore();
  }

  function draw() {
    const r = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, r.width, r.height);
    const p = player(b); const sight = sightRange(cfg, s, b);
    const reach = b.phase === "player" && !busy ? reachable(b, p, p.moveLeft) : new Map<string, number>();
    // önce yükseltilerin yan yüzü
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
      const t = b.tiles[y][x]; const { cx, cy } = center(x, y);
      if (t === "tepe") { hexPath(cx, cy + geo.size * 0.18, geo.size * 0.98); ctx.fillStyle = "#8C7744"; ctx.fill(); }
    }
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
      const t = b.tiles[y][x]; const info = TERRAIN[t]; const { cx, cy } = center(x, y); const sz = geo.size * 0.98;
      const lift = t === "tepe" ? -geo.size * 0.08 : 0; const seed = x * 31 + y * 17;
      hexPath(cx, cy + lift, sz, 1.6, seed);
      const g = ctx.createRadialGradient(cx - sz * 0.3, cy - sz * 0.3, sz * 0.1, cx, cy, sz * 1.1);
      g.addColorStop(0, "rgba(255,255,255,.35)"); g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = info.color; ctx.fill(); ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = "rgba(42,39,34,.55)"; ctx.lineWidth = 1; ctx.stroke();
      glyph(t, cx, cy + lift, sz, seed);
      const k = x + "," + y;
      if (reach.has(k)) {
        ctx.save(); hexPath(cx, cy + lift, sz * 0.92); ctx.clip(); ctx.strokeStyle = "rgba(46,76,122,.55)"; ctx.lineWidth = 1.2;
        for (let i = -sz * 2; i < sz * 2; i += 6) { ctx.beginPath(); ctx.moveTo(cx + i, cy + sz); ctx.lineTo(cx + i + sz, cy - sz); ctx.stroke(); }
        ctx.restore();
      }
      const d = dist(p.x, p.y, x, y);
      if (d > sight) { hexPath(cx, cy + lift, sz + 1); ctx.fillStyle = b.night ? "rgba(24,28,44,.62)" : "rgba(240,240,236,.72)"; ctx.fill(); }
    }
    if (b.weather === "sis" && !b.night) { ctx.fillStyle = "rgba(245,245,240,.18)"; ctx.fillRect(0, 0, r.width, r.height); }
    if (b.night) {
      const { cx, cy } = center(p.x, p.y);
      const g = ctx.createRadialGradient(cx, cy, geo.size, cx, cy, geo.size * (sight + 2) * 1.6);
      g.addColorStop(0, "rgba(255,200,120,.10)"); g.addColorStop(1, "rgba(20,24,40,.35)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, r.width, r.height);
    }
    for (const u of b.units) if (u.hp > 0 && !u.fled && visible(cfg, s, b, u)) drawUnit(u);
    if (b.weather === "yagmur") {
      ctx.strokeStyle = "rgba(46,76,122,.35)"; ctx.lineWidth = 1;
      for (let i = 0; i < 90; i++) { const x = (hashXY(i, 3) * r.width + rainT * 0.9) % r.width, y = (hashXY(i, 8) * r.height + rainT * 3.2) % r.height;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 10); ctx.stroke(); }
    }
  }
  function loop(t: number) { rainT = t / 16; draw(); raf = requestAnimationFrame(loop); }

  function info() {
    const p = player(b);
    el.querySelector("#bInfo")!.textContent = `${b.night ? "Gece" : "Gündüz"} · ${b.weather === "yagmur" ? "yağmur" : b.weather === "sis" ? "sis" : "açık"} · tur ${b.turn} · can ${p.hp}/${p.maxHp}`;
  }
  function renderPanel() {
    info();
    const p = player(b); const tgt = b.units.find(u => u.uid === selected && u.hp > 0 && !u.fled && visible(cfg, s, b, u));
    const terr = TERRAIN[b.tiles[p.y][p.x]];
    const atEdge = p.x === 0 || p.y === 0 || p.x === b.w - 1 || p.y === b.h - 1;
    let foe = "";
    if (tgt) {
      const d = ENEMIES[tgt.def!]; const known = knownWeakPoints(cfg, s, d.id); const pv = previewAttack(cfg, s, b, tgt, aim);
      const adj = dist(p.x, p.y, tgt.x, tgt.y) === 1;
      const parts = pv.critParts.sort((a, c) => c.amount - a.amount).slice(0, 4).map(x => `${x.name} ${x.amount >= 0 ? "+" : ""}${x.amount.toFixed(1)}`).join(" · ");
      foe = `<div class="foe">${wolfSketch({ detail: s.attrs.analiz?.level ?? 0, marks: known.map(w => ({ name: w.name, at: w.at })), width: 112, labels: false, seed: tgt.uid.length * 13 })}
        <div><div class="entry-head"><span class="entry-title" style="font-size:22px">${esc(tgt.name)}</span><span class="hpbar">can ${tgt.hp}/${tgt.maxHp}</span></div>
        <div class="odds"><span>İsabet <b>%${Math.round(pv.hit)}</b></span><span>Kritik <b>%${Math.round(pv.crit)}</b></span><span>Hasar <b>${pv.dmg[0]}–${pv.dmg[1]}</b></span></div>
        <div class="muted" style="font-size:12px;line-height:1.3">Kritik: ${esc(parts)}</div></div></div>
        ${known.length ? `<div class="row">${known.map(w => `<button class="btn small ${aim === w.id ? "primary" : "red"}" data-aim="${w.id}">${esc(w.name)}</button>`).join("")}</div>` : ""}
        <div class="row"><button class="btn primary" data-b="attack" ${!adj || p.acted || busy ? "disabled" : ""}>${aim ? "Nişanlı vur" : "Saldır"}</button>
        <button class="btn blue" data-b="observe" ${p.acted || busy ? "disabled" : ""}>Gözle</button>${!adj ? `<span class="muted" style="font-size:14px">Vurmak için yanına git.</span>` : ""}</div>`;
    } else foe = `<p class="muted" style="margin:0;font-size:14px">Taralı altıgenlere dokunarak yürü, kurda dokunarak incele.${b.night || b.weather === "sis" ? " Görüşün kısıtlı; karanlıkta olanı göremezsin." : ""}</p>`;
    panel.innerHTML = `<div class="battle-log">${b.log.slice(0, 2).map(t => `<div>${esc(t)}</div>`).join("")}</div>${foe}
      <div class="row" style="justify-content:space-between"><span class="muted" style="font-size:13px">Durduğun yer: ${esc(terr.name)} · hareket ${p.moveLeft}</span>
      <span class="row"><button class="btn small" data-b="end" ${busy ? "disabled" : ""}>Turu bitir</button>${atEdge ? `<button class="btn small red" data-b="flee" ${busy ? "disabled" : ""}>Geri çekil</button>` : ""}</span></div>`;
    if (!raining) draw();
  }
  function afterAction() {
    renderPanel();
    if (b.phase === "won" || b.phase === "lost" || b.phase === "fled") return finish();
    const p = player(b);
    if (p.acted && p.moveLeft === 0) endTurn();
  }
  function endTurn() {
    if (busy || b.phase !== "player") return;
    busy = true; renderPanel();
    setTimeout(() => {
      enemyTurn(cfg, s, b); busy = false;
      if (!b.units.some(u => u.uid === selected && u.hp > 0 && !u.fled)) selected = enemies(b)[0]?.uid ?? null;
      persist(); renderPanel();
      if (b.phase === "won" || b.phase === "lost") finish();
    }, reduced() ? 0 : 450);
  }
  function finish() {
    setTimeout(() => {
      const o = finishBattle(cfg, s, b);
      cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); ro.disconnect(); el.remove();
      onEnd(o, b);
    }, reduced() ? 0 : 700);
  }

  canvas.addEventListener("pointerup", e => {
    if (busy || b.phase !== "player") return;
    const r = canvas.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top;
    let best: [number, number] | null = null, bd = Infinity;
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) { const { cx, cy } = center(x, y); const d = Math.hypot(cx - mx, (cy - my) / geo.sy); if (d < bd) { bd = d; best = [x, y]; } }
    if (!best || bd > geo.size) return;
    const u = b.units.find(v => v.hp > 0 && !v.fled && v.x === best![0] && v.y === best![1]);
    if (u && u.side === "enemy" && visible(cfg, s, b, u)) { if (selected !== u.uid) aim = undefined; selected = u.uid; renderPanel(); return; }
    if (movePlayer(cfg, s, b, best[0], best[1])) afterAction();
  });
  panel.addEventListener("click", e => {
    const t = (e.target as HTMLElement).closest("button"); if (!t || busy) return;
    if (t.dataset.aim) { aim = aim === t.dataset.aim ? undefined : t.dataset.aim; renderPanel(); return; }
    const tgt = b.units.find(u => u.uid === selected);
    switch (t.dataset.b) {
      case "attack": if (tgt) { playerAttack(cfg, s, b, tgt, aim); persist(); afterAction(); } break;
      case "observe": if (tgt) { observe(cfg, s, b, tgt); persist(); afterAction(); } break;
      case "end": endTurn(); break;
      case "flee": if (tryFlee(b)) finish(); break;
    }
  });
  const onResize = () => { layout(); draw(); };
  window.addEventListener("resize", onResize);
  // yağmur yağıyorsa harita canlı çizilir; yoksa yalnız değişince (pil dostu)
  // panel yüksekliği değiştikçe tuval yeniden ölçülür (yoksa harita basık çizilir)
  const ro = new ResizeObserver(() => { layout(); draw(); });
  ro.observe(canvas.parentElement!);
  renderPanel(); layout(); draw();
  if (raining) raf = requestAnimationFrame(loop);
  return b;
}

