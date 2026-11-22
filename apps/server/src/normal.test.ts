import { expect, test } from 'vitest';
import { gameConstants } from '@carocard/shared';
import type { ClientAction, Command, Phase } from '@carocard/shared';
import { Room } from './room.ts';
import type { Player } from './room.ts';

function setup() {
  const room = new Room('NORMAL', () => 'heads', { now: () => 0, rng: { next: () => 0 }, roundTransitionMs: 0 });
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
  expect(room.snapshot(x)).toMatchObject({ turn: 'O', you: { hairTrigger: { from: 2, through: 2 } } });
  send(o, { type: 'place', row: 1, col: 0 });
  ready();
  const mark = { type: 'place', row: 0, col: 0 } as const;
  const card = { type: 'useCard', slot: 0 } as const;
  expect(send(x, markFirst ? mark : card).error).toBeUndefined();
  expect(room.snapshot(x)).toMatchObject({ turn: 'X', you: { canEndTurn: true, canPlace: !markFirst } });
  if (markFirst) expect(room.snapshot(x).you.privateState.bench[0].canUse).toBe(true);
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

test('Ultimatum hides the prompt from the caster and restores Hair-Trigger action time at the exact deadline', () => {
  const { room, x, o, send, ready } = setup();
  const { action, popup } = gameConstants.timersMs;
  x.shop.bench = [{ cardId: 'DEB-R01', star: 1 }];
  x.effects.hair = { star: 1, from: 1, through: 1 };
  ready();
  expect(send(x, { type: 'useCard', slot: 0 }, 'ACTION', 1000).error).toBeUndefined();
  const own = room.snapshot(x);
  expect(own).toMatchObject({ actionDeadline: null, ultimatum: null, choiceWindow: null });
  const window = room.snapshot(o).choiceWindow!;
  const answer = { type: 'answerUltimatum', windowId: window.id, choice: 'accept' } as const;
  expect(send(x, answer, 'ACTION', 1001).error).toBe('STALE_CHOICE');
  expect(send(o, { ...answer, windowId: 'wrong-window' }, 'ACTION', 1002).error).toBe('STALE_CHOICE');
  expect(send(x, { type: 'place', row: 0, col: 0 }, 'ACTION', 1003).error).toBe('CHOICE_PENDING');
  expect(send(o, answer, 'ACTION', 1000 + popup).error).toBeUndefined();
  expect(room.snapshot(x)).toMatchObject({ turn: 'X', actionDeadline: action + popup });
  expect(send(x, { type: 'place', row: 0, col: 0 }, 'ACTION', 1100 + popup).error).toBeUndefined();
  send(o, { type: 'place', row: 1, col: 0 }, 'ACTION', 1200 + popup);
  expect(room.snapshot(o).you.canBuy).toBe(false);
  expect(send(o, { type: 'buy', slot: 0, round: 2 }, 'PREPARATION', 1300 + popup).error).toBe('BUY_LOCKED');
});

test.each([1, 2])('offline Ultimatum %i★ resolves at 15s with the legal default', star => {
  const { room, x, o, send, ready } = setup();
  const popup = gameConstants.timersMs.popup;
  x.shop.bench = [{ cardId: 'DEB-R01', star }];
  ready();
  room.setOnline(o, false, 10);
  send(x, { type: 'useCard', slot: 0 }, 'ACTION', 20);
  expect(room.snapshot(o).ultimatum?.canResist).toBe(star === 1);
  room.advance(20 + popup);
  expect(room.snapshot(o).choiceWindow).not.toBeNull();
  room.advance(21 + popup);
  expect(room.snapshot(o)).toMatchObject({ turn: 'O', choiceWindow: null, actionDeadline: 20 + popup + gameConstants.timersMs.action });
  expect(room.reconnect(o, 22 + popup)).toBe(true);
  send(o, { type: 'place', row: 1, col: 0 }, 'ACTION', 25 + popup);
  const prep = room.snapshot(o);
  expect(prep.you.privateState.shop.filter(slot => slot.blocked)).toHaveLength(star === 1 ? 2 : 0);
  expect(prep.you.privateState.freeRerolls).toBe(star === 1 ? 1 : 2);
});

test('attacker payload is identical with or without a hidden Cutpurse target', () => {
  function attack(withTarget: boolean) {
    const { room, x, o, send, ready } = setup();
    x.shop.bench = [{ cardId: 'DEB-C02', star: 3 }];
    if (withTarget) o.shop.bench = [{ cardId: 'INT-R01', star: 3 }];
    ready();
    const result = send(x, { type: 'useCard', slot: 0 });
    expect(room.snapshot(o).you.privateState.bench).toEqual([]);
    const { you, lastCard, phase, turn, coins } = room.snapshot(x);
    return { result, lastCard, phase, turn, coins, ownBench: you.privateState.bench };
  }
  expect(attack(true)).toEqual(attack(false));
});

test('Angel blocks Ultimatum completely while still consuming the card and the turn', () => {
  const { room, x, o, send, ready } = setup();
  x.shop.bench = [{ cardId: 'DEB-R01', star: 3 }];
  o.effects.angelImmune = true;
  ready();
  expect(send(x, { type: 'useCard', slot: 0 }).error).toBeUndefined();
  expect(room.snapshot(o)).toMatchObject({ turn: 'O', ultimatum: null, choiceWindow: null });
  expect(room.snapshot(x).you.privateState.bench).toEqual([]);
});

test('both seats must wait until a scheduled Ultimatum expires before using another', () => {
  const { room, x, o, send, ready } = setup();
  x.shop.bench = [{ cardId: 'DEB-R01', star: 1 }, { cardId: 'DEB-R01', star: 2 }];
  o.shop.bench = [{ cardId: 'DEB-R01', star: 1 }];
  ready();
  send(x, { type: 'useCard', slot: 0 });
  send(o, { type: 'answerUltimatum', windowId: room.snapshot(o).choiceWindow!.id, choice: 'accept' });
  expect(send(o, { type: 'useCard', slot: 0 }).error).toBe('ULTIMATUM_ACTIVE');
  send(o, { type: 'place', row: 1, col: 0 });
  ready();
  expect(room.snapshot(x).ultimatumLocked).toBe(true);
  expect(room.snapshot(x).you.privateState.bench[0].canUse).toBe(false);
  expect(send(x, { type: 'useCard', slot: 0 }).error).toBe('ULTIMATUM_ACTIVE');
  expect(x.shop.bench).toEqual([{ cardId: 'DEB-R01', star: 2 }]);
  send(x, { type: 'place', row: 0, col: 0 });
  send(o, { type: 'place', row: 1, col: 1 });
  ready();
  expect(room.snapshot(x).ultimatumLocked).toBe(false);
  expect(send(x, { type: 'useCard', slot: 0 }).error).toBeUndefined();
});

test('New Angle consumes a card only on a legal move and can pair with one mark', () => {
  const { room, x, o, send, ready } = setup();
  x.shop.bench = [{ cardId: 'BUF-R01', star: 1 }];
  ready();
  expect(room.snapshot(x).you.privateState.bench[0].canUse).toBe(false);
  send(x, { type: 'place', row: 0, col: 0 });
  send(o, { type: 'place', row: 1, col: 0 });
  x.effects.hair = { star: 1, from: 2, through: 2 };
  ready();
  const use = { type: 'useCard', slot: 0, move: { from: { row: 0, col: 0 }, to: { row: 0, col: 2 } } } as const;
  expect(send(x, use).error).toBe('INVALID_MOVE');
  expect(room.snapshot(x).you.privateState.bench[0].canUse).toBe(true);
  expect(send(x, { ...use, move: { ...use.move, to: { row: 0, col: 1 } } }).error).toBeUndefined();
  expect(room.snapshot(o).board.slice(0, 2)).toEqual([null, 'X']);
  expect(room.snapshot(x)).toMatchObject({ turn: 'X', you: { canPlace: true, privateState: { bench: [] } } });
  expect(send(x, { type: 'place', row: 0, col: 2 }).error).toBeUndefined();
  expect(room.snapshot(x).turn).toBe('O');
});

test.each(['alone', 'wall-first', 'mark-first'])('Makeshift Wall allows exactly one mark and one card: %s', order => {
  const { room, x, o, send, ready } = setup();
  x.shop.bench = [{ cardId: 'BUF-E01', star: 1 }, { cardId: 'INT-C01', star: 1 }, { cardId: 'BUF-E01', star: 3 }];
  if (order !== 'alone') x.effects.hair = { star: 1, from: 1, through: 1 };
  ready();
  if (order === 'mark-first') send(x, { type: 'place', row: 0, col: 0 });
  expect(send(x, { type: 'useCard', slot: 0, walls: [] }).error).toBe('INVALID_WALLS');
  expect(x.shop.bench).toHaveLength(3);
  expect(send(x, { type: 'useCard', slot: 0, walls: [{ row: 0, col: 1 }] }).error).toBeUndefined();
  expect(room.snapshot(o).board[1]).toBe('Makeshift Wall');
  expect(room.snapshot(x).you.wallsRemaining).toBe(2);
  if (order !== 'mark-first') {
    expect(room.snapshot(x).you.canPlace).toBe(true);
    expect(send(x, { type: 'useCard', slot: 0 }).error).toBe('ACTION_USED');
    expect(send(x, { type: 'place', row: 0, col: 0 }).error).toBeUndefined();
  }
  expect(room.snapshot(x)).toMatchObject({ turn: 'O', you: { canPlace: false } });
  expect(send(x, { type: 'place', row: 0, col: 2 }).error).toBe('WRONG_TURN');
  send(o, { type: 'place', row: 1, col: 0 });
  ready();
  expect(room.snapshot(x).you.privateState.bench[1].canUse).toBe(false);
  expect(send(x, { type: 'useCard', slot: 1, walls: [
    { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 },
  ] }).error).toBe('INVALID_WALLS');
  expect(x.shop.bench).toHaveLength(2);
});
