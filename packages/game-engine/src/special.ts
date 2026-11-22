import { cardDefinition, mergeBench, piggyBankId } from './shop.ts';
import type { BenchCard, Shop } from './shop.ts';

export function isMirrorTarget(card: BenchCard) {
  const { rarity, maxStar } = cardDefinition(card.cardId);
  return card.cardId !== piggyBankId && (rarity === 'common' || rarity === 'rare')
    && card.star >= 1 && card.star < maxStar;
}

export function mirrorImage(shop: Shop, slot: number, targetSlot: number, round: number): Shop | null {
  const source = shop.bench[slot];
  const target = shop.bench[targetSlot];
  if (source?.cardId !== 'SPC-03' || round < (cardDefinition(source.cardId).minRound ?? 1)
    || !target || !isMirrorTarget(target)) return null;
  const bench = [...shop.bench];
  bench[slot] = { cardId: target.cardId, star: 1 };
  return { ...shop, bench: mergeBench(bench, target.cardId) };
}
