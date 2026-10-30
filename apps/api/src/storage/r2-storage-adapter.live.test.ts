import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { readR2Environment } from "../config/r2-environment";
import type { StorageObjectReference } from "../domain/storage/object-storage";
import { createR2StorageAdapter } from "./r2-storage-adapter";
import { createStorageKey } from "./storage-key";

const environment = readR2Environment(process.env);

describe("live private R2 adapter", () => {
  it("verifies direct PUT/GET, CORS, integrity, expiry, HEAD, and cleanup", async () => {
    const adapter = createR2StorageAdapter(environment);
    const references: StorageObjectReference[] = [];

    try {
      const validBody = Buffer.from("dropit-r2-integration", "utf8");
      const validReference = makeReference();
      references.push(validReference);
      const validCapability = await adapter.createUploadCapability({
        ...validReference,
        contentType: "text/plain",
        contentMd5: md5(validBody),
        expectedSizeBytes: validBody.byteLength,
      });

      const preflight = await fetch(validCapability.url, {
        method: "OPTIONS",
        headers: {
          Origin: environment.appOrigin,
          "Access-Control-Request-Method": "PUT",
          "Access-Control-Request-Headers": "content-md5,content-type",
        },
      });
      expect(preflight.ok).toBe(true);
      expect(preflight.headers.get("access-control-allow-origin")).toBe(
        environment.appOrigin,
      );
      expect(
        preflight.headers.get("access-control-allow-methods")?.toUpperCase(),
      ).toContain("PUT");
      expect(
        preflight.headers.get("access-control-allow-headers")?.toLowerCase(),
      ).toContain("content-type");
      expect(
        preflight.headers.get("access-control-allow-headers")?.toLowerCase(),
      ).toContain("content-md5");

      const upload = await fetch(validCapability.url, {
        method: validCapability.method,
        headers: {
          ...validCapability.requiredHeaders,
          Origin: environment.appOrigin,
        },
        body: validBody,
      });
      expect(upload.ok).toBe(true);
      expect(upload.headers.get("access-control-allow-origin")).toBe(
        environment.appOrigin,
      );

      const verified = await adapter.verifyObject({
        ...validReference,
        contentMd5: md5(validBody),
        expectedSizeBytes: validBody.byteLength,
      });
      expect(verified).toMatchObject({
        ok: true,
        contentLength: validBody.byteLength,
      });

      const downloadCapability = await adapter.createDownloadCapability({
        ...validReference,
        filename: "integration.txt",
      });
      const download = await fetch(downloadCapability.url, {
        headers: { Origin: environment.appOrigin },
      });
      expect(download.ok).toBe(true);
      expect(download.headers.get("content-type")).toBe(
        "application/octet-stream",
      );
      expect(download.headers.get("content-disposition")).toContain(
        "attachment",
      );
      expect(download.headers.get("access-control-allow-origin")).toBe(
        environment.appOrigin,
      );
      expect(Buffer.from(await download.arrayBuffer())).toEqual(validBody);

      await verifyWrongContentTypeIsRejected(adapter, references);
      await verifyBadChecksumIsRejected(adapter, references);
      await verifyOversizeCannotVerify(adapter, references);
      await verifyExpiredUrlIsRejected(adapter, references);

      await adapter.deleteObject(validReference);
      expect(
        await adapter.verifyObject({
          ...validReference,
          expectedSizeBytes: validBody.byteLength,
        }),
      ).toEqual({ ok: false, reason: "MISSING" });
    } finally {
      await Promise.all(
        references.map((reference) => adapter.deleteObject(reference)),
      );
      adapter.close();
    }
  }, 60_000);
});

async function verifyWrongContentTypeIsRejected(
  adapter: ReturnType<typeof createR2StorageAdapter>,
  references: StorageObjectReference[],
): Promise<void> {
  const body = Buffer.from("mime", "utf8");
  const reference = makeReference();
  references.push(reference);
  const capability = await adapter.createUploadCapability({
    ...reference,
    contentType: "text/plain",
    contentMd5: md5(body),
    expectedSizeBytes: body.byteLength,
  });
  const response = await fetch(capability.url, {
    method: "PUT",
    headers: {
      ...capability.requiredHeaders,
      "content-type": "application/json",
      Origin: environment.appOrigin,
    },
    body,
  });
  expect(response.status).toBe(403);
  await response.arrayBuffer();
}

async function verifyBadChecksumIsRejected(
  adapter: ReturnType<typeof createR2StorageAdapter>,
  references: StorageObjectReference[],
): Promise<void> {
  const expectedBody = Buffer.from("abc", "utf8");
  const wrongBody = Buffer.from("abd", "utf8");
  const reference = makeReference();
  references.push(reference);
  const capability = await adapter.createUploadCapability({
    ...reference,
    contentType: "application/octet-stream",
    contentMd5: md5(expectedBody),
    expectedSizeBytes: expectedBody.byteLength,
  });
  const response = await fetch(capability.url, {
    method: "PUT",
    headers: {
      ...capability.requiredHeaders,
      Origin: environment.appOrigin,
    },
    body: wrongBody,
  });
  expect(response.status).toBe(400);
  await response.arrayBuffer();
  expect(
    await adapter.verifyObject({
      ...reference,
      expectedSizeBytes: expectedBody.byteLength,
    }),
  ).toEqual({ ok: false, reason: "MISSING" });
}

async function verifyOversizeCannotVerify(
  adapter: ReturnType<typeof createR2StorageAdapter>,
  references: StorageObjectReference[],
): Promise<void> {
  const reference = makeReference();
  references.push(reference);
  const capability = await adapter.createUploadCapability({
    ...reference,
    contentType: "application/octet-stream",
    expectedSizeBytes: 3,
  });
  const response = await fetch(capability.url, {
    method: "PUT",
    headers: {
      ...capability.requiredHeaders,
      Origin: environment.appOrigin,
    },
    body: Buffer.from("four", "utf8"),
  });
  expect(response.status).toBe(403);
  await response.arrayBuffer();

  const verification = await adapter.verifyObject({
    ...reference,
    expectedSizeBytes: 3,
  });
  expect(verification).toEqual({ ok: false, reason: "MISSING" });
}

async function verifyExpiredUrlIsRejected(
  adapter: ReturnType<typeof createR2StorageAdapter>,
  references: StorageObjectReference[],
): Promise<void> {
  const reference = makeReference();
  references.push(reference);
  const capability = await adapter.createUploadCapability({
    ...reference,
    contentType: "application/octet-stream",
    expectedSizeBytes: 1,
    expiresInSeconds: 1,
  });
  await new Promise((resolve) => setTimeout(resolve, 2_100));
  const response = await fetch(capability.url, {
    method: "PUT",
    headers: {
      ...capability.requiredHeaders,
      Origin: environment.appOrigin,
    },
    body: Buffer.from("x", "utf8"),
  });
  expect(response.status).toBe(403);
  await response.arrayBuffer();
}

function makeReference(): StorageObjectReference {
  const transferId = randomUUID();
  const fileId = randomUUID();
  return {
    transferId,
    fileId,
    storageKey: createStorageKey(transferId, fileId),
  };
}

function md5(value: Uint8Array): string {
  return createHash("md5").update(value).digest("base64");
}
