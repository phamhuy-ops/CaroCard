import { afterEach, expect, test, vi } from 'vitest';
import { summarizeRtt } from '@carocard/shared/network-metrics';
import { networkProfile, orderedDelivery } from './network.ts';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

test('debug delay is off by default and rejects unsupported settings', () => {
  expect(networkProfile({})).toEqual({ delayMs: 0, jitterMs: 0 });
  expect(networkProfile({ DEBUG_LATENCY_MS: '300', DEBUG_JITTER_MS: '40' })).toEqual({ delayMs: 300, jitterMs: 40 });
  expect(() => networkProfile({ DEBUG_LATENCY_MS: '250' })).toThrow();
});

test('jitter cannot reorder messages or send one after disposing the connection', () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValueOnce(0);
  const delivery = orderedDelivery({ delayMs: 100, jitterMs: 40 });
  const order: number[] = [];
  delivery.enqueue(() => order.push(1));
  delivery.enqueue(() => order.push(2));
  vi.advanceTimersByTime(100);
  expect(order).toEqual([]);
  vi.advanceTimersByTime(50);
  expect(order).toEqual([1, 2]);
  delivery.enqueue(() => order.push(3));
  delivery.dispose();
  vi.runAllTimers();
  expect(order).toEqual([1, 2]);
});

test('RTT uses nearest-rank percentiles and preserves the sample order', () => {
  const values = [100, 3, 4, 1, 2];
  expect(summarizeRtt(values)).toEqual({ count: 5, p50: 3, p95: 100 });
  expect(values).toEqual([100, 3, 4, 1, 2]);
  expect(summarizeRtt([])).toBeNull();
});
