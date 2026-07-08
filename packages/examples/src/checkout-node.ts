import { createNodeSignals } from '@youssoufcherif/signals-node';
import { processCheckout } from './process-checkout.js';

const signals = createNodeSignals({ pretty: true });

const result = await processCheckout(signals, { id: 'order_2', total: 99 });
console.log('result:', result);

await signals.shutdown();
