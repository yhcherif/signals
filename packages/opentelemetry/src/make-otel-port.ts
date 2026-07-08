import {
  context as otelContext,
  metrics as otelMetrics,
  trace as otelTrace,
} from '@opentelemetry/api';
import { SpanStatusCode } from '@opentelemetry/api';
import type { Counter, Histogram, Meter, Span, Tracer, UpDownCounter } from '@opentelemetry/api';
import { createSignals } from '@youssoufcherif/signals-core';
import type { Signals, SignalsPort, SpanHandle } from '@youssoufcherif/signals-core';
import { assertNever } from '@youssoufcherif/signals-core';
import { toOtelExceptionInput } from './internal/to-otel-exception.js';

export type OtelPortConfig = {
  serviceName: string;
  /** Inject an existing tracer instead of resolving one from the global provider. */
  tracer?: Tracer;
  /** Inject an existing meter instead of resolving one from the global provider. */
  meter?: Meter;
  /**
   * Called from `flush()`. Wire this to your TracerProvider/MeterProvider's
   * `forceFlush`/`shutdown` — this adapter deliberately doesn't reach for a
   * global SDK instance, keeping provider setup entirely at your
   * composition root.
   */
  onFlush?: () => Promise<void>;
};

/**
 * The OTel strategy. This is the ONLY file in the whole ecosystem allowed
 * to import `@opentelemetry/api` (see ADR-0002, biome.json override, and
 * scripts/check-boundaries.mjs). Everything it produces is translated into
 * the plain `SignalsPort` shape before leaving this file — no `Span`,
 * `Tracer`, or other OTel type is ever returned to a caller.
 *
 * Parent/child span linkage uses an identity-keyed WeakMap from our own
 * `SpanHandle` to the underlying OTel `Span`, rather than exposing the OTel
 * span on the handle itself. This keeps `SpanHandle` vendor-free while
 * still letting this adapter build correct OTel parent contexts.
 */
export function makeOtelPort(config: OtelPortConfig): SignalsPort {
  const tracer = config.tracer ?? otelTrace.getTracer(config.serviceName);
  const meter = config.meter ?? otelMetrics.getMeter(config.serviceName);

  const otelSpanByHandle = new WeakMap<SpanHandle, Span>();
  const counters = new Map<string, Counter>();
  const histograms = new Map<string, Histogram>();
  const gauges = new Map<string, UpDownCounter>();

  const startSpan: SignalsPort['startSpan'] = (name, parent) => {
    const parentOtelSpan = parent ? otelSpanByHandle.get(parent) : undefined;
    const parentContext = parentOtelSpan
      ? otelTrace.setSpan(otelContext.active(), parentOtelSpan)
      : otelContext.active();

    const span = tracer.startSpan(name, undefined, parentContext);

    const handle: SpanHandle = {
      setAttribute: (key, value) => {
        span.setAttribute(key, value);
      },
      addEvent: (eventName, attrs) => {
        span.addEvent(eventName, attrs);
      },
      recordException: (err) => {
        span.recordException(toOtelExceptionInput(err));
        span.setStatus({ code: SpanStatusCode.ERROR });
      },
      end: () => {
        span.end();
      },
      getCorrelation: () => {
        const spanContext = span.spanContext();
        return { traceId: spanContext.traceId, spanId: spanContext.spanId };
      },
    };

    otelSpanByHandle.set(handle, span);
    return handle;
  };

  const log: SignalsPort['log'] = (level, message, attrs) => {
    // A dedicated OTel Logs SDK integration (@opentelemetry/api-logs) is a
    // natural follow-up once that API stabilizes further. For now, route
    // through console with level + attrs preserved as structured JSON,
    // which is still fully correlated via the caller's injected
    // traceId/spanId attrs from createSignals' log correlation.
    console.log(JSON.stringify({ level, message, ...attrs }));
  };

  const recordMetric: SignalsPort['recordMetric'] = (kind, name, value, attrs) => {
    switch (kind) {
      case 'counter': {
        const counter = counters.get(name) ?? meter.createCounter(name);
        counters.set(name, counter);
        counter.add(value, attrs);
        return;
      }
      case 'histogram': {
        const histogram = histograms.get(name) ?? meter.createHistogram(name);
        histograms.set(name, histogram);
        histogram.record(value, attrs);
        return;
      }
      case 'gauge': {
        // OTel's true gauge is observable/callback-based; an UpDownCounter
        // is the closest push-based approximation. Documented limitation:
        // this behaves like a running total, not an instantaneous
        // snapshot. A callback-based observable gauge is a natural
        // follow-up if that distinction matters for your dashboards.
        const gauge = gauges.get(name) ?? meter.createUpDownCounter(name);
        gauges.set(name, gauge);
        gauge.add(value, attrs);
        return;
      }
      default:
        assertNever(kind);
    }
  };

  const flush: SignalsPort['flush'] = async () => {
    if (config.onFlush) {
      await config.onFlush();
    }
  };

  return { startSpan, log, recordMetric, flush };
}

export function createOtelSignals(config: OtelPortConfig): Signals {
  return createSignals(makeOtelPort(config));
}
