# @youssoufcherif/signals-opentelemetry

> ⚠️ **Pre-alpha (`0.0.x`)** — built in the open, APIs change without notice.
> Not yet supported for use outside the author's projects. See the
> [repo README](https://github.com/yhcherif/signals#readme).

The OpenTelemetry adapter for
[Signals](https://github.com/yhcherif/signals) — the only package in the
ecosystem that imports `@opentelemetry/*`. Your business code stays free of
`Span`/`Context`/SDK types; this adapter maps the Signals ports onto OTel.

`@opentelemetry/api` is a peer dependency; exporter/SDK setup remains your
application's composition-root concern.

```bash
pnpm add @youssoufcherif/signals-opentelemetry @opentelemetry/api
```

```ts
import { createOtelSignals } from '@youssoufcherif/signals-opentelemetry';

const signals = createOtelSignals({ serviceName: 'checkout' });

await signals.trace.run('checkout.process', async (ctx) => {
  ctx.metric.counter('payment.attempts');
});
await signals.shutdown();
```

Known `0.0.x` simplifications: the log port falls back to `console.log`
pending `@opentelemetry/api-logs` integration, and `gauge` is approximated
with an `UpDownCounter`.

MIT © Youssouf Cherif Hamed
