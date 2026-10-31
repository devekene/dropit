import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { readR2Environment } from "../config/r2-environment";
import { createR2StorageAdapter } from "../storage/r2-storage-adapter";
import type { StorageObjectReference } from "../domain/storage/object-storage";
import { boundedMap } from "./bounded-map";
import { createHarness } from "./testing/harness";
import { validateResponse } from "./testing/contract";
import type { CreatedTransferResponse } from "./transfer-contract";

it("runs the HTTP create/direct R2 PUT/verify/metadata/cancel flow with disposable DB rows and objects", async () => {
  const environment = readR2Environment(process.env);
  const storage = createR2StorageAdapter(environment);
  const harness = await createHarness(storage, environment.appOrigin);
  const references: StorageObjectReference[] = [];
  try {
    for (const scenario of ["valid", "missing", "wrong-size"] as const) {
      const created = await harness.app.inject({
        method: "POST",
        url: "/v1/transfers",
        headers: { "idempotency-key": randomUUID() },
        payload: {
          files: [{ name: "slice-06.txt", size: 3, contentType: "text/plain" }],
        },
      });
      expect(created.statusCode).toBe(201);
      const result = created.json<CreatedTransferResponse>();
      validateResponse("/transfers", "post", 201, result);
      const record = await harness.repository.findById(result.transferId);
      const file = record?.files[0];
      const capability = result.files[0];
      if (file === undefined || capability === undefined)
        throw new Error("Missing live test fixture");
      const reference = {
        transferId: result.transferId,
        fileId: file.id,
        storageKey: file.storageKey,
      };
      references.push(reference);
      const metadataUrl = `/v1/public/transfers/${new URL(result.shareUrl).pathname.split("/").at(-1)}`;
      expect(
        (await harness.app.inject({ method: "GET", url: metadataUrl }))
          .statusCode,
      ).toBe(404);

      if (scenario === "valid") {
        const extraUrl = new URL(capability.uploadUrl);
        extraUrl.pathname = extraUrl.pathname.replace(/[^/]+$/, randomUUID());
        expect(
          await put(extraUrl.toString(), capability.uploadHeaders, "abc"),
        ).toBe(403);
        expect(
          await put(capability.uploadUrl, capability.uploadHeaders, "abc"),
        ).toBe(200);
      } else if (scenario === "wrong-size") {
        // Simulate out-of-band corruption with the test's backend credential.
        // The API never issues this capability; finalize must still reject it.
        const corrupt = await storage.createUploadCapability({
          ...reference,
          contentType: "text/plain",
          expectedSizeBytes: 4,
        });
        expect(await put(corrupt.url, corrupt.requiredHeaders, "four")).toBe(
          200,
        );
      }

      const completeUrl = `/v1/transfers/${result.transferId}/complete`;
      const headers = { authorization: `Bearer ${result.managementToken}` };
      const completed = await harness.app.inject({
        method: "POST",
        url: completeUrl,
        headers,
      });
      validateResponse(
        "/transfers/{id}/complete",
        "post",
        completed.statusCode,
        completed.json<unknown>(),
      );
      expect(completed.statusCode).toBe(scenario === "valid" ? 200 : 409);
      if (scenario === "valid") {
        expect(completed.json()).toEqual({ status: "READY" });
        expect(
          (
            await harness.app.inject({
              method: "POST",
              url: completeUrl,
              headers,
            })
          ).json(),
        ).toEqual({ status: "READY" });
        const metadata = await harness.app.inject({
          method: "GET",
          url: metadataUrl,
        });
        expect(metadata.statusCode).toBe(200);
        validateResponse(
          "/public/transfers/{token}",
          "get",
          200,
          metadata.json<unknown>(),
        );
        expect(
          (
            await harness.app.inject({
              method: "DELETE",
              url: `/v1/transfers/${result.transferId}`,
              headers,
            })
          ).statusCode,
        ).toBe(204);
      }
      expect(
        (await harness.app.inject({ method: "GET", url: metadataUrl }))
          .statusCode,
      ).toBe(404);
      expect(
        await storage.verifyObject({ ...reference, expectedSizeBytes: 3 }),
      ).toEqual({ ok: false, reason: "MISSING" });
    }
  } finally {
    try {
      await boundedMap(references, (reference) =>
        storage.deleteObject(reference),
      );
    } finally {
      storage.close();
      await harness.close();
    }
  }
}, 60_000);

async function put(
  url: string,
  headers: Readonly<Record<string, string>>,
  body: string,
): Promise<number> {
  try {
    const response = await fetch(url, {
      method: "PUT",
      headers,
      body,
      signal: AbortSignal.timeout(10_000),
    });
    await response.arrayBuffer();
    return response.status;
  } catch {
    throw new Error("Live transfer storage request failed");
  }
}
