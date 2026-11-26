// Ekranlar. Bilgi sayfaları: Defter, Vücut. Karar sayfaları: Çanta, Çalış, İşler.
// Her ekran HTML üretir; tıklamalar app.ts'deki data-act işleyicilerine gider.
import type { Config } from "../engine/config";
import { type GameState, clock, minutesLeft, minutesToDark, repOf, isNight } from "../engine/state";
import { DEFERRED_CATEGORIES, type GainReport } from "../engine/progression";
import { questList, npc } from "../engine/quests";
import { maxHp } from "../engine/combat";
import { maxMana } from "../engine/derived";
import { healPower } from "../engine/healing";
import { planSession, SESSION_OPTIONS, wounded, TIME_SCALE, fmtDur } from "../engine/session";
import { itemInfo, stacks, capacity, bagOf, craftCheck, freeCount, pouchesOf, pouchSlots, inTab, INV_TABS, MAX_POUCHES, POUCH_SHARE, type InvTab } from "../engine/inventory";
import { canSell, dayFactor, PARTNERS, stake, ITEM_VALUES } from "../engine/finance";
import { STRUCTURES, yapiOf, levelOf, canBuild, canUpgrade, upgradeNeed, engLevel, REFUND } from "../engine/engineering";
import { fill as fillPet, petType, petMul, moodWord, doing, perksOf, homePets, homeSlots, PET_TYPES, type Pet } from "../engine/pet";
import { gearOf, slotsFor, weaponSet, totalArmor, totalDodge, gearBonus, wornIds, isTwoHanded, WEAR_SLOTS, SLOT_NAMES, type GearSlot } from "../engine/gear";
import { CHAPTERS, ELEMENT_PAGES } from "../content/story";
import { NPCS, ENEMIES, teacherOf, MARKETS, CRAFTS } from "../content/world";
import { esc, inkBar, wolfSketch, humanSketch, bodySketch, VITAL_ICONS, ICONS, STRUCT_ICONS } from "./sketch";
import { personPic, itemPic, placePic, motherPic, artUrl, petArt, structPic } from "./art";
import { RELICS } from "../content/relics";
import { REGION_NAMES } from "../content/map";
import { collected, seenCount, dailyRequests, searchInfo, canSearch } from "../engine/explore";
import { COLLECTIBLES, COLL_KIND_NAMES, FINDS, SEARCH_MINUTES, type CollKind } from "../content/explore";
import { APP_VERSION } from "../update";
import { phase, PHASE_ICONS } from "./daylight";
import { here, place, activityPlace, activityOpen } from "../engine/travel";
import { NPC_PLACE, SHOP_PLACE, PLACES } from "../content/map";

export interface UiState { lastResult?: { title: string; gains: GainReport; note?: string; at: number }; sel?: string; showDone?: boolean; page?: number; invTab?: InvTab; bagPage?: "envanter" | "techizat" | "elisi" | "pazar"; jobTab?: "acik" | "biten" | "sonraki"; bodyTab?: string; diyarTab?: string }

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

/** Kararmaya bu kadar dakika kala uyarı görünür; öncesinde üst şeritte yer kaplamaz. */
export const DARK_WARN_MIN = 120;
/** Saat yanındaki kısa zaman notu: yalnız akşam yaklaşınca, gece ve gün bitince. */
export function timeNote(s: GameState): { text: string; level: "" | "warn" | "red" } | null {
  const dark = minutesToDark(s); const lf = Math.floor(minutesLeft(s));
  const hm = (m: number) => m >= 60 ? `${Math.floor(m / 60)} sa ${Math.round(m % 60)} dk` : `${Math.round(m)} dk`;
  if (lf <= 0) return { text: "gün bitti", level: "red" };
  if (dark <= 0) return { text: `gece · uyku sınırına ${hm(lf)}`, level: "red" };
  if (dark <= DARK_WARN_MIN) return { text: `kararmaya ${hm(dark)}`, level: "warn" };
  return null;
}

export function statusBar(cfg: Config, s: GameState): string {
  const g = vitals(cfg, s).map(v => {
    const f = Math.max(0, Math.min(1, v.value / v.max));
    const st = f < 0.25 ? "low" : f < 0.5 ? "warn" : "";
    const val = `${Math.round(v.value)}${v.key === "hp" || v.key === "mana" ? "/" + v.max : ""}`;
    return `<div class="gauge ${st}" title="${v.label}: ${val}"><span class="gi">${VITAL_ICONS[v.key]}</span>
      <div class="gw"><div class="gl"><span class="sr">${v.label}</span><b>${val}</b></div>
      <div class="gb"><div class="gf" style="width:${(f * 100).toFixed(1)}%;background:${v.color}"></div></div></div></div>`;
  }).join("");
  const al = alerts(cfg, s); const tn = timeNote(s); const ph = phase(s.minute);
  return `<header class="status">
    <div class="st-row">
      <div class="day">Gün ${s.day}<small>${clock(s)}</small><span class="phase" title="${ph.name}" aria-label="${ph.name}">${PHASE_ICONS[ph.icon]}</span></div>
      <button class="where" data-act="show-place" data-id="${esc(s.journey ? s.journey.to : s.location)}">⌖ ${s.journey ? `Yolda → ${esc(place(s.journey.to)?.name ?? "")}` : esc(here(s).name)}</button>
      <div class="money"><span class="coin">${VITAL_ICONS.coin}</span>${s.money}<span class="sr"> bakır</span><button class="sleepbtn ${isNight(s) || s.energy < 25 ? "hot" : ""}" data-act="sleep" aria-label="Uyu ya da dinlen" title="Uyu ya da dinlen">${ICONS.uyku}</button></div>
    </div>
    ${tn ? `<div class="tnote ${tn.level}">${tn.text}</div>` : ""}
    <div class="vitals">${g}</div>
    ${al.length ? `<div class="alert-strip ${al[0].level}" role="status"><b>!</b><span>${esc(al[0].text)}${al.length > 1 ? ` <i>(+${al.length - 1})</i>` : ""}</span></div>` : ""}
  </header>`;
}

