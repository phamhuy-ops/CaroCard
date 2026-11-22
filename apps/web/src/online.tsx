import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ClientAction, ClientMessage, Face, Seat, ServerMessage, Snapshot } from '@carocard/shared';
import { boardSize, newAngleTargets, wallsForStar } from '@carocard/game-engine';
import type { Square } from '@carocard/game-engine';

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
  ALREADY_READY: 'Bạn đã sẵn sàng.',
  CHOICE_PENDING: 'Đang chờ lựa chọn.',
  SHOP_HELD: 'Tắt giữ Shop trước khi đổi.',
  NOT_ENOUGH_COINS: 'Bạn không đủ xu.',
  SLOT_BLOCKED: 'Ô Shop này đang bị khóa.',
  EMPTY_SLOT: 'Ô này đang trống.',
  BENCH_FULL: 'Kho bài đã đầy.',
  CARD_ALREADY_OWNED: 'Bạn đã có thẻ này trong kho.',
  DEMON_LIMIT: 'Bạn đã có tối đa hai Demon đang khóa.',
  CANNOT_DISCARD: 'Thẻ này không thể vứt từ kho.',
  CANNOT_USE_CARD: 'Không thể dùng thẻ này lúc này.',
  ACTION_USED: 'Bạn đã thực hiện thao tác này trong lượt.',
  STALE_CHOICE: 'Hộp lựa chọn đã đóng hoặc không dành cho bạn.',
  BUY_LOCKED: 'Tối hậu thư đang khóa lượt mua thẻ.',
  CARD_LOCKED: 'Tối hậu thư đang khóa quyền dùng thẻ.',
  ULTIMATUM_ACTIVE: 'Chờ Tối hậu thư trước hết hiệu lực.',
  INVALID_MOVE: 'Nước dời quân không hợp lệ.',
  INVALID_WALLS: 'Chọn đủ ô trống khác nhau và kiểm tra chỗ đặt tường còn lại.',
  INVALID_SPECIAL_TARGET: 'Mục tiêu của thẻ đặc biệt không hợp lệ.',
};

const rarityLabels: Record<string, string> = {
  common: 'Thường', rare: 'Hiếm', epic: 'Sử thi', legendary: 'Huyền thoại',
  special: 'Đặc biệt', demon: 'Demon',
};

