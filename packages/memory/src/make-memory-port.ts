import type {
  AttrRecord,
  LogLevel,
  MetricKind,
  SignalsPort,
  SpanHandle,
} from '@youssoufcherif/signals-core';

export type RecordedSpan = {
  id: string;
  name: string;
  parentId?: string | undefined;
  attributes: AttrRecord;
  events: { name: string; attrs?: AttrRecord | undefined }[];
  exceptions: unknown[];
  ended: boolean;
};

export type RecordedLog = {
  level: LogLevel;
  message: string;
  attrs?: AttrRecord | undefined;
};

export type RecordedMetric = {
  kind: MetricKind;
  name: string;
  value: number;
  attrs?: AttrRecord | undefined;
};

/**
 * The memory strategy: `SignalsPort` implemented with plain closures over
 * arrays, plus three inspection getters that are NOT part of `SignalsPort`
 * — they're extra surface this package adds on top so tests can assert on
 * what happened. Returning "port fields + extra fields" still satisfies
 * `SignalsPort` structurally; nothing here needs a class or a cast.
 */
export function makeMemoryPort() {
  const spans: RecordedSpan[] = [];
  const logs: RecordedLog[] = [];
  const metrics: RecordedMetric[] = [];
  let spanCounter = 0;

  const startSpan: SignalsPort['startSpan'] = (name, parent, attrs) => {
    const id = `span-${++spanCounter}`;
    const parentSpanId = parent?.getCorrelation()['spanId'];
    const record: RecordedSpan = {
      id,
      name,
      parentId: typeof parentSpanId === 'string' ? parentSpanId : undefined,
      attributes: { ...attrs },
      events: [],
      exceptions: [],
      ended: false,
    };
    spans.push(record);

    const handle: SpanHandle = {
      setAttribute: (key, value) => {
        record.attributes[key] = value;
      },
      addEvent: (eventName, eventAttrs) => {
        record.events.push({ name: eventName, attrs: eventAttrs });
      },
      recordException: (error) => {
        record.exceptions.push(error);
      },
      end: () => {
        record.ended = true;
      },
      getCorrelation: () => ({ traceId: 'memory-trace', spanId: id }),
    };
    return handle;
  };

  const log: SignalsPort['log'] = (level, message, attrs) => {
    logs.push({ level, message, attrs });
  };

  const recordMetric: SignalsPort['recordMetric'] = (kind, name, value, attrs) => {
    metrics.push({ kind, name, value, attrs });
  };

  const flush: SignalsPort['flush'] = async () => {};

  return {
    startSpan,
    log,
    recordMetric,
    flush,
    getSpans: (): RecordedSpan[] => [...spans],
    getLogs: (): RecordedLog[] => [...logs],
    getMetrics: (): RecordedMetric[] => [...metrics],
    reset: (): void => {
      spans.length = 0;
      logs.length = 0;
      metrics.length = 0;
    },
  };
}

export type MemoryPort = ReturnType<typeof makeMemoryPort>;