/* ---------------- Defter (bilgi) ---------------- */
export function defterScreen(cfg: Config, s: GameState, page = 0): string {
  const rep = Math.floor(repOf(s, s.region, "taninirlik"));
  const region = s.region ?? "taspinar";
  const people = NPCS.filter(n => (n.region ?? "taspinar") === region || s.metNpcs.includes(n.id)).map(n => {
    const known = s.metNpcs.includes(n.id) || rep >= (n.minRep ?? 0);
    return `<div class="person">${personPic(n, 46, known)}<div><div class="nm">${known ? esc(n.name) : "?"}</div><div class="rl">${known ? esc(n.role) : "Henüz tanışmadın"}</div></div></div>`;
  }).join("");
  const sawWolf = s.journal.kurt !== undefined || s.quests.kurt;
  const wolfMarks = (s.journal.kurt ?? []).map(id => ENEMIES.kurt.weakPoints.find(w => w.id === id)!).filter(Boolean);
  const analiz = s.attrs.analiz?.level ?? 0;
  const notes = s.log.slice(0, 8).map(l => `<div class="note${l.kind ? " note-" + l.kind : ""}"><small>G${l.day}</small>${esc(l.text)}</div>`).join("");
  const relics = (s.relics ?? []).map(id => RELICS[id]).filter(Boolean);
  const pages: { title: string; html: string }[] = [
    { title: "Hikâye", html: `${storySection(cfg, s)}
    <section class="sec">
      <h1>${esc(REGION_NAMES[region as keyof typeof REGION_NAMES] ?? "Taşpınar")}</h1>
      <p class="lede">${esc(REGION_DESC[region] ?? "")} ${rep <= 0 ? "Burada kimse seni tanımıyor." : rep < 5 ? "Birkaç kişi adını duymuş." : rep < 15 ? "Adın anılmaya başladı." : "İnsanlar seni selamlıyor."}</p>
      <p class="hand blue">${esc(s.name)} · tanınırlık ${rep} · güven ${Math.floor(repOf(s, s.region, "guven"))}</p>
    </section>` },
    { title: "Tanıdıklar", html: `<section class="sec"><h2>Tanıdıklar</h2><div class="people">${people}</div></section>
</section>` },
    ...(s.pet || homePets(s).length ? [{ title: "Evcil", html: petPage(cfg, s) }] : []),
    { title: "Koleksiyon", html: collectionSection(s) },
  ];
  if (s.knownElements.length) pages.push({ title: "Annem", html: `<section class="sec"><h2>Annemin sayfaları</h2>${motherPic()}${s.knownElements.map(id => { const e = cfg.element.get(id); return `<div class="page-sheet" style="border-left-color:${esc(e?.color ?? "var(--red)")}"><div class="ttl">${esc(e?.name ?? id)}</div><p style="margin:0" class="hand blue">${esc(ELEMENT_PAGES[id] ?? e?.desc ?? "")}</p></div>`; }).join("")}</section>` });
  if (relics.length) pages.push({ title: "Kadim", html: `<section class="sec"><h2>Kadim eşyalar</h2><p class="muted tiny" style="margin:0">Taşıdığın sürece güçleri seninle.</p>${relics.map(r => `<div class="relic-card"><div class="relic-glow"></div><div><h3>${esc(r.name)}</h3><p class="tiny" style="margin:0">${esc(r.desc)}</p><p class="hand green" style="margin:0">${Object.entries(r.boosts).map(([a, n]) => `${esc(cfg.attr.get(a)?.name ?? a)} +${n}`).join(" · ")}</p><p class="muted tiny" style="margin:0">${esc(r.source)}</p></div></div>`).join("")}</section>` });
  const humanMarks = (s.journal.insan ?? []).map(id => ENEMIES.haydut.weakPoints.find(w => w.id === id)!).filter(Boolean);
  const humanCard = s.journal.insan !== undefined ? `<div class="card"><div class="entry-head"><span class="entry-title">İnsan</span><span class="entry-meta">${humanMarks.length}/${ENEMIES.haydut.weakPoints.length} zayıf nokta</span></div>
      ${humanSketch({ marks: humanMarks.map(w => ({ name: w.name, at: w.at })), width: 300 })}
      <p style="margin:0;font-size:14px" class="muted">İnsanın zayıf noktalarını anatomi bilgisi açar: resim dersi ve şifacıların dersi işe yarar.</p></div>` : "";
  if (sawWolf || humanCard) pages.push({ title: "Gözlemler", html: `<section class="sec"><h2>Gözlemler</h2>${humanCard}
      <div class="card"><div class="entry-head"><span class="entry-title">Kurt</span><span class="entry-meta">${wolfMarks.length}/${ENEMIES.kurt.weakPoints.length} zayıf nokta</span></div>
      ${wolfMarks.length === ENEMIES.kurt.weakPoints.length && artUrl("dusman_kurt_anatomi")
        ? `<img class="anatomy" src="${artUrl("dusman_kurt_anatomi")}" alt="Kurt anatomisi"><p class="hand blue" style="margin:0">Üç zayıf noktayı da buldun; Zehra'nın gösterdiği gibi iskeletini de çizdin.</p>`
        : wolfSketch({ detail: analiz, marks: wolfMarks.map(w => ({ name: w.name, at: w.at })), width: 300 })}
      <p style="margin:0;font-size:14px" class="muted">${analiz < 12 ? "Çizimin kaba. Gözlem yeteneğin geliştikçe detaylar oturur (resim dersi işe yarar)." : "Çizgilerin netleşti; hayvanın yapısını görmeye başladın."}</p></div></section>` });
  const parts = PARTNERS.filter(p => stake(s, p.id) > 0);
  if (parts.length || (s.ledger ?? []).length) pages.push({ title: "Hesap", html: `<section class="sec"><h2>Hesap defteri</h2>
    <p class="hand blue" style="margin:0">Cebinde ${s.money} bakır${parts.length ? ` · ortaklıklarda ${parts.reduce((a, p) => a + stake(s, p.id), 0)} bakır` : ""}</p>
    ${parts.map(p => { const st = s.partners![p.id]; return `<div class="card"><div class="entry-head"><span class="entry-title">${esc(p.name)}</span><span class="entry-meta">${st.amount} bakır</span></div><p class="tiny" style="margin:0">Gün ${st.since}'den beri · şimdiye kadar +${st.earned} bakır kazandırdı.</p></div>`; }).join("")}
    <h3>Son hareketler</h3><div class="ledger">${(s.ledger ?? []).slice(0, 14).map(l => `<div class="ledger-row"><small>G${l.day}</small><span>${esc(l.text)}</span><b class="${l.amount >= 0 ? "green" : "red"}">${l.amount >= 0 ? "+" : ""}${l.amount}</b></div>`).join("") || `<p class="muted">Henüz bir hareket yok.</p>`}</div></section>` });
  pages.push({ title: "Notlar", html: `<section class="sec"><h2>Notlar</h2><div class="notes">${notes || `<div class="note">Köye yeni geldin. Çoban Hasan'ın bir derdi var gibi.</div>`}</div></section>
    <hr class="rule">
    <div class="row" style="justify-content:space-between"><button class="btn small" data-act="menu">Ana menü ve ayarlar</button><span class="muted" style="font-size:13px">Sürüm ${esc(APP_VERSION)}</span></div>` });
  const cur = Math.max(0, Math.min(pages.length - 1, page));
  return `<div class="book">
    <nav class="book-tabs" aria-label="Defter sayfaları">${pages.map((p, i) => `<button class="${i === cur ? "on" : ""}" data-page="${i}">${esc(p.title)}</button>`).join("")}</nav>
    <div class="book-track">${pages.map((p, i) => `<article class="leaf" aria-label="${esc(p.title)}"><div class="page">${p.html}</div><div class="leaf-num">${i + 1}</div></article>`).join("")}</div>
  </div>`;
}

const REGION_DESC: Record<string, string> = {
  taspinar: "Dağ eteğinde, otuz hanelik bir köy.",
  karacam: "Surlu tüccar şehri; herkesin bir fiyatı var.",
  ayazkale: "Buzla kaplı bir kale; kimse yabancıya gülümsemez.",
  ardic: "Küllerinin üstüne yeniden kurulmuş başkent.",
};
const KIND_ICON: Record<CollKind, string> = {
  bitki: `<svg width="40" height="40" viewBox="0 0 48 48" aria-hidden="true"><g fill="none" stroke="var(--ink)" stroke-width="1.4" stroke-linecap="round"><path d="M24 42V12"/><path d="M24 22c-8-2-12-8-12-12 6 0 11 4 12 12zM24 30c8-2 12-8 12-12-6 0-11 4-12 12z" fill="#7A9A5A"/></g></svg>`,
  hayvan: `<svg width="40" height="40" viewBox="0 0 48 48" aria-hidden="true"><g fill="#6B5235" stroke="var(--ink)" stroke-width="1.2"><ellipse cx="24" cy="31" rx="8" ry="7"/><ellipse cx="13" cy="20" rx="3.5" ry="4.5"/><ellipse cx="20" cy="13" rx="3.5" ry="4.5"/><ellipse cx="28" cy="13" rx="3.5" ry="4.5"/><ellipse cx="35" cy="20" rx="3.5" ry="4.5"/></g></svg>`,
  nesne: `<svg width="40" height="40" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="12" fill="#C9A24A" stroke="var(--ink)" stroke-width="1.4"/></svg>`,
};
/** Defterin koleksiyon sayfaları: bitkiler, hayvanlar, nesneler. Bulunmayanlar ipucuyla. */
function collectionSection(s: GameState): string {
  const got = collected(s); const sc = seenCount(s);
  const groups = (["bitki", "hayvan", "nesne"] as CollKind[]).map(k => {
    const list = COLLECTIBLES.filter(c => c.kind === k);
    return `<div class="coll-group"><h3>${COLL_KIND_NAMES[k]} <span class="muted tiny">${list.filter(c => got.has(c.id)).length}/${list.length}</span></h3>
      <div class="coll">${list.map(c => got.has(c.id)
        ? `<div class="coll-item">${c.item ? itemPic(c.item, 40) : KIND_ICON[k]}<div><div class="nm">${esc(c.name)}</div><div class="tiny muted">${esc(c.note)}</div></div></div>`
        : `<div class="coll-item unknown"><span class="q">?</span><div><div class="tiny muted">${esc(c.hint)}</div></div></div>`).join("")}</div></div>`;
  }).join("");
  return `<section class="sec"><h2>Koleksiyon</h2><p class="muted tiny" style="margin:0">Vadide ${sc.seen}/${sc.total} yer keşfettin. Gittiğin yerde etrafı aramak için İşler'e bak.</p>${groups}</section>`;
}

function storySection(_cfg: Config, s: GameState): string {
  const ch = CHAPTERS.find(c => !c.soon && c.milestones.some(m => !m.side && !s.story.reached.includes(m.id)));
  const finished = CHAPTERS.filter(c => !c.soon && c !== ch && c.milestones.every(m => m.side || s.story.reached.includes(m.id)));
  const past = finished.length ? `<div class="muted tiny" style="margin-bottom:6px">${finished.map(c => `✓ ${esc(c.title)}`).join(" · ")}</div>` : "";
  if (!ch) return `<section class="sec"><h2>${esc(s.name)}'in yolu</h2>${past}<p class="hand blue">Hikâye tamamlandı. Isı geri döndü. Defterin açık: dolaşmaya, öğrenmeye devam edebilirsin.</p></section>`;
  let nowShown = false;
  const steps = ch.milestones.map(m => {
    const done = s.story.reached.includes(m.id);
    if (done) return `<div class="story-step done"><span class="mk" style="color:var(--green)">✓</span><span class="t">${esc(m.title)}</span></div>`;
    if (m.side) return `<div class="story-step"><span class="mk muted">◦</span><span><span class="t">${esc(m.title)}</span> <span class="muted tiny">yan hikâye</span><div class="h">${esc(m.hint)}</div></span></div>`;
    if (!nowShown) { nowShown = true; return `<div class="story-step now"><span class="mk red">→</span><span><span class="t">${esc(m.title)}</span><div class="h">${esc(m.hint)}</div></span></div>`; }
    return `<div class="story-step"><span class="mk muted">·</span><span class="t muted">…</span></div>`;
  }).join("");
  return `<section class="sec">${past}<h2>${esc(ch.title)}</h2><div>${steps}</div></section>`;
}

/* ---------------- Vücut (bilgi) ---------------- */
export function vucutScreen(cfg: Config, s: GameState, ui: UiState = {}): string {
  const lv = (id: string) => s.attrs[id]?.level ?? 0;
  const pd = (id: string) => s.attrs[id]?.pending ?? 0;
  const nm = (id: string) => cfg.attr.get(id)?.name ?? id;
  const cats = cfg.data.attributeCategories.filter(c => cfg.data.attributes.some(a => a.cat === c.id));
  const cur = cats.find(c => c.id === ui.bodyTab) ?? cats[0];
  const pend = (c: { id: string }) => cfg.data.attributes.filter(a => a.cat === c.id).reduce((n, a) => n + (s.attrs[a.id]?.pending ?? 0), 0);
  const tabs = `<div class="seg" role="tablist">${cats.map(c => `<button role="tab" class="${c.id === cur.id ? "on" : ""}" data-act="bodytab" data-id="${c.id}" aria-selected="${c.id === cur.id}">${esc(c.name)}${pend(c) > 0.01 ? ` <i class="dot"></i>` : ""}</button>`).join("")}</div>`;
  const attrs = cfg.data.attributes.filter(a => a.cat === cur.id);
  const list = `<section class="sec"><h3 style="color:${esc(cur.color)}">${esc(cur.name)}</h3><div class="attr-group">${attrs.map((a, i) => {
    const st = s.attrs[a.id]; const max = a.max ?? 100;
    return `<div class="attr"><span class="nm" title="${esc(a.desc ?? "")}">${esc(a.name)}</span><div class="bar">${inkBar(st.level / max, st.pending / max, i + 3)}</div>
      <span class="v">${st.level.toFixed(1)}${st.pending > 0.01 ? `<br><span class="pend">+${st.pending.toFixed(1)}</span>` : ""}</span></div>`;
  }).join("")}</div></section>`;
  const body = cur.id === "fiziksel" ? `<div class="body-wrap">${bodySketch(lv, pd, nm, artUrl("vucut_insan"))}</div>` : "";
  return `<div class="page">${tabs}
    <section class="sec"><h1>Vücut</h1><p class="lede">Kaslar çalıştıkça koyulaşır. Kesikli yeşil çizgi bu gece uykuda işlenecek gelişme.</p>
    ${wounded(cfg, s) ? `<p class="red" style="margin:0">Yaralısın: can ${s.hp}/${maxHp(cfg, s)}. Uyku yaraların çoğunu kapatır.</p>` : ""}</section>
    ${body}${list}
  </div>`;
}

/* ---------------- Çanta (karar) ---------------- */
export function cantaScreen(cfg: Config, s: GameState, ui: UiState): string {
  const cap = capacity(cfg, s); const st = stacks(cfg, s);
  const slot = (label: string, id: string | undefined, key: string) => {
    const it = id ? itemInfo(cfg, id) : undefined;
    return `<button class="eq-slot ${ui.sel === "eq:" + key ? "sel" : ""}" data-act="pick" data-id="eq:${key}" aria-label="${label}${it ? ": " + esc(it.name) : " boş"}">
      ${it ? itemPic(it.id, 40) : `<span class="muted tiny">boş</span>`}<span class="eq-l">${label}</span></button>`;
  };
  const tab: InvTab = ui.invTab ?? "hepsi";
  const shown = st.map((x, i) => ({ x, i })).filter(v => inTab(cfg, v.x.id, tab));
  const cells = (tab === "hepsi" ? Array.from({ length: cap }, (_, i) => ({ x: st[i], i })) : shown).map(({ x, i }) => {
    if (!x) return `<div class="cell empty" aria-hidden="true"></div>`;
    const it = itemInfo(cfg, x.id);
    return `<button class="cell ${ui.sel === "inv:" + i ? "sel" : ""}" data-act="pick" data-id="inv:${i}" aria-label="${esc(it.name)} ${x.count}">${itemPic(x.id, 38)}${x.count > 1 ? `<span class="cnt">${x.count}</span>` : ""}</button>`;
  }).join("");
  // seçili eşya ayrıntısı
  let selId: string | undefined, equippedKey: string | undefined;
  if (ui.sel?.startsWith("inv:")) selId = st[+ui.sel.slice(4)]?.id;
  if (ui.sel?.startsWith("eq:")) { equippedKey = ui.sel.slice(3); selId = equippedKey.startsWith("pouch") ? pouchesOf(s)[+equippedKey.slice(5)] : equippedKey === "bag" ? bagOf(s) : s.equipped[equippedKey as GearSlot]; }
  let detail = `<p class="muted tiny" style="margin:0">Bir eşyaya dokun: ne işe yaradığını gör, kuşan, ye ya da bırak.</p>`;
  if (selId) {
    const it = itemInfo(cfg, selId); const acts: string[] = [];
    if (!equippedKey && it.kind === "Çanta") acts.push(`<button class="btn small primary" data-act="equip" data-id="${esc(selId)}">Ana çanta yap</button>`);
    if (!equippedKey && (it.kind === "Silah" || it.kind === "Zırh" || it.kind === "Takı")) {
      const ss = slotsFor(selId); const g = gearOf(selId);
      const lbl = (k: GearSlot) => g.bow ? "Yayı tak" : g.shield ? "Sol ele al" : g.hands === 2 ? "İki elle tut" : k === "weapon" ? "Sağ ele al" : k === "offhand" ? "Sol ele al" : g.part === "taki" ? `Tak${ss.length > 1 ? ` (${k === "trinket1" ? "1" : "2"})` : ""}` : "Giy";
      for (const k of g.part === "taki" ? [ss.find(x => !s.equipped[x]) ?? ss[0]] : ss) acts.push(`<button class="btn small primary" data-act="equip" data-id="${esc(selId)}|${k}">${lbl(k)}</button>`);
    }
    if (equippedKey && equippedKey !== "bag" && !equippedKey.startsWith("pouch")) acts.push(`<button class="btn small" data-act="unequip" data-id="${esc(equippedKey)}">Çıkar</button>`);
    if (equippedKey?.startsWith("pouch")) acts.push(`<button class="btn small" data-act="detach" data-id="${equippedKey.slice(5)}">Sök</button>`);
    if (!equippedKey && it.kind === "Çanta") acts.push(`<button class="btn small" data-act="attach" data-id="${esc(selId)}" ${pouchesOf(s).length >= MAX_POUCHES ? "disabled" : ""}>${esc(itemInfo(cfg, bagOf(s)).name)}'na dik (+${pouchSlots(cfg, selId)} göz)</button>`);
    if (it.kind === "Yiyecek") acts.push(`<button class="btn small primary" data-act="eat" data-id="${esc(selId)}">Ye (+${it.satiety} tokluk)</button>`);
    if (it.heal) acts.push(`<button class="btn small primary" data-act="heal" data-id="${esc(selId)}">Yarayı sar (+${Math.round(healPower(cfg, s, selId))} can)</button>`);
    if (!equippedKey && it.kind !== "Çanta") acts.push(`<button class="btn small red" data-act="drop" data-id="${esc(selId)}">Bırak</button>`);
    const val = ITEM_VALUES[selId] ?? it.price; const gm = gearOf(selId);
    const where = gm.bow ? "yay" : gm.shield ? "kalkan · sol el" : gm.hands === 2 ? "iki elli" : gm.hands === 1 ? "tek elli" : gm.part ? ({ bas: "baş", govde: "üst", alt: "alt", el: "eller", taki: "takı" } as const)[gm.part] : "";
    const bon = Object.entries(gm.bonus ?? {}).map(([a, v]) => `${cfg.attr.get(a)?.name ?? a} ${v > 0 ? "+" : ""}${v}`).join(", ");
    const stats = [where, it.damage ? `hasar ${it.damage}` : "", (gm.armor ?? it.armor) ? `koruma ${gm.armor ?? it.armor}` : "", gm.dodge ? `kaçınma ${gm.dodge > 0 ? "+" : ""}${gm.dodge}` : "", bon, val ? `değeri ~${val} bakır` : "", equippedKey?.startsWith("pouch") ? `ek bölme: +${pouchSlots(cfg, selId)} göz` : "", it.armor ? `koruma ${it.armor}` : "", it.capacity ? `${it.capacity} göz` : "", it.satiety ? `tokluk +${it.satiety}` : "",
      it.kind === "Silah" && s.familiarity[selId] !== undefined ? `alışkınlık ${Math.round(s.familiarity[selId] ?? 0)}/100` : ""].filter(Boolean).join(" · ");
    detail = `<div class="item-detail">${itemPic(selId, 64)}<div><div class="entry-title">${esc(it.name)}</div><div class="muted tiny">${esc(it.kind)}${stats ? " · " + stats : ""}</div>
      <p style="margin:4px 0 8px;font-size:15px">${esc(it.desc)}</p><div class="row">${acts.join("")}</div></div></div>`;
  }
  const crafts = CRAFTS.map(c => {
    const chk = craftCheck(cfg, s, c); const p = itemInfo(cfg, c.product);
    const needs = Object.entries(c.needs).map(([id, n]) => `<span class="chip ${freeCount(cfg, s, id) >= n ? "" : "miss"}">${n} ${esc(itemInfo(cfg, id).name)}</span>`).join("");
    return `<div class="entry"><div class="item-detail">${itemPic(c.product, 48)}<div><div class="entry-head"><span class="entry-title">${esc(p.name)}</span><span class="entry-meta">${c.minutes} dk</span></div>
      <div class="chips">${needs}${Object.entries(c.skill).map(([a, v]) => `<span class="chip">${esc(cfg.attr.get(a)?.name ?? a)} ${v}</span>`).join("")}</div>
      ${chk.ok ? `<div class="row" style="margin-top:6px"><button class="btn small" data-act="craft" data-id="${esc(c.id)}">Başla</button></div>` : `<div class="lock">${esc(chk.reason ?? "")}</div>`}</div></div></div>`;
  }).join("");
  const bp = ui.bagPage ?? "envanter";
  const seg = `<div class="seg" role="tablist">${([["envanter", "Envanter"], ["techizat", "Teçhizat"], ["elisi", "El işi"], ["pazar", "Pazar"]] as const).map(([id, n]) => `<button role="tab" class="${bp === id ? "on" : ""}" data-act="bagpage" data-id="${id}" aria-selected="${bp === id}">${n}</button>`).join("")}</div>`;
  const header = (title: string, right: string) => `<section class="sec"><div class="entry-head"><h1>${title}</h1><span class="hand">${right}</span></div>
      <div class="purse"><span class="coin">${VITAL_ICONS.coin}</span><span>Kese: <b>${s.money} bakır</b></span></div></section>`;
  if (bp === "techizat") return `<div class="page">${seg}<section class="sec"><div class="entry-head"><h1>Teçhizat</h1><span class="hand">${st.length}/${cap} göz</span></div>
      ${(() => { const ws = weaponSet(cfg, s); const bonus = [...new Set(wornIds(s).flatMap(id => Object.keys(gearOf(id).bonus ?? {})))].map(a => `${cfg.attr.get(a)?.name ?? a} ${gearBonus(s, a) > 0 ? "+" : ""}${+gearBonus(s, a).toFixed(1)}`).join(", ");
        return `<div class="gear-sum"><span>Vuruş <b>${+ws.dmg.toFixed(1)}</b>${ws.dual ? " (çift)" : ws.twoHanded ? " (iki el)" : ""}</span><span>Koruma <b>${totalArmor(s)}</b></span><span>Kaçınma <b>${totalDodge(s) >= 0 ? "+" : ""}${totalDodge(s)}</b></span>${bonus ? `<span>${esc(bonus)}</span>` : ""}</div>`; })()}
      <h3 class="eq-h">Giyim</h3><div class="eq-row">${WEAR_SLOTS.map(k => slot(SLOT_NAMES[k], s.equipped[k], k)).join("")}</div>
      <h3 class="eq-h">Eller</h3><div class="eq-row">${slot("Sağ el", s.equipped.weapon, "weapon")}${isTwoHanded(s.equipped.weapon) ? `<div class="eq-slot two"><span class="muted tiny">iki elli</span><span class="eq-l">Sol el</span></div>` : slot("Sol el", s.equipped.offhand, "offhand")}${slot("Yay", s.equipped.bow, "bow")}</div>
      <h3 class="eq-h">Çanta</h3><div class="eq-row">${slot("Çanta", bagOf(s), "bag")}${Array.from({ length: MAX_POUCHES }, (_, i) => slot(`Ek ${i + 1}`, pouchesOf(s)[i], "pouch" + i)).join("")}</div>
      <p class="muted tiny" style="margin:0">${esc(itemInfo(cfg, bagOf(s)).name)} ${itemInfo(cfg, bagOf(s)).capacity} göz${pouchesOf(s).map(p => ` + ${esc(itemInfo(cfg, p).name)} ${pouchSlots(cfg, p)}`).join("")} = <b>${cap} göz</b>. Boştaki bir çantayı ana çantaya dikersen kendi gözünün ancak %${Math.round(POUCH_SHARE * 100)}'ını katar.</p></section>
    <section class="sec">${detail}</section></div>`;
  if (bp === "pazar") return `<div class="page">${seg}${pazarSection(cfg, s)}</div>`;
  if (bp === "elisi") return `<div class="page">${seg}${header("El işi", "")}
    ${craftingSection(cfg, s, crafts)}</div>`;
  return `<div class="page">${seg}${header("Envanter", `${st.length}/${cap} göz`)}
    <div class="inv-tabs" role="tablist">${INV_TABS.map(x => { const n = x.id === "hepsi" ? st.length : st.filter(v => inTab(cfg, v.id, x.id)).length;
      return `<button role="tab" class="inv-tab ${tab === x.id ? "on" : ""}" data-act="invtab" data-id="${x.id}" aria-selected="${tab === x.id}">${x.name}<small>${n}</small></button>`; }).join("")}</div>
    <div class="grid">${cells || `<p class="muted tiny" style="grid-column:1/-1;margin:6px 0">Bu bölmede bir şey yok.</p>`}</div>
    <section class="sec">${detail}</section>
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
  // henüz açılmamış bölgelerin işleri gösterilmez; yalnız sayısı ipucu olarak kalır
  const open = (a: { id: string }) => activityOpen(s, a.id);
  const selfAll = cfg.data.activities.filter(a => a.kind === "aktivite" && !isMagic(a));
  const lessonAll = cfg.data.activities.filter(a => a.kind === "ders" && teacherOf(a.id));
  const hidden = selfAll.filter(a => !open(a)).length + lessonAll.filter(a => !open(a)).length;
  const selfActs = selfAll.filter(open).map(a => row(a.id)).join("");
  const magicActs = cfg.data.activities.filter(a => isMagic(a) && s.knownElements.includes(String(a.params!.element))).map(a => row(a.id)).join("");
  const lessons = lessonAll.filter(open).map(a => row(a.id)).join("");
  return `<div class="page">
    <section class="sec"><h1>Çalış</h1><p class="lede">Bir çalışma seç ve süresini belirle. Oyunda 1 saat, gerçekte 1 dakika sürer. Uzun çalışan çok kazanır ama yorulur; aynı şeyi tekrarlamak giderek daha az kazandırır.</p></section>
    ${res ? `<div class="card flash"><span class="entry-title">${esc(res.title)}</span>${gainList(cfg, res.gains)}${res.note ? `<p class="muted" style="margin:0;font-size:14px">${esc(res.note)}</p>` : ""}</div>` : ""}
    ${magicActs ? `<section class="sec"><h2>Büyü</h2><p class="muted" style="margin:0;font-size:14px">Annenin sayfalarına göre çalış. Büyü de bir beceri: tekrar ettikçe ustalaşırsın.</p><div>${magicActs}</div></section>` : ""}
    <section class="sec"><h2>Kendi başına</h2><div>${selfActs}</div></section>
    <section class="sec"><h2>Dersler</h2><p class="muted" style="margin:0;font-size:14px">Öğretmenler ancak tanıdıkları birine ders verir. Ücret başlayan her saat için.</p><div>${lessons}</div>
      ${hidden ? `<p class="tiny muted" style="margin:6px 0 0">Yeni yerlere vardıkça ${hidden} çalışma daha öğreneceksin.</p>` : ""}</section>
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
    return `<button class="choice ${p.ok ? "" : "off"}" data-start="${o.ms}" ${p.ok ? "" : "disabled"}><b>${o.label}</b><span class="tiny muted">gerçekte ${fmtDur(o.ms / TIME_SCALE)}</span>
      <span class="tiny">${p.ok ? `enerji −${Math.ceil(p.energy)}${p.fee ? ` · ${p.fee} bakır` : ""}` : esc(p.reason ?? "")}</span></button>`;
  }).join("");
  return `<p class="hand muted" style="margin:0">Ne kadar çalışacaksın?</p><h2>${esc(a.name)}</h2>
    ${a.desc ? `<p style="margin:0" class="muted">${esc(a.desc)}</p>` : ""}
    <div class="chips"><span class="tiny muted">Oyunda 1 saatte (gerçekte 1 dk):</span>${hourGain}</div>
    <div class="choices">${opts}</div>
    <p class="muted tiny" style="margin:0">Oyunda 1 dakika gerçekte 1 saniye sürer. Çalışırken başka bir şey yapamazsın; uygulamayı kapatsan da süre işler. Yarıda bırakırsan geçen süre kadar kazanırsın.</p>`;
}

