import { expect, test } from 'vitest';
import { Room } from './room.ts';
import { gameConstants } from '@carocard/shared';

const { prep, action, minPrep, seatHold, popup } = gameConstants.timersMs;

function startedRoom(roundTransitionMs = 0) {
  const steps: string[] = [];
  const room = new Room('CLOCK', () => 'heads', {
    rng: { next: () => 0 },
    prepDuration: seat => seat === 'X' ? 1 : prep,
    roundEndStep: (step, seat) => steps.push(`${step}:${seat}`),
    now: () => 0,
    roundTransitionMs,
  });
  const x = room.join();
  const o = room.join();
  room.execute(x, { type: 'chooseFace', expectedPhase: 'LOBBY', commandId: 'x-face', face: 'heads' }, 0);
  room.execute(o, { type: 'chooseFace', expectedPhase: 'LOBBY', commandId: 'o-face', face: 'tails' }, 0);
  room.execute(x, { type: 'toss', expectedPhase: 'LOBBY', commandId: 'toss' }, 0);
  room.execute(x, { type: 'start', expectedPhase: 'LOBBY', commandId: 'start' }, 0);
  return { room, x, o, steps };
}

function actionRoom(roundTransitionMs = 0) {
  const context = startedRoom(roundTransitionMs);
  for (const player of [context.x, context.o]) {
    context.room.execute(player, { type: 'ready', expectedPhase: 'PREPARATION', commandId: 'ready' }, 0);
  }
  return context;
}

test('round results apply once and both seats enter the next preparation after three seconds', () => {
  const { room, x, o, steps } = actionRoom(3000);
  const move = { type: 'place', expectedPhase: 'ACTION', commandId: 'move', row: 0, col: 0 } as const;
  room.execute(x, move, 10);
  room.execute(o, { ...move, row: 1 }, 20);
  expect(room.snapshot(x)).toMatchObject({ phase: 'ROUND_END', round: 1, nextRoundAt: 3020, coins: { X: 4, O: 5 } });
  expect(room.snapshot(o).nextRoundAt).toBe(3020);
  room.advance(3019);
  expect(room.snapshot(x).preparation).toBeNull();
  room.advance(3021);
  expect(room.snapshot(x)).toMatchObject({ phase: 'PREPARATION', round: 2, nextRoundAt: null,
    preparation: { X: { deadline: 3020 + minPrep }, O: { deadline: 3020 + prep } } });
  expect(steps).toHaveLength(gameConstants.roundEndOrder.length * 2);
});

test('preparation has separate deadlines, a minimum duration and early readiness', () => {
  const { room, x, o } = startedRoom();
  expect(room.snapshot(x).preparation).toMatchObject({
    X: { deadline: minPrep, ready: false }, O: { deadline: prep, ready: false },
  });
  room.advance(minPrep + 1);
  expect(room.snapshot(x).preparation?.X.ready).toBe(true);
  room.execute(o, { type: 'ready', expectedPhase: 'PREPARATION', commandId: 'ready' }, minPrep + 1);
  expect(room.snapshot(x)).toMatchObject({ phase: 'ACTION', turn: 'X', actionDeadline: minPrep + 1 + action });
});

test('deadline is inclusive, stale timeout is inert and each round ends in spec order', () => {
  const { room, x, o, steps } = actionRoom();
  const move = { type: 'place', expectedPhase: 'ACTION', commandId: 'move', row: 0, col: 1 } as const;
  expect(room.execute(x, move, action).error).toBeUndefined();
  room.advance(action + 1);
  expect(room.snapshot(x)).toMatchObject({ turn: 'O', actionDeadline: 2 * action });
  expect(room.execute(o, { ...move, row: 1 }, 2 * action).error).toBeUndefined();
  expect(room.execute(o, { ...move, row: 1 }, 2 * action + 1).duplicate).toBe(true);
  expect(room.snapshot(o)).toMatchObject({ phase: 'PREPARATION', round: 2, coins: { X: 4, O: 5 } });
  expect(steps).toEqual(gameConstants.roundEndOrder.flatMap(step => [`${step}:X`, `${step}:O`]));
});

test('a late move is refused and timeout places a seeded mark even while disconnected', () => {
  const { room, x } = actionRoom();
  room.setOnline(x, false, 1);
  const move = { type: 'place', expectedPhase: 'ACTION', commandId: 'late', row: 0, col: 1 } as const;
  expect(room.execute(x, move, action + 1).error).toBe('WRONG_TURN');
  expect(room.reconnect(x, action + 2)).toBe(true);
  expect(room.snapshot(x)).toMatchObject({ turn: 'O', actionDeadline: 2 * action, you: { seat: 'X', online: true } });
  expect(room.snapshot(x).board.slice(0, 2)).toEqual(['X', null]);
});

test('choice window is private, runs while offline and resumes the saved action time', () => {
  const { room, x, o } = actionRoom();
  const window = room.openChoice('O', 'ultimatum', 500);
  expect(room.snapshot(x).choiceWindow).toBeNull();
  expect(room.snapshot(o).choiceWindow).toEqual(window);
  expect(room.snapshot(x).actionDeadline).toBeNull();
  room.setOnline(o, false, 600);
  expect(room.reconnect(o, 700)).toBe(true);
  expect(room.snapshot(o).choiceWindow?.deadline).toBe(500 + popup);
  room.advance(500 + popup + 1);
  expect(room.snapshot(x).actionDeadline).toBe(action + popup);
});

test('an online opponent wins when the other seat expires', () => {
  const { room, x, o } = actionRoom();
  room.setOnline(x, false, 10);
  room.advance(11 + seatHold);
  expect(room.snapshot(o).result).toEqual({ kind: 'win', winner: 'O', reason: 'disconnect' });
  expect(room.reconnect(x, 11 + seatHold)).toBe(false);
});

test('with both offline the remaining seat can return, or the match is cancelled', () => {
  const first = actionRoom();
  first.room.setOnline(first.x, false, 10);
  first.room.setOnline(first.o, false, 20);
  first.room.advance(11 + seatHold);
  expect(first.room.snapshot(first.o).result).toBeNull();
  expect(first.room.reconnect(first.o, 20 + seatHold)).toBe(true);
  expect(first.room.snapshot(first.o).result).toMatchObject({ kind: 'win', winner: 'O', reason: 'disconnect' });

  const second = actionRoom();
  second.room.setOnline(second.x, false, 10);
  second.room.setOnline(second.o, false, 10);
  second.room.advance(11 + seatHold);
  expect(second.room.snapshot(second.o).result).toEqual({ kind: 'cancelled' });
});
