import { createHash } from 'node:crypto';
import { createRng } from '@carocard/game-engine/rng';
import { boardSize } from '@carocard/game-engine';
import { expect, test } from 'vitest';
import type { ClientAction, Command, Seat, Snapshot } from '@carocard/shared';
import { Room } from './room.ts';

type Entry = { at: number; seat: Seat; command: Command } | { at: number };
const blindTargets = ['DMN-01', 'DMN-02', 'DMN-03', 'DMN-04', 'DMN-05'] as const;

function replayRoom(seed: number) {
  let time = 0;
  let windowId = 0;
  const room = new Room('REPLAY', () => 'heads', {
    seed, now: () => time,
    choiceId: () => `00000000-0000-4000-8000-${String(++windowId).padStart(12, '0')}`,
  });
  const players = { X: room.join(), O: room.join() };
  const snapshot = (seat: Seat) => room.snapshot(players[seat]);

  return {
    room, snapshot,
    play(entry: Entry) {
      time = entry.at;
      const result = 'command' in entry ? room.execute(players[entry.seat], entry.command, time) : room.advance(time);
      return createHash('sha256').update(JSON.stringify({
        X: snapshot('X'), O: snapshot('O'), result,
        effects: [players.X.effects, players.O.effects], shops: [players.X.shop, players.O.shop],
      })).digest('hex');
    },
  };
}

function generate(seed: number) {
  const { room, snapshot, play } = replayRoom(seed);
  const rng = createRng(seed);
  const log: Entry[] = [];
  const hashes: string[] = [];
  let time = 0;
  const record = (entry: Entry) => { log.push(entry); hashes.push(play(entry)); };
  const send = (seat: Seat, action: ClientAction) => {
    const command = { ...action, expectedPhase: room.phase, commandId: String(log.length) } as Command;
    record({ at: ++time, seat, command });
  };
  send('X', { type: 'chooseFace', face: 'heads' });
  send('O', { type: 'chooseFace', face: 'tails' });
  send('X', { type: 'toss' });
  send('X', { type: 'start' });

  function prepare(seat: Seat, view: Snapshot) {
    const options = view.you.privateState.shop.flatMap(({ card, blocked, demonUnavailable }, slot) =>
      card && !blocked && !demonUnavailable && card.cost <= view.coins[seat] ? [slot] : []);
    if (options.length && rng.next() < 0.55) {
      send(seat, { type: 'buy', round: view.round, slot: options[Math.floor(rng.next() * options.length)] });
    }
    send(seat, { type: 'ready' });
  }

  for (let step = 0; step < 500 && room.phase !== 'FINISHED'; step++) {
    const x = snapshot('X');
    if (x.phase === 'PREPARATION') {
      prepare('X', x);
      prepare('O', snapshot('O'));
    } else if (x.phase === 'ROUND_END') {
      time = x.nextRoundAt! + 1;
      record({ at: time });
    } else if (x.phase === 'ACTION' && x.turn) {
      const o = snapshot('O');
      const viewer = x.choiceWindow ? x : o.choiceWindow ? o : null;
      if (viewer?.choiceWindow && viewer.you.seat) {
        time = viewer.choiceWindow.deadline + 1;
        record({ at: time });
        continue;
      }
      const view = x.turn === 'X' ? x : o;
      const slot = view.you.privateState.bench.findIndex(card => card.canUse && ['INT-C01', 'BUF-C01', 'SPC-01'].includes(card.id));
      if (slot >= 0 && rng.next() < 0.25) {
        const card = view.you.privateState.bench[slot];
        send(x.turn, card.id === 'SPC-01' ? {
          type: 'useCard', slot, cross: { side: 'opponent', demon: blindTargets[Math.floor(rng.next() * blindTargets.length)] },
        } : { type: 'useCard', slot });
      } else {
        const free = x.board.flatMap((cell, index) => cell === null ? [index] : []);
        const index = free[Math.floor(rng.next() * free.length)];
        send(x.turn, { type: 'place', row: Math.floor(index / boardSize), col: index % boardSize });
      }
    } else throw new Error(`Unexpected replay phase ${x.phase}`);
  }
  expect(room.phase).toBe('FINISHED');
  return { log, hashes };
}

test('100 seeded matches replay to the same hash after every command and deadline', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const { log, hashes } = generate(seed);
    const second = replayRoom(seed);
    expect(log.map(second.play), `seed ${seed}`).toEqual(hashes);
  }
}, 45_000);