/* ---------------- İşler (karar) ---------------- */
/** Pazarda satılabilecekler: günün fiyatıyla; aynı maldan çok satınca fiyat düşer. */
function sellList(cfg: Config, s: GameState): string {
  const ids = [...new Set(stacks(cfg, s).map(x => x.id))];
  const rows = ids.map(id => {
    const it = itemInfo(cfg, id); const c = canSell(cfg, s, id); const n = freeCount(cfg, s, id);
    return `<div class="shop-item">${itemPic(id, 40)}<div><div class="nm">${esc(it.name)}${n > 1 ? ` <span class="muted tiny">×${n}</span>` : ""}</div><div class="muted tiny">${c.ok ? (dayFactor(s, s.location, id) > 1.1 ? "Bugün fiyatı iyi." : dayFactor(s, s.location, id) < 0.9 ? "Bugün fiyatı düşük." : "") : esc(c.reason ?? "")}</div></div>
      <button class="btn small price" data-act="sell" data-id="${id}" ${c.ok ? "" : "disabled"}><span class="coin">${VITAL_ICONS.coin}</span>+${c.price}</button></div>`;
  }).join("");
  return `<h3>Sat</h3><p class="muted tiny" style="margin:0">Fiyatlar her gün değişir; aynı maldan çok satarsan düşer. Şehir otu ve kürkü köyden iyi alır.</p>${rows || `<p class="muted" style="margin:0">Satacak bir şeyin yok.</p>`}`;
}

