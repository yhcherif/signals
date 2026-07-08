# @youssoufcherif/blog-app

A tiny Hono blog API built to stress-test the `@youssoufcherif/signals` design
against a real consumer app - same rules apply here as in the platform
itself: no `class`, no `as`, dependency injection over import, local
minimal interfaces over shared contracts.

## Run it

```bash
pnpm dev            # SIGNALS_PROVIDER=node (structured console JSON)
pnpm dev:memory     # in-memory, nothing printed - inspect via signals.getSpans() in code
pnpm dev:otel       # OpenTelemetry adapter (no exporter registered by default)
pnpm dev:noop       # telemetry fully disabled
```

Then:

```bash
curl -X POST http://localhost:3000/posts \
  -H 'content-type: application/json' \
  -d '{"title":"Hello","body":"World"}'

curl http://localhost:3000/posts
curl http://localhost:3000/posts/post-1
```

## What to look at

- `src/http/routes/posts.ts` - each handler declares its own local,
  minimal interface for the repository capability it needs (e.g.
  `{ findAll: () => Promise<Post[]> }`), rather than importing a shared
  `PostRepository` type from the adapter. This is the exact pattern
  requested for the core `signals` packages, applied to this app's own
  domain.
- `src/http/middleware/observability.ts` - one root span per request,
  exposed to handlers via Hono's per-request context (`c.get('signals')`)
  - the same "explicit context, not global" idea from ADR-0003, just
  expressed through Hono's own mechanism instead of ours.
- `src/http/routes/posts.ts` `createPost` - a nested `signals.trace.run`
  inside a handler, producing a child span, a metric, and a warn-level log
  on validation failure, entirely through the public `Signals` API.
- `src/server.ts` - the only file that imports all four
  `@youssoufcherif/signals-*` provider packages; picks one based on
  `SIGNALS_PROVIDER` and never touches it again.
- `test/posts.test.ts` - a full integration test using a real Hono app, a
  real in-memory repository, and a real `createMemorySignals()` - no
  mocking library anywhere - asserting on both HTTP responses and on what
  telemetry was actually recorded.
