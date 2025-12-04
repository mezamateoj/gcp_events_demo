
export interface TraceContext {
    traceId: string;
    gcpTrace: string; // Google Cloud format: projects/{project}/traces/{traceId}
    spanId: string;
    traceFlags?: string;
  }


export interface TraceConfig {
    level?: string;
    projectId?: string;
}


declare module 'koa' {
    interface BaseContext {
      trace: TraceContext;
    }
  }