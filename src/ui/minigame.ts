// Mini oyunlar: çalışma oturumunda "odak turu". Her iş kendine benzer bir oyunla oynanır (~20 sn), sonuç 0–1.
// Kolaylık (ease) karakterin becerisinden gelir: pencere, tolerans ve süreler onunla genişler.
import { type MiniKind, MINI_NAMES, grade, rhythmScore } from "../engine/timing";
import { dirScore, swipeOf, runeScore, RUNES, type P } from "../engine/gesture";
import { WOLF_OUTLINE } from "./sketch";
import { sfx, buzz, note } from "./feel";

interface Game {
  hint: string;
  frame(t: number, g: CanvasRenderingContext2D): boolean; // true: bitti
  down?(x: number, y: number, t: number): void;
  move?(x: number, y: number, t: number): void;
  up?(t: number): void;
  score(): number;
}
interface Ink { ink: string; soft: string; pencil: string; red: string; green: string; blue: string; paper: string; paper2: string; wash: string }
export interface MiniOpts { element?: string }
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const TAU = Math.PI * 2;
let seed = 1; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

/* ---------- ortak çizim ---------- */
function wob(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, k = 1.4, s = 1) {
  g.beginPath();
  for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU; const j = Math.sin(a * 5 + s) * k + Math.sin(a * 3 + s * 2) * k * 0.6; const x = cx + Math.cos(a) * (r + j), y = cy + Math.sin(a) * (r + j); i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.closePath();
}
interface Pop { text: string; x: number; y: number; t: number; color: string }
function drawPops(g: CanvasRenderingContext2D, pops: Pop[], t: number) {
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i]; const a = (t - p.t) / 750; if (a > 1) { pops.splice(i, 1); continue; }
    g.globalAlpha = 1 - a; g.fillStyle = p.color; g.font = `700 ${Math.round(28 * (a < 0.12 ? 1.4 - a * 3.3 : 1))}px Caveat, cursive`; g.textAlign = "center";
    g.fillText(p.text, p.x, p.y - a * 30); g.globalAlpha = 1;
  }
}
/** Kıvılcım, yonga, su damlası… */
interface Part { x: number; y: number; vx: number; vy: number; t: number; life: number; color: string; r: number }
function burst(parts: Part[], x: number, y: number, n: number, color: string, now: number, speed = 3, r = 2.5) {
  for (let i = 0; i < n; i++) { const a = rnd() * TAU, v = (0.4 + rnd()) * speed; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.6, t: now, life: 500 + rnd() * 400, color, r }); }
}
function drawParts(g: CanvasRenderingContext2D, parts: Part[], now: number) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; const k = (now - p.t) / p.life; if (k >= 1) { parts.splice(i, 1); continue; }
    const dt = (now - p.t) / 16; g.globalAlpha = 1 - k; g.fillStyle = p.color;
    g.beginPath(); g.arc(p.x + p.vx * dt, p.y + p.vy * dt + dt * dt * 0.12, p.r, 0, TAU); g.fill();
  }
  g.globalAlpha = 1;
}
function feedback(q: number) { if (q >= 0.95) { sfx("perfect"); buzz("medium"); } else if (q >= 0.55) { sfx("good"); buzz("light"); } else sfx("bad"); }
const qColor = (c: Ink, q: number) => q >= 0.95 ? c.green : q >= 0.55 ? c.blue : c.red;
const counter = (g: CanvasRenderingContext2D, c: Ink, S: number, text: string) => { g.fillStyle = c.soft; g.font = "18px Alegreya, serif"; g.textAlign = "center"; g.fillText(text, S / 2, S - 12); };
/** Basit insan figürü (yan). legs: adım fazı. */
function stickman(g: CanvasRenderingContext2D, x: number, y: number, h: number, c: Ink, legs = 0, arms = 0) {
  g.save(); g.translate(x, y); g.strokeStyle = c.ink; g.lineWidth = 2.2; g.lineCap = "round";
  const k = h / 60;
  g.beginPath(); g.moveTo(0, -30 * k); g.lineTo(Math.sin(legs) * 10 * k, 0); g.moveTo(0, -30 * k); g.lineTo(-Math.sin(legs) * 10 * k, 0); g.stroke();
  g.fillStyle = c.blue; g.beginPath(); g.moveTo(-5 * k, -30 * k); g.lineTo(5 * k, -30 * k); g.lineTo(4 * k, -48 * k); g.lineTo(-4 * k, -48 * k); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(0, -44 * k); g.lineTo(Math.cos(arms) * 11 * k, -38 * k + Math.sin(arms) * 8 * k); g.moveTo(0, -44 * k); g.lineTo(-Math.cos(arms) * 9 * k, -36 * k); g.stroke();
  g.fillStyle = "#E7CFAE"; g.beginPath(); g.arc(0, -54 * k, 5.5 * k, 0, TAU); g.fill(); g.stroke();
  g.restore();
}

