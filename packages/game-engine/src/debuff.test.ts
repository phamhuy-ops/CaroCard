import { expect, test } from 'vitest';
import { applyDebuff, applyUltimatum, startDebuffRound, endDebuffRound, hasDebuff } from './debuff.ts';
import { createNormalEffects } from './normal.ts';
import { createShop } from './shop.ts';

const rng = { next: () => 0 };
const player = (coins = 0) => ({ shop: createShop(), effects: createNormalEffects(), coins });
const card = (cardId: string, star = 1) => ({ cardId, star });

test.each([1, 2, 3])('Shop Disruption %i★ schedules exactly that many persistent blocks', star => {
  const target = applyDebuff(card('DEB-C01', star), player(), player(), 2, 'source', rng).target;
  expect(target.shop.blocks.every(block => block === null)).toBe(true);
  const first = startDebuffRound(target, 3, rng);
  expect(first.shop.blocks.filter(Boolean)).toHaveLength(star);
  expect(startDebuffRound(first, 4, rng).shop.blocks).toEqual(first.shop.blocks);
  expect(startDebuffRound(first, 5, rng).shop.blocks.every(block => block === null)).toBe(true);
});

test.each([1, 2, 3])('Cutpurse %i★ destroys the highest eligible Interest without refund', star => {
  const target = player(2);
  target.shop.bench = [1, 2, 3].map(rank => ({
    ...card('INT-R01', rank), piggy: { purchasedRound: 1, noSpendRounds: 1, totalEarned: 9 },
  }));
  const result = applyDebuff(card('DEB-C02', star), player(), target, 2, 'source', rng).target;
  expect(result.shop.bench.map(item => item.star)).toEqual([1, 2, 3].filter(rank => rank !== star));
  expect(result.coins).toBe(2);
});

test.each([[1, 3], [2, 3], [3, 4]])('Rust %i★ runs after income and cannot make coins negative', (star, duration) => {
  const target = applyDebuff(card('DEB-E01', star), player(), player(8), 2, 'source', rng).target;
  expect(endDebuffRound(target, 2).coins).toBe(8);
  expect(endDebuffRound(target, 2 + duration).coins).toBe(8 - star);
  expect(endDebuffRound(target, 3 + duration).coins).toBe(8);
  expect(endDebuffRound({ ...target, coins: 0 }, 3).coins).toBe(0);
});

test.each([[1, [2, 3, 0]], [2, [2, 2, 0]], [3, [1, 1, 0]]])('Corruption %i★ downgrades distinct Normal targets', (star, expected) => {
  const target = player();
  target.shop.bench = [card('INT-R01', 3), card('INT-C01', 3), card('SPC-01', 0)];
  expect(applyDebuff(card('DEB-L01', star), player(), target, 2, 'source', rng)
    .target.shop.bench.map(item => item.star)).toEqual(expected);
});

test('Jester applies each rank independently and Angel blocks both gift and penalty', () => {
  const attacker = player();
  attacker.shop.bench = [card('BUF-C01')];
  const target = player(4);
  target.shop.bench = [card('BUF-R01'), card('BUF-E01')];
  const run = (star: number, defender = target) =>
    applyDebuff(card('DEB-R02', star), attacker, defender, 2, 'source', rng);
  const first = run(1).target;
  expect(first.coins).toBe(5);
  const started = startDebuffRound(first, 3, rng);
  expect(started.shop.blocks.filter(Boolean)).toHaveLength(2);
  expect(startDebuffRound(started, 4, rng).shop.blocks).toEqual(started.shop.blocks);
  expect(startDebuffRound(started, 5, rng).shop.blocks.filter(Boolean)).toHaveLength(0);
  expect(run(2).attacker.shop.bench).toEqual([card('BUF-R01')]);
  expect(run(2).target.shop.bench).toEqual([card('BUF-E01'), card('BUF-C01')]);
  expect(run(3).target).toMatchObject({ coins: 0, shop: { bench: [card('BUF-R01', 2)] } });
  const immune = { ...target, effects: { ...target.effects, angelImmune: true } };
  for (const star of [1, 2, 3]) expect(run(star, immune)).toEqual({ attacker, target: immune });
});

test('Ultimatum resolves both branches at each rank without destroying Special or Demon', () => {
  const target = player(10);
  target.shop.bench = [card('SPC-01', 0), card('DMN-01', 0), card('INT-R01'), card('BUF-C01')];
  const resolve = (star: number, choice: 'accept' | 'resist') =>
    applyUltimatum(target, star, choice, 2, 'source', rng);
  expect(hasDebuff(resolve(1, 'accept').effects, 'buyLock', 3)).toBe(true);
  const resisted = startDebuffRound(resolve(1, 'resist'), 3, rng);
  expect(resisted.shop.blocks.filter(Boolean)).toHaveLength(2);
  expect(hasDebuff(resisted.effects, 'noSystemReroll', 3)).toBe(true);
  expect(endDebuffRound(resolve(2, 'accept'), 3).coins).toBe(5);
  expect(resolve(2, 'resist').coins).toBe(5);
  expect(hasDebuff(resolve(3, 'accept').effects, 'cardLock', 4)).toBe(true);
  expect(hasDebuff(resolve(3, 'accept').effects, 'cardLock', 5)).toBe(false);
  expect(resolve(3, 'resist').shop.bench).toEqual([card('SPC-01', 0), card('DMN-01', 0)]);
});
