import { expect, test } from 'vitest';
import { createGame, resolvePlacements } from './board.ts';
import { abaddonReward, cancelDemon, malphasReward, agaresReward, checkDemon } from './demon.ts';
import { createNormalEffects } from './normal.ts';
import { buy, createShop } from './shop.ts';

const rng = { next: () => 0 };
const card = (cardId: string) => ({ cardId, star: 1 });
const locked = (cardId: string) => ({ cardId, star: 0, demon: {
  status: 'Locked' as const, progress: 0, failed: false, sourceId: cardId,
} });

test('Demon acquisition counts only Locked contracts', () => {
  const first = locked('DMN-01');
  const shop = { ...createShop(), slots: ['DMN-03'], bench: [
    { ...first, demon: { ...first.demon, status: 'Unlocked' as const } }, locked('DMN-02'),
  ] };
  expect(buy(shop, 0, 0)).toMatchObject({ coins: 0, shop: { bench: expect.arrayContaining([
    expect.objectContaining({ cardId: 'DMN-03', demon: expect.objectContaining({ status: 'Locked', progress: 0 }) }),
  ]) } });
});

test('Malphas, Belial and Abaddon maintain consecutive-round progress independently', () => {
  const malphas = locked('DMN-01');
  const belial = locked('DMN-04');
  const abaddon = locked('DMN-05');
  const m1 = checkDemon(malphas, true);
  expect(checkDemon(m1, true).demon).toMatchObject({ status: 'Unlocked', progress: 2 });
  expect(checkDemon(m1, false).demon?.progress).toBe(0);
  expect(checkDemon(checkDemon(checkDemon(belial, true), true), true).demon?.status).toBe('Unlocked');
  expect(checkDemon(checkDemon(checkDemon(abaddon, true), true), true).demon?.status).toBe('Contracted');
});

test('Malphas atomically places the required Dark Walls without touching an occupied square', () => {
  const game = createGame();
  const squares = [{ row: 0, col: 0 }, { row: 0, col: 1 }];
  expect(malphasReward(game, squares)?.board.slice(0, 2)).toEqual(['Dark Wall', 'Dark Wall']);
  expect(malphasReward(game, [squares[0], squares[0]])).toBeNull();
  expect(malphasReward(game, [squares[0]])?.board[0]).toBe('Dark Wall');
  expect(malphasReward(game, [])).toBeNull();
});

test('Agares protects a blocker of four and a confirmed winning chain', () => {
  const game = createGame();
  const { board } = resolvePlacements(game.board, [
    ...[1, 2, 3, 4].map(col => ({ row: 2, col, cell: 'X' as const })),
    { row: 2, col: 5, cell: 'O' },
    ...[1, 2, 3, 4, 5].map(col => ({ row: 4, col, cell: 'O' as const })),
    { row: 6, col: 6, cell: 'O' },
  ]);
  const after = agaresReward({ ...game, board }, 'X', rng);
  expect(after.board[2 * 15 + 5]).toBe('O');
  expect(after.board.slice(4 * 15 + 1, 4 * 15 + 6)).toEqual(Array(5).fill('O'));
  expect(after.board[6 * 15 + 6]).toBeNull();
  expect(after.board[0]).toBe('O');
});

test('cancellation checks the exact penalty and preserves other contracts', () => {
  const shop = { ...createShop(), bench: [locked('DMN-01'), locked('DMN-02'), card('INT-R01'), card('SPC-01')] };
  expect(cancelDemon(shop, 1, 0, rng)).toBeNull();
  expect(cancelDemon(shop, 2, 0, rng)).toMatchObject({ coins: 0, shop: { bench: shop.bench.slice(1) } });
  expect(cancelDemon(shop, 5, 1, rng)).toMatchObject({ coins: 5, shop: { bench: [shop.bench[0]] } });
  expect(cancelDemon({ ...shop, bench: shop.bench.slice(0, 3) }, 5, 1, rng)).toBeNull();
});

test('Abaddon respects the Shop block cap and leaves scheduled buffs and Angel intact', () => {
  const shop = { ...createShop(), blocks: ['existing', 'other', null, null] };
  const rarity = { star: 3, from: 4, through: 5 };
  const effects = {
    ...createNormalEffects(), angelImmune: true, rarity, hair: { star: 1, from: 3, through: 3 },
  };
  const reward = abaddonReward(shop, effects, 'abaddon', 3, rng);
  expect(reward.shop.blocks).toEqual(['existing', 'other', 'abaddon', null]);
  expect(reward.effects).toMatchObject({ hair: null, rarity, angelImmune: true });
});
