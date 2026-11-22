export interface NetworkProfile {
  delayMs: number;
  jitterMs: number;
}

export function networkProfile(env: NodeJS.ProcessEnv): NetworkProfile {
  const delayMs = Number(env.DEBUG_LATENCY_MS ?? 0);
  const jitterMs = Number(env.DEBUG_JITTER_MS ?? 0);
  if (![0, 100, 300].includes(delayMs) || !Number.isInteger(jitterMs) || jitterMs < 0 || jitterMs > 300) {
    throw new Error('Set DEBUG_LATENCY_MS to 0, 100 or 300 and DEBUG_JITTER_MS to an integer from 0 to 300');
  }
  return { delayMs, jitterMs };
}

// Delay whole WebSocket messages without breaking their FIFO order in either direction.
export function orderedDelivery(profile: NetworkProfile) {
  const queued: { at: number; deliver: () => void }[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  function schedule() {
    const next = queued[0];
    if (!next || timer) return;
    timer = setTimeout(() => {
      timer = undefined;
      while (queued[0] && queued[0].at <= performance.now()) queued.shift()?.deliver();
      schedule();
    }, Math.max(1, Math.ceil(next.at - performance.now())));
  }
  return {
    enqueue(deliver: () => void) {
      if (!profile.delayMs && !profile.jitterMs) {
        deliver();
        return;
      }
      const now = performance.now();
      const variation = (Math.random() * 2 - 1) * profile.jitterMs;
      queued.push({ at: Math.max(queued.at(-1)?.at ?? 0, now + Math.max(0, profile.delayMs + variation)), deliver });
      schedule();
    },
    dispose() {
      clearTimeout(timer);
      timer = undefined;
      queued.length = 0;
    },
  };
}
