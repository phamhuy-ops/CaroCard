export function summarizeRtt(samples: readonly number[]) {
  if (!samples.length) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    count: sorted.length,
    p50: Math.round(sorted[Math.ceil(sorted.length * 0.50) - 1]),
    p95: Math.round(sorted[Math.ceil(sorted.length * 0.95) - 1]),
  };
}
