# ADR-0003: Public API — `Signals`, `TracePort`, and Explicit Context

- **Status**: Accepted
- **Date**: 2026-07-01

## Context

ADR-0001 requires Zero Knowledge (no `Span`/`Context` object ever crosses a port
boundary into business code) and explicit context threading over hidden
mechanisms like `AsyncLocalStorage`. We need one concrete, self-consistent shape
that satisfies both, is learnable in under five minutes, and supports nested
spans without exposing a span object anywhere.

The two candidate shapes considered during design were:
(a) a bare `SpanHandle` passed into `run`'s callback, requiring business code to
call `span.addEvent()` / `span.end()` directly, or
(b) recursion: the callback receives another full `Signals` object, scoped to
that span, so nesting is just calling `.trace.run` again on what you were given.

Shape (a) violates Zero Knowledge the moment a `SpanHandle` type needs to be
named anywhere in business code. Shape (b) does not — nothing OTel-shaped is
ever named outside an adapter.

## Decision

The public API is:

```ts
type AttrValue = string | number | boolean;
type AttrRecord = Record<string, AttrValue>;

type TracePort = {
  run: <T>(name: string, fn: (ctx: Signals) => T | Promise<T>) => Promise<T>;
  event: (name: string, attrs?: AttrRecord) => void;
  attribute: (key: string, value: AttrValue) => void;
  error: (err: unknown) => void;
};

type LogPort = {
  debug: (message: string, attrs?: AttrRecord) => void;
  info: (message: string, attrs?: AttrRecord) => void;
  warn: (message: string, attrs?: AttrRecord) => void;
  error: (message: string, attrs?: AttrRecord) => void;
};

type MetricKind = 'counter' | 'histogram' | 'gauge';

type MetricPort = {
  counter: (name: string, value?: number, attrs?: AttrRecord) => void;
  histogram: (name: string, value: number, attrs?: AttrRecord) => void;
  gauge: (name: string, value: number, attrs?: AttrRecord) => void;
};

type Signals = {
  trace: TracePort;
  log: LogPort;
  metric: MetricPort;
  shutdown: () => Promise<void>;
};
```

`Signals` is **self-similar**: the top-level object returned by `createSignals(port)`
and the `ctx` object handed into any `trace.run` callback have the identical
shape. Nesting is recursion, not a different API:

```ts
const signals = createSignals(makeOtelPort({ serviceName: 'checkout' }));

await signals.trace.run('checkout.process', async (ctx) => {
  ctx.trace.event('cart.validated', { itemCount: 3 });

  await ctx.trace.run('checkout.charge', async (child) => {
    child.metric.counter('payment.attempts');
    child.log.info('charging payment', { provider: 'stripe' });
  });
});

await signals.shutdown();
```

No `Span`, `Context`, or adapter-specific type is named anywhere in this
example. `ctx.trace.attribute`/`event`/`error` act on whichever span is active
in that closure; `ctx.log` closes over that span's trace/span ID and injects it
into log attributes automatically, giving correlated logs for free without the
caller ever touching an ID.

**Context propagation is explicit, not ambient.** There is no global "current
span." A function that wants to add a child span must have been handed a
`Signals`/`ctx` value — either the top-level one or one received from an
enclosing `run` — and call `.trace.run` on it. This is a deliberate rejection of
`AsyncLocalStorage`: propagation is visible in every function signature that
needs it, at the cost of callers threading `ctx` through call chains explicitly.

**Degraded behavior with no active span.** At the top level (no enclosing
`run`), `trace.event` and `trace.error` fall back to structured log lines
instead of being no-ops, so telemetry emitted outside a span isn't silently
dropped. `trace.attribute` is a no-op at the top level — there is no span to
attach an attribute to, and no log-line equivalent that preserves its meaning.

**The escape hatch from the earlier draft is removed.** A prior draft included
a `trace(name): SpanHandle` manual-control escape hatch for spans that outlive
one function scope. It is dropped: it violates Zero Knowledge by returning a
span object to business code. If a genuine need for long-lived, manually-closed
spans emerges, it will be solved inside a specific adapter's internals, not
exposed generically.

## Consequences

**Easier:**
- The entire API surface is five names (`trace`, `log`, `metric`, `shutdown`,
  plus nesting via `.run`) — learnable in minutes, matching the stated goal.
- Log/trace correlation is automatic and free, without exposing IDs.
- No hidden state means no surprises across `await` boundaries, worker threads,
  or non-Node runtimes (Bun/Deno/Workers) where `AsyncLocalStorage` either
  doesn't exist or behaves differently.
- Every port implementation (`memory`, `noop`, `node`, `opentelemetry`) can be
  tested against one shared contract test suite, since they all produce the same
  `Signals` shape.

**Harder:**
- Deeply nested call chains that need tracing must thread `ctx` as a parameter
  through every intermediate function, even ones that don't themselves add
  spans but call something that does. This is more verbose than ambient context,
  and is the direct, accepted cost of ADR-0001's explicitness principle.
- Manually-controlled, scope-crossing spans (e.g. "start when the request
  arrives, end in a different handler") are not supported generically. Adapters
  may offer adapter-specific solutions for this if a real need arises, but it
  will not be part of the portable core API.

## Alternatives Considered

- **Bare `SpanHandle` passed to `run`.** Rejected: violates Zero Knowledge as
  soon as the handle's type must be named or stored anywhere.
- **`AsyncLocalStorage`-backed ambient context** (`getActiveSpan()` callable
  from anywhere). Rejected in ADR-0001 already: hidden state, non-portable
  across runtimes, and a `class`-based primitive at a port boundary.
- **Single flat `Signals` object with no `trace`/`log`/`metric` grouping**
  (e.g. `signals.runSpan`, `signals.logInfo`, `signals.recordCounter`).
  Rejected: less discoverable, loses the grouping that makes autocomplete and
  documentation navigable; the three-pillar grouping mirrors OTel's own
  vocabulary (traces/logs/metrics) without importing OTel's types.
