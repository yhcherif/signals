# Contributing to Signals

Thanks for your interest! A candid note first: Signals is **pre-alpha
(`0.0.x`)** and the API is still churning. Issues, questions, and design
discussion are very welcome; unsolicited large PRs will probably collide with
in-flight changes. **Open an issue first** so we can agree on direction before
you write code.

## Setup

```bash
pnpm install   # installs workspace deps and git hooks (lefthook)
pnpm build     # build all packages (typecheck resolves against dist)
pnpm test
```

Requirements: Node ≥ 20, pnpm 9.

## House rules (enforced by tooling, not vibes)

Read `docs/adr/` before changing anything it governs — especially
[ADR-0001](./docs/adr/0001-vision-and-principles.md) (principles),
[ADR-0002](./docs/adr/0002-monorepo-package-boundaries.md) (package
boundaries), and [ADR-0003](./docs/adr/0003-public-api-signals-traceport.md)
(public API shape). The short version:

- Dependency injection, never import. No singletons, no globals, no
  `AsyncLocalStorage`.
- No `as` (except `as const`), no `any`, no `!`, no `class`/`instanceof`
  outside a package's `src/internal/`.
- Factories (`makeX(deps)`) returning plain records of functions; state in
  closures.
- Adapters depend on `core`, never the reverse; `@opentelemetry/*` only inside
  `packages/opentelemetry/src/`.
- No mocking libraries. Test with `createMemorySignals()` and
  `@youssoufcherif/signals-testing`.
- Never loosen `tsconfig.base.json` or `biome.json` to make code compile —
  fix the code.

These are checked by Biome plus `scripts/check-boundaries.mjs`, wired into
git hooks (lint + boundaries on commit, typecheck + tests on push) and CI.

## Before you push

```bash
node scripts/check-boundaries.mjs && pnpm lint && pnpm build && pnpm typecheck && pnpm test
```

CI runs exactly this gate on every PR; it must be green.

## Changesets — every user-visible change needs one

```bash
pnpm changeset
```

Pick the affected packages and write a short summary. While we are pre-`0.1.0`
**every bump is a `patch`** — all published packages share one fixed version
(`0.0.x`) and any release may break things; that's the documented dev-stage
policy (see [ADR-0004](./docs/adr/0004-publishing-and-versioning.md)).
Internal-only changes (docs, CI, tests) don't need a changeset.

Releases are automated: merging to `main` lets the release workflow open a
"Version Packages" PR; merging *that* publishes to npm with provenance.
Nobody publishes from a laptop.

## PR checklist

- [ ] Issue discussed first (for anything non-trivial)
- [ ] Full gate green locally (`boundaries`, `lint`, `build`, `typecheck`, `test`)
- [ ] New behavior covered by tests (memory provider, no mocks)
- [ ] ADR added/updated if a design decision changed
- [ ] Changeset added (patch) if the change is user-visible

## License

By contributing you agree your contributions are licensed under the
[MIT License](./LICENSE).
