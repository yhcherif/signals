/**
 * Plain data types shared by every port. Nothing here names a vendor
 * concept (Span, Resource, Exporter, ...) — see ADR-0001, Zero Knowledge.
 */

export type AttrValue = string | number | boolean;

export type AttrRecord = Record<string, AttrValue>;

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type MetricKind = 'counter' | 'histogram' | 'gauge';
