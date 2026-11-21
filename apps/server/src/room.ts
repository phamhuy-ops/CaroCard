import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { boardSize, createGame, placeTurn } from '@carocard/game-engine';
import { createRng } from '@carocard/game-engine/rng';
import type { Rng } from '@carocard/game-engine/rng';
import { ErrorCode, gameConstants } from '@carocard/shared';
import type { ChoiceWindow, Command, CommandResult, Face, Phase, Preparation, PrivateState, Seat, Snapshot } from '@carocard/shared';

const { timersMs, roundEndOrder, startCoins, coinsPerRound } = gameConstants;
const seats: readonly Seat[] = ['X', 'O'];

interface RoomOptions {
  now?: () => number;
  rng?: Rng;
  prepDuration?: (seat: Seat) => number;
  roundEndStep?: (step: string, seat: Seat) => void;
}

export interface Player {
  token: string;
  host: boolean;
  online: boolean;
  face: Face | null;
  seat: Seat | null;
  privateState: PrivateState;
  commands: Map<string, CommandResult>;
  holdUntil: number | null;
  expired: boolean;
}

function publicPlayer({ host, online, face, seat }: Player) {
  return { host, online, face, seat };
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
  private choiceWindow: ChoiceWindow | null = null;
  private round = 0;
  private coins = { ...startCoins };
  private connectionResult: Snapshot['result'] = null;

  readonly code: string;
  private readonly tossCoin: () => Face;
  private readonly now: () => number;
  private readonly rng: Rng;
  private readonly prepDuration: (seat: Seat) => number;
  private readonly roundEndStep?: RoomOptions['roundEndStep'];

  constructor(code: string, tossCoin: () => Face = () => randomInt(2) === 0 ? 'heads' : 'tails', options: RoomOptions = {}) {
    this.code = code;
    this.tossCoin = tossCoin;
    this.now = options.now ?? (() => performance.now());
    this.rng = options.rng ?? createRng(randomBytes(4).readUInt32LE());
    this.prepDuration = options.prepDuration ?? (() => timersMs.prep);
    this.roundEndStep = options.roundEndStep;
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
      privateState: { shop: [], bench: [], curseProgress: {}, transactions: [] },
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
    let next = this.actionDeadline ?? this.choiceWindow?.deadline ?? Infinity;
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
      if (this.preparation) {
        for (const seat of seats) {
          if (this.preparation?.[seat].deadline === deadline && !this.preparation[seat].ready) {
            this.markReady(seat, deadline);
            this.revision++;
          }
        }
      } else if (this.choiceWindow?.deadline === deadline) {
        this.closeChoice(this.choiceWindow.id, deadline);
      } else if (this.actionDeadline === deadline) {
        const free = this.game.board.flatMap((cell, index) => cell === null ? [index] : []);
        const index = free[Math.floor(this.rng.next() * free.length)];
        this.place(Math.floor(index / boardSize), index % boardSize, deadline);
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
    this.choiceWindow = null;
  }

  private beginPreparation(at: number) {
    this.round++;
    this.phase = 'PREPARATION';
    this.actionDeadline = null;
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

  private place(row: number, col: number, at: number) {
    const next = placeTurn(this.game, row, col);
    if (next === this.game) return ErrorCode.InvalidCell;
    this.game = next;
    if (next.result) {
      this.finish();
    } else if (next.turn === 'X') {
      this.phase = 'ROUND_END';
      for (const step of roundEndOrder) {
        for (const seat of seats) {
          if (step === 'coin+1') this.coins[seat] += coinsPerRound;
          this.roundEndStep?.(step, seat);
        }
      }
      this.beginPreparation(at);
    } else {
      this.actionDeadline = at + timersMs.action;
    }
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
    const { shop, bench, curseProgress, transactions } = player.privateState;
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
      choiceWindow: this.choiceWindow && this.choiceWindow.seat === player.seat ? { ...this.choiceWindow } : null,
      turn: this.phase === 'ACTION' ? this.game.turn : null,
      result: this.game.result ?? this.connectionResult,
      you: {
        ...publicPlayer(player),
        privateState: { shop: [...shop], bench: [...bench], curseProgress: { ...curseProgress }, transactions: [...transactions] },
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
    if (command.type === 'ready') {
      if (!this.preparation || !player.seat) return ErrorCode.WrongPhase;
      if (this.preparation[player.seat].ready) return ErrorCode.AlreadyReady;
      this.markReady(player.seat, at);
      return;
    }
    if (command.type === 'place') {
      if (this.phase !== 'ACTION') return ErrorCode.WrongPhase;
      if (this.choiceWindow) return ErrorCode.ChoicePending;
      if (player.seat !== this.game.turn) return ErrorCode.WrongTurn;
      return this.place(command.row, command.col, at);
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
    this.beginPreparation(at);
  }
}
