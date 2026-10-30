import { describe, expect, it } from "vitest";
import { readApiEnvironment } from "./environment";

describe("API environment", () => {
  it("defaults only absent settings", () => {
    expect(readApiEnvironment({})).toEqual({
      nodeEnv: "development",
      port: 3001,
    });
  });
  it.each(["development", "test", "production"])("accepts %s", (nodeEnv) => {
    expect(
      readApiEnvironment({ NODE_ENV: nodeEnv, API_PORT: "65535" }),
    ).toEqual({ nodeEnv, port: 65535 });
  });
  it.each([
    "",
    "0",
    "-1",
    "65536",
    "3001.5",
    "3e3",
    " 3001",
    "3001 ",
    "03001",
    "secret-value",
  ])("rejects invalid port case %# without echoing input", (port) => {
    expect(() => readApiEnvironment({ API_PORT: port })).toThrowError(
      new Error("Invalid configuration: API_PORT"),
    );
  });
  it.each(["", "staging", "secret-value"])(
    "rejects invalid mode case %# without echoing input",
    (nodeEnv) => {
      expect(() => readApiEnvironment({ NODE_ENV: nodeEnv })).toThrowError(
        new Error("Invalid configuration: NODE_ENV"),
      );
    },
  );
  it("does not expose unrelated environment values", () => {
    expect(readApiEnvironment({ PRIVATE_VALUE: "test-sentinel" })).toEqual({
      nodeEnv: "development",
      port: 3001,
    });
  });
});
