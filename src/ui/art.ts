// Çizilmiş görseller: src/assets/art altındaki dosyalar ada göre bulunur.
// portre_<npc>.webp, yer_<yer>.webp, esya_<eşya>.webp
// Görseli olmayanlar sketch.ts'teki eskizlerle gösterilir.
import { esc, itemIcon, portrait } from "./sketch";

const files = import.meta.glob("../assets/art/*.webp", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
const ART: Record<string, string> = {};
for (const [path, url] of Object.entries(files)) ART[path.split("/").pop()!.replace(/\.webp$/, "")] = url;

export const artUrl = (key: string): string | undefined => ART[key];

/** Kişi resmi: görsel varsa ve tanışıldıysa çizim, yoksa eskiz. */
export function personPic(n: { id: string; name: string }, size = 46, known = true): string {
  const url = ART["portre_" + n.id];
  if (!url || !known) return portrait(n.name, size, known);
  // küçük boyutta yüz seçilsin diye resim yüze yakınlaştırılır
  return `<span class="art-portrait" style="width:${size}px;height:${size}px"><img src="${url}" alt="${esc(n.name)}" loading="lazy"></span>`;
}

/** Eşya resmi: görsel varsa çizim, yoksa eskiz. */
export function itemPic(id: string, size = 44): string {
  const url = ART["esya_" + id];
  if (!url) return itemIcon(id, size);
  return `<img class="art-item" src="${url}" width="${size}" height="${size}" alt="" loading="lazy">`;
}

/** Annenin portresi: "Annemin sayfaları" bölümünün başında, bir anı gibi soluk. */
export function motherPic(): string {
  const url = ART["portre_anne"];
  return url ? `<div class="art-mother"><img src="${url}" alt="Annem" loading="lazy"></div>` : "";
}

/** Yer görseli (yoksa boş). */
export function placePic(id: string, name: string, cls = "art-place"): string {
  const url = ART["yer_" + id];
  return url ? `<div class="${cls}"><img src="${url}" alt="${esc(name)}" loading="lazy"></div>` : "";
}
