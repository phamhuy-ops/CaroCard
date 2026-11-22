import { createHash, randomBytes } from 'node:crypto';
import { blastMakeshiftWall, boardSize, createGame, isEdge, moveWithNewAngle, newAngleTargets, placeMakeshiftWalls, placeTurn, removeDarkWalls,
  remainingWallCapacity, wallsForStar } from '@carocard/game-engine';
import { createRng } from '@carocard/game-engine/rng';
import type { Rng } from '@carocard/game-engine/rng';
import { advanceInterest, buy, canDiscard, cardDefinition, createShop, discard, lockedDemon, lockedDemonCount, refreshShop, releaseBlock, reroll } from '@carocard/game-engine/shop';
import type { BenchCard, Shop } from '@carocard/game-engine/shop';
import { abaddonReward, agaresReward, canCancelDemon, cancelDemon, checkDemon, darkWallsRequired, demonGoal,
  demonRules, flagCurse, forbiddenAbaddonRun, isHellsDealer, malphasReward, normalCard, removeRandomCards } from '@carocard/game-engine/demon';
import { activateNormal, canPairWithMark, canUseActionCard, createNormalEffects, timedEffectActive } from '@carocard/game-engine/normal';
import { isMirrorTarget, mirrorImage } from '@carocard/game-engine/special';
import type { NormalEffects } from '@carocard/game-engine/normal';
import { applyDebuff, applyUltimatum, canResistUltimatum, endDebuffRound, hasDebuff, startDebuffRound, ultimatumView } from '@carocard/game-engine/debuff';
import type { UltimatumChoice } from '@carocard/game-engine/debuff';
import { ErrorCode, gameConstants } from '@carocard/shared';
import type { ChoiceWindow, Command, CommandResult, Face, Phase, Preparation, PrivateState, Seat, Snapshot } from '@carocard/shared';

const { timersMs, roundEndOrder, startCoins, coinsPerRound } = gameConstants;
const seats: readonly Seat[] = ['X', 'O'];

interface RoomOptions {
  now?: () => number;
  rng?: Rng;
  prepDuration?: (seat: Seat) => number;
  roundEndStep?: (step: string, seat: Seat) => void;
  roundTransitionMs?: number;
  seed?: number;
  choiceId?: () => string;
}

export interface Player {
  token: string;
  host: boolean;
  online: boolean;
  face: Face | null;
  seat: Seat | null;
  shop: Shop;
  effects: NormalEffects;
  privateState: Pick<PrivateState, 'curseProgress' | 'transactions'>;
  commands: Map<string, CommandResult>;
  holdUntil: number | null;
  expired: boolean;
  benchLockedThrough: number;
  actionCardsLockedThrough: number;
  resetCoinsAt: number;
  reducedPreparation: { from: number; through: number } | null;
  ultimatumTimeout: Snapshot['you']['ultimatumTimeout'];
}

function publicPlayer({ host, online, face, seat }: Player) {
  return { host, online, face, seat };
}

function cardView(cardId: string) {
  const { id, name, rarity, cost } = cardDefinition(cardId);
  return { id, name, rarity, cost };
}

export class Room {
  readonly players: Player[] = [];
  phase: Phase = 'LOBBY';
  revision = 0;
  private game = createGame();
  private coin: Face | null = null;
  private queue: Promise<void> = Promise.resolve();
  private preparation: Record<Seat, Preparation> | null = null;
  private actionDeadline: number | null = null;
  private nextRoundAt: number | null = null;
  private choiceWindow: ChoiceWindow | null = null;
  private pendingUltimatum: { star: number; keepTurn: boolean } | null = null;
  private readonly forcedTurns = new Map<Seat, { caster: Seat; sourceId: string }>();
  private round = 0;
  private coins = { ...startCoins };
  private connectionResult: Snapshot['result'] = null;
  private placed = false;
  private usedCard = false;
  private timelyAsmodeusMark = false;
  private lastCard: Snapshot['lastCard'] = null;

  readonly code: string;
  private readonly tossCoin: () => Face;
  private readonly now: () => number;
  private readonly rng: Rng;
  private readonly shopRng: Record<Seat, Rng>;
  private readonly prepDuration: (seat: Seat) => number;
  private readonly roundEndStep?: RoomOptions['roundEndStep'];
  private readonly roundTransitionMs: number;
  private readonly choiceId: () => string;

  constructor(code: string, tossCoin?: () => Face, options: RoomOptions = {}) {
    this.code = code;
    this.now = options.now ?? (() => performance.now());
    const seed = options.seed ?? randomBytes(4).readUInt32LE();
    const coinRng = createRng(seed ^ 0xc2b2ae35);
    this.tossCoin = tossCoin ?? (() => coinRng.next() < 0.5 ? 'heads' : 'tails');
    this.rng = options.rng ?? createRng(seed);
    this.shopRng = { X: createRng(seed ^ 0x9e3779b9), O: createRng(seed ^ 0x85ebca6b) };
    this.prepDuration = options.prepDuration ?? (() => timersMs.prep);
    this.roundEndStep = options.roundEndStep;
    this.roundTransitionMs = options.roundTransitionMs ?? 3000;
    let sequence = 0;
    this.choiceId = options.choiceId ?? (() => `00000000-0000-4000-8000-${(++sequence).toString(16).padStart(12, '0')}`);
  }

