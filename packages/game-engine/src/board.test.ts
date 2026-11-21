import { describe, expect, test } from 'vitest';
import { boardSize, createGame, placeTurn, resolvePlacements } from './board.ts';
import { createRng } from './rng.ts';

describe('board results', () => {
  test.each([[0, 1], [1, 0], [1, 1], [1, -1]])(
    'detects five along direction (%i, %i)',
    (dr, dc) => {
      const moves = Array.from({ length: 5 }, (_, i) => ({
        row: 2 + dr * i, col: 6 + dc * i, cell: 'X' as const,
      }));
      expect(resolvePlacements(createGame().board, moves).result).toEqual({
        kind: 'win', winner: 'X', reason: 'fiveInRow',
      });
    },
  );

  test('wins with both ends blocked and when bridging to six', () => {
    for (const length of [5, 6]) {
      const moves = Array.from({ length }, (_, i) => i + 1)
        .filter(col => col !== 3)
        .map(col => ({ row: 0, col, cell: 'X' as const }));
      const { board } = resolvePlacements(createGame().board, [
        { row: 0, col: 0, cell: 'O' },
        { row: 0, col: length + 1, cell: 'O' },
        ...moves,
      ]);
      expect(resolvePlacements(board, [{ row: 0, col: 3, cell: 'X' }]).result)
        .toMatchObject({ kind: 'win', winner: 'X' });
    }
  });

  function almostFullBoard() {
    return createGame().board.map((cell, index) => {
      const row = Math.floor(index / boardSize);
      const col = index % boardSize;
      if (index === 0) return 'Dark Wall' as const;
      if (index === 1) return 'Makeshift Wall' as const;
      if (index === 4) return cell;
      return (row + Math.floor(col / 2)) % 2 === 0 ? 'X' as const : 'O' as const;
    });
  }

  test('draws when the final free space is filled and both walls occupy cells', () => {
    expect(resolvePlacements(almostFullBoard(), [{ row: 0, col: 4, cell: 'X' }]).result)
      .toEqual({ kind: 'draw' });
  });

  test('checks Hell’s Dealer before a line, then a line before a full-board draw', () => {
    const board = almostFullBoard();
    board[0] = board[1] = board[2] = board[3] = 'X';
    const moves = [{ row: 0, col: 4, cell: 'X' as const }];
    expect(resolvePlacements(board, moves, () => 'O').result)
      .toEqual({ kind: 'win', winner: 'O', reason: 'hellsDealer' });
    expect(resolvePlacements(board, moves).result)
      .toEqual({ kind: 'win', winner: 'X', reason: 'fiveInRow' });
  });

  test('credits a forced placement to its mark and resolves dual lines in batch order', () => {
    const setup = Array.from({ length: 4 }, (_, col) => [
      { row: 0, col, cell: 'X' as const },
      { row: 1, col, cell: 'O' as const },
    ]).flat();
    const { board } = resolvePlacements(createGame().board, setup);
    const forced = { row: 1, col: 4, cell: 'O' as const };
    const other = { row: 0, col: 4, cell: 'X' as const };
    expect(resolvePlacements(board, [forced]).result).toMatchObject({ winner: 'O' });
    expect(resolvePlacements(board, [forced, other]).result).toMatchObject({ winner: 'O' });
    expect(resolvePlacements(board, [other, forced]).result).toMatchObject({ winner: 'X' });
  });

  test('rejects invalid and occupied cells and ends play immediately on a win', () => {
    let game = createGame();
    expect(placeTurn(game, -1, 0)).toBe(game);
    expect(placeTurn(game, 0, boardSize)).toBe(game);
    for (let col = 0; col < 4; col++) {
      game = placeTurn(game, 0, col);
      expect(placeTurn(game, 0, col)).toBe(game);
      game = placeTurn(game, 1, col);
    }
    game = placeTurn(game, 0, 4);
    expect(game.result).toMatchObject({ winner: 'X' });
    expect(placeTurn(game, 1, 4)).toBe(game);
  });
});

test('the same RNG seed produces the same sequence', () => {
  const first = createRng(42);
  const second = createRng(42);
  const values = Array.from({ length: 8 }, () => first.next());
  expect(values).toEqual(Array.from({ length: 8 }, () => second.next()));
  expect(new Set(values).size).toBe(values.length);
  expect(values.every(value => value >= 0 && value < 1)).toBe(true);
});
