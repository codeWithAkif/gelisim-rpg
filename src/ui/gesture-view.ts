// Savaşta parmak hareketleri: kurdun üstünden kesik çekmek, atılan kurttan kaçmak,
// büyünün işaretini çizmek, kurdu sürükleyip itmek. Hepsi kısa bir katmanda oynanır, 0–1 kalite döner.
import { slashScore, dirScore, swipeOf, runeScore, RUNES, type P } from "../engine/gesture";
import { wolfSketch, esc, WOLF_OUTLINE } from "./sketch";
import { artUrl } from "./art";
import { sfx, buzz } from "./feel";
import { ENEMIES } from "../content/world";

const TAU = Math.PI * 2;

interface Layer { el: HTMLElement; box: HTMLElement; cv: HTMLCanvasElement; g: CanvasRenderingContext2D; W: number; H: number; ink: string; red: string; blue: string; green: string; close: (ms?: number) => Promise<void> }
function layer(host: HTMLElement, cls: string, title: string, W: number, H: number, bg = ""): Layer {
  const el = document.createElement("div"); el.className = "qt gx " + cls;
  el.innerHTML = `<div class="qt-box gx-box"><div class="qt-label hand">${title}</div><div class="gx-stage" style="width:${W}px;height:${H}px">${bg}<canvas></canvas></div><div class="qt-result hand"></div></div>`;
  host.appendChild(el);
  const cv = el.querySelector("canvas")!; const dpr = window.devicePixelRatio || 1;
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px";
  const g = cv.getContext("2d")!; g.scale(dpr, dpr);
  const cs = getComputedStyle(document.documentElement); const v = (n: string) => cs.getPropertyValue(n).trim();
  return { el, box: el.querySelector(".gx-stage")!, cv, g, W, H, ink: v("--ink"), red: v("--red"), blue: v("--blue"), green: v("--green"),
    close: (ms = 560) => new Promise(r => setTimeout(() => { el.remove(); r(); }, ms)) };
}
function result(L: Layer, q: number, text: string) {
  const r = L.el.querySelector<HTMLElement>(".qt-result")!; r.textContent = text; r.dataset.q = q >= 0.95 ? "1" : q >= 0.55 ? "g" : "0";
  if (q >= 0.95) { sfx("perfect"); buzz("medium"); } else if (q >= 0.55) sfx("good"); else sfx("bad");
}
/** Parmak izini mürekkep gibi çizer (hızlı yerde ince, yavaşta kalın). */
function inkTrail(g: CanvasRenderingContext2D, pts: P[], color: string, alpha = 1) {
  g.save(); g.globalAlpha = alpha; g.strokeStyle = color; g.lineCap = "round"; g.lineJoin = "round";
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]; const sp = Math.hypot(b.x - a.x, b.y - a.y) / Math.max(1, b.t - a.t);
    g.lineWidth = Math.max(2, 7 - sp * 3); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
  }
  g.restore();
}
function track(cv: HTMLCanvasElement, onMove: (pts: P[]) => void, onEnd: (pts: P[]) => void) {
  let pts: P[] | null = null;
  const pos = (e: PointerEvent): P => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }; };
  cv.addEventListener("pointerdown", e => { e.preventDefault(); cv.setPointerCapture(e.pointerId); pts = [pos(e)]; onMove(pts); });
  cv.addEventListener("pointermove", e => { if (!pts) return; pts.push(pos(e)); onMove(pts); });
  const up = () => { if (!pts) return; const p = pts; pts = null; onEnd(p); };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
}
/** Sahne boyu: savaş alanına sığsın (yükseklik/genişlik oranı r). */
const stageSize = (host: HTMLElement, r: number): [number, number] => {
  const W = Math.max(220, Math.min(340, host.clientWidth - 40, (host.clientHeight - 100) / r));
  return [Math.round(W), Math.round(W * r)];
};
/** Kurdu kanvasa çizer (sola bakar, merkez 0,0, genişlik w). */
function drawWolf(g: CanvasRenderingContext2D, w: number, ink: string) {
  const k = w / 200; g.beginPath();
  WOLF_OUTLINE.forEach(([x, y], i) => { const px = (x - 100) * k, py = (y - 80) * k; i ? g.lineTo(px, py) : g.moveTo(px, py); });
  g.closePath(); g.fillStyle = "#5E5850"; g.fill(); g.strokeStyle = ink; g.lineWidth = 1.5; g.stroke();
  g.fillStyle = "#E9DFC9"; g.beginPath(); g.arc((36 - 100) * k, (50 - 80) * k, 1.8, 0, 7); g.fill();
}
/** Kurdun resmi: görsel varsa o, yoksa eskiz. Sola bakar; zayıf noktalar 0–1 kutu koordinatında. */
/** Düşmanın görseli: kendi görseli (dusman_<tür>), insanlar için kahraman pozunun boyanmış hâli, yoksa kurt. */
export interface FoeArt { url?: string; attack?: string; aspect: number; filter: string; human: boolean; name: string }
export function foeArt(foe = "kurt"): FoeArt {
  const d = ENEMIES[foe] ?? ENEMIES.kurt; const human = d.species === "insan";
  const own = artUrl("dusman_" + foe);
  if (human) return { url: own ?? artUrl("poz_kahraman_durus"), attack: own ?? artUrl("poz_kahraman_vurus"), aspect: own ? 1.4 : 373 / 172, filter: own ? "none" : d.tint ?? "none", human, name: d.name };
  return { url: artUrl("dusman_kurt"), attack: artUrl("poz_kurt_atilma"), aspect: 393 / 640, filter: d.tint ?? "none", human, name: d.name };
}
/** Görseli W×H kutuya sığdırınca kapladığı dikdörtgen. */
const fitRect = (W: number, H: number, aspect: number) => { const w = Math.min(W, H / aspect), h = w * aspect; return { x: (W - w) / 2, y: (H - h) / 2, w, h }; };
function foePicHtml(W: number, H: number, detail: number, art: FoeArt, aimAt?: [number, number]): string {
  const img = art.url ? `<img src="${art.url}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;filter:${art.filter}">` : `<div style="position:absolute;inset:0">${wolfSketch({ detail, marks: [], width: W, labels: false })}</div>`;
  const target = aimAt ? `<div class="gx-aim" style="left:${aimAt[0] * W}px;top:${aimAt[1] * H}px"></div>` : "";
  return `<div class="gx-wolf" style="position:absolute;inset:0">${img + target}</div>`;
}

