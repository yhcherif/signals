import { describe, expect, it } from 'vitest';
import { createMemorySignals } from '../src/create-memory-signals.js';

describe('createMemorySignals', () => {
  it('records a span with nested attributes and events', async () => {
    const signals = createMemorySignals();

    await signals.trace.run('checkout', async (ctx) => {
      ctx.trace.attribute('userId', 'u_123');
      ctx.trace.event('cart.validated', { itemCount: 3 });
    });

    const spans = signals.getSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0]?.name).toBe('checkout');
    expect(spans[0]?.ended).toBe(true);
    expect(spans[0]?.attributes).toMatchObject({ userId: 'u_123' });
    expect(spans[0]?.events).toEqual([{ name: 'cart.validated', attrs: { itemCount: 3 } }]);
  });

  it('records parent/child span relationships via parentId', async () => {
    const signals = createMemorySignals();

    await signals.trace.run('parent', async (ctx) => {
      await ctx.trace.run('child', async () => {});
    });

    const [parent, child] = signals.getSpans();
    expect(child?.parentId).toBe(parent?.id);
  });

  it('reset() clears recorded state between tests', async () => {
    const signals = createMemorySignals();
    await signals.trace.run('work', async () => {});
    expect(signals.getSpans()).toHaveLength(1);

    signals.reset();

    expect(signals.getSpans()).toHaveLength(0);
  });
});
