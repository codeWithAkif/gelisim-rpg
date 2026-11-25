// Tekrarlanabilir rastgelelik (mulberry32). Savaş durumu tohumla birlikte kaydedilir.
export class Rng {
  constructor(public seed: number) {}
  next(): number {
    let t = (this.seed = (this.seed + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(a: number, b: number): number { return a + Math.floor(this.next() * (b - a + 1)); }
  chance(pct: number): boolean { return this.next() * 100 < pct; }
  pick<T>(arr: T[]): T { return arr[Math.floor(this.next() * arr.length)]; }
}
