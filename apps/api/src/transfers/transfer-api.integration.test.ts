import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  idempotencyRecords,
  transferFiles,
  transfers,
} from "../database/schema";
import type { CreatedTransferResponse } from "./transfer-contract";
import { TransferApiModule } from "./transfer-api.module";
import { createHarness, StorageTransport } from "./testing/harness";
import {
  compileContractSchemas,
  validateCreateRequest,
  validateResponse,
} from "./testing/contract";

const descriptor = { name: "hello.txt", size: 3, contentType: "text/plain" };
const createBody = { files: [descriptor] };

describe("test-only transfer API with PostgreSQL and R2 adapter", () => {
  const transport = new StorageTransport();
  const storage = transport.adapter();
  let harness: Awaited<ReturnType<typeof createHarness>>;

  beforeAll(async () => {
    harness = await createHarness(storage);
  }, 20_000);
  afterAll(async () => {
    await harness?.close();
    storage.close();
  });
  beforeEach(async () => {
    await harness.db.execute(
      sql`truncate transfers, idempotency_records cascade`,
    );
    transport.objects.clear();
    transport.heads = 0;
    transport.maxActive = 0;
    transport.failHead = false;
    transport.failDelete = false;
    transport.beforeHead = undefined;
    vi.restoreAllMocks();
  });

  async function create(body: object = createBody, key = randomUUID()) {
    const response = await harness.app.inject({
      method: "POST",
      url: "/v1/transfers",
      headers: { "idempotency-key": key },
      payload: body,
    });
    validateResponse(
      "/transfers",
      "post",
      response.statusCode,
      response.json<unknown>(),
    );
    return response;
  }

  async function created(
    body: object = createBody,
  ): Promise<CreatedTransferResponse> {
    const response = await create(body);
    expect(response.statusCode).toBe(201);
    return response.json<CreatedTransferResponse>();
  }

  async function upload(result: CreatedTransferResponse, size = 3) {
    const record = await harness.repository.findById(result.transferId);
    if (record === null) throw new Error("Missing fixture transfer");
    for (const file of record.files)
      transport.objects.set(file.storageKey, size);
  }

  async function complete(
    result: CreatedTransferResponse,
    authorization = `Bearer ${result.managementToken}`,
  ) {
    const response = await harness.app.inject({
      method: "POST",
      url: `/v1/transfers/${result.transferId}/complete`,
      headers: { authorization },
    });
    validateResponse(
      "/transfers/{id}/complete",
      "post",
      response.statusCode,
      response.json<unknown>(),
    );
    return response;
  }

  async function metadata(result: CreatedTransferResponse) {
    const token = new URL(result.shareUrl).pathname.split("/").at(-1);
    const response = await harness.app.inject({
      method: "GET",
      url: `/v1/public/transfers/${token}`,
    });
    validateResponse(
      "/public/transfers/{token}",
      "get",
      response.statusCode,
      response.json<unknown>(),
    );
    return response;
  }

  async function cancel(result: CreatedTransferResponse) {
    const response = await harness.app.inject({
      method: "DELETE",
      url: `/v1/transfers/${result.transferId}`,
      headers: { authorization: `Bearer ${result.managementToken}` },
    });
    validateResponse(
      "/transfers/{id}",
      "delete",
      response.statusCode,
      response.statusCode === 204 ? response.body : response.json<unknown>(),
    );
    return response;
  }

  async function expire(id: string) {
    await harness.db
      .update(transfers)
      .set({
        createdAt: new Date(Date.now() - 7200_000),
        expiresAt: new Date(Date.now() - 3600_000),
      })
      .where(eq(transfers.id, id));
  }

  it("compiles the OpenAPI schemas and follows create, sign, verify, READY, metadata, cancel", async () => {
    compileContractSchemas();
    expect(validateCreateRequest(createBody)).toBe(true);
    const response = await create();
    expect(response.statusCode).toBe(201);
    const result = response.json<CreatedTransferResponse>();
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(result.files).toHaveLength(1);
    for (const file of result.files) {
      const url = new URL(file.uploadUrl);
      expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
      expect(url.searchParams.get("X-Amz-SignedHeaders")).toContain(
        "content-length",
      );
      expect(file.uploadHeaders).toEqual({ "content-type": "text/plain" });
    }
    expect((await metadata(result)).statusCode).toBe(404);
    await upload(result);
    const completion = await complete(result);
    expect(completion.statusCode).toBe(200);
    expect(completion.json()).toEqual({ status: "READY" });
    expect((await complete(result)).json()).toEqual({ status: "READY" });
    expect(transport.heads).toBe(1);
    expect((await metadata(result)).json()).toEqual({
      passwordRequired: false,
      expiresAt: result.expiresAt,
      files: [{ id: result.files[0]?.id, name: "hello.txt", size: 3 }],
    });
    const stored = await harness.repository.findById(result.transferId);
    expect(stored?.files.every((file) => file.status === "VERIFIED")).toBe(
      true,
    );
    const records = await harness.db.select().from(idempotencyRecords);
    const persisted = JSON.stringify({ stored, records });
    expect(persisted).not.toContain(result.managementToken);
    expect(persisted).not.toContain(result.shareUrl);
    expect(persisted).not.toContain("X-Amz-");
    expect((await cancel(result)).statusCode).toBe(204);
    expect((await cancel(result)).statusCode).toBe(204);
    expect((await metadata(result)).statusCode).toBe(404);
    expect(transport.objects.size).toBe(0);
  });

  it.each([
    { files: [] },
    { files: Array.from({ length: 11 }, () => descriptor) },
    { files: [{ ...descriptor, size: 0 }] },
    { files: [{ ...descriptor, size: 100_000_001 }] },
    { files: [{ ...descriptor, size: "3" }] },
    { files: [{ ...descriptor, size: 1.5 }] },
    {
      files: Array.from({ length: 6 }, () => ({
        ...descriptor,
        size: 100_000_000,
      })),
    },
    { files: [{ ...descriptor, name: "../private" }] },
    { files: [{ ...descriptor, contentType: "text/plain\r\nX: yes" }] },
    { files: [{ ...descriptor, storageKey: "injected" }] },
    { ...createBody, extra: true },
    { ...createBody, expiresInHours: 169 },
    { ...createBody, expiresInHours: null },
    { ...createBody, expiresInHours: 0 },
    { ...createBody, password: "must-not-be-ignored" },
    { ...createBody, password: "" },
  ])(
    "rejects invalid or unsupported create input %# without partial rows",
    async (body) => {
      const response = await create(body);
      expect(response.statusCode).toBe(400);
      expect(await harness.db.select().from(transfers)).toEqual([]);
      expect(await harness.db.select().from(idempotencyRecords)).toEqual([]);
    },
  );

  it("accepts decimal boundary and ten-file manifests, rejects the former binary boundary", async () => {
    expect(
      validateCreateRequest({ files: [{ ...descriptor, size: 104_857_600 }] }),
    ).toBe(false);
    expect(
      (
        await create({
          files: Array.from({ length: 5 }, () => ({
            ...descriptor,
            size: 100_000_000,
          })),
          expiresInHours: 168,
        })
      ).statusCode,
    ).toBe(201);
    expect(
      (
        await create({
          files: Array.from({ length: 10 }, () => descriptor),
          password: null,
        })
      ).statusCode,
    ).toBe(201);
  });

  it("atomically rejects concurrent creation replay, changed payload, and retained expired keys", async () => {
    const key = randomUUID();
    const responses = await Promise.all([
      create(createBody, key),
      create(createBody, key),
      create({ files: [{ ...descriptor, name: "changed" }] }, key),
    ]);
    expect(responses.map((response) => response.statusCode).sort()).toEqual([
      201, 409, 409,
    ]);
    expect(await harness.db.select().from(transfers)).toHaveLength(1);
    expect(await harness.db.select().from(transferFiles)).toHaveLength(1);
    await harness.db.update(idempotencyRecords).set({ expiresAt: new Date(0) });
    expect((await create(createBody, key)).statusCode).toBe(409);
    expect(
      responses
        .filter((response) => response.statusCode === 409)
        .every((response) => !response.body.includes("managementToken")),
    ).toBe(true);
  });

  it.each([undefined, "short", " ".repeat(16), "x".repeat(129)])(
    "requires a bounded valid idempotency key %#",
    async (key) => {
      const response = await harness.app.inject({
        method: "POST",
        url: "/v1/transfers",
        headers: key === undefined ? {} : { "idempotency-key": key },
        payload: createBody,
      });
      expect(response.statusCode).toBe(400);
    },
  );

  it("enforces independent, transfer-scoped management and public capabilities", async () => {
    const first = await created();
    const second = await created();
    const publicToken = new URL(first.shareUrl).pathname.split("/").at(-1);
    for (const token of [
      "",
      "Bearer wrong",
      `Bearer ${publicToken}`,
      `Bearer ${second.managementToken}`,
    ]) {
      expect((await complete(first, token)).statusCode).toBe(401);
      const response = await harness.app.inject({
        method: "DELETE",
        url: `/v1/transfers/${first.transferId}`,
        headers: { authorization: token },
      });
      expect(response.statusCode).toBe(401);
    }
    const cookieOnly = await harness.app.inject({
      method: "POST",
      url: `/v1/transfers/${first.transferId}/complete`,
      headers: { cookie: `grant=${first.managementToken}` },
    });
    expect(cookieOnly.statusCode).toBe(401);
    await upload(first);
    await complete(first);
    expect(
      (
        await harness.app.inject({
          method: "GET",
          url: `/v1/public/transfers/${first.managementToken}`,
        })
      ).statusCode,
    ).toBe(404);
  });

  it.each(["missing", "wrong-size", "aborted"])(
    "fails %s upload, deletes objects, and never exposes metadata",
    async (kind) => {
      const result = await created({
        files: [descriptor, { ...descriptor, name: "second.txt" }],
      });
      if (kind === "wrong-size") await upload(result, 4);
      if (kind === "aborted") {
        const record = await harness.repository.findById(result.transferId);
        const first = record?.files[0];
        if (first === undefined) throw new Error("Missing file");
        transport.objects.set(first.storageKey, 3);
      }
      expect((await complete(result)).statusCode).toBe(409);
      expect(
        (await harness.repository.findById(result.transferId))?.status,
      ).toBe("FAILED");
      expect((await metadata(result)).statusCode).toBe(404);
      expect(transport.objects.size).toBe(0);
    },
  );

  it("rejects client-supplied extra files and keys at completion", async () => {
    const result = await created();
    await upload(result);
    for (const payload of [
      { fileIds: [randomUUID()] },
      { storageKey: "extra" },
      [],
      null,
    ]) {
      const response = await harness.app.inject({
        method: "POST",
        url: `/v1/transfers/${result.transferId}/complete`,
        headers: {
          authorization: `Bearer ${result.managementToken}`,
          "content-type": "application/json",
        },
        payload: JSON.stringify(payload),
      });
      expect(response.statusCode).toBe(400);
    }
    expect(transport.heads).toBe(0);
    expect((await harness.repository.findById(result.transferId))?.status).toBe(
      "UPLOADING",
    );
  });

  it("bounds verification to three HEADs and gives competing completion the current state", async () => {
    const result = await created({
      files: Array.from({ length: 10 }, () => descriptor),
    });
    await upload(result);
    const gate = deferred();
    const entered = deferred();
    transport.beforeHead = () => {
      entered.resolve();
      return gate.promise;
    };
    const pending = complete(result);
    await entered.promise;
    try {
      expect((await complete(result)).json()).toEqual({ status: "VERIFYING" });
      expect(transport.maxActive).toBeLessThanOrEqual(3);
    } finally {
      gate.resolve();
    }
    expect((await pending).json()).toEqual({ status: "READY" });
    expect(transport.heads).toBe(10);
    expect(transport.maxActive).toBe(3);
  });

  it.each(["cancel", "expire"])(
    "cannot publish READY when %s wins during HEAD",
    async (action) => {
      const result = await created();
      await upload(result);
      const gate = deferred();
      const entered = deferred();
      transport.beforeHead = () => {
        entered.resolve();
        return gate.promise;
      };
      const pending = complete(result);
      await entered.promise;
      try {
        if (action === "cancel")
          expect((await cancel(result)).statusCode).toBe(204);
        else await expire(result.transferId);
      } finally {
        gate.resolve();
      }
      expect((await pending).statusCode).toBe(action === "expire" ? 404 : 409);
      expect((await metadata(result)).statusCode).toBe(404);
      const record = await harness.repository.findById(result.transferId);
      expect(record?.status).not.toBe("READY");
      expect(record?.files.some((file) => file.status === "VERIFIED")).toBe(
        false,
      );
    },
  );

  it("uses expiry on complete, cancel and already-ready metadata", async () => {
    const result = await created();
    await upload(result);
    await complete(result);
    await expire(result.transferId);
    expect((await complete(result)).statusCode).toBe(404);
    expect((await cancel(result)).statusCode).toBe(404);
    expect((await metadata(result)).statusCode).toBe(404);
  });

  it("returns only a locked state for protected records and exposes no unlock/download route", async () => {
    const result = await created();
    await upload(result);
    await complete(result);
    await harness.db
      .update(transfers)
      .set({ passwordHash: "test-password-hash-sentinel" })
      .where(eq(transfers.id, result.transferId));
    expect((await metadata(result)).json()).toEqual({ passwordRequired: true });
    const token = new URL(result.shareUrl).pathname.split("/").at(-1);
    for (const route of ["unlock", "download-urls"]) {
      expect(
        (
          await harness.app.inject({
            method: "POST",
            url: `/v1/public/transfers/${token}/${route}`,
            payload: {},
          })
        ).statusCode,
      ).toBe(404);
    }
  });

  it("sanitizes provider failures, releases verification for retry, and never logs credentials", async () => {
    const log = vi.spyOn(console, "error");
    const result = await created();
    await upload(result);
    transport.failHead = true;
    const failure = await complete(result);
    expect(failure.statusCode).toBe(503);
    expect(failure.headers["retry-after"]).toBe("5");
    expect(failure.body).not.toContain("private-provider-sentinel");
    expect(failure.body).not.toContain(result.managementToken);
    expect(log).not.toHaveBeenCalled();
    transport.failHead = false;
    expect((await complete(result)).json()).toEqual({ status: "READY" });
    expect(harness.service.metrics().storage_unavailable).toBeGreaterThan(0);
  });

  it("recovers a crashed verifier after the lease expires", async () => {
    const result = await created();
    await upload(result);
    const record = await harness.repository.findById(result.transferId);
    if (record === null) throw new Error("Missing transfer");
    expect(await harness.repository.claimVerification(record)).not.toBeNull();
    expect((await complete(result)).json()).toEqual({ status: "VERIFYING" });
    expect(transport.heads).toBe(0);
    await harness.db
      .update(transfers)
      .set({ verificationClaimUntil: new Date(0) })
      .where(eq(transfers.id, result.transferId));
    expect((await complete(result)).json()).toEqual({ status: "READY" });
  });

  it.each(["cancel", "failed"])(
    "retries cleanup for %s after deletion failure",
    async (operation) => {
      const result = await created();
      await upload(result, operation === "failed" ? 4 : 3);
      transport.failDelete = true;
      expect(
        (await (operation === "cancel" ? cancel(result) : complete(result)))
          .statusCode,
      ).toBe(503);
      expect((await metadata(result)).statusCode).toBe(404);
      transport.failDelete = false;
      expect(
        (await (operation === "cancel" ? cancel(result) : complete(result)))
          .statusCode,
      ).toBe(operation === "cancel" ? 204 : 409);
      expect(transport.objects.size).toBe(0);
    },
  );

  it("does not duplicate creation after signing fails or the original response is lost", async () => {
    const key = randomUUID();
    vi.spyOn(storage, "createUploadCapability").mockRejectedValueOnce(
      new Error("signing-private-sentinel"),
    );
    const response = await create(createBody, key);
    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain("signing-private-sentinel");
    expect((await create(createBody, key)).statusCode).toBe(409);
    expect(await harness.db.select().from(transfers)).toHaveLength(1);
  });

  it("sanitizes body-limit, malformed JSON, unknown paths and rejects query credentials", async () => {
    for (const test of [
      {
        url: "/v1/transfers",
        payload: "{broken-private-sentinel",
        status: 400,
      },
      {
        url: "/v1/transfers",
        payload: JSON.stringify({ text: "x".repeat(33 * 1024) }),
        status: 413,
      },
      {
        url: "/v1/transfers?token=private-sentinel",
        payload: "{}",
        status: 400,
      },
      {
        url: "/v1/public/transfers/private-sentinel/download-urls",
        payload: "{}",
        status: 404,
      },
    ]) {
      const response = await harness.app.inject({
        method: "POST",
        url: test.url,
        headers: {
          "content-type": "application/json",
          "x-request-id": "test-request-123",
        },
        payload: test.payload,
      });
      expect(response.statusCode).toBe(test.status);
      expect(response.json()).toMatchObject({
        error: { requestId: "test-request-123" },
      });
      expect(response.headers["x-request-id"]).toBe("test-request-123");
      expect(response.body).not.toContain("private-sentinel");
    }
  });

  it("refuses to mount the API module outside tests", () => {
    const previous = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "production";
      expect(() => TransferApiModule.forTesting(harness.service)).toThrow(
        "test-only",
      );
      process.env.NODE_ENV = "development";
      expect(() => TransferApiModule.forTesting(harness.service)).toThrow(
        "test-only",
      );
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  it("rejects excess concurrent requests and releases admission after completion", async () => {
    const gate = deferred();
    const entered = deferred();
    let requests = 0;
    vi.spyOn(harness.service, "metadata").mockImplementation(async () => {
      requests++;
      if (requests === 8) entered.resolve();
      await gate.promise;
      return { passwordRequired: true };
    });
    const pending = Array.from({ length: 8 }, () =>
      harness.app.inject({ method: "GET", url: "/v1/public/transfers/test" }),
    );
    const all = Promise.all(pending);
    await entered.promise;
    try {
      const response = await harness.app.inject({
        method: "GET",
        url: "/v1/public/transfers/test",
      });
      expect(response.statusCode).toBe(429);
      expect(response.headers["retry-after"]).toBe("5");
      validateResponse(
        "/public/transfers/{token}",
        "get",
        429,
        response.json<unknown>(),
      );
    } finally {
      gate.resolve();
    }
    expect((await all).every((response) => response.statusCode === 200)).toBe(
      true,
    );
    expect(
      (
        await harness.app.inject({
          method: "GET",
          url: "/v1/public/transfers/test",
        })
      ).statusCode,
    ).toBe(200);
  });

  it("rejects stale lease publication and release after a new verifier takes ownership", async () => {
    const result = await created();
    const record = await harness.repository.findById(result.transferId);
    if (record === null) throw new Error("Missing fixture");
    const oldClaim = await harness.repository.claimVerification(record);
    if (oldClaim === null) throw new Error("Missing first claim");
    await harness.db
      .update(transfers)
      .set({ verificationClaimUntil: new Date(0) })
      .where(eq(transfers.id, result.transferId));
    const nextClaim = await harness.repository.claimVerification(oldClaim);
    if (nextClaim === null) throw new Error("Missing new claim");
    await harness.repository.releaseVerification(oldClaim.id, oldClaim.version);
    expect(await harness.repository.publishVerified(oldClaim)).toBe(false);
    expect((await complete(result)).json()).toEqual({ status: "VERIFYING" });
    expect(transport.heads).toBe(0);
    expect(
      (await harness.repository.findById(record.id))?.files.every(
        (file) => file.status === "PENDING",
      ),
    ).toBe(true);
    await harness.repository.releaseVerification(
      nextClaim.id,
      nextClaim.version,
    );
    await upload(result);
    expect((await complete(result)).json()).toEqual({ status: "READY" });
  });

  it("rolls back the idempotency claim when file persistence fails", async () => {
    const first = await created();
    const original = await harness.repository.findById(first.transferId);
    const file = original?.files[0];
    if (file === undefined) throw new Error("Missing fixture");
    const id = randomUUID();
    await expect(
      harness.repository.createOnce({
        transfer: {
          id,
          passwordHash: null,
          publicTokenDigest: harness.capabilities.issue("public").digest,
          managementTokenDigest:
            harness.capabilities.issue("management").digest,
          files: [{ ...file, id: randomUUID() }],
        },
        expiresInHours: 24,
        scopeDigest: harness.capabilities.fingerprint(
          "scope",
          "anonymous-create",
        ),
        keyDigest: harness.capabilities.fingerprint("key", randomUUID()),
        requestFingerprint: harness.capabilities.fingerprint(
          "request",
          "fixture",
        ),
      }),
    ).rejects.toThrow();
    expect(await harness.repository.findById(id)).toBeNull();
    expect(await harness.db.select().from(idempotencyRecords)).toHaveLength(1);
  });

  it("sanitizes unexpected database errors", async () => {
    const result = await created();
    vi.spyOn(harness.repository, "findById").mockRejectedValueOnce(
      new Error("database-password-private-sentinel"),
    );
    const response = await complete(result);
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain("private-sentinel");
  });

  it("attempts every exact-key deletion with bounded fanout despite individual failures", async () => {
    const result = await created({
      files: Array.from({ length: 10 }, () => descriptor),
    });
    await upload(result);
    const remove = storage.deleteObject.bind(storage);
    let attempts = 0;
    vi.spyOn(storage, "deleteObject").mockImplementation(async (reference) => {
      attempts++;
      if (attempts === 1) throw new Error("temporary-delete-failure");
      return remove(reference);
    });
    expect((await cancel(result)).statusCode).toBe(503);
    expect(attempts).toBe(10);
    expect(transport.objects.size).toBe(1);
    expect((await cancel(result)).statusCode).toBe(204);
    expect(transport.objects.size).toBe(0);
  });
});

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => {
    throw new Error("Deferred not initialized");
  };
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
