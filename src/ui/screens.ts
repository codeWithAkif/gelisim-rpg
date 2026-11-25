// Ekranlar. Bilgi sayfaları: Defter, Vücut. Karar sayfaları: Çanta, Çalış, İşler.
// Her ekran HTML üretir; tıklamalar app.ts'deki data-act işleyicilerine gider.
import type { Config } from "../engine/config";
import { type GameState, clock, minutesLeft, repOf } from "../engine/state";
import { DEFERRED_CATEGORIES, type GainReport } from "../engine/progression";
import { questList, npc } from "../engine/quests";
import { maxHp } from "../engine/combat";
import { maxMana } from "../engine/derived";
import { planSession, SESSION_OPTIONS, wounded } from "../engine/session";
import { itemInfo, stacks, capacity, bagOf, craftCheck, freeCount } from "../engine/inventory";
import { CHAPTERS, ELEMENT_PAGES } from "../content/story";
import { NPCS, ENEMIES, teacherOf, SHOP, CRAFTS } from "../content/world";
import { esc, inkBar, portrait, wolfSketch, bodySketch, itemIcon, VITAL_ICONS } from "./sketch";
import { APP_VERSION } from "../update";
import { here, place, activityPlace } from "../engine/travel";
import { NPC_PLACE, SHOP_PLACE } from "../content/map";

export interface UiState { lastResult?: { title: string; gains: GainReport; note?: string; at: number }; sel?: string }

const fmt = (v: number) => (Math.abs(v) < 0.01 ? v.toFixed(3) : Math.abs(v) < 0.1 ? v.toFixed(2) : v.toFixed(1));
const catColor = (cfg: Config, id?: string) => cfg.cat.get(id ?? "")?.color ?? "var(--pencil)";

export function gainList(cfg: Config, g: GainReport, limit = 6): string {
  const rows = Object.entries(g).filter(([, v]) => v > 0.0004).sort((a, b) => b[1] - a[1]).slice(0, limit);
  if (!rows.length) return `<p class="muted">Belirgin bir gelişme yok.</p>`;
  return `<div class="gainlist">${rows.map(([id, v]) => {
    const a = cfg.attr.get(id); const later = DEFERRED_CATEGORIES.has(a?.cat ?? "");
    return `<div><span>${esc(a?.name ?? id)}${later ? ` <span class="muted">· uykuda işlenecek</span>` : ""}</span><span class="g">+${fmt(v)}</span></div>`;
  }).join("")}</div>`;
}

/* ---------------- Göstergeler ve uyarılar ---------------- */
export interface Vital { key: "hp" | "energy" | "food" | "mana"; label: string; value: number; max: number; color: string }
export function vitals(cfg: Config, s: GameState): Vital[] {
  const hpM = maxHp(cfg, s);
  const out: Vital[] = [
    { key: "hp", label: "Can", value: s.hp || hpM, max: hpM, color: "#C2483A" },
    { key: "energy", label: "Enerji", value: s.energy, max: 100, color: "#D9A53A" },
    { key: "food", label: "Tokluk", value: s.satiety, max: 100, color: "#A9783E" },
  ];
  if (s.knownElements.length) { const mm = maxMana(cfg, s); out.push({ key: "mana", label: "Mana", value: s.mana < 0 ? mm : s.mana, max: mm, color: "#5A7FB8" }); }
  return out;
}
export interface Alert { id: string; level: "red" | "amber"; text: string }
export function alerts(cfg: Config, s: GameState): Alert[] {
  const a: Alert[] = []; const hpM = maxHp(cfg, s), hp = s.hp || hpM;
  if (hp < hpM * 0.25) a.push({ id: "hp25", level: "red", text: "Ağır yaralısın. Savaşa girme; yemek ve uyku yaralarını kapatır." });
  else if (hp < hpM * 0.5) a.push({ id: "hp50", level: "amber", text: "Yaralısın: bedensel çalışma daha az kazandırır, daha çok yorar." });
  if (s.energy < 15) a.push({ id: "en15", level: "red", text: "Bitkinsin. Ağır iş yapamazsın; uyuman gerek." });
  else if (s.energy < 30) a.push({ id: "en30", level: "amber", text: "Yorgunsun: çalışmanın verimi düşüyor." });
  if (s.satiety < 15) a.push({ id: "fd15", level: "red", text: "Çok açsın: aç uyursan kasların gelişmez. Çantandan bir şey ye." });
  else if (s.satiety < 30) a.push({ id: "fd30", level: "amber", text: "Acıktın. Çantandan bir şey ye ya da pazardan al." });
  if (minutesLeft(s) <= 0) a.push({ id: "day", level: "amber", text: "Gün bitti. Uyumak için İşler'e git." });
  return a.sort((x, y) => (x.level === "red" ? 0 : 1) - (y.level === "red" ? 0 : 1));
}

