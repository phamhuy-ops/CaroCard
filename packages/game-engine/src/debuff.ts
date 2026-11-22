import config from '../data/normal-cards.json' with { type: 'json' };
import constants from '../../../spec/data/constants.json' with { type: 'json' };
import { activateBlock, cardDefinition, hideOwnedPiggyBank, mergeBench, ownsPiggyBank, piggyBankId, releaseBlock } from './shop.ts';
import type { BenchCard, Shop } from './shop.ts';
import type { DebuffSource, NormalEffects } from './normal.ts';
import type { Rng } from './rng.ts';

const { disruption, ultimatum, jester, rust, corruption } = config.debuff;
export type UltimatumChoice = 'accept' | 'resist';

interface Combatant {
  shop: Shop;
  effects: NormalEffects;
  coins: number;
}

function active(effect: DebuffSource, round: number) {
  return round >= effect.from && round <= effect.through;
}

export function hasDebuff(effects: NormalEffects, flag: 'buyLock' | 'cardLock' | 'noSystemReroll', round: number) {
  return effects.debuffs.some(effect => active(effect, round) && effect[flag]);
}

function normal(card: BenchCard) {
  const { rarity } = cardDefinition(card.cardId);
  return rarity !== 'special' && rarity !== 'demon';
}

function pick(bench: readonly BenchCard[], eligible: (card: BenchCard) => boolean,
  count: number, rng: Rng, highestFirst = false) {
  const candidates = bench.flatMap((card, index) => eligible(card) ? [index] : []);
  const selected: number[] = [];
  while (selected.length < count && candidates.length) {
    const highest = Math.max(...candidates.map(index => bench[index].star));
    const pool = highestFirst ? candidates.filter(index => bench[index].star === highest) : candidates;
    const index = pool[Math.floor(rng.next() * pool.length)];
    selected.push(index);
    candidates.splice(candidates.indexOf(index), 1);
  }
  return selected;
}

function remove(bench: readonly BenchCard[], indices: readonly number[]) {
  return bench.filter((_, index) => !indices.includes(index));
}

function withBench(player: Combatant, bench: BenchCard[]): Combatant {
  return { ...player, shop: hideOwnedPiggyBank({ ...player.shop, bench }) };
}

function changeStars(bench: readonly BenchCard[], indices: number[], update: (star: number) => number) {
  const next = bench.map((item, index) => indices.includes(index) ? { ...item, star: update(item.star) } : item);
  const types = new Set(indices.map(index => bench[index].cardId));
  return [...types].reduce((cards, id) => mergeBench(cards, id), next);
}

function withoutRule(player: Combatant, rule: DebuffSource['rule'], test: (effect: DebuffSource) => boolean) {
  const removed = player.effects.debuffs.filter(effect => effect.rule === rule && test(effect));
  return {
    ...player,
    shop: removed.reduce((shop, effect) => releaseBlock(shop, effect.id), player.shop),
    effects: { ...player.effects, debuffs: player.effects.debuffs.filter(effect => !removed.includes(effect)) },
  };
}

function schedule(player: Combatant, id: string, round: number, duration: number,
  rule: NonNullable<DebuffSource['rule']>, details: Partial<DebuffSource>): Combatant {
  const next = withoutRule(player, rule, effect => rule === 'rust' || effect.from > round);
  const effect: DebuffSource = { ...details, id, group: 'debuff', rule, from: round + 1, through: round + duration };
  return { ...next, effects: { ...next.effects, debuffs: [...next.effects.debuffs, effect] } };
}

export function startDebuffRound(player: Combatant, round: number, rng: Rng): Combatant {
  const effects = player.effects.debuffs;
  let shop = player.shop;
  const starting = effects.filter(effect => effect.group === 'debuff' && effect.from === round);
  const kept = effects.filter(effect => {
    const replace = effect.group === 'debuff' && starting.some(next => next.rule === effect.rule && next.from > effect.from);
    if (effect.through >= round && !replace) return true;
    shop = releaseBlock(shop, effect.id);
    return false;
  });
  for (const effect of starting) {
    if (effect.blocks) shop = activateBlock(shop, effect.id, effect.blocks, rng);
  }
  return { ...player, shop, effects: { ...player.effects, debuffs: kept } };
}

export function endDebuffRound(player: Combatant, round: number): Combatant {
  let { coins } = player;
  for (const effect of player.effects.debuffs) {
    if (active(effect, round) && effect.coinPenalty && coins >= (effect.coinThreshold ?? 0)) {
      coins = Math.max(0, coins - effect.coinPenalty);
    }
  }
  return { ...player, coins };
}

export function canResistUltimatum(star: number, coins: number) {
  return star !== 2 || coins >= ultimatum.coinPenalty;
}

