import { randomBytes } from 'node:crypto';
import type { Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { clientMessageSchema, ErrorCode } from '@carocard/shared';
import type { ServerMessage } from '@carocard/shared';
import { Room } from './room.ts';
import type { Player } from './room.ts';

function send(socket: WebSocket, message: ServerMessage) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

export function attachGameSocket(server: Server) {
  const rooms = new Map<string, Room>();
  const sockets = new Map<Player, WebSocket>();
  const timers = new Map<Room, ReturnType<typeof setTimeout>>();
  const alive = new WeakSet<WebSocket>();
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (!alive.delete(socket)) socket.terminate();
      else if (socket.readyState === WebSocket.OPEN) socket.ping();
    }
  }, 5000);
  heartbeat.unref();
  wss.on('close', () => {
    clearInterval(heartbeat);
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
  });

  function broadcast(room: Room) {
    for (const player of room.players) {
      const socket = sockets.get(player);
      if (socket) send(socket, { type: 'snapshot', snapshot: room.snapshot(player) });
    }
  }

  function schedule(room: Room) {
    clearTimeout(timers.get(room));
    const deadline = room.nextDeadline;
    if (!Number.isFinite(deadline)) {
      timers.delete(room);
      return;
    }
    const timer = setTimeout(() => {
      const at = performance.now();
      void room.enqueue(() => {
        if (timers.get(room) !== timer) return;
        const previous = room.revision;
        room.advance(at);
        if (room.revision !== previous) broadcast(room);
        schedule(room);
      }).catch(() => console.error(JSON.stringify({ roomId: room.code, reason: 'TIMER_FAILED' })));
    }, Math.max(1, Math.ceil(deadline - performance.now() + 1)));
    timer.unref();
    timers.set(room, timer);
  }

  wss.on('connection', socket => {
    alive.add(socket);
    socket.on('pong', () => alive.add(socket));
    let session: { room: Room; player: Player } | undefined;
    const fail = (error: ErrorCode) => send(socket, { type: 'error', error });
    const run = (room: Room, work: () => void) => {
      void room.enqueue(work).catch(() => {
        console.error(JSON.stringify({ roomId: room.code, reason: 'ROOM_OPERATION_FAILED' }));
        socket.close(1011);
      });
    };

    socket.on('error', () => socket.terminate());
    socket.on('message', (raw, isBinary) => {
      const receivedAt = performance.now();
      if (isBinary) return fail(ErrorCode.InvalidMessage);
      let input: unknown;
      try {
        input = JSON.parse(raw.toString());
      } catch {
        return fail(ErrorCode.InvalidMessage);
      }
      const parsed = clientMessageSchema.safeParse(input);
      if (!parsed.success) return fail(ErrorCode.InvalidMessage);
      const message = parsed.data;
      if (message.type === 'command') {
        if (!session) return fail(ErrorCode.InvalidSession);
        const { room, player } = session;
        const { command } = message;
        run(room, () => {
          if (sockets.get(player) !== socket) return fail(ErrorCode.InvalidSession);
          const previous = room.revision;
          const result = room.execute(player, command, receivedAt);
          send(socket, result);
          console.log(JSON.stringify({
            roomId: room.code,
            commandId: command.commandId,
            phase: room.phase,
            revision: room.revision,
            reason: result.duplicate ? 'DUPLICATE' : result.error ?? 'ACCEPTED',
            ms: performance.now() - receivedAt,
          }));
          if (room.revision !== previous) broadcast(room);
          schedule(room);
        });
        return;
      }

      if (session) return fail(ErrorCode.AlreadyJoined);
      let room: Room | undefined;
      if (message.type === 'create') {
        let code: string;
        do {
          code = randomBytes(4).toString('hex').toUpperCase();
        } while (rooms.has(code));
        room = new Room(code);
        rooms.set(code, room);
      } else {
        room = rooms.get(message.roomCode);
      }
      if (!room) return fail(ErrorCode.RoomNotFound);
      const selectedRoom = room;
      run(selectedRoom, () => {
        if (socket.readyState !== WebSocket.OPEN) return;
        if (session) return fail(ErrorCode.AlreadyJoined);
        let player: Player;
        if (message.type === 'resume') {
          const existing = selectedRoom.players.find(other => other.token === message.token);
          if (!existing) return fail(ErrorCode.InvalidSession);
          const previous = selectedRoom.revision;
          if (!selectedRoom.reconnect(existing, receivedAt)) {
            if (selectedRoom.revision !== previous) broadcast(selectedRoom);
            schedule(selectedRoom);
            return fail(ErrorCode.InvalidSession);
          }
          player = existing;
          sockets.get(player)?.close(4001, 'Session replaced');
        } else {
          if (selectedRoom.players.length >= 2 || selectedRoom.phase !== 'LOBBY') {
            return fail(ErrorCode.RoomFull);
          }
          player = selectedRoom.join();
        }
        session = { room: selectedRoom, player };
        sockets.set(player, socket);
        send(socket, { type: 'session', roomCode: selectedRoom.code, token: player.token });
        broadcast(selectedRoom);
        schedule(selectedRoom);
      });
    });

    socket.on('close', () => {
      const closedAt = performance.now();
      if (!session) return;
      const { room, player } = session;
      run(room, () => {
        if (sockets.get(player) !== socket) return;
        sockets.delete(player);
        room.setOnline(player, false, closedAt);
        broadcast(room);
        schedule(room);
      });
    });
  });
}
