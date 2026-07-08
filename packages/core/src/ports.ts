import type { AttrRecord, AttrValue, LogLevel, MetricKind } from './types.js';

/**
 * SpanHandle is the minimal, adapter-internal representation of "a span
 * currently in progress". It never crosses into business code — only
 * `compose.ts` and adapter implementations ever hold one. See ADR-0003,
 * Zero Knowledge.
 *
 * `getCorrelation` returns whatever identifiers the adapter can offer for
 * log correlation (e.g. `{ traceId, spanId }`). It returns an empty record
 * if the adapter has nothing to offer — this is how `noop` stays inert.
 */
export type SpanHandle = {
  setAttribute: (key: string, value: AttrValue) => void;
  addEvent: (name: string, attrs?: AttrRecord) => void;
  recordException: (error: unknown) => void;
  end: () => void;
  getCorrelation: () => AttrRecord;
};

/**
 * SignalsPort is the strategy interface every adapter (`memory`, `noop`,
 * `node`, `opentelemetry`, ...) implements. It is deliberately small and
 * primitive — all ergonomic behavior (try/catch around spans, log
 * correlation, event fallback-to-log) is built once in `compose.ts`, not
 * duplicated per adapter. This is the "strategy" in the strategy pattern;
 * `make*Port()` factory functions are the concrete strategies.
 */
export type SignalsPort = {
  startSpan: (name: string, parent: SpanHandle | undefined, attrs?: AttrRecord) => SpanHandle;
  log: (level: LogLevel, message: string, attrs?: AttrRecord) => void;
  recordMetric: (kind: MetricKind, name: string, value: number, attrs?: AttrRecord) => void;
  flush: () => Promise<void>;
};

/**
 * TracePort — the tracing capability exposed to business code. `run`
 * receives the *next* `Signals` value (self-similar recursion — see
 * ADR-0003) rather than a bare span, so nesting never requires naming a
 * span type. `event`/`attribute`/`error` act on whichever span is active
 * in the closure that produced this TracePort.
 */
export type TracePort = {
  run: <T>(name: string, fn: (ctx: Signals) => T | Promise<T>) => Promise<T>;
  event: (name: string, attrs?: AttrRecord) => void;
  attribute: (key: string, value: AttrValue) => void;
  error: (err: unknown) => void;
};

export type LogPort = {
  debug: (message: string, attrs?: AttrRecord) => void;
  info: (message: string, attrs?: AttrRecord) => void;
  warn: (message: string, attrs?: AttrRecord) => void;
  error: (message: string, attrs?: AttrRecord) => void;
};

export type MetricPort = {
  counter: (name: string, value?: number, attrs?: AttrRecord) => void;
  histogram: (name: string, value: number, attrs?: AttrRecord) => void;
  gauge: (name: string, value: number, attrs?: AttrRecord) => void;
};

/**
 * Signals is the public, self-similar API. `createSignals(port)` returns
 * one; `trace.run`'s callback receives another, scoped to the new span.
 * Business code only ever sees this shape — never `SpanHandle`, never a
 * `SignalsPort`, never a vendor type.
 */
export type Signals = {
  trace: TracePort;
  log: LogPort;
  metric: MetricPort;
  shutdown: () => Promise<void>;
};
