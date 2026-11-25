// Savaş haritası çizici: eğik (3/4) bakış, ayakta duran figürler, arazi nesneleri ve canlandırmalar.
// Savaş ekranı ve hazırlık ekranı aynı çiziciyi kullanır.
import { TERRAIN, ENEMIES, type Terrain } from "../content/world";
import type { Unit, Weather, XY } from "../engine/combat";
import { animScale } from "./settings";
import { artUrl } from "./art";

const SQ3 = Math.sqrt(3);
const TAU = Math.PI * 2;
const reducedMotion = () => animScale() === 0;
function hash(x: number, y: number) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const ease = (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

const SIDE: Record<Terrain, string> = { cayir: "#9C9A68", uzun_ot: "#7F8C52", camur: "#6F5A3C", kaya: "#8B8576", tepe: "#8C7744", su: "#4E7F8F", agac: "#5E7545" };

export interface MapView {
  w: number; h: number; tiles: Terrain[][];
  fire: Record<string, number>; walls: Record<string, number>; traps: Record<string, number>;
  weather: Weather; night: boolean; wind?: { dir: number; strength: number } | null;
  units: Unit[];
  sight?: { at: XY; range: number } | null;    // görüş dışı karartılır
  torchLit?: boolean;
}
export interface Overlay {
  reach?: Set<string>; threat?: Map<string, number>; range?: Set<string>; area?: Set<string>;
  markers?: { at: XY; label: string; active?: boolean }[]; unknown?: XY[];
  selected?: string | null; hiddenUnits?: Set<string>; trapMode?: boolean;
}
interface DS { x: number; y: number; face: number; alpha: number; lying: number; offX: number; offY: number; flash: number; walk: number; pose?: "defend" | "swing" | "leap" }
interface Floater { x: number; y: number; text: string; color: string; size: number; t0: number; dur: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; t0: number; color: string }
interface Projectile { from: { x: number; y: number }; to: { x: number; y: number }; t0: number; dur: number; kind: "ates" | "mesale" | "buz" | "genel" }
interface Tween { t0: number; dur: number; step: (t: number) => void; done: () => void }

export class MapRenderer {
  private ctx: CanvasRenderingContext2D;
  view!: MapView; over: Overlay = {};
  size = 20; sy = 0.6; thick = 6; ox = 0; oy = 0; cw = 0; ch = 0;
  private ds = new Map<string, DS>();
  private locked = false;
  private floaters: Floater[] = []; private parts: Particle[] = []; private projs: Projectile[] = [];
  private tweens: Tween[] = []; private hiddenFire = new Set<string>();
  private shakeT = 0; private shakeAmp = 6; private raf = 0; private now = 0;
  private splats: { x: number; y: number; r: number; t0: number; color: string; seed: number }[] = [];
  private slashes: { x1: number; y1: number; x2: number; y2: number; t0: number; color: string }[] = [];
  private zoom: { x: number; y: number; t0: number; k: number } | null = null;
  private imgs = new Map<string, HTMLImageElement | null>();
  /** Poz görseli (src/assets/art/poz_*.webp ya da dusman_*.webp); yoksa null ve kodla çizilir. */
  private img(key: string): HTMLImageElement | null {
    if (!this.imgs.has(key)) { const u = artUrl(key); this.imgs.set(key, u ? Object.assign(new Image(), { src: u }) : null); }
    const im = this.imgs.get(key)!; return im && im.complete && im.naturalWidth ? im : null;
  }
  constructor(private canvas: HTMLCanvasElement) { this.ctx = canvas.getContext("2d")!; }

  /* ---------- yerleşim ---------- */
  layout() {
    const r = this.canvas.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(r.width * dpr); this.canvas.height = Math.round(r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cw = r.width; this.ch = r.height;
    const { w, h } = this.view;
    const byW = r.width / (SQ3 * (w + 0.5));
    const byH = r.height / ((1.5 * (h - 1) + 2) * this.sy + 1.6); // üstte ağaç/figür payı
    this.size = Math.min(byW, byH) * 0.98;
    this.thick = this.size * 0.26;
    const tw = SQ3 * this.size * (w + 0.5), th = (1.5 * (h - 1) + 2) * this.size * this.sy;
    this.ox = (r.width - tw) / 2 + SQ3 * this.size / 2;
    this.oy = (r.height - th) / 2 + this.size * this.sy + this.size * 0.5;
  }
  lift(t: Terrain) { return t === "tepe" ? this.size * 0.34 : t === "su" ? -this.size * 0.08 : 0; }
  center(x: number, y: number) {
    const t = this.view.tiles[y]?.[x] ?? "cayir";
    return { cx: this.ox + SQ3 * this.size * (x + (y & 1 ? 0.5 : 0)), cy: this.oy + 1.5 * this.size * y * this.sy - this.lift(t) };
  }
  pick(clientX: number, clientY: number): XY | null {
    const r = this.canvas.getBoundingClientRect(); const mx = clientX - r.left, my = clientY - r.top;
    let best: XY | null = null, bd = Infinity;
    for (let y = 0; y < this.view.h; y++) for (let x = 0; x < this.view.w; x++) {
      const { cx, cy } = this.center(x, y); const d = Math.hypot(cx - mx, (cy - my) / this.sy);
      if (d < bd) { bd = d; best = [x, y]; }
    }
    return best && bd < this.size * 1.05 ? best : null;
  }

  /* ---------- birim görüntü durumu ---------- */
  private dsOf(u: Unit): DS {
    let d = this.ds.get(u.uid);
    if (!d) { const c = this.center(u.x, u.y); d = { x: c.cx, y: c.cy, face: u.side === "player" ? 1 : -1, alpha: 1, lying: 0, offX: 0, offY: 0, flash: 0, walk: 0 }; this.ds.set(u.uid, d); }
    return d;
  }
  private sync() {
    if (this.locked) return;
    for (const u of this.view.units) { const d = this.dsOf(u); const c = this.center(u.x, u.y); d.x = c.cx; d.y = c.cy; if (u.hp > 0 && !u.fled) { d.alpha = 1; d.lying = 0; } }
  }
  /** Canlandırma boyunca birimler motorun yeni konumuna atlamasın. */
  lock(on: boolean) { this.locked = on; if (!on) { this.hiddenFire.clear(); this.sync(); } }
  hideFire(k: string) { this.hiddenFire.add(k); }
  showFire(k: string) { this.hiddenFire.delete(k); }
  setPose(uid: string, pose?: DS["pose"]) { const d = this.ds.get(uid); if (d) d.pose = pose; }

  /* ---------- canlandırmalar (Promise döner) ---------- */
  private tween(dur: number, step: (t: number) => void): Promise<void> {
    if (reducedMotion()) { step(1); return Promise.resolve(); }
    return new Promise(res => this.tweens.push({ t0: performance.now(), dur: dur * animScale(), step, done: res }));
  }
  wait(ms: number) { return reducedMotion() ? Promise.resolve() : new Promise<void>(r => setTimeout(r, ms * animScale())); }
  async animMove(uid: string, path: XY[]) {
    const d = this.ds.get(uid); if (!d || path.length < 2) return;
    for (let i = 1; i < path.length; i++) {
      const a = this.center(...path[i - 1]), b = this.center(...path[i]);
      if (Math.abs(b.cx - a.cx) > 1) d.face = b.cx > a.cx ? 1 : -1;
      await this.tween(150, t => { d.x = a.cx + (b.cx - a.cx) * t; d.y = a.cy + (b.cy - a.cy) * t - Math.sin(t * Math.PI) * this.size * 0.08; d.walk += 0.35; });
    }
  }
  async animAttack(uid: string, targetUid: string, res: { hit: boolean; crit: boolean; dmg: number; power?: boolean; ambush?: boolean }) {
    const a = this.ds.get(uid), b = this.ds.get(targetUid); if (!a || !b) return;
    a.face = b.x >= a.x ? 1 : -1;
    const wolf = uid !== "p";
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, reach = this.size * (wolf ? 0.7 : res.power ? 0.55 : 0.38);
    a.pose = wolf ? "leap" : "swing";
    const dur = wolf ? 420 : res.power ? 420 : 320;
    // 1) atılış: kurt yay çizerek sıçrar, insan öne savurur
    await this.tween(dur * 0.55, t => { const k = ease(t); a.offX = dx / L * reach * k; a.offY = dy / L * reach * k - (wolf ? Math.sin(t * Math.PI / 2) * this.size * 0.45 : 0); });
    // 2) çarpma anı
    const hx = b.x, hy = b.y - this.size * 0.4;
    if (res.hit) {
      b.flash = 1;
      const big = res.crit || (wolf && res.dmg >= 5);
      this.shake(big ? 11 : 5, big ? 380 : 240);
      this.burst(hx, hy, res.crit ? "#9E3423" : wolf ? "#9E3423" : "#5B5447", res.crit ? 22 : 9);
      this.splat(hx, hy + this.size * 0.4, res.crit ? this.size * 0.5 : this.size * 0.28, wolf ? "rgba(140,30,20,.55)" : "rgba(42,39,34,.55)");
      if (!wolf) { const nx = -dy / L, ny = dx / L; this.slashes.push({ x1: hx - nx * this.size * 0.7 - dx / L * this.size * 0.3, y1: hy - ny * this.size * 0.7, x2: hx + nx * this.size * 0.7 + dx / L * this.size * 0.3, y2: hy + ny * this.size * 0.7, t0: performance.now(), color: res.crit ? "#9E3423" : "#2A2722" }); }
      if (res.crit) this.zoom = { x: hx, y: hy, t0: performance.now(), k: 0.28 };
    }
    const txt = !res.hit ? "ıska" : `${res.crit ? "Kritik! " : ""}−${res.dmg}`;
    this.float(b.x, b.y - this.size * 0.9, (res.ambush && res.hit ? "Pusu! " : "") + txt, !res.hit ? "#8B8270" : res.crit || wolf ? "#9E3423" : "#2A2722", res.crit ? 1.7 : res.hit ? 1.2 : 1);
    if (res.crit) await this.wait(170); // vuruş anı kısa bir duraksama
    // 3) geri çekilme
    const ox = a.offX, oy = a.offY;
    await this.tween(dur * 0.45, t => { const k = 1 - ease(t); a.offX = ox * k; a.offY = oy * k; });
    a.offX = a.offY = 0; a.pose = undefined;
  }
  /** Yere mürekkep/kan lekesi: birkaç saniyede solar. */
  splat(x: number, y: number, r: number, color: string) { this.splats.push({ x, y, r, t0: performance.now(), color, seed: Math.random() * 1000 }); if (this.splats.length > 30) this.splats.shift(); }
  async animProjectile(from: XY, to: XY, kind: Projectile["kind"]) {
    const a = this.center(...from), b = this.center(...to);
    const p: Projectile = { from: { x: a.cx, y: a.cy - this.size * 0.5 }, to: { x: b.cx, y: b.cy - this.size * 0.2 }, t0: performance.now(), dur: 450 * animScale(), kind };
    if (reducedMotion()) return;
    this.projs.push(p);
    await this.wait(p.dur);
    this.burst(b.cx, b.cy - this.size * 0.2, kind === "buz" ? "#9FD3E8" : "#D66C28", 18);
  }
  async animPush(uid: string, to: XY, ok: boolean) {
    const d = this.ds.get(uid); if (!d) return;
    const b = this.center(...to); const ax = d.x, ay = d.y;
    if (!ok) { await this.tween(200, t => { d.offX = Math.sin(t * Math.PI * 3) * 3; }); d.offX = 0; return; }
    await this.tween(240, t => { const e = ease(t); d.x = ax + (b.cx - ax) * e; d.y = ay + (b.cy - ay) * e - Math.sin(t * Math.PI) * this.size * 0.25; });
  }
  async animFlee(uid: string, awayFrom: { x: number; y: number }) {
    const d = this.ds.get(uid); if (!d) return;
    const dx = d.x - awayFrom.x, dy = d.y - awayFrom.y, L = Math.hypot(dx, dy) || 1;
    d.face = dx >= 0 ? 1 : -1; const sx = d.x, sy = d.y;
    await this.tween(650, t => { d.x = sx + dx / L * this.size * 3 * t; d.y = sy + dy / L * this.size * 2 * t; d.alpha = 1 - t; d.walk += 0.5; });
  }
  async animDown(uid: string) {
    const d = this.ds.get(uid); if (!d) return;
    await this.tween(500, t => { d.lying = t; });
    await this.tween(700, t => { d.alpha = 1 - t * 0.75; });
  }
  float(x: number, y: number, text: string, color: string, size = 1) {
    this.floaters.push({ x, y, text, color, size, t0: performance.now(), dur: 1100 });
  }
  floatAt(uid: string, text: string, color: string) { const d = this.ds.get(uid); if (d) this.float(d.x, d.y - this.size * 1.0, text, color); }
  flash(uid: string) { const d = this.ds.get(uid); if (d) d.flash = 1; }
  burst(x: number, y: number, color: string, n: number) {
    const t0 = performance.now();
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 0.4 + Math.random() * 1.4; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.8, life: 450 + Math.random() * 300, t0, color }); }
  }
  shake(amp = 6, _ms = 260) { this.shakeT = performance.now(); this.shakeAmp = amp; }

  /* ---------- döngü ---------- */
  start() { const loop = (t: number) => { this.frame(t); this.raf = requestAnimationFrame(loop); }; this.raf = requestAnimationFrame(loop); }
  stop() { cancelAnimationFrame(this.raf); }

  private frame(t: number) {
    this.now = t;
    for (const tw of [...this.tweens]) {
      const k = Math.min(1, (t - tw.t0) / tw.dur); tw.step(k);
      if (k >= 1) { this.tweens.splice(this.tweens.indexOf(tw), 1); tw.done(); }
    }
    this.sync();
    this.draw();
  }

  /* ---------- çizim ---------- */
  private hexPath(cx: number, cy: number, sz: number, wob = 0, seed = 0) {
    const c = this.ctx; c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 180 * (60 * i - 30); const j = wob ? (hash(seed + i, i * 7) - 0.5) * wob : 0;
      const px = cx + (sz + j) * Math.cos(a), py = cy + (sz + j) * Math.sin(a) * this.sy;
      i ? c.lineTo(px, py) : c.moveTo(px, py);
    }
    c.closePath();
  }
  /** Altıgenin ön yüzü (kalınlık): alt üç kenar aşağı uzatılır. */
  private sidePath(cx: number, cy: number, sz: number, depth: number) {
    const c = this.ctx; const pts: [number, number][] = [];
    for (const i of [0, 1, 2, 3]) { const a = Math.PI / 180 * (60 * i - 30); pts.push([cx + sz * Math.cos(a), cy + sz * Math.sin(a) * this.sy]); }
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) c.lineTo(p[0], p[1]);
    for (const p of [...pts].reverse()) c.lineTo(p[0], p[1] + depth);
    c.closePath();
  }

  private draw() {
    const c = this.ctx; const v = this.view; if (!v) return;
    c.save();
    c.clearRect(0, 0, this.cw, this.ch);
    if (this.shakeT && this.now - this.shakeT < 320) { const k = 1 - (this.now - this.shakeT) / 320; c.translate((Math.random() - 0.5) * this.shakeAmp * k, (Math.random() - 0.5) * this.shakeAmp * k); }
    if (this.zoom) { const k = (this.now - this.zoom.t0) / 650; if (k >= 1) this.zoom = null; else { const z = 1 + this.zoom.k * (k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8); c.translate(this.zoom.x, this.zoom.y); c.scale(z, z); c.translate(-this.zoom.x, -this.zoom.y); } }
    const sz = this.size * 0.985; const o = this.over;
    const sightOk = (x: number, y: number) => !v.sight || hexDist(v.sight.at[0], v.sight.at[1], x, y) <= v.sight.range;
    // birimleri satıra göre grupla (görüntü konumuna göre)
    const unitsByRow = new Map<number, Unit[]>();
    for (const u of v.units) {
      const d = this.dsOf(u);
      const alive = u.hp > 0 && !u.fled;
      if (!alive && d.alpha <= 0.02) continue;
      if (o.hiddenUnits?.has(u.uid)) continue;
      if (u.side === "enemy" && alive && !sightOk(u.x, u.y)) continue;
      const row = Math.max(0, Math.min(v.h - 1, Math.round((d.y - this.oy) / (1.5 * this.size * this.sy))));
      (unitsByRow.get(row) ?? unitsByRow.set(row, []).get(row)!).push(u);
    }
    for (let y = 0; y < v.h; y++) {
      // 1) zemin
      for (let x = 0; x < v.w; x++) {
        const t = v.tiles[y][x]; const info = TERRAIN[t]; const { cx, cy } = this.center(x, y); const seed = x * 31 + y * 17;
        const depth = this.thick + this.lift(t) + (t === "su" ? -this.thick * 0.3 : 0);
        this.sidePath(cx, cy, sz, Math.max(2, depth)); c.fillStyle = SIDE[t]; c.fill(); c.strokeStyle = "rgba(42,39,34,.45)"; c.lineWidth = 1; c.stroke();
        this.hexPath(cx, cy, sz, 1.4, seed);
        const g = c.createLinearGradient(cx, cy - sz * this.sy, cx, cy + sz * this.sy);
        g.addColorStop(0, "rgba(255,255,255,.22)"); g.addColorStop(1, "rgba(0,0,0,.05)");
        c.fillStyle = info.color; c.fill(); c.fillStyle = g; c.fill();
        c.strokeStyle = "rgba(42,39,34,.5)"; c.lineWidth = 1; c.stroke();
        this.groundDetail(t, cx, cy, sz, seed);
        const k = x + "," + y;
        if (o.threat?.has(k)) { this.hexPath(cx, cy, sz * 0.86); c.fillStyle = `rgba(158,52,35,${0.2 + 0.12 * (o.threat.get(k)! - 1)})`; c.fill(); c.strokeStyle = "rgba(158,52,35,.55)"; c.lineWidth = 1.2; c.stroke(); }
        if (o.reach?.has(k)) this.hatch(cx, cy, sz * 0.86, "rgba(46,76,122,.6)");
        if (o.range?.has(k)) { this.hexPath(cx, cy, sz * 0.82); c.setLineDash([3, 3]); c.strokeStyle = "rgba(158,52,35,.8)"; c.lineWidth = 1.3; c.stroke(); c.setLineDash([]); }
        if (o.area?.has(k)) { this.hexPath(cx, cy, sz * 0.9); c.fillStyle = "rgba(214,108,40,.35)"; c.fill(); }
        if (v.traps[k]) this.trapIcon(cx, cy);
      }
      // 2) bu satırın nesneleri ve birimleri (arkadan öne)
      for (let x = 0; x < v.w; x++) {
        const t = v.tiles[y][x]; const { cx, cy } = this.center(x, y); const k = x + "," + y;
        this.props(t, cx, cy, sz, x * 31 + y * 17);
        if (v.walls[k]) this.iceWall(cx, cy, sz);
        if (v.fire[k] && !this.hiddenFire.has(k)) this.flames(cx, cy, sz, x + y * 7);
      }
      for (const u of (unitsByRow.get(y) ?? []).sort((a, b) => this.dsOf(a).x - this.dsOf(b).x)) this.unit(u);
    }
    // 3) işaretler
    for (const m of o.markers ?? []) this.flag(m.at, m.label, !!m.active);
    for (const u of o.unknown ?? []) { const { cx, cy } = this.center(...u); c.font = `700 ${Math.round(this.size * 0.9)}px Caveat, cursive`; c.fillStyle = "rgba(158,52,35,.85)"; c.textAlign = "center"; c.fillText("?", cx, cy); }
    // 4) görüş dışı karartma, gece, sis
    if (v.sight) for (let y = 0; y < v.h; y++) for (let x = 0; x < v.w; x++) {
      if (sightOk(x, y)) continue;
      const { cx, cy } = this.center(x, y); const t = v.tiles[y][x];
      this.hexPath(cx, cy - this.size * (t === "agac" ? 0.4 : 0.1), sz * 1.08);
      c.fillStyle = v.night ? "rgba(24,28,44,.6)" : "rgba(240,240,236,.7)"; c.fill();
    }
    if (v.night) {
      const p = v.units.find(u => u.side === "player"); const d = p ? this.dsOf(p) : null;
      const g = c.createRadialGradient(d?.x ?? 0, d?.y ?? 0, this.size, d?.x ?? 0, d?.y ?? 0, this.size * ((v.sight?.range ?? 2) + 2) * 1.6);
      g.addColorStop(0, v.torchLit ? "rgba(255,190,110,.16)" : "rgba(255,210,150,.06)"); g.addColorStop(1, "rgba(18,22,40,.38)");
      c.fillStyle = g; c.fillRect(0, 0, this.cw, this.ch);
    }
    if (v.weather === "sis") { for (let i = 0; i < 5; i++) { const y = ((i * 97 + this.now * 0.01) % (this.ch + 80)) - 40; const g = c.createLinearGradient(0, y - 30, 0, y + 30); g.addColorStop(0, "rgba(245,245,240,0)"); g.addColorStop(0.5, "rgba(245,245,240,.22)"); g.addColorStop(1, "rgba(245,245,240,0)"); c.fillStyle = g; c.fillRect(0, y - 30, this.cw, 60); } }
    // 5) lekeler, kesikler, mermiler, parçacıklar, yazılar
    for (const sp of [...this.splats]) {
      const k = (this.now - sp.t0) / 3500; if (k >= 1) { this.splats.splice(this.splats.indexOf(sp), 1); continue; }
      c.globalAlpha = 1 - k; c.fillStyle = sp.color;
      for (let i = 0; i < 6; i++) { const a = hash(i, sp.seed | 0) * TAU, d = hash(sp.seed | 0, i) * sp.r; c.beginPath(); c.ellipse(sp.x + Math.cos(a) * d, sp.y + Math.sin(a) * d * 0.45, sp.r * (0.25 + hash(i, 7) * 0.35), sp.r * 0.18, 0, 0, TAU); c.fill(); }
      c.globalAlpha = 1;
    }
    for (const sl of [...this.slashes]) {
      const k = (this.now - sl.t0) / 320; if (k >= 1) { this.slashes.splice(this.slashes.indexOf(sl), 1); continue; }
      const e = Math.min(1, k * 3); c.globalAlpha = 1 - k; c.strokeStyle = sl.color; c.lineCap = "round";
      for (let i = 0; i < 3; i++) { c.lineWidth = (5 - i * 1.5) * (1 - k * 0.5); c.beginPath(); c.moveTo(sl.x1, sl.y1 + i * 3); c.lineTo(sl.x1 + (sl.x2 - sl.x1) * e, sl.y1 + (sl.y2 - sl.y1) * e + i * 3); c.stroke(); }
      c.globalAlpha = 1;
    }
    for (const p of [...this.projs]) {
      const k = (this.now - p.t0) / p.dur; if (k >= 1) { this.projs.splice(this.projs.indexOf(p), 1); continue; }
      const x = p.from.x + (p.to.x - p.from.x) * k, y = p.from.y + (p.to.y - p.from.y) * k - Math.sin(k * Math.PI) * this.size * 1.4;
      for (let i = 0; i < 6; i++) { const kk = Math.max(0, k - i * 0.03); const tx = p.from.x + (p.to.x - p.from.x) * kk, ty = p.from.y + (p.to.y - p.from.y) * kk - Math.sin(kk * Math.PI) * this.size * 1.4; c.beginPath(); c.arc(tx, ty, this.size * (0.16 - i * 0.02), 0, TAU); c.fillStyle = p.kind === "buz" ? `rgba(159,211,232,${0.7 - i * 0.1})` : `rgba(${230 - i * 10},${120 - i * 12},40,${0.75 - i * 0.11})`; c.fill(); }
      c.beginPath(); c.arc(x, y, this.size * 0.2, 0, TAU); c.fillStyle = p.kind === "buz" ? "#E6F4FA" : "#FFD27A"; c.fill();
    }
    for (const p of [...this.parts]) {
      const k = (this.now - p.t0) / p.life; if (k >= 1) { this.parts.splice(this.parts.indexOf(p), 1); continue; }
      const dt = (this.now - p.t0) / 16; c.globalAlpha = 1 - k; c.fillStyle = p.color;
      c.beginPath(); c.arc(p.x + p.vx * dt * 2, p.y + p.vy * dt * 2 + dt * dt * 0.03, 2, 0, TAU); c.fill(); c.globalAlpha = 1;
    }
    for (const f of [...this.floaters]) {
      const k = (this.now - f.t0) / f.dur; if (k >= 1) { this.floaters.splice(this.floaters.indexOf(f), 1); continue; }
      c.globalAlpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
      const pop = k < 0.12 ? 1.5 - k / 0.12 * 0.5 : 1;
      c.font = `700 ${Math.round(this.size * 0.75 * f.size * pop)}px Caveat, cursive`; c.textAlign = "center";
      c.lineWidth = 3; c.strokeStyle = "rgba(234,224,200,.95)"; c.strokeText(f.text, f.x, f.y - k * this.size * 0.9);
      c.fillStyle = f.color; c.fillText(f.text, f.x, f.y - k * this.size * 0.9); c.globalAlpha = 1;
    }
    if (v.weather === "yagmur") {
      c.strokeStyle = "rgba(46,76,122,.32)"; c.lineWidth = 1; const tt = this.now / 16;
      for (let i = 0; i < 110; i++) { const x = (hash(i, 3) * this.cw + tt * 0.9) % this.cw, y = (hash(i, 8) * this.ch + tt * 3.4) % this.ch; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 3, y + 11); c.stroke(); }
    }
    if (v.wind && v.wind.strength > 0) this.windArrow(v.wind.dir, v.wind.strength);
    c.restore();
  }

  private hatch(cx: number, cy: number, sz: number, color: string) {
    const c = this.ctx; c.save(); this.hexPath(cx, cy, sz); c.clip(); c.strokeStyle = color; c.lineWidth = 1.2;
    for (let i = -sz * 2; i < sz * 2; i += 6) { c.beginPath(); c.moveTo(cx + i, cy + sz); c.lineTo(cx + i + sz, cy - sz); c.stroke(); }
    c.restore();
  }
  private groundDetail(t: Terrain, cx: number, cy: number, sz: number, seed: number) {
    const c = this.ctx; const r = (k: number) => hash(seed, k) - 0.5;
    if (t === "camur") {
      for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(cx + r(i) * sz, cy + r(i + 4) * sz * this.sy, sz * 0.22, sz * 0.09, 0, 0, TAU); c.fillStyle = "rgba(90,70,40,.55)"; c.fill(); c.beginPath(); c.ellipse(cx + r(i) * sz - 2, cy + r(i + 4) * sz * this.sy - 1, sz * 0.08, sz * 0.025, 0, 0, TAU); c.fillStyle = "rgba(255,255,255,.35)"; c.fill(); }
    } else if (t === "su") {
      c.strokeStyle = "rgba(255,255,255,.6)"; c.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) { const y = cy + (i - 1) * sz * 0.22 * this.sy * 1.6, ph = this.now / 400 + i + seed; c.beginPath(); c.moveTo(cx - sz * 0.5, y); for (let k = 0; k <= 8; k++) c.lineTo(cx - sz * 0.5 + k * sz / 8, y + Math.sin(ph + k * 0.9) * 1.6); c.stroke(); }
    } else if (t === "tepe") {
      c.strokeStyle = "rgba(110,90,50,.5)"; c.lineWidth = 1;
      for (let i = 1; i <= 2; i++) { c.beginPath(); c.ellipse(cx, cy, sz * (0.75 - i * 0.22), sz * (0.75 - i * 0.22) * this.sy, 0, 0, TAU); c.stroke(); }
    }
  }
  private props(t: Terrain, cx: number, cy: number, sz: number, seed: number) {
    const c = this.ctx; const r = (k: number) => hash(seed, k) - 0.5; const sway = (k: number) => Math.sin(this.now / 700 + seed + k) * sz * 0.04 * (1 + (this.view.wind?.strength ?? 0));
    if (t === "uzun_ot" || t === "cayir") {
      const n = t === "uzun_ot" ? 7 : 3, h = t === "uzun_ot" ? sz * 0.42 : sz * 0.18;
      c.strokeStyle = t === "uzun_ot" ? "#6E7C3C" : "#8E9154"; c.lineWidth = 1.2; c.lineCap = "round";
      for (let i = 0; i < n; i++) { const x = cx + r(i) * sz * 1.1, y = cy + r(i + 9) * sz * this.sy * 1.1; const s = sway(i);
        c.beginPath(); c.moveTo(x - 2, y); c.quadraticCurveTo(x - 3, y - h * 0.5, x - 4 + s, y - h * 0.9); c.moveTo(x, y); c.quadraticCurveTo(x, y - h * 0.6, x + s, y - h * 1.1); c.moveTo(x + 2, y); c.quadraticCurveTo(x + 3, y - h * 0.5, x + 4 + s, y - h * 0.85); c.stroke(); }
    } else if (t === "kaya") {
      for (let i = 0; i < 2; i++) {
        const x = cx + (i ? sz * 0.28 : -sz * 0.2), y = cy + (i ? sz * 0.12 : -sz * 0.08) * this.sy, k = sz * (i ? 0.28 : 0.38);
        c.beginPath(); c.moveTo(x - k, y + k * 0.25); c.lineTo(x - k * 0.55, y - k * 0.7); c.lineTo(x + k * 0.35, y - k * 0.85); c.lineTo(x + k, y - k * 0.1); c.lineTo(x + k * 0.8, y + k * 0.3); c.closePath();
        c.fillStyle = "#A9A393"; c.fill(); c.strokeStyle = "#5F5A4C"; c.lineWidth = 1.2; c.stroke();
        c.beginPath(); c.moveTo(x - k * 0.55, y - k * 0.7); c.lineTo(x + k * 0.35, y - k * 0.85); c.lineTo(x + k * 0.1, y - k * 0.2); c.lineTo(x - k * 0.3, y - k * 0.15); c.closePath(); c.fillStyle = "#CFC9B9"; c.fill();
      }
    } else if (t === "agac") {
      for (const [ox, oy, s] of [[-0.3, -0.12, 1], [0.28, 0.12, 0.85]] as const) {
        const x = cx + ox * sz, y = cy + oy * sz * this.sy, hgt = sz * 1.25 * s; const sw = sway(ox * 10);
        c.fillStyle = "rgba(42,39,34,.18)"; c.beginPath(); c.ellipse(x + 3, y + 2, sz * 0.35 * s, sz * 0.12 * s, 0, 0, TAU); c.fill();
        c.strokeStyle = "#5B4630"; c.lineWidth = Math.max(2, sz * 0.09 * s); c.beginPath(); c.moveTo(x, y); c.lineTo(x + sw * 0.3, y - hgt * 0.5); c.stroke();
        for (const [dx, dy, rr, col] of [[0, -0.72, 0.34, "#5E7E47"], [-0.2, -0.55, 0.26, "#6F8F55"], [0.2, -0.56, 0.25, "#6A8A50"], [0, -0.9, 0.24, "#7C9C60"]] as const) {
          c.beginPath(); c.arc(x + dx * sz * s + sw, y + dy * hgt, rr * sz * s, 0, TAU); c.fillStyle = col; c.fill(); c.strokeStyle = "rgba(42,39,34,.55)"; c.lineWidth = 1; c.stroke();
        }
      }
    }
  }
  private flames(cx: number, cy: number, sz: number, seed: number) {
    const c = this.ctx; const t = this.now / 120;
    const g = c.createRadialGradient(cx, cy - sz * 0.3, 2, cx, cy - sz * 0.3, sz * 1.4);
    g.addColorStop(0, "rgba(255,170,60,.35)"); g.addColorStop(1, "rgba(255,170,60,0)");
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy - sz * 0.3, sz * 1.4, 0, TAU); c.fill();
    for (let i = 0; i < 4; i++) {
      const fx = cx + (i - 1.5) * sz * 0.26, fy = cy + (hash(seed, i) - 0.5) * sz * 0.2, h = sz * (0.55 + 0.25 * Math.sin(t + i * 1.7 + seed)) * (i % 2 ? 0.8 : 1);
      c.beginPath(); c.moveTo(fx - sz * 0.13, fy); c.quadraticCurveTo(fx - sz * 0.2, fy - h * 0.5, fx + Math.sin(t + i) * 2, fy - h); c.quadraticCurveTo(fx + sz * 0.2, fy - h * 0.5, fx + sz * 0.13, fy); c.closePath();
      c.fillStyle = "rgba(214,98,32,.85)"; c.fill(); c.strokeStyle = "#9E3423"; c.lineWidth = 1; c.stroke();
      c.beginPath(); c.moveTo(fx - sz * 0.06, fy); c.quadraticCurveTo(fx, fy - h * 0.55, fx + sz * 0.06, fy); c.fillStyle = "#FFD27A"; c.fill();
    }
    if (Math.random() < 0.06) this.parts.push({ x: cx + (Math.random() - 0.5) * sz * 0.6, y: cy - sz * 0.6, vx: (Math.random() - 0.5) * 0.3, vy: -0.6, life: 900, t0: this.now, color: "rgba(90,85,80,.5)" });
  }
  private iceWall(cx: number, cy: number, sz: number) {
    const c = this.ctx; const h = sz * 0.9;
    c.beginPath(); c.moveTo(cx - sz * 0.6, cy + sz * 0.1); c.lineTo(cx - sz * 0.5, cy - h); c.lineTo(cx + sz * 0.1, cy - h * 1.15); c.lineTo(cx + sz * 0.6, cy - h * 0.8); c.lineTo(cx + sz * 0.6, cy + sz * 0.15); c.closePath();
    c.fillStyle = "rgba(200,230,242,.9)"; c.fill(); c.strokeStyle = "#4E7F8F"; c.lineWidth = 1.4; c.stroke();
    c.beginPath(); c.moveTo(cx - sz * 0.2, cy - h * 0.8); c.lineTo(cx, cy - h * 0.3); c.lineTo(cx + sz * 0.25, cy - h * 0.6); c.stroke();
  }
  private trapIcon(cx: number, cy: number) {
    const c = this.ctx; const s = this.size * 0.3;
    c.strokeStyle = "#5B4630"; c.lineWidth = 1.6; c.lineCap = "round";
    c.beginPath(); c.moveTo(cx - s, cy + s * 0.3); c.lineTo(cx - s * 0.2, cy - s * 0.6); c.moveTo(cx + s, cy + s * 0.3); c.lineTo(cx + s * 0.2, cy - s * 0.6); c.stroke();
    c.beginPath(); c.ellipse(cx, cy, s * 0.7, s * 0.3, 0, 0, TAU); c.setLineDash([2, 2]); c.stroke(); c.setLineDash([]);
  }
  private flag(at: XY, label: string, active: boolean) {
    const c = this.ctx; const { cx, cy } = this.center(...at); const h = this.size * 1.1;
    c.strokeStyle = "#2A2722"; c.lineWidth = 1.6; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx, cy - h); c.stroke();
    c.beginPath(); c.moveTo(cx, cy - h); c.lineTo(cx + this.size * 0.6, cy - h + this.size * 0.2); c.lineTo(cx, cy - h + this.size * 0.4); c.closePath();
    c.fillStyle = active ? "#9E3423" : "#E9DFC9"; c.fill(); c.stroke();
    c.font = `700 ${Math.round(this.size * 0.55)}px Caveat, cursive`; c.fillStyle = active ? "#9E3423" : "#2A2722"; c.textAlign = "left"; c.fillText(label, cx + this.size * 0.7, cy - h + this.size * 0.4);
  }
  private windArrow(dir: number, strength: number) {
    const c = this.ctx; const x = this.cw - 34, y = 30, a = dir * Math.PI / 3, L = 16;
    c.save(); c.translate(x, y); c.strokeStyle = "#2E4C7A"; c.fillStyle = "#2E4C7A"; c.lineWidth = 1.6;
    c.beginPath(); c.arc(0, 0, 20, 0, TAU); c.fillStyle = "rgba(234,224,200,.85)"; c.fill(); c.stroke();
    c.rotate(a); c.beginPath(); c.moveTo(-L, 0); c.lineTo(L, 0); c.stroke();
    c.beginPath(); c.moveTo(L, 0); c.lineTo(L - 6, -5); c.lineTo(L - 6, 5); c.closePath(); c.fillStyle = "#2E4C7A"; c.fill();
    for (let i = 0; i < strength; i++) { c.beginPath(); c.moveTo(-L + 3 + i * 5, 0); c.lineTo(-L + i * 5, -6); c.stroke(); }
    c.restore();
    c.font = "600 11px Alegreya, serif"; c.fillStyle = "#2E4C7A"; c.textAlign = "center"; c.fillText("rüzgâr", x, y + 32);
  }

  private unit(u: Unit) {
    const c = this.ctx; const d = this.dsOf(u); const k = this.size / 34;
    const x = d.x + d.offX, y = d.y + d.offY;
    c.save(); c.globalAlpha = d.alpha;
    c.fillStyle = "rgba(42,39,34,.22)"; c.beginPath(); c.ellipse(x, y + 1, 11 * k, 4 * k, 0, 0, TAU); c.fill();
    if (u.uid === this.over.selected) { c.setLineDash([4, 3]); c.strokeStyle = "#9E3423"; c.lineWidth = 1.6; c.beginPath(); c.ellipse(x, y + 1, 16 * k, 6.5 * k, 0, 0, TAU); c.stroke(); c.setLineDash([]); }
    c.translate(x, y);
    if (d.lying) c.rotate(d.face * d.lying * Math.PI / 2 * 0.9);
    const bob = Math.sin(this.now / 380 + (u.uid.charCodeAt(1) || 0)) * 0.6 * k;
    if (u.side === "player") this.human(k, d, bob, u); else this.wolf(k, d, u);
    c.restore();
    if (d.alpha > 0.5 && !d.lying) this.unitHud(u, x, y, k);
  }
  private human(k: number, d: DS, bob: number, u: Unit) {
    const c = this.ctx; const f = d.face;
    const im = (d.pose === "swing" && this.img("poz_kahraman_vurus")) || ((u.defending || d.pose === "defend") && this.img("poz_kahraman_savunma")) || this.img("poz_kahraman_durus");
    if (im) {
      // pozlar aynı ölçekte kesildi: duruş boyu 373 px = 56 birim; görseller sola bakar
      const s = 56 * k / 373, h = im.naturalHeight * s, w = im.naturalWidth * s;
      c.scale(-f, 1); if (d.flash > 0) c.filter = `sepia(1) saturate(4) hue-rotate(-30deg)`;
      c.drawImage(im, -w / 2, -h + bob, w, h); c.filter = "none"; d.flash = Math.max(0, d.flash - 0.05); return;
    } const step = Math.sin(d.walk) * 3 * k;
    c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = "#2A2722"; c.lineWidth = 1.6 * k;
    c.beginPath(); c.moveTo(-2 * k, 0); c.lineTo(-2 * k + step * 0.4, -11 * k); c.moveTo(2 * k, 0); c.lineTo(2 * k - step * 0.4, -11 * k); c.stroke();
    c.beginPath(); c.moveTo(-6 * k, -11 * k + bob); c.lineTo(6 * k, -11 * k + bob); c.lineTo(4.5 * k, -25 * k + bob); c.lineTo(-4.5 * k, -25 * k + bob); c.closePath();
    c.fillStyle = d.flash > 0 ? `rgba(158,52,35,${0.6 + d.flash * 0.4})` : "#3F5F8F"; c.fill(); c.stroke();
    c.beginPath(); c.arc(0, -30 * k + bob, 4.6 * k, 0, TAU); c.fillStyle = "#E7CFAE"; c.fill(); c.stroke();
    c.beginPath(); c.arc(0, -31 * k + bob, 4.8 * k, Math.PI * 1.05, Math.PI * 1.95); c.strokeStyle = "#4A3A2A"; c.lineWidth = 2 * k; c.stroke();
    c.strokeStyle = "#2A2722"; c.lineWidth = 1.6 * k;
    // kol + değnek
    const defend = u.defending || d.pose === "defend", swing = d.pose === "swing";
    c.beginPath(); c.moveTo(3.5 * k * f, -22 * k + bob); c.lineTo(9 * k * f, -16 * k + bob); c.stroke();
    c.strokeStyle = "#6B5235"; c.lineWidth = 2 * k; c.beginPath();
    if (defend) { c.moveTo(-6 * k, -20 * k); c.lineTo(12 * k, -22 * k); }
    else if (swing) { c.moveTo(9 * k * f, -16 * k); c.lineTo(22 * k * f, -10 * k); }
    else { c.moveTo(9 * k * f, -14 * k + bob); c.lineTo(13 * k * f, -34 * k + bob); }
    c.stroke();
    if (this.view.torchLit) { const fx = -8 * k * f, fy = -24 * k; c.strokeStyle = "#5B4630"; c.beginPath(); c.moveTo(-4 * k * f, -16 * k); c.lineTo(fx, fy); c.stroke(); const h = (5 + Math.sin(this.now / 90) * 1.5) * k; c.beginPath(); c.moveTo(fx - 2.5 * k, fy); c.quadraticCurveTo(fx, fy - h * 1.6, fx + 2.5 * k, fy); c.fillStyle = "#F0A040"; c.fill(); }
    d.flash = Math.max(0, d.flash - 0.05);
  }
  private wolf(k: number, d: DS, u: Unit) {
    const c = this.ctx;
    const im = (d.pose === "leap" && this.img("poz_kurt_atilma")) || this.img("dusman_kurt");
    if (im) {
      // görseller sola bakar; kurt yönüne göre çevrilir
      const w = 58 * k, h = w * im.naturalHeight / im.naturalWidth;
      c.scale(-d.face, 1); if (d.flash > 0) c.filter = `sepia(1) saturate(4) hue-rotate(-30deg) brightness(${1 - d.flash * 0.2})`;
      c.drawImage(im, -w / 2, -h * 0.95, w, h); c.filter = "none"; d.flash = Math.max(0, d.flash - 0.05); return;
    }
    c.scale(d.face, 1);
    const step = Math.sin(d.walk) * 3 * k; const crouch = u.alert ? 0 : 2 * k;
    c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = "#2A2722"; c.lineWidth = 1.4 * k;
    // bacaklar
    c.beginPath();
    c.moveTo(-9 * k, -9 * k + crouch); c.lineTo(-10 * k + step, 0);
    c.moveTo(-6 * k, -9 * k + crouch); c.lineTo(-6 * k - step, 0);
    c.moveTo(6 * k, -9 * k + crouch); c.lineTo(7 * k - step, 0);
    c.moveTo(9 * k, -9 * k + crouch); c.lineTo(10 * k + step, 0); c.stroke();
    // gövde, kuyruk, baş
    c.beginPath();
    c.moveTo(-13 * k, -16 * k + crouch); c.quadraticCurveTo(-2 * k, -21 * k + crouch, 9 * k, -18 * k + crouch);
    c.lineTo(13 * k, -22 * k + crouch); c.lineTo(14 * k, -27 * k + crouch); c.lineTo(16.5 * k, -23.5 * k + crouch); c.lineTo(18 * k, -27.5 * k + crouch); c.lineTo(19 * k, -23 * k + crouch);
    c.lineTo(25 * k, -20 * k + crouch); c.lineTo(24 * k, -17.5 * k + crouch); c.lineTo(16 * k, -15 * k + crouch);
    c.quadraticCurveTo(10 * k, -9 * k + crouch, 0, -9 * k + crouch); c.quadraticCurveTo(-10 * k, -8 * k + crouch, -13 * k, -12 * k + crouch);
    c.quadraticCurveTo(-20 * k, -9 * k + crouch, -23 * k + (u.scared ? 0 : -1) * k, (u.scared ? -6 : -16) * k + crouch);
    c.quadraticCurveTo(-18 * k, -14 * k + crouch, -13 * k, -16 * k + crouch); c.closePath();
    c.fillStyle = d.flash > 0 ? `rgba(158,52,35,${0.6 + d.flash * 0.4})` : "#5E5850"; c.fill(); c.stroke();
    c.beginPath(); c.arc(18.5 * k, -20.5 * k + crouch, 1 * k, 0, TAU); c.fillStyle = "#E9DFC9"; c.fill();
    c.strokeStyle = "rgba(233,223,201,.5)"; c.lineWidth = 1 * k; c.beginPath(); for (let i = 0; i < 4; i++) { c.moveTo((-6 + i * 4) * k, -17 * k + crouch); c.lineTo((-4 + i * 4) * k, -13 * k + crouch); } c.stroke();
    d.flash = Math.max(0, d.flash - 0.05);
  }
  private unitHud(u: Unit, x: number, y: number, k: number) {
    const c = this.ctx; if (u.hp <= 0 || u.fled) return;
    const w = 24 * k, top = y - 40 * k; const f = u.hp / u.maxHp;
    c.fillStyle = "rgba(234,224,200,.9)"; c.fillRect(x - w / 2 - 1, top - 1, w + 2, 5);
    c.fillStyle = f > 0.5 ? "#4F6A34" : f > 0.25 ? "#A35A12" : "#9E3423"; c.fillRect(x - w / 2, top, w * f, 3);
    c.strokeStyle = "#2A2722"; c.lineWidth = 0.8; c.strokeRect(x - w / 2 - 1, top - 1, w + 2, 5);
    if (u.side === "enemy") {
      const def = ENEMIES[u.def!]; void def;
      const tag = !u.alert ? "z" : u.scared ? "korkmuş" : "";
      const extra = u.slowed > 0 ? " topal" : "";
      if (tag || extra) { c.font = `700 ${Math.round(12 * k)}px Caveat, cursive`; c.textAlign = "center"; c.fillStyle = !u.alert ? "#2E4C7A" : "#9E3423"; c.fillText((tag + extra).trim(), x, top - 4); }
    } else if (u.defending) { c.font = `700 ${Math.round(12 * k)}px Caveat, cursive`; c.textAlign = "center"; c.fillStyle = "#2E4C7A"; c.fillText("savunmada", x, top - 4); }
  }
}

function toCube(x: number, y: number) { const q = x - (y - (y & 1)) / 2; return { q, r: y, s: -q - y }; }
function hexDist(x1: number, y1: number, x2: number, y2: number) { const a = toCube(x1, y1), b = toCube(x2, y2); return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.s - b.s)); }
