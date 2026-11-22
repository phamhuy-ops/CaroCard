import { describe, expect, test } from 'vitest';
import { createRng } from './rng.ts';
import {
  activateBlock, buy, createShop, discard, refreshShop, releaseBlock, reroll, rollShop,
} from './shop.ts';
import constants from '../../../spec/data/constants.json' with { type: 'json' };

const fixed = (value = 0) => ({ next: () => value });
const offer = (cardId: string, star = 1) => ({ cardId, star });

describe('Shop distributions', () => {
  test.each(constants.rarityStages)('10,000 shops at stage $stage', stage => {
    const rng = createRng(100 + stage.stage);
    const counts: Record<string, number> = {};
    const demons: Record<string, number> = {};
    let ordinary = 0;
    let withDemon = 0;
    let withTwoDemons = 0;
    for (let i = 0; i < 10_000; i++) {
      const cards = rollShop(stage.roundFrom, rng);
      const demonCards = cards.filter(card => card.rarity === 'demon');
      expect(new Set(demonCards.map(card => card.id)).size).toBe(demonCards.length);
      expect(demonCards.length).toBeLessThanOrEqual(2);
      if (demonCards.length) {
        withDemon++;
        if (demonCards.length === 1) {
          const { id } = demonCards[0];
          demons[id] = (demons[id] ?? 0) + 1;
        }
      }
      if (demonCards.length === 2) withTwoDemons++;
      for (const card of cards.filter(card => card.rarity !== 'demon')) {
        ordinary++;
        counts[card.rarity] = (counts[card.rarity] ?? 0) + 1;
      }
    }
    for (const rarity of ['common', 'rare', 'epic', 'special', 'legendary'] as const) {
      expect(Math.abs((counts[rarity] ?? 0) / ordinary - stage[rarity] / 100)).toBeLessThan(0.015);
    }
    expect(Math.abs(withDemon / 10_000 - stage.demonP)).toBeLessThan(0.02);
    expect(Math.abs(withTwoDemons / 10_000 - stage.demonP ** 2)).toBeLessThan(0.015);
    if (stage.demonP >= 0.16) {
      for (const [id, weight] of Object.entries(constants.demonWeights)) {
        expect(Math.abs((demons[id] ?? 0) / (withDemon - withTwoDemons) - weight / 100)).toBeLessThan(0.04);
      }
    }
  });
});

test('Hold preserves ordinary cards and gives expired Demon slots priority over empty slots', () => {
  const shop = { ...createShop(), hold: true, slots: [null, 'BUF-C01', null, 'DMN-03'] };
  const next = refreshShop(shop, 5, fixed());
  expect(next.slots).toEqual(['DMN-02', 'BUF-C01', null, 'DMN-01']);
  expect(refreshShop(shop, 1, fixed()).slots).toEqual([null, 'BUF-C01', null, null]);
  expect(reroll(shop, 4, 5, fixed())).toEqual({ error: 'SHOP_HELD' });
});

test('Block chooses once, caps at three and survives Hold and refresh', () => {
  let shop = activateBlock(createShop(), 'first', 2, fixed());
  shop = activateBlock(shop, 'second', 4, fixed());
  expect(shop.blocks).toEqual(['first', 'first', 'second', null]);
  expect(refreshShop(shop, 1, fixed()).blocks).toEqual(shop.blocks);
  expect(refreshShop({ ...shop, hold: true }, 5, fixed()).blocks).toEqual(shop.blocks);
  expect(buy(refreshShop(shop, 1, fixed()), 8, 0)).toEqual({ error: 'SLOT_BLOCKED' });
  expect(releaseBlock(shop, 'first').blocks).toEqual([null, null, 'second', null]);
});

test('free rerolls cap at three, then cost one coin without overdrawing', () => {
  let shop = createShop();
  for (let round = 1; round <= 4; round++) shop = refreshShop(shop, round, fixed());
  expect(shop.freeRerolls).toBe(3);
  for (let i = 0; i < 3; i++) {
    const result = reroll(shop, 0, 4, fixed());
    if ('error' in result) throw new Error(result.error);
    shop = result.shop;
    expect(result.coins).toBe(0);
  }
  expect(reroll(shop, 0, 4, fixed())).toEqual({ error: 'NOT_ENOUGH_COINS' });
  expect(reroll(shop, 1, 4, fixed())).toMatchObject({ coins: 0 });
});

test('buying on a full Bench can chain merge to 3★ atomically', () => {
  const bench = [offer('BUF-C01'), offer('BUF-C01', 2), offer('BUF-C01'),
    offer('BUF-C01', 2), offer('INT-C01')];
  const shop = { ...createShop(), slots: ['BUF-C01', 'BUF-C02', null, null], bench };
  expect(buy(shop, 10, 1)).toEqual({ error: 'BENCH_FULL' });
  expect(buy(shop, 10, 0)).toMatchObject({
    coins: 9, shop: { bench: [offer('BUF-C01', 3), offer('INT-C01')], slots: [null, 'BUF-C02', null, null] },
  });
  expect(shop.bench).toEqual(bench);
});

test('unique cards, locked Demon cap and Piggy Bank rules are enforced', () => {
  const shop = {
    ...createShop(), slots: ['SPC-01', 'DMN-01', 'DMN-03', 'INT-R01'],
    bench: [offer('SPC-01', 0), offer('DMN-01', 0), offer('DMN-02', 0), offer('INT-R01'), offer('INT-R01')],
  };
  expect(buy(shop, 9, 0)).toEqual({ error: 'CARD_ALREADY_OWNED' });
  expect(buy(shop, 9, 1)).toEqual({ error: 'CARD_ALREADY_OWNED' });
  expect(buy(shop, 9, 2)).toEqual({ error: 'DEMON_LIMIT' });
  expect(buy(shop, 9, 3)).toEqual({ error: 'BENCH_FULL' });
  expect(discard(shop, 9, 1)).toEqual({ error: 'CANNOT_DISCARD' });
  expect(discard(shop, 9, 3)).toMatchObject({ coins: 9 });
  const dropped = discard(shop, 9, 0);
  if ('error' in dropped) throw new Error(dropped.error);
  expect(dropped.coins).toBe(9);
  const purchase = buy(dropped.shop, 9, 3);
  expect(purchase).toMatchObject({ coins: 7, shop: { bench: expect.arrayContaining([offer('INT-R01')]) } });
  if ('error' in purchase) throw new Error(purchase.error);
  expect(purchase.shop.bench.filter(card => card.cardId === 'INT-R01')).toHaveLength(3);
});
