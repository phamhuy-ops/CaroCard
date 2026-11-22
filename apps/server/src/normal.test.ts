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

test('Mirror Image copies privately during preparation without using the upcoming turn', () => {
  const { room, x, o, send, ready } = setup();
  x.shop.bench = [{ cardId: 'SPC-03', star: 0 }, { cardId: 'BUF-C01', star: 2 }, { cardId: 'INT-R01', star: 1 }];
  expect(send(x, { type: 'mirror', round: 1, slot: 0, targetSlot: 1 }).error).toBe('INVALID_SPECIAL_TARGET');
  for (let round = 1; round < 5; round++) {
    ready();
    send(x, { type: 'place', row: 0, col: round * 2 });
    send(o, { type: 'place', row: 1, col: round * 2 });
  }
  expect(room.snapshot(x).you.privateState.bench[0].canUse).toBe(true);
  expect(send(x, { type: 'mirror', round: 5, slot: 0, targetSlot: 2 }).error).toBe('INVALID_SPECIAL_TARGET');
  expect(send(x, { type: 'mirror', round: 5, slot: 0, targetSlot: 1 }).error).toBeUndefined();
  expect(x.shop.bench.map(({ cardId, star }) => [cardId, star])).toEqual([
    ['BUF-C01', 1], ['BUF-C01', 2], ['INT-R01', 1],
  ]);
  expect(room.snapshot(o).you.privateState.bench).toEqual([]);
  ready();
  expect(room.snapshot(x)).toMatchObject({ phase: 'ACTION', turn: 'X', you: { canPlace: true } });
});

test('Powder Keg validates its target and Hair-Trigger permits marking the opened square', () => {
  const { room, x, o, send, ready } = setup();
  o.shop.bench = [{ cardId: 'BUF-E01', star: 1 }];
  x.shop.bench = [{ cardId: 'SPC-02', star: 0 }];
  ready();
  expect(room.snapshot(x).you.privateState.bench[0].canUse).toBe(false);
  send(x, { type: 'place', row: 0, col: 0 });
  send(o, { type: 'useCard', slot: 0, walls: [{ row: 1, col: 1 }] });
  send(o, { type: 'place', row: 1, col: 0 });
  x.effects.hair = { star: 1, from: 2, through: 2 };
  ready();
  expect(send(x, { type: 'useCard', slot: 0, blast: { row: 1, col: 0 } }).error).toBe('INVALID_SPECIAL_TARGET');
  expect(x.shop.bench).toHaveLength(1);
  expect(send(x, { type: 'useCard', slot: 0, blast: { row: 1, col: 1 } }).error).toBeUndefined();
  expect(room.snapshot(o).you.wallsRemaining).toBe(3);
  expect(send(x, { type: 'place', row: 1, col: 1 }).error).toBeUndefined();
  expect(room.snapshot(o)).toMatchObject({ phase: 'ACTION', turn: 'O' });
});

test('Malphas unlocks privately after two full turns and using it consumes the entire next turn', () => {
  const { room, x, o, send, ready } = setup();
  x.shop.slots[0] = 'DMN-01';
  expect(send(x, { type: 'buy', round: 1, slot: 0 }).error).toBeUndefined();
  for (let round = 1; round <= 2; round++) {
    ready();
    send(x, { type: 'place', row: 0, col: round });
    expect(room.snapshot(x).you.privateState.bench[0].demon?.progress).toBe(round);
    expect(JSON.stringify(room.snapshot(o))).not.toContain('DMN-01');
    send(o, { type: 'place', row: 1, col: round });
  }
  x.effects.hair = { star: 1, from: 3, through: 3 };
  ready();
  expect(send(x, { type: 'useDemon', slot: 0, walls: [{ row: 2, col: 2 }] }).error).toBeUndefined();
  expect(room.snapshot(x)).toMatchObject({ turn: 'O', you: { privateState: { bench: [{ demon: { status: 'Contracted' } }] } } });
  expect(room.snapshot(o).board[2 * 15 + 2]).toBe('Dark Wall');
});