/** Günlük küçük istekler (köylülerden). */
function dailyCards(cfg: Config, s: GameState): string {
  const reqs = dailyRequests(s);
  if (!reqs.length) return "";
  return `<section class="sec"><h2>Bugünün küçük istekleri</h2>${reqs.map(r => {
    const want = Object.entries(r.def.want).map(([k, n]) => `${itemPic(k, 22)} ${esc(itemInfo(cfg, k).name)} <b>${Math.min(n, s.inventory[k] ?? 0)}/${n}</b>`).join(" · ");
    const act = r.done ? `<span class="hand" style="color:var(--green)">Getirdin ✓</span>`
      : r.here && r.have ? `<button class="btn small primary" data-act="deliver" data-id="${r.def.id}">Ver</button>`
      : r.here ? `<span class="muted tiny">Çantanda yeterince yok.</span>`
      : `<button class="btn small blue" data-act="show-place" data-id="${r.place}">${esc(place(r.place)?.name ?? "")} · haritada göster</button>`;
    return `<div class="entry${r.done ? " done" : ""}"><div class="entry-head"><span class="entry-title" style="font-size:19px">${esc(r.npcName)}</span><span class="kind-chip k-gunluk">Günlük</span></div>
      <p style="margin:0">"${esc(r.def.text)}"</p><div class="want">${want}</div><div class="row"><span class="rl">${r.def.money} bakır${r.def.gift ? " ve hediye" : ""} · güven</span>${act}</div></div>`;
  }).join("")}<p class="muted tiny" style="margin:0">İstekler her sabah yenilenir.</p></section>`;
}

