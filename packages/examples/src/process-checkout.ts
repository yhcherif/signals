import type { Signals } from '@youssoufcherif/signals-core';

/**
 * This function never imports `@youssoufcherif/signals-memory`, `-node`, or
 * `-opentelemetry`. It receives whatever `Signals` its caller built at the
 * composition root — this is the "success criterion" from ADR-0001 made
 * concrete: swapping providers never touches this file.
 */
export async function processCheckout(
  signals: Signals,
  order: { id: string; total: number },
): Promise<{ status: 'charged' }> {
  return signals.trace.run('checkout.process', async (ctx) => {
    ctx.trace.attribute('order.id', order.id);
    ctx.log.info('processing checkout', { orderId: order.id });

    await ctx.trace.run('checkout.validate', async (validateCtx) => {
      validateCtx.trace.event('cart.validated', { total: order.total });
    });

    await ctx.trace.run('checkout.charge', async (chargeCtx) => {
      chargeCtx.metric.counter('payment.attempts');
      chargeCtx.log.info('charging payment provider', { provider: 'stripe' });
      chargeCtx.metric.histogram('payment.amount', order.total);
    });

    return { status: 'charged' as const };
  });
}
