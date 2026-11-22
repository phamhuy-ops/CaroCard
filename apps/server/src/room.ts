import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { boardSize, createGame, moveWithNewAngle, newAngleTargets, placeMakeshiftWalls, placeTurn,
  remainingWallCapacity, wallsForStar } from '@carocard/game-engine';
import { createRng } from '@carocard/game-engine/rng';
import type { Rng } from '@carocard/game-engine/rng';
import { advanceInterest, buy, canDiscard, cardDefinition, createShop, discard, refreshShop, reroll } from '@carocard/game-engine/shop';
import type { Shop } from '@carocard/game-engine/shop';
import { activateNormal, canPairWithMark, canUseNormal, createNormalEffects, timedEffectActive } from '@carocard/game-engine/normal';
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
  private round = 0;
  private coins = { ...startCoins };
  private connectionResult: Snapshot['result'] = null;
  private placed = false;
  private usedCard = false;
  private lastCard: Snapshot['lastCard'] = null;

  readonly code: string;
  private readonly tossCoin: () => Face;
  private readonly now: () => number;
  private readonly rng: Rng;
  private readonly shopRng: Record<Seat, Rng>;
  private readonly prepDuration: (seat: Seat) => number;
  private readonly roundEndStep?: RoomOptions['roundEndStep'];
  private readonly roundTransitionMs: number;

  constructor(code: string, tossCoin: () => Face = () => randomInt(2) === 0 ? 'heads' : 'tails', options: RoomOptions = {}) {
    this.code = code;
    this.tossCoin = tossCoin;
    this.now = options.now ?? (() => performance.now());
    this.rng = options.rng ?? createRng(randomBytes(4).readUInt32LE());
    this.shopRng = { X: createRng(randomBytes(4).readUInt32LE()), O: createRng(randomBytes(4).readUInt32LE()) };
    this.prepDuration = options.prepDuration ?? (() => timersMs.prep);
    this.roundEndStep = options.roundEndStep;
    this.roundTransitionMs = options.roundTransitionMs ?? 3000;
  }

  enqueue(work: () => void) {
    const operation = this.queue.then(work);
    this.queue = operation.catch(() => {});
    return operation;
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
          this.resolveUltimatum(target, target.seat, choice, deadline);
        } else this.closeChoice(this.choiceWindow.id, deadline);
      } else if (this.actionDeadline === deadline) {
        if (this.placed || this.usedCard) {
          this.endAction(deadline);
        } else {
          const free = this.game.board.flatMap((cell, index) => cell === null ? [index] : []);
          const index = free[Math.floor(this.rng.next() * free.length)];
          this.place(Math.floor(index / boardSize), index % boardSize, deadline, false);
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

  private beginPreparation(at: number) {
    this.round++;
    this.phase = 'PREPARATION';
    this.actionDeadline = null;
    this.nextRoundAt = null;
    this.preparation = {
      X: { deadline: at + Math.max(timersMs.minPrep, this.prepDuration('X')), ready: false },
      O: { deadline: at + Math.max(timersMs.minPrep, this.prepDuration('O')), ready: false },
    };
  }

  private markReady(seat: Seat, at: number) {
    if (!this.preparation) return;
    this.preparation[seat].ready = true;
    if (!this.preparation.X.ready || !this.preparation.O.ready) return;
    this.preparation = null;
    this.phase = 'ACTION';
    this.actionDeadline = at + timersMs.action;
  }

  private place(row: number, col: number, at: number, hairActive: boolean) {
    const next = placeTurn(this.game, row, col, true);
    if (next === this.game) return ErrorCode.InvalidCell;
    this.game = next;
    if (next.result) {
      this.finish();
    } else if (hairActive && !this.usedCard) {
      this.placed = true;
    } else {
      this.endAction(at);
    }
  }

  private endAction(at: number) {
    this.placed = false;
    this.usedCard = false;
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
          this.roundEndStep?.(step, seat);
          if (step === 'shopRefreshAndReroll') this.refreshSeatShop(seat, this.round + 1);
        }
      }
      this.actionDeadline = null;
      if (this.roundTransitionMs > 0) this.nextRoundAt = at + this.roundTransitionMs;
      else this.beginPreparation(at);
    } else {
      this.actionDeadline = at + timersMs.action;
    }
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

  private resolveUltimatum(target: Player, seat: Seat, choice: UltimatumChoice, at: number) {
    const window = this.choiceWindow;
    const pending = this.pendingUltimatum;
    if (!window || !pending || !this.closeChoice(window.id, at)) return;
    this.pendingUltimatum = null;
    const next = applyUltimatum(this.combatant(target, seat), pending.star, choice, this.round, window.id, this.rng);
    this.updateCombatant(target, seat, next);
    if (!pending.keepTurn) this.endAction(at);
  }

  private rarityStar(player: Player, round: number) {
    const effect = player.effects.rarity;
    return effect && timedEffectActive(effect, round) ? effect.star : 0;
  }

  openChoice(seat: Seat, kind: ChoiceWindow['kind'], at: number) {
    if (this.actionDeadline === null || at > this.actionDeadline) throw new Error('No active turn');
    const duration = kind === 'belial' ? timersMs.action : timersMs.popup;
    const choice = {
      id: randomUUID(), seat, kind, deadline: at + duration,
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
    const canUseCard = ownAction && !this.usedCard && !hasDebuff(player.effects, 'cardLock', this.round);
    const wallsRemaining = player.seat ? remainingWallCapacity(this.game, player.seat) : 0;
    const emptySquares = this.game.board.filter(cell => cell === null).length;
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
        canBuy: !hasDebuff(player.effects, 'buyLock', this.round),
        wallsRemaining,
        hairTrigger: player.effects.hair && player.effects.hair.through >= this.round
          ? { from: player.effects.hair.from, through: player.effects.hair.through } : null,
        privateState: {
          shop: slots.map((id, index) => ({ card: id === null ? null : cardView(id), blocked: blocks[index] !== null })),
          bench: bench.map(({ cardId, star, piggy }) => ({
            ...cardView(cardId), star, canDiscard: canDiscard(cardId),
            canUse: canUseCard && canUseNormal(cardId) && (!this.placed || canPairWithMark(cardId))
              && (cardId !== 'DEB-R01' || !this.ultimatumLocked)
              && (cardId !== 'BUF-R01' || this.game.board.some((cell, index) =>
                cell === this.game.turn && newAngleTargets(this.game.board, this.game.turn, star,
                  { row: Math.floor(index / boardSize), col: index % boardSize }).length > 0))
              && (cardId !== 'BUF-E01' || wallsForStar(star) <= Math.min(wallsRemaining, emptySquares)),
            piggy: piggy && { noSpendRounds: piggy.noSpendRounds, totalEarned: piggy.totalEarned },
          })),
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
      if (command.type === 'buy' && hasDebuff(player.effects, 'buyLock', this.round)) return ErrorCode.BuyLocked;
      if (command.type === 'toggleHold') {
        player.shop = { ...player.shop, hold: !player.shop.hold };
        return;
      }
      const coins = this.coins[seat];
      const result = command.type === 'reroll'
        ? reroll(player.shop, coins, this.round, this.shopRng[seat], this.rarityStar(player, this.round))
        : command.type === 'buy' ? buy(player.shop, coins, command.slot, this.round)
          : discard(player.shop, coins, command.slot);
      if ('error' in result) return result.error;
      player.shop = result.shop;
      this.coins[seat] = result.coins;
      return;
    }
    if (command.type === 'ready') {
      if (!this.preparation || !player.seat) return ErrorCode.WrongPhase;
      if (this.preparation[player.seat].ready) return ErrorCode.AlreadyReady;
      this.markReady(player.seat, at);
      return;
    }
    if (command.type === 'place' || command.type === 'useCard' || command.type === 'endTurn') {
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
      if (hasDebuff(player.effects, 'cardLock', this.round)) return ErrorCode.CardLocked;
      const card = player.shop.bench[command.slot];
      if (!card) return ErrorCode.EmptySlot;
      if (card.cardId === 'DEB-R01' && this.ultimatumLocked) return ErrorCode.UltimatumActive;
      if (!canUseNormal(card.cardId) || (this.placed && !canPairWithMark(card.cardId))) return ErrorCode.CannotUseCard;
      const isNewAngle = card.cardId === 'BUF-R01';
      const isMakeshiftWall = card.cardId === 'BUF-E01';
      if (isNewAngle !== Boolean(command.move)) return ErrorCode.InvalidMove;
      if (isMakeshiftWall !== Boolean(command.walls)) return ErrorCode.InvalidWalls;
      const moved = command.move && moveWithNewAngle(this.game, card.star, command.move.from, command.move.to);
      if (isNewAngle && !moved) return ErrorCode.InvalidMove;
      const built = command.walls && placeMakeshiftWalls(this.game, card.star, command.walls);
      if (isMakeshiftWall && !built) return ErrorCode.InvalidWalls;
      const boardAction = moved || built;
      const definition = cardDefinition(card.cardId);
      const keepTurn = !this.placed && (isMakeshiftWall || (hairActive && canPairWithMark(card.cardId)));
      player.shop = { ...player.shop, bench: player.shop.bench.filter((_, index) => index !== command.slot) };
      this.lastCard = { seat, name: definition.name };
      if (boardAction) {
        this.game = boardAction;
        if (boardAction.result) {
          this.finish();
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