test.each([true, false])('Belial consumes the caster turn and places the opposing mark, timeout: %s', timeout => {
  const { room, x, o, send, ready } = setup();
  x.shop.bench = [{ cardId: 'DMN-04', star: 0, demon: { sourceId: 'belial', status: 'Unlocked', progress: 3, failed: false } }];
  o.shop.bench = [
    { cardId: 'BUF-C01', star: 1 }, { cardId: 'INT-R01', star: 1 }, { cardId: 'SPC-01', star: 0 },
    { cardId: 'DMN-03', star: 0, demon: { sourceId: 'asmodeus', status: 'Locked', progress: 2, failed: false } },
  ];
  ready();
  expect(send(x, { type: 'useDemon', slot: 0 }).error).toBeUndefined();
  const window = room.snapshot(x).choiceWindow!;
  expect(window.kind).toBe('belial');
  expect(window.deadline).toBe(15_000);
  expect(room.snapshot(o).choiceWindow).toBeNull();
  expect(room.snapshot(o).you.privateState.bench.map(card => card.id)).toEqual(['SPC-01', 'DMN-03']);
  const command = { type: 'answerBelial', windowId: window.id, target: { row: 0, col: 0 } } as const;
  expect(send(o, command).error).toBe('STALE_CHOICE');
  if (timeout) {
    room.setOnline(x, false, 1);
    room.advance(window.deadline + 1);
  } else expect(send(x, command, 'ACTION', window.deadline).error).toBeUndefined();
  expect(room.snapshot(o).board[0]).toBe('O');
  expect(o.shop.bench[1].demon).toMatchObject({ status: 'Locked', progress: 0 });
  expect(room.snapshot(o)).toMatchObject({ round: 2, phase: 'PREPARATION' });
});

test('Abaddon ignores spending before purchase, resets after paid reroll, and locks the Bench upon cancellation', () => {
  const { room, x, o, send, ready } = setup();
  x.shop.slots = ['BUF-C01', 'DMN-05', null, null];
  expect(send(x, { type: 'buy', round: 1, slot: 0 }).error).toBeUndefined();
  expect(send(x, { type: 'buy', round: 1, slot: 1 }).error).toBeUndefined();
  ready();
  send(x, { type: 'place', row: 0, col: 0 });
  send(o, { type: 'place', row: 1, col: 0 });
  expect(x.shop.bench[1].demon?.progress).toBe(1);
  x.shop.freeRerolls = 0;
  send(x, { type: 'reroll', round: 2 });
  expect(x.shop.bench[1].demon?.progress).toBe(0);
  expect(send(x, { type: 'cancelDemon', round: 2, slot: 1 }).error).toBeUndefined();
  expect(room.snapshot(x)).toMatchObject({ coins: { X: 0 }, you: { benchLocked: true } });
  expect(send(x, { type: 'discard', round: 2, slot: 0 }).error).toBe('BENCH_LOCKED');
  ready();
  send(x, { type: 'place', row: 0, col: 2 });
  send(o, { type: 'place', row: 1, col: 2 });
  expect(room.snapshot(x)).toMatchObject({ round: 3, coins: { X: 0 }, you: { benchLocked: true } });
});

test.each([0, 1])('Asmodeus accepts exactly ten seconds excluding a popup, extra ms: %i', extra => {
  const { room, x, o, send, ready } = setup();
  x.shop.slots[0] = 'DMN-03';
  send(x, { type: 'buy', round: 1, slot: 0 });
  x.shop.bench[0].demon!.progress = 2;
  ready();
  const choice = room.openChoice('O', 'ultimatum', 1000);
  expect(room.closeChoice(choice.id, 5000)).toBe(true);
  const at = 4000 + 10_000 + extra;
  expect(send(x, { type: 'place', row: 0, col: 0 }, 'ACTION', at).error).toBeUndefined();
  expect(room.snapshot(x).you.privateState.bench[0].demon).toMatchObject(
    extra ? { status: 'Locked', progress: 0 } : { status: 'Contracted', progress: 3 });
  send(o, { type: 'place', row: 1, col: 0 }, 'ACTION', at + 1);
  expect(room.snapshot(o).preparation?.O.deadline).toBe(at + 1 + (extra ? 30_000 : 15_000));
});

test('Asmodeus does not count a Hair-Trigger turn with a card, or a turn played by timeout', () => {
  const { room, x, o, send, ready } = setup();
  x.shop.slots[0] = 'DMN-03';
  send(x, { type: 'buy', round: 1, slot: 0 });
  x.shop.bench[0].demon!.progress = 2;
  x.shop.bench.push({ cardId: 'INT-C01', star: 1 });
  x.effects.hair = { star: 1, from: 1, through: 1 };
  ready();
  send(x, { type: 'place', row: 0, col: 0 }, 'ACTION', 100);
  send(x, { type: 'useCard', slot: 1 }, 'ACTION', 200);
  expect(x.shop.bench[0].demon).toMatchObject({ status: 'Locked', progress: 0 });
  send(o, { type: 'place', row: 1, col: 0 }, 'ACTION', 300);
  x.shop.bench[0].demon!.progress = 2;
  send(x, { type: 'ready' }, 'PREPARATION', 301);
  send(o, { type: 'ready' }, 'PREPARATION', 301);
  room.advance(302 + gameConstants.timersMs.action);
  expect(x.shop.bench[0].demon).toMatchObject({ status: 'Locked', progress: 0 });
});