/** Görevin türü: neyi takip edeceğin anlaşılsın. */
export type QuestKind = "ana" | "hikaye" | "yan";
export const questKind = (def: { importance: string; repeatable?: boolean }): QuestKind => def.importance === "hayati" ? "ana" : def.repeatable || def.importance === "basit" ? "yan" : "hikaye";
export const KIND_NAMES: Record<QuestKind, string> = { ana: "Ana görev", hikaye: "Hikâye görevi", yan: "Yan görev" };
const kindChip = (k: QuestKind) => `<span class="kind-chip k-${k}">${KIND_NAMES[k]}</span>`;

export function islerScreen(cfg: Config, s: GameState, ui: UiState = {}): string {
  const left = Math.floor(minutesLeft(s));
  const kindOrder = { ana: 0, hikaye: 1, yan: 2 } as const; const stOrder = { aktif: 0, yeni: 1, kilitli: 2, bitti: 3 } as const;
  const localFirst = (q: { def: { at: string } }) => (PLACES.find(p => p.id === q.def.at)?.region ?? "taspinar") === (s.region ?? "taspinar") ? 0 : 1;
  const all = questList(s).sort((a, b) => stOrder[a.status] - stOrder[b.status] || localFirst(a) - localFirst(b) || kindOrder[questKind(a.def)] - kindOrder[questKind(b.def)]);
  const open = all.filter(q => q.status === "aktif" || q.status === "yeni");
  const closed = all.filter(q => q.status === "bitti");
  const next = all.filter(q => q.status === "kilitli");
  const tab = ui.jobTab ?? "acik";
  const card = (q: (typeof all)[number]) => {
    const g = npc(q.def.giverNpc); const imp = cfg.importance(q.def.importance); const giver = cfg.giver(g.giver); const kind = questKind(q.def);
    let action = "";
    const giverAt = NPC_PLACE[q.def.giverNpc];
    const goBtn = (pl: string) => `<button class="btn small blue" data-act="show-place" data-id="${pl}">${esc(place(pl)?.name ?? pl)} · haritada göster</button>`;
    if (q.status === "yeni") action = s.location === giverAt ? `<button class="btn small" data-act="accept" data-id="${q.def.id}">Üstlen</button>` : `<span class="muted tiny">${esc(g.name)} ${esc(place(giverAt)?.name ?? "")} tarafında.</span>${goBtn(giverAt)}`;
    if (q.status === "aktif") action = s.location !== q.def.at ? goBtn(q.def.at) : q.def.siege
      ? `<button class="btn small red" data-act="fight" data-id="${q.def.id}" ${left < 30 ? "disabled" : ""}>Savunmaya geç</button>`
      : q.def.battle
      ? `<button class="btn small red" data-act="fight" data-id="${q.def.id}" ${left < 30 ? "disabled" : ""}>Meraya çık</button>`
      : `<button class="btn small blue" data-act="walk" data-id="${q.def.id}" ${left < q.def.minutes ? "disabled" : ""}>${esc(q.def.doneText ?? "Yap")} (${q.def.minutes} dk)</button>`;
    const reward = q.status === "bitti"
      ? `<div class="hand green" style="color:var(--green)">Ödül: ${esc(q.def.rewards.note)}</div>`
      : `<div style="font-size:14px" class="muted">${esc(giver?.name ?? "")} · ${esc(imp?.name ?? "")} iş. Ödülü verenin imkânı kadar olur.</div>`;
    return `<div class="entry"><div class="entry-head"><span class="entry-title">${esc(q.def.title)}</span><span class="entry-meta">${q.status === "bitti" ? "tamamlandı" : q.status === "aktif" ? "üstlendin" : q.status === "kilitli" ? "kilitli" : "yeni"}</span></div>
      <div class="chips" style="margin:0 0 2px">${kindChip(kind)}</div>
      <div class="person">${personPic(g, 40)}<div><div class="nm" style="font-size:19px">${esc(g.name)}</div><div class="rl">${esc(g.role)}</div></div></div>
      <p style="margin:0">${esc(q.def.text)}</p>${reward}
      ${q.status === "kilitli" ? `<div class="lock">${esc(q.reason ?? "")}</div>` : ""}<div class="row">${action}</div></div>`;
  };
  // takip: şimdi ne yapmalı? Önce ana görev, sonra hikâye, sonra yan işler
  const track = [...open].sort((a, b) => (a.status === "aktif" ? 0 : 1) - (b.status === "aktif" ? 0 : 1) || kindOrder[questKind(a.def)] - kindOrder[questKind(b.def)])[0];
  const trackCard = track ? (() => {
    const k = questKind(track.def); const at = place(track.def.at)?.name ?? ""; const giverAt = NPC_PLACE[track.def.giverNpc];
    const step = track.status === "yeni" ? `${npc(track.def.giverNpc).name} ile konuş (${place(giverAt)?.name ?? ""}) ve işi üstlen.` : s.location === track.def.at ? `Buradasın: ${track.def.doneText ?? (track.def.battle || track.def.siege ? "savaşa hazırlan" : "işi yap")}.` : `${at} yerine git.`;
    return `<section class="sec track"><div class="entry-head"><h2>Şimdi takip et</h2>${kindChip(k)}</div><div class="entry-title">${esc(track.def.title)}</div><p style="margin:0">${esc(step)}</p></section>`;
  })() : "";
  const tabs: [string, string, number][] = [["acik", "Açık işler", open.length], ["biten", "Biten işler", closed.length], ["sonraki", "Sonraki iş", next.length]];
  const seg = `<div class="seg" role="tablist">${tabs.map(([id, n, c]) => `<button role="tab" class="${tab === id ? "on" : ""}" data-act="jobtab" data-id="${id}" aria-selected="${tab === id}">${n}${c ? ` <small>${c}</small>` : ""}</button>`).join("")}</div>`;
  const empty = (m: string) => `<p class="muted" style="margin:0">${m}</p>`;
  const body = tab === "biten" ? `<section class="sec">${closed.map(card).join("") || empty("Henüz bitirdiğin bir iş yok.")}</section>`
    : tab === "sonraki" ? `<section class="sec"><p class="muted tiny" style="margin:0">Henüz açılmamış işler. Önce yazan işi bitirince bunlar açılır.</p>${next.map(card).join("") || empty("Bilinen başka iş yok; insanlarla konuştukça yenileri çıkar.")}</section>`
    : `${trackCard}<section class="sec"><p class="lede" style="margin:0">${s.region && s.region !== "taspinar" ? "Önce bulunduğun yerin işleri; uzaktakiler aşağıda." : "Köylünün işi küçük, ödülü de küçük olur. Önemli bir iş, onun için değerli bir şey demektir."}</p>${open.map(card).join("") || empty("Şu an açık bir iş yok. Köyü dolaş, insanlarla tanış.")}</section>${dailyCards(cfg, s)}`;
  // yer resmi: üstünde mercek; basınca saklı şeyleri bulma oyunu açılır
  let hero = "";
  if (!s.journey) {
    const can = FINDS[s.location] ? canSearch(s) : null;
    const pic = placePic(s.location, here(s).name, "art-place") || `<div class="art-place plain"><span class="hand">${esc(here(s).name)}</span></div>`;
    if (can) {
      const inf = searchInfo(s);
      hero = `<div class="hero-lens">${pic}<button class="lens-btn" data-act="search" ${can.ok ? "" : "disabled"} aria-label="Etrafa bak"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="10" cy="10" r="6.5" fill="rgba(255,255,255,.35)"/><path d="M15 15l6 6"/></svg><span>Etrafa bak</span></button>
        <span class="lens-note">${can.ok ? `bugün ${inf.left} bulgu daha · ${SEARCH_MINUTES} dk` : esc(can.reason ?? "")}</span></div>`;
    } else hero = pic;
  }
  return `<div class="page">
    ${hero}
    <section class="sec"><h1>İşler</h1></section>
    ${seg}${body}
  </div>`;
}

