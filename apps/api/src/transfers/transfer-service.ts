import { randomUUID } from "node:crypto";
import type { ObjectStorage } from "../domain/storage/object-storage";
import type { TransferApiRepository } from "../domain/transfers/transfer-api-repository";
import type { TransferWithFiles } from "../domain/transfers/transfer-repository";
import { createStorageKey } from "../storage/storage-key";
import { TransferApiError } from "./api-error";
import { boundedMap } from "./bounded-map";
import { Capabilities } from "./capabilities";
import type {
  CompleteTransferResponse,
  CreatedTransferResponse,
  CreateTransferRequest,
  PublicTransferResponse,
} from "./transfer-contract";

type Event =
  | "created"
  | "duplicate"
  | "ready"
  | "verification_failed"
  | "cancelled"
  | "storage_unavailable";

export class TransferService {
  private readonly events: Record<Event, number> = {
    created: 0,
    duplicate: 0,
    ready: 0,
    verification_failed: 0,
    cancelled: 0,
    storage_unavailable: 0,
  };
  private readonly webOrigin: string;

  constructor(
    private readonly repository: TransferApiRepository,
    private readonly storage: ObjectStorage,
    private readonly capabilities: Capabilities,
    webOrigin: string,
  ) {
    const origin = new URL(webOrigin);
    if (
      origin.origin !== webOrigin ||
      !["http:", "https:"].includes(origin.protocol)
    )
      throw new Error("Invalid web origin");
    this.webOrigin = webOrigin;
  }

  metrics(): Readonly<Record<Event, number>> {
    return { ...this.events };
  }

  async create(
    body: CreateTransferRequest,
    idempotencyKey: string,
  ): Promise<CreatedTransferResponse> {
    const management = this.capabilities.issue("management");
    const publicCapability = this.capabilities.issue("public");
    const id = randomUUID();
    const record = await this.repository.createOnce({
      transfer: {
        id,
        managementTokenDigest: management.digest,
        publicTokenDigest: publicCapability.digest,
        passwordHash: null,
        files: body.files.map((file) => {
          const fileId = randomUUID();
          return {
            id: fileId,
            originalFilename: file.name,
            sizeBytes: file.size,
            contentTypeClaimed: file.contentType,
            storageKey: createStorageKey(id, fileId),
          };
        }),
      },
      expiresInHours: body.expiresInHours,
      scopeDigest: this.capabilities.fingerprint("scope", "anonymous-create"),
      keyDigest: this.capabilities.fingerprint("key", idempotencyKey),
      requestFingerprint: this.capabilities.fingerprint(
        "request",
        JSON.stringify(body),
      ),
    });
    if (record === null) {
      this.events.duplicate++;
      throw new TransferApiError("CONFLICT");
    }
    try {
      const files = await boundedMap(record.files, async (file) => {
        const capability = await this.storage.createUploadCapability({
          transferId: id,
          fileId: file.id,
          storageKey: file.storageKey,
          contentType: file.contentTypeClaimed,
          expectedSizeBytes: file.sizeBytes,
        });
        return {
          id: file.id,
          uploadUrl: capability.url,
          uploadMethod: capability.method,
          uploadHeaders: capability.requiredHeaders,
          uploadExpiresAt: capability.expiresAt.toISOString(),
        };
      });
      this.events.created++;
      return {
        transferId: id,
        managementToken: management.token,
        shareUrl: `${this.webOrigin}/t/${publicCapability.token}`,
        expiresAt: record.expiresAt.toISOString(),
        files,
      };
    } catch {
      await this.repository.transition({
        id,
        from: "UPLOADING",
        to: "FAILED",
        expectedVersion: record.version,
      });
      throw this.storageUnavailable();
    }
  }

