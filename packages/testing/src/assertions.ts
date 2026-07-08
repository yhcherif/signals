import type { MemorySignals, RecordedSpan } from '@youssoufcherif/signals-memory';

/**
 * Finds a recorded span by name, or throws with a helpful message listing
 * what was actually recorded. Plain function, not a custom Vitest matcher
 * — keeps this package usable from any test runner, not just Vitest.
 */
export function expectSpan(signals: MemorySignals, name: string): RecordedSpan {
  const span = signals.getSpans().find((s) => s.name === name);
  if (!span) {
    const recordedNames = signals.getSpans().map((s) => s.name);
    throw new Error(
      `Expected a span named "${name}" but none was recorded. Recorded spans: [${recordedNames.join(', ')}]`,
    );
  }
  return span;
}

export function expectSpanEnded(signals: MemorySignals, name: string): void {
  const span = expectSpan(signals, name);
  if (!span.ended) {
    throw new Error(`Expected span "${name}" to have ended, but it is still open.`);
  }
}

export function expectLogMessage(signals: MemorySignals, message: string): void {
  const found = signals.getLogs().some((log) => log.message === message);
  if (!found) {
    const recordedMessages = signals.getLogs().map((log) => log.message);
    throw new Error(
      `Expected a log with message "${message}" but none was recorded. Recorded messages: [${recordedMessages.join(', ')}]`,
    );
  }
}

export function expectMetric(signals: MemorySignals, name: string): void {
  const found = signals.getMetrics().some((metric) => metric.name === name);
  if (!found) {
    const recordedNames = signals.getMetrics().map((metric) => metric.name);
    throw new Error(
      `Expected a metric named "${name}" but none was recorded. Recorded metrics: [${recordedNames.join(', ')}]`,
    );
  }
}
