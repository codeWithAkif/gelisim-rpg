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
  harita: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></svg>`,
  canta: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9h14l-1 11H6z"/><path d="M9 9V7a3 3 0 0 1 6 0v2M5 13h14"/></svg>`,
  defter: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 4.5c3-.8 5.5-.5 8 1.2v14c-2.5-1.7-5-2-8-1.2z"/><path d="M20 4.5c-3-.8-5.5-.5-8 1.2v14c2.5-1.7 5-2 8-1.2z"/></svg>`,
  vucut: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="4.5" r="2.3"/><path d="M6 9.5c4-1.5 8-1.5 12 0M12 8.5v6.5M12 15l-3 6.5M12 15l3 6.5M8 9.8 6.5 14.5M16 9.8l1.5 4.7"/></svg>`,
  calis: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="14.5" cy="4.5" r="2"/><path d="M8 9.5l4-2 3 3-2 4 3 3v3M13 14.5l-4 1-2 4M15 10.5l3.5 1.5"/></svg>`,
  isler: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 3.5h11v15.5c0 1.2-1 2-2 2H5"/><path d="M6 3.5c-1.4 0-2 1-2 2s.6 2 2 2M8.5 8h6M8.5 11.5h6M8.5 15h4"/></svg>`,
};

/** Eşya resimleri: suluboya dolgu + titrek mürekkep hat. */
export function itemIcon(id: string, size = 44): string {
  const P = (pts: [number, number][], fill: string, seed: number, close = true, extra = "") =>
    `<path d="${roughPath(pts, 0.9, seed, close)}" fill="${fill}" ${extra}/>`;
  const L = (pts: [number, number][], seed: number, extra = "") => `<path d="${roughPath(pts, 0.6, seed)}" fill="none" ${extra}/>`;
  let g = "";
  switch (id) {
    case "ekmek": g = P([[6, 30], [10, 18], [24, 13], [38, 18], [42, 30], [34, 36], [14, 36]], "#C98F4A", 1) + L([[16, 20], [20, 28]], 2) + L([[23, 18], [27, 27]], 3) + L([[30, 19], [34, 27]], 4); break;
    case "peynir": g = P([[6, 34], [40, 34], [40, 22], [6, 30]], "#E8C870", 5) + P([[6, 30], [40, 22], [30, 14]], "#F2DA8C", 6) + `<circle cx="18" cy="30" r="2.2" fill="#C9A24A"/><circle cx="30" cy="29" r="1.6" fill="#C9A24A"/>`; break;
    case "degnek": g = L([[10, 40], [38, 8]], 7, 'stroke="#6B5235" stroke-width="4"') + L([[22, 26], [26, 25]], 8, 'stroke="#4A3A22" stroke-width="2"'); break;
    case "el_yapimi_bicak": g = P([[24, 24], [40, 8], [42, 10], [27, 27]], "#C9CDD1", 9) + P([[10, 38], [24, 24], [27, 27], [13, 41]], "#7B5A3A", 10) + L([[15, 32], [19, 36]], 11) + L([[18, 29], [22, 33]], 12); break;
    case "temiz_giysi": g = P([[14, 8], [20, 10], [24, 12], [28, 10], [34, 8], [42, 16], [36, 22], [34, 20], [34, 40], [14, 40], [14, 20], [12, 22], [6, 16]], "#8FA6C4", 13) + L([[24, 12], [24, 20]], 14); break;
    case "deri": g = P([[8, 14], [16, 8], [26, 10], [36, 8], [42, 16], [38, 26], [42, 36], [30, 40], [20, 36], [8, 40], [10, 28]], "#A0703F", 15) + L([[16, 18], [30, 20]], 16, 'stroke-dasharray="2 3"'); break;
    case "ip": g = `<ellipse cx="24" cy="26" rx="15" ry="11" fill="#D8C08A"/>` + [0, 1, 2, 3].map(i => `<ellipse cx="24" cy="26" rx="${15 - i * 3.5}" ry="${11 - i * 2.5}" fill="none"/>`).join("") + L([[36, 32], [42, 40]], 17); break;
    case "bez_torba": g = P([[12, 18], [36, 18], [40, 36], [24, 42], [8, 36]], "#D9C9A0", 18) + P([[18, 18], [22, 10], [26, 10], [30, 18]], "#CDBB93", 19) + L([[16, 18], [32, 18]], 20, 'stroke="#8B6A3A" stroke-width="2"'); break;
    case "deri_canta": g = P([[8, 16], [40, 16], [40, 40], [8, 40]], "#8A5A30", 21) + P([[8, 16], [40, 16], [38, 28], [10, 28]], "#A0703F", 22) + `<rect x="21" y="25" width="6" height="5" fill="#D9B54A"/>` + L([[14, 16], [20, 6], [28, 6], [34, 16]], 23, 'stroke="#5B3A1E" stroke-width="2"'); break;
    case "annenin_heybesi": g = P([[4, 14], [22, 14], [22, 40], [4, 38]], "#6E5070", 24) + P([[26, 14], [44, 14], [44, 38], [26, 40]], "#6E5070", 25) + P([[4, 14], [44, 14], [44, 20], [4, 20]], "#83647F", 26) + P([[13, 26], [16, 23], [19, 26], [16, 30]], "#9E3423", 27); break;
    case "dede_kilici": g = P([[22, 30], [40, 6], [43, 8], [26, 33]], "#D5D9DD", 28) + L([[16, 26], [30, 38]], 29, 'stroke="#8A6A2A" stroke-width="3"') + L([[8, 42], [22, 30]], 30, 'stroke="#5B3A1E" stroke-width="4"'); break;
    case "av_yayi": g = `<path d="M14,6 Q38,24 14,42" fill="none" stroke="#7B5A3A" stroke-width="3.5"/>` + L([[14, 6], [14, 42]], 31, 'stroke="#C9B98A"'); break;
    case "deri_zirh": g = P([[12, 8], [20, 12], [28, 12], [36, 8], [38, 40], [10, 40]], "#8A5A30", 32) + L([[24, 12], [24, 40]], 33) + L([[14, 24], [34, 24]], 34, 'stroke-dasharray="2 2"'); break;
    case "zincir_zirh": g = P([[12, 8], [20, 12], [28, 12], [36, 8], [38, 40], [10, 40]], "#A9ADB1", 35) + [0, 1, 2, 3, 4].map(r => [0, 1, 2, 3].map(c => `<circle cx="${15 + c * 6 + (r % 2) * 3}" cy="${18 + r * 5}" r="2" fill="none" stroke-width=".8"/>`).join("")).join(""); break;
    default: g = P([[10, 10], [38, 10], [38, 38], [10, 38]], "#E1D5B8", 36) + `<text x="24" y="30" text-anchor="middle" font-family="var(--f-hand)" font-size="18" fill="var(--ink)">?</text>`;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true"><g stroke="var(--ink)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${g}</g></svg>`;
}

/** Gösterge simgeleri. */
export const VITAL_ICONS = {
  hp: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="#C2483A" stroke="var(--ink)" stroke-width="1.3"/></svg>`,
  energy: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 5 13h6l-1 9 8-12h-6z" fill="#E0B043" stroke="var(--ink)" stroke-width="1.3" stroke-linejoin="round"/></svg>`,
  food: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14c1-5 5-8 8-8s7 3 8 8c-1 3-4 4-8 4s-7-1-8-4z" fill="#C98F4A" stroke="var(--ink)" stroke-width="1.3"/><path d="M9 9l1 4M13 8l1 5M17 10l0 4" stroke="var(--ink)" stroke-width="1" fill="none"/></svg>`,
  mana: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c3 5 6 8 6 12a6 6 0 0 1-12 0c0-4 3-7 6-12z" fill="#5A7FB8" stroke="var(--ink)" stroke-width="1.3"/></svg>`,
};