/* ---------- koşu: patikada engelden zıpla ---------- */
function kosu(S: number, c: Ink, ease: number): Game {
  const D = 22000; const ground = S * 0.74; let jumpT = -1e9; const JUMP = 620 * Math.min(1.3, ease);
  const obs: { x: number; kind: number; hit?: boolean; passed?: boolean }[] = []; let nextAt = 1200; let last = 0; let speed = S / 2600;
  let cleared = 0, total = 0; const pops: Pop[] = []; const parts: Part[] = []; let stepPhase = 0; let lastStep = 0; let stumble = -1e9;
  const yOf = (now: number) => { const k = (now - jumpT) / JUMP; return k >= 0 && k <= 1 ? Math.sin(k * Math.PI) * S * 0.24 : 0; };
  return {
    hint: "Patikada koşuyorsun. Taşa ya da köke gelince dokun ve zıpla. Hız giderek artar.",
    frame(now, g) {
      const dt = last ? Math.min(50, now - last) : 16; last = now; speed = S / 2600 * (1 + now / D * 0.9);
      // arka plan: dağlar (yavaş), ağaçlar (orta)
      g.strokeStyle = c.pencil; g.lineWidth = 1.5; g.beginPath();
      for (let x = 0; x <= S; x += 8) { const w = x + now * speed * 0.15; const y = S * 0.42 - Math.abs(Math.sin(w / 70)) * S * 0.12 - Math.sin(w / 23) * 4; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
      g.fillStyle = c.wash; for (let i = 0; i < 5; i++) { const x = ((i * S / 4 - now * speed * 0.45) % (S + 60) + S + 60) % (S + 60) - 30; g.beginPath(); g.ellipse(x, ground - 30, 14, 26, 0, 0, TAU); g.fill(); }
      g.strokeStyle = c.ink; g.lineWidth = 2; g.beginPath(); g.moveTo(0, ground); g.lineTo(S, ground); g.stroke();
      g.setLineDash([3, 9]); g.beginPath(); g.moveTo(-((now * speed) % 12), ground + 8); g.lineTo(S, ground + 8); g.stroke(); g.setLineDash([]);
      // engeller
      if (now > nextAt && now < D - 1500) { obs.push({ x: S + 20, kind: rnd() < 0.5 ? 0 : 1 }); total++; nextAt = now + (900 + rnd() * 900) / (1 + now / D * 0.6); }
      const px = S * 0.25, py = ground - yOf(now);
      for (let i = obs.length - 1; i >= 0; i--) {
        const o = obs[i]; o.x -= speed * dt;
        g.fillStyle = o.kind ? "#7B6A55" : "#9A958A"; g.strokeStyle = c.ink; g.lineWidth = 1.6;
        if (o.kind) { g.beginPath(); g.moveTo(o.x - 16, ground); g.quadraticCurveTo(o.x, ground - 22, o.x + 16, ground); g.closePath(); g.fill(); g.stroke(); }
        else { wob(g, o.x, ground - 10, 12, 1.5, i); g.fill(); g.stroke(); }
        if (!o.hit && !o.passed && Math.abs(o.x - px) < 16 && ground - py < 16) { o.hit = true; stumble = now; sfx("hurt"); buzz("medium"); pops.push({ text: "Tökezledin!", x: px, y: ground - 70, t: now, color: c.red }); burst(parts, px, ground, 8, "#9A958A", now, 2); }
        if (!o.passed && o.x < px - 20) { o.passed = true; if (!o.hit) { cleared++; if (rnd() < 0.5) pops.push({ text: "Hop!", x: px, y: ground - 90, t: now, color: c.green }); } }
        if (o.x < -30) obs.splice(i, 1);
      }
      stepPhase += dt * speed * 0.06 * (now - stumble < 400 ? 0.3 : 1);
      if (yOf(now) === 0 && now - lastStep > 330 / (1 + now / D)) { sfx("step"); lastStep = now; }
      g.save(); if (now - stumble < 400) { g.translate(px, py); g.rotate(0.3); g.translate(-px, -py); }
      stickman(g, px, py, S * 0.2, c, yOf(now) > 0 ? 0.8 : stepPhase, stepPhase);
      g.restore();
      drawParts(g, parts, now); drawPops(g, pops, now);
      counter(g, c, S, `${cleared} / ${total} engel · ${Math.max(0, Math.ceil((D - now) / 1000))} sn`);
      return now >= D;
    },
    down(_x, _y, now) { if (yOf(now) === 0) { jumpT = now; sfx("whoosh"); } },
    score: () => total ? clamp01((cleared / total - 0.3) / 0.65) : 0,
  };
}

/* ---------- yüzme: sol-sağ kulaç, ara ara nefes ---------- */
function yuzme(S: number, c: Ink, ease: number): Game {
  const beats: { t: number; side: 0 | 1; breath?: boolean }[] = []; let t = 1300;
  for (let i = 0; i < 22; i++) { const br = i > 0 && i % 6 === 5; beats.push({ t, side: (i % 2) as 0 | 1, breath: br }); t += br ? 1100 : 640; }
  const win = 120 * ease; const taps: number[] = [], good: number[] = []; const pops: Pop[] = []; let breaths = 0, breathOk = 0; let swipe: P[] = []; let stroke = -1e9, strokeSide = 0; const parts: Part[] = [];
  const end = beats[beats.length - 1].t + 800;
  const near = (now: number) => beats.reduce((b, x) => Math.abs(x.t - now) < Math.abs(b.t - now) ? x : b, beats[0]);
  return {
    hint: "Parlayan kol hangi taraftaysa ekranın o yarısına dokun. \"Nefes!\" yazınca yukarı kaydır.",
    frame(now, g) {
      const cy = S * 0.5;
      // su
      g.strokeStyle = c.blue; g.globalAlpha = 0.5; g.lineWidth = 1.5;
      for (let r = 0; r < 6; r++) { g.beginPath(); for (let x = 0; x <= S; x += 10) { const y = S * 0.2 + r * S * 0.12 + Math.sin(x / 30 + now / 400 + r) * 4; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
      g.globalAlpha = 1;
      // yüzücü (üstten)
      const sw = (now - stroke) < 400 ? 1 - (now - stroke) / 400 : 0;
      g.save(); g.translate(S / 2, cy); g.fillStyle = "#E7CFAE"; g.strokeStyle = c.ink; g.lineWidth = 2;
      g.beginPath(); g.ellipse(0, 10, 13, 30, 0, 0, TAU); g.fillStyle = c.blue; g.fill(); g.stroke();
      g.fillStyle = "#E7CFAE"; g.beginPath(); g.arc(0, -26, 10, 0, TAU); g.fill(); g.stroke();
      const nb = beats.find(b => b.t > now - 150); const glow = nb && nb.t - now < 650 && !nb.breath ? nb.side : -1;
      for (const side of [0, 1]) {
        const dir = side ? 1 : -1; const reach = side === strokeSide ? sw : 0;
        g.strokeStyle = glow === side ? c.red : c.ink; g.lineWidth = glow === side ? 4 : 3;
        g.beginPath(); g.moveTo(dir * 10, -10); g.lineTo(dir * (26 - reach * 10), -36 + reach * 50); g.stroke();
      }
      g.restore();
      if (nb?.breath && nb.t - now < 1000) { g.fillStyle = c.red; g.font = "700 34px Caveat, cursive"; g.textAlign = "center"; g.fillText("Nefes! ↑", S / 2, S * 0.18); }
      g.strokeStyle = c.pencil; g.setLineDash([4, 6]); g.beginPath(); g.moveTo(S / 2, S * 0.25); g.lineTo(S / 2, S * 0.88); g.stroke(); g.setLineDash([]);
      for (const b of beats) if (b.breath && !("done" in b) && now > b.t + 500) { (b as { done?: boolean }).done = true; breaths++; pops.push({ text: "Su yuttun", x: S / 2, y: S * 0.3, t: now, color: c.red }); sfx("splash"); }
      drawParts(g, parts, now); drawPops(g, pops, now);
      counter(g, c, S, `${good.length} kulaç`);
      return now >= end;
    },
    down(x, y, now) { swipe = [{ x, y, t: now }]; },
    move(x, y, now) { swipe.push({ x, y, t: now }); },
    up(now) {
      const sw = swipeOf(swipe); const b = near(now);
      if (sw.len > 40 && dirScore(sw, -90, 50) > 0) {
        if (b.breath && Math.abs(b.t - now) < 700 && !("done" in b)) { (b as { done?: boolean }).done = true; breaths++; breathOk++; pops.push({ text: "Derin nefes", x: S / 2, y: S * 0.3, t: now, color: c.green }); sfx("good"); }
        return;
      }
      const side = swipe[0].x > S / 2 ? 1 : 0; stroke = now; strokeSide = side; taps.push(now); sfx("splash");
      burst(parts, S / 2 + (side ? 30 : -30), S * 0.5 - 20, 6, "rgba(159,189,232,.9)", now, 2);
      if (!b.breath && b.side === side) { const gr = grade(now - b.t, win); if (gr.q > 0.3) good.push(b.t); pops.push({ text: gr.label, x: side ? S * 0.78 : S * 0.22, y: S * 0.4, t: now, color: qColor(c, gr.q) }); }
      else pops.push({ text: "Yanlış kol", x: side ? S * 0.78 : S * 0.22, y: S * 0.4, t: now, color: c.red });
    },
    score: () => clamp01(rhythmScore(beats.filter(b => !b.breath).map(b => b.t), good, win) * 0.75 + (breaths ? breathOk / breaths : 1) * 0.25),
  };
}

/* ---------- odun: baltayı çizgi boyunca savur ---------- */
function odun(S: number, c: Ink, ease: number): Game {
  const N = 6; const res: number[] = []; let ang = 0; const newLog = () => { ang = 90 + (rnd() - 0.5) * 60; }; newLog();
  let trail: P[] = []; let split = -1e9, splitQ = 0; const parts: Part[] = []; const pops: Pop[] = []; let showAt = 0; let lastQ = 0;
  return {
    hint: "Kütüğün üstündeki kesik çizgi boyunca hızlıca kaydır. Açı ne kadar doğruysa o kadar temiz yarılır.",
    frame(now, g) {
      const cx = S / 2, cy = S * 0.5; const r = S * 0.2;
      g.fillStyle = "#8A6A45"; g.strokeStyle = c.ink; g.lineWidth = 2; g.fillRect(cx - S * 0.3, cy + r * 0.9, S * 0.6, S * 0.14); g.strokeRect(cx - S * 0.3, cy + r * 0.9, S * 0.6, S * 0.14); // kütük altı
      const sp = now - split < 600 ? (now - split) / 600 : -1;
      const a = ang * Math.PI / 180;
      const drawHalf = (side: number) => {
        g.save(); if (sp >= 0 && splitQ > 0.3) { g.translate(side * Math.cos(a + Math.PI / 2) * sp * S * 0.3, side * Math.sin(a + Math.PI / 2) * sp * S * 0.3 + sp * sp * 40); g.rotate(side * sp * 0.6); }
        g.beginPath(); g.ellipse(cx, cy, r, r * 0.95, 0, 0, TAU); g.save(); g.clip();
        g.fillStyle = "#D9B98A"; g.fillRect(cx - r, cy - r, r * 2, r * 2);
        if (sp >= 0 && splitQ > 0.3) { g.globalCompositeOperation = "destination-out"; g.beginPath(); const nx = Math.cos(a + Math.PI / 2) * side, ny = Math.sin(a + Math.PI / 2) * side; g.moveTo(cx - Math.cos(a) * r * 2 - nx * r * 2, cy - Math.sin(a) * r * 2 - ny * r * 2); g.lineTo(cx + Math.cos(a) * r * 2 - nx * r * 2, cy + Math.sin(a) * r * 2 - ny * r * 2); g.lineTo(cx + Math.cos(a) * r * 2, cy + Math.sin(a) * r * 2); g.lineTo(cx - Math.cos(a) * r * 2, cy - Math.sin(a) * r * 2); g.fill(); g.globalCompositeOperation = "source-over"; }
        g.strokeStyle = "#A07A48"; g.lineWidth = 1.2; for (let i = 1; i < 5; i++) { g.beginPath(); g.arc(cx, cy, r * i / 5, 0, TAU); g.stroke(); }
        g.restore(); g.strokeStyle = c.ink; g.lineWidth = 2.5; g.stroke(); g.restore();
      };
      if (sp >= 0 && splitQ > 0.3) { drawHalf(1); drawHalf(-1); } else drawHalf(0);
      if (sp < 0 || splitQ <= 0.3) { g.setLineDash([7, 6]); g.strokeStyle = c.red; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - Math.cos(a) * r * 1.4, cy - Math.sin(a) * r * 1.4); g.lineTo(cx + Math.cos(a) * r * 1.4, cy + Math.sin(a) * r * 1.4); g.stroke(); g.setLineDash([]); }
      if (sp > 1 || (split > 0 && now - split > 600 && showAt < split)) { showAt = now; if (res.length < N) newLog(); }
      if (trail.length > 1) { g.strokeStyle = c.ink; g.lineWidth = 4; g.globalAlpha = 0.6; g.beginPath(); trail.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.stroke(); g.globalAlpha = 1; }
      drawParts(g, parts, now); drawPops(g, pops, now);
      counter(g, c, S, `${res.length} / ${N} kütük`);
      void lastQ;
      return res.length >= N && now - split > 900;
    },
    down(x, y, now) { trail = [{ x, y, t: now }]; },
    move(x, y, now) { trail.push({ x, y, t: now }); },
    up(now) {
      if (now - split < 600 || res.length >= N) { trail = []; return; }
      const sw = swipeOf(trail); const cx = S / 2, cy = S * 0.5;
      const through = trail.some(p => Math.hypot(p.x - cx, p.y - cy) < S * 0.08);
      const d = Math.max(dirScore(sw, ang, 35 * ease, 60), dirScore(sw, ang + 180, 35 * ease, 60));
      const fast = clamp01(sw.len / Math.max(1, sw.dur) / 1.2);
      const q = through ? clamp01(d * (0.6 + fast * 0.5)) : 0; trail = [];
      res.push(q); split = now; splitQ = q; lastQ = q;
      if (q > 0.3) { sfx("thunk"); buzz(q > 0.85 ? "heavy" : "medium"); burst(parts, cx, cy, 14, "#C9A26A", now, 4, 3); } else { sfx("bad"); }
      pops.push({ text: q > 0.85 ? "Tek vuruşta!" : q > 0.55 ? "Yarıldı" : q > 0.3 ? "Zorla yarıldı" : "Balta saplandı", x: cx, y: S * 0.15, t: now, color: qColor(c, q > 0.85 ? 1 : q > 0.55 ? 0.7 : 0.2) });
    },
    score: () => res.reduce((a, b) => a + b, 0) / N,
  };
}

/* ---------- tırmanma: parlayan tutamağa sırayla uzan ---------- */
function tirmanma(S: number, c: Ink, ease: number): Game {
  const holds: { x: number; y: number }[] = []; for (let i = 0; i < 16; i++) holds.push({ x: S * (i % 2 ? 0.62 : 0.38) + (rnd() - 0.5) * S * 0.18, y: -i * S * 0.16 });
  let idx = 1; let grip = 1; let cam = 0; let fall = -1; const decoys = holds.map(h => ({ x: S - h.x + (rnd() - 0.5) * 30, y: h.y - S * 0.07 }));
  const pops: Pop[] = []; let last = 0; const parts: Part[] = [];
  return {
    hint: "Parlayan tutamağa dokun; sol ve sağ el sırayla. Kavrama gücün azalıyor, oyalanma. Yanlış taşa uzanırsan kayarsın.",
    frame(now, g) {
      const dt = last ? Math.min(50, now - last) : 16; last = now;
      if (fall < 0 && idx > 1) grip -= dt / (4200 * ease) * (1 + idx / 24);
      if (grip <= 0 && fall < 0) { fall = now; sfx("hurt"); buzz("long"); }
      const target = -holds[Math.min(idx, holds.length - 1)].y + S * 0.6; cam += (target - cam) * 0.08;
      g.fillStyle = "#CDBE9A"; g.fillRect(S * 0.15, 0, S * 0.7, S); g.strokeStyle = c.pencil; g.lineWidth = 1;
      for (let i = 0; i < 12; i++) { const y = ((i * 47 + cam) % S + S) % S; g.beginPath(); g.moveTo(S * 0.15, y); g.lineTo(S * 0.3, y + 10); g.lineTo(S * 0.5, y - 5); g.stroke(); }
      const draw = (h: { x: number; y: number }, glow: boolean, done: boolean) => { const y = h.y + cam; if (y < -20 || y > S + 20) return; g.fillStyle = done ? "#9A958A" : glow ? "#E8B84A" : "#8A7A62"; g.strokeStyle = c.ink; g.lineWidth = glow ? 3 : 1.5; wob(g, h.x, y, glow ? 13 : 10, 1.5, h.x); g.fill(); g.stroke(); };
      decoys.forEach((d, i) => { if (i >= idx - 1 && i < idx + 3) draw(d, false, false); });
      holds.forEach((h, i) => draw(h, i === idx && fall < 0, i < idx));
      // tırmanıcı: iki el son iki tutamakta
      const a = holds[idx - 1], b = holds[Math.max(0, idx - 2)]; const fy = fall >= 0 ? (now - fall) * 0.6 : 0;
      const bx = (a.x + b.x) / 2, by = Math.max(a.y, b.y) + cam + S * 0.12 + fy;
      g.strokeStyle = c.ink; g.lineWidth = 2.5; g.beginPath(); g.moveTo(bx, by - 18); g.lineTo(a.x, a.y + cam + fy); g.moveTo(bx, by - 18); g.lineTo(b.x, b.y + cam + fy); g.stroke();
      stickman(g, bx, by + 30, S * 0.18, c, 0.4, -1.2);
      // kavrama çubuğu
      g.fillStyle = c.paper2; g.fillRect(12, 20, 12, S - 60); g.fillStyle = grip > 0.3 ? c.green : c.red; g.fillRect(12, 20 + (S - 60) * (1 - Math.max(0, grip)), 12, (S - 60) * Math.max(0, grip)); g.strokeStyle = c.ink; g.strokeRect(12, 20, 12, S - 60);
      drawParts(g, parts, now); drawPops(g, pops, now);
      counter(g, c, S, fall >= 0 ? "Düştün" : `${idx - 1} / ${holds.length - 1} tutamak`);
      return (fall >= 0 && now - fall > 900) || idx >= holds.length;
    },
    down(x, y, now) {
      if (fall >= 0 || idx >= holds.length) return;
      const h = holds[idx];
      if (Math.hypot(x - h.x, y - (h.y + cam)) < 34) { idx++; grip = Math.min(1, grip + 0.28); sfx("step"); buzz("light"); burst(parts, h.x, h.y + cam, 5, "#9A958A", now, 1.5); }
      else { grip -= 0.12; sfx("bad"); pops.push({ text: "Kaydı!", x, y, t: now, color: c.red }); burst(parts, x, y, 6, "#9A958A", now, 2); }
    },
    score: () => clamp01((idx - 1) / (holds.length - 1)),
  };
}

/* ---------- dans ve kılıç: yöne kaydır ---------- */
const DIRS: [number, string][] = [[0, "→"], [90, "↓"], [180, "←"], [-90, "↑"]];
function dans(S: number, c: Ink, ease: number): Game {
  const N = 14; const moves = Array.from({ length: N }, (_, i) => ({ t: 1200 + i * 900, d: DIRS[Math.floor(rnd() * 4)] }));
  const res: number[] = []; let sw: P[] = []; const pops: Pop[] = []; let pose = -1e9, poseDir = 0;
  return {
    hint: "Ok ortadaki halkaya geldiğinde o yöne kaydır. Davul ritmine uy.",
    frame(now, g) {
      for (const m of moves) if (!(m as { beat?: boolean }).beat && now >= m.t) { (m as { beat?: boolean }).beat = true; sfx("beat"); }
      const cx = S / 2, cy = S * 0.45;
      g.strokeStyle = c.ink; g.lineWidth = 2; wob(g, cx, cy, 34, 1, 2); g.stroke();
      for (const m of moves) {
        const lead = (m.t - now) / 1600; if (lead < -0.15 || lead > 1) continue; const done = res.length > moves.indexOf(m);
        g.globalAlpha = done ? 0.2 : 1; g.fillStyle = c.red; g.font = "700 46px Caveat, cursive"; g.textAlign = "center";
        g.fillText(m.d[1], cx + lead * S * 0.45, cy + 16); g.globalAlpha = 1;
      }
      const pk = now - pose < 350 ? 1 - (now - pose) / 350 : 0; const a = poseDir * Math.PI / 180;
      stickman(g, cx + Math.cos(a) * pk * 20, S * 0.88 + Math.sin(a) * pk * 10, S * 0.24, c, pk * 1.2, pk * 2);
      for (const m of moves) { const i = moves.indexOf(m); if (i === res.length && now > m.t + 450) { res.push(0); pops.push({ text: "Kaçırdın", x: cx, y: S * 0.2, t: now, color: c.red }); } }
      drawPops(g, pops, now);
      counter(g, c, S, `${res.length} / ${N}`);
      return res.length >= N && pops.length === 0;
    },
    down(x, y, now) { sw = [{ x, y, t: now }]; }, move(x, y, now) { sw.push({ x, y, t: now }); },
    up(now) {
      const m = moves[res.length]; if (!m) return; const s = swipeOf(sw); if (s.len < 30) return;
      const d = dirScore(s, m.d[0], 40, 30); const tq = grade(now - m.t, 170 * ease).q; const q = d > 0 ? tq : 0;
      res.push(q); pose = now; poseDir = s.angle; feedback(q);
      pops.push({ text: d === 0 ? "Ters adım" : q >= 0.95 ? "Kusursuz" : q >= 0.55 ? "Güzel" : "Ritim kaçtı", x: S / 2, y: S * 0.2, t: now, color: qColor(c, q) });
    },
    score: () => res.reduce((a, b) => a + b, 0) / N,
  };
}
function savustur(S: number, c: Ink, ease: number): Game {
  // hoca kılıcı kaldırır (sol/sağ/üst); darbe gelirken kılıcın geldiği yöne kaydır. Bazıları aldatmaca: taraf değişir.
  const N = 9; interface St { at: number; wind: number; side: number; feint: boolean; q?: number }
  const st: St[] = []; let t = 1000; for (let i = 0; i < N; i++) { const wind = 700 - i * 25; st.push({ at: t, wind, side: Math.floor(rnd() * 3), feint: i > 2 && rnd() < 0.3 }); t += wind + 1100 + rnd() * 500; }
  const sideAngle = [180, 0, -90]; const sideName = ["sol", "sağ", "üst"]; let sw: P[] = []; const pops: Pop[] = []; let clash = -1e9; const parts: Part[] = [];
  const realSide = (s: St, now: number) => s.feint && now > s.at + s.wind * 0.55 ? (s.side + 1) % 3 : s.side;
  const cur = (now: number) => st.find(s => s.q === undefined && now >= s.at && now <= s.at + s.wind + 380);
  return {
    hint: "Hoca kılıcı kaldırınca hangi taraftan geleceğine bak. Darbe inerken o tarafa doğru kaydırıp karşıla. Hile yapıp taraf değiştirebilir.",
    frame(now, g) {
      const cx = S / 2, cy = S * 0.5;
      stickman(g, cx, cy + S * 0.12, S * 0.36, c, 0, 0);
      const s = cur(now);
      if (s) {
        const side = realSide(s, now); const k = Math.min(1, (now - s.at) / s.wind);
        const a0 = side === 0 ? -2.4 : side === 1 ? -0.7 : -1.57; const tip = a0 + (k > 0.75 ? (k - 0.75) * 4 * (side === 2 ? 0 : side === 0 ? 0.9 : -0.9) : 0);
        const hx = cx + (side === 0 ? -14 : side === 1 ? 14 : 0), hy = cy - S * 0.05;
        g.strokeStyle = k > 0.75 ? c.red : "#8A8F96"; g.lineWidth = 5; g.lineCap = "round"; g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx + Math.cos(tip) * S * 0.3, hy + Math.sin(tip) * S * 0.3); g.stroke();
        if (k > 0.75) { g.fillStyle = c.red; g.font = "700 24px Caveat, cursive"; g.textAlign = "center"; g.fillText("Şimdi!", cx, S * 0.12); }
      }
      for (const x of st) if (x.q === undefined && now > x.at + x.wind + 380) { x.q = 0; pops.push({ text: "Darbe yedin", x: cx, y: S * 0.2, t: now, color: c.red }); sfx("hurt"); buzz("medium"); }
      if (now - clash < 200) { g.fillStyle = "#FFD27A"; g.beginPath(); g.arc(cx, cy - S * 0.1, 30 * (1 - (now - clash) / 200), 0, TAU); g.fill(); }
      drawParts(g, parts, now); drawPops(g, pops, now);
      const done = st.filter(x => x.q !== undefined).length; counter(g, c, S, `${done} / ${N}`);
      return done >= N && pops.length === 0;
    },
    down(x, y, now) { sw = [{ x, y, t: now }]; }, move(x, y, now) { sw.push({ x, y, t: now }); },
    up(now) {
      const s = cur(now); if (!s) return; const v = swipeOf(sw); if (v.len < 30) return;
      const side = realSide(s, now); const k = (now - s.at) / s.wind;
      const d = dirScore(v, sideAngle[side], 45 * ease, 30); const timing = k < 0.5 ? 0 : k < 0.72 ? 0.5 : 1;
      const q = d > 0 ? timing * Math.max(0.6, d) : 0; s.q = q;
      if (q > 0) { sfx("clang"); buzz("medium"); clash = now; burst(parts, S / 2, S * 0.4, 10, "#FFD27A", now, 3, 2); }
      else sfx("bad");
      pops.push({ text: d === 0 ? `Darbe ${sideName[side]}dan geldi` : timing === 0 ? "Erken davrandın" : q >= 0.95 ? "Savuşturdun!" : "Karşıladın", x: S / 2, y: S * 0.2, t: now, color: qColor(c, q) });
    },
    score: () => st.reduce((a, s) => a + (s.q ?? 0), 0) / N,
  };
}

/* ---------- kesme: hocanın havaya attıklarını kılıçla kes, taşa vurma ---------- */
function kesme(S: number, c: Ink, ease: number): Game {
  const D = 25000; const G = 0.00055 * S / 400 / Math.sqrt(ease); // yerçekimi: beceri arttıkça şeyler havada daha uzun kalır
  const KINDS = [
    { name: "elma", r: 0.055, fill: "#C8463A", inner: "#F2E2B0", pts: 1 },
    { name: "kabak", r: 0.085, fill: "#D98A2E", inner: "#F2C46A", pts: 1 },
    { name: "saman", r: 0.07, fill: "#D9BE6A", inner: "#B89A48", pts: 1 },
    { name: "taş", r: 0.06, fill: "#8A8680", inner: "#8A8680", pts: 0 },
  ];
  interface O { k: number; x: number; y: number; vx: number; vy: number; rot: number; vr: number; t0: number; cut?: number; ang?: number; gone?: boolean }
  const objs: O[] = []; let next = 600; let launched = 0, cut = 0, stones = 0, missed = 0, best = 0;
  let trail: P[] = []; let swipeCuts = 0; const parts: Part[] = []; const pops: Pop[] = []; let last = 0; let flash = -1e9;
  const throwOne = (now: number) => {
    const late = now / D; const stoneP = 0.08 + late * 0.12;
    const k = rnd() < stoneP ? 3 : Math.floor(rnd() * 3);
    const x = S * (0.2 + rnd() * 0.6); const tx = S * (0.25 + rnd() * 0.5);
    const peak = S * (0.15 + rnd() * 0.25); const vy = -Math.sqrt(2 * G * (S + 20 - peak)); const tUp = -vy / G;
    objs.push({ k, x, y: S + 20, vx: (tx - x) / tUp / 1.6, vy, rot: rnd() * 6, vr: (rnd() - 0.5) * 0.008, t0: now });
    if (k !== 3) launched++;
  };
  const segDist = (px: number, py: number, a: P, b: P) => { const vx = b.x - a.x, vy = b.y - a.y, L2 = vx * vx + vy * vy || 1; const t = Math.max(0, Math.min(1, ((px - a.x) * vx + (py - a.y) * vy) / L2)); return Math.hypot(px - a.x - vx * t, py - a.y - vy * t); };
  return {
    hint: "Hoca havaya elma, kabak ve saman demeti atıyor. Parmağını hızla kaydırıp kes; tek savuruşta birkaçını kesersen ustalık. Gri taşa dokunma, kılıcın çentiklenir.",
    frame(now, g) {
      const dt = last ? Math.min(40, now - last) : 16; last = now;
      if (now > next && now < D - 1200) {
        const n = rnd() < 0.25 + now / D * 0.35 ? 2 + Math.floor(rnd() * 2) : 1;
        for (let i = 0; i < n; i++) throwOne(now);
        next = now + (1100 - now / D * 450) / Math.min(1.3, ease) + rnd() * 400; sfx("whoosh");
      }
      if (now - flash < 160) { g.fillStyle = "rgba(158,52,35,.18)"; g.fillRect(0, 0, S, S); }
      for (const o of objs) {
        if (o.gone) continue;
        o.vy += G * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.rot += o.vr * dt;
        const K = KINDS[o.k]; const r = K.r * S;
        if (o.y > S + 60) { o.gone = true; if (o.cut === undefined && o.k !== 3) { missed++; pops.push({ text: "Düştü", x: Math.max(30, Math.min(S - 30, o.x)), y: S - 30, t: now, color: c.red }); } continue; }
        g.save(); g.translate(o.x, o.y); g.strokeStyle = c.ink; g.lineWidth = 2;
        if (o.cut === undefined) {
          g.rotate(o.rot); g.fillStyle = K.fill; wob(g, 0, 0, r, 1.6, o.k + 1); g.fill(); g.stroke();
          if (o.k === 0) { g.beginPath(); g.moveTo(0, -r); g.lineTo(2, -r - 8); g.stroke(); g.fillStyle = c.green; g.beginPath(); g.ellipse(6, -r - 6, 5, 2.5, -0.5, 0, TAU); g.fill(); }
          if (o.k === 1) { g.globalAlpha = 0.5; for (const a of [-0.5, 0, 0.5]) { g.beginPath(); g.ellipse(0, 0, r * Math.abs(Math.cos(a + 1)) * 0.7, r, 0, 0, TAU); g.stroke(); } g.globalAlpha = 1; }
          if (o.k === 2) { g.globalAlpha = 0.6; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * r * 0.3, -r * 0.9); g.lineTo(i * r * 0.35, r * 0.9); g.stroke(); } g.globalAlpha = 1; g.strokeStyle = "#8A5A30"; g.lineWidth = 3; g.beginPath(); g.moveTo(-r, 0); g.lineTo(r, 0); g.stroke(); }
          if (o.k === 3) { g.fillStyle = "rgba(255,255,255,.25)"; g.beginPath(); g.arc(-r * 0.3, -r * 0.3, r * 0.25, 0, TAU); g.fill(); }
        } else {
          // iki yarım birbirinden ayrılır
          const s = (now - o.cut) / 1000; const a = o.ang!;
          for (const side of [-1, 1]) {
            g.save(); g.translate(Math.cos(a + Math.PI / 2) * side * s * 60, Math.sin(a + Math.PI / 2) * side * s * 60); g.rotate(a + side * s * 2);
            g.beginPath(); g.arc(0, 0, r, side > 0 ? 0 : Math.PI, side > 0 ? Math.PI : TAU); g.closePath();
            g.fillStyle = K.fill; g.fill(); g.stroke();
            g.beginPath(); g.ellipse(0, 0, r * 0.92, r * 0.18, 0, side > 0 ? 0 : Math.PI, side > 0 ? Math.PI : TAU); g.fillStyle = K.inner; g.fill();
            g.restore();
          }
        }
        g.restore();
        // kesik kontrolü: son iz parçası daireyi geçerse ve parmak hızlıysa
        if (o.cut === undefined && trail.length >= 2) {
          const a = trail[trail.length - 2], b = trail[trail.length - 1];
          const sp = Math.hypot(b.x - a.x, b.y - a.y) / Math.max(1, b.t - a.t);
          if (sp > 0.35 / ease && segDist(o.x, o.y, a, b) < r * (0.9 + ease * 0.2)) {
            o.cut = now; o.ang = Math.atan2(b.y - a.y, b.x - a.x);
            if (o.k === 3) { stones++; flash = now; sfx("clang"); buzz("heavy"); pops.push({ text: "Çentik!", x: o.x, y: o.y - 20, t: now, color: c.red }); burst(parts, o.x, o.y, 10, "#FFD27A", now, 3, 2); }
            else { cut++; swipeCuts++; sfx("hit"); buzz("light"); burst(parts, o.x, o.y, 12, K.inner, now, 3, 3);
              if (swipeCuts >= 2) { pops.push({ text: swipeCuts >= 3 ? `Üçlü kesik!` : "Çifte kesik!", x: o.x, y: o.y - 30, t: now, color: c.green }); sfx("perfect"); best = Math.max(best, swipeCuts); } }
          }
        }
      }
      for (let i = objs.length - 1; i >= 0; i--) if (objs[i].gone || (objs[i].cut !== undefined && now - objs[i].cut! > 1200)) objs.splice(i, 1);
      // kılıç izi: parlak, hızla solan
      const fresh = trail.filter(p => now - p.t < 140 || p.t > now);
      if (fresh.length > 1) { g.lineCap = "round"; for (let i = 1; i < fresh.length; i++) { const k = i / fresh.length; g.strokeStyle = `rgba(230,235,240,${k})`; g.lineWidth = 2 + k * 6; g.beginPath(); g.moveTo(fresh[i - 1].x, fresh[i - 1].y); g.lineTo(fresh[i].x, fresh[i].y); g.stroke(); g.strokeStyle = c.ink; g.lineWidth = 1; g.stroke(); } }
      drawParts(g, parts, now); drawPops(g, pops, now);
      counter(g, c, S, `${cut} kesik · ${stones ? stones + " çentik · " : ""}${Math.max(0, Math.ceil((D - now) / 1000))} sn`);
      return now >= D && objs.length === 0;
    },
    down(x, y, now) { trail = [{ x, y, t: now }]; swipeCuts = 0; },
    move(x, y, now) { if (!trail.length) return; trail.push({ x, y, t: now }); if (trail.length > 40) trail.shift(); if (trail.length % 6 === 0) sfx("whoosh"); },
    up() { trail = []; swipeCuts = 0; },
    score: () => launched ? clamp01(cut / launched * 1.1 + Math.min(best, 3) * 0.03 - stones * 0.12) : 0,
  };
}

