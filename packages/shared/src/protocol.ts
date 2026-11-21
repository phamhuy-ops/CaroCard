import { z } from 'zod';

const phase = z.enum(['LOBBY', 'PREPARATION', 'ACTION', 'ROUND_END', 'FINISHED']);
const face = z.enum(['heads', 'tails']);
const roomCode = z.string().regex(/^[A-F0-9]{8}$/);
const commandFields = {
  commandId: z.uuid(),
  expectedPhase: phase,
};

export const commandSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...commandFields, type: z.literal('chooseFace'), face }),
  z.strictObject({ ...commandFields, type: z.literal('toss') }),
  z.strictObject({ ...commandFields, type: z.literal('start') }),
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
} as const;

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];

export interface PrivateState {
  shop: string[];
  bench: string[];
  curseProgress: Record<string, number>;
  transactions: string[];
}

interface PublicPlayer {
  host: boolean;
  online: boolean;
  face: Face | null;
  seat: Seat | null;
}

export interface Snapshot {
  roomCode: string;
  phase: Phase;
  revision: number;
  serverTime: number;
  players: PublicPlayer[];
  coin: Face | null;
  board: readonly (Seat | 'Dark Wall' | 'Makeshift Wall' | null)[];
  turn: Seat | null;
  result: { kind: 'win'; winner: Seat; reason: 'hellsDealer' | 'fiveInRow' } | { kind: 'draw' } | null;
  you: PublicPlayer & { privateState: PrivateState };
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
