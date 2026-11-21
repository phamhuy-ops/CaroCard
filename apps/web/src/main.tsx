import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { boardSize, createGame, placeTurn } from '@carocard/game-engine';
import { OnlineGame } from './online.tsx';
import './style.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Không tìm thấy phần tử root');
}

export function Board({ board, canPlace, onPlace }: {
  board: ReturnType<typeof createGame>['board'];
  canPlace: boolean;
  onPlace: (row: number, col: number) => void;
}) {
  return (
    <div className="board" aria-label="Bàn cờ Caro" role="group"
      style={{ gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))` }}>
      {board.map((cell, index) => {
        const row = Math.floor(index / boardSize);
        const col = index % boardSize;
        return (
          <button key={index} className="cell" data-mark={cell ?? undefined}
            aria-label={`Hàng ${row + 1}, cột ${col + 1}${cell ? `, ${cell}` : ''}`}
            disabled={cell !== null || !canPlace}
            onClick={() => onPlace(row, col)}>
            {cell}
          </button>
        );
      })}
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
      {online ? <OnlineGame renderBoard={(board, canPlace, onPlace) =>
        <Board board={board} canPlace={canPlace} onPlace={onPlace} />} /> : <HotSeat />}
    </main>
  );
}

createRoot(container).render(<App />);