/* ---------- yay: geri çek, rüzgârı hesapla, bırak ---------- */
function yay(S: number, c: Ink, ease: number): Game {
  const N = 5; const res: number[] = []; let pull: P | null = null; let cur: P | null = null; let wind = 0; const newWind = () => { wind = (rnd() - 0.5) * 2; }; newWind();
  let arrow: { x: number; y: number; vx: number; vy: number; t: number } | null = null; const pops: Pop[] = []; const holes: { x: number; y: number }[] = [];
  const bx = S / 2, by = S * 0.8; const tgt = (now: number) => ({ x: S / 2 + Math.sin(now / 900 + res.length) * S * 0.28, y: S * 0.2 });
  return {
    hint: "Yayın dibinden parmağını aşağı çek, nişan al ve bırak. Ok rüzgârla kayar; kaçan tavşanın önüne at.",
    frame(now, g) {
      const T = tgt(now); const R = S * 0.07;
      // çimen, tavşan
      g.strokeStyle = c.green; g.lineWidth = 1.2; for (let i = 0; i < 30; i++) { const x = (i * 37) % S, y = S * 0.12 + (i * 53) % (S * 0.2); g.beginPath(); g.moveTo(x, y); g.lineTo(x + 2, y - 7); g.stroke(); }
      g.fillStyle = "#B8A58A"; g.strokeStyle = c.ink; g.lineWidth = 1.5; g.beginPath(); g.ellipse(T.x, T.y, R * 0.9, R * 0.6, 0, 0, TAU); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(T.x + R * 0.6, T.y - R * 0.6, R * 0.18, R * 0.5, 0.3, 0, TAU); g.fill(); g.stroke();
      for (const h of holes) { g.strokeStyle = c.ink; g.lineWidth = 2; g.beginPath(); g.moveTo(h.x - 5, h.y - 5); g.lineTo(h.x + 5, h.y + 5); g.moveTo(h.x + 5, h.y - 5); g.lineTo(h.x - 5, h.y + 5); g.stroke(); }
      // rüzgâr
      g.strokeStyle = c.blue; g.lineWidth = 2.5; const wl = wind * 50; g.beginPath(); g.moveTo(S / 2 - wl, S * 0.5); g.lineTo(S / 2 + wl, S * 0.5); g.lineTo(S / 2 + wl - Math.sign(wl) * 8, S * 0.5 - 6); g.stroke();
      g.fillStyle = c.blue; g.font = "18px Caveat, cursive"; g.textAlign = "center"; g.fillText("rüzgâr", S / 2, S * 0.5 + 20);
      // yay ve kiriş
      const dx = pull && cur ? cur.x - pull.x : 0, dy = pull && cur ? cur.y - pull.y : 0; const L = Math.min(S * 0.25, Math.hypot(dx, dy)); const a = Math.atan2(-dy, -dx);
      g.save(); g.translate(bx, by); g.rotate(L > 5 ? a + Math.PI / 2 : 0);
      g.strokeStyle = "#7B5A3A"; g.lineWidth = 4; g.beginPath(); g.arc(0, 30, 52, -Math.PI * 0.85, -Math.PI * 0.15); g.stroke();
      const sx = Math.cos(-Math.PI * 0.85) * 52, sy = 30 + Math.sin(-Math.PI * 0.85) * 52;
      g.strokeStyle = c.ink; g.lineWidth = 1.4; g.beginPath(); g.moveTo(sx, sy); g.lineTo(0, sy + L); g.lineTo(-sx, sy); g.stroke();
      if (!arrow) { g.strokeStyle = "#5B4630"; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, sy + L); g.lineTo(0, sy + L - 60); g.stroke(); }
      g.restore();
      if (arrow) {
        const k = (now - arrow.t) / 16; arrow.x += arrow.vx; arrow.y += arrow.vy; arrow.x += wind * 0.9;
        g.strokeStyle = "#5B4630"; g.lineWidth = 2.5; g.beginPath(); g.moveTo(arrow.x, arrow.y); g.lineTo(arrow.x - arrow.vx * 4, arrow.y - arrow.vy * 4); g.stroke();
        if (arrow.y < T.y || k > 120) {
          const d = Math.hypot(arrow.x - T.x, arrow.y - T.y); const q = clamp01(1.25 - d / (R * 2.2 * ease)); res.push(q); holes.push({ x: arrow.x, y: Math.max(arrow.y, T.y) });
          sfx(q > 0 ? "hit" : "miss"); if (q > 0.8) buzz("medium");
          pops.push({ text: q > 0.8 ? "Tam isabet!" : q > 0.4 ? "Sıyırdı" : "Iska", x: T.x, y: T.y + 40, t: now, color: qColor(c, q > 0.8 ? 1 : q > 0.4 ? 0.6 : 0) });
          arrow = null; newWind();
        }
      }
      drawPops(g, pops, now); counter(g, c, S, `${res.length} / ${N} ok`);
      return res.length >= N && !arrow && pops.length === 0;
    },
    down(x, y, now) { if (!arrow && res.length < N && Math.hypot(x - bx, y - by) < S * 0.25) { pull = { x, y, t: now }; cur = pull; } },
    move(x, y, now) { if (pull) cur = { x, y, t: now }; },
    up(now) {
      if (!pull || !cur) return; const dx = cur.x - pull.x, dy = cur.y - pull.y; const L = Math.min(S * 0.25, Math.hypot(dx, dy)); pull = cur = null;
      if (L < 20) return; const sp = 4 + L / (S * 0.25) * 10; const a = Math.atan2(-dy, -dx);
      arrow = { x: bx, y: by - 30, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: now }; sfx("whoosh");
    },
    score: () => res.reduce((a, b) => a + b, 0) / N,
  };
}

