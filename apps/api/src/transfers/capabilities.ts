import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

type CapabilityPurpose = "public" | "management";

/** Key IDs travel in tokens; only purpose-separated HMAC digests enter storage. */
export class Capabilities {
  private readonly keys: ReadonlyMap<string, Uint8Array>;

  constructor(
    private readonly activeKeyId: string,
    keys: Readonly<Record<string, Uint8Array>>,
    private readonly idempotencyKey: Uint8Array,
  ) {
    if (
      !/^[a-zA-Z0-9_-]{1,16}$/.test(activeKeyId) ||
      keys[activeKeyId] === undefined ||
      idempotencyKey.byteLength < 32
    ) {
      throw new Error("Invalid capability key configuration");
    }
    for (const [id, key] of Object.entries(keys)) {
      if (!/^[a-zA-Z0-9_-]{1,16}$/.test(id) || key.byteLength < 32) {
        throw new Error("Invalid capability key configuration");
      }
    }
    this.keys = new Map(
      Object.entries(keys).map(([id, key]) => [id, Uint8Array.from(key)]),
    );
    this.idempotencyKey = Uint8Array.from(idempotencyKey);
  }

  issue(purpose: CapabilityPurpose): { token: string; digest: Uint8Array } {
    const token = `${this.activeKeyId}.${randomBytes(32).toString("base64url")}`;
    const digest = this.digest(purpose, token);
    if (digest === null)
      throw new Error("Capability configuration unavailable");
    return { token, digest };
  }

  digest(purpose: CapabilityPurpose, token: string): Uint8Array | null {
    const match = /^([A-Za-z0-9_-]{1,16})\.([A-Za-z0-9_-]{43})$/.exec(token);
    if (match?.[1] === undefined || match[2] === undefined) return null;
    if (Buffer.from(match[2], "base64url").toString("base64url") !== match[2])
      return null;
    const key = this.keys.get(match[1]);
    return key === undefined
      ? null
      : createHmac("sha256", key).update(`${purpose}\0${token}`).digest();
  }

  matches(
    purpose: CapabilityPurpose,
    token: string,
    expected: Uint8Array,
  ): boolean {
    const actual = this.digest(purpose, token);
    return (
      actual !== null &&
      actual.byteLength === expected.byteLength &&
      timingSafeEqual(actual, expected)
    );
  }

  fingerprint(purpose: "scope" | "key" | "request", value: string): Uint8Array {
    return createHmac("sha256", this.idempotencyKey)
      .update(`${purpose}\0${value}`)
      .digest();
  }
}
