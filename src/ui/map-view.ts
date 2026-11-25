// Dünya haritası: elle çizilmiş ülke haritası, sürükle/yakınlaştır, yer seçimi ve yürüyüş canlandırması.
import type { Config } from "../engine/config";
import type { GameState } from "../engine/state";
import { PLACES, ROADS, type Place } from "../content/map";
import { NPCS, QUESTS } from "../content/world";
import { place, planTravel, peopleAt, isOpen } from "../engine/travel";
import { esc, roughPath } from "./sketch";
import { personPic, placePic, artUrl } from "./art";
import { animScale } from "./settings";
import { journeyPoint, journeyProgress, journeyLeftMs } from "../engine/journey";
import { fmtDur } from "../engine/session";
import { darkness } from "./daylight";
import { isSeen } from "../engine/explore";
import { placeActions, nextHint } from "../engine/actions";

const W = 1000, H = 1400;
function hash(x: number, y: number) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

/* ---------- arazi (bir kez üretilir) ---------- */
let terrainCache = "";
function mountains(x0: number, x1: number, y0: number, y1: number, n: number, seed: number, snow = false): string {
  let out = "";
  const pk: [number, number, number][] = [];
  for (let i = 0; i < n; i++) pk.push([x0 + hash(seed, i) * (x1 - x0), y0 + hash(seed + 7, i) * (y1 - y0), 14 + hash(seed + 3, i) * 22]);
  pk.sort((a, b) => a[1] - b[1]);
  for (const [x, y, s] of pk) {
    out += `<path d="M${x - s},${y} L${x - s * 0.1},${y - s * 1.3} L${x + s},${y} Z" fill="#CDBF98" stroke="#5B5447" stroke-width="1.2" vector-effect="non-scaling-stroke"/>`;
    out += `<path d="M${x - s * 0.1},${y - s * 1.3} L${x + s},${y} L${x + s * 0.2},${y} Z" fill="#B3A47C"/>`;
    if (snow) out += `<path d="M${x - s * 0.42},${y - s * 0.8} L${x - s * 0.1},${y - s * 1.3} L${x + s * 0.3},${y - s * 0.8} L${x + s * 0.05},${y - s * 0.9} Z" fill="#F4F1E8"/>`;
  }
  return out;
}
function forest(cx: number, cy: number, rx: number, ry: number, n: number, seed: number): string {
  let out = ""; const t: [number, number][] = [];
  for (let i = 0; i < n; i++) { const a = hash(seed, i) * Math.PI * 2, r = Math.sqrt(hash(seed + 1, i)); t.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]); }
  t.sort((a, b) => a[1] - b[1]);
  for (const [x, y] of t) out += `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + 5}" stroke="#5B4630" stroke-width="1" vector-effect="non-scaling-stroke"/><circle cx="${x}" cy="${y - 2}" r="${5 + hash(x, y) * 3}" fill="${hash(y, x) > 0.5 ? "#7C9A5E" : "#6A8A50"}" stroke="#3E5230" stroke-width=".8" vector-effect="non-scaling-stroke"/>`;
  return out;
}
/** Vadi görselinin dünya üzerindeki kutusu (content/map.ts'teki yerler buna göre). */
const VALLEY = { x: 384, y: 497, w: 220, h: 330 };
const VILLAGE: [number, number] = [494, 662];
/** Çizilmiş harita görselleri: ülke tüm dünyayı, vadi yakınlaşınca belirir. */
function paintedTerrain(): string | null {
  const ulke = artUrl("harita_ulke"), vadi = artUrl("harita_vadi");
  if (!ulke) return null;
  const vw = 933; // 2:3 görsel 1400 boyda
  return `<rect x="-400" y="-400" width="${W + 800}" height="${H + 800}" fill="#E9DFC6"/>
    <image href="${ulke}" x="${(W - vw) / 2}" y="0" width="${vw}" height="${H}" preserveAspectRatio="none"/>
    ${vadi ? `<defs><radialGradient id="vadiFade"><stop offset="0.72" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient><mask id="vadiMask"><rect x="${VALLEY.x}" y="${VALLEY.y}" width="${VALLEY.w}" height="${VALLEY.h}" fill="url(#vadiFade)"/></mask></defs>
    <image class="valley-art" href="${vadi}" x="${VALLEY.x}" y="${VALLEY.y}" width="${VALLEY.w}" height="${VALLEY.h}" preserveAspectRatio="none" mask="url(#vadiMask)"/>` : ""}`;
}
function terrain(): string {
  if (terrainCache) return terrainCache;
  const painted = paintedTerrain(); if (painted) return (terrainCache = painted);
  const land = roughPath([[120, 40], [600, 20], [930, 80], [980, 400], [940, 800], [960, 1150], [820, 1370], [420, 1380], [150, 1330], [60, 1150], [110, 900], [40, 600], [90, 300]], 18, 4, true);
  const river = `M430,300 C470,420 410,520 470,640 C510,720 430,780 452,906 C470,1000 330,1040 260,1120 C200,1180 120,1230 70,1260`;
  let fields = "";
  for (let i = 0; i < 9; i++) { const x = 480 + hash(i, 3) * 140, y = 870 + hash(i, 5) * 60; fields += `<rect x="${x}" y="${y}" width="${12 + hash(i, 9) * 14}" height="${8 + hash(i, 11) * 8}" fill="${i % 2 ? "#D7CE9A" : "#CFC48A"}" stroke="#8E8454" stroke-width=".7" vector-effect="non-scaling-stroke" transform="rotate(${(hash(i, 2) - 0.5) * 30} ${x} ${y})"/>`; }
  let houses = "";
  for (let i = 0; i < 14; i++) { const x = 518 + hash(i, 21) * 70, y = 842 + hash(i, 22) * 40; houses += `<path d="M${x - 3},${y} L${x - 3},${y - 4} L${x},${y - 7} L${x + 3},${y - 4} L${x + 3},${y} Z" fill="#E8D9B4" stroke="#5B4630" stroke-width=".8" vector-effect="non-scaling-stroke"/><path d="M${x - 3.6},${y - 4} L${x},${y - 7.5} L${x + 3.6},${y - 4}" fill="none" stroke="#9E3423" stroke-width="1" vector-effect="non-scaling-stroke"/>`; }
  let waves = "";
  for (let i = 0; i < 14; i++) { const x = 30 + hash(i, 31) * 120, y = 1000 + hash(i, 32) * 380; waves += `<path d="M${x},${y} q5,-4 10,0 t10,0" fill="none" stroke="#7E9EA6" stroke-width="1" vector-effect="non-scaling-stroke"/>`; }
  terrainCache = `
    <rect x="-400" y="-400" width="${W + 800}" height="${H + 800}" fill="#B9CDD0"/>${waves}
    <path d="${land}" fill="#E6DCC0" stroke="#5B5447" stroke-width="1.6" vector-effect="non-scaling-stroke"/>
    <path d="M150,1100 C220,1060 300,1130 360,1180" fill="none" stroke="#C9BC93" stroke-width="30" stroke-linecap="round" opacity=".5"/>
    ${mountains(180, 840, 140, 480, 46, 11, true)}
    ${mountains(420, 640, 650, 715, 9, 23)}
    ${mountains(700, 900, 860, 1060, 10, 37)}
    <path d="${river}" fill="none" stroke="#7FA9B8" stroke-width="7" stroke-linecap="round"/>
    <path d="${river}" fill="none" stroke="#4E7F8F" stroke-width="1.2" vector-effect="non-scaling-stroke"/>
    ${forest(615, 800, 32, 26, 26, 41)}${forest(720, 700, 70, 50, 50, 43)}${forest(330, 760, 60, 45, 30, 47)}${forest(620, 1150, 80, 50, 40, 53)}
    ${fields}${houses}
    <circle cx="540" cy="858" r="4" fill="#A9C7D0" stroke="#4E7F8F" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
  return terrainCache;
}

/* ---------- yer simgeleri ---------- */
function placeIcon(p: Place, sz: number, locked: boolean): string {
  const c = locked ? "#8B8270" : "#2A2722"; const f = locked ? "#D9D0B8" : "#F3ECDA";
  const k = sz / 20;
  const t = (d: string, fill = f) => `<path d="${d}" fill="${fill}" stroke="${c}" stroke-width="1.4" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>`;
  let g = "";
  switch (p.icon) {
    case "dag": g = t("M-10,6 L-3,-8 L2,-1 L5,-5 L11,6 Z") + `<circle cx="-2" cy="3" r="2" fill="#FFF" stroke="${c}" stroke-width="1" vector-effect="non-scaling-stroke"/><circle cx="3" cy="4" r="1.8" fill="#FFF" stroke="${c}" stroke-width="1" vector-effect="non-scaling-stroke"/>`; break;
    case "ev": g = t("M-7,7 L-7,-1 L0,-8 L7,-1 L7,7 Z") + t("M-2,7 L-2,2 L2,2 L2,7", "#8B6A3A"); break;
    case "meydan": g = t("M-8,4 A8,4 0 0 0 8,4 L8,0 A8,4 0 0 0 -8,0 Z", "#A9C7D0") + t("M-2,0 L-2,-8 L2,-8 L2,0", "#CFC9B9"); break;
    case "ocak": g = t("M-8,0 L8,0 L5,4 L-5,4 Z", "#8B8576") + t("M-3,4 L3,4 L4,8 L-4,8 Z", "#8B8576") + `<path d="M-1,-2 Q1,-8 3,-3" fill="#E07A2E" stroke="${c}" stroke-width="1" vector-effect="non-scaling-stroke"/>`; break;
    case "dere": g = `<path d="M-9,-2 q4.5,-4 9,0 t9,0 M-9,4 q4.5,-4 9,0 t9,0" fill="none" stroke="#4E7F8F" stroke-width="2" vector-effect="non-scaling-stroke"/>`; break;
    case "koru": g = t("M0,-9 C8,-9 9,1 3,3 L3,8 L-3,8 L-3,3 C-9,1 -8,-9 0,-9 Z", "#7C9A5E"); break;
    case "sehir": g = t("M-10,8 L-10,-2 L-5,-6 L0,-2 L0,8 Z") + t("M0,8 L0,-6 L5,-10 L10,-6 L10,8 Z"); break;
    case "kale": g = t("M-9,8 L-9,-6 L-6,-6 L-6,-9 L-3,-9 L-3,-6 L3,-6 L3,-9 L6,-9 L6,-6 L9,-6 L9,8 Z", locked ? "#E3E8EA" : f); break;
  }
  return `<g transform="translate(${p.x},${p.y}) scale(${k})">${g}</g>`;
}

export interface MapHooks { onTravel: (to: string) => void; onAct: (act: string, id: string) => void; onTurnBack: () => void }
type View = { cx: number; cy: number; w: number };
const LEVELS: Record<string, (s: GameState) => View> = {
  // alttaki bilgi kartı haritanın altını örttüğü için merkezler biraz aşağı kaydırıldı
  koy: s => ({ cx: place(s.location)!.x, cy: place(s.location)!.y + 55, w: 230 }),
  vadi: () => ({ cx: VALLEY.x + VALLEY.w / 2, cy: VALLEY.y + VALLEY.h / 2 + 40, w: 300 }),
  ulke: () => ({ cx: 500, cy: 760, w: 1000 }),
};

export function mountMap(host: HTMLElement, cfg: Config, s: GameState, hooks: MapHooks, saved?: { view?: View; sel?: string }): { state: () => { view: View; sel?: string }; refresh: () => void } {
  host.innerHTML = `<div class="map-wrap"><svg class="map-svg" aria-label="Harita"><g class="terrain">${terrain()}</g><g class="dyn"></g></svg>
    <div class="map-zoom"><button data-z="koy">Köy</button><button data-z="vadi">Vadi</button><button data-z="ulke">Ülke</button></div>
    <div class="map-card" id="mapCard"></div></div>`;
  const svg = host.querySelector<SVGSVGElement>("svg")!; const dyn = host.querySelector<SVGGElement>(".dyn")!;
  const card = host.querySelector<HTMLElement>("#mapCard")!;
  let view: View = saved?.view ?? LEVELS.koy(s);
  let sel: string | undefined = saved?.sel ?? s.location;
  let walker: { x: number; y: number; trail: [number, number][] } | null = null;
  const busy = false;
  /** Yolculuk sürüyorsa figürün yerini ve geçilen izi hesapla. */
  function syncWalker() {
    if (!s.journey) { walker = null; return; }
    const j = s.journey; const now = Date.now(); const [x, y] = journeyPoint(s, now); const f = journeyProgress(s, now);
    const segs = j.pts.slice(1).map((p, i) => Math.hypot(p[0] - j.pts[i][0], p[1] - j.pts[i][1]));
    let d = f * segs.reduce((a, b) => a + b, 0); let i = 0; while (i < segs.length - 1 && d > segs[i]) { d -= segs[i]; i++; }
    walker = { x, y, trail: [...j.pts.slice(0, i + 1), [x, y]] };
  }

  const aspect = () => { const r = svg.getBoundingClientRect(); return r.height / Math.max(1, r.width) || 1.3; };
  function applyView() {
    view.w = Math.max(120, Math.min(1150, view.w));
    const h = view.w * aspect();
    view.cx = Math.max(0, Math.min(W, view.cx)); view.cy = Math.max(0, Math.min(H, view.cy));
    svg.setAttribute("viewBox", `${view.cx - view.w / 2} ${view.cy - h / 2} ${view.w} ${h}`);
    const va = svg.querySelector<SVGImageElement>(".valley-art"); if (va) va.style.opacity = String(Math.max(0, Math.min(1, (700 - view.w) / 300)));
    drawDyn();
    host.querySelectorAll<HTMLButtonElement>("[data-z]").forEach(b => b.classList.toggle("on", Math.abs(LEVELS[b.dataset.z!](s).w - view.w) < 30));
  }
  function drawDyn() {
    const k = view.w / 300; // ölçek: yazı ve simgeler ekranda aynı boyda kalsın
    const fs = 11 * k, icon = 16 * k;
    let out = "";
    // akşam ve gece haritanın üstüne gölge düşer
    const dk = darkness(s.minute);
    if (dk > 0.01) out += `<rect x="-400" y="-400" width="1800" height="2200" fill="#141A30" opacity="${(dk * 0.5).toFixed(2)}" pointer-events="none"/>`;
    for (const r of ROADS) {
      const open = isOpen(place(r.a)!, s) && isOpen(place(r.b)!, s);
      const sa = isSeen(s, r.a), sb = isSeen(s, r.b);
      if (!sa && !sb) continue;
      if (!sa || !sb) {
        // bilinmeyen yere giden yol: sadece başı görünür, sonu sise karışır
        const pts = sa ? r.pts : [...r.pts].reverse(); const half = pts.slice(0, Math.max(2, Math.ceil(pts.length / 2)));
        const end = half[half.length - 1];
        out += `<path d="M${half.map(p => p.join(",")).join(" L")}" fill="none" stroke="#6B5235" stroke-width="1.6" stroke-dasharray="2 4" opacity=".55" vector-effect="non-scaling-stroke"/>`;
        out += `<text x="${end[0]}" y="${end[1] + fs * 0.4}" font-size="${fs * 1.4}" text-anchor="middle" class="map-label faint">?</text>`;
        continue;
      }
      out += `<path d="M${r.pts.map(p => p.join(",")).join(" L")}" fill="none" stroke="${open ? "#6B5235" : "#A79C82"}" stroke-width="${r.kind === "yol" ? 2.2 : 1.6}" stroke-dasharray="${r.kind === "yol" ? "6 3" : "3 3"}" vector-effect="non-scaling-stroke" ${open ? "" : 'opacity=".6"'}/>`;
    }
    // seçili yere giden yol
    if (sel && sel !== s.location && !walker) {
      const p = planTravel(cfg, s, sel);
      if (p.pts.length) out += `<path d="M${p.pts.map(q => q.join(",")).join(" L")}" fill="none" stroke="${p.ok ? "#9E3423" : "#8B8270"}" stroke-width="3" stroke-dasharray="1 5" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
    }
    if (s.journey) out += `<path d="M${s.journey.pts.map(q => q.join(",")).join(" L")}" fill="none" stroke="#9E3423" stroke-width="3" stroke-dasharray="1 5" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
    if (walker && walker.trail.length > 1) out += `<path d="M${walker.trail.map(q => q.join(",")).join(" L")}" fill="none" stroke="#9E3423" stroke-width="3" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
    const regionLabels = view.w > 420;
    for (const p of PLACES) {
      if (!isSeen(s, p.id)) continue;
      const locked = !isOpen(p, s);
      if (!locked && view.w > 700 && !p.hub) continue; // ülke ölçeğinde köy içi yerler tek etikette toplanır
      out += placeIcon(p, icon * (locked ? 1.4 : 1), locked);
      if (sel === p.id) out += `<circle cx="${p.x}" cy="${p.y}" r="${icon * 0.85}" fill="none" stroke="#9E3423" stroke-width="2" stroke-dasharray="3 2" vector-effect="non-scaling-stroke"/>`;
      if (!locked || regionLabels) out += `<text x="${p.x}" y="${p.y + icon * 0.95}" font-size="${fs * (locked ? 1.3 : 1)}" text-anchor="middle" class="map-label">${esc(locked ? p.name + " ?" : p.name)}</text>`;
    }
    if (view.w > 700) {
      out += `<circle cx="${VILLAGE[0]}" cy="${VILLAGE[1]}" r="${10 * k}" fill="#F3ECDA" stroke="#2A2722" stroke-width="1.4" vector-effect="non-scaling-stroke"/><text x="${VILLAGE[0]}" y="${VILLAGE[1] + 24 * k}" font-size="${fs * 1.3}" text-anchor="middle" class="map-label">Taşpınar vadisi</text>`;
      out += `<text x="314" y="202" font-size="${fs * 1.6}" text-anchor="middle" class="map-label faint">Kuzey Dağları</text><text x="146" y="1234" font-size="${fs * 1.4}" text-anchor="middle" class="map-label faint">Tuz Denizi</text>`;
    }
    // oyuncu
    const me = walker ?? { x: place(s.location)!.x, y: place(s.location)!.y };
    const pk = 14 * k;
    out += `<g transform="translate(${me.x},${me.y - pk * 0.2})"><ellipse cx="0" cy="${pk * 0.15}" rx="${pk * 0.5}" ry="${pk * 0.18}" fill="rgba(42,39,34,.25)"/>
      <path d="M0,0 L${-pk * 0.35},${-pk * 0.9} A${pk * 0.42},${pk * 0.42} 0 1 1 ${pk * 0.35},${-pk * 0.9} Z" fill="#2E4C7A" stroke="#F3ECDA" stroke-width="1.6" vector-effect="non-scaling-stroke"/>
      <circle cx="0" cy="${-pk * 1.05}" r="${pk * 0.17}" fill="#F3ECDA"/></g>`;
    dyn.innerHTML = out;
  }

  /** Buradayken yapılabilecekler: kart üzerinden doğrudan (İşler'e gitmeden). */
  function hereActions(): string {
    const acts = placeActions(cfg, s, s.location);
    if (!acts.length) {
      const n = nextHint(s);
      return `<p class="hand blue" style="margin:0">Burada şu an yapacak bir şey yok.</p>${n ? `<div class="here-act next"><div><b>${esc(n.label)}</b>${n.sub ? `<div class="tiny muted">${esc(n.sub)}</div>` : ""}</div>${n.id ? `<button class="btn small blue" data-sel="${n.id}">Haritada göster</button>` : ""}</div>` : ""}`;
    }
    const n = acts.some(x => x.primary) ? null : nextHint(s);
    const nextRow = n && n.id ? `<div class="here-act next"><div><b>${esc(n.label)}</b>${n.sub ? `<div class="tiny muted">${esc(n.sub)}</div>` : ""}</div><button class="btn small blue" data-sel="${n.id}">Göster</button></div>` : "";
    return `<div class="here-acts">${nextRow}${acts.map(x => `<div class="here-act${x.primary ? " main" : ""}"><div><b>${esc(x.label)}</b>${x.sub ? `<div class="tiny muted">${esc(x.sub)}</div>` : ""}${x.disabled ? `<div class="tiny red">${esc(x.disabled)}</div>` : ""}</div>
      <button class="btn small ${x.primary ? "red" : x.act === "accept" ? "primary" : ""}" data-act="${x.act}" data-id="${esc(x.id)}" ${x.disabled ? "disabled" : ""}>${x.act === "accept" ? "Üstlen" : x.act === "fight" ? "Hazırlan" : x.act === "walk" ? "Yap" : x.act === "deliver" ? "Ver" : x.act === "search" ? "Ara" : x.act === "market" ? "Aç" : "Başla"}</button></div>`).join("")}</div>`;
  }
  function renderCard() {
    if (s.journey) {
      const j = s.journey; const now = Date.now(); const f = journeyProgress(s, now);
      card.innerHTML = `<div class="entry-head"><span class="entry-title">${j.back ? "Geri dönüyorsun" : "Yoldasın"}: ${esc(place(j.to)!.name)}</span><span class="entry-meta">${fmtDur(journeyLeftMs(s, now))} kaldı</span></div>
        <div class="gb big"><div class="gf" style="width:${(f * 100).toFixed(1)}%;background:var(--green)"></div></div>
        <p class="muted tiny" style="margin:0">${j.pausedAt !== undefined ? "Yolda bir şey oldu; karar vermeni bekliyor." : `Oyunda ${Math.round(j.minutes)} dk yol. Yolda bir şey çıkarsa sen karar verene kadar beklersin.`}</p>
        ${j.back ? "" : `<div class="row"><button class="btn small" data-back="1">Geri dön</button></div>`}`;
      return;
    }
    if (!sel) { card.innerHTML = ""; return; }
    const p = place(sel)!; const at = sel === s.location;
    const people = peopleAt(sel).map(id => NPCS.find(n => n.id === id)!).filter(Boolean);
    const known = (id: string) => s.metNpcs.includes(id);
    const quests = QUESTS.filter(q => q.at === sel && (s.quests[q.id]?.status === "aktif"));
    if (!isOpen(p, s)) {
      card.innerHTML = `<div class="entry-head"><span class="entry-title">${esc(p.name)}</span><span class="entry-meta">${esc(p.chapter ?? "")}</span></div><p class="tiny" style="margin:0">${esc(p.desc)}</p><p class="muted tiny" style="margin:0">Henüz buraya gidemezsin.</p>`;
      return;
    }
    const plan = at ? null : planTravel(cfg, s, sel);
    const peopleRow = people.length ? `<div class="row">${people.map(n => `<span class="person">${personPic(n, 30, known(n.id))}<span class="tiny">${known(n.id) ? esc(n.name) : "?"}</span></span>`).join("")}</div>` : "";
    card.classList.toggle("here", at);
    card.innerHTML = at
      // buradayken: önce yapılabilecekler, sonra yer bilgisi
      ? `<div class="entry-head"><span class="entry-title">${esc(p.name)}</span><span class="entry-meta">buradasın</span></div>
        ${hereActions()}
        ${peopleRow}
        <details class="place-more"><summary class="tiny muted">Bu yer hakkında</summary>${placePic(sel, p.name, "art-thumb")}<p class="tiny" style="margin:0">${esc(p.desc)}</p></details>`
      : `${placePic(sel, p.name, "art-thumb")}<div class="entry-head"><span class="entry-title">${esc(p.name)}</span><span class="entry-meta">${plan ? `${plan.minutes} dk yol · enerji −${plan.energy}` : ""}</span></div>
        <p class="tiny" style="margin:0">${esc(p.desc)}</p>${peopleRow}
        ${(() => { const acts = placeActions(cfg, s, sel); return acts.length ? `<p class="tiny" style="margin:0"><b>Orada:</b> ${acts.slice(0, 3).map(x => esc(x.label)).join(" · ")}${acts.length > 3 ? " …" : ""}</p>` : ""; })()}
        <div class="row"><button class="btn primary" data-go="${sel}" ${plan?.ok && !busy ? "" : "disabled"}>Git</button>${plan && !plan.ok ? `<span class="lock">${esc(plan.reason ?? "")}</span>` : ""}</div>`;
  }

  /* ---------- sürükle, kıstır, tekerlek ---------- */
  const ptrs = new Map<number, { x: number; y: number }>(); let moved = 0; let pinch0 = 0, w0 = 0;
  const toWorld = (px: number, py: number) => { const r = svg.getBoundingClientRect(); const h = view.w * aspect(); return { x: view.cx - view.w / 2 + (px - r.left) / r.width * view.w, y: view.cy - h / 2 + (py - r.top) / r.height * h }; };
  svg.addEventListener("pointerdown", e => { svg.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); w0 = view.w; } });
  svg.addEventListener("pointermove", e => {
    const p = ptrs.get(e.pointerId); if (!p || busy) return;
    if (ptrs.size === 1) {
      const r = svg.getBoundingClientRect(); const dx = e.clientX - p.x, dy = e.clientY - p.y; moved += Math.abs(dx) + Math.abs(dy);
      view.cx -= dx / r.width * view.w; view.cy -= dy / r.height * view.w * aspect(); applyView();
    }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0) { view.w = w0 * pinch0 / d; moved += 10; applyView(); } }
  });
  const up = (e: PointerEvent) => {
    const wasTap = ptrs.size === 1 && moved < 8; ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = 0;
    if (!wasTap || busy) return;
    const w = toWorld(e.clientX, e.clientY); const k = view.w / 300;
    let best: Place | undefined, bd = Infinity;
    for (const p of PLACES) { if ((isOpen(p, s) && view.w > 700 && !p.hub) || !isSeen(s, p.id)) continue; const d = Math.hypot(p.x - w.x, p.y - w.y); if (d < bd) { bd = d; best = p; } }
    if (view.w > 700 && Math.hypot(VILLAGE[0] - w.x, VILLAGE[1] - w.y) < 30 * k) { view = LEVELS.vadi(s); applyView(); return; }
    if (best && bd < 26 * k) { sel = best.id; renderCard(); drawDyn(); }
  };
  svg.addEventListener("pointerup", up); svg.addEventListener("pointercancel", up);
  svg.addEventListener("wheel", e => { e.preventDefault(); view.w *= Math.exp(e.deltaY * 0.0015); applyView(); }, { passive: false });

  host.addEventListener("click", e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button"); if (!b || b.disabled) return;
    if (b.dataset.z) { const target = LEVELS[b.dataset.z](s); zoomTo(target); }
    if (b.dataset.go) hooks.onTravel(b.dataset.go);
    if (b.dataset.back) hooks.onTurnBack();
    if (b.dataset.qa) hooks.onAct("quest", b.dataset.qa);
    if (b.dataset.sel) { sel = b.dataset.sel; const p = place(sel); if (p) zoomTo({ cx: p.x, cy: p.y + 55, w: Math.max(view.w, 300) }); renderCard(); drawDyn(); }
  });
  function zoomTo(t: View) {
    const from = { ...view }; const dur = 380 * animScale(); const t0 = performance.now();
    const step = (now: number) => { const f = dur ? Math.min(1, (now - t0) / dur) : 1; const e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
      view = { cx: from.cx + (t.cx - from.cx) * e, cy: from.cy + (t.cy - from.cy) * e, w: from.w + (t.w - from.w) * e }; applyView(); if (f < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  new ResizeObserver(() => applyView()).observe(svg);
  syncWalker(); applyView(); renderCard();
  return {
    state: () => ({ view, sel }),
    refresh: () => {
      syncWalker();
      // yürüyen figür ekrandan çıkmasın
      if (walker) { const h = view.w * aspect(); if (Math.abs(walker.x - view.cx) > view.w * 0.35 || Math.abs(walker.y - view.cy) > h * 0.3) { view.cx += (walker.x - view.cx) * 0.5; view.cy += (walker.y + view.w * 0.2 - view.cy) * 0.5; } }
      applyView(); renderCard();
    },
  };
}
