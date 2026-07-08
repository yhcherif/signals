# ADR-0002: Monorepo Structure & Package Boundaries

- **Status**: Accepted
- **Date**: 2026-07-01

## Context

ADR-0001 commits us to a provider-agnostic platform where OpenTelemetry is one
adapter among several. That only holds if the packaging itself makes coupling
impossible, not just discouraged. A single package with "optional" OTel
dependency, gated by `if (otelInstalled)` checks, would violate Zero Knowledge in
practice even if the docs claim agnosticism. We need physical, enforceable
separation.

We also want consumers to install only what they use — a Lambda function using
only the `noop` adapter for cold-start-sensitive paths shouldn't pull in the
OpenTelemetry SDK as a transitive dependency.

## Decision

We will use a **pnpm workspace monorepo** with the following packages, each
independently versioned via Changesets:

```
signals/
├── packages/
│   ├── core/            @youssoufcherif/signals-core
│   ├── opentelemetry/   @youssoufcherif/signals-opentelemetry
│   ├── memory/          @youssoufcherif/signals-memory
│   ├── noop/            @youssoufcherif/signals-noop
│   ├── node/            @youssoufcherif/signals-node
│   ├── testing/         @youssoufcherif/signals-testing
│   └── examples/        (private, not published)
├── docs/
│   └── adr/
├── biome.json
├── lefthook.yml
├── tsconfig.base.json
└── pnpm-workspace.yaml
```

**Package responsibilities:**

| Package | Depends on | Contains |
|---|---|---|
| `signals-core` | nothing (zero runtime deps) | Ports (`TracePort`, `LogPort`, `MetricPort`), `createSignals(port)`, shared types, `assertNever` |
| `signals-opentelemetry` | `signals-core`, `@opentelemetry/*` | `makeOtelPort(config)` — the only place OTel types are imported |
| `signals-memory` | `signals-core` | `makeMemoryPort()`, `createMemorySignals()` |
| `signals-noop` | `signals-core` | `makeNoopPort()`, `createNoopSignals()` |
| `signals-node` | `signals-core` | `makeNodePort(options)` — console/`perf_hooks`-based, no OTel dependency |
| `signals-testing` | `signals-core`, `signals-memory` | Assertion helpers (`expectSpan`, `expectLog`), Vitest matchers |
| `examples` | any/all | Runnable sample apps per adapter; never published |

**Import rules, enforced by lint (not just convention):**

1. Applications import only a package's public entry point (`@youssoufcherif/signals-core`,
   not `@youssoufcherif/signals-core/src/internal/whatever`).
2. Packages never import another package's `src/` directly — only its published
   entry point, resolved the same way an external consumer would.
3. Only `index.ts` files define a package's public API. Anything not re-exported
   from `index.ts` is private, regardless of what the file system allows.
4. `signals-core` never imports any provider package. Dependency direction is
   strictly one-way: adapters depend on core, never the reverse.
5. Provider packages implement core's ports; they do not extend or narrow them.
6. No `class` keyword, no `instanceof`, outside a package's `src/internal/`
   directory. This is a Biome/lint rule, not a style guideline.

These rules are mechanically checkable and run in CI and pre-push, not left to
code review memory. In practice enforcement is split across two tools: Biome
handles what its rule set supports (`noNonNullAssertion`, `useImportType`,
`noStaticOnlyClass`, plus general lint/format), and
`scripts/check-boundaries.mjs` — a small, dependency-free script — handles the
rest (`as` casts, `class` outside `internal/`, cross-package `src/` imports,
and `@opentelemetry/*` imports outside `packages/opentelemetry/src/`). Biome
1.9.4 does not yet have a `noRestrictedImports`-style rule to express
import-path restrictions, so that piece lives in our own script rather than
Biome config.

## Consequences

**Easier:**
- `npm install @youssoufcherif/signals-core @youssoufcherif/signals-memory` in a test suite
  pulls in zero OpenTelemetry code, transitively or otherwise.
- Independent versioning: a bug fix in `signals-opentelemetry` doesn't force a
  version bump in `signals-noop`.
- New adapters are new packages — additive, no risk of destabilizing `core`.
- Import-rule violations are caught by tooling before merge, not discovered in
  production when someone accidentally imports OTel types into business code.

**Harder:**
- More release/versioning overhead than a single package — mitigated by
  Changesets automating changelogs and version bumps across the workspace.
- Cross-package refactors (e.g. changing a port shape in `core`) require
  coordinated releases across every adapter package. This is the direct cost of
  the isolation we're buying, and is treated as a deliberate trade-off: it makes
  breaking changes to the core contract visible and expensive, which is
  desirable for a 5-10 year contract.
- Contributors need to understand workspace resolution (`workspace:*` protocol)
  during local development, which has a small learning curve versus a flat
  single-package repo.

## Alternatives Considered

- **Single package with optional peer dependencies** (`@youssoufcherif/signals` with
  OTel as an optional peerDep, feature-detected at runtime). Rejected: feature
  detection at runtime reintroduces the exact `instanceof`/casting patterns
  ADR-0001 forbids, and doesn't prevent OTel's types from leaking into shared
  files during development.
- **Separate repos per adapter.** Rejected: makes atomic changes across
  `core` + an adapter (e.g. adding a new port method) require multi-repo PRs and
  cross-repo CI coordination, which is worse than the monorepo's coordinated
  release cost.
