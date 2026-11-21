import constants from '../../../spec/data/constants.json' with { type: 'json' };

export type Seat = 'X' | 'O';
export type Cell = Seat | 'Dark Wall' | 'Makeshift Wall' | null;

export interface Placement {
  row: number;
  col: number;
  cell: Exclude<Cell, null>;
}

export type Result =
  | { kind: 'win'; winner: Seat; reason: 'hellsDealer' | 'fiveInRow' }
  | { kind: 'draw' };

export interface Game {
  board: readonly Cell[];
  turn: Seat;
  result: Result | null;
}

const { size, cells, winLength, overlineWins, blockedBothEndsWins } = constants.board;
export const boardSize = size;
const directions = [[0, 1], [1, 0], [1, 1], [1, -1]] as const;

function inBounds(row: number, col: number) {
  return Number.isInteger(row) && Number.isInteger(col)
    && row >= 0 && row < size && col >= 0 && col < size;
}

function hasWinningLine(board: readonly Cell[], { row, col, cell }: Placement) {
  if (cell !== 'X' && cell !== 'O') return false;

  return directions.some(([dr, dc]) => {
    let length = 1;
    let blockedEnds = 0;
    for (const sign of [-1, 1]) {
      let r = row + sign * dr;
      let c = col + sign * dc;
      while (inBounds(r, c) && board[r * size + c] === cell) {
        length++;
        r += sign * dr;
        c += sign * dc;
      }
      if (!inBounds(r, c) || board[r * size + c] !== null) blockedEnds++;
    }
    return (length === winLength || (overlineWins && length > winLength))
      && (blockedBothEndsWins || blockedEnds < 2);
  });
}

export function resolvePlacements(
  board: readonly Cell[],
  placements: readonly Placement[],
  checkHellsDealer?: (board: readonly Cell[]) => Seat | undefined,
): { board: readonly Cell[]; result: Result | null } {
  if (placements.length === 0) return { board, result: null };
  const next = [...board];
  let lineWinner: Seat | undefined;

  for (const placement of placements) {
    const { row, col, cell } = placement;
    const index = row * size + col;
    if (!inBounds(row, col) || next[index] !== null) return { board, result: null };
    next[index] = cell;
    if (!lineWinner && (cell === 'X' || cell === 'O') && hasWinningLine(next, placement)) {
      lineWinner = cell;
    }
  }

  for (const check of constants.winCheckOrder) {
    switch (check) {
      case 'hellsDealer': {
        const winner = checkHellsDealer?.(next);
        if (winner) return { board: next, result: { kind: 'win', winner, reason: check } };
        break;
      }
      case 'fiveInRow':
        if (lineWinner) return { board: next, result: { kind: 'win', winner: lineWinner, reason: check } };
        break;
      case 'fullBoardDraw':
        if (next.every(cell => cell !== null)) return { board: next, result: { kind: 'draw' } };
        break;
    }
  }
  return { board: next, result: null };
}

export function createGame(): Game {
  return { board: Array<Cell>(cells).fill(null), turn: 'X', result: null };
}

export function placeTurn(game: Game, row: number, col: number): Game {
  if (game.result) return game;
  const { board, result } = resolvePlacements(game.board, [{ row, col, cell: game.turn }]);
  if (board === game.board) return game;
  return { board, result, turn: result ? game.turn : game.turn === 'X' ? 'O' : 'X' };
}
