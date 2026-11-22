import catalog from '../../../spec/data/cards.json' with { type: 'json' };
import constants from '../../../spec/data/constants.json' with { type: 'json' };
import rules from '../data/normal-cards.json' with { type: 'json' };
import type { Rng } from './rng.ts';

const rarities = ['common', 'rare', 'epic', 'special', 'legendary'] as const;
const normalRarities = ['common', 'rare', 'epic', 'legendary'] as const;
const cards = new Map(catalog.map(card => [card.id, card]));
const weights = Object.entries(constants.demonWeights);
const { shop: shopRules, bench: benchRules, reroll: rerollRules } = constants;
export const piggyBankId = 'INT-R01';

export interface BenchCard {
  cardId: string;
  star: number;
  piggy?: { purchasedRound: number; noSpendRounds: number; totalEarned: number };
  demon?: {
    status: 'Locked' | 'Unlocked' | 'Contracted';
    progress: number;
    failed: boolean;
    sourceId: string;
    activeFrom?: number;
  };
}

export function lockedDemon(cardId: string, sourceId: string, activeFrom: number): BenchCard {
  return { cardId, star: 0, demon: { status: 'Locked', progress: 0, failed: false, sourceId, activeFrom } };
}

export interface Shop {
  slots: (string | null)[];
  bench: BenchCard[];
  blocks: (string | null)[];
  hold: boolean;
  freeRerolls: number;
  spentThisRound: boolean;
}

export function ownsPiggyBank(shop: Shop) {
  return shop.bench.some(card => card.cardId === piggyBankId);
}

export function lockedDemonCount(shop: Shop) {
  return shop.bench.filter(item => cardDefinition(item.cardId).rarity === 'demon'
    && (item.demon?.status ?? 'Locked') === 'Locked').length;
}