/* ---------- ocak: demir kızgınken vur, soğuyunca ocağa sür ---------- */
function ocak(S: number, c: Ink, ease: number): Game {
  const D = 22000, TARGET = 14; let heat = 1; let hits = 0, cold = 0; let last = 0; let hammer = -1e9; let sw: P[] = []; let reheat = -1e9;
  const parts: Part[] = []; const pops: Pop[] = []; let shake = -1e9;
  return {
    hint: "Demir sarı-turuncuyken örse vur (dokun). Kızıllık sönünce yukarı kaydırıp ocağa sür, ısınınca yine vur.",
    frame(now, g) {
      const dt = last ? Math.min(50, now - last) : 16; last = now;
      if (now - reheat > 700) heat = Math.max(0, heat - dt / (3000 * ease)); else heat = Math.min(1, heat + dt / 500);
      g.save(); if (now - shake < 150) g.translate((rnd() - 0.5) * 8, (rnd() - 0.5) * 8);
      // ocak (üst)
      const fl = 0.6 + Math.sin(now / 80) * 0.2; const gr = g.createRadialGradient(S / 2, S * 0.12, 5, S / 2, S * 0.12, S * 0.25); gr.addColorStop(0, `rgba(255,190,80,${fl})`); gr.addColorStop(1, "rgba(200,60,20,0)");
      g.fillStyle = gr; g.fillRect(0, 0, S, S * 0.35); g.strokeStyle = c.ink; g.lineWidth = 2; g.strokeRect(S * 0.25, S * 0.04, S * 0.5, S * 0.18);
      for (let i = 0; i < 14; i++) { g.fillStyle = i % 3 ? "#3A3030" : `rgba(240,${120 + Math.sin(now / 120 + i) * 60},40,.9)`; g.beginPath(); g.arc(S * 0.29 + (i % 7) * S * 0.07, S * 0.15 + Math.floor(i / 7) * S * 0.04, 6, 0, TAU); g.fill(); }
      g.fillStyle = c.soft; g.font = "16px Caveat, cursive"; g.textAlign = "center"; g.fillText("ocak ↑", S / 2, S * 0.27);
      // örs
      const ay = S * 0.66; g.fillStyle = "#4A4A50"; g.beginPath(); g.moveTo(S * 0.2, ay); g.lineTo(S * 0.8, ay); g.lineTo(S * 0.7, ay + 24); g.lineTo(S * 0.3, ay + 24); g.closePath(); g.fill(); g.stroke();
      g.fillRect(S * 0.42, ay + 24, S * 0.16, S * 0.14);
      // demir: ısıya göre renk; vuruldukça yassılır
      const inForge = now - reheat < 700; const my = inForge ? S * 0.14 : ay - 8; const flat = Math.min(1, hits / TARGET);
      const col = heat > 0.7 ? "#FFD27A" : heat > 0.45 ? "#F08A3A" : heat > 0.2 ? "#B04020" : "#5A5552";
      g.fillStyle = col; g.strokeStyle = c.ink; g.fillRect(S * 0.32 - flat * 20, my - 8 + flat * 3, S * 0.36 + flat * 40, 16 - flat * 6); g.strokeRect(S * 0.32 - flat * 20, my - 8 + flat * 3, S * 0.36 + flat * 40, 16 - flat * 6);
      // çekiç
      const hk = now - hammer < 220 ? 1 - (now - hammer) / 220 : 0; g.save(); g.translate(S * 0.78, ay - 40); g.rotate(-0.9 + hk * 1.1);
      g.fillStyle = "#6B5235"; g.fillRect(-4, 0, 8, 70); g.fillStyle = "#5A5A60"; g.fillRect(-18, -10, 36, 18); g.strokeRect(-18, -10, 36, 18); g.restore();
      g.restore();
      // ısı çubuğu
      g.fillStyle = c.paper2; g.fillRect(14, S * 0.3, 12, S * 0.5); g.fillStyle = col; g.fillRect(14, S * 0.3 + S * 0.5 * (1 - heat), 12, S * 0.5 * heat); g.strokeStyle = c.ink; g.strokeRect(14, S * 0.3, 12, S * 0.5);
      g.strokeStyle = c.green; g.beginPath(); g.moveTo(10, S * 0.3 + S * 0.5 * 0.55); g.lineTo(30, S * 0.3 + S * 0.5 * 0.55); g.stroke();
      drawParts(g, parts, now); drawPops(g, pops, now);
      counter(g, c, S, `${hits} / ${TARGET} vuruş · ${Math.max(0, Math.ceil((D - now) / 1000))} sn`);
      return now >= D || hits >= TARGET;
    },
    down(x, y, now) { sw = [{ x, y, t: now }]; },
    move(x, y, now) { sw.push({ x, y, t: now }); },
    up(now) {
      const v = swipeOf(sw);
      if (v.len > 50 && dirScore(v, -90, 50) > 0) { reheat = now; sfx("fire"); return; }
      if (now - reheat < 700 || now - hammer < 180) return;
      hammer = now; shake = now;
      if (heat > 0.45) { hits++; sfx("clang"); buzz("medium"); burst(parts, S / 2, S * 0.6, 16, "#FFD27A", now, 4, 2); if (heat > 0.7 && hits % 3 === 0) pops.push({ text: "Tam kıvamında", x: S / 2, y: S * 0.45, t: now, color: c.green }); }
      else { cold++; sfx("bad"); buzz("light"); pops.push({ text: "Soğuk demire vurdun", x: S / 2, y: S * 0.45, t: now, color: c.red }); }
      heat = Math.max(0, heat - 0.08);
    },
    score: () => clamp01(hits / TARGET - cold * 0.06),
  };
}

