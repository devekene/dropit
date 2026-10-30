import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assertStorageKeyOwnership, createStorageKey } from "./storage-key";

describe("server-owned storage keys", () => {
  it("creates an isolated key without using a filename", () => {
    const transferId = randomUUID();
    const fileId = randomUUID();
    const key = createStorageKey(transferId, fileId);

    expect(key).toMatch(
      new RegExp(`^v1/transfers/${transferId}/files/${fileId}/[0-9a-f-]{36}$`),
    );
    expect(key).not.toContain("report.pdf");
    expect(() =>
      assertStorageKeyOwnership({ transferId, fileId, storageKey: key }),
    ).not.toThrow();
  });

  it.each(["transfer", "file"] as const)(
    "rejects a key owned by another %s",
    (owner) => {
      const transferId = randomUUID();
      const fileId = randomUUID();
      const key = createStorageKey(transferId, fileId);
      expect(() =>
        assertStorageKeyOwnership({
          transferId: owner === "transfer" ? randomUUID() : transferId,
          fileId: owner === "file" ? randomUUID() : fileId,
          storageKey: key,
        }),
      ).toThrow("Storage key does not belong");
    },
  );

  it.each([
    "",
    "../other-object",
    "v1/transfers/not-a-uuid/files/not-a-uuid/value",
  ])("rejects malformed key %s", (storageKey) => {
    expect(() =>
      assertStorageKeyOwnership({
        transferId: randomUUID(),
        fileId: randomUUID(),
        storageKey,
      }),
    ).toThrow();
  });
});
