import { expect, test } from 'vitest';
import { gameConstants } from '@carocard/shared';
import type { ClientAction, Command, Phase } from '@carocard/shared';
import { Room } from './room.ts';
import type { Player } from './room.ts';

function setup() {
  const room = new Room('NORMAL', () => 'heads', { now: () => 0, rng: { next: () => 0 } });
  const x = room.join();
  const o = room.join();
  let id = 0;
  const send = (player: Player, action: ClientAction, phase: Phase = room.phase, at = 0) =>
    room.execute(player, { ...action, expectedPhase: phase, commandId: String(++id) } as Command, at);
  send(x, { type: 'chooseFace', face: 'heads' });
  send(o, { type: 'chooseFace', face: 'tails' });
  send(x, { type: 'toss' });
  send(x, { type: 'start' });
  const ready = () => {
    send(x, { type: 'ready' });
    send(o, { type: 'ready' });
  };
  return { room, x, o, send, ready };
}

test.each([true, false])('Hair-Trigger permits exactly one of each action, mark first: %s', markFirst => {
  const { room, x, o, send, ready } = setup();
  x.shop.bench = [{ cardId: 'BUF-C02', star: 1 }, { cardId: 'INT-C01', star: 2 }, { cardId: 'BUF-C01', star: 1 }];
  expect(send(x, { type: 'useCard', slot: 0 }).error).toBe('WRONG_PHASE');
  ready();
  expect(send(o, { type: 'useCard', slot: 0 }).error).toBe('WRONG_TURN');
  expect(send(x, { type: 'useCard', slot: 0 }).error).toBeUndefined();
  expect(room.snapshot(x).turn).toBe('O');
  send(o, { type: 'place', row: 1, col: 0 });
  ready();
  const mark = { type: 'place', row: 0, col: 0 } as const;
  const card = { type: 'useCard', slot: 0 } as const;
  expect(send(x, markFirst ? mark : card).error).toBeUndefined();
  expect(room.snapshot(x)).toMatchObject({ turn: 'X', you: { canEndTurn: true } });
  expect(send(x, markFirst ? { ...mark, col: 2 } : card).error).toBe('ACTION_USED');
  if (markFirst) expect(send(x, { type: 'useCard', slot: 1 }).error).toBe('CANNOT_USE_CARD');
  expect(send(x, markFirst ? card : mark).error).toBeUndefined();
  const projected = room.snapshot(o);
  expect(projected).toMatchObject({ turn: 'O', coins: { X: 9 }, lastCard: { seat: 'X', name: 'Aurelia Pocket' } });
  expect(projected.board[0]).toBe('X');
  expect(projected.you.privateState.bench).toEqual([]);
});

test.each([true, false])('a partial turn can end early or time out without adding a mark: %s', early => {
  const { room, x, send, ready } = setup();
  x.effects.hair = { star: 1, from: 1, through: 1 };
  x.shop.bench = [{ cardId: 'INT-C01', star: 1 }];
  ready();
  expect(send(x, { type: 'useCard', slot: 0 }).error).toBeUndefined();
  if (early) expect(send(x, { type: 'endTurn' }).error).toBeUndefined();
  else room.advance(gameConstants.timersMs.action + 1);
  expect(room.snapshot(x).turn).toBe('O');
  expect(room.snapshot(x).board.every(cell => cell === null)).toBe(true);
});

test('five wins immediately even with a Hair-Trigger card action remaining', () => {
  const { room, x, o, send, ready } = setup();
  for (let col = 0; col < 4; col++) {
    ready();
    send(x, { type: 'place', row: 0, col });
    send(o, { type: 'place', row: 1, col });
  }
  x.effects.hair = { star: 1, from: 5, through: 5 };
  x.shop.bench = [{ cardId: 'INT-C01', star: 1 }];
  ready();
  expect(send(x, { type: 'place', row: 0, col: 4 }).error).toBeUndefined();
  expect(room.snapshot(x)).toMatchObject({
    phase: 'FINISHED', result: { kind: 'win', winner: 'X' },
    you: { privateState: { bench: [{ id: 'INT-C01', canUse: false }] } },
  });
  expect(send(x, { type: 'useCard', slot: 0 }).error).toBe('WRONG_PHASE');
});

test('Rarity Up 3★ applies to the next Shop refresh even when Hold is enabled', () => {
  const { room, x, o, send, ready } = setup();
  send(x, { type: 'toggleHold', round: 1 });
  send(x, { type: 'reroll', round: 1 }); // Held Shop cannot reroll.
  x.shop.bench = [{ cardId: 'BUF-C01', star: 3 }];
  ready();
  expect(send(x, { type: 'useCard', slot: 0 }).error).toBeUndefined();
  expect(room.snapshot(x).you.privateState.freeRerolls).toBe(1);
  send(o, { type: 'place', row: 1, col: 0 });
  expect(room.snapshot(x)).toMatchObject({ round: 2, you: { privateState: { freeRerolls: 3, hold: true } } });
});