/** Pazar: Çanta'nın bir sekmesi. Pazarın olduğu yerde alış-satış, değilse en yakın pazara yönlendirme. */
export function pazarSection(cfg: Config, s: GameState): string {
  const market = MARKETS[s.location];
  if (!market) {
    const ids = Object.keys(MARKETS); const near = ids.find(id => (PLACES.find(p => p.id === id)?.region ?? "taspinar") === (s.region ?? "taspinar")) ?? ids[0];
    const nm = MARKETS[near]?.name ?? "pazar"; const pl = place(near)?.name ?? "";
    return `<section class="sec"><h2>Pazar</h2><p style="margin:0">Burada pazar yok.</p><p class="muted" style="margin:0">Alıp satmak istersen <b>${esc(pl)}</b> (${esc(nm)}) tarafına git.</p>
      <div class="row"><button class="btn small blue" data-act="show-place" data-id="${near}">${esc(pl)} · haritada göster</button></div></section>`;
  }
  const shop = market.items.map(id => {
    const it = itemInfo(cfg, id);
    return `<div class="shop-item">${itemPic(id, 40)}<div><div class="nm">${esc(it.name)}</div><div class="muted tiny">${esc(it.desc)}</div></div>
      <button class="btn small price" data-act="buy" data-id="${id}" ${s.money < (it.price ?? 0) ? "disabled" : ""}><span class="coin">${VITAL_ICONS.coin}</span>${it.price}</button></div>`;
  }).join("");
  return `<section class="sec"><div class="entry-head"><h2>${esc(market.name)}</h2><span class="hand">${s.money} bakır</span></div><h3>Al</h3><div>${shop}</div>${sellList(cfg, s)}</section>`;
}