export function slashPrompt(host: HTMLElement, o: { foe?: string; aimName?: string; aimAt?: [number, number]; aimArtAt?: [number, number]; detail: number; ease: number }): Promise<number> {
  return new Promise(resolve => {
    const [W, H] = stageSize(host, 0.65);
    // görsel varsa zayıf nokta görseldeki yerine taşınır (görsel kutuya sığdırılır, ortalanır)
    const art = foeArt(o.foe); const R = fitRect(W, H, art.aspect);
    const toStage = (p: [number, number]): [number, number] => [(R.x + p[0] * R.w) / W, (R.y + p[1] * R.h) / H];
    const aim: [number, number] | undefined = art.url && o.aimArtAt ? toStage(o.aimArtAt) : o.aimAt;
    o = { ...o, aimAt: aim };
    const L = layer(host, "slash", o.aimName ? `Kes! ${esc(o.aimName)} hedefinden geçir` : `${esc(art.name)}: üstünden kes!`, W, H, foePicHtml(W, H, o.detail, art, o.aimAt));
    // gövde: kurt yatay, insan dikey
    const bodyPts: [number, number][] = art.human ? [[0.5, 0.25], [0.5, 0.45], [0.5, 0.65], [0.5, 0.85]] : [[0.22, 0.45], [0.42, 0.5], [0.62, 0.5], [0.82, 0.48]];
    const body0 = bodyPts.map(p => { const [x, y] = art.human && art.url ? toStage(p) : p; return { x: x * W, y: y * H, r: (art.human ? R.w * 0.3 : W * 0.11) }; });
    // hassas nokta küçük; kurt da yerinde durmuyor (çevikliği, senin refleksine karşı)
    const weak0 = o.aimAt ? { x: o.aimAt[0] * W, y: o.aimAt[1] * H, r: W * 0.042 } : undefined;
    const wolfEl = L.box.querySelector<HTMLElement>(".gx-wolf"); let ox = 0, oy = 0;
    const sway = () => { if (done) return; const tt = (performance.now() - t0) / 1000; ox = Math.sin(tt * 2.3) * W * 0.07 / o.ease; oy = Math.sin(tt * 3.7 + 1) * H * 0.04 / o.ease; if (wolfEl) wolfEl.style.transform = `translate(${ox}px,${oy}px)`; requestAnimationFrame(sway); };
    const shift = <T extends { x: number; y: number }>(c: T): T => ({ ...c, x: c.x + ox, y: c.y + oy });
    let done = false; const t0 = performance.now(); const LIMIT = 2600;
    requestAnimationFrame(() => sway());
    const timer = setInterval(() => { if (!done && performance.now() - t0 > LIMIT) finish([], "Geç kaldın"); }, 100);
    const bar = document.createElement("div"); bar.className = "gx-bar"; L.box.after(bar);
    const tick = () => { if (done) return; bar.style.width = `${Math.max(0, 100 - (performance.now() - t0) / LIMIT * 100)}%`; requestAnimationFrame(tick); }; tick();
    const finish = (pts: P[], label?: string) => {
      if (done) return; done = true; clearInterval(timer);
      const r = pts.length ? slashScore(pts, body0.map(shift), weak0 && shift(weak0), o.ease) : { q: 0, weak: false };
      L.g.clearRect(0, 0, W, H); if (pts.length) inkTrail(L.g, pts, r.q > 0 ? L.red : L.ink);
      if (r.q > 0) { sfx(r.weak || r.q >= 0.95 ? "crit" : "hit"); buzz(r.weak ? "heavy" : "light"); L.el.classList.add("hit"); } else sfx("miss");
      result(L, r.q, label ?? (r.weak ? "Tam isabet!" : r.q >= 0.75 ? "Temiz kesik" : r.q > 0 ? "Sıyırdı" : "Iska"));
      void L.close(650).then(() => resolve(r.weak ? 1.25 : r.q));
    };
    track(L.cv, pts => { L.g.clearRect(0, 0, W, H); inkTrail(L.g, pts, L.ink, 0.85); if (pts.length % 4 === 0) sfx("draw"); }, pts => finish(pts));
  });
}

