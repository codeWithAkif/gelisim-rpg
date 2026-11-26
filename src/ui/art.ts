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
  const url = ART["portre_" + (n.id === "leyla" ? "anne" : n.id)];
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

/** Yapı (barikat, tuzak) resmi: varsa çizimi, yoksa boş (çağıran eskizi kullanır). */
export function structPic(id: string, size = 56): string {
  const url = ART["yapi_" + id];
  return url ? `<img class="art-item" src="${url}" width="${size}" height="${size}" alt="" loading="lazy">` : "";
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

/**
 * Hareketli resim: "anim_<ad>" 2×2 kareli bir sayfadan (4 kare) CSS ile oynatılır; sayfa yoksa durağan resim ya da boş döner.
 * Kareler soldan sağa, yukarıdan aşağıya: 1-2 / 3-4.
 */
export function spriteHtml(key: string, size: number, ms = 640, extra = ""): string | null {
  const url = ART[key]; if (!url) return null;
  return `<span class="sprite ${extra}" style="width:${size}px;height:${size}px;background-image:url(${url});animation-duration:${ms}ms" role="img"></span>`;
}
/** Evcil hayvanın resmi: önce hareketli sayfa, sonra durağan resim; köpek için kurt resmi renk süzgeciyle. */
export function petArt(id: string, size: number, state: "yuru" | "dur" = "dur", tint = ""): string {
  const walk = state === "yuru" ? spriteHtml(`anim_${id}_yuru`, size) : null; if (walk) return walk;
  const url = ART[`dusman_${id}`] ?? ART[`anim_${id}_dur`] ?? (id === "kopek" || id === "kedi" || id === "sahin" ? ART["dusman_kurt"] : undefined);
  if (!url) return `<span class="pet-fallback" style="width:${size}px;height:${size}px"></span>`;
  const own = !!ART[`dusman_${id}`];
  return `<img class="pet-img" src="${url}" width="${size}" height="${size}" alt="" style="${own ? "" : `filter:${tint}`}">`;
}