test('canceling Asmodeus costs three coins and blocks cards in this and the next ACTION', () => {
  const { room, x, o, send, ready } = setup();
  x.shop.slots[0] = 'DMN-03';
  send(x, { type: 'buy', round: 1, slot: 0 });
  x.shop.bench.push({ cardId: 'INT-C01', star: 1 });
  expect(send(x, { type: 'cancelDemon', round: 1, slot: 0 }).error).toBeUndefined();
  expect(room.snapshot(x).coins.X).toBe(0);
  for (let round = 1; round <= 2; round++) {
    ready();
    expect(send(x, { type: 'useCard', slot: 0 }).error).toBe('CARD_LOCKED');
    send(x, { type: 'place', row: 0, col: round });
    send(o, { type: 'place', row: 1, col: round });
  }
  ready();
  expect(send(x, { type: 'useCard', slot: 0 }).error).toBeUndefined();
});

test('Asmodeus and the Belial cancellation apply both reductions to the base preparation duration', () => {
  const { room, x, o, send, ready } = setup();
  x.shop.bench = [{ cardId: 'DMN-03', star: 0, demon: { status: 'Contracted', progress: 3, failed: false, sourceId: 'a' } }];
  o.shop.slots[0] = 'DMN-04';
  send(o, { type: 'buy', round: 1, slot: 0 });
  expect(send(o, { type: 'cancelDemon', round: 1, slot: 0 }).error).toBeUndefined();
  ready();
  send(x, { type: 'place', row: 0, col: 0 });
  send(o, { type: 'place', row: 1, col: 0 });
  expect(room.snapshot(o).preparation?.O.deadline).toBe(7500);
});

test('Holy Cross removes a Locked enemy Demon without a counterattack and keeps the catalog blind', () => {
  const { room, x, o, send, ready } = setup();
  x.shop.bench = [{ cardId: 'SPC-01', star: 0 }];
  o.shop.bench = [{ cardId: 'DMN-04', star: 0, demon: { status: 'Locked', progress: 2, failed: false, sourceId: 'b' } }];
  ready();
  expect(room.snapshot(x).you.privateState.bench[0].canUse).toBe(true);
  const used = send(x, { type: 'useCard', slot: 0, cross: { side: 'opponent', demon: 'DMN-04' } });
  expect(used.error).toBeUndefined();
  expect(x.shop.bench).toHaveLength(0);
  expect(o.shop.bench).toHaveLength(0);
  expect(room.snapshot(x)).toMatchObject({ turn: 'O', choiceWindow: null, lastCard: { name: 'Holy Cross' } });
});

test('a wrong Holy Cross starts the received curse next round and self-dispel leaves coins unchanged', () => {
  const { room, x, o, send, ready } = setup();
  x.shop.bench = [{ cardId: 'SPC-01', star: 0 }];
  ready();
  expect(send(x, { type: 'useCard', slot: 0, cross: { side: 'opponent', demon: 'DMN-01' } }).error).toBeUndefined();
  expect(x.shop.bench[0].demon).toMatchObject({ status: 'Locked', progress: 0, activeFrom: 2 });
  send(o, { type: 'place', row: 1, col: 0 });
  x.shop.bench.push({ cardId: 'SPC-01', star: 0 });
  ready();
  const coins = room.snapshot(x).coins.X;
  expect(send(x, { type: 'useCard', slot: 1, cross: { side: 'self', demon: 'DMN-01' } }).error).toBeUndefined();
  expect(x.shop.bench).toEqual([]);
  expect(room.snapshot(x).coins.X).toBe(coins);
});

test('Hell’s Dealer wins ahead of a winning line on the same placement', () => {
  const { room, x, o, send, ready } = setup();
  for (const col of [0, 1, 2, 3]) {
    ready();
    send(x, { type: 'place', row: 0, col });
    send(o, { type: 'place', row: 2, col });
  }
  x.shop.bench = ['DMN-01', 'DMN-02', 'DMN-03', 'DMN-04', 'DMN-05'].map(cardId => ({
    cardId, star: 0, demon: { sourceId: cardId, status: cardId === 'DMN-02' ? 'Locked' : 'Contracted',
      progress: cardId === 'DMN-02' ? 2 : 3, failed: false },
  }));
  ready();
  expect(send(x, { type: 'place', row: 0, col: 4 }).error).toBeUndefined();
  expect(room.snapshot(o)).toMatchObject({ phase: 'FINISHED', result: { kind: 'win', winner: 'X', reason: 'hellsDealer' } });
});

