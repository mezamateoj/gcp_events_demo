import crypto from 'crypto';

export function generateHex(length: number): string {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

export function generateTraceId(): string {
  return generateHex(32);
}

export function generateSpanId(): string {
  return generateHex(16);
}

export function formatTraceId(traceId: string, projectId?: string): string {
  if (!projectId) {
    return traceId;
  }
  return `projects/${projectId}/traces/${traceId}`;
}

/**
 * Parses a W3C Trace Context traceparent header string into its components.
 * 
 * The traceparent header follows the format:
 * `00-{trace-id}-{parent-id}-{trace-flags}`
 * 
 * Where:
 * - `00` is the version (currently only version 00 is supported)
 * - `trace-id` is a 32-character hex string (128-bit) that uniquely identifies the trace
 * - `parent-id` is a 16-character hex string (64-bit) that identifies the parent span
 * - `trace-flags` is a 2-character hex string containing trace flags
 *   - `01` indicates the request should be traced
 *   - `00` indicates the request should not be traced
 * 
 * @see https://www.w3.org/TR/trace-context/#traceparent-header
 * @see https://cloud.google.com/trace/docs/trace-context#http-requests
 * 
 * @param traceparent - The traceparent header string to parse
 * @returns An object containing the parsed trace ID, span ID and flags, or null if invalid format
 */
export function parseTraceparent(traceparent: string): { traceId: string; spanId: string; flags: string } | null {
  const parts = traceparent.split('-');
  if (parts.length === 4) {
    return {
      traceId: parts[1],
      spanId: parts[2], 
      flags: parts[3]
    };
  }
  return null;
}