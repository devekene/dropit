// This module is consumed by next.config.ts, never by client components.
export function readWebEnvironment(
  source: Readonly<Record<string, string | undefined>>,
): { nodeEnv: "development" | "test" | "production" } {
  const nodeEnv = source.NODE_ENV ?? "development";
  if (
    nodeEnv !== "development" &&
    nodeEnv !== "test" &&
    nodeEnv !== "production"
  ) {
    throw new Error("Invalid configuration: NODE_ENV");
  }
  return { nodeEnv };
}