/* ---------- savunma: atılan kurttan kaç ---------- */
/** from: kurdun oyuncuya göre geldiği yön (derece, ekran). */
export function dodgePrompt(host: HTMLElement, o: { foe?: string; from: number; ease: number }): Promise<number> {
  return new Promise(resolve => {
    const [W, H] = stageSize(host, 0.8);
    const art = foeArt(o.foe);
    const L = layer(host, "dodge", `${esc(art.name)} ${art.human ? "saldırıyor" : "atılıyor"}! Kenara kaç`, W, H);
    const cx = W / 2, cy = H / 2; const a = o.from * Math.PI / 180;
    const sx = cx + Math.cos(a) * W * 0.46, sy = cy + Math.sin(a) * H * 0.46;
    const lead = 350 + Math.random() * 350, dur = 900 + Math.random() * 300; const t0 = performance.now();
    const away = (o.from + 180) % 360; let done = false; let trail: P[] = [];
    const img = art.attack ?? art.url ? Object.assign(new Image(), { src: (art.attack ?? art.url)! }) : null;
    const draw = () => {
      if (done) return; const now = performance.now() - t0; const p = Math.max(0, Math.min(1.2, (now - lead) / dur));
      const g = L.g; g.clearRect(0, 0, W, H);
      // oyuncu
      g.fillStyle = L.blue; g.beginPath(); g.arc(cx, cy, 9, 0, 7); g.fill();
      // kurt: çömelir, sonra yay çizerek atılır
      const e = p * p; const wx = sx + (cx - sx) * e, wy = sy + (cy - sy) * e - Math.sin(Math.min(1, p) * Math.PI) * H * 0.12;
      const sc = 0.7 + e * 0.6; const shake = p === 0 ? Math.sin(now / 30) * 2 : 0;
      // kurt oyuncuya bakar: görseller sola bakar, sağdan geliyorsa olduğu gibi
      g.save(); g.translate(wx + shake, wy); g.scale((Math.cos(a) > 0 ? 1 : -1) * sc, sc); if (p > 0) g.rotate(-0.25);
      if (img?.complete && img.naturalWidth) { g.filter = art.filter; const w = art.human ? 52 : 96, h = w * img.naturalHeight / img.naturalWidth; g.drawImage(img, -w / 2, art.human ? -h * 0.7 : -30, w, h); g.filter = "none"; } else drawWolf(g, 90, L.ink);
      g.restore();
      if (p > 0) { g.strokeStyle = L.red; g.globalAlpha = 0.35; g.setLineDash([4, 6]); g.beginPath(); g.moveTo(sx, sy); g.lineTo(cx, cy); g.stroke(); g.setLineDash([]); g.globalAlpha = 1; }
      if (trail.length) inkTrail(g, trail, L.blue, 0.8);
      if (p >= 1.1) return finish([], "Isırdı");
      requestAnimationFrame(draw);
    };
    const finish = (pts: P[], label?: string) => {
      if (done) return; done = true;
      let q = 0;
      if (pts.length) {
        const now = pts[pts.length - 1].t - t0; const p = (now - lead) / dur;
        const sw = swipeOf(pts);
        const dir = Math.max(dirScore(sw, away, 45 * o.ease, 35), dirScore(sw, away + 90, 40 * o.ease, 35) * 0.85, dirScore(sw, away - 90, 40 * o.ease, 35) * 0.85);
        const timing = p < 0.2 ? 0 : p < 0.5 ? 0.5 : p <= 1.02 ? 1 : 0;
        q = dir * timing;
        label = timing === 0 ? (p < 0.2 ? "Erken davrandın" : "Geç kaldın") : dir === 0 ? "Yanlış yöne" : q >= 0.95 ? "Tam kaçış!" : q >= 0.55 ? "Kaçtın" : "Ucu ucuna";
      }
      if (q === 0) { sfx("hurt"); buzz("heavy"); } else sfx("whoosh");
      result(L, q, label ?? "Isırdı");
      void L.close().then(() => resolve(q));
    };
    track(L.cv, pts => { trail = pts; }, pts => finish(pts));
    requestAnimationFrame(draw);
  });
}

