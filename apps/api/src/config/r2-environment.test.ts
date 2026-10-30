import { describe, expect, it } from "vitest";
import { readR2Environment } from "./r2-environment";

const validEnvironment = {
  S3_ENDPOINT:
    "https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com",
  S3_REGION: "auto",
  S3_BUCKET: "dropit-test",
  S3_ACCESS_KEY_ID: "access-key",
  S3_SECRET_ACCESS_KEY: "secret-key",
  APP_ORIGIN: "http://127.0.0.1:3000",
};

describe("R2 environment", () => {
  it("returns only validated storage settings", () => {
    expect(
      readR2Environment({ ...validEnvironment, UNRELATED: "ignored" }),
    ).toEqual({
      endpoint: validEnvironment.S3_ENDPOINT,
      region: "auto",
      bucket: "dropit-test",
      accessKeyId: "access-key",
      secretAccessKey: "secret-key",
      appOrigin: "http://127.0.0.1:3000",
    });
  });

  it.each(Object.keys(validEnvironment))("rejects missing %s", (key) => {
    expect(() =>
      readR2Environment({ ...validEnvironment, [key]: undefined }),
    ).toThrow(`Invalid configuration: ${key}`);
  });

  it.each([
    ["S3_ENDPOINT", "http://account.r2.cloudflarestorage.com"],
    ["S3_ENDPOINT", "https://example.com"],
    ["S3_ENDPOINT", "https://account.r2.cloudflarestorage.com/path"],
    ["S3_ENDPOINT", "https://user@account.r2.cloudflarestorage.com"],
    ["S3_REGION", "us-east-1"],
    ["S3_BUCKET", "AB"],
    ["S3_BUCKET", "Uppercase-bucket"],
    ["APP_ORIGIN", "https://example.com/path"],
    ["APP_ORIGIN", "ftp://example.com"],
  ])("rejects invalid %s", (key, value) => {
    expect(() =>
      readR2Environment({ ...validEnvironment, [key]: value }),
    ).toThrow(`Invalid configuration: ${key}`);
  });

  it("does not expose a secret value in an error", () => {
    const sentinel = "do-not-print-this-secret";
    let message = "";
    try {
      readR2Environment({
        ...validEnvironment,
        S3_ENDPOINT: sentinel,
        S3_SECRET_ACCESS_KEY: sentinel,
      });
    } catch (error: unknown) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toBe("Invalid configuration: S3_ENDPOINT");
    expect(message).not.toContain(sentinel);
  });
});
