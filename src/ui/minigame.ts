// Mini oyunlar: çalışma oturumunda "odak turu". Her biri ~20 saniye, sonuç 0–1.
// Kolaylık (ease) karakterin becerisinden gelir: pencere, tolerans ve daire boyları onunla büyür.
import { type MiniKind, MINI_NAMES, grade, rhythmScore } from "../engine/timing";
import { sfx, buzz } from "./feel";

interface Game {
  hint: string;
  frame(t: number, g: CanvasRenderingContext2D): boolean; // true: bitti
  down?(x: number, y: number, t: number): void;
  move?(x: number, y: number, t: number): void;
  up?(t: number): void;
  score(): number;
}
interface Ink { ink: string; soft: string; pencil: string; red: string; green: string; blue: string; paper: string; paper2: string; wash: string }
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
let seed = 1; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

/** Titrek mürekkep daire. */
function wob(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, k = 1.4, s = 1) {
  g.beginPath();
  for (let i = 0; i <= 40; i++) {
    const a = i / 40 * Math.PI * 2; const j = Math.sin(a * 5 + s) * k + Math.sin(a * 3 + s * 2) * k * 0.6;
    const x = cx + Math.cos(a) * (r + j), y = cy + Math.sin(a) * (r + j);
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.closePath();
}
/** Kısa süre yukarı süzülen not ("Tam an!"). */
interface Pop { text: string; x: number; y: number; t: number; color: string }
function drawPops(g: CanvasRenderingContext2D, pops: Pop[], t: number) {
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i]; const a = (t - p.t) / 700; if (a > 1) { pops.splice(i, 1); continue; }
    g.globalAlpha = 1 - a; g.fillStyle = p.color; g.font = "700 26px Caveat, cursive"; g.textAlign = "center";
    g.fillText(p.text, p.x, p.y - a * 30); g.globalAlpha = 1;
  }
}
function feedback(q: number) {
  if (q >= 1) { sfx("perfect"); buzz("medium"); } else if (q >= 0.6) { sfx("good"); buzz("light"); } else sfx("bad");
}
const qColor = (c: Ink, q: number) => q >= 1 ? c.green : q >= 0.6 ? c.blue : c.red;

/* ---------- ritim: adıma, küreğe, çekice uy ---------- */
function ritim(S: number, c: Ink, ease: number): Game {
  const beats: number[] = []; let t = 1200;
  for (let i = 0; i < 18; i++) { beats.push(t); t += 720 - i * 12; }
  const win = 90 * ease; const taps: number[] = []; const pops: Pop[] = []; let played = 0; let pulse = -1e9;
  return {
    hint: "Daire içteki halkaya oturduğu anda ekrana dokun. Tempo giderek hızlanır.",
    frame(now, g) {
      const cx = S / 2, cy = S / 2, R0 = S * 0.14;
      while (played < beats.length && now >= beats[played]) { sfx("beat"); played++; }
      g.strokeStyle = c.ink; g.lineWidth = 2.5; wob(g, cx, cy, R0, 1.2, 1); g.stroke();
      const pk = Math.max(0, 1 - (now - pulse) / 250);
      if (pk > 0) { g.fillStyle = c.wash; wob(g, cx, cy, R0 * (1 + pk * 0.15), 1, 2); g.fill(); }
      for (const b of beats) {
        const lead = (b - now) / 1100; if (lead < -0.05 || lead > 1) continue;
        g.strokeStyle = c.soft; g.lineWidth = 1.8; g.globalAlpha = 1 - Math.max(0, lead) * 0.6;
        wob(g, cx, cy, R0 + Math.max(0, lead) * S * 0.3, 1.6, b); g.stroke(); g.globalAlpha = 1;
      }
      g.fillStyle = c.soft; g.font = "18px Alegreya, serif"; g.textAlign = "center";
      g.fillText(`${Math.min(played, beats.length)} / ${beats.length}`, cx, S - 16);
      drawPops(g, pops, now);
      return now > beats[beats.length - 1] + 700;
    },
    down(_x, _y, now) {
      taps.push(now); pulse = now;
      let bd = Infinity, off = 0; for (const b of beats) { const d = now - b; if (Math.abs(d) < bd) { bd = Math.abs(d); off = d; } }
      const gr = grade(off, win); feedback(gr.q); sfx("step");
      pops.push({ text: gr.label, x: S / 2, y: S * 0.28, t: now, color: qColor(c, gr.q) });
    },
    score: () => rhythmScore(beats, taps, win),
  };
}

