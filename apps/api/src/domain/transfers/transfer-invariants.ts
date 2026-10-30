import { TransferDomainError } from "./errors";
import type { TransferWithFiles } from "./transfer-repository";
import {
  MAX_EXPIRY_HOURS,
  MIN_EXPIRY_HOURS,
  assertValidDate,
  validateTransferFiles,
} from "./transfer-policy";

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;

export function assertTransferInvariants(transfer: TransferWithFiles): void {
  if (transfer.id.trim().length === 0) {
    fail("Transfer ID must not be empty");
  }
  if (!Number.isSafeInteger(transfer.version) || transfer.version < 0) {
    fail("Transfer version must be a nonnegative safe integer");
  }
  if (
    transfer.publicTokenDigest.byteLength !== 32 ||
    transfer.managementTokenDigest.byteLength !== 32
  ) {
    fail("Stored capability digests must be 32 bytes");
  }

  assertValidDate(transfer.createdAt, "Creation time");
  assertValidDate(transfer.expiresAt, "Transfer expiry");
  const lifetime = transfer.expiresAt.getTime() - transfer.createdAt.getTime();
  if (
    lifetime < MIN_EXPIRY_HOURS * MILLISECONDS_PER_HOUR ||
    lifetime > MAX_EXPIRY_HOURS * MILLISECONDS_PER_HOUR
  ) {
    fail(
      `Transfer lifetime must be ${MIN_EXPIRY_HOURS}–${MAX_EXPIRY_HOURS} hours`,
    );
  }

  const validatedFiles = validateTransferFiles(transfer.files).files;
  const fileIds = new Set<string>();
  const storageKeys = new Set<string>();
  for (const [index, file] of transfer.files.entries()) {
    if (validatedFiles[index]?.originalFilename !== file.originalFilename) {
      fail("Stored filenames must use their normalized form");
    }
    if (file.transferId !== transfer.id) {
      fail("Every file must belong to the transfer");
    }
    if (file.id.trim().length === 0 || fileIds.has(file.id)) {
      fail("File IDs must be nonempty and unique within a transfer");
    }
    fileIds.add(file.id);
    if (
      file.storageKey.trim().length === 0 ||
      storageKeys.has(file.storageKey)
    ) {
      fail("Storage keys must be nonempty and unique within a transfer");
    }
    storageKeys.add(file.storageKey);

    if (file.status === "VERIFIED") {
      if (file.verifiedAt === null) {
        fail("A verified file must have a verification time");
      }
      assertValidDate(file.verifiedAt, "File verification time");
      if (
        file.verifiedAt.getTime() < transfer.createdAt.getTime() ||
        file.verifiedAt.getTime() >= transfer.expiresAt.getTime()
      ) {
        fail("File verification time must be within the transfer lifetime");
      }
    } else if (file.verifiedAt !== null) {
      fail("Only a verified file may have a verification time");
    }
  }

  if (transfer.status === "READY") {
    const completedAt = transfer.completedAt;
    if (completedAt === null) {
      fail("A ready transfer must have a completion time");
    }
    assertValidDate(completedAt, "Completion time");
    if (
      completedAt.getTime() < transfer.createdAt.getTime() ||
      completedAt.getTime() >= transfer.expiresAt.getTime()
    ) {
      fail("Completion time must be within the transfer lifetime");
    }
    if (transfer.files.some((file) => file.status !== "VERIFIED")) {
      fail("Every file in a ready transfer must be verified");
    }
    if (
      transfer.files.some(
        (file) =>
          file.verifiedAt !== null &&
          file.verifiedAt.getTime() > completedAt.getTime(),
      )
    ) {
      fail("A transfer cannot complete before its files are verified");
    }
  }
}

function fail(message: string): never {
  throw new TransferDomainError("INVALID_INVARIANT", message);
}
