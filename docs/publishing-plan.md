# Publishing plan — signals monorepo

Status: **approved plan, not yet implemented**. Decisions locked with the owner on 2026-07-08:
public npm registry, MIT license, **fixed** versioning at `0.0.x` across all publishable
packages (switch to independent per-package versioning per ADR-0002 at `0.1.0`, when the
port contract stabilizes).

Dev-stage posture: published publicly so the owner can `pnpm add` the packages from any
project, but explicitly marked **pre-alpha** — `0.0.x` versions plus a prominent README
banner stating APIs change without notice and external use is not yet supported.

Publishable: `signals-core`, `signals-memory`, `signals-noop`, `signals-node`,
`signals-opentelemetry`, `signals-testing`. Never published: `examples`, `blog-app`
(both stay `"private": true`).

---

## Phase 0 — Accounts & one-time setup (manual, outside the repo)

1. npm account owning the `youssoufcherif` scope (`npm whoami` must print `youssoufcherif`, or an
   org named `youssoufcherif` must exist). Enable 2FA on the account.
2. Create a **granular automation token** on npmjs.com: packages+scopes limited to
   `@youssoufcherif/*`, permission "Read and write", bypass-2FA-for-automation. This is what CI
   publishes with.
3. Create the GitHub repo (`<github-user>/signals`), add the token as the `NPM_TOKEN`
   Actions secret. Allow GitHub Actions to create pull requests
   (Settings → Actions → General → Workflow permissions).

## Phase 1 — Repo hygiene

1. `git init` + initial commit + push to the new remote (`main` as default branch).
   `pnpm install` runs `lefthook install` via the existing `prepare` script.
2. Add root `LICENSE` (MIT, copyright Youssouf Cherif Hamed) and copy it into each
   publishable package directory (npm tarballs do not inherit the repo-root LICENSE).
3. Add `.idea/` to `.gitignore`.

## Phase 2 — Package manifest hardening (all six publishable packages)

- `"version": "0.0.0"` (the first changesets release makes it `0.0.1`).
- `"license": "MIT"`, `"author"`, `"repository"` (git URL + `"directory"` per package),
  `"homepage"`, `"bugs"`, a few `"keywords"`.
- `"publishConfig": { "access": "public", "provenance": true }` — scoped packages default
  to restricted; publish fails without `access: public`. Provenance links each publish to
  its GitHub Actions run.
- `"sideEffects": false`, `"engines": { "node": ">=20" }`.
- `"files": ["dist"]` stays; add `LICENSE` alongside (README is auto-included).
- Stays **ESM-only** (`"type": "module"`, import-only exports) — an explicit decision,
  documented in README and ADR-0004. Dual CJS builds are out of scope until someone
  actually needs them.
- `workspace:*` internal deps are fine: pnpm/changesets rewrite them to real versions in
  the published tarball.
- `@opentelemetry/api` stays a peerDependency of `signals-opentelemetry`.

## Phase 3 — Changesets

- `pnpm changeset init`, then edit `.changeset/config.json`:
  - `"fixed": [["@youssoufcherif/signals-core", "@youssoufcherif/signals-memory", "@youssoufcherif/signals-noop", "@youssoufcherif/signals-node", "@youssoufcherif/signals-opentelemetry", "@youssoufcherif/signals-testing"]]`
  - `"access": "public"`, `"baseBranch": "main"`,
    `"privatePackages": { "version": false, "tag": false }`.
- Working rule (goes in CONTRIBUTING): every user-visible change lands with a changeset
  (`pnpm changeset`); while pre-`0.1.0`, **everything is a `patch`** so versions walk
  `0.0.1 → 0.0.2 → …`. Under semver-0 any bump may break — that is the dev-stage signal.

## Phase 4 — CI workflows (`.github/workflows/`)

- **`ci.yml`** — on PRs and pushes to `main`: checkout → pnpm setup (Node 22, pnpm cache)
  → `pnpm install --frozen-lockfile` → `node scripts/check-boundaries.mjs` →
  `pnpm lint` → `pnpm typecheck` → `pnpm build` → `pnpm test`. This mirrors the local
  final gate; CI green must mean publishable.
