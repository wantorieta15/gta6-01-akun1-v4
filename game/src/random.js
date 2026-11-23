// Seeded RNG (mulberry32) so every ?shot= frame is identical for the same seed.
export function createRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function pick(rand, arr) { return arr[Math.floor(rand() * arr.length)]; }
export function range(rand, lo, hi) { return lo + rand() * (hi - lo); }
