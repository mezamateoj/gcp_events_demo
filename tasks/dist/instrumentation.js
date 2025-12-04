import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { ConsoleSpanExporter } from "@opentelemetry/sdk-trace-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
const isProduction = process.env.NODE_ENV === "production";
const debug = process.env.OTEL_DEBUG === "true";
if (debug) {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
}
const traceExporter = isProduction
    ? new OTLPTraceExporter({
        url: "https://telemetry.googleapis.com/v1/traces",
    })
    : new ConsoleSpanExporter();
// almost like this setup
// https://github.com/GoogleCloudPlatform/opentelemetry-operations-js/blob/79655f431cfe10b803b4607e6055c6cb1bc2d3c4/samples/instrumentation-quickstart/src/instrumentation.ts
// in the docs they dont use a trace exporter
// https://docs.cloud.google.com/trace/docs/setup/nodejs-ot
// maybe try without it and just use the traceparent header
const sdk = new NodeSDK({
    resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || "tasks-app",
    }),
    traceExporter,
    instrumentations: [
        getNodeAutoInstrumentations({
            // diasable noise logs
            "@opentelemetry/instrumentation-fs": { enabled: false },
            "@opentelemetry/instrumentation-dns": { enabled: false },
            "@opentelemetry/instrumentation-net": { enabled: false },
        }),
    ],
});
sdk.start();
console.log(`OpenTelemetry initialized (${isProduction ? "OTLP" : "Console"} exporter)`);
process.on("SIGTERM", () => {
    sdk
        .shutdown()
        .then(() => console.log("OpenTelemetry SDK shut down"))
        .catch((error) => console.error("Error shutting down SDK", error));
});
