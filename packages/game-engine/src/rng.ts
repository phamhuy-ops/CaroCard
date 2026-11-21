export interface Rng {
  next(): number;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return {
    next() {
      // Numerical Recipes LCG, using unsigned 32-bit arithmetic.
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x1_0000_0000;
    },
  };
}
