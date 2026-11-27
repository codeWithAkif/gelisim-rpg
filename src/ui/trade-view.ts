// Kervan kurma penceresi: nereye, ne yük, kim korur. Kâr tahmini ve yolun tehlikesi yola çıkmadan görünür.
import type { GameState } from "../engine/state";
import {
  postAt, openPosts, buyPrice, sellTotal, planCaravan, sendCaravan, buyCart, nextCartCost, cartsFree, tradeOf, guardPower,
} from "../engine/trade";
import { GOODS, REGION_NAMES, route, CART_CAP, type Region } from "../content/trade";
import { est, heroDef, heroStats, ROLE_NAMES } from "../engine/estate";
import { esc } from "./sketch";
import { sfx, buzz } from "./feel";

export function openCaravan(s: GameState, done: { persist: () => void; render: () => void; toast: (t: string) => void }) {
  const here = postAt(s.location); if (!here) { done.toast("Kervan bir ticaret yerinden çıkar"); return; }
  const dests = openPosts(s).filter(r => r !== here && route(here, r));
  let to: Region | undefined = dests[0];
  const cargo: Record<string, number> = {}; const guards = new Set<string>();
  const bg = document.createElement("div"); bg.className = "modal-bg";
  const box = document.createElement("div"); box.className = "modal caravan"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
  bg.appendChild(box); document.body.appendChild(bg);

  const draw = () => {
    const t = tradeOf(s); const cap = cartsFree(s) * CART_CAP; const cc = nextCartCost(s);
    const p = to ? planCaravan(s, to, cargo, [...guards]) : null;
    const units = p?.units ?? 0;
    const rows = to ? GOODS.map(g => {
      const buy = buyPrice(s, here, g.id); const sell1 = sellTotal(s, to!, g.id, 1); const gain = sell1 - buy; const n = cargo[g.id] ?? 0;
      return `<div class="cv-row"><div class="cv-g"><b>${esc(g.name)}</b><span class="tiny muted">alış ${buy} · orada ~${sell1}</span></div>
        <span class="cv-gain ${gain > 0 ? "green" : "red"}">${gain > 0 ? "+" : ""}${gain}</span>
        <div class="cv-step"><button class="btn small" data-c="-" data-id="${g.id}" ${n ? "" : "disabled"}>−</button><b>${n}</b><button class="btn small" data-c="+" data-id="${g.id}" ${units < cap ? "" : "disabled"}>+</button></div></div>`;
    }).join("") : "";
    const heroes = est(s).heroes!;
    const gchips = heroes.map(h => { const d = heroDef(h.id)!; const free = h.status === "evde"; const on = guards.has(h.id);
      return `<button class="chip ${on ? "on" : ""}" data-c="g" data-id="${h.id}" ${free ? "" : "disabled"}>${esc(d.name.split(" ")[0])} · ${ROLE_NAMES[d.role]} ${Math.round(heroStats(h).power)}${free ? "" : " (meşgul)"}</button>`; }).join("");
    const gp = guardPower(s, [...guards]);
    const verdict = !p || !units ? "" : p.power >= p.need * 1.3 ? `<span class="green">Pusu olursa büyük ihtimalle püskürtürler.</span>`
      : p.power >= p.need * 0.7 ? `<span>Pusu olursa ucu ucuna; yük gidebilir.</span>` : `<span class="red">Pusu olursa yükün çoğu gider.</span>`;
    box.innerHTML = `<p class="hand muted" style="margin:0">Kervan · ${esc(REGION_NAMES[here])}</p><h2>Ucuz al, uzağa götür</h2>
      <div class="odds"><span>Araba <b>${t.carts}</b> (boşta ${cartsFree(s)})</span><span>Yük yeri <b>${units}/${cap}</b></span><span>Cebin <b>${s.money}</b></span></div>
      ${cc !== null ? `<div class="row"><button class="btn small" data-c="cart" ${s.money >= cc ? "" : "disabled"}>${t.carts ? "Bir araba daha" : "Araba al"} (${cc} bakır, ${CART_CAP} yük)</button></div>` : ""}
      ${dests.length ? `<h3>Nereye?</h3><div class="chips">${dests.map(r => { const rt = route(here, r)!; return `<button class="chip ${to === r ? "on" : ""}" data-c="to" data-id="${r}">${esc(REGION_NAMES[r])} · ${rt.days} gün · tehlike ${rt.danger}</button>`; }).join("")}</div>`
        : `<p class="hand blue" style="margin:0">Buradan gidilecek başka bir ticaret yeri henüz açılmadı.</p>`}
      ${to ? `<h3>Yük</h3><p class="tiny muted" style="margin:0">Sayı: birim başına tahmini kâr. Aynı maldan çok satarsan fiyat düşer; satış varış günündeki fiyatla olur.</p><div class="cv-list">${rows}</div>
        <h3>Korumalar</h3>${heroes.length ? `<div class="chips">${gchips}</div>` : `<p class="tiny muted" style="margin:0">Adamın yok; kervan korumasız gider. Adam tutmak için Diyar'a bak.</p>`}
        <p class="tiny" style="margin:4px 0 0"><b>Yol:</b> ${esc(p?.threat ?? "")}. Pusu ihtimali %${Math.round((p?.ambush ?? 0) * 100)}${gp.scout ? " (izci yolu kolluyor)" : ""}. Korumaların gücü ${Math.round(gp.power)}, gereken ~${Math.round(p?.need ?? 0)}. ${verdict}</p>
        <div class="odds"><span>Maliyet <b>${p?.cost ?? 0}</b></span><span>Tahmini satış <b>${p?.estimate ?? 0}</b></span><span>Kâr <b class="${(p?.estimate ?? 0) - (p?.cost ?? 0) >= 0 ? "green" : "red"}">${(p?.estimate ?? 0) - (p?.cost ?? 0)}</b></span><span>Varış <b>${p?.days ?? 0} gün</b></span></div>
        ${p && !p.ok && units ? `<p class="tiny red" style="margin:0">${esc(p.reason ?? "")}</p>` : ""}` : ""}
      <div class="row"><button class="btn primary" data-c="send" ${p?.ok ? "" : "disabled"}>Yola çıkar</button><button class="btn" data-c="close">Kapat</button></div>`;
  };
  box.addEventListener("click", e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-c]"); if (!b || b.disabled) return;
    const c = b.dataset.c, id = b.dataset.id ?? "";
    if (c === "close") { bg.remove(); return; }
    if (c === "cart") { const r = buyCart(s); sfx(r.ok ? "coin" : "bad"); done.toast(r.ok ? "Araba aldın." : r.reason ?? ""); done.persist(); }
    if (c === "to") to = id as Region;
    if (c === "+") cargo[id] = (cargo[id] ?? 0) + 1;
    if (c === "-") cargo[id] = Math.max(0, (cargo[id] ?? 0) - 1);
    if (c === "g") { if (guards.has(id)) guards.delete(id); else guards.add(id); }
    if (c === "send" && to) {
      const r = sendCaravan(s, to, cargo, [...guards]);
      if (r.ok) { sfx("coin"); buzz("medium"); done.toast(`Kervan yola çıktı: ${r.days} gün sonra ${REGION_NAMES[to]}'ta. Sonucu uyuyunca öğrenirsin.`); done.persist(); done.render(); bg.remove(); return; }
      done.toast(r.reason ?? ""); sfx("bad");
    }
    sfx("tap"); draw();
  });
  draw();
}
