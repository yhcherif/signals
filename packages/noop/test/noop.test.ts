import { describe, expect, it } from 'vitest';
import { createNoopSignals } from '../src/make-noop-port.js';

describe('createNoopSignals', () => {
  it('runs the callback and returns its value without throwing', async () => {
    const signals = createNoopSignals();

    const result = await signals.trace.run('anything', async (ctx) => {
      ctx.trace.event('ignored');
      ctx.trace.attribute('ignored', 'value');
      ctx.log.info('ignored');
      ctx.metric.counter('ignored');
      return 42;
    });

    expect(result).toBe(42);
  });

  it('still propagates thrown errors', async () => {
    const signals = createNoopSignals();
    await expect(
      signals.trace.run('failing', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });

  it('shutdown resolves without error', async () => {
    const signals = createNoopSignals();
    await expect(signals.shutdown()).resolves.toBeUndefined();
  });
});