function crossDemon(cardId: string, sourceId = cardId, status: 'Locked' | 'Unlocked' | 'Contracted' = 'Contracted') {
  return { cardId, star: 0, demon: { sourceId, status, progress: 3, failed: false } };
}

test('Holy Cross removes only the Malphas walls of the expelled source', () => {
  const { room, x, o, send, ready } = setup();
  x.shop.bench = [crossDemon('DMN-01', 'x-walls', 'Unlocked'), { cardId: 'SPC-01', star: 0 }];
  o.shop.bench = [crossDemon('DMN-01', 'o-walls', 'Unlocked')];
  ready();
  send(x, { type: 'useDemon', slot: 0, walls: [{ row: 0, col: 0 }] });
  send(o, { type: 'useDemon', slot: 0, walls: [{ row: 0, col: 1 }] });
  ready();
  send(x, { type: 'useCard', slot: 1, cross: { side: 'opponent', demon: 'DMN-01' } });
  expect(room.snapshot(o).board.slice(0, 2)).toEqual(['Dark Wall', null]);
});

test('expelling Agares moves the Demon owner’s marks and Belial grants a new forced choice', () => {
  const { room, x, o, send, ready } = setup();
  x.shop.bench = [{ cardId: 'SPC-01', star: 0 }];
  o.shop.bench = [crossDemon('DMN-02'), crossDemon('DMN-04', 'b', 'Unlocked'), { cardId: 'BUF-C01', star: 1 }];
  ready();
  send(x, { type: 'place', row: 7, col: 7 });
  send(o, { type: 'place', row: 4, col: 4 });
  ready();
  send(x, { type: 'useCard', slot: 0, cross: { side: 'opponent', demon: 'DMN-02' } });
  expect(room.snapshot(x).board[0]).toBe('O');
  expect(room.snapshot(x).board[4 * 15 + 4]).toBeNull();
  send(o, { type: 'place', row: 4, col: 5 });
  x.shop.bench = [{ cardId: 'SPC-01', star: 0 }];
  ready();
  const forced = Reflect.get(room, 'forcedTurns') as Map<'X' | 'O', { caster: 'X' | 'O'; sourceId: string }>;
  forced.set('X', { caster: 'O', sourceId: 'b' });
  send(x, { type: 'useCard', slot: 0, cross: { side: 'opponent', demon: 'DMN-04' } });
  const window = room.snapshot(x).choiceWindow!;
  expect(window.kind).toBe('belial');
  expect(o.shop.bench).toEqual([]);
  send(x, { type: 'answerBelial', windowId: window.id, target: { row: 2, col: 2 } });
  ready();
  expect(room.snapshot(x)).toMatchObject({ choiceWindow: null, turn: 'X', you: { canPlace: true } });
});

test('expelling Asmodeus preserves another preparation reduction and Abaddon clears only its own blocks', () => {
  const { room, x, o, send, ready } = setup();
  x.shop.bench = [{ cardId: 'SPC-01', star: 0 }];
  x.reducedPreparation = { from: 2, through: 3 };
  x.shop.blocks = ['abaddon', 'other-effect', null, null];
  o.shop.bench = [crossDemon('DMN-03'), crossDemon('DMN-05', 'abaddon')];
  ready();
  send(x, { type: 'useCard', slot: 0, cross: { side: 'opponent', demon: 'DMN-03' } });
  send(o, { type: 'place', row: 0, col: 0 });
  expect(room.snapshot(x).preparation?.X.deadline).toBe(
    gameConstants.timersMs.prep * gameConstants.belialCancelPrepFactor);
  x.shop.bench = [{ cardId: 'SPC-01', star: 0 }];
  ready();
  send(x, { type: 'useCard', slot: 0, cross: { side: 'opponent', demon: 'DMN-05' } });
  expect(x.shop.blocks).toEqual([null, 'other-effect', null, null]);
});

test('Holy Cross cannot self-expel a Contracted Demon and a wrong guess can consume without granting one', () => {
  const { x, send, ready } = setup();
  x.shop.bench = [
    { cardId: 'SPC-01', star: 0 }, crossDemon('DMN-01'), crossDemon('DMN-02', 'a', 'Locked'),
    crossDemon('DMN-03', 'b', 'Locked'),
  ];
  ready();
  expect(send(x, { type: 'useCard', slot: 0, cross: { side: 'self', demon: 'DMN-01' } }).error)
    .toBe('INVALID_SPECIAL_TARGET');
  expect(x.shop.bench[0].cardId).toBe('SPC-01');
  expect(send(x, { type: 'useCard', slot: 0, cross: { side: 'opponent', demon: 'DMN-05' } }).error).toBeUndefined();
  expect(x.shop.bench.map(card => card.cardId)).toEqual(['DMN-01', 'DMN-02', 'DMN-03']);
});
