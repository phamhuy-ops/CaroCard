import { expect, test } from 'vitest';
import { createGame, moveWithNewAngle, newAngleTargets, resolvePlacements, winningLine } from './board.ts';

const from = { row: 7, col: 7 };

test.each([[1, 8, 9], [2, 24, 10], [3, 224, 14]])('New Angle %i★ respects its Chebyshev range', (star, count, far) => {
  const { board } = resolvePlacements(createGame().board, [{ ...from, cell: 'X' }]);
  expect(newAngleTargets(board, 'X', star, from)).toHaveLength(count);
  expect(newAngleTargets(board, 'X', star, from)).toContainEqual({ row: 8, col: 8 });
  const moved = moveWithNewAngle({ ...createGame(), board }, star, from, { row: far, col: far });
  expect(Boolean(moved)).toBe(star === 3);
});

test('walls, opposing marks and invalid sources are rejected without changing the board', () => {
  const { board } = resolvePlacements(createGame().board, [
    { ...from, cell: 'X' }, { row: 7, col: 8, cell: 'Dark Wall' },
    { row: 7, col: 6, cell: 'Makeshift Wall' }, { row: 8, col: 7, cell: 'O' },
  ]);
  const game = { ...createGame(), board };
  for (const to of [{ row: 7, col: 8 }, { row: 7, col: 6 }, { row: 8, col: 7 }, { row: -1, col: 7 }, from]) {
    expect(moveWithNewAngle(game, 3, from, to)).toBeNull();
  }
  expect(moveWithNewAngle(game, 3, { row: 8, col: 7 }, { row: 8, col: 8 })).toBeNull();
  expect(moveWithNewAngle(game, 3, from, { row: 8, col: 8 })?.board[7 * 15 + 7]).toBeNull();
  expect(game.board[7 * 15 + 7]).toBe('X');
});

test('a moved mark can win immediately', () => {
  const { board } = resolvePlacements(createGame().board, [
    ...[0, 1, 2, 3].map(col => ({ row: 0, col, cell: 'X' as const })),
    { row: 1, col: 4, cell: 'X' },
  ]);
  const won = moveWithNewAngle({ ...createGame(), board }, 1, { row: 1, col: 4 }, { row: 0, col: 4 })!;
  expect(won.result).toEqual({ kind: 'win', winner: 'X', reason: 'fiveInRow' });
  expect(winningLine(won.board, 'X')).toEqual({ from: { row: 0, col: 0 }, to: { row: 0, col: 4 } });
});

test('the line joins both endpoints of a descending diagonal', () => {
  const board = resolvePlacements(createGame().board, Array.from({ length: 5 }, (_, i) => ({
    row: 2 + i, col: 8 - i, cell: 'O' as const,
  }))).board;
  expect(winningLine(board, 'O')).toEqual({ from: { row: 2, col: 8 }, to: { row: 6, col: 4 } });
  expect(winningLine(board, 'X')).toBeNull();
});