/* ---------- nefes: daire büyürken basılı tut, küçülürken bırak ---------- */
function nefes(S: number, c: Ink, ease: number): Game {
  const P = 5200, cycles = 4, grace = 220 * ease; let pressed = false; let good = 0, total = 0, last = 0;
  return {
    hint: "Daire büyürken parmağını basılı tut (nefes al), küçülürken bırak (nefes ver).",
    frame(now, g) {
      const dt = last ? now - last : 0; last = now;
      const ph = (now % P) / P; const inhale = ph < 0.5; const k = inhale ? ph * 2 : 2 - ph * 2;
      const e = 0.5 - Math.cos(k * Math.PI) / 2; const cx = S / 2, cy = S / 2;
      const r = S * (0.12 + e * 0.24);
      const nearEdge = Math.min(now % (P / 2), P / 2 - (now % (P / 2))) < grace;
      if (now < P * cycles) { total += dt; if (pressed === inhale || nearEdge) good += dt; }
      g.fillStyle = c.wash; wob(g, cx, cy, r, 2, 3); g.fill();
      g.strokeStyle = c.ink; g.lineWidth = 2; wob(g, cx, cy, r, 2, 3); g.stroke();
      if (pressed) { g.strokeStyle = c.blue; g.lineWidth = 4; wob(g, cx, cy, r + 8, 1, 7); g.stroke(); }
      g.fillStyle = pressed === inhale ? c.green : c.red; g.font = "700 30px Caveat, cursive"; g.textAlign = "center";
      g.fillText(inhale ? "Nefes al" : "Ver", cx, cy + 10);
      g.fillStyle = c.soft; g.font = "18px Alegreya, serif"; g.fillText(`${Math.min(cycles, Math.floor(now / P) + 1)} / ${cycles}`, cx, S - 16);
      return now >= P * cycles;
    },
    down() { pressed = true; buzz("light"); }, up() { pressed = false; },
    score: () => clamp01((good / Math.max(1, total) - 0.55) / 0.4),
  };
}

/* ---------- kıvılcım: kaçan kıvılcımı avucunun içinde tut ---------- */
function kivilcim(S: number, c: Ink, ease: number): Game {
  const D = 20000; let px = S / 2, py = S / 2; let x = S / 2, y = S / 2, vx = 0, vy = 0; let inside = 0, total = 0, last = 0, lastSpark = 0;
  const rp = S * 0.1 * ease;
  return {
    hint: "Parmağınla avucunu (halka) sürükle; titreyen kıvılcım hep avucunun içinde kalsın.",
    frame(now, g) {
      const dt = last ? Math.min(50, now - last) : 0; last = now; const hard = 1 + now / D;
      vx += (rnd() - 0.5) * 0.06 * hard * dt; vy += (rnd() - 0.5) * 0.06 * hard * dt;
      if (rnd() < 0.004 * hard) { vx += (rnd() - 0.5) * 9; vy += (rnd() - 0.5) * 9; }
      vx *= 0.96; vy *= 0.96; x += vx * dt / 16; y += vy * dt / 16;
      if (x < 20 || x > S - 20) vx = -vx; if (y < 20 || y > S - 20) vy = -vy;
      x = Math.max(20, Math.min(S - 20, x)); y = Math.max(20, Math.min(S - 20, y));
      const inn = Math.hypot(x - px, y - py) < rp;
      total += dt; if (inn) { inside += dt; if (now - lastSpark > 400) { sfx("spark"); lastSpark = now; } }
      g.strokeStyle = inn ? c.green : c.ink; g.lineWidth = 2.2; wob(g, px, py, rp, 0.8, 5); g.stroke();
      const fl = 6 + Math.sin(now / 40) * 2 + rnd() * 2;
      const grd = g.createRadialGradient(x, y, 0, x, y, fl * 3); grd.addColorStop(0, "rgba(255,210,120,.95)"); grd.addColorStop(0.4, "rgba(230,120,40,.7)"); grd.addColorStop(1, "rgba(200,60,20,0)");
      g.fillStyle = grd; g.beginPath(); g.arc(x, y, fl * 3, 0, Math.PI * 2); g.fill();
      g.fillStyle = c.soft; g.font = "18px Alegreya, serif"; g.textAlign = "center"; g.fillText(`${Math.max(0, Math.ceil((D - now) / 1000))} sn`, S / 2, S - 16);
      return now >= D;
    },
    down(mx, my) { px = mx; py = my; }, move(mx, my) { px = mx; py = my; },
    score: () => clamp01((inside / Math.max(1, total) - 0.15) / 0.7),
  };
}

