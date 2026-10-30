export interface ApiEnvironment {
  nodeEnv: "development" | "test" | "production";
  port: number;
}

// Accept only the settings this service currently consumes. Never return the
// source object or interpolate environment values into error messages.
export function readApiEnvironment(
  source: Readonly<Record<string, string | undefined>>,
): ApiEnvironment {
  const nodeEnv = source.NODE_ENV ?? "development";
  if (
    nodeEnv !== "development" &&
    nodeEnv !== "test" &&
    nodeEnv !== "production"
  ) {
    throw new Error("Invalid configuration: NODE_ENV");
  }
  const portText = source.API_PORT ?? "3001";
  if (!/^[1-9]\d{0,4}$/.test(portText)) {
    throw new Error("Invalid configuration: API_PORT");
  }
  const port = Number(portText);
  if (port > 65535) throw new Error("Invalid configuration: API_PORT");
  return { nodeEnv, port };
}
