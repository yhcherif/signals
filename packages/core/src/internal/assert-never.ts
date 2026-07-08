/**
 * Used at the end of an exhaustive switch over a discriminated union.
 * If every case is handled, `value` is narrowed to `never` by the
 * compiler and this is unreachable. If a new union member is added
 * without updating the switch, this becomes a compile error at the call
 * site — not a silent runtime bug. This is how we get exhaustiveness
 * without ever writing `as`.
 */
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}
