import type { Signals } from '@youssoufcherif/signals-core';
import type { Context, Next } from 'hono';

/**
 * Hono's per-request context variables ARE our explicit-context mechanism
 * here - not a new one. `c.set('signals', ctx)` is exactly the same idea
 * as passing `ctx` into a nested `trace.run` callback (ADR-0003): a
 * request-scoped value handed down explicitly, never a global.
 */
export type ObservabilityVariables = {
  signals: Signals;
};

/**
 * Takes the root `Signals` (built once at the composition root - see
 * server.ts) and returns Hono middleware that opens one span per request,
 * records method/path/status, and makes a span-scoped `Signals` available
 * to every handler downstream via `c.get('signals')`.
 */
export function observability(rootSignals: Signals) {
  return async (c: Context<{ Variables: ObservabilityVariables }>, next: Next) => {
    await rootSignals.trace.run(`http.${c.req.method} ${c.req.path}`, async (ctx) => {
      ctx.trace.attribute('http.method', c.req.method);
      ctx.trace.attribute('http.path', c.req.path);
      c.set('signals', ctx);

      try {
        await next();
      } finally {
        ctx.trace.attribute('http.status', c.res.status);
      }
    });
  };
}
