import { createSignals } from '@youssoufcherif/signals-core';
import type { Signals, SignalsPort, SpanHandle } from '@youssoufcherif/signals-core';

const inertSpan: SpanHandle = {
  setAttribute: () => {},
  addEvent: () => {},
  recordException: () => {},
  end: () => {},
  getCorrelation: () => ({}),
};

/**
 * The noop strategy: every method is a stable no-op. Useful as the
 * "telemetry is off" switch — e.g. in a CLI's default mode, or a
 * cold-start-sensitive Lambda path that opts out of tracing entirely.
 * Because it satisfies the exact same `SignalsPort` shape as every other
 * adapter, no code anywhere needs to special-case "telemetry might be
 * disabled" — it's just another strategy.
 */
export function makeNoopPort(): SignalsPort {
  return {
    startSpan: () => inertSpan,
    log: () => {},
    recordMetric: () => {},
    flush: async () => {},
  };
}

export function createNoopSignals(): Signals {
  return createSignals(makeNoopPort());
}
