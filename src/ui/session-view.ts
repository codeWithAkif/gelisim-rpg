// Çalışma oturumu: süre seçimi ve süren oturumun ekranı (kum saati, kalan süre, şimdiye kadarki kazanç).
import type { Config } from "../engine/config";
import type { GameState } from "../engine/state";
import { finishSession, sessionProgress, fmtDur, type SessionResult } from "../engine/session";
import { itemInfo } from "../engine/inventory";
import { CRAFTS } from "../content/world";
import { sessionSheet, gainList } from "./screens";
import { esc, roughPath } from "./sketch";

export function openSessionSheet(cfg: Config, s: GameState, actId: string, onStart: (ms: number) => void) {
  const bg = document.createElement("div"); bg.className = "modal-bg";
  bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${sessionSheet(cfg, s, actId)}<div class="row"><button class="btn" data-x="close">Vazgeç</button></div></div>`;
  document.body.appendChild(bg);
  bg.addEventListener("click", e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!b) { if (e.target === bg) bg.remove(); return; }
    if (b.disabled) return;
    if (b.dataset.x === "close") { bg.remove(); return; }
    if (b.dataset.start) { bg.remove(); onStart(+b.dataset.start); }
  });
}

function hourglass(p: number): string {
  const top = 1 - p, bot = p;
  return `<svg viewBox="0 0 120 160" width="140" height="186" aria-hidden="true"><g fill="none" stroke="var(--ink)" stroke-width="2" stroke-linecap="round">
    <path d="${roughPath([[20, 12], [100, 12]], 1, 1)}"/><path d="${roughPath([[20, 148], [100, 148]], 1, 2)}"/>
    <path d="${roughPath([[30, 14], [32, 50], [56, 78], [32, 108], [30, 146]], 1, 3)}"/><path d="${roughPath([[90, 14], [88, 50], [64, 78], [88, 108], [90, 146]], 1, 4)}"/></g>
    <path d="M${36 + (1 - top) * 18},${74 - top * 54} L${84 - (1 - top) * 18},${74 - top * 54} L60,76 Z" fill="#C9A86A" opacity=".85"/>
    <path d="M36,144 L84,144 L${84 - (1 - bot) * 22},${144 - bot * 50} L${36 + (1 - bot) * 22},${144 - bot * 50} Z" fill="#C9A86A" opacity=".85"/>
    ${p < 1 ? `<line x1="60" y1="78" x2="60" y2="${144 - bot * 50}" stroke="#C9A86A" stroke-width="2" stroke-dasharray="3 4" class="sand"/>` : ""}</svg>`;
}

/** Süren oturumun ekranı. Kapanınca onDone sonucu verir. */
export function openSessionRun(cfg: Config, s: GameState, onDone: (r: SessionResult) => void, persist: () => void) {
  const ss = s.session; if (!ss) return;
  const title = ss.kind === "craft" ? `${itemInfo(cfg, CRAFTS.find(c => c.id === ss.id)!.product).name} yapıyorsun` : ss.label;
  const el = document.createElement("div");
  el.className = "session-screen"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Çalışma");
  document.body.appendChild(el);
  let confirm = false;
  const close = (r: SessionResult | null) => { clearInterval(timer); document.removeEventListener("visibilitychange", vis); el.remove(); persist(); if (r) onDone(r); };
  const draw = () => {
    if (!s.session) return close(null);
    const now = Date.now(); const p = sessionProgress(s, now);
    if (p >= 1) { const r = finishSession(cfg, s, now); return close(r); }
    const left = s.session.durMs - (now - s.session.startMs);
    let soFar = "";
    if (ss.kind === "act") { const c = structuredClone(s); const r = finishSession(cfg, c, now, true); soFar = r ? gainList(cfg, r.gains, 4) : ""; }
    el.innerHTML = `<div class="session-inner">
      <p class="hand muted" style="margin:0">${ss.kind === "craft" ? "El işi" : "Çalışıyorsun"}</p><h1>${esc(title)}</h1>
      <div class="hg">${hourglass(p)}</div>
      <div class="sess-time">${fmtDur(left)}<span class="muted tiny"> kaldı · oyunda ${fmtDur(ss.gameMs ?? ss.durMs)}</span></div>
      <div class="gb big"><div class="gf" style="width:${(p * 100).toFixed(2)}%;background:var(--green)"></div></div>
      ${soFar ? `<h3>Şimdiye kadar</h3>${soFar}` : ""}
      <p class="muted tiny">Çalışırken başka bir şey yapamazsın. Uygulamayı kapatabilirsin; süre işlemeye devam eder.</p>
      <div class="row" style="justify-content:center">${confirm
        ? `<span class="red">Yarıda bırakırsan geçen süre kadar kazanırsın.</span><button class="btn red" data-x="stop">Evet, bırak</button><button class="btn" data-x="no">Devam et</button>`
        : `<button class="btn" data-x="ask">Yarıda bırak</button>`}</div></div>`;
  };
  el.addEventListener("click", e => {
    const x = (e.target as HTMLElement).closest<HTMLElement>("[data-x]")?.dataset.x;
    if (x === "ask") { confirm = true; draw(); }
    if (x === "no") { confirm = false; draw(); }
    if (x === "stop") close(finishSession(cfg, s, Date.now(), true));
  });
  const vis = () => { if (!document.hidden) draw(); };
  document.addEventListener("visibilitychange", vis);
  const timer = window.setInterval(draw, 1000);
  draw();
}
