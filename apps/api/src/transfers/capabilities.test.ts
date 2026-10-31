import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Capabilities } from "./capabilities";

describe("independent versioned capabilities", () => {
  it("uses 32 random bytes, separates purposes, and compares digests without accepting aliases", () => {
    const codec = new Capabilities(
      "k1",
      { k1: randomBytes(32) },
      randomBytes(32),
    );
    const first = codec.issue("management");
    const second = codec.issue("management");
    const publicToken = codec.issue("public");
    expect(first.token).not.toBe(second.token);
    expect(first.token).not.toBe(publicToken.token);
    expect(Buffer.from(first.token.slice(3), "base64url")).toHaveLength(32);
    expect(first.digest).toHaveLength(32);
    expect(codec.matches("management", first.token, first.digest)).toBe(true);
    expect(codec.matches("public", first.token, first.digest)).toBe(false);
    expect(codec.matches("management", second.token, first.digest)).toBe(false);
    expect(codec.matches("management", first.token, new Uint8Array(1))).toBe(
      false,
    );
    for (const invalid of [
      "",
      first.token + "=",
      first.token + "x",
      first.token.replace("k1.", "unknown."),
      "k1." + "_".repeat(43),
    ]) {
      expect(codec.digest("management", invalid)).toBeNull();
    }
  });

  it("keeps old tokens valid during rotation and idempotency stable across capability keys", () => {
    const oldKey = randomBytes(32);
    const nextKey = randomBytes(32);
    const dedupeKey = randomBytes(32);
    const old = new Capabilities("old", { old: oldKey }, dedupeKey);
    const token = old.issue("public");
    const rotated = new Capabilities(
      "next",
      { old: oldKey, next: nextKey },
      dedupeKey,
    );
    expect(rotated.matches("public", token.token, token.digest)).toBe(true);
    expect(rotated.issue("public").token.startsWith("next.")).toBe(true);
    expect(old.fingerprint("key", "example")).toEqual(
      rotated.fingerprint("key", "example"),
    );
    expect(old.fingerprint("key", "example")).not.toEqual(
      old.fingerprint("request", "example"),
    );
    expect(
      new Capabilities("next", { next: nextKey }, dedupeKey).digest(
        "public",
        token.token,
      ),
    ).toBeNull();
  });

  it("rejects missing or weak key configuration without exposing values", () => {
    for (const key of [new Uint8Array(0), randomBytes(31)]) {
      expect(() => new Capabilities("k", { k: key }, randomBytes(32))).toThrow(
        "Invalid capability key configuration",
      );
      expect(() => new Capabilities("k", { k: randomBytes(32) }, key)).toThrow(
        "Invalid capability key configuration",
      );
    }
    expect(
      () =>
        new Capabilities("missing", { k: randomBytes(32) }, randomBytes(32)),
    ).toThrow();
  });
});
