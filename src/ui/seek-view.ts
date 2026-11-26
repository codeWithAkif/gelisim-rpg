// Etrafa bak: yer resminin içine saklanmış şeyleri mercekle bulma oyunu.
// Mercek parmağını izler; içinde saklı şeyler büyür ve belirginleşir. Bırakırken merceğin ortasındaki şeyi alırsın.
// Keskin gözlü olan (görüş, koku, kulak, gözlem) küçük şeyleri daha kolay seçer ve daha geniş merceğe sahip olur.
import type { Config } from "../engine/config";
import type { GameState } from "../engine/state";
import type { Find } from "../content/explore";
import { collectible } from "../engine/explore";
import { Rng } from "../engine/rng";
import { artUrl, itemPic } from "./art";
import { esc } from "./sketch";
import { sfx, buzz } from "./feel";

const imgCache = new Map<string, HTMLImageElement | null>();
const img = (key: string) => { if (!imgCache.has(key)) { const u = artUrl(key); imgCache.set(key, u ? Object.assign(new Image(), { src: u }) : null); } const i = imgCache.get(key)!; return i && i.complete && i.naturalWidth ? i : null; };

interface Hidden { find: Find; x: number; y: number; rot: number; found: boolean; kind: string; item?: string; name: string }
interface Decoy { x: number; y: number; r: number; k: number }

