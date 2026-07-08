# @youssoufcherif/signals-noop

> ⚠️ **Pre-alpha (`0.0.x`)** — built in the open, APIs change without notice.
> Not yet supported for use outside the author's projects. See the
> [repo README](https://github.com/yhcherif/signals#readme).

Zero-overhead provider for [Signals](https://github.com/yhcherif/signals):
every operation is a no-op. Use it to disable telemetry entirely (e.g. on
cold-start-sensitive paths) without touching instrumented code.

```bash
pnpm add @youssoufcherif/signals-noop
```

```ts
import { createNoopSignals } from '@youssoufcherif/signals-noop';

const signals = createNoopSignals();
// identical Signals API — trace.run still runs your callback, records nothing
```

MIT © Youssouf Cherif Hamed