  enqueue(work: () => void) {
    const operation = this.queue.then(work);
    this.queue = operation.catch(() => {});
    return operation;
  }

  matchHash() {
    return createHash('sha256').update(JSON.stringify({
      players: this.players.map(player => {
        const snapshot = this.snapshot(player);
        const you: Partial<Snapshot['you']> = { ...snapshot.you };
        delete you.ultimatumTimeout;
        return {
          snapshot: { ...snapshot, serverTime: 0, you },
          shop: player.shop, effects: player.effects, holdUntil: player.holdUntil, expired: player.expired,
          benchLockedThrough: player.benchLockedThrough, actionCardsLockedThrough: player.actionCardsLockedThrough,
          resetCoinsAt: player.resetCoinsAt, reducedPreparation: player.reducedPreparation,
        };
      }),
      game: this.game, forcedTurns: [...this.forcedTurns], pendingUltimatum: this.pendingUltimatum,
      placed: this.placed, usedCard: this.usedCard, timelyAsmodeusMark: this.timelyAsmodeusMark,
    })).digest('hex');
  }

  join() {
    if (this.players.length >= 2 || this.phase !== 'LOBBY') throw new Error('Room is full');
    const player: Player = {
      token: randomBytes(32).toString('hex'),
      host: this.players.length === 0,
      online: true,
      face: null,
      seat: null,
      shop: createShop(),
      effects: createNormalEffects(),
      privateState: { curseProgress: {}, transactions: [] },
      commands: new Map(),
      holdUntil: null,
      expired: false,
      benchLockedThrough: 0,
      actionCardsLockedThrough: 0,
      resetCoinsAt: 0,
      reducedPreparation: null,
      ultimatumTimeout: null,
    };
    this.players.push(player);
    this.revision++;
    return player;
  }

  setOnline(player: Player, online: boolean, at = this.now()) {
    this.advance(at);
    if (player.online === online) return;
    player.online = online;
    player.holdUntil = !online && this.running ? at + timersMs.seatHold : null;
    this.revision++;
  }

  reconnect(player: Player, at = this.now()) {
    this.advance(at);
    if (player.expired) return false;
    this.setOnline(player, true, at);
    this.finishExpiredMatch();
    return true;
  }

  private get running() {
    return this.phase !== 'LOBBY' && this.phase !== 'FINISHED';
  }

  get nextDeadline() {
    let next = this.actionDeadline ?? this.choiceWindow?.deadline ?? this.nextRoundAt ?? Infinity;
    if (this.preparation) {
      for (const seat of seats) {
        if (!this.preparation[seat].ready) next = Math.min(next, this.preparation[seat].deadline);
      }
    }
    if (this.running) {
      for (const player of this.players) next = Math.min(next, player.holdUntil ?? Infinity);
    }
    return next;
  }

  advance(at = this.now()) {
    for (let deadline = this.nextDeadline; deadline < at; deadline = this.nextDeadline) {
      for (const player of this.players) {
        if (player.holdUntil !== deadline) continue;
        player.holdUntil = null;
        player.expired = true;
        this.revision++;
      }
      this.finishExpiredMatch();
      if (!this.running) return;
      if (this.nextRoundAt === deadline) {
        this.beginPreparation(deadline);
        this.revision++;
      } else if (this.preparation) {
        for (const seat of seats) {
          if (this.preparation?.[seat].deadline === deadline && !this.preparation[seat].ready) {
            this.markReady(seat, deadline);
            this.revision++;
          }
        }
      } else if (this.choiceWindow?.deadline === deadline) {
        if (this.pendingUltimatum) {
          const target = this.players.find(player => player.seat === this.choiceWindow?.seat);
          if (!target?.seat) throw new Error('Ultimatum target missing');
          const choice = canResistUltimatum(this.pendingUltimatum.star, this.coins[target.seat]) ? 'resist' : 'accept';
          this.resolveUltimatum(target, target.seat, choice, deadline, true);
        } else if (this.choiceWindow.kind === 'belial' && this.forcedTurns.has(this.game.turn)) {
          this.forceMark(this.randomEmptySquare(), deadline);
          this.revision++;
        } else this.closeChoice(this.choiceWindow.id, deadline);
      } else if (this.actionDeadline === deadline) {
        if (this.placed || this.usedCard) {
          this.endAction(deadline);
        } else {
          const { row, col } = this.randomEmptySquare();
          this.place(row, col, deadline, false);
        }
        this.revision++;
      }
    }
  }