/* ---------- savuştur: hocanın darbesi gelirken doğru anda karşıla; aldatmacaya kanma ---------- */
function savustur(S: number, c: Ink, ease: number): Game {
  interface Strike { at: number; dur: number; feint: boolean; q?: number; label?: string }
  const strikes: Strike[] = []; let t = 900;
  for (let i = 0; i < 9; i++) { const dur = 950 - i * 35; strikes.push({ at: t, dur, feint: i > 1 && rnd() < 0.25 }); t += dur + 600 + rnd() * 700; }
  const win = 0.12 * ease; const pops: Pop[] = [];
  const cur = (now: number) => strikes.find(s => s.q === undefined && now >= s.at && now <= s.at + s.dur * 1.35);
  return {
    hint: "Halka ortadaki daireye kapanınca dokun. Kırmızı halka aldatmacadır: dokunma!",
    frame(now, g) {
      const cx = S / 2, cy = S / 2, R0 = S * 0.12;
      g.strokeStyle = c.ink; g.lineWidth = 2.5; wob(g, cx, cy, R0, 1.2, 4); g.stroke();
      for (const s of strikes) {
        if (s.q !== undefined || now < s.at) continue;
        const p = (now - s.at) / s.dur;
        if (s.feint && p > 0.6) { s.q = 1; s.label = "Kanmadın"; pops.push({ text: "Kanmadın", x: cx, y: S * 0.22, t: now, color: c.green }); continue; }
        if (p > 1.35) { s.q = 0; pops.push({ text: "Kaçırdın", x: cx, y: S * 0.22, t: now, color: c.red }); sfx("hurt"); buzz("medium"); continue; }
        const r = R0 + (1 - Math.min(1, p)) * S * 0.32;
        g.strokeStyle = s.feint ? c.red : c.blue; g.lineWidth = 3; wob(g, cx, cy, r, 2, s.at); g.stroke();
      }
      const done = strikes.filter(s => s.q !== undefined).length;
      g.fillStyle = c.soft; g.font = "18px Alegreya, serif"; g.textAlign = "center"; g.fillText(`${done} / ${strikes.length}`, cx, S - 16);
      drawPops(g, pops, now);
      return done === strikes.length && pops.length === 0;
    },
    down(_x, _y, now) {
      const s = cur(now); if (!s) { sfx("whoosh"); return; }
      if (s.feint) { s.q = 0; pops.push({ text: "Aldandın!", x: S / 2, y: S * 0.22, t: now, color: c.red }); sfx("bad"); buzz("medium"); return; }
      const gr = grade((now - (s.at + s.dur)) / s.dur, win); s.q = gr.q;
      feedback(gr.q); sfx(gr.q > 0 ? "hit" : "miss");
      pops.push({ text: gr.label, x: S / 2, y: S * 0.22, t: now, color: qColor(c, gr.q) });
    },
    score: () => strikes.reduce((a, s) => a + (s.q ?? 0), 0) / strikes.length,
  };
}

