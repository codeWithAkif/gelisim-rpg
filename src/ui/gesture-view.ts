// Savaşta parmak hareketleri: kurdun üstünden kesik çekmek, atılan kurttan kaçmak,
// büyünün işaretini çizmek, kurdu sürükleyip itmek. Hepsi kısa bir katmanda oynanır, 0–1 kalite döner.
import { slashScore, dirScore, swipeOf, runeScore, RUNES, type P } from "../engine/gesture";
import { wolfSketch, esc, WOLF_OUTLINE } from "./sketch";
import { artUrl } from "./art";
import { sfx, buzz } from "./feel";

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
function wolfPic(W: number, H: number, detail: number, aimAt?: [number, number]): string {
  const url = artUrl("dusman_kurt");
  const img = url ? `<img src="${url}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain">` : `<div style="position:absolute;inset:0">${wolfSketch({ detail, marks: [], width: W, labels: false })}</div>`;
  const target = aimAt ? `<div class="gx-aim" style="left:${aimAt[0] * W}px;top:${aimAt[1] * H}px"></div>` : "";
  return img + target;
}

/* ---------- saldırı: kesik ---------- */
export function slashPrompt(host: HTMLElement, o: { aimName?: string; aimAt?: [number, number]; aimArtAt?: [number, number]; detail: number; ease: number }): Promise<number> {
  return new Promise(resolve => {
    const [W, H] = stageSize(host, 0.65);
    // görsel varsa zayıf nokta görseldeki yerine taşınır (görsel kutuya sığdırılır, ortalanır)
    const art = artUrl("dusman_kurt"); const IA = 393 / 640;
    const aim: [number, number] | undefined = art && o.aimArtAt ? [o.aimArtAt[0], (H - W * IA) / 2 / H + o.aimArtAt[1] * W * IA / H] : o.aimAt;
    o = { ...o, aimAt: aim };
    const L = layer(host, "slash", o.aimName ? `Kes! ${esc(o.aimName)} hedefinden geçir` : "Kurdun üstünden kes!", W, H, wolfPic(W, H, o.detail, o.aimAt));
    const body = [[0.22, 0.45], [0.42, 0.5], [0.62, 0.5], [0.82, 0.48]].map(([x, y]) => ({ x: x * W, y: y * H, r: W * 0.11 }));
    const weak = o.aimAt ? { x: o.aimAt[0] * W, y: o.aimAt[1] * H, r: W * 0.06 } : undefined;
    let done = false; const t0 = performance.now(); const LIMIT = 2600;
    const timer = setInterval(() => { if (!done && performance.now() - t0 > LIMIT) finish([], "Geç kaldın"); }, 100);
    const bar = document.createElement("div"); bar.className = "gx-bar"; L.box.after(bar);
    const tick = () => { if (done) return; bar.style.width = `${Math.max(0, 100 - (performance.now() - t0) / LIMIT * 100)}%`; requestAnimationFrame(tick); }; tick();
    const finish = (pts: P[], label?: string) => {
      if (done) return; done = true; clearInterval(timer);
      const r = pts.length ? slashScore(pts, body, weak, o.ease) : { q: 0, weak: false };
      L.g.clearRect(0, 0, W, H); if (pts.length) inkTrail(L.g, pts, r.q > 0 ? L.red : L.ink);
      if (r.q > 0) { sfx(r.weak || r.q >= 0.95 ? "crit" : "hit"); buzz(r.weak ? "heavy" : "light"); L.el.classList.add("hit"); } else sfx("miss");
      result(L, r.q, label ?? (r.weak ? "Tam isabet!" : r.q >= 0.75 ? "Temiz kesik" : r.q > 0 ? "Sıyırdı" : "Iska"));
      void L.close(650).then(() => resolve(r.q));
    };
    track(L.cv, pts => { L.g.clearRect(0, 0, W, H); inkTrail(L.g, pts, L.ink, 0.85); if (pts.length % 4 === 0) sfx("draw"); }, pts => finish(pts));
  });
}

/* ---------- savunma: atılan kurttan kaç ---------- */
/** from: kurdun oyuncuya göre geldiği yön (derece, ekran). */
export function dodgePrompt(host: HTMLElement, o: { from: number; ease: number }): Promise<number> {
  return new Promise(resolve => {
    const [W, H] = stageSize(host, 0.8);
    const L = layer(host, "dodge", "Kurt atılıyor! Kenara kaç", W, H);
    const cx = W / 2, cy = H / 2; const a = o.from * Math.PI / 180;
    const sx = cx + Math.cos(a) * W * 0.46, sy = cy + Math.sin(a) * H * 0.46;
    const lead = 350 + Math.random() * 350, dur = 900 + Math.random() * 300; const t0 = performance.now();
    const away = (o.from + 180) % 360; let done = false; let trail: P[] = [];
    const wolf = artUrl("dusman_kurt"); const img = wolf ? Object.assign(new Image(), { src: wolf }) : null;
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
      if (img?.complete && img.naturalWidth) g.drawImage(img, -48, -30, 96, 96 * img.naturalHeight / img.naturalWidth); else drawWolf(g, 90, L.ink);
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
