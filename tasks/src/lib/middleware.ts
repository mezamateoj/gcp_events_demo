import { Context, Next } from "koa";
import { trace } from "@opentelemetry/api";
import { generateSpanId, formatTraceId, parseTraceparent } from "./utils.js";
import { TraceConfig } from "./types.js";
import { traceStore } from "../logger/traceContext.js";

export function createTraceMiddleware(config: TraceConfig = {}) {
  if (!config.projectId) {
    console.warn(
      "TraceMiddleware: No projectId configured. GCP trace formatting will be disabled.",
    );
  }

  return async function traceMiddleware(ctx: Context, next: Next) {
    // Get the current OpenTelemetry span (created by auto-instrumentation)
    const activeSpan = trace.getActiveSpan();

    let traceId: string;
    let spanId: string;
    let traceFlags: string | undefined;
    const traceparentHeader = ctx.headers["traceparent"];
    const traceparent = Array.isArray(traceparentHeader)
      ? traceparentHeader[0]
      : traceparentHeader;

    if (traceparent) {
      const parsed = parseTraceparent(traceparent);
      if (parsed) {
        traceId = parsed.traceId;
        // spanId = parsed.spanId;
        spanId = generateSpanId();
        //
        traceFlags = parsed.flags;
      } else {
        traceId = generateSpanId() + generateSpanId();
        spanId = generateSpanId();
      }
    } else {
      traceId = generateSpanId() + generateSpanId();
      spanId = generateSpanId();
    }

    // if (!activeSpan) {
    //   // Use OpenTelemetry's trace and span IDs - these are exported to Cloud Trace
    //   // const spanContext = activeSpan.spanContext();
    //   // traceId = spanContext.traceId;
    //   // spanId = spanContext.spanId;
    //   // traceFlags = (spanContext.traceFlags & 1) === 1 ? "01" : "00";
    // } else {
    //   // Fallback: parse traceparent header if OTel isn't active
    // }

    ctx.trace = {
      traceId,
      gcpTrace: formatTraceId(traceId, config.projectId),
      spanId,
      traceFlags,
    };

    return traceStore.run(
      {
        trace_id: ctx.trace.gcpTrace,
        span_id: ctx.trace.spanId,
        trace_flags: ctx.trace.traceFlags,
      },
      next,
    );
  };
}
