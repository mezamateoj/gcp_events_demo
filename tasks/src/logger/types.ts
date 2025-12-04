export interface TraceContext {
  trace_id?: string;
  span_id?: string;
  trace_flags?: string;
  insertId?: string;
}

export interface LogRecord extends TraceContext {
  [key: string]: unknown;
}

export interface LoggerConfig {
  level?: string;
  projectId?: string;
}

export interface CloudLogger {
  trace(data: LogRecord | Error | string, message?: string): void;
  debug(data: LogRecord | Error | string, message?: string): void;
  info(data: LogRecord | Error | string, message?: string): void;
  warn(data: LogRecord | Error | string, message?: string): void;
  error(data: LogRecord | Error | string, message?: string): void;
  fatal(data: LogRecord | Error | string, message?: string): void;
  child(bindings: LogRecord): CloudLogger;
}
