// Uygulama kabuğu: üst şerit, ekranlar, alt sekmeler, eylemler, kayıt.
import { config as cfg } from "../engine/config";
import type { GameState } from "../engine/state";
import { sleep, eat } from "../engine/progression";
import { acceptQuest, walkQuest, completeQuest, itemName } from "../engine/quests";
import { maxHp } from "../engine/combat";
import { load, save, reset } from "../engine/save";
import { newGame } from "../engine/state";
import { QUESTS } from "../content/world";
import { itemInfo, equip, unequip, drop, buy, bagOf } from "../engine/inventory";
import { startSession, startCraft, finishSession, fmtDur, type SessionResult } from "../engine/session";
import { openSessionSheet, openSessionRun } from "./session-view";
import { mountMap } from "./map-view";
import { travel, place } from "../engine/travel";
import { esc, ICONS } from "./sketch";
import { statusBar, defterScreen, vucutScreen, calisScreen, islerScreen, cantaScreen, gainList, alerts, type UiState } from "./screens";
import { openBattle } from "./battle-view";
import { openPlan } from "./plan-view";
import { showIntro } from "./intro";
import { showTitle } from "./title";
import { applySettings } from "./settings";
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
  function toast(t: string) { const el = root.querySelector("#toast")!; el.textContent = t; el.classList.add("on"); clearTimeout((toast as any).t); (toast as any).t = setTimeout(() => el.classList.remove("on"), 2400); }
  function render(keepScroll = true) {
    const y = main.scrollTop;
    root.querySelector("#statusSlot")!.innerHTML = statusBar(cfg, s);
    if (mapApi) { mapState = mapApi.state(); mapApi = undefined; }
    main.classList.toggle("map-mode", tab === "harita");
    if (tab === "harita") {
      main.innerHTML = `<div class="map-host"></div>`;
      mapApi = mountMap(main.querySelector<HTMLElement>(".map-host")!, cfg, s, {
        onTravel: async to => {
          const r = travel(cfg, s, to);
          if (r) { toast(`${place(to)!.name}: ${r.minutes} dk yürüdün.`); persist(); }
          mapState = { view: mapApi!.state().view, sel: to }; render(); storyTick();
        },
        onAct: (_k, qid) => { const q = QUESTS.find(x => x.id === qid)!; if (q.battle) doFight(qid); else doWalk(qid); },
      }, mapState);
    } else
    main.innerHTML = tab === "defter" ? defterScreen(cfg, s) : tab === "vucut" ? vucutScreen(cfg, s) : tab === "canta" ? cantaScreen(cfg, s, ui) : tab === "calis" ? calisScreen(cfg, s, ui) : islerScreen(cfg, s);
    root.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach(b => b.setAttribute("aria-current", b.dataset.tab === tab ? "page" : "false"));
    if (keepScroll) main.scrollTop = y; else main.scrollTop = 0;
    vitalAlerts();
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
  function sessionDone(r: SessionResult) {
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
      ${r.wounded ? `<p class="red" style="margin:0">Yaralıydın; bedensel kazanç düştü.</p>` : ""}`, [{ label: "Tamam", cls: "primary", fn: () => storyTick() }]);
  }
  function resumeSession() {
    if (!s.session) return false;
    const r = finishSession(cfg, s, Date.now());
    if (r) { sessionDone(r); return true; }
    openSessionRun(cfg, s, sessionDone, persist);
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
      const m = fresh[i];
      modal(`<p class="hand muted" style="margin:0">Yeni sayfa</p><h2>${esc(m.title)}</h2><p style="font-size:18px;line-height:1.5">${esc(m.text)}</p>`,
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
    render(false);
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
          persist(); render(); openSessionRun(cfg, s, sessionDone, persist);
        });
        break;
      case "craft": {
        const r = startCraft(cfg, s, id, Date.now());
        if (!r.ok) { toast(r.reason ?? "Başlayamadın"); break; }
        persist(); render(); openSessionRun(cfg, s, sessionDone, persist); break;
      }
      case "pick": ui.sel = ui.sel === id ? undefined : id; render(); break;
      case "eat": { const it = itemInfo(cfg, id); if (eat(s, id, it.satiety ?? 20)) { toast(`${it.name} yedin. Tokluk +${it.satiety}.`); if (!s.inventory[id]) ui.sel = undefined; persist(); render(); } break; }
      case "buy": { const r = buy(cfg, s, id); toast(r.ok ? `${itemInfo(cfg, id).name} aldın.` : r.reason ?? ""); persist(); render(); break; }
      case "drop": { if (drop(cfg, s, id)) { toast(`${itemInfo(cfg, id).name} bırakıldı.`); ui.sel = undefined; persist(); render(); } break; }
      case "unequip": { const r = unequip(cfg, s, id as "weapon" | "armor"); toast(r.ok ? "Çıkardın; çantana koydun." : r.reason ?? ""); ui.sel = undefined; persist(); render(); break; }
      case "sleep": {
        const hpBefore = s.hp; const rep = sleep(cfg, s);
        const m = maxHp(cfg, s); s.hp = Math.min(m, Math.round(hpBefore + m * 0.6));
        persist(); render(false);
        modal(`<h2>Gün ${s.day - 1} bitti</h2><p class="lede">${rep.recovery < 1 ? "Aç yattın; vücudun tam dinlenemedi." : "Tok ve yorgun uyudun. Vücut gece çalıştı."}</p>
          <h3>Gece işlenen</h3>${gainList(cfg, rep.applied, 8)}
          ${Object.keys(rep.decayed).length ? `<h3 class="red">Körelen</h3><p class="muted" style="margin:0">${Object.entries(rep.decayed).map(([k, v]) => `${esc(cfg.attr.get(k)?.name ?? k)} −${v.toFixed(2)}`).join(", ")}</p>` : ""}`,
          [{ label: "Güne başla", cls: "primary", fn: () => storyTick() }]);
        break;
      }
      case "accept": acceptQuest(s, id); persist(); render(); toast("İşi üstlendin."); break;
      case "walk": doWalk(id); break;
      case "fight": doFight(id); break;
      case "show-place": tab = "harita"; mapState = { view: mapState?.view ?? { cx: place(id)!.x, cy: place(id)!.y + 70, w: 300 }, sel: id }; if (mapState.view.w > 500 || Math.hypot(mapState.view.cx - place(id)!.x, mapState.view.cy - place(id)!.y) > mapState.view.w / 2) mapState.view = { cx: (place(id)!.x + place(s.location)!.x) / 2, cy: (place(id)!.y + place(s.location)!.y) / 2 + 70, w: 300 }; render(false); break;
      case "equip": {
        const kind = itemInfo(cfg, id).kind; const r = equip(cfg, s, id);
        toast(!r.ok ? r.reason ?? "" : kind === "Silah" ? "Yeni silaha alışman zaman alacak." : kind === "Çanta" ? `Artık ${itemInfo(cfg, bagOf(s)).capacity} gözün var.` : "Kuşandın.");
        ui.sel = undefined; persist(); render(); break;
      }
      case "menu": persist(); openTitle(); break;
    }
  });

  function doWalk(id: string) {
        const r = walkQuest(cfg, s, id);
        if ("error" in r) { toast(r.error); return; }
        persist(); render();
        modal(`<h2>${esc(QUESTS.find(q => q.id === id)!.title)}</h2><p>${esc(r.note)}</p><p class="hand blue">${Object.entries(r.items).map(([k, n]) => `${itemName(cfg, k)}${n > 1 ? " ×" + n : ""}`).join(", ")}${Object.keys(r.items).length ? " · " : ""}tanınırlık +${+r.rep.toFixed(1)}</p>`, [{ label: "Tamam", cls: "primary", fn: () => storyTick() }]);
        return;
        }
  function doFight(id: string) {
        const q = QUESTS.find(x => x.id === id)!;
        if (s.energy < 15) { toast("Bu yorgunlukla kurtların karşısına çıkamazsın."); return; }
        openPlan(cfg, s, id, q.title, q.battle!.map, q.battle!.enemies, (sc, plan) => openBattle(cfg, s, sc, plan, id, (o) => {
          let extra = "";
          if (o.result === "won") {
            const r = completeQuest(cfg, s, id);
            if (Object.keys(r.dropped).length) toast("Çantan doluydu; bazı ödülleri taşıyamadın.");
            extra = `<h3>Ödül</h3><p>${esc(r.note)}</p><p class="hand blue">${Object.entries(r.items).map(([k, n]) => `${itemName(cfg, k)}${n > 1 ? " ×" + n : ""}`).join(", ")}${r.money ? ` · ${r.money} bakır` : ""} · tanınırlık +${+r.rep.toFixed(1)}</p>`;
          }
          persist(); render();
          modal(`<h2>${o.result === "won" ? "Kurtlar uzaklaştı" : o.result === "fled" ? "Geri çekildin" : "Yenildin"}</h2>
            <p class="lede">${o.result === "lost" ? "Hasan seni yaralı hâlde bulup köye taşıdı. Dinlenmeden tekrar deneme." : o.result === "fled" ? "Kurtlar hâlâ orada. Hazırlanıp tekrar dene." : "Hasan uzaktan izliyordu; koşarak geldi."}</p>
            <h3>Savaşta gelişen</h3>${gainList(cfg, o.gains, 6)}${extra}`, [{ label: "Devam", cls: "primary", fn: () => storyTick() }]);
        }, persist), () => { persist(); render(); });
          }
  function beginIntro() {
    showIntro(name => { s.name = name; s.introDone = true; persist(); render(false); storyTick(); });
  }

  document.addEventListener("visibilitychange", () => { if (document.hidden) persist(); });
  function newGameNow() { reset(); s = newGame(cfg); s.hp = maxHp(cfg, s); persist(); tab = "defter"; ui.lastResult = undefined; render(false); beginIntro(); }
  function openTitle() {
    const started = s.introDone;
    showTitle({
      hasSave: started,
      summary: `${s.name} · Gün ${s.day} · ${currentChapter(s).title}`,
      onContinue: () => { render(false); if (!resumeSession()) storyTick(); },
      onNew: newGameNow,
    });
  }

  applySettings();
  render(false);
  persist();
  openTitle();

}