/* ---------- mum: parmağın kıpırdamasın, dikkatin dağılmasın ---------- */
function mum(S: number, c: Ink, ease: number): Game {
  const D = 20000; let hold: P | null = null; let cur: P | null = null; let calm = 0, total = 0, last = 0; let flick = 0;
  const flies: { t: number; y: number; dir: number }[] = []; let nextFly = 3000; const pops: Pop[] = []; let lifted = 0;
  return {
    hint: "Parmağını ekrana koy ve kıpırdatmadan tut. Alev senin nefesin: sen sakin kalırsan o da sakin kalır. Sineğe aldırma.",
    frame(now, g) {
      const dt = last ? Math.min(50, now - last) : 16; last = now;
      const moved = hold && cur ? Math.hypot(cur.x - hold.x, cur.y - hold.y) : 99;
      const still = !!hold && moved < 10 * ease;
      if (now < D) { total += dt; if (still) calm += dt; }
      flick += ((still ? 0 : 1) - flick) * 0.06;
      // sinek
      if (now > nextFly && now < D - 2000) { flies.push({ t: now, y: S * (0.2 + rnd() * 0.5), dir: rnd() < 0.5 ? 1 : -1 }); nextFly = now + 2500 + rnd() * 2500; sfx("whoosh"); }
      for (const f of flies) { const k = (now - f.t) / 2200; if (k > 1) continue; const x = f.dir > 0 ? k * S : S - k * S; const y = f.y + Math.sin(k * 30) * 14; g.fillStyle = c.ink; g.beginPath(); g.arc(x, y, 2.5, 0, TAU); g.fill(); g.strokeStyle = c.pencil; g.lineWidth = 1; g.beginPath(); g.ellipse(x - 2, y - 3, 3, 1.5, -0.5, 0, TAU); g.ellipse(x + 2, y - 3, 3, 1.5, 0.5, 0, TAU); g.stroke(); }
      // mum ve alev
      const cx = S / 2, top = S * 0.55;
      g.fillStyle = "#F2E6C8"; g.strokeStyle = c.ink; g.lineWidth = 2; g.fillRect(cx - 18, top, 36, S * 0.3); g.strokeRect(cx - 18, top, 36, S * 0.3);
      g.beginPath(); g.moveTo(cx, top); g.lineTo(cx, top - 8); g.stroke();
      const sway = Math.sin(now / 70) * 10 * flick + Math.sin(now / 23) * 3 * flick; const h = 46 - flick * 16;
      const gl = g.createRadialGradient(cx, top - 30, 4, cx, top - 30, 110); gl.addColorStop(0, `rgba(255,200,110,${0.5 - flick * 0.3})`); gl.addColorStop(1, "rgba(255,200,110,0)"); g.fillStyle = gl; g.fillRect(0, 0, S, S);
      g.beginPath(); g.moveTo(cx - 9, top - 8); g.quadraticCurveTo(cx - 12 + sway * 0.3, top - h * 0.6, cx + sway, top - h); g.quadraticCurveTo(cx + 12 + sway * 0.3, top - h * 0.6, cx + 9, top - 8); g.closePath(); g.fillStyle = "#F0A040"; g.fill();
      g.beginPath(); g.ellipse(cx + sway * 0.3, top - 16, 4, 9, 0, 0, TAU); g.fillStyle = "#FFF0C0"; g.fill();
      if (hold && cur) { g.strokeStyle = still ? c.green : c.red; g.lineWidth = 2; wob(g, hold.x, hold.y, 10 * ease, 0.6, 3); g.stroke(); }
      g.fillStyle = still ? c.green : c.soft; g.font = "700 24px Caveat, cursive"; g.textAlign = "center";
      g.fillText(!hold ? "Parmağını koy" : still ? "Sakin…" : "Kıpırdadın", cx, S * 0.12);
      drawPops(g, pops, now); counter(g, c, S, `${Math.max(0, Math.ceil((D - now) / 1000))} sn`);
      return now >= D;
    },
    down(x, y, now) { hold = { x, y, t: now }; cur = hold; },
    move(x, y, now) { if (hold) cur = { x, y, t: now }; },
    up(now) { if (hold) { lifted++; pops.push({ text: "Odağın koptu", x: S / 2, y: S * 0.3, t: now, color: c.red }); sfx("bad"); } hold = cur = null; },
    score: () => clamp01(calm / Math.max(1, total) * 1.08 - lifted * 0.03),
  };
}

