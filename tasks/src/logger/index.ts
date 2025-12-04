export type {
  CloudLogger,
  LoggerConfig,
  TraceContext,
  LogRecord,
} from "./types.js";
export { lidzLogger } from "./logger.js";

import { lidzLogger } from "./logger.js";
export const logger = lidzLogger();
