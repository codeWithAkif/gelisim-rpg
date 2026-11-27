// Her özellik oyunda ne işe yarar: çalışma ekranında ve Vücut sayfasında tek cümle. Config editöründe karşılığı yok.
// Yalnızca kodda gerçekten işleyen etkiler yazılır; hiçbir şeyi etkilemeyen özellik bunu açıkça söyler.
// Sıradaki açılış (şu seviyede şunu yaparsın) engine/thresholds.ts nextThreshold ile veriden gelir.
export const ATTR_USE: Record<string, string> = {
  // fiziksel
  ust_govde: "Kılıç ve balta vuruşunu güçlendirir; barikatı sağlamlaştırır; harabede yakın dövüşü artırır.",
  bacak: "Yolculukta ve harabede daha hızlı yürürsün; kaçınmana katkı verir.",
  core: "Canını artırır (savaşta ve harabede); itme şansını yükseltir.",
  kavrama: "Harabede merdiveni daha çabuk çıkarsın; iki silahı birlikte kullanmayı kolaylaştırır.",
  kardiyo: "Canını artırır; yolculuğu hızlandırır; uzun ve ağır çalışmaları kaldırabilirsin.",
  nefes: "Harabede büyü daha çabuk dolar; yüzme çalışmasını ve büyü süresini belirler.",
  esneklik: "Kaçınma şansını artırır; harabede yürümeyi ve tırmanmayı hızlandırır.",
  refleks: "Kaçınma ve kritik şansını artırır; kaçınma ve saldırı oyunlarında doğru an penceresi genişler; nöbette atışı hızlandırır.",
  el_becerisi: "Barikat ve tuzakları sağlamlaştırır; harabede aramayı hızlandırır; el işlerini ve yapıları açar.",
  agri: "Canını artırır; harabede darbeye dayanırsın.",
  // algısal
  gorus: "Menzilli isabeti artırır; gece ve sisli havada daha uzağı görürsün; nöbette menzili uzatır.",
  cevresel: "Gizlenirken kuşkunun dolmasını yavaşlatır; kaçınmana katkı verir; harabede ilk baskına kalan süreyi uzatır.",
  isitme: "Gizlenirken kuşkunun dolmasını yavaşlatır; harabede ilk baskına kalan süreyi uzatır; etrafı ararken sesle bulunanları (baykuş gibi) kolaylaştırır.",
  koku: "Etrafı ararken kokuyla bulunanları kolaylaştırır: otlar ve mantarlar.",
  mekansal: "Menzilli isabeti ve büyünün isabetini artırır; gizlenirken kuşkunun dolmasını yavaşlatır.",
  // zihinsel
  odak: "Büyünün elinde dağılma şansını düşürür; büyü çizerken işaretleri tanımayı kolaylaştırır ve süreyi uzatır; harabede büyüyü üst üste salmanı sağlar.",
  hafiza: "Ezgi, ot ayıklama, satranç ve hitabet dersi gibi hafıza oyunlarını kolaylaştırır.",
  analiz: "Kritik şansını artırır; savaşta zayıf noktaları fark etmeni sağlar; harabede aramayı hızlandırır; yapıları güçlendirir.",
  taktik: "Barikat ve tuzak gibi yapıların seviyesini yükseltir.",
  irade: "Gizlenirken kuşkunun dolmasını yavaşlatır; yolculukta çıkan sınavlarda dayanma şansını artırır.",
  stres: "Yolculukta çıkan sınavlarda dayanma şansını artırır.",
  // sosyal
  hitabet: "Pazarda mallarını biraz daha iyi fiyata satarsın.",
  insan_okuma: "Pazarda mallarını biraz daha iyi fiyata satarsın.",
  gorgu: "İyi davranışların bölge halkının nezdinde daha çok yankılanır (güven ve itibar kazancı artar).",
  aldatma: "Gizlenirken nöbetçilerin kuşkusu daha yavaş dolar.",
  // büyü
  mana: "Mana deposunu büyütür (10 + 1,5 × seviye); harabede büyünün vuruş gücünü artırır.",
  ates: "Ateş büyülerinin hasarını artırır ve sönme şansını düşürür; yeni ateş büyülerini açar.",
  su_buyu: "Su büyülerinin hasarını artırır ve sönme şansını düşürür; yeni su büyülerini açar.",
  toprak_buyu: "Toprak büyülerinin hasarını artırır ve sönme şansını düşürür; yeni toprak büyülerini açar.",
  hava_buyu: "Hava büyülerinin hasarını artırır ve sönme şansını düşürür; yeni hava büyülerini açar.",
  simsek_buyu: "Şimşek büyülerinin hasarını artırır ve sönme şansını düşürür; yeni şimşek büyülerini açar.",
  ayaz_buyu: "Ayaz büyülerinin hasarını artırır ve sönme şansını düşürür; yeni ayaz büyülerini açar.",
  // bilgi
  kilic: "Yakın dövüşte isabet ve kritik şansını artırır; harabede vuruşu güçlendirir.",
  okculuk: "Ok isabetini ve kritik şansını artırır; harabede sadağı büyütür; nöbette kulenin hasarını artırır.",
  anatomi_insan: "İnsanların zayıf noktalarını fark etmeni sağlar; kritik şansını artırır.",
  anatomi_hayvan: "Hayvanların (kurt gibi) zayıf noktalarını fark etmeni sağlar.",
  iz_surme: "Yolculukta pusuya ve sürprize daha az denk gelirsin.",
  ilk_yardim: "Sargı bezi ve merhem daha çok can verir; uykuda yaralar daha çabuk kapanır.",
  simya: "Otlardan yapılan ilaçlar (merhem) daha güçlü olur; 100. seviyede iki kat.",
  demircilik: "Silahı bilemek daha çok güç katar; 100. seviyede %25.",
};
export const attrUse = (id: string): string => ATTR_USE[id] ?? "";