export function ultimatumView(star: number, coins: number) {
  return {
    star, canResist: canResistUltimatum(star, coins),
    blocks: ultimatum.blocks, coinThreshold: ultimatum.coinThreshold, coinPenalty: ultimatum.coinPenalty,
    destroy: ultimatum.destroy, lockedRounds: ultimatum.lockedRounds,
  };
}

export function applyUltimatum(target: Combatant, star: number, choice: UltimatumChoice,
  round: number, id: string, rng: Rng): Combatant {
  if (target.effects.angelImmune) return target;
  if (choice === 'accept') {
    if (star === 1) return schedule(target, id, round, 1, 'ultimatum', { buyLock: true });
    if (star === 2) return schedule(target, id, round, 1, 'ultimatum', {
      coinThreshold: ultimatum.coinThreshold, coinPenalty: ultimatum.coinPenalty,
    });
    return schedule(target, id, round, ultimatum.lockedRounds, 'ultimatum', { cardLock: true });
  }
  if (star === 1) return schedule(target, id, round, 1, 'ultimatum', { blocks: ultimatum.blocks, noSystemReroll: true });
  if (star === 2) return { ...target, coins: Math.max(0, target.coins - ultimatum.coinPenalty) };
  return withBench(target, remove(target.shop.bench, pick(target.shop.bench, normal, ultimatum.destroy, rng)));
}

function bargain(star: number, attacker: Combatant, target: Combatant, round: number, id: string, rng: Rng) {
  if (star === 1) return {
    attacker, target: schedule({ ...target, coins: target.coins + jester.giftCoins },
      id, round, jester.blockRounds, 'jester', { blocks: jester.blocks }),
  };
  if (star === 2) {
    let sourceBench = attacker.shop.bench;
    let targetBench = target.shop.bench;
    let targetCoins = target.coins;
    const [giftIndex] = pick(sourceBench, card => cardDefinition(card.cardId).rarity === 'common', 1, rng);
    if (giftIndex === undefined) targetCoins += jester.giftCoins;
    else {
      const gift = sourceBench[giftIndex];
      sourceBench = remove(sourceBench, [giftIndex]);
      if (targetBench.length >= constants.bench.slots) targetBench = remove(targetBench, pick(targetBench, normal, 1, rng));
      if (targetBench.length < constants.bench.slots) targetBench = mergeBench([...targetBench, gift], gift.cardId);
    }
    const alreadyOwnsPiggy = ownsPiggyBank(attacker.shop);
    const [rareIndex] = pick(targetBench, card => cardDefinition(card.cardId).rarity === 'rare'
      && (!alreadyOwnsPiggy || card.cardId !== piggyBankId), 1, rng);
    if (rareIndex !== undefined) {
      const rare = targetBench[rareIndex];
      targetBench = remove(targetBench, [rareIndex]);
      sourceBench = mergeBench([...sourceBench, rare], rare.cardId);
    }
    return { attacker: withBench(attacker, sourceBench), target: withBench({ ...target, coins: targetCoins }, targetBench) };
  }
  const upgrade = pick(target.shop.bench, card => {
    const definition = cardDefinition(card.cardId);
    return definition.rarity === 'rare' && !definition.selfEvolving && card.star < definition.maxStar;
  }, 1, rng);
  const upgraded = changeStars(target.shop.bench, upgrade, star => star + 1);
  const destroy = pick(upgraded, card => ['epic', 'legendary', 'special'].includes(cardDefinition(card.cardId).rarity), 1, rng);
  return { attacker, target: withBench({ ...target, coins: Math.max(0, target.coins - jester.tax) }, remove(upgraded, destroy)) };
}

export function applyDebuff(card: BenchCard, attacker: Combatant, target: Combatant, round: number, id: string, rng: Rng) {
  if (target.effects.angelImmune) return { attacker, target };
  const { cardId, star } = card;
  switch (cardId) {
    case 'DEB-C01':
      return { attacker, target: schedule(target, id, round, disruption.rounds, 'disruption', { blocks: disruption.blocks[star - 1] }) };
    case 'DEB-C02': {
      const selected = pick(target.shop.bench, item => item.star <= star && cardDefinition(item.cardId).group === 'interest', 1, rng, true);
      return { attacker, target: withBench(target, remove(target.shop.bench, selected)) };
    }
    case 'DEB-R02':
      return bargain(star, attacker, target, round, id, rng);
    case 'DEB-E01':
      return { attacker, target: schedule(target, id, round, rust.rounds[star - 1], 'rust', { coinPenalty: rust.coins[star - 1] }) };
    case 'DEB-L01': {
      const chosen = pick(target.shop.bench, item => normal(item) && item.star >= 2,
        corruption.targets[star - 1] ?? target.shop.bench.length, rng, true);
      return { attacker, target: withBench(target, changeStars(target.shop.bench, chosen, rank => star === 3 ? 1 : rank - 1)) };
    }
    default:
      throw new Error(`Card ${cardId} requires a separate choice`);
  }
}
