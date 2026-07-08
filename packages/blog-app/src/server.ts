import { serve } from '@hono/node-server';
import type { Signals } from '@youssoufcherif/signals-core';
import { createMemorySignals } from '@youssoufcherif/signals-memory';
import { createNodeSignals } from '@youssoufcherif/signals-node';
import { createNoopSignals } from '@youssoufcherif/signals-noop';
import { createOtelSignals } from '@youssoufcherif/signals-opentelemetry';
import { makeInMemoryPostRepository } from './adapters/in-memory-post-repository.js';
import { createApp } from './http/app.js';

/**
 * `SIGNALS_PROVIDER` is external input (an env var), so per ADR-0001 it
 * goes through a small validating function that returns a typed `Signals`
 * or throws - not a cast, not a discriminated-union switch (a free-form
 * string isn't a closed union, so `assertNever` doesn't apply here; that
 * pattern is for our own internal closed types, not arbitrary env input).
 */
function createSignalsFromEnv(): Signals {
  const provider = process.env['SIGNALS_PROVIDER'] ?? 'node';

  if (provider === 'memory') return createMemorySignals();
  if (provider === 'noop') return createNoopSignals();
  if (provider === 'otel') return createOtelSignals({ serviceName: 'blog-app' });
  if (provider === 'node') return createNodeSignals({ pretty: true });

  throw new Error(
    `Unknown SIGNALS_PROVIDER "${provider}". Expected one of: memory, noop, otel, node.`,
  );
}

const signals = createSignalsFromEnv();
const repo = makeInMemoryPostRepository();
const app = createApp({ signals, repo });

const port = Number(process.env['PORT'] ?? 3000);

serve({ fetch: app.fetch, port }, (info) => {
  // This one console.log is the composition root's own startup message,
  // not telemetry - it's fine here regardless of which Signals provider
  // is active.
  console.log(
    `blog-app listening on http://localhost:${info.port} (SIGNALS_PROVIDER=${process.env['SIGNALS_PROVIDER'] ?? 'node'})`,
  );
});

async function shutdown() {
  await signals.shutdown();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
