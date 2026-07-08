# Signals

[![CI](https://github.com/yhcherif/signals/actions/workflows/ci.yml/badge.svg)](https://github.com/yhcherif/signals/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@youssoufcherif/signals-core)](https://www.npmjs.com/package/@youssoufcherif/signals-core)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

> ⚠️ **Pre-alpha (`0.0.x`).** Signals is being built in the open, but it is not ready
> for use outside the author's own projects yet. Every release may change any API
> without notice or migration path. Watch the repo if you're curious; don't build on
> it yet — `0.1.0` will be the first version with any stability intent.

A provider-agnostic telemetry platform for TypeScript. OpenTelemetry is one
adapter among several — not the thing being wrapped.

Start with [`docs/adr/`](./docs/adr) for the architecture decisions behind
this repo (vision, package boundaries, public API design) before reading code.

## Packages

| Package | What it is |
|---|---|
| [`@youssoufcherif/signals-core`](./packages/core) | Ports + `createSignals(port)`. Zero runtime deps. |
| [`@youssoufcherif/signals-memory`](./packages/memory) | In-memory provider for tests. |
| [`@youssoufcherif/signals-noop`](./packages/noop) | Zero-overhead provider for disabling telemetry. |
| [`@youssoufcherif/signals-node`](./packages/node) | Console-based provider, no OTel dependency. |
| [`@youssoufcherif/signals-opentelemetry`](./packages/opentelemetry) | The OTel adapter. Only package that imports `@opentelemetry/*`. |
| [`@youssoufcherif/signals-testing`](./packages/testing) | Assertion helpers built on `signals-memory`. |
| `packages/examples` | Runnable demos — `pnpm memory`, `pnpm node`, `pnpm otel`. Not published. |
| `packages/blog-app` | A small Hono API stress-testing the design as a real consumer. Not published. |

All packages are ESM-only and require Node ≥ 20.

## Install

```bash
pnpm add @youssoufcherif/signals-core @youssoufcherif/signals-memory
# pick your production adapter:
pnpm add @youssoufcherif/signals-node            # structured console output
pnpm add @youssoufcherif/signals-opentelemetry   # OpenTelemetry
pnpm add @youssoufcherif/signals-noop            # telemetry disabled
```

## Quick start

```ts
import { createMemorySignals } from '@youssoufcherif/signals-memory';

const signals = createMemorySignals();

await signals.trace.run('checkout.process', async (ctx) => {
  ctx.trace.attribute('order.id', 'order_1');
  ctx.log.info('processing checkout');
  await ctx.trace.run('checkout.charge', async (chargeCtx) => {
    chargeCtx.metric.counter('payment.attempts');
  });
});

await signals.shutdown();
```

Swap `createMemorySignals()` for `createOtelSignals({ serviceName: '...' })`
or `createNodeSignals()` — the code inside `trace.run` never changes. See
`packages/examples/src/process-checkout.ts` for the pattern in a real
function signature (dependency injection, not import).

## Versioning policy (pre-alpha)

- All published packages share **one fixed version**, currently `0.0.x`, bumped
  together via [Changesets](https://github.com/changesets/changesets). Every
  release is a `patch` and **may contain breaking changes** — that is what
  `0.0.x` means here.
- Because of semver-0 rules, `^0.0.x` in a consumer floats nothing: you always
  pin an exact version and upgrade deliberately.
- `0.1.0` will mark the first release with a stability intent for the core port
  shape; packages move to independent versioning then (see
  [ADR-0004](./docs/adr/0004-publishing-and-versioning.md)).

## Development

```bash
pnpm install       # install workspace deps (installs git hooks via lefthook)
pnpm build         # build all packages
pnpm test          # run every package's Vitest suite
pnpm typecheck     # tsc --noEmit across the workspace
pnpm lint          # biome check
pnpm lint:fix      # biome check --write
node scripts/check-boundaries.mjs   # enforce ADR-0001/0002 rules Biome can't express
```

`lefthook` runs `lint` + boundary checks on commit, `typecheck` + `test` on
push (see `lefthook.yml`). CI runs the same gate on every PR; releases are
published from `main` by the release workflow when a "Version Packages" PR is
merged. See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Known simplifications (v0.0.x)

Documented, not hidden:

- `signals-opentelemetry`'s log port is a `console.log` fallback pending a
  `@opentelemetry/api-logs` integration.
- `signals-opentelemetry`'s `gauge` metric uses an `UpDownCounter`
  approximation rather than a true observable gauge.

## License

[MIT](./LICENSE) © Youssouf Cherif Hamed
