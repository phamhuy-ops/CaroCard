import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { boardSize, createGame, placeTurn } from '@carocard/game-engine';
import './style.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Không tìm thấy phần tử root');
}

function App() {
  const [game, setGame] = useState(createGame);
  const status = game.result?.kind === 'draw'
    ? 'Hòa ván'
    : game.result?.kind === 'win'
      ? `${game.result.winner} thắng`
      : `Lượt của ${game.turn}`;

  return (
    <main>
      <header>
        <h1>CaroCard</h1>
        <button className="restart" onClick={() => setGame(createGame())}>Chơi lại</button>
      </header>
      <p role="status">{status}</p>
      <div className="board" aria-label="Bàn cờ Caro" role="group"
        style={{ gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))` }}>
        {game.board.map((cell, index) => {
          const row = Math.floor(index / boardSize);
          const col = index % boardSize;
          return (
            <button key={index} className="cell" data-mark={cell ?? undefined}
              aria-label={`Hàng ${row + 1}, cột ${col + 1}${cell ? `, ${cell}` : ''}`}
              disabled={cell !== null || game.result !== null}
              onClick={() => setGame(current => placeTurn(current, row, col))}>
              {cell}
            </button>
          );
        })}
      </div>
    </main>
  );
}

createRoot(container).render(<App />);
