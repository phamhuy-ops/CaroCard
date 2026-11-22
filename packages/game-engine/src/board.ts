import constants from '../../../spec/data/constants.json' with { type: 'json' };
import cardRules from '../data/normal-cards.json' with { type: 'json' };

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
  wallOwners: Readonly<Partial<Record<number, Seat>>>;
  darkWallSources: Readonly<Partial<Record<number, string>>>;
}

export type Square = { row: number; col: number };

export function isEdge({ row, col }: Square) {
  return row === 0 || col === 0 || row === size - 1 || col === size - 1;
}

function ray(board: readonly Cell[], row: number, col: number, dr: number, dc: number, seat: Seat) {
  let length = 0;
  while (inBounds(row += dr, col += dc) && board[row * size + col] === seat) length++;
  return length;
}

export function hasRunAt(board: readonly Cell[], { row, col }: Square, seat: Seat, length: number) {
  return board[row * size + col] === seat && directions.some(([dr, dc]) =>
    1 + ray(board, row, col, dr, dc, seat) + ray(board, row, col, -dr, -dc, seat) >= length);
}

export function blocksRun(board: readonly Cell[], { row, col }: Square, seat: Seat, length: number) {
  return directions.some(([dr, dc]) =>
    ray(board, row, col, dr, dc, seat) >= length || ray(board, row, col, -dr, -dc, seat) >= length);
}

export function winningLine(board: readonly Cell[], winner: Seat): { from: Square; to: Square } | null {
  for (let index = 0; index < board.length; index++) {
    if (board[index] !== winner) continue;
    const row = Math.floor(index / size);
    const col = index % size;
    for (const [dr, dc] of directions) {
      const previousRow = row - dr;
      const previousCol = col - dc;
      if (inBounds(previousRow, previousCol) && board[previousRow * size + previousCol] === winner) continue;
      let length = 1;
      while (inBounds(row + dr * length, col + dc * length)
        && board[(row + dr * length) * size + col + dc * length] === winner) length++;
      if (length >= winLength) {
        return { from: { row, col }, to: { row: row + dr * (length - 1), col: col + dc * (length - 1) } };
      }
    }
  }
  return null;
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
  return { board: Array<Cell>(cells).fill(null), turn: 'X', result: null, wallOwners: {}, darkWallSources: {} };
}

export function placeTurn(game: Game, row: number, col: number, keepTurn = false): Game {
  if (game.result) return game;
  const { board, result } = resolvePlacements(game.board, [{ row, col, cell: game.turn }]);
  if (board === game.board) return game;
  return { ...game, board, result, turn: result || keepTurn ? game.turn : game.turn === 'X' ? 'O' : 'X' };
}

function newAngleDestination(board: readonly Cell[], from: Square, to: Square, star: number) {
  const radius = cardRules.newAngle.radius[star - 1];
  return radius !== undefined && inBounds(to.row, to.col) && board[to.row * size + to.col] === null
    && (radius === null || Math.max(Math.abs(from.row - to.row), Math.abs(from.col - to.col)) <= radius);
}

export function newAngleTargets(board: readonly Cell[], seat: Seat, star: number, from: Square): Square[] {
  if (!inBounds(from.row, from.col) || board[from.row * size + from.col] !== seat) return [];
  const radius = cardRules.newAngle.radius[star - 1] ?? size;
  const targets: Square[] = [];
  for (let row = Math.max(0, from.row - radius); row <= Math.min(size - 1, from.row + radius); row++) {
    for (let col = Math.max(0, from.col - radius); col <= Math.min(size - 1, from.col + radius); col++) {
      const to = { row, col };
      if (newAngleDestination(board, from, to, star)) targets.push(to);
    }
  }
  return targets;
}

export function moveWithNewAngle(game: Game, star: number, from: Square, to: Square): Game | null {
  if (game.result || !inBounds(from.row, from.col) || game.board[from.row * size + from.col] !== game.turn
    || !newAngleDestination(game.board, from, to, star)) return null;
  const lifted = [...game.board];
  lifted[from.row * size + from.col] = null;
  const { board, result } = resolvePlacements(lifted, [{ ...to, cell: game.turn }]);
  return { ...game, board, result };
}

export function wallsForStar(star: number) {
  return cardRules.makeshiftWall.wallsByStar[star - 1] ?? 0;
}

export function remainingWallCapacity(game: Game, seat: Seat) {
  const owned = game.board.reduce((count, cell, index) =>
    cell === 'Makeshift Wall' && game.wallOwners[index] === seat ? count + 1 : count, 0);
  return Math.max(0, cardRules.makeshiftWall.maxOnBoardPerSeat - owned);
}

export function placeMakeshiftWalls(game: Game, star: number, squares: readonly Square[]): Game | null {
  const count = wallsForStar(star);
  if (game.result || count === 0 || squares.length !== count || count > remainingWallCapacity(game, game.turn)) return null;
  const placements = squares.map(square => ({ ...square, cell: 'Makeshift Wall' as const }));
  // The placement pipeline rejects the entire set if any coordinate is occupied, repeated or invalid.
  const { board, result } = resolvePlacements(game.board, placements);
  if (board === game.board) return null;
  const wallOwners = { ...game.wallOwners };
  for (const { row, col } of squares) wallOwners[row * size + col] = game.turn;
  return { ...game, board, result, wallOwners };
}

export function blastMakeshiftWall(game: Game, { row, col }: Square): Game | null {
  const index = row * size + col;
  if (game.result || !inBounds(row, col) || game.board[index] !== 'Makeshift Wall') return null;
  const board = [...game.board];
  board[index] = null;
  const wallOwners = { ...game.wallOwners };
  delete wallOwners[index];
  return { ...game, board, wallOwners };
}

export function removeDarkWalls(game: Game, sourceId: string): Game {
  const board = [...game.board];
  const darkWallSources = { ...game.darkWallSources };
  for (const [index, source] of Object.entries(game.darkWallSources)) {
    if (source !== sourceId) continue;
    const square = Number(index);
    if (board[square] === 'Dark Wall') board[square] = null;
    delete darkWallSources[square];
  }
  return { ...game, board, darkWallSources };
}