  private finishExpiredMatch() {
    if (!this.running || !this.players.some(player => player.expired)) return;
    const winner = this.players.find(player => player.online && !player.expired)?.seat;
    if (winner) this.connectionResult = { kind: 'win', winner, reason: 'disconnect' };
    else if (this.players.every(player => player.expired)) this.connectionResult = { kind: 'cancelled' };
    else return;
    this.finish();
    this.revision++;
  }

  private finish() {
    this.phase = 'FINISHED';
    this.preparation = null;
    this.actionDeadline = null;
    this.nextRoundAt = null;
    this.choiceWindow = null;
    this.pendingUltimatum = null;
  }

  private confirmResult() {
    const dealer = this.players.find(player => player.seat && isHellsDealer(player.shop.bench))?.seat;
    if (dealer) this.game = { ...this.game, result: { kind: 'win', winner: dealer, reason: 'hellsDealer' } };
    if (!this.game.result) return false;
    this.finish();
    return true;
  }

  private beginPreparation(at: number) {
    this.round++;
    this.phase = 'PREPARATION';
    this.actionDeadline = null;
    this.nextRoundAt = null;
    const durations = { X: this.prepDuration('X'), O: this.prepDuration('O') };
    for (const player of this.players) {
      if (!player.seat) continue;
      if (player.resetCoinsAt === this.round) this.coins[player.seat] = 0;
      const reduction = player.reducedPreparation;
      if (reduction && this.round >= reduction.from && this.round <= reduction.through) {
        durations[player.seat] *= gameConstants.belialCancelPrepFactor;
      }
      if (player.shop.bench.some(card => card.cardId === 'DMN-03' && card.demon?.status === 'Contracted')) {
        const opponent = player.seat === 'X' ? 'O' : 'X';
        durations[opponent] *= gameConstants.asmodeusPrepFactor;
      }
    }
    this.checkAbaddonBoard();
    this.preparation = {
      X: { deadline: at + Math.max(timersMs.minPrep, Math.floor(durations.X)), ready: false },
      O: { deadline: at + Math.max(timersMs.minPrep, Math.floor(durations.O)), ready: false },
    };
  }

  private markReady(seat: Seat, at: number) {
    if (!this.preparation) return;
    this.preparation[seat].ready = true;
    if (!this.preparation.X.ready || !this.preparation.O.ready) return;
    this.preparation = null;
    this.phase = 'ACTION';
    this.openAction(at);
  }

  private openAction(at: number) {
    this.actionDeadline = at + timersMs.action;
    const forced = this.forcedTurns.get(this.game.turn);
    if (forced) this.openChoice(forced.caster, 'belial', at);
  }

  private randomEmptySquare() {
    const free = this.game.board.flatMap((cell, index) => cell === null ? [index] : []);
    const index = free[Math.floor(this.rng.next() * free.length)];
    return { row: Math.floor(index / boardSize), col: index % boardSize };
  }

