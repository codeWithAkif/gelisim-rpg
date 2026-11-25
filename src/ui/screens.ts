// Defter, Vücut, Çalış ve İşler ekranları. Her ekran HTML üretir;
// tıklamalar app.ts'deki data-act işleyicilerine gider.
import type { Config } from "../engine/config";
import { type GameState, clock, minutesLeft, repOf } from "../engine/state";
import { canDoActivity, DEFERRED_CATEGORIES, type GainReport } from "../engine/progression";
import { questList, itemName, npc } from "../engine/quests";
import { maxHp } from "../engine/combat";
import { NPCS, GAME_ITEMS, ENEMIES, teacherOf } from "../content/world";
import { esc, inkBar, portrait, wolfSketch, bodySketch } from "./sketch";
import { APP_VERSION } from "../update";

export interface UiState { lastResult?: { title: string; gains: GainReport; note?: string; at: number } }

const fmt = (v: number) => (Math.abs(v) < 0.1 ? v.toFixed(2) : v.toFixed(1));
const catColor = (cfg: Config, id?: string) => cfg.cat.get(id ?? "")?.color ?? "var(--pencil)";

export function gainList(cfg: Config, g: GainReport, limit = 6): string {
  const rows = Object.entries(g).filter(([, v]) => v > 0.004).sort((a, b) => b[1] - a[1]).slice(0, limit);
  if (!rows.length) return `<p class="muted">Belirgin bir gelişme yok.</p>`;
  return `<div class="gainlist">${rows.map(([id, v]) => {
    const a = cfg.attr.get(id); const later = DEFERRED_CATEGORIES.has(a?.cat ?? "");
    return `<div><span>${esc(a?.name ?? id)}${later ? ` <span class="muted">· uykuda işlenecek</span>` : ""}</span><span class="g">+${fmt(v)}</span></div>`;
  }).join("")}</div>`;
}

export function statusBar(cfg: Config, s: GameState): string {
  const hpM = maxHp(cfg, s), hp = s.hp || hpM;
  const late = minutesLeft(s) <= 0;
  return `<header class="status">
    <div class="day">Gün ${s.day}<small>${clock(s)}${late ? " · gün bitti" : ""}</small></div>
    <div class="money">${s.money} bakır</div>
    <div class="meters">
      <div class="meter">Enerji <b>${Math.round(s.energy)}</b><div class="bar">${inkBar(s.energy / 100, 0, 11)}</div></div>
      <div class="meter">Tokluk <b>${Math.round(s.satiety)}</b><div class="bar">${inkBar(s.satiety / 100, 0, 12)}</div></div>
      <div class="meter">Can <b>${Math.round(hp)}/${hpM}</b><div class="bar">${inkBar(hp / hpM, 0, 13)}</div></div>
    </div></header>`;
}

