// Mürekkep ve sulu boya alev: barikat savaşında, nöbette ve ateş şeritlerinde aynı çizim.
// Sıcak hale, kavrulmuş toprak, titreşen dört alev dili, sarı öz; ara ara kıvılcım ve duman.
export interface Ember { x: number; y: number; vx: number; vy: number; t0: number; smoke: boolean }

export function drawFlames(g: CanvasRenderingContext2D, embers: Ember[], cx: number, cy: number, sz: number, seed: number, now: number, alpha: number) {
  const t = now / 110; g.save(); g.globalAlpha = alpha;
  g.fillStyle = "rgba(70,45,25,.25)"; g.beginPath(); g.ellipse(cx, cy, sz * 0.9, sz * 0.35, 0, 0, 7); g.fill();
  const glow = g.createRadialGradient(cx, cy - sz * 0.3, 1, cx, cy - sz * 0.3, sz * 1.5);
  glow.addColorStop(0, "rgba(255,170,60,.4)"); glow.addColorStop(1, "rgba(255,170,60,0)"); g.fillStyle = glow; g.beginPath(); g.arc(cx, cy - sz * 0.3, sz * 1.5, 0, 7); g.fill();
  for (let i = 0; i < 4; i++) {
    const j = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453; const r = j - Math.floor(j);
    const fx = cx + (i - 1.5) * sz * 0.3, fy = cy + (r - 0.5) * sz * 0.2, h = sz * (0.75 + 0.35 * Math.sin(t + i * 1.7 + seed)) * (i % 2 ? 0.8 : 1.1);
    const sway = Math.sin(t * 1.3 + i + seed) * sz * 0.12;
    g.beginPath(); g.moveTo(fx - sz * 0.17, fy); g.quadraticCurveTo(fx - sz * 0.26, fy - h * 0.5, fx + sway, fy - h); g.quadraticCurveTo(fx + sz * 0.26, fy - h * 0.5, fx + sz * 0.17, fy); g.closePath();
    g.fillStyle = "rgba(214,98,32,.88)"; g.fill(); g.strokeStyle = "#9E3423"; g.lineWidth = 1.1; g.stroke();
    g.beginPath(); g.moveTo(fx - sz * 0.08, fy); g.quadraticCurveTo(fx + sway * 0.5, fy - h * 0.6, fx + sz * 0.08, fy); g.fillStyle = "#FFD27A"; g.fill();
  }
  g.restore();
  if (Math.random() < 0.05 * alpha) embers.push({ x: cx + (Math.random() - 0.5) * sz, y: cy - sz * 0.7, vx: (Math.random() - 0.5) * 0.25, vy: -0.5 - Math.random() * 0.3, t0: now, smoke: Math.random() < 0.4 });
}
export function drawEmbers(g: CanvasRenderingContext2D, embers: Ember[], now: number) {
  for (let i = embers.length - 1; i >= 0; i--) {
    const e = embers[i]; const k = (now - e.t0) / (e.smoke ? 1100 : 600); if (k > 1) { embers.splice(i, 1); continue; }
    const x = e.x + e.vx * (now - e.t0) * 0.06, y = e.y + e.vy * (now - e.t0) * 0.06;
    g.fillStyle = e.smoke ? `rgba(90,85,80,${0.35 * (1 - k)})` : `rgba(255,190,90,${1 - k})`; g.beginPath(); g.arc(x, y, e.smoke ? 2 + k * 5 : 1.4, 0, 7); g.fill();
  }
}