  async complete(id: string, token: string): Promise<CompleteTransferResponse> {
    const record = await this.authorize(id, token);
    if (record.status === "READY") return { status: "READY" };
    if (record.status === "FAILED") {
      await this.deleteObjects(record);
      throw new TransferApiError("CONFLICT");
    }
    if (!["UPLOADING", "VERIFYING"].includes(record.status))
      throw new TransferApiError("CONFLICT");
    const claimed = await this.repository.claimVerification(record);
    if (claimed === null || claimed.status !== "VERIFYING")
      return this.currentCompletion(id, token);

    let results;
    try {
      results = await boundedMap(claimed.files, (file) =>
        this.storage.verifyObject({
          transferId: id,
          fileId: file.id,
          storageKey: file.storageKey,
          expectedSizeBytes: file.sizeBytes,
          signal: AbortSignal.timeout(10_000),
        }),
      );
    } catch {
      await this.repository.releaseVerification(id, claimed.version);
      throw this.storageUnavailable();
    }
    if (results.length === 0 || results.some((result) => !result.ok)) {
      const failed = await this.repository.transition({
        id,
        from: "VERIFYING",
        to: "FAILED",
        expectedVersion: claimed.version,
      });
      if (failed === null) return this.currentCompletion(id, token);
      this.events.verification_failed++;
      await this.deleteObjects(failed);
      throw new TransferApiError("CONFLICT");
    }
    if (!(await this.repository.publishVerified(claimed)))
      return this.currentCompletion(id, token);
    this.events.ready++;
    return { status: "READY" };
  }

  async cancel(id: string, token: string): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const record = await this.authorize(id, token);
      if (record.status === "CANCELLED") return this.deleteObjects(record);
      if (
        !["CREATED", "UPLOADING", "VERIFYING", "READY"].includes(record.status)
      )
        throw new TransferApiError("CONFLICT");
      const cancelled = await this.repository.transition({
        id,
        from: record.status,
        to: "CANCELLED",
        expectedVersion: record.version,
      });
      if (cancelled !== null) {
        this.events.cancelled++;
        return this.deleteObjects(cancelled);
      }
    }
    throw new TransferApiError("CONFLICT");
  }

  async metadata(token: string): Promise<PublicTransferResponse> {
    const digest = this.capabilities.digest("public", token);
    if (digest === null) throw new TransferApiError("NOT_FOUND");
    const record = await this.repository.findPublic(digest);
    if (record === null) throw new TransferApiError("NOT_FOUND");
    if (record.passwordHash !== null) return { passwordRequired: true };
    return {
      passwordRequired: false,
      expiresAt: record.expiresAt.toISOString(),
      files: record.files.map((file) => ({
        id: file.id,
        name: file.originalFilename,
        size: file.sizeBytes,
      })),
    };
  }

  private async authorize(
    id: string,
    token: string,
  ): Promise<TransferWithFiles> {
    const record = await this.repository.findById(id);
    if (
      record === null ||
      !this.capabilities.matches(
        "management",
        token,
        record.managementTokenDigest,
      )
    )
      throw new TransferApiError("UNAUTHORIZED");
    const active = await this.repository.findActiveById(id);
    if (active === null) throw new TransferApiError("NOT_FOUND");
    return active;
  }

  private async currentCompletion(
    id: string,
    token: string,
  ): Promise<CompleteTransferResponse> {
    const record = await this.authorize(id, token);
    if (record.status === "READY" || record.status === "VERIFYING")
      return { status: record.status };
    throw new TransferApiError("CONFLICT");
  }

  private async deleteObjects(record: TransferWithFiles): Promise<void> {
    try {
      await boundedMap(record.files, (file) =>
        this.storage.deleteObject({
          transferId: record.id,
          fileId: file.id,
          storageKey: file.storageKey,
          signal: AbortSignal.timeout(10_000),
        }),
      );
    } catch {
      throw this.storageUnavailable();
    }
  }

  private storageUnavailable(): TransferApiError {
    this.events.storage_unavailable++;
    return new TransferApiError("STORAGE_UNAVAILABLE");
  }
}
