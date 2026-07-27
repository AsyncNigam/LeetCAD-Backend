import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

const traceExporter = new OTLPTraceExporter();

const sdk = new NodeSDK({
  traceExporter,
  instrumentations: [getNodeAutoInstrumentations()],
  serviceName: "core-platform",
});

try {
  sdk.start();
  console.log("[tracing] OpenTelemetry SDK started for core-platform");
} catch (error) {
  console.error("[tracing] Failed to start OpenTelemetry SDK:", error);
}

process.on("SIGTERM", async () => {
  try {
    await sdk.shutdown();
    console.log("[tracing] OpenTelemetry SDK shut down");
  } catch (error) {
    console.error("[tracing] Error shutting down OpenTelemetry SDK:", error);
  } finally {
    process.exit(0);
  }
});
