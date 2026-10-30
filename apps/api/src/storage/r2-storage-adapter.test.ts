import { createHash, randomUUID } from "node:crypto";
import { S3Client } from "@aws-sdk/client-s3";
import { describe, expect, it } from "vitest";
import {
  MAX_DOWNLOAD_URL_TTL_SECONDS,
  MAX_UPLOAD_URL_TTL_SECONDS,
  R2StorageAdapter,
} from "./r2-storage-adapter";
import { createStorageKey } from "./storage-key";

const secretAccessKey = "unit-test-secret-that-must-not-appear";

describe("R2 storage adapter signing", () => {
  it("signs an exact-key PUT with bounded expiry and required headers", async () => {
    const adapter = makeAdapter();
    const reference = makeReference();
    const contentMd5 = createHash("md5").update("abc").digest("base64");
    const capability = await adapter.createUploadCapability({
      ...reference,
      contentType: "text/plain",
      contentMd5,
      expectedSizeBytes: 3,
    });
    const url = new URL(capability.url);
    const signedHeaders = url.searchParams.get("X-Amz-SignedHeaders") ?? "";

    expect(capability.method).toBe("PUT");
    expect(capability.requiredHeaders).toEqual({
      "content-md5": contentMd5,
      "content-type": "text/plain",
    });
    expect(url.pathname).toContain(reference.storageKey);
    expect(url.searchParams.get("X-Amz-Expires")).toBe(
      String(MAX_UPLOAD_URL_TTL_SECONDS),
    );
    expect(signedHeaders).toContain("content-length");
    expect(signedHeaders).toContain("content-md5");
    expect(signedHeaders).toContain("content-type");
    expect(capability.url).not.toContain(secretAccessKey);
    adapter.close();
  });

  it("signs an attachment-only GET for at most 60 seconds", async () => {
    const adapter = makeAdapter();
    const reference = makeReference();
    const capability = await adapter.createDownloadCapability({
      ...reference,
      filename: "résumé.pdf",
    });
    const url = new URL(capability.url);

    expect(capability.method).toBe("GET");
    expect(url.searchParams.get("X-Amz-Expires")).toBe(
      String(MAX_DOWNLOAD_URL_TTL_SECONDS),
    );
    expect(url.searchParams.get("response-content-type")).toBe(
      "application/octet-stream",
    );
    expect(url.searchParams.get("response-content-disposition")).toBe(
      "attachment; filename=\"download\"; filename*=UTF-8''r%C3%A9sum%C3%A9.pdf",
    );
    expect(capability.url).not.toContain(secretAccessKey);
    adapter.close();
  });

  it.each([
    { name: "zero size", expectedSizeBytes: 0 },
    { name: "oversized file", expectedSizeBytes: 100_000_001 },
    { name: "fractional size", expectedSizeBytes: 1.5 },
  ])("rejects $name before signing", async ({ expectedSizeBytes }) => {
    const adapter = makeAdapter();
    await expect(
      adapter.createUploadCapability({
        ...makeReference(),
        contentType: "application/octet-stream",
        expectedSizeBytes,
      }),
    ).rejects.toThrow("Invalid expected object size");
    adapter.close();
  });

  it.each([
    "text/plain; charset=utf-8",
    "not-a-media-type",
    "text/plain\r\nx-injected: yes",
  ])("rejects unsafe content type %s", async (contentType) => {
    const adapter = makeAdapter();
    await expect(
      adapter.createUploadCapability({
        ...makeReference(),
        contentType,
        expectedSizeBytes: 1,
      }),
    ).rejects.toThrow("Invalid object content type");
    adapter.close();
  });

  it.each([
    { kind: "upload", ttl: MAX_UPLOAD_URL_TTL_SECONDS + 1 },
    { kind: "download", ttl: MAX_DOWNLOAD_URL_TTL_SECONDS + 1 },
    { kind: "upload", ttl: 0 },
  ])("rejects invalid $kind TTL $ttl", async ({ kind, ttl }) => {
    const adapter = makeAdapter();
    const reference = makeReference();
    const operation =
      kind === "upload"
        ? adapter.createUploadCapability({
            ...reference,
            contentType: "application/octet-stream",
            expectedSizeBytes: 1,
            expiresInSeconds: ttl,
          })
        : adapter.createDownloadCapability({
            ...reference,
            filename: "file.bin",
            expiresInSeconds: ttl,
          });
    await expect(operation).rejects.toThrow("capability TTL");
    adapter.close();
  });

  it("refuses to sign a key from another transfer", async () => {
    const adapter = makeAdapter();
    const reference = makeReference();
    await expect(
      adapter.createUploadCapability({
        ...reference,
        transferId: randomUUID(),
        contentType: "application/octet-stream",
        expectedSizeBytes: 1,
      }),
    ).rejects.toThrow("Storage key does not belong");
    adapter.close();
  });
});

function makeAdapter(): R2StorageAdapter {
  return new R2StorageAdapter(
    new S3Client({
      region: "auto",
      endpoint:
        "https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com",
      credentials: { accessKeyId: "unit-test-key", secretAccessKey },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    }),
    "dropit-unit-test",
  );
}

function makeReference() {
  const transferId = randomUUID();
  const fileId = randomUUID();
  return {
    transferId,
    fileId,
    storageKey: createStorageKey(transferId, fileId),
  };
}
