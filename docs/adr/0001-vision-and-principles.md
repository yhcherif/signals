# ADR-0001: Vision & Guiding Principles

- **Status**: Accepted
- **Date**: 2026-07-01

## Context

Most "observability wrappers" in the TypeScript ecosystem start from OpenTelemetry's
object model (`Span`, `TracerProvider`, `Resource`, `Exporter`, `Context`) and try to
hide it behind a thinner facade. This inverts who owns the vocabulary: business code
ends up shaped around OTel's concerns even when OTel is nominally "just a detail."

We are building something we intend to depend on across multiple companies and
projects for 5-10 years, across runtimes OpenTelemetry may or may not support well
(Bun, Deno, Cloudflare Workers, Lambda), and across backends that may not be OTel at
all (plain console output during local dev, in-memory capture during tests, a future
vendor we haven't picked yet). A thin wrapper couples our lifetime to OpenTelemetry's
API stability. A domain-first model does not.

## Decision

We will build **Signals**, a provider-agnostic telemetry platform, not an
OpenTelemetry wrapper. OpenTelemetry is one adapter among several
(`memory`, `noop`, `node`, `opentelemetry`, ...). The domain — traces, logs, metrics
as *capabilities a service needs* — owns the vocabulary. Every adapter conforms to
that vocabulary; the vocabulary never bends to fit an adapter.

This is enforced through the following non-negotiable principles:

1. **Dependency Injection, never import.** A function that needs a capability
   receives it as an argument. It never reaches for a singleton, a global tracer,
   or an imported vendor client.

2. **Ports and Adapters.** Business code depends on small, local interfaces
   ("ports"). Infrastructure code ("adapters") implements them. A port is defined
   at its point of use — consumers do not import a shared contract type from the
   adapter package; they declare the shape they need and rely on structural typing.

3. **Small interfaces, one capability each.** No interface should describe an SDK.
   `TracePort` describes tracing capability (`run`, `event`, `attribute`, `error`) —
   nothing about span kinds, processors, or resources.

4. **Composition over configuration.** Behavior is built by composing small
   functions (`createSignals(port)`), not by passing ever-larger config objects
   into constructors.

5. **Zero Knowledge.** Business code must never see, hold a reference to, or
   import the type of: `Span`, `TracerProvider`, `Resource`, `Exporter`, `Context`,
   `Processor`, or any other adapter-specific object. These are adapter-internal by
   construction — not by convention, not by naming, but because no port ever
   exposes them.

6. **Testability first, no mocks required.** Every module is testable by swapping
   in `createMemorySignals()` — a real, working, in-process implementation of the
   same ports — never a mocking library, never `vi.mock`.

7. **No casting, no classes at the port boundary.** No `as`, no `any`, no
   `unknown as X`, no `instanceof`. Vendor classes (e.g. OTel SDK internals) may
   exist only inside an adapter's private internal modules; nothing extending
   `class` or requiring `instanceof` may cross a port boundary. Discriminated
   unions and structural typing replace narrowing and casting.

8. **Explicit context over hidden state.** Span/trace nesting is achieved by
   threading a context object through function calls explicitly, not through
   `AsyncLocalStorage` or module-level globals. See ADR-0003.

## Consequences

**Easier:**
- Swapping telemetry backend (OTel → console → memory → future vendor) is a
  one-line change at the composition root; business code is untouched.
- Every module in the codebase is unit-testable without a mocking framework.
- The library's lifetime is decoupled from OpenTelemetry's API churn — if OTel v2
  changes its object model, only the `signals-opentelemetry` adapter changes.
- New adapters (a future vendor, a new runtime) are additive; they never require
  touching `signals-core` or business code.

**Harder:**
- We give up OTel-specific power-user features (custom `SpanProcessor` chains,
  `Sampler` configuration, resource detectors) at the port level. These remain
  configurable, but only inside adapter construction (e.g.
  `makeOtelPort({ sampler, processors })`), never through the generic `Signals`
  API. This is a deliberate ceiling, not an oversight.
- Contributors must learn "define ports locally" as a discipline; it is less
  familiar than "import the SDK's types," and code review must catch violations
  until tooling (ADR-0002 import rules) enforces it automatically.
- Some ergonomic conveniences common in OTel-native code (e.g. grabbing the
  "current active span" from anywhere) are intentionally unavailable; this is the
  direct cost of explicit context (ADR-0003).

## Alternatives Considered

- **Thin OpenTelemetry wrapper** (expose a simplified facade over OTel's own
  types). Rejected: couples our public API's lifetime directly to OTel's, and
  leaks `Span`/`Context` concepts into business code the moment anyone needs an
  escape hatch.
- **Full auto-instrumentation SDK** (agent-style, patches modules at runtime).
  Rejected: out of scope — see Non-Goals. We expose capabilities; we do not own
  instrumentation strategy for third-party libraries.
- **Class-based ports with inheritance** (`abstract class TracePort`). Rejected:
  reintroduces `instanceof`/casting pressure at composition boundaries and
  couples adapters to a shared base class rather than a structural shape.

## Non-Goals

Signals is explicitly **not**:
- an OpenTelemetry wrapper
- another logging framework
- an HTTP framework
- a dependency injection container
- an auto-instrumentation SDK

Its only job is exposing observability capabilities (trace, log, metric) through a
stable, domain-owned API.

## Success Criteria

A service can replace its telemetry backend — OpenTelemetry, console, memory, or a
future vendor — by changing one line at its composition root, with zero changes to
business code.
