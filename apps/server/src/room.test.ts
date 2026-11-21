import { createRng } from '@carocard/game-engine/rng';
import { describe, expect, test } from 'vitest';
import { Room } from './room.ts';

function setup() {
  const room = new Room('TEST', () => 'heads');
  const host = room.join();
  const guest = room.join();
  room.execute(host, { type: 'chooseFace', face: 'heads', commandId: '1', expectedPhase: 'LOBBY' });
  room.execute(guest, { type: 'chooseFace', face: 'tails', commandId: '1', expectedPhase: 'LOBBY' });
  return { room, host, guest };
}

function startAction({ room, host, guest }: ReturnType<typeof setup>) {
  room.execute(host, { type: 'toss', commandId: '2', expectedPhase: 'LOBBY' });
  room.execute(host, { type: 'start', commandId: '3', expectedPhase: 'LOBBY' });
  for (const player of [host, guest]) {
    room.execute(player, { type: 'ready', commandId: 'ready', expectedPhase: 'PREPARATION' });
  }
}

describe('room commands', () => {
  test('only the host can toss and start, and the coin assigns opposite seats', () => {
    const { room, host, guest } = setup();
    const toss = { type: 'toss', commandId: '2', expectedPhase: 'LOBBY' } as const;
    expect(room.execute(guest, toss).error).toBe('NOT_HOST');
    expect(room.execute(host, toss).error).toBeUndefined();
    expect(room.snapshot(host).you.seat).toBe('X');
    expect(room.snapshot(guest).you.seat).toBe('O');
    expect(room.snapshot(guest).coin).toBe('heads');
    expect(room.execute(host, { type: 'start', commandId: '3', expectedPhase: 'LOBBY' }).error)
      .toBeUndefined();
  });

  test('a repeated command cannot apply twice and invalid phase or turn does not commit', () => {
    const { room, host, guest } = setup();
    startAction({ room, host, guest });
    const move = { type: 'place', commandId: '4', expectedPhase: 'ACTION', row: 0, col: 0 } as const;
    expect(room.execute(guest, move).error).toBe('WRONG_TURN');
    expect(room.execute(host, { ...move, expectedPhase: 'LOBBY' }).error).toBe('WRONG_PHASE');
    const accepted = { ...move, commandId: '5' };
    expect(room.execute(host, accepted).error).toBeUndefined();
    const revision = room.snapshot(host).revision;
    expect(room.execute(host, accepted)).toMatchObject({ revision, duplicate: true });
    expect(room.snapshot(host).revision).toBe(revision);
  });

  test('random commands never leak the other player’s private state in outgoing payloads', () => {
    const { room, host, guest } = setup();
    for (const [player, marker] of [[host, 'secret-host'], [guest, 'secret-guest']] as const) {
      player.privateState = {
        shop: [marker], bench: [marker], curseProgress: { [marker]: 1 }, transactions: [marker],
      };
    }
    const rng = createRng(42);
    startAction({ room, host, guest });
    for (let index = 0; index < 200; index++) {
      const player = rng.next() < 0.5 ? host : guest;
      const payload = room.execute(player, {
        type: 'place', commandId: `move-${index}`, expectedPhase: 'ACTION',
        row: Math.floor(rng.next() * 15), col: Math.floor(rng.next() * 15),
      });
      for (const [viewer, own, other] of [
        [host, 'secret-host', 'secret-guest'],
        [guest, 'secret-guest', 'secret-host'],
      ] as const) {
        const output = JSON.stringify([room.snapshot(viewer), payload]);
        expect(output).toContain(own);
        expect(output).not.toContain(other);
        expect(output).not.toContain(host.token);
        expect(output).not.toContain(guest.token);
      }
    }
  });
});
