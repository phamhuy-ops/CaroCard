import rules from '../data/demons.json' with { type: 'json' };
import constants from '../../../spec/data/constants.json' with { type: 'json' };
import { blocksRun, boardSize, hasRunAt, isEdge, resolvePlacements } from './board.ts';
import type { Game, Seat, Square } from './board.ts';
import { activateBlock, cardDefinition } from './shop.ts';
import type { BenchCard, Shop } from './shop.ts';
import type { NormalEffects } from './normal.ts';
import { timedEffectActive } from './normal.ts';
import type { Rng } from './rng.ts';

export const demonRules = rules;
export type DemonId = keyof typeof rules.progress;

export function demonGoal(cardId: string) {
  return rules.progress[cardId as DemonId] ?? 0;
}

export function isHellsDealer(bench: readonly BenchCard[]) {
  return bench.length === constants.bench.slots && constants.demonRewardOrder.every(id =>
    bench.some(card => card.cardId === id && card.demon?.status === 'Contracted'));
}

export function checkDemon(card: BenchCard, passed: boolean): BenchCard {
  const demon = card.demon;
  if (demon?.status !== 'Locked') return card;
  const progress = passed ? demon.progress + 1 : 0;
  const status = progress < demonGoal(card.cardId) ? 'Locked'
    : ['DMN-01', 'DMN-04'].includes(card.cardId) ? 'Unlocked' : 'Contracted';
  return { ...card, demon: { ...demon, progress, status, failed: false } };
}

export function flagCurse(shop: Shop, ids: readonly string[]): Shop {
  return { ...shop, bench: shop.bench.map(card => card.demon?.status === 'Locked' && ids.includes(card.cardId)
    ? { ...card, demon: { ...card.demon, progress: 0, failed: true } } : card) };
}

export function normalCard(card: BenchCard) {
  const { rarity } = cardDefinition(card.cardId);
  return rarity !== 'special' && rarity !== 'demon';
}

export function removeRandomCards(shop: Shop, eligible: (card: BenchCard) => boolean, count: number, rng: Rng) {
  const indices = shop.bench.flatMap((card, index) => eligible(card) ? [index] : []);
  const selected = new Set<number>();
  while (indices.length && selected.size < count) {
    selected.add(indices.splice(Math.floor(rng.next() * indices.length), 1)[0]);
  }
  return { ...shop, bench: shop.bench.filter((_, index) => !selected.has(index)) };
}

export function canCancelDemon(shop: Shop, coins: number, slot: number) {
  const card = shop.bench[slot];
  if (card?.demon?.status !== 'Locked') return false;
  if (card.cardId === 'DMN-01') return coins >= rules.malphas.cancelCoins;
  if (card.cardId === 'DMN-02') return shop.bench.filter(item => cardDefinition(item.cardId).rarity !== 'demon').length >= rules.agares.cancelCards;
  if (card.cardId === 'DMN-03') return coins >= rules.asmodeus.cancelCoins;
  return card.cardId === 'DMN-04' || card.cardId === 'DMN-05';
}

export function cancelDemon(shop: Shop, coins: number, slot: number, rng: Rng) {
  if (!canCancelDemon(shop, coins, slot)) return null;
  const { cardId } = shop.bench[slot];
  let next = { ...shop, bench: shop.bench.filter((_, index) => index !== slot) };
  if (cardId === 'DMN-01') coins -= rules.malphas.cancelCoins;
  if (cardId === 'DMN-03') coins -= rules.asmodeus.cancelCoins;
  if (cardId === 'DMN-02') {
    next = removeRandomCards(next, card => cardDefinition(card.cardId).rarity !== 'demon', rules.agares.cancelCards, rng);
  }
  if (cardId === 'DMN-04') next = { ...next, bench: next.bench.filter(card => !normalCard(card)) };
  if (cardId === 'DMN-05') coins = 0;
  return { shop: next, coins };
}

export function darkWallsRequired(game: Game) {
  return Math.min(rules.malphas.walls, game.board.filter(cell => cell === null).length);
}

export function malphasReward(game: Game, squares: readonly Square[], sourceId = 'DMN-01'): Game | null {
  const capacity = darkWallsRequired(game);
  if (game.result || squares.length > capacity || (capacity > 0 && squares.length === 0)) return null;
  if (squares.length === 0) return game;
  const { board, result } = resolvePlacements(game.board, squares.map(square => ({ ...square, cell: 'Dark Wall' })));
  if (board === game.board) return null;
  const darkWallSources = { ...game.darkWallSources };
  for (const { row, col } of squares) darkWallSources[row * boardSize + col] = sourceId;
  return { ...game, board, result, darkWallSources };
}

export function forbiddenAbaddonRun(game: Game, seat: Seat) {
  return game.board.some((cell, index) => cell === seat && hasRunAt(game.board,
    { row: Math.floor(index / boardSize), col: index % boardSize }, seat, rules.abaddon.forbiddenRun));
}

export function agaresReward(game: Game, caster: Seat, rng: Rng): Game {
  const target = caster === 'X' ? 'O' : 'X';
  const win = constants.board.winLength;
  const board = [...game.board];
  const squareAt = (index: number) => ({ row: Math.floor(index / boardSize), col: index % boardSize });
  const sources = board.flatMap((cell, index) => {
    const square = squareAt(index);
    return cell === target && !isEdge(square) && !hasRunAt(board, square, target, win)
      && !blocksRun(board, square, caster, rules.agares.protectedRun) ? [index] : [];
  });
  let moved = 0;
  while (sources.length && moved < rules.agares.moveMarks) {
    const src = sources.splice(Math.floor(rng.next() * sources.length), 1)[0];
    board[src] = null;
    const destinations = board.flatMap((cell, index) => {
      const square = squareAt(index);
      if (cell !== null || !isEdge(square)) return [];
      board[index] = target;
      const createsWin = hasRunAt(board, square, target, win);
      board[index] = null;
      return createsWin ? [] : [index];
    });
    if (!destinations.length) board[src] = target;
    else {
      board[destinations[Math.floor(rng.next() * destinations.length)]] = target;
      moved++;
    }
  }
  return { ...game, board };
}

export function abaddonReward(shop: Shop, effects: NormalEffects, source: string, round: number, rng: Rng) {
  const next = { ...effects };
  const buffs = (['hair', 'rarity'] as const).filter(key => timedEffectActive(effects[key], round));
  for (let count = 0; count < rules.abaddon.removeBuffs && buffs.length; count++) {
    const key = buffs.splice(Math.floor(rng.next() * buffs.length), 1)[0];
    next[key] = null;
  }
  return { shop: activateBlock(shop, source, rules.abaddon.blocks, rng), effects: next };
}
