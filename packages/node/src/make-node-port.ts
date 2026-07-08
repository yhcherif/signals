import { createSignals } from '@youssoufcherif/signals-core';
import type { AttrRecord, Signals, SignalsPort, SpanHandle } from '@youssoufcherif/signals-core';
import { errorToAttrs } from './internal/error-to-attrs.js';

export type NodePortOptions = {
  /** Pretty-print JSON output. Defaults to false (one line per event). */
  pretty?: boolean;
  /** Injectable for testing; defaults to the real console. */
  write?: (line: string) => void;
};

function serialize(payload: Record<string, unknown>, pretty: boolean | undefined): string {
  return pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload);
}

/**
 * The node strategy: a real, working provider backed by `console` and
 * `performance.now()` — nothing from `@opentelemetry/*`. Useful for CLIs,
 * scripts, and any context where pulling in the OTel SDK isn't worth the
 * dependency weight or cold-start cost, but structured output is still
 * wanted over silence.
 */
export function makeNodePort(options: NodePortOptions = {}): SignalsPort {
  const write = options.write ?? ((line: string) => console.log(line));
  let spanCounter = 0;

  const startSpan: SignalsPort['startSpan'] = (name, parent, attrs) => {
    const id = `span-${++spanCounter}`;
    const parentSpanId = parent?.getCorrelation()['spanId'];
    const startedAt = performance.now();
    const attributes: AttrRecord = { ...attrs };

    write(
      serialize(
        { evt: 'span.start', span: name, id, parentId: parentSpanId, attributes },
        options.pretty,
      ),
    );

    const handle: SpanHandle = {
      setAttribute: (key, value) => {
        attributes[key] = value;
      },
      addEvent: (eventName, eventAttrs) => {
        write(
          serialize(
            { evt: 'span.event', span: name, id, name: eventName, attrs: eventAttrs },
            options.pretty,
          ),
        );
      },
      recordException: (err) => {
        write(
          serialize(
            { evt: 'span.exception', span: name, id, error: errorToAttrs(err) },
            options.pretty,
          ),
        );
      },
      end: () => {
        write(
          serialize(
            {
              evt: 'span.end',
              span: name,
              id,
              durationMs: performance.now() - startedAt,
              attributes,
            },
            options.pretty,
          ),
        );
      },
      getCorrelation: () => ({ traceId: 'node-trace', spanId: id }),
    };
    return handle;
  };

  const log: SignalsPort['log'] = (level, message, attrs) => {
    write(serialize({ evt: 'log', level, message, ...attrs }, options.pretty));
  };

  const recordMetric: SignalsPort['recordMetric'] = (kind, name, value, attrs) => {
    write(serialize({ evt: 'metric', kind, name, value, ...attrs }, options.pretty));
  };

  return {
    startSpan,
    log,
    recordMetric,
    flush: async () => {},
  };
}

export function createNodeSignals(options?: NodePortOptions): Signals {
  return createSignals(makeNodePort(options));
}