/** El işi sayfasının gövdesi: mühendislik atölyesi (kalıcı yapılar) ve eşya yapımı. */
function craftingSection(cfg: Config, s: GameState, craftsHtml: string): string {
  const eng = engLevel(s);
  const chips = (cost: Record<string, number>) => Object.entries(cost).filter(([, n]) => n > 0).map(([id, n]) => `<span class="chip ${freeCount(cfg, s, id) >= n ? "" : "miss"}">${n} ${esc(itemInfo(cfg, id).name)}</span>`).join("");
  const structs = STRUCTURES.map(d => {
    const y = yapiOf(s, d.id); const chk = canBuild(cfg, s, d.id); const need = upgradeNeed(s, d.id); const cu = canUpgrade(cfg, s, d.id);
    const lv = levelOf(s, d.id);
    return `<div class="entry struct"><div class="item-detail">${structPic(d.id, 56) || STRUCT_ICONS[d.icon]}<div style="flex:1;min-width:0">
      <div class="entry-head"><span class="entry-title">${esc(d.name)}</span><span class="entry-meta">${y.n} adet · seviye ${lv}/${d.maxLv}</span></div>
      <div class="muted tiny">${esc(d.desc)}</div><div class="tiny" style="margin:2px 0"><b>Şimdi:</b> ${esc(d.effect(lv))}</div>
      <div class="chips">${chips(d.cost)}<span class="chip">${d.minutes} dk</span>${Object.entries(d.skill).map(([a, v]) => `<span class="chip ${(s.attrs[a]?.level ?? 0) >= v ? "" : "miss"}">${esc(cfg.attr.get(a)?.name ?? a)} ${v}</span>`).join("")}</div>
      <div class="row" style="margin-top:6px"><button class="btn small" data-act="build" data-id="${d.id}" ${chk.ok ? "" : "disabled"}>Yap</button>
        <button class="btn small" data-act="upgrade" data-id="${d.id}" ${cu.ok ? "" : "disabled"}>${need ? `Geliştir → ${need.lv + 1}` : "Tam seviye"}</button>
        <button class="btn small red" data-act="dismantle" data-id="${d.id}" ${y.n > 0 ? "" : "disabled"}>Sök (%${Math.round(REFUND * 100)} geri)</button></div>
      ${!chk.ok ? `<div class="tiny red">Yapmak için: ${esc(chk.reason ?? "")}</div>` : ""}
      ${need ? `<div class="tiny muted">Geliştirme: ${chips(need.cost)} · mühendislik ${need.eng}${!cu.ok && y.n > 0 ? ` <span class="red">(${esc(cu.reason ?? "")})</span>` : ""}</div>` : ""}
    </div></div></div>`;
  }).join("");
  return `<section class="sec"><h2>Mühendislik</h2><p class="muted tiny" style="margin:0">Yaptığın barikat ve tuzaklar tükenmez: kuşatmada ve savaş hazırlığında kullanılır, savaştan sonra yine senindir. Dilersen sökersin, malzemesi geri gelir; geliştirdiğin seviye türde kalır.
    Gelecekte kuşatma silahları da burada yapılacak.</p><p class="hand blue" style="margin:0">Mühendislik düzeyi: <b>${eng.toFixed(1)}</b> <span class="muted tiny">(el becerisi, taktik, gözlem, güç)</span></p>${structs}</section>
  <section class="sec"><h2>Eşya yapımı</h2><p class="muted tiny" style="margin:0">Malzemen ve becerin yetiyorsa kendin yap.</p>${craftsHtml}</section>`;
}

