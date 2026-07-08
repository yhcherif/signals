import type { AttrRecord } from '@youssoufcherif/signals-core';

/**
 * `instanceof Error` here is normal JS error normalization, not a vendor
 * telemetry type crossing a port boundary — the ADR-0001 restriction is
 * about vendor SDK objects (Span, Resource, ...) never requiring a
 * business-code `instanceof` check to use. Kept in `internal/` anyway to
 * stay on the conservative side of that line.
 */
export function errorToAttrs(err: unknown): AttrRecord {
  if (err instanceof Error) {
    return { errorName: err.name, errorMessage: err.message, errorStack: err.stack ?? '' };
  }
  return { errorMessage: String(err) };
}
