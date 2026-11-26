// Uygulama kabuğu: üst şerit, ekranlar, alt sekmeler, eylemler, kayıt.
import { config as cfg } from "../engine/config";
import type { GameState } from "../engine/state";
import { sleep, eat } from "../engine/progression";
import { acceptQuest, walkQuest, completeQuest, itemName, type RewardReport } from "../engine/quests";
import { maxHp } from "../engine/combat";
import { load, save, reset } from "../engine/save";
import { newGame } from "../engine/state";
import { QUESTS, CRAFTS, ENEMIES } from "../content/world";
import { itemInfo, equip, unequip, drop, buy, bagOf } from "../engine/inventory";
import { startSession, startCraft, finishSession, fmtDur, type SessionResult } from "../engine/session";
import { openSessionSheet, openSessionRun } from "./session-view";
import { mountMap } from "./map-view";
import { place } from "../engine/travel";
import { startJourney, dueEvent, pauseJourney, resumeJourney, resolveEvent, finishJourney, turnBack, canUseChoice } from "../engine/journey";
import { makeScenario, DEFAULT_PLAN, foeWords, cap } from "../engine/combat";
import { AMBUSH_MAP } from "../content/world";
import { esc, ICONS } from "./sketch";
import { statusBar, defterScreen, vucutScreen, calisScreen, islerScreen, cantaScreen, gainList, alerts, type UiState } from "./screens";
import { openBattle } from "./battle-view";
import { openPlan } from "./plan-view";
import { openSiege } from "./siege-view";
import { openStealth } from "./stealth-view";
import { rollFoes, bonusOf, modeOptions, stealthGoal, siegeFromFoes, groundOf, type Mode, type Context } from "../engine/encounter";
import { addItem } from "../engine/inventory";
import { isNight } from "../engine/state";
import type { BattleOutcome } from "../engine/combat";
import { SIEGES } from "../engine/siege";
import { showIntro } from "./intro";
import { applyDaylight } from "./daylight";
import { notifyAt, clearNotify } from "../notify";
import { showTitle } from "./title";
import { applySettings } from "./settings";
import { sfx, buzz, ambience, unlockAudio } from "./feel";
import { darkness } from "./daylight";
import { searchHere, deliverRequest } from "../engine/explore";
import { sell, partner, stake, invest, withdraw, nightlyFinance } from "../engine/finance";
import { sleepOptions, sleepAt, rest, type SleepKind } from "../engine/rest";
import { minutesLeft } from "../engine/state";
import { itemPic, artUrl } from "./art";
import { currentChapter } from "../engine/story";
import { advanceStory } from "../engine/story";

type Tab = "defter" | "vucut" | "canta" | "harita" | "calis" | "isler";
// bilgi sayfaları solda, karar sayfaları sağda
const TABS: [Tab, string][] = [["defter", "Defter"], ["vucut", "Vücut"], ["canta", "Çanta"], ["harita", "Harita"], ["calis", "Çalış"], ["isler", "İşler"]];

