# Architecture Decision Records

This directory records the significant architectural decisions behind Signals,
in the order they were made. Read them in sequence — later ADRs assume earlier
ones as settled context.

| ADR | Title | Status |
|---|---|---|
| [0001](./0001-vision-and-principles.md) | Vision & Guiding Principles | Accepted |
| [0002](./0002-monorepo-package-boundaries.md) | Monorepo Structure & Package Boundaries | Accepted |
| [0003](./0003-public-api-signals-traceport.md) | Public API — `Signals`, `TracePort`, and Explicit Context | Accepted |

New ADRs should copy [`0000-template.md`](./0000-template.md) and be numbered
sequentially. An ADR is never edited to reverse a decision after acceptance —
instead, a new ADR supersedes it and both remain in the log.