/* ---------- işaret: element işaretini çiz, giderek rehbersiz ---------- */
function isaret(S: number, c: Ink, ease: number, o: MiniOpts): Game {
  const id = o.element && RUNES[o.element] ? o.element : "el_ates"; const N = 5; const res: number[] = []; let trail: P[] = []; const parts: Part[] = []; const pops: Pop[] = []; let fx = -1e9, fxQ = 0;
  const col = { el_ates: "#E07A2E", el_su: "#4A8AC8", el_toprak: "#8A6A3A", el_hava: "#A8C8D8", el_ayaz: "#9FD3E8", el_simsek: "#E8D84A" }[id] ?? "#E07A2E";
  return {
    hint: `Annenin defterindeki "${RUNES[id].name}" işaretini çiz. Her turda rehber biraz daha silinir; sonunda ezberden çizeceksin.`,
    frame(now, g) {
      const guide = Math.max(0, 0.8 - res.length * 0.2);
      if (res.length < N) {
        g.save(); g.globalAlpha = guide; g.setLineDash([6, 8]); g.strokeStyle = c.red; g.lineWidth = 3; g.beginPath();
        RUNES[id].pts.forEach(([x, y], k) => { const px = S * 0.15 + x * S * 0.7, py = S * 0.12 + y * S * 0.7; k ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke(); g.restore();
      }
      if (trail.length > 1) { g.strokeStyle = c.ink; g.lineWidth = 4; g.lineCap = "round"; g.beginPath(); trail.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.stroke(); }
      // başarılı çizimde element canlanır
      const k = (now - fx) / 800; if (k < 1 && fxQ > 0.3) { g.globalAlpha = 1 - k; const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.5 * (0.4 + k)); gr.addColorStop(0, col); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, S, S); g.globalAlpha = 1; }
      drawParts(g, parts, now); drawPops(g, pops, now);
      counter(g, c, S, `${Math.min(res.length + 1, N)} / ${N} · rehber %${Math.round(guide / 0.8 * 100)}`);
      return res.length >= N && pops.length === 0;
    },
    down(x, y, now) { trail = [{ x, y, t: now }]; }, move(x, y, now) { trail.push({ x, y, t: now }); if (trail.length % 6 === 0) sfx("draw"); },
    up(now) {
      if (trail.length < 3 || res.length >= N) return; const q = runeScore(trail, id, ease); res.push(q); trail = []; fx = now; fxQ = q;
      if (q > 0.3) { sfx(id === "el_ates" ? "fire" : id === "el_su" ? "splash" : "spark"); burst(parts, S / 2, S / 2, 20, col, now, 4, 3); buzz(q > 0.8 ? "medium" : "light"); } else sfx("bad");
      pops.push({ text: q > 0.8 ? "Kusursuz işaret" : q > 0.5 ? "Tuttu" : q > 0.3 ? "Zayıf" : "Dağıldı", x: S / 2, y: S * 0.1, t: now, color: qColor(c, q > 0.8 ? 1 : q > 0.5 ? 0.7 : 0.2) });
    },
    score: () => res.reduce((a, b) => a + b, 0) / N,
  };
}

