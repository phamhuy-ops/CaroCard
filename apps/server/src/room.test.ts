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
        curseProgress: { [marker]: 1 }, transactions: [marker],
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

  test('shop, bench and block sources remain private after a purchase and readiness', () => {
    const { room, host, guest } = setup();
    room.execute(host, { type: 'toss', commandId: '2', expectedPhase: 'LOBBY' });
    room.execute(host, { type: 'start', commandId: '3', expectedPhase: 'LOBBY' });
    host.shop.slots = ['SPC-01', 'BUF-C02', null, null];
    host.shop.blocks[0] = 'host-block-source';
    guest.shop.slots = ['DEB-C01', null, null, null];
    guest.shop.bench = [{ cardId: 'DMN-03', star: 0 }];
    const purchase = { type: 'buy', round: 1, slot: 1, commandId: 'purchase', expectedPhase: 'PREPARATION' } as const;
    const result = room.execute(host, purchase);
    expect(result.error).toBeUndefined();
    const x = room.snapshot(host);
    const o = room.snapshot(guest);
    expect(x.coins.X).toBe(2);
    expect(x.you.privateState.bench[0].id).toBe('BUF-C02');
    expect(x.you.privateState.shop[1].card).toBeNull();
    expect(x.you.privateState.shop[0].blocked).toBe(true);
    expect(JSON.stringify([x, result])).not.toMatch(/DEB-C01|DMN-03|host-block-source/);
    expect(JSON.stringify(o)).not.toMatch(/SPC-01|BUF-C02|host-block-source/);
    expect(room.execute(host, purchase).duplicate).toBe(true);
    expect(room.snapshot(host).coins.X).toBe(2);
    room.execute(host, { type: 'ready', commandId: 'ready', expectedPhase: 'PREPARATION' });
    expect(room.execute(host, { ...purchase, commandId: 'after-ready' }).error).toBe('ALREADY_READY');
  });
});
