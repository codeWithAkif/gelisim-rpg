// Küçük çaplı para düzeni: satış (günlük fiyat, aynı malı çok satınca düşen fiyat) ve ortaklıklar
// (birine para koyup her gece payını almak; risk var, para batabilir). DOM yok.
import type { Config } from "./config";
import { type GameState, DAY_MINUTES, repOf } from "./state";
import { itemInfo, freeCount, removeItem } from "./inventory";
import { Rng } from "./rng";
import { NPC_PLACE } from "../content/map";
import { MARKETS, GAME_ITEMS, CONFIG_PRICES } from "../content/world";

/* ---------- değer ve fiyat ---------- */
/** Satın alınamayan şeylerin değeri (bakır): toplanan otlar, av, buluntular. */
export const ITEM_VALUES: Record<string, number> = {
  kekik: 2, isirgan: 2, nane: 1, adacayi: 2, mantar: 2, yaban_mersini: 1, kartal_tuyu: 8, eski_sikke: 18,
  elma: 1, temiz_giysi: 6, el_yapimi_bicak: 10, degnek: 1, kurt_postu: 34, deri_canta: 14, bez_torba: 2,
  dede_kilici: 60, zincir_zirh: 90,
};
/** Satılmaz: hikâyesi olan eşyalar. */
export const KEEPSAKES = new Set(["annenin_heybesi"]);
export function itemValue(cfg: Config, id: string): number {
  return ITEM_VALUES[id] ?? GAME_ITEMS[id]?.price ?? CONFIG_PRICES[id] ?? itemInfo(cfg, id).price ?? 0;
}
/** Pazarın bu mala ilgisi: şehir otu ve kürkü köyden iyi alır; köy kendi otunu ucuz alır. */
const DEMAND: Record<string, Record<string, number>> = {
  koy_meydani: { Yiyecek: 0.9, Malzeme: 0.8, Silah: 0.6, Zırh: 0.6, Eşya: 0.7, kurt_postu: 0.8, eski_sikke: 0.6 },
  karacam: { Yiyecek: 0.8, Malzeme: 1.2, Silah: 1, Zırh: 1, Eşya: 1.3, kurt_postu: 1.4, kartal_tuyu: 1.4, eski_sikke: 1.5 },
  ardic_kul: { Yiyecek: 1.3, Malzeme: 1, Eşya: 0.9 },
};
function demand(cfg: Config, place: string, id: string): number {
  const d = DEMAND[place]; if (!d) return 0;
  return d[id] ?? d[itemInfo(cfg, id).kind] ?? 0.7;
}
/** Günün fiyat dalgası: her pazar, her mal için 0.8–1.25 arası (aynı gün aynı kalır). */
export function dayFactor(s: GameState, place: string, id: string): number {
  let h = s.seed ^ (s.day * 2654435761); for (const ch of place + id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return 0.8 + new Rng(h).next() * 0.45;
}
function soldToday(s: GameState, id: string) { return s.market?.day === s.day ? s.market.sold[id] ?? 0 : 0; }
/** Satış fiyatı: değerin yarısı × pazarın ilgisi × günün dalgası × (aynı maldan bugün kaç sattıysan düşer). Pazarlık becerisi biraz artırır. */
export function sellPrice(cfg: Config, s: GameState, id: string, place = s.location): number {
  const base = itemValue(cfg, id); const dm = demand(cfg, place, id); if (!base || !dm) return 0;
  const talk = 1 + ((s.attrs.hitabet?.level ?? 10) - 10) / 100 + ((s.attrs.insan_okuma?.level ?? 10) - 10) / 150;
  return Math.max(1, Math.floor(base * 0.5 * dm * dayFactor(s, place, id) * Math.pow(0.85, soldToday(s, id)) * talk));
}
export interface SellCheck { ok: boolean; reason?: string; price: number }
export function canSell(cfg: Config, s: GameState, id: string): SellCheck {
  const price = sellPrice(cfg, s, id);
  if (s.journey || !MARKETS[s.location]) return { ok: false, reason: "Burada pazar yok", price };
  if (KEEPSAKES.has(id)) return { ok: false, reason: "Bunu satmazsın", price };
  if (freeCount(cfg, s, id) <= 0) return { ok: false, reason: "Kuşandığını satamazsın", price };
  if (!price) return { ok: false, reason: "Bunu burada kimse almaz", price };
  return { ok: true, price };
}
export function sell(cfg: Config, s: GameState, id: string): SellCheck {
  const c = canSell(cfg, s, id); if (!c.ok) return c;
  removeItem(s, id, 1); s.money += c.price;
  if (s.market?.day !== s.day) s.market = { day: s.day, sold: {} };
  s.market.sold[id] = (s.market.sold[id] ?? 0) + 1;
  s.minute = Math.min(DAY_MINUTES, s.minute + 3);
  ledger(s, `${itemInfo(cfg, id).name} sattın`, c.price);
  return c;
}

/* ---------- ortaklıklar ---------- */
export interface Partner {
  id: string; npc: string; name: string; desc: string; min: number; max: number;
  rate: number;          // günlük ortalama getiri (anaparaya oran)
  risk: number;          // bir gecede kötü bir şey olma olasılığı
  loss: number;          // kötü gecede anaparadan giden oran
  goodNews: string[]; badNews: string[];
  unlock: (s: GameState) => string | null;   // null: açık; değilse neden kapalı
  safer?: (s: GameState) => boolean;          // riski yarıya indiren durum
}
const done = (s: GameState, q: string) => (s.quests[q]?.count ?? 0) > 0 || s.quests[q]?.status === "bitti";
export const PARTNERS: Partner[] = [
  { id: "suru", npc: "hasan", name: "Hasan'ın sürüsü", min: 10, max: 60, rate: 0.06, risk: 0.08, loss: 0.25,
    desc: "Sürüye ortak olursun: kuzu ve yün satışından pay. Az ama düzenli getirir; kurtlar dadanırsa kuzu gider.",
    goodNews: ["İki kuzu doğdu.", "Yün iyi fiyata gitti.", "Hasan peynir sattı."], badNews: ["Kurtlar bir kuzuyu kaptı.", "Bir koyun uçurumdan düştü."],
    unlock: s => done(s, "kurt") ? null : "Önce Hasan'ın kurt derdine yardım et", safer: s => done(s, "akyele") },
  { id: "demirhane", npc: "kemal", name: "Kemal'in demirhanesi", min: 20, max: 100, rate: 0.065, risk: 0.05, loss: 0.2,
    desc: "Ocağa kömür ve demir alırsın; Kemal'in sattığı her nal ve bıçaktan payın olur.",
    goodNews: ["Kemal köyün bütün atlarını nalladı.", "Bir kervan bıçak sipariş etti."], badNews: ["Körük yırtıldı, iş durdu.", "Bir parti demir çatladı."],
    unlock: s => repOf(s, "taspinar", "guven") >= 4 ? null : "Taşpınar'da güven 4 gerekir" },
  { id: "han", npc: "yaren", name: "Yaren'in hanı", min: 20, max: 120, rate: 0.07, risk: 0.04, loss: 0.15,
    desc: "Hanın yeni odalarına ortak olursun. Kervan geldikçe kazanır; kış uzarsa yolcu azalır.",
    goodNews: ["Han tıklım tıklım doldu.", "Bir tüccar haftalığını peşin ödedi."], badNews: ["Kar yolları kapattı, oda boş kaldı.", "Bir yolcu parasını ödemeden kaçtı."],
    unlock: s => s.story.reached.includes("k_varis") ? null : "Karaçam'a git" },
  { id: "kervan", npc: "selim", name: "Selim'in kervanı", min: 30, max: 250, rate: 0.12, risk: 0.14, loss: 0.4,
    desc: "Kervana mal koyarsın; kârı büyük, ama yolda haydut var. Kervanı bir kez korumuş olman güven verir.",
    goodNews: ["Kervan baharatla döndü.", "Kumaş iki katına satıldı.", "Selim yeni bir müşteri buldu."], badNews: ["Haydutlar bir arabayı soydu.", "Yükün yarısı yolda ıslandı."],
    unlock: s => done(s, "kervan") ? null : "Önce Selim'in kervanını koru", safer: s => done(s, "lonca_defteri") },
];
export const partner = (id: string) => PARTNERS.find(p => p.id === id);
export function partnerAt(placeId: string) { return PARTNERS.filter(p => NPC_PLACE[p.npc] === placeId); }
export function stake(s: GameState, id: string) { return s.partners?.[id]?.amount ?? 0; }
/** Ortaklık fikri tüccar şehri Karaçam'da gelir (Bölüm 2); daha önce kurulmuş paylar işlemeye devam eder. */
export const FINANCE_GATE = "k_varis";
export const financeOpen = (s: GameState) => s.story.reached.includes(FINANCE_GATE);
export function partnerLock(s: GameState, p: Partner): string | null {
  if (!financeOpen(s) && !stake(s, p.id)) return "Ortaklığı Karaçam'ın tüccarlarından öğrenirsin";
  return p.unlock(s);
}

export function invest(s: GameState, id: string, amount: number): { ok: boolean; reason?: string } {
  const p = partner(id); if (!p) return { ok: false, reason: "Böyle bir ortaklık yok" };
  const lock = partnerLock(s, p); if (lock) return { ok: false, reason: lock };
  if (s.location !== NPC_PLACE[p.npc]) return { ok: false, reason: "Ortağının yanında olmalısın" };
  const cur = stake(s, id);
  if (cur + amount < p.min) return { ok: false, reason: `En az ${p.min} bakır` };
  if (cur + amount > p.max) return { ok: false, reason: `En çok ${p.max} bakır koyabilirsin` };
  if (s.money < amount) return { ok: false, reason: "Paran yetmiyor" };
  s.money -= amount; s.partners ??= {};
  s.partners[id] = { amount: cur + amount, since: s.partners[id]?.since ?? s.day, earned: s.partners[id]?.earned ?? 0 };
  ledger(s, `${p.name}: ${amount} bakır yatırdın`, -amount);
  return { ok: true };
}
export function withdraw(s: GameState, id: string): { ok: boolean; reason?: string; amount: number } {
  const p = partner(id); const cur = stake(s, id);
  if (!p || !cur) return { ok: false, reason: "Burada paran yok", amount: 0 };
  if (s.location !== NPC_PLACE[p.npc]) return { ok: false, reason: "Ortağının yanında olmalısın", amount: 0 };
  s.money += cur; delete s.partners![id];
  ledger(s, `${p.name}: payını geri aldın`, cur);
  return { ok: true, amount: cur };
}
export interface NightLine { partner: string; text: string; amount: number }
/** Her gece: ortaklıklar ya kazandırır ya kaybettirir. Uyurken çağrılır. */
export function nightlyFinance(s: GameState): NightLine[] {
  const out: NightLine[] = [];
  for (const [id, st] of Object.entries(s.partners ?? {})) {
    const p = partner(id); if (!p || st.amount <= 0) continue;
    const rng = new Rng((s.seed * 7919 + s.day * 104729 + id.length * 31 + id.charCodeAt(0)) | 0);
    const risk = p.risk * (p.safer?.(s) ? 0.5 : 1);
    if (rng.chance(risk * 100)) {
      const lost = Math.max(1, Math.round(st.amount * p.loss * (0.6 + rng.next() * 0.8)));
      st.amount = Math.max(0, st.amount - lost);
      const text = rng.pick(p.badNews); out.push({ partner: p.name, text, amount: -lost });
      ledger(s, `${p.name}: ${text}`, -lost);
      if (st.amount <= 0) delete s.partners![id];
    } else {
      // küçük paylar kaybolmasın: bakırın kesirleri birikir, bütün bakır olunca eline geçer
      st.acc = (st.acc ?? 0) + st.amount * p.rate * (0.5 + rng.next());
      const gain = Math.floor(st.acc); st.acc -= gain;
      if (gain <= 0) { out.push({ partner: p.name, text: `İyi geçti; payın birikiyor (bir bakırın %${Math.round(st.acc * 100)}'i).`, amount: 0 }); continue; }
      s.money += gain; st.earned += gain;
      const text = rng.next() < 0.5 ? rng.pick(p.goodNews) : "Payın geldi.";
      out.push({ partner: p.name, text, amount: gain }); ledger(s, `${p.name}: ${text}`, gain);
    }
  }
  return out;
}

/* ---------- hesap defteri ---------- */
export function ledger(s: GameState, text: string, amount: number) {
  (s.ledger ??= []).unshift({ day: s.day, text, amount });
  s.ledger.length = Math.min(s.ledger.length, 30);
}
