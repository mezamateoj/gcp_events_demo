import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { TraceExporter } from '@google-cloud/opentelemetry-cloud-trace-exporter';
let sdk = null;
/**
 * Initialize OpenTelemetry tracing with GCP Cloud Trace exporter.
 * This should be called once at application startup, before any other imports.
 *
 * @example
 * ```typescript
 * import { initTracing } from '@lidz/tracer';
 *
 * initTracing({
 *   projectId: 'my-gcp-project',
 *   serviceName: 'my-api'
 * });
 * ```
 */
export function initTracing(config) {
    if (!config.enabled && config.enabled !== undefined) {
        console.log('Tracing is disabled');
        return;
    }
    if (!config.projectId) {
        console.warn('OpenTelemetry: No projectId configured. Tracing disabled.');
        return;
    }
    if (sdk) {
        console.warn('OpenTelemetry SDK already initialized');
        return;
    }
    sdk = new NodeSDK({
        serviceName: config.serviceName || 'unknown-service',
        traceExporter: new TraceExporter({
            projectId: config.projectId,
        }),
        instrumentations: [
            getNodeAutoInstrumentations({
                // Automatically instrument Koa and other frameworks
                '@opentelemetry/instrumentation-http': {
                    enabled: true,
                },
            }),
        ],
    });
    sdk.start();
    console.log('OpenTelemetry tracing initialized for project:', config.projectId);
    // Gracefully shut down on process exit
    process.on('SIGTERM', () => {
        sdk
            ?.shutdown()
            .then(() => console.log('OpenTelemetry SDK shut down successfully'))
            .catch((error) => console.error('Error shutting down OpenTelemetry SDK', error));
    });
}
/**
 * Manually shutdown the OpenTelemetry SDK.
 * Useful for testing or graceful shutdowns.
 */
export async function shutdownTracing() {
    if (sdk) {
        await sdk.shutdown();
        sdk = null;
    }
}
