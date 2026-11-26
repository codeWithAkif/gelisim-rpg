// Diyar sayfası: rütbe, ev, işletmeler, adamlar, görev panosu. Karar sayfası.
import type { Config } from "../engine/config";
import type { GameState } from "../engine/state";
import {
  est, rankOf, RANKS, HOUSES, HOME_PLACES, VENTURES, HEROES, ROLE_NAMES, heroDef, heroStats, heroLimit, houseOf, canBuyHouse, jobsFor, canAssign, successChance,
  canFound, canUpVenture, ventureUpCost, heroOf, xpFor, PARTY_MAX, togglePartyCheck, jobDef, rankNo, venturesOpen,
} from "../engine/estate";
import { homePets } from "../engine/pet";
import { itemInfo, freeCount } from "../engine/inventory";
import { place } from "../engine/travel";
import { esc, ICONS } from "./sketch";
import { personPic, itemPic } from "./art";
import type { UiState } from "./screens";

const TABS: [string, string][] = [["genel", "Genel"], ["ev", "Ev"], ["isletme", "İşletme"], ["adamlar", "Adamlar"], ["pano", "Görevler"]];
const STATUS: Record<string, string> = { evde: "evde", yolda: "seninle", gorevde: "görevde", yarali: "yaralı" };

export function diyarScreen(cfg: Config, s: GameState, ui: UiState): string {
  const open = venturesOpen(s); const tabs = TABS.filter(([id]) => open || (id !== "isletme" && id !== "pano"));
  const tab = tabs.some(([id]) => id === ui.diyarTab) ? ui.diyarTab! : "genel";
  const seg = `<div class="seg" role="tablist">${tabs.map(([id, n]) => `<button role="tab" class="${tab === id ? "on" : ""}" data-act="diyartab" data-id="${id}" aria-selected="${tab === id}">${n}</button>`).join("")}</div>`;
  const body = tab === "ev" ? evTab(cfg, s) : tab === "isletme" ? isletmeTab(cfg, s) : tab === "adamlar" ? adamlarTab(cfg, s) : tab === "pano" ? panoTab(cfg, s) : genelTab(cfg, s);
  return `<div class="page">${seg}${body}</div>`;
}
const chips = (cfg: Config, s: GameState, c: { money: number; items: Record<string, number> }) =>
  `<span class="chip ${s.money >= c.money ? "" : "miss"}">${c.money} bakır</span>` + Object.entries(c.items).map(([k, n]) => `<span class="chip ${freeCount(cfg, s, k) >= n ? "" : "miss"}">${n} ${esc(itemInfo(cfg, k).name)}</span>`).join("");

