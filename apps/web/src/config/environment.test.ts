import { describe, expect, it } from "vitest";
import { readWebEnvironment } from "./environment";

describe("web build/server environment", () => {
  it("defaults missing mode", () => {
    expect(readWebEnvironment({})).toEqual({ nodeEnv: "development" });
  });
  it.each(["development", "test", "production"])("accepts %s", (nodeEnv) => {
    expect(readWebEnvironment({ NODE_ENV: nodeEnv })).toEqual({ nodeEnv });
  });
  it.each(["", "staging", "test-secret-value"])(
    "rejects invalid mode case %# without echoing input",
    (nodeEnv) => {
      expect(() => readWebEnvironment({ NODE_ENV: nodeEnv })).toThrowError(
        new Error("Invalid configuration: NODE_ENV"),
      );
    },
  );
  it("does not expose server secrets or create public env", () => {
    expect(
      readWebEnvironment({
        PRIVATE_VALUE: "test-sentinel",
        NEXT_PUBLIC_UNRELATED: "test-sentinel",
      }),
    ).toEqual({ nodeEnv: "development" });
  });
});