/* ---------- büyü: işaret çizmek ---------- */
export function runePrompt(host: HTMLElement, o: { runes: string[]; ease: number; guide: number; spellName: string }): Promise<number> {
  return new Promise(resolve => {
    const [W, H] = stageSize(host, 1);
    const L = layer(host, "rune", `${esc(o.spellName)}: işareti çiz`, W, H);
    const lbl = L.el.querySelector<HTMLElement>(".qt-label")!;
    const scores: number[] = []; let i = 0; let t0 = performance.now(); let trail: P[] = []; let done = false; const LIMIT = 4500;
    const bar = document.createElement("div"); bar.className = "gx-bar"; L.box.after(bar);
    const draw = () => {
      if (done) return;
      const g = L.g; g.clearRect(0, 0, W, H); const id = o.runes[i];
      // rehber: annenin sayfası; ustalaştıkça silikleşir
      g.save(); g.globalAlpha = o.guide; g.setLineDash([6, 8]); g.strokeStyle = L.red; g.lineWidth = 3; g.beginPath();
      RUNES[id].pts.forEach(([x, y], k) => { const px = W * 0.15 + x * W * 0.7, py = H * 0.15 + y * H * 0.7; k ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke(); g.restore();
      const s0 = RUNES[id].pts[0]; g.fillStyle = L.red; g.globalAlpha = Math.max(0.25, o.guide); g.beginPath(); g.arc(W * 0.15 + s0[0] * W * 0.7, H * 0.15 + s0[1] * H * 0.7, 6, 0, 7); g.fill(); g.globalAlpha = 1;
      if (trail.length) inkTrail(g, trail, L.ink);
      const left = 1 - (performance.now() - t0) / LIMIT; bar.style.width = `${Math.max(0, left * 100)}%`;
      if (left <= 0) return next([]);
      requestAnimationFrame(draw);
    };
    const next = (pts: P[]) => {
      const id = o.runes[i]; const q = pts.length ? runeScore(pts, id, o.ease) : 0; scores.push(q);
      const r = L.el.querySelector<HTMLElement>(".qt-result")!; r.textContent = q >= 0.8 ? `${RUNES[id].name}: kusursuz` : q >= 0.3 ? `${RUNES[id].name}: tuttu` : `${RUNES[id].name}: dağıldı`; r.dataset.q = q >= 0.8 ? "1" : q >= 0.3 ? "g" : "0";
      sfx(q >= 0.3 ? "spark" : "bad"); if (q >= 0.8) buzz("light");
      trail = []; i++;
      if (i >= o.runes.length || q < 0.3) {
        done = true; const fq = Math.min(...scores, ...(q < 0.3 ? [0] : []));
        if (fq >= 0.3) { sfx("fire"); buzz("medium"); }
        void L.close(700).then(() => resolve(fq)); return;
      }
      lbl.textContent = `${i + 1}. işaret: ${RUNES[o.runes[i]].name}`; t0 = performance.now();
      setTimeout(() => { r.textContent = ""; }, 500);
    };
    lbl.textContent = o.runes.length > 1 ? `1. işaret: ${RUNES[o.runes[0]].name}` : `${esc(o.spellName)}: ${RUNES[o.runes[0]].name} işaretini çiz`;
    track(L.cv, pts => { trail = pts; if (pts.length % 5 === 0) sfx("draw"); }, pts => next(pts));
    requestAnimationFrame(draw);
  });
}

/* ---------- itme: kurdu sürükle ---------- */
/** dir: itme yönü (derece, ekran: oyuncudan kurda). */
export function pushPrompt(host: HTMLElement, o: { dir: number; ease: number; into?: string }): Promise<number> {
  return new Promise(resolve => {
    const [W, H] = stageSize(host, 0.7);
    const L = layer(host, "push", `İt! Kurdu ${o.into ? esc(o.into) + " doğru" : "geriye"} sürükle`, W, H);
    const a = o.dir * Math.PI / 180; const cx = W / 2 - Math.cos(a) * W * 0.18, cy = H / 2 - Math.sin(a) * H * 0.18;
    let trail: P[] = []; let done = false; const t0 = performance.now(); const LIMIT = 2600;
    const draw = () => {
      if (done) return; const g = L.g; g.clearRect(0, 0, W, H);
      const last = trail[trail.length - 1]; const wx = last ? last.x : cx, wy = last ? last.y : cy;
      g.strokeStyle = L.blue; g.globalAlpha = 0.35; g.lineWidth = 3; g.setLineDash([3, 7]); g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * W * 0.4, cy + Math.sin(a) * H * 0.4); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
      g.save(); g.translate(wx, wy); g.scale(Math.cos(a) > 0 ? -1 : 1, 1); drawWolf(g, 80, L.ink); g.restore();
      if (performance.now() - t0 > LIMIT) return finish([]);
      requestAnimationFrame(draw);
    };
    const finish = (pts: P[]) => {
      if (done) return; done = true;
      const sw = swipeOf(pts); const speed = sw.len / Math.max(1, sw.dur);
      const q = pts.length && Math.hypot(pts[0].x - cx, pts[0].y - cy) < 60 ? dirScore(sw, o.dir, 40 * o.ease, 50) * Math.min(1, 0.5 + speed) : 0;
      if (q > 0) { sfx("whoosh"); buzz("medium"); }
      result(L, q, q >= 0.95 ? "Sert itiş!" : q >= 0.55 ? "İttin" : q > 0 ? "Zayıf itiş" : "Tutamadın");
      void L.close().then(() => resolve(q));
    };
    track(L.cv, pts => { trail = pts; }, pts => finish(pts));
    requestAnimationFrame(draw);
  });
}

/* ---------- ok: yayı geri çek, rüzgârı hesapla, bırak ---------- */
/** range: hedefe uzaklık (altıgen); wind: -1..1 yan rüzgâr. Kafaya isabet 1.25 döner. */
export function bowPrompt(host: HTMLElement, o: { foe?: string; range: number; wind: number; ease: number }): Promise<number> {
  return new Promise(resolve => {
    const [W, H] = stageSize(host, 1.05);
    const L = layer(host, "bow", "Yayı geri çek, nişan al, bırak", W, H);
    const art = foeArt(o.foe); const wimg = art.url ? Object.assign(new Image(), { src: art.url }) : null;
    const scale = Math.max(0.45, 1.15 - o.range * 0.13);           // uzaktaki kurt küçük
    const ww = W * (art.human ? 0.16 : 0.38) * scale, wh = ww * art.aspect; const wy = H * 0.24;
    const bx = W / 2, by = H * 0.86; const t0 = performance.now(); const LIMIT = 6000;
    let pull: P | null = null, cur: P | null = null; let arrow: { x: number; y: number; vx: number; vy: number } | null = null; let done = false;
    const wolfX = (now: number) => W / 2 + Math.sin((now - t0) / 700) * W * 0.3 + Math.sin((now - t0) / 260) * W * 0.04 / o.ease;
    const finish = (q: number, text: string) => {
      if (done) return; done = true; result(L, q, text);
      if (q > 0) { sfx(q > 1 ? "crit" : "hit"); buzz(q > 1 ? "heavy" : "light"); } else sfx("miss");
      void L.close(700).then(() => resolve(q));
    };
    const draw = () => {
      if (done) return; const now = performance.now(); const g = L.g; g.clearRect(0, 0, W, H);
      const x = wolfX(now);
      const right = Math.cos((now - t0) / 700) > 0; // görsel sola bakar; sağa koşarken çevrilir
      g.save(); g.translate(x, wy); if (right) g.scale(-1, 1);
      if (wimg?.complete && wimg.naturalWidth) { g.filter = art.filter; g.drawImage(wimg, -ww / 2, -wh / 2, ww, wh); g.filter = "none"; } else { g.fillStyle = "#5E5850"; g.beginPath(); g.ellipse(0, 0, ww / 2, wh / 3, 0, 0, TAU); g.fill(); }
      g.restore();
      // rüzgâr
      g.strokeStyle = L.blue; g.lineWidth = 2.5; const wl = o.wind * 50; g.beginPath(); g.moveTo(W / 2 - wl, H * 0.5); g.lineTo(W / 2 + wl, H * 0.5); if (Math.abs(wl) > 3) { g.lineTo(W / 2 + wl - Math.sign(wl) * 8, H * 0.5 - 6); } g.stroke();
      g.fillStyle = L.blue; g.font = "16px Caveat, cursive"; g.textAlign = "center"; g.fillText(o.wind ? "rüzgâr" : "rüzgâr yok", W / 2, H * 0.5 + 18);
      // yay
      const dx = pull && cur ? cur.x - pull.x : 0, dy = pull && cur ? cur.y - pull.y : 0; const len = Math.min(H * 0.22, Math.hypot(dx, dy)); const a = Math.atan2(-dy, -dx);
      g.save(); g.translate(bx, by); g.rotate(len > 5 ? a + Math.PI / 2 : 0);
      g.strokeStyle = "#7B5A3A"; g.lineWidth = 4; g.beginPath(); g.arc(0, 30, 52, -Math.PI * 0.85, -Math.PI * 0.15); g.stroke();
      const sx = Math.cos(-Math.PI * 0.85) * 52, sy = 30 + Math.sin(-Math.PI * 0.85) * 52;
      g.strokeStyle = L.ink; g.lineWidth = 1.4; g.beginPath(); g.moveTo(sx, sy); g.lineTo(0, sy + len); g.lineTo(-sx, sy); g.stroke();
      if (!arrow) { g.strokeStyle = "#5B4630"; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, sy + len); g.lineTo(0, sy + len - 60); g.stroke(); }
      g.restore();
      if (arrow) {
        arrow.x += arrow.vx + o.wind * 1.1; arrow.y += arrow.vy;
        g.strokeStyle = "#5B4630"; g.lineWidth = 2.5; g.beginPath(); g.moveTo(arrow.x, arrow.y); g.lineTo(arrow.x - arrow.vx * 3, arrow.y - arrow.vy * 3); g.stroke();
        if (arrow.y <= wy) {
          const hx = art.human ? x : x + (right ? 1 : -1) * ww * 0.38, hy = art.human ? wy - wh * 0.38 : wy - wh * 0.08; // kafa (görsel sola bakar)
          const head = Math.hypot(arrow.x - hx, arrow.y - hy) < (art.human ? ww * 0.3 : ww * 0.12) * o.ease;
          const body = Math.abs(arrow.x - x) < ww * 0.42 * Math.min(1.3, o.ease) && Math.abs(arrow.y - wy) < wh * 0.45;
          return head ? finish(1.25, "Kafasına!") : body ? finish(Math.max(0.55, 1 - Math.abs(arrow.x - x) / ww), "Saplandı") : finish(0, "Iska");
        }
        if (arrow.y < -20 || arrow.x < -20 || arrow.x > W + 20) return finish(0, "Iska");
      } else if (now - t0 > LIMIT) return finish(0, "Geç kaldın");
      requestAnimationFrame(draw);
    };
    const pos = (e: PointerEvent): P => { const r = L.cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }; };
    L.cv.addEventListener("pointerdown", e => { if (arrow || done) return; L.cv.setPointerCapture(e.pointerId); pull = pos(e); cur = pull; });
    L.cv.addEventListener("pointermove", e => { if (pull) cur = pos(e); });
    const up = () => {
      if (!pull || !cur || arrow) return; const dx = cur.x - pull.x, dy = cur.y - pull.y; const len = Math.min(H * 0.22, Math.hypot(dx, dy)); pull = cur = null;
      if (len < 20) return; const sp = 6 + len / (H * 0.22) * 9; const a = Math.atan2(-dy, -dx);
      arrow = { x: bx, y: by - 30, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp }; sfx("whoosh");
    };
    L.cv.addEventListener("pointerup", up); L.cv.addEventListener("pointercancel", up);
    requestAnimationFrame(draw);
  });
}
