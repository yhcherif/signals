# @youssoufcherif/signals-memory

> ⚠️ **Pre-alpha (`0.0.x`)** — built in the open, APIs change without notice.
> Not yet supported for use outside the author's projects. See the
> [repo README](https://github.com/yhcherif/signals#readme).

In-memory provider for [Signals](https://github.com/yhcherif/signals). A real,
working implementation that records every span, log, and metric in process
memory — the test double for code instrumented with Signals, with no mocking
library involved.

```bash
pnpm add -D @youssoufcherif/signals-memory
```

```ts
import { createMemorySignals } from '@youssoufcherif/signals-memory';

const signals = createMemorySignals();

await signals.trace.run('checkout.process', async (ctx) => {
  ctx.metric.counter('payment.attempts');
});

signals.getSpans();   // RecordedSpan[]
signals.getLogs();    // RecordedLog[]
signals.getMetrics(); // RecordedMetric[]
signals.reset();
```

For readable assertions on top of this, see
[`@youssoufcherif/signals-testing`](https://www.npmjs.com/package/@youssoufcherif/signals-testing).

MIT © Youssouf Cherif Hamed
