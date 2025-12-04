import pino, { LoggerOptions } from "pino";
import { CloudLogger, LoggerConfig, LogRecord } from "./types.js";
import { EventId } from "./event.js";
import { getTraceContext } from "./traceContext.js";

/**
 * Creates a JSON fragment string containing the timestamp in GCP logging
 * format.
 *
 * @example ', "timestamp": { "seconds": 123456789, "nanos": 123000000 }'
 *
 * Creating a string with seconds/nanos is ~10x faster than formatting the
 * timestamp as an ISO string.
 *
 * @see https://cloud.google.com/logging/docs/agent/logging/configuration#timestamp-processing
 *
 * As Javascript Date uses millisecond precision, in
 * {@link formatLogObject} the logger adds a monotonically increasing insertId
 * into the log object to preserve log order inside GCP logging.
 *
 * @see https://github.com/googleapis/nodejs-logging/blob/main/src/entry.ts#L189
 */
function getGcpLoggingTimestamp() {
  const seconds = Date.now() / 1000;
  const secondsRounded = Math.floor(seconds);
  // The following line is 2x as fast as seconds % 1000
  // Uses Math.round, not Math.floor due to JS floating point...
  // eg for a Date.now()=1713024754120
  // (seconds-secondsRounded)*1000 => 119.99988555908203
  const millis = Math.round((seconds - secondsRounded) * 1000);
  if (millis !== 0) {
    return `,"timestamp":{"seconds":${secondsRounded},"nanos":${millis}000000}`;
  } else {
    return `,"timestamp":{"seconds":${secondsRounded},"nanos":0}`;
  }
}

/** Monotonically increasing ID for insertId. */
const eventId = new EventId();

// https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry#logseverity
const PinoLevelToSeverityLookup: Record<string, string | undefined> = {
  trace: "DEBUG",
  debug: "DEBUG",
  info: "INFO",
  warn: "WARNING",
  error: "ERROR",
  fatal: "CRITICAL",
};

function getTraceMixin() {
  const trace = getTraceContext();
  if (!trace) return {};
  return {
    trace_id: trace.trace_id,
    span_id: trace.span_id,
    trace_flags: trace.trace_flags,
  };
}

function getProductionConfig(level: string): LoggerOptions {
  return {
    level,
    messageKey: "message",
    timestamp: () => getGcpLoggingTimestamp(),
    mixin: getTraceMixin,
    formatters: {
      log(object: LogRecord): Record<string, unknown> {
        const { trace_id, span_id, trace_flags, ...rest } = object;
        return {
          "logging.googleapis.com/trace": trace_id,
          "logging.googleapis.com/spanId": span_id,
          "logging.googleapis.com/trace_sampled": trace_flags
            ? trace_flags === "01"
            : undefined,
          "logging.googleapis.com/insertId": eventId.new(),
          ...rest,
        };
      },
      level(label: string) {
        return {
          severity:
            PinoLevelToSeverityLookup[label] ??
            PinoLevelToSeverityLookup["info"],
        };
      },
    },
  };
}

function getDevelopmentConfig(level: string): LoggerOptions {
  return {
    level,
    mixin: getTraceMixin,
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "yyyy-mm-dd HH:MM:ss.l",
        ignore: "pid,hostname",
      },
    },
  };
}

export function lidzLogger(config: LoggerConfig = {}): CloudLogger {
  const isProduction = process.env.NODE_ENV === "production";
  const level = config.level || "info";

  const pinoConfig = isProduction
    ? getProductionConfig(level)
    : getDevelopmentConfig(level);

  return pino(pinoConfig);
}
