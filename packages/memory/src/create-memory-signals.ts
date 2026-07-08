import { createSignals } from '@youssoufcherif/signals-core';
import type { Signals } from '@youssoufcherif/signals-core';
import { makeMemoryPort } from './make-memory-port.js';
import type { RecordedLog, RecordedMetric, RecordedSpan } from './make-memory-port.js';

export type MemorySignals = Signals & {
  getSpans: () => RecordedSpan[];
  getLogs: () => RecordedLog[];
  getMetrics: () => RecordedMetric[];
  reset: () => void;
};

/**
 * The one-line convenience matching the "fake strategy is enough" goal:
 *
 *   const signals = createMemorySignals();
 *   await signals.trace.run('checkout', ...);
 *   expect(signals.getSpans()).toHaveLength(1);
 *
 * This is a real, working implementation exercising the exact same
 * `createSignals` composition every other adapter uses — not a mock.
 */
export function createMemorySignals(): MemorySignals {
  const memoryPort = makeMemoryPort();
  const signals = createSignals(memoryPort);
  return {
    ...signals,
    getSpans: memoryPort.getSpans,
    getLogs: memoryPort.getLogs,
    getMetrics: memoryPort.getMetrics,
    reset: memoryPort.reset,
  };
}
