import { z } from 'zod';
import constants from '../../../spec/data/constants.json' with { type: 'json' };
import timers from '../data/timers.json' with { type: 'json' };

export const gameConstants = { ...constants, timersMs: { ...constants.timersMs, ...timers } };

const phase = z.enum(['LOBBY', 'PREPARATION', 'ACTION', 'ROUND_END', 'FINISHED']);
const face = z.enum(['heads', 'tails']);
const roomCode = z.string().regex(/^[A-F0-9]{8}$/);
const commandFields = {
  commandId: z.uuid(),
  expectedPhase: phase,
};

const squareSchema = z.strictObject({ row: z.int().nonnegative(), col: z.int().nonnegative() });

export const commandSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...commandFields, type: z.literal('chooseFace'), face }),
  z.strictObject({ ...commandFields, type: z.literal('toss') }),
  z.strictObject({ ...commandFields, type: z.literal('start') }),
  z.strictObject({ ...commandFields, type: z.literal('ready') }),
  z.strictObject({
    ...commandFields, type: z.literal('useCard'), slot: z.int().nonnegative(),
    move: z.strictObject({ from: squareSchema, to: squareSchema }).optional(),
    walls: z.array(squareSchema).optional(),
    blast: squareSchema.optional(),
  }),
  z.strictObject({
    ...commandFields, type: z.literal('mirror'), round: z.int().positive(), slot: z.int().nonnegative(),
    targetSlot: z.int().nonnegative(),
  }),
  z.strictObject({ ...commandFields, type: z.literal('endTurn') }),
  z.strictObject({ ...commandFields, type: z.literal('cancelDemon'), round: z.int().positive(), slot: z.int().nonnegative() }),
  z.strictObject({ ...commandFields, type: z.literal('useDemon'), slot: z.int().nonnegative(), walls: z.array(squareSchema).optional() }),
  z.strictObject({ ...commandFields, type: z.literal('answerBelial'), windowId: z.uuid(), target: squareSchema }),
  z.strictObject({ ...commandFields, type: z.literal('answerUltimatum'), windowId: z.uuid(), choice: z.enum(['accept', 'resist']) }),
  z.strictObject({ ...commandFields, type: z.literal('toggleHold'), round: z.int().positive() }),
  z.strictObject({ ...commandFields, type: z.literal('reroll'), round: z.int().positive() }),
  z.strictObject({ ...commandFields, type: z.literal('buy'), round: z.int().positive(), slot: z.int().nonnegative() }),
  z.strictObject({ ...commandFields, type: z.literal('discard'), round: z.int().positive(), slot: z.int().nonnegative() }),
  z.strictObject({
    ...commandFields, type: z.literal('place'), row: z.int().nonnegative(), col: z.int().nonnegative(),
  }),
]);

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('create') }),
  z.strictObject({ type: z.literal('join'), roomCode }),
  z.strictObject({ type: z.literal('resume'), roomCode, token: z.string().regex(/^[a-f0-9]{64}$/) }),
  z.strictObject({ type: z.literal('command'), command: commandSchema }),
]);

export type Phase = z.infer<typeof phase>;
export type Face = z.infer<typeof face>;
export type Command = z.infer<typeof commandSchema>;
export type ClientMessage = z.infer<typeof clientMessageSchema>;
export type ClientAction = Command extends infer C
  ? C extends Command ? Omit<C, 'commandId' | 'expectedPhase'> : never
  : never;
export type Seat = 'X' | 'O';

