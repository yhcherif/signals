export type OtelExceptionInput = { name?: string; message: string; stack?: string };

/**
 * OTel's `recordException` wants a plain object shape, not necessarily a
 * real `Error`. We build a fresh object rather than casting `err` into
 * that shape - this file lives in `internal/` specifically because of the
 * `instanceof Error` check below, kept isolated from the rest of the
 * adapter per the class/instanceof convention in ADR-0001.
 *
 * Optional keys are omitted entirely when absent (rather than set to
 * `undefined`) because OTel's own `Exception` type does not opt in to
 * `exactOptionalPropertyTypes`-style `| undefined` on its optional fields
 * - a vendor constraint we work around here rather than by loosening our
 * own tsconfig.
 */
export function toOtelExceptionInput(err: unknown): OtelExceptionInput {
  if (err instanceof Error) {
    return {
      message: err.message,
      ...(err.name !== undefined ? { name: err.name } : {}),
      ...(err.stack !== undefined ? { stack: err.stack } : {}),
    };
  }
  return { message: String(err) };
}
