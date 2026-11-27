// Açılış menüsü: devam et, yeni oyun (sıfırlama), ayarlar.
import { art } from "./intro";
import { esc } from "./sketch";
import { settings, saveSettings, type Settings, type BoolSetting } from "./settings";
import { sfx } from "./feel";
import { APP_VERSION, APK_URL, lastUpdateStatus, updateLog } from "../update";
import { currentBackup, decodeBackup, restoreBackup, type BackupInfo } from "../engine/save";

export interface TitleOpts { hasSave: boolean; summary: string; onContinue: () => void; onNew: () => void }

export function showTitle(o: TitleOpts) {
  const el = document.createElement("div");
  el.className = "intro title-screen"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Ana menü");
  document.body.appendChild(el);
  let view: "menu" | "ayarlar" | "sil" | "yedek" | "geri" = "menu";
  let pending: BackupInfo | null = null; let restoreErr = ""; let copied = false;
  const chip = (group: keyof Settings, val: string, label: string) =>
    `<button class="choice ${settings()[group] === val ? "on" : ""}" data-set="${group}" data-val="${val}"><b>${label}</b></button>`;
  const toggle = (k: BoolSetting, title: string, desc: string) =>
    `<section class="sec"><h3>${title}</h3><div class="choices"><button class="choice ${settings()[k] ? "on" : ""}" data-bool="${k}" data-val="1"><b>Açık</b></button><button class="choice ${settings()[k] ? "" : "on"}" data-bool="${k}" data-val="0"><b>Kapalı</b></button></div><p class="muted tiny" style="margin:0">${desc}</p></section>`;
  const render = () => {
    if (view === "menu") el.innerHTML = `<div class="intro-page title-page">
      <div class="intro-art">${art("defter")}</div>
      <h1 class="title-name">Gezgin Defteri</h1>
      <p class="intro-text muted" style="text-align:center">Isı kaybolmaz. Bir yere gider.</p>
      ${o.hasSave ? `<p class="hand blue" style="text-align:center;margin:0">${esc(o.summary)}</p>` : ""}
      <div class="title-buttons">
        ${o.hasSave ? `<button class="btn primary" data-x="continue">Devam et</button><button class="btn" data-x="new">Yeni oyun</button>` : `<button class="btn primary" data-x="start">Oyuna başla</button>`}
        <button class="btn" data-x="settings">Ayarlar</button>
        ${o.hasSave ? `<button class="btn" data-x="backup">Kaydı yedekle</button>` : `<button class="btn" data-x="restore">Yedekten yükle</button>`}
      </div>
      ${(() => { const u = lastUpdateStatus(); return u ? `<p class="tiny ${u.ok ? "muted" : "red"}" style="text-align:center;margin:0">Güncelleme: ${esc(u.text)}</p>` : ""; })()}
      <p class="muted tiny" style="text-align:center;margin-top:auto">Sürüm ${esc(APP_VERSION)}</p></div>`;
    if (view === "ayarlar") el.innerHTML = `<div class="intro-page">
      <h1>Ayarlar</h1>
      <section class="sec"><h3>Savaş canlandırmaları</h3><div class="choices">
        ${chip("anim", "yavas", "Yavaş")}${chip("anim", "normal", "Normal")}${chip("anim", "hizli", "Hızlı")}${chip("anim", "kapali", "Kapalı")}</div>
        <p class="muted tiny" style="margin:0">Yürüme, saldırı, ateş topu ve hasar yazılarının hızı.</p></section>
      ${toggle("timing", "Savaşta parmak hareketleri", "Kurdun üstünden kesik çekmek, kaçmak için kaydırmak, büyü işaretini çizmek, itmek için sürüklemek. Kapalıysa savaş eskisi gibi zar ile.")}
      ${toggle("sound", "Ses efektleri", "Vuruş, adım, kâğıt hışırtısı.")}
      ${toggle("ambient", "Ortam sesi", "Gerçek doğa kayıtları: yaylada rüzgâr ve koyun çanları, derede su, çarşıda kalabalık; gece cırcırböcekleri.")}
      ${toggle("music", "Müzik", "Bölge müzikleri (eklendikçe).")}
      ${toggle("haptic", "Titreşim", "Vuruşta, kritikte ve yaralanınca.")}
      ${toggle("notify", "Bildirimler", "Çalışma bitince telefona haber ver.")}
      <section class="sec"><h3>Yazı boyutu</h3><div class="choices">${chip("text", "normal", "Normal")}${chip("text", "buyuk", "Büyük")}</div></section>
      <p class="muted tiny">Ayarlar kaydından ayrı tutulur; yeni oyuna başlamak ayarları silmez.</p>
      <section class="sec"><h3>Kayıt yedeği</h3>
        <p class="muted tiny" style="margin:0">Uygulamayı silersen kaydın da silinir. Önce yedek kodunu al ve bir yere (not, WhatsApp'ta kendine mesaj) yapıştır; yeniden kurunca geri yükle.</p>
        <div class="row"><button class="btn small" data-x="backup" ${o.hasSave ? "" : "disabled"}>Yedek kodu al</button><button class="btn small" data-x="restore">Yedekten yükle</button></div></section>
      <section class="sec"><h3>Güncelleme</h3>${(() => { const u = lastUpdateStatus(); return u ? `<p class="${u.ok ? "" : "red"}" style="margin:0">${esc(u.text)}</p><p class="muted tiny" style="margin:0">${new Date(u.at).toLocaleString("tr-TR")}</p>` : `<p class="muted" style="margin:0">Henüz denetlenmedi.</p>`; })()}
        <details class="update-log"><summary class="tiny muted">Güncelleme günlüğü (sorun olursa bunun ekran görüntüsünü gönder)</summary>
          ${updateLog().map(l => `<div class="tiny"><span class="muted">${new Date(l.at).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span> ${esc(l.text)}</div>`).join("") || `<div class="tiny muted">Henüz kayıt yok.</div>`}</details>
        <div class="row"><button class="btn small" data-x="check">Güncellemeleri denetle</button><a class="btn small" href="${APK_URL}">Son APK'yı indir</a></div>
        <p class="muted tiny" style="margin:0">APK'yı kurarken eski uygulamayı <b>silme</b>; üstüne kur. Böylece kaydın yerinde kalır.</p></section>
      <div class="intro-foot"><span class="muted tiny">Sürüm ${esc(APP_VERSION)}</span><button class="btn primary" data-x="back">Geri</button></div></div>`;
    if (view === "yedek") { const code = currentBackup() ?? ""; el.innerHTML = `<div class="intro-page">
      <h1>Yedek kodu</h1>
      <p class="intro-text">Bu kod kaydının tamamı. Kopyala ve güvenli bir yere yapıştır. Uygulamayı yeniden kurarsan "Yedekten yükle" ile geri getirirsin.</p>
      <textarea id="backupCode" class="backup-code" readonly>${esc(code)}</textarea>
      <p class="hand ${copied ? "green" : "muted"}" style="margin:0">${copied ? "Kopyalandı. Şimdi bir yere yapıştır." : `${(code.length / 1024).toFixed(1)} KB`}</p>
      <div class="intro-foot"><button class="btn" data-x="back">Geri</button><button class="btn primary" data-x="copy">Kopyala</button></div></div>`; }
    if (view === "geri") el.innerHTML = `<div class="intro-page">
      <h1>Yedekten yükle</h1>
      <p class="intro-text">Daha önce aldığın yedek kodunu aşağıya yapıştır.</p>
      <textarea id="restoreCode" class="backup-code" placeholder="GD1:..."></textarea>
      ${restoreErr ? `<p class="red" style="margin:0">${esc(restoreErr)}</p>` : ""}
      ${pending ? `<p class="hand blue" style="margin:0">${esc(pending.name)} · Gün ${pending.day}. ${o.hasSave ? "Şu anki kaydın bununla değişecek." : ""}</p>` : ""}
      <div class="intro-foot"><button class="btn" data-x="${o.hasSave ? "settings" : "back"}">Geri</button>${pending ? `<button class="btn primary" data-x="doRestore">Yükle ve başla</button>` : `<button class="btn primary" data-x="check-code">Kontrol et</button>`}</div></div>`;
    if (view === "sil") el.innerHTML = `<div class="intro-page">
      <h1>Yeni oyun</h1>
      <p class="intro-text">Bu defterdeki her şey silinecek: gelişimin, tanıdıkların, eşyaların ve hikâyede geldiğin yer.</p>
      <p class="hand red">${esc(o.summary)}</p>
      <div class="intro-foot"><button class="btn" data-x="back">Vazgeç</button><button class="btn red" data-x="wipe">Sil ve baştan başla</button></div></div>`;
  };
  el.addEventListener("click", e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button"); if (!b) return;
    if (b.dataset.set) { saveSettings({ ...settings(), [b.dataset.set]: b.dataset.val } as Settings); render(); return; }
    if (b.dataset.bool) { saveSettings({ ...settings(), [b.dataset.bool]: b.dataset.val === "1" }); sfx("tap"); render(); return; }
    switch (b.dataset.x) {
      case "continue": el.remove(); o.onContinue(); return;
      case "start": case "wipe": el.remove(); o.onNew(); return;
      case "new": view = "sil"; break;
      case "settings": view = "ayarlar"; break;
      case "back": view = "menu"; break;
      case "backup": copied = false; view = "yedek"; break;
      case "restore": pending = null; restoreErr = ""; view = "geri"; break;
      case "copy": {
        const ta = el.querySelector<HTMLTextAreaElement>("#backupCode")!;
        const done = () => { copied = true; render(); };
        navigator.clipboard?.writeText(ta.value).then(done, () => { ta.select(); try { document.execCommand("copy"); done(); } catch { /* elle seçsin */ } });
        if (!navigator.clipboard) { ta.select(); try { document.execCommand("copy"); copied = true; } catch { /* */ } }
        return;
      }
      case "check-code": {
        const v = el.querySelector<HTMLTextAreaElement>("#restoreCode")?.value ?? "";
        pending = decodeBackup(v); restoreErr = pending ? "" : "Kod okunamadı. Tamamını, GD1: ile başlayarak yapıştırdığından emin ol.";
        break;
      }
      case "doRestore": if (pending) { restoreBackup(pending); location.reload(); } return;
      case "check": window.dispatchEvent(new Event("gelisim-guncelle")); setTimeout(render, 2500); break;
    }
    render();
  });
  render();
}
