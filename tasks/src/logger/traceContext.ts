import { AsyncLocalStorage } from "node:async_hooks";
import type { TraceContext } from "./types.js";

export const traceStore = new AsyncLocalStorage<TraceContext>();

export function getTraceContext(): TraceContext | undefined {
  return traceStore.getStore();
}
