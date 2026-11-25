// Açılış menüsü: devam et, yeni oyun (sıfırlama), ayarlar.
import { art } from "./intro";
import { esc } from "./sketch";
import { settings, saveSettings, type Settings } from "./settings";
import { APP_VERSION, lastUpdateStatus } from "../update";

export interface TitleOpts { hasSave: boolean; summary: string; onContinue: () => void; onNew: () => void }

export function showTitle(o: TitleOpts) {
  const el = document.createElement("div");
  el.className = "intro title-screen"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Ana menü");
  document.body.appendChild(el);
  let view: "menu" | "ayarlar" | "sil" = "menu";
  const chip = (group: keyof Settings, val: string, label: string) =>
    `<button class="choice ${settings()[group] === val ? "on" : ""}" data-set="${group}" data-val="${val}"><b>${label}</b></button>`;
  const render = () => {
    if (view === "menu") el.innerHTML = `<div class="intro-page title-page">
      <div class="intro-art">${art("defter")}</div>
      <h1 class="title-name">Gezgin Defteri</h1>
      <p class="intro-text muted" style="text-align:center">Isı kaybolmaz. Bir yere gider.</p>
      ${o.hasSave ? `<p class="hand blue" style="text-align:center;margin:0">${esc(o.summary)}</p>` : ""}
      <div class="title-buttons">
        ${o.hasSave ? `<button class="btn primary" data-x="continue">Devam et</button><button class="btn" data-x="new">Yeni oyun</button>` : `<button class="btn primary" data-x="start">Oyuna başla</button>`}
        <button class="btn" data-x="settings">Ayarlar</button>
      </div>
      <p class="muted tiny" style="text-align:center;margin-top:auto">Sürüm ${esc(APP_VERSION)}</p></div>`;
    if (view === "ayarlar") el.innerHTML = `<div class="intro-page">
      <h1>Ayarlar</h1>
      <section class="sec"><h3>Savaş canlandırmaları</h3><div class="choices">
        ${chip("anim", "yavas", "Yavaş")}${chip("anim", "normal", "Normal")}${chip("anim", "hizli", "Hızlı")}${chip("anim", "kapali", "Kapalı")}</div>
        <p class="muted tiny" style="margin:0">Yürüme, saldırı, ateş topu ve hasar yazılarının hızı.</p></section>
      <section class="sec"><h3>Yazı boyutu</h3><div class="choices">${chip("text", "normal", "Normal")}${chip("text", "buyuk", "Büyük")}</div></section>
      <p class="muted tiny">Ayarlar kaydından ayrı tutulur; yeni oyuna başlamak ayarları silmez.</p>
      <section class="sec"><h3>Güncelleme</h3>${(() => { const u = lastUpdateStatus(); return u ? `<p class="${u.ok ? "" : "red"}" style="margin:0">${esc(u.text)}</p><p class="muted tiny" style="margin:0">${new Date(u.at).toLocaleString("tr-TR")}</p>` : `<p class="muted" style="margin:0">Henüz denetlenmedi.</p>`; })()}
        <div class="row"><button class="btn small" data-x="check">Güncellemeleri denetle</button></div></section>
      <div class="intro-foot"><span class="muted tiny">Sürüm ${esc(APP_VERSION)}</span><button class="btn primary" data-x="back">Geri</button></div></div>`;
    if (view === "sil") el.innerHTML = `<div class="intro-page">
      <h1>Yeni oyun</h1>
      <p class="intro-text">Bu defterdeki her şey silinecek: gelişimin, tanıdıkların, eşyaların ve hikâyede geldiğin yer.</p>
      <p class="hand red">${esc(o.summary)}</p>
      <div class="intro-foot"><button class="btn" data-x="back">Vazgeç</button><button class="btn red" data-x="wipe">Sil ve baştan başla</button></div></div>`;
  };
  el.addEventListener("click", e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button"); if (!b) return;
    if (b.dataset.set) { saveSettings({ ...settings(), [b.dataset.set]: b.dataset.val } as Settings); render(); return; }
    switch (b.dataset.x) {
      case "continue": el.remove(); o.onContinue(); return;
      case "start": case "wipe": el.remove(); o.onNew(); return;
      case "new": view = "sil"; break;
      case "settings": view = "ayarlar"; break;
      case "back": view = "menu"; break;
      case "check": window.dispatchEvent(new Event("gelisim-guncelle")); setTimeout(render, 2500); break;
    }
    render();
  });
  render();
}
