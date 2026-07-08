import type { LogPort, MetricPort, Signals, SignalsPort, SpanHandle, TracePort } from './ports.js';
import type { AttrRecord, AttrValue } from './types.js';

/**
 * Builds a `Signals` value from a `SignalsPort` strategy and an optional
 * "currently active" span. This is the one place `run`'s cross-cutting
 * behavior lives (start span, catch + record exception, always end) —
 * every adapter gets it for free instead of reimplementing it.
 *
 * Context is explicit, not ambient (ADR-0003): nesting happens because
 * `run`'s callback is handed a *new* `Signals` built with the child span
 * active, and the caller chooses to call `.trace.run` on it again. There
 * is no global/AsyncLocalStorage-backed "current span" anywhere.
 */
function buildSignals(port: SignalsPort, activeSpan: SpanHandle | undefined): Signals {
  const trace: TracePort = {
    run: async (name, fn) => {
      const span = port.startSpan(name, activeSpan);
      const childSignals = buildSignals(port, span);
      try {
        return await fn(childSignals);
      } catch (err) {
        span.recordException(err);
        throw err;
      } finally {
        span.end();
      }
    },

    event: (name, attrs) => {
      if (activeSpan) {
        activeSpan.addEvent(name, attrs);
        return;
      }
      // No active span: degrade to a log line rather than dropping the
      // signal silently (ADR-0003, "degraded behavior with no active span").
      port.log('info', name, attrs);
    },

    attribute: (key: string, value: AttrValue) => {
      if (activeSpan) {
        activeSpan.setAttribute(key, value);
      }
      // No active span: no-op. There is no log-line equivalent that
      // preserves an attribute's meaning outside a span.
    },

    error: (err) => {
      if (activeSpan) {
        activeSpan.recordException(err);
        return;
      }
      port.log('error', messageFromError(err), attrsFromError(err));
    },
  };

  const correlation = (): AttrRecord => (activeSpan ? activeSpan.getCorrelation() : {});

  const log: LogPort = {
    debug: (message, attrs) => port.log('debug', message, { ...correlation(), ...attrs }),
    info: (message, attrs) => port.log('info', message, { ...correlation(), ...attrs }),
    warn: (message, attrs) => port.log('warn', message, { ...correlation(), ...attrs }),
    error: (message, attrs) => port.log('error', message, { ...correlation(), ...attrs }),
  };

  const metric: MetricPort = {
    counter: (name, value, attrs) => port.recordMetric('counter', name, value ?? 1, attrs),
    histogram: (name, value, attrs) => port.recordMetric('histogram', name, value, attrs),
    gauge: (name, value, attrs) => port.recordMetric('gauge', name, value, attrs),
  };

  return { trace, log, metric, shutdown: port.flush };
}

/**
 * The one generic composition function every adapter package sits on top
 * of. Swapping providers is swapping which `SignalsPort` you pass here —
 * see ADR-0001's success criterion.
 */
export function createSignals(port: SignalsPort): Signals {
  return buildSignals(port, undefined);
}

function messageFromError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function attrsFromError(err: unknown): AttrRecord {
  if (err instanceof Error) {
    return { errorName: err.name, errorMessage: err.message };
  }
  return { errorMessage: String(err) };
}