/* ---------- nişan: sallanan nişangâhı rüzgârı hesaba katarak bırak ---------- */
function nisan(S: number, c: Ink, ease: number): Game {
  const shots = 5; const res: { x: number; y: number; q: number }[] = []; let wind = 0; let ready = 600; const pops: Pop[] = [];
  const newWind = () => { wind = (rnd() - 0.5) * 2 * S * 0.13; };
  newWind();
  let rx = S / 2, ry = S / 2;
  return {
    hint: "Nişangâh kendi kendine sallanır. Ok rüzgârla kayar: rüzgârın tersine nişan alıp dokun.",
    frame(now, g) {
      const cx = S / 2, cy = S / 2; const A = S * 0.2 / ease;
      for (const [r, col] of [[0.3, c.paper2], [0.2, c.wash], [0.1, c.paper2]] as [number, string][]) { g.fillStyle = col; wob(g, cx, cy, S * r, 1.5, r * 10); g.fill(); g.strokeStyle = c.ink; g.lineWidth = 1.5; g.stroke(); }
      g.fillStyle = c.red; g.beginPath(); g.arc(cx, cy, 4, 0, 7); g.fill();
      for (const h of res) { g.strokeStyle = c.ink; g.lineWidth = 2; g.beginPath(); g.moveTo(h.x - 6, h.y - 6); g.lineTo(h.x + 6, h.y + 6); g.moveTo(h.x + 6, h.y - 6); g.lineTo(h.x - 6, h.y + 6); g.stroke(); }
      // rüzgâr oku
      g.strokeStyle = c.blue; g.lineWidth = 2.5; const wy = 28, wl = wind / (S * 0.13) * 60;
      g.beginPath(); g.moveTo(cx - wl / 2, wy); g.lineTo(cx + wl / 2, wy); g.lineTo(cx + wl / 2 - Math.sign(wl) * 8, wy - 6); g.moveTo(cx + wl / 2, wy); g.lineTo(cx + wl / 2 - Math.sign(wl) * 8, wy + 6); g.stroke();
      g.fillStyle = c.blue; g.font = "18px Caveat, cursive"; g.textAlign = "center"; g.fillText("rüzgâr", cx, wy + 22);
      if (res.length < shots) {
        const tt = now / 1000; rx = cx + A * Math.sin(tt * 1.3 + res.length) + A * 0.3 * Math.sin(tt * 3.1); ry = cy + A * 0.8 * Math.sin(tt * 1.7 + 2) + A * 0.2 * Math.sin(tt * 2.6);
        g.globalAlpha = now < ready ? 0.3 : 1; g.strokeStyle = c.ink; g.lineWidth = 1.8; wob(g, rx, ry, 14, 0.6, 2); g.stroke();
        g.beginPath(); g.moveTo(rx - 22, ry); g.lineTo(rx + 22, ry); g.moveTo(rx, ry - 22); g.lineTo(rx, ry + 22); g.stroke(); g.globalAlpha = 1;
      }
      g.fillStyle = c.soft; g.font = "18px Alegreya, serif"; g.fillText(`${res.length} / ${shots}`, cx, S - 16);
      drawPops(g, pops, now);
      return res.length >= shots && pops.length === 0;
    },
    down(_x, _y, now) {
      if (now < ready || res.length >= shots) return;
      const hx = rx + wind, hy = ry; const d = Math.hypot(hx - S / 2, hy - S / 2);
      const q = clamp01(1 - d / (S * 0.3)); res.push({ x: hx, y: hy, q }); ready = now + 900; newWind();
      sfx("whoosh"); setTimeout(() => sfx(q > 0 ? "hit" : "miss"), 180); if (q > 0.85) buzz("medium");
      pops.push({ text: q > 0.85 ? "On ikiden!" : q > 0.55 ? "İyi atış" : q > 0 ? "Kenara" : "Iska", x: S / 2, y: S * 0.84, t: now, color: qColor(c, q > 0.85 ? 1 : q > 0.55 ? 0.7 : 0.2) });
    },
    score: () => clamp01(res.reduce((a, r) => a + r.q, 0) / shots * 1.15),
  };
}

