import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { summarizeRtt } from '@carocard/shared/network-metrics';
import type { ClientAction, ClientMessage, Phase, ServerMessage, Snapshot } from '@carocard/shared';
import { attachGameSocket } from './socket.ts';
import type { NetworkProfile } from './network.ts';

async function connect(url: string) {
  const ws = new WebSocket(url);
  const inbox: ServerMessage[] = [];
  ws.addEventListener('message', event => inbox.push(JSON.parse(String(event.data)) as ServerMessage));
  await once(ws, 'open', { signal: AbortSignal.timeout(5000) });
  const send = (message: ClientMessage) => ws.send(JSON.stringify(message));
  async function receive<Type extends ServerMessage['type']>(
    type: Type, predicate: (message: Extract<ServerMessage, { type: Type }>) => boolean = () => true,
  ) {
    const signal = AbortSignal.timeout(8000);
    for (;;) {
      const index = inbox.findIndex(message => message.type === type
        && predicate(message as Extract<ServerMessage, { type: Type }>));
      if (index >= 0) return inbox.splice(index, 1)[0] as Extract<ServerMessage, { type: Type }>;
      await once(ws, 'message', { signal });
    }
  }
  return {
    ws, send, receive,
    async snapshot(predicate: (snapshot: Snapshot) => boolean) {
      return (await receive('snapshot', message => predicate(message.snapshot))).snapshot;
    },
    async command(expectedPhase: Phase, action: ClientAction) {
      const commandId = randomUUID();
      send({ type: 'command', command: { ...action, expectedPhase, commandId } });
      const result = await receive('commandResult', message => message.commandId === commandId);
      assert.equal(result.error, undefined);
      return result;
    },
  };
}

async function run(profile: NetworkProfile, playPopup: boolean) {
  const server = createServer();
  const wss = attachGameSocket(server, profile);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `ws://127.0.0.1:${address.port}/ws`;
  const connections: Awaited<ReturnType<typeof connect>>[] = [];
  async function open() {
    const client = await connect(url);
    connections.push(client);
    return client;
  }
  try {
    const host = await open();
    const samples: number[] = [];
    for (let nonce = 1; nonce <= 20; nonce++) {
      const start = performance.now();
      host.send({ type: 'ping', nonce });
      await host.receive('pong', message => message.nonce === nonce);
      samples.push(performance.now() - start);
    }
    let recoveredMs: number | null = null;
    if (playPopup) {
      const guest = await open();
      host.send({ type: 'create' });
      const hostSession = await host.receive('session');
      guest.send({ type: 'join', roomCode: hostSession.roomCode });
      const guestSession = await guest.receive('session');
      await host.command('LOBBY', { type: 'chooseFace', face: 'heads' });
      await guest.command('LOBBY', { type: 'chooseFace', face: 'tails' });
      await host.command('LOBBY', { type: 'toss' });
      await host.command('LOBBY', { type: 'start' });
      const prep = await host.snapshot(snapshot => snapshot.phase === 'PREPARATION');
      const x = prep.you.seat === 'X' ? host : guest;
      const o = x === host ? guest : host;
      const oSession = o === host ? hostSession : guestSession;
      const xPrep = x === host ? prep : await guest.snapshot(snapshot => snapshot.phase === 'PREPARATION');
      const slot = xPrep.you.privateState.shop.findIndex(({ card }) => card?.id === 'DEB-R01');
      assert.ok(slot >= 0, 'Seed 7 must offer Brutal Ultimatum to X');
      await x.command('PREPARATION', { type: 'buy', round: 1, slot });
      await x.command('PREPARATION', { type: 'ready' });
      await o.command('PREPARATION', { type: 'ready' });
      await x.command('ACTION', { type: 'useCard', slot: 0 });
      const before = await o.snapshot(snapshot => snapshot.choiceWindow !== null);
      const closed = once(o.ws, 'close');
      o.ws.close();
      await closed;
      const lostAt = performance.now();
      await new Promise(resolve => setTimeout(resolve, 500));
      const resumed = await open();
      resumed.send({ type: 'resume', roomCode: oSession.roomCode, token: oSession.token });
      const after = await resumed.snapshot(snapshot => snapshot.choiceWindow !== null);
      recoveredMs = Math.round(performance.now() - lostAt);
      assert.equal(after.you.seat, 'O');
      assert.deepEqual(after.choiceWindow, before.choiceWindow);
      await resumed.command('ACTION', { type: 'answerUltimatum', choice: 'accept', windowId: after.choiceWindow!.id });
      const restored = await resumed.snapshot(snapshot => snapshot.turn === 'O' && snapshot.choiceWindow === null);
      assert.equal(restored.phase, 'ACTION');
    }
    return { ...profile, ...summarizeRtt(samples), recoveredMs };
  } finally {
    for (const client of connections) {
      if (client.ws.readyState !== WebSocket.OPEN) continue;
      const closed = once(client.ws, 'close');
      client.ws.close();
      await closed;
    }
    wss.close();
    server.close();
  }
}

process.env.DEBUG_MATCH_SEED = '7';
const profiles = [
  { delayMs: 0, jitterMs: 0 },
  { delayMs: 100, jitterMs: 0 },
  { delayMs: 300, jitterMs: 0 },
  { delayMs: 100, jitterMs: 40 },
];
const results = await Promise.all(profiles.map(profile => run(profile, profile.jitterMs > 0)));
for (const result of results) console.log(JSON.stringify(result));
