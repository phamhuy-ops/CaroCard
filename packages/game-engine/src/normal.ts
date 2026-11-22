import rules from '../data/normal-cards.json' with { type: 'json' };
import { grantRerolls, releaseBlock } from './shop.ts';
import type { BenchCard, Shop } from './shop.ts';
import type { Rng } from './rng.ts';

export interface TimedEffect {
  star: number;
  from: number;
  through: number;
}

export interface DebuffSource {
  id: string;
  group: 'debuff' | 'demon';
  from: number;
  through: number;
  rule?: 'disruption' | 'jester' | 'ultimatum' | 'rust';
  blocks?: number;
  buyLock?: true;
  noSystemReroll?: true;
  cardLock?: true;
  coinPenalty?: number;
  coinThreshold?: number;
}

export interface NormalEffects {
  hair: TimedEffect | null;
  rarity: TimedEffect | null;
  angelImmune: boolean;
  debuffs: DebuffSource[];
}

export function createNormalEffects(): NormalEffects {
  return { hair: null, rarity: null, angelImmune: false, debuffs: [] };
}

export function timedEffectActive(effect: TimedEffect | null, round: number) {
  return effect !== null && round >= effect.from && round <= effect.through;
}

export function canUseActionCard(cardId: string) {
  return ['INT-C01', 'BUF-C01', 'BUF-C02', 'BUF-R01', 'BUF-E01', 'BUF-L01', 'DEB-C01', 'DEB-C02', 'DEB-R01', 'DEB-R02', 'DEB-E01', 'DEB-L01', 'SPC-02'].includes(cardId);
}

export function canPairWithMark(cardId: string) {
  return ['INT-C01', 'BUF-R01', 'BUF-E01', 'BUF-L01', 'DEB-C02', 'DEB-R01', 'DEB-R02', 'DEB-E01', 'DEB-L01', 'SPC-02'].includes(cardId);
}

export function activateNormal(card: BenchCard, shop: Shop, effects: NormalEffects, round: number, rng: Rng) {
  const { cardId, star } = card;
  const rank = star - 1;
  switch (cardId) {
    case 'INT-C01':
      return { shop: grantRerolls(shop, rules.aurelia.freeRerolls[rank]), effects, coins: rules.aurelia.coins[rank] };
    case 'BUF-C01':
      return {
        shop, coins: 0,
        effects: { ...effects, rarity: { star, from: round + 1, through: round + rules.rarityUp.duration } },
      };
    case 'BUF-C02':
      return {
        shop, coins: 0,
        effects: { ...effects, hair: { star, from: round + 1, through: round + rules.hairTrigger.duration[rank] } },
      };
    case 'BUF-L01': {
      const eligible = effects.debuffs.filter(effect =>
        effect.group === 'debuff' && round >= effect.from && round <= effect.through);
      const removed = new Set<string>();
      if (star === 1) {
        while (eligible.length && removed.size < rules.angel.firstStarCleanseLimit) {
          removed.add(eligible.splice(Math.floor(rng.next() * eligible.length), 1)[0].id);
        }
      } else {
        for (const effect of eligible) removed.add(effect.id);
      }
      let cleansed = shop;
      for (const source of removed) cleansed = releaseBlock(cleansed, source);
      return {
        shop: cleansed, coins: 0,
        effects: {
          ...effects,
          angelImmune: effects.angelImmune || star >= rules.angel.immuneAtStar,
          debuffs: effects.debuffs.filter(effect => !removed.has(effect.id)),
        },
      };
    }
    default:
      throw new Error(`Card ${cardId} has no M5a action`);
  }
}
