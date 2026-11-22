import { expect, test } from 'vitest';
import { blastMakeshiftWall, createGame, placeMakeshiftWalls, remainingWallCapacity } from './board.ts';
import { buy, createShop, discard, refreshShop, reroll } from './shop.ts';
import { mirrorImage } from './special.ts';
import { applyDebuff } from './debuff.ts';
import { createNormalEffects } from './normal.ts';

const card = (cardId: string, star = 1) => ({ cardId, star });
const rng = { next: () => 0 };

test('Powder Keg destroys a wall of either seat and releases the original owner’s limit', () => {
  const placed = placeMakeshiftWalls(createGame(), 1, [{ row: 0, col: 0 }])!;
  const board = [...placed.board];
  board[1] = 'Dark Wall';
  board[2] = 'O';
  for (const turn of ['X', 'O'] as const) {
    const game = { ...placed, board, turn };
    expect(blastMakeshiftWall(game, { row: 0, col: 1 })).toBeNull();
    expect(blastMakeshiftWall(game, { row: 0, col: 2 })).toBeNull();
    const blasted = blastMakeshiftWall(game, { row: 0, col: 0 })!;
    expect(blasted.board.slice(0, 3)).toEqual([null, 'Dark Wall', 'O']);
    expect(blasted.wallOwners[0]).toBeUndefined();
    expect(remainingWallCapacity(blasted, 'X')).toBe(3);
  }
});

test('Mirror Image creates a 1★ copy from a 2★ target and can merge on a full Bench', () => {
  const shop = { ...createShop(), bench: [
    card('SPC-03', 0), card('BUF-C01', 2), card('BUF-C01'), card('BUF-C01'), card('INT-R01'),
  ] };
  expect(mirrorImage(shop, 0, 1, 4)).toBeNull();
  expect(mirrorImage(shop, 0, 4, 5)).toBeNull();
  expect(mirrorImage(shop, 0, 1, 5)?.bench).toEqual([card('BUF-C01', 2), card('BUF-C01', 2), card('INT-R01')]);
  for (const invalid of [card('BUF-C01', 3), card('BUF-E01'), card('SPC-01', 0), card('DMN-01', 0)]) {
    expect(mirrorImage({ ...shop, bench: [shop.bench[0], invalid] }, 0, 1, 5)).toBeNull();
  }
});

test('one owned Piggy Bank is removed from current and subsequent Shop offers until it leaves the Bench', () => {
  const shop = { ...createShop(), slots: ['INT-R01', 'INT-R01', null, null] };
  const bought = buy(shop, 4, 0);
  if ('error' in bought) throw new Error(bought.error);
  expect(bought.shop.slots).toEqual([null, null, null, null]);
  const rarePiggy = { next: () => 0.9 };
  for (const seed of [0.7, 0.8, 0.9]) {
    const random = { next: () => seed };
    expect(refreshShop(bought.shop, 1, random).slots).not.toContain('INT-R01');
    expect(reroll(bought.shop, 2, 1, random)).toMatchObject({ shop: { slots: expect.not.arrayContaining(['INT-R01']) } });
  }
  expect(buy({ ...bought.shop, slots: shop.slots }, 4, 1)).toEqual({ error: 'CARD_ALREADY_OWNED' });
  const broken = discard(bought.shop, 2, 0);
  if ('error' in broken) throw new Error(broken.error);
  expect(refreshShop(broken.shop, 1, rarePiggy).slots).toContain('INT-R01');
});

test('Jester cannot give a second Piggy Bank and clears its Shop offers when the first is transferred', () => {
  const attacker = { shop: { ...createShop(), slots: ['INT-R01', null, null, null] }, effects: createNormalEffects(), coins: 0 };
  const piggy = { ...card('INT-R01'), piggy: { purchasedRound: 1, noSpendRounds: 1, totalEarned: 1 } };
  const target = { ...attacker, shop: { ...createShop(), bench: [piggy] } };
  const first = applyDebuff(card('DEB-R02', 2), attacker, target, 2, 'test', rng);
  expect(first.attacker.shop.bench).toEqual([piggy]);
  expect(first.attacker.shop.slots).not.toContain('INT-R01');
  const second = applyDebuff(card('DEB-R02', 2), first.attacker, target, 2, 'test-2', rng);
  expect(second.attacker.shop.bench).toEqual([piggy]);
  expect(second.target.shop.bench).toEqual([piggy]);
});