export function statusBar(cfg: Config, s: GameState): string {
  const late = minutesLeft(s) <= 0;
  const g = vitals(cfg, s).map(v => {
    const f = Math.max(0, Math.min(1, v.value / v.max));
    const st = f < 0.25 ? "low" : f < 0.5 ? "warn" : "";
    return `<div class="gauge ${st}" title="${v.label}"><span class="gi">${VITAL_ICONS[v.key]}</span>
      <div class="gw"><div class="gl"><span>${v.label}</span><b>${Math.round(v.value)}${v.key === "hp" || v.key === "mana" ? "/" + v.max : ""}</b></div>
      <div class="gb"><div class="gf" style="width:${(f * 100).toFixed(1)}%;background:${v.color}"></div></div></div></div>`;
  }).join("");
  const al = alerts(cfg, s);
  return `<header class="status">
    <div class="day">Gün ${s.day}<small>${clock(s)}${late ? " · gün bitti" : ""}</small></div>
    <div class="money">${s.money} bakır</div>
    <button class="where" data-act="show-place" data-id="${esc(s.journey ? s.journey.to : s.location)}">⌖ ${s.journey ? `Yolda → ${esc(place(s.journey.to)?.name ?? "")}` : esc(here(s).name)}</button>
    <div class="vitals">${g}</div>
    ${al.length ? `<div class="alert-strip ${al[0].level}" role="status"><b>!</b><span>${esc(al[0].text)}${al.length > 1 ? ` <i>(+${al.length - 1})</i>` : ""}</span></div>` : ""}
  </header>`;
}

/* ---------------- Defter (bilgi) ---------------- */
export function defterScreen(cfg: Config, s: GameState): string {
  const rep = Math.floor(repOf(s, s.region, "taninirlik"));
  const people = NPCS.map(n => {
    const known = s.metNpcs.includes(n.id) || rep >= (n.minRep ?? 0);
    return `<div class="person">${portrait(n.name, 46, known)}<div><div class="nm">${known ? esc(n.name) : "?"}</div><div class="rl">${known ? esc(n.role) : "Henüz tanışmadın"}</div></div></div>`;
  }).join("");
  const sawWolf = s.journal.kurt !== undefined || s.quests.kurt;
  const wolfMarks = (s.journal.kurt ?? []).map(id => ENEMIES.kurt.weakPoints.find(w => w.id === id)!).filter(Boolean);
  const analiz = s.attrs.analiz?.level ?? 0;
  const notes = s.log.slice(0, 8).map(l => `<div class="note${l.kind ? " note-" + l.kind : ""}"><small>G${l.day}</small>${esc(l.text)}</div>`).join("");
  return `<div class="page">
    ${storySection(cfg, s)}
    <section class="sec">
      <h1>Taşpınar</h1>
      <p class="lede">Dağ eteğinde, otuz hanelik bir köy. ${rep <= 0 ? "Burada kimse seni tanımıyor." : rep < 5 ? "Birkaç kişi adını duymuş." : rep < 15 ? "Köyde adın anılmaya başladı." : "Köylüler seni selamlıyor."}</p>
      <p class="hand blue">${esc(s.name)} · tanınırlık ${rep} · güven ${Math.floor(repOf(s, s.region, "guven"))}</p>
    </section>
    <section class="sec"><h2>Tanıdıklar</h2><div class="people">${people}</div></section>
    ${s.knownElements.length ? `<section class="sec"><h2>Annemin sayfaları</h2>${s.knownElements.map(id => { const e = cfg.element.get(id); return `<div class="page-sheet" style="border-left-color:${esc(e?.color ?? "var(--red)")}"><div class="ttl">${esc(e?.name ?? id)}</div><p style="margin:0" class="hand blue">${esc(ELEMENT_PAGES[id] ?? e?.desc ?? "")}</p></div>`; }).join("")}</section>` : ""}
    ${sawWolf ? `<section class="sec"><h2>Gözlemler</h2>
      <div class="card"><div class="entry-head"><span class="entry-title">Kurt</span><span class="entry-meta">${wolfMarks.length}/${ENEMIES.kurt.weakPoints.length} zayıf nokta</span></div>
      ${wolfSketch({ detail: analiz, marks: wolfMarks.map(w => ({ name: w.name, at: w.at })), width: 300 })}
      <p style="margin:0;font-size:14px" class="muted">${analiz < 12 ? "Çizimin kaba. Gözlem yeteneğin geliştikçe detaylar oturur (resim dersi işe yarar)." : "Çizgilerin netleşti; hayvanın yapısını görmeye başladın."}</p></div></section>` : ""}
    <section class="sec"><h2>Notlar</h2><div class="notes">${notes || `<div class="note">Köye yeni geldin. Çoban Hasan'ın bir derdi var gibi.</div>`}</div></section>
    <hr class="rule">
    <div class="row" style="justify-content:space-between"><button class="btn small" data-act="menu">Ana menü ve ayarlar</button><span class="muted" style="font-size:13px">Sürüm ${esc(APP_VERSION)}</span></div>
  </div>`;
}

function storySection(_cfg: Config, s: GameState): string {
  const ch = CHAPTERS.find(c => !c.soon && c.milestones.some(m => !s.story.reached.includes(m.id)));
  if (!ch) {
    const next = CHAPTERS.find(c => c.soon);
    return `<section class="sec"><h2>${esc(s.name)}'in yolu</h2><p class="hand blue">Bölüm 1 tamamlandı. ${next ? esc(next.title) + " yakında." : ""}</p></section>`;
  }
  let nowShown = false;
  const steps = ch.milestones.map(m => {
    const done = s.story.reached.includes(m.id);
    if (done) return `<div class="story-step done"><span class="mk" style="color:var(--green)">✓</span><span class="t">${esc(m.title)}</span></div>`;
    if (!nowShown) { nowShown = true; return `<div class="story-step now"><span class="mk red">→</span><span><span class="t">${esc(m.title)}</span><div class="h">${esc(m.hint)}</div></span></div>`; }
    return `<div class="story-step"><span class="mk muted">·</span><span class="t muted">…</span></div>`;
  }).join("");
  return `<section class="sec"><h2>${esc(ch.title)}</h2><div>${steps}</div></section>`;
}

