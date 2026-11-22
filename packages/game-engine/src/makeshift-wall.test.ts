import { expect, test } from 'vitest';
import { boardSize, createGame, placeMakeshiftWalls, remainingWallCapacity } from './board.ts';

const squares = [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }];

test.each([1, 2, 3])('Makeshift Wall %i★ requires the exact number of distinct empty squares', star => {
  const game = createGame();
  const valid = squares.slice(0, star);
  expect(placeMakeshiftWalls(game, star, valid)?.board.slice(0, star)).toEqual(Array(star).fill('Makeshift Wall'));
  expect(placeMakeshiftWalls(game, star, valid.slice(1))).toBeNull();
  expect(placeMakeshiftWalls(game, 2, [squares[0], squares[0]])).toBeNull();
  expect(placeMakeshiftWalls(game, 1, [{ row: -1, col: 0 }])).toBeNull();
  expect(game.board[0]).toBeNull();
});

test('the cap is per seat and only counts walls still on the board', () => {
  const x = placeMakeshiftWalls(createGame(), 2, squares.slice(0, 2))!;
  expect(placeMakeshiftWalls(x, 2, [{ row: 1, col: 0 }, { row: 1, col: 1 }])).toBeNull();
  expect(placeMakeshiftWalls(x, 1, [squares[0]])).toBeNull();
  const full = placeMakeshiftWalls(x, 1, [squares[2]])!;
  const both = placeMakeshiftWalls({ ...full, turn: 'O' }, 3, squares.map(square => ({ ...square, row: 1 })))!;
  expect(remainingWallCapacity(both, 'X')).toBe(0);
  expect(remainingWallCapacity(both, 'O')).toBe(0);
  const board = [...both.board];
  board[0] = null;
  expect(remainingWallCapacity({ ...both, board }, 'X')).toBe(1);
  expect(remainingWallCapacity({ ...both, board }, 'O')).toBe(0);
});

test('a wall that fills the last empty square ends the match in a draw', () => {
  const game = createGame();
  const board = game.board.map((cell, index) => {
    if (index === 0) return cell;
    return (Math.floor(index / boardSize) + Math.floor((index % boardSize) / 2)) % 2 ? 'X' as const : 'O' as const;
  });
  expect(placeMakeshiftWalls({ ...game, board }, 1, [squares[0]])?.result).toEqual({ kind: 'draw' });
});