function ShopPanel({ snapshot, disabled, command, onUse }: {
  snapshot: Snapshot;
  disabled: boolean;
  command: (action: ClientAction) => void;
  onUse: (slot: number) => void;
}) {
  const { shop, bench, hold, freeRerolls } = snapshot.you.privateState;
  const { round } = snapshot;
  const seat = snapshot.you.seat;
  const canTrade = !disabled && seat !== null && snapshot.preparation?.[seat].ready === false;
  const coins = seat ? snapshot.coins[seat] : 0;

  return (
    <section className="shop-panel" aria-label="Shop và kho bài của bạn">
      {snapshot.preparation && <>
      <div className="shop-header">
        <h2>Shop</h2>
        <div className="room-actions">
          <button className="restart" aria-pressed={hold} disabled={!canTrade}
            onClick={() => command({ type: 'toggleHold', round })}>{hold ? 'Bỏ giữ Shop' : 'Giữ Shop'}</button>
          <button className="restart" disabled={!canTrade || hold}
            onClick={() => command({ type: 'reroll', round })}>
            {freeRerolls ? `Đổi Shop · ${freeRerolls} miễn phí` : 'Đổi Shop bằng xu'}
          </button>
        </div>
      </div>
      <ul className="shop-slots">
        {shop.map(({ card, blocked }, slot) => (
          <li className="shop-card" key={slot}>
            {card ? <>
              <strong>{card.name}</strong>
              <span>{rarityLabels[card.rarity]} · {card.cost} xu</span>
              <button className="restart" disabled={!canTrade || !snapshot.you.canBuy || blocked || card.cost > coins}
                aria-label={blocked ? `Ô ${slot + 1} bị khóa` : `Mua ${card.name} ở ô ${slot + 1}`}
                onClick={() => command({ type: 'buy', round, slot })}>{blocked ? 'Bị khóa' : 'Mua'}</button>
            </> : <span>{blocked ? 'Ô trống bị khóa' : 'Ô trống'}</span>}
          </li>
        ))}
      </ul>
      {!snapshot.you.canBuy && <p>Tối hậu thư khóa mua thẻ trong vòng này.</p>}
      </>}
      <h2>Kho bài</h2>
      {bench.length === 0 ? <p>Kho trống</p> : (
        <ul className="bench-list">
          {bench.map((card, slot) => (
            <li className="shop-card" key={slot}>
              <strong>{card.name}{card.star > 0 ? ` · ${card.star}★` : ''}</strong>
              <span>{card.rarity === 'demon' ? 'Demon · Đang khóa' : rarityLabels[card.rarity]}</span>
              {card.piggy && <span>Chuỗi tiết kiệm: {card.piggy.noSpendRounds} · Đã sinh {card.piggy.totalEarned} xu</span>}
              {snapshot.preparation && card.canDiscard && <button className="restart" disabled={!canTrade}
                aria-label={`${card.piggy ? 'Đập heo' : 'Vứt'} ${card.name} ở ô ${slot + 1}`}
                onClick={() => command({ type: 'discard', round, slot })}>{card.piggy ? 'Đập heo' : 'Vứt'}</button>}
              {card.canUse && <button className="restart" disabled={disabled}
                aria-label={`Dùng ${card.name} ở ô ${slot + 1}`}
                onClick={() => onUse(slot)}>Dùng thẻ</button>}
              {((['BUF-R01', 'BUF-E01', 'SPC-02'].includes(card.id) && snapshot.phase === 'ACTION' && snapshot.turn === seat)
                || (card.id === 'SPC-03' && snapshot.phase === 'PREPARATION')) && !card.canUse &&
                <button className="restart" disabled>Dùng thẻ</button>}
              {card.id === 'BUF-E01' && <span>Chỗ đặt tường còn lại: {snapshot.you.wallsRemaining}</span>}
              {card.id === 'DEB-R01' && snapshot.ultimatumLocked &&
                <span>Chờ Tối hậu thư trước hết hiệu lực.</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function UltimatumDialog({ details, seconds, disabled, answer }: {
  details: NonNullable<Snapshot['ultimatum']>;
  seconds: number;
  disabled: boolean;
  answer: (choice: 'accept' | 'resist') => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const { star, canResist, blocks, coinThreshold, coinPenalty, destroy, lockedRounds } = details;
  const accept = star === 1 ? 'Không mua thẻ trong vòng sau.'
    : star === 2 ? `Cuối vòng sau, mất ${coinPenalty} xu nếu còn từ ${coinThreshold} xu trở lên.`
      : `Không dùng thẻ trong ${lockedRounds} vòng tiếp theo.`;
  const resist = star === 1 ? `Vòng sau bị khóa ${blocks} ô Shop và mất lượt Reroll miễn phí của hệ thống.`
    : star === 2 ? `Trừ ngay ${coinPenalty} xu.`
      : `Phá ngẫu nhiên tối đa ${destroy} thẻ thường trong kho.`;
  return (
    <dialog ref={dialog} className="ultimatum" aria-labelledby="ultimatum-title"
      onCancel={event => event.preventDefault()}>
      <h2 id="ultimatum-title">Brutal Ultimatum · {star}★</h2>
      <p>Còn {seconds} giây</p>
      <p><strong>Chấp nhận</strong> · {accept}</p>
      <p><strong>Chống lại</strong> · {resist}</p>
      {!canResist && <p>Bạn chưa đủ xu để chống lại.</p>}
      <div className="room-actions">
        <button className="restart" disabled={disabled} onClick={() => answer('accept')}>Chấp nhận</button>
        <button className="restart" disabled={disabled || !canResist} onClick={() => answer('resist')}>Chống lại</button>
      </div>
    </dialog>
  );
}

function commandId() {
  // getRandomValues is also available over HTTP on the local network.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export interface BoardSelection {
  canSelect: (row: number, col: number) => boolean;
  selected: (row: number, col: number) => boolean;
}

export function OnlineGame({ renderBoard }: {
  renderBoard: (board: Snapshot['board'], canPlace: boolean, onPlace: (row: number, col: number) => void,
    selection?: BoardSelection, winner?: Seat) => ReactNode;
}) {
  const socket = useRef<WebSocket | null>(null);
  const outstanding = useRef<Extract<ClientMessage, { type: 'command' }> | null>(null);
  const [connection, setConnection] = useState<'connecting' | 'open' | 'closed' | 'replaced'>('connecting');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [offset, setOffset] = useState(0);
  const [clock, setClock] = useState(() => performance.now());
  const [angle, setAngle] = useState<{ round: number; slot: number; from: Square | null } | null>(null);
  const [wall, setWall] = useState<{ round: number; slot: number; squares: Square[] } | null>(null);
  const [special, setSpecial] = useState<{ round: number; slot: number; id: 'SPC-02' | 'SPC-03' } | null>(null);

  useEffect(() => {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    let attempts = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    function connect() {
      const client = new WebSocket(`${protocol}//${location.host}/ws`);
      socket.current = client;
      client.onopen = () => {
        const saved = sessionStorage.getItem(sessionKey);
        if (saved) {
          try {
            const { roomCode, token } = JSON.parse(saved) as { roomCode: string; token: string };
            client.send(JSON.stringify({ type: 'resume', roomCode, token } satisfies ClientMessage));
            return;
          } catch {
            sessionStorage.removeItem(sessionKey);
          }
        }
        attempts = 0;
        setConnection('open');
      };
      client.onclose = event => {
        if (event.code === 4001) {
          setConnection('replaced');
          return;
        }
        setConnection('closed');
        setPending(outstanding.current !== null);
        retry = setTimeout(connect, Math.min(500 * 2 ** attempts++, 5000));
      };
      client.onmessage = ({ data }) => {
        const message = JSON.parse(String(data)) as ServerMessage;
        switch (message.type) {
          case 'session':
            attempts = 0;
            sessionStorage.setItem(sessionKey, JSON.stringify({ roomCode: message.roomCode, token: message.token }));
            if (outstanding.current) client.send(JSON.stringify(outstanding.current));
            break;
          case 'snapshot': {
            const receivedAt = performance.now();
            setSnapshot(message.snapshot);
            setOffset(message.snapshot.serverTime - receivedAt);
            setClock(receivedAt);
            setConnection('open');
            if (!outstanding.current) setPending(false);
            break;
          }
          case 'commandResult':
            if (message.commandId !== outstanding.current?.command.commandId) break;
            outstanding.current = null;
            if (message.error || message.duplicate) setPending(false);
            if (message.error) setError(errors[message.error] ?? 'Không thể thực hiện thao tác.');
            break;
          case 'error':
            setPending(false);
            setError(errors[message.error] ?? 'Không thể thực hiện thao tác.');
            if (['INVALID_SESSION', 'ROOM_NOT_FOUND'].includes(message.error)) {
              if (sessionStorage.getItem(sessionKey)) {
                sessionStorage.removeItem(sessionKey);
                outstanding.current = null;
                setSnapshot(null);
              }
              setConnection('open');
            }
            break;
        }
      };
    }
    connect();
    const tick = setInterval(() => setClock(performance.now()), 250);
    return () => {
      clearTimeout(retry);
      clearInterval(tick);
      const client = socket.current;
      if (client) {
        client.onopen = client.onclose = client.onmessage = null;
        client.close();
      }
    };
  }, []);

  function send(message: ClientMessage) {
    if (socket.current?.readyState !== WebSocket.OPEN || pending) return;
    setError('');
    setPending(true);
    if (message.type === 'command') outstanding.current = message;
    socket.current.send(JSON.stringify(message));
  }

  function command(action: ClientAction) {
    if (!snapshot) return;
    send({ type: 'command', command: {
      ...action, commandId: commandId(), expectedPhase: snapshot.phase,
    } });
  }

  const disabled = connection !== 'open' || pending;
  const opponent = snapshot?.players.find(player => player.host !== snapshot.you.host);
  const seconds = (deadline: number) => Math.max(0, Math.ceil((deadline - clock - offset) / 1000));
  const hair = snapshot?.you.hairTrigger;
  const angleCard = angle && snapshot?.round === angle.round ? snapshot.you.privateState.bench[angle.slot] : null;
  const selecting = angle && angleCard?.id === 'BUF-R01' && angleCard.canUse && snapshot?.you.seat
    ? { ...angle, star: angleCard.star, seat: snapshot.you.seat } : null;
  const destinations = selecting?.from && snapshot
    ? newAngleTargets(snapshot.board, selecting.seat, selecting.star, selecting.from) : [];
  const boardSelection: BoardSelection | undefined = selecting && snapshot ? {
    selected: (row, col) => row === selecting.from?.row && col === selecting.from?.col,
    canSelect: (row, col) => !disabled && (selecting.from
      ? destinations.some(square => square.row === row && square.col === col)
      : newAngleTargets(snapshot.board, selecting.seat, selecting.star, { row, col }).length > 0),
  } : undefined;
  const wallCard = wall && snapshot?.round === wall.round ? snapshot.you.privateState.bench[wall.slot] : null;
  const building = wall && wallCard?.id === 'BUF-E01' && wallCard.canUse
    ? { ...wall, required: wallsForStar(wallCard.star) } : null;
  const wallSelection: BoardSelection | undefined = building && snapshot ? {
    selected: (row, col) => building.squares.some(square => square.row === row && square.col === col),
    canSelect: (row, col) => !disabled && snapshot.board[row * boardSize + col] === null
      && (building.squares.length < building.required || building.squares.some(square => square.row === row && square.col === col)),
  } : undefined;
  const specialCard = special && snapshot?.round === special.round ? snapshot.you.privateState.bench[special.slot] : null;
  const pickingSpecial = special && specialCard?.id === special.id && specialCard.canUse ? special : null;
  const blastSelection: BoardSelection | undefined = pickingSpecial?.id === 'SPC-02' && snapshot ? {
    selected: () => false,
    canSelect: (row, col) => !disabled && snapshot.board[row * boardSize + col] === 'Makeshift Wall',
  } : undefined;

  function clickBoard(row: number, col: number) {
    if (pickingSpecial?.id === 'SPC-02') {
      command({ type: 'useCard', slot: pickingSpecial.slot, blast: { row, col } });
      setSpecial(null);
    } else if (building) {
      const selected = building.squares.some(square => square.row === row && square.col === col);
      const squares = selected ? building.squares.filter(square => square.row !== row || square.col !== col)
        : [...building.squares, { row, col }];
      setWall({ round: building.round, slot: building.slot, squares });
    } else if (!selecting) {
      command({ type: 'place', row, col });
    } else if (selecting.from) {
      command({ type: 'useCard', slot: selecting.slot, move: { from: selecting.from, to: { row, col } } });
      setAngle(null);
    } else {
      setAngle({ ...selecting, from: { row, col } });
    }
  }

  return (
    <section className="online">
      {connection === 'connecting' && <p role="status">Đang kết nối…</p>}
      {connection === 'closed' && <p role="status">Mất kết nối. Đang thử kết nối lại…</p>}
      {connection === 'replaced' && <p role="status">Phiên đang mở ở tab khác.</p>}
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
              <p>Vòng {snapshot.round} · X: {snapshot.coins.X} xu · O: {snapshot.coins.O} xu</p>
              {snapshot.nextRoundAt !== null && <p role="status">Vòng {snapshot.round + 1} bắt đầu sau {seconds(snapshot.nextRoundAt)} giây.</p>}
              {snapshot.lastCard && <p>{snapshot.lastCard.seat} đã dùng {snapshot.lastCard.name}.</p>}
              {hair && <p>{snapshot.round < hair.from
                ? `Hair-Trigger bắt đầu từ vòng ${hair.from}.`
                : `Hair-Trigger đến hết vòng ${hair.through} · Dùng một thẻ tương thích và đặt một dấu theo thứ tự tùy chọn.`}</p>}
              {hair && snapshot.round >= hair.from && snapshot.you.canEndTurn && (
                <p>{snapshot.you.canPlace ? 'Bạn còn có thể đặt một dấu.'
                  : snapshot.you.privateState.bench.some(card => card.canUse) ? 'Bạn còn có thể dùng một thẻ tương thích.'
                    : 'Bạn có thể kết thúc lượt.'}</p>
              )}
              {snapshot.preparation && snapshot.you.seat && (
                <div className="room-actions">
                  <span>Chuẩn bị · {(['X', 'O'] as const).map(seat => {
                    const prep = snapshot.preparation?.[seat];
                    return prep?.ready ? `${seat}: đã sẵn sàng` : `${seat}: ${seconds(prep?.deadline ?? 0)} giây`;
                  }).join(' · ')}</span>
                  <button className="restart" disabled={disabled || snapshot.preparation[snapshot.you.seat].ready}
                    onClick={() => command({ type: 'ready' })}>Sẵn sàng</button>
                </div>
              )}
              {snapshot.result && <p role="status">{snapshot.result.kind === 'draw' ? 'Hòa ván'
                : snapshot.result.kind === 'cancelled' ? 'Ván đã hủy do mất kết nối'
                  : snapshot.result.kind === 'win' && `${snapshot.result.winner} thắng${snapshot.result.reason === 'disconnect' ? ' do đối thủ mất kết nối' : ''}`}</p>}
              {snapshot.phase === 'ACTION' && <p>Lượt của {snapshot.turn}{snapshot.actionDeadline !== null
                ? ` · ${seconds(snapshot.actionDeadline)} giây`
                : snapshot.choiceWindow ? ` · Còn ${seconds(snapshot.choiceWindow.deadline)} giây để chọn` : ' · Đang chờ lựa chọn'}</p>}
              {snapshot.choiceWindow && snapshot.ultimatum && (
                <UltimatumDialog key={snapshot.choiceWindow.id} details={snapshot.ultimatum}
                  seconds={seconds(snapshot.choiceWindow.deadline)} disabled={disabled}
                  answer={choice => {
                    if (snapshot.choiceWindow) command({ type: 'answerUltimatum', windowId: snapshot.choiceWindow.id, choice });
                  }} />
              )}
              {snapshot.you.canEndTurn && <div className="room-actions">
                <button className="restart" disabled={disabled}
                  onClick={() => command({ type: 'endTurn' })}>Kết thúc lượt</button>
              </div>}
              <ShopPanel snapshot={snapshot} disabled={disabled} command={command} onUse={slot => {
                const { id } = snapshot.you.privateState.bench[slot];
                setAngle(null);
                setWall(null);
                setSpecial(null);
                if (id === 'BUF-R01') {
                  setAngle({ round: snapshot.round, slot, from: null });
                } else if (id === 'BUF-E01') {
                  setWall({ round: snapshot.round, slot, squares: [] });
                } else if (id === 'SPC-02' || id === 'SPC-03') {
                  setSpecial({ round: snapshot.round, slot, id });
                } else {
                  command({ type: 'useCard', slot });
                }
              }} />
              {pickingSpecial?.id === 'SPC-03' && <div className="room-actions" role="group" aria-label="Chọn thẻ để sao chép">
                <p>Chọn thẻ để tạo bản sao 1★.</p>
                {snapshot.you.privateState.bench.map((card, targetSlot) => card.mirrorTarget && (
                  <button key={targetSlot} className="restart" disabled={disabled}
                    onClick={() => {
                      command({ type: 'mirror', round: snapshot.round, slot: pickingSpecial.slot, targetSlot });
                      setSpecial(null);
                    }}>{card.name} · {card.star}★ · ô {targetSlot + 1}</button>
                ))}
                <button className="restart" onClick={() => setSpecial(null)}>Hủy chọn</button>
              </div>}
              {pickingSpecial?.id === 'SPC-02' && <div className="room-actions">
                <p role="status">Chọn tường Makeshift Wall để phá.</p>
                <button className="restart" onClick={() => setSpecial(null)}>Hủy chọn</button>
              </div>}
              {selecting && <div className="room-actions">
                <p role="status">{selecting.from ? 'Chọn ô trống để dời quân.' : 'Chọn quân của bạn để dời.'}</p>
                {selecting.from && <button className="restart"
                  onClick={() => setAngle({ ...selecting, from: null })}>Chọn lại quân</button>}
                <button className="restart" onClick={() => setAngle(null)}>Hủy chọn</button>
              </div>}
              {building && <div className="room-actions">
                <p role="status">Chọn ô trống để đặt tường · {building.squares.length}/{building.required}</p>
                <button className="restart" disabled={disabled || building.squares.length !== building.required}
                  onClick={() => {
                    command({ type: 'useCard', slot: building.slot, walls: building.squares });
                    setWall(null);
                  }}>Đặt tường</button>
                <button className="restart" onClick={() => setWall(null)}>Hủy chọn</button>
              </div>}
              {renderBoard(snapshot.board, !disabled && snapshot.you.canPlace, clickBoard, blastSelection ?? wallSelection ?? boardSelection,
                snapshot.result?.kind === 'win' && snapshot.result.reason === 'fiveInRow' ? snapshot.result.winner : undefined)}
            </>
          )}
        </>
      )}
    </section>
  );
}
