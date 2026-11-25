// Elle çizilmiş görünüm: titrek mürekkep çizgileri, eskizler, vücut çizimi.
// Her şey SVG metni olarak üretilir; görsel dosya gerekmez.

/** Tohuma bağlı küçük rastgelelik: aynı çizim her açılışta aynı titrer. */
function jitter(seed: number) {
  let t = seed | 0;
  return () => { t = (t + 0x6d2b79f5) | 0; let r = Math.imul(t ^ (t >>> 15), t | 1); r ^= r + Math.imul(r ^ (r >>> 7), r | 61); return (((r ^ (r >>> 14)) >>> 0) / 4294967296) - 0.5; };
}
export function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/** Noktaları titreterek bir yol üretir. */
export function roughPath(pts: [number, number][], amp: number, seed: number, close = false): string {
  const j = jitter(seed);
  const p = pts.map(([x, y]) => [x + j() * amp, y + j() * amp]);
  let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
  for (let i = 1; i < p.length; i++) {
    const [x0, y0] = p[i - 1], [x1, y1] = p[i];
    const mx = (x0 + x1) / 2 + j() * amp, my = (y0 + y1) / 2 + j() * amp;
    d += ` Q${mx.toFixed(1)},${my.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  return close ? d + " Z" : d;
}
function roughEllipse(cx: number, cy: number, rx: number, ry: number, amp: number, seed: number, n = 14): string {
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2 + 0.3; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  return roughPath(pts, amp, seed);
}

/** Mürekkep çubuk: değer/üst sınır, tarama doldurmalı. */
export function inkBar(frac: number, pendingFrac = 0, seed = 1): string {
  const w = 100, f = Math.max(0, Math.min(1, frac)), pf = Math.max(0, Math.min(1 - f, pendingFrac));
  const outline = roughPath([[0, 1], [w, 0.5], [w, 7], [0, 7.5]], 0.6, seed, true);
  let hatch = "";
  for (let x = 2; x < f * w; x += 3) hatch += `M${x},7 L${x + 3},1 `;
  return `<svg viewBox="-1 -1 102 10" preserveAspectRatio="none" aria-hidden="true">
    <path d="${hatch}" stroke="var(--ink)" stroke-width=".9" fill="none" vector-effect="non-scaling-stroke"/>
    ${pf > 0 ? `<rect x="${f * w}" y="1" width="${pf * w}" height="6" fill="var(--green)" opacity=".35"/>` : ""}
    <path d="${outline}" stroke="var(--ink)" stroke-width="1.1" fill="none" vector-effect="non-scaling-stroke"/></svg>`;
}

/** Kişi portresi: isme göre değişen basit eskiz. */
export function portrait(name: string, size = 46, known = true): string {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0;
  const j = jitter(h);
  const head = roughEllipse(23, 22, 11 + j() * 2, 13 + j() * 2, 1.2, h);
  const hair = roughPath([[11, 18], [15, 9 + j() * 3], [23, 7], [31, 9 + j() * 3], [35, 18]], 1.5, h + 1);
  const beard = (h & 3) === 0 ? `<path d="${roughPath([[14, 26], [18, 36], [23, 38], [28, 36], [32, 26]], 1.2, h + 2)}"/>` : "";
  const scarf = (h & 4) ? `<path d="${roughPath([[10, 14], [23, 4], [36, 14]], 1.4, h + 3)}" stroke-width="2"/>` : "";
  const body = roughPath([[6, 46], [10, 38], [23, 35], [36, 38], [40, 46]], 1.2, h + 4);
  if (!known) return `<svg width="${size}" height="${size}" viewBox="0 0 46 46" aria-hidden="true"><g fill="none" stroke="var(--pencil)" stroke-width="1.2" stroke-dasharray="3 3"><path d="${head}"/><path d="${body}"/></g><text x="23" y="27" text-anchor="middle" font-family="var(--f-hand)" font-size="16" fill="var(--pencil)">?</text></svg>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 46 46" aria-hidden="true"><g fill="none" stroke="var(--ink)" stroke-width="1.2" stroke-linecap="round">
    <path d="${body}"/><path d="${head}"/><path d="${hair}"/>${beard}${scarf}
    <circle cx="${19 + j()}" cy="21" r=".9" fill="var(--ink)"/><circle cx="${27 + j()}" cy="21" r=".9" fill="var(--ink)"/>
    <path d="${roughPath([[20, 29], [23, 30], [26, 29]], 0.6, h + 5)}"/></g></svg>`;
}

/** Kurt eskizi: gözlem yeteneği arttıkça çizim gelişir, bilinen zayıf noktalar kırmızıyla işaretlenir. */
export function wolfSketch(opts: { detail: number; marks: { name: string; at: [number, number] }[]; width?: number; seed?: number; labels?: boolean }): string {
  const { detail, marks, width = 200, seed = 7, labels = true } = opts;
  const amp = detail < 12 ? 4 : detail < 25 ? 2 : 1.2;
  const outline: [number, number][] = [[10, 58], [26, 50], [40, 40], [47, 26], [54, 38], [61, 30], [64, 44], [82, 52], [112, 46], [142, 48], [166, 52], [182, 48], [196, 36], [192, 54], [176, 64], [171, 92], [175, 118], [165, 118], [158, 94], [150, 80], [120, 82], [98, 84], [88, 118], [78, 118], [79, 90], [70, 80], [60, 72], [46, 70], [30, 66], [12, 62]];
  let body = `<path d="${roughPath(outline, amp, seed, true)}" fill="${detail >= 25 ? "rgba(42,39,34,.06)" : "none"}"/>`;
  if (detail >= 12) {
    body += `<path d="${roughPath(outline, amp * 1.2, seed + 9, true)}" opacity=".45"/>`;
    body += `<circle cx="36" cy="50" r="1.6" fill="var(--ink)"/>`;
    for (let i = 0; i < 7; i++) { const x = 90 + i * 11; body += `<path d="${roughPath([[x, 50], [x + 5, 58]], 0.8, seed + 20 + i)}" opacity=".6"/>`; }
  }
  if (detail >= 25) {
    body += `<path d="${roughPath([[64, 48], [74, 64], [70, 80]], 1, seed + 40)}" opacity=".5"/>`;
    body += `<path d="${roughPath([[150, 58], [160, 72], [158, 94]], 1, seed + 41)}" opacity=".5"/>`;
    for (let i = 0; i < 9; i++) { const x = 104 + i * 6; body += `<path d="M${x},${66} L${x + 4},${78}" opacity=".35"/>`; }
  }
  const mk = marks.map((m, i) => {
    const x = m.at[0] * 200, y = m.at[1] * 130;
    const lx = x < 100 ? 4 : 120, ly = 12 + i * 15;
    return `<g stroke="var(--red)" stroke-width="2" stroke-linecap="round"><path d="M${x - 5},${y - 5} L${x + 5},${y + 5} M${x + 5},${y - 5} L${x - 5},${y + 5}"/></g>
      ${labels ? `<path d="M${x},${y} L${lx + (x < 100 ? 30 : 0)},${ly + 3}" stroke="var(--red)" stroke-width=".8" fill="none" stroke-dasharray="2 2"/>
      <text x="${lx}" y="${ly}" font-family="var(--f-hand)" font-size="13" fill="var(--red)">${esc(m.name)}</text>` : ""}`;
  }).join("");
  const h = Math.round(width * 0.65);
  return `<svg width="${width}" height="${h}" viewBox="0 0 200 130" aria-label="Kurt eskizi"><g fill="none" stroke="var(--ink)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${body}</g>${mk}</svg>`;
}

/** Vücut çizimi: kas grupları seviyesine göre koyulaşır, uykuda işlenecek kazanç kesikli yeşil çizilir. */
export function bodySketch(lv: (id: string) => number, pend: (id: string) => number, names: (id: string) => string): string {
  const s = 3;
  const fig = [
    roughEllipse(100, 40, 20, 25, 1.4, s),
    roughPath([[92, 64], [92, 74], [70, 82], [56, 96], [50, 140], [44, 186], [42, 222]], 1.4, s + 1),
    roughPath([[108, 64], [108, 74], [130, 82], [144, 96], [150, 140], [156, 186], [158, 222]], 1.4, s + 2),
    roughPath([[70, 96], [74, 150], [76, 196], [72, 250], [76, 300], [76, 348], [94, 350], [96, 300], [98, 214]], 1.4, s + 3),
    roughPath([[130, 96], [126, 150], [124, 196], [128, 250], [124, 300], [124, 348], [106, 350], [104, 300], [102, 214]], 1.4, s + 4),
    roughPath([[62, 112], [66, 160], [62, 196]], 1, s + 5), roughPath([[138, 112], [134, 160], [138, 196]], 1, s + 6),
  ];
  type M = { id: string; shapes: [number, number, number, number][]; label: [number, number, "l" | "r"] };
  // etiketler gövdenin iki yanındaki sütunlarda; çizgiler kasa uzanır
  const muscles: M[] = [
    { id: "ust_govde", shapes: [[76, 94, 12, 10], [124, 94, 12, 10], [88, 112, 12, 9], [112, 112, 12, 9], [58, 128, 6, 14], [142, 128, 6, 14]], label: [-66, 92, "l"] },
    { id: "kavrama", shapes: [[51, 172, 5, 16], [149, 172, 5, 16]], label: [-66, 176, "l"] },
    { id: "core", shapes: [[100, 150, 13, 24]], label: [266, 176, "r"] },
    { id: "bacak", shapes: [[86, 240, 10, 28], [114, 240, 10, 28], [86, 312, 7, 20], [114, 312, 7, 20]], label: [-66, 262, "l"] },
  ];
  const labelAt = (x: number, y: number, side: "l" | "r", name: string, val: string, color = "var(--ink)") =>
    `<text x="${x}" y="${y - 4}" text-anchor="${side === "l" ? "start" : "end"}" font-family="var(--f-hand)" font-size="16" fill="${color}">${esc(name)}</text>
     <text x="${x}" y="${y + 12}" text-anchor="${side === "l" ? "start" : "end"}" font-family="var(--f-hand)" font-size="15" fill="var(--ink-soft)">${val}</text>`;
  let parts = "";
  muscles.forEach((m, mi) => {
    const v = lv(m.id), p = pend(m.id);
    const op = Math.min(0.8, 0.05 + (v / 100) * 0.95);
    const sw = 0.8 + v / 35;
    m.shapes.forEach(([cx, cy, rx, ry], i) => {
      const grow = 1 + v / 250;
      const d = roughEllipse(cx, cy, rx * grow, ry * grow, 0.8, 50 + mi * 10 + i, 10);
      parts += `<path d="${d}" fill="rgba(158,52,35,${op.toFixed(2)})" stroke="var(--red)" stroke-width="${sw.toFixed(2)}"/>`;
      if (p > 0.01) parts += `<path d="${roughEllipse(cx, cy, rx * grow + 3, ry * grow + 3, 0.6, 90 + mi * 10 + i, 10)}" fill="none" stroke="var(--green)" stroke-width="1.4" stroke-dasharray="3 2"/>`;
    });
    const [lx, ly, side] = m.label;
    const target = side === "l" ? m.shapes[0] : m.shapes[0];
    const lineFrom = side === "l" ? lx + 52 : lx - 52;
    parts += `<path d="M${lineFrom},${ly + 2} L${target[0] - (side === "l" ? target[2] : -target[2])},${target[1]}" stroke="var(--pencil)" stroke-width=".7" fill="none"/>`;
    parts += labelAt(lx, ly, side, names(m.id), `${v.toFixed(1)}${p > 0.01 ? ` <tspan fill="var(--green)">+${p.toFixed(1)}</tspan>` : ""}`);
  });
  // kalp ve akciğerler: dayanıklılık ve nefes
  const kv = lv("kardiyo"), nv = lv("nefes"), kp = pend("kardiyo"), np = pend("nefes");
  parts += `<path d="${roughPath([[100, 126], [94, 120], [94, 114], [100, 117], [106, 114], [106, 120], [100, 126]], 0.4, 9)}" fill="rgba(158,52,35,${(0.15 + kv / 120).toFixed(2)})" stroke="var(--red)" stroke-width="1"/>
    <path d="${roughEllipse(90, 116, 7, 12, 0.5, 31)}" fill="none" stroke="var(--blue)" stroke-width="${(0.6 + nv / 40).toFixed(2)}" stroke-dasharray="2 2"/>
    <path d="${roughEllipse(110, 116, 7, 12, 0.5, 32)}" fill="none" stroke="var(--blue)" stroke-width="${(0.6 + nv / 40).toFixed(2)}" stroke-dasharray="2 2"/>
    <path d="M214,94 L106,120" stroke="var(--pencil)" stroke-width=".7" fill="none"/><path d="M214,134 L117,118" stroke="var(--pencil)" stroke-width=".7" fill="none"/>`;
  parts += labelAt(266, 92, "r", names("kardiyo"), `${kv.toFixed(1)}${kp > 0.01 ? ` <tspan fill="var(--green)">+${kp.toFixed(1)}</tspan>` : ""}`);
  parts += labelAt(266, 132, "r", names("nefes"), `${nv.toFixed(1)}${np > 0.01 ? ` <tspan fill="var(--green)">+${np.toFixed(1)}</tspan>` : ""}`, "var(--blue)");
  return `<svg viewBox="-70 0 340 360" role="img" aria-label="Vücut çizimi"><g fill="none" stroke="var(--ink)" stroke-width="1.5" stroke-linecap="round">${fig.map(d => `<path d="${d}"/>`).join("")}</g>${parts}</svg>`;
}

export const ICONS = {
  defter: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 4.5c3-.8 5.5-.5 8 1.2v14c-2.5-1.7-5-2-8-1.2z"/><path d="M20 4.5c-3-.8-5.5-.5-8 1.2v14c2.5-1.7 5-2 8-1.2z"/></svg>`,
  vucut: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="4.5" r="2.3"/><path d="M6 9.5c4-1.5 8-1.5 12 0M12 8.5v6.5M12 15l-3 6.5M12 15l3 6.5M8 9.8 6.5 14.5M16 9.8l1.5 4.7"/></svg>`,
  calis: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="14.5" cy="4.5" r="2"/><path d="M8 9.5l4-2 3 3-2 4 3 3v3M13 14.5l-4 1-2 4M15 10.5l3.5 1.5"/></svg>`,
  isler: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 3.5h11v15.5c0 1.2-1 2-2 2H5"/><path d="M6 3.5c-1.4 0-2 1-2 2s.6 2 2 2M8.5 8h6M8.5 11.5h6M8.5 15h4"/></svg>`,
};
