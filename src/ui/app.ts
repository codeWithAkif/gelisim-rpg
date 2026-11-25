// Uygulama kabuğu: üst şerit, ekranlar, alt sekmeler, eylemler, kayıt.
import { config as cfg } from "../engine/config";
import type { GameState } from "../engine/state";
import { doActivity, sleep, eat } from "../engine/progression";
import { acceptQuest, walkQuest, completeQuest, itemName } from "../engine/quests";
import { maxHp } from "../engine/combat";
import { load, save, reset } from "../engine/save";
import { newGame } from "../engine/state";
import { GAME_ITEMS, QUESTS } from "../content/world";
import { esc, ICONS } from "./sketch";
import { statusBar, defterScreen, vucutScreen, calisScreen, islerScreen, gainList, type UiState } from "./screens";
import { openBattle } from "./battle-view";
import { openPlan } from "./plan-view";
import { showIntro } from "./intro";
import { showTitle } from "./title";
import { applySettings } from "./settings";
import { currentChapter } from "../engine/story";
import { advanceStory } from "../engine/story";

type Tab = "defter" | "vucut" | "calis" | "isler";
const TABS: [Tab, string][] = [["defter", "Defter"], ["vucut", "Vücut"], ["calis", "Çalış"], ["isler", "İşler"]];

export function startApp(root: HTMLElement) {
  let s: GameState = load(cfg);
  let tab: Tab = (() => { try { return (localStorage.getItem("gelisim-sekme") as Tab) || "defter"; } catch { return "defter"; } })();
  const ui: UiState = {};
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
    main.innerHTML = tab === "defter" ? defterScreen(cfg, s) : tab === "vucut" ? vucutScreen(cfg, s) : tab === "calis" ? calisScreen(cfg, s, ui) : islerScreen(cfg, s);
    root.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach(b => b.setAttribute("aria-current", b.dataset.tab === tab ? "page" : "false"));
    if (keepScroll) main.scrollTop = y; else main.scrollTop = 0;
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

  main.addEventListener("click", e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-act]"); if (!b || b.disabled) return;
    const id = b.dataset.id ?? "";
    switch (b.dataset.act) {
      case "do": {
        const r = doActivity(cfg, s, id);
        if ("error" in r) { toast(r.error); break; }
        const a = cfg.act.get(id)!;
        ui.lastResult = { title: a.name, gains: r.gains, at: Date.now(), note: r.tired ? "Yorgundun; verim düştü." : r.fee ? `${r.fee} bakır ders ücreti ödedin.` : undefined };
        persist(); render(); main.scrollTo({ top: 0, behavior: "smooth" }); storyTick(); break;
      }
      case "eat": { const it = GAME_ITEMS[id]; if (it && eat(s, id, it.satiety ?? 20)) { toast(`${it.name} yedin.`); persist(); render(); } break; }
      case "buy-bread": { if (s.money >= 2) { s.money -= 2; s.inventory.ekmek = (s.inventory.ekmek ?? 0) + 1; s.minute = Math.min(16 * 60, s.minute + 10); toast("Bir somun ekmek aldın."); persist(); render(); } break; }
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
      case "walk": {
        const r = walkQuest(cfg, s, id);
        if ("error" in r) { toast(r.error); break; }
        persist(); render();
        modal(`<h2>${esc(QUESTS.find(q => q.id === id)!.title)}</h2><p>${esc(r.note)}</p><p class="hand blue">${Object.entries(r.items).map(([k, n]) => `${itemName(cfg, k)}${n > 1 ? " ×" + n : ""}`).join(", ")}${Object.keys(r.items).length ? " · " : ""}tanınırlık +${+r.rep.toFixed(1)}</p>`, [{ label: "Tamam", cls: "primary", fn: () => storyTick() }]);
        break;
      }
      case "fight": {
        const q = QUESTS.find(x => x.id === id)!;
        if (s.energy < 15) { toast("Bu yorgunlukla kurtların karşısına çıkamazsın."); break; }
        openPlan(cfg, s, id, q.title, q.battle!.map, q.battle!.enemies, (sc, plan) => openBattle(cfg, s, sc, plan, id, (o) => {
          let extra = "";
          if (o.result === "won") {
            const r = completeQuest(cfg, s, id);
            extra = `<h3>Ödül</h3><p>${esc(r.note)}</p><p class="hand blue">${Object.entries(r.items).map(([k, n]) => `${itemName(cfg, k)}${n > 1 ? " ×" + n : ""}`).join(", ")}${r.money ? ` · ${r.money} bakır` : ""} · tanınırlık +${+r.rep.toFixed(1)}</p>`;
          }
          persist(); render();
          modal(`<h2>${o.result === "won" ? "Kurtlar uzaklaştı" : o.result === "fled" ? "Geri çekildin" : "Yenildin"}</h2>
            <p class="lede">${o.result === "lost" ? "Hasan seni yaralı hâlde bulup köye taşıdı. Dinlenmeden tekrar deneme." : o.result === "fled" ? "Kurtlar hâlâ orada. Hazırlanıp tekrar dene." : "Hasan uzaktan izliyordu; koşarak geldi."}</p>
            <h3>Savaşta gelişen</h3>${gainList(cfg, o.gains, 6)}${extra}`, [{ label: "Devam", cls: "primary", fn: () => storyTick() }]);
        }, persist), () => { persist(); render(); });
        break;
      }
      case "equip": {
        const slot = GAME_ITEMS[id]?.slot ?? cfg.item.get(id)?.slot;
        if (slot === "Silah") s.equipped.weapon = id; else if (slot === "Zırh") s.equipped.armor = id;
        s.familiarity[id] ??= 0; toast(slot === "Silah" ? "Yeni silaha alışman zaman alacak." : "Kuşandın."); persist(); render(); break;
      }
      case "menu": persist(); openTitle(); break;
    }
  });

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
      onContinue: () => { render(false); storyTick(); },
      onNew: newGameNow,
    });
  }

  applySettings();
  render(false);
  persist();
  openTitle();

}
