// Ölçer işi ekranı: annenin defterinden bir sayfa gibi çizilmiş ısı ağı.
// Bir yere dokun (kaynak), sonra yolla bağlı bir komşuya dokun: bir birim ısı taşınır.
// "Ölç" kipinde gizli bir yere dokunursan ısısı açılır. Toplam ısı hep aynı kalır.
import type { Config } from "../engine/config";
import type { GameState } from "../engine/state";
import { type HState, type HNode, createPuzzle, transfer, measure, totalHeat, linked, nodeOk, finishOlcer, olcerLevel } from "../engine/olcer";
import type { GainReport } from "../engine/progression";
import { esc, roughPath, roughEllipse } from "./sketch";
import { sfx, buzz } from "./feel";

export interface OlcerEnd { won: boolean; title: string; gains: GainReport; first: boolean }

const goalText = (n: HNode) => n.atLeast !== undefined && n.atMost !== undefined ? (n.atLeast === n.atMost ? `tam ${n.atLeast}` : `${n.atLeast}–${n.atMost}`)
  : n.atLeast !== undefined ? `en az ${n.atLeast}` : n.atMost !== undefined ? (n.atMost === 0 ? "boşalt" : `en çok ${n.atMost}`) : "";

export function openOlcer(cfg: Config, s: GameState, levelId: string, persist: () => void, onEnd: (r: OlcerEnd) => void) {
  const level = olcerLevel(levelId)!;
  let st: HState = createPuzzle(s, level);
  let sel: string | null = null; let mode: "tasi" | "olc" = "tasi"; let flash: { id: string; t: number } | null = null;
  const el = document.createElement("div"); el.className = "olcer"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Ölçer işi");
  document.body.appendChild(el);

  const nodeSvg = (n: HNode, i: number) => {
    const known = st.known.includes(n.id); const h = st.heat[n.id];
    const warm = known ? Math.min(1, h / 6) : 0;
    const fill = known ? `rgba(${Math.round(70 + 120 * warm)},${Math.round(90 - 40 * warm)},${Math.round(150 - 110 * warm)},${(0.12 + warm * 0.35).toFixed(2)})` : "rgba(42,39,34,.06)";
    const ok = known && nodeOk(n, h) && goalText(n);
    const r = n.drain ? 10 : 9;
    const shape = n.drain
      ? roughPath([[n.x, n.y - r], [n.x + r, n.y], [n.x, n.y + r], [n.x - r, n.y]], 0.6, 40 + i, true)
      : roughEllipse(n.x, n.y, r, r, 0.6, 20 + i);
    const isSel = sel === n.id; const canTo = sel && sel !== n.id && linked(level, sel, n.id);
    return `<g class="h-node${isSel ? " sel" : ""}${canTo ? " can" : ""}${flash?.id === n.id ? " flash" : ""}" data-n="${n.id}" role="button" aria-label="${esc(n.name)}: ${known ? h : "ölçülmedi"}">
      <path d="${shape}" fill="var(--paper)" stroke="none"/>
      <path d="${shape}" fill="${fill}" stroke="${n.drain && known ? "var(--blue)" : "var(--ink)"}" stroke-width="${isSel ? 1.4 : 0.8}"/>
      <text x="${n.x}" y="${n.y + 2.2}" text-anchor="middle" class="h-val">${known ? h : "?"}</text>
      <text x="${n.x}" y="${n.y + r + 5}" text-anchor="middle" class="h-name">${esc(n.name)}</text>
      ${goalText(n) ? `<text x="${n.x}" y="${n.y + r + 9.5}" text-anchor="middle" class="h-goal${ok ? " ok" : ""}">${ok ? "✓ " : ""}${goalText(n)}</text>` : ""}
    </g>`;
  };
  const draw = () => {
    const links = level.links.map(([a, b], i) => { const A = level.nodes.find(n => n.id === a)!, B = level.nodes.find(n => n.id === b)!;
      return `<path d="${roughPath([[A.x, A.y], [B.x, B.y]], 0.8, 60 + i)}" stroke="var(--pencil)" stroke-width=".7" stroke-dasharray="2 1.4" fill="none"/>`; }).join("");
    const done = st.done;
    el.innerHTML = `<div class="olcer-inner">
      <p class="hand muted" style="margin:0">Ölçer işi · annemin defterinden</p><h2 style="margin:0">${esc(level.title)}</h2>
      <p class="tiny" style="margin:0">${esc(level.text)}</p>
      <div class="odds"><span>Hamle <b>${st.moves}</b></span><span>Ölçüm <b>${st.measures}</b></span><span>Toplam ısı <b>${totalHeat(st)}</b> <i class="muted">hiç değişmez</i></span></div>
      <svg viewBox="0 0 100 100" class="h-map">${links}${level.nodes.map(nodeSvg).join("")}</svg>
      <p class="tiny muted h-hint">${done ? "" : mode === "olc" ? "Ölçmek istediğin yere dokun." : sel ? "Isıyı taşıyacağın komşuya dokun (kesikli yol). Boş yere dokunursan seçim kalkar." : "Isıyı alacağın yere dokun."}</p>
      ${st.log.length ? `<div class="h-log">${st.log.slice(-3).map(l => `<div>${esc(l)}</div>`).join("")}</div>` : ""}
      ${done ? `<div class="card"><p class="hand ${done === "won" ? "green" : "red"}" style="margin:0;font-size:22px">${done === "won" ? "Isı yerini buldu." : "Hamlen bitti."}</p>
          <p class="tiny" style="margin:0">${done === "won" ? "Hesap tuttu. Isı kaybolmadı; yalnız yer değiştirdi." : "Isı yine kaybolmadı; yalnız yanlış yerde kaldı. Ölç, sonra yeniden dene."}</p></div>
        <div class="row">${done === "lost" ? `<button class="btn" data-o="retry">Baştan dene</button>` : ""}<span style="flex:1"></span><button class="btn primary" data-o="end">Deftere işle</button></div>`
      : `<div class="row"><button class="btn small ${mode === "olc" ? "primary" : ""}" data-o="mode" ${st.measures <= 0 && mode !== "olc" ? "disabled" : ""}>${mode === "olc" ? "Ölçmeyi bırak" : "Ölç"}</button>
          <button class="btn small" data-o="retry">Baştan</button><span style="flex:1"></span><button class="btn small" data-o="quit">Vazgeç</button></div>`}
    </div>`;
  };
  const end = () => { const r = finishOlcer(cfg, s, st); persist(); el.remove(); onEnd({ won: st.done === "won", title: level.title, gains: r.gains, first: r.first }); };
  el.addEventListener("click", e => {
    const t = e.target as Element;
    const o = t.closest<HTMLElement>("[data-o]")?.dataset.o;
    if (o === "mode") { mode = mode === "olc" ? "tasi" : "olc"; sel = null; sfx("tap"); draw(); return; }
    if (o === "retry") { st = createPuzzle(s, level); sel = null; mode = "tasi"; sfx("page"); draw(); return; }
    if (o === "quit") { if (!st.done) st.done = "lost"; end(); return; }
    if (o === "end") { end(); return; }
    const id = t.closest<SVGGElement>("[data-n]")?.dataset.n;
    if (!id) { if (sel && t.closest(".h-map")) { sel = null; draw(); } return; }   // boş yere dokunmak seçimi kaldırır
    if (st.done) return;
    if (mode === "olc") { if (measure(st, id)) { sfx("good"); flash = { id, t: Date.now() }; mode = st.measures > 0 ? "olc" : "tasi"; } else sfx("bad"); draw(); return; }
    if (!sel) { sel = id; sfx("tap"); draw(); return; }
    if (sel === id) return;   // seçili kaynağa yeniden dokunmak seçimi bozmaz
    if (!linked(level, sel, id)) { sel = id; sfx("tap"); draw(); return; }
    const r = transfer(st, sel, id);
    if (r === "ok") { sfx("whoosh"); buzz("light"); flash = { id, t: Date.now() }; } else if (r === "bos") { sfx("bad"); buzz("medium"); }
    if (st.done === "won") { sfx("win"); buzz("medium"); } else if (st.done === "lost") sfx("bad");
    sel = null;   // her hamle iki dokunuş: önce kaynak, sonra hedef (yanlışlıkla aktarım olmasın)
    draw();
  });
  draw();
}