export const ErrorCode = {
  InvalidMessage: 'INVALID_MESSAGE',
  AlreadyJoined: 'ALREADY_JOINED',
  RoomNotFound: 'ROOM_NOT_FOUND',
  RoomFull: 'ROOM_FULL',
  InvalidSession: 'INVALID_SESSION',
  WrongPhase: 'WRONG_PHASE',
  NotHost: 'NOT_HOST',
  FaceTaken: 'FACE_TAKEN',
  CoinAlreadyTossed: 'COIN_ALREADY_TOSSED',
  FacesRequired: 'FACES_REQUIRED',
  CoinRequired: 'COIN_REQUIRED',
  WrongTurn: 'WRONG_TURN',
  InvalidCell: 'INVALID_CELL',
  AlreadyReady: 'ALREADY_READY',
  ChoicePending: 'CHOICE_PENDING',
  ShopHeld: 'SHOP_HELD',
  NotEnoughCoins: 'NOT_ENOUGH_COINS',
  SlotBlocked: 'SLOT_BLOCKED',
  EmptySlot: 'EMPTY_SLOT',
  BenchFull: 'BENCH_FULL',
  CardAlreadyOwned: 'CARD_ALREADY_OWNED',
  DemonLimit: 'DEMON_LIMIT',
  CannotDiscard: 'CANNOT_DISCARD',
  CannotUseCard: 'CANNOT_USE_CARD',
  ActionUsed: 'ACTION_USED',
  StaleChoice: 'STALE_CHOICE',
  BuyLocked: 'BUY_LOCKED',
  CardLocked: 'CARD_LOCKED',
  UltimatumActive: 'ULTIMATUM_ACTIVE',
  InvalidMove: 'INVALID_MOVE',
  InvalidWalls: 'INVALID_WALLS',
  InvalidSpecialTarget: 'INVALID_SPECIAL_TARGET',
  DemonUnavailable: 'DEMON_UNAVAILABLE',
  BenchLocked: 'BENCH_LOCKED',
} as const;

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];

export interface CardView {
  id: string;
  name: string;
  rarity: string;
  cost: number;
}

export interface PrivateState {
  shop: { card: CardView | null; blocked: boolean; demonUnavailable: boolean }[];
  bench: (CardView & {
    star: number;
    canDiscard: boolean;
    canUse: boolean;
    mirrorTarget: boolean;
    piggy?: { noSpendRounds: number; totalEarned: number };
    demon?: { status: 'Locked' | 'Unlocked' | 'Contracted'; progress: number; goal: number; canCancel: boolean };
  })[];
  hold: boolean;
  freeRerolls: number;
  curseProgress: Record<string, number>;
  transactions: string[];
}

interface PublicPlayer {
  host: boolean;
  online: boolean;
  face: Face | null;
  seat: Seat | null;
}

export interface Preparation {
  deadline: number;
  ready: boolean;
}

export interface ChoiceWindow {
  id: string;
  seat: Seat;
  kind: 'ultimatum' | 'belial';
  deadline: number;
  resumeRemainingMs: number;
}

export interface Snapshot {
  roomCode: string;
  phase: Phase;
  revision: number;
  serverTime: number;
  players: PublicPlayer[];
  coin: Face | null;
  board: readonly (Seat | 'Dark Wall' | 'Makeshift Wall' | null)[];
  round: number;
  coins: Record<Seat, number>;
  preparation: Record<Seat, Preparation> | null;
  actionDeadline: number | null;
  nextRoundAt: number | null;
  darkWallsAvailable: number;
  choiceWindow: ChoiceWindow | null;
  ultimatumLocked: boolean;
  ultimatum: {
    star: number; canResist: boolean; blocks: number; coinThreshold: number;
    coinPenalty: number; destroy: number; lockedRounds: number;
  } | null;
  lastCard: { seat: Seat; name: string } | null;
  turn: Seat | null;
  result: { kind: 'win'; winner: Seat; reason: 'hellsDealer' | 'fiveInRow' | 'disconnect' }
    | { kind: 'draw' | 'cancelled' } | null;
  you: PublicPlayer & {
    privateState: PrivateState; canPlace: boolean; canEndTurn: boolean; canBuy: boolean; wallsRemaining: number;
    hairTrigger: { from: number; through: number } | null;
    benchLocked: boolean;
  };
}

export interface CommandResult {
  type: 'commandResult';
  commandId: string;
  revision: number;
  error?: ErrorCode;
  duplicate?: true;
}

export type ServerMessage =
  | { type: 'session'; roomCode: string; token: string }
  | { type: 'snapshot'; snapshot: Snapshot }
  | { type: 'error'; error: ErrorCode }
  | CommandResult;
