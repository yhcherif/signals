# ADR-0004: Publishing & Versioning Policy (dev stage)

- **Status**: Accepted
- **Date**: 2026-07-08

## Context

The platform is ready to be consumed by the author's own projects, but the
port contract is still expected to churn. We need real npm publishes (so
consuming projects install normal registry packages, not `file:`/git deps)
without signalling stability we don't have, and a release pipeline that is
boring and repeatable from day one.

ADR-0002 prescribed independent per-package versioning via Changesets. That
remains the destination, but while every release may touch the shared port
shape, independent versions are bookkeeping without benefit: consumers of any
adapter must upgrade `core` in lockstep anyway.

## Decision

1. **Registry & visibility**: public npm, under the `@youssoufcherif` scope
   (the npm account's current username; the former `yhcherif` scope is
   retired). Public because it is free and frictionless to consume; the
   dev-stage warning is carried by versioning and documentation, not access
   control. Publishable packages: `signals-core`, `signals-memory`,
   `signals-noop`, `signals-node`, `signals-opentelemetry`, `signals-testing`.
   `examples` and `blog-app` are `private: true`, never published.
2. **License**: MIT, root `LICENSE` copied into every published tarball.
3. **Versioning**: **fixed group** in `.changeset/config.json` — all six
   packages share one version, starting at `0.0.1` and bumped together. While
   pre-`0.1.0`, every changeset is a `patch`; under semver-0 semantics any
   release may break, and `^0.0.x` ranges float nothing, so consumers pin
   exact versions and upgrade deliberately. This temporarily supersedes
   ADR-0002's independent versioning.
4. **Graduation criteria**: `0.1.0` is cut when the port shape survives real
   use in ≥2 consuming projects without a breaking change for a sustained
   period. At `0.1.0` the fixed group is dissolved and packages return to
   independent versioning per ADR-0002.
5. **Module format**: ESM-only (`"type": "module"`), Node ≥ 20, no CJS build
   until a concrete consumer needs one.
6. **Pipeline**: GitHub Actions only — CI (boundaries → lint → build →
   typecheck → test) on every PR/push; `changesets/action` on `main` opens a
   "Version Packages" PR and, when merged, runs `pnpm build && changeset
   publish` with a granular npm automation token and `--provenance`
   (`publishConfig.provenance: true`). No publishing from developer machines
   after the pipeline is proven.

## Consequences

**Easier:** one version to reason about across the ecosystem; consuming
projects upgrade all `@youssoufcherif/signals-*` deps to the same number;
release mechanics are a merge button; provenance links every tarball to a
public build.

**Harder:** a doc-only fix to one adapter still bumps all six packages —
accepted noise at this stage; the `0.1.0` graduation requires deliberately
dissolving the fixed group and writing per-package changelog discipline into
the workflow; ADR-0002's versioning statement is out of date until then (this
ADR is the authority on versioning while it is marked Accepted).

## Alternatives Considered

- **GitHub Packages / private npm**: truly gated, but adds token+`.npmrc`
  friction to every consuming project (and CI), for code that is public in
  spirit anyway. Rejected.
- **Independent versioning from day one** (ADR-0002 as written): accurate
  per-package changelogs, but a cross-package version matrix while the core
  contract churns. Deferred to `0.1.0`, not rejected.
- **`0.x.y` with minor bumps for breaking changes**: more semver-expressive,
  but overstates stability and invites `^0.x` ranges that float. `0.0.x`
  states the truth: everything may change.
