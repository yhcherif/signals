import { describe, expect, it } from 'vitest';
import { createSignals } from '../src/compose.js';
import type { AttrRecord, SignalsPort, SpanHandle } from '../src/ports.js';

/**
 * A tiny hand-rolled fake — not a mocking library, not a class, just a
 * closure over arrays. This is the pattern every real adapter follows,
 * and it's proof that `createSignals` needs nothing more than a
 * `SignalsPort` shape to be fully testable.
 */
function makeFakePort() {
  const spans: { name: string; ended: boolean; attrs: AttrRecord; exceptions: unknown[] }[] = [];
  const logs: { level: string; message: string; attrs?: AttrRecord }[] = [];
  const metrics: { kind: string; name: string; value: number }[] = [];
  let idCounter = 0;

  const port: SignalsPort = {
    startSpan: (name) => {
      const record: { name: string; ended: boolean; attrs: AttrRecord; exceptions: unknown[] } = {
        name,
        ended: false,
        attrs: {},
        exceptions: [],
      };
      spans.push(record);
      const id = `span-${++idCounter}`;
      const handle: SpanHandle = {
        setAttribute: (key, value) => {
          record.attrs[key] = value;
        },
        addEvent: () => {},
        recordException: (err) => {
          record.exceptions.push(err);
        },
        end: () => {
          record.ended = true;
        },
        getCorrelation: () => ({ spanId: id }),
      };
      return handle;
    },
    log: (level, message, attrs) => {
      logs.push({ level, message, attrs });
    },
    recordMetric: (kind, name, value) => {
      metrics.push({ kind, name, value });
    },
    flush: async () => {},
  };

  return { port, spans, logs, metrics };
}

describe('createSignals', () => {
  it('starts and ends a span for run()', async () => {
    const { port, spans } = makeFakePort();
    const signals = createSignals(port);

    await signals.trace.run('work', async () => 'done');

    expect(spans).toHaveLength(1);
    expect(spans[0]?.name).toBe('work');
    expect(spans[0]?.ended).toBe(true);
  });

  it('records an exception and rethrows when the callback throws', async () => {
    const { port, spans } = makeFakePort();
    const signals = createSignals(port);

    await expect(
      signals.trace.run('failing', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(spans[0]?.ended).toBe(true);
    expect(spans[0]?.exceptions).toHaveLength(1);
  });

  it('degrades event() to a log line when there is no active span', () => {
    const { port, logs } = makeFakePort();
    const signals = createSignals(port);

    signals.trace.event('top-level-event', { foo: 'bar' });

    expect(logs).toHaveLength(1);
    expect(logs[0]?.message).toBe('top-level-event');
  });

  it('attaches event() to the active span instead of logging when nested', async () => {
    const { port, logs } = makeFakePort();
    const signals = createSignals(port);

    await signals.trace.run('parent', async (ctx) => {
      ctx.trace.event('nested-event');
    });

    expect(logs).toHaveLength(0);
  });

  it('injects span correlation into log attributes automatically', async () => {
    const { port, logs } = makeFakePort();
    const signals = createSignals(port);

    await signals.trace.run('parent', async (ctx) => {
      ctx.log.info('hello');
    });

    expect(logs[0]?.attrs).toMatchObject({ spanId: 'span-1' });
  });

  it('records metrics of every kind', () => {
    const { port, metrics } = makeFakePort();
    const signals = createSignals(port);

    signals.metric.counter('requests');
    signals.metric.histogram('latency', 42);
    signals.metric.gauge('queue-depth', 3);

    expect(metrics).toEqual([
      { kind: 'counter', name: 'requests', value: 1 },
      { kind: 'histogram', name: 'latency', value: 42 },
      { kind: 'gauge', name: 'queue-depth', value: 3 },
    ]);
  });
});