/* ---------------- Vücut (bilgi) ---------------- */
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
    <section class="sec"><h1>Vücut</h1><p class="lede">Kaslar çalıştıkça koyulaşır. Kesikli yeşil çizgi bu gece uykuda işlenecek gelişme.</p>
    ${wounded(cfg, s) ? `<p class="red" style="margin:0">Yaralısın: can ${s.hp}/${maxHp(cfg, s)}. Uyku yaraların çoğunu kapatır.</p>` : ""}</section>
    <div class="body-wrap">${bodySketch(lv, pd, nm)}</div>
    ${groups}
  </div>`;
}

/* ---------------- Çanta (karar) ---------------- */
export function cantaScreen(cfg: Config, s: GameState, ui: UiState): string {
  const cap = capacity(cfg, s); const st = stacks(cfg, s);
  const slot = (label: string, id: string | undefined, key: string) => {
    const it = id ? itemInfo(cfg, id) : undefined;
    return `<button class="eq-slot ${ui.sel === "eq:" + key ? "sel" : ""}" data-act="pick" data-id="eq:${key}" aria-label="${label}${it ? ": " + esc(it.name) : " boş"}">
      ${it ? itemIcon(it.id, 40) : `<span class="muted tiny">boş</span>`}<span class="eq-l">${label}</span></button>`;
  };
  const cells = Array.from({ length: cap }, (_, i) => {
    const x = st[i];
    if (!x) return `<div class="cell empty" aria-hidden="true"></div>`;
    const it = itemInfo(cfg, x.id);
    return `<button class="cell ${ui.sel === "inv:" + i ? "sel" : ""}" data-act="pick" data-id="inv:${i}" aria-label="${esc(it.name)} ${x.count}">${itemIcon(x.id, 38)}${x.count > 1 ? `<span class="cnt">${x.count}</span>` : ""}</button>`;
  }).join("");
  // seçili eşya ayrıntısı
  let selId: string | undefined, equippedKey: string | undefined;
  if (ui.sel?.startsWith("inv:")) selId = st[+ui.sel.slice(4)]?.id;
  if (ui.sel?.startsWith("eq:")) { equippedKey = ui.sel.slice(3); selId = equippedKey === "weapon" ? s.equipped.weapon : equippedKey === "armor" ? s.equipped.armor : bagOf(s); }
  let detail = `<p class="muted tiny" style="margin:0">Bir eşyaya dokun: ne işe yaradığını gör, kuşan, ye ya da bırak.</p>`;
  if (selId) {
    const it = itemInfo(cfg, selId); const acts: string[] = [];
    if (!equippedKey && (it.kind === "Silah" || it.kind === "Zırh" || it.kind === "Çanta")) acts.push(`<button class="btn small primary" data-act="equip" data-id="${esc(selId)}">Kuşan</button>`);
    if (equippedKey && equippedKey !== "bag") acts.push(`<button class="btn small" data-act="unequip" data-id="${esc(equippedKey)}">Çıkar</button>`);
    if (it.kind === "Yiyecek") acts.push(`<button class="btn small primary" data-act="eat" data-id="${esc(selId)}">Ye (+${it.satiety} tokluk)</button>`);
    if (!equippedKey && it.kind !== "Çanta") acts.push(`<button class="btn small red" data-act="drop" data-id="${esc(selId)}">Bırak</button>`);
    const stats = [it.damage ? `hasar ${it.damage}` : "", it.armor ? `koruma ${it.armor}` : "", it.capacity ? `${it.capacity} göz` : "", it.satiety ? `tokluk +${it.satiety}` : "",
      it.kind === "Silah" && s.familiarity[selId] !== undefined ? `alışkınlık ${Math.round(s.familiarity[selId] ?? 0)}/100` : ""].filter(Boolean).join(" · ");
    detail = `<div class="item-detail">${itemIcon(selId, 64)}<div><div class="entry-title">${esc(it.name)}</div><div class="muted tiny">${esc(it.kind)}${stats ? " · " + stats : ""}</div>
      <p style="margin:4px 0 8px;font-size:15px">${esc(it.desc)}</p><div class="row">${acts.join("")}</div></div></div>`;
  }
  const crafts = CRAFTS.map(c => {
    const chk = craftCheck(cfg, s, c); const p = itemInfo(cfg, c.product);
    const needs = Object.entries(c.needs).map(([id, n]) => `<span class="chip ${freeCount(cfg, s, id) >= n ? "" : "miss"}">${n} ${esc(itemInfo(cfg, id).name)}</span>`).join("");
    return `<div class="entry"><div class="item-detail">${itemIcon(c.product, 48)}<div><div class="entry-head"><span class="entry-title">${esc(p.name)}</span><span class="entry-meta">${c.minutes} dk</span></div>
      <div class="chips">${needs}${Object.entries(c.skill).map(([a, v]) => `<span class="chip">${esc(cfg.attr.get(a)?.name ?? a)} ${v}</span>`).join("")}</div>
      ${chk.ok ? `<div class="row" style="margin-top:6px"><button class="btn small" data-act="craft" data-id="${esc(c.id)}">Başla</button></div>` : `<div class="lock">${esc(chk.reason ?? "")}</div>`}</div></div></div>`;
  }).join("");
  return `<div class="page">
    <section class="sec"><div class="entry-head"><h1>Çanta</h1><span class="hand">${st.length}/${cap} göz</span></div>
      <div class="eq-row">${slot("Silah", s.equipped.weapon, "weapon")}${slot("Giysi", s.equipped.armor, "armor")}${slot("Çanta", bagOf(s), "bag")}</div></section>
    <div class="grid">${cells}</div>
    <section class="sec">${detail}</section>
    <section class="sec"><h2>El işi</h2><p class="muted tiny" style="margin:0">Malzemen ve becerin yetiyorsa kendin yap. Daha büyük çanta, daha çok göz.</p>${crafts}</section>
  </div>`;
}

/* ---------------- Çalış (karar) ---------------- */
export function calisScreen(cfg: Config, s: GameState, ui: UiState): string {
  const res = ui.lastResult && Date.now() - ui.lastResult.at < 120000 ? ui.lastResult : undefined;
  const row = (id: string) => {
    const a = cfg.act.get(id)!; const t = teacherOf(id);
    const perHour = 60 / (a.duration ?? 60);
    const best = SESSION_OPTIONS.map(o => planSession(cfg, s, id, o.ms)).find(p => p.ok);
    const any = planSession(cfg, s, id, SESSION_OPTIONS[0].ms);
    const chips = [...a.gains].sort((x, y) => y.w - x.w).slice(0, 4).map(g => {
      const at = cfg.attr.get(g.attribute);
      return `<span class="chip"><b style="background:${esc(catColor(cfg, at?.cat))}"></b>${esc(at?.name ?? g.attribute)}</span>`;
    }).join("");
    return `<div class="entry"><div class="entry-head"><span class="entry-title">${esc(a.name)}</span>
      <span class="entry-meta">saatte yorgunluk ${Math.round((a.fatigue ?? 0) * perHour)}${t ? ` · ${t.fee ?? 0} bakır/sa` : ""}</span></div>
      ${t ? `<div style="font-size:14px" class="muted">Öğretmen: ${esc(t.name)}</div>` : ""}
      <div class="chips">${chips}</div>
      ${best ? `<div class="row"><button class="btn small" data-act="session-pick" data-id="${esc(id)}">Başla</button></div>` : `<div class="lock">${esc(any.reason ?? "")}</div>`}
      ${!best && activityPlace(id) && !activityPlace(id)!.includes(s.location) ? `<div class="row"><button class="btn small blue" data-act="show-place" data-id="${esc(activityPlace(id)![0])}">Haritada göster</button></div>` : ""}</div>`;
  };
  const isMagic = (a: { params?: Record<string, unknown> }) => typeof a.params?.element === "string";
  const selfActs = cfg.data.activities.filter(a => a.kind === "aktivite" && !isMagic(a)).map(a => row(a.id)).join("");
  const magicActs = cfg.data.activities.filter(a => isMagic(a) && s.knownElements.includes(String(a.params!.element))).map(a => row(a.id)).join("");
  const lessons = cfg.data.activities.filter(a => a.kind === "ders" && teacherOf(a.id)).map(a => row(a.id)).join("");
  return `<div class="page">
    <section class="sec"><h1>Çalış</h1><p class="lede">Bir çalışma seç ve süresini belirle. Süre gerçek zamanda işler; uzun çalışan çok kazanır ama yorulur. Aynı şeyi tekrarlamak giderek daha az kazandırır.</p></section>
    ${res ? `<div class="card flash"><span class="entry-title">${esc(res.title)}</span>${gainList(cfg, res.gains)}${res.note ? `<p class="muted" style="margin:0;font-size:14px">${esc(res.note)}</p>` : ""}</div>` : ""}
    ${magicActs ? `<section class="sec"><h2>Büyü</h2><p class="muted" style="margin:0;font-size:14px">Annenin sayfalarına göre çalış. Büyü de bir beceri: tekrar ettikçe ustalaşırsın.</p><div>${magicActs}</div></section>` : ""}
    <section class="sec"><h2>Kendi başına</h2><div>${selfActs}</div></section>
    <section class="sec"><h2>Dersler</h2><p class="muted" style="margin:0;font-size:14px">Öğretmenler ancak tanıdıkları birine ders verir. Ücret başlayan her saat için.</p><div>${lessons}</div></section>
  </div>`;
}

/** Süre seçimi: her seçeneğin enerji maliyeti ve kapalıysa nedeni. */
export function sessionSheet(cfg: Config, s: GameState, actId: string): string {
  const a = cfg.act.get(actId)!; const perHour = 60 / (a.duration ?? 60);
  const hourGain = [...a.gains].sort((x, y) => y.w - x.w).slice(0, 4).map(g => {
    const at = cfg.attr.get(g.attribute)!; const lv = s.attrs[g.attribute]?.level ?? 0;
    const room = Math.max(0, 1 - lv / (at.max ?? 100));
    return `<span class="chip">${esc(at.name)} ≈ +${fmt(g.w * (at.learnRate ?? 1) * perHour * Math.pow(room, at.diminish ?? 1))}</span>`;
  }).join("");
  const opts = SESSION_OPTIONS.map(o => {
    const p = planSession(cfg, s, actId, o.ms);
    return `<button class="choice ${p.ok ? "" : "off"}" data-start="${o.ms}" ${p.ok ? "" : "disabled"}><b>${o.label}</b>
      <span class="tiny">${p.ok ? `enerji −${Math.ceil(p.energy)}${p.fee ? ` · ${p.fee} bakır` : ""}` : esc(p.reason ?? "")}</span></button>`;
  }).join("");
  return `<p class="hand muted" style="margin:0">Ne kadar çalışacaksın?</p><h2>${esc(a.name)}</h2>
    ${a.desc ? `<p style="margin:0" class="muted">${esc(a.desc)}</p>` : ""}
    <div class="chips"><span class="tiny muted">1 saatte:</span>${hourGain}</div>
    <div class="choices">${opts}</div>
    <p class="muted tiny" style="margin:0">Çalışırken başka bir şey yapamazsın. Uygulamayı kapatsan da süre işler; yarıda bırakırsan geçen süre kadar kazanırsın.</p>`;
}

/* ---------------- İşler (karar) ---------------- */
export function islerScreen(cfg: Config, s: GameState): string {
  const left = Math.floor(minutesLeft(s));
  const list = questList(s).map(q => {
    const g = npc(q.def.giverNpc); const imp = cfg.importance(q.def.importance);
    const giver = cfg.giver(g.giver);
    let action = "";
    const giverAt = NPC_PLACE[q.def.giverNpc];
    const goBtn = (pl: string) => `<button class="btn small blue" data-act="show-place" data-id="${pl}">${esc(place(pl)?.name ?? pl)} · haritada göster</button>`;
    if (q.status === "yeni") action = s.location === giverAt ? `<button class="btn small" data-act="accept" data-id="${q.def.id}">Üstlen</button>` : `<span class="muted tiny">${esc(g.name)} ${esc(place(giverAt)?.name ?? "")} tarafında.</span>${goBtn(giverAt)}`;
    if (q.status === "aktif") action = s.location !== q.def.at ? goBtn(q.def.at) : q.def.battle
      ? `<button class="btn small red" data-act="fight" data-id="${q.def.id}" ${left < 30 ? "disabled" : ""}>Meraya çık</button>`
      : `<button class="btn small blue" data-act="walk" data-id="${q.def.id}" ${left < q.def.minutes ? "disabled" : ""}>${esc(q.def.doneText ?? "Yap")} (${q.def.minutes} dk)</button>`;
    const reward = q.status === "bitti"
      ? `<div class="hand green" style="color:var(--green)">Ödül: ${esc(q.def.rewards.note)}</div>`
      : `<div style="font-size:14px" class="muted">${esc(giver?.name ?? "")} · ${esc(imp?.name ?? "")} iş. Ödülü verenin imkânı kadar olur.</div>`;
    return `<div class="entry"><div class="entry-head"><span class="entry-title">${esc(q.def.title)}</span><span class="entry-meta">${q.status === "bitti" ? "tamamlandı" : q.status === "aktif" ? "üstlendin" : q.status === "kilitli" ? "kilitli" : "yeni"}</span></div>
      <div class="person">${portrait(g.name, 40)}<div><div class="nm" style="font-size:19px">${esc(g.name)}</div><div class="rl">${esc(g.role)}</div></div></div>
      <p style="margin:0">${esc(q.def.text)}</p>${reward}
      ${q.status === "kilitli" ? `<div class="lock">${esc(q.reason ?? "")}</div>` : ""}<div class="row">${action}</div></div>`;
  }).join("");
  const shop = SHOP.map(id => {
    const it = itemInfo(cfg, id);
    return `<div class="shop-item">${itemIcon(id, 40)}<div><div class="nm">${esc(it.name)}</div><div class="muted tiny">${esc(it.desc)}</div></div>
      <button class="btn small" data-act="buy" data-id="${id}" ${s.money < (it.price ?? 0) ? "disabled" : ""}>${it.price} bakır</button></div>`;
  }).join("");
  return `<div class="page">
    <section class="sec card"><div class="entry-head"><h2>Bugün</h2><span class="hand">${clock(s)}</span></div>
      <p style="margin:0">${left > 0 ? `Hava kararmadan <b>${Math.floor(left / 60)} saat ${left % 60} dakika</b> var.` : "Gün bitti. Dinlenmezsen yarın hiçbir şey yapamazsın."}</p>
      <div class="row"><button class="btn primary" data-act="sleep">${left > 4 * 60 ? "Erken yat" : "Uyu"}</button>
      <span class="muted tiny">Kaslar uykuda gelişir, yaralar kapanır. Tok uyumak tam dinlenme demek.</span></div></section>
    <section class="sec"><h1>İşler</h1><p class="lede">Köylünün işi küçük, ödülü de küçük olur. Önemli bir iş, onun için değerli bir şey demektir.</p></section>
    <section class="sec">${list}</section>
    <section class="sec"><h2>Köy pazarı</h2>${s.location === SHOP_PLACE ? `<div>${shop}</div>` : `<p class="muted" style="margin:0">Pazar köy meydanında.</p><div class="row"><button class="btn small blue" data-act="show-place" data-id="${SHOP_PLACE}">Haritada göster</button></div>`}</section>
  </div>`;
}