  private forceMark({ row, col }: ReturnType<Room['randomEmptySquare']>, at: number) {
    if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0 || row >= boardSize
      || col >= boardSize || this.game.board[row * boardSize + col] !== null) return ErrorCode.InvalidCell;
    this.forcedTurns.delete(this.game.turn);
    this.choiceWindow = null;
    return this.place(row, col, at, false);
  }

  private updateCurse(player: Player, cardId: string, condition: (card: BenchCard) => boolean) {
    const slot = player.shop.bench.findIndex(card => card.cardId === cardId && card.demon?.status === 'Locked'
      && (card.demon.activeFrom ?? 1) <= this.round);
    if (slot < 0) return;
    const bench = [...player.shop.bench];
    const current = bench[slot];
    bench[slot] = checkDemon(current, condition(current));
    player.shop = { ...player.shop, bench };
    return bench[slot].demon?.status === 'Contracted' ? bench[slot].demon : undefined;
  }

  private checkAbaddonBoard() {
    for (const player of this.players) {
      if (player.seat && player.shop.bench.some(card => card.cardId === 'DMN-05' && card.demon?.status === 'Locked'
        && (card.demon.activeFrom ?? 1) <= this.round)
        && forbiddenAbaddonRun(this.game, player.seat)) player.shop = flagCurse(player.shop, ['DMN-05']);
    }
  }

  private checkRoundDemons(player: Player, seat: Seat) {
    this.updateCurse(player, 'DMN-04', card => !card.demon?.failed && this.coins[seat] <= demonRules.belial.maxCoins);
    const contract = this.updateCurse(player, 'DMN-05', card => !card.demon?.failed);
    const opponent = this.players.find(other => other.seat !== seat);
    if (contract && opponent) {
      const reward = abaddonReward(opponent.shop, opponent.effects, contract.sourceId, this.round, this.rng);
      opponent.shop = reward.shop;
      opponent.effects = reward.effects;
    }
  }

  private benchLocked(player: Player) {
    return this.round > 0 && player.benchLockedThrough >= this.round;
  }

  private noteActionCard(player: Player) {
    player.shop = flagCurse(player.shop, ['DMN-01', 'DMN-03', 'DMN-04', 'DMN-05']);
  }

  private actionCardsLocked(player: Player) {
    return player.actionCardsLockedThrough >= this.round || hasDebuff(player.effects, 'cardLock', this.round);
  }

  private demonReward(player: Player, seat: Seat, command: Extract<Command, { type: 'useDemon' }>, at: number) {
    if (this.usedCard || this.placed) return ErrorCode.ActionUsed;
    const card = player.shop.bench[command.slot];
    if (card?.demon?.status !== 'Unlocked') return ErrorCode.DemonUnavailable;
    const opponentSeat = seat === 'X' ? 'O' : 'X';
    if (card.cardId === 'DMN-01') {
      const next = malphasReward(this.game, command.walls ?? [], card.demon.sourceId);
      if (!next) return ErrorCode.InvalidWalls;
      this.game = next;
    } else if (card.cardId === 'DMN-04') {
      const opponent = this.players.find(other => other.seat === opponentSeat);
      if (!opponent || this.forcedTurns.has(opponentSeat) || command.walls !== undefined) return ErrorCode.DemonUnavailable;
      opponent.shop = removeRandomCards(opponent.shop, normalCard, demonRules.belial.destroyCards, this.rng);
      this.forcedTurns.set(opponentSeat, { caster: seat, sourceId: card.demon.sourceId });
    } else return ErrorCode.DemonUnavailable;

    const bench = [...player.shop.bench];
    bench[command.slot] = { ...card, demon: { ...card.demon, status: 'Contracted' } };
    player.shop = { ...player.shop, bench };
    this.noteActionCard(player);
    this.lastCard = { seat, name: cardDefinition(card.cardId).name };
    if (!this.confirmResult()) this.endAction(at);
  }

  private holyCross(player: Player, seat: Seat, cross: NonNullable<Extract<Command, { type: 'useCard' }>['cross']>, sourceId: string) {
    const target = cross.side === 'self' ? player : this.players.find(other => other.seat !== seat);
    if (!target?.seat) throw new Error('Holy Cross target missing');
    const slot = target.shop.bench.findIndex(card => card.cardId === cross.demon && card.demon);
    const demon = target.shop.bench[slot]?.demon;
    if (!demon) {
      if (!player.shop.bench.some(card => card.cardId === cross.demon)
        && lockedDemonCount(player.shop) < gameConstants.demonLocking.maxLocked) {
        player.shop = { ...player.shop, bench: [...player.shop.bench, lockedDemon(cross.demon, sourceId, this.round + 1)] };
      }
      return;
    }
    target.shop = { ...target.shop, bench: target.shop.bench.filter((_, index) => index !== slot) };
    if (cross.side === 'self' || demon.status === 'Locked') return;
    if (cross.demon === 'DMN-01') this.game = removeDarkWalls(this.game, demon.sourceId);
    if (cross.demon === 'DMN-02') this.game = agaresReward(this.game, seat, this.rng);
    if (cross.demon === 'DMN-04') {
      for (const [victim, forced] of this.forcedTurns) {
        if (forced.sourceId === demon.sourceId && forced.caster === target.seat) this.forcedTurns.delete(victim);
      }
      target.shop = removeRandomCards(target.shop, normalCard, demonRules.belial.destroyCards, this.rng);
      if (!this.forcedTurns.has(target.seat)) this.forcedTurns.set(target.seat, { caster: seat, sourceId });
    }
    if (cross.demon === 'DMN-05') player.shop = releaseBlock(player.shop, demon.sourceId);
    // Asmodeus derives its factor from the Contracted card still in the Bench.
    this.checkAbaddonBoard();
  }

  private place(row: number, col: number, at: number, hairActive: boolean) {
    const next = placeTurn(this.game, row, col, true);
    if (next === this.game) return ErrorCode.InvalidCell;
    this.timelyAsmodeusMark = this.actionDeadline !== null
      && at <= this.actionDeadline - timersMs.action + timersMs.asmodeusMoveLimit;
    this.game = next;
    this.checkAbaddonBoard();
    const player = this.players.find(other => other.seat === this.game.turn);
    if (player && !this.timelyAsmodeusMark) player.shop = flagCurse(player.shop, ['DMN-03']);
    if (player && isEdge({ row, col }) && this.updateCurse(player, 'DMN-02', () => true)) {
      this.game = agaresReward(this.game, this.game.turn, this.rng);
      this.checkAbaddonBoard();
    }
    if (next.result) {
      if (player) this.settleAsmodeus(player);
      this.confirmResult();
    } else if (this.confirmResult()) {
      return;
    } else if (hairActive && !this.usedCard) {
      this.placed = true;
    } else {
      this.endAction(at);
    }
  }

  private endAction(at: number) {
    const actor = this.players.find(player => player.seat === this.game.turn);
    if (actor) {
      this.updateCurse(actor, 'DMN-01', card => !card.demon?.failed);
      this.settleAsmodeus(actor);
    }
    if (this.confirmResult()) return;
    this.placed = false;
    this.usedCard = false;
    this.timelyAsmodeusMark = false;
    this.game = { ...this.game, turn: this.game.turn === 'X' ? 'O' : 'X' };
    if (this.game.turn === 'X') {
      this.phase = 'ROUND_END';
      for (const step of roundEndOrder) {
        for (const seat of seats) {
          if (step === 'coin+1') this.coins[seat] += coinsPerRound;
          if (step === 'interest') {
            const player = this.players.find(player => player.seat === seat);
            if (player) {
              const interest = advanceInterest(player.shop, this.round);
              player.shop = interest.shop;
              this.coins[seat] += interest.coins;
            }
          }
          if (step === 'debuff') {
            const player = this.players.find(player => player.seat === seat);
            if (player) this.updateCombatant(player, seat, endDebuffRound(this.combatant(player, seat), this.round));
          }
          if (step === 'demonCheck') {
            const player = this.players.find(player => player.seat === seat);
            if (player) this.checkRoundDemons(player, seat);
            if (this.confirmResult()) return;
          }
          this.roundEndStep?.(step, seat);
          if (step === 'shopRefreshAndReroll') this.refreshSeatShop(seat, this.round + 1);
        }
      }
      this.actionDeadline = null;
      if (this.roundTransitionMs > 0) this.nextRoundAt = at + this.roundTransitionMs;
      else this.beginPreparation(at);
    } else {
      this.openAction(at);
    }
  }

  private settleAsmodeus(player: Player) {
    // A mark-first Hair-Trigger turn qualifies only if the player finishes it without using a card.
    this.updateCurse(player, 'DMN-03', card => this.timelyAsmodeusMark && !card.demon?.failed);
  }

  private refreshSeatShop(seat: Seat, round: number) {
    const player = this.players.find(player => player.seat === seat);
    if (!player) return;
    this.updateCombatant(player, seat, startDebuffRound(this.combatant(player, seat), round, this.rng));
    player.shop = refreshShop(player.shop, round, this.shopRng[seat], this.rarityStar(player, round),
      !hasDebuff(player.effects, 'noSystemReroll', round));
  }

  private combatant(player: Player, seat: Seat) {
    return { shop: player.shop, effects: player.effects, coins: this.coins[seat] };
  }

  private get ultimatumLocked() {
    return this.pendingUltimatum !== null || this.players.some(player =>
      player.effects.debuffs.some(effect => effect.rule === 'ultimatum' && effect.through >= this.round));
  }

  private updateCombatant(player: Player, seat: Seat, value: ReturnType<Room['combatant']>) {
    player.shop = value.shop;
    player.effects = value.effects;
    this.coins[seat] = value.coins;
  }

  private resolveUltimatum(target: Player, seat: Seat, choice: UltimatumChoice, at: number, timedOut = false) {
    const window = this.choiceWindow;
    const pending = this.pendingUltimatum;
    if (!window || !pending || !this.closeChoice(window.id, at)) return;
    this.pendingUltimatum = null;
    const next = applyUltimatum(this.combatant(target, seat), pending.star, choice, this.round, window.id, this.rng);
    this.updateCombatant(target, seat, next);
    if (timedOut) {
      const { star, blocks, coinThreshold, coinPenalty, destroy, lockedRounds } = ultimatumView(pending.star, next.coins);
      const effect = star === 1 ? (choice === 'accept' ? 'Vòng sau không thể mua thẻ.'
        : `Vòng sau khóa tối đa ${blocks} ô Shop và không cấp lượt Reroll miễn phí của hệ thống.`)
        : star === 2 ? (choice === 'accept' ? `Cuối vòng sau trừ ${coinPenalty} xu nếu còn từ ${coinThreshold} xu.`
          : `Đã trừ ${coinPenalty} xu.`)
          : (choice === 'accept' ? `Không thể dùng thẻ trong ${lockedRounds} vòng tiếp theo.`
            : `Đã xử lý phá ngẫu nhiên tối đa ${destroy} thẻ Normal trong kho.`);
      target.ultimatumTimeout = { round: this.round, star, choice, effect };
    } else target.ultimatumTimeout = null;
    if (!pending.keepTurn) this.endAction(at);
  }

  private rarityStar(player: Player, round: number) {
    const effect = player.effects.rarity;
    return effect && timedEffectActive(effect, round) ? effect.star : 0;
  }

  openChoice(seat: Seat, kind: ChoiceWindow['kind'], at: number) {
    if (this.actionDeadline === null || at > this.actionDeadline) throw new Error('No active turn');
    const duration = kind === 'belial' ? timersMs.belial : timersMs.popup;
    const choice = {
      id: this.choiceId(), seat, kind, deadline: at + duration,
      resumeRemainingMs: this.actionDeadline - at,
    };
    this.choiceWindow = choice;
    this.actionDeadline = null;
    this.revision++;
    return { ...choice };
  }

  closeChoice(id: string, at: number) {
    if (this.choiceWindow?.id !== id || at > this.choiceWindow.deadline) return false;
    this.actionDeadline = at + this.choiceWindow.resumeRemainingMs;
    this.choiceWindow = null;
    this.revision++;
    return true;
  }

  snapshot(player: Player): Snapshot {
    const { curseProgress, transactions } = player.privateState;
    const { slots, bench, blocks, hold, freeRerolls } = player.shop;
    const ownAction = this.phase === 'ACTION' && !this.choiceWindow && player.seat === this.game.turn;
    const benchLocked = this.benchLocked(player);
    const canUseCard = ownAction && !this.usedCard && !benchLocked && !this.actionCardsLocked(player);
    const wallsRemaining = player.seat ? remainingWallCapacity(this.game, player.seat) : 0;
    const emptySquares = this.game.board.filter(cell => cell === null).length;
    const preparing = player.seat !== null && this.preparation?.[player.seat].ready === false;
    const canUseMirror = preparing && !benchLocked
      && this.round >= (cardDefinition('SPC-03').minRound ?? 1) && bench.some(isMirrorTarget);
    const hasMakeshiftWall = this.game.board.includes('Makeshift Wall');
    const locked = lockedDemonCount(player.shop);
    const ownWindow = this.choiceWindow && this.choiceWindow.seat === player.seat ? { ...this.choiceWindow } : null;
    return {
      roomCode: this.code,
      phase: this.phase,
      revision: this.revision,
      serverTime: this.now(),
      players: this.players.map(publicPlayer),
      coin: this.coin,
      board: this.game.board,
      round: this.round,
      coins: { ...this.coins },
      preparation: this.preparation && { X: { ...this.preparation.X }, O: { ...this.preparation.O } },
      actionDeadline: this.actionDeadline,
      nextRoundAt: this.nextRoundAt,
      darkWallsAvailable: darkWallsRequired(this.game),
      choiceWindow: ownWindow,
      ultimatumLocked: this.ultimatumLocked,
      ultimatum: ownWindow && this.pendingUltimatum && player.seat
        ? ultimatumView(this.pendingUltimatum.star, this.coins[player.seat]) : null,
      lastCard: this.lastCard,
      turn: this.phase === 'ACTION' ? this.game.turn : null,
      result: this.game.result ?? this.connectionResult,
      you: {
        ...publicPlayer(player),
        canPlace: ownAction && !this.placed,
        canEndTurn: ownAction && (this.placed || this.usedCard),
        canBuy: !benchLocked && !hasDebuff(player.effects, 'buyLock', this.round),
        benchLocked,
        ultimatumTimeout: player.ultimatumTimeout,
        wallsRemaining,
        hairTrigger: player.effects.hair && player.effects.hair.through >= this.round
          ? { from: player.effects.hair.from, through: player.effects.hair.through } : null,
        privateState: {
          shop: slots.map((id, index) => {
            const card = id === null ? null : cardView(id);
            return {
              card, blocked: blocks[index] !== null,
              demonUnavailable: card?.rarity === 'demon'
                && (locked >= gameConstants.demonLocking.maxLocked || bench.some(item => item.cardId === card.id)),
            };
          }),
          bench: bench.map((card, slot) => {
            const { cardId, star, piggy, demon } = card;
            return {
              ...cardView(cardId), star, canDiscard: !benchLocked && canDiscard(cardId),
              mirrorTarget: isMirrorTarget(card),
              canUse: demon ? canUseCard && !this.placed && demon.status === 'Unlocked'
                && (cardId === 'DMN-01' || (cardId === 'DMN-04' && !this.forcedTurns.has(this.game.turn === 'X' ? 'O' : 'X')))
                : cardId === 'SPC-03' ? canUseMirror
                : canUseCard && canUseActionCard(cardId) && (!this.placed || canPairWithMark(cardId))
                && (cardId !== 'DEB-R01' || !this.ultimatumLocked)
                && (cardId !== 'SPC-02' || hasMakeshiftWall)
                && (cardId !== 'BUF-R01' || this.game.board.some((cell, index) =>
                  cell === this.game.turn && newAngleTargets(this.game.board, this.game.turn, star,
                    { row: Math.floor(index / boardSize), col: index % boardSize }).length > 0))
                && (cardId !== 'BUF-E01' || wallsForStar(star) <= Math.min(wallsRemaining, emptySquares)),
              piggy: piggy && { noSpendRounds: piggy.noSpendRounds, totalEarned: piggy.totalEarned },
              demon: demon && { status: demon.status, progress: demon.progress, goal: demonGoal(cardId),
                canCancel: preparing && !benchLocked && canCancelDemon(player.shop, this.coins[player.seat!], slot) },
            };
          }),
          hold, freeRerolls, curseProgress: { ...curseProgress }, transactions: [...transactions],
        },
      },
    };
  }

  execute(player: Player, command: Command, at = this.now()): CommandResult {
    this.advance(at);
    const previous = player.commands.get(command.commandId);
    if (previous) return { ...previous, duplicate: true };
    const error = this.apply(player, command, at);
    if (!error) this.revision++;
    const result = { type: 'commandResult' as const, commandId: command.commandId, revision: this.revision, error };
    player.commands.set(command.commandId, result);
    return result;
  }

  private apply(player: Player, command: Command, at: number): ErrorCode | undefined {
    if (command.expectedPhase !== this.phase) return ErrorCode.WrongPhase;
    if (command.type === 'answerBelial') {
      if (this.choiceWindow?.kind !== 'belial' || this.choiceWindow.seat !== player.seat
        || this.choiceWindow.id !== command.windowId || !this.forcedTurns.has(this.game.turn)) return ErrorCode.StaleChoice;
      return this.forceMark(command.target, at);
    }
    if (command.type === 'answerUltimatum') {
      if (!player.seat || !this.pendingUltimatum || this.choiceWindow?.seat !== player.seat
        || this.choiceWindow.id !== command.windowId) return ErrorCode.StaleChoice;
      if (command.choice === 'resist' && !canResistUltimatum(this.pendingUltimatum.star, this.coins[player.seat])) {
        return ErrorCode.NotEnoughCoins;
      }
      this.resolveUltimatum(player, player.seat, command.choice, at);
      return;
    }
    if ('round' in command) {
      const seat = player.seat;
      if (!this.preparation || !seat || command.round !== this.round) return ErrorCode.WrongPhase;
      if (this.preparation[seat].ready) return ErrorCode.AlreadyReady;
      if (this.benchLocked(player) && command.type !== 'reroll' && command.type !== 'toggleHold') return ErrorCode.BenchLocked;
      if (command.type === 'cancelDemon') {
        const cardId = player.shop.bench[command.slot]?.cardId;
        const result = cancelDemon(player.shop, this.coins[seat], command.slot, this.rng);
        if (!result) return ErrorCode.DemonUnavailable;
        player.shop = result.shop;
        this.coins[seat] = result.coins;
        if (cardId === 'DMN-04') {
          player.reducedPreparation = { from: this.round + 1, through: this.round + gameConstants.belialCancelPrepRounds };
        } else if (cardId === 'DMN-05') {
          player.benchLockedThrough = this.round + 1;
          player.resetCoinsAt = this.round + 1;
        } else if (cardId === 'DMN-03') {
          player.actionCardsLockedThrough = this.round + demonRules.asmodeus.cancelActionRounds - 1;
        }
        return;
      }
      if (command.type === 'mirror') {
        const next = mirrorImage(player.shop, command.slot, command.targetSlot, this.round);
        if (!next) return ErrorCode.InvalidSpecialTarget;
        player.shop = next;
        return;
      }
      if (command.type === 'buy' && hasDebuff(player.effects, 'buyLock', this.round)) return ErrorCode.BuyLocked;
      if (command.type === 'toggleHold') {
        player.shop = { ...player.shop, hold: !player.shop.hold };
        return;
      }
      const coins = this.coins[seat];
      const result = command.type === 'reroll'
        ? reroll(player.shop, coins, this.round, this.shopRng[seat], this.rarityStar(player, this.round))
        : command.type === 'buy' ? buy(player.shop, coins, command.slot, this.round, `${seat}:${command.commandId}`)
          : discard(player.shop, coins, command.slot);
      if ('error' in result) return result.error;
      player.shop = result.shop;
      this.coins[seat] = result.coins;
      if (result.coins < coins && command.type !== 'discard') player.shop = flagCurse(player.shop, ['DMN-05']);
      if (command.type === 'buy') this.checkAbaddonBoard();
      return;
    }
    if (command.type === 'ready') {
      if (!this.preparation || !player.seat) return ErrorCode.WrongPhase;
      if (this.preparation[player.seat].ready) return ErrorCode.AlreadyReady;
      this.markReady(player.seat, at);
      return;
    }
    if (command.type === 'place' || command.type === 'useCard' || command.type === 'endTurn' || command.type === 'useDemon') {
      if (this.phase !== 'ACTION') return ErrorCode.WrongPhase;
      if (this.choiceWindow) return ErrorCode.ChoicePending;
      const seat = player.seat;
      if (seat !== this.game.turn) return ErrorCode.WrongTurn;
      const hairActive = timedEffectActive(player.effects.hair, this.round);
      if (command.type === 'place') {
        if (this.placed) return ErrorCode.ActionUsed;
        return this.place(command.row, command.col, at, hairActive);
      }
      if (command.type === 'endTurn') {
        if (!this.placed && !this.usedCard) return ErrorCode.CannotUseCard;
        this.endAction(at);
        return;
      }
      if (this.usedCard) return ErrorCode.ActionUsed;
      if (this.benchLocked(player)) return ErrorCode.BenchLocked;
      if (this.actionCardsLocked(player)) return ErrorCode.CardLocked;
      if (command.type === 'useDemon') return this.demonReward(player, seat, command, at);
      const card = player.shop.bench[command.slot];
      if (!card) return ErrorCode.EmptySlot;
      if (card.cardId === 'DEB-R01' && this.ultimatumLocked) return ErrorCode.UltimatumActive;
      if (!canUseActionCard(card.cardId) || (this.placed && !canPairWithMark(card.cardId))) return ErrorCode.CannotUseCard;
      const isNewAngle = card.cardId === 'BUF-R01';
      const isMakeshiftWall = card.cardId === 'BUF-E01';
      const isPowderKeg = card.cardId === 'SPC-02';
      const isHolyCross = card.cardId === 'SPC-01';
      if (isNewAngle !== Boolean(command.move)) return ErrorCode.InvalidMove;
      if (isMakeshiftWall !== Boolean(command.walls)) return ErrorCode.InvalidWalls;
      if (isPowderKeg !== Boolean(command.blast)) return ErrorCode.InvalidSpecialTarget;
      if (isHolyCross !== Boolean(command.cross)) return ErrorCode.InvalidSpecialTarget;
      if (command.cross?.side === 'self' && !player.shop.bench.some(item => item.cardId === command.cross?.demon
        && (item.demon?.status === 'Locked' || item.demon?.status === 'Unlocked'))) return ErrorCode.InvalidSpecialTarget;
      const moved = command.move && moveWithNewAngle(this.game, card.star, command.move.from, command.move.to);
      if (isNewAngle && !moved) return ErrorCode.InvalidMove;
      const built = command.walls && placeMakeshiftWalls(this.game, card.star, command.walls);
      if (isMakeshiftWall && !built) return ErrorCode.InvalidWalls;
      const blasted = command.blast && blastMakeshiftWall(this.game, command.blast);
      if (isPowderKeg && !blasted) return ErrorCode.InvalidSpecialTarget;
      const boardAction = moved || built || blasted;
      const definition = cardDefinition(card.cardId);
      const keepTurn = !this.placed && (isMakeshiftWall || (hairActive && canPairWithMark(card.cardId)));
      player.shop = { ...player.shop, bench: player.shop.bench.filter((_, index) => index !== command.slot) };
      this.noteActionCard(player);
      this.lastCard = { seat, name: definition.name };
      if (command.cross) {
        this.holyCross(player, seat, command.cross, `${seat}:${command.commandId}`);
      } else if (boardAction) {
        this.game = boardAction;
        this.checkAbaddonBoard();
        if (boardAction.result) {
          this.confirmResult();
          return;
        }
      } else if (definition.group === 'debuff') {
        const otherSeat = seat === 'X' ? 'O' : 'X';
        const opponent = this.players.find(other => other.seat === otherSeat);
        if (!opponent) throw new Error('Opponent missing');
        if (!opponent.effects.angelImmune && card.cardId === 'DEB-R01') {
          this.openChoice(otherSeat, 'ultimatum', at);
          this.pendingUltimatum = { star: card.star, keepTurn };
          this.usedCard = true;
          return;
        }
        if (card.cardId !== 'DEB-R01') {
          const result = applyDebuff(card, this.combatant(player, seat), this.combatant(opponent, otherSeat),
            this.round, command.commandId, this.rng);
          this.updateCombatant(player, seat, result.attacker);
          this.updateCombatant(opponent, otherSeat, result.target);
        }
      } else {
        const effect = activateNormal(card, player.shop, player.effects, this.round, this.rng);
        this.updateCombatant(player, seat, { ...effect, coins: this.coins[seat] + effect.coins });
      }
      if (keepTurn) this.usedCard = true;
      else this.endAction(at);
      return;
    }

    if (this.phase !== 'LOBBY') return ErrorCode.WrongPhase;
    if (command.type === 'chooseFace') {
      if (this.coin) return ErrorCode.CoinAlreadyTossed;
      if (this.players.some(other => other !== player && other.face === command.face)) return ErrorCode.FaceTaken;
      player.face = command.face;
      return;
    }

    if (!player.host) return ErrorCode.NotHost;
    if (command.type === 'toss') {
      if (this.coin) return ErrorCode.CoinAlreadyTossed;
      if (this.players.length !== 2 || !this.players.every(other => other.face && other.online)) {
        return ErrorCode.FacesRequired;
      }
      this.coin = this.tossCoin();
      for (const other of this.players) other.seat = other.face === this.coin ? 'X' : 'O';
      return;
    }
    if (!this.coin || !this.players.every(other => other.online)) return ErrorCode.CoinRequired;
    for (const seat of seats) this.refreshSeatShop(seat, this.round + 1);
    this.beginPreparation(at);
  }
}
