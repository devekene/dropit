import type {
  NewTransferRecord,
  TransferRepository,
  TransferWithFiles,
} from "./transfer-repository";

export interface CreateOnceInput {
  transfer: Omit<NewTransferRecord, "expiresAt">;
  expiresInHours: number;
  scopeDigest: Uint8Array;
  keyDigest: Uint8Array;
  requestFingerprint: Uint8Array;
}

/** All authorization reads and lease/state writes use the database clock. */
export interface TransferApiRepository extends TransferRepository {
  createOnce(input: CreateOnceInput): Promise<TransferWithFiles | null>;
  findActiveById(id: string): Promise<TransferWithFiles | null>;
  findPublic(digest: Uint8Array): Promise<TransferWithFiles | null>;
  claimVerification(
    record: TransferWithFiles,
  ): Promise<TransferWithFiles | null>;
  releaseVerification(id: string, version: number): Promise<void>;
  publishVerified(record: TransferWithFiles): Promise<boolean>;
}