export function hideOwnedPiggyBank(shop: Shop): Shop {
  if (!ownsPiggyBank(shop) || !shop.slots.includes(piggyBankId)) return shop;
  return { ...shop, slots: shop.slots.map(id => id === piggyBankId ? null : id) };
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
    spentThisRound: false,
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

export function shopOdds(round: number, rarityStar = 0) {
  const stage = stageFor(round);
  const odds = { ...stage };
  const boosts: Partial<Record<(typeof normalRarities)[number], number>> = rules.rarityUp.boosts[rarityStar - 1] ?? {};
  const deductions = { common: 0, rare: 0, epic: 0, legendary: 0 };
  for (const [index, rarity] of normalRarities.entries()) {
    const boost = boosts[rarity] ?? 0;
    if (!boost) continue;
    odds[rarity] += boost;
    const lower = normalRarities.slice(0, index);
    const pool = lower.reduce((sum, candidate) => sum + stage[candidate], 0);
    if (pool > 0) {
      for (const candidate of lower) deductions[candidate] += Math.min(boost, pool) * stage[candidate] / pool;
    }
  }
  for (const rarity of normalRarities) odds[rarity] = Math.max(0, odds[rarity] - deductions[rarity]);
  let excess = rarities.reduce((sum, rarity) => sum + odds[rarity], 0) - 100;
  const fallback = normalRarities.filter(rarity => !boosts[rarity]).sort((a, b) => odds[b] - odds[a]);
  for (const rarity of fallback) {
    if (excess <= 0) break;
    const deduction = Math.min(excess, odds[rarity]);
    odds[rarity] -= deduction;
    excess -= deduction;
  }
  if (stage.stage > 1 && rarityStar === 3) {
    odds.demonP = Math.min(constants.demonPCap, stage.demonP + constants.rarityUp3DemonBonusPct / 100);
  }
  return odds;
}

function rollDemons(demonP: number, rng: Rng) {
  const available = [...weights];
  const ids: string[] = [];
  while (ids.length < shopRules.maxDemonPerShop && rng.next() < demonP) {
    let roll = rng.next() * available.reduce((sum, [, weight]) => sum + weight, 0);
    const index = available.findIndex(([, weight]) => (roll -= weight) < 0);
    ids.push(available.splice(index, 1)[0][0]);
  }
  return ids;
}

export function rollShop(round: number, rng: Rng, rarityStar = 0, excludePiggyBank = false) {
  const stage = shopOdds(round, rarityStar);
  const demonIds = rollDemons(stage.demonP, rng);
  const remaining = Array.from({ length: shopRules.slots }, (_, index) => index);
  const bySlot = new Map(demonIds.map(id => [takeRandom(remaining, rng), cardDefinition(id)]));
  return Array.from({ length: shopRules.slots }, (_, slot) => {
    const demon = bySlot.get(slot);
    if (demon) return demon;
    let roll = rng.next() * 100;
    const rarity = rarities.find(candidate => (roll -= stage[candidate]) < 0)
      ?? rarities.findLast(candidate => stage[candidate] > 0);
    const eligible = catalog.filter(card => card.rarity === rarity && round >= (card.minRound ?? 1)
      && (!excludePiggyBank || card.id !== piggyBankId));
    const card = eligible[Math.floor(rng.next() * eligible.length)];
    if (!card) throw new Error(`No eligible card for rarity ${rarity} in round ${round}`);
    return card;
  });
}

export function grantRerolls(shop: Shop, amount: number): Shop {
  return { ...shop, freeRerolls: Math.min(rerollRules.freeCap, shop.freeRerolls + amount) };
}

export function refreshShop(shop: Shop, round: number, rng: Rng, rarityStar = 0, grantSystemReroll = true): Shop {
  const next = grantRerolls(shop, (grantSystemReroll ? rerollRules.freePerRound : 0)
    + (rules.rarityUp.freeRerolls[rarityStar - 1] ?? 0));
  if (!shop.hold) return { ...next, slots: rollShop(round, rng, rarityStar, ownsPiggyBank(shop)).map(card => card.id) };

  const expired: number[] = [];
  const empty: number[] = [];
  const slots = hideOwnedPiggyBank(shop).slots.map((id, index) => {
    if (id === null) empty.push(index);
    else if (cardDefinition(id).rarity === 'demon') {
      expired.push(index);
      return null;
    }
    return id;
  });
  const destinations = [...expired, ...empty];
  rollDemons(shopOdds(round, rarityStar).demonP, rng).slice(0, destinations.length).forEach((id, index) => {
    slots[destinations[index]] = id;
  });
  return { ...next, slots };
}

export function reroll(shop: Shop, coins: number, round: number, rng: Rng, rarityStar = 0): Transaction {
  if (shop.hold) return { error: 'SHOP_HELD' };
  const cost = shop.freeRerolls > 0 ? 0 : rerollRules.paidCost;
  if (coins < cost) return { error: 'NOT_ENOUGH_COINS' };
  return {
    coins: coins - cost,
    shop: recordSpend({
      ...shop, freeRerolls: Math.max(0, shop.freeRerolls - 1),
      slots: rollShop(round, rng, rarityStar, ownsPiggyBank(shop)).map(card => card.id),
    }, cost),
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

export function buy(shop: Shop, coins: number, index: number, round = 1, sourceId?: string): Transaction {
  const id = shop.slots[index];
  if (!id) return { error: 'EMPTY_SLOT' };
  if (shop.blocks[index] !== null) return { error: 'SLOT_BLOCKED' };
  const card = cardDefinition(id);
  const demon = card.rarity === 'demon';
  if ((card.uniquePerBench || demon || id === piggyBankId) && shop.bench.some(item => item.cardId === id)) {
    return { error: 'CARD_ALREADY_OWNED' };
  }
  if (demon && lockedDemonCount(shop) >= constants.demonLocking.maxLocked) return { error: 'DEMON_LIMIT' };
  if (coins < card.cost) return { error: 'NOT_ENOUGH_COINS' };

  const item: BenchCard = demon ? lockedDemon(id, sourceId ?? id, round) : { cardId: id, star: card.maxStar > 0 ? 1 : 0 };
  if (card.selfEvolving) item.piggy = { purchasedRound: round, noSpendRounds: 0, totalEarned: 0 };
  const bench = mergeBench([...shop.bench, item], id);
  if (bench.length > benchRules.slots) return { error: 'BENCH_FULL' };
  const slots = [...shop.slots];
  slots[index] = null;
  return { coins: coins - card.cost, shop: recordSpend(hideOwnedPiggyBank({ ...shop, slots, bench }), card.cost) };
}

function recordSpend(shop: Shop, cost: number): Shop {
  if (cost === 0) return shop;
  const bench = shop.bench.map(card => card.piggy
    ? { ...card, piggy: { ...card.piggy, noSpendRounds: 0 } } : card);
  return { ...shop, bench, spentThisRound: true };
}

export function advanceInterest(shop: Shop, round: number) {
  let coins = 0;
  const bench = shop.bench.map(card => {
    if (!card.piggy || card.piggy.purchasedRound >= round || shop.spentThisRound) return card;
    const piggy = { ...card.piggy, noSpendRounds: card.piggy.noSpendRounds + 1 };
    if (piggy.noSpendRounds < rules.piggy.roundsPerReward) return { ...card, piggy };
    const reward = rules.piggy.coins[card.star - 1];
    coins += reward;
    piggy.totalEarned += reward;
    piggy.noSpendRounds = 0;
    return { ...card, star: Math.min(card.star + 1, cardDefinition(card.cardId).maxStar), piggy };
  });
  return { shop: { ...shop, bench, spentThisRound: false }, coins };
}

export function discard(shop: Shop, coins: number, index: number): Transaction {
  const item = shop.bench[index];
  if (!item) return { error: 'EMPTY_SLOT' };
  if (!canDiscard(item.cardId)) return { error: 'CANNOT_DISCARD' };
  const bench = shop.bench.filter((_, slot) => slot !== index);
  const earned = item.piggy?.totalEarned ?? 0;
  const refund = earned > 0 ? Math.max(rules.piggy.minimumReturnWhenEarned, Math.floor(earned * rules.piggy.returnFraction)) : 0;
  return { coins: coins + refund, shop: { ...shop, bench } };
}

export function canDiscard(id: string) {
  const card = cardDefinition(id);
  return card.rarity !== 'demon';
}