/* ---------- çizgi: modelin hattını parmakla izle ---------- */
function cizgi(S: number, c: Ink, ease: number): Game {
  const make = () => {
    const ctrl: [number, number][] = []; for (let i = 0; i < 5; i++) ctrl.push([S * (0.12 + i * 0.19), S * (0.25 + rnd() * 0.5)]);
    const pts: [number, number][] = [];
    for (let i = 0; i < ctrl.length - 1; i++) {
      const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
      for (let k = 0; k < 15; k++) { const u = k / 15, u2 = u * u, u3 = u2 * u;
        pts.push([0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * u + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * u2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * u3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * u + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3)]); }
    }
    pts.push(ctrl[ctrl.length - 1]); return pts;
  };
  const N = 3, tol = S * 0.05 * ease; let curve = make(); let stroke: [number, number][] = []; const scores: number[] = []; let started = 0; let lastDraw = 0; const pops: Pop[] = []; let drawing = false;
  const judge = (now: number) => {
    if (stroke.length < 5) return;
    const md = (p: [number, number], set: [number, number][]) => set.reduce((m, q) => Math.min(m, Math.hypot(p[0] - q[0], p[1] - q[1])), Infinity);
    const cov = curve.reduce((a, p) => a + clamp01(1 - md(p, stroke) / tol), 0) / curve.length;
    const pre = stroke.reduce((a, p) => a + clamp01(1 - md(p, curve) / (tol * 1.5)), 0) / stroke.length;
    const q = clamp01((cov * 0.7 + pre * 0.3) * 1.1); scores.push(q); feedback(q >= 0.85 ? 1 : q >= 0.6 ? 0.7 : 0.2);
    pops.push({ text: q >= 0.85 ? "Kusursuz hat" : q >= 0.6 ? "Güzel" : "Titrek", x: S / 2, y: S * 0.12, t: now, color: qColor(c, q >= 0.85 ? 1 : q >= 0.6 ? 0.7 : 0.2) });
    stroke = []; curve = make(); started = now; sfx("page");
  };
  return {
    hint: "Kesik çizgiyi soldaki noktadan başlayıp parmağını kaldırmadan izle. Üç çizim var.",
    frame(now, g) {
      if (!started) started = now;
      if (scores.length < N) {
        g.setLineDash([5, 7]); g.strokeStyle = c.pencil; g.lineWidth = 2.2; g.beginPath(); curve.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); g.setLineDash([]);
        g.fillStyle = c.red; g.beginPath(); g.arc(curve[0][0], curve[0][1], 7, 0, 7); g.fill();
        g.strokeStyle = c.ink; g.lineWidth = 2.6; g.lineCap = "round"; g.beginPath(); stroke.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
        const left = Math.max(0, 9000 - (now - started)); if (left === 0 && !drawing) { scores.push(0); stroke = []; curve = make(); started = now; }
        g.fillStyle = c.soft; g.font = "18px Alegreya, serif"; g.textAlign = "center"; g.fillText(`${scores.length + 1} / ${N} · ${Math.ceil(left / 1000)} sn`, S / 2, S - 16);
      }
      drawPops(g, pops, now);
      return scores.length >= N && pops.length === 0;
    },
    down(x, y) { drawing = true; stroke = [[x, y]]; },
    move(x, y, now) { if (!drawing) return; stroke.push([x, y]); if (now - lastDraw > 90) { sfx("draw"); lastDraw = now; } },
    up(now) { drawing = false; judge(now); },
    score: () => scores.reduce((a, b) => a + b, 0) / N,
  };
}