/* ---------------- Evcil hayvan sayfası ---------------- */
function petPage(_cfg: Config, s: GameState): string {
  const p = s.pet; const at = s.location === s.estate?.homePlace; const slots = homeSlots(s);
  const bar = (label: string, v: number, color: string) => `<div class="pet-bar"><span>${label}</span><div class="gb"><div class="gf" style="width:${Math.max(0, Math.min(100, v))}%;background:${color}"></div></div><b>${Math.round(v)}</b></div>`;
  const stage = (pet: Pet) => {
    const f = fillPet(pet); const sleepy = 6 + s.minute / 60 >= 21 || f.energy < 20; const hungry = f.satiety < 20;
    return `<div class="pet-stage ${sleepy ? "sleepy" : hungry ? "still" : ""}"><div class="pet-walk"><div class="pet-bob">${petArt(pet.id, 120, sleepy || hungry ? "dur" : "yuru", ENEMIES[pet.id]?.tint ?? "")}</div></div>${sleepy ? `<i class="zz">z z z</i>` : ""}</div>`;
  };
  let main = `<section class="sec"><h2>Evcil hayvan</h2><p class="muted tiny" style="margin:0">Bir seferde tek hayvan yanında gezer${slots ? `; evin ${slots} hayvanlık yer veriyor.` : ". Bir evin olursa diğerleri orada yaşar."}</p></section>`;
  if (p) {
    const f = fillPet(p); const t = petType(p.id);
    main += `<section class="sec">${stage(p)}
      <div class="entry-head"><span class="entry-title" style="font-size:26px">${esc(p.name)}</span><span class="entry-meta">${esc(t.species)} · ${esc(t.role)} · ${moodWord(p)}</span></div>
      <p class="hand blue" style="margin:0">${esc(doing(s, p))}</p>
      ${bar("Tokluk", f.satiety, "var(--green)")}${bar("Keyif", f.mood, "#B07A1E")}${bar("Enerji", f.energy, "var(--blue)")}${bar("Bağ", p.bond, "var(--red)")}
      <p class="tiny muted" style="margin:0">${esc(t.desc)} Etkisi: ${Math.round(petMul(s) * 100)}% (tok ve keyifliyse tam çalışır).</p>
      <div class="row"><button class="btn small primary" data-act="pet-feed">Besle</button><button class="btn small" data-act="pet-caress">Sev</button><button class="btn small" data-act="pet-play">Oyna (30 dk)</button><button class="btn small" data-act="pet-rename">Adı değiştir</button></div>
      <h3>Yetenekler</h3>${perksOf(p).map(x => `<div class="perk ${x.on ? "on" : ""}"><b>${x.on ? "✓" : "bağ " + x.bond}</b><span>${esc(x.text)}</span></div>`).join("")}
      <div class="row">${slots ? `<button class="btn small" data-act="pet-home" ${at && homePets(s).length < slots ? "" : "disabled"}>Evde bırak</button>` : ""}<button class="btn small red" data-act="pet-release">Salıver</button></div>
      ${slots && !at ? `<p class="tiny muted" style="margin:0">Değiştirmek için evinde olmalısın.</p>` : ""}</section>`;
  } else main += `<section class="sec"><p class="hand blue" style="margin:0">Yanında evcil hayvan yok.</p></section>`;
  const home = homePets(s);
  if (home.length) main += `<section class="sec"><h2>Evde yaşayanlar</h2>${home.map((h, i) => { const f = fillPet(h); const t = petType(h.id);
    return `<div class="card"><div class="item-detail">${petArt(h.id, 56, "dur", ENEMIES[h.id]?.tint ?? "")}<div style="flex:1;min-width:0"><div class="entry-head"><span class="entry-title">${esc(h.name)}</span><span class="entry-meta">${esc(t.species)} · ${moodWord(h)}</span></div>
      <div class="tiny muted">tokluk ${Math.round(f.satiety)} · keyif ${Math.round(f.mood)} · bağ ${Math.floor(h.bond)}</div><div class="row" style="margin-top:6px"><button class="btn small" data-act="pet-swap" data-id="${i}" ${at ? "" : "disabled"}>Yanıma al</button></div></div></div></div>`; }).join("")}</section>`;
  const shops = Object.values(PET_TYPES).filter(x => x.shop);
  main += `<section class="sec"><h2>Yavru bulmak</h2><p class="muted tiny" style="margin:0">Yavruları ilgili yerlerde bulursun; bir sorun çıkmaması için önce yer ayırmalısın.</p>${shops.map(x => `<div class="entry"><div class="item-detail">${petArt(x.id, 44, "dur", ENEMIES[x.id]?.tint ?? "")}<div><div class="entry-head"><span class="entry-title">${esc(x.species)}</span><span class="entry-meta">${x.price} bakır</span></div><div class="tiny muted">${esc(x.role)} · ${esc(x.desc)}</div><div class="tiny">Nerede: ${esc(place(x.shop!)?.name ?? x.shop!)}</div></div></div></div>`).join("")}</section>`;
  return main;
}