/* ---------- çizgi: modelin hattını izle, bitince boyanır ---------- */
function cizgi(S: number, c: Ink, ease: number): Game {
  const models: { name: string; pts: [number, number][] }[] = [
    { name: "Kurt", pts: WOLF_OUTLINE.slice(0, 18).map(([x, y]) => [x / 200, y / 130 * 0.65 + 0.1] as [number, number]) },
    { name: "Yaprak", pts: Array.from({ length: 25 }, (_, i) => { const a = i / 24 * TAU; return [0.5 + Math.sin(a) * 0.4 * Math.abs(Math.sin(a / 2)), 0.5 - Math.cos(a) * 0.4] as [number, number]; }) },
    { name: "Dağ", pts: [[0, 0.8], [0.18, 0.45], [0.3, 0.6], [0.5, 0.15], [0.68, 0.5], [0.8, 0.38], [1, 0.8]] },
  ];
  const N = 3; const tol = S * 0.05 * ease; const scores: number[] = []; let stroke: P[] = []; let started = 0; let drawing = false; const pops: Pop[] = []; let reveal = -1e9, revealQ = 0, revealM = 0;
  const curveOf = (m: number) => { const out: [number, number][] = []; const p = models[m].pts; for (let i = 0; i < p.length - 1; i++) for (let k = 0; k < 6; k++) out.push([S * (0.08 + (p[i][0] + (p[i + 1][0] - p[i][0]) * k / 6) * 0.84), S * (0.08 + (p[i][1] + (p[i + 1][1] - p[i][1]) * k / 6) * 0.84)]); out.push([S * (0.08 + p[p.length - 1][0] * 0.84), S * (0.08 + p[p.length - 1][1] * 0.84)]); return out; };
  let curve = curveOf(0);
  const judge = (now: number) => {
    if (stroke.length < 5) return;
    const md = (p: { x?: number; y?: number } | [number, number], set: ({ x: number; y: number } | [number, number])[]) => { const px = Array.isArray(p) ? p[0] : p.x!, py = Array.isArray(p) ? p[1] : p.y!; return set.reduce((m, q) => Math.min(m, Math.hypot(px - (Array.isArray(q) ? q[0] : q.x), py - (Array.isArray(q) ? q[1] : q.y))), Infinity); };
    const cov = curve.reduce((a, p) => a + clamp01(1 - md(p, stroke) / tol), 0) / curve.length;
    const pre = stroke.reduce((a, p) => a + clamp01(1 - md(p, curve) / (tol * 1.5)), 0) / stroke.length;
    const q = clamp01((cov * 0.7 + pre * 0.3) * 1.1); scores.push(q); feedback(q >= 0.85 ? 1 : q >= 0.6 ? 0.7 : 0.2);
    reveal = now; revealQ = q; revealM = scores.length - 1;
    pops.push({ text: q >= 0.85 ? "Kusursuz hat" : q >= 0.6 ? "Güzel" : "Titrek", x: S / 2, y: S * 0.08, t: now, color: qColor(c, q >= 0.85 ? 1 : q >= 0.6 ? 0.7 : 0.2) });
    sfx("page");
  };
  return {
    hint: "Nuri'nin modelini izle: kesik çizgiyi kırmızı noktadan başlayıp parmağını kaldırmadan çiz. İyi çizimler boyanır.",
    frame(now, g) {
      if (!started) started = now;
      const rk = (now - reveal) / 1200;
      if (rk < 1) {
        // boyanma: suluboya lekesi büyür
        const cv = curveOf(revealM); g.globalAlpha = 0.5 * Math.min(1, rk * 2) * revealQ; g.fillStyle = ["#8A7A62", "#7A9A5A", "#9AAAC0"][revealM % 3];
        g.beginPath(); cv.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.lineTo(cv[cv.length - 1][0], S * 0.95); g.lineTo(cv[0][0], S * 0.95); g.closePath(); g.fill(); g.globalAlpha = 1;
        g.strokeStyle = c.ink; g.lineWidth = 2.5; g.beginPath(); cv.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
        if (rk > 0.95 && scores.length < N && revealM === scores.length - 1) { curve = curveOf(scores.length); started = now; stroke = []; }
      } else if (scores.length < N) {
        g.setLineDash([5, 7]); g.strokeStyle = c.pencil; g.lineWidth = 2.2; g.beginPath(); curve.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); g.setLineDash([]);
        g.fillStyle = c.red; g.beginPath(); g.arc(curve[0][0], curve[0][1], 7, 0, TAU); g.fill();
        g.strokeStyle = c.ink; g.lineWidth = 2.6; g.lineCap = "round"; g.beginPath(); stroke.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.stroke();
        const left = Math.max(0, 10000 - (now - started)); if (left === 0 && !drawing) { scores.push(0); reveal = now; revealQ = 0; revealM = scores.length - 1; }
        counter(g, c, S, `${models[scores.length].name} · ${scores.length + 1} / ${N} · ${Math.ceil(left / 1000)} sn`);
      }
      drawPops(g, pops, now);
      return scores.length >= N && now - reveal > 1300;
    },
    down(x, y, now) { if ((now - reveal) / 1200 < 1) return; drawing = true; stroke = [{ x, y, t: now }]; },
    move(x, y, now) { if (!drawing) return; stroke.push({ x, y, t: now }); if (stroke.length % 5 === 0) sfx("draw"); },
    up(now) { if (!drawing) return; drawing = false; judge(now); },
    score: () => scores.reduce((a, b) => a + b, 0) / N,
  };
}