/* ---------- hafıza: yanıp sönen sırayı tekrarla ---------- */
function hafiza(S: number, c: Ink, ease: number): Game {
  const cols = [c.red, c.blue, c.green, "#B8862E"]; const seq: number[] = [0, 0, 0].map(() => Math.floor(rnd() * 4));
  let mode: "show" | "input" | "end" = "show"; let showAt = 700; let idx = 0; let best = 0; let lit = -1; let litUntil = 0; let endAt = 0;
  const step = 560 * Math.min(1.6, ease);
  const cell = (i: number) => { const s = S * 0.36, gap = S * 0.06; return { x: S / 2 - s - gap / 2 + (i % 2) * (s + gap), y: S / 2 - s - gap / 2 + Math.floor(i / 2) * (s + gap), s }; };
  const glyph = (g: CanvasRenderingContext2D, i: number, x: number, y: number, s: number) => {
    g.strokeStyle = c.ink; g.lineWidth = 2.4; g.beginPath(); const cx = x + s / 2, cy = y + s / 2, r = s * 0.2;
    if (i === 0) { g.arc(cx, cy, r, 0, 7); } else if (i === 1) { g.moveTo(cx, cy - r); g.lineTo(cx + r, cy + r); g.lineTo(cx - r, cy + r); g.closePath(); }
    else if (i === 2) { g.rect(cx - r, cy - r, r * 2, r * 2); } else { g.moveTo(cx - r, cy - r); g.lineTo(cx + r, cy + r); g.moveTo(cx + r, cy - r); g.lineTo(cx - r, cy + r); }
    g.stroke();
  };
  return {
    hint: "Kareler sırayla yanar. Aynı sırayla dokun. Her doğru turda sıra bir uzar.",
    frame(now, g) {
      if (mode === "show") {
        const el = now - showAt; const k = Math.floor(el / step);
        if (el < 0) lit = -1;
        else if (k < seq.length) { const nl = el % step < step * 0.7 ? seq[k] : -1; if (nl !== -1 && lit !== nl) sfx("tap"); lit = nl; }
        else { mode = "input"; idx = 0; lit = -1; }
      } else if (litUntil < now) lit = -1;
      for (let i = 0; i < 4; i++) {
        const { x, y, s } = cell(i); g.fillStyle = lit === i ? cols[i] : c.paper2;
        g.globalAlpha = lit === i ? 0.85 : 1; g.fillRect(x, y, s, s); g.globalAlpha = 1; g.strokeStyle = c.ink; g.lineWidth = 2; g.strokeRect(x, y, s, s); glyph(g, i, x, y, s);
      }
      g.fillStyle = c.soft; g.font = "18px Alegreya, serif"; g.textAlign = "center";
      g.fillText(mode === "show" ? "İzle…" : mode === "input" ? `Sıra sende (${idx}/${seq.length})` : "Bitti", S / 2, S - 12);
      return mode === "end" && now > endAt;
    },
    down(x, y, now) {
      if (mode !== "input") return;
      const i = [0, 1, 2, 3].find(k => { const q = cell(k); return x >= q.x && x <= q.x + q.s && y >= q.y && y <= q.y + q.s; }); if (i === undefined) return;
      lit = i; litUntil = now + 220;
      if (i !== seq[idx]) { sfx("bad"); buzz("heavy"); mode = "end"; endAt = now + 900; return; }
      sfx("tap"); idx++;
      if (idx === seq.length) { best = seq.length; sfx("good"); if (seq.length >= 8) { mode = "end"; endAt = now + 700; return; } seq.push(Math.floor(rnd() * 4)); mode = "show"; showAt = now + 700; }
    },
    score: () => clamp01((best - 2) / 6),
  };
}

const MAKERS: Record<MiniKind, (S: number, c: Ink, ease: number) => Game> = { ritim, nefes, kivilcim, savustur, nisan, cizgi, hafiza };

/** Mini oyunu açar. Vazgeçilirse -1, oynandıysa 0–1 puan döner. */
export function playMini(kind: MiniKind, ease: number, title: string, boostNote: (score: number) => string): Promise<number> {
  return new Promise(resolve => {
    seed = (Date.now() % 100000) + 7;
    const el = document.createElement("div"); el.className = "minigame"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Odak turu");
    document.body.appendChild(el);
    const cs = getComputedStyle(document.documentElement); const v = (n: string) => cs.getPropertyValue(n).trim();
    const ink: Ink = { ink: v("--ink"), soft: v("--ink-soft"), pencil: v("--pencil"), red: v("--red"), green: v("--green"), blue: v("--blue"), paper: v("--paper"), paper2: v("--paper-2"), wash: v("--wash") || "rgba(158,52,35,.18)" };
    const S = Math.min(window.innerWidth - 32, 380, window.innerHeight - 260);
    const game = MAKERS[kind](S, ink, ease);
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
      el.innerHTML = `<div class="mini-inner"><p class="mini-hint">${game.hint}</p><canvas class="mini-canvas" style="width:${S}px;height:${S}px"></canvas><div class="mini-count hand"></div></div>`;
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
