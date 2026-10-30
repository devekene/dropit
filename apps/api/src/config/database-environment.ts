export interface DatabaseEnvironment {
  databaseUrl: string;
}

export function readDatabaseEnvironment(
  source: Readonly<Record<string, string | undefined>>,
): DatabaseEnvironment {
  const value = source.DATABASE_URL;
  if (value === undefined || value.length === 0) {
    throw new Error("Invalid configuration: DATABASE_URL");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid configuration: DATABASE_URL");
  }

  if (
    (url.protocol !== "postgres:" && url.protocol !== "postgresql:") ||
    url.hostname.length === 0 ||
    url.username.length === 0 ||
    url.pathname.length <= 1
  ) {
    throw new Error("Invalid configuration: DATABASE_URL");
  }

  if (url.port.length > 0) {
    const port = Number(url.port);
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      throw new Error("Invalid configuration: DATABASE_URL");
    }
  }

  return { databaseUrl: value };
}
