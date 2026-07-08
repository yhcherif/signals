# CLAUDE.md — Engineering standards for the signals monorepo

Every task in this repo follows the criteria below. The authoritative sources are the ADRs in `docs/adr/` — read the relevant one before changing anything it governs, and record new significant decisions as ADRs (use `docs/adr/0000-template.md`) **before** writing the code that implements them.

## What this is

**Signals** is a provider-agnostic telemetry platform for TypeScript — *not* an OpenTelemetry wrapper. The domain (traces, logs, metrics as capabilities a service needs) owns the vocabulary; OTel is one adapter among several. A service must be able to swap its telemetry backend by changing one line at its composition root, with zero changes to business code (ADR-0001's success criterion).

pnpm workspace monorepo, released via Changesets — currently a **fixed group** at `0.0.x` (all six published packages share one version, every bump a `patch`; independent versioning returns at `0.1.0` — see ADR-0004):

| Package | Depends on | Contains |
|---|---|---|
| `packages/core` → `@youssoufcherif/signals-core` | nothing (zero runtime deps) | Ports (`TracePort`, `LogPort`, `MetricPort`), `createSignals(port)`, shared types, `assertNever` |
| `packages/opentelemetry` → `@youssoufcherif/signals-opentelemetry` | core + `@opentelemetry/*` | `makeOtelPort(config)` — the **only** place OTel is imported |
| `packages/memory` → `@youssoufcherif/signals-memory` | core | `makeMemoryPort()`, `createMemorySignals()` — the test double (a real implementation, not a mock) |
| `packages/noop` → `@youssoufcherif/signals-noop` | core | zero-overhead disabled telemetry |
| `packages/node` → `@youssoufcherif/signals-node` | core | console/`perf_hooks`-based provider, no OTel |
| `packages/testing` → `@youssoufcherif/signals-testing` | core + memory | assertion helpers (`expectSpan`, `expectLog`), Vitest matchers |
| `packages/examples` | any (private) | runnable demos per adapter |
| `packages/blog-app` | any (private) | Hono blog API stress-testing the design as a real consumer; same rules apply inside it |

## Non-negotiable principles (ADR-0001)

1. **Dependency injection, never import.** A function that needs a capability receives it as an argument — no singletons, no global tracer, no imported vendor client.
2. **Ports and adapters.** Business code depends on small local interfaces defined at the point of use; consumers declare the shape they need and rely on structural typing rather than importing the adapter's contract type.
3. **Small interfaces, one capability each.** No interface describes an SDK.
4. **Composition over configuration**: `createSignals(port)`, not ever-larger config objects into constructors.
5. **Zero Knowledge.** Business code never sees, holds, or imports `Span`, `TracerProvider`, `Resource`, `Exporter`, `Context`, `Processor`, or any adapter-specific object — by construction (no port exposes them), not by convention. OTel power-user features are configurable only inside adapter construction (`makeOtelPort({ sampler, ... })`), never through the generic `Signals` API — a deliberate ceiling.
6. **Testability first, no mocks.** Every module is testable by swapping in `createMemorySignals()`. Never a mocking library, never `vi.mock`.
7. **No casting, no classes at port boundaries.** No `as` (except `as const`), no `any`, no `unknown as X`, no non-null `!`, no `instanceof`. Vendor classes live only inside a package's `src/internal/`; nothing class-shaped crosses a port boundary. Discriminated unions + structural typing replace narrowing and casting.
8. **Explicit context over hidden state.** Span nesting is threaded explicitly through function calls — never `AsyncLocalStorage`, never module-level globals.

## Public API shape (ADR-0003)

`Signals = { trace, log, metric, shutdown }` and it is **self-similar**: the object returned by `createSignals(port)` and the `ctx` handed to any `trace.run(name, fn)` callback have the identical shape — nesting is recursion (`ctx.trace.run(...)`), not a different API. `ctx.log` automatically correlates logs with the active span without exposing IDs.

- There is no global "current span"; a function that wants a child span must have been handed a `Signals`/`ctx` value. Verbose `ctx` threading through intermediate functions is the accepted cost.
- Degraded top-level behavior: outside any span, `trace.event`/`trace.error` fall back to structured log lines (not silently dropped); `trace.attribute` is a no-op.
- No `SpanHandle` escape hatch in the portable API — manually-controlled, scope-crossing spans are adapter-internal solutions if ever needed. Do not reintroduce one.

## Package boundary rules (ADR-0002, mechanically enforced)

1. Only a package's public entry point may be imported — never another package's `src/` directly; only `index.ts` defines the public API (anything not re-exported there is private).
2. Dependency direction is strictly one-way: adapters depend on `core`, never the reverse. `core` has zero runtime dependencies.
3. Adapters implement core's ports; they never extend or narrow them.
4. `@opentelemetry/*` imports are allowed only in `packages/opentelemetry/src/`.
5. No `class` / `instanceof` outside a package's `src/internal/`.

Enforcement is split: Biome 1.9.4 handles what its rule set supports (`noExplicitAny`, `noNonNullAssertion`, `useImportType`, `noStaticOnlyClass`; `useLiteralKeys` is off because it conflicts with `noPropertyAccessFromIndexSignature`; Biome 1.9 has no `noRestrictedImports`), and `scripts/check-boundaries.mjs` — a dependency-free text scanner — handles the rest (`as` casts, `class` placement, cross-package `src/` imports, OTel import containment). It blanks whole import/export statements before scanning so `import { x as y }` renames don't false-positive; if you modify it, re-verify against a deliberately-bad throwaway file and confirm every rule fires with correct line numbers.

## TypeScript & tooling

- `tsconfig.base.json` strictness is sacred — `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, `isolatedModules`. When the compiler fights you, fix the code, never loosen the config. Known friction: optional keys are omitted when absent (`...(x !== undefined ? { x } : {})`), and index-signature access must be bracketed (`process.env['FOO']`).
- Factories over classes: `makeX(deps)` returns a plain record of functions; state lives in closures; no `this`.
- Validating parsers for external input (env, JSON) that return typed values — never `JSON.parse(x) as Config`.
- Lefthook: pre-commit → biome (auto-fix staged) + boundary script; pre-push → `pnpm typecheck` + `pnpm test`.
- Vitest everywhere; hand-rolled fakes and `signals-memory`/`signals-testing` instead of any mocking library.

## Commands

```bash
pnpm install / build / test / typecheck / lint / lint:fix
node scripts/check-boundaries.mjs
pnpm --filter @youssoufcherif/blog-app dev   # or dev:memory / dev:otel / dev:noop
```

**Final gate before declaring any task done**: run boundary script, `pnpm lint`, `pnpm typecheck`, `pnpm test` (and the relevant example/app if runtime behavior changed) and show real output. Never claim something builds or passes without running it. Report every deviation from the ADRs explicitly.

## Non-goals (do not add)

Not an OTel wrapper, not a logging framework, not an HTTP framework, not a DI container, not an auto-instrumentation SDK. Its only job is exposing trace/log/metric capabilities through a stable, domain-owned API.

## Known v0.1 simplifications (documented, not hidden)

- `signals-opentelemetry` log port is a `console.log` fallback pending `@opentelemetry/api-logs` integration; its `gauge` uses an `UpDownCounter` approximation.

## Releasing

Never publish from a laptop. Every user-visible change lands with `pnpm changeset` (always `patch` while pre-0.1.0). Merging to `main` lets the release workflow open a "Version Packages" PR; merging that publishes all six packages to npm with provenance (see `.github/workflows/release.yml` and ADR-0004).
