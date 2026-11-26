// Hareketli çizimler: "anim_<ad>.webp" 2×2 kareli bir sayfadır (soldan sağa, yukarıdan aşağıya 4 kare).
//   anim_kahraman_yuru  – kahraman yürüyüşü          anim_kahraman_yay – ok atışı: 1 hazırlık, 2 geriliyor, 3 tam gergin, 4 bırakma
//   anim_kurt_yuru      – kurt yürüyüşü              anim_kopek_yuru / anim_kedi_yuru / anim_sahin_yuru – evcil hayvanlar
// Sayfa yoksa çağıran taraf eski durağan resmi kullanır ve yürürken hafifçe sallanır (gait).
import { artUrl } from "./art";

const cache = new Map<string, HTMLImageElement | null>();
function img(key: string): HTMLImageElement | null {
  if (!cache.has(key)) { const u = artUrl(key); cache.set(key, u ? Object.assign(new Image(), { src: u }) : null); }
  const i = cache.get(key)!; return i && i.complete && i.naturalWidth ? i : null;
}
export const hasSheet = (key: string) => !!artUrl(key);
export interface Quad { im: HTMLImageElement; sx: number; sy: number; sw: number; sh: number }
/** Sayfadan bir kare (0–3). Yüklenmediyse ya da yoksa null. */
export function quad(key: string, frame: number): Quad | null {
  const im = img(key); if (!im) return null; const f = ((frame % 4) + 4) % 4; const sw = im.naturalWidth / 2, sh = im.naturalHeight / 2;
  return { im, sx: (f % 2) * sw, sy: Math.floor(f / 2) * sh, sw, sh };
}
/** Yürüme karesi: zamana göre 4 kare döner. */
export const walkFrame = (now: number, seed = 0, fps = 9) => Math.floor(now / (1000 / fps) + seed) % 4;
/** Yay karesi: atış döngüsünün ilerlemesine (0–1, atıştan sonra 0'dan başlar) göre. */
export function bowFrame(p: number, hasTarget: boolean): number { if (!hasTarget) return 0; return p < 0.15 ? 3 : p < 0.4 ? 0 : p < 0.75 ? 1 : 2; }
/** Sayfa yokken yürüme sallanması: dikey zıplama (birim: ekran pikseli çarpanı) ve hafif yalpa. */
export function gait(now: number, seed = 0, moving = true): { dy: number; rot: number } {
  if (!moving) return { dy: 0, rot: 0 }; const t = now / 105 + seed;
  return { dy: -Math.abs(Math.sin(t)) * 0.55, rot: Math.sin(t) * 0.05 };
}
/** Bir kareyi çizer: alt-orta çapa, yüksekliği h. flip: sağa bakıyorsa true. */
export function drawQuad(g: CanvasRenderingContext2D, q: Quad, x: number, y: number, h: number, flip: boolean, filter = "none", alpha = 1) {
  const w = h * q.sw / q.sh; g.save(); g.globalAlpha = alpha; g.translate(x, y); if (flip) g.scale(-1, 1); g.filter = filter;
  g.drawImage(q.im, q.sx, q.sy, q.sw, q.sh, -w / 2, -h * 0.85, w, h); g.restore();
}
