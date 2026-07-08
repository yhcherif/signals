import { createMemorySignals } from '@youssoufcherif/signals-memory';
import { processCheckout } from './process-checkout.js';

// The only line that changes between checkout-memory.ts, checkout-node.ts,
// and checkout-otel.ts is this composition-root line. `processCheckout`
// itself is byte-for-byte identical across all three.
const signals = createMemorySignals();

const result = await processCheckout(signals, { id: 'order_1', total: 42 });
console.log('result:', result);
console.log(
  'recorded spans:',
  signals.getSpans().map((s) => s.name),
);
console.log(
  'recorded logs:',
  signals.getLogs().map((l) => l.message),
);
console.log(
  'recorded metrics:',
  signals.getMetrics().map((m) => `${m.name}=${m.value}`),
);

await signals.shutdown();