/* ---------- hafıza ve ezgi: sırayı tekrarla (taşlar ya da teller) ---------- */
function sequence(S: number, c: Ink, ease: number, strings: boolean): Game {
  const K = strings ? 5 : 4; const cols = [c.red, c.blue, c.green, "#B8862E", "#7A5A8A"];
  const seq: number[] = [0, 0, 0].map(() => Math.floor(rnd() * K));
  let mode: "show" | "input" | "end" = "show"; let showAt = 900; let idx = 0; let best = 0; let lit = -1; let litUntil = 0; let endAt = 0;
  const step = 560 * Math.min(1.6, ease); const pops: Pop[] = [];
  const cell = (i: number) => strings ? { x: S * 0.08, y: S * (0.14 + i * 0.15), w: S * 0.84, h: S * 0.1 } : (() => { const s = S * 0.36, gap = S * 0.06; return { x: S / 2 - s - gap / 2 + (i % 2) * (s + gap), y: S / 2 - s - gap / 2 + Math.floor(i / 2) * (s + gap), w: s, h: s }; })();
  const play = (i: number) => strings ? note(i) : sfx("tap");
  return {
    hint: strings ? "Hoca bir ezgi çalar. Dinle, sonra aynı tellere aynı sırayla dokun. Her doğru turda ezgi uzar." : "Taşlar sırayla yanar. Aynı sırayla dokun. Her doğru turda sıra bir uzar.",
    frame(now, g) {
      if (mode === "show") {
        const el = now - showAt; const k = Math.floor(el / step);
        if (el < 0) lit = -1;
        else if (k < seq.length) { const nl = el % step < step * 0.7 ? seq[k] : -1; if (nl !== -1 && lit !== nl) play(nl); lit = nl; }
        else { mode = "input"; idx = 0; lit = -1; }
      } else if (litUntil < now) lit = -1;
      for (let i = 0; i < K; i++) {
        const q = cell(i);
        if (strings) {
          const vib = lit === i ? Math.sin(now / 15) * 4 : 0; g.strokeStyle = lit === i ? cols[i] : c.ink; g.lineWidth = lit === i ? 4 : 2 + i * 0.4;
          g.beginPath(); g.moveTo(q.x, q.y + q.h / 2); g.quadraticCurveTo(q.x + q.w / 2, q.y + q.h / 2 + vib, q.x + q.w, q.y + q.h / 2); g.stroke();
          g.fillStyle = "#8A6A45"; g.fillRect(q.x - 6, q.y + q.h / 2 - 5, 8, 10); g.fillRect(q.x + q.w - 2, q.y + q.h / 2 - 5, 8, 10);
        } else {
          g.fillStyle = lit === i ? cols[i] : c.paper2; g.globalAlpha = lit === i ? 0.85 : 1; g.fillRect(q.x, q.y, q.w, q.h); g.globalAlpha = 1; g.strokeStyle = c.ink; g.lineWidth = 2; g.strokeRect(q.x, q.y, q.w, q.h);
          const cx = q.x + q.w / 2, cy = q.y + q.h / 2, r = q.w * 0.2; g.beginPath();
          if (i === 0) g.arc(cx, cy, r, 0, TAU); else if (i === 1) { g.moveTo(cx, cy - r); g.lineTo(cx + r, cy + r); g.lineTo(cx - r, cy + r); g.closePath(); } else if (i === 2) g.rect(cx - r, cy - r, r * 2, r * 2); else { g.moveTo(cx - r, cy - r); g.lineTo(cx + r, cy + r); g.moveTo(cx + r, cy - r); g.lineTo(cx - r, cy + r); }
          g.stroke();
        }
      }
      drawPops(g, pops, now);
      counter(g, c, S, mode === "show" ? (strings ? "Dinle…" : "İzle…") : mode === "input" ? `Sıra sende (${idx}/${seq.length})` : `En uzun: ${best}`);
      return mode === "end" && now > endAt;
    },
    down(x, y, now) {
      if (mode !== "input") return;
      const i = Array.from({ length: K }, (_, k) => k).find(k => { const q = cell(k); return x >= q.x && x <= q.x + q.w && y >= q.y - (strings ? 10 : 0) && y <= q.y + q.h + (strings ? 10 : 0); }); if (i === undefined) return;
      lit = i; litUntil = now + 240; play(i);
      if (i !== seq[idx]) { sfx("bad"); buzz("heavy"); pops.push({ text: "Yanlış", x: S / 2, y: S * 0.08, t: now, color: c.red }); mode = "end"; endAt = now + 900; return; }
      idx++;
      if (idx === seq.length) { best = seq.length; sfx("good"); pops.push({ text: "Doğru!", x: S / 2, y: S * 0.08, t: now, color: c.green }); if (seq.length >= 8) { mode = "end"; endAt = now + 700; return; } seq.push(Math.floor(rnd() * K)); mode = "show"; showAt = now + 800; }
    },
    score: () => clamp01((best - 2) / 6),
  };
}

const MAKERS: Record<MiniKind, (S: number, c: Ink, ease: number, o: MiniOpts) => Game> = {
  kosu, yuzme, odun, tirmanma, dans, ocak, mum, isaret, savustur, kesme, yay, cizgi,
  hafiza: (S, c, e) => sequence(S, c, e, false), ezgi: (S, c, e) => sequence(S, c, e, true),
};

/** Mini oyunu açar. Vazgeçilirse -1, oynandıysa 0–1 puan döner. */
export function playMini(kind: MiniKind, ease: number, title: string, boostNote: (score: number) => string, opts: MiniOpts = {}): Promise<number> {
  return new Promise(resolve => {
    seed = (Date.now() % 100000) + 7;
    const el = document.createElement("div"); el.className = "minigame"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Odak turu");
    document.body.appendChild(el);
    const cs = getComputedStyle(document.documentElement); const v = (n: string) => cs.getPropertyValue(n).trim();
    const ink: Ink = { ink: v("--ink"), soft: v("--ink-soft"), pencil: v("--pencil"), red: v("--red"), green: v("--green"), blue: v("--blue"), paper: v("--paper"), paper2: v("--paper-2"), wash: v("--wash") || "rgba(158,52,35,.18)" };
    const S = Math.floor(Math.min(window.innerWidth - 32, 400, window.innerHeight - 200));
    const game = MAKERS[kind](S, ink, ease, opts);
    let raf = 0;
    const finish = (score: number) => { cancelAnimationFrame(raf); el.remove(); resolve(score); };
    el.innerHTML = `<div class="mini-inner"><p class="hand muted" style="margin:0">Odak turu · ${MINI_NAMES[kind]}</p><h1>${title}</h1>
      <p class="mini-hint">${game.hint}</p>
      <div class="row" style="justify-content:center"><button class="btn primary" data-x="go">Başla</button><button class="btn" data-x="cancel">Vazgeç</button></div></div>`;
    el.addEventListener("click", e => {
      const x = (e.target as HTMLElement).closest<HTMLElement>("[data-x]")?.dataset.x;
      if (x === "cancel") finish(-1);
      if (x === "go") start();
      if (x === "ok") finish(Number(el.dataset.score));
    });
    function start() {
      sfx("page");
      el.innerHTML = `<div class="mini-inner"><p class="hand muted" style="margin:0">${MINI_NAMES[kind]}</p><canvas class="mini-canvas" style="width:${S}px;height:${S}px"></canvas><div class="mini-count hand"></div><p class="mini-hint tiny">${game.hint}</p></div>`;
      const cv = el.querySelector("canvas")!; const dpr = window.devicePixelRatio || 1;
      cv.width = S * dpr; cv.height = S * dpr; const g = cv.getContext("2d")!; g.scale(dpr, dpr);
      const count = el.querySelector<HTMLElement>(".mini-count")!;
      const t0 = performance.now() + 2400; // 3-2-1
      const pos = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
      cv.addEventListener("pointerdown", e => { const now = performance.now() - t0; if (now < 0) return; cv.setPointerCapture(e.pointerId); const [x, y] = pos(e); game.down?.(x, y, now); });
      cv.addEventListener("pointermove", e => { const now = performance.now() - t0; if (now < 0) return; const [x, y] = pos(e); game.move?.(x, y, now); });
      const up = () => { const now = performance.now() - t0; if (now >= 0) game.up?.(now); };
      cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
      let lastN = 4;
      const loop = () => {
        const now = performance.now() - t0;
        g.clearRect(0, 0, S, S);
        if (now < 0) { const n = Math.ceil(-now / 800); count.textContent = String(n); if (n !== lastN) { sfx("tap"); lastN = n; } raf = requestAnimationFrame(loop); return; }
        count.textContent = "";
        if (game.frame(now, g)) return result();
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    function result() {
      const sc = clamp01(game.score()); el.dataset.score = String(sc);
      const word = sc >= 0.85 ? "Kusursuz" : sc >= 0.6 ? "Çok iyi" : sc >= 0.35 ? "Fena değil" : "Dağınık";
      sfx(sc >= 0.6 ? "win" : "page"); if (sc >= 0.85) buzz("heavy");
      el.innerHTML = `<div class="mini-inner" style="text-align:center"><p class="hand muted" style="margin:0">Odak turu bitti</p>
        <div class="mini-score">%${Math.round(sc * 100)}</div><h2>${word}</h2>
        <p>${boostNote(sc)}</p>
        <div class="row" style="justify-content:center"><button class="btn primary" data-x="ok">Çalışmaya dön</button></div></div>`;
    }
  });
}
