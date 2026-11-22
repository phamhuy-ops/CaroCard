import { readFile } from 'node:fs/promises';
import { replayMatch } from './match-record.ts';
import type { MatchEntry, RecordHeader } from './match-record.ts';

const file = process.argv[2];
if (!file) throw new Error('Usage: node apps/server/src/replay-recording.ts <record.jsonl>');
const [header, ...entries] = (await readFile(file, 'utf8')).trimEnd().split('\n');
console.log(JSON.stringify(replayMatch(JSON.parse(header) as RecordHeader,
  entries.map(line => JSON.parse(line) as MatchEntry))));
