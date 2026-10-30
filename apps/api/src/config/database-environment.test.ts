import { describe, expect, it } from "vitest";
import { readDatabaseEnvironment } from "./database-environment";

describe("database environment", () => {
  it.each([
    "postgres://dropit:password@127.0.0.1:5432/dropit",
    "postgresql://dropit:password@db.internal/dropit?sslmode=require",
  ])("accepts a complete PostgreSQL URL", (databaseUrl) => {
    expect(readDatabaseEnvironment({ DATABASE_URL: databaseUrl })).toEqual({
      databaseUrl,
    });
  });

  it.each([
    undefined,
    "",
    "not-a-url",
    "mysql://dropit:password@db.internal/dropit",
    "postgresql://db.internal/dropit",
    "postgresql://dropit:password@db.internal",
  ])("rejects invalid case %# without echoing it", (databaseUrl) => {
    expect(() =>
      readDatabaseEnvironment({ DATABASE_URL: databaseUrl }),
    ).toThrow(new Error("Invalid configuration: DATABASE_URL"));
  });
});
