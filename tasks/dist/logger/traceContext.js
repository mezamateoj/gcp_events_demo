import { AsyncLocalStorage } from "node:async_hooks";
export const traceStore = new AsyncLocalStorage();
export function getTraceContext() {
    return traceStore.getStore();
}
