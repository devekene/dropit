import { TransferDomainError } from "./errors";
import { normalizeFilename } from "./filename";

export const MAX_FILES_PER_TRANSFER = 10;
export const MAX_FILE_SIZE_BYTES = 100_000_000;
export const MAX_TRANSFER_SIZE_BYTES = 500_000_000;
export const MIN_EXPIRY_HOURS = 1;
export const DEFAULT_EXPIRY_HOURS = 24;
export const MAX_EXPIRY_HOURS = 168;

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;

export interface TransferFileDescriptor {
  originalFilename: string;
  sizeBytes: number;
}

export interface ValidatedTransferFile {
  originalFilename: string;
  sizeBytes: number;
}

export interface ValidatedTransferFiles {
  files: ValidatedTransferFile[];
  totalBytes: number;
}

export function validateTransferFiles(
  files: readonly TransferFileDescriptor[],
): ValidatedTransferFiles {
  if (files.length < 1 || files.length > MAX_FILES_PER_TRANSFER) {
    throw new TransferDomainError(
      "INVALID_FILE_SET",
      `A transfer must contain 1–${MAX_FILES_PER_TRANSFER} files`,
    );
  }

  let totalBytes = 0;
  const validatedFiles = files.map((file) => {
    if (
      !Number.isSafeInteger(file.sizeBytes) ||
      file.sizeBytes < 1 ||
      file.sizeBytes > MAX_FILE_SIZE_BYTES
    ) {
      throw new TransferDomainError(
        "INVALID_FILE_SET",
        `Each file must contain 1–${MAX_FILE_SIZE_BYTES} bytes`,
      );
    }

    totalBytes += file.sizeBytes;
    if (totalBytes > MAX_TRANSFER_SIZE_BYTES) {
      throw new TransferDomainError(
        "INVALID_FILE_SET",
        `Transfer size must not exceed ${MAX_TRANSFER_SIZE_BYTES} bytes`,
      );
    }

    return {
      originalFilename: normalizeFilename(file.originalFilename),
      sizeBytes: file.sizeBytes,
    };
  });

  return { files: validatedFiles, totalBytes };
}

export function calculateExpiresAt(
  createdAt: Date,
  expiresInHours = DEFAULT_EXPIRY_HOURS,
): Date {
  assertValidDate(createdAt, "Creation time");
  if (
    !Number.isSafeInteger(expiresInHours) ||
    expiresInHours < MIN_EXPIRY_HOURS ||
    expiresInHours > MAX_EXPIRY_HOURS
  ) {
    throw new TransferDomainError(
      "INVALID_EXPIRY",
      `Expiry must be an integer from ${MIN_EXPIRY_HOURS} to ${MAX_EXPIRY_HOURS} hours`,
    );
  }

  return new Date(createdAt.getTime() + expiresInHours * MILLISECONDS_PER_HOUR);
}

export function assertValidDate(value: Date, label: string): void {
  if (!Number.isFinite(value.getTime())) {
    throw new TransferDomainError(
      "INVALID_INVARIANT",
      `${label} must be a valid date`,
    );
  }
}
