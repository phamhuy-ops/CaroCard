import { expect, test } from 'vitest';
import { healthResponse } from './health.ts';

test('health endpoint returns a successful JSON response', () => {
  expect(healthResponse()).toEqual({ status: 'ok' });
});
