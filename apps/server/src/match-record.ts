import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Command } from '@carocard/shared';
import { Room } from './room.ts';

export interface RecordHeader {
  version: 1;
  roomCode: string;
  seed: number;
}

type Event = { at: number } & (
  | { type: 'join' | 'advance' }
  | { type: 'command'; player: number; command: Command }
  | { type: 'offline' | 'resume'; player: number }
);

export type MatchEntry = Event & { hash: string };

export function recordMatch(header: RecordHeader, directory = 'records') {
  const file = join(directory, `${Date.now()}-${header.roomCode}.jsonl`);
  let writes = mkdir(directory, { recursive: true })
    .then(() => writeFile(file, JSON.stringify(header) + '\n', { flag: 'wx' }))
    .then(() => true, () => {
      console.error(JSON.stringify({ roomId: header.roomCode, reason: 'RECORD_OPEN_FAILED' }));
      return false;
    });
  return {
    append(event: Event, room: Room) {
      // Capture the post-event hash synchronously before the next room command can run.
      const line = JSON.stringify({ ...event, hash: room.matchHash() }) + '\n';
      writes = writes.then(async open => {
        if (!open) return false;
        try {
          await appendFile(file, line, 'utf8');
          return true;
        } catch {
          console.error(JSON.stringify({ roomId: header.roomCode, reason: 'RECORD_WRITE_FAILED' }));
          return false;
        }
      });
    },
  };
}

export function replayMatch(header: RecordHeader, entries: readonly MatchEntry[]) {
  if (header.version !== 1) throw new Error('Unsupported match recording version');
  const room = new Room(header.roomCode, undefined, { seed: header.seed });
  for (const [index, event] of entries.entries()) {
    if (event.type === 'join') room.join();
    else if (event.type === 'advance') room.advance(event.at);
    else if ('player' in event) {
      const player = room.players[event.player];
      if (!player) throw new Error(`Unknown player at event ${index + 1}`);
      if (event.type === 'command') room.execute(player, event.command, event.at);
      else if (event.type === 'offline') room.setOnline(player, false, event.at);
      else room.reconnect(player, event.at);
    }
    if (room.matchHash() !== event.hash) throw new Error(`State differs at event ${index + 1} (${event.type})`);
  }
  return { roomCode: header.roomCode, events: entries.length, phase: room.phase, revision: room.revision };
}
