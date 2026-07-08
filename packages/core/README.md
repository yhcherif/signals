# @youssoufcherif/signals-core

> ⚠️ **Pre-alpha (`0.0.x`)** — built in the open, APIs change without notice.
> Not yet supported for use outside the author's projects. See the
> [repo README](https://github.com/yhcherif/signals#readme).

The heart of [Signals](https://github.com/yhcherif/signals), a
provider-agnostic telemetry platform: the port types (`TracePort`, `LogPort`,
`MetricPort`, `SignalsPort`) and `createSignals(port)`, which composes a port
into the `Signals` capability object your business code receives via
dependency injection. Zero runtime dependencies.

You usually install this alongside an adapter (`signals-memory`,
`signals-node`, `signals-noop`, `signals-opentelemetry`) rather than alone.

```bash
pnpm add @youssoufcherif/signals-core
```

```ts
import { createSignals } from '@youssoufcherif/signals-core';
import type { Signals } from '@youssoufcherif/signals-core';

// any object satisfying SignalsPort works — adapters provide them
const signals: Signals = createSignals(port);

await signals.trace.run('checkout.process', async (ctx) => {
  ctx.log.info('processing'); // logs are correlated to the active span
  ctx.metric.counter('checkout.attempts');
});
await signals.shutdown();
```

`Signals` is self-similar: the `ctx` inside `trace.run` has the same shape as
the top-level object, so nesting spans is just calling `ctx.trace.run` again.
Design rationale: [ADRs](https://github.com/yhcherif/signals/tree/main/docs/adr).

MIT © Youssouf Cherif Hamed
