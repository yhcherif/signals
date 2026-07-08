# @youssoufcherif/signals-testing

> ⚠️ **Pre-alpha (`0.0.x`)** — built in the open, APIs change without notice.
> Not yet supported for use outside the author's projects. See the
> [repo README](https://github.com/yhcherif/signals#readme).

Assertion helpers for testing code instrumented with
[Signals](https://github.com/yhcherif/signals), built on the in-memory
provider — no mocking library, ever. Re-exports `createMemorySignals` so a
test file needs a single import.

```bash
pnpm add -D @youssoufcherif/signals-testing
```

```ts
import {
  createMemorySignals,
  expectLogMessage,
  expectMetric,
  expectSpan,
  expectSpanEnded,
} from '@youssoufcherif/signals-testing';

const signals = createMemorySignals();
await processCheckout(signals, order); // your code, Signals injected

const span = expectSpan(signals, 'checkout.process');
expectSpanEnded(signals, 'checkout.process');
expectLogMessage(signals, 'processing checkout');
expectMetric(signals, 'payment.attempts');
```

MIT © Youssouf Cherif Hamed
