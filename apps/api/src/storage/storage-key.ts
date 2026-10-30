import { randomUUID } from "node:crypto";
import type { StorageObjectReference } from "../domain/storage/object-storage";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const STORAGE_KEY_PATTERN =
  /^v1\/transfers\/([0-9a-f-]{36})\/files\/([0-9a-f-]{36})\/([0-9a-f-]{36})$/;

export class StorageKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageKeyError";
  }
}

export function createStorageKey(transferId: string, fileId: string): string {
  const normalizedTransferId = normalizeUuid(transferId, "Transfer ID");
  const normalizedFileId = normalizeUuid(fileId, "File ID");
  return `v1/transfers/${normalizedTransferId}/files/${normalizedFileId}/${randomUUID()}`;
}

export function assertStorageKeyOwnership(
  reference: StorageObjectReference,
): void {
  const transferId = normalizeUuid(reference.transferId, "Transfer ID");
  const fileId = normalizeUuid(reference.fileId, "File ID");
  const match = STORAGE_KEY_PATTERN.exec(reference.storageKey);
  if (
    match === null ||
    match[1] !== transferId ||
    match[2] !== fileId ||
    match[3] === undefined ||
    !UUID_PATTERN.test(match[3])
  ) {
    throw new StorageKeyError(
      "Storage key does not belong to the supplied transfer and file",
    );
  }
}

function normalizeUuid(value: string, label: string): string {
  const normalized = value.toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    throw new StorageKeyError(`${label} must be a UUID`);
  }
  return normalized;
}
