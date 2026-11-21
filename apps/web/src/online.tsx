import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ClientAction, ClientMessage, Face, ServerMessage, Snapshot } from '@carocard/shared';

const sessionKey = 'carocard.roomSession';
const faces: Record<Face, string> = { heads: 'Ngửa', tails: 'Sấp' };
const errors: Record<string, string> = {
  INVALID_MESSAGE: 'Mã phòng hoặc thao tác không hợp lệ.',
  ROOM_NOT_FOUND: 'Không tìm thấy phòng.',
  ROOM_FULL: 'Phòng đã đủ người.',
  INVALID_SESSION: 'Phiên cũ đã hết hiệu lực. Hãy tạo hoặc vào phòng lại.',
  NOT_HOST: 'Chỉ chủ phòng thực hiện được thao tác này.',
  FACE_TAKEN: 'Người kia đã chọn mặt này.',
  COIN_ALREADY_TOSSED: 'Đồng xu đã được tung.',
  FACES_REQUIRED: 'Cần hai người đang kết nối và đã chọn mặt.',
  COIN_REQUIRED: 'Hãy tung xu và chờ cả hai người kết nối.',
  WRONG_PHASE: 'Ván đã chuyển trạng thái.',
  WRONG_TURN: 'Chưa đến lượt bạn.',
  INVALID_CELL: 'Ô này không còn trống hoặc nằm ngoài bàn.',
};

export function OnlineGame({ renderBoard }: {
  renderBoard: (board: Snapshot['board'], canPlace: boolean, onPlace: (row: number, col: number) => void) => ReactNode;
}) {
  const socket = useRef<WebSocket | null>(null);
  const [connection, setConnection] = useState<'connecting' | 'open' | 'closed'>('connecting');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const client = new WebSocket(`${protocol}//${location.host}/ws`);
    socket.current = client;
    client.onopen = () => {
      setConnection('open');
      const saved = sessionStorage.getItem(sessionKey);
      if (saved) {
        try {
          const { roomCode, token } = JSON.parse(saved) as { roomCode: string; token: string };
          client.send(JSON.stringify({ type: 'resume', roomCode, token } satisfies ClientMessage));
        } catch {
          sessionStorage.removeItem(sessionKey);
        }
      }
    };
    client.onclose = () => {
      setConnection('closed');
      setPending(false);
    };
    client.onmessage = ({ data }) => {
      const message = JSON.parse(String(data)) as ServerMessage;
      switch (message.type) {
        case 'session':
          sessionStorage.setItem(sessionKey, JSON.stringify({ roomCode: message.roomCode, token: message.token }));
          break;
        case 'snapshot':
          setSnapshot(message.snapshot);
          setPending(false);
          break;
        case 'error':
        case 'commandResult':
          if (message.type === 'error' || message.error || message.duplicate) setPending(false);
          if (message.error) {
            setError(errors[message.error] ?? 'Không thể thực hiện thao tác.');
            if (message.type === 'error' && ['INVALID_SESSION', 'ROOM_NOT_FOUND'].includes(message.error)) {
              sessionStorage.removeItem(sessionKey);
              setSnapshot(null);
            }
          }
          break;
      }
    };
    return () => {
      client.onopen = client.onclose = client.onmessage = null;
      client.close();
    };
  }, [attempt]);

  function send(message: ClientMessage) {
    if (socket.current?.readyState !== WebSocket.OPEN || pending) return;
    setError('');
    setPending(true);
    socket.current.send(JSON.stringify(message));
  }

  function command(action: ClientAction) {
    if (!snapshot) return;
    send({ type: 'command', command: {
      ...action, commandId: crypto.randomUUID(), expectedPhase: snapshot.phase,
    } });
  }

  const disabled = connection !== 'open' || pending;
  const opponent = snapshot?.players.find(player => player.host !== snapshot.you.host);

  return (
    <section className="online">
      {connection === 'connecting' && <p role="status">Đang kết nối…</p>}
      {connection === 'closed' && (
        <div className="room-actions">
          <p role="status">Mất kết nối.</p>
          <button className="restart" onClick={() => {
            setConnection('connecting');
            setAttempt(current => current + 1);
          }}>Kết nối lại</button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {!snapshot ? (
        <form className="room-actions" onSubmit={event => {
          event.preventDefault();
          send({ type: 'join', roomCode: code });
        }}>
          <button className="restart" type="button" disabled={disabled}
            onClick={() => send({ type: 'create' })}>Tạo phòng</button>
          <label>Mã phòng <input value={code} maxLength={8}
            onChange={event => setCode(event.target.value.trim().toUpperCase())} /></label>
          <button className="restart" disabled={disabled || code.length !== 8}>Vào phòng</button>
        </form>
      ) : (
        <>
          <p>Mã phòng <strong>{snapshot.roomCode}</strong>{snapshot.you.seat && ` · Bạn là ${snapshot.you.seat}`}</p>
          {opponent && !opponent.online && <p role="status">Đối thủ đã mất kết nối.</p>}
          {snapshot.phase === 'LOBBY' ? (
            <>
              {!opponent && <p>Gửi mã phòng cho người thứ hai.</p>}
              {snapshot.coin ? (
                <p role="status">Đồng xu ra mặt <strong>{faces[snapshot.coin]}</strong>.</p>
              ) : (
                <div className="room-actions" role="group" aria-label="Chọn mặt đồng xu">
                  {(['heads', 'tails'] as const).map(face => (
                    <button key={face} className="restart" disabled={disabled || opponent?.face === face}
                      aria-pressed={snapshot.you.face === face}
                      onClick={() => command({ type: 'chooseFace', face })}>{faces[face]}</button>
                  ))}
                  {opponent?.face && <span>Đối thủ chọn {faces[opponent.face]}.</span>}
                </div>
              )}
              {snapshot.you.host && <div className="room-actions">
                {snapshot.coin
                  ? <button className="restart" disabled={disabled || !opponent?.online}
                    onClick={() => command({ type: 'start' })}>Bắt đầu</button>
                  : <button className="restart" disabled={disabled || !snapshot.you.face || !opponent?.face || !opponent.online}
                    onClick={() => command({ type: 'toss' })}>Tung xu</button>}
              </div>}
              {!snapshot.you.host && snapshot.coin && <p>Đang chờ chủ phòng bắt đầu.</p>}
            </>
          ) : (
            <>
              <p role="status">{snapshot.result?.kind === 'draw' ? 'Hòa ván'
                : snapshot.result?.kind === 'win' ? `${snapshot.result.winner} thắng`
                  : `Lượt của ${snapshot.turn}`}</p>
              {renderBoard(snapshot.board, !disabled && snapshot.phase === 'ACTION' && snapshot.turn === snapshot.you.seat,
                (row, col) => command({ type: 'place', row, col }))}
            </>
          )}
        </>
      )}
    </section>
  );
}
