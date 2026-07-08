import { describe, expect, it, vi } from 'vitest';
import { createOtelSignals } from '../src/make-otel-port.js';

describe('createOtelSignals', () => {
  it('runs a nested span without throwing, using the default OTel API tracer', async () => {
    const signals = createOtelSignals({ serviceName: 'test-service' });

    const result = await signals.trace.run('parent', async (ctx) => {
      ctx.trace.attribute('key', 'value');
      return ctx.trace.run('child', async (child) => {
        child.metric.counter('requests');
        child.metric.histogram('latency', 12);
        child.metric.gauge('depth', 3);
        return 'ok';
      });
    });

    expect(result).toBe('ok');
  });

  it('propagates thrown errors after recording the exception', async () => {
    const signals = createOtelSignals({ serviceName: 'test-service' });

    await expect(
      signals.trace.run('failing', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });

  it('calls the injected onFlush during shutdown', async () => {
    const onFlush = vi.fn(async () => {});
    const signals = createOtelSignals({ serviceName: 'test-service', onFlush });

    await signals.shutdown();

    expect(onFlush).toHaveBeenCalledOnce();
  });
});
