import { describe, expect, it } from 'vitest';
import { createNodeSignals } from '../src/make-node-port.js';

describe('createNodeSignals', () => {
  it('writes structured JSON lines for span lifecycle and logs', async () => {
    const lines: string[] = [];
    const signals = createNodeSignals({ write: (line) => lines.push(line) });

    await signals.trace.run('checkout', async (ctx) => {
      ctx.log.info('processing');
    });

    const parsed = lines.map((line) => JSON.parse(line));
    expect(parsed.some((p) => p.evt === 'span.start' && p.span === 'checkout')).toBe(true);
    expect(parsed.some((p) => p.evt === 'span.end' && p.span === 'checkout')).toBe(true);
    expect(parsed.some((p) => p.evt === 'log' && p.message === 'processing')).toBe(true);
  });

  it('writes a span.exception line and rethrows on error', async () => {
    const lines: string[] = [];
    const signals = createNodeSignals({ write: (line) => lines.push(line) });

    await expect(
      signals.trace.run('failing', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const parsed = lines.map((line) => JSON.parse(line));
    expect(parsed.some((p) => p.evt === 'span.exception')).toBe(true);
  });
});
