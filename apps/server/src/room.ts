import { randomBytes, randomInt } from 'node:crypto';
import { createGame, placeTurn } from '@carocard/game-engine';
import { ErrorCode } from '@carocard/shared';
import type { Command, CommandResult, Face, Phase, PrivateState, Seat, Snapshot } from '@carocard/shared';

export interface Player {
  token: string;
  host: boolean;
  online: boolean;
  face: Face | null;
  seat: Seat | null;
  privateState: PrivateState;
  commands: Map<string, CommandResult>;
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

  readonly code: string;
  private readonly tossCoin: () => Face;

  constructor(code: string, tossCoin: () => Face = () => randomInt(2) === 0 ? 'heads' : 'tails') {
    this.code = code;
    this.tossCoin = tossCoin;
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
    };
    this.players.push(player);
    this.revision++;
    return player;
  }

  setOnline(player: Player, online: boolean) {
    if (player.online === online) return;
    player.online = online;
    this.revision++;
  }

  snapshot(player: Player): Snapshot {
    const { shop, bench, curseProgress, transactions } = player.privateState;
    return {
      roomCode: this.code,
      phase: this.phase,
      revision: this.revision,
      serverTime: performance.now(),
      players: this.players.map(publicPlayer),
      coin: this.coin,
      board: this.game.board,
      turn: this.phase === 'ACTION' ? this.game.turn : null,
      result: this.game.result,
      you: {
        ...publicPlayer(player),
        privateState: { shop: [...shop], bench: [...bench], curseProgress: { ...curseProgress }, transactions: [...transactions] },
      },
    };
  }

  execute(player: Player, command: Command): CommandResult {
    const previous = player.commands.get(command.commandId);
    if (previous) return { ...previous, duplicate: true };
    const error = this.apply(player, command);
    if (!error) this.revision++;
    const result = { type: 'commandResult' as const, commandId: command.commandId, revision: this.revision, error };
    player.commands.set(command.commandId, result);
    return result;
  }

  private apply(player: Player, command: Command): ErrorCode | undefined {
    if (command.expectedPhase !== this.phase) return ErrorCode.WrongPhase;
    if (command.type === 'place') {
      if (this.phase !== 'ACTION') return ErrorCode.WrongPhase;
      if (player.seat !== this.game.turn) return ErrorCode.WrongTurn;
      const next = placeTurn(this.game, command.row, command.col);
      if (next === this.game) return ErrorCode.InvalidCell;
      this.game = next;
      if (next.result) this.phase = 'FINISHED';
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
    this.phase = 'ACTION';
  }
}