/* ---------------- Defter ---------------- */
export function defterScreen(cfg: Config, s: GameState): string {
  const food = Object.entries(s.inventory).filter(([k]) => GAME_ITEMS[k]?.slot === "Yiyecek");
  const rep = Math.floor(repOf(s, s.region, "taninirlik"));
  const left = minutesLeft(s);
  const hour = Math.floor(left / 60);
  const people = NPCS.map(n => {
    const known = s.metNpcs.includes(n.id) || rep >= (n.minRep ?? 0);
    return `<div class="person">${portrait(n.name, 46, known)}<div><div class="nm">${known ? esc(n.name) : "?"}</div><div class="rl">${known ? esc(n.role) : "Henüz tanışmadın"}</div></div></div>`;
  }).join("");
  const sawWolf = s.journal.kurt !== undefined || s.quests.kurt;
  const wolfMarks = (s.journal.kurt ?? []).map(id => ENEMIES.kurt.weakPoints.find(w => w.id === id)!).filter(Boolean);
  const analiz = s.attrs.analiz?.level ?? 0;
  const notes = s.log.slice(0, 8).map(l => `<div class="note ${l.kind ?? ""}"><small>G${l.day}</small>${esc(l.text)}</div>`).join("");
  return `<div class="page">
    <section class="sec">
      <h1>Taşpınar</h1>
      <p class="lede">Dağ eteğinde, otuz hanelik bir köy. ${rep <= 0 ? "Burada kimse seni tanımıyor." : rep < 5 ? "Birkaç kişi adını duymuş." : rep < 15 ? "Köyde adın anılmaya başladı." : "Köylüler seni selamlıyor."}</p>
      <p class="hand blue">Tanınırlık ${rep} · güven ${Math.floor(repOf(s, s.region, "guven"))}</p>
    </section>

    <section class="sec">
      <h2>Bugün</h2>
      <p>${left > 0 ? `Hava kararmadan <b>${hour} saat ${left % 60} dakika</b> var.` : "Gün bitti. Dinlenmezsen yarın hiçbir şey yapamazsın."}
        ${s.energy < 25 ? ` <span class="red">Çok yorgunsun; çalışsan da verim düşük olur.</span>` : ""}
        ${s.satiety < 25 ? ` <span class="red">Karnın aç; aç uyursan kasların dinlenmez.</span>` : ""}</p>
      <div class="row">
        ${food.length ? food.map(([k, n]) => `<button class="btn small" data-act="eat" data-id="${k}">${esc(GAME_ITEMS[k].name)} ye (${n})</button>`).join("") : `<span class="muted">Yiyeceğin yok.</span>`}
        <button class="btn small blue" data-act="buy-bread" ${s.money < 2 ? "disabled" : ""}>Fırından ekmek al · 2 bakır</button>
      </div>
      <div class="row"><button class="btn primary" data-act="sleep">${left > 4 * 60 ? "Erken yat" : "Uyu"}</button>
        <span class="muted" style="font-size:14px">Kaslar uykuda gelişir. Tok uyumak tam dinlenme demek.</span></div>
    </section>

    <section class="sec"><h2>Tanıdıklar</h2><div class="people">${people}</div></section>

    ${sawWolf ? `<section class="sec"><h2>Gözlemler</h2>
      <div class="card"><div class="entry-head"><span class="entry-title">Kurt</span><span class="entry-meta">${wolfMarks.length}/${ENEMIES.kurt.weakPoints.length} zayıf nokta</span></div>
      ${wolfSketch({ detail: analiz, marks: wolfMarks.map(w => ({ name: w.name, at: w.at })), width: 300 })}
      <p style="margin:0;font-size:14px" class="muted">${analiz < 12 ? "Çizimin kaba. Gözlem yeteneğin geliştikçe detaylar oturur (resim dersi işe yarar)." : "Çizgilerin netleşti; hayvanın yapısını görmeye başladın."}</p></div></section>` : ""}

    <section class="sec"><h2>Notlar</h2><div class="notes">${notes || `<div class="note">Köye yeni geldin. Çoban Hasan'ın bir derdi var gibi.</div>`}</div></section>
    <hr class="rule">
    <div class="row" style="justify-content:space-between"><button class="btn small red" data-act="reset">Yeni oyuna başla</button><span class="muted" style="font-size:13px">Sürüm ${esc(APP_VERSION)}</span></div>
  </div>`;
}

/* ---------------- Vücut ---------------- */
export function vucutScreen(cfg: Config, s: GameState): string {
  const lv = (id: string) => s.attrs[id]?.level ?? 0;
  const pd = (id: string) => s.attrs[id]?.pending ?? 0;
  const nm = (id: string) => cfg.attr.get(id)?.name ?? id;
  const groups = cfg.data.attributeCategories.map(c => {
    const attrs = cfg.data.attributes.filter(a => a.cat === c.id);
    if (!attrs.length) return "";
    return `<section class="sec"><h3 style="color:${esc(c.color)}">${esc(c.name)}</h3><div class="attr-group">${attrs.map((a, i) => {
      const st = s.attrs[a.id]; const max = a.max ?? 100;
      return `<div class="attr"><span class="nm" title="${esc(a.desc ?? "")}">${esc(a.name)}</span><div class="bar">${inkBar(st.level / max, st.pending / max, i + 3)}</div>
        <span class="v">${st.level.toFixed(1)}${st.pending > 0.01 ? `<br><span class="pend">+${st.pending.toFixed(1)}</span>` : ""}</span></div>`;
    }).join("")}</div></section>`;
  }).join("");
  return `<div class="page">
    <section class="sec"><h1>Vücut</h1><p class="lede">Kaslar çalıştıkça koyulaşır. Kesikli yeşil çizgi bu gece uykuda işlenecek gelişme.</p></section>
    <div class="body-wrap">${bodySketch(lv, pd, nm)}</div>
    ${groups}
  </div>`;
}

/* ---------------- Çalış ---------------- */
export function calisScreen(cfg: Config, s: GameState, ui: UiState): string {
  const res = ui.lastResult && Date.now() - ui.lastResult.at < 120000 ? ui.lastResult : undefined;
  const row = (id: string) => {
    const a = cfg.act.get(id)!; const chk = canDoActivity(cfg, s, id);
    const t = teacherOf(id);
    const chips = [...a.gains].sort((x, y) => y.w - x.w).slice(0, 4).map(g => {
      const at = cfg.attr.get(g.attribute);
      return `<span class="chip"><b style="background:${esc(catColor(cfg, at?.cat))}"></b>${esc(at?.name ?? g.attribute)}</span>`;
    }).join("");
    return `<div class="entry"><div class="entry-head"><span class="entry-title">${esc(a.name)}</span>
      <span class="entry-meta">${a.duration ?? 60} dk · yorgunluk ${a.fatigue ?? 0}${chk.ok && chk.fee ? ` · ${chk.fee} bakır` : ""}</span></div>
      ${t ? `<div style="font-size:14px" class="muted">Öğretmen: ${esc(t.name)}</div>` : ""}
      <div class="chips">${chips}</div>
      ${chk.ok ? `<div class="row"><button class="btn small" data-act="do" data-id="${esc(id)}">Yap</button></div>` : `<div class="lock">${esc(chk.reason)}</div>`}</div>`;
  };
  const selfActs = cfg.data.activities.filter(a => a.kind === "aktivite").map(a => row(a.id)).join("");
  const lessons = cfg.data.activities.filter(a => a.kind === "ders" && teacherOf(a.id)).map(a => row(a.id)).join("");
  return `<div class="page">
    <section class="sec"><h1>Çalış</h1><p class="lede">Ne yaparsan onda gelişirsin. Aynı şeyi tekrarlamak giderek daha az kazandırır.</p></section>
    ${res ? `<div class="card flash"><span class="entry-title">${esc(res.title)}</span>${gainList(cfg, res.gains)}${res.note ? `<p class="muted" style="margin:0;font-size:14px">${esc(res.note)}</p>` : ""}</div>` : ""}
    <section class="sec"><h2>Kendi başına</h2><div>${selfActs}</div></section>
    <section class="sec"><h2>Dersler</h2><p class="muted" style="margin:0;font-size:14px">Öğretmenler ancak tanıdıkları birine ders verir.</p><div>${lessons}</div></section>
  </div>`;
}

/* ---------------- İşler ---------------- */
export function islerScreen(cfg: Config, s: GameState): string {
  const list = questList(s).map(q => {
    const g = npc(q.def.giverNpc); const imp = cfg.importance(q.def.importance);
    const giver = cfg.giver(g.giver);
    let action = "";
    if (q.status === "yeni") action = `<button class="btn small" data-act="accept" data-id="${q.def.id}">Üstlen</button>`;
    if (q.status === "aktif") action = q.def.battle
      ? `<button class="btn small red" data-act="fight" data-id="${q.def.id}" ${minutesLeft(s) < 30 ? "disabled" : ""}>Meraya çık</button>`
      : `<button class="btn small blue" data-act="walk" data-id="${q.def.id}" ${minutesLeft(s) < q.def.minutes ? "disabled" : ""}>Git (${q.def.minutes} dk)</button>`;
    const reward = q.status === "bitti"
      ? `<div class="hand green" style="color:var(--green)">Ödül: ${esc(q.def.rewards.note)}</div>`
      : `<div style="font-size:14px" class="muted">${esc(giver?.name ?? "")} · ${esc(imp?.name ?? "")} iş. Ödülü verenin imkânı kadar olur.</div>`;
    return `<div class="entry"><div class="entry-head"><span class="entry-title">${esc(q.def.title)}</span><span class="entry-meta">${q.status === "bitti" ? "tamamlandı" : q.status === "aktif" ? "üstlendin" : q.status === "kilitli" ? "kilitli" : "yeni"}</span></div>
      <div class="person">${portrait(g.name, 40)}<div><div class="nm" style="font-size:19px">${esc(g.name)}</div><div class="rl">${esc(g.role)}</div></div></div>
      <p style="margin:0">${esc(q.def.text)}</p>${reward}
      ${q.status === "kilitli" ? `<div class="lock">${esc(q.reason ?? "")}</div>` : ""}<div class="row">${action}</div></div>`;
  }).join("");
  const inv = Object.entries(s.inventory).map(([k, n]) => {
    const gi = GAME_ITEMS[k]; const slot = gi?.slot ?? cfg.item.get(k)?.slot;
    const eq = s.equipped.weapon === k || s.equipped.armor === k;
    const can = slot === "Silah" || slot === "Zırh";
    return `<div class="entry"><div class="entry-head"><span class="entry-title" style="font-size:21px">${esc(itemName(cfg, k))}${n > 1 ? ` ×${n}` : ""}</span><span class="entry-meta">${esc(slot ?? "")}${eq ? " · kuşanıldı" : ""}</span></div>
      ${gi?.desc ? `<div style="font-size:14px" class="muted">${esc(gi.desc)}</div>` : ""}
      ${can && !eq ? `<div class="row"><button class="btn small" data-act="equip" data-id="${esc(k)}">Kuşan</button></div>` : ""}
      ${eq && slot === "Silah" ? `<div style="font-size:14px">Alışkınlık ${Math.round(s.familiarity[k] ?? 0)}/100</div>` : ""}</div>`;
  }).join("");
  return `<div class="page">
    <section class="sec"><h1>İşler</h1><p class="lede">Köylünün işi küçük, ödülü de küçük olur. Önemli bir iş, onun için değerli bir şey demektir.</p></section>
    <section class="sec">${list}</section>
    <section class="sec"><h2>Heybe</h2>${inv || `<p class="muted">Heyben boş.</p>`}</section>
  </div>`;
}

