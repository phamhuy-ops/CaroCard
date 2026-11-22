import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { boardSize, createGame, placeTurn, winningLine } from '@carocard/game-engine';
import type { Seat } from '@carocard/game-engine';
import { OnlineGame } from './online.tsx';
import type { BoardSelection } from './online.tsx';
import './style.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Không tìm thấy phần tử root');
}

function Board({ board, canPlace, onPlace, selection, winner }: {
  board: ReturnType<typeof createGame>['board'];
  canPlace: boolean;
  onPlace: (row: number, col: number) => void;
  selection?: BoardSelection;
  winner?: Seat;
}) {
  const line = winner ? winningLine(board, winner) : null;
  const dx = line ? line.to.col - line.from.col : 0;
  const dy = line ? line.to.row - line.from.row : 0;
  return (
    <div className="board" aria-label="Bàn cờ Caro" role="group"
      style={{ gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))` }}>
      {board.map((cell, index) => {
        const row = Math.floor(index / boardSize);
        const col = index % boardSize;
        const enabled = selection ? selection.canSelect(row, col) : cell === null && canPlace;
        return (
          <button key={index} className="cell" data-mark={cell ?? undefined}
            aria-label={`Hàng ${row + 1}, cột ${col + 1}${cell ? `, ${cell}` : ''}`}
            data-target={selection && enabled ? true : undefined}
            aria-pressed={selection ? selection.selected(row, col) : undefined}
            disabled={!enabled}
            onClick={() => onPlace(row, col)}>
            {cell === 'Makeshift Wall' ? '▦' : cell}
          </button>
        );
      })}
      {line && <span aria-hidden="true" className="winning-line" data-winner={winner}
        style={{
          left: `${(line.from.col + 0.5) / boardSize * 100}%`,
          top: `${(line.from.row + 0.5) / boardSize * 100}%`,
          width: `${Math.hypot(dx, dy) / boardSize * 100}%`,
          transform: `translateY(-50%) rotate(${Math.atan2(dy, dx)}rad)`,
        }} />}
    </div>
  );
}

function HotSeat() {
  const [game, setGame] = useState(createGame);
  const status = game.result?.kind === 'draw'
    ? 'Hòa ván'
    : game.result?.kind === 'win'
      ? `${game.result.winner} thắng`
      : `Lượt của ${game.turn}`;

  return (
    <>
      <div className="room-actions">
        <button className="restart" onClick={() => setGame(createGame())}>Chơi lại</button>
      </div>
      <p role="status">{status}</p>
      <Board board={game.board} canPlace={!game.result}
        winner={game.result?.kind === 'win' && game.result.reason === 'fiveInRow' ? game.result.winner : undefined}
        onPlace={(row, col) => setGame(current => placeTurn(current, row, col))} />
    </>
  );
}

function App() {
  const [online, setOnline] = useState(true);
  return (
    <main>
      <header>
        <h1>CaroCard</h1>
        <button className="restart" onClick={() => setOnline(!online)}>
          {online ? 'Chơi cùng máy' : 'Chơi qua phòng'}
        </button>
      </header>
      {online ? <OnlineGame renderBoard={(board, canPlace, onPlace, selection, winner) =>
        <Board board={board} canPlace={canPlace} onPlace={onPlace} selection={selection} winner={winner} />} /> : <HotSeat />}
    </main>
  );
}

createRoot(container).render(<App />);
