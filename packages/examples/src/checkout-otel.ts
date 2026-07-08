import { createOtelSignals } from '@youssoufcherif/signals-opentelemetry';
import { processCheckout } from './process-checkout.js';

// In a real service you'd register a TracerProvider/MeterProvider with
// real exporters before this line (see signals-opentelemetry's README).
// Without one registered, the OTel API's default no-op implementations
// are used - spans/metrics are created but not exported anywhere, which
// is still useful to prove wiring works before adding exporters.
const signals = createOtelSignals({ serviceName: 'checkout-service' });

const result = await processCheckout(signals, { id: 'order_3', total: 15 });
console.log('result:', result);

await signals.shutdown();