function genelTab(_cfg: Config, s: GameState): string {
  const r = rankOf(s); const e = est(s); const wages = e.heroes!.reduce((n, h) => n + heroDef(h.id)!.wage, 0);
  const upkeep = VENTURES.reduce((n, d) => n + (e.ventures![d.id]?.worker ? d.upkeep * e.ventures![d.id].lv : 0), 0);
  return `<section class="sec"><h1>Diyar</h1><p class="lede">Adın yayıldıkça ev, işletme ve adamlar edinirsin. Kendi işini kendin yaparsın; tekrar eden işleri adamlarına bırakırsın.</p>
    <div class="card"><div class="entry-head"><span class="entry-title" style="font-size:26px">${esc(r.rank.name)}</span><span class="entry-meta">nüfuz ${r.score}${r.next ? ` / ${r.next.at}` : ""}</span></div>
      <div class="gb"><div class="gf" style="width:${Math.round(r.frac * 100)}%;background:var(--red)"></div></div>
      <p class="tiny" style="margin:4px 0 0">${esc(r.rank.unlocks)}</p>${r.next ? `<p class="tiny muted" style="margin:0">Sıradaki: <b>${esc(r.next.name)}</b>: ${esc(r.next.unlocks)}</p>` : ""}
      <p class="tiny muted" style="margin:4px 0 0">Nüfuz; tanınırlık, güven, tamamlanan işler, evin, işletmelerin ve adamlarının toplamından gelir.</p></div></section>
    <section class="sec"><h2>Durum</h2><div class="odds">
      <span>Ev <b>${houseOf(s)?.name ?? "yok"}</b></span><span>İşletme <b>${Object.keys(e.ventures!).length}</b></span><span>Adam <b>${e.heroes!.length}/${heroLimit(s)}</b></span><span>Evcil <b>${(s.pet ? 1 : 0) + homePets(s).length}</b></span></div>
      <p class="tiny muted" style="margin:4px 0 0">Günlük gider: maaş ${wages} + bakım ${upkeep} bakır. Her gece uyuyunca ödenir.</p></section>
    ${e.reports!.length ? `<section class="sec"><h2>Dün gece</h2>${e.reports!.map(x => `<div class="note">${esc(x)}</div>`).join("")}</section>` : ""}
    <section class="sec"><h3>Nereden başlamalı?</h3><p class="tiny muted" style="margin:0">${venturesOpen(s) ? `1) Köy meydanında <b>ev kur</b>. 2) Bir <b>adam tut</b>. 3) Rütbe 2'de <b>işletme</b> kur, adama işletmeyi ver. 4) Tekrarlı işleri <b>Görevler</b>'den adamlarına ata.` : `1) Köy meydanında <b>ev kur</b>: kendi yatağında daha iyi dinlenirsin. 2) Bir <b>adam tut</b>: yanında gezen adam savaşta yardım eder. İşletme ve görev panosu ileride, adın şehre ulaşınca açılır.`}</p></section>`;
}
function evTab(cfg: Config, s: GameState): string {
  const e = est(s); const h = houseOf(s); const lv = e.house ?? 0; const next = HOUSES[lv]; const c = canBuyHouse(cfg, s, s.location);
  const cur = h ? `<div class="card"><div class="entry-head"><span class="entry-title">${esc(h.name)}</span><span class="entry-meta">${esc(place(e.homePlace!)?.name ?? "")}</span></div><p class="tiny" style="margin:0">${esc(h.desc)}</p>
    <div class="odds"><span>Evcil <b>${h.pets}</b></span><span>Adam odası <b>${h.rooms}</b></span><span>Dinlenme <b>%${Math.round(h.bed * 100)}</b></span></div></div>` : `<p class="hand blue" style="margin:0">Henüz bir evin yok.</p>`;
  const where = lv === 0 ? `Ev şu yerlerde kurulur: ${HOME_PLACES.map(p => esc(place(p)?.name ?? p)).join(", ")}. Orada Harita kartındaki <b>Ev kur</b> satırını kullan.` : `Evini büyütmek için evde (${esc(place(e.homePlace!)?.name ?? "")}) olmalısın.`;
  return `<section class="sec"><h2>Ev</h2>${cur}
    ${next ? `<div class="card"><div class="entry-head"><span class="entry-title">${lv ? "Büyüt: " : "Kur: "}${esc(next.name)}</span><span class="entry-meta">rütbe ${Math.max(1, lv + 1)}</span></div><p class="tiny" style="margin:0">${esc(next.desc)}</p>
      <div class="chips">${chips(cfg, s, next.cost)}</div>
      <div class="row" style="margin-top:6px"><button class="btn small primary" data-act="house-up" ${c.ok ? "" : "disabled"}>${lv ? "Büyüt" : "Burada kur"}</button></div>
      ${!c.ok ? `<div class="tiny red">${esc(c.reason ?? "")}</div>` : ""}</div>` : ""}
    <p class="tiny muted" style="margin:0">${where} Evinde kendi yatağında güvenle uyursun; hayvanların ve adamların orada yaşar.</p></section>`;
}
function isletmeTab(cfg: Config, s: GameState): string {
  const e = est(s);
  const cards = VENTURES.map(d => {
    const v = e.ventures![d.id]; const w = v?.worker ? heroOf(s, v.worker) : undefined; const found = canFound(cfg, s, d.id); const up = v ? canUpVenture(cfg, s, d.id) : null;
    const it = itemPic(d.makes, 30);
    if (!v) return `<div class="card"><div class="entry-head"><span class="entry-title">${esc(d.name)}</span><span class="entry-meta">rütbe ${d.minRank}</span></div><p class="tiny" style="margin:0">${esc(d.desc)} Üretir: ${it} ${esc(itemInfo(cfg, d.makes).name)}.</p>
      <div class="chips">${chips(cfg, s, d.cost)}</div><div class="row" style="margin-top:6px"><button class="btn small" data-act="venture-found" data-id="${d.id}" ${found.ok ? "" : "disabled"}>Kur</button></div>${!found.ok ? `<div class="tiny red">${esc(found.reason ?? "")}</div>` : ""}</div>`;
    return `<div class="card"><div class="entry-head"><span class="entry-title">${esc(d.name)}</span><span class="entry-meta">seviye ${v.lv}/3 · bakım ${d.upkeep * v.lv}/gün</span></div>
      <div class="item-detail">${it}<div><div>Ambar: <b>${Math.floor(v.stock)}/${10 * v.lv}</b> ${esc(itemInfo(cfg, d.makes).name)}</div><div class="tiny muted">${w ? `Çalışan: ${esc(heroDef(w.id)!.name)}${heroDef(w.id)!.role === d.need ? "" : " (rolü uymuyor, yarım verim)"}` : "Çalışan yok: üretmez."}</div></div></div>
      <div class="chips">${e.heroes!.filter(h => h.status === "evde").map(h => `<button class="chip ${v.worker === h.id ? "on" : ""}" data-act="venture-worker" data-id="${d.id}|${h.id}">${esc(heroDef(h.id)!.name.split(" ")[0])}</button>`).join("") || `<span class="tiny muted">Evde boşta adam yok</span>`}${v.worker ? `<button class="chip" data-act="venture-worker" data-id="${d.id}|">Boşalt</button>` : ""}</div>
      <div class="row" style="margin-top:6px"><button class="btn small primary" data-act="venture-collect" data-id="${d.id}" ${v.stock >= 1 ? "" : "disabled"}>Teslim al</button>
        <button class="btn small" data-act="venture-up" data-id="${d.id}" ${up?.ok ? "" : "disabled"}>${v.lv >= 3 ? "Tam seviye" : "Geliştir"}</button></div>
      ${v.lv < 3 ? `<div class="chips" style="margin-top:4px">${chips(cfg, s, ventureUpCost(d, v.lv))}</div>` : ""}${up && !up.ok && v.lv < 3 ? `<div class="tiny red">${esc(up.reason ?? "")}</div>` : ""}</div>`;
  }).join("");
  return `<section class="sec"><h2>İşletmeler</h2><p class="muted tiny" style="margin:0">Kurmak için evinde olmalısın. Çalışanı olan işletme her gece üretir ve bakım parası öder.</p>${cards}</section>`;
}
function adamlarTab(cfg: Config, s: GameState): string {
  const e = est(s);
  const roster = e.heroes!.map(h => {
    const d = heroDef(h.id)!; const st = heroStats(h); const inParty = e.party!.includes(h.id); const pc = togglePartyCheck(s, h.id);
    return `<div class="card"><div class="item-detail">${personPic({ id: h.id, name: d.name }, 52, true)}<div style="flex:1;min-width:0">
      <div class="entry-head"><span class="entry-title">${esc(d.name)}</span><span class="entry-meta">${ROLE_NAMES[d.role]} · sv.${h.lv}</span></div>
      <div class="tiny muted">${esc(d.bio)}</div>
      <div class="tiny">${STATUS[h.status]}${h.status === "yarali" ? ` (gün ${h.until} dolana dek)` : ""} · can ${Math.round(h.hp)}/${st.maxHp} · sadakat ${Math.round(h.loyalty)} · maaş ${d.wage}/gün</div>
      <div class="gb"><div class="gf" style="width:${(h.xp / xpFor(h.lv)) * 100}%;background:var(--blue)"></div></div>
      <div class="row" style="margin-top:6px"><button class="btn small ${inParty ? "primary" : ""}" data-act="hero-party" data-id="${h.id}" ${inParty || pc.ok ? "" : "disabled"}>${inParty ? "Eve gönder" : "Yanıma al"}</button><button class="btn small red" data-act="hero-dismiss" data-id="${h.id}">Terhis et</button></div>
      ${!inParty && !pc.ok ? `<div class="tiny red">${esc(pc.reason ?? "")}</div>` : ""}</div></div></div>`;
  }).join("");
  const open = HEROES.filter(h => !e.heroes!.some(x => x.id === h.id));
  return `<section class="sec"><h2>Adamların</h2><p class="muted tiny" style="margin:0">En çok ${PARTY_MAX} kişi yanında gezer ve savaşta yardım eder. Yanında olmayana savaş yerinde haber salarsın; yetişmesi vakit alır.
    Maaşını her gece ödersin; ödemezsen sadakati düşer. Adam tutmak için bir evin ve rütben olmalı (en çok ${heroLimit(s)}).</p>${roster || `<p class="hand blue" style="margin:0">Henüz kimse yok.</p>`}</section>
    <section class="sec"><h2>Aranan kişiler</h2><p class="muted tiny" style="margin:0">Bulundukları yere gidince Harita kartından tutarsın.</p>${open.map(h => `<div class="entry"><div class="entry-head"><span class="entry-title">${esc(h.name)}</span><span class="entry-meta">${ROLE_NAMES[h.role]} · rütbe ${h.minRank}</span></div>
      <div class="tiny muted">${esc(h.bio)} · ${h.hire} bakır, maaş ${h.wage}/gün</div><div class="tiny">Nerede: ${esc(place(h.place)?.name ?? h.place)}</div></div>`).join("")}</section>`;
}
function panoTab(_cfg: Config, s: GameState): string {
  const e = est(s); const jobs = jobsFor(s);
  const active = e.missions!.map(m => { const j = jobDef(m.job)!; const h = heroOf(s, m.hero); return `<div class="entry"><div class="entry-head"><span class="entry-title">${esc(j.name)}</span><span class="entry-meta">${esc(h ? heroDef(h.id)!.name : "?")} · ${m.end - s.day <= 0 ? "bu gece" : (m.end - s.day) + " gün"}</span></div>
    <div class="row"><button class="btn small" data-act="job-recall" data-id="${m.hero}">Geri çağır</button></div></div>`; }).join("");
  const free = e.heroes!.filter(h => h.status === "evde");
  const list = jobs.map(j => {
    const taken = e.missions!.some(m => m.job === j.id);
    const rewards = [j.money ? `${j.money} bakır` : "", ...Object.entries(j.items).map(([k, n]) => `${n} ${itemInfo(_cfg, k).name}`)].filter(Boolean).join(", ");
    return `<div class="entry"><div class="entry-head"><span class="entry-title">${esc(j.name)}</span><span class="entry-meta">${j.days} gün · zorluk ${j.diff}</span></div>
      <div class="tiny muted">${esc(j.desc)} Uygun: ${j.role.map(r => ROLE_NAMES[r]).join(", ")}. Ödül: ${esc(rewards || "—")}</div>
      <div class="chips">${taken ? `<span class="tiny muted">Bir adam gitti</span>` : free.length ? free.map(h => { const c = canAssign(s, j.id, h.id); return `<button class="chip" data-act="job-assign" data-id="${j.id}|${h.id}" ${c.ok ? "" : "disabled"}>${esc(heroDef(h.id)!.name.split(" ")[0])} %${Math.round(successChance(h, j) * 100)}</button>`; }).join("") : `<span class="tiny muted">Evde boşta adam yok</span>`}</div></div>`;
  }).join("");
  return `<section class="sec"><h2>Görev panosu</h2><p class="muted tiny" style="margin:0">Tekrar eden işleri adamların halleder; sonuç ertesi sabah belli olur. Yüzde, adamın o işte başarı şansıdır; başarısız olan yaralı döner. Bu işleri kendin de yapabilirsin (İşler ve Harita).</p>
    ${active ? `<h3>Yolda olanlar</h3>${active}` : ""}<h3>Açık işler</h3>${list || `<p class="tiny muted" style="margin:0">Rütben ve yaptığın işler arttıkça yenileri açılır.</p>`}</section>`;
}
void ICONS; void rankNo; void RANKS;
