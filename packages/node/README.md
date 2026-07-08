# @youssoufcherif/signals-node

> ⚠️ **Pre-alpha (`0.0.x`)** — built in the open, APIs change without notice.
> Not yet supported for use outside the author's projects. See the
> [repo README](https://github.com/yhcherif/signals#readme).

Lightweight console provider for
[Signals](https://github.com/yhcherif/signals): spans, logs, and metrics as
structured JSON lines on stdout. No OpenTelemetry dependency — ideal for local
development or simple services that ship logs from stdout.

```bash
pnpm add @youssoufcherif/signals-node
```

```ts
import { createNodeSignals } from '@youssoufcherif/signals-node';

const signals = createNodeSignals({ pretty: true }); // options optional

await signals.trace.run('checkout.process', async (ctx) => {
  ctx.log.info('processing checkout'); // JSON line, correlated to the span
});
await signals.shutdown();
```

MIT © Youssouf Cherif Hamed
