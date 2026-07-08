import { describe, expect, it } from 'vitest';
import {
  createMemorySignals,
  expectLogMessage,
  expectMetric,
  expectSpanEnded,
} from '../src/index.js';

describe('signals-testing assertions', () => {
  it('expectSpanEnded passes for a completed span', async () => {
    const signals = createMemorySignals();
    await signals.trace.run('checkout', async () => {});

    expect(() => expectSpanEnded(signals, 'checkout')).not.toThrow();
  });

  it('expectSpanEnded throws with a helpful message when the span is missing', async () => {
    const signals = createMemorySignals();
    await signals.trace.run('checkout', async () => {});

    expect(() => expectSpanEnded(signals, 'nonexistent')).toThrow(/Recorded spans: \[checkout\]/);
  });

  it('expectLogMessage and expectMetric find recorded entries', () => {
    const signals = createMemorySignals();
    signals.log.info('hello world');
    signals.metric.counter('requests');

    expect(() => expectLogMessage(signals, 'hello world')).not.toThrow();
    expect(() => expectMetric(signals, 'requests')).not.toThrow();
  });
});
