import catalog from '../../../spec/data/cards.json' with { type: 'json' };
import constants from '../../../spec/data/constants.json' with { type: 'json' };
import type { Rng } from './rng.ts';

const rarities = ['common', 'rare', 'epic', 'special', 'legendary'] as const;
const cards = new Map(catalog.map(card => [card.id, card]));
const weights = Object.entries(constants.demonWeights);
const { shop: shopRules, bench: benchRules, reroll: rerollRules } = constants;

export interface BenchCard {
  cardId: string;
  star: number;
}

export interface Shop {
  slots: (string | null)[];
  bench: BenchCard[];
  blocks: (string | null)[];
  hold: boolean;
  freeRerolls: number;
}

type ShopError = 'SHOP_HELD' | 'NOT_ENOUGH_COINS' | 'SLOT_BLOCKED' | 'EMPTY_SLOT'
  | 'BENCH_FULL' | 'CARD_ALREADY_OWNED' | 'DEMON_LIMIT' | 'CANNOT_DISCARD';
type Transaction = { error: ShopError } | { shop: Shop; coins: number };

export function cardDefinition(id: string) {
  const card = cards.get(id);
  if (!card) throw new Error(`Unknown card ${id}`);
  return card;
}

export function createShop(): Shop {
  return {
    slots: Array<string | null>(shopRules.slots).fill(null),
    bench: [],
    blocks: Array<string | null>(shopRules.slots).fill(null),
    hold: false,
    freeRerolls: 0,
  };
}

function stageFor(round: number) {
  const stage = constants.rarityStages.find(candidate =>
    round >= candidate.roundFrom && (candidate.roundTo === null || round <= candidate.roundTo));
  if (!stage) throw new Error(`No Shop rarity stage for round ${round}`);
  return stage;
}

function takeRandom<T>(options: T[], rng: Rng): T {
  return options.splice(Math.floor(rng.next() * options.length), 1)[0];
}

function rollDemons(round: number, rng: Rng) {
  const { demonP } = stageFor(round);
  const available = [...weights];
  const ids: string[] = [];
  while (ids.length < shopRules.maxDemonPerShop && rng.next() < demonP) {
    let roll = rng.next() * available.reduce((sum, [, weight]) => sum + weight, 0);
    const index = available.findIndex(([, weight]) => (roll -= weight) < 0);
    ids.push(available.splice(index, 1)[0][0]);
  }
  return ids;
}

export function rollShop(round: number, rng: Rng) {
  const stage = stageFor(round);
  const demonIds = rollDemons(round, rng);
  const remaining = Array.from({ length: shopRules.slots }, (_, index) => index);
  const bySlot = new Map(demonIds.map(id => [takeRandom(remaining, rng), cardDefinition(id)]));
  return Array.from({ length: shopRules.slots }, (_, slot) => {
    const demon = bySlot.get(slot);
    if (demon) return demon;
    let roll = rng.next() * 100;
    const rarity = rarities.find(candidate => (roll -= stage[candidate]) < 0);
    const eligible = catalog.filter(card => card.rarity === rarity && round >= (card.minRound ?? 1));
    const card = eligible[Math.floor(rng.next() * eligible.length)];
    if (!card) throw new Error(`No eligible card for rarity ${rarity} in round ${round}`);
    return card;
  });
}

export function refreshShop(shop: Shop, round: number, rng: Rng): Shop {
  const freeRerolls = Math.min(rerollRules.freeCap, shop.freeRerolls + rerollRules.freePerRound);
  if (!shop.hold) return { ...shop, freeRerolls, slots: rollShop(round, rng).map(card => card.id) };

  const expired: number[] = [];
  const empty: number[] = [];
  const slots = shop.slots.map((id, index) => {
    if (id === null) empty.push(index);
    else if (cardDefinition(id).rarity === 'demon') {
      expired.push(index);
      return null;
    }
    return id;
  });
  const destinations = [...expired, ...empty];
  rollDemons(round, rng).slice(0, destinations.length).forEach((id, index) => {
    slots[destinations[index]] = id;
  });
  return { ...shop, freeRerolls, slots };
}

export function reroll(shop: Shop, coins: number, round: number, rng: Rng): Transaction {
  if (shop.hold) return { error: 'SHOP_HELD' };
  const cost = shop.freeRerolls > 0 ? 0 : rerollRules.paidCost;
  if (coins < cost) return { error: 'NOT_ENOUGH_COINS' };
  return {
    coins: coins - cost,
    shop: {
      ...shop, freeRerolls: Math.max(0, shop.freeRerolls - 1),
      slots: rollShop(round, rng).map(card => card.id),
    },
  };
}

export function activateBlock(shop: Shop, source: string, count: number, rng: Rng): Shop {
  if (shop.blocks.includes(source)) return shop;
  const blocks = [...shop.blocks];
  const open = blocks.flatMap((effect, index) => effect === null ? [index] : []);
  const available = shopRules.maxBlocked - (blocks.length - open.length);
  for (let i = 0; i < Math.min(count, available); i++) blocks[takeRandom(open, rng)] = source;
  return { ...shop, blocks };
}

export function releaseBlock(shop: Shop, source: string): Shop {
  return { ...shop, blocks: shop.blocks.map(effect => effect === source ? null : effect) };
}

export function mergeBench(bench: readonly BenchCard[], cardId: string): BenchCard[] {
  const definition = cardDefinition(cardId);
  let result = [...bench];
  if (definition.mergeable === false) return result;
  for (let star = 1; star < definition.maxStar; star++) {
    const matches = result.flatMap((card, index) => card.cardId === cardId && card.star === star ? [index] : []);
    const consumed = new Set<number>();
    while (matches.length >= 3) {
      const [first, second, third] = matches.splice(0, 3);
      result[first] = { cardId, star: star + 1 };
      consumed.add(second);
      consumed.add(third);
    }
    result = result.filter((_, index) => !consumed.has(index));
  }
  return result;
}

export function buy(shop: Shop, coins: number, index: number): Transaction {
  const id = shop.slots[index];
  if (!id) return { error: 'EMPTY_SLOT' };
  if (shop.blocks[index] !== null) return { error: 'SLOT_BLOCKED' };
  const card = cardDefinition(id);
  const demon = card.rarity === 'demon';
  if ((card.uniquePerBench || demon) && shop.bench.some(item => item.cardId === id)) {
    return { error: 'CARD_ALREADY_OWNED' };
  }
  // Demon progression is introduced in M7. Every purchased Demon starts Locked.
  if (demon && shop.bench.filter(item => cardDefinition(item.cardId).rarity === 'demon').length
    >= constants.demonLocking.maxLocked) return { error: 'DEMON_LIMIT' };
  if (coins < card.cost) return { error: 'NOT_ENOUGH_COINS' };

  const bench = mergeBench([...shop.bench, { cardId: id, star: card.maxStar > 0 ? 1 : 0 }], id);
  if (bench.length > benchRules.slots) return { error: 'BENCH_FULL' };
  const slots = [...shop.slots];
  slots[index] = null;
  return { coins: coins - card.cost, shop: { ...shop, slots, bench } };
}

export function discard(shop: Shop, coins: number, index: number): Transaction {
  const item = shop.bench[index];
  if (!item) return { error: 'EMPTY_SLOT' };
  if (!canDiscard(item.cardId)) return { error: 'CANNOT_DISCARD' };
  const bench = shop.bench.filter((_, slot) => slot !== index);
  return { coins, shop: { ...shop, bench } };
}

export function canDiscard(id: string) {
  const card = cardDefinition(id);
  return !card.selfEvolving && card.rarity !== 'demon';
}