export function startApp(root: HTMLElement) {
  let s: GameState = load(cfg);
  let tab: Tab = (() => { try { return (localStorage.getItem("gelisim-sekme") as Tab) || "defter"; } catch { return "defter"; } })();
  const ui: UiState = {};
  let mapState: ReturnType<ReturnType<typeof mountMap>["state"]> | undefined;
  let mapApi: ReturnType<typeof mountMap> | undefined;
  if (!s.hp) s.hp = maxHp(cfg, s);

  root.innerHTML = `<div id="statusSlot"></div><main id="main" tabindex="-1"></main>
    <nav class="tabs" aria-label="Bölümler">${TABS.map(([id, label]) => `<button data-tab="${id}">${ICONS[id]}<span>${label}</span></button>`).join("")}</nav>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>`;
  const main = root.querySelector<HTMLElement>("#main")!;

  function persist() { save(s); }
  let titleOpen = true;
  function syncAmbience() { ambience(!titleOpen && !document.querySelector(".battle, .minigame"), darkness(s.minute) > 0.7); }
  window.addEventListener("gelisim-ayar", syncAmbience);
  document.addEventListener("visibilitychange", syncAmbience);
  function toast(t: string) { const el = root.querySelector("#toast")!; el.textContent = t; el.classList.add("on"); clearTimeout((toast as any).t); (toast as any).t = setTimeout(() => el.classList.remove("on"), 2400); }
  function render(keepScroll = true) {
    const y = main.scrollTop;
    applyDaylight(s.minute); syncAmbience();
    root.querySelector("#statusSlot")!.innerHTML = statusBar(cfg, s);
    if (mapApi) { mapState = mapApi.state(); mapApi = undefined; }
    main.classList.toggle("map-mode", tab === "harita");
    main.classList.toggle("book-mode", tab === "defter");
    const leafY = tab === "defter" ? main.querySelectorAll<HTMLElement>(".leaf")[ui.page ?? 0]?.scrollTop ?? 0 : 0;
    if (tab === "harita") {
      main.innerHTML = `<div class="map-host"></div>`;
      mapApi = mountMap(main.querySelector<HTMLElement>(".map-host")!, cfg, s, {
        onTravel: to => {
          const r = startJourney(cfg, s, to, Date.now());
          if (!r.ok) { toast(r.reason ?? "Yola çıkamadın"); return; }
          persist(); mapState = { view: mapApi!.state().view, sel: to }; mapApi = undefined; render(); journeyTick();
        },
        onTurnBack: () => { if (turnBack(s, Date.now())) { toast("Geri dönüyorsun."); persist(); render(); } },
        onAct: (_k, qid) => { const q = QUESTS.find(x => x.id === qid)!; if (q.battle) doFight(qid); else doWalk(qid); },
      }, mapState);
    } else
    main.innerHTML = tab === "defter" ? defterScreen(cfg, s, ui.page ?? 0) : tab === "vucut" ? vucutScreen(cfg, s) : tab === "canta" ? cantaScreen(cfg, s, ui) : tab === "calis" ? calisScreen(cfg, s, ui) : islerScreen(cfg, s, ui);
    root.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach(b => b.setAttribute("aria-current", b.dataset.tab === tab ? "page" : "false"));
    if (keepScroll) main.scrollTop = y; else main.scrollTop = 0;
    if (tab === "defter") mountBook(keepScroll ? leafY : 0);
    vitalAlerts();
  }
  /** Defter: sayfalar yana kaydırılarak çevrilir; sekmeler sayfaya atlar. */
  function mountBook(leafY: number) {
    const track = main.querySelector<HTMLElement>(".book-track"); if (!track) return;
    const leaves = track.querySelectorAll<HTMLElement>(".leaf"); const tabs = main.querySelectorAll<HTMLButtonElement>(".book-tabs button");
    ui.page = Math.min(ui.page ?? 0, leaves.length - 1);
    track.scrollLeft = ui.page * track.clientWidth; leaves[ui.page].scrollTop = leafY;
    const mark = () => { tabs.forEach((b, i) => b.classList.toggle("on", i === ui.page)); tabs[ui.page!]?.scrollIntoView({ block: "nearest", inline: "nearest" }); };
    let tm = 0;
    track.addEventListener("scroll", () => {
      clearTimeout(tm);
      tm = window.setTimeout(() => { const p = Math.round(track.scrollLeft / track.clientWidth); if (p !== ui.page) { ui.page = p; sfx("page"); mark(); } }, 80);
    });
    tabs.forEach((b, i) => b.addEventListener("click", () => { ui.page = i; mark(); track.scrollTo({ left: i * track.clientWidth, behavior: "smooth" }); }));
    mark();
  }
  /** Bir değer eşiğin altına ilk düştüğünde uyarı; düzelince yeniden kurulur. */
  function vitalAlerts() {
    s.alerts ??= {};
    const now = new Set(alerts(cfg, s).map(a => a.id));
    // yeni düşen uyarılardan en ciddisi gösterilir
    const fresh = alerts(cfg, s).filter(a => !s.alerts![a.id] && a.id !== "day");
    fresh.forEach(a => { s.alerts![a.id] = true; });
    if (fresh.length) toast(fresh[0].text);
    for (const k of Object.keys(s.alerts)) if (!now.has(k)) delete s.alerts[k];
  }
  /** Oturum bitiş anına telefon bildirimi kurar. */
  function scheduleNotify() {
    const ss = s.session; if (!ss) return;
    const name = ss.kind === "craft" ? itemInfo(cfg, (CRAFTS.find(c => c.id === ss.id)?.product) ?? "").name : ss.label;
    notifyAt(ss.kind === "craft" ? "El işin bitti" : "Çalışman bitti", `${name} tamamlandı. Kazancını görmek için defterini aç.`, ss.startMs + ss.durMs)
      .then(r => { if (r === "izin-yok") toast("Bildirim izni verilmedi; Ayarlar'dan açabilirsin."); });
  }
  function sessionDone(r: SessionResult) {
    clearNotify();
    if (r.kind === "craft") {
      if (r.early) { toast("Yarıda bıraktın; malzemeler çantanda."); persist(); render(); return; }
      const p = itemInfo(cfg, r.product!);
      persist(); render();
      modal(`<p class="hand muted" style="margin:0">El işi bitti</p><h2>${esc(p.name)}</h2>${r.dropped ? `<p class="red">Çantanda yer yoktu; yere bıraktın.</p>` : `<p>Çantana koydun. Kuşanmak için Çanta'ya git.</p>`}${gainList(cfg, r.gains)}`, [{ label: "Tamam", cls: "primary", fn: () => storyTick() }]);
      return;
    }
    ui.lastResult = { title: r.label, gains: r.gains, at: Date.now(), note: r.wounded ? "Yaralıydın; bedensel kazanç düştü." : undefined };
    persist(); render();
    modal(`<p class="hand muted" style="margin:0">${r.early ? "Yarıda bıraktın" : "Çalışma bitti"} · ${fmtDur(r.minutes * 60_000)}</p><h2>${esc(r.label)}</h2>${gainList(cfg, r.gains, 8)}
      ${r.boost && r.boost > 1.01 ? `<p class="hand" style="margin:0;color:var(--green)">Odak turu: verim ×${r.boost.toFixed(1)}</p>` : ""}
      ${r.wounded ? `<p class="red" style="margin:0">Yaralıydın; bedensel kazanç düştü.</p>` : ""}`, [{ label: "Tamam", cls: "primary", fn: () => storyTick() }]);
    sfx(r.early ? "page" : "win"); buzz("medium");
  }
  function resumeSession() {
    if (!s.session) return false;
    const r = finishSession(cfg, s, Date.now());
    if (r) { sessionDone(r); return true; }
    openSessionRun(cfg, s, sessionDone, persist, scheduleNotify);
    return true;
  }
  /** Yeni kilometre taşlarını sırayla "Yeni sayfa" olarak gösterir. */
  function storyTick(after?: () => void) {
    const fresh = advanceStory(s);
    if (!fresh.length) { after?.(); return; }
    persist(); render();
    // birden fazla sayfa birden açıldıysa (eski kayıt, art arda olaylar) tek özet pencere
    if (fresh.length > 1) {
      const last = fresh[fresh.length - 1];
      modal(`<p class="hand muted" style="margin:0">Defterin önceki sayfaları</p><h2>${esc(last.title)}</h2>
        <div>${fresh.slice(0, -1).map(m => `<div class="story-step done"><span class="mk" style="color:var(--green)">✓</span><span class="t">${esc(m.title)}</span></div>`).join("")}</div>
        <p style="font-size:18px;line-height:1.5">${esc(last.text)}</p>`, [{ label: "Deftere işle", cls: "primary", fn: () => after?.() }]);
      return;
    }
    const show = (i: number) => {
      if (i >= fresh.length) { after?.(); return; }
      const m = fresh[i]; sfx("page"); const pic = artUrl("hikaye_" + m.id);
      modal(`<p class="hand muted" style="margin:0">Yeni sayfa</p><h2>${esc(m.title)}</h2>${pic ? `<img class="story-art small" src="${pic}" alt="">` : ""}<p style="font-size:18px;line-height:1.5">${esc(m.text)}</p>`,
        [{ label: "Deftere işle", cls: "primary", fn: () => show(i + 1) }]);
    };
    show(0);
  }
  function modal(html: string, buttons: { label: string; cls?: string; fn: () => void }[]) {
    const bg = document.createElement("div"); bg.className = "modal-bg";
    bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}<div class="row">${buttons.map((b, i) => `<button class="btn ${b.cls ?? ""}" data-i="${i}">${esc(b.label)}</button>`).join("")}</div></div>`;
    document.body.appendChild(bg);
    bg.addEventListener("click", e => { const t = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-i]"); if (!t) return; bg.remove(); buttons[+t.dataset.i!].fn(); });
    bg.querySelector<HTMLButtonElement>("[data-i]")?.focus();
  }

  root.querySelector("nav")!.addEventListener("click", e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-tab]"); if (!b) return;
    tab = b.dataset.tab as Tab; try { localStorage.setItem("gelisim-sekme", tab); } catch { /* yok */ }
    sfx("page"); render(false);
  });

  // üst şeritteki konum düğmesi haritayı açar
  root.querySelector("#statusSlot")!.addEventListener("click", e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-act=show-place]"); if (!b) return;
    tab = "harita"; mapState = { view: { cx: place(s.location)!.x, cy: place(s.location)!.y + 55, w: 230 }, sel: s.location }; render(false);
  });
  main.addEventListener("click", e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-act]"); if (!b || b.disabled) return;
    const id = b.dataset.id ?? "";
    switch (b.dataset.act) {
      case "session-pick":
        openSessionSheet(cfg, s, id, ms => {
          const p = startSession(cfg, s, id, ms, Date.now());
          if (!p.ok) { toast(p.reason ?? "Başlayamadın"); return; }
          persist(); render(); scheduleNotify(); openSessionRun(cfg, s, sessionDone, persist, scheduleNotify);
        });
        break;
      case "craft": {
        const r = startCraft(cfg, s, id, Date.now());
        if (!r.ok) { toast(r.reason ?? "Başlayamadın"); break; }
        persist(); render(); scheduleNotify(); openSessionRun(cfg, s, sessionDone, persist, scheduleNotify); break;
      }
      case "pick": ui.sel = ui.sel === id ? undefined : id; render(); break;
      case "eat": { const it = itemInfo(cfg, id); if (eat(s, id, it.satiety ?? 20)) { toast(`${it.name} yedin. Tokluk +${it.satiety}.`); if (!s.inventory[id]) ui.sel = undefined; persist(); render(); } break; }
      case "buy": { const r = buy(cfg, s, id); sfx(r.ok ? "coin" : "bad"); toast(r.ok ? `${itemInfo(cfg, id).name} aldın.` : r.reason ?? ""); persist(); render(); break; }
      case "drop": { if (drop(cfg, s, id)) { toast(`${itemInfo(cfg, id).name} bırakıldı.`); ui.sel = undefined; persist(); render(); } break; }
      case "unequip": { const r = unequip(cfg, s, id as "weapon" | "armor"); toast(r.ok ? "Çıkardın; çantana koydun." : r.reason ?? ""); ui.sel = undefined; persist(); render(); break; }
      case "sleep": openSleep(); break;
      case "accept": acceptQuest(s, id); sfx("page"); persist(); render(); toast("İşi üstlendin."); break;
      case "walk": doWalk(id); break;
      case "fight": doFight(id); break;
      case "show-place": tab = "harita"; mapState = { view: mapState?.view ?? { cx: place(id)!.x, cy: place(id)!.y + 70, w: 300 }, sel: id }; if (mapState.view.w > 500 || Math.hypot(mapState.view.cx - place(id)!.x, mapState.view.cy - place(id)!.y) > mapState.view.w / 2) mapState.view = { cx: (place(id)!.x + place(s.location)!.x) / 2, cy: (place(id)!.y + place(s.location)!.y) / 2 + 70, w: 300 }; render(false); break;
      case "equip": {
        const kind = itemInfo(cfg, id).kind; const r = equip(cfg, s, id);
        toast(!r.ok ? r.reason ?? "" : kind === "Silah" ? "Yeni silaha alışman zaman alacak." : kind === "Çanta" ? `Artık ${itemInfo(cfg, bagOf(s)).capacity} gözün var.` : "Kuşandın.");
        ui.sel = undefined; persist(); render(); break;
      }
      case "menu": persist(); openTitle(); break;
      case "search": doSearch(); break;
      case "sell": {
        const r = sell(cfg, s, id);
        if (!r.ok) { toast(r.reason ?? ""); break; }
        sfx("coin"); buzz("light"); toast(`${itemInfo(cfg, id).name} sattın: +${r.price} bakır`); persist(); render(); break;
      }
      case "partner": openPartner(id); break;
      case "market": tab = "isler"; render(false); setTimeout(() => main.querySelector(".shop-item")?.closest("section")?.scrollIntoView({ behavior: "smooth" }), 50); break;
      case "toggle-done": ui.showDone = !ui.showDone; render(); break;
      case "deliver": {
        const r = deliverRequest(cfg, s, id);
        if (!r.ok) { toast(r.reason ?? ""); break; }
        sfx("coin"); buzz("light"); persist(); render(); toast(r.text ?? "Teşekkür etti."); break;
      }
    }
  });

  /** Uyu ya da dinlen: nerede uyuyacağın dinlenmeyi ve gecenin tehlikesini belirler. */
  function openSleep() {
    if (s.journey) { toast("Yoldayken uyuyamazsın."); return; }
    const opts = sleepOptions(s); const left = minutesLeft(s);
    const pct = (r: number) => r <= 0 ? "güvenli" : r < 0.12 ? "az tehlikeli" : r < 0.25 ? "tehlikeli" : "çok tehlikeli";
    const btns: { label: string; cls?: string; fn: () => void }[] = [];
    for (const o of opts) if (o.ok) btns.push({ label: o.kind === "lodging" ? `Burada uyu${o.cost ? ` (${o.cost} bakır)` : ""}` : o.name, cls: o.kind === "lodging" ? "primary" : "", fn: () => doSleep(o.kind) });
    for (const m of [30, 60, 120]) if (left >= m) btns.push({ label: `${m < 60 ? m + " dk" : m / 60 + " saat"} dinlen`, fn: () => doRest(m) });
    btns.push({ label: "Vazgeç", fn: () => {} });
    modal(`<p class="hand muted" style="margin:0">${isNight(s) ? (left < 120 ? "Gecenin sonu" : "Gece") : "Daha erken"} · ${clockStr()}</p><h2>Uyu ya da dinlen</h2>
      ${opts.map(o => `<div class="here-act${o.kind === "lodging" && o.ok ? " main" : ""}"><div><b>${esc(o.name)}</b><div class="tiny muted">${esc(o.note)}</div>
        <div class="tiny">Dinlenme %${Math.round(o.quality * 100)} · ${pct(o.risk)}${o.risk > 0 ? ` (%${Math.round(o.risk * 100)})` : ""}</div>${o.ok ? "" : `<div class="tiny red">${esc(o.reason ?? "")}</div>`}</div></div>`).join("")}
      <p class="muted tiny" style="margin:0">Dinlenmek zamanı ilerletir: enerjin ve büyü gücün döner ama acıkırsın. Gece kası işler, yarayı uyku kapatır. ${s.pet ? `${esc(s.pet.name)} yanındayken açıkta daha güvendesin.` : ""}</p>`, btns);
  }
  function clockStr() { const h = (6 + Math.floor(s.minute / 60)) % 24, mm = Math.floor(s.minute % 60); return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`; }
  function doRest(m: number) {
    const r = rest(cfg, s, m); if ("error" in r) { toast(r.error); return; }
    sfx("page"); persist(); render();
    toast(`${r.minutes} dk dinlendin: enerji +${Math.round(r.energy)}, tokluk ${Math.round(r.satiety)}.`);
  }
  function doSleep(kind: SleepKind) {
    const r = sleepAt(cfg, s, kind); if ("error" in r) { toast(r.error); return; }
    const fin = nightlyFinance(s); const rep = r.report;
    persist(); render(false); if (r.event) { sfx("hurt"); buzz("medium"); }
    modal(`<h2>Gün ${s.day - 1} bitti</h2><p class="lede">${esc(r.option.kind === "lodging" ? `Geceyi geçirdin: ${r.option.name}.` : r.option.kind === "tent" ? "Çadırda uyudun." : "Açıkta uyudun.")} ${rep.recovery < 0.75 ? "Tam dinlenemedin." : "Vücut gece çalıştı."}</p>
      ${r.event ? `<p class="story-after" style="border-color:var(--red)">${esc(r.event.text)}</p>` : ""}
      <h3>Gece işlenen</h3>${gainList(cfg, rep.applied, 8)}
      ${fin.length ? `<h3>Ortaklıklar</h3>${fin.map(l => `<div class="ledger-row"><small>${esc(l.partner)}</small><span>${esc(l.text)}</span><b class="${l.amount >= 0 ? "green" : "red"}">${l.amount ? `${l.amount > 0 ? "+" : ""}${l.amount}` : ""}</b></div>`).join("")}` : ""}`,
      [{ label: "Güne başla", cls: "primary", fn: () => storyTick() }]);
  }
  /** Ortaklık: şartlar, payın, yatır ya da çek. */
  function openPartner(id: string) {
    const p = partner(id)!; const st = stake(s, id); const lock = p.unlock(s);
    const steps = [10, 25, 50].map(n => Math.max(n, st ? 0 : p.min)).filter((n, i, a) => a.indexOf(n) === i && st + n <= p.max && n <= s.money);
    const risk = p.risk * (p.safer?.(s) ? 0.5 : 1);
    const btns: { label: string; cls?: string; fn: () => void }[] = steps.map(n => ({ label: `${n} yatır`, cls: "primary", fn: () => { const r = invest(s, id, n); toast(r.ok ? `${p.name}: ${n} bakır yatırdın.` : r.reason ?? ""); if (r.ok) sfx("coin"); persist(); render(); } }));
    if (st) btns.push({ label: `Payını çek (${st})`, fn: () => { const r = withdraw(s, id); toast(r.ok ? `${r.amount} bakır geri aldın.` : r.reason ?? ""); if (r.ok) sfx("coin"); persist(); render(); } });
    btns.push({ label: "Kapat", fn: () => {} });
    modal(`<p class="hand muted" style="margin:0">Ortaklık</p><h2>${esc(p.name)}</h2><p style="margin:0">${esc(p.desc)}</p>
      <div class="odds"><span>Günlük getiri <b>~%${Math.round(p.rate * 100)}</b></span><span>Kötü gece <b>%${Math.round(risk * 100)}</b></span><span>Kötü gecede kayıp <b>~%${Math.round(p.loss * 100)}</b></span></div>
      ${p.safer?.(s) ? `<p class="tiny green" style="margin:0">Yaptıkların sayesinde risk yarıya indi.</p>` : ""}
      <p class="hand blue" style="margin:0">${lock && !st ? esc(lock) : st ? `Payın: ${st} bakır · şimdiye kadar +${s.partners![id].earned}` : `En az ${p.min}, en çok ${p.max} bakır koyabilirsin. Cebinde ${s.money} var.`}</p>
      <p class="muted tiny" style="margin:0">Paylar her gece uyuyunca gelir. Payını istediğin zaman, ortağının yanındayken geri alabilirsin.</p>`, lock && !st ? [{ label: "Kapat", fn: () => {} }] : btns);
  }
  /** Etrafı aramak: kısa bir arama anı, sonra ne bulunduğu. */
  function doSearch() {
    const bg = document.createElement("div"); bg.className = "modal-bg";
    bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><div class="searching"><span class="lens">⌕ ara…</span><p class="muted" style="margin:0">Otların arasına, taşların altına bakıyorsun.</p></div></div>`;
    document.body.appendChild(bg); sfx("page"); setTimeout(() => sfx("step"), 400); setTimeout(() => sfx("step"), 800);
    setTimeout(() => {
      bg.remove();
      const r = searchHere(cfg, s); persist(); render();
      if (!r.ok) { toast(r.reason ?? ""); return; }
      if (r.relic) { sfx("perfect"); buzz("heavy"); modal(`<p class="hand red" style="margin:0">Kadim eşya</p><h2>${esc(r.relic.name)}</h2><div class="relic-card"><div class="relic-glow"></div><p style="margin:0">${esc(r.text)} ${esc(r.relic.desc)}</p></div><h3>Güç sıçraması</h3>${gainList(cfg, r.gains, 6)}`, [{ label: "Deftere işle", cls: "primary", fn: () => {} }]); return; }
      if (r.found) { sfx(r.first ? "perfect" : "good"); buzz(r.first ? "medium" : "light"); } else sfx("page");
      const pic = r.found ? (r.found.item ? itemPic(r.found.item, 72) : "") : "";
      modal(`<p class="hand muted" style="margin:0">${r.found ? (r.first ? "Deftere yeni sayfa!" : "Buldun") : "Bir şey yok"}</p><h2>${esc(r.found?.name ?? "Boş el")}</h2>
        ${pic ? `<div class="found-pic">${pic}</div>` : ""}<p style="margin:0">${esc(r.text)}</p>${r.found && r.first ? `<p class="hand blue" style="margin:0">${esc(r.found.note)}</p>` : ""}${gainList(cfg, r.gains, 3)}`,
        [{ label: "Tamam", cls: "primary", fn: () => {} }]);
    }, 1300);
  }
  /** Görev ödülü: eşya, para, öğrenilen, kadim eşya ve hikâyenin devamı. */
  function rewardHtml(r: RewardReport): string {
    const items = Object.entries(r.items).map(([k, n]) => `${itemName(cfg, k)}${n > 1 ? " ×" + n : ""}`);
    if (r.money) items.push(`${r.money} bakır`);
    return `${r.after ? `<p class="story-after">${esc(r.after)}</p>` : ""}
      <p style="margin:0">${esc(r.note)}</p>
      ${r.bonus ? `<p class="hand red" style="margin:0">${esc(r.bonus)}</p>` : ""}
      <p class="hand blue" style="margin:0">${items.join(", ")}${items.length ? " · " : ""}tanınırlık +${+r.rep.toFixed(1)}</p>
      ${r.relics.map(x => `<div class="relic-card"><div class="relic-glow"></div><div><p class="hand red" style="margin:0">Kadim eşya</p><h3>${esc(x.name)}</h3><p class="tiny" style="margin:0">${esc(x.desc)}</p></div></div>`).join("")}
      ${Object.keys(r.gains).length ? `<h3>${r.relics.length ? "Güç sıçraması" : "Öğrendiklerin"}</h3>${gainList(cfg, r.gains, 8)}` : ""}`;
  }
  function doWalk(id: string) {
        const r = walkQuest(cfg, s, id);
        if ("error" in r) { toast(r.error); return; }
        persist(); render();
        sfx(r.relics.length ? "perfect" : "page");
        modal(`<h2>${esc(QUESTS.find(q => q.id === id)!.title)}</h2>${rewardHtml(r)}`, [{ label: "Tamam", cls: "primary", fn: () => storyTick() }]);
        return;
        }
  /** Nasıl savaşacaksın: göğüs göğüse, barikat, gizlenme. Her karşılaşmada sorulur. */
  function chooseMode(title: string, foes: string[], ctx: Context, pick: (m: Mode) => void, cancel?: () => void) {
    const counts: Record<string, number> = {}; for (const f of foes) counts[f] = (counts[f] ?? 0) + 1;
    const who = Object.entries(counts).map(([k, n]) => `${n > 1 ? n + " " : ""}${ENEMIES[k]?.name ?? k}`).join(", ");
    const opts = modeOptions(s, foes, ctx);
    const bg = document.createElement("div"); bg.className = "modal-bg";
    bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><p class="hand muted" style="margin:0">${ctx === "yol" ? "Yolda" : "Karşılaşma"}${isNight(s) ? " · gece" : ""}</p><h2>${esc(title)}</h2>
      <p style="margin:0">Karşında: <b>${esc(who)}</b>.${isNight(s) ? ` <span class="red">Gece: daha kalabalık, daha tehlikeli; ödülü de fazla.</span>` : ""}</p>
      <h3 style="margin:4px 0 0">Nasıl karşılayacaksın?</h3>
      <div class="choices modes">${opts.map(o => `<button class="choice" data-m="${o.id}" ${o.ok ? "" : "disabled"}><b>${esc(o.name)}</b><span>${esc(o.desc)}</span><span class="muted tiny">${esc(o.reason ?? o.outcome)}</span></button>`).join("")}</div>
      ${cancel ? `<div class="row"><button class="btn" data-m="x">Vazgeç</button></div>` : ""}</div>`;
    document.body.appendChild(bg); sfx("page");
    bg.addEventListener("click", e => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-m]"); if (!b || b.disabled) return;
      bg.remove(); if (b.dataset.m === "x") { cancel?.(); return; } pick(b.dataset.m as Mode);
    });
  }
  function doFight(id: string) {
        const q = QUESTS.find(x => x.id === id)!;
        if (s.energy < 15) { toast("Bu yorgunlukla savaşa giremezsin; dinlen."); return; }
        const siegeEnd = (won: boolean, gains: Record<string, number>, foes?: string[]) => {
          let extra = "";
          if (won) { const r = completeQuest(cfg, s, id, foes ? bonusOf(s, q.battle!.enemies, foes) : bonusOf(s, [], [])); extra = `<h3>Ödül</h3>${rewardHtml(r)}`; }
          persist(); render();
          modal(`<h2>${won ? "Savunma tuttu" : "Savunma düştü"}</h2><p class="lede">${won ? "Son dalga da çekildi." : "Geri çekilmek zorunda kaldın. Dinlen, kazıkları daha iyi yerleştir, yeniden dene."}</p>
            <h3>Savaşta gelişen</h3>${gainList(cfg, gains, 6)}${extra}`, [{ label: "Devam", cls: "primary", fn: () => storyTick() }]);
        };
        if (q.siege) { openSiege(cfg, s, SIEGES[q.siege], (s.seed + s.day * 31) | 0, (won, gains) => siegeEnd(won, gains), persist); return; }
        const base = q.battle!.enemies; const foes = rollFoes(s, base, id);
        const W = foeWords(foes); const big = foes.find(e => (ENEMIES[e]?.scale ?? 1) > 1);
        const battleEnd = (o: BattleOutcome) => {
          let extra = "";
          if (o.result === "won") {
            const r = completeQuest(cfg, s, id, bonusOf(s, base, foes));
            if (Object.keys(r.dropped).length) toast("Çantan doluydu; bazı ödülleri taşıyamadın.");
            extra = `<h3>Ödül</h3>${rewardHtml(r)}`; if (r.relics.length) sfx("perfect");
          }
          persist(); render();
          const boss = id === "akyele"; const home = q.giverNpc === "hasan";
          modal(`<h2>${o.result === "won" ? (big ? `${esc(ENEMIES[big].name)} düştü` : `${esc(cap(W.pl))} dağıldı`) : o.result === "fled" ? "Geri çekildin" : "Yenildin"}</h2>
            <p class="lede">${o.result === "lost" ? (boss ? "Sürü seni inden kovaladı; köylüler seni yarı baygın buldu. Hazırlanmadan dönme." : home ? "Hasan seni yaralı hâlde bulup köye taşıdı. Dinlenmeden tekrar deneme." : "Yaralı hâlde sürünerek kurtuldun. Dinlenmeden, hazırlanmadan tekrar deneme.") : o.result === "fled" ? (big ? `Sağ çıktın. ${esc(ENEMIES[big].name)} seni artık tanıyor.` : `${esc(cap(W.pl))} hâlâ orada. Hazırlanıp tekrar dene.`) : boss ? "Kalan kurtlar uluyarak kuzeye kaçtı." : home ? "Hasan uzaktan izliyordu; koşarak geldi." : "Nefesin yerine geldi; geride sessizlik kaldı."}</p>
            <h3>Savaşta gelişen</h3>${gainList(cfg, o.gains, 6)}${extra}`, [{ label: "Devam", cls: "primary", fn: () => storyTick() }]);
        };
        chooseMode(q.title, foes, "gorev", mode => {
          if (mode === "yakin") { openPlan(cfg, s, id, q.title, q.battle!.map, foes, (sc, plan) => openBattle(cfg, s, sc, plan, id, battleEnd, persist), () => { persist(); render(); }); return; }
          if (mode === "barikat") { openSiege(cfg, s, siegeFromFoes(q.title, foes, groundOf(s.region, foes)), (s.seed + s.day * 31 + s.minute) | 0, (won, gains) => siegeEnd(won, gains, foes), persist); return; }
          const goal = stealthGoal(foes, "gorev"); const night = isNight(s);
          openStealth(cfg, s, q.title, foes, goal, (s.seed * 7 + s.day * 131 + s.minute) | 0, night, (won, gains) => {
            persist(); render();
            const sc = makeScenario(s, q.battle!.map, foes, id);
            if (won && goal === "sizma") {
              const r = completeQuest(cfg, s, id, bonusOf(s, base, foes)); persist(); render(); if (r.relics.length) sfx("perfect");
              modal(`<h2>Kimse görmedi</h2><p class="lede">Gölgeden gölgeye geçtin; muhafızlar sırtlarını döndüğünde içerideydin. Tek kılıç çekilmedi.</p>
                <h3>Gizlenirken gelişen</h3>${gainList(cfg, gains, 6)}<h3>Ödül</h3>${rewardHtml(r)}`, [{ label: "Devam", cls: "primary", fn: () => storyTick() }]);
              return;
            }
            modal(won ? `<h2>Pusudasın</h2><p class="lede">${esc(cap(W.pl))} seni fark etmedi. İlk vuruş senin.</p>${gainList(cfg, gains, 4)}`
              : `<h2>Görüldün!</h2><p class="lede">Bir dal çatırdadı; bakışlar sana döndü. Kaçacak yer yok.</p>${gainList(cfg, gains, 4)}`,
              [{ label: "Savaş", cls: "primary", fn: () => openBattle(cfg, s, sc, { ...DEFAULT_PLAN, surprise: won, ambushed: !won }, id, battleEnd, persist) }]);
          }, persist);
        }, () => {});
  }
  /* ---------- yolculuk: her saniye ilerleme, sürpriz ve varış ---------- */
  let eventOpen = false;
  function journeyTick() {
    if (!s.journey || eventOpen) return;
    const now = Date.now();
    const due = dueEvent(s, now);
    if (due) {
      pauseJourney(s, now); persist(); eventOpen = true; sfx("page"); buzz("light");
      if (tab !== "harita") { tab = "harita"; render(false); } else mapApi?.refresh();
      const opts = due.def.choices.map(c => ({ ...c, ok: canUseChoice(s, c.need) }));
      const bg = document.createElement("div"); bg.className = "modal-bg";
      bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><p class="hand muted" style="margin:0">Yolda</p><h2>${esc(due.def.title)}</h2><p style="font-size:17px;line-height:1.5;margin:0">${esc(due.def.text)}</p>
        <div class="choices">${opts.map(o => `<button class="choice" data-c="${o.id}" ${o.ok ? "" : "disabled"}><b>${esc(o.label)}</b>${o.ok ? "" : `<span class="tiny">${o.need === "ates" ? "Ateş sayfası ve 8 mana gerekir" : ""}</span>`}</button>`).join("")}</div></div>`;
      document.body.appendChild(bg);
      bg.addEventListener("click", e => {
        const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-c]"); if (!b || b.disabled) return;
        bg.remove();
        const out = resolveEvent(cfg, s, b.dataset.c!, Date.now()); persist();
        const cont = () => { eventOpen = false; resumeJourney(s, Date.now()); persist(); render(); journeyTick(); };
        if (out.battle) {
          const foes = rollFoes(s, out.foes ?? ["kurt"], "yol" + s.day + Math.floor(s.minute)); const night = isNight(s);
          const spoils = (won: boolean) => won ? (addItem(cfg, s, "deri", night ? 2 : 1) ? "" : ` ${night ? "İki" : "Bir"} deri yüzdün.`) : "";
          const endModal = (head: string, text: string, gains: Record<string, number>) => { persist(); render(); modal(`<h2>${esc(head)}</h2><p class="lede">${esc(text)}</p>${gainList(cfg, gains, 5)}`, [{ label: "Yola devam", cls: "primary", fn: cont }]); };
          const melee = (plan = { ...DEFAULT_PLAN, ambushed: true }) => {
            const sc = makeScenario(s, AMBUSH_MAP, foes, "pusu" + s.day + s.minute);
            openBattle(cfg, s, sc, plan, undefined, o => endModal(o.result === "won" ? (foes.length > 1 ? "Sürü dağıldı" : "Kurt kaçtı") : o.result === "fled" ? "Sıyrıldın" : "Yaralandın",
              (o.result === "lost" ? "Kanayan kolunla yoluna devam ettin." : "Soluklanıp yoluna devam ettin.") + spoils(o.result === "won"), o.gains), persist);
          };
          chooseMode(due.def.title, foes, "yol", mode => {
            if (mode === "yakin") { melee(); return; }
            if (mode === "barikat") {
              openSiege(cfg, s, siegeFromFoes(due.def.title, foes, groundOf(s.region, foes)), (s.seed + s.day * 17 + s.minute) | 0,
                (won, gains) => endModal(won ? "Atlattın" : "Yaralandın", (won ? "Kazıkların arkasında sabaha kadar dayandın; sonunda çekildiler." : "Kazıklar dağıldı; zar zor sıyrıldın.") + spoils(won), gains), persist);
              return;
            }
            openStealth(cfg, s, due.def.title, foes, "kacis", (s.seed * 3 + s.day * 53 + s.minute) | 0, night, (won, gains) => {
              if (won) { endModal("Sıyrıldın", "Görünmeden geçtin; arkanda yalnızca rüzgâr kaldı.", gains); return; }
              persist(); modal(`<h2>Görüldün!</h2><p class="lede">Kokunu aldılar. Kaçacak yer yok.</p>`, [{ label: "Savaş", cls: "primary", fn: () => melee() }]);
            }, persist);
          });
          return;
        }
        modal(`<h2>${esc(due.def.title)}</h2><p style="font-size:17px">${esc(out.text)}</p>${Object.keys(out.gains).length ? gainList(cfg, out.gains, 4) : ""}`, [{ label: "Yola devam", cls: "primary", fn: cont }]);
      });
      return;
    }
    const arrived = finishJourney(cfg, s, now);
    if (arrived) {
      persist(); mapApi = undefined; mapState = { view: { cx: place(arrived.to)!.x, cy: place(arrived.to)!.y + 55, w: 230 }, sel: arrived.to };
      render(); toast(`Vardın: ${place(arrived.to)!.name}.`); sfx("good"); storyTick(); return;
    }
    if (tab === "harita") mapApi?.refresh();
    else root.querySelector("#statusSlot")!.innerHTML = statusBar(cfg, s);
    applyDaylight(s.minute);
    if (s.journey.pausedAt === undefined && !document.hidden) { sfx("step"); setTimeout(() => sfx("step"), 480); }
  }
  window.setInterval(journeyTick, 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) journeyTick(); });

  function beginIntro() {
    showIntro(name => { s.name = name; s.introDone = true; persist(); render(false); storyTick(); });
  }

  document.addEventListener("visibilitychange", () => { if (document.hidden) persist(); });
  function newGameNow() { reset(); s = newGame(cfg); s.hp = maxHp(cfg, s); persist(); tab = "defter"; ui.lastResult = undefined; render(false); beginIntro(); }
  function openTitle() {
    const started = s.introDone; titleOpen = true; syncAmbience();
    showTitle({
      hasSave: started,
      summary: `${s.name} · Gün ${s.day} · ${currentChapter(s).title}`,
      onContinue: () => {
        titleOpen = false;
        if (s.journey) { tab = "harita"; render(false); journeyTick(); return; }
        render(false); if (!resumeSession()) storyTick();
      },
      onNew: () => { titleOpen = false; newGameNow(); },
    });
  }

  applySettings(); unlockAudio();
  render(false);
  persist();
  openTitle();

}
