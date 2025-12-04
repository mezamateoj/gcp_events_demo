import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { ConsoleSpanExporter } from "@opentelemetry/sdk-trace-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";

export interface TracingConfig {
  projectId: string;
  serviceName?: string;
  enabled?: boolean;
  debug?: boolean;
}

let sdk: NodeSDK | null = null;

// this did not work
// we need to preload the OpenTelemetry configuration
// see src/instrumentation.ts for working solution
export function initTracing(config: TracingConfig): void {
  if (!config.enabled && config.enabled !== undefined) {
    console.log("Tracing is disabled");
    return;
  }

  if (sdk) {
    console.warn("OpenTelemetry SDK already initialized");
    return;
  }

  if (config.debug) {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  const isProduction = process.env.NODE_ENV === "production";

  const traceExporter = isProduction
    ? new OTLPTraceExporter({
        url: "https://telemetry.googleapis.com/v1/traces",
      })
    : new ConsoleSpanExporter();

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: config.serviceName || "unknown-service",
    }),
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-http": { enabled: true },
        "@opentelemetry/instrumentation-fs": { enabled: false },
      }),
    ],
  });

  sdk.start();
  console.log(
    `OpenTelemetry tracing initialized (${isProduction ? "OTLP" : "Console"} exporter)`,
  );

  process.on("SIGTERM", () => {
    sdk
      ?.shutdown()
      .then(() => console.log("OpenTelemetry SDK shut down"))
      .catch((error) =>
        console.error("Error shutting down OpenTelemetry SDK", error),
      );
  });
}

export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
  }
}
