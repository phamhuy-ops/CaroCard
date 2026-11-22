import { expect, test } from 'vitest';
import { activateNormal, createNormalEffects, timedEffectActive } from './normal.ts';
import { advanceInterest, buy, createShop, discard, reroll, shopOdds } from './shop.ts';

const rng = { next: () => 0 };

test.each([[1, 3, 0], [2, 5, 1], [3, 12, 2]])('Aurelia %i★ grants the exact rewards', (star, coins, rerolls) => {
  const result = activateNormal({ cardId: 'INT-C01', star }, createShop(), createNormalEffects(), 2, rng);
  expect(result).toMatchObject({ coins, shop: { freeRerolls: rerolls } });
});

test('Piggy Bank skips its purchase round, distinguishes free and paid rerolls, and pays out on breaking', () => {
  const purchased = buy({ ...createShop(), slots: ['INT-R01', null, null, null] }, 5, 0, 2);
  if ('error' in purchased) throw new Error(purchased.error);
  const initial = advanceInterest(purchased.shop, 2);
  const third = advanceInterest(initial.shop, 3);
  expect(third.coins).toBe(0);
  expect(third.shop.bench[0].piggy?.noSpendRounds).toBe(1);
  const paid = reroll(third.shop, 1, 4, rng);
  if ('error' in paid) throw new Error(paid.error);
  const fourth = advanceInterest(paid.shop, 4);
  expect(fourth.coins).toBe(0);
  expect(fourth.shop.bench[0].piggy?.noSpendRounds).toBe(0);
  const free = reroll({ ...fourth.shop, freeRerolls: 1 }, 0, 5, rng);
  if ('error' in free) throw new Error(free.error);
  const sixth = advanceInterest(advanceInterest(free.shop, 5).shop, 6);
  expect(sixth).toMatchObject({ coins: 1, shop: { bench: [{ star: 2, piggy: { totalEarned: 1 } }] } });
  const eighth = advanceInterest(advanceInterest(sixth.shop, 7).shop, 8);
  expect(eighth).toMatchObject({ coins: 2, shop: { bench: [{ star: 3, piggy: { totalEarned: 3 } }] } });
  expect(discard(eighth.shop, 5, 0)).toMatchObject({ coins: 6, shop: { bench: [] } });
});

test('Rarity Up normalizes chances, keeps Special unchanged, and raises Demon p only after stage one', () => {
  expect(shopOdds(1, 3)).toMatchObject({ legendary: 20, special: 0, demonP: 0 });
  expect(shopOdds(5, 3)).toMatchObject({ legendary: 23, special: 5, demonP: 0.16 });
  const stageFour = shopOdds(16, 1);
  expect(stageFour).toMatchObject({ common: 0, rare: 29, epic: 22, special: 23 });
  const simultaneous = shopOdds(5, 2);
  expect(simultaneous.epic).toBeCloseTo(16 + 18 - 5 * 16 / (43 + 33 + 16));
  const sum = simultaneous.common + simultaneous.rare + simultaneous.epic
    + simultaneous.legendary + simultaneous.special;
  expect(sum).toBeCloseTo(100);
});

test('timed buffs start next round and replacing one cancels the remaining old duration', () => {
  const first = activateNormal({ cardId: 'BUF-C02', star: 3 }, createShop(), createNormalEffects(), 1, rng);
  expect(timedEffectActive(first.effects.hair, 1)).toBe(false);
  expect(timedEffectActive(first.effects.hair, 4)).toBe(true);
  const replacement = activateNormal({ cardId: 'BUF-C02', star: 1 }, first.shop, first.effects, 2, rng);
  expect(timedEffectActive(replacement.effects.hair, 3)).toBe(true);
  expect(timedEffectActive(replacement.effects.hair, 4)).toBe(false);
});

test('Angel cleanses by active Normal source, preserves Demon and scheduled sources, and grants immunity', () => {
  const effects = {
    ...createNormalEffects(), debuffs: [
      { id: 'first', group: 'debuff' as const, from: 1, through: 4 },
      { id: 'second', group: 'debuff' as const, from: 1, through: 4 },
      { id: 'third', group: 'debuff' as const, from: 1, through: 4 },
      { id: 'demon', group: 'demon' as const, from: 1, through: 4 },
      { id: 'scheduled', group: 'debuff' as const, from: 4, through: 5 },
    ],
  };
  const shop = { ...createShop(), blocks: ['first', 'first', 'demon', null] };
  const one = activateNormal({ cardId: 'BUF-L01', star: 1 }, shop, effects, 2, rng);
  expect(one.effects.debuffs.map(effect => effect.id)).toEqual(['third', 'demon', 'scheduled']);
  expect(one.shop.blocks).toEqual([null, null, 'demon', null]);
  const three = activateNormal({ cardId: 'BUF-L01', star: 3 }, shop, effects, 2, rng);
  expect(three.effects.angelImmune).toBe(true);
  expect(three.effects.debuffs.map(effect => effect.id)).toEqual(['demon', 'scheduled']);
});