/** Saklı şeyleri yerleştirir ve oyunu açar. Bitince bulunanların kimlikleri verilir. */
export function openSeek(cfg: Config, s: GameState, placeId: string, placeName: string, targets: Find[], onDone: (foundIds: string[]) => void) {
  const rng = new Rng((s.seed * 53 + s.day * 211 + Math.round(s.minute) * 3) | 0);
  const lv = (a: string) => s.attrs[a]?.level ?? 0;
  const sharp = Math.min(60, (lv("gorus") + lv("analiz") + lv("koku") + lv("isitme")) / 4);
  const hidden: Hidden[] = [];
  for (const f of targets) {
    const c = collectible(f.id)!; let x = 0, y = 0;
    for (let k = 0; k < 40; k++) { x = 0.1 + rng.next() * 0.8; y = 0.14 + rng.next() * 0.76; if (hidden.every(h => Math.hypot(h.x - x, (h.y - y) * 1.5) > 0.24)) break; }
    hidden.push({ find: f, x, y, rot: (rng.next() - 0.5) * 0.9, found: false, kind: c.kind, item: c.item, name: c.name });
  }
  const decoys: Decoy[] = Array.from({ length: 16 }, () => ({ x: 0.05 + rng.next() * 0.9, y: 0.08 + rng.next() * 0.86, r: 5 + rng.next() * 6, k: rng.int(0, 2) }));

  const el = document.createElement("div"); el.className = "siege seek"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Etrafa bak");
  el.innerHTML = `<div class="siege-top"><div class="siege-title hand">${esc(placeName)}: etrafa bak</div><div class="hand seek-count" id="skCount">0/${hidden.length}</div></div>
    <div class="siege-stage"><canvas></canvas></div>
    <div class="siege-panel"><p class="tiny" style="margin:0" id="skHint">Merceği parmağınla gezdir; saklı şeyler büyüyünce parmağını kaldır.</p>
      <div class="seek-list" id="skList"></div>
      <div class="row"><span style="flex:1"></span><button class="btn small" data-s="quit">Bitir</button></div></div>`;
  document.body.appendChild(el);
  const cv = el.querySelector("canvas")!; const stage = el.querySelector<HTMLElement>(".siege-stage")!; const g = cv.getContext("2d")!;
  const count = el.querySelector<HTMLElement>("#skCount")!; const hint = el.querySelector<HTMLElement>("#skHint")!; const list = el.querySelector<HTMLElement>("#skList")!;
  let W = 300, H = 400; let lx = 0.5, ly = 0.5; let down = false; let touch = false; let raf = 0; let done = false; let pulse = 0;
  const R = () => Math.max(40, Math.min(70, 44 + sharp * 0.4));
  const layout = () => { const r = stage.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1; W = r.width; H = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + "px"; cv.style.height = H + "px"; g.setTransform(dpr, 0, 0, dpr, 0, 0); };
  const renderList = () => {
    list.innerHTML = hidden.map(h => `<span class="seek-chip ${h.found ? "got" : ""}">${h.item ? itemPic(h.item, 26) : `<i class="seek-paw"></i>`}<b>${esc(h.name)}</b></span>`).join("");
    const n = hidden.filter(h => h.found).length; count.textContent = `${n}/${hidden.length}`;
  };

  const base = () => (artUrl("yer_" + placeId) ? img("yer_" + placeId) : null);
  // kapak (cover) yerleşimi: resim ekranı doldurur, taşan kısım kırpılır
  const fit = () => { const b = base(); if (!b) return { x: 0, y: 0, w: W, h: H }; const k = Math.max(W / b.naturalWidth, H / b.naturalHeight); const w = b.naturalWidth * k, h = b.naturalHeight * k; return { x: (W - w) / 2, y: (H - h) / 2, w, h }; };
  const pos = (nx: number, ny: number) => ({ x: nx * W, y: ny * H });

  function drawGlyph(h: Hidden, x: number, y: number, size: number, alpha: number) {
    g.save(); g.translate(x, y); g.rotate(h.rot); g.globalAlpha = alpha;
    const im = h.item ? img("esya_" + h.item) : null;
    if (im) g.drawImage(im, -size / 2, -size / 2, size, size);
    else if (h.kind === "hayvan") { g.fillStyle = "#4A3A2A"; g.beginPath(); g.ellipse(0, size * 0.12, size * 0.26, size * 0.2, 0, 0, 7); g.fill(); for (const [dx, dy] of [[-0.3, -0.18], [-0.1, -0.32], [0.1, -0.32], [0.3, -0.18]]) { g.beginPath(); g.arc(dx * size, dy * size, size * 0.09, 0, 7); g.fill(); } }
    else { g.fillStyle = "#6B7A45"; g.strokeStyle = "#2A2722"; g.lineWidth = 1.2; g.beginPath(); g.ellipse(0, 0, size * 0.34, size * 0.18, 0.6, 0, 7); g.fill(); g.stroke(); }
    g.restore();
  }
  function drawScene(zoom: number, cx: number, cy: number, reveal: boolean) {
    // zoom çevresinde (cx, cy) noktasına göre ölçeklenen sahne
    const f = fit(); const b = base();
    g.save(); g.translate(cx, cy); g.scale(zoom, zoom); g.translate(-cx, -cy);
    if (b) g.drawImage(b, f.x, f.y, f.w, f.h); else { g.fillStyle = "#DDD2B2"; g.fillRect(0, 0, W, H); }
    // yer çizimi yoksa ya da kalabalık yapmak için çevreye yaprak/taş benzeri leke: saklı şeylerin yanında dikkat dağıtır
    for (const d of decoys) { const p = pos(d.x, d.y); g.globalAlpha = 0.5; g.fillStyle = d.k === 0 ? "#7C8A55" : d.k === 1 ? "#8A7A5A" : "#9A9486"; g.beginPath(); g.ellipse(p.x, p.y, d.r, d.r * 0.55, d.x * 6, 0, 7); g.fill(); }
    g.globalAlpha = 1;
    const a0 = Math.min(0.5, 0.2 + sharp / 220);
    for (const h of hidden) { if (h.found) continue; const p = pos(h.x, h.y); g.globalCompositeOperation = reveal ? "source-over" : "multiply"; drawGlyph(h, p.x, p.y, reveal ? 30 : 22, reveal ? 1 : a0); g.globalCompositeOperation = "source-over"; }
    g.restore();
  }
  function frame() {
    if (done) return; pulse += 0.05;
    g.clearRect(0, 0, W, H);
    drawScene(1, 0, 0, false);
    // mercek
    const r = R(); const lp = { x: lx * W, y: Math.max(r * 0.6, ly * H - (touch && down ? r * 0.9 : 0)) };
    g.save(); g.beginPath(); g.arc(lp.x, lp.y, r, 0, 7); g.clip();
    g.fillStyle = "rgba(255,250,235,.12)"; g.fillRect(lp.x - r, lp.y - r, r * 2, r * 2);
    drawScene(2.2, lp.x, lp.y, true);
    g.restore();
    g.strokeStyle = "#2A2722"; g.lineWidth = 4; g.beginPath(); g.arc(lp.x, lp.y, r, 0, 7); g.stroke();
    g.strokeStyle = "rgba(255,255,255,.7)"; g.lineWidth = 2; g.beginPath(); g.arc(lp.x, lp.y, r - 4, 3.6, 4.7); g.stroke();
    g.strokeStyle = "#6B4A2E"; g.lineWidth = 7; g.lineCap = "round"; g.beginPath(); g.moveTo(lp.x + r * 0.72, lp.y + r * 0.72); g.lineTo(lp.x + r * 1.35, lp.y + r * 1.35); g.stroke();
    // ortada bir artı: bırakınca buradaki şeyi alırsın
    g.strokeStyle = "rgba(42,39,34,.35)"; g.lineWidth = 1; g.beginPath(); g.moveTo(lp.x - 8, lp.y); g.lineTo(lp.x + 8, lp.y); g.moveTo(lp.x, lp.y - 8); g.lineTo(lp.x, lp.y + 8); g.stroke();
    // yakındaki saklı şeye yaklaşınca merceğin kenarı titrer
    raf = requestAnimationFrame(frame);
  }
  const lensPos = () => { const r = R(); return { x: lx * W, y: Math.max(r * 0.6, ly * H - (touch && down ? r * 0.9 : 0)) }; };
  const setP = (e: PointerEvent) => { const rc = cv.getBoundingClientRect(); lx = Math.max(0, Math.min(1, (e.clientX - rc.left) / rc.width)); ly = Math.max(0, Math.min(1, (e.clientY - rc.top) / rc.height)); touch = e.pointerType !== "mouse"; };
  cv.addEventListener("pointerdown", e => { down = true; setP(e); cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", e => { if (down || e.pointerType === "mouse") setP(e); });
  cv.addEventListener("pointerup", e => {
    if (!down) return; setP(e); const lp = lensPos(); down = false;
    // merceğin ortasına en yakın saklı şey
    let best: Hidden | null = null, bd = 1e9;
    for (const h of hidden) { if (h.found) continue; const p = pos(h.x, h.y); const d = Math.hypot(p.x - lp.x, p.y - lp.y); if (d < bd) { bd = d; best = h; } }
    if (best && bd < 18 + sharp * 0.15) {
      best.found = true; sfx("perfect"); buzz("medium"); renderList(); hint.textContent = `${best.name} buldun!`;
      if (hidden.every(h => h.found)) { setTimeout(() => finish(), 700); }
    } else { sfx("tap"); }
  });
  cv.addEventListener("pointercancel", () => { down = false; });
  function finish() { if (done) return; done = true; cancelAnimationFrame(raf); window.removeEventListener("resize", layout); el.remove(); onDone(hidden.filter(h => h.found).map(h => h.find.id)); }
  el.querySelector("[data-s=quit]")!.addEventListener("click", () => { sfx("tap"); finish(); });
  window.addEventListener("resize", layout);
  layout(); renderList(); raf = requestAnimationFrame(frame);
  void cfg;
}