- **`release.yml`** — on push to `main`, using `changesets/action`:
  - If pending changesets exist → opens/updates a "Version Packages" PR (bumps versions,
    writes changelogs).
  - When that PR is merged → runs `pnpm build` then `pnpm changeset publish` with
    `NPM_TOKEN`, creates git tags (`@youssoufcherif/signals-core@0.0.1`, …) and GitHub Releases.
  - Needs `permissions: contents: write, pull-requests: write, id-token: write`
    (id-token for provenance).

## Phase 5 — Documentation

- **Root README overhaul**: pre-alpha status banner at the very top ("⚠️ 0.0.x — built in
  the open, APIs change without notice, not yet supported for external use"); CI + npm
  version badges; install + quick start per adapter; package table; versioning policy
  (fixed 0.0.x now, what 0.1.0 will mean); links to ADRs, CONTRIBUTING, LICENSE.
- **Per-package READMEs** (all six — npm currently shows a blank page for each): what the
  package is in two sentences, install command, one minimal runnable example, links back
  to the monorepo docs and status banner. Short; the deep docs live in the repo.
- **CONTRIBUTING.md**: dev setup (pnpm, lefthook auto-installed), the house rules in
  brief with pointers to ADRs and `scripts/check-boundaries.mjs`, commands
  (lint/typecheck/test/boundaries), the changeset requirement, PR checklist, and an
  honest note that external PRs are welcome for discussion but the API is churning —
  open an issue first.
- **ADR-0004 — publishing & versioning policy**: records everything decided here (public
  npm, MIT, fixed 0.0.x, ESM-only, Node ≥20, provenance, changesets flow, the criteria
  and mechanics for moving to 0.1.0 + independent versioning).
- Optional, later: SECURITY.md, CODE_OF_CONDUCT.md — not blockers for a 0.0.x dev release.

## Phase 6 — First publish, step by step

1. Full local gate: `node scripts/check-boundaries.mjs && pnpm lint && pnpm typecheck &&
   pnpm build && pnpm test`, plus run one example.
2. `npm whoami` → must be `youssoufcherif`.
3. **Dry run**: `pnpm -r --filter='!*examples*' --filter='!*blog-app*' exec npm pack`,
   inspect each tarball: `dist/`, `README.md`, `LICENSE`, `package.json` only — no `src/`,
   no tests, `workspace:*` rewritten.
4. Create the initial changeset (patch, all six packages, summary "initial dev release"),
   commit, push to `main`.
5. Let **CI publish**: release workflow opens the Version Packages PR (0.0.0 → 0.0.1);
   review the diff (versions + changelogs); merge; the workflow publishes all six with
   provenance and tags. Doing release #1 through CI validates the whole pipeline.
   (Fallback if the pipeline misbehaves: `pnpm changeset version && pnpm build &&
   pnpm changeset publish` locally with OTP, then fix CI.)
6. Verify: `npm view @youssoufcherif/signals-core` shows 0.0.1; in a scratch project outside
   the workspace, `pnpm add @youssoufcherif/signals-core @youssoufcherif/signals-memory`, run the
   README quick-start, confirm types resolve.

## Phase 7 — Consuming from your projects (dev-stage caveat)

Under semver, `^0.0.1` floats **nothing** — caret on `0.0.x` pins the exact patch. So in
consuming projects either depend on exact versions and bump deliberately (recommended),
or use a loose range knowingly. Each new signals release therefore requires an explicit
`pnpm update @youssoufcherif/signals-*` in consumers — a feature, not a bug, at this stage.

## Ongoing release loop (after the first publish)

change code → `pnpm changeset` (patch) → PR → CI green → merge → merge the auto
"Version Packages" PR when ready to cut a release → CI publishes. Batching several
changesets into one release is normal; the version PR just accumulates.
